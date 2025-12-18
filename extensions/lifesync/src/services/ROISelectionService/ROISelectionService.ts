/**
 * ROISelectionService
 *
 * Manages Region of Interest selection using rectangle annotations drawn by user.
 * User draws rectangles on coronal and sagittal views, then zooms to the ROI.
 *
 * Workflow:
 * 1. User activates ROI mode - RectangleROI tool is enabled
 * 2. User draws rectangles on coronal and sagittal views
 * 3. User clicks "Zoom to ROI" - camera zooms to focus on the intersection
 * 4. User can reset to restore original view
 */

import { PubSubService } from '@ohif/core';
import { getRenderingEngines, Types as csTypes } from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import {
  Rectangle2DBounds,
  RectangleAnnotationInfo,
  ROI3DBounds,
  ROISelection,
  VolumeInfo,
  ROI_SELECTION_EVENTS,
  SelectionMode,
} from './types';

const { annotation: annotationModule, RectangleROITool } = cornerstoneTools;

class ROISelectionService extends PubSubService {
  public static REGISTRATION = {
    name: 'roiSelectionService',
    altName: 'ROISelectionService',
    create: ({ servicesManager, extensionManager }) => {
      return new ROISelectionService(servicesManager, extensionManager);
    },
  };

  private servicesManager: any;
  private extensionManager: any;
  private mode: SelectionMode = 'idle';
  private selection: ROISelection;
  private volumeInfo: VolumeInfo | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  private originalCameraStates: Map<string, any> = new Map();

  constructor(servicesManager: any, extensionManager: any) {
    super(ROI_SELECTION_EVENTS);
    this.servicesManager = servicesManager;
    this.extensionManager = extensionManager;
    this.selection = this._createEmptySelection();
  }

  private _createEmptySelection(): ROISelection {
    return {
      coronalRect: undefined,
      sagittalRect: undefined,
      worldBounds: undefined,
      isComplete: false,
      isApplied: false,
    };
  }

  /**
   * Start ROI selection mode
   * - Enables RectangleROI tool
   * - User draws rectangles on viewports
   */
  public startSelection(): void {
    try {
      console.log('🎯 [ROISelectionService] Starting ROI selection - draw rectangles on views');

    this.mode = 'selecting';
    this.selection = this._createEmptySelection();
    this.volumeInfo = this._getVolumeInfo();

    if (!this.volumeInfo) {
      console.warn('🎯 [ROISelectionService] No volume found');
    this._broadcastEvent(ROI_SELECTION_EVENTS.SELECTION_STARTED, {
          volumeInfo: null,
          error: 'No volume found',
        });
        return;
      }

      // Enable RectangleROI tool
      this._enableRectangleTool();

      // Subscribe to annotation events
      this._subscribeToEvents();

      // Save original camera states
      this._saveOriginalCameraStates();

      this._broadcastEvent(ROI_SELECTION_EVENTS.SELECTION_STARTED, {
        volumeInfo: this.volumeInfo,
      selection: this.selection,
    });
    } catch (error) {
      console.error('🎯 [ROISelectionService] Error starting selection:', error);
      this.mode = 'idle';
      this._broadcastEvent(ROI_SELECTION_EVENTS.SELECTION_STARTED, {
        volumeInfo: null,
        error: error.message || 'Failed to start selection',
      });
    }
  }

  /**
   * Get volume info from the first available viewport
   */
  private _getVolumeInfo(): VolumeInfo | null {
    try {
      const renderingEngines = getRenderingEngines();
      if (!renderingEngines || renderingEngines.length === 0) {
      return null;
    }

      const renderingEngine = renderingEngines[0];
      const viewports = renderingEngine.getViewports();

        for (const viewport of viewports) {
          if (viewport.type === 'orthographic') {
          const orthoViewport = viewport as csTypes.IVolumeViewport;
          const actors = orthoViewport.getActors();

          if (actors && actors.length > 0) {
            const volumeActor = actors[0];
            const volumeId = volumeActor.uid;

            // Get volume bounds from actor
            const bounds = volumeActor.actor?.getMapper()?.getInputData()?.getBounds?.();
            if (bounds) {
              const [xMin, xMax, yMin, yMax, zMin, zMax] = bounds;

              // Get spacing from image data
              const imageData = volumeActor.actor?.getMapper()?.getInputData();
              const spacing = imageData?.getSpacing?.() || [1, 1, 1];
              const origin = imageData?.getOrigin?.() || [0, 0, 0];
              const dimensions = imageData?.getDimensions?.() || [1, 1, 1];
              const direction = imageData?.getDirection?.() || [1, 0, 0, 0, 1, 0, 0, 0, 1];

                return {
                  volumeId,
                  dimensions: dimensions as [number, number, number],
                  spacing: spacing as [number, number, number],
                  origin: origin as [number, number, number],
                direction: direction as number[],
                bounds: { xMin, xMax, yMin, yMax, zMin, zMax },
              };
            }
          }
        }
      }
    } catch (error) {
      console.error('🎯 [ROISelectionService] Error getting volume info:', error);
    }
    return null;
  }

