const colours = {
  'viewport-0': 'rgb(200, 0, 0)',
  'viewport-1': 'rgb(200, 200, 0)',
  'viewport-2': 'rgb(0, 200, 0)',
};

const colorsByOrientation = {
  axial: 'rgb(200, 0, 0)',
  sagittal: 'rgb(200, 200, 0)',
  coronal: 'rgb(0, 200, 0)',
};

function initDefaultToolGroup(extensionManager, toolGroupService, commandsManager, toolGroupId) {
  // DEFENSIVE PATTERN: Validate inputs
  if (!extensionManager || !toolGroupService || !commandsManager || !toolGroupId) {
    console.error('[initToolGroups] Missing required parameters for initDefaultToolGroup');
    return false;
  }

  try {
    const utilityModule = extensionManager.getModuleEntry(
      '@ohif/extension-cornerstone.utilityModule.tools'
    );

    // Guard: Check if utility module exists
    if (!utilityModule?.exports) {
      console.error('[initToolGroups] Cornerstone utility module not found');
      return false;
    }

    const { toolNames, Enums } = utilityModule.exports;

    // Guard: Validate required exports
    if (!toolNames || !Enums) {
      console.error('[initToolGroups] Tool names or Enums not available in utility module');
      return false;
    }

    const tools = {
      active: [
        {
          toolName: toolNames.WindowLevel,
          bindings: [{ mouseButton: Enums.MouseBindings.Primary }],
        },
        {
          toolName: toolNames.Pan,
          bindings: [{ mouseButton: Enums.MouseBindings.Auxiliary }],
        },
        {
          toolName: toolNames.Zoom,
          bindings: [{ mouseButton: Enums.MouseBindings.Secondary }, { numTouchPoints: 2 }],
        },
        {
          toolName: toolNames.StackScroll,
          bindings: [{ mouseButton: Enums.MouseBindings.Wheel }, { numTouchPoints: 3 }],
        },
      ],
      passive: [
        { toolName: toolNames.Length },
        {
          toolName: toolNames.ArrowAnnotate,
          configuration: {
            getTextCallback: (callback, eventDetails) => {
              commandsManager.runCommand('arrowTextCallback', {
                callback,
                eventDetails,
              });
            },
            changeTextCallback: (data, eventDetails, callback) => {
              commandsManager.runCommand('arrowTextCallback', {
                callback,
                data,
                eventDetails,
              });
            },
          },
        },
        {
          toolName: toolNames.SegmentBidirectional,
        },
        { toolName: toolNames.Bidirectional },
        { toolName: toolNames.DragProbe },
        { toolName: toolNames.Probe },
        { toolName: toolNames.FiducialMarker },
        { toolName: toolNames.EllipticalROI },
        { toolName: toolNames.CircleROI },
        { toolName: toolNames.RectangleROI },
        { toolName: toolNames.StackScroll },
        { toolName: toolNames.Angle },
        { toolName: toolNames.CobbAngle },
        { toolName: toolNames.Magnify },
        { toolName: toolNames.CalibrationLine },
        {
          toolName: toolNames.PlanarFreehandContourSegmentation,
          configuration: {
            displayOnePointAsCrosshairs: true,
          },
        },
        { toolName: toolNames.UltrasoundDirectional },
        { toolName: toolNames.PlanarFreehandROI },
        { toolName: toolNames.SplineROI },
        { toolName: toolNames.LivewireContour },
        { toolName: toolNames.WindowLevelRegion },
      ],
      enabled: [
        { toolName: toolNames.ImageOverlayViewer },
        { toolName: toolNames.ReferenceLines },
      ],
      disabled: [
        {
          toolName: toolNames.AdvancedMagnify,
        },
      ],
    };

    // DEFENSIVE PATTERN: Safe command execution
    let updatedTools = tools;
    try {
      if (commandsManager?.run) {
        updatedTools = commandsManager.run('initializeSegmentLabelTool', { tools });
      }
    } catch (error) {
      console.warn('[initToolGroups] Error running initializeSegmentLabelTool command:', error);
      // Continue with original tools if command fails
    }

    // DEFENSIVE PATTERN: Safe tool group creation
    if (!toolGroupService?.createToolGroupAndAddTools) {
      console.error('[initToolGroups] createToolGroupAndAddTools method not available');
      return false;
    }

    toolGroupService.createToolGroupAndAddTools(toolGroupId, updatedTools);
    console.log(`✅ [initToolGroups] Successfully initialized ${toolGroupId} tool group`);
    return true;

  } catch (error) {
    console.error(`[initToolGroups] Error initializing ${toolGroupId} tool group:`, error);
    return false;
  }
}

