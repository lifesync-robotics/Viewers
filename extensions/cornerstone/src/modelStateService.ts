import { PubSubService } from '@ohif/core';
import { getRenderingEngine, getRenderingEngines, metaData } from '@cornerstonejs/core';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkOBJReader from '@kitware/vtk.js/IO/Misc/OBJReader';  // models are all in obj format
import vtkCutter from '@kitware/vtk.js/Filters/Core/Cutter';
import vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane';
import vtkMatrixBuilder from '@kitware/vtk.js/Common/Core/MatrixBuilder';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';
import vtkTransform from '@kitware/vtk.js/Common/Transform/Transform';

import { Types as OHIFTypes } from '@ohif/core';
import { crosshairsHandler } from './utils/crosshairsHandler';
/**
 *
 *
 * model should be placed at the origin 0,0,0 for screw planning at the beginning.
 * Then the model orientation should follow the viewport camera normal and the crosshairs center point.
 * Also, we may need to offset it depending on the design
 *
 *
 */
/**
 * Supported 3D model formats
 */
export enum ModelFormat {
  OBJ = 'obj',
}

/**
 * Model metadata interface
 */
export interface ModelMetadata {
  id: string;
  name: string;
  format: ModelFormat;
  filePath: string;
  fileUrl?: string;
  loadedAt: Date;
  viewportId?: string;
  visible: boolean;
  color?: [number, number, number];
  opacity?: number;
  // DICOM alignment information
  dicomOrigin?: [number, number, number];
  dicomOrientation?: number[];
  originalPosition?: [number, number, number];
  alignedPosition?: [number, number, number];
  // Note: All models are automatically transformed:
  //   - Rotated 90° around X-axis to align with DICOM coordinate system
  //   - Scaled 10x in all directions for better visibility
}

/**
 * 2D plane cutter data for cross-section rendering
 */
export interface PlaneCutter {
  viewportId: string;
  orientation: 'axial' | 'coronal' | 'sagittal';
  plane: any; // vtkPlane
  cutter: any; // vtkCutter
  mapper: any; // vtkMapper
  actor: any; // vtkActor
  updateCallback?: any; // Callback for viewport updates
}

/**
 * Loaded model data structure
 */
export interface LoadedModel {
  metadata: ModelMetadata;
  actor: any; // vtkActor
  mapper: any; // vtkMapper
  reader: any; // vtkOBJReader
  polyData?: any; // vtkPolyData (with all transformations baked in, in world space)
  planeCutters?: PlaneCutter[]; // 2D cross-section cutters for orthographic viewports
}

/**
 * Model loading options
 */
export interface ModelLoadOptions {
  viewportId?: string; // Note: Model will be added to ALL viewports in the same rendering engine
  color?: [number, number, number];
  opacity?: number;
  visible?: boolean;
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * Service events
 */
const EVENTS = {
  MODEL_ADDED: 'event::model_added',
  MODEL_REMOVED: 'event::model_removed',
  MODEL_UPDATED: 'event::model_updated', // Note: not used yet
  MODEL_VISIBILITY_CHANGED: 'event::model_visibility_changed', // Note: not used yet
  MODEL_LOADING_START: 'event::model_loading_start', // Note: not used yet
  MODEL_LOADING_COMPLETE: 'event::model_loading_complete', // Note: not used yet
  MODEL_LOADING_ERROR: 'event::model_loading_error', // Note: not used yet
  MODELS_CLEARED: 'event::models_cleared', // Note: not used yet
};

/**
 * ModelStateService - Manages 3D model loading, rendering, and state management
 *
 * Based on:
 * - Cornerstone.js mesh loader: https://www.cornerstonejs.org/live-examples/meshloader
 * - vtk.js OBJ Viewer: https://kitware.github.io/vtk-js/examples/OBJViewer.html
 */
class ModelStateService extends PubSubService {
  static REGISTRATION = {
    name: 'modelStateService',
    altName: 'ModelStateService',
    create: ({ servicesManager }: OHIFTypes.Extensions.ExtensionParams): ModelStateService => {
      return new ModelStateService({ servicesManager });
    },
  };

  public readonly EVENTS = EVENTS;
  public static readonly EVENTS = EVENTS;

  private readonly servicesManager: any;
  private loadedModels: Map<string, LoadedModel>;
  private modelDirectory: string;

  constructor({ servicesManager }) {
    super(EVENTS);
    this.servicesManager = servicesManager;
    this.loadedModels = new Map();

    // Subscribe to MODEL_ADDED event to create 2D plane cutters
    this.subscribe(this.EVENTS.MODEL_ADDED, this._handleModelAdded.bind(this));
  }

  /**
   * Handle MODEL_ADDED event - create 2D plane cutters for FourUpMesh layout
   */
  private _handleModelAdded(event: { modelId: string; metadata: ModelMetadata }): void {
    const { modelId } = event;
    const loadedModel = this.loadedModels.get(modelId);

    if (!loadedModel) {
      console.warn('⚠️ [ModelStateService] Model not found in _handleModelAdded:', modelId);
      return;
    }

    // Check if we're in fourUpMesh layout
    const { hangingProtocolService } = this.servicesManager.services;
    const hpState = hangingProtocolService?.getState();

    if (hpState?.protocolId === 'fourUpMesh') {
      console.log('🔪 [ModelStateService] FourUpMesh detected - creating 2D plane cutters');
      this._create2DPlaneCutters(loadedModel);
    } else {
      console.log('ℹ️ [ModelStateService] Not using fourUpMesh layout - skipping 2D plane cutters');
    }
  }

  /**
   * Create 2D plane cutters for axial, coronal, and sagittal viewports
   */
  private async _create2DPlaneCutters(loadedModel: LoadedModel): Promise<void> {
    try {
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔪 [ModelStateService] CREATING 2D PLANE CUTTERS');
      console.log('═══════════════════════════════════════════════════════');

      const renderingEngines = getRenderingEngines();
      const orthographicViewports: { viewport: any; orientation: 'axial' | 'coronal' | 'sagittal' }[] = [];

      // Find all orthographic viewports
      for (const engine of renderingEngines) {
        const viewports = engine.getViewports();

        for (const vp of viewports) {
          // Skip 3D viewports
          if (vp.type === 'volume3d') {
            continue;
          }

          // Determine orientation from viewport ID or camera
          const orientation = this._getViewportOrientation(vp);

          if (orientation) {
            orthographicViewports.push({ viewport: vp, orientation });
            console.log(`  ✅ Found ${orientation} viewport: ${vp.id}`);
          }
        }
      }

      if (orthographicViewports.length === 0) {
        console.warn('⚠️ [ModelStateService] No orthographic viewports found for plane cutters');
        return;
      }

      // Initialize planeCutters array
      loadedModel.planeCutters = [];

      // Create a plane cutter for each orthographic viewport
      for (const { viewport, orientation } of orthographicViewports) {
        console.log(`───────────────────────────────────────────────────────`);
        console.log(`🔪 [ModelStateService] Creating ${orientation} plane cutter`);

        const planeCutter = await this._createPlaneCutterForViewport(loadedModel, viewport, orientation);

        if (planeCutter) {
          loadedModel.planeCutters.push(planeCutter);
          // good habit for naming viewports , so that we can debug here!
          console.log(`  ✅ ${orientation} plane cutter created and added to viewport: ${viewport.id}`);
        }
        // break // just try it on one viewport for now
      }

      console.log('═══════════════════════════════════════════════════════');
      console.log(`✅ [ModelStateService] Created ${loadedModel.planeCutters.length} plane cutters`);
      console.log('═══════════════════════════════════════════════════════');


      // ═════════════════════════════════════════════════════════
      // SAFEGUARD: Check if model was already transformed
      // If so, update all cutters with transformed polyData
      // ═════════════════════════════════════════════════════════

      if (loadedModel && loadedModel.actor.getUserMatrix()) {
        console.log('⚠️ Model was already transformed before cutters were created');
        console.log('🔄 Updating all cutters with transformed polyData...');
        this._updateAllPlaneCutters(loadedModel.metadata.id);
      }

    } catch (error) {
      console.error('❌ [ModelStateService] Error creating 2D plane cutters:', error);
      console.error('❌ [ModelStateService] Error stack:', error.stack);
    }


  }

