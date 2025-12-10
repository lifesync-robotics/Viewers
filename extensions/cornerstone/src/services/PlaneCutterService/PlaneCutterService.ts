import { PubSubService, Types as OHIFTypes } from '@ohif/core';
import { getRenderingEngines } from '@cornerstonejs/core';
import vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane';
import vtkCutter from '@kitware/vtk.js/Filters/Core/Cutter';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkAppendPolyData from '@kitware/vtk.js/Filters/General/AppendPolyData';
import { crosshairsHandler } from '../../utils/crosshairsHandler';

/**
 * Per-model cutter data within a viewport's plane cutter
 */
interface ModelCutterData {
  cutter: any; // vtkCutter (used for thin slices)
  mapper: any; // vtkMapper
  actor: any; // vtkActor
  modelId: string;
  polyData: any; // Reference to the model's polyData
  appendFilter?: any; // vtkAppendPolyData (used for thick slabs, kept alive)
  slabCutters?: any[]; // Array of reusable vtkCutters for slab sampling (kept alive)
  slabPlanes?: any[]; // Array of reusable vtkPlanes for slab sampling (kept alive)
  slabCuttersReverse?: any[]; // Second pass cutters for flipped-normal sweep
  slabPlanesReverse?: any[]; // Second pass planes for flipped-normal sweep
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
  slabThickness?: number; // Slab thickness for multi-slice cutting
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

  constructor({ servicesManager }) {
    super(EVENTS);
    this.servicesManager = servicesManager;
    this.planeCutters = [];
    this.isEnabled = true; // Enable plane cutters by default for 2D cross-sections
    this.colorIndex = 0;
    this.modelColors = new Map();

    // Subscribe to ModelStateService events
    this._subscribeToModelEvents();

    // Subscribe to viewport property changes for slab thickness
    this._subscribeToViewportProperties();
  }

  /**
   * Subscribe to model events from ModelStateService
   */
  private _subscribeToModelEvents(): void {
    const { modelStateService } = this.servicesManager.services;

    if (!modelStateService) {
      // console.warn('⚠️ [PlaneCutterService] ModelStateService not available');
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

    // console.log('✅ [PlaneCutterService] Subscribed to ModelStateService events');
  }

  /**
   * Subscribe to viewport property changes (slab thickness, blend mode)
   */
  private _subscribeToViewportProperties(): void {
    const { cornerstoneViewportService } = this.servicesManager.services;

    if (!cornerstoneViewportService) {
      // console.warn('⚠️ [PlaneCutterService] CornerstoneViewportService not available');
      return;
    }

    const eventName = cornerstoneViewportService.EVENTS.VIEWPORT_PROPERTIES_CHANGED;
    // console.log(`🔔 [PlaneCutterService] Subscribing to event: "${eventName}"`);
    
    cornerstoneViewportService.subscribe(
      eventName,
      this._handleViewportPropertiesChanged.bind(this)
    );

    // console.log('✅ [PlaneCutterService] Subscribed to viewport property changes');
  }

  /**
   * Handle MODEL_ADDED event
   */
  private _handleModelAdded(event: { modelId: string; metadata: any }): void {
    const { modelId } = event;

    // console.log(`🔪 [PlaneCutterService] Model added: ${modelId}`);

    if (!this.isEnabled) {
      // console.log(`   ℹ️ Plane cutters not enabled, skipping`);
      return;
    }

    if (this.planeCutters.length === 0) {
      // console.log(`   ℹ️ Plane cutters not initialized yet, skipping (model will be added when enable() is called)`);
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

    // console.log(`🗑️ [PlaneCutterService] Model removed: ${modelId}`);

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

    // console.log(`🔄 [PlaneCutterService] Model updated: ${modelId}`);

    if (!this.isEnabled) {
      return;
    }

    // Update the model's cutters with latest polyData
    this.updateModelCutters(modelId);
  }

  /**
   * Handle VIEWPORT_PROPERTIES_CHANGED event (slab thickness changes)
   */
  private _handleViewportPropertiesChanged(event: { viewportId: string; properties: any; volumeId?: string }): void {
    const { viewportId, properties } = event;

    // console.log(`📨 [PlaneCutterService] Received VIEWPORT_PROPERTIES_CHANGED`, {
    //   viewportId,
    //   properties,
    //   hasSlabThickness: properties.slabThickness !== undefined,
    //   slabThicknessValue: properties.slabThickness,
    // });

    if (!properties.slabThickness && properties.slabThickness !== 0) {
      // console.log(`   ⏭️ Ignoring - no slab thickness in properties`);
      return; // Only handle slab thickness changes
    }

    const planeCutter = this.planeCutters.find(pc => pc.viewportId === viewportId);
    if (!planeCutter) {
      // console.log(`   ℹ️ Viewport ${viewportId} not managed by PlaneCutterService (3D viewport?)`);
      return; // Viewport not managed by this service
    }

    const oldThickness = planeCutter.slabThickness ?? 0;
    const newThickness = properties.slabThickness;
    // console.log(`📏 [PlaneCutterService] Slab thickness changed for ${planeCutter.orientation}: ${oldThickness}mm → ${newThickness}mm`);
    // console.log(`   Viewport: ${viewportId}, Models to rebuild: ${planeCutter.modelCutters.size}`);
    
    // Get viewport properties for debugging
    const viewport = this._getViewportById(viewportId);
    if (viewport) {
      const viewportProps = viewport.getProperties?.();
      // console.log(`   Viewport properties:`, viewportProps);
    }

    // Store the new slab thickness
    planeCutter.slabThickness = newThickness;

    // Rebuild all model cutters for this viewport with the new slab thickness
    for (const [modelId, modelCutterData] of planeCutter.modelCutters.entries()) {
      // console.log(`   🔄 Rebuilding model ${modelId} with thickness ${newThickness}mm`);
      this._rebuildSlabCut(modelCutterData, planeCutter, { log: true });
    }

    // Trigger re-render
    if (viewport) {
      // console.log(`   🎨 Rendering viewport ${viewportId}`);
      
      // Force VTK renderer to update actors
      const vtkRenderer = viewport.getRenderer();
      if (vtkRenderer) {
        vtkRenderer.resetCameraClippingRange();
        // console.log(`   ✅ VTK renderer updated for ${viewportId}`);
      }
      
      viewport.render();
      // console.log(`   ✅ Viewport ${viewportId} rendered`);
    }
  }

  /**
   * Initialize plane cutters for orthographic viewports
   * This should be called when fourUpMesh or MPR layout loads
   * @returns Promise<boolean> - true if initialization successful, false otherwise
   */
  public async initialize(): Promise<boolean> {
    try {
      // console.log('═══════════════════════════════════════════════════════');
      // console.log('🔪 [PlaneCutterService] INITIALIZING PLANE CUTTERS');
      // console.log('═══════════════════════════════════════════════════════');
      // console.log(`   Current state: ${this.planeCutters.length} existing plane cutters, isEnabled=${this.isEnabled}`);

      const renderingEngines = getRenderingEngines();

      if (!renderingEngines || renderingEngines.length === 0) {
        // console.warn('⚠️ [PlaneCutterService] No rendering engines found');
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

      // console.log('🔍 [PlaneCutterService] Looking for orthographic viewports (fourUpMesh or MPR):');
      targetViewports.forEach(vp => {}); // console.log(`   - ${vp.id}`)

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
                // console.log(`  ⏳ Viewport ${targetViewport.id} has no renderer yet (not ready)`);
                continue;
              }

              // Verify it's not a 3D viewport
              if (viewport.type === 'volume3d') {
                // console.log(`  ⚠️ Viewport ${targetViewport.id} is volume3d (skipping)`);
                continue;
              }

              orthographicViewports.push({
                viewport,
                orientation: targetViewport.orientation
              });
              // console.log(`  ✅ Found ${targetViewport.orientation} viewport: ${targetViewport.id}`);
              foundOrientations.add(targetViewport.orientation);
              found = true;
              break;
            }
          } catch (error) {
            // Viewport not in this engine, continue searching
          }
        }

        if (!found) {
          // console.warn(`  ⚠️ Could not find viewport: ${targetViewport.id}`);
        }
      }

