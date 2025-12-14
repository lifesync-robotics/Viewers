import i18n from 'i18next';
import { id } from './id';
import { initToolGroups, toolbarButtons as basicToolbarButtons, cornerstone,
  ohif,
  dicomsr,
  dicomvideo,
  basicLayout,
  basicRoute,
  extensionDependencies as basicDependencies,
  mode as basicMode,
  modeInstance as basicModeInstance,
} from '@ohif/mode-basic';
import { HangingProtocol } from 'platform/core/src/types';
// import plannerToolbarButtons from './toolbarButtons';

export const tracked = {
  screwManagement: '@ohif/extension-lifesync.panelModule.screw-management',
  roiPanel: '@ohif/extension-lifesync.panelModule.roi-panel',
  viewport: '@ohif/extension-measurement-tracking.viewportModule.cornerstone-tracked',
  thumbnailList: '@ohif/extension-measurement-tracking.panelModule.seriesList',
  measurements: '@ohif/extension-measurement-tracking.panelModule.trackedMeasurements',
  viewportState: '@ohif/extension-cornerstone.panelModule.viewport-state',
};


export const extensionDependencies = {
  // Can derive the versions at least process.env.from npm_package_version
  ...basicDependencies,
  '@ohif/extension-measurement-tracking': '^3.0.0',
};

export const plannerInstance = {
  ...basicLayout,
  id: ohif.layout,
  props: {
    ...basicLayout.props,
    leftPanels: [tracked.thumbnailList],
    leftPanelClosed: false,
    rightPanels: [tracked.screwManagement, tracked.roiPanel],
    rightPanelClosed: false,
    viewports: [
      {
        namespace: tracked.viewport,
        // Re-use the display sets from basic
        displaySetsToDisplay: basicLayout.props.viewports[0].displaySetsToDisplay,
      },
      ...basicLayout.props.viewports,
      ],
    }
  };


export const plannerRoute =
    {
      ...basicRoute,
      path: 'planner',
        /*init: ({ servicesManager, extensionManager }) => {
          //defaultViewerRouteInit
        },*/
      layoutInstance: plannerInstance,
    };

/**
 * Planner-specific mode entry hook
 * Extends the basic mode's onModeEnter to activate Crosshairs tool
 * and add OrientationMarker tool (disabled by default, user can toggle)
 */