  /**
   * Create a plane cutter for a specific viewport
   */
  private async _createPlaneCutterForViewport(
    loadedModel: LoadedModel,
    viewport: any,
    orientation: 'axial' | 'coronal' | 'sagittal'
  ): Promise<PlaneCutter | null> {
    try {
      // Get the camera to determine the cutting plane
      const camera = viewport.getCamera();
      const { focalPoint, viewPlaneNormal } = camera;

      console.log(`  📋 Camera focal point:`, focalPoint);
      console.log(`  📋 View plane normal:`, viewPlaneNormal);

      // ═══════════════════════════════════════════════════════════════════════════
      // SIMPLE & FAST: Use transformed polyData already in world space
      // No inverse transforms needed - everything works in world coordinates
      // This approach scales well for future UI-based model manipulation
      // ═══════════════════════════════════════════════════════════════════════════

      // Create VTK plane directly from viewport's camera plane (already in world space)
      const plane = vtkPlane.newInstance();
      plane.setOrigin(focalPoint[0], focalPoint[1], focalPoint[2]);
      plane.setNormal(viewPlaneNormal[0], viewPlaneNormal[1], viewPlaneNormal[2]);

      // Create VTK cutter using the polyData (already hardened to world space)
      const cutter = vtkCutter.newInstance();
      cutter.setCutFunction(plane);
      cutter.setInputData(loadedModel.polyData); // PolyData already in world space!

      console.log(`  ✅ Cutter created using world-space polyData (no transform calculations needed)`);

      // Create mapper for the cut
      const mapper = vtkMapper.newInstance();
      mapper.setInputConnection(cutter.getOutputPort());

      // Create actor for the cut
      const actor = vtkActor.newInstance();
      actor.setMapper(mapper);

      // ═══════════════════════════════════════════════════════════════════════════
      // NO transformations needed on the cutter actor!
      // The transformed polyData is already in world space with all transformations baked in
      // Actor uses identity transform - geometry is already positioned correctly
      // ═══════════════════════════════════════════════════════════════════════════

      console.log(`  ✅ Cutter actor uses identity transform (geometry already in world space)`);

      // Set line properties for better visibility
      actor.getProperty().setLineWidth(3); // Slightly thicker for better visibility
      actor.getProperty().setColor(1.0, 0.5, 0.0); // Orange color for visibility

      // CRITICAL: Configure rendering to ensure contours always show on top of DICOM volume
      // This ensures the cross-section is visible regardless of its depth position

      // Use mapper's coincident topology resolution to push lines forward
      if (mapper.setResolveCoincidentTopologyToPolygonOffset) {
        mapper.setResolveCoincidentTopologyToPolygonOffset();
        console.log(`  🎨 Using polygon offset for depth resolution`);
      }

      // Set relative offset parameters for lines to ensure they render on top
      if (mapper.setRelativeCoincidentTopologyLineOffsetParameters) {
        mapper.setRelativeCoincidentTopologyLineOffsetParameters(-1, -1);
        console.log(`  🎨 Line offset parameters set for visibility`);
      }

      // Alternative: Set opacity slightly less than 1.0 to use transparency rendering path
      // which often renders after opaque geometry
      actor.getProperty().setOpacity(0.999);

      // Note: Camera offset technique removed since polyData is pre-transformed
      // The geometry is already in the correct position from the transformFilter

      console.log(`  ✅ Contour rendering configured for maximum visibility`);

      // Add actor to viewport's renderer
      const vtkRenderer = viewport.getRenderer();
      if (!vtkRenderer) {
        console.error('❌ [ModelStateService] No VTK renderer found for viewport:', viewport.id);
        return null;
      }

      vtkRenderer.addActor(actor);

      // CRITICAL: Set up dynamic plane updates using crosshair tool
      // This provides better synchronization and accuracy across all viewports
      const updatePlanePosition = () => {
        try {
          let planeOrigin = null;
          let planeNormal = null;
          let usedCrosshairs = false;

          // Try to get crosshair data using the handler
          try {
            const crosshairData = crosshairsHandler.getCrosshairCenter(viewport.id);

            if (crosshairData.isActive && crosshairData.center) {
              planeOrigin = crosshairData.center;
              usedCrosshairs = true;
              // console.log(`  🎯 Using crosshair center: [${planeOrigin[0]?.toFixed(1)}, ${planeOrigin[1]?.toFixed(1)}, ${planeOrigin[2]?.toFixed(1)}]`);
            }
          } catch (crosshairError) {
            console.warn('⚠️ Could not get crosshair data, falling back to camera:', crosshairError.message);
          }

          // Fallback to camera focal point if crosshairs not available
          if (!planeOrigin || !Array.isArray(planeOrigin) || planeOrigin.length !== 3) {
            const currentCamera = viewport.getCamera();
            planeOrigin = currentCamera.focalPoint;
            planeNormal = currentCamera.viewPlaneNormal;
            // console.log(`  📷 Using camera focal point: [${planeOrigin[0]?.toFixed(1)}, ${planeOrigin[1]?.toFixed(1)}, ${planeOrigin[2]?.toFixed(1)}]`);
          } else {
            // Get plane normal from camera even when using crosshair center
            const currentCamera = viewport.getCamera();
            planeNormal = currentCamera.viewPlaneNormal;
          }

          // Final validation
          if (!planeOrigin || !planeNormal || planeOrigin.length !== 3 || planeNormal.length !== 3) {
            console.warn('⚠️ Invalid plane origin or normal, skipping update');
            return;
          }

          // Update plane origin to match current position
          plane.setOrigin(planeOrigin[0], planeOrigin[1], planeOrigin[2]);

          // Update plane normal
          plane.setNormal(planeNormal[0], planeNormal[1], planeNormal[2]);

          // Cutter automatically updates when plane changes
          cutter.update();

          // No position offset needed - geometry is already in world space
          // Actor maintains identity transform

          // Re-render viewport
          viewport.render();

          const source = usedCrosshairs ? 'crosshairs' : 'camera';
          // console.log(`  🔄 [${source}] Plane updated for ${orientation}`);
        } catch (error) {
          console.warn('⚠️ Error updating plane position:', error.message);
        }
      };

      // Subscribe to camera modified events (includes scrolling, panning, zooming)
      const { Enums } = await import('@cornerstonejs/core');
      const element = viewport.element;

      if (element && Enums?.Events?.CAMERA_MODIFIED) {
        element.addEventListener(Enums.Events.CAMERA_MODIFIED, updatePlanePosition);
        console.log(`  📡 Subscribed to CAMERA_MODIFIED events (scroll/pan/zoom)`);
      }

      // Initial update with current position
      // This will use crosshair center if crosshairs are active
      updatePlanePosition();

      console.log(`  ✅ Plane cutter actor added with dynamic updates enabled`);

      return {
        viewportId: viewport.id,
        orientation,
        plane,
        cutter,
        mapper,
        actor,
        updateCallback: updatePlanePosition,
      };

    } catch (error) {
      console.error(`❌ [ModelStateService] Error creating plane cutter for ${orientation}:`, error);
      return null;
    }
  }

