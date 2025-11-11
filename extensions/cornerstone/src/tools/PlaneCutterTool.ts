import { BaseTool } from '@cornerstonejs/tools';
import { Types as OHIFTypes } from '@ohif/core';

/**
 * PlaneCutterTool
 *
 * A tool that manages 2D plane cutters for 3D models in orthographic viewports.
 * When active, plane cutters are enabled and visible.
 * When disabled, plane cutters are hidden.
 *
 * This tool acts as a wrapper around PlaneCutterService, providing
 * standard Cornerstone tool integration.
 */
class PlaneCutterTool extends BaseTool {
  static toolName = 'PlaneCutter';

  private planeCutterService: any;

  constructor(
    toolProps = {},
    defaultToolProps = {
      supportedInteractionTypes: [], // Non-interactive tool
      configuration: {},
    }
  ) {
    super(toolProps, defaultToolProps);
  }

  /**
   * Set the services manager to access PlaneCutterService
   * This should be called during tool initialization
   */
  public setServicesManager(servicesManager: any): void {
    this.planeCutterService = servicesManager?.services?.planeCutterService;

    if (!this.planeCutterService) {
      console.warn('⚠️ [PlaneCutterTool] PlaneCutterService not available');
    }
  }

  /**
   * Called when tool is set to Active state
   */
  onSetToolActive(): void {
    console.log('🟢 [PlaneCutterTool] Tool activated - enabling plane cutters');

    if (this.planeCutterService) {
      this.planeCutterService.enable();
    } else {
      console.error('❌ [PlaneCutterTool] PlaneCutterService not available');
    }
  }

  /**
   * Called when tool is set to Passive state (not used for this tool)
   */
  onSetToolPassive(): void {
    console.log('🟡 [PlaneCutterTool] Tool set to passive');
    // Plane cutters remain enabled but tool is not primary
  }

  /**
   * Called when tool is set to Disabled state
   */
  onSetToolDisabled(): void {
    console.log('🔴 [PlaneCutterTool] Tool disabled - disabling plane cutters');

    if (this.planeCutterService) {
      this.planeCutterService.disable();
    }
  }

  /**
   * Called when tool is set to Enabled state
   */
  onSetToolEnabled(): void {
    console.log('🟢 [PlaneCutterTool] Tool enabled');
    // Tool is available but not necessarily active
  }
}

export default PlaneCutterTool;
