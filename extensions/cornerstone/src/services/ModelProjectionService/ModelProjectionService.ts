import { PubSubService, Types as OHIFTypes } from '@ohif/core';
import { Enums as cs3DEnums, getRenderingEngine } from '@cornerstonejs/core';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';
import vtkPoints from '@kitware/vtk.js/Common/Core/Points';
import vtkCellArray from '@kitware/vtk.js/Common/Core/CellArray';
import { vec3 } from 'gl-matrix';
import { crosshairsHandler } from '../../utils/crosshairsHandler';
import { RENDERING_ENGINE_ID } from '../ViewportService/constants';

type ProjectionRelation = 'inside' | 'partial' | 'none';

interface SlabROI {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
  dMin: number;
  dMax: number;
}

interface PlaneState {
  viewportId: string;
  center: vec3;
  normal: vec3;
  u: vec3;
  v: vec3;
  roi: SlabROI;
}

interface ProjectionRenderData {
  viewportId: string;
  modelId: string;
  relation: ProjectionRelation;
  worldPoints: Array<[number, number, number]>;
  canvasPoints: Array<[number, number]>;
  canvasBounds: { xMin: number; xMax: number; yMin: number; yMax: number } | null;
  slabBounds: SlabROI | null;
}

const EVENTS = {
  PROJECTION_UPDATED: 'event::model_projection_updated',
};

const COLOR_BY_RELATION: Record<ProjectionRelation, string> = {
  inside: '#18e06f', // bright green
  partial: '#f5a623', // orange/yellow
  none: '#9ea0a6', // muted gray
};

const LOG_PREFIX = '🧭 [ModelProjection]';

/**
 * ModelProjectionService
 *
 * Computes per-model projections into existing orthographic (MPR) viewports and
 * renders lightweight VTK polyline overlays (footprint/bounding box). It does not change
 * cameras or create extra viewports; it only draws on top of the current MPR.
 */
class ModelProjectionService extends PubSubService {
  static REGISTRATION = {
    name: 'modelProjectionService',
    altName: 'ModelProjectionService',
    create: ({ servicesManager }: OHIFTypes.Extensions.ExtensionParams): ModelProjectionService => {
      return new ModelProjectionService({ servicesManager });
    },
  };

  public readonly EVENTS = EVENTS;
  public static readonly EVENTS = EVENTS;

  private readonly servicesManager: any;
  private enabled = true;
  private readonly maxSamplePoints = 1500;
  private overlayActors: Map<string, Map<string, { actor: any; mapper: any; polyData: any }>> =
    new Map(); // viewportId -> (modelId -> vtkActor bundle)
  private cameraListeners: Map<string, (evt?: any) => void> = new Map(); // viewportId -> listener
  private readonly debug = true; // keep console logs active for debugging

  constructor({ servicesManager }) {
    super(EVENTS);
    this.servicesManager = servicesManager;

    this._subscribeToModelEvents();
    this._subscribeToViewportEvents();

    this._log('Initialized ModelProjectionService');
  }

  /**
   * Enable/disable overlays. Disabling clears existing overlays.
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this._clearAllOverlays();
      this._log('Disabled overlays; cleared all VTK overlays');
    } else {
      this._log('Enabled overlays; triggering full projection update');
      this.updateAllProjections();
    }
  }

  /**
   * Recompute projections for all orthographic viewports.
   */
  public updateAllProjections(): void {
    if (!this.enabled) {
      this._log('Skipping updateAllProjections (disabled)');
      return;
    }

    const renderingEngine = getRenderingEngine(RENDERING_ENGINE_ID);
    if (!renderingEngine) {
      this._warn('Rendering engine not found; cannot update projections');
      return;
    }

    const models = this._getProjectableModels();
    if (!models.length) {
      this._clearAllOverlays();
      this._log('No projectable models found; overlays cleared');
      return;
    }

    const viewports = renderingEngine.getViewports();
    // this._log(`Updating projections for ${viewports.length} viewports, ${models.length} models`);
    viewports.forEach(viewport => this._updateProjectionForViewport(viewport, models));
  }