  /**
   * Determine viewport orientation from viewport properties
   */
  private _getViewportOrientation(viewport: any): 'axial' | 'coronal' | 'sagittal' | null {
    // Try to get orientation from viewport ID
    const viewportId = viewport.id.toLowerCase();

    if (viewportId.includes('axial')) {
      return 'axial';
    } else if (viewportId.includes('coronal')) {
      return 'coronal';
    } else if (viewportId.includes('sagittal')) {
      return 'sagittal';
    }

    // Try to determine from viewport options
    const viewportOptions = viewport.options;
    if (viewportOptions && viewportOptions.orientation) {
      const orientation = viewportOptions.orientation.toLowerCase();
      if (orientation === 'axial' || orientation === 'coronal' || orientation === 'sagittal') {
        return orientation as 'axial' | 'coronal' | 'sagittal';
      }
    }

    // Try to determine from camera's view plane normal
    try {
      const camera = viewport.getCamera();
      const { viewPlaneNormal } = camera;

      // Axial: normal is (0, 0, 1) or (0, 0, -1)
      if (Math.abs(viewPlaneNormal[2]) > 0.9) {
        return 'axial';
      }
      // Sagittal: normal is (1, 0, 0) or (-1, 0, 0)
      else if (Math.abs(viewPlaneNormal[0]) > 0.9) {
        return 'sagittal';
      }
      // Coronal: normal is (0, 1, 0) or (0, -1, 0)
      else if (Math.abs(viewPlaneNormal[1]) > 0.9) {
        return 'coronal';
      }
    } catch (error) {
      console.warn('⚠️ [ModelStateService] Could not determine orientation from camera:', error.message);
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // API INTEGRATION METHODS
  // Methods to interact with the model server for listing and uploading models
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get base URL for model server API
   * In development, this is proxied through webpack dev server
   */
  private _getModelServerBaseUrl(): string {
    // In development, webpack dev server proxies to localhost:5001
    // In production, you might want to use an environment variable
    return window.location.origin; // Proxied by webpack dev server
  }

  /**
   * Fetch list of available models from the server
   * Returns both server-provided models and user-uploaded models
   *
   * @returns Promise with list of available models
   * @example
   * const models = await modelStateService.fetchAvailableModels();
   * models.forEach(model => {
   *   console.log(model.name, model.url);
   * });
   */
  public async fetchAvailableModels(): Promise<any[]> {
    try {
      const baseUrl = this._getModelServerBaseUrl();
      const response = await fetch(`${baseUrl}/api/models/list`);

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.models) {
        console.log(`✅ [ModelStateService] Fetched ${data.count} models from server`);
        return data.models;
      } else {
        console.error('❌ [ModelStateService] Invalid response from model server:', data);
        return [];
      }
    } catch (error) {
      console.error('❌ [ModelStateService] Error fetching models:', error);
      return [];
    }
  }

  /**
   * Upload a model file to the server
   *
   * @param file - The File object to upload (must be .obj)
   * @returns Promise with upload result including model metadata
   * @example
   * const input = document.querySelector('input[type="file"]');
   * const file = input.files[0];
   * const result = await modelStateService.uploadModelToServer(file);
   * if (result.success) {
   *   console.log('Model uploaded:', result.model.url);
   * }
   */
  public async uploadModelToServer(file: File): Promise<any> {
    try {
      // Validate file type
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'obj') {
        throw new Error('Only .obj files are supported');
      }

      // Create FormData for upload
      const formData = new FormData();
      formData.append('model', file);

      const baseUrl = this._getModelServerBaseUrl();
      const response = await fetch(`${baseUrl}/api/models/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        console.log('✅ [ModelStateService] Model uploaded successfully:', result.model.filename);
        return result;
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('❌ [ModelStateService] Error uploading model:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Load a model from the server by its URL
   * This is a convenience method that combines fetching and loading
   *
   * @param modelUrl - The URL of the model (e.g., '/models/server/brain.obj')
   * @param options - Loading options (viewportId, color, etc.)
   * @returns Promise with loaded model
   * @example
   * // Load a server model
   * await modelStateService.loadModelFromServer('/models/server/brain.obj', {
   *   viewportId: 'viewport-3d',
   *   color: [1, 0, 0],
   *   opacity: 0.8
   * });
   */
  public async loadModelFromServer(
    modelUrl: string,
    options: ModelLoadOptions = {}
  ): Promise<LoadedModel | null> {
    try {
      // Prepend base URL if not already a full URL
      let fullUrl = modelUrl;
      if (!modelUrl.startsWith('http')) {
        const baseUrl = this._getModelServerBaseUrl();
        fullUrl = `${baseUrl}${modelUrl.startsWith('/') ? '' : '/'}${modelUrl}`;
      }

      console.log(`📥 [ModelStateService] Loading model from server: ${fullUrl}`);

      // Use existing loadModel method
      return await this.loadModel(fullUrl, options);
    } catch (error) {
      console.error('❌ [ModelStateService] Error loading model from server:', error);
      return null;
    }
  }

  /**
   * Upload a model and immediately load it into a viewport
   *
   * @param file - The File object to upload
   * @param options - Loading options (viewportId, color, etc.)
   * @returns Promise with loaded model
   * @example
   * const input = document.querySelector('input[type="file"]');
   * const file = input.files[0];
   * await modelStateService.uploadAndLoadModel(file, {
   *   viewportId: 'viewport-3d'
   * });
   */
  public async uploadAndLoadModel(
    file: File,
    options: ModelLoadOptions = {}
  ): Promise<LoadedModel | null> {
    try {
      console.log('📤 [ModelStateService] Uploading and loading model:', file.name);

      // First upload to server
      const uploadResult = await this.uploadModelToServer(file);

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      // Then load from server URL
      return await this.loadModelFromServer(uploadResult.model.url, options);
    } catch (error) {
      console.error('❌ [ModelStateService] Error uploading and loading model:', error);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // END API INTEGRATION METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Load a 3D model from file path or URL
   */
  public async loadModel(
    filePathOrUrl: string,
    options: ModelLoadOptions = {}
  ): Promise<LoadedModel | null> {
    const fileName = this._extractFileName(filePathOrUrl);
    const modelId = this._generateModelId(fileName);
    const format = this._getModelFormat(fileName);

    if (!format) {
      console.error(`Unsupported file format: ${fileName}`);
      this._broadcastEvent(this.EVENTS.MODEL_LOADING_ERROR, { fileName, error: 'Unsupported format' });
      return null;
    }

    this._broadcastEvent(this.EVENTS.MODEL_LOADING_START, { modelId, fileName });

    try {
      const metadata: ModelMetadata = {
        id: modelId,
        name: fileName,
        format,
        filePath: filePathOrUrl,
        loadedAt: new Date(),
        viewportId: options.viewportId,
        visible: options.visible ?? true,
        color: options.color,
        opacity: options.opacity ?? 1.0,
      };

      let loadedModel: LoadedModel;

      // Check if loading from URL or local file
      if (this._isUrl(filePathOrUrl)) {
        loadedModel = await this._loadFromUrl(metadata, options);
      } else {
        loadedModel = await this._loadFromFile(metadata, options);
      }

      this.loadedModels.set(modelId, loadedModel);

      // Add to 3D volume viewport ONLY
      if (options.viewportId) {
        this._addModelToViewportSmart(loadedModel, options.viewportId);
      }
      // This event is very important; later when we deal with 2d plane cutting we need to start cutting after the model is added to the viewport
      this._broadcastEvent(this.EVENTS.MODEL_ADDED, { modelId, metadata });
      this._broadcastEvent(this.EVENTS.MODEL_LOADING_COMPLETE, { modelId, metadata });

      return loadedModel;
    } catch (error) {
      console.error(`Error loading model ${fileName}:`, error);
      this._broadcastEvent(this.EVENTS.MODEL_LOADING_ERROR, { modelId, fileName, error: error.message });
      return null;
    }
  }

  /**
   * Load model from URL
   */
  private async _loadFromUrl(
    metadata: ModelMetadata,
    options: ModelLoadOptions
  ): Promise<LoadedModel> {
    return new Promise((resolve, reject) => {
      fetch(metadata.filePath)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.text();
        })
        .then(content => {
          const loadedModel = this._createModelFromText(content, metadata, options);
          resolve(loadedModel);
        })
        .catch(error => reject(error));
    });
  }

  /**
   * Load model from local file
   */
  private async _loadFromFile(
    metadata: ModelMetadata,
    options: ModelLoadOptions
  ): Promise<LoadedModel> {
    return new Promise((resolve, reject) => {
      fetch(`file:///${metadata.filePath}`)
        .then(response => response.text())
        .then(content => {
          const loadedModel = this._createModelFromText(content, metadata, options);
          resolve(loadedModel);
        })
        .catch(error => {
          // Fallback: try to read as File object
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = `.${metadata.format}`;

          input.onchange = (e: any) => {
            const file = e.target.files[0];
            const reader = new FileReader();

            reader.onload = (event: any) => {
              const content = event.target.result;
              const loadedModel = this._createModelFromText(content, metadata, options);
              resolve(loadedModel);
            };

            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
          };

          // For automated loading without user interaction
          reject(new Error('Cannot read local file without user interaction. Use loadModelFromFileInput instead.'));
        });
    });
  }

