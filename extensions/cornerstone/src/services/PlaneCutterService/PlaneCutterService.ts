import { PubSubService, Types as OHIFTypes } from '@ohif/core';
import { getRenderingEngines } from '@cornerstonejs/core';
import vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane';
import vtkCutter from '@kitware/vtk.js/Filters/Core/Cutter';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkAppendPolyData from '@kitware/vtk.js/Filters/General/AppendPolyData';
import { crosshairsHandler } from '../../utils/crosshairsHandler';
// Note: Plane cutters now use camera.focalPoint directly instead of crosshairs center
// This ensures proper synchronization when scrolling MPR slices

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

type PlaneCutterMode = 'thin' | 'slab';

/**
 * Template pattern for cutter behaviors. Strategy is selected at runtime
 * based on the requested slab thickness and delegates the per-model update.
 */
interface PlaneCutterTemplate {
  mode: PlaneCutterMode;
  shouldUse: (thickness: number) => boolean;
  updateModelCut: (
    modelCutterData: ModelCutterData,
    planeCutter: PlaneCutterData,
    thickness: number
  ) => void;
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
  mode: PlaneCutterMode;
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
  private viewportDescriptors: { viewportId: string; orientation: 'axial' | 'coronal' | 'sagittal' }[];
  private isEnabled: boolean;
  private colorIndex: number;
  private modelColors: Map<string, [number, number, number]>; // Map modelId -> color
  private cutterTemplates: PlaneCutterTemplate[];

