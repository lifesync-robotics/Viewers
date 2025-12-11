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
import { getRenderingEngine } from '@cornerstonejs/core';
// import navigationToolbarButtons from './toolbarButtons';

export const tracked = {
  measurements: '@ohif/extension-measurement-tracking.panelModule.trackedMeasurements',
  thumbnailList: '@ohif/extension-measurement-tracking.panelModule.seriesList',
  viewport: '@ohif/extension-measurement-tracking.viewportModule.cornerstone-tracked',
  viewportState: '@ohif/extension-cornerstone.panelModule.viewport-state',
  screwManagement: '@ohif/extension-lifesync.panelModule.screw-list',
  trackingPanel: '@ohif/extension-lifesync.panelModule.trackingPanel',
  registrationPanel: '@ohif/extension-lifesync.panelModule.registration-panel',
};

export const extensionDependencies = {
  // Can derive the versions at least process.env.from npm_package_version
  ...basicDependencies,
  '@ohif/extension-measurement-tracking': '^3.0.0',
  '@ohif/extension-lifesync': '^3.12.0-beta.56',
};

// Global storage for viewport IDs (imageId/volumeId)
// Used to ensure consistent targetId format throughout the application
declare global {
  interface Window {
    __viewportIds?: {
      [viewportId: string]: string; // Maps viewport ID to its imageId or volumeId
    };
  }
}

export const navigationInstance = {
  ...basicLayout,
  id: ohif.layout,
  props: {
    ...basicLayout.props,
    leftPanels: [tracked.thumbnailList, tracked.screwManagement],
    leftPanelClosed: false,
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
 * Captures and stores viewport IDs (imageId or volumeId) globally
 * This ensures consistent targetId format throughout the application
 */
function captureViewportIds({ servicesManager }) {
  try {
    console.log('🔍 [Navigation Mode] Capturing viewport IDs...');
    
    // Initialize global storage
    if (!window.__viewportIds) {
      window.__viewportIds = {};
    }

    // Get viewports directly from the rendering engine
    const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
    
    if (!renderingEngine) {
      console.warn('⚠️ [Navigation Mode] No rendering engine found');
      return;
    }

    const viewports = renderingEngine.getViewports();
    console.log(`🔍 [Navigation Mode] Found ${viewports.length} viewports`);

    viewports.forEach((viewport) => {
      const viewportId = viewport.id;
      let targetId = null;

      // PRIORITY 1: For volume/MPR viewports, try getImageIds (most reliable for axial/coronal/sagittal)
      const imageIds = (viewport as any).getImageIds?.();
      if (imageIds && imageIds.length > 0) {
        const rawId = imageIds[0];
        targetId = rawId.startsWith('imageId:') || rawId.startsWith('volumeId:') 
          ? rawId 
          : `imageId:${rawId}`;
        console.log(`📐 [Navigation Mode] MPR viewport ${viewportId} -> ${targetId}`);
      }

      // PRIORITY 2: For stack viewports, get the current image ID
      if (!targetId && typeof (viewport as any).getCurrentImageId === 'function') {
        const imageId = (viewport as any).getCurrentImageId();
        if (imageId) {
          targetId = imageId.startsWith('imageId:') ? imageId : `imageId:${imageId}`;
          console.log(`📷 [Navigation Mode] Stack viewport ${viewportId} -> ${targetId}`);
        }
      }

      // PRIORITY 3: For volume viewports, get the volume ID
      if (!targetId && typeof (viewport as any).getVolumeIds === 'function') {
        const volumeIds = (viewport as any).getVolumeIds();
        if (volumeIds && volumeIds.length > 0) {
          const volumeId = volumeIds[0];
          targetId = volumeId.startsWith('volumeId:') ? volumeId : `volumeId:${volumeId}`;
          console.log(`🎬 [Navigation Mode] Volume viewport ${viewportId} -> ${targetId}`);
        }
      }

      if (targetId) {
        window.__viewportIds[viewportId] = targetId;
        console.log(`✅ [Navigation Mode] Stored viewport ID: ${viewportId} = ${targetId}`);
      } else {
        console.warn(`⚠️ [Navigation Mode] Could not capture ID for viewport: ${viewportId}`);
        console.warn(`   Viewport type: ${viewport.type}, hasImageIds: ${!!imageIds}, hasVolumeIds: ${!!(viewport as any).getVolumeIds?.()}`);
      }
    });

    console.log('✅ [Navigation Mode] Viewport IDs captured:', window.__viewportIds);
  } catch (error) {
    console.error('❌ [Navigation Mode] Error capturing viewport IDs:', error);
  }
}

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

  // // Register navigation-specific toolbar buttons (disabled for now)
  // try {
  //   if (toolbarService && navigationToolbarButtons) {
  //     // Register the buttons first
  //     toolbarService.register(navigationToolbarButtons);
  //     console.log('✅ [Navigation Mode] NavigationOrientationMarker toolbar button registered');
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
  //       'NavigationOrientationMarker', // Our custom button (unique ID, no conflict!)
  //     ]);
  //     console.log('✅ [Navigation Mode] NavigationOrientationMarker button added to MoreTools section');
  //   }
  // } catch (error) {
  //   console.error('❌ [Navigation Mode] Failed to register toolbar buttons:', error);
  // }

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

            // Capture viewport IDs after viewports are ready
            captureViewportIds({ servicesManager });
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
      path: 'navigation',
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
    routeName: 'navigation',
    displayName: i18n.t('Modes:Navigation'),
    routes: [
      navigationRoute
    ],
    hangingProtocol: 'mpr',
    extensions: extensionDependencies,
    onModeEnter: navigationOnModeEnter,
    onModeExit: navigationOnModeExit,
    _viewportReadySubscription: null,
  };

// Combine basic toolbar buttons with navigation-specific buttons
// const navigationToolbarButtonsCombined = [
//   ...toolbarButtons,
//   ...navigationToolbarButtons,
// ];

const mode = {
  ...basicMode,
  id,
  modeInstance,
  extensionDependencies,
};

export default mode;
// export { initToolGroups, navigationToolbarButtonsCombined as toolbarButtons };