      if (orthographicViewports.length === 0) {
        // console.warn('⚠️ [PlaneCutterService] No orthographic viewports found - viewports may not be ready yet');
        return false;
      }

      if (orthographicViewports.length < 3) {
        // console.warn(`⚠️ [PlaneCutterService] Only found ${orthographicViewports.length}/3 orthographic viewports - some may not be ready yet`);
        return false;
      }

      // console.log(`✅ [PlaneCutterService] Found all 3 orthographic viewports:`, orthographicViewports.map(v => v.viewport.id));

      // Clear any existing plane cutters before creating new ones
      if (this.planeCutters.length > 0) {
        // console.log('🔄 [PlaneCutterService] Clearing existing plane cutters before re-initialization');
        // Disable and cleanup old plane cutters (but don't reset isEnabled flag)
        const wasEnabled = this.isEnabled;
        this.cleanup();
        this.isEnabled = wasEnabled; // Restore the enabled state after cleanup
      }

      // Create a plane cutter for each orthographic viewport
      for (const { viewport, orientation } of orthographicViewports) {
        // console.log(`───────────────────────────────────────────────────────`);
        // console.log(`🔪 [PlaneCutterService] Creating ${orientation} plane cutter`);

        const planeCutter = await this._createPlaneCutterForViewport(viewport, orientation);

        if (planeCutter) {
          this.planeCutters.push(planeCutter);
          // console.log(`  ✅ ${orientation} plane cutter created for viewport: ${viewport.id}`);
        }
      }

      // console.log('═══════════════════════════════════════════════════════');
      // console.log(`✅ [PlaneCutterService] Created ${this.planeCutters.length} plane cutters`);
      // console.log('═══════════════════════════════════════════════════════');

      // Set up synchronized updates across all viewports
      this._setupSynchronizedUpdates();