  /**
   * Recompute projection for a single viewport (by id).
   */
  public updateProjectionsForViewport(viewportId: string): void {
    const renderingEngine = getRenderingEngine(RENDERING_ENGINE_ID);
    const viewport = renderingEngine?.getViewport?.(viewportId);

    if (!viewport) {
      this._removeViewportOverlay(viewportId);
      this._warn(`Viewport ${viewportId} not found; cleared overlay`);
      return;
    }

    const models = this._getProjectableModels();
    if (!models.length) {
      this._removeViewportOverlay(viewportId);
    //   this._log(`Skipping projection update for viewport ${viewportId} (no models)`);
      return;
    }

    // this._log(`Updating projections for viewport ${viewportId} with ${models.length} models`);
    this._updateProjectionForViewport(viewport, models);
  }

  private _subscribeToModelEvents(): void {
    const { modelStateService } = this.servicesManager.services;
    if (!modelStateService?.subscribe) {
      this._warn('ModelStateService not available; projection updates will be incomplete');
      return;
    }

    const modelEvents = modelStateService.EVENTS || {};
    const eventNames = [
      modelEvents.MODEL_ADDED,
      modelEvents.MODEL_REMOVED,
      modelEvents.MODEL_UPDATED,
      modelEvents.MODEL_VISIBILITY_CHANGED,
      modelEvents.MODELS_CLEARED,
    ].filter(Boolean);

    eventNames.forEach(eventName => {
      modelStateService.subscribe(eventName, () => {
        // this._log(`Model event "${eventName}" received; refreshing projections`);
        this.updateAllProjections();
      });
    });
  }

  private _subscribeToViewportEvents(): void {
    const { cornerstoneViewportService } = this.servicesManager.services;
    if (!cornerstoneViewportService?.subscribe) {
      this._warn('CornerstoneViewportService not available; projection updates may miss viewport changes');
      return;
    }

    const viewportEvents = cornerstoneViewportService.EVENTS || {};

    [viewportEvents.VIEWPORT_PROPERTIES_CHANGED, viewportEvents.VIEWPORT_DATA_CHANGED]
      .filter(Boolean)
      .forEach(eventName => {
        cornerstoneViewportService.subscribe(eventName, ({ viewportId }) => {
          this._log(`Viewport event "${eventName}" for ${viewportId}; refreshing projections for viewport`);
          this.updateProjectionsForViewport(viewportId);
        });
      });
  }

  private _getProjectableModels(): any[] {
    const { modelStateService } = this.servicesManager.services;
    if (!modelStateService?.getAllModels) {
      this._warn('ModelStateService.getAllModels unavailable');
      return [];
    }

    // Only project models that are currently visible
    const all = modelStateService.getAllModels() || [];
    const visible = all.filter(model => model?.metadata?.visible !== false);
    // this._log(`Projectable models: ${visible.length}/${all.length} visible`);
    return visible;
  }

  private _updateProjectionForViewport(viewport: any, models: any[]): void {
    if (!this.enabled || !viewport) {
      return;
    }

    // Skip stack and 3D viewports; only orthographic MPRs are supported
    if (viewport.type === 'stack') {
      this._log(`Skipping stack viewport ${viewport.id}`);
      this._removeViewportOverlay(viewport.id);
      return;
    }

    const viewportClassName = viewport.constructor?.name || '';
    if (viewportClassName === 'VolumeViewport3D' || viewport.type === cs3DEnums.ViewportType.VOLUME_3D) {
      this._log(`Skipping 3D viewport ${viewport.id}`);
      this._removeViewportOverlay(viewport.id);
      return;
    }

    const planeState = this._getPlaneState(viewport);
    if (!planeState) {
      this._warn(`Plane state unavailable for viewport ${viewport.id}; clearing overlay`);
      this._removeViewportOverlay(viewport.id);
      return;
    }

    this._ensureCameraListener(viewport);

    const processedModels = new Set<string>();

    models.forEach(model => {
      const data = this._computeProjectionForModel(viewport, planeState, model);
      processedModels.add(model?.metadata?.id || model?.metadata?.modelId || 'unknown');
      this._renderOverlay(viewport, planeState, data);
    });

    this._pruneStaleModelOverlays(viewport.id, processedModels);

    this._broadcastEvent(EVENTS.PROJECTION_UPDATED, { viewportId: viewport.id });
    // this._log(`Projection updated for viewport ${viewport.id}`);
  }

