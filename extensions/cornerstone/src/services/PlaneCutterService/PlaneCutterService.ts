import { PubSubService, Types as OHIFTypes } from '@ohif/core';
import { getRenderingEngines } from '@cornerstonejs/core';
import vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane';
import vtkCutter from '@kitware/vtk.js/Filters/Core/Cutter';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import { crosshairsHandler } from '../../utils/crosshairsHandler';

/**
 * Per-model cutter data within a viewport's plane cutter
 */
interface ModelCutterData {
  cutter: any; // vtkCutter
  mapper: any; // vtkMapper
  actor: any; // vtkActor
  modelId: string;
  polyData: any; // Reference to the model's polyData
}

/**
 * Plane cutter data for a single viewport
 * Each viewport has ONE plane cutter that cuts ALL models
 */
interface PlaneCutterData {
  viewportId: string;
  orientation: 'axial' | 'coronal' | 'sagittal';
  plane: any; // vtkPlane
  modelCutters: Map<string, ModelCutterData>; // modelId -> ModelCutterData
  updateCallback?: any; // Callback for viewport updates
  eventListenerElement?: any; // Element for event listeners
}

/**
 * Color palette for multi-model visualization
 */
const COLOR_PALETTE = [
  [1.0, 0.5, 0.0], // Orange (default, first model)
  [0.0, 1.0, 1.0], // Cyan
  [1.0, 0.0, 1.0], // Magenta
  [1.0, 1.0, 0.0], // Yellow
  [0.0, 1.0, 0.0], // Green
  [1.0, 0.0, 0.0], // Red
  [0.5, 0.0, 1.0], // Purple
  [0.0, 0.5, 1.0], // Blue
];

/**
 * Service events
 */
const EVENTS = {
  PLANE_CUTTER_ENABLED: 'event::plane_cutter_enabled',
  PLANE_CUTTER_DISABLED: 'event::plane_cutter_disabled',
  PLANE_CUTTER_UPDATED: 'event::plane_cutter_updated',
};

