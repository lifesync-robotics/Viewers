import { PubSubService, Types as OHIFTypes } from '@ohif/core';
import { getRenderingEngines } from '@cornerstonejs/core';
import vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane';
import vtkCutter from '@kitware/vtk.js/Filters/Core/Cutter';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
// Note: Plane cutters now use camera.focalPoint directly instead of crosshairs center
// This ensures proper synchronization when scrolling MPR slices

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
 * Fallback color palette for models without metadata color
 * This should rarely be used as models should have colors assigned
 */
const FALLBACK_COLOR_PALETTE = [
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
  private svgOverlays: Map<string, SVGElement> = new Map(); // viewportId -> SVGElement
  private resizeObservers: Map<string, ResizeObserver> = new Map(); // viewportId -> ResizeObserver
  private animationFrameId: number | null = null; // For continuous updates during drag
  private lastCameraStates: Map<string, any> = new Map(); // Track camera state to detect changes
  private isUpdating: Set<string> = new Set(); // viewportId -> Set of viewportIds currently being updated (prevents duplicate updates)

  constructor({ servicesManager }) {
    super(EVENTS);
    this.servicesManager = servicesManager;
    this.planeCutters = [];
    this.isEnabled = true; // Enable plane cutters by default for 2D cross-sections
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
   * This should be called when fourUpMesh or MPR layout loads
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

      // Define the viewport IDs we need - support both fourUpMesh and MPR layouts
      const targetViewports = [
        { id: 'fourUpMesh-mpr-axial', orientation: 'axial' as const },
        { id: 'fourUpMesh-mpr-coronal', orientation: 'coronal' as const },
        { id: 'fourUpMesh-mpr-sagittal', orientation: 'sagittal' as const },
        { id: 'mpr-axial', orientation: 'axial' as const },
        { id: 'mpr-coronal', orientation: 'coronal' as const },
        { id: 'mpr-sagittal', orientation: 'sagittal' as const },
      ];

      console.log('🔍 [PlaneCutterService] Looking for orthographic viewports (fourUpMesh or MPR):');
      targetViewports.forEach(vp => console.log(`   - ${vp.id}`));

      const orthographicViewports: { viewport: any; orientation: 'axial' | 'coronal' | 'sagittal' }[] = [];
      const foundOrientations = new Set<string>(); // Track which orientations we've found

      // Find the orthographic viewports
      for (const targetViewport of targetViewports) {
        // Skip if we already found this orientation
        if (foundOrientations.has(targetViewport.orientation)) {
          continue;
        }
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
              foundOrientations.add(targetViewport.orientation);
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
        console.warn('⚠️ [PlaneCutterService] No orthographic viewports found - viewports may not be ready yet');
        return false;
      }

      if (orthographicViewports.length < 3) {
        console.warn(`⚠️ [PlaneCutterService] Only found ${orthographicViewports.length}/3 orthographic viewports - some may not be ready yet`);
        return false;
      }

      console.log(`✅ [PlaneCutterService] Found all 3 orthographic viewports:`, orthographicViewports.map(v => v.viewport.id));

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
      // Note: This is async but we don't await it - it sets up event listeners and starts the loop
      console.log('🔄 [PlaneCutterService] About to call _setupSynchronizedUpdates()...');
      console.log(`  📊 Plane cutters available: ${this.planeCutters.length}`);

      try {
        await this._setupSynchronizedUpdates();
        console.log('  ✅ _setupSynchronizedUpdates() completed successfully');
      } catch (error) {
        console.error('❌ [PlaneCutterService] Error setting up synchronized updates:', error);
        console.error('  Error stack:', error.stack);
      }

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
    console.log(`  📊 Current plane cutters count: ${this.planeCutters.length}`);

    if (this.planeCutters.length === 0) {
      console.warn('  ⚠️ No plane cutters to set up - skipping synchronized updates');
      return;
    }
    console.log(`  📊 Current plane cutters count: ${this.planeCutters.length}`);

    if (this.planeCutters.length === 0) {
      console.warn('  ⚠️ No plane cutters to set up - skipping synchronized updates');
      return;
    }

    // Create centralized update function that updates ALL plane cutters
    const updateAllPlaneCutters = () => {
      try {
        // Update each plane cutter using camera focalPoint (not crosshairs)
        // This ensures plane cutters follow the current slice when scrolling MPR
        for (const planeCutter of this.planeCutters) {
          this._updateSinglePlaneCutter(planeCutter, null); // Use camera focalPoint, not crosshairs
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
      if (viewport && viewport.element) {
        // Listen to CAMERA_MODIFIED for major camera changes
        if (Enums?.Events?.CAMERA_MODIFIED) {
        viewport.element.addEventListener(Enums.Events.CAMERA_MODIFIED, updateAllPlaneCutters);
        }

        // Listen to IMAGE_RENDERED for continuous updates during drag
        // This fires more frequently than CAMERA_MODIFIED during interactions
        if (Enums?.Events?.IMAGE_RENDERED) {
          const imageRenderedHandler = () => {
            // Throttle updates to avoid excessive computation
            // Only update if camera actually changed
            const camera = viewport.getCamera();
            const currentState = JSON.stringify({
              focalPoint: camera.focalPoint,
              viewPlaneNormal: camera.viewPlaneNormal
            });
            const lastState = this.lastCameraStates.get(planeCutter.viewportId);

            if (currentState !== lastState) {
              this.lastCameraStates.set(planeCutter.viewportId, currentState);
              this._updateSinglePlaneCutter(planeCutter, null);
            }
          };
          viewport.element.addEventListener(Enums.Events.IMAGE_RENDERED, imageRenderedHandler);
        }

        planeCutter.updateCallback = updateAllPlaneCutters;
        planeCutter.eventListenerElement = viewport.element;
        console.log(`  📡 ${planeCutter.orientation} viewport subscribed to CAMERA_MODIFIED and IMAGE_RENDERED events`);
      }
    }

    // Initial update for all plane cutters
    console.log('🔄 [PlaneCutterService] Performing initial synchronized update');
    updateAllPlaneCutters();

    // Start continuous update loop using requestAnimationFrame
    // This ensures SVG overlay updates smoothly during drag operations
    // IMPORTANT: Start loop AFTER initial update to ensure plane cutters exist
    console.log('🔄 [PlaneCutterService] About to start continuous update loop...');
    console.log(`  📊 Plane cutters count: ${this.planeCutters.length}`);
    try {
      this._startContinuousUpdateLoop();
      console.log('  ✅ _startContinuousUpdateLoop() method called successfully');
    } catch (error) {
      console.error('❌ [PlaneCutterService] Failed to start continuous update loop:', error);
      console.error('  Error stack:', error.stack);
    }

    console.log('✅ [PlaneCutterService] Synchronized updates configured');
  }

  /**
   * Start continuous update loop using requestAnimationFrame
   * This ensures SVG overlay updates smoothly during drag operations
   */
  private _startContinuousUpdateLoop(): void {
    console.log('🔄 [PlaneCutterService] Attempting to start continuous update loop...');

    // Stop any existing loop
    if (this.animationFrameId !== null) {
      console.log('  ⚠️ Stopping existing animation frame loop');
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Check if we have any plane cutters to update
    if (this.planeCutters.length === 0) {
      console.warn('  ⚠️ No plane cutters to update - skipping loop start');
      return;
    }

    console.log(`  📊 Starting loop for ${this.planeCutters.length} plane cutters`);

    const updateLoop = () => {
      // Update all plane cutters every frame during drag operations
      // This ensures SVG overlay follows camera changes in real-time
      for (const planeCutter of this.planeCutters) {
        const viewport = this._getViewportById(planeCutter.viewportId);
        if (!viewport) {
          continue;
        }

        try {
          const camera = viewport.getCamera();
          if (!camera || !camera.focalPoint || !camera.viewPlaneNormal) {
            continue;
          }

          // TEMPORARY: Update every frame without state comparison
          // This ensures SVG overlay updates smoothly during drag
          // TODO: Re-enable state comparison for performance once working
          this._updateSinglePlaneCutter(planeCutter, null);
        } catch (error) {
          // Silently ignore errors (viewport might be destroyed)
        }
      }

      // Continue loop
      this.animationFrameId = requestAnimationFrame(updateLoop);
    };

    // Start the loop
    this.animationFrameId = requestAnimationFrame(updateLoop);
    console.log('🔄 [PlaneCutterService] Started continuous update loop for real-time SVG overlay');
  }

  /**
   * Stop continuous update loop
   */
  private _stopContinuousUpdateLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Update a single plane cutter's position and cut all models
   * Uses camera focalPoint to determine the cutting plane position
   * This ensures the plane cutter follows the current slice when scrolling MPR
   * @param planeCutter - The plane cutter to update
   * @param _unused - Unused parameter (kept for backwards compatibility)
   */
  private _updateSinglePlaneCutter(
    planeCutter: PlaneCutterData,
    _unused: [number, number, number] | null = null
  ): void {
    // CRITICAL: Prevent duplicate updates in the same frame
    // Multiple event listeners (requestAnimationFrame, CAMERA_MODIFIED, IMAGE_RENDERED)
    // can trigger updates simultaneously, causing duplicate cutter executions and duplicate SVG paths
    if (this.isUpdating.has(planeCutter.viewportId)) {
      // Already updating this viewport, skip duplicate call
      return;
    }

    // Mark as updating
    this.isUpdating.add(planeCutter.viewportId);

    try {
      const viewport = this._getViewportById(planeCutter.viewportId);
      if (!viewport) {
        return;
      }

      // Get camera for plane origin and normal calculations
      const camera = viewport.getCamera();
      const planeNormal = camera.viewPlaneNormal;
      const { focalPoint } = camera;

      // Validate plane normal
      if (!planeNormal || planeNormal.length !== 3) {
        return;
      }

      // Validate focal point
      if (!focalPoint || focalPoint.length !== 3) {
          return;
        }

      // Use camera focalPoint directly as the plane origin
      // This is the correct approach - the cutting plane should be at the camera's focal point
      // which corresponds to the current slice being viewed
      const planeOrigin = [focalPoint[0], focalPoint[1], focalPoint[2]];

      // Update plane origin and normal
      planeCutter.plane.setOrigin(planeOrigin[0], planeOrigin[1], planeOrigin[2]);
      planeCutter.plane.setNormal(planeNormal[0], planeNormal[1], planeNormal[2]);

      // Method 3: Update SVG overlay instead of VTK actors
      const svgOverlay = this._getOrCreateSVGOverlay(viewport);
      if (!svgOverlay) {
        console.warn(`⚠️ SVG overlay not available for viewport ${planeCutter.viewportId}`);
        return;
      }

      // CRITICAL: Clear all existing paths first to avoid duplicate/old contours
      // Get list of current model IDs
      const currentModelIds = new Set(planeCutter.modelCutters.keys());

      // Remove any paths that don't belong to current models
      const allPaths = svgOverlay.querySelectorAll('path[data-model-id]');
      allPaths.forEach((path: Element) => {
        const modelId = path.getAttribute('data-model-id');
        if (modelId && !currentModelIds.has(modelId)) {
          path.remove();
          console.log(`  🗑️ Removed stale SVG path for model ${modelId}`);
        }
      });

      // Update all model cutters in this plane
      for (const modelCutterData of planeCutter.modelCutters.values()) {
        modelCutterData.cutter.modified();
        modelCutterData.cutter.update();

        // Get updated cut output
        const cutOutput = modelCutterData.cutter.getOutputData();
        if (!cutOutput) {
          continue;
        }

        // Get color for this model
        const color = this._getColorForModel(modelCutterData.modelId);
        const colorHex = this._rgbToHex(color[0], color[1], color[2]);

        // Update SVG overlay with new cut contour
        this._renderCutContourToSVG(viewport, svgOverlay, modelCutterData.modelId, cutOutput, colorHex);
      }
    } catch (error) {
      console.warn(`⚠️ [${planeCutter.orientation}] Error updating plane:`, error.message);
    } finally {
      // Always remove from updating set, even if error occurred
      // This ensures the viewport can be updated again in the next frame
      this.isUpdating.delete(planeCutter.viewportId);
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
   * Get all plane cutters (for debugging)
   */
  public getPlaneCutters(): PlaneCutterData[] {
    return this.planeCutters;
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

    // Allow cap models to be added to plane cutters so they are visible in MPR viewports
    // Cap models will show their 2D cross-section contours in MPR viewports
    // while remaining fully visible in 3D viewport

    if (this.planeCutters.length === 0) {
      console.log(`ℹ️ [PlaneCutterService] No plane cutters initialized yet, skipping model ${modelId}`);
      return;
    }

    console.log(`🔪 [PlaneCutterService] Adding model ${modelId} to ${this.planeCutters.length} plane cutters`);
    console.log(`   Plane cutter viewport IDs:`, this.planeCutters.map(pc => pc.viewportId));

    // Check for valid plane cutters (support both fourUpMesh and MPR layouts)
    const validViewportIds = [
      'fourUpMesh-mpr-axial', 'fourUpMesh-mpr-coronal', 'fourUpMesh-mpr-sagittal',
      'mpr-axial', 'mpr-coronal', 'mpr-sagittal'
    ];
    const invalidCutters = this.planeCutters.filter(pc => !validViewportIds.includes(pc.viewportId));

    if (invalidCutters.length > 0) {
      console.error(`❌ [PlaneCutterService] Detected invalid plane cutters! Cleaning up...`);
      console.error(`   Invalid viewport IDs:`, invalidCutters.map(pc => pc.viewportId));
      console.error(`   Expected viewport IDs (fourUpMesh or MPR):`, validViewportIds);
      this.cleanup();
      console.log(`ℹ️ [PlaneCutterService] After cleanup, skipping model ${modelId}`);
      console.log(`ℹ️ Please reload fourUpMesh or MPR layout to reinitialize plane cutters`);
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

    // Get viewport for SVG overlay
    const viewport = this._getViewportById(planeCutter.viewportId);
    if (!viewport) {
      console.error(`❌ Viewport ${planeCutter.viewportId} not found`);
      return;
    }

    console.log(`  📍 Target viewport ID: ${planeCutter.viewportId}`);
    console.log(`  📍 Viewport lookup result:`, viewport ? `✅ Found (${viewport.type})` : '❌ Not found');

    // Method 3: Use SVG Overlay - completely independent of 3D rendering pipeline
    // This ensures cutter plane always renders on top, regardless of volume rendering or slab thickness
    const svgOverlay = this._getOrCreateSVGOverlay(viewport);
    if (!svgOverlay) {
      console.error(`❌ Failed to create SVG overlay for viewport ${planeCutter.viewportId}`);
      return;
    }

    // Create cutter for this model (still needed to compute the cut geometry)
    const cutter = vtkCutter.newInstance();
    cutter.setCutFunction(planeCutter.plane);
    cutter.setInputData(loadedModel.polyData);

    // Force immediate cutter update
    cutter.modified();
    cutter.update();

    // Get cutter output and convert to SVG
    const cutOutput = cutter.getOutputData();
    if (!cutOutput) {
      console.warn(`  ⚠️ Cutter output is null for model ${modelId}`);
      return;
    }

    const numCutPoints = cutOutput.getPoints()?.getNumberOfPoints() || 0;
    console.log(`  🔍 Cutter output: ${numCutPoints} cut points`);

      if (numCutPoints === 0) {
        console.warn(`  ⚠️ Cutter produced 0 points - plane may not intersect model`);
        const planeOrigin = planeCutter.plane.getOrigin();
        const planeNormal = planeCutter.plane.getNormal();
        console.warn(`  ⚠️ Plane: origin=[${planeOrigin}], normal=[${planeNormal}]`);
      // Still store the cutter data even if no points (might intersect later)
    }

    // Get color for this model
    const color = this._getColorForModel(modelId);
    const colorHex = this._rgbToHex(color[0], color[1], color[2]);

    // Render cut contour to SVG overlay
    this._renderCutContourToSVG(viewport, svgOverlay, modelId, cutOutput, colorHex);

    // Store model cutter data (cutter is still needed for updates)
    const modelCutterData: ModelCutterData = {
      cutter,
      mapper: null, // No longer using VTK mapper
      actor: null,   // No longer using VTK actor
      modelId,
      polyData: loadedModel.polyData,
    };

    planeCutter.modelCutters.set(modelId, modelCutterData);

    // Trigger viewport render to show SVG overlay
    viewport.render?.();

    console.log(`  ✅ Model ${modelId} added to ${planeCutter.orientation} cutter with SVG overlay (color: ${colorHex})`);
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

    // Method 3: Remove SVG path element from overlay
    const svg = this.svgOverlays.get(planeCutter.viewportId);
    if (svg) {
      const path = svg.querySelector(`path[data-model-id="${modelId}"]`);
      if (path) {
        path.remove();
        console.log(`  ✅ Removed SVG contour for model ${modelId}`);
      }
    }

    // Clean up VTK objects (cutter is still needed for computation)
    try {
      if (modelCutterData.cutter) {
        modelCutterData.cutter.delete();
      }
      // Note: mapper and actor are null in SVG overlay mode, so no need to delete
    } catch (error) {
      console.warn(`  ⚠️ Error deleting VTK objects:`, error.message);
    }

    // Trigger viewport render
    const viewport = this._getViewportById(planeCutter.viewportId);
    if (viewport) {
      viewport.render?.();
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
   * Priority: 1. Model metadata color, 2. Cached color, 3. Fallback palette
   */
  private _getColorForModel(modelId: string): [number, number, number] {
    // First, try to get color from model metadata (source of truth)
    const { modelStateService } = this.servicesManager.services;
    const loadedModel = modelStateService?.getModel(modelId);

    if (loadedModel && loadedModel.metadata && loadedModel.metadata.color) {
      const metadataColor = loadedModel.metadata.color;

      // Validate it's a proper RGB array
      if (Array.isArray(metadataColor) && metadataColor.length === 3) {
        const color: [number, number, number] = [
          metadataColor[0],
          metadataColor[1],
          metadataColor[2]
        ];

        // Cache it for future lookups
        this.modelColors.set(modelId, color);

        console.log(`🎨 [PlaneCutterService] Using metadata color [${color}] for model ${modelId}`);
        return color;
      }
    }

    // Second, check if we already have a cached color
    if (this.modelColors.has(modelId)) {
      const cachedColor = this.modelColors.get(modelId)!;
      console.log(`🎨 [PlaneCutterService] Using cached color [${cachedColor}] for model ${modelId}`);
      return cachedColor;
    }

    // Last resort: Assign a new color from the fallback palette
    const color = FALLBACK_COLOR_PALETTE[this.colorIndex % FALLBACK_COLOR_PALETTE.length] as [number, number, number];
    this.colorIndex++;

    // Store the color for this model
    this.modelColors.set(modelId, color);

    console.log(`🎨 [PlaneCutterService] Assigned fallback color [${color}] to model ${modelId} (no metadata color)`);

    return color;
  }

  /**
   * Get or create SVG overlay element for viewport (Method 3: SVG Overlay)
   * IMPORTANT: Only create SVG overlay for MPR (orthographic) viewports, NOT for 3D viewports
   */
  private _getOrCreateSVGOverlay(viewport: any): SVGElement | null {
    const viewportId = viewport.id;

    // CRITICAL: Do not create SVG overlay for 3D viewports
    // SVG overlay is only for 2D MPR viewports where we show plane cutter contours
    if (viewport.type === 'volume3d') {
      console.warn(`⚠️ [PlaneCutterService] SVG overlay not created for 3D viewport ${viewportId} - only for MPR viewports`);
      return null;
    }

    // Check if we already have an SVG element
    if (this.svgOverlays.has(viewportId)) {
      const existing = this.svgOverlays.get(viewportId);
      if (existing && document.body.contains(existing)) {
        return existing;
      }
    }

    // Get viewport container element
    const container = viewport.element;
    if (!container) {
      console.error(`❌ Viewport ${viewportId} has no element`);
      return null;
    }

    // Find canvas element inside container
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) {
      console.error(`❌ Viewport ${viewportId} has no canvas element`);
      return null;
    }

    // Create SVG overlay
    // CRITICAL: pointer-events: none ensures mouse events pass through to canvas below
    // This allows drag-and-drop and other interactions to work normally
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'plane-cutter-overlay');
    svg.setAttribute('data-viewport-id', viewportId);
    svg.setAttribute('style', `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    `);
    // Also set pointer-events on SVG element itself (redundant but ensures compatibility)
    (svg as any).style.pointerEvents = 'none';

    // Match canvas display dimensions (not internal resolution)
    // Use clientWidth/clientHeight to match the actual displayed size
    const svgWidth = canvas.clientWidth || canvas.width;
    const svgHeight = canvas.clientHeight || canvas.height;
    svg.setAttribute('width', svgWidth.toString());
    svg.setAttribute('height', svgHeight.toString());
    // Set viewBox to match for proper coordinate scaling
    svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

    // Insert SVG as sibling to canvas (position it absolutely over canvas)
    if (canvas.parentElement) {
      // Make parent relative if not already
      const parentStyle = window.getComputedStyle(canvas.parentElement);
      if (parentStyle.position === 'static') {
        canvas.parentElement.style.position = 'relative';
      }

      canvas.parentElement.appendChild(svg);
    } else {
      console.error(`❌ Canvas parent element not found for viewport ${viewportId}`);
      return null;
    }

    // Store reference
    this.svgOverlays.set(viewportId, svg);

    // Update size on canvas resize
    const resizeObserver = new ResizeObserver(() => {
      const svgWidth = canvas.clientWidth || canvas.width;
      const svgHeight = canvas.clientHeight || canvas.height;
      svg.setAttribute('width', svgWidth.toString());
      svg.setAttribute('height', svgHeight.toString());
      svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
      // Re-render all contours when canvas resizes
      this._updateSVGContoursForViewport(viewport);
    });
    resizeObserver.observe(canvas);
    this.resizeObservers.set(viewportId, resizeObserver);

    console.log(`✅ Created SVG overlay for viewport ${viewportId}`);
    return svg;
  }

  /**
   * Render cut contour to SVG overlay
   */
  private _renderCutContourToSVG(
    viewport: any,
    svg: SVGElement,
    modelId: string,
    cutOutput: any,
    colorHex: string
  ): void {
    // CRITICAL: Remove ALL existing contours for this model
    // Use querySelectorAll to remove duplicate paths (can occur if cutter is called multiple times)
    const existingPaths = svg.querySelectorAll(`path[data-model-id="${modelId}"]`);
    if (existingPaths.length > 0) {
      existingPaths.forEach((path: Element) => {
        path.remove();
      });
    }

    const points = cutOutput.getPoints();
    if (!points || points.getNumberOfPoints() === 0) {
      // No points to render, but don't log warning (plane may not intersect)
      return;
    }

    // Get point coordinates
    const pointData = points.getData();

    // CRITICAL FIX: Use vtkCutter's line connectivity information (getLines)
    // instead of just iterating through points in order.
    // The cutter outputs polylines with proper vertex connectivity.
    const lines = cutOutput.getLines();

    // Validate lines data exists
    if (!lines) {
      return;
    }

    const linesData = lines.getData();
    const numCells = lines.getNumberOfCells();

    if (numCells === 0 || !linesData || linesData.length === 0) {
      return;
    }

    // Helper function to convert world point to canvas point
    const worldToCanvas = (pointIndex: number): [number, number] | null => {
      const worldPoint = [
        pointData[pointIndex * 3],
        pointData[pointIndex * 3 + 1],
        pointData[pointIndex * 3 + 2]
      ];

      try {
        const canvasPoint = viewport.worldToCanvas?.(worldPoint);
        if (canvasPoint && Array.isArray(canvasPoint) && canvasPoint.length >= 2) {
          if (!isNaN(canvasPoint[0]) && !isNaN(canvasPoint[1])) {
            return [canvasPoint[0], canvasPoint[1]];
          }
        }
      } catch (error) {
        // Skip invalid points
      }
      return null;
    };

    // Create a single path element with multiple subpaths
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('data-model-id', modelId);

    let pathData = '';
    let offset = 0;

    // Iterate through each line cell
    // Format: [numPoints, pointId0, pointId1, ..., numPoints, pointId0, ...]
    while (offset < linesData.length) {
      const numPointsInLine = linesData[offset];
      if (numPointsInLine < 2) {
        offset += numPointsInLine + 1;
        continue;
      }

      // Get first point of this line segment
      const firstPointIdx = linesData[offset + 1];
      const firstCanvasPoint = worldToCanvas(firstPointIdx);

      if (firstCanvasPoint) {
        // Start new subpath
        pathData += `M ${firstCanvasPoint[0]} ${firstCanvasPoint[1]} `;

        // Add remaining points in this line
        for (let i = 2; i <= numPointsInLine; i++) {
          const pointIdx = linesData[offset + i];
          const canvasPoint = worldToCanvas(pointIdx);
          if (canvasPoint) {
            pathData += `L ${canvasPoint[0]} ${canvasPoint[1]} `;
          }
        }
      }

      offset += numPointsInLine + 1;
    }

    if (pathData.length === 0) {
      return;
    }

    path.setAttribute('d', pathData.trim());
    path.setAttribute('stroke', colorHex);
    path.setAttribute('stroke-width', '3');
    path.setAttribute('fill', 'none');
    path.setAttribute('opacity', '1.0');
    // CRITICAL: Ensure path does not intercept mouse events - allow events to pass through to canvas
    path.setAttribute('style', 'pointer-events: none;');

    // Add to SVG
    svg.appendChild(path);
  }

  /**
   * Update all SVG contours for a viewport (called on resize)
   */
  private _updateSVGContoursForViewport(viewport: any): void {
    const viewportId = viewport.id;
    const planeCutter = this.planeCutters.find(pc => pc.viewportId === viewportId);
    if (!planeCutter) {
      return;
    }

    const svg = this.svgOverlays.get(viewportId);
    if (!svg) {
      return;
    }

    // Re-render all contours
    for (const modelCutterData of planeCutter.modelCutters.values()) {
      modelCutterData.cutter.modified();
      modelCutterData.cutter.update();

      const cutOutput = modelCutterData.cutter.getOutputData();
      if (!cutOutput) {
        continue;
      }

      const color = this._getColorForModel(modelCutterData.modelId);
      const colorHex = this._rgbToHex(color[0], color[1], color[2]);
      this._renderCutContourToSVG(viewport, svg, modelCutterData.modelId, cutOutput, colorHex);
    }
  }

  /**
   * Convert RGB values (0-1) to hex color string
   */
  private _rgbToHex(r: number, g: number, b: number): string {
    const toHex = (value: number) => {
      const hex = Math.round(Math.max(0, Math.min(255, value * 255))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Cleanup - remove all plane cutters and SVG overlays
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

    // Clean up SVG overlays
    for (const [viewportId, svg] of this.svgOverlays.entries()) {
      try {
        // Remove resize observer
        const observer = this.resizeObservers.get(viewportId);
        if (observer) {
          observer.disconnect();
          this.resizeObservers.delete(viewportId);
        }

        // Remove SVG element from DOM
        if (svg && svg.parentElement) {
          svg.parentElement.removeChild(svg);
        }
      } catch (error) {
        console.warn(`⚠️ [PlaneCutterService] Error removing SVG overlay for ${viewportId}:`, error.message);
      }
    }

    this.svgOverlays.clear();
    this.resizeObservers.clear();
    this.lastCameraStates.clear();
    this.planeCutters = [];
    this.colorIndex = 0;
    this.modelColors.clear(); // Clear model color assignments

    // Stop continuous update loop
    this._stopContinuousUpdateLoop();

    console.log('✅ [PlaneCutterService] Cleanup complete');
  }
}

export default PlaneCutterService;