  private _getPlaneState(viewport: any): PlaneState | null {
    try {
      const camera = viewport.getCamera?.();
      if (!camera) {
        return null;
      }

      const normal = vec3.normalize(vec3.create(), camera.viewPlaneNormal || [0, 0, 1]);
      let up = vec3.normalize(vec3.create(), camera.viewUp || [0, 1, 0]);
      let right = vec3.cross(vec3.create(), normal, up);

      if (vec3.length(right) < 1e-6) {
        right = vec3.fromValues(1, 0, 0);
      } else {
        vec3.normalize(right, right);
      }

      // Re-orthogonalize up to ensure a clean basis
      up = vec3.cross(vec3.create(), right, normal);
      vec3.normalize(up, up);

      const crosshairCenter = crosshairsHandler.getCrosshairCenter?.();
      const center =
        (crosshairCenter && crosshairCenter.length === 3 && crosshairCenter) ||
        camera.focalPoint ||
        null;

      if (!center) {
        return null;
      }

      // Slab thickness and half-thickness
      const properties = viewport.getProperties?.();
      const slabThickness = properties?.slabThickness ?? 0;
      const halfThickness = slabThickness / 2;

      // In-plane extents based on camera parallel scale and canvas aspect
      const element = viewport.element as HTMLElement;
      const canvas = element?.querySelector('canvas') as HTMLCanvasElement;
      const aspect =
        canvas && canvas.height !== 0 ? canvas.width / canvas.height : (camera.aspectRatio || 1) || 1;

      const halfHeight = camera.parallelScale || 200;
      const halfWidth = halfHeight * aspect;

      const roi: SlabROI = {
        uMin: -halfWidth,
        uMax: halfWidth,
        vMin: -halfHeight,
        vMax: halfHeight,
        dMin: -halfThickness,
        dMax: halfThickness,
      };

      return {
        viewportId: viewport.id,
        center: vec3.fromValues(center[0], center[1], center[2]),
        normal,
        u: right,
        v: up,
        roi,
      };
    } catch (error) {
      this._warn(`Unable to build plane state: ${error}`);
      return null;
    }
  }

  private _computeProjectionForModel(
    viewport: any,
    plane: PlaneState,
    model: any
  ): ProjectionRenderData {
    const modelId = model?.metadata?.id || model?.metadata?.modelId || 'unknown';
    const sample = this._getModelSamplePoints(model);

    if (!sample) {
      return {
        viewportId: viewport.id,
        modelId,
        relation: 'none',
        worldPoints: [],
        canvasPoints: [],
        canvasBounds: null,
        slabBounds: null,
      };
    }

    const slabPoints = sample.points.map(p => this._toSlabCoords(p, plane));
    const slabBounds = this._buildSlabBounds(slabPoints);
    const relation = this._classify(slabBounds, plane.roi);
    // this._log(`Model ${modelId} relation=${relation} (viewport=${viewport.id})`);

    if (relation === 'none') {
      return {
        viewportId: viewport.id,
        modelId,
        relation,
        worldPoints: [],
        canvasPoints: [],
        canvasBounds: null,
        slabBounds,
      };
    }

    const worldPoints: Array<[number, number, number]> = [];
    const canvasPoints: Array<[number, number]> = [];
    for (let i = 0; i < sample.points.length; i++) {
      const d = slabPoints[i].d;
      if (d < plane.roi.dMin || d > plane.roi.dMax) {
        continue;
      }

      const w = this._slabToWorldPoint(slabPoints[i], plane);
      worldPoints.push(w);

      // Optional canvas mapping retained for diagnostics
      const canvasPoint = viewport.worldToCanvas?.(w);
      if (canvasPoint && canvasPoint.length >= 2) {
        const [x, y] = canvasPoint;
        if (Number.isFinite(x) && Number.isFinite(y)) {
          canvasPoints.push([x, y]);
        }
      }
    }

    return {
      viewportId: viewport.id,
      modelId,
      relation,
      worldPoints,
      canvasPoints,
      canvasBounds: null,
      slabBounds,
    };
  }