function initSRToolGroup(extensionManager, toolGroupService) {
  // DEFENSIVE PATTERN: Validate inputs
  if (!extensionManager || !toolGroupService) {
    console.error('[initToolGroups] Missing required parameters for initSRToolGroup');
    return false;
  }

  try {
    const SRUtilityModule = extensionManager.getModuleEntry(
      '@ohif/extension-cornerstone-dicom-sr.utilityModule.tools'
    );

    // Guard: SR extension is optional, return gracefully if not available
    if (!SRUtilityModule?.exports) {
      console.debug('[initToolGroups] SR utility module not available (optional)');
      return false;
    }

    const CS3DUtilityModule = extensionManager.getModuleEntry(
      '@ohif/extension-cornerstone.utilityModule.tools'
    );

    // Guard: Check cornerstone utility module
    if (!CS3DUtilityModule?.exports) {
      console.error('[initToolGroups] Cornerstone utility module not found for SR tool group');
      return false;
    }

    const { toolNames: SRToolNames } = SRUtilityModule.exports;
    const { toolNames, Enums } = CS3DUtilityModule.exports;

    // Guard: Validate exports
    if (!SRToolNames || !toolNames || !Enums) {
      console.error('[initToolGroups] Required tool names or Enums not available for SR tool group');
      return false;
    }
    const tools = {
      active: [
        {
          toolName: toolNames.WindowLevel,
          bindings: [
            {
              mouseButton: Enums.MouseBindings.Primary,
            },
          ],
        },
        {
          toolName: toolNames.Pan,
          bindings: [
            {
              mouseButton: Enums.MouseBindings.Auxiliary,
            },
          ],
        },
        {
          toolName: toolNames.Zoom,
          bindings: [
            {
              mouseButton: Enums.MouseBindings.Secondary,
            },
            { numTouchPoints: 2 },
          ],
        },
        {
          toolName: toolNames.StackScroll,
          bindings: [{ mouseButton: Enums.MouseBindings.Wheel }, { numTouchPoints: 3 }],
        },
      ],
      passive: [
        { toolName: SRToolNames.SRLength },
        { toolName: SRToolNames.SRArrowAnnotate },
        { toolName: SRToolNames.SRBidirectional },
        { toolName: SRToolNames.SREllipticalROI },
        { toolName: SRToolNames.SRCircleROI },
        { toolName: SRToolNames.SRPlanarFreehandROI },
        { toolName: SRToolNames.SRRectangleROI },
        { toolName: toolNames.WindowLevelRegion },
      ],
      enabled: [
        {
          toolName: SRToolNames.DICOMSRDisplay,
        },
      ],
      // disabled
    };

    const toolGroupId = 'SRToolGroup';

    // DEFENSIVE PATTERN: Safe tool group creation
    if (!toolGroupService?.createToolGroupAndAddTools) {
      console.error('[initToolGroups] createToolGroupAndAddTools method not available for SR');
      return false;
    }

    toolGroupService.createToolGroupAndAddTools(toolGroupId, tools);
    console.log(`✅ [initToolGroups] Successfully initialized ${toolGroupId}`);
    return true;

  } catch (error) {
    console.error('[initToolGroups] Error initializing SR tool group:', error);
    return false;
  }
}

