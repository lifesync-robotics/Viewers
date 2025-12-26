/**
 * ScrewInteractionTool
 *
 * A Cornerstone tool for interacting with screws on MPR planes.
 * Features:
 * - Click to select a screw (identifies screw by ID)
 * - Drag to translate screw on the current viewport plane
 * - Automatically moves both screw body and cap together
 * - Visual feedback during interaction
 */

import {
  BaseTool,
  Enums as csToolsEnums,
  ToolGroupManager,
} from '@cornerstonejs/tools';
import {
  getRenderingEngine,
  getEnabledElement,
  eventTarget,
  EVENTS as csEvents
} from '@cornerstonejs/core';
import type { ScrewPickResult } from '../components/CustomizedModels/modelStateService';
import { planningBackendService } from '../services';
import { vec3 } from 'gl-matrix';

const { MouseBindings } = csToolsEnums;

/**
 * Interaction state for screw manipulation
 */
interface ScrewInteractionState {
  selectedScrewId: string | null;
  selectedScrewLabel: string | null;
  selectedPart: 'cap' | 'body' | 'tip' | null;
  interactionMode: 'translate' | 'rotate' | null;
  isDragging: boolean;
  dragStartWorld: [number, number, number] | null;
  lastWorldPosition: [number, number, number] | null;
  originalTransform: number[] | null;
  originalPosition: [number, number, number] | null; // Original screw position at start of drag
  cumulativeTranslation: [number, number, number]; // Total translation from original position
  cumulativeRotationAngle: number; // Total rotation angle from original orientation (degrees)
  viewportPlaneNormal: [number, number, number] | null;
  viewportId: string | null;
  element: HTMLElement | null;
}

class ScrewInteractionTool extends BaseTool {
  static toolName = 'ScrewInteraction';

  private state: ScrewInteractionState;
  private modelStateService: any;
  private planningBackendService: any;
  private sessionId: string | null = null;
  private debug: boolean = true;
  
  // Safety limits - constrain movement during each edit session (mouse down to mouse up)
  private readonly MAX_TRANSLATION_MM = 30.0;  // ±20mm translation limit per edit
  private readonly MAX_ROTATION_DEG = 20.0;    // ±10° rotation limit per edit
  
  // Visual warning overlay
  private warningOverlay: HTMLDivElement | null = null;
  private warningTimeout: any = null;
  private isWarningVisible: boolean = false; // Prevent rapid re-creation during drag
  
  // Crosshairs state management - store original state to restore after interaction
  private crosshairsOriginalState: Map<string, boolean> = new Map(); // toolGroupId -> was crosshairs active
  
  // Viewport camera change monitoring - detect external camera updates during drag
  private cameraModifiedListener: ((evt: any) => void) | null = null;

  constructor(
    toolProps = {},
    defaultToolProps = {
      supportedInteractionTypes: ['Mouse', 'Touch'],
      configuration: {
        pickRadius: 20,
        capOnlyDrag: false,
      },
    }
  ) {
    super(toolProps, defaultToolProps);
    this.state = this._getInitialState();
  }

  /**
   * Initialize services from ServicesManager
   */
  public setServicesManager(servicesManager: any): void {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔧 [ScrewInteractionTool] setServicesManager CALLED');
    console.log('   servicesManager:', !!servicesManager);
    console.log('   servicesManager.services:', servicesManager?.services ? Object.keys(servicesManager.services) : 'undefined');
    console.log('═══════════════════════════════════════════════════════');

    this.modelStateService = servicesManager?.services?.modelStateService;
    // Use the directly imported planningBackendService singleton
    // (servicesManager.services.planningBackendService is not registered)
    this.planningBackendService = planningBackendService;

    console.log('   modelStateService set:', !!this.modelStateService);
    console.log('   planningBackendService set:', !!this.planningBackendService);

    if (this.modelStateService) {
      this._log('✅ ModelStateService connected');
    } else {
      console.warn('⚠️ [ScrewInteractionTool] ModelStateService not available');
    }

    if (this.planningBackendService) {
      this._log('✅ PlanningBackendService connected (singleton)');
    }
  }

  /**
   * Set the current planning session ID
   * This is needed to save screw transforms to the backend
   */
  public setSessionId(sessionId: string): void {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔧 [ScrewInteractionTool] setSessionId CALLED');
    console.log('   sessionId:', sessionId);
    console.log('═══════════════════════════════════════════════════════');
    this.sessionId = sessionId;
    this._log(`✅ Session ID set: ${sessionId}`);
  }

  private _getInitialState(): ScrewInteractionState {
    return {
      selectedScrewId: null,
      selectedScrewLabel: null,
      selectedPart: null,
      interactionMode: null,
      isDragging: false,
      dragStartWorld: null,
      lastWorldPosition: null,
      originalTransform: null,
      originalPosition: null,
      cumulativeTranslation: [0, 0, 0],
      cumulativeRotationAngle: 0,
      viewportPlaneNormal: null,
      viewportId: null,
      element: null,
    };
  }

  private _log(message: string, ...args: any[]): void {
    if (this.debug) {
      console.log(`🔧 [ScrewInteractionTool] ${message}`, ...args);
    }
  }

