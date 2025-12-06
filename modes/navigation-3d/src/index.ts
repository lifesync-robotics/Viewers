import i18n from 'i18next';
import { id } from './id';
import { initToolGroups, toolbarButtons, cornerstone,
  ohif,
  dicomsr,
  dicomvideo,
  basicLayout,
  basicRoute,
  extensionDependencies as basicDependencies,
  mode as basicMode,
  modeInstance as basicModeInstance,
} from '@ohif/mode-basic';
import navigationToolbarButtons from './toolbarButtons';

export const tracked = {
  measurements: '@ohif/extension-measurement-tracking.panelModule.trackedMeasurements',
  thumbnailList: '@ohif/extension-measurement-tracking.panelModule.seriesList',
  viewport: '@ohif/extension-measurement-tracking.viewportModule.cornerstone-tracked',
  viewportState: '@ohif/extension-cornerstone.panelModule.viewport-state',
  // screwManagement: '@ohif/extension-lifesync.panelModule.screw-management',
  trackingPanel: '@ohif/extension-lifesync.panelModule.trackingPanel',
  registrationPanel: '@ohif/extension-lifesync.panelModule.registration-panel',
};

export const extensionDependencies = {
  // Can derive the versions at least process.env.from npm_package_version
  ...basicDependencies,
  '@ohif/extension-measurement-tracking': '^3.0.0',
  '@ohif/extension-lifesync': '^3.12.0-beta.56',
};

export const navigationInstance = {
  ...basicLayout,
  id: ohif.layout,
  props: {
    ...basicLayout.props,
    leftPanels: [tracked.thumbnailList],
    leftPanelClosed: true,
    rightPanels: [tracked.trackingPanel,  cornerstone.segmentation, tracked.measurements],
    rightPanelClosed: false,
    viewports: [
      {
        namespace: tracked.viewport,
        // Re-use the display sets from basic
        displaySetsToDisplay: basicLayout.props.viewports[0].displaySetsToDisplay,
      },
      ...basicLayout.props.viewports,
    ],
  },
};

/**
 * Navigation mode entry hook
 * Extends the basic mode's onModeEnter to activate Crosshairs tool
 * and add OrientationMarker tool (disabled by default, user can toggle)
 */