function initMPRToolGroup(extensionManager, toolGroupService, commandsManager) {
  // DEFENSIVE PATTERN: Validate inputs
  if (!extensionManager || !toolGroupService || !commandsManager) {
    console.error('[initToolGroups] Missing required parameters for initMPRToolGroup');
    return false;
  }

  try {
    const utilityModule = extensionManager.getModuleEntry(
      '@ohif/extension-cornerstone.utilityModule.tools'
    );

    // Guard: Check utility module exists
    if (!utilityModule?.exports) {
      console.error('[initToolGroups] Cornerstone utility module not found for MPR');
      return false;
    }

    // Guard: Check service manager exists
    const serviceManager = extensionManager._servicesManager;
    if (!serviceManager?.services) {
      console.error('[initToolGroups] Service manager not available for MPR');
      return false;
    }

    const { cornerstoneViewportService } = serviceManager.services;
    
    // Guard: Check viewport service exists
    if (!cornerstoneViewportService) {
      console.error('[initToolGroups] Cornerstone viewport service not available for MPR');
      return false;
    }

    const { toolNames, Enums } = utilityModule.exports;

    // Guard: Validate exports
    if (!toolNames || !Enums) {
      console.error('[initToolGroups] Tool names or Enums not available for MPR tool group');
      return false;
    }

    const tools = {
      active: [
        {
          toolName: toolNames.WindowLevel,
          bindings: [{ mouseButton: Enums.MouseBindings.Primary }],
        },
        {
          toolName: toolNames.Pan,
          bindings: [{ mouseButton: Enums.MouseBindings.Auxiliary }],
        },
        {
          toolName: toolNames.Zoom,
          bindings: [{ mouseButton: Enums.MouseBindings.Secondary }, { numTouchPoints: 2 }],
        },
        {
          toolName: toolNames.StackScroll,
          bindings: [{ mouseButton: Enums.MouseBindings.Wheel }, { numTouchPoints: 3 }],
        },
      ],
      passive: [
        { toolName: toolNames.Length },
        {
          toolName: toolNames.ArrowAnnotate,
          configuration: {
            getTextCallback: (callback, eventDetails) => {
              commandsManager.runCommand('arrowTextCallback', {
                callback,
                eventDetails,
              });
            },
            changeTextCallback: (data, eventDetails, callback) => {
              commandsManager.runCommand('arrowTextCallback', {
                callback,
                data,
                eventDetails,
              });
            },
          },
        },
        { toolName: toolNames.Bidirectional },
        { toolName: toolNames.DragProbe },
        { toolName: toolNames.Probe },
        { toolName: toolNames.FiducialMarker },
        { toolName: toolNames.EllipticalROI },
        { toolName: toolNames.CircleROI },
        { toolName: toolNames.RectangleROI },
        { toolName: toolNames.StackScroll },
        { toolName: toolNames.Angle },
        { toolName: toolNames.CobbAngle },
        { toolName: toolNames.PlanarFreehandROI },
        { toolName: toolNames.SplineROI },
        { toolName: toolNames.LivewireContour },
        { toolName: toolNames.WindowLevelRegion },
        {
          toolName: toolNames.PlanarFreehandContourSegmentation,
          configuration: {
            displayOnePointAsCrosshairs: true,
          },
          // ✨ Increased crosshair line width to 3x (from ~1.5px to 4.5px)
          getReferenceLineWidth: () => 4.5,
          getReferenceLineDashed: () => false,
        },
      ],
      disabled: [
        {
          toolName: toolNames.Crosshairs,
          configuration: {
            viewportIndicators: true,
            viewportIndicatorsConfig: {
              circleRadius: 5,
              xOffset: 0.95,
              yOffset: 0.05,
            },
            disableOnPassive: true,
            autoPan: {
              enabled: false,
              panSize: 10,
            },
            getReferenceLineColor: viewportId => {
              // DEFENSIVE PATTERN: Safe viewport info retrieval
              try {
                const viewportInfo = cornerstoneViewportService.getViewportInfo(viewportId);
                const viewportOptions = viewportInfo?.viewportOptions;
                if (viewportOptions) {
                  return (
                    colours[viewportOptions.id] ||
                    colorsByOrientation[viewportOptions.orientation] ||
                    '#0c0'
                  );
                } else {
                  console.debug('[initToolGroups] Missing viewport options for', viewportId);
                  return '#0c0';
                }
              } catch (error) {
                console.warn('[initToolGroups] Error getting reference line color:', error);
                return '#0c0';
              }
            },
          },
        },
        {
          toolName: toolNames.AdvancedMagnify,
        },
        { toolName: toolNames.ReferenceLines },
      ],
    };

    // DEFENSIVE PATTERN: Safe tool group creation
    if (!toolGroupService?.createToolGroupAndAddTools) {
      console.error('[initToolGroups] createToolGroupAndAddTools method not available for MPR');
      return false;
    }

    toolGroupService.createToolGroupAndAddTools('mpr', tools);
    console.log('✅ [initToolGroups] Successfully initialized mpr tool group');
    return true;

  } catch (error) {
    console.error('[initToolGroups] Error initializing MPR tool group:', error);
    return false;
  }
}
function initVolume3DToolGroup(extensionManager, toolGroupService) {
  // DEFENSIVE PATTERN: Validate inputs
  if (!extensionManager || !toolGroupService) {
    console.error('[initToolGroups] Missing required parameters for initVolume3DToolGroup');
    return false;
  }

  try {
    const utilityModule = extensionManager.getModuleEntry(
      '@ohif/extension-cornerstone.utilityModule.tools'
    );

    // Guard: Check utility module exists
    if (!utilityModule?.exports) {
      console.error('[initToolGroups] Cornerstone utility module not found for Volume3D');
      return false;
    }

    const { toolNames, Enums } = utilityModule.exports;

    // Guard: Validate exports
    if (!toolNames || !Enums) {
      console.error('[initToolGroups] Tool names or Enums not available for Volume3D tool group');
      return false;
    }

    const tools = {
      active: [
        {
          toolName: toolNames.TrackballRotateTool,
          bindings: [{ mouseButton: Enums.MouseBindings.Primary }],
        },
        {
          toolName: toolNames.Zoom,
          bindings: [{ mouseButton: Enums.MouseBindings.Secondary }, { numTouchPoints: 2 }],
        },
        {
          toolName: toolNames.Pan,
          bindings: [{ mouseButton: Enums.MouseBindings.Auxiliary }, { numTouchPoints: 3 }],
        },
      ],
    };

    // DEFENSIVE PATTERN: Safe tool group creation
    if (!toolGroupService?.createToolGroupAndAddTools) {
      console.error('[initToolGroups] createToolGroupAndAddTools method not available for Volume3D');
      return false;
    }

    toolGroupService.createToolGroupAndAddTools('volume3d', tools);
    console.log('✅ [initToolGroups] Successfully initialized volume3d tool group');
    return true;

  } catch (error) {
    console.error('[initToolGroups] Error initializing Volume3D tool group:', error);
    return false;
  }
}