  /**
   * Called when tool is activated
   */
  onSetToolActive(): void {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🟢 [ScrewInteractionTool] onSetToolActive() CALLED');
    console.log('═══════════════════════════════════════════════════════');
    console.log('   Tool is now ACTIVE and listening for mouse events');
    console.log('   ModelStateService available:', !!this.modelStateService);
    this._log('Tool activated');
    
    // ═══════════════════════════════════════════════════════════════════════════
    // CRITICAL: Disable Crosshairs to prevent viewport camera conflicts
    // ═══════════════════════════════════════════════════════════════════════════
    // Issue: When crosshairs are centered on a screw, editing that screw causes
    // crosshairs to update viewport cameras in real-time, fighting against our
    // freeze logic. This is why some screws (with crosshairs) don't freeze correctly
    // while others (without crosshairs) do.
    //
    // Solution: Disable crosshairs when ScrewInteractionTool is active
    this.crosshairsOriginalState.clear();
    const allToolGroups = ToolGroupManager.getAllToolGroups();
    
    for (const toolGroup of allToolGroups) {
      try {
        const crosshairsTool = toolGroup.getToolInstance('Crosshairs');
        if (crosshairsTool) {
          const beforeOptions = toolGroup.getToolOptions('Crosshairs');
          const wasActive = beforeOptions?.mode === 'Active';
          this.crosshairsOriginalState.set(toolGroup.id, wasActive);
          toolGroup.setToolDisabled('Crosshairs');
        }
      } catch (error) {
        // Crosshairs not in this tool group, continue
      }
    }
  }

  /**
   * Called when tool is disabled
   */
  onSetToolDisabled(): void {
    this._log('Tool disabled');
    
    // Clean up interaction state
    if (this.state.selectedScrewId) {
      this._highlightScrew(this.state.selectedScrewId, false);
    }
    this._removeWarningOverlay();
    this.state = this._getInitialState();
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Restore Crosshairs to original state
    // ═══════════════════════════════════════════════════════════════════════════
    const allToolGroups = ToolGroupManager.getAllToolGroups();
    
    for (const toolGroup of allToolGroups) {
      try {
        const crosshairsTool = toolGroup.getToolInstance('Crosshairs');
        if (crosshairsTool) {
          const wasActive = this.crosshairsOriginalState.get(toolGroup.id);
          if (wasActive) {
            toolGroup.setToolActive('Crosshairs');
          }
        }
      } catch (error) {
        // Crosshairs not in this tool group, continue
      }
    }
    
    this.crosshairsOriginalState.clear();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CORNERSTONE TOOL CALLBACKS
  // These are called by the Cornerstone tool framework
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Called on mouse down - required by BaseTool
   */
  preMouseDownCallback = (evt: any): boolean => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔧 [ScrewInteractionTool] preMouseDownCallback CALLED');
    console.log('═══════════════════════════════════════════════════════');

    if (!this.modelStateService) {
      this._log('❌ ModelStateService not available');
      console.log('   Check: servicesManager was not set properly');
      return false;
    }

    const eventDetail = evt.detail;
    console.log('   Event detail:', eventDetail);

    const { element, currentPoints } = eventDetail;

    if (!currentPoints) {
      this._log('❌ No currentPoints in event');
      return false;
    }

    const worldPoint = currentPoints?.world;
    if (!worldPoint) {
      this._log('❌ No world point in currentPoints');
      console.log('   currentPoints:', currentPoints);
      return false;
    }

    this._log(`✅ Mouse down at world: [${worldPoint[0].toFixed(2)}, ${worldPoint[1].toFixed(2)}, ${worldPoint[2].toFixed(2)}]`);

    // Perform inside/outside test - check if click is INSIDE a screw cylinder
    const pickResult: ScrewPickResult | null = this.modelStateService.findScrewAtPoint(
      [worldPoint[0], worldPoint[1], worldPoint[2]] as [number, number, number]
    );

    if (!pickResult) {
      this._log('❌ Click is NOT inside any screw - cannot drag');
      return false;
    }

    // Point is inside a screw! Allow drag

    // Found a screw - start interaction
    this._log(`✅ Selected screw: ${pickResult.screwLabel} (${pickResult.part}) - Mode: ${pickResult.interactionMode}`);

    // Get viewport plane normal for constraining movement
    const planeNormal = this._getViewportPlaneNormal(element);

    // Store original transform for potential undo and limit checking
    const originalTransform = this.modelStateService.getScrewTransform(pickResult.modelId);
    
    // Extract original position from transform matrix (translation is at indices 3, 7, 11)
    const originalPosition: [number, number, number] = originalTransform ? [
      originalTransform[3],
      originalTransform[7],
      originalTransform[11]
    ] : [worldPoint[0], worldPoint[1], worldPoint[2]];

    console.log(`📍 [ScrewInteractionTool] Original position: [${originalPosition.map(v => v.toFixed(2)).join(', ')}]`);
    console.log(`🎯 [ScrewInteractionTool] Safety limits: Translation ±${this.MAX_TRANSLATION_MM}mm, Rotation ±${this.MAX_ROTATION_DEG}°`);

    // Update state
    this.state = {
      selectedScrewId: pickResult.modelId,
      selectedScrewLabel: pickResult.screwLabel,
      selectedPart: pickResult.part,
      interactionMode: pickResult.interactionMode,
      isDragging: true,
      dragStartWorld: [worldPoint[0], worldPoint[1], worldPoint[2]],
      lastWorldPosition: [worldPoint[0], worldPoint[1], worldPoint[2]],
      originalTransform,
      originalPosition,
      cumulativeTranslation: [0, 0, 0],
      cumulativeRotationAngle: 0,
      viewportPlaneNormal: planeNormal,
      viewportId: this._getViewportId(element),
      element,
    };

    // Visual feedback - highlight screw
    this._highlightScrew(pickResult.modelId, true);

    // Get the viewport ID where the click occurred (to exclude it from updates)
    const clickedViewportId = this._getViewportId(element);
    
    if (!clickedViewportId) {
      console.error(`❌ Failed to get viewport ID from element - all viewports may update incorrectly`);
    }
    
    // Install global camera change monitor to catch external updates
    this._installCameraMonitor(clickedViewportId);

    // ═══════════════════════════════════════════════════════════════════════════
    // NO viewport camera updates on mouse down
    // ═══════════════════════════════════════════════════════════════════════════
    // The entire interaction from mouse down → drag → mouse up is ONE edit session
    // Viewport cameras remain FROZEN throughout the entire edit
    // Updates happen ONLY on mouse release (in mouseUpCallback)
    // 
    // Timeline:
    //   Mouse down: Start edit, freeze all cameras ❄️
    //   Drag: Continue edit, cameras still frozen ❄️
    //   Stop dragging (mouse still down): Still editing, cameras frozen ❄️
    //   Mouse up: End edit, update OTHER viewports ✅
    
    // Return true to indicate we handled the event
    return true;
  };

