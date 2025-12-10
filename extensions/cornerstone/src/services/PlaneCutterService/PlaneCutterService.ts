import { PubSubService, Types as OHIFTypes } from '@ohif/core';
import { getRenderingEngines, Enums } from '@cornerstonejs/core';
import vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane';
import vtkCutter from '@kitware/vtk.js/Filters/Core/Cutter';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import { crosshairsHandler } from '../../utils/crosshairsHandler';

interface ModelCutterData {
  cutter: any;
  mapper: any;
  actor: any;
  modelId: string;
  polyData: any;
  appendFilter?: any;
  slabCutters?: any[];
  slabPlanes?: any[];
  slabCuttersReverse?: any[];
  slabPlanesReverse?: any[];
}

type PlaneCutterMode = 'thin' | 'slab';

interface PlaneCutterData {
  viewportId: string;
  orientation: 'axial' | 'coronal' | 'sagittal';
  plane: any;
  modelCutters: Map<string, ModelCutterData>;
  updateCallback?: any;
  eventListenerElement?: any;
  slabThickness?: number;
  mode: PlaneCutterMode;
}

interface ThicknessChangeEvent {
  viewportId: string;
  thickness: number;
  viewport?: any;
}

class ViewportThicknessService {
  private listeners = new Set<(change: ThicknessChangeEvent) => void>();
  private started = false;

  constructor(
    private cornerstoneViewportService: any,
    private getViewportById: (viewportId: string) => any
  ) {}

  start(): void {
    if (this.started || !this.cornerstoneViewportService?.EVENTS?.VIEWPORT_PROPERTIES_CHANGED) return;
    this.started = true;
    
    this.cornerstoneViewportService.subscribe(
      this.cornerstoneViewportService.EVENTS.VIEWPORT_PROPERTIES_CHANGED,
      (event: any) => {
        const thickness = event?.properties?.slabThickness;
        if (thickness !== undefined) {
          this.emit({
            viewportId: event.viewportId,
            thickness,
            viewport: this.getViewportById(event.viewportId),
          });
        }
      }
    );
  }