  /**
   * Load model from file input element
   */
  public async loadModelFromFileInput(
    file: File,
    options: ModelLoadOptions = {}
  ): Promise<LoadedModel | null> {
    const fileName = file.name;
    const modelId = this._generateModelId(fileName);
    const format = this._getModelFormat(fileName);

    if (!format) {
      console.error(`Unsupported file format: ${fileName}`);
      return null;
    }

    this._broadcastEvent(this.EVENTS.MODEL_LOADING_START, { modelId, fileName });

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event: any) => {
        try {
          const content = event.target.result;

          const metadata: ModelMetadata = {
            id: modelId,
            name: fileName,
            format,
            filePath: file.name,
            loadedAt: new Date(),
            viewportId: options.viewportId,
            visible: options.visible ?? true,
            color: options.color,
            opacity: options.opacity ?? 1.0,
          };

          const loadedModel = this._createModelFromText(content, metadata, options);
          this.loadedModels.set(modelId, loadedModel);

          if (options.viewportId) {
            this._addModelToViewportSmart(loadedModel, options.viewportId);
          }

          this._broadcastEvent(this.EVENTS.MODEL_ADDED, { modelId, metadata });
          this._broadcastEvent(this.EVENTS.MODEL_LOADING_COMPLETE, { modelId, metadata });

          resolve(loadedModel);
        } catch (error) {
          console.error(`Error loading model ${fileName}:`, error);
          this._broadcastEvent(this.EVENTS.MODEL_LOADING_ERROR, { modelId, fileName, error: error.message });
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(reader.error);
      };

      reader.readAsText(file);
    });
  }

  /**
   * Apply initial DICOM coordinate system transformation to actor
   * - Rotates -90° around X-axis to align with DICOM coordinate system
   * - Scales 10x for better visibility
   * - Applies custom position/rotation/scale from options
   */
  private _applyInitialDicomTransform(
    actor: any,
    options: ModelLoadOptions
  ): void {

    // no longer needed as the transformation matrix should handle this rotation already
    // DICOM coordinate system alignment: -90° rotation around X-axis
    // const dicomAlignmentRotation = [-90, 0, 0];
    // actor.setOrientation(dicomAlignmentRotation[0], dicomAlignmentRotation[1], dicomAlignmentRotation[2]);

    // Default scale
    const defaultScale = [1, 1, 1];
    actor.setScale(defaultScale[0], defaultScale[1], defaultScale[2]);

    // Apply custom position if provided
    // if (options.position) {
    //   actor.setPosition(options.position[0], options.position[1], options.position[2]);
    // }

    // Apply custom scale if provided (multiply with default)
    if (options.scale) {
      const combinedScale = [
        defaultScale[0] * options.scale[0],
        defaultScale[1] * options.scale[1],
        defaultScale[2] * options.scale[2],
      ];
      actor.setScale(combinedScale[0], combinedScale[1], combinedScale[2]);
    }

    // Apply custom rotation if provided (add to DICOM alignment)
    // if (options.rotation) {
    //   const combinedRotation = [
    //     dicomAlignmentRotation[0] + options.rotation[0],
    //     dicomAlignmentRotation[1] + options.rotation[1],
    //     dicomAlignmentRotation[2] + options.rotation[2],
    //   ];
    //   actor.setOrientation(combinedRotation[0], combinedRotation[1], combinedRotation[2]);
    // }

    // Apply visual properties
    if (options.color) {
      actor.getProperty().setColor(options.color[0], options.color[1], options.color[2]);
    }

    if (options.opacity !== undefined) {
      actor.getProperty().setOpacity(options.opacity);
    }
  }

  /**
   * Harden polyData transformations - bake actor transformations into polyData geometry
   * This modifies polyData IN-PLACE to save memory
   * After this, polyData exists in world space with all transformations applied
   */
  private _hardenPolyDataTransform(polyData: any, actor: any): void {
    // Get final transformation parameters from the actor
    const orientation = actor.getOrientation();
    const scale = actor.getScale();
    const position = actor.getPosition();

    // Build transformation matrix: scale -> rotate -> translate
    const transformMatrix = vtkMatrixBuilder
      .buildFromDegree()
      .scale(scale[0], scale[1], scale[2])
      .rotateX(orientation[0])
      .rotateY(orientation[1])
      .rotateZ(orientation[2])
      .translate(position[0], position[1], position[2])
      .getMatrix();

    // Get the points from polyData
    const points = polyData.getPoints();
    const pointsData = points.getData();
    const numPoints = points.getNumberOfPoints();

    // Transform each point IN-PLACE using the matrix
    for (let i = 0; i < numPoints; i++) {
      const idx = i * 3;
      const x = pointsData[idx];
      const y = pointsData[idx + 1];
      const z = pointsData[idx + 2];

      // Apply 4x4 transformation matrix (homogeneous coordinates)
      pointsData[idx] =
        transformMatrix[0] * x + transformMatrix[1] * y + transformMatrix[2] * z + transformMatrix[3];
      pointsData[idx + 1] =
        transformMatrix[4] * x + transformMatrix[5] * y + transformMatrix[6] * z + transformMatrix[7];
      pointsData[idx + 2] =
        transformMatrix[8] * x + transformMatrix[9] * y + transformMatrix[10] * z + transformMatrix[11];
    }

    // Notify that points have been modified
    points.modified();

    console.log(`✅ Hardened polyData transformations (${numPoints} points transformed in-place)`);
    console.log(`   Applied: rotation=${orientation}, scale=${scale}, position=${position}`);
  }

  /**
   * Create model from text content
   */
  private _createModelFromText(
    content: string,
    metadata: ModelMetadata,
    options: ModelLoadOptions
  ): LoadedModel {
    let reader: any;

    // Create OBJ reader
    switch (metadata.format) {
      case ModelFormat.OBJ:
        reader = vtkOBJReader.newInstance();
        reader.parseAsText(content);
        break;
      default:
        throw new Error(`Unsupported format: ${metadata.format}. Only OBJ format is supported.`);
    }

    // Create mapper and actor
    const mapper = vtkMapper.newInstance();
    const actor = vtkActor.newInstance();

    // Handle multiple outputs (OBJ files can have multiple objects)
    const numberOfOutputs = reader.getNumberOfOutputPorts ? reader.getNumberOfOutputPorts() : 1;

    if (numberOfOutputs > 1) {
      // For OBJ files with multiple objects, use the first one
      const polyData = reader.getOutputData(0);
      mapper.setInputData(polyData);
    } else {
      mapper.setInputConnection(reader.getOutputPort());
    }

    actor.setMapper(mapper);

    // Apply initial DICOM alignment transformation and custom options
    this._applyInitialDicomTransform(actor, options);
    actor.setVisibility(metadata.visible);

    // Get polyData and harden transformations (modifies polyData in-place to save memory)
    const polyData = mapper.getInputData();
    this._hardenPolyDataTransform(polyData, actor);

    // Reset actor transform to identity since geometry is now in world space
    actor.setOrientation(0, 0, 0);
    actor.setScale(1, 1, 1);
    actor.setPosition(0, 0, 0);

    return {
      metadata,
      actor,
      mapper,
      reader,
      polyData,
    };
  }

  /**
   * Smart viewport selection - checks if using fourUpMesh and adds to 3D viewport only
   */
  private _addModelToViewportSmart(loadedModel: LoadedModel, viewportId: string): void {
    try {
      // Get hanging protocol service to check current layout
      const { hangingProtocolService } = this.servicesManager.services;
      const hpState = hangingProtocolService?.getState();

      console.log('🔧 [ModelStateService] Checking hanging protocol:', hpState?.protocolId);

      // If using fourUpMesh, find the 3D volume viewport
      if (hpState?.protocolId === 'fourUpMesh') {
        console.log('🎯 [ModelStateService] FourUpMesh layout detected - finding 3D volume viewport');

        const renderingEngines = getRenderingEngines();
        let volume3DViewport = null;

        // Find the volume3d viewport in the fourUpMesh layout
        for (const engine of renderingEngines) {
          const viewports = engine.getViewports();

          for (const vp of viewports) {
            console.log(`🔍 [ModelStateService] Checking viewport: ${vp.id} (type: ${vp.type})`);

            // Check if viewport is a 3D volume viewport
            if (vp.type === 'volume3d') {
              volume3DViewport = vp;
              console.log(`✅ [ModelStateService] Found 3D volume viewport: ${vp.id}`);
              break;
            }
          }

          if (volume3DViewport) break;
        }

        if (volume3DViewport) {
          console.log('🎯 [ModelStateService] Adding model to 3D viewport only:', volume3DViewport.id);
          this._addModelToViewport(loadedModel, volume3DViewport.id);
        } else {
          console.warn('⚠️ [ModelStateService] No 3D volume viewport found in fourUpMesh layout');
          console.warn('⚠️ [ModelStateService] Model will not be added');
        }
      } else {
        // Not using fourUpMesh, add to specified viewport
        console.log('🔧 [ModelStateService] Standard layout - adding to specified viewport:', viewportId);
        this._addModelToViewport(loadedModel, viewportId);
      }
    } catch (error) {
      console.error('❌ [ModelStateService] Error in smart viewport selection:', error);
      // Fallback to regular behavior
      this._addModelToViewport(loadedModel, viewportId);
    }
  }

  /**
   * Add model to a specific viewport
   */
  private _addModelToViewport(loadedModel: LoadedModel, viewportId: string): void {
    try {
      console.log('🔧 [ModelStateService] Adding model to viewport:', viewportId);

      // Get all rendering engines and find the one with our viewport
      const renderingEngines = getRenderingEngines();
      console.log('🔧 [ModelStateService] Available rendering engines:', renderingEngines.length);

      // Log details about each rendering engine
      // there should be 2. 1 "OHIFCornerstoneRenderingEngine"; 2 thumbnail rendering engines
      // if (renderingEngines.length > 0) {
      //   console.log('🔍 [ModelStateService] Rendering engines details:');
      //   renderingEngines.forEach((engine, index) => {
      //     const viewports = engine.getViewports();
      //     console.log(`   Engine ${index + 1}:`);
      //     console.log(`     - ID: "${engine.id}"`);
      //     console.log(`     - Viewports: ${viewports.length}`);
      //     console.log(`     - Has been destroyed: ${engine.hasBeenDestroyed}`);
      //     viewports.forEach(vp => {
      //       console.log(`       • ${vp.id} (type: ${vp.type})`);
      //     });
      //   });
      // }

      if (renderingEngines.length === 0) {
        console.error('❌ [ModelStateService] No rendering engines found!');
        console.error('❌ [ModelStateService] Make sure Cornerstone3D is properly initialized');
        return;
      }

      let renderingEngine = null;
      let viewport = null;

      // Try to find the viewport in any rendering engine
      for (const engine of renderingEngines) {
        console.log('🔧 [ModelStateService] Checking rendering engine:', engine.id);
        try {
          const vp = engine.getViewport(viewportId);
          if (vp) {
            renderingEngine = engine;
            viewport = vp;
            console.log('✅ [ModelStateService] Found viewport in engine:', engine.id);
            break;
          }
        } catch (e) {
          // Viewport not in this engine, continue searching
        }
      }

      if (!renderingEngine || !viewport) {
        console.error('❌ [ModelStateService] Viewport not found:', viewportId);
        console.log('🔧 [ModelStateService] Available viewports:');
        renderingEngines.forEach(engine => {
          const viewports = engine.getViewports();
          viewports.forEach(vp => {
            console.log(`  - ${vp.id} (type: ${vp.type})`);
          });
        });
        return;
      }

      // Check viewport type
      console.log('🔧 [ModelStateService] Viewport type:', viewport.type);

      if (viewport.type !== 'volume3d' && viewport.type !== 'VOLUME_3D') {
        console.warn('⚠️ [ModelStateService] Viewport is not Volume3D!');
        console.warn('⚠️ [ModelStateService] Current type:', viewport.type);
        console.warn('⚠️ [ModelStateService] 3D mesh models require a Volume3D viewport');
        console.warn('⚠️ [ModelStateService] Model will NOT be added to this viewport');
        return;
      }

      // Get the vtk.js renderer from the viewport
      const vtkRenderer = viewport.getRenderer();

      if (!vtkRenderer) {
        console.error('❌ [ModelStateService] No VTK renderer found in viewport');
        return;
      }

      // Get DICOM origin, spacing, and dimensions to align model to center
      const dicomOrigin = this._getDICOMOrigin(viewport);
      const dicomOrientation = this._getDICOMOrientation(viewport);
      const dicomSpacing = this._getDICOMSpacing(viewport);
      const dicomDimensions = this._getDICOMDimensions(viewport);

      if (dicomOrigin && dicomSpacing && dicomDimensions) {
      //   console.log('═══════════════════════════════════════════════════════');
      //   console.log('🎯 [ModelStateService] DICOM SPATIAL ALIGNMENT');
      //   console.log('═══════════════════════════════════════════════════════');
      //   console.log('📋 DICOM Origin (ImagePositionPatient):', dicomOrigin);
      //   console.log('   Tag: (0020,0032) - Patient position in 3D space (mm)');
      //   console.log('   X (LR):', dicomOrigin[0].toFixed(2), 'mm');
      //   console.log('   Y (AP):', dicomOrigin[1].toFixed(2), 'mm');
      //   console.log('   Z (SI):', dicomOrigin[2].toFixed(2), 'mm');

      //   console.log('📋 DICOM Spacing (PixelSpacing + SliceThickness):', dicomSpacing);
      //   console.log('   X spacing:', dicomSpacing[0].toFixed(2), 'mm');
      //   console.log('   Y spacing:', dicomSpacing[1].toFixed(2), 'mm');
      //   console.log('   Z spacing:', dicomSpacing[2].toFixed(2), 'mm');

      //   console.log('📋 DICOM Dimensions:', dicomDimensions);
      //   console.log('   Width (X):', dicomDimensions[0], 'pixels');
      //   console.log('   Height (Y):', dicomDimensions[1], 'pixels');
      //   console.log('   Slices (Z):', dicomDimensions[2], 'slices');

      //   if (dicomOrientation) {
      //     console.log('📋 DICOM Orientation (ImageOrientationPatient):', dicomOrientation);
      //     console.log('   Tag: (0020,0037) - Image orientation cosines');
      //     console.log('   Row direction:', [dicomOrientation[0], dicomOrientation[1], dicomOrientation[2]]);
      //     console.log('   Column direction:', [dicomOrientation[3], dicomOrientation[4], dicomOrientation[5]]);
      //   }

        // Calculate DICOM volume center
        // Center = Origin + (Spacing * Dimensions / 2)
        const dicomCenter: [number, number, number] = [
          dicomOrigin[0] + (dicomSpacing[0] * dicomDimensions[0] / 2),
          dicomOrigin[1] + (dicomSpacing[1] * dicomDimensions[1] / 2),
          dicomOrigin[2] + (dicomSpacing[2] * dicomDimensions[2] / 2),
        ];

        // console.log('───────────────────────────────────────────────────────');
        // console.log('🎯 DICOM Volume Center (Calculated):', dicomCenter);
        // console.log('   X:', dicomCenter[0].toFixed(2), 'mm');
        // console.log('   Y:', dicomCenter[1].toFixed(2), 'mm');
        // console.log('   Z:', dicomCenter[2].toFixed(2), 'mm');
        // console.log('   Formula: Origin + (Spacing × Dimensions / 2)');

        // Get model's current position
        const modelPosArray = loadedModel.actor.getPosition();
        const modelPosition: [number, number, number] = [
          modelPosArray[0],
          modelPosArray[1],
          modelPosArray[2],
        ];
        // console.log('───────────────────────────────────────────────────────');
        // console.log('📍 Model Original Position:', modelPosition);
        // console.log('   X:', modelPosition[0].toFixed(2));
        // console.log('   Y:', modelPosition[1].toFixed(2));
        // console.log('   Z:', modelPosition[2].toFixed(2));

        // Show rotation and scale information
        // const modelOrientation = loadedModel.actor.getOrientation();
        // console.log('🔄 Model Orientation (Rotation):');
        // console.log('   X-axis:', modelOrientation[0].toFixed(2), '°');
        // console.log('   Y-axis:', modelOrientation[1].toFixed(2), '°');
        // console.log('   Z-axis:', modelOrientation[2].toFixed(2), '°');
        // console.log('   Note: 90° X-rotation applied for DICOM coordinate alignment');

        // const modelScale = loadedModel.actor.getScale();
        // console.log('📏 Model Scale:');
        // console.log('   X-scale:', modelScale[0].toFixed(2), 'x');
        // console.log('   Y-scale:', modelScale[1].toFixed(2), 'x');
        // console.log('   Z-scale:', modelScale[2].toFixed(2), 'x');
        // console.log('   Note: 10x default scale applied for better visibility');

        // Calculate new position by merging with DICOM center
        const newPosition: [number, number, number] = [
          modelPosition[0] + dicomCenter[0],
          modelPosition[1] + dicomCenter[1],
          modelPosition[2] + dicomCenter[2],
        ];

        // console.log('───────────────────────────────────────────────────────');
        // console.log('📍 Model New Position (Aligned to DICOM center):', newPosition);
        // console.log('   X:', newPosition[0].toFixed(2), 'mm');
        // console.log('   Y:', newPosition[1].toFixed(2), 'mm');
        // console.log('   Z:', newPosition[2].toFixed(2), 'mm');

        // console.log('───────────────────────────────────────────────────────');
        // console.log('📐 Position Delta (Offset to center):');
        // console.log('   ΔX:', (newPosition[0] - modelPosition[0]).toFixed(2), 'mm');
        // console.log('   ΔY:', (newPosition[1] - modelPosition[1]).toFixed(2), 'mm');
        // console.log('   ΔZ:', (newPosition[2] - modelPosition[2]).toFixed(2), 'mm');
        // console.log('   Magnitude:', Math.sqrt(
        //   Math.pow(newPosition[0] - modelPosition[0], 2) +
        //   Math.pow(newPosition[1] - modelPosition[1], 2) +
        //   Math.pow(newPosition[2] - modelPosition[2], 2)
        // ).toFixed(2), 'mm');
        // console.log('═══════════════════════════════════════════════════════');

        // Apply the position transformation
        loadedModel.actor.setPosition(newPosition[0], newPosition[1], newPosition[2]);

        // Store the DICOM alignment information in metadata
        loadedModel.metadata.dicomOrigin = dicomOrigin;
        loadedModel.metadata.dicomOrientation = dicomOrientation || undefined;
        loadedModel.metadata.originalPosition = modelPosition;
        loadedModel.metadata.alignedPosition = newPosition;

        // console.log('✅ [ModelStateService] Model position successfully aligned to DICOM volume center');
      } else {
        console.warn('⚠️ [ModelStateService] DICOM spatial information not available');
        if (!dicomOrigin) console.warn('⚠️ [ModelStateService] - Missing: DICOM origin');
        if (!dicomSpacing) console.warn('⚠️ [ModelStateService] - Missing: DICOM spacing');
        if (!dicomDimensions) console.warn('⚠️ [ModelStateService] - Missing: DICOM dimensions');
        console.warn('⚠️ [ModelStateService] Model will use its original position');
        console.warn('⚠️ [ModelStateService] Model may not align with DICOM images');
      }

      // console.log('🔧 [ModelStateService] Adding actor to renderer');
      vtkRenderer.addActor(loadedModel.actor);

      // console.log('🔧 [ModelStateService] Resetting camera');
      vtkRenderer.resetCamera();

      // console.log('🔧 [ModelStateService] Rendering viewport');
      viewport.render();

      // console.log('✅ [ModelStateService] Model added successfully to viewport:', viewportId);

      // Note: Model is only added to the specified 3D viewport
      // If you need the model in other viewports, load it separately for each viewport
      // console.log('═══════════════════════════════════════════════════════');
      // console.log('✅ [ModelStateService] Model added to specified 3D viewport only');
      // console.log('═══════════════════════════════════════════════════════');

    } catch (error) {
      console.error('❌ [ModelStateService] Error adding model to viewport:', error);
      console.error('❌ [ModelStateService] Error stack:', error.stack);
    }
  }

  /**
   * Remove model from viewport
   */
  public removeModelFromViewport(modelId: string, viewportId: string): boolean {
    const loadedModel = this.loadedModels.get(modelId);

    if (!loadedModel) {
      console.warn(`Model ${modelId} not found`);
      return false;
    }

    try {
      // Get all rendering engines and find the viewport
      const renderingEngines = getRenderingEngines();

      for (const engine of renderingEngines) {
        try {
          const viewport = engine.getViewport(viewportId);

          if (viewport) {
            const vtkRenderer = viewport.getRenderer();
            if (vtkRenderer) {
              vtkRenderer.removeActor(loadedModel.actor);
              viewport.render();
              console.log('🗑️ [ModelStateService] Model removed from viewport:', viewportId);
              return true;
            }
          }
        } catch (e) {
          // Viewport not in this engine, continue searching
        }
      }

      return false;
    } catch (error) {
      console.error('Error removing model from viewport:', error);
      return false;
    }
  }

  /**
   * Remove model completely (from all viewports and memory)
   */
  public removeModel(modelId: string): boolean {
    const loadedModel = this.loadedModels.get(modelId);

    if (!loadedModel) {
      console.warn(`Model ${modelId} not found`);
      return false;
    }

    console.log('🗑️ [ModelStateService] Removing model from all viewports:', modelId);

    // Remove 2D plane cutters first
    if (loadedModel.planeCutters && loadedModel.planeCutters.length > 0) {
      console.log('🗑️ [ModelStateService] Removing 2D plane cutters...');

      const renderingEngines = getRenderingEngines();

      loadedModel.planeCutters.forEach(async (planeCutter) => {
        try {
          // Find viewport and remove actor + event listener
          for (const engine of renderingEngines) {
            try {
              const viewport = engine.getViewport(planeCutter.viewportId);
              if (viewport) {
                // Remove event listeners if exist
                if (planeCutter.updateCallback && viewport.element) {
                  const { Enums } = await import('@cornerstonejs/core');
                  if (Enums?.Events?.CAMERA_MODIFIED) {
                    viewport.element.removeEventListener(
                      Enums.Events.CAMERA_MODIFIED,
                      planeCutter.updateCallback
                    );
                    console.log(`   📡 Unsubscribed from camera/crosshair events for ${planeCutter.orientation}`);
                  }
                }

                const vtkRenderer = viewport.getRenderer();
                if (vtkRenderer) {
                  vtkRenderer.removeActor(planeCutter.actor);
                  viewport.render();
                  console.log(`   🗑️ Removed ${planeCutter.orientation} plane cutter from ${planeCutter.viewportId}`);
                }
                break;
              }
            } catch (e) {
              // Viewport not in this engine
            }
          }

          // Clean up vtk objects
          planeCutter.actor.delete();
          planeCutter.mapper.delete();
          planeCutter.cutter.delete();
          planeCutter.plane.delete();
        } catch (error) {
          console.error('   ⚠️ Error removing plane cutter:', error.message);
        }
      });

      loadedModel.planeCutters = [];
    }

    // Remove from all viewports in all rendering engines
    const renderingEngines = getRenderingEngines();
    let removedCount = 0;

    renderingEngines.forEach(engine => {
      const viewports = engine.getViewports();

      viewports.forEach(viewport => {
        try {
          const vtkRenderer = viewport.getRenderer();
          if (vtkRenderer) {
            vtkRenderer.removeActor(loadedModel.actor);
            viewport.render();
            removedCount++;
            console.log('   🗑️ Removed from viewport:', viewport.id, '(type:', viewport.type, ')');
          }
        } catch (error) {
          console.error('   ⚠️ Error removing from viewport:', viewport.id, error.message);
        }
      });
    });

    console.log('✅ [ModelStateService] Model removed from', removedCount, 'viewports');

    // Clean up vtk objects
    loadedModel.actor.delete();
    loadedModel.mapper.delete();
    loadedModel.reader.delete();

    // Remove from map
    this.loadedModels.delete(modelId);

    this._broadcastEvent(this.EVENTS.MODEL_REMOVED, { modelId });

    return true;
  }



  /**
   * Get all loaded models
   */
  public getAllModels(): LoadedModel[] {
    return Array.from(this.loadedModels.values());
  }

  /**
   * Get model by ID
   */
  public getModel(modelId: string): LoadedModel | undefined {
    return this.loadedModels.get(modelId);
  }

  /**
   * Get models by viewport ID
   */
  public getModelsByViewport(viewportId: string): LoadedModel[] {
    return this.getAllModels().filter(
      model => model.metadata.viewportId === viewportId
    );
  }

  /**
   * Update model visibility
   */
  public setModelVisibility(modelId: string, visible: boolean): boolean {
    const loadedModel = this.loadedModels.get(modelId);

    if (!loadedModel) {
      return false;
    }

    loadedModel.metadata.visible = visible;
    loadedModel.actor.setVisibility(visible);

    // Re-render affected viewports
    if (loadedModel.metadata.viewportId) {
      const renderingEngine = getRenderingEngine('default');
      const viewport = renderingEngine?.getViewport(loadedModel.metadata.viewportId);
      viewport?.render();
    }

    this._broadcastEvent(this.EVENTS.MODEL_VISIBILITY_CHANGED, { modelId, visible });

    return true;
  }

  /**
   * Update model color
   */
  public setModelColor(modelId: string, color: [number, number, number]): boolean {
    const loadedModel = this.loadedModels.get(modelId);

    if (!loadedModel) {
      return false;
    }

    loadedModel.metadata.color = color;
    loadedModel.actor.getProperty().setColor(color[0], color[1], color[2]);

    if (loadedModel.metadata.viewportId) {
      const renderingEngine = getRenderingEngine('default');
      const viewport = renderingEngine?.getViewport(loadedModel.metadata.viewportId);
      viewport?.render();
    }

    this._broadcastEvent(this.EVENTS.MODEL_UPDATED, { modelId, property: 'color', value: color });

    return true;
  }

  /**
   * Update model opacity
   */
  public setModelOpacity(modelId: string, opacity: number): boolean {
    const loadedModel = this.loadedModels.get(modelId);

    if (!loadedModel) {
      return false;
    }

    loadedModel.metadata.opacity = opacity;
    loadedModel.actor.getProperty().setOpacity(opacity);

    if (loadedModel.metadata.viewportId) {
      const renderingEngine = getRenderingEngine('default');
      const viewport = renderingEngine?.getViewport(loadedModel.metadata.viewportId);
      viewport?.render();
    }

    this._broadcastEvent(this.EVENTS.MODEL_UPDATED, { modelId, property: 'opacity', value: opacity });

    return true;
  }

  /**
   * Clear all models
   */
  public clearAllModels(): void {
    const modelIds = Array.from(this.loadedModels.keys());

    modelIds.forEach(modelId => {
      this.removeModel(modelId);
    });

    this._broadcastEvent(this.EVENTS.MODELS_CLEARED, {});
  }

  /**
   * Helper: Check if string is a URL
   */
  private _isUrl(str: string): boolean {
    try {
      new URL(str);
      return true;
    } catch {
      return str.startsWith('http://') || str.startsWith('https://');
    }
  }

  /**
   * Helper: Extract file name from path
   */
  private _extractFileName(path: string): string {
    return path.split(/[\\/]/).pop() || path;
  }

  /**
   * Helper: Get model format from filename
   * Only OBJ format is supported
   */
  private _getModelFormat(fileName: string): ModelFormat | null {
    const ext = fileName.split('.').pop()?.toLowerCase();

    if (ext === 'obj') {
      return ModelFormat.OBJ;
    }

    return null;
  }

  /**
   * Helper: Generate unique model ID based on filename
   * Uses the filename (without extension) as the base ID
   * Adds a counter suffix if there are duplicate filenames
   */
  private _generateModelId(fileName: string): string {
    // Remove file extension and sanitize the filename
    const baseName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');

    // Check if this ID already exists
    let modelId = baseName;
    let counter = 1;

    while (this.loadedModels.has(modelId)) {
      modelId = `${baseName}_${counter}`;
      counter++;
    }

    return modelId;
  }

  /**
   * Helper: Get DICOM origin (ImagePositionPatient) from viewport
   * This reads the DICOM metadata to get the patient position in 3D space
   */
  private _getDICOMOrigin(viewport: any): [number, number, number] | null {
    try {
      // console.log('🔍 [ModelStateService] Extracting DICOM origin from viewport');

      // For Volume viewports
      if (viewport.type === 'VOLUME_3D' || viewport.type === 'volume3d') {
        // Get the volume actor
        const actors = viewport.getActors();
        if (actors && actors.length > 0) {
          const volumeActor = actors[0];
          const imageData = volumeActor?.actor?.getMapper?.()?.getInputData?.();

          if (imageData) {
            const origin = imageData.getOrigin();
            // console.log('✅ [ModelStateService] Volume origin from imageData:', origin);
            return [origin[0], origin[1], origin[2]];
          }
        }

        // Try to get from viewport properties
        const imageData = viewport.getImageData?.();
        if (imageData) {
          const origin = imageData.getOrigin();
          // console.log('✅ [ModelStateService] Volume origin from viewport.getImageData():', origin);
          return [origin[0], origin[1], origin[2]];
        }
      }

      // For Stack/Orthographic viewports - get from current image metadata
      const imageId = viewport.getCurrentImageId?.();
      if (imageId) {
        // console.log('🔍 [ModelStateService] Getting metadata for imageId:', imageId);

        // Import metaData from cornerstone
        // const { metaData } = require('@cornerstonejs/core');

        // Get imagePlaneModule which contains ImagePositionPatient
        const imagePlaneModule = metaData.get('imagePlaneModule', imageId);

        if (imagePlaneModule && imagePlaneModule.imagePositionPatient) {
          const ipp = imagePlaneModule.imagePositionPatient;
          // console.log('✅ [ModelStateService] ImagePositionPatient:', ipp);
          // console.log('📋 [ModelStateService] DICOM Tag (0020,0032) ImagePositionPatient');

          // Also get ImageOrientationPatient if available
          if (imagePlaneModule.imageOrientationPatient) {
            const iop = imagePlaneModule.imageOrientationPatient;
            // console.log('📋 [ModelStateService] ImageOrientationPatient:', iop);
            // console.log('📋 [ModelStateService] DICOM Tag (0020,0037) ImageOrientationPatient');
          }

          return [ipp[0], ipp[1], ipp[2]];
        }
      }

      // Try alternative method - get from viewport's default actor
      const defaultActor = viewport.getDefaultActor?.();
      if (defaultActor) {
        const actor = defaultActor.actor;
        if (actor) {
          const bounds = actor.getBounds();
          if (bounds) {
            // Calculate center from bounds as fallback
            const origin = [
              (bounds[0] + bounds[1]) / 2,
              (bounds[2] + bounds[3]) / 2,
              (bounds[4] + bounds[5]) / 2,
            ];
            // console.log('⚠️ [ModelStateService] Using actor bounds center as origin:', origin);
            return origin as [number, number, number];
          }
        }
      }

      console.warn('⚠️ [ModelStateService] Could not extract DICOM origin from viewport');
      console.warn('⚠️ [ModelStateService] Viewport type:', viewport.type);
      return null;
    } catch (error) {
      console.error('❌ [ModelStateService] Error getting DICOM origin:', error);
      return null;
    }
  }

  /**
   * Helper: Get DICOM orientation (ImageOrientationPatient) from viewport
   */
  private _getDICOMOrientation(viewport: any): number[] | null {
    try {
      const imageId = viewport.getCurrentImageId?.();
      if (imageId) {
        // const { metaData } = require('@cornerstonejs/core');
        const imagePlaneModule = metaData.get('imagePlaneModule', imageId);

        if (imagePlaneModule && imagePlaneModule.imageOrientationPatient) {
          return imagePlaneModule.imageOrientationPatient;
        }
      }
      return null;
    } catch (error) {
      console.error('❌ [ModelStateService] Error getting DICOM orientation:', error);
      return null;
    }
  }

  /**
   * Helper: Get DICOM spacing (pixel spacing + slice thickness) from viewport
   * Returns [xSpacing, ySpacing, zSpacing] in mm
   */
  private _getDICOMSpacing(viewport: any): [number, number, number] | null {
    try {
      // console.log('🔍 [ModelStateService] Extracting DICOM spacing from viewport');

      // For Volume viewports
      if (viewport.type === 'VOLUME_3D' || viewport.type === 'volume3d') {
        const actors = viewport.getActors();
        if (actors && actors.length > 0) {
          const volumeActor = actors[0];
          const imageData = volumeActor?.actor?.getMapper?.()?.getInputData?.();

          if (imageData) {
            const spacing = imageData.getSpacing();
            // console.log('✅ [ModelStateService] Volume spacing from imageData:', spacing);
            return [spacing[0], spacing[1], spacing[2]];
          }
        }

        // Try to get from viewport properties
        const imageData = viewport.getImageData?.();
        if (imageData) {
          const spacing = imageData.getSpacing();
          // console.log('✅ [ModelStateService] Volume spacing from viewport.getImageData():', spacing);
          return [spacing[0], spacing[1], spacing[2]];
        }
      }

      // For Stack/Orthographic viewports - get from metadata
      const imageId = viewport.getCurrentImageId?.();
      if (imageId) {
        const imagePlaneModule = metaData.get('imagePlaneModule', imageId);

        if (imagePlaneModule) {
          // rowPixelSpacing and columnPixelSpacing for X and Y
          const rowSpacing = imagePlaneModule.rowPixelSpacing || imagePlaneModule.pixelSpacing?.[0] || 1.0;
          const colSpacing = imagePlaneModule.columnPixelSpacing || imagePlaneModule.pixelSpacing?.[1] || 1.0;

          // sliceThickness for Z
          const sliceThickness = imagePlaneModule.sliceThickness || imagePlaneModule.spacingBetweenSlices || 1.0;

          // console.log('✅ [ModelStateService] Spacing from metadata:');
          // console.log('   Row spacing (X):', rowSpacing, 'mm');
          // console.log('   Column spacing (Y):', colSpacing, 'mm');
          // console.log('   Slice thickness (Z):', sliceThickness, 'mm');

          return [rowSpacing, colSpacing, sliceThickness];
        }
      }

      console.warn('⚠️ [ModelStateService] Could not extract DICOM spacing from viewport');
      return null;
    } catch (error) {
      console.error('❌ [ModelStateService] Error getting DICOM spacing:', error);
      return null;
    }
  }

  /**
   * Helper: Get DICOM dimensions (width, height, number of slices) from viewport
   * Returns [width, height, numSlices] in pixels/slices
   */
  private _getDICOMDimensions(viewport: any): [number, number, number] | null {
    try {
      // console.log('🔍 [ModelStateService] Extracting DICOM dimensions from viewport');

      // For Volume viewports
      if (viewport.type === 'VOLUME_3D' || viewport.type === 'volume3d') {
        const actors = viewport.getActors();
        if (actors && actors.length > 0) {
          const volumeActor = actors[0];
          const imageData = volumeActor?.actor?.getMapper?.()?.getInputData?.();

          if (imageData) {
            const dimensions = imageData.getDimensions();
            // console.log('✅ [ModelStateService] Volume dimensions from imageData:', dimensions);
            return [dimensions[0], dimensions[1], dimensions[2]];
          }
        }

        // Try to get from viewport properties
        const imageData = viewport.getImageData?.();
        if (imageData) {
          const dimensions = imageData.getDimensions();
          // console.log('✅ [ModelStateService] Volume dimensions from viewport.getImageData():', dimensions);
          return [dimensions[0], dimensions[1], dimensions[2]];
        }
      }

      // For Stack/Orthographic viewports - get from metadata
      const imageId = viewport.getCurrentImageId?.();
      if (imageId) {
        const imagePlaneModule = metaData.get('imagePlaneModule', imageId);

        if (imagePlaneModule) {
          const rows = imagePlaneModule.rows || 512;
          const columns = imagePlaneModule.columns || 512;

          // Try to get number of slices from viewport
          let numSlices = 1;

          // Try to get from viewport's image IDs
          const imageIds = viewport.getImageIds?.();
          if (imageIds && imageIds.length > 0) {
            numSlices = imageIds.length;
          }

          // console.log('✅ [ModelStateService] Dimensions from metadata:');
          // console.log('   Columns (width):', columns, 'pixels');
          // console.log('   Rows (height):', rows, 'pixels');
          // console.log('   Number of slices:', numSlices);

          return [columns, rows, numSlices];
        }
      }

      console.warn('⚠️ [ModelStateService] Could not extract DICOM dimensions from viewport');
      return null;
    } catch (error) {
      console.error('❌ [ModelStateService] Error getting DICOM dimensions:', error);
      return null;
    }
  }