  /**
   * Called on mouse drag - required by BaseTool
   *
   * IMPORTANT: Updates OTHER viewport cameras during drag (crosshairs behavior)
   * - Edited viewport: Camera stays stationary
   * - Other viewports: Camera updates to track screw position/orientation
   */
  mouseDragCallback = (evt: any): void => {
    if (!this.state.isDragging || !this.state.selectedScrewId) {
      return;
    }

    const eventDetail = evt.detail;
    const { currentPoints } = eventDetail;

    const currentWorld = currentPoints?.world;
    if (!currentWorld || !this.state.lastWorldPosition) {
      return;
    }

    // Calculate world delta from last position
    const worldDelta: [number, number, number] = [
      currentWorld[0] - this.state.lastWorldPosition[0],
      currentWorld[1] - this.state.lastWorldPosition[1],
      currentWorld[2] - this.state.lastWorldPosition[2]
    ];

    // Constrain movement to viewport plane
    // NOTE: We use the viewportPlaneNormal from when drag started (stored in state)
    // This ensures consistent dragging behavior
    let constrainedDelta = worldDelta;
    if (this.state.viewportPlaneNormal && this.modelStateService.projectDeltaOntoPlane) {
      constrainedDelta = this.modelStateService.projectDeltaOntoPlane(
        worldDelta,
        this.state.viewportPlaneNormal
      );
    }

    // Skip if delta is too small
    const deltaMagnitude = Math.sqrt(
      constrainedDelta[0] ** 2 +
      constrainedDelta[1] ** 2 +
      constrainedDelta[2] ** 2
    );

    if (deltaMagnitude < 0.01) {
      return;
    }

    // Update last position
    this.state.lastWorldPosition = [currentWorld[0], currentWorld[1], currentWorld[2]];

    // Log drag activity (throttled - only log every 10th drag)
    if (!this._dragLogCounter) this._dragLogCounter = 0;
    this._dragLogCounter++;
    if (this._dragLogCounter % 10 === 1) {
      console.log(`🔄 [ScrewInteractionTool] ${this.state.interactionMode?.toUpperCase() || 'DRAG'} screw: ${this.state.selectedScrewId?.substring(0, 8)}... delta: [${constrainedDelta[0].toFixed(2)}, ${constrainedDelta[1].toFixed(2)}, ${constrainedDelta[2].toFixed(2)}]`);
    }

    // Apply transformation based on interaction mode with safety limits
    if (this.state.interactionMode === 'rotate') {
      // ═══════════════════════════════════════════════════════════════════════════
      // ROTATION MODE - Apply rotation with angle limit
      // ═══════════════════════════════════════════════════════════════════════════
      if (this.modelStateService.rotateScrew && this.state.viewportPlaneNormal) {
        // Estimate rotation angle from delta magnitude
        // This is approximate - actual angle depends on rotation radius
        const rotationEstimate = deltaMagnitude * 2.0; // Approximate degrees per mm of cursor movement
        
        // Check if adding this delta would exceed rotation limit
        const newCumulativeRotation = this.state.cumulativeRotationAngle + rotationEstimate;
        
        if (Math.abs(newCumulativeRotation) > this.MAX_ROTATION_DEG) {
          // Limit reached - show warning (throttled)
          if (this._dragLogCounter % 20 === 0) {
            console.warn(`⚠️ [ScrewInteractionTool] Rotation limit reached: ±${this.MAX_ROTATION_DEG}° (current: ${newCumulativeRotation.toFixed(1)}°)`);
          }
          // Show visual warning on viewport
          this._showWarningOverlay(`Rotation Limit: ±${this.MAX_ROTATION_DEG}°`, 'rotation');
          // Clamp the delta to stay within limits
          const remainingRotation = this.MAX_ROTATION_DEG - Math.abs(this.state.cumulativeRotationAngle);
          if (remainingRotation > 0) {
            const scaleFactor = remainingRotation / rotationEstimate;
            constrainedDelta = [
              constrainedDelta[0] * scaleFactor,
              constrainedDelta[1] * scaleFactor,
              constrainedDelta[2] * scaleFactor
            ];
          } else {
            // No more rotation allowed
            return;
          }
        }
        
        // Apply rotation
        this.modelStateService.rotateScrew(
          this.state.selectedScrewId,
          constrainedDelta,
          this.state.viewportPlaneNormal
        );
        
        // Update cumulative rotation
        this.state.cumulativeRotationAngle = newCumulativeRotation;
      }
    } else {
      // ═══════════════════════════════════════════════════════════════════════════
      // TRANSLATION MODE - Apply translation with distance limit
      // ═══════════════════════════════════════════════════════════════════════════
      if (this.modelStateService.translateScrew && this.state.originalPosition) {
        // Calculate what the new cumulative translation would be
        const newCumulativeTranslation: [number, number, number] = [
          this.state.cumulativeTranslation[0] + constrainedDelta[0],
          this.state.cumulativeTranslation[1] + constrainedDelta[1],
          this.state.cumulativeTranslation[2] + constrainedDelta[2]
        ];
        
        // Calculate total distance from original position
        const totalDistance = Math.sqrt(
          newCumulativeTranslation[0] ** 2 +
          newCumulativeTranslation[1] ** 2 +
          newCumulativeTranslation[2] ** 2
        );
        
        // Check if translation exceeds limit
        if (totalDistance > this.MAX_TRANSLATION_MM) {
          // Limit reached - show warning (throttled)
          if (this._dragLogCounter % 20 === 0) {
            console.warn(`⚠️ [ScrewInteractionTool] Translation limit reached: ±${this.MAX_TRANSLATION_MM}mm (current: ${totalDistance.toFixed(1)}mm)`);
          }
          // Show visual warning on viewport
          this._showWarningOverlay(`Translation Limit: ±${this.MAX_TRANSLATION_MM}mm`, 'translation');
          
          // Scale down the delta to stay within limit
          // Calculate how much we can still move
          const currentDistance = Math.sqrt(
            this.state.cumulativeTranslation[0] ** 2 +
            this.state.cumulativeTranslation[1] ** 2 +
            this.state.cumulativeTranslation[2] ** 2
          );
          
          const remainingDistance = this.MAX_TRANSLATION_MM - currentDistance;
          
          if (remainingDistance <= 0) {
            // No more movement allowed
            return;
          }
          
          // Scale delta to use remaining distance
          const deltaDistance = Math.sqrt(
            constrainedDelta[0] ** 2 +
            constrainedDelta[1] ** 2 +
            constrainedDelta[2] ** 2
          );
          
          const scaleFactor = remainingDistance / deltaDistance;
          constrainedDelta = [
            constrainedDelta[0] * scaleFactor,
            constrainedDelta[1] * scaleFactor,
            constrainedDelta[2] * scaleFactor
          ];
          
          // Recalculate new cumulative translation with scaled delta
          newCumulativeTranslation[0] = this.state.cumulativeTranslation[0] + constrainedDelta[0];
          newCumulativeTranslation[1] = this.state.cumulativeTranslation[1] + constrainedDelta[1];
          newCumulativeTranslation[2] = this.state.cumulativeTranslation[2] + constrainedDelta[2];
        }
        
        // Apply translation
        this.modelStateService.translateScrew(this.state.selectedScrewId, constrainedDelta);
        
        // Update cumulative translation
        this.state.cumulativeTranslation = newCumulativeTranslation;
        
        // Log cumulative translation (throttled)
        if (this._dragLogCounter % 20 === 0) {
          const currentDistance = Math.sqrt(
            this.state.cumulativeTranslation[0] ** 2 +
            this.state.cumulativeTranslation[1] ** 2 +
            this.state.cumulativeTranslation[2] ** 2
          );
          console.log(`📏 [ScrewInteractionTool] Cumulative translation: ${currentDistance.toFixed(1)}mm / ${this.MAX_TRANSLATION_MM}mm`);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SIMPLIFIED WORKFLOW: No viewport camera updates during drag
    // ═══════════════════════════════════════════════════════════════════════════
    // All viewport cameras remain frozen during drag operation
    // Cameras will be updated only on mouse release (in mouseUpCallback)
    // This prevents ANY viewport from moving while user is actively editing
    // Benefits:
    //   - Simpler logic (no selective updates)
    //   - Better performance (no camera calculations during drag)
    //   - More predictable behavior (everything frozen until commit)
    //   - Clearer user intent (explicit "apply" moment on mouse release)
  };

  private _dragLogCounter: number = 0;

  /**
   * Called on mouse up - required by BaseTool
   */
  mouseUpCallback = (evt: any): void => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔧 [ScrewInteractionTool] mouseUpCallback CALLED');
    console.log('   isDragging:', this.state.isDragging);
    console.log('   selectedScrewId:', this.state.selectedScrewId);
    console.log('═══════════════════════════════════════════════════════');

    if (!this.state.isDragging || !this.state.selectedScrewId) {
      console.log('   ❌ Skipping - not dragging or no screw selected');
      return;
    }

    this._log(`Drag completed for screw: ${this.state.selectedScrewLabel}`);
    
    // Log final movement statistics
    if (this.state.interactionMode === 'rotate') {
      const finalRotation = Math.abs(this.state.cumulativeRotationAngle);
      console.log(`📊 [ScrewInteractionTool] Final rotation: ${finalRotation.toFixed(1)}° / ${this.MAX_ROTATION_DEG}° (${((finalRotation / this.MAX_ROTATION_DEG) * 100).toFixed(0)}% of limit)`);
    } else {
      const finalDistance = Math.sqrt(
        this.state.cumulativeTranslation[0] ** 2 +
        this.state.cumulativeTranslation[1] ** 2 +
        this.state.cumulativeTranslation[2] ** 2
      );
      console.log(`📊 [ScrewInteractionTool] Final translation: ${finalDistance.toFixed(1)}mm / ${this.MAX_TRANSLATION_MM}mm (${((finalDistance / this.MAX_TRANSLATION_MM) * 100).toFixed(0)}% of limit)`);
    }

    // Save the updated transform to backend session
    console.log('   📤 Calling _saveTransformToBackend...');
    console.log('   📤 selectedScrewId:', this.state.selectedScrewId);
    console.log('   📤 sessionId:', this.sessionId);
    console.log('   📤 planningBackendService:', !!this.planningBackendService);

    // Call async save and log result
    this._saveTransformToBackend(this.state.selectedScrewId).then(() => {
      console.log('   ✅ _saveTransformToBackend completed');
    }).catch((err) => {
      console.error('   ❌ _saveTransformToBackend failed:', err);
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // NOW update viewport cameras after drag completes (simplified workflow)
    // ═══════════════════════════════════════════════════════════════════════════
    // During drag: ALL viewports remained frozen (no camera updates)
    // On mouse release: Update OTHER viewports to reflect new screw position
    // IMPORTANT: Edited viewport stays stationary at its original camera position
    // This is the ONLY camera update during the entire interaction (simpler logic)

    
    let editedViewportId = this.state.viewportId;
    
    // Defensive: If viewport ID wasn't captured on mouse down, try to get it now
    if (!editedViewportId && this.state.element) {
      editedViewportId = this._getViewportId(this.state.element);
    }
    
    if (!editedViewportId) {
      console.error(`❌ No viewport ID available - skipping viewport camera updates`);
    } else {
      this._updateViewportCamerasFromScrew(this.state.selectedScrewId, editedViewportId);
    }

    // Remove highlight
    this._highlightScrew(this.state.selectedScrewId, false);

    // Remove warning overlay if present
    this._removeWarningOverlay();
    
    // Remove camera change monitor
    this._removeCameraMonitor();

    // Reset state
    this.state = this._getInitialState();
  };

  /**
   * Save the screw's updated transform matrix to the backend session
   * This ensures changes are persisted when SavePlan is called
   */
  private async _saveTransformToBackend(modelId: string): Promise<void> {
    console.log('═══════════════════════════════════════════════════════');
    console.log('📤 [ScrewInteractionTool] _saveTransformToBackend CALLED');
    console.log('   modelId:', modelId);
    console.log('   modelStateService:', !!this.modelStateService);
    console.log('   planningBackendService:', !!this.planningBackendService);
    console.log('   sessionId:', this.sessionId);
    console.log('═══════════════════════════════════════════════════════');

    // Check if modelId is a valid UUID (backend screw_id format)
    // UUIDs look like: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidBackendId = uuidPattern.test(modelId);

    if (!isValidBackendId) {
      console.log(`⚠️ [ScrewInteractionTool] modelId "${modelId}" is not a valid backend screw_id (UUID)`);
      console.log('   This screw was likely created locally and not yet saved to backend.');
      console.log('   Visual changes are preserved. Save the plan to persist changes.');
      return;
    }

    if (!this.modelStateService) {
      console.log('❌ Cannot save: ModelStateService not available');
      return;
    }

    if (!this.planningBackendService) {
      console.log('❌ Cannot save to backend: PlanningBackendService not available');
      console.log('   This means servicesManager.services.planningBackendService is undefined');
      // Changes are still in modelStateService, just won't persist to backend session
      return;
    }

    try {
      // Get the current transform matrix from the model
      const transformMatrix = this.modelStateService.getScrewTransform(modelId);
      if (!transformMatrix) {
        this._log('⚠️ No transform matrix available for screw:', modelId);
        return;
      }

      // Build update data with transform matrix
      // Transform matrix contains all position/orientation info
      const updateData: any = {
        transformMatrix: Array.from(transformMatrix),
      };

      // Extract entry point from transform matrix (translation is at indices 3, 7, 11 in row-major)
      // getScrewTransform returns row-major format
      updateData.entryPoint = {
        x: transformMatrix[3],
        y: transformMatrix[7],
        z: transformMatrix[11],
      };

      // Extract trajectory direction from transform matrix
      // Z-axis direction (third column) indicates screw direction
      // In row-major: column 2 is at indices 2, 6, 10
      updateData.trajectory = {
        direction: [
          transformMatrix[2],
          transformMatrix[6],
          transformMatrix[10],
        ],
        insertionDepth: 40, // Default, will be overridden by backend if available
        convergenceAngle: 0,
        cephaladAngle: 0,
      };

      this._log('📤 Saving transform to backend:', { modelId, updateData });

      // Call the backend to update the screw
      if (!this.sessionId) {
        this._log('⚠️ No session ID set, cannot save to backend');
        this._log('   Call setSessionId() before using the tool');
        return;
      }

      console.log('   📤 Calling planningBackendService.updateScrew...');
      console.log('      screwId:', modelId);
      console.log('      sessionId:', this.sessionId);
      console.log('      updateData:', JSON.stringify(updateData, null, 2).substring(0, 500));

      const result = await this.planningBackendService.updateScrew(modelId, this.sessionId, updateData);

      console.log('   📤 updateScrew result:', result);

      if (result.success) {
        console.log('✅ [ScrewInteractionTool] Transform saved to backend session');
      } else {
        console.error('❌ [ScrewInteractionTool] Failed to save transform:', result.error);
      }
    } catch (error) {
      console.error('❌ [ScrewInteractionTool] Exception in _saveTransformToBackend:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  private _getViewportPlaneNormal(element: HTMLElement): [number, number, number] {
    try {
      const enabledElement = getEnabledElement(element as HTMLDivElement);
      if (!enabledElement) return [0, 0, 1];

      const viewport = enabledElement.viewport;
      if (!viewport) return [0, 0, 1];

      const camera = viewport.getCamera();
      if (camera?.viewPlaneNormal) {
        return camera.viewPlaneNormal as [number, number, number];
      }
    } catch (error) {
      this._log('Error getting viewport plane normal:', error);
    }

    return [0, 0, 1];
  }

  private _getViewportId(element: HTMLElement): string | null {
    try {
      const enabledElement = getEnabledElement(element as HTMLDivElement);
      if (enabledElement) {
        return enabledElement.viewportId;
      }
    } catch (error) {
      this._log('Error getting viewport ID:', error);
    }
    return null;
  }

  private _highlightScrew(modelId: string, highlight: boolean): void {
    try {
      if (!this.modelStateService) return;

      const model = this.modelStateService.getModel(modelId);
      if (!model || !model.actor) return;

      const property = model.actor.getProperty();
      if (!property) return;

      if (highlight) {
        const originalColor = property.getColor();
        model._originalColor = [...originalColor];

        property.setColor(
          Math.min(1, originalColor[0] * 1.3),
          Math.min(1, originalColor[1] * 1.3),
          Math.min(1, originalColor[2] * 1.3)
        );
        property.setOpacity(1.0);

        this._log(`Highlighted screw: ${modelId}`);
      } else {
        if (model._originalColor) {
          property.setColor(...model._originalColor);
          property.setOpacity(0.9);
        }
        this._log(`Unhighlighted screw: ${modelId}`);
      }

      const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
      if (renderingEngine) {
        renderingEngine.render();
      }
    } catch (error) {
      this._log('Error highlighting screw:', error);
    }
  }

  /**
   * Update viewport cameras to align with screw orientation
   * Called when clicking on a screw (mouse down) and when releasing (mouse up)
   * Similar to clicking the "View" button in ScrewManagementPanel
   *
   * @param modelId - Screw model ID
   * @param excludeViewportId - Optional viewport ID to exclude from updates (e.g., the viewport where user clicked)
   */
  private _updateViewportCamerasFromScrew(modelId: string, excludeViewportId?: string): void {
    if (!modelId || !this.modelStateService) {
      console.warn('⚠️ [ScrewInteractionTool] Cannot update viewport cameras - missing modelId or modelStateService');
      return;
    }

    try {
      console.log('🎯 [ScrewInteractionTool] Updating viewport cameras from screw:', modelId);
      // Get current screw transform matrix
      const transform = this.modelStateService.getScrewTransform(modelId);
      if (!transform || transform.length !== 16) {
        return;
      }

      // Get screw position from transform (translation column)
      const screwPosition: [number, number, number] = [
        transform[3],
        transform[7],
        transform[11]
      ];

      // Extract axis directions from transform matrix (row-major format)
      // X-axis: Column 0 (indices 0, 4, 8) → Axial plane normal
      // Y-axis: Column 1 (indices 1, 5, 9) → Coronal plane normal (stored negated)
      // Z-axis: Column 2 (indices 2, 6, 10) → Sagittal plane normal
      const axialNormal: [number, number, number] = [
        transform[0],
        transform[4],
        transform[8]
      ];
      // Coronal normal is stored negated, so negate it back
      const coronalNormal: [number, number, number] = [
        -transform[1],
        -transform[5],
        -transform[9]
      ];
      const sagittalNormal: [number, number, number] = [
        transform[2],
        transform[6],
        transform[10]
      ];

      // Normalize the vectors
      vec3.normalize(axialNormal, axialNormal);
      vec3.normalize(coronalNormal, coronalNormal);
      vec3.normalize(sagittalNormal, sagittalNormal);

      const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
      if (!renderingEngine) {
        return;
      }

      const viewports = renderingEngine.getViewports();
      if (viewports.length === 0) {
        return;
      }

      if (!excludeViewportId) {
        console.warn(`⚠️ No viewport to exclude - all viewports will be updated`);
      }

      // Update each MPR viewport camera
      for (const viewport of viewports) {
        try {
          // Skip the viewport where user clicked (if specified)
          // Use exact string comparison
          if (excludeViewportId && viewport.id === excludeViewportId) {
            continue;
          }


          const viewportId = viewport.id.toLowerCase();
          const camera = viewport.getCamera();
          const { position: cameraPosition } = camera;

          // Calculate new camera position maintaining distance from focal point
          const viewDirection = vec3.sub(
            vec3.create(),
            cameraPosition as [number, number, number],
            camera.focalPoint as [number, number, number]
          );
          const distance = vec3.length(viewDirection);

          // Keep the original viewUp from DICOM series loading
          const originalViewUp = camera.viewUp as [number, number, number];

          let newViewPlaneNormal: [number, number, number] | null = null;

          // Set viewPlaneNormal based on viewport type
          if (viewportId.includes('axial')) {
            newViewPlaneNormal = axialNormal;
            console.log(`📐 [${viewport.id}] Setting axial viewPlaneNormal: [${newViewPlaneNormal.map(v => v.toFixed(3)).join(', ')}]`);
          } else if (viewportId.includes('sagittal')) {
            newViewPlaneNormal = sagittalNormal;
            console.log(`📐 [${viewport.id}] Setting sagittal viewPlaneNormal: [${newViewPlaneNormal.map(v => v.toFixed(3)).join(', ')}]`);
          } else if (viewportId.includes('coronal')) {
            newViewPlaneNormal = coronalNormal;
            console.log(`📐 [${viewport.id}] Setting coronal viewPlaneNormal: [${newViewPlaneNormal.map(v => v.toFixed(3)).join(', ')}]`);
          }

          if (newViewPlaneNormal) {
            // Ensure viewUp is orthogonal to viewPlaneNormal (Gram-Schmidt orthogonalization)
            // This is critical for proper camera orientation
            const dot = vec3.dot(originalViewUp, newViewPlaneNormal);
            const projection = vec3.scale(vec3.create(), newViewPlaneNormal, dot);
            const orthogonalViewUp = vec3.subtract(vec3.create(), originalViewUp, projection);
            vec3.normalize(orthogonalViewUp, orthogonalViewUp);

            // Calculate new camera position
            const newPosition = vec3.add(
              vec3.create(),
              screwPosition,
              vec3.scale(vec3.create(), newViewPlaneNormal, distance)
            ) as [number, number, number];

            console.log(`📷 [${viewport.id}] Camera update:`);
            console.log(`   focalPoint: [${screwPosition.map(v => v.toFixed(2)).join(', ')}]`);
            console.log(`   position: [${newPosition.map(v => v.toFixed(2)).join(', ')}]`);
            console.log(`   viewPlaneNormal: [${newViewPlaneNormal.map(v => v.toFixed(3)).join(', ')}]`);
            console.log(`   viewUp (original): [${originalViewUp.map(v => v.toFixed(3)).join(', ')}]`);
            console.log(`   viewUp (orthogonal): [${orthogonalViewUp.map(v => v.toFixed(3)).join(', ')}]`);

            // Update camera with orthogonal viewUp
            viewport.setCamera({
              focalPoint: screwPosition,
              position: newPosition,
              viewPlaneNormal: newViewPlaneNormal,
              viewUp: [orthogonalViewUp[0], orthogonalViewUp[1], orthogonalViewUp[2]],
            });

            // Verify the update
            const updatedCamera = viewport.getCamera();
            console.log(`   ✓ Camera updated - viewPlaneNormal: [${updatedCamera.viewPlaneNormal.map(v => v.toFixed(3)).join(', ')}]`);

            viewport.render();
            console.log(`✅ Updated camera for ${viewport.id}`);
          }
        } catch (error) {
          console.warn(`⚠️ Error updating viewport ${viewport.id}:`, error);
        }
      }

      // STEP 2: Update crosshairs position to match screw position (like "View" button)
      // This ensures crosshairs align with the screw center
      let crosshairsUpdated = false;
      for (const viewport of viewports) {
        try {
          const toolGroup = ToolGroupManager.getToolGroupForViewport(
            viewport.id,
            renderingEngine.id
          );

          if (!toolGroup) continue;

          const crosshairsTool = toolGroup.getToolInstance('Crosshairs');

          if (crosshairsTool && typeof crosshairsTool.setToolCenter === 'function') {
            // Use the tool's API to properly move crosshairs
            // Second parameter (false) means don't trigger an event
            crosshairsTool.setToolCenter(screwPosition, false);
            crosshairsUpdated = true;
            console.log(`✅ [ScrewInteractionTool] Crosshairs setToolCenter called`);
            break; // Only need to call once, crosshairs are shared
          }
        } catch (e) {
          console.debug(`⚠️ Could not use setToolCenter in viewport ${viewport.id}:`, e);
        }
      }

      // STEP 3: Force rendering engine to render all viewports
      if (renderingEngine) {
        // Get viewport IDs from viewport objects
        const viewportIds = viewports.map(vp => vp.id);
        renderingEngine.renderViewports(viewportIds);
        console.log('✅ Forced rendering engine to render all viewports');
        console.log(`✅ [ScrewInteractionTool] Viewport update completed - camera: ✓, crosshairs: ${crosshairsUpdated ? '✓' : '✗'}`);
      }
    } catch (error) {
      console.error('❌ Error updating viewport cameras from screw:', error);
    }
  }

  /**
   * Get the currently selected screw info
   */
  public getSelectedScrew(): { modelId: string; label: string; part: string } | null {
    if (!this.state.selectedScrewId) return null;

    return {
      modelId: this.state.selectedScrewId,
      label: this.state.selectedScrewLabel || '',
      part: this.state.selectedPart || 'body',
    };
  }

  /**
   * Show visual warning overlay on screen (simple, non-intrusive)
   * IMPORTANT: Uses fixed positioning attached to document.body to avoid interfering with viewport
   * Throttled: Only shows once per warning session to prevent constant DOM manipulation
   */
  private _showWarningOverlay(message: string, type: 'translation' | 'rotation'): void {
    // Don't show if warning is already visible (prevents constant DOM manipulation during drag)
    if (this.isWarningVisible) {
      return;
    }

    // Remove existing overlay
    this._removeWarningOverlay();

    // Create simple text overlay
    const overlay = document.createElement('div');
    const icon = type === 'translation' ? '📏' : '🔄';
    
    // Use fixed position at top-center of screen - doesn't interfere with viewport at all
    overlay.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 152, 0, 0.95);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: bold;
      z-index: 99999;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      border: 2px solid rgba(255, 193, 7, 0.9);
      text-align: center;
      animation: slideDown 0.3s ease-out;
    `;
    
    overlay.innerHTML = `${icon} ⚠️ ${message}`;

    // Add animation keyframes only once
    if (!document.getElementById('screw-warning-styles')) {
      const style = document.createElement('style');
      style.id = 'screw-warning-styles';
      style.textContent = `
        @keyframes slideDown {
          0% { transform: translateX(-50%) translateY(-20px); opacity: 0; }
          100% { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    // Attach directly to document.body - doesn't touch viewport container at all
    document.body.appendChild(overlay);
    
    this.warningOverlay = overlay;
    this.isWarningVisible = true; // Mark as visible to prevent re-creation

    console.log(`⚠️ [ScrewInteractionTool] Warning displayed: ${message}`);

    // Auto-remove after 2 seconds
    if (this.warningTimeout) {
      clearTimeout(this.warningTimeout);
    }
    this.warningTimeout = setTimeout(() => {
      this._removeWarningOverlay();
    }, 2000);
  }

  /**
   * Remove warning overlay
   */
  private _removeWarningOverlay(): void {
    if (this.warningOverlay) {
      try {
        this.warningOverlay.remove();
      } catch (e) {
        // Ignore errors
      }
      this.warningOverlay = null;
    }
    if (this.warningTimeout) {
      clearTimeout(this.warningTimeout);
      this.warningTimeout = null;
    }
    this.isWarningVisible = false; // Reset flag to allow future warnings
  }

  /**
   * Install global camera change monitor to detect external viewport camera updates
   * This helps debug cases where something ELSE is updating viewport cameras during our drag
   */
  private _installCameraMonitor(editedViewportId: string | null): void {
    // Remove any existing listener first
    this._removeCameraMonitor();
    
    // Create listener that logs ALL camera modifications
    this.cameraModifiedListener = (evt: any) => {
      const { viewportId, camera } = evt.detail || {};
      
      // Log ALL camera changes
      if (viewportId === editedViewportId) {
        console.warn(`🚨 External camera update on edited viewport ${viewportId} - this should not happen during drag`);
      }
    };
    
    // Listen to Cornerstone CAMERA_MODIFIED event globally
    eventTarget.addEventListener(csEvents.CAMERA_MODIFIED, this.cameraModifiedListener);
  }

  /**
   * Remove global camera change monitor
   */
  private _removeCameraMonitor(): void {
    if (this.cameraModifiedListener) {
      eventTarget.removeEventListener(csEvents.CAMERA_MODIFIED, this.cameraModifiedListener);
      this.cameraModifiedListener = null;
    }
  }
}

export default ScrewInteractionTool;