/**
 * Initialize all tool groups with defensive programming patterns
 * Returns summary of successful/failed initializations
 */
function initToolGroups(extensionManager, toolGroupService, commandsManager) {
  // DEFENSIVE PATTERN: Validate required parameters
  if (!extensionManager || !toolGroupService || !commandsManager) {
    console.error('[initToolGroups] Missing required parameters - cannot initialize tool groups');
    return {
      success: false,
      initialized: [],
      failed: ['all'],
      error: 'Missing required parameters',
    };
  }

  console.log('🔧 [initToolGroups] Starting tool group initialization with defensive checks...');

  const results = {
    success: true,
    initialized: [],
    failed: [],
  };

  // Initialize each tool group with error tracking
  try {
    if (initDefaultToolGroup(extensionManager, toolGroupService, commandsManager, 'default')) {
      results.initialized.push('default');
    } else {
      results.failed.push('default');
      results.success = false;
    }
  } catch (error) {
    console.error('[initToolGroups] Unexpected error initializing default tool group:', error);
    results.failed.push('default');
    results.success = false;
  }

  try {
    if (initSRToolGroup(extensionManager, toolGroupService)) {
      results.initialized.push('SRToolGroup');
    } else {
      // SR is optional, so don't mark as overall failure
      console.debug('[initToolGroups] SR tool group not initialized (optional)');
    }
  } catch (error) {
    console.error('[initToolGroups] Unexpected error initializing SR tool group:', error);
    // SR is optional, continue
  }

  try {
    if (initMPRToolGroup(extensionManager, toolGroupService, commandsManager)) {
      results.initialized.push('mpr');
    } else {
      results.failed.push('mpr');
      results.success = false;
    }
  } catch (error) {
    console.error('[initToolGroups] Unexpected error initializing MPR tool group:', error);
    results.failed.push('mpr');
    results.success = false;
  }

  try {
    if (initVolume3DToolGroup(extensionManager, toolGroupService)) {
      results.initialized.push('volume3d');
    } else {
      results.failed.push('volume3d');
      results.success = false;
    }
  } catch (error) {
    console.error('[initToolGroups] Unexpected error initializing Volume3D tool group:', error);
    results.failed.push('volume3d');
    results.success = false;
  }

  // Log summary
  console.log('🎉 [initToolGroups] Initialization complete:');
  console.log(`   ✅ Successful: ${results.initialized.join(', ') || 'none'}`);
  if (results.failed.length > 0) {
    console.log(`   ❌ Failed: ${results.failed.join(', ')}`);
  }

  return results;
}

export default initToolGroups;