  private _slabToWorldPoint(
    slab: { u: number; v: number; d: number },
    plane: PlaneState
  ): [number, number, number] {
    const w = vec3.create();
    const offsetU = vec3.scale(vec3.create(), plane.u, slab.u);
    const offsetV = vec3.scale(vec3.create(), plane.v, slab.v);
    vec3.add(w, plane.center, offsetU);
    vec3.add(w, w, offsetV);
    return [w[0], w[1], w[2]];
  }

  private _toSlabCoords(point: number[], plane: PlaneState): { u: number; v: number; d: number } {
    const p = vec3.fromValues(point[0], point[1], point[2]);
    const diff = vec3.subtract(vec3.create(), p, plane.center);
    return {
      u: vec3.dot(diff, plane.u),
      v: vec3.dot(diff, plane.v),
      d: vec3.dot(diff, plane.normal),
    };
  }

  private _buildSlabBounds(points: Array<{ u: number; v: number; d: number }>): SlabROI {
    let uMin = Infinity;
    let uMax = -Infinity;
    let vMin = Infinity;
    let vMax = -Infinity;
    let dMin = Infinity;
    let dMax = -Infinity;

    points.forEach(p => {
      uMin = Math.min(uMin, p.u);
      uMax = Math.max(uMax, p.u);
      vMin = Math.min(vMin, p.v);
      vMax = Math.max(vMax, p.v);
      dMin = Math.min(dMin, p.d);
      dMax = Math.max(dMax, p.d);
    });

    return { uMin, uMax, vMin, vMax, dMin, dMax };
  }

  private _classify(bounds: SlabROI, roi: SlabROI): ProjectionRelation {
    if (!bounds) {
      return 'none';
    }

    const noOverlap =
      bounds.uMax < roi.uMin ||
      bounds.uMin > roi.uMax ||
      bounds.vMax < roi.vMin ||
      bounds.vMin > roi.vMax ||
      bounds.dMax < roi.dMin ||
      bounds.dMin > roi.dMax;

    if (noOverlap) {
      return 'none';
    }

    const inside =
      bounds.uMin >= roi.uMin &&
      bounds.uMax <= roi.uMax &&
      bounds.vMin >= roi.vMin &&
      bounds.vMax <= roi.vMax &&
      bounds.dMin >= roi.dMin &&
      bounds.dMax <= roi.dMax;

    return inside ? 'inside' : 'partial';
  }

  private _renderOverlay(viewport: any, plane: PlaneState, data: ProjectionRenderData): void {
    const { modelId, relation, worldPoints, slabBounds } = data;
    const viewportId = viewport.id;

    if (relation === 'none' || worldPoints.length === 0) {
      this._removeModelOverlay(viewportId, modelId);
      return;
    }

    const polyline = this._buildWorldPolyline(worldPoints, slabBounds, plane);
    if (!polyline.length) {
      this._removeModelOverlay(viewportId, modelId);
      return;
    }

    const color = COLOR_BY_RELATION[relation];
    const actorBundle = this._getOrCreateOverlayActor(viewport, modelId, color);
    this._updateOverlayPolyData(actorBundle.polyData, polyline);

    // Force render to show updates
    viewport.render?.();
    this._log(`Rendered VTK overlay for model ${modelId} in viewport ${viewportId} (relation=${relation})`);
  }

  private _buildWorldPolyline(
    worldPoints: Array<[number, number, number]>,
    slabBounds: SlabROI | null,
    plane: PlaneState
  ): Array<[number, number, number]> {
    if (worldPoints.length >= 2) {
      return this._closePolyline(worldPoints);
    }

    if (slabBounds) {
      const { uMin, uMax, vMin, vMax } = slabBounds;
      const corners: Array<[number, number, number]> = [
        this._slabToWorldPoint({ u: uMin, v: vMin, d: 0 }, plane),
        this._slabToWorldPoint({ u: uMax, v: vMin, d: 0 }, plane),
        this._slabToWorldPoint({ u: uMax, v: vMax, d: 0 }, plane),
        this._slabToWorldPoint({ u: uMin, v: vMax, d: 0 }, plane),
      ];
      return this._closePolyline(corners);
    }

    return [];
  }