  onThicknessChange(listener: (change: ThicknessChangeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  read(viewportId: string): number {
    const viewport = this.getViewportById(viewportId);
    return viewport?.getProperties?.()?.slabThickness ?? 0;
  }

  private emit(change: ThicknessChangeEvent): void {
    this.listeners.forEach(listener => {
      try { listener(change); } catch {}
    });
  }
}

const FALLBACK_COLOR_PALETTE: [number, number, number][] = [
  [1.0, 0.5, 0.0], [0.0, 1.0, 1.0], [1.0, 0.0, 1.0], [1.0, 1.0, 0.0],
  [0.0, 1.0, 0.0], [1.0, 0.0, 0.0], [0.5, 0.0, 1.0], [0.0, 0.5, 1.0],
];

const EVENTS = {
  PLANE_CUTTER_ENABLED: 'event::plane_cutter_enabled',
  PLANE_CUTTER_DISABLED: 'event::plane_cutter_disabled',
  PLANE_CUTTER_UPDATED: 'event::plane_cutter_updated',
  PLANE_CUTTER_THICKNESS_CHANGED: 'event::plane_cutter_thickness_changed',
};

class PlaneCutterService extends PubSubService {
  static REGISTRATION = {
    name: 'planeCutterService',
    altName: 'PlaneCutterService',
    create: ({ servicesManager }: OHIFTypes.Extensions.ExtensionParams): PlaneCutterService => {
      return new PlaneCutterService({ servicesManager });
    },
  };

  public readonly EVENTS = EVENTS;
  public static readonly EVENTS = EVENTS;

  private servicesManager: any;
  private planeCutters: PlaneCutterData[] = [];
  private viewportDescriptors: { viewportId: string; orientation: 'axial' | 'coronal' | 'sagittal' }[] = [];
  private isEnabled = true;
  private colorIndex = 0;
  private modelColors = new Map<string, [number, number, number]>();
  private viewportThicknessService: ViewportThicknessService;
  // Debug flag: force thin mode and completely disable slab handling
  private readonly slabEnabled = false;
  // Batching for MODEL_ADDED events
  private pendingModelAdds = new Set<string>();
  private batchAddTimer: any = null;
  private readonly batchAddDelay = 50; // ms
  private isBatchAdding = false; // Flag to skip individual renders during batch

  constructor({ servicesManager }) {
    super(EVENTS);
    this.servicesManager = servicesManager;
    
    const { cornerstoneViewportService } = servicesManager.services;
    this.viewportThicknessService = new ViewportThicknessService(
      cornerstoneViewportService,
      this._getViewportById.bind(this)
    );

    this._subscribeToModelEvents();
    this._subscribeToViewportProperties();
  }

  private _subscribeToModelEvents(): void {
    const { modelStateService } = this.servicesManager.services;
    if (!modelStateService) return;

    modelStateService.subscribe(modelStateService.EVENTS.MODEL_ADDED, this._handleModelAdded.bind(this));
    modelStateService.subscribe(modelStateService.EVENTS.MODEL_REMOVED, this._handleModelRemoved.bind(this));
    modelStateService.subscribe(modelStateService.EVENTS.MODEL_UPDATED, this._handleModelUpdated.bind(this));
  }

  private _subscribeToViewportProperties(): void {
    if (!this.servicesManager.services.cornerstoneViewportService) return;
    this.viewportThicknessService.start();
    this.viewportThicknessService.onThicknessChange(this._handleThicknessChanged.bind(this));
  }

  private _handleModelAdded(event: { modelId: string }): void {
    if (!this.isEnabled) return;
    console.log(`🔪 [PlaneCutterService] MODEL_ADDED event: ${event.modelId} - batching...`);
    this._batchModelAdd(event.modelId);
  }

  private _handleModelRemoved(event: { modelId: string }): void {
    if (this.isEnabled) this.removeModelFromCutters(event.modelId);
  }

  private _handleModelUpdated(event: { modelId: string }): void {
    if (!this.isEnabled) return;
    console.log(`🔪 [PlaneCutterService] MODEL_UPDATED event: ${event.modelId} - batching...`);
    this._batchModelAdd(event.modelId);
  }

  private _batchModelAdd(modelId: string): void {
    this.pendingModelAdds.add(modelId);
    
    if (this.batchAddTimer) {
      clearTimeout(this.batchAddTimer);
    }
    
    this.batchAddTimer = setTimeout(() => {
      this._flushBatchedModelAdds();
    }, this.batchAddDelay);
  }

  private async _flushBatchedModelAdds(): Promise<void> {
    if (this.pendingModelAdds.size === 0) return;
    
    const modelIds = Array.from(this.pendingModelAdds);
    this.pendingModelAdds.clear();
    this.batchAddTimer = null;
    
    console.log(`🔪 [PlaneCutterService] Flushing ${modelIds.length} batched model additions`);
    
    // Set flag to skip individual renders during batch
    this.isBatchAdding = true;
    
    // Add all models sequentially to avoid VTK race conditions
    for (const modelId of modelIds) {
      try {
        await this.addModelToCutters(modelId);
      } catch (error) {
        console.error(`❌ Error adding model ${modelId} to cutters:`, error);
      }
    }
    
    // Clear batch flag
    this.isBatchAdding = false;
    
    // Single render pass after all models added to reduce render thrashing
    console.log(`🔪 [PlaneCutterService] Triggering final render for all viewports`);
    for (const descriptor of this.viewportDescriptors) {
      try {
        const viewport = this._getViewportById(descriptor.viewportId);
        if (viewport) {
          const vtkRenderer = viewport.getRenderer?.();
          if (vtkRenderer?.resetCameraClippingRange) {
            vtkRenderer.resetCameraClippingRange();
          }
          viewport.render?.();
        }
      } catch (error) {
        console.error(`❌ Error rendering viewport ${descriptor.viewportId}:`, error);
      }
    }
    
    console.log(`✅ [PlaneCutterService] Batch complete - all ${modelIds.length} models added and rendered`);
  }

  private async _handleThicknessChanged(change: ThicknessChangeEvent): Promise<void> {
    const { viewportId, thickness: incomingThickness, viewport: providedViewport } = change;
    console.log(`🔪 [PlaneCutterService] Thickness change received: ${viewportId} → ${incomingThickness}mm`);

    const viewport = providedViewport ?? this._getViewportById(viewportId);
    if (!viewport) return;

    const orientation = this._resolveViewportOrientation(viewport);
    if (!orientation) return;

    // Force thin mode when slab is disabled for debugging
    const rawThickness = incomingThickness ?? this._readViewportThickness(viewportId);
    const newThickness = this.slabEnabled ? rawThickness : 0;
    const targetMode: PlaneCutterMode = this.slabEnabled && newThickness > 0 ? 'slab' : 'thin';
    
    const { modelStateService } = this.servicesManager.services;
    const models = modelStateService?.getAllModels?.() || [];
    if (!models.length) return;

    const planeCutter = await this._getOrCreatePlaneCutterForViewport(viewport, orientation, targetMode, newThickness);
    if (!planeCutter) return;

    planeCutter.slabThickness = targetMode === 'slab' ? newThickness : 0;

    // Ensure all models are present
    for (const model of models) {
      const modelId = model?.metadata?.id;
      if (modelId) {
        if (!planeCutter.modelCutters.has(modelId)) {
          this._addModelToPlaneCutter(planeCutter, model);
        }
        this._setModelVisibility(planeCutter, modelId, true);
      }
    }

    // Hide inactive mode
    const otherMode = targetMode === 'thin' ? 'slab' : 'thin';
    const otherCutter = await this._getOrCreatePlaneCutterForViewport(viewport, orientation, otherMode);
    if (otherCutter) {
      if (targetMode === 'thin') otherCutter.slabThickness = 0;
      for (const modelId of otherCutter.modelCutters.keys()) {
        this._setModelVisibility(otherCutter, modelId, false);
      }
    }

    // Rebuild slab cuts
    if (targetMode === 'slab' && planeCutter.slabThickness && planeCutter.slabThickness > 0) {
      for (const [, modelCutterData] of planeCutter.modelCutters) {
        this._rebuildSlabCut(modelCutterData, planeCutter);
      }
    }

    // Render
    const vtkRenderer = viewport.getRenderer?.();
    if (vtkRenderer?.resetCameraClippingRange) vtkRenderer.resetCameraClippingRange();
    viewport.render?.();

    console.log(`🔪 [PlaneCutterService] Broadcasting thickness change event: ${viewportId} → ${newThickness}mm (${targetMode} mode)`);
    this._broadcastEvent(EVENTS.PLANE_CUTTER_THICKNESS_CHANGED, {
      viewportId,
      thickness: newThickness,
      mode: targetMode,
    });
  }

  public async initialize(): Promise<boolean> {
    try {
      const renderingEngines = getRenderingEngines();
      if (!renderingEngines?.length) return false;

      const targetViewports = [
        { id: 'fourUpMesh-mpr-axial', orientation: 'axial' as const },
        { id: 'fourUpMesh-mpr-coronal', orientation: 'coronal' as const },
        { id: 'fourUpMesh-mpr-sagittal', orientation: 'sagittal' as const },
        { id: 'mpr-axial', orientation: 'axial' as const },
        { id: 'mpr-coronal', orientation: 'coronal' as const },
        { id: 'mpr-sagittal', orientation: 'sagittal' as const },
      ];

      const orthographicViewports: { viewport: any; orientation: 'axial' | 'coronal' | 'sagittal' }[] = [];
      const foundOrientations = new Set<string>();

      for (const targetViewport of targetViewports) {
        if (foundOrientations.has(targetViewport.orientation)) continue;

        for (const engine of renderingEngines) {
          try {
            const viewport = engine.getViewport(targetViewport.id);
            if (viewport?.getRenderer() && viewport.type !== 'volume3d') {
              orthographicViewports.push({ viewport, orientation: targetViewport.orientation });
              foundOrientations.add(targetViewport.orientation);
              break;
            }
          } catch {}
        }
      }

      if (orthographicViewports.length < 3) return false;

      // Clear existing cutters
      if (this.planeCutters.length > 0) {
        const wasEnabled = this.isEnabled;
        this.cleanup();
        this.isEnabled = wasEnabled;
      } else {
        this.viewportDescriptors = [];
      }

      this.viewportDescriptors = orthographicViewports.map(({ viewport, orientation }) => ({
        viewportId: viewport.id,
        orientation,
      }));

      return this.viewportDescriptors.length > 0;
    } catch {
      return false;
    }
  }

  private async _setupSynchronizedUpdates(targetCutters: PlaneCutterData[] = this.planeCutters): Promise<void> {
    const updatePlaneCutter = (planeCutter: PlaneCutterData) => {
      try {
        const crosshairCenter = crosshairsHandler.getCrosshairCenter();
        const thickness = this._readViewportThickness(planeCutter.viewportId);
        this._updateSinglePlaneCutter(planeCutter, crosshairCenter, thickness);
        this._getViewportById(planeCutter.viewportId)?.render();
      } catch {}
    };

    for (const planeCutter of targetCutters) {
      const viewport = this._getViewportById(planeCutter.viewportId);
      if (viewport?.element && Enums?.Events?.CAMERA_MODIFIED && !planeCutter.updateCallback) {
        const combinedUpdate = () => updatePlaneCutter(planeCutter);
        viewport.element.addEventListener(Enums.Events.CAMERA_MODIFIED, combinedUpdate);
        planeCutter.updateCallback = combinedUpdate;
        planeCutter.eventListenerElement = viewport.element;
      }
    }

    targetCutters.forEach(updatePlaneCutter);
  }

  private _updateSinglePlaneCutter(
    planeCutter: PlaneCutterData,
    crosshairCenter: [number, number, number] | null = null,
    currentThickness?: number
  ): void {
    try {
      const effectiveThickness = currentThickness ?? planeCutter.slabThickness ?? 0;
      planeCutter.slabThickness = effectiveThickness;

      const requiredMode: PlaneCutterMode = effectiveThickness > 0 ? 'slab' : 'thin';
      if (planeCutter.mode !== requiredMode) return;

      const viewport = this._getViewportById(planeCutter.viewportId);
      if (!viewport) return;

      const camera = viewport.getCamera();
      const planeNormal = camera.viewPlaneNormal;
      if (!planeNormal || planeNormal.length !== 3) return;

      let planeOrigin: [number, number, number] | undefined;

      if (crosshairCenter) {
        planeOrigin = crosshairCenter;
      } else {
        const handlerCenter = crosshairsHandler.getCrosshairCenter?.();
        if (handlerCenter && Array.isArray(handlerCenter) && handlerCenter.length === 3) {
          planeOrigin = [handlerCenter[0], handlerCenter[1], handlerCenter[2]];
        } else {
          planeOrigin = this._getLegacyPlaneOrigin(viewport, camera, planeCutter.orientation);
        }
      }

      if (!planeOrigin) {
        planeOrigin = [camera.focalPoint[0], camera.focalPoint[1], camera.focalPoint[2]];
      }

      planeCutter.plane.setOrigin(planeOrigin[0], planeOrigin[1], planeOrigin[2]);
      planeCutter.plane.setNormal(planeNormal[0], planeNormal[1], planeNormal[2]);

      // Update model cuts for slab mode only
      if (requiredMode === 'slab' && effectiveThickness > 0) {
        for (const modelCutterData of planeCutter.modelCutters.values()) {
          this._rebuildSlabCut(modelCutterData, planeCutter);
        }
      }
    } catch {}
  }

  private _getLegacyPlaneOrigin(viewport: any, camera: any, orientation: string): [number, number, number] | undefined {
    try {
      const imageData = viewport.getImageData?.();
      if (!imageData) return undefined;

      const { focalPoint } = camera;
      const origin = imageData.getOrigin();
      const spacing = imageData.getSpacing();
      const dimensions = imageData.getDimensions();

      const calcOrigin = (axis: number) => {
        const sliceIndex = Math.round((focalPoint[axis] - origin[axis]) / spacing[axis]);
        const clampedIndex = Math.max(0, Math.min(dimensions[axis] - 1, sliceIndex));
        return origin[axis] + clampedIndex * spacing[axis];
      };

      if (orientation === 'axial') {
        return [
          origin[0] + (dimensions[0] / 2) * spacing[0],
          origin[1] + (dimensions[1] / 2) * spacing[1],
          calcOrigin(2)
        ];
      } else if (orientation === 'coronal') {
        return [
          origin[0] + (dimensions[0] / 2) * spacing[0],
          calcOrigin(1),
          origin[2] + (dimensions[2] / 2) * spacing[2]
        ];
      } else if (orientation === 'sagittal') {
        return [
          calcOrigin(0),
          origin[1] + (dimensions[1] / 2) * spacing[1],
          origin[2] + (dimensions[2] / 2) * spacing[2]
        ];
      }
    } catch {}
    return undefined;
  }

  private _clearProjectionOverlaysFromPlaneCutterViewports(): void {
    const { modelProjectionService } = this.servicesManager.services;
    if (!modelProjectionService) return;

    // Disable ModelProjectionService to prevent orange projection overlays
    // from interfering with plane cutter visualization
    try {
      modelProjectionService.setEnabled?.(false);
      console.log('🔪 [PlaneCutterService] Disabled ModelProjectionService to prevent overlay conflicts');
    } catch (error) {
      console.warn('🔪 [PlaneCutterService] Failed to disable ModelProjectionService:', error);
    }
  }

  public async enable(): Promise<void> {
    console.log('🔪 [PlaneCutterService] Enabling plane cutters');
    this.isEnabled = true;
    await this._ensureViewportDescriptors();

    // Clear projection overlays from plane cutter viewports to prevent visual conflicts
    this._clearProjectionOverlaysFromPlaneCutterViewports();

    const { modelStateService } = this.servicesManager.services;
    const models = modelStateService?.getAllModels() || [];
    console.log(`🔪 [PlaneCutterService] Adding ${models.length} existing models to plane cutters`);
    await Promise.all(models.map(model => this.addModelToCutters(model.metadata.id)));

    this._broadcastEvent(EVENTS.PLANE_CUTTER_ENABLED, {});
  }

  public disable(): void {
    if (!this.isEnabled) {
      console.log('🔪 [PlaneCutterService] Plane cutters already disabled');
      return;
    }
    console.log('🔪 [PlaneCutterService] Disabling plane cutters');
    this.isEnabled = false;

    for (const planeCutter of this.planeCutters) {
      for (const [modelId] of planeCutter.modelCutters) {
        try {
          this._removeModelCutterFromViewport(planeCutter, modelId);
        } catch {}
      }
    }

    // Re-enable ModelProjectionService if it was disabled
    const { modelProjectionService } = this.servicesManager.services;
    if (modelProjectionService) {
      try {
        modelProjectionService.setEnabled?.(true);
        console.log('🔪 [PlaneCutterService] Re-enabled ModelProjectionService');
      } catch (error) {
        console.warn('🔪 [PlaneCutterService] Failed to re-enable ModelProjectionService:', error);
      }
    }

    this._broadcastEvent(EVENTS.PLANE_CUTTER_DISABLED, {});
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  public getPlaneCutters(): PlaneCutterData[] {
    return this.planeCutters;
  }

  public async addModelToCutters(modelId: string): Promise<void> {
    const { modelStateService } = this.servicesManager.services;
    const loadedModel = modelStateService?.getModel(modelId);
    if (!loadedModel || !(await this._ensureViewportDescriptors())) return;

    const resolvedModelId = this._getModelId(loadedModel) ?? modelId;
    if (!resolvedModelId) {
      return;
    }

    for (const descriptor of this.viewportDescriptors) {
      const viewport = this._getViewportById(descriptor.viewportId);
      if (!viewport) continue;

      const orientation = descriptor.orientation ?? this._resolveViewportOrientation(viewport);
      if (!orientation) continue;

      const thickness = this.slabEnabled ? this._readViewportThickness(viewport.id) : 0;
      const targetMode: PlaneCutterMode = this.slabEnabled && thickness > 0 ? 'slab' : 'thin';

      const planeCutter = await this._getOrCreatePlaneCutterForViewport(viewport, orientation, targetMode, thickness);
      if (!planeCutter) continue;

      planeCutter.slabThickness = targetMode === 'slab' ? thickness : 0;
      this._addModelToPlaneCutter(planeCutter, loadedModel, resolvedModelId);

      // Hide inactive mode
      const otherMode = targetMode === 'thin' ? 'slab' : 'thin';
      const otherCutter = await this._getOrCreatePlaneCutterForViewport(viewport, orientation, otherMode);
      if (otherCutter) this._setModelVisibility(otherCutter, resolvedModelId, false);
      this._setModelVisibility(planeCutter, resolvedModelId, true);

      console.log(
        `🔪 [PlaneCutterService] Viewport ${viewport.id} (${orientation}) now has ${planeCutter.modelCutters.size} model cutters`
      );
    }

    this._broadcastEvent(EVENTS.PLANE_CUTTER_UPDATED, { modelId: resolvedModelId, action: 'added' });
  }

  public removeModelFromCutters(modelId: string): void {
    const { modelStateService } = this.servicesManager.services;
    const resolvedModelId = this._getModelId(modelStateService?.getModel(modelId)) ?? modelId;
    this.planeCutters.forEach(pc => {
      this._removeModelCutterFromViewport(pc, resolvedModelId);
      if (resolvedModelId !== modelId) {
        this._removeModelCutterFromViewport(pc, modelId);
      }
    });
    this.modelColors.delete(resolvedModelId);
    this.modelColors.delete(modelId);
    this._broadcastEvent(EVENTS.PLANE_CUTTER_UPDATED, { modelId: resolvedModelId, action: 'removed' });
  }

  public updateModelCutters(modelId: string): void {
    const { modelStateService } = this.servicesManager.services;
    const loadedModel = modelStateService?.getModel(modelId);
    if (!loadedModel?.polyData || !this.planeCutters.length) return;

    const resolvedModelId = this._getModelId(loadedModel) ?? modelId;

    for (const planeCutter of this.planeCutters) {
      let modelCutterData = planeCutter.modelCutters.get(resolvedModelId);
      if (!modelCutterData && resolvedModelId !== modelId) {
        modelCutterData = planeCutter.modelCutters.get(modelId);
        if (modelCutterData) {
          planeCutter.modelCutters.delete(modelId);
          planeCutter.modelCutters.set(resolvedModelId, modelCutterData);
        }
      }

      if (modelCutterData) {
        modelCutterData.polyData = loadedModel.polyData;
        if (planeCutter.mode === 'slab' && (planeCutter.slabThickness ?? 0) > 0) {
          this._rebuildSlabCut(modelCutterData, planeCutter);
        }
        this._getViewportById(planeCutter.viewportId)?.render();
      }
    }

    this._broadcastEvent(EVENTS.PLANE_CUTTER_UPDATED, { modelId: resolvedModelId, action: 'updated' });
  }

  private _rebuildSlabCut(modelCutterData: ModelCutterData, planeCutter: PlaneCutterData): void {
    try {
      modelCutterData?.actor?.setVisibility?.(false);
    } catch {}

    // Removed modelProjectionService call to prevent extra orange overlay actors
    // const { modelProjectionService } = this.servicesManager.services;
    // modelProjectionService?.updateProjectionsForViewport?.(planeCutter.viewportId);
  }

  private async _createPlaneCutterForViewport(
    viewport: any,
    orientation: 'axial' | 'coronal' | 'sagittal'
  ): Promise<PlaneCutterData | null> {
    try {
      const camera = viewport.getCamera();
      const { focalPoint, viewPlaneNormal } = camera;

      const plane = vtkPlane.newInstance();
      plane.setOrigin(focalPoint[0], focalPoint[1], focalPoint[2]);
      plane.setNormal(viewPlaneNormal[0], viewPlaneNormal[1], viewPlaneNormal[2]);

      return {
        viewportId: viewport.id,
        orientation,
        plane,
        modelCutters: new Map(),
        mode: 'thin',
        updateCallback: null,
        eventListenerElement: null,
      };
    } catch {
      return null;
    }
  }

  private async _ensureViewportDescriptors(): Promise<boolean> {
    return this.viewportDescriptors.length > 0 || await this.initialize();
  }

  private _getViewportDescriptor(viewportId: string) {
    return this.viewportDescriptors.find(vp => vp.viewportId === viewportId);
  }

  private _resolveViewportOrientation(viewport: any): 'axial' | 'coronal' | 'sagittal' | null {
    return this._getViewportDescriptor(viewport.id)?.orientation ?? this._getViewportOrientation(viewport);
  }

  private _getPlaneCutterForViewport(viewportId: string, mode: PlaneCutterMode): PlaneCutterData | undefined {
    return this.planeCutters.find(pc => pc.viewportId === viewportId && pc.mode === mode);
  }

  private _readViewportThickness(viewportId: string): number {
    return this.viewportThicknessService?.read(viewportId) ?? 0;
  }

  private _setModelVisibility(planeCutter: PlaneCutterData, modelId: string, visible: boolean): void {
    try {
      planeCutter.modelCutters.get(modelId)?.actor?.setVisibility?.(visible);
    } catch {}
  }

  private async _getOrCreatePlaneCutterForViewport(
    viewport: any,
    orientation: 'axial' | 'coronal' | 'sagittal',
    mode: PlaneCutterMode,
    slabThickness?: number
  ): Promise<PlaneCutterData | null> {
    const effectiveThickness = slabThickness ?? this._readViewportThickness(viewport.id);
    const existing = this._getPlaneCutterForViewport(viewport.id, mode);
    
    if (existing) {
      existing.slabThickness = mode === 'slab' ? effectiveThickness : 0;
      return existing;
    }

    const planeCutter = await this._createPlaneCutterForViewport(viewport, orientation);
    if (!planeCutter) return null;

    planeCutter.mode = mode;
    planeCutter.slabThickness = mode === 'slab' ? effectiveThickness : 0;
    this.planeCutters.push(planeCutter);
    await this._setupSynchronizedUpdates([planeCutter]);

    return planeCutter;
  }

  private _addModelToPlaneCutter(planeCutter: PlaneCutterData, loadedModel: any, providedModelId?: string): void {
    const modelId = providedModelId ?? this._getModelId(loadedModel);
    if (!modelId || planeCutter.modelCutters.has(modelId) || !loadedModel.polyData) return;

    const cutter = vtkCutter.newInstance();
    cutter.setCutFunction(planeCutter.plane);
    cutter.setInputData(loadedModel.polyData);

    const mapper = vtkMapper.newInstance();
    mapper.setInputConnection(cutter.getOutputPort());

    const actor = vtkActor.newInstance();
    actor.setMapper(mapper);

    const color = this._getColorForModel(modelId, loadedModel);
    const actorProperty = actor.getProperty();
    actorProperty.setColor(color[0], color[1], color[2]);
    actorProperty.setLineWidth(5);
    actorProperty.setOpacity(1.0);
    actorProperty.setAmbient(1.0);
    actorProperty.setDiffuse(0.0);
    (actorProperty as any).setDisplayLocationToForeground?.();
    (actorProperty as any).setFrontfaceCulling?.(false);
    (actorProperty as any).setBackfaceCulling?.(false);
    (actorProperty as any).setDepthTest?.(false);

    mapper.setResolveCoincidentTopologyToPolygonOffset?.();
    mapper.setRelativeCoincidentTopologyLineOffsetParameters?.(-4, -4);
    mapper.setResolveCoincidentTopologyPolygonOffsetParameters?.(-1, -500);

    actorProperty.setRepresentationToSurface();
    actorProperty.setEdgeVisibility(false);
    actorProperty.setLighting(false);

    const viewport = this._getViewportById(planeCutter.viewportId);
    const vtkRenderer = viewport?.getRenderer();
    if (!vtkRenderer) return;

    vtkRenderer.addActor(actor);

    const modelCutterData: ModelCutterData = {
      cutter,
      mapper,
      actor,
      modelId,
      polyData: loadedModel.polyData,
    };

    planeCutter.modelCutters.set(modelId, modelCutterData);

    if (planeCutter.mode === 'slab' && (planeCutter.slabThickness ?? 0) > 0) {
      this._rebuildSlabCut(modelCutterData, planeCutter);
    }

    // Skip individual render during batch operations - we'll render once at the end
    if (!this.isBatchAdding) {
      viewport.render();
    }
  }

  private _removeModelCutterFromViewport(planeCutter: PlaneCutterData, modelId: string): void {
    const modelCutterData = planeCutter.modelCutters.get(modelId);
    if (!modelCutterData) return;

    try {
      const viewport = this._getViewportById(planeCutter.viewportId);
      const vtkRenderer = viewport?.getRenderer();
      if (vtkRenderer) {
        vtkRenderer.removeActor(modelCutterData.actor);
        viewport.render();
      }
    } catch {}

    try {
      modelCutterData.actor?.delete();
      modelCutterData.mapper?.delete();
      modelCutterData.cutter?.delete();
      modelCutterData.appendFilter?.delete();
      modelCutterData.slabCutters?.forEach(c => c.delete());
      modelCutterData.slabPlanes?.forEach(p => p.delete());
      modelCutterData.slabCuttersReverse?.forEach(c => c.delete());
      modelCutterData.slabPlanesReverse?.forEach(p => p.delete());
    } catch {}

    planeCutter.modelCutters.delete(modelId);
  }

  private _getViewportById(viewportId: string): any {
    const renderingEngines = getRenderingEngines();
    for (const engine of renderingEngines) {
      try {
        const viewport = engine.getViewport(viewportId);
        if (viewport) return viewport;
      } catch {}
    }
    return null;
  }

  private _getViewportOrientation(viewport: any): 'axial' | 'coronal' | 'sagittal' | null {
    const viewportId = viewport.id.toLowerCase();
    if (viewportId.includes('axial')) return 'axial';
    if (viewportId.includes('coronal')) return 'coronal';
    if (viewportId.includes('sagittal')) return 'sagittal';

    const orientation = viewport.options?.orientation?.toLowerCase();
    if (orientation === 'axial' || orientation === 'coronal' || orientation === 'sagittal') {
      return orientation;
    }

    try {
      const { viewPlaneNormal } = viewport.getCamera();
      if (Math.abs(viewPlaneNormal[2]) > 0.9) return 'axial';
      if (Math.abs(viewPlaneNormal[0]) > 0.9) return 'sagittal';
      if (Math.abs(viewPlaneNormal[1]) > 0.9) return 'coronal';
    } catch {}

    return null;
  }

  private _getColorForModel(modelId: string, loadedModel?: any): [number, number, number] {
    const { modelStateService } = this.servicesManager.services;
    const model = loadedModel ?? modelStateService?.getModel(modelId);

    if (model?.metadata?.color) {
      const metadataColor = model.metadata.color;
      if (Array.isArray(metadataColor) && metadataColor.length === 3) {
        const color: [number, number, number] = [metadataColor[0], metadataColor[1], metadataColor[2]];
        this.modelColors.set(modelId, color);
        return color;
      }
    }

    // Fallback to actor color if present
    try {
      const actorColor = model?.actor?.getProperty?.()?.getColor?.();
      if (Array.isArray(actorColor) && actorColor.length === 3) {
        const color: [number, number, number] = [actorColor[0], actorColor[1], actorColor[2]];
        this.modelColors.set(modelId, color);
        return color;
      }
    } catch {}

    if (this.modelColors.has(modelId)) {
      return this.modelColors.get(modelId)!;
    }

    const color = FALLBACK_COLOR_PALETTE[this.colorIndex % FALLBACK_COLOR_PALETTE.length];
    this.colorIndex++;
    this.modelColors.set(modelId, color);
    return color;
  }

  private _getModelId(model: any): string | null {
    const candidate =
      model?.metadata?.id ??
      model?.metadata?.modelId ??
      model?.metadata?.uid ??
      model?.id ??
      model?.modelId;
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
  }

  public debugSlabThickness(): void {
    for (const planeCutter of this.planeCutters) {
      const viewport = this._getViewportById(planeCutter.viewportId);
      let viewportThickness = 'N/A';
      if (viewport) {
        try {
          viewportThickness = viewport.getProperties?.()?.slabThickness ?? 'undefined';
        } catch {
          viewportThickness = 'error';
        }
      }
    }
  }

  public cleanup(): void {
    if (this.isEnabled) this.disable();

    // Clear batch timer
    if (this.batchAddTimer) {
      clearTimeout(this.batchAddTimer);
      this.batchAddTimer = null;
    }
    this.pendingModelAdds.clear();

    for (const planeCutter of this.planeCutters) {
      try {
        if (planeCutter.updateCallback && planeCutter.eventListenerElement) {
          if (Enums?.Events?.CAMERA_MODIFIED) {
            planeCutter.eventListenerElement.removeEventListener(
              Enums.Events.CAMERA_MODIFIED,
              planeCutter.updateCallback
            );
          }
        }
        planeCutter.plane?.delete();
      } catch {}
    }

    this.planeCutters = [];
    this.colorIndex = 0;
    this.modelColors.clear();
    this.viewportDescriptors = [];
  }
}

export default PlaneCutterService;