function plannerOnModeEnter(args) {
  const { commandsManager, servicesManager, extensionManager } = args;
  const { viewportGridService, toolbarService, toolGroupService } = servicesManager.services;

  // Call the base mode's onModeEnter first to initialize tool groups
  const baseOnModeEnter = basicModeInstance.onModeEnter;
  if (baseOnModeEnter) {
    try {
      baseOnModeEnter.call(this, args);
      console.log('✅ [Planner Mode] Base mode initialization complete');
    } catch (error) {
      console.error('❌ [Planner Mode] Error in base mode initialization:', error);
    }
  }

  // Add OrientationMarker tool to tool groups AFTER viewports are ready
  // This prevents the "Cannot read properties of undefined (reading 'getViewports')" error
  const addOrientationMarkerWhenReady = () => {
    try {
      const utilityModule = extensionManager.getModuleEntry(
        '@ohif/extension-cornerstone.utilityModule.tools'
      );

      if (!utilityModule?.exports?.toolNames) {
        console.warn('⚠️ [Planner Mode] Tool names not available');
        return;
      }

      const { toolNames } = utilityModule.exports;

      if (!toolNames.OrientationMarker) {
        console.warn('⚠️ [Planner Mode] OrientationMarker tool not found');
        return;
      }

      // Add to all tool groups - OrientationMarker supports both Stack (2D) and Volume (3D) viewports
      const toolGroupIds = ['default', 'mpr', 'SRToolGroup', 'volume3d'];
      const orientationMarkerConfig = {
        disabled: [{
          toolName: toolNames.OrientationMarker,
          configuration: {
            orientationWidget: {
              enabled: true,
              viewportCorner: 'BOTTOM_LEFT', // VTK.js Corners enum: 'BOTTOM_LEFT', 'BOTTOM_RIGHT', 'TOP_LEFT', 'TOP_RIGHT'
              viewportSize: 0.2,
              minPixelSize: 100,
              maxPixelSize: 150,
            },
            overlayMarkerType: 2, // 2 = AXIS style (arrows), 1 = CUBE style
          },
        }],
      };

      console.log('🔧 [Planner Mode] Adding OrientationMarker tool (AXIS style, disabled by default, Stack & Volume viewports)...');

      toolGroupIds.forEach(toolGroupId => {
        try {
          const toolGroup = toolGroupService.getToolGroup(toolGroupId);
          if (toolGroup && !toolGroup.hasTool(toolNames.OrientationMarker)) {
            toolGroupService.addToolsToToolGroup(toolGroupId, orientationMarkerConfig);
            console.log(`✅ [Planner Mode] OrientationMarker added to ${toolGroupId}`);
          }
        } catch (error) {
          console.warn(`⚠️ [Planner Mode] Could not add OrientationMarker to ${toolGroupId}:`, error.message);
        }
      });
    } catch (error) {
      console.warn('⚠️ [Planner Mode] Error adding OrientationMarker tool:', error);
    }
  };

  // // Register planner-specific toolbar buttons (disabled for now)
  // try {
  //   if (toolbarService && plannerToolbarButtons) {
  //     // Register the buttons first
  //     toolbarService.register(plannerToolbarButtons);
  //     console.log('✅ [Planner Mode] PlannerOrientationMarker toolbar button registered');
  //
  //     // Update MoreTools section to include our button
  //     toolbarService.updateSection('MoreTools', [
  //       'Reset',
  //       'rotate-right',
  //       'flipHorizontal',
  //       'ImageSliceSync',
  //       'ReferenceLines',
  //       'ImageOverlayViewer',
  //       'StackScroll',
  //       'invert',
  //       'Probe',
  //       'Cine',
  //       'Angle',
  //       'CobbAngle',
  //       'Magnify',
  //       'CalibrationLine',
  //       'TagBrowser',
  //       'AdvancedMagnify',
  //       'UltrasoundDirectionalTool',
  //       'WindowLevelRegion',
  //       'SegmentLabelTool',
  //       'PlannerOrientationMarker', // Our custom button (unique ID, no conflict!)
  //     ]);
  //     console.log('✅ [Planner Mode] PlannerOrientationMarker button added to MoreTools section');
  //   }
  // } catch (error) {
  //   console.error('❌ [Planner Mode] Failed to register toolbar buttons:', error);
  // }

  // Subscribe to VIEWPORTS_READY event to add tools and activate Crosshairs
  try {
    if (viewportGridService?.subscribe) {
      const { unsubscribe } = viewportGridService.subscribe(
        viewportGridService.EVENTS.VIEWPORTS_READY,
        () => {
          console.log('📋 [Planner Mode] VIEWPORTS_READY event received');

          setTimeout(() => {
            // First, add OrientationMarker tool (now that viewports/rendering engine exist)
            addOrientationMarkerWhenReady();

            // Then, activate Crosshairs tool
            try {
              const utilityModule = extensionManager.getModuleEntry(
                '@ohif/extension-cornerstone.utilityModule.tools'
              );

              if (utilityModule?.exports?.toolNames) {
                const { toolNames } = utilityModule.exports;

                if (toolNames.Crosshairs && commandsManager?.runCommand) {
                  commandsManager.runCommand('setToolActive', {
                    toolName: 'Crosshairs',
                    toolGroupId: 'mpr',
                  });
                  console.log('✅ [Planner Mode] Crosshairs tool activated');
                }
              }
            } catch (error) {
              console.warn('⚠️ [Planner Mode] Error activating Crosshairs:', error);
            }
          }, 100);

          try {
            unsubscribe();
          } catch (error) {
            console.warn('⚠️ [Planner Mode] Error unsubscribing:', error);
          }
        }
      );

      this._viewportReadySubscription = unsubscribe;
    }
  } catch (error) {
    console.error('❌ [Planner Mode] Failed to subscribe to viewport events:', error);
  }

  console.log('✅ [Planner Mode] Initialization complete - OrientationMarker will be added when viewports are ready');
}

/**
 * Planner mode exit hook
 */
function plannerOnModeExit(args) {
  console.log('🧹 [Planner Mode] Starting cleanup...');

  // Clean up viewport ready subscription
  if (this._viewportReadySubscription) {
    try {
      this._viewportReadySubscription();
      this._viewportReadySubscription = null;
    } catch (error) {
      console.warn('⚠️ [Planner Mode] Error cleaning up viewport subscription:', error);
    }
  }

  // Call base mode's onModeExit
  const baseOnModeExit = basicModeInstance.onModeExit;
  if (baseOnModeExit) {
    baseOnModeExit.call(this, args);
  }

  console.log('✅ [Planner Mode] Cleanup complete');
}

export const modeInstance = {
    ...basicModeInstance,
    // TODO: We're using this as a route segment
    // We should not be.
    id,
    routeName: 'planner',
    displayName: i18n.t('Modes:Surgical Planner'),
    routes: [
      plannerRoute
    ],
    hangingProtocol: 'fourUpMesh',
    extensions: extensionDependencies,
    onModeEnter: plannerOnModeEnter,
    onModeExit: plannerOnModeExit,
    _viewportReadySubscription: null,
  };

// Combine basic toolbar buttons with planner-specific buttons
// export const toolbarButtons = [
//   ...basicToolbarButtons,
//   ...plannerToolbarButtons,
// ];

const mode = {
  ...basicMode,
  id,
  modeInstance,
  extensionDependencies,
};

export default mode;
export { initToolGroups };