  constructor({ servicesManager }) {
    super(EVENTS);
    this.servicesManager = servicesManager;
    this.planeCutters = [];
    this.viewportDescriptors = [];
    this.isEnabled = true; // Enable plane cutters by default for 2D cross-sections
    this.colorIndex = 0;
    this.modelColors = new Map();
    this.cutterTemplates = [
      {
        mode: 'thin',
        shouldUse: thickness => thickness <= 0,
        updateModelCut: () => {
          /* thin mode does not rebuild on camera changes */
        },
      },
      {
        mode: 'slab',
        shouldUse: thickness => thickness > 0,
        updateModelCut: (modelCutterData, planeCutter, thickness) => {
          if (thickness > 0) {
            this._rebuildSlabCut(modelCutterData, planeCutter, { log: true });
          }
        },
      },
    ];

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

    // Add model to plane cutters (will lazily create cutters as needed)
    void this.addModelToCutters(modelId);
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
  private async _handleViewportPropertiesChanged(event: { viewportId: string; properties: any; volumeId?: string }): Promise<void> {
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

    const viewport = this._getViewportById(viewportId);
    if (!viewport) {
      return;
    }

    const orientation = this._resolveViewportOrientation(viewport);
    if (!orientation) {
      return;
    }

    const newThickness = properties.slabThickness;
    const targetMode: PlaneCutterMode = newThickness > 0 ? 'slab' : 'thin';
    const { modelStateService } = this.servicesManager.services;
    const models = modelStateService?.getAllModels?.() || [];

    if (!models.length) {
      return; // Do not create cutters until a model exists
    }

    const planeCutter = await this._getOrCreatePlaneCutterForViewport(viewport, orientation, targetMode);

    if (!planeCutter) {
      return;
    }

    planeCutter.slabThickness = targetMode === 'slab' ? newThickness : 0;

    // Ensure all models are present on the active cutter
    for (const model of models) {
      const modelId = model?.metadata?.id;
      if (!modelId) {
        continue;
      }

      if (!planeCutter.modelCutters.has(modelId)) {
        this._addModelToPlaneCutter(planeCutter, model);
      }
      this._setModelVisibility(planeCutter, modelId, true);
    }

    // Hide the inactive mode to prevent double rendering
    const otherMode = this._getOppositeMode(targetMode);
    const otherCutter = await this._getOrCreatePlaneCutterForViewport(viewport, orientation, otherMode);
    if (otherCutter) {
      if (targetMode === 'thin') {
        otherCutter.slabThickness = 0;
      }
      for (const modelId of otherCutter.modelCutters.keys()) {
        this._setModelVisibility(otherCutter, modelId, false);
      }
    }

    // Rebuild slab cuts only when in slab mode with a positive thickness
    if (targetMode === 'slab' && planeCutter.slabThickness && planeCutter.slabThickness > 0) {
      for (const [modelId, modelCutterData] of planeCutter.modelCutters.entries()) {
        // console.log(`   🔄 Rebuilding model ${modelId} with thickness ${newThickness}mm`);
        this._rebuildSlabCut(modelCutterData, planeCutter, { log: true });
      }
    }

    // Trigger re-render
    if (viewport) {
      const vtkRenderer = viewport.getRenderer?.();
      if (vtkRenderer?.resetCameraClippingRange) {
        vtkRenderer.resetCameraClippingRange();
      }
      viewport.render?.();
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

      // Clear any existing plane cutters before caching new viewport descriptors
      if (this.planeCutters.length > 0) {
        // console.log('🔄 [PlaneCutterService] Clearing existing plane cutters before re-initialization');
        // Disable and cleanup old plane cutters (but don't reset isEnabled flag)
        const wasEnabled = this.isEnabled;
        this.cleanup();
        this.isEnabled = wasEnabled; // Restore the enabled state after cleanup
      } else {
        // Even if no cutters exist yet, reset descriptors to avoid stale entries
        this.viewportDescriptors = [];
      }

      // Cache viewport descriptors; actual cutters are created lazily once a model arrives
      this.viewportDescriptors = orthographicViewports.map(({ viewport, orientation }) => ({
        viewportId: viewport.id,
        orientation,
      }));

      // console.log('═══════════════════════════════════════════════════════');
      // console.log(`✅ [PlaneCutterService] Cached ${this.viewportDescriptors.length} orthographic viewports for cutter creation`);
      // console.log('═══════════════════════════════════════════════════════');

      return this.viewportDescriptors.length > 0;

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
  private async _setupSynchronizedUpdates(targetCutters: PlaneCutterData[] = this.planeCutters): Promise<void> {
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
        const thickness = this._readViewportThickness(planeCutter.viewportId);
        this._updateSinglePlaneCutter(planeCutter, crosshairCenter, thickness);

        const viewport = this._getViewportById(planeCutter.viewportId);
        if (viewport) {
          viewport.render();
        }
      } catch (error) {
        // console.warn(`⚠️ [PlaneCutterService] Error updating ${planeCutter.orientation}:`, error.message);
      }
    };

    // Subscribe to CAMERA_MODIFIED events from ALL viewports
    const { Enums } = await import('@cornerstonejs/core');

    for (const planeCutter of targetCutters) {
      const viewport = this._getViewportById(planeCutter.viewportId);
      if (viewport && viewport.element && Enums?.Events?.CAMERA_MODIFIED) {
        if (planeCutter.updateCallback) {
          continue; // Already subscribed
        }
        // Combined update function that ONLY touches this viewport's VTK objects
        const combinedUpdate = () => {
          updatePlaneCutter(planeCutter);
        };

        viewport.element.addEventListener(Enums.Events.CAMERA_MODIFIED, combinedUpdate);
        planeCutter.updateCallback = combinedUpdate;
        planeCutter.eventListenerElement = viewport.element;
        // console.log(`  📡 ${planeCutter.orientation} viewport subscribed to synchronized updates + slab thickness monitoring`);
      }
    }

    // Initial per-viewport update (isolated)
    // console.log('🔄 [PlaneCutterService] Performing initial per-viewport updates');
    for (const planeCutter of targetCutters) {
      updatePlaneCutter(planeCutter);
    }

    // console.log('✅ [PlaneCutterService] Synchronized updates configured');
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
    crosshairCenter: [number, number, number] | null = null,
    currentThickness?: number
  ): void {
    try {
      const effectiveThickness =
        typeof currentThickness === 'number'
          ? currentThickness
          : planeCutter.slabThickness ?? 0;
      planeCutter.slabThickness = effectiveThickness;

      // Route work to the correct cutter based on the current thickness.
      const requiredMode: PlaneCutterMode = effectiveThickness > 0 ? 'slab' : 'thin';
      if (planeCutter.mode !== requiredMode) {
        return;
      }

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

      let planeOrigin: [number, number, number] | undefined;

      // Use provided crosshair center; if absent, fetch from handler; fallback to legacy imageData only if unavailable
      if (crosshairCenter) {
        planeOrigin = crosshairCenter;
      } else {
        const handlerCenter = crosshairsHandler.getCrosshairCenter?.();
        if (handlerCenter && Array.isArray(handlerCenter) && handlerCenter.length === 3) {
          planeOrigin = [handlerCenter[0], handlerCenter[1], handlerCenter[2]];
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

      // Fallback: use camera focalPoint directly as the plane origin
      if (!planeOrigin) {
        planeOrigin = [focalPoint[0], focalPoint[1], focalPoint[2]];
      }

      // Update plane origin and normal
      planeCutter.plane.setOrigin(planeOrigin[0], planeOrigin[1], planeOrigin[2]);
      planeCutter.plane.setNormal(planeNormal[0], planeNormal[1], planeNormal[2]);

      // Update all model cutters in this plane with slab thickness support
      const template = this._selectTemplateForThickness(effectiveThickness);
      for (const modelCutterData of planeCutter.modelCutters.values()) {
        template.updateModelCut(modelCutterData, planeCutter, effectiveThickness);
      }
    } catch (error) {
      // console.warn(`⚠️ [${planeCutter.orientation}] Error updating plane:`, error.message);
    }
  }

  /**
   * Enable plane cutters (make visible)
   */
  public async enable(): Promise<void> {
    // console.log('🟢 [PlaneCutterService] Enabling plane cutters');

    this.isEnabled = true;

    // Ensure viewport descriptors are ready; actual cutters are created lazily
    await this._ensureViewportDescriptors();

    // Add all existing models to cutters
    const { modelStateService } = this.servicesManager.services;
    const models = modelStateService?.getAllModels() || [];

    // console.log(`   Found ${models.length} existing models to add to plane cutters (lazy per viewport)`);

    await Promise.all(models.map(model => this.addModelToCutters(model.metadata.id)));

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
   * Get all plane cutters (for debugging)
   */
  public getPlaneCutters(): PlaneCutterData[] {
    return this.planeCutters;
  }

  /**
   * Add a model to all plane cutters
   */
  public async addModelToCutters(modelId: string): Promise<void> {
    const { modelStateService } = this.servicesManager.services;
    const loadedModel = modelStateService?.getModel(modelId);

    if (!loadedModel) {
      // console.warn(`⚠️ [PlaneCutterService] Model ${modelId} not found`);
      return;
    }

    const descriptorsReady = await this._ensureViewportDescriptors();

    if (!descriptorsReady) {
      // console.log(`ℹ️ [PlaneCutterService] Viewports not ready yet, skipping model ${modelId}`);
      return;
    }

    // console.log(`🔪 [PlaneCutterService] Adding model ${modelId} to available plane cutters (lazy creation per viewport)`);

    for (const descriptor of this.viewportDescriptors) {
      const viewport = this._getViewportById(descriptor.viewportId);
      if (!viewport) {
        continue;
      }

      const orientation = descriptor.orientation ?? this._resolveViewportOrientation(viewport);
      if (!orientation) {
        continue;
      }

      const props = viewport.getProperties?.();
      const thickness = props?.slabThickness ?? 0;
      const targetMode: PlaneCutterMode = thickness > 0 ? 'slab' : 'thin';

      const planeCutter = await this._getOrCreatePlaneCutterForViewport(viewport, orientation, targetMode);
      if (!planeCutter) {
        continue;
      }

      planeCutter.slabThickness = targetMode === 'slab' ? thickness : 0;
      this._addModelToPlaneCutter(planeCutter, loadedModel);

      // Hide the non-active mode to prevent double rendering
      const otherMode = this._getOppositeMode(targetMode);
      const otherCutter = await this._getOrCreatePlaneCutterForViewport(viewport, orientation, otherMode);
      if (otherCutter) {
        this._setModelVisibility(otherCutter, modelId, false);
      }
      this._setModelVisibility(planeCutter, modelId, true);
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
        if (planeCutter.mode === 'slab' && (planeCutter.slabThickness ?? 0) > 0) {
          this._rebuildSlabCut(modelCutterData, planeCutter);
        }

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
    const { modelProjectionService } = this.servicesManager.services;
    const { log = false } = options;

    // Hide legacy actor output; projection is overlay-only now.
    try {
      modelCutterData?.actor?.setVisibility?.(false);
    } catch (e) {
      /* ignore */
    }

    if (modelProjectionService?.updateProjectionsForViewport) {
      modelProjectionService.updateProjectionsForViewport(planeCutter.viewportId);
      if (log) {
        // console.log(`[PlaneCutterService] Routed slab rebuild to ModelProjectionService for ${planeCutter.viewportId}`);
      }
    } else if (log) {
      // console.warn('[PlaneCutterService] ModelProjectionService not available; skipping projection update');
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
        mode: 'thin', // Default; will be overridden by caller when necessary
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
   * Ensure viewport descriptors are available; if not, try to initialize.
   */
  private async _ensureViewportDescriptors(): Promise<boolean> {
    if (this.viewportDescriptors.length > 0) {
      return true;
    }

    return await this.initialize();
  }

  private _getViewportDescriptor(viewportId: string) {
    return this.viewportDescriptors.find(vp => vp.viewportId === viewportId);
  }

  private _resolveViewportOrientation(viewport: any): 'axial' | 'coronal' | 'sagittal' | null {
    const cached = this._getViewportDescriptor(viewport.id);
    if (cached?.orientation) {
      return cached.orientation;
    }

    return this._getViewportOrientation(viewport);
  }

  private _getPlaneCutterForViewport(viewportId: string, mode: PlaneCutterMode): PlaneCutterData | undefined {
    return this.planeCutters.find(pc => pc.viewportId === viewportId && pc.mode === mode);
  }

  private _getOppositeMode(mode: PlaneCutterMode): PlaneCutterMode {
    return mode === 'thin' ? 'slab' : 'thin';
  }

  /**
   * Choose the cutter template based on the current thickness.
   */
  private _selectTemplateForThickness(thickness: number): PlaneCutterTemplate {
    return (
      this.cutterTemplates.find(template => template.shouldUse(thickness)) ||
      this.cutterTemplates[0]
    );
  }

  /**
   * Read the latest slab thickness from the viewport (defaults to 0).
   */
  private _readViewportThickness(viewportId: string): number {
    const viewport = this._getViewportById(viewportId);
    if (!viewport) {
      return 0;
    }
    try {
      const props = viewport.getProperties?.();
      return props?.slabThickness ?? 0;
    } catch (e) {
      return 0;
    }
  }

  private _setModelVisibility(planeCutter: PlaneCutterData, modelId: string, visible: boolean): void {
    const modelCutterData = planeCutter.modelCutters.get(modelId);
    if (!modelCutterData || !modelCutterData.actor?.setVisibility) {
      return;
    }

    try {
      modelCutterData.actor.setVisibility(visible);
    } catch (e) {
      // Ignore visibility errors
    }
  }

  /**
   * Lazily create or return a plane cutter for the requested viewport/mode.
   */
  private async _getOrCreatePlaneCutterForViewport(
    viewport: any,
    orientation: 'axial' | 'coronal' | 'sagittal',
    mode: PlaneCutterMode
  ): Promise<PlaneCutterData | null> {
    const existing = this._getPlaneCutterForViewport(viewport.id, mode);
    if (existing) {
      return existing;
    }

    const planeCutter = await this._createPlaneCutterForViewport(viewport, orientation);
    if (!planeCutter) {
      return null;
    }

    planeCutter.mode = mode;
    const props = viewport.getProperties?.();
    planeCutter.slabThickness = mode === 'slab'
      ? props?.slabThickness ?? 0
      : 0;

    this.planeCutters.push(planeCutter);

    await this._setupSynchronizedUpdates([planeCutter]);

    return planeCutter;
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

    // Apply slab cutting only when the slab cutter is active
    if (planeCutter.mode === 'slab' && (planeCutter.slabThickness ?? 0) > 0) {
      this._rebuildSlabCut(modelCutterData, planeCutter, { log: true });
    }

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
    this.viewportDescriptors = [];

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