/**
 * PlaneCutterService - Manages 2D plane cutters for 3D models
 *
 * Each orthographic viewport (axial, coronal, sagittal) has ONE plane cutter
 * that cuts ALL models in the world, creating separate colored actors for each model.
 */
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

  private readonly servicesManager: any;
  private planeCutters: PlaneCutterData[];
  private isEnabled: boolean;
  private colorIndex: number;
  private modelColors: Map<string, [number, number, number]>; // Map modelId -> color

  constructor({ servicesManager }) {
    super(EVENTS);
    this.servicesManager = servicesManager;
    this.planeCutters = [];
    this.isEnabled = false;
    this.colorIndex = 0;
    this.modelColors = new Map();

    // Subscribe to ModelStateService events
    this._subscribeToModelEvents();
  }

  /**
   * Subscribe to model events from ModelStateService
   */
  private _subscribeToModelEvents(): void {
    const { modelStateService } = this.servicesManager.services;

    if (!modelStateService) {
      console.warn('⚠️ [PlaneCutterService] ModelStateService not available');
      return;
    }

    // Listen for model added events
    modelStateService.subscribe(
      modelStateService.EVENTS.MODEL_ADDED,
      this._handleModelAdded.bind(this)
    );

    // Listen for model removed events
    modelStateService.subscribe(
      modelStateService.EVENTS.MODEL_REMOVED,
      this._handleModelRemoved.bind(this)
    );

    // Listen for model updated events (transforms, etc)
    modelStateService.subscribe(
      modelStateService.EVENTS.MODEL_UPDATED,
      this._handleModelUpdated.bind(this)
    );

    console.log('✅ [PlaneCutterService] Subscribed to ModelStateService events');
  }

  /**
   * Handle MODEL_ADDED event
   */
  private _handleModelAdded(event: { modelId: string; metadata: any }): void {
    const { modelId } = event;

    console.log(`🔪 [PlaneCutterService] Model added: ${modelId}`);

    if (!this.isEnabled) {
      console.log(`   ℹ️ Plane cutters not enabled, skipping`);
      return;
    }

    if (this.planeCutters.length === 0) {
      console.log(`   ℹ️ Plane cutters not initialized yet, skipping (model will be added when enable() is called)`);
      return;
    }

    // Add model to all plane cutters
    this.addModelToCutters(modelId);
  }

  /**
   * Handle MODEL_REMOVED event
   */
  private _handleModelRemoved(event: { modelId: string }): void {
    const { modelId } = event;

    console.log(`🗑️ [PlaneCutterService] Model removed: ${modelId}`);

    if (!this.isEnabled) {
      return;
    }

    // Remove model from all plane cutters
    this.removeModelFromCutters(modelId);
  }

  /**
   * Handle MODEL_UPDATED event (transforms, visibility changes, etc)
   */
  private _handleModelUpdated(event: { modelId: string; property?: string }): void {
    const { modelId } = event;

    console.log(`🔄 [PlaneCutterService] Model updated: ${modelId}`);

    if (!this.isEnabled) {
      return;
    }

    // Update the model's cutters with latest polyData
    this.updateModelCutters(modelId);
  }

  /**
   * Initialize plane cutters for orthographic viewports
   * This should be called when fourUpMesh layout loads
   * @returns Promise<boolean> - true if initialization successful, false otherwise
   */
  public async initialize(): Promise<boolean> {
    try {
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔪 [PlaneCutterService] INITIALIZING PLANE CUTTERS');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`   Current state: ${this.planeCutters.length} existing plane cutters, isEnabled=${this.isEnabled}`);

      const renderingEngines = getRenderingEngines();

      if (!renderingEngines || renderingEngines.length === 0) {
        console.warn('⚠️ [PlaneCutterService] No rendering engines found');
        return false;
      }

      // Define the specific fourUpMesh viewport IDs we need
      const fourUpMeshViewports = [
        { id: 'fourUpMesh-mpr-axial', orientation: 'axial' as const },
        { id: 'fourUpMesh-mpr-coronal', orientation: 'coronal' as const },
        { id: 'fourUpMesh-mpr-sagittal', orientation: 'sagittal' as const },
      ];

      console.log('🔍 [PlaneCutterService] Looking for specific fourUpMesh viewports:');
      fourUpMeshViewports.forEach(vp => console.log(`   - ${vp.id}`));

      const orthographicViewports: { viewport: any; orientation: 'axial' | 'coronal' | 'sagittal' }[] = [];

      // Find the specific fourUpMesh orthographic viewports
      for (const targetViewport of fourUpMeshViewports) {
        let found = false;

        for (const engine of renderingEngines) {
          try {
            const viewport = engine.getViewport(targetViewport.id);

            if (viewport) {
              // Verify viewport has a renderer (fully initialized)
              const renderer = viewport.getRenderer();
              if (!renderer) {
                console.log(`  ⏳ Viewport ${targetViewport.id} has no renderer yet (not ready)`);
                continue;
              }

              // Verify it's not a 3D viewport
              if (viewport.type === 'volume3d') {
                console.log(`  ⚠️ Viewport ${targetViewport.id} is volume3d (skipping)`);
                continue;
              }

              orthographicViewports.push({
                viewport,
                orientation: targetViewport.orientation
              });
              console.log(`  ✅ Found ${targetViewport.orientation} viewport: ${targetViewport.id}`);
              found = true;
              break;
            }
          } catch (error) {
            // Viewport not in this engine, continue searching
          }
        }

        if (!found) {
          console.warn(`  ⚠️ Could not find viewport: ${targetViewport.id}`);
        }
      }

      if (orthographicViewports.length === 0) {
        console.warn('⚠️ [PlaneCutterService] No fourUpMesh viewports found - viewports may not be ready yet');
        return false;
      }

      if (orthographicViewports.length < 3) {
        console.warn(`⚠️ [PlaneCutterService] Only found ${orthographicViewports.length}/3 fourUpMesh viewports - some may not be ready yet`);
        return false;
      }

      console.log(`✅ [PlaneCutterService] Found all 3 fourUpMesh viewports`);

      // Clear any existing plane cutters before creating new ones
      if (this.planeCutters.length > 0) {
        console.log('🔄 [PlaneCutterService] Clearing existing plane cutters before re-initialization');
        // Disable and cleanup old plane cutters (but don't reset isEnabled flag)
        const wasEnabled = this.isEnabled;
        this.cleanup();
        this.isEnabled = wasEnabled; // Restore the enabled state after cleanup
      }

      // Create a plane cutter for each orthographic viewport
      for (const { viewport, orientation } of orthographicViewports) {
        console.log(`───────────────────────────────────────────────────────`);
        console.log(`🔪 [PlaneCutterService] Creating ${orientation} plane cutter`);

        const planeCutter = await this._createPlaneCutterForViewport(viewport, orientation);

        if (planeCutter) {
          this.planeCutters.push(planeCutter);
          console.log(`  ✅ ${orientation} plane cutter created for viewport: ${viewport.id}`);
        }
      }

      console.log('═══════════════════════════════════════════════════════');
      console.log(`✅ [PlaneCutterService] Created ${this.planeCutters.length} plane cutters`);
      console.log('═══════════════════════════════════════════════════════');

      // Set up synchronized updates across all viewports
      this._setupSynchronizedUpdates();

      return this.planeCutters.length > 0;

    } catch (error) {
      console.error('❌ [PlaneCutterService] Error initializing plane cutters:', error);
      console.error('❌ [PlaneCutterService] Error stack:', error.stack);
      return false;
    }
  }

  /**
   * Set up synchronized updates across all viewports
   * When any viewport changes, all plane cutters update and all viewports render
   */
  private async _setupSynchronizedUpdates(): Promise<void> {
    console.log('🔗 [PlaneCutterService] Setting up synchronized updates');

    // Create centralized update function that updates ALL plane cutters
    const updateAllPlaneCutters = () => {
      try {
        // Fetch crosshair center ONCE for all plane cutters (optimization)
        const crosshairCenter = crosshairsHandler.getCrosshairCenter();

        // Update each plane cutter with the shared crosshair center
        for (const planeCutter of this.planeCutters) {
          this._updateSinglePlaneCutter(planeCutter, crosshairCenter);
        }

        // Render ALL viewports after all cutters are updated
        for (const planeCutter of this.planeCutters) {
          const viewport = this._getViewportById(planeCutter.viewportId);
          if (viewport) {
            viewport.render();
          }
        }
      } catch (error) {
        console.warn('⚠️ [PlaneCutterService] Error in synchronized update:', error.message);
      }
    };

    // Subscribe to CAMERA_MODIFIED events from ALL viewports
    const { Enums } = await import('@cornerstonejs/core');

    for (const planeCutter of this.planeCutters) {
      const viewport = this._getViewportById(planeCutter.viewportId);
      if (viewport && viewport.element && Enums?.Events?.CAMERA_MODIFIED) {
        viewport.element.addEventListener(Enums.Events.CAMERA_MODIFIED, updateAllPlaneCutters);
        planeCutter.updateCallback = updateAllPlaneCutters;
        planeCutter.eventListenerElement = viewport.element;
        console.log(`  📡 ${planeCutter.orientation} viewport subscribed to synchronized updates`);
      }
    }

    // Initial update for all plane cutters
    console.log('🔄 [PlaneCutterService] Performing initial synchronized update');
    updateAllPlaneCutters();

    console.log('✅ [PlaneCutterService] Synchronized updates configured');
  }

  /**
   * Update a single plane cutter's position and cut all models
   * @param planeCutter - The plane cutter to update
   * @param crosshairCenter - The crosshair center (if available), passed from caller for efficiency
   */
  private _updateSinglePlaneCutter(
    planeCutter: PlaneCutterData,
    crosshairCenter: [number, number, number] | null = null
  ): void {
    try {
      const viewport = this._getViewportById(planeCutter.viewportId);
      if (!viewport) {
        return;
      }

      let planeOrigin = null;
      let planeNormal = null;

      // Get camera once for both plane origin and normal calculations
      const camera = viewport.getCamera();
      planeNormal = camera.viewPlaneNormal;

      // Validate plane normal
      if (!planeNormal || planeNormal.length !== 3) {
        return;
      }

      // Use the provided crosshair center if available
      if (crosshairCenter) {
        planeOrigin = crosshairCenter;
      } else {
        // Fallback: Calculate plane origin from viewport's current image slice
        try {
          const imageData = viewport.getImageData?.();
          if (imageData) {
            const { focalPoint } = camera;
            const origin = imageData.getOrigin();
            const spacing = imageData.getSpacing();
            const dimensions = imageData.getDimensions();

            // Calculate the center position of the current slice based on viewport orientation
            if (planeCutter.orientation === 'axial') {
              const sliceIndex = Math.round((focalPoint[2] - origin[2]) / spacing[2]);
              const clampedIndex = Math.max(0, Math.min(dimensions[2] - 1, sliceIndex));
              planeOrigin = [
                origin[0] + (dimensions[0] / 2) * spacing[0],
                origin[1] + (dimensions[1] / 2) * spacing[1],
                origin[2] + clampedIndex * spacing[2]
              ];
            } else if (planeCutter.orientation === 'coronal') {
              const sliceIndex = Math.round((focalPoint[1] - origin[1]) / spacing[1]);
              const clampedIndex = Math.max(0, Math.min(dimensions[1] - 1, sliceIndex));
              planeOrigin = [
                origin[0] + (dimensions[0] / 2) * spacing[0],
                origin[1] + clampedIndex * spacing[1],
                origin[2] + (dimensions[2] / 2) * spacing[2]
              ];
            } else if (planeCutter.orientation === 'sagittal') {
              const sliceIndex = Math.round((focalPoint[0] - origin[0]) / spacing[0]);
              const clampedIndex = Math.max(0, Math.min(dimensions[0] - 1, sliceIndex));
              planeOrigin = [
                origin[0] + clampedIndex * spacing[0],
                origin[1] + (dimensions[1] / 2) * spacing[1],
                origin[2] + (dimensions[2] / 2) * spacing[2]
              ];
            }
          }
        } catch (sliceError) {
          return;
        }
      }

      // If still no valid position, skip update
      if (!planeOrigin || !Array.isArray(planeOrigin) || planeOrigin.length !== 3) {
        return;
      }

      // Update plane origin and normal
      planeCutter.plane.setOrigin(planeOrigin[0], planeOrigin[1], planeOrigin[2]);
      planeCutter.plane.setNormal(planeNormal[0], planeNormal[1], planeNormal[2]);

      // Update all model cutters in this plane
      for (const modelCutterData of planeCutter.modelCutters.values()) {
        modelCutterData.cutter.modified();
        modelCutterData.cutter.update();
      }
    } catch (error) {
      console.warn(`⚠️ [${planeCutter.orientation}] Error updating plane:`, error.message);
    }
  }

  /**
   * Enable plane cutters (make visible)
   */
  public enable(): void {
    console.log('🟢 [PlaneCutterService] Enabling plane cutters');

    if (this.planeCutters.length === 0) {
      console.warn('⚠️ [PlaneCutterService] No plane cutters initialized - cannot enable');
      console.warn('   Call initialize() first before enable()');
      this.isEnabled = true; // Set flag anyway so future models will be added
      return;
    }

    this.isEnabled = true;

    // Add all existing models to cutters
    const { modelStateService } = this.servicesManager.services;
    const models = modelStateService?.getAllModels() || [];

    console.log(`   Found ${models.length} existing models to add to ${this.planeCutters.length} plane cutters`);

    for (const model of models) {
      this.addModelToCutters(model.metadata.id);
    }

    this._broadcastEvent(EVENTS.PLANE_CUTTER_ENABLED, {});
  }

  /**
   * Disable plane cutters (make invisible, remove from viewports)
   */
  public disable(): void {
    console.log('🔴 [PlaneCutterService] Disabling plane cutters');

    if (!this.isEnabled) {
      console.log('  ℹ️ Plane cutters already disabled');
      return;
    }

    this.isEnabled = false;

    // Remove all model cutters from all plane cutters
    for (const planeCutter of this.planeCutters) {
      for (const [modelId, modelCutterData] of planeCutter.modelCutters) {
        try {
          this._removeModelCutterFromViewport(planeCutter, modelId);
        } catch (error) {
          console.warn(`⚠️ Error removing model cutter ${modelId}:`, error.message);
        }
      }
    }

    this._broadcastEvent(EVENTS.PLANE_CUTTER_DISABLED, {});
  }

  /**
   * Get enabled state
   */
  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Add a model to all plane cutters
   */
  public addModelToCutters(modelId: string): void {
    const { modelStateService } = this.servicesManager.services;
    const loadedModel = modelStateService?.getModel(modelId);

    if (!loadedModel) {
      console.warn(`⚠️ [PlaneCutterService] Model ${modelId} not found`);
      return;
    }

    if (this.planeCutters.length === 0) {
      console.log(`ℹ️ [PlaneCutterService] No plane cutters initialized yet, skipping model ${modelId}`);
      return;
    }

    console.log(`🔪 [PlaneCutterService] Adding model ${modelId} to ${this.planeCutters.length} plane cutters`);
    console.log(`   Plane cutter viewport IDs:`, this.planeCutters.map(pc => pc.viewportId));

    // Check for non-fourUpMesh plane cutters (stale/invalid)
    const validViewportIds = ['fourUpMesh-mpr-axial', 'fourUpMesh-mpr-coronal', 'fourUpMesh-mpr-sagittal'];
    const invalidCutters = this.planeCutters.filter(pc => !validViewportIds.includes(pc.viewportId));

    if (invalidCutters.length > 0) {
      console.error(`❌ [PlaneCutterService] Detected invalid plane cutters! Cleaning up...`);
      console.error(`   Invalid viewport IDs:`, invalidCutters.map(pc => pc.viewportId));
      console.error(`   Expected fourUpMesh viewport IDs:`, validViewportIds);
      this.cleanup();
      console.log(`ℹ️ [PlaneCutterService] After cleanup, skipping model ${modelId}`);
      console.log(`ℹ️ Please reload fourUpMesh layout to reinitialize plane cutters`);
      return;
    }

    // Add to each plane cutter
    for (const planeCutter of this.planeCutters) {
      this._addModelToPlaneCutter(planeCutter, loadedModel);
    }

    this._broadcastEvent(EVENTS.PLANE_CUTTER_UPDATED, { modelId, action: 'added' });
  }

  /**
   * Remove a model from all plane cutters
   */
  public removeModelFromCutters(modelId: string): void {
    console.log(`🗑️ [PlaneCutterService] Removing model ${modelId} from all plane cutters`);

    // Remove from each plane cutter
    for (const planeCutter of this.planeCutters) {
      this._removeModelCutterFromViewport(planeCutter, modelId);
    }

    // Remove color assignment for this model
    this.modelColors.delete(modelId);

    this._broadcastEvent(EVENTS.PLANE_CUTTER_UPDATED, { modelId, action: 'removed' });
  }

  /**
   * Update a model's cutters (when polyData changes)
   */
  public updateModelCutters(modelId: string): void {
    const { modelStateService } = this.servicesManager.services;
    const loadedModel = modelStateService?.getModel(modelId);

    if (!loadedModel) {
      console.warn(`⚠️ [PlaneCutterService] Model ${modelId} not found for update`);
      return;
    }

    if (this.planeCutters.length === 0) {
      console.log(`ℹ️ [PlaneCutterService] No plane cutters to update for model ${modelId}`);
      return;
    }

    console.log(`🔄 [PlaneCutterService] Updating cutters for model ${modelId}`);

    // Validate new polyData
    if (!loadedModel.polyData) {
      console.error(`❌ Model ${modelId} has no polyData after update`);
      return;
    }

    const numPoints = loadedModel.polyData.getPoints()?.getNumberOfPoints() || 0;
    const bounds = loadedModel.polyData.getBounds();
    console.log(`  📊 Updated PolyData: ${numPoints} points, bounds:`, bounds);

    // Update in each plane cutter
    for (const planeCutter of this.planeCutters) {
      const modelCutterData = planeCutter.modelCutters.get(modelId);

      if (modelCutterData) {
        console.log(`  🔄 Updating ${planeCutter.orientation} cutter`);

        // Update the cutter with latest polyData
        modelCutterData.cutter.setInputData(loadedModel.polyData);
        modelCutterData.cutter.modified();
        modelCutterData.cutter.update();

        // Check output
        const cutterOutput = modelCutterData.cutter.getOutputData();
        if (cutterOutput) {
          const numCutPoints = cutterOutput.getPoints()?.getNumberOfPoints() || 0;
          console.log(`  ✅ ${planeCutter.orientation} cut produced ${numCutPoints} points`);
        } else {
          console.warn(`  ⚠️ ${planeCutter.orientation} cutter output is null`);
        }

        // Trigger re-render
        const viewport = this._getViewportById(planeCutter.viewportId);
        if (viewport) {
          viewport.render();
        }
      }
    }

    this._broadcastEvent(EVENTS.PLANE_CUTTER_UPDATED, { modelId, action: 'updated' });
  }

  /**
   * Create a plane cutter for a specific viewport
   */
  private async _createPlaneCutterForViewport(
    viewport: any,
    orientation: 'axial' | 'coronal' | 'sagittal'
  ): Promise<PlaneCutterData | null> {
    try {
      // Get the camera to determine the cutting plane
      const camera = viewport.getCamera();
      const { focalPoint, viewPlaneNormal } = camera;

      console.log(`  📋 Camera focal point:`, focalPoint);
      console.log(`  📋 View plane normal:`, viewPlaneNormal);

      // Create VTK plane directly from viewport's camera plane
      const plane = vtkPlane.newInstance();
      plane.setOrigin(focalPoint[0], focalPoint[1], focalPoint[2]);
      plane.setNormal(viewPlaneNormal[0], viewPlaneNormal[1], viewPlaneNormal[2]);

      // Create plane cutter data structure
      const planeCutterData: PlaneCutterData = {
        viewportId: viewport.id,
        orientation,
        plane,
        modelCutters: new Map(),
      };

      // Event listeners will be set up after all plane cutters are created
      planeCutterData.updateCallback = null;
      planeCutterData.eventListenerElement = null;

      console.log(`  ✅ Plane cutter created for ${orientation}`);

      return planeCutterData;

    } catch (error) {
      console.error(`❌ [PlaneCutterService] Error creating plane cutter for ${orientation}:`, error);
      return null;
    }
  }

  /**
   * Add a model to a specific plane cutter
   */
  private _addModelToPlaneCutter(planeCutter: PlaneCutterData, loadedModel: any): void {
    const modelId = loadedModel.metadata.id;

    // Check if already exists
    if (planeCutter.modelCutters.has(modelId)) {
      console.log(`  ℹ️ Model ${modelId} already in ${planeCutter.orientation} cutter`);
      return;
    }

    console.log(`  🔪 Adding model ${modelId} to ${planeCutter.orientation} cutter`);

    // Validate polyData
    if (!loadedModel.polyData) {
      console.error(`❌ Model ${modelId} has no polyData - cannot create plane cutter`);
      console.error(`   Model metadata:`, loadedModel.metadata);
      return;
    }

    const numPoints = loadedModel.polyData.getPoints()?.getNumberOfPoints() || 0;
    const bounds = loadedModel.polyData.getBounds();
    console.log(`  📊 PolyData info: ${numPoints} points, bounds:`, bounds);

    // Create cutter for this model
    const cutter = vtkCutter.newInstance();
    cutter.setCutFunction(planeCutter.plane);
    cutter.setInputData(loadedModel.polyData);

    // Create mapper
    const mapper = vtkMapper.newInstance();
    mapper.setInputConnection(cutter.getOutputPort());

    // Create actor
    const actor = vtkActor.newInstance();
    actor.setMapper(mapper);

    // Assign color from palette (same color for same model across all viewports)
    const color = this._getColorForModel(modelId);
    actor.getProperty().setColor(color[0], color[1], color[2]);
    actor.getProperty().setLineWidth(3);

    // Configure rendering for visibility
    if (mapper.setResolveCoincidentTopologyToPolygonOffset) {
      mapper.setResolveCoincidentTopologyToPolygonOffset();
    }

    if (mapper.setRelativeCoincidentTopologyLineOffsetParameters) {
      mapper.setRelativeCoincidentTopologyLineOffsetParameters(-1, -1);
    }

    actor.getProperty().setOpacity(0.999);

    // Add actor to viewport's renderer
    const viewport = this._getViewportById(planeCutter.viewportId);
    if (!viewport) {
      console.error(`❌ Viewport ${planeCutter.viewportId} not found`);
      return;
    }

    const vtkRenderer = viewport.getRenderer();
    if (!vtkRenderer) {
      console.error(`❌ No VTK renderer found for viewport ${planeCutter.viewportId}`);
      return;
    }

    console.log(`  📍 Target viewport ID: ${planeCutter.viewportId}`);
    console.log(`  📍 Viewport lookup result:`, viewport ? `✅ Found (${viewport.type})` : '❌ Not found');

    vtkRenderer.addActor(actor);
    console.log(`  📐 Actor added to renderer for viewport ${planeCutter.viewportId}`);

    // Force immediate cutter update
    cutter.modified();
    cutter.update();

    // Check cutter output immediately
    const initialOutput = cutter.getOutputData();
    if (initialOutput) {
      const numCutPoints = initialOutput.getPoints()?.getNumberOfPoints() || 0;
      console.log(`  🔍 Initial cutter output: ${numCutPoints} cut points`);
      if (numCutPoints === 0) {
        console.warn(`  ⚠️ Cutter produced 0 points - plane may not intersect model`);
        const planeOrigin = planeCutter.plane.getOrigin();
        const planeNormal = planeCutter.plane.getNormal();
        console.warn(`  ⚠️ Plane: origin=[${planeOrigin}], normal=[${planeNormal}]`);
      }
    } else {
      console.warn(`  ⚠️ Cutter output is null`);
    }

    // Store model cutter data
    const modelCutterData: ModelCutterData = {
      cutter,
      mapper,
      actor,
      modelId,
      polyData: loadedModel.polyData,
    };

    planeCutter.modelCutters.set(modelId, modelCutterData);

    // Render viewport
    viewport.render();

    console.log(`  ✅ Model ${modelId} added to ${planeCutter.orientation} cutter with color [${color}]`);
  }

  /**
   * Remove a model from a specific plane cutter
   */
  private _removeModelCutterFromViewport(planeCutter: PlaneCutterData, modelId: string): void {
    const modelCutterData = planeCutter.modelCutters.get(modelId);

    if (!modelCutterData) {
      return;
    }

    console.log(`  🗑️ Removing model ${modelId} from ${planeCutter.orientation} cutter`);

    // Remove actor from viewport
    try {
      const viewport = this._getViewportById(planeCutter.viewportId);
      if (viewport) {
        const vtkRenderer = viewport.getRenderer();
        if (vtkRenderer) {
          vtkRenderer.removeActor(modelCutterData.actor);
          viewport.render();
        }
      } else {
        console.log(`  ℹ️ Viewport ${planeCutter.viewportId} no longer exists`);
      }
    } catch (error) {
      console.warn(`  ⚠️ Error removing actor from viewport:`, error.message);
    }

    // Clean up VTK objects
    try {
      if (modelCutterData.actor) {
        modelCutterData.actor.delete();
      }
      if (modelCutterData.mapper) {
        modelCutterData.mapper.delete();
      }
      if (modelCutterData.cutter) {
        modelCutterData.cutter.delete();
      }
    } catch (error) {
      console.warn(`  ⚠️ Error deleting VTK objects:`, error.message);
    }

    // Remove from map
    planeCutter.modelCutters.delete(modelId);

    console.log(`  ✅ Model ${modelId} removed from ${planeCutter.orientation} cutter`);
  }

  /**
   * Get viewport by ID
   */
  private _getViewportById(viewportId: string): any {
    const renderingEngines = getRenderingEngines();

    for (const engine of renderingEngines) {
      try {
        const viewport = engine.getViewport(viewportId);
        if (viewport) {
          return viewport;
        }
      } catch (e) {
        // Viewport not in this engine
      }
    }

    return null;
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
      console.warn('⚠️ [PlaneCutterService] Could not determine orientation from camera:', error.message);
    }

    return null;
  }

  /**
   * Get color for a specific model ID
   * Returns the same color for the same model across all viewports
   */
  private _getColorForModel(modelId: string): [number, number, number] {
    // Check if this model already has a color assigned
    if (this.modelColors.has(modelId)) {
      return this.modelColors.get(modelId)!;
    }

    // Assign a new color from the palette
    const color = COLOR_PALETTE[this.colorIndex % COLOR_PALETTE.length] as [number, number, number];
    this.colorIndex++;

    // Store the color for this model
    this.modelColors.set(modelId, color);

    console.log(`🎨 [PlaneCutterService] Assigned color [${color}] to model ${modelId}`);

    return color;
  }

  /**
   * Cleanup - remove all plane cutters
   */
  public cleanup(): void {
    console.log('🗑️ [PlaneCutterService] Cleaning up all plane cutters');

    // Disable first to remove actors
    if (this.isEnabled) {
      this.disable();
    }

    // Remove event listeners and clean up VTK objects
    for (const planeCutter of this.planeCutters) {
      try {
        if (planeCutter.updateCallback && planeCutter.eventListenerElement) {
          const { Enums } = require('@cornerstonejs/core');
          if (Enums?.Events?.CAMERA_MODIFIED) {
            planeCutter.eventListenerElement.removeEventListener(
              Enums.Events.CAMERA_MODIFIED,
              planeCutter.updateCallback
            );
          }
        }

        // Clean up plane
        if (planeCutter.plane) {
          planeCutter.plane.delete();
        }
      } catch (error) {
        console.warn('⚠️ [PlaneCutterService] Error during cleanup:', error.message);
      }
    }

    this.planeCutters = [];
    this.colorIndex = 0;
    this.modelColors.clear(); // Clear model color assignments

    console.log('✅ [PlaneCutterService] Cleanup complete');
  }
}

export default PlaneCutterService;