function navigationOnModeEnter(args) {
  const { commandsManager, servicesManager, extensionManager } = args;
  const { viewportGridService, toolbarService, toolGroupService } = servicesManager.services;

  // Call the base mode's onModeEnter first to initialize tool groups
  const baseOnModeEnter = basicModeInstance.onModeEnter;
  if (baseOnModeEnter) {
    try {
      baseOnModeEnter.call(this, args);
      console.log('✅ [Navigation Mode] Base mode initialization complete');
    } catch (error) {
      console.error('❌ [Navigation Mode] Error in base mode initialization:', error);
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
        console.warn('⚠️ [Navigation Mode] Tool names not available');
        return;
      }
      
      const { toolNames } = utilityModule.exports;
      
      if (!toolNames.OrientationMarker) {
        console.warn('⚠️ [Navigation Mode] OrientationMarker tool not found');
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
      
      console.log('🔧 [Navigation Mode] Adding OrientationMarker tool (AXIS style, disabled by default, Stack & Volume viewports)...');

      toolGroupIds.forEach(toolGroupId => {
        try {
          const toolGroup = toolGroupService.getToolGroup(toolGroupId);
          if (toolGroup && !toolGroup.hasTool(toolNames.OrientationMarker)) {
            toolGroupService.addToolsToToolGroup(toolGroupId, orientationMarkerConfig);
            console.log(`✅ [Navigation Mode] OrientationMarker added to ${toolGroupId}`);
          }
        } catch (error) {
          console.warn(`⚠️ [Navigation Mode] Could not add OrientationMarker to ${toolGroupId}:`, error.message);
        }
      });
    } catch (error) {
      console.warn('⚠️ [Navigation Mode] Error adding OrientationMarker tool:', error);
    }
  };

  // Register navigation-specific toolbar buttons
  try {
    if (toolbarService && navigationToolbarButtons) {
      // Register the buttons first
      toolbarService.register(navigationToolbarButtons);
      console.log('✅ [Navigation Mode] NavigationOrientationMarker toolbar button registered');
      
      // Update MoreTools section to include our button
      toolbarService.updateSection('MoreTools', [
        'Reset',
        'rotate-right',
        'flipHorizontal',
        'ImageSliceSync',
        'ReferenceLines',
        'ImageOverlayViewer',
        'StackScroll',
        'invert',
        'Probe',
        'Cine',
        'Angle',
        'CobbAngle',
        'Magnify',
        'CalibrationLine',
        'TagBrowser',
        'AdvancedMagnify',
        'UltrasoundDirectionalTool',
        'WindowLevelRegion',
        'SegmentLabelTool',
        'NavigationOrientationMarker', // Our custom button (unique ID, no conflict!)
      ]);
      console.log('✅ [Navigation Mode] NavigationOrientationMarker button added to MoreTools section');
    }
  } catch (error) {
    console.error('❌ [Navigation Mode] Failed to register toolbar buttons:', error);
  }

  // Subscribe to VIEWPORTS_READY event to add tools and activate Crosshairs
  try {
    if (viewportGridService?.subscribe) {
      const { unsubscribe } = viewportGridService.subscribe(
        viewportGridService.EVENTS.VIEWPORTS_READY,
        () => {
          console.log('📋 [Navigation Mode] VIEWPORTS_READY event received');

          setTimeout(() => {
            // First, add OrientationMarker tool (now that viewports/rendering engine exist)
            addOrientationMarkerWhenReady();

            // Apply volume rendering performance optimizations for 3D viewports
            try {
              const viewports = viewportGridService.getViewports();
              viewports.forEach(viewport => {
                if (viewport.viewportOptions?.viewportType === 'volume3d' ||
                    viewport.viewportOptions?.viewportType === 'volume') {
                  console.log(`🔧 [Navigation Mode] Applying volume rendering optimizations to viewport: ${viewport.viewportId}`);

                  // Reduce image sample distance for better performance (fewer rays per pixel)
                  commandsManager.runCommand('setVolumeRenderingImageSampleDistance', {
                    viewportId: viewport.viewportId,
                    imageSampleDistance: 1.5, // Cast rays every 1.5 pixels instead of every pixel
                  });

                  // Enable interaction quality reduction (lower quality during dragging/rotating)
                  commandsManager.runCommand('setVolumeRenderingInteractionSampleDistance', {
                    viewportId: viewport.viewportId,
                    initialScale: 2.0,      // Reduce quality when interaction starts
                    interactionFactor: 2.0, // Double sample distance during interaction
                  });

                  // Set lower default quality for real-time tracking performance
                  commandsManager.runCommand('setVolumeRenderingQulaity', {
                    viewportId: viewport.viewportId,
                    volumeQuality: 2, // Lower quality for better performance
                  });
                }
              });
            } catch (error) {
              console.warn('⚠️ [Navigation Mode] Error applying volume rendering optimizations:', error);
            }

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
                  console.log('✅ [Navigation Mode] Crosshairs tool activated');
                }
              }
            } catch (error) {
              console.warn('⚠️ [Navigation Mode] Error activating Crosshairs:', error);
            }
          }, 100);

          try {
            unsubscribe();
          } catch (error) {
            console.warn('⚠️ [Navigation Mode] Error unsubscribing:', error);
          }
        }
      );

      this._viewportReadySubscription = unsubscribe;
    }
  } catch (error) {
    console.error('❌ [Navigation Mode] Failed to subscribe to viewport events:', error);
  }

  console.log('✅ [Navigation Mode] Initialization complete - OrientationMarker will be added when viewports are ready');
}

/**
 * Navigation mode exit hook
 */
function navigationOnModeExit(args) {
  console.log('🧹 [Navigation Mode] Starting cleanup...');

  // Clean up viewport ready subscription
  if (this._viewportReadySubscription) {
    try {
      this._viewportReadySubscription();
      this._viewportReadySubscription = null;
    } catch (error) {
      console.warn('⚠️ [Navigation Mode] Error cleaning up viewport subscription:', error);
    }
  }

  // Call base mode's onModeExit
  const baseOnModeExit = basicModeInstance.onModeExit;
  if (baseOnModeExit) {
    baseOnModeExit.call(this, args);
  }

  console.log('✅ [Navigation Mode] Cleanup complete');
}

export const navigationRoute =
    {
      ...basicRoute,
      path: 'navigation-3d',
        /*init: ({ servicesManager, extensionManager }) => {
          //defaultViewerRouteInit
        },*/
      layoutInstance: navigationInstance,
    };

export const modeInstance = {
    ...basicModeInstance,
    // TODO: We're using this as a route segment
    // We should not be.
    id,
    routeName: 'navigation-3d',
    displayName: i18n.t('Modes:Navigation 3D'),
    routes: [
      navigationRoute
    ],
    hangingProtocol: 'fourUpMesh',
    extensions: extensionDependencies,
    onModeEnter: navigationOnModeEnter,
    onModeExit: navigationOnModeExit,
    _viewportReadySubscription: null,
  };

// Combine basic toolbar buttons with navigation-specific buttons
const navigationToolbarButtonsCombined = [
  ...toolbarButtons,
  ...navigationToolbarButtons,
];

const mode = {
  ...basicMode,
  id,
  modeInstance,
  extensionDependencies,
};

export default mode;
export { initToolGroups, navigationToolbarButtonsCombined as toolbarButtons };