/**
 * Set transformation matrix for a loaded model
 *
 * @param modelId - The unique identifier for the model
 * @param transform - 4x4 transformation matrix as a flat array of 16 elements (row-major order)
 * @returns true if successful, false otherwise
 */
async setModelTransform(modelId: string, transform: number[]): Promise<boolean> {
  try {
    const loadedModel = this.loadedModels.get(modelId);
    if (!loadedModel) {
      console.error(`❌ Model not found`);
      return false;
    }

    // Validate and convert transform
    if (!Array.isArray(transform) || transform.length !== 16) {
      console.error(`❌ Invalid transform`);
      return false;
    }

    // Convert row-major to column-major and create Float32Array directly
    const finalTransform = new Float32Array([
      transform[0], transform[4], transform[8],  transform[12],
      transform[1], transform[5], transform[9],  transform[13],
      transform[2], transform[6], transform[10], transform[14],
      transform[3], transform[7], transform[11], transform[15]
    ]);


    // // Convert row-major to column-major
    // const jsonTransform = [
    //   transform[0], transform[4], transform[8],  transform[12],
    //   transform[1], transform[5], transform[9],  transform[13],
    //   transform[2], transform[6], transform[10], transform[14],
    //   transform[3], transform[7], transform[11], transform[15]
    // ];


    // // Create 10x scale matrix
    // // const scale10x = [
    // //   10, 0, 0, 0,
    // //   0, 10, 0, 0,
    // //   0, 0, 10, 0,
    // //   0, 0, 0, 1
    // // ];


    // // Compose: Final = JSON × Scale(10x)
    // const finalTransform = new Float32Array(16);
    // for (let row = 0; row < 4; row++) {
    //   for (let col = 0; col < 4; col++) {
    //     let sum = 0;
    //     for (let k = 0; k < 4; k++) {
    //       sum += jsonTransform[row + k * 4] * scale10x[k + col * 4];
    //     }
    //     finalTransform[row + col * 4] = sum;
    //   }
    // }

    // ═════════════════════════════════════════════════════════
    // PART 1: Transform ACTOR (GPU-side, for 3D display)
    // ═════════════════════════════════════════════════════════
    loadedModel.actor.setUserMatrix(finalTransform);
    loadedModel.actor.setPosition(0, 0, 0);
    loadedModel.actor.setScale(1, 1, 1);
    loadedModel.actor.setOrientation(0, 0, 0);

    console.log('✅ Actor transformed (GPU rendering)');

    // ═════════════════════════════════════════════════════════
    // PART 2: Transform POLYDATA (CPU-side, for plane cutters)
    // ═════════════════════════════════════════════════════════

    console.log('🔪 Transforming polyData for plane cutters...');

    // Get ORIGINAL polyData from reader
    const originalPolyData = loadedModel.reader.getOutputData();

    // Create VTK transform object with same matrix
    const vtkTransformObj = vtkTransform.newInstance();
    vtkTransformObj.setMatrix(finalTransform);

    // Create new transformed polyData
    const transformedPolyData = vtkPolyData.newInstance();
    transformedPolyData.shallowCopy(originalPolyData);

    // Transform ALL points
    const points = originalPolyData.getPoints();
    const numPoints = points.getNumberOfPoints();
    const transformedPoints = new Float32Array(numPoints * 3);

    for (let i = 0; i < numPoints; i++) {
      const point = points.getPoint(i);
      const transformedPoint = [0, 0, 0];
      vtkTransformObj.transformPoint(point, transformedPoint);

      const idx = i * 3;
      transformedPoints[idx] = transformedPoint[0];
      transformedPoints[idx + 1] = transformedPoint[1];
      transformedPoints[idx + 2] = transformedPoint[2];
    }

    // Update polyData with transformed coordinates
    transformedPolyData.getPoints().setData(transformedPoints, 3);

    // Store transformed polyData
    loadedModel.polyData = transformedPolyData;

    // Update ALL plane cutters with transformed polyData
    for (const planeCutter of loadedModel.planeCutters) {
      planeCutter.cutter.setInputData(transformedPolyData);
    }

    console.log(`✅ Transformed ${numPoints} points`);
    console.log(`✅ Updated ${loadedModel.planeCutters.length} plane cutters`);
    console.log('✅ Plane cutters now operate on transformed coordinates');


    // ═════════════════════════════════════════════════════════
    // PART 3: Update ALL plane cutters with new polyData
    // This ensures ALL cutters get updated, including ones
    // created before the transform
    // ═════════════════════════════════════════════════════════

    this._updateAllPlaneCutters(modelId);

    console.log('✅ Model transform complete!');
    return true;


    // // Trigger re-render
    // const renderingEngines = getRenderingEngines();
    // for (const engine of renderingEngines) {
    //   engine.render();
    // }

    // return true;

  } catch (error) {
    console.error('❌ Error setting transform:', error);
    console.error('Stack:', error.stack);
    return false;
  }
}

