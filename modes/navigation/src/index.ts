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
 */
function navigationOnModeEnter(args) {
  const { commandsManager, servicesManager, extensionManager } = args;
  const { viewportGridService, toolbarService, toolGroupService, surgicalWorkflowService } = servicesManager.services;

  console.log('🚀 [Navigation Mode] onModeEnter - Navigation stage');

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

  // Workflow integration
  // NOTE: We DON'T set the stage here - workflow navigation already handles that!
  // Modes should only READ the current stage, never SET it
  if (surgicalWorkflowService) {
    try {
      const currentStage = surgicalWorkflowService.getCurrentStage();
      console.log(`✅ [Navigation Mode] Current workflow stage: ${currentStage}`);

      // Load navigation reference from workflow if available
      const navigationData = surgicalWorkflowService.getStageData(currentStage);
      if (navigationData && navigationData.sessionId) {
        console.log('📂 [Navigation Mode] Navigation reference found:', {
          sessionId: navigationData.sessionId,
          trackingData: navigationData.trackingData,
        });
        // Note: Fetch actual navigation data from backend if needed
        // await fetchNavigationDataFromBackend(navigationData.sessionId);
      }

      // Check dependencies: Get all stages and check if prerequisites are completed
      const allStages = surgicalWorkflowService.getState().stages;
      for (const [stageId, stageData] of Object.entries(allStages)) {
        const data = stageData as any;
        if (stageId !== currentStage && data.completed) {
          console.log(`✅ [Navigation Mode] Prerequisite stage completed: ${stageId}`);
        } else if (stageId !== currentStage && !data.completed) {
          console.warn(`⚠️ [Navigation Mode] Prerequisite stage not completed: ${stageId}`);
        }
      }
    } catch (error) {
      console.error('❌ [Navigation Mode] Error reading workflow stage:', error);
    }
  } else {
    console.warn('⚠️ [Navigation Mode] WorkflowService not available');
  }

  // Toolbar buttons removed - OrientationMarker causes errors before volume is ready

  // Subscribe to VIEWPORTS_READY event to add tools and activate Crosshairs
  try {
    if (viewportGridService?.subscribe) {
      const { unsubscribe } = viewportGridService.subscribe(
        viewportGridService.EVENTS.VIEWPORTS_READY,
        () => {
          console.log('📋 [Navigation Mode] VIEWPORTS_READY event received');
          
          setTimeout(() => {
            // Activate Crosshairs tool
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

  console.log('✅ [Navigation Mode] Initialization complete');
}

/**
 * Navigation mode exit hook
 */
function navigationOnModeExit(args) {
  console.log('🧹 [Navigation Mode] Starting cleanup...');

  const { servicesManager } = args;
  const { surgicalWorkflowService } = servicesManager.services;

  // Save navigation reference to workflow (backend stores actual navigation data)
  // NOTE: Do NOT set 'completed' here - workflow handles completion status
  if (surgicalWorkflowService) {
    try {
      // Get navigation reference (e.g., from backend after save)
      const sessionId = sessionStorage.getItem('ohif_session_id') || null;
      const trackingData = sessionStorage.getItem('navigation_tracking_data') || null;
      
      // Get current stage from workflow service - NO HARDCODING!
      const currentStage = surgicalWorkflowService.getCurrentStage();
      const currentStageData = surgicalWorkflowService.getStageData(currentStage);
      
      surgicalWorkflowService.updateStageData(currentStage, {
        // Preserve existing completed status (set by workflow advancement)
        completed: currentStageData.completed,
        sessionId: sessionId,
        trackingData: trackingData,
        timestamp: Date.now(),
      });

      console.log(`✅ [Navigation Mode] Navigation reference saved for ${currentStage}:`, {
        sessionId,
        completed: currentStageData.completed,
      });
    } catch (error) {
      console.error('❌ [Navigation Mode] Error saving workflow reference:', error);
    }
  }

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

