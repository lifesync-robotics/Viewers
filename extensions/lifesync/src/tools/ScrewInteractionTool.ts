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

const { MouseBindings } = csToolsEnums;

/**
 * Interaction state for screw manipulation
 */
interface ScrewInteractionState {
  selectedScrewId: string | null;
  selectedScrewLabel: string | null;
  selectedPart: 'cap' | 'body' | 'tip' | null;
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
    this.modelStateService = servicesManager?.services?.modelStateService;
    this.planningBackendService = servicesManager?.services?.planningBackendService;

    if (this.modelStateService) {
      this._log('✅ ModelStateService connected');
    } else {
      console.warn('⚠️ [ScrewInteractionTool] ModelStateService not available');
    }
  }

  private _getInitialState(): ScrewInteractionState {
    return {
      selectedScrewId: null,
      selectedScrewLabel: null,
      selectedPart: null,
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
    console.log('🎯 CHECK INSIDE A SCREW - DRAG ENABLED');
    console.log(`   Screw: ${pickResult.screwLabel}`);
    console.log(`   Part: ${pickResult.part}`);
    console.log('═══════════════════════════════════════════════════════');

    // Found a screw - start interaction
    this._log(`✅ Selected screw: ${pickResult.screwLabel} (${pickResult.part})`);

    // Get viewport plane normal for constraining movement
    const planeNormal = this._getViewportPlaneNormal(element);

    // Store original transform for potential undo
    const originalTransform = this.modelStateService.getScrewTransform(pickResult.modelId);

    // Update state
    this.state = {
      selectedScrewId: pickResult.modelId,
      selectedScrewLabel: pickResult.screwLabel,
      selectedPart: pickResult.part,
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

    // Translate the screw
    if (this.modelStateService.translateScrew) {
      this.modelStateService.translateScrew(this.state.selectedScrewId, constrainedDelta);
    }
  };

  /**
   * Called on mouse up - required by BaseTool
   */
  mouseUpCallback = (evt: any): void => {
    if (!this.state.isDragging || !this.state.selectedScrewId) {
      return;
    }

    this._log(`Drag completed for screw: ${this.state.selectedScrewLabel}`);

    // Remove highlight
    this._highlightScrew(this.state.selectedScrewId, false);

    // Reset state
    this.state = this._getInitialState();
  };

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
