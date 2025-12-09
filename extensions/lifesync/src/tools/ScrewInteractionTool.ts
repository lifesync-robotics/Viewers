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
  getToolGroup,
} from '@cornerstonejs/tools';
import {
  getRenderingEngine,
  getEnabledElement,
  eventTarget,
  EVENTS as csEvents
} from '@cornerstonejs/core';
import type { ScrewPickResult } from '../components/CustomizedModels/modelStateService';
import { planningBackendService } from '../services';

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
  }

  /**
   * Called when tool is disabled
   */
  onSetToolDisabled(): void {
    this._log('Tool disabled');
    if (this.state.selectedScrewId) {
      this._highlightScrew(this.state.selectedScrewId, false);
    }
    this.state = this._getInitialState();
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

    // Point is inside a screw! Log confirmation and allow drag
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎯 CHECK INSIDE A SCREW - INTERACTION ENABLED');
    console.log(`   Screw: ${pickResult.screwLabel}`);
    console.log(`   Part: ${pickResult.part}`);
    console.log(`   Mode: ${pickResult.interactionMode.toUpperCase()}`);
    console.log('═══════════════════════════════════════════════════════');

    // Found a screw - start interaction
    this._log(`✅ Selected screw: ${pickResult.screwLabel} (${pickResult.part}) - Mode: ${pickResult.interactionMode}`);

    // Get viewport plane normal for constraining movement
    const planeNormal = this._getViewportPlaneNormal(element);

    // Store original transform for potential undo
    const originalTransform = this.modelStateService.getScrewTransform(pickResult.modelId);

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
      viewportPlaneNormal: planeNormal,
      viewportId: this._getViewportId(element),
      element,
    };

    // Visual feedback - highlight screw
    this._highlightScrew(pickResult.modelId, true);

    // Return true to indicate we handled the event
    return true;
  };

  /**
   * Called on mouse drag - required by BaseTool
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

    // Apply transformation based on interaction mode
    if (this.state.interactionMode === 'rotate') {
      // Rotate the screw around its origin
      if (this.modelStateService.rotateScrew && this.state.viewportPlaneNormal) {
        this.modelStateService.rotateScrew(
          this.state.selectedScrewId,
          constrainedDelta,
          this.state.viewportPlaneNormal
        );
      }
    } else {
      // Translate the screw (default)
      if (this.modelStateService.translateScrew) {
        this.modelStateService.translateScrew(this.state.selectedScrewId, constrainedDelta);
      }
    }
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

    // CRITICAL: Apply the final position update before saving
    // The last mouseDragCallback may have missed the final mouse position
    const eventDetail = evt.detail;
    const currentPoints = eventDetail?.currentPoints;
    const finalWorld = currentPoints?.world;

    if (finalWorld && this.state.lastWorldPosition) {
      // Calculate final delta from last known position
      const finalDelta: [number, number, number] = [
        finalWorld[0] - this.state.lastWorldPosition[0],
        finalWorld[1] - this.state.lastWorldPosition[1],
        finalWorld[2] - this.state.lastWorldPosition[2]
      ];

      // Constrain to viewport plane
      let constrainedDelta = finalDelta;
      if (this.state.viewportPlaneNormal && this.modelStateService?.projectDeltaOntoPlane) {
        constrainedDelta = this.modelStateService.projectDeltaOntoPlane(
          finalDelta,
          this.state.viewportPlaneNormal
        );
      }

      // Apply if significant
      const deltaMagnitude = Math.sqrt(
        constrainedDelta[0] ** 2 +
        constrainedDelta[1] ** 2 +
        constrainedDelta[2] ** 2
      );

      if (deltaMagnitude >= 0.01) {
        console.log(`   🎯 Applying final delta: [${constrainedDelta[0].toFixed(2)}, ${constrainedDelta[1].toFixed(2)}, ${constrainedDelta[2].toFixed(2)}]`);

        // Apply final transformation
        if (this.state.interactionMode === 'rotate') {
          if (this.modelStateService?.rotateScrew && this.state.viewportPlaneNormal) {
            this.modelStateService.rotateScrew(
              this.state.selectedScrewId,
              constrainedDelta,
              this.state.viewportPlaneNormal
            );
          }
        } else {
          if (this.modelStateService?.translateScrew) {
            this.modelStateService.translateScrew(this.state.selectedScrewId, constrainedDelta);
          }
        }
      }
    }

    this._log(`Drag completed for screw: ${this.state.selectedScrewLabel}`);

    // Capture the screw ID before resetting state (for async operation)
    const screwIdToSave = this.state.selectedScrewId;

    // Remove highlight
    this._highlightScrew(this.state.selectedScrewId, false);

    // Reset state BEFORE async save to prevent race conditions
    this.state = this._getInitialState();

    // Save the updated transform to backend session
    console.log('   📤 Calling _saveTransformToBackend...');
    console.log('   📤 screwIdToSave:', screwIdToSave);
    console.log('   📤 sessionId:', this.sessionId);
    console.log('   📤 planningBackendService:', !!this.planningBackendService);

    // Call async save with captured screw ID
    this._saveTransformToBackend(screwIdToSave).then(() => {
      console.log('   ✅ _saveTransformToBackend completed');
    }).catch((err) => {
      console.error('   ❌ _saveTransformToBackend failed:', err);
    });
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

      console.log('═══════════════════════════════════════════════════════');
      console.log('📤 [_saveTransformToBackend] TRANSFORM FROM getScrewTransform');
      console.log(`   Transform (row-major): [${transformMatrix[3].toFixed(2)}, ${transformMatrix[7].toFixed(2)}, ${transformMatrix[11].toFixed(2)}, ...]`);
      console.log('   ⚠️ SIMPLIFIED LOGIC: This is MODEL ORIGIN position (no compensation)');
      console.log('═══════════════════════════════════════════════════════');

      // Build update data with transform matrix
      // Transform matrix contains all position/orientation info
      const updateData: any = {
        transformMatrix: Array.from(transformMatrix),
      };

      // ⚠️ SIMPLIFIED LOGIC: entryPoint = model origin (same as transform translation)
      // Extract entry point from transform matrix (translation is at indices 3, 7, 11 in row-major)
      // getScrewTransform returns row-major format
      updateData.entryPoint = {
        x: transformMatrix[3],
        y: transformMatrix[7],
        z: transformMatrix[11],
      };

      console.log('📊 [_saveTransformToBackend] UPDATE DATA:');
      console.log(`   entryPoint: [${updateData.entryPoint.x.toFixed(2)}, ${updateData.entryPoint.y.toFixed(2)}, ${updateData.entryPoint.z.toFixed(2)}]`);
      console.log(`   transformMatrix translation: [${transformMatrix[3].toFixed(2)}, ${transformMatrix[7].toFixed(2)}, ${transformMatrix[11].toFixed(2)}]`);

      // ⚠️ CRITICAL CHECK: In simplified logic, these MUST be equal
      const match = updateData.entryPoint.x === transformMatrix[3] &&
                    updateData.entryPoint.y === transformMatrix[7] &&
                    updateData.entryPoint.z === transformMatrix[11];
      console.log(`   ✅ They match (both are model origin): ${match}`);

      if (!match) {
        const diffX = updateData.entryPoint.x - transformMatrix[3];
        const diffY = updateData.entryPoint.y - transformMatrix[7];
        const diffZ = updateData.entryPoint.z - transformMatrix[11];
        const magnitude = Math.sqrt(diffX*diffX + diffY*diffY + diffZ*diffZ);
        console.error(`   ❌ CRITICAL ERROR: entryPoint != transformMatrix!`);
        console.error(`      Difference: [${diffX.toFixed(2)}, ${diffY.toFixed(2)}, ${diffZ.toFixed(2)}]`);
        console.error(`      Magnitude: ${magnitude.toFixed(2)}mm`);
        console.error(`      This should NEVER happen in simplified logic!`);
      }

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
      console.log('      updateData.transformMatrix:', JSON.stringify(updateData.transformMatrix).substring(0, 200));
      console.log('      updateData.entryPoint:', JSON.stringify(updateData.entryPoint));

      const result = await this.planningBackendService.updateScrew(modelId, this.sessionId, updateData);

      console.log('═══════════════════════════════════════════════════════');
      console.log('   📤 updateScrew RESPONSE:');
      console.log('      success:', result.success);
      if (result.screw) {
        console.log('      returned screw.entry_point:', result.screw.entry_point);
        console.log('      returned screw.transform_matrix (first 4):', result.screw.transform_matrix?.slice(0, 4));
        console.log('      returned screw.transform_matrix translation:',
          result.screw.transform_matrix ?
          `[${result.screw.transform_matrix[3]?.toFixed(2)}, ${result.screw.transform_matrix[7]?.toFixed(2)}, ${result.screw.transform_matrix[11]?.toFixed(2)}]` :
          'N/A');

        // Check if backend modified the data
        if (result.screw.transform_matrix) {
          const sentY = updateData.transformMatrix[7];
          const returnedY = result.screw.transform_matrix[7];
          if (Math.abs(sentY - returnedY) > 0.01) {
            console.error('   ❌ BACKEND MODIFIED transform_matrix!');
            console.error(`      Sent Y: ${sentY.toFixed(2)}`);
            console.error(`      Returned Y: ${returnedY.toFixed(2)}`);
            console.error(`      Difference: ${(returnedY - sentY).toFixed(2)}mm`);
          }
        }
      }
      console.log('═══════════════════════════════════════════════════════');

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
      const enabledElement = getEnabledElement(element);
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
      const enabledElement = getEnabledElement(element);
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
}

export default ScrewInteractionTool;