/**
 * Update all plane cutters for a model with the current transformed polyData
 * Call this after updating loadedModel.polyData to ensure all cutters are in sync
 */
private _updateAllPlaneCutters(modelId: string): void {
  const loadedModel = this.loadedModels.get(modelId);

  if (!loadedModel) {
    console.warn(`⚠️ Model ${modelId} not found`);
    return;
  }

  if (!loadedModel.planeCutters || loadedModel.planeCutters.length === 0) {
    console.log('⚠️ No plane cutters to update');
    return;
  }

  console.log(`🔄 Updating ${loadedModel.planeCutters.length} plane cutters with current polyData...`);

  const currentPolyData = loadedModel.polyData;

  for (const planeCutter of loadedModel.planeCutters) {
    console.log(`  🔄 Updating ${planeCutter.orientation} cutter...`);

    // Update input data
    planeCutter.cutter.setInputData(currentPolyData);

    // Force VTK to recompute the cutting
    planeCutter.cutter.modified();
    planeCutter.cutter.update();

    // Update mapper
    planeCutter.mapper.modified();
    planeCutter.mapper.update();

    console.log(`  ✅ ${planeCutter.orientation} cutter updated`);
  }

  console.log(`✅ All plane cutters updated with current polyData`);

  // Trigger re-render of all viewports
  const renderingEngines = getRenderingEngines();
  for (const engine of renderingEngines) {
    engine.render();
  }
}


}

export default ModelStateService;