  /**
   * Enable RectangleROI tool for selection
   */
  private _enableRectangleTool(): void {
    try {
      // Try multiple tool group IDs
      const toolGroupIds = ['mpr', 'default'];
      let foundToolGroup = false;

      for (const toolGroupId of toolGroupIds) {
        const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
        if (toolGroup) {
          console.log('🎯 [ROISelectionService] Found tool group:', toolGroupId);

          // Ensure tool is added
          if (!toolGroup.hasTool(RectangleROITool.toolName)) {
            toolGroup.addTool(RectangleROITool.toolName);
          }

          // Set as active tool
          toolGroup.setToolActive(RectangleROITool.toolName, {
        bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Primary }],
      });

          foundToolGroup = true;
          console.log('🎯 [ROISelectionService] RectangleROI tool enabled on', toolGroupId);
        }
      }

      if (!foundToolGroup) {
        console.warn('🎯 [ROISelectionService] No tool group found');
      }
    } catch (error) {
      console.error('🎯 [ROISelectionService] Error enabling rectangle tool:', error);
    }
  }

  /**
   * Subscribe to annotation modification events
   */
  private _subscribeToEvents(): void {
    const { eventTarget } = cornerstoneTools;

    // Listen for new annotations
    const handleAnnotationCompleted = (evt: any) => {
      const { annotation } = evt.detail;
      if (annotation?.metadata?.toolName === RectangleROITool.toolName) {
        console.log('🎯 [ROISelectionService] New rectangle annotation:', annotation.annotationUID);
        this._processNewAnnotation(annotation);
      }
    };

    // Listen for annotation modifications
    const handleAnnotationModified = (evt: any) => {
      const { annotation } = evt.detail;
      if (annotation?.metadata?.toolName === RectangleROITool.toolName) {
        this._updateRectangleFromAnnotation(annotation);
      }
    };

    eventTarget.addEventListener(
      cornerstoneTools.Enums.Events.ANNOTATION_COMPLETED,
      handleAnnotationCompleted
    );

    eventTarget.addEventListener(
      cornerstoneTools.Enums.Events.ANNOTATION_MODIFIED,
      handleAnnotationModified
    );

    this.eventUnsubscribers.push(() => {
      eventTarget.removeEventListener(
        cornerstoneTools.Enums.Events.ANNOTATION_COMPLETED,
        handleAnnotationCompleted
      );
      eventTarget.removeEventListener(
        cornerstoneTools.Enums.Events.ANNOTATION_MODIFIED,
        handleAnnotationModified
      );
    });
  }

  /**
   * Process a new annotation and determine its viewport orientation
   */
  private _processNewAnnotation(annotation: any): void {
    const viewPlaneNormal = annotation.metadata?.viewPlaneNormal;
    if (!viewPlaneNormal) return;

    // Determine orientation based on view plane normal
    let orientation: 'coronal' | 'sagittal' | 'axial' | null = null;

    if (Math.abs(viewPlaneNormal[1]) > 0.9) {
      orientation = 'coronal'; // Looking in Y direction
    } else if (Math.abs(viewPlaneNormal[0]) > 0.9) {
      orientation = 'sagittal'; // Looking in X direction
    } else if (Math.abs(viewPlaneNormal[2]) > 0.9) {
      orientation = 'axial'; // Looking in Z direction
    }

    if (!orientation) {
      console.log('🎯 [ROISelectionService] Could not determine orientation');
      return;
    }

    // Extract bounds from annotation
    const bounds = this._extractBoundsFromAnnotation(annotation, orientation);
    if (!bounds) return;

    const rectInfo: RectangleAnnotationInfo = {
      annotationUID: annotation.annotationUID,
      viewportType: orientation === 'axial' ? 'coronal' : orientation, // Map axial to coronal for now
      bounds,
    };

    // Store based on orientation
    if (orientation === 'coronal') {
      this.selection.coronalRect = rectInfo;
      console.log('🎯 [ROISelectionService] Coronal rectangle set');
    } else if (orientation === 'sagittal') {
      this.selection.sagittalRect = rectInfo;
      console.log('🎯 [ROISelectionService] Sagittal rectangle set');
    }

    // Calculate 3D bounds if both rectangles are set
    this._calculate3DBounds();

    this._broadcastEvent(ROI_SELECTION_EVENTS.RECTANGLE_UPDATED, {
      orientation,
      bounds,
      worldBounds: this.selection.worldBounds,
      coronalRect: this.selection.coronalRect,
      sagittalRect: this.selection.sagittalRect,
    });
  }

  /**
   * Extract bounds from annotation handles
   */
  private _extractBoundsFromAnnotation(
    annotation: any,
    orientation: 'coronal' | 'sagittal' | 'axial'
  ): Rectangle2DBounds | null {
    const points = annotation.data?.handles?.points;
    if (!points || points.length < 2) return null;

    if (orientation === 'coronal') {
      // Coronal: X horizontal, Z vertical
      const xValues = points.map((p: number[]) => p[0]);
      const zValues = points.map((p: number[]) => p[2]);
      return {
        min1: Math.min(...xValues),
        max1: Math.max(...xValues),
        min2: Math.min(...zValues),
        max2: Math.max(...zValues),
      };
    } else if (orientation === 'sagittal') {
      // Sagittal: Y horizontal, Z vertical
      const yValues = points.map((p: number[]) => p[1]);
      const zValues = points.map((p: number[]) => p[2]);
      return {
        min1: Math.min(...yValues),
        max1: Math.max(...yValues),
        min2: Math.min(...zValues),
        max2: Math.max(...zValues),
      };
    } else if (orientation === 'axial') {
      // Axial: X horizontal, Y vertical
      const xValues = points.map((p: number[]) => p[0]);
      const yValues = points.map((p: number[]) => p[1]);
      return {
        min1: Math.min(...xValues),
        max1: Math.max(...xValues),
        min2: Math.min(...yValues),
        max2: Math.max(...yValues),
      };
    }

    return null;
  }

  /**
   * Update rectangle bounds from annotation handles
   */
  private _updateRectangleFromAnnotation(annotation: any): void {
    const annotationUID = annotation.annotationUID;

    // Find which rectangle this is
    let rectInfo: RectangleAnnotationInfo | undefined;
    let orientation: 'coronal' | 'sagittal' | undefined;

    if (this.selection.coronalRect?.annotationUID === annotationUID) {
      rectInfo = this.selection.coronalRect;
      orientation = 'coronal';
    } else if (this.selection.sagittalRect?.annotationUID === annotationUID) {
      rectInfo = this.selection.sagittalRect;
      orientation = 'sagittal';
    }

    if (!rectInfo || !orientation) return;

    // Update bounds
    const newBounds = this._extractBoundsFromAnnotation(annotation, orientation);
    if (newBounds) {
      rectInfo.bounds = newBounds;
    }

    // Recalculate 3D bounds
    this._calculate3DBounds();

    this._broadcastEvent(ROI_SELECTION_EVENTS.RECTANGLE_UPDATED, {
      orientation,
      bounds: rectInfo.bounds,
      worldBounds: this.selection.worldBounds,
    });
  }

  /**
   * Calculate 3D ROI bounds from rectangle intersections
   */
  private _calculate3DBounds(): void {
    const { coronalRect, sagittalRect } = this.selection;

    if (!coronalRect || !sagittalRect) {
      this.selection.isComplete = false;
      return;
    }

    // Coronal: X (min1,max1), Z (min2,max2)
    // Sagittal: Y (min1,max1), Z (min2,max2)

    const xMin = coronalRect.bounds.min1;
    const xMax = coronalRect.bounds.max1;
    const yMin = sagittalRect.bounds.min1;
    const yMax = sagittalRect.bounds.max1;

    // Z comes from both - use intersection
    const zMin = Math.max(coronalRect.bounds.min2, sagittalRect.bounds.min2);
    const zMax = Math.min(coronalRect.bounds.max2, sagittalRect.bounds.max2);

    this.selection.worldBounds = { xMin, xMax, yMin, yMax, zMin, zMax };
    this.selection.isComplete = true;

    console.log('🎯 [ROISelectionService] 3D Bounds calculated:', this.selection.worldBounds);

    this._broadcastEvent(ROI_SELECTION_EVENTS.BOUNDS_UPDATED, {
      worldBounds: this.selection.worldBounds,
    });
  }

  /**
   * Save original camera states for reset
   */
  private _saveOriginalCameraStates(): void {
    const renderingEngines = getRenderingEngines();
    if (!renderingEngines || renderingEngines.length === 0) return;

    const renderingEngine = renderingEngines[0];
    const viewports = renderingEngine.getViewports();

    for (const viewport of viewports) {
      if (viewport.type === 'orthographic') {
        const orthoViewport = viewport as csTypes.IVolumeViewport;
        const camera = orthoViewport.getCamera();
        this.originalCameraStates.set(viewport.id, { ...camera });
      }
    }
  }

  /**
   * Confirm selection and zoom camera to ROI
   */
  public confirmSelection(): void {
    if (this.mode !== 'selecting') {
      console.warn('🎯 [ROISelectionService] Not in selection mode');
      return;
    }

    // Check if we have both rectangles
    if (!this.selection.coronalRect || !this.selection.sagittalRect) {
      console.warn('🎯 [ROISelectionService] Need rectangles on both Coronal and Sagittal views');
      return;
    }

    // Recalculate bounds
    this._calculate3DBounds();

    if (!this.selection.isComplete || !this.selection.worldBounds) {
      console.warn('🎯 [ROISelectionService] Selection not complete');
      return;
    }

    console.log('🎯 [ROISelectionService] Confirming selection, zooming to ROI');

    this.mode = 'confirmed';

    // Zoom cameras to ROI
    this._zoomToROI();

    // Clean up
    this._unsubscribeFromEvents();

    this.selection.isApplied = true;

    this._broadcastEvent(ROI_SELECTION_EVENTS.SELECTION_CONFIRMED, {
      worldBounds: this.selection.worldBounds,
    });

      this._broadcastEvent(ROI_SELECTION_EVENTS.ROI_APPLIED, {
      worldBounds: this.selection.worldBounds,
    });
  }

  /**
   * Zoom all viewports to focus on ROI
   */
  private _zoomToROI(): void {
    const { worldBounds } = this.selection;
    if (!worldBounds) return;

    const renderingEngines = getRenderingEngines();
    if (!renderingEngines || renderingEngines.length === 0) return;

    const renderingEngine = renderingEngines[0];
    const viewports = renderingEngine.getViewports();

    // Calculate ROI center
    const roiCenterX = (worldBounds.xMin + worldBounds.xMax) / 2;
    const roiCenterY = (worldBounds.yMin + worldBounds.yMax) / 2;
    const roiCenterZ = (worldBounds.zMin + worldBounds.zMax) / 2;

    // Calculate ROI extents
    const xExtent = worldBounds.xMax - worldBounds.xMin;
    const yExtent = worldBounds.yMax - worldBounds.yMin;
    const zExtent = worldBounds.zMax - worldBounds.zMin;

    console.log('🎯 [ROISelectionService] Zooming to ROI:', {
      center: [roiCenterX, roiCenterY, roiCenterZ],
      extents: [xExtent, yExtent, zExtent],
    });

    for (const viewport of viewports) {
      if (viewport.type !== 'orthographic') continue;

      const orthoViewport = viewport as csTypes.IVolumeViewport;
      const camera = orthoViewport.getCamera();
      const viewPlaneNormal = camera.viewPlaneNormal;

      let focalPoint: csTypes.Point3;
      let parallelScale: number;

      // Determine viewport orientation and set appropriate zoom
      if (Math.abs(viewPlaneNormal[2]) > 0.9) {
        // Axial view: looking in Z direction
        focalPoint = [roiCenterX, roiCenterY, roiCenterZ] as csTypes.Point3;
        parallelScale = Math.max(xExtent, yExtent) / 2 * 1.1; // 10% padding
      } else if (Math.abs(viewPlaneNormal[1]) > 0.9) {
        // Coronal view: looking in Y direction
        focalPoint = [roiCenterX, roiCenterY, roiCenterZ] as csTypes.Point3;
        parallelScale = Math.max(xExtent, zExtent) / 2 * 1.1;
      } else if (Math.abs(viewPlaneNormal[0]) > 0.9) {
        // Sagittal view: looking in X direction
        focalPoint = [roiCenterX, roiCenterY, roiCenterZ] as csTypes.Point3;
        parallelScale = Math.max(yExtent, zExtent) / 2 * 1.1;
      } else {
            continue;
          }

      // Calculate camera position (keep same distance from focal point)
      const distance = camera.position
        ? Math.sqrt(
            Math.pow(camera.position[0] - camera.focalPoint[0], 2) +
              Math.pow(camera.position[1] - camera.focalPoint[1], 2) +
              Math.pow(camera.position[2] - camera.focalPoint[2], 2)
          )
        : 1000;

      const position: csTypes.Point3 = [
        focalPoint[0] - viewPlaneNormal[0] * distance,
        focalPoint[1] - viewPlaneNormal[1] * distance,
        focalPoint[2] - viewPlaneNormal[2] * distance,
      ];

      orthoViewport.setCamera({
        ...camera,
        focalPoint,
        position,
        parallelScale,
      });

      orthoViewport.render();
    }
  }

  /**
   * Remove all ROI rectangle annotations
   */
  private _removeRectangleAnnotations(): void {
    try {
      if (this.selection.coronalRect) {
        annotationModule.state.removeAnnotation(this.selection.coronalRect.annotationUID);
      }
      if (this.selection.sagittalRect) {
        annotationModule.state.removeAnnotation(this.selection.sagittalRect.annotationUID);
      }

      // Render all viewports to update
      const renderingEngines = getRenderingEngines();
      if (renderingEngines && renderingEngines.length > 0) {
        renderingEngines[0].renderViewports(renderingEngines[0].getViewports().map(v => v.id));
      }
    } catch (error) {
      console.error('🎯 [ROISelectionService] Error removing annotations:', error);
    }
  }

  /**
   * Unsubscribe from events
   */
  private _unsubscribeFromEvents(): void {
    for (const unsub of this.eventUnsubscribers) {
      try {
        unsub();
    } catch (error) {
        console.warn('🎯 [ROISelectionService] Error unsubscribing:', error);
      }
    }
    this.eventUnsubscribers = [];
  }

  /**
   * Reset ROI and restore original camera states
   */
  public reset(): void {
    console.log('🎯 [ROISelectionService] Resetting ROI');

    // Remove any annotations
    this._removeRectangleAnnotations();

    // Restore original camera states
    this._restoreOriginalCameraStates();

    // Unsubscribe from events
    this._unsubscribeFromEvents();

    // Reset state
    this.mode = 'idle';
    this.selection = this._createEmptySelection();
    this.volumeInfo = null;

    this._broadcastEvent(ROI_SELECTION_EVENTS.ROI_RESET, {});
  }

  /**
   * Restore original camera states
   */
  private _restoreOriginalCameraStates(): void {
    const renderingEngines = getRenderingEngines();
    if (!renderingEngines || renderingEngines.length === 0) return;

    const renderingEngine = renderingEngines[0];
    const viewports = renderingEngine.getViewports();

    for (const viewport of viewports) {
      const originalCamera = this.originalCameraStates.get(viewport.id);
      if (originalCamera && viewport.type === 'orthographic') {
        const orthoViewport = viewport as csTypes.IVolumeViewport;
        orthoViewport.setCamera(originalCamera);
        orthoViewport.render();
      }
    }

    this.originalCameraStates.clear();
  }

  /**
   * Cancel selection without applying
   */
  public cancelSelection(): void {
    console.log('🎯 [ROISelectionService] Canceling ROI selection');
    this.reset();
  }

  /**
   * Get current selection state
   */
  public getSelection(): ROISelection {
    return { ...this.selection };
  }

  /**
   * Get current mode
   */
  public getMode(): SelectionMode {
    return this.mode;
  }

  /**
   * Check if ROI is currently active
   */
  public isActive(): boolean {
    return this.mode !== 'idle';
  }

  /**
   * Check if ROI has been applied
   */
  public isApplied(): boolean {
    return this.selection.isApplied;
  }

  /**
   * Get rectangle count
   */
  public getRectangleCount(): number {
    let count = 0;
    if (this.selection.coronalRect) count++;
    if (this.selection.sagittalRect) count++;
    return count;
  }
}

export default ROISelectionService;