  private _closePolyline(points: Array<[number, number, number]>): Array<[number, number, number]> {
    if (points.length < 2) {
      return [];
    }
    const result = [...points];
    const first = result[0];
    const last = result[result.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1] || first[2] !== last[2]) {
      result.push([first[0], first[1], first[2]]);
    }
    return result;
  }

  private _getOrCreateOverlayActor(viewport: any, modelId: string, color: string) {
    const viewportId = viewport.id;
    let modelMap = this.overlayActors.get(viewportId);
    if (!modelMap) {
      modelMap = new Map();
      this.overlayActors.set(viewportId, modelMap);
    }

    let bundle = modelMap.get(modelId);
    if (!bundle) {
      const [r, g, b] = this._hexToRgb(color);
      const polyData = vtkPolyData.newInstance();
      const mapper = vtkMapper.newInstance();
      mapper.setInputData(polyData);
      const actor = vtkActor.newInstance();
      actor.setMapper(mapper);

      const prop = actor.getProperty();
      prop.setColor(r, g, b);
      prop.setLineWidth(3);
      prop.setOpacity(0.9);
      prop.setLighting(false);
      prop.setAmbient(1.0);
      prop.setDiffuse(0.0);
      prop.setFrontfaceCulling(false);
      prop.setBackfaceCulling(false);
      (prop as any).setDepthTest?.(false);
      (prop as any).setDisplayLocationToForeground?.();
      (mapper as any).setResolveCoincidentTopologyToPolygonOffset?.();
      (mapper as any).setRelativeCoincidentTopologyLineOffsetParameters?.(-2, -2);

      const renderer = viewport.getRenderer?.();
      if (renderer && renderer.addActor) {
        renderer.addActor(actor);
      }

      bundle = { actor, mapper, polyData };
      modelMap.set(modelId, bundle);
    } else {
      const renderer = viewport.getRenderer?.();
      if (renderer && renderer.addActor && !renderer.hasViewProp(bundle.actor)) {
        renderer.addActor(bundle.actor);
      }
      const [r, g, b] = this._hexToRgb(color);
      bundle.actor.getProperty().setColor(r, g, b);
    }

    return bundle;
  }

  private _updateOverlayPolyData(polyData: any, polyline: Array<[number, number, number]>): void {
    if (!polyline.length) {
      const empty = vtkPoints.newInstance();
      empty.setData(new Float32Array());
      polyData.setPoints(empty);
      polyData.setLines(vtkCellArray.newInstance());
      polyData.modified();
      return;
    }

    const flat = new Float32Array(polyline.length * 3);
    polyline.forEach((p, i) => {
      flat[i * 3 + 0] = p[0];
      flat[i * 3 + 1] = p[1];
      flat[i * 3 + 2] = p[2];
    });

    const points = vtkPoints.newInstance();
    points.setData(flat, 3);

    const lines = vtkCellArray.newInstance();
    const n = polyline.length;
    const cell = new Uint32Array(n + 1);
    cell[0] = n;
    for (let i = 0; i < n; i++) {
      cell[i + 1] = i;
    }
    lines.insertNextCell(Array.from(cell));

    polyData.setPoints(points);
    polyData.setLines(lines);
    polyData.modified();
  }

  private _removeModelOverlay(viewportId: string, modelId: string): void {
    const modelMap = this.overlayActors.get(viewportId);
    if (!modelMap) {
      return;
    }

    const bundle = modelMap.get(modelId);
    if (bundle) {
      try {
        const renderingEngine = getRenderingEngine(RENDERING_ENGINE_ID);
        const viewport = renderingEngine?.getViewport?.(viewportId);
        const renderer = viewport?.getRenderer?.();
        if (renderer?.removeActor) {
          renderer.removeActor(bundle.actor);
        }
      } catch (e) {
        // ignore renderer removal issues
      }

      bundle.actor?.delete?.();
      bundle.mapper?.delete?.();
      bundle.polyData?.delete?.();
      modelMap.delete(modelId);
      this._log(`Removed overlay for model ${modelId} in viewport ${viewportId}`);
    }
  }

  private _pruneStaleModelOverlays(viewportId: string, validIds: Set<string>): void {
    const modelMap = this.overlayActors.get(viewportId);
    if (!modelMap) {
      return;
    }

    Array.from(modelMap.keys()).forEach(modelId => {
      if (!validIds.has(modelId)) {
        this._removeModelOverlay(viewportId, modelId);
      }
    });
  }

  private _removeViewportOverlay(viewportId: string): void {
    const modelMap = this.overlayActors.get(viewportId);
    if (modelMap) {
      Array.from(modelMap.keys()).forEach(modelId => this._removeModelOverlay(viewportId, modelId));
      this.overlayActors.delete(viewportId);
    }

    const listener = this.cameraListeners.get(viewportId);
    if (listener) {
      const renderingEngine = getRenderingEngine(RENDERING_ENGINE_ID);
      const viewport = renderingEngine?.getViewport?.(viewportId);
      viewport?.element?.removeEventListener?.(cs3DEnums.Events.CAMERA_MODIFIED, listener);
      this.cameraListeners.delete(viewportId);
    }
    this._log(`Removed overlay and camera listener for viewport ${viewportId}`);
  }

  private _clearAllOverlays(): void {
    Array.from(this.overlayActors.keys()).forEach(viewportId => this._removeViewportOverlay(viewportId));
    this._log('Cleared all overlays');
  }

  private _getModelSamplePoints(model: any): { points: number[][] } | null {
    // Prefer baked polyData if available
    const polyData = model?.polyData;
    if (polyData?.getPoints) {
      const points = polyData.getPoints();
      const data = points.getData();
      const numPoints = points.getNumberOfPoints?.() || data.length / 3;
      const step = Math.max(1, Math.floor(numPoints / this.maxSamplePoints));
      const sampled: number[][] = [];

      for (let i = 0; i < numPoints; i += step) {
        const idx = i * 3;
        sampled.push([data[idx], data[idx + 1], data[idx + 2]]);
      }

      // Ensure we include bounds corners for classification robustness
      const bounds = polyData.getBounds?.();
      if (bounds && bounds.length === 6) {
        this._boundsToCorners(bounds).forEach(corner => sampled.push(corner));
      }

      return { points: sampled };
    }

    const bounds = model?.actor?.getBounds?.();
    if (bounds && bounds.length === 6) {
      return { points: this._boundsToCorners(bounds) };
    }

    return null;
  }

  private _boundsToCorners(bounds: number[]): number[][] {
    const [xmin, xmax, ymin, ymax, zmin, zmax] = bounds;
    return [
      [xmin, ymin, zmin],
      [xmin, ymin, zmax],
      [xmin, ymax, zmin],
      [xmin, ymax, zmax],
      [xmax, ymin, zmin],
      [xmax, ymin, zmax],
      [xmax, ymax, zmin],
      [xmax, ymax, zmax],
    ];
  }

  private _hexToRgb(hex: string): [number, number, number] {
    const clean = hex.startsWith('#') ? hex.slice(1) : hex;
    if (clean.length === 6) {
      const r = parseInt(clean.slice(0, 2), 16) / 255;
      const g = parseInt(clean.slice(2, 4), 16) / 255;
      const b = parseInt(clean.slice(4, 6), 16) / 255;
      return [r, g, b];
    }
    // fallback to gray
    return [0.6, 0.6, 0.6];
  }

  private _ensureCameraListener(viewport: any): void {
    const viewportId = viewport.id;
    if (this.cameraListeners.has(viewportId)) {
      return;
    }

    if (!viewport?.element || !cs3DEnums?.Events?.CAMERA_MODIFIED) {
      return;
    }

    const listener = () => this.updateProjectionsForViewport(viewportId);
    viewport.element.addEventListener(cs3DEnums.Events.CAMERA_MODIFIED, listener);
    this.cameraListeners.set(viewportId, listener);
    this._log(`Attached CAMERA_MODIFIED listener for viewport ${viewportId}`);
  }

  private _log(message: string): void {
    if (!this.debug) {
      return;
    }
    console.log(`${LOG_PREFIX} ${message}`);
  }

  private _warn(message: string): void {
    if (!this.debug) {
      return;
    }
    console.warn(`${LOG_PREFIX} ${message}`);
  }

  private _error(message: string): void {
    if (!this.debug) {
      return;
    }
    console.error(`${LOG_PREFIX} ${message}`);
  }
}

export default ModelProjectionService;