      return this.planeCutters.length > 0;

    } catch (error) {
      // console.error('❌ [PlaneCutterService] Error initializing plane cutters:', error);
      // console.error('❌ [PlaneCutterService] Error stack:', error.stack);
      return false;
    }
  }

  /**
   * Set up synchronized updates across all viewports
   * When any viewport changes, all plane cutters update and all viewports render
   */
  private async _setupSynchronizedUpdates(): Promise<void> {
    // console.log('🔗 [PlaneCutterService] Setting up synchronized updates');

    // Per-viewport updater (isolated VTK objects per viewport)
    let updateCount = 0;
    const updatePlaneCutter = (planeCutter: PlaneCutterData) => {
      try {
        updateCount++;
        if (updateCount % 10 === 0) {
          // console.log(`🔄 [PlaneCutterService] Plane cutter update #${updateCount} for ${planeCutter.orientation}`);
        }

        const crosshairCenter = crosshairsHandler.getCrosshairCenter();
        this._updateSinglePlaneCutter(planeCutter, crosshairCenter);

        const viewport = this._getViewportById(planeCutter.viewportId);
        if (viewport) {
          viewport.render();
        }
      } catch (error) {
        // console.warn(`⚠️ [PlaneCutterService] Error updating ${planeCutter.orientation}:`, error.message);
      }
    };

    // Check for slab thickness changes for a specific viewport (no throttling to catch slow scroll updates)
    const checkSlabThickness = (planeCutter: PlaneCutterData) => {
      const viewport = this._getViewportById(planeCutter.viewportId);
      if (!viewport) return;

      try {
        const props = viewport.getProperties?.();
        const currentThickness = props?.slabThickness ?? 0;
        const storedThickness = planeCutter.slabThickness ?? 0;

        if (currentThickness !== storedThickness) {
          // console.log(`📏 [PlaneCutterService] Detected slab thickness change for ${planeCutter.orientation}: ${storedThickness}mm → ${currentThickness}mm`);
          
          // Store new thickness
          planeCutter.slabThickness = currentThickness;

          // Rebuild all model cutters for THIS viewport only
          for (const [modelId, modelCutterData] of planeCutter.modelCutters.entries()) {
            // console.log(`   🔄 Rebuilding model ${modelId} with thickness ${currentThickness}mm (viewport ${planeCutter.viewportId})`);
            this._rebuildSlabCut(modelCutterData, planeCutter);
          }

          // Trigger re-render
          viewport.render();
        } else if (currentThickness > 0) {
          // Even if thickness unchanged, ensure mapper stays connected to slab append filter
          for (const [_, modelCutterData] of planeCutter.modelCutters.entries()) {
            if (modelCutterData.appendFilter) {
              modelCutterData.mapper.setInputConnection(modelCutterData.appendFilter.getOutputPort());
            }
          }
          viewport.render();
        }
      } catch (error) {
        // Ignore errors in slab thickness check
      }
    };

    // Subscribe to CAMERA_MODIFIED events from ALL viewports
    const { Enums } = await import('@cornerstonejs/core');

    for (const planeCutter of this.planeCutters) {
      const viewport = this._getViewportById(planeCutter.viewportId);
      if (viewport && viewport.element && Enums?.Events?.CAMERA_MODIFIED) {
        // Combined update function that ONLY touches this viewport's VTK objects
        const combinedUpdate = () => {
          updatePlaneCutter(planeCutter);
          checkSlabThickness(planeCutter);
        };

        viewport.element.addEventListener(Enums.Events.CAMERA_MODIFIED, combinedUpdate);
        planeCutter.updateCallback = combinedUpdate;
        planeCutter.eventListenerElement = viewport.element;
        // console.log(`  📡 ${planeCutter.orientation} viewport subscribed to synchronized updates + slab thickness monitoring`);
      }
    }

    // Initial per-viewport update (isolated)
    // console.log('🔄 [PlaneCutterService] Performing initial per-viewport updates');
    for (const planeCutter of this.planeCutters) {
      updatePlaneCutter(planeCutter);
      checkSlabThickness(planeCutter);
    }

    // console.log('✅ [PlaneCutterService] Synchronized updates configured');
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

      // Use provided crosshair center; if absent, fetch from handler; fallback to legacy imageData only if unavailable
      if (crosshairCenter) {
        planeOrigin = crosshairCenter;
      } else {
        const handlerCenter = crosshairsHandler.getCrosshairCenter?.();
        if (handlerCenter && Array.isArray(handlerCenter) && handlerCenter.length === 3) {
          planeOrigin = handlerCenter;
        } else {
          // Legacy fallback: derive from imageData if crosshair center unavailable
          try {
            const imageData = viewport.getImageData?.();
            if (imageData) {
              const { focalPoint } = camera;
              const origin = imageData.getOrigin();
              const spacing = imageData.getSpacing();
              const dimensions = imageData.getDimensions();

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
      }

      // If still no valid position, skip update
      if (!planeOrigin || !Array.isArray(planeOrigin) || planeOrigin.length !== 3) {
        return;
      }

      // Update plane origin and normal
      planeCutter.plane.setOrigin(planeOrigin[0], planeOrigin[1], planeOrigin[2]);
      planeCutter.plane.setNormal(planeNormal[0], planeNormal[1], planeNormal[2]);

      // Update all model cutters in this plane with slab thickness support
      for (const modelCutterData of planeCutter.modelCutters.values()) {
        // Rebuild slab cut with new plane position (from scrolling or crosshair movement)
        // IMPORTANT: This should preserve the current slab thickness
        const currentThickness = planeCutter.slabThickness ?? 0;
        if (currentThickness > 0) {
          // Only rebuild for THICK SLAB mode (expensive operation)
          // Increased logging frequency to 10% for debugging slab issues
          
          this._rebuildSlabCut(modelCutterData, planeCutter, { log: true });
        }
        // IMPORTANT: DO NOT rebuild thin slices on every scroll!
        // Thin slice cutter already tracks the plane automatically via planeCutter.plane
        // Rebuilding would overwrite slab rendering from other viewports
      }
    } catch (error) {
      // console.warn(`⚠️ [${planeCutter.orientation}] Error updating plane:`, error.message);
    }
  }

  /**
   * Enable plane cutters (make visible)
   */
  public enable(): void {
    // console.log('🟢 [PlaneCutterService] Enabling plane cutters');

    if (this.planeCutters.length === 0) {
      // console.warn('⚠️ [PlaneCutterService] No plane cutters initialized - cannot enable');
      // console.warn('   Call initialize() first before enable()');
      this.isEnabled = true; // Set flag anyway so future models will be added
      return;
    }

    this.isEnabled = true;

    // Add all existing models to cutters
    const { modelStateService } = this.servicesManager.services;
    const models = modelStateService?.getAllModels() || [];

    // console.log(`   Found ${models.length} existing models to add to ${this.planeCutters.length} plane cutters`);

    for (const model of models) {
      this.addModelToCutters(model.metadata.id);
    }

    this._broadcastEvent(EVENTS.PLANE_CUTTER_ENABLED, {});
  }

  /**
   * Disable plane cutters (make invisible, remove from viewports)
   */
  public disable(): void {
    // console.log('🔴 [PlaneCutterService] Disabling plane cutters');

    if (!this.isEnabled) {
      // console.log('  ℹ️ Plane cutters already disabled');
      return;
    }

    this.isEnabled = false;

    // Remove all model cutters from all plane cutters
    for (const planeCutter of this.planeCutters) {
      for (const [modelId, modelCutterData] of planeCutter.modelCutters) {
        try {
          this._removeModelCutterFromViewport(planeCutter, modelId);
        } catch (error) {
          // console.warn(`⚠️ Error removing model cutter ${modelId}:`, error.message);
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
      // console.warn(`⚠️ [PlaneCutterService] Model ${modelId} not found`);
      return;
    }

    if (this.planeCutters.length === 0) {
      // console.log(`ℹ️ [PlaneCutterService] No plane cutters initialized yet, skipping model ${modelId}`);
      return;
    }

    // console.log(`🔪 [PlaneCutterService] Adding model ${modelId} to ${this.planeCutters.length} plane cutters`);
    // console.log(`   Plane cutter viewport IDs:`, this.planeCutters.map(pc => pc.viewportId));

    // Check for valid plane cutters (support both fourUpMesh and MPR layouts)
    const validViewportIds = [
      'fourUpMesh-mpr-axial', 'fourUpMesh-mpr-coronal', 'fourUpMesh-mpr-sagittal',
      'mpr-axial', 'mpr-coronal', 'mpr-sagittal'
    ];
    const invalidCutters = this.planeCutters.filter(pc => !validViewportIds.includes(pc.viewportId));

    if (invalidCutters.length > 0) {
      // console.error(`❌ [PlaneCutterService] Detected invalid plane cutters! Cleaning up...`);
      // console.error(`   Invalid viewport IDs:`, invalidCutters.map(pc => pc.viewportId));
      // console.error(`   Expected viewport IDs (fourUpMesh or MPR):`, validViewportIds);
      this.cleanup();
      // console.log(`ℹ️ [PlaneCutterService] After cleanup, skipping model ${modelId}`);
      // console.log(`ℹ️ Please reload fourUpMesh or MPR layout to reinitialize plane cutters`);
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
    // console.log(`🗑️ [PlaneCutterService] Removing model ${modelId} from all plane cutters`);

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
      // console.warn(`⚠️ [PlaneCutterService] Model ${modelId} not found for update`);
      return;
    }

    if (this.planeCutters.length === 0) {
      // console.log(`ℹ️ [PlaneCutterService] No plane cutters to update for model ${modelId}`);
      return;
    }

    // console.log(`🔄 [PlaneCutterService] Updating cutters for model ${modelId}`);

    // Validate new polyData
    if (!loadedModel.polyData) {
      // console.error(`❌ Model ${modelId} has no polyData after update`);
      return;
    }

    const numPoints = loadedModel.polyData.getPoints()?.getNumberOfPoints() || 0;
    const bounds = loadedModel.polyData.getBounds();
    // console.log(`  📊 Updated PolyData: ${numPoints} points, bounds:`, bounds);

    // Update in each plane cutter
    for (const planeCutter of this.planeCutters) {
      const modelCutterData = planeCutter.modelCutters.get(modelId);

      if (modelCutterData) {
        // console.log(`  🔄 Updating ${planeCutter.orientation} cutter`);

        // Update polyData reference
        modelCutterData.polyData = loadedModel.polyData;

        // Rebuild the slab cut with updated polyData
        this._rebuildSlabCut(modelCutterData, planeCutter);

        // Check output (cutter always has the base plane cut)
        const outputData = modelCutterData.cutter.getOutputData();
        if (outputData) {
          const numCutPoints = outputData.getPoints()?.getNumberOfPoints() || 0;
          const slabInfo = (planeCutter.slabThickness ?? 0) > 0 ? ` (slab mode)` : '';
          // console.log(`  ✅ ${planeCutter.orientation} cut produced ${numCutPoints} points${slabInfo}`);
        } else {
          // console.warn(`  ⚠️ ${planeCutter.orientation} cutter output is null`);
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
   * Rebuild cutter output for slab thickness by sampling multiple parallel planes
   * @param modelCutterData - The model cutter data to update
   * @param planeCutter - The parent plane cutter containing slab thickness
   */
  private _rebuildSlabCut(
    modelCutterData: ModelCutterData,
    planeCutter: PlaneCutterData,
    options: { log?: boolean } = {}
  ): void {
    const { log = false } = options;
    const thickness = planeCutter.slabThickness ?? 0;

    // If no thickness (thin slice), use standard single-plane cutting
    if (thickness <= 0) {
      if (log) {
        // console.log(`  ⚠️ Switching to THIN SLICE mode (thickness=${thickness})`);
      }
      
      // Clean up any existing append filter from previous slab mode
      if (modelCutterData.appendFilter) {
        if (log) {
          // console.log(`  🗑️ Deleting append filter (switching from slab to thin slice)`);
        }
        modelCutterData.appendFilter.delete();
        modelCutterData.appendFilter = null;
      }

      // Ensure cutter has the correct plane and input data
      modelCutterData.cutter.setCutFunction(planeCutter.plane);
      modelCutterData.cutter.setInputData(modelCutterData.polyData);
      modelCutterData.cutter.modified();
      modelCutterData.cutter.update();

      // Connect mapper to cutter output (thin slice mode)
      modelCutterData.mapper.setInputConnection(modelCutterData.cutter.getOutputPort());
      modelCutterData.mapper.modified();
      modelCutterData.actor.modified();
      
      // console.log(`  ⚡ THIN SLICE mode activated (overwriting any slab)`);
      return;
    }
    
    if (log) {
      // console.log(`  📏 THICK SLAB mode (thickness=${thickness.toFixed(2)}mm)`);
    }

    // For thick slabs, sample multiple planes and merge their outputs
    // CRITICAL: Delete and recreate append filter each time to clear old inputs
    // (VTK.js vtkAppendPolyData accumulates connections without a proper clear method)
    if (modelCutterData.appendFilter) {
      modelCutterData.appendFilter.delete();
    }
    modelCutterData.appendFilter = vtkAppendPolyData.newInstance();
    const append = modelCutterData.appendFilter;

    // -----------------------------------------------------------------------
    // Coordinate frame alignment
    // Grab plane in world space (same as thin-cutter) and optionally map
    // into the model's local frame if the model appears translated relative
    // to its bounds. This keeps slab sampling consistent with thin-slice
    // rendering even when models carry per-actor transforms.
    // -----------------------------------------------------------------------
    const worldOrigin = planeCutter.plane.getOrigin();
    const worldNormal = planeCutter.plane.getNormal();
    let origin = [...worldOrigin];
    let normal = [...worldNormal];
    let frameLabel = 'world';

    // Heuristic: if actor has a user matrix and its translation is far from
    // the polyData bounds center (>5mm), treat polyData as model-space and
    // transform the plane into that model frame.
    const actorMatrix = modelCutterData.actor?.getUserMatrix?.() as Float32Array | null;
    const modelBoundsWorld = modelCutterData.polyData?.getBounds?.();
    let modelBoundsInFrame = modelBoundsWorld;

    if (actorMatrix && modelBoundsWorld) {
      const translation = [actorMatrix[12], actorMatrix[13], actorMatrix[14]];
      const boundsCenter = [
        (modelBoundsWorld[0] + modelBoundsWorld[1]) / 2,
        (modelBoundsWorld[2] + modelBoundsWorld[3]) / 2,
        (modelBoundsWorld[4] + modelBoundsWorld[5]) / 2,
      ];
      const distToCenter = Math.hypot(
        translation[0] - boundsCenter[0],
        translation[1] - boundsCenter[1],
        translation[2] - boundsCenter[2]
      );

      const shouldMapToModelFrame = distToCenter > 5; // mm heuristic
      const invActor = shouldMapToModelFrame ? this._invert4x4(actorMatrix) : null;

      if (invActor) {
        origin = this._transformPoint(invActor, worldOrigin);
        normal = this._normalizeVector(this._transformVector(invActor, worldNormal));
        modelBoundsInFrame = this._transformBounds(invActor, modelBoundsWorld);
        frameLabel = 'model';
      }
    }

    // If polyData is effectively in world (frameLabel === 'world') but actor still
    // carries a userMatrix, we would double-transform on render. Clear it so
    // the slab output stays aligned with the volume.
    if (frameLabel === 'world' && actorMatrix && this._isNonIdentity4x4(actorMatrix)) {
      const identity4 = this._identity4x4();
      modelCutterData.actor.setUserMatrix(identity4);
      if (log) {
        // console.log('   🧭 Cleared actor userMatrix to avoid double-transform (polyData already in world)');
      }
    }

    // Two-pass sampling across slab: one sweep with +normal, one with -normal.
    // This explicitly covers both directions to neutralize any directional bias.
    const stepSize = 0.5; // fixed step size of 0.15mm
    const halfThickness = thickness / 2;
    const maxStepsPerSide = 50; // safety clamp
    const stepsPerSide = Math.max(1, Math.min(maxStepsPerSide, Math.ceil(halfThickness / stepSize)));

    const forwardOffsets: number[] = [0]; // includes base plane
    const reverseOffsets: number[] = [];  // swept along -normal (no base to avoid duplication)
    for (let i = 1; i <= stepsPerSide; i++) {
      const delta = i * stepSize;
      if (delta <= halfThickness + 1e-3) {
        forwardOffsets.push(delta);   // +normal direction
        reverseOffsets.push(delta);   // -normal direction (handled with flipped normal)
      }
    }

    if (log) {
      // console.log(
      //   `  📏 Two-pass slab build: forward=${forwardOffsets.length} slices, reverse=${reverseOffsets.length} slices (thickness: ${thickness.toFixed(2)}mm, step size: ${stepSize.toFixed(2)}mm)`
      // );
      // console.log(
      //   `  📐 Base plane: origin=[${origin[0].toFixed(2)}, ${origin[1].toFixed(2)}, ${origin[2].toFixed(2)}], normal=[${normal[0]}, ${normal[1]}, ${normal[2]}]`
      // );
    }

    // Initialize or resize reusable cutter/plane arrays for BOTH passes
    if (!modelCutterData.slabCutters) {
      modelCutterData.slabCutters = [];
      modelCutterData.slabPlanes = [];
    }
    if (!modelCutterData.slabCuttersReverse) {
      modelCutterData.slabCuttersReverse = [];
      modelCutterData.slabPlanesReverse = [];
    }
    
    const resizeReusableArrays = (cutters: any[], planes: any[], targetLength: number) => {
      while (cutters.length > targetLength) {
        const oldCutter = cutters.pop();
        const oldPlane = planes.pop();
        if (oldCutter) oldCutter.delete();
        if (oldPlane) oldPlane.delete();
      }
      while (cutters.length < targetLength) {
        planes.push(vtkPlane.newInstance());
        cutters.push(vtkCutter.newInstance());
      }
    };

    resizeReusableArrays(modelCutterData.slabCutters, modelCutterData.slabPlanes, forwardOffsets.length);
    resizeReusableArrays(modelCutterData.slabCuttersReverse, modelCutterData.slabPlanesReverse, reverseOffsets.length);
    
    // CRITICAL: Set input data for ALL cutters (both passes)
    [...modelCutterData.slabCutters, ...modelCutterData.slabCuttersReverse].forEach(slabCutter => {
      slabCutter.setInputData(modelCutterData.polyData);
    });

    const runSweep = (
      offsetsList: number[],
      planesArr: any[],
      cuttersArr: any[],
      sweepNormal: number[],
      label: string
    ) => {
      let sweepTotalPoints = 0;
      let sweepPositiveHits = 0;
      let sweepNegativeHits = 0;
      let sweepZeroHit = 0;
      const sweepPorts = [];

      // Track first few hits/misses for detailed debugging
      let firstPosHit = null;
      let firstNegHit = null;
      let firstPosMiss = null;
      let firstNegMiss = null;

      for (let i = 0; i < offsetsList.length; i++) {
        const offset = offsetsList[i];
        const offsetOrigin = [
          origin[0] + sweepNormal[0] * offset,
          origin[1] + sweepNormal[1] * offset,
          origin[2] + sweepNormal[2] * offset,
        ];

        const slabPlane = planesArr[i];
        const slabCutter = cuttersArr[i];

        slabPlane.setOrigin(offsetOrigin[0], offsetOrigin[1], offsetOrigin[2]);
        slabPlane.setNormal(sweepNormal[0], sweepNormal[1], sweepNormal[2]);

        slabCutter.setInputData(modelCutterData.polyData);
        slabCutter.setCutFunction(slabPlane);
        slabCutter.modified();
        slabCutter.update();

        const sliceOutput = slabCutter.getOutputData();
        const numPoints = sliceOutput ? sliceOutput.getPoints()?.getNumberOfPoints() || 0 : 0;
        if (sliceOutput && numPoints > 0) {
          sweepPorts.push(slabCutter.getOutputPort());
          sweepTotalPoints += numPoints;

          if (offset > 0) {
            sweepPositiveHits++;
            if (!firstPosHit) firstPosHit = { offset, origin: offsetOrigin, points: numPoints };
          } else if (offset < 0) {
            sweepNegativeHits++;
            if (!firstNegHit) firstNegHit = { offset, origin: offsetOrigin, points: numPoints };
          } else {
            sweepZeroHit = 1;
          }
        } else {
          if (offset > 0 && !firstPosMiss) {
            firstPosMiss = { offset, origin: offsetOrigin };
          } else if (offset < 0 && !firstNegMiss) {
            firstNegMiss = { offset, origin: offsetOrigin };
          }
        }
      }

      if (log) {
        if (firstPosHit) {
          // console.log(`   ✅ [${label}] First +hit: offset=${firstPosHit.offset.toFixed(3)}mm, origin=[${firstPosHit.origin[0].toFixed(2)}, ${firstPosHit.origin[1].toFixed(2)}, ${firstPosHit.origin[2].toFixed(2)}], points=${firstPosHit.points}`);
        }
        if (firstNegHit) {
          // console.log(`   ✅ [${label}] First -hit: offset=${firstNegHit.offset.toFixed(3)}mm, origin=[${firstNegHit.origin[0].toFixed(2)}, ${firstNegHit.origin[1].toFixed(2)}, ${firstNegHit.origin[2].toFixed(2)}], points=${firstNegHit.points}`);
        }
        if (firstPosMiss) {
          // console.log(`   ❌ [${label}] First +miss: offset=${firstPosMiss.offset.toFixed(3)}mm, origin=[${firstPosMiss.origin[0].toFixed(2)}, ${firstPosMiss.origin[1].toFixed(2)}, ${firstPosMiss.origin[2].toFixed(2)}]`);
        }
        if (firstNegMiss) {
          // console.log(`   ❌ [${label}] First -miss: offset=${firstNegMiss.offset.toFixed(3)}mm, origin=[${firstNegMiss.origin[0].toFixed(2)}, ${firstNegMiss.origin[1].toFixed(2)}], ${firstNegMiss.origin[2].toFixed(2)}]`);
        }
      }

      return {
        sweepTotalPoints,
        sweepPositiveHits,
        sweepNegativeHits,
        sweepZeroHit,
        sweepPorts,
      };
    };

    // Get model bounds for debugging (frame-aware)
    if (log && modelBoundsInFrame) {
      // console.log(`   📦 Model bounds (${frameLabel}): X[${modelBoundsInFrame[0]?.toFixed(2)}, ${modelBoundsInFrame[1]?.toFixed(2)}], Y[${modelBoundsInFrame[2]?.toFixed(2)}, ${modelBoundsInFrame[3]?.toFixed(2)}], Z[${modelBoundsInFrame[4]?.toFixed(2)}, ${modelBoundsInFrame[5]?.toFixed(2)}]`);
      // console.log(`   🧭 Plane origin (world): [${worldOrigin.map(v => v.toFixed(2)).join(', ')}], normal=[${worldNormal.map(v => v.toFixed(2)).join(', ')}]`);
      // console.log(`   🧭 Plane origin (${frameLabel}): [${origin.map(v => v.toFixed(2)).join(', ')}], normal=[${normal.map(v => v.toFixed(2)).join(', ')}]`);
    }

    // Optional guard: warn if base plane is completely outside bounds (+/- halfThickness)
    if (modelBoundsInFrame) {
      const margin = halfThickness + 1e-3;
      const outside =
        origin[0] < modelBoundsInFrame[0] - margin ||
        origin[0] > modelBoundsInFrame[1] + margin ||
        origin[1] < modelBoundsInFrame[2] - margin ||
        origin[1] > modelBoundsInFrame[3] + margin ||
        origin[2] < modelBoundsInFrame[4] - margin ||
        origin[2] > modelBoundsInFrame[5] + margin;
      if (outside && log) {
        // console.warn(`   ⚠️ Base plane appears outside model bounds in ${frameLabel} frame (margin=${margin.toFixed(2)}mm)`);
      }
    }

    // Run forward (+normal) sweep
    const forwardStats = runSweep(
      forwardOffsets,
      modelCutterData.slabPlanes,
      modelCutterData.slabCutters,
      normal,
      '+normal sweep'
    );

    // Run reverse (-normal) sweep (offsets only in +direction to avoid duplicating base plane)
    const flippedNormal = [-normal[0], -normal[1], -normal[2]];
    const reverseStats = runSweep(
      reverseOffsets,
      modelCutterData.slabPlanesReverse,
      modelCutterData.slabCuttersReverse,
      flippedNormal,
      '-normal sweep'
    );

    // Now add all valid ports from both sweeps to append filter
    for (const port of forwardStats.sweepPorts) {
      append.addInputConnection(port);
    }
    for (const port of reverseStats.sweepPorts) {
      append.addInputConnection(port);
    }

    // Aggregate stats (map reverse hits onto world +/− relative to original normal)
    const worldPositiveHits = forwardStats.sweepPositiveHits + reverseStats.sweepNegativeHits;
    const worldNegativeHits = forwardStats.sweepNegativeHits + reverseStats.sweepPositiveHits;
    const worldZeroHit = forwardStats.sweepZeroHit + reverseStats.sweepZeroHit;

    const totalPoints =
      forwardStats.sweepTotalPoints + reverseStats.sweepTotalPoints;
    const totalHits =
      worldPositiveHits + worldNegativeHits + worldZeroHit;

    if (log) {
      // console.log(
      //   `   📊 Slice distribution (world frame): +side=${worldPositiveHits}, -side=${worldNegativeHits}, base=${worldZeroHit}`
      // );
      // console.log(
      //   `  ✅ Created ${totalHits}/${forwardOffsets.length + reverseOffsets.length} valid slab slices with ${totalPoints} total points`
      // );
      // console.log(
      //   `   🔗 Connected ${forwardStats.sweepPorts.length + reverseStats.sweepPorts.length} cutter outputs to append filter (two-pass)`
      // );
      // console.log(
      //   `   🔍 Array sizes: forwardCutters=${modelCutterData.slabCutters.length}, reverseCutters=${modelCutterData.slabCuttersReverse.length}`
      // );

      if (totalHits > 0 && (worldPositiveHits === 0 || worldNegativeHits === 0)) {
        // console.warn(
        //   `   ⚠️ ASYMMETRIC HITS DETECTED even after two-pass sweep: Only ${worldPositiveHits > 0 ? 'positive' : 'negative'} side produced intersections!`
        // );
      }
    }

    // **BUG FIX 2: Non-persistent / Flashing Output**
    // Instead of permanently hiding the actor when totalHits === 0,
    // fall back to thin-slice mode. This prevents the "flash and disappear" behavior
    // when scrolling through regions with temporary no-hit zones.
    if (totalHits === 0) {
      // Debug info for zero-hit slabs
      const bounds = modelCutterData.polyData?.getBounds?.();
      if (log && bounds) {
        // console.warn(
        //   `  ⚠️ No valid slab slices produced; model bounds X[${bounds[0]?.toFixed(2)}, ${bounds[1]?.toFixed(
        //     2
        //   )}], Y[${bounds[2]?.toFixed(2)}, ${bounds[3]?.toFixed(2)}], Z[${bounds[4]?.toFixed(2)}, ${bounds[5]?.toFixed(
        //     2
        //   )}]`
        // );
        // console.warn(
        //   `  ⚠️ Plane origin=[${origin.map(v => v.toFixed(2))}], normal=[${normal.map(v => v.toFixed(2))}], thickness=${thickness.toFixed(
        //     2
        //   )}mm`
        // );
        // console.warn(`  🔄 Falling back to thin-slice mode to maintain visibility`);
      }

      // Fall back to thin-slice mode instead of hiding the actor
      // This ensures the cross-section remains visible even when slab temporarily misses
      if (modelCutterData.appendFilter) {
        try {
          modelCutterData.appendFilter.delete();
        } catch (e) {
          /* ignore */
        }
        modelCutterData.appendFilter = null;
      }

      // Connect mapper to the base cutter (thin slice at plane origin)
      modelCutterData.cutter.setCutFunction(planeCutter.plane);
      modelCutterData.cutter.setInputData(modelCutterData.polyData);
      modelCutterData.cutter.modified();
      modelCutterData.cutter.update();
      
      modelCutterData.mapper.setInputConnection(modelCutterData.cutter.getOutputPort());
      modelCutterData.mapper.modified();
      
      // Keep actor visible with thin-slice fallback
      modelCutterData.actor.setVisibility(true);
      modelCutterData.actor.modified();
      
      if (log) {
        const thinOutput = modelCutterData.cutter.getOutputData();
        const thinPoints = thinOutput ? thinOutput.getPoints()?.getNumberOfPoints() || 0 : 0;
        // console.log(`  ✅ Thin-slice fallback: ${thinPoints} points at plane origin`);
      }
      
      return;
    }

    // Update append filter and route slab output through the thin-slice pipeline
    append.update();
    modelCutterData.mapper.setInputConnection(append.getOutputPort());
    modelCutterData.mapper.modified();
    modelCutterData.actor.setVisibility(true);
    modelCutterData.actor.modified();
    
    // CRITICAL: Force actor to be visible and in front
    const actorProp = modelCutterData.actor.getProperty();
    actorProp.setOpacity(0.99); // Force update
    modelCutterData.actor.setVisibility(true);
    
    // Verify the pipeline output
    if (log) {
      const finalOutput = append.getOutputData();
      if (finalOutput && finalOutput.getPoints()) {
        const finalPoints = finalOutput.getPoints().getNumberOfPoints();
        const finalCells = finalOutput.getNumberOfCells();
        // console.log(`  📦 Append filter output: ${finalPoints} points, ${finalCells} cells`);
        // console.log(`  🎬 Actor visibility: ${modelCutterData.actor.getVisibility()}, opacity: ${actorProp.getOpacity()}`);
      } else {
        // console.warn(`  ⚠️ Append filter has no output data!`);
      }
    }
    
    // Ensure actor properties are correct
    const actorProperty = modelCutterData.actor.getProperty();
    const currentOpacity = actorProperty.getOpacity();
    const currentVisibility = modelCutterData.actor.getVisibility();
    
    if (log) {
      // console.log(`   🎭 Actor state: opacity=${currentOpacity}, visibility=${currentVisibility}`);
    }
    
    // Force actor to be visible
    if (!currentVisibility) {
      modelCutterData.actor.setVisibility(true);
      if (log) {
        // console.log(`   ✅ Actor visibility forced to true`);
      }
    }
    
    modelCutterData.actor.modified?.();
    
    if (log) {
      // console.log(`   ✅ Mapper and actor updated with combined slab output`);
    }

    // Ensure actor is attached and in clipping range, then render viewport
    const viewport = this._getViewportById(planeCutter.viewportId);
    if (viewport) {
      const vtkRenderer = viewport.getRenderer?.();
      if (vtkRenderer?.hasViewProp && !vtkRenderer.hasViewProp(modelCutterData.actor)) {
        vtkRenderer.addActor(modelCutterData.actor);
      }
      vtkRenderer?.resetCameraClippingRange?.();
      viewport.render?.();

      if (log) {
        const actorBounds = modelCutterData.actor.getBounds?.();
        const cam = viewport.getCamera?.();
        const clip = vtkRenderer?.getActiveCamera?.()?.getClippingRange?.();
        // console.log(`   📐 Actor bounds: ${actorBounds ? actorBounds.map(v => v.toFixed?.(2) ?? v).join(', ') : 'n/a'}`);
        // console.log(`   🎥 Camera clip range: ${clip ? clip.map(v => v.toFixed?.(2) ?? v).join(', ') : 'n/a'}, viewPlaneNormal: ${cam?.viewPlaneNormal ? cam.viewPlaneNormal.map(v => v.toFixed?.(3) ?? v).join(', ') : 'n/a'}`);
      }
    }
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

      // console.log(`  📋 Camera focal point:`, focalPoint);
      // console.log(`  📋 View plane normal:`, viewPlaneNormal);

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

      // console.log(`  ✅ Plane cutter created for ${orientation}`);

      return planeCutterData;

    } catch (error) {
      // console.error(`❌ [PlaneCutterService] Error creating plane cutter for ${orientation}:`, error);
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
      // console.log(`  ℹ️ Model ${modelId} already in ${planeCutter.orientation} cutter`);
      return;
    }

    // console.log(`  🔪 Adding model ${modelId} to ${planeCutter.orientation} cutter`);
    // console.log(`  📏 Current slab thickness: ${planeCutter.slabThickness ?? 0}mm`);

    // Validate polyData
    if (!loadedModel.polyData) {
      // console.error(`❌ Model ${modelId} has no polyData - cannot create plane cutter`);
      // console.error(`   Model metadata:`, loadedModel.metadata);
      return;
    }

    const numPoints = loadedModel.polyData.getPoints()?.getNumberOfPoints() || 0;
    const bounds = loadedModel.polyData.getBounds();
    // console.log(`  📊 PolyData info: ${numPoints} points, bounds:`, bounds);
    
    // Get plane info for debugging
    const planeOrigin = planeCutter.plane.getOrigin();
    const planeNormal = planeCutter.plane.getNormal();
    // console.log(`  ✂️ Cutting plane: origin=[${planeOrigin[0].toFixed(2)}, ${planeOrigin[1].toFixed(2)}, ${planeOrigin[2].toFixed(2)}], normal=[${planeNormal[0].toFixed(2)}, ${planeNormal[1].toFixed(2)}, ${planeNormal[2].toFixed(2)}]`);
    
    // Check if plane intersects model bounds
    const [xMin, xMax, yMin, yMax, zMin, zMax] = bounds;
    // console.log(`  📦 Model bounds: X[${xMin.toFixed(2)}, ${xMax.toFixed(2)}], Y[${yMin.toFixed(2)}, ${yMax.toFixed(2)}], Z[${zMin.toFixed(2)}, ${zMax.toFixed(2)}]`);

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
    const actorProperty = actor.getProperty();
    actorProperty.setColor(color[0], color[1], color[2]);
    actorProperty.setLineWidth(5); // Thicker lines for better visibility
    actorProperty.setOpacity(1.0); // Full opacity
    actorProperty.setAmbient(1.0); // Full ambient lighting (no shadows)
    actorProperty.setDiffuse(0.0); // No diffuse (prevents darkening)
    // Render in foreground to avoid being hidden by the volume (vtk.js optional API)
    (actorProperty as any).setDisplayLocationToForeground?.();
    // Ensure both sides render and depth test does not cull the overlay (optional APIs)
    (actorProperty as any).setFrontfaceCulling?.(false);
    (actorProperty as any).setBackfaceCulling?.(false);
    (actorProperty as any).setDepthTest?.(false);

    // Configure rendering for visibility - CRITICAL for orthographic viewports
    // Moderate forward bias to keep contour in front of volume without extreme offsets
    mapper.setResolveCoincidentTopologyToPolygonOffset?.();
    mapper.setRelativeCoincidentTopologyLineOffsetParameters?.(-4, -4);
    mapper.setResolveCoincidentTopologyPolygonOffsetParameters?.(-1, -500);

    // Use SURFACE representation (not wireframe) for continuous contours
    // VTK will render the polylines as solid lines
    actorProperty.setRepresentationToSurface();
    actorProperty.setEdgeVisibility(false);
    actorProperty.setLighting(false); // Disable lighting for consistent bright lines
    
    // console.log(`  🎨 Actor configured: color=[${color}], surface mode, line width=5, extreme depth offset`);

    // Add actor to viewport's renderer
    const viewport = this._getViewportById(planeCutter.viewportId);
    if (!viewport) {
      // console.error(`❌ Viewport ${planeCutter.viewportId} not found`);
      return;
    }

    const vtkRenderer = viewport.getRenderer();
    if (!vtkRenderer) {
      // console.error(`❌ No VTK renderer found for viewport ${planeCutter.viewportId}`);
      return;
    }

    // console.log(`  📍 Target viewport ID: ${planeCutter.viewportId}`);
    // console.log(`  📍 Viewport lookup result:`, viewport ? `✅ Found (${viewport.type})` : '❌ Not found');

    vtkRenderer.addActor(actor);
    // console.log(`  📐 Actor added to renderer for viewport ${planeCutter.viewportId}`);

    // Store model cutter data first
    const modelCutterData: ModelCutterData = {
      cutter,
      mapper,
      actor,
      modelId,
      polyData: loadedModel.polyData,
    };

    planeCutter.modelCutters.set(modelId, modelCutterData);

    // Apply slab cutting (will handle both thin slice and thick slab cases)
    this._rebuildSlabCut(modelCutterData, planeCutter, { log: true });

    // Check cutter output for debugging
    const outputData = cutter.getOutputData();
    if (outputData) {
      const numCutPoints = outputData.getPoints()?.getNumberOfPoints() || 0;
      const slabInfo = (planeCutter.slabThickness ?? 0) > 0 ? ` (slab: ${planeCutter.slabThickness}mm)` : '';
      // console.log(`  🔍 Initial cutter output: ${numCutPoints} cut points${slabInfo}`);
      if (numCutPoints === 0) {
        // console.warn(`  ⚠️ Cutter produced 0 points - plane may not intersect model`);
        const planeOrigin = planeCutter.plane.getOrigin();
        const planeNormal = planeCutter.plane.getNormal();
        // console.warn(`  ⚠️ Plane: origin=[${planeOrigin}], normal=[${planeNormal}]`);
      }
    } else {
      // console.warn(`  ⚠️ Cutter output is null`);
    }

    // Render viewport
    viewport.render();

    // console.log(`  ✅ Model ${modelId} added to ${planeCutter.orientation} cutter with color [${color}]`);
  }

  /**
   * Remove a model from a specific plane cutter
   */
  private _removeModelCutterFromViewport(planeCutter: PlaneCutterData, modelId: string): void {
    const modelCutterData = planeCutter.modelCutters.get(modelId);

    if (!modelCutterData) {
      return;
    }

    // console.log(`  🗑️ Removing model ${modelId} from ${planeCutter.orientation} cutter`);

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
        // console.log(`  ℹ️ Viewport ${planeCutter.viewportId} no longer exists`);
      }
    } catch (error) {
      // console.warn(`  ⚠️ Error removing actor from viewport:`, error.message);
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
      if (modelCutterData.appendFilter) {
        modelCutterData.appendFilter.delete();
      }
      // Clean up reusable slab cutters and planes
      if (modelCutterData.slabCutters) {
        modelCutterData.slabCutters.forEach(c => c.delete());
      }
      if (modelCutterData.slabPlanes) {
        modelCutterData.slabPlanes.forEach(p => p.delete());
      }
      if (modelCutterData.slabCuttersReverse) {
        modelCutterData.slabCuttersReverse.forEach(c => c.delete());
      }
      if (modelCutterData.slabPlanesReverse) {
        modelCutterData.slabPlanesReverse.forEach(p => p.delete());
      }
    } catch (error) {
      // console.warn(`  ⚠️ Error deleting VTK objects:`, error.message);
    }

    // Remove from map
    planeCutter.modelCutters.delete(modelId);

    // console.log(`  ✅ Model ${modelId} removed from ${planeCutter.orientation} cutter`);
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
      // console.warn('⚠️ [PlaneCutterService] Could not determine orientation from camera:', error.message);
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

        // console.log(`🎨 [PlaneCutterService] Using metadata color [${color}] for model ${modelId}`);
        return color;
      }
    }

    // Second, check if we already have a cached color
    if (this.modelColors.has(modelId)) {
      const cachedColor = this.modelColors.get(modelId)!;
      // console.log(`🎨 [PlaneCutterService] Using cached color [${cachedColor}] for model ${modelId}`);
      return cachedColor;
    }

    // Last resort: Assign a new color from the fallback palette
    const color = FALLBACK_COLOR_PALETTE[this.colorIndex % FALLBACK_COLOR_PALETTE.length] as [number, number, number];
    this.colorIndex++;

    // Store the color for this model
    this.modelColors.set(modelId, color);

    // console.log(`🎨 [PlaneCutterService] Assigned fallback color [${color}] to model ${modelId} (no metadata color)`);

    return color;
  }

  /**
   * Debug: Get current slab thickness for all plane cutters
   */
  public debugSlabThickness(): void {
    // console.log('🔍 [PlaneCutterService] Current slab thickness state:');
    for (const planeCutter of this.planeCutters) {
      const viewport = this._getViewportById(planeCutter.viewportId);
      let viewportThickness = 'N/A';
      
      if (viewport) {
        try {
          const props = viewport.getProperties?.();
          viewportThickness = props?.slabThickness ?? 'undefined';
        } catch (e) {
          viewportThickness = 'error';
        }
      }
      
      // console.log(`  ${planeCutter.orientation} (${planeCutter.viewportId}):`, {
      //   planeCutterThickness: planeCutter.slabThickness ?? 0,
      //   viewportThickness,
      //   modelCount: planeCutter.modelCutters.size,
      // });
    }
  }

  /**
   * Cleanup - remove all plane cutters
   */
  public cleanup(): void {
    // console.log('🗑️ [PlaneCutterService] Cleaning up all plane cutters');

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
        // console.warn('⚠️ [PlaneCutterService] Error during cleanup:', error.message);
      }
    }

    this.planeCutters = [];
    this.colorIndex = 0;
    this.modelColors.clear(); // Clear model color assignments

    // console.log('✅ [PlaneCutterService] Cleanup complete');
  }

  // ──────────────────────────────────────────────────────────
  // Matrix helpers (column-major 4x4, VTK style)
  // ──────────────────────────────────────────────────────────
  private _invert4x4(m: ArrayLike<number>): number[] | null {
    // m is column-major
    const [
      m00, m01, m02, m03,
      m10, m11, m12, m13,
      m20, m21, m22, m23,
      m30, m31, m32, m33,
    ] = m as any;

    const a00 = m00 * m11 - m01 * m10;
    const a01 = m00 * m12 - m02 * m10;
    const a02 = m00 * m13 - m03 * m10;
    const a03 = m01 * m12 - m02 * m11;
    const a04 = m01 * m13 - m03 * m11;
    const a05 = m02 * m13 - m03 * m12;
    const a06 = m20 * m31 - m21 * m30;
    const a07 = m20 * m32 - m22 * m30;
    const a08 = m20 * m33 - m23 * m30;
    const a09 = m21 * m32 - m22 * m31;
    const a10 = m21 * m33 - m23 * m31;
    const a11 = m22 * m33 - m23 * m32;

    const det = a00 * a11 - a01 * a10 + a02 * a09 + a03 * a08 - a04 * a07 + a05 * a06;
    if (Math.abs(det) < 1e-12) {
      return null;
    }
    const invDet = 1.0 / det;

    return [
      ( m11 * a11 - m12 * a10 + m13 * a09) * invDet,
      (-m01 * a11 + m02 * a10 - m03 * a09) * invDet,
      ( m31 * a05 - m32 * a04 + m33 * a03) * invDet,
      (-m21 * a05 + m22 * a04 - m23 * a03) * invDet,
      (-m10 * a11 + m12 * a08 - m13 * a07) * invDet,
      ( m00 * a11 - m02 * a08 + m03 * a07) * invDet,
      (-m30 * a05 + m32 * a02 - m33 * a01) * invDet,
      ( m20 * a05 - m22 * a02 + m23 * a01) * invDet,
      ( m10 * a10 - m11 * a08 + m13 * a06) * invDet,
      (-m00 * a10 + m01 * a08 - m03 * a06) * invDet,
      ( m30 * a04 - m31 * a02 + m33 * a00) * invDet,
      (-m20 * a04 + m21 * a02 - m23 * a00) * invDet,
      (-m10 * a09 + m11 * a07 - m12 * a06) * invDet,
      ( m00 * a09 - m01 * a07 + m02 * a06) * invDet,
      (-m30 * a03 + m31 * a01 - m32 * a00) * invDet,
      ( m20 * a03 - m21 * a01 + m22 * a00) * invDet,
    ];
  }

  private _transformPoint(m: ArrayLike<number>, p: number[]): number[] {
    const x = p[0], y = p[1], z = p[2];
    return [
      m[0] * x + m[4] * y + m[8]  * z + m[12],
      m[1] * x + m[5] * y + m[9]  * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14],
    ];
  }

  private _transformVector(m: ArrayLike<number>, v: number[]): number[] {
    const x = v[0], y = v[1], z = v[2];
    return [
      m[0] * x + m[4] * y + m[8]  * z,
      m[1] * x + m[5] * y + m[9]  * z,
      m[2] * x + m[6] * y + m[10] * z,
    ];
  }

  private _normalizeVector(v: number[]): number[] {
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / len, v[1] / len, v[2] / len];
  }

  private _transformBounds(m: ArrayLike<number>, b: number[]): number[] {
    // b = [xmin, xmax, ymin, ymax, zmin, zmax]
    const corners = [
      [b[0], b[2], b[4]], [b[1], b[2], b[4]],
      [b[0], b[3], b[4]], [b[1], b[3], b[4]],
      [b[0], b[2], b[5]], [b[1], b[2], b[5]],
      [b[0], b[3], b[5]], [b[1], b[3], b[5]],
    ];
    const tx = [];
    const ty = [];
    const tz = [];
    corners.forEach(c => {
      const t = this._transformPoint(m, c);
      tx.push(t[0]); ty.push(t[1]); tz.push(t[2]);
    });
    return [
      Math.min(...tx), Math.max(...tx),
      Math.min(...ty), Math.max(...ty),
      Math.min(...tz), Math.max(...tz),
    ];
  }

  private _identity4x4(): Float32Array {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  }

  private _isNonIdentity4x4(m: ArrayLike<number>, eps = 1e-6): boolean {
    const id = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
    for (let i = 0; i < 16; i++) {
      if (Math.abs(m[i] - id[i]) > eps) {
        return true;
      }
    }
    return false;
  }
}

export default PlaneCutterService;
