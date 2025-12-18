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
import { Enums as cstSegmentationEnums } from '@cornerstonejs/tools';
import plannerToolbarButtons from './toolbarButtons';

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
 * Helper function to restore segmentations from segmentation mode
 */
async function restoreSegmentationsFromSegmentationMode(servicesManager, commandsManager) {
  try {
    const segmentationStateJson = sessionStorage.getItem('segmentationStateFromSegmentation');
    if (!segmentationStateJson) {
      console.log('ℹ️ [Planner Mode] No segmentation state found from segmentation mode');
      return;
    }

    const segmentationState = JSON.parse(segmentationStateJson);
    console.log('📊 [Planner Mode] Found segmentation state from segmentation mode:', segmentationState);

    // Check if the state is recent (within last 5 minutes)
    const now = Date.now();
    const stateAge = now - (segmentationState.timestamp || 0);
    if (stateAge > 5 * 60 * 1000) { // 5 minutes
      console.log('⚠️ [Planner Mode] Segmentation state is too old, ignoring');
      sessionStorage.removeItem('segmentationStateFromSegmentation');
      return;
    }

    // Wait for viewports to be ready, then load segmentations
    const { viewportGridService } = servicesManager.services;
    if (viewportGridService?.subscribe) {
      const unsubscribe = viewportGridService.subscribe(
        viewportGridService.constructor.EVENTS.VIEWPORTS_READY,
        async () => {
          console.log('🎯 [Planner Mode] Viewports ready, restoring segmentations...');

          // Wait a bit more to ensure viewports are fully initialized in CornerstoneViewportService
          await new Promise(resolve => setTimeout(resolve, 500));

          try {
            const { segmentationService, displaySetService, cornerstoneViewportService } = servicesManager.services;

            // Check if segmentations are already available in Cornerstone state
            const existingSegmentations = segmentationService.getSegmentations();
            console.log(`   Found ${existingSegmentations.length} existing segmentations in Cornerstone state`);

            // Get all viewport IDs to add segmentations to
            const viewportIds = viewportGridService.getViewportIds();
            console.log(`   Found ${viewportIds.length} viewports from grid service:`, viewportIds);

            // Verify viewports exist in CornerstoneViewportService
            const validViewportIds = viewportIds.filter(viewportId => {
              try {
                const viewportInfo = cornerstoneViewportService.getViewportInfo(viewportId);
                if (!viewportInfo) {
                  console.warn(`   ⚠️ Viewport ${viewportId} not found in CornerstoneViewportService`);
                  return false;
                }
                return true;
              } catch (error) {
                console.warn(`   ⚠️ Error checking viewport ${viewportId}:`, error.message);
                return false;
              }
            });

            console.log(`   Valid viewports: ${validViewportIds.length}/${viewportIds.length}`);

            if (validViewportIds.length === 0) {
              console.warn('   ⚠️ No valid viewports found, skipping segmentation restoration');
              return;
            }

            // For each segmentation from the stored state, ensure it's properly loaded
            for (const segState of segmentationState.segmentations) {
              const existingSeg = existingSegmentations.find(s => s.id === segState.id);
              if (existingSeg) {
                console.log(`   ✅ Processing segmentation ${segState.id} (${segState.label})`);

                // Check if segmentation display set exists
                const segmentationDisplaySet = displaySetService.getDisplaySetByUID(segState.id);
                if (!segmentationDisplaySet) {
                  console.warn(`   ⚠️ Segmentation display set ${segState.id} not found, creating it...`);

                  // Create display set for segmentation if it doesn't exist
                  const imageIds = existingSeg.representationData?.Labelmap?.imageIds ??
                                   existingSeg.representationData?.Contour?.imageIds;

                  if (imageIds) {
                    const newDisplaySet = {
                      displaySetInstanceUID: segState.id,
                      SOPClassUID: '1.2.840.10008.5.1.4.1.1.66.4',
                      SOPClassHandlerId: '@ohif/extension-cornerstone-dicom-seg.sopClassHandlerModule.dicom-seg',
                      SeriesDescription: segState.label,
                      Modality: 'SEG',
                      numImageFrames: imageIds.length,
                      imageIds,
                      isOverlayDisplaySet: true,
                      label: segState.label,
                      madeInClient: true,
                      segmentationId: segState.id,
                      isDerived: true,
                    };

                    displaySetService.addDisplaySets(newDisplaySet);
                    console.log(`   ✅ Created display set for segmentation ${segState.id}`);
                  }
                }

                // Add segmentation representation to each valid viewport
                for (const viewportId of validViewportIds) {
                  try {
                    // Double-check viewport exists before adding segmentation
                    const viewportInfo = cornerstoneViewportService.getViewportInfo(viewportId);
                    if (!viewportInfo) {
                      console.warn(`     ⚠️ Viewport ${viewportId} not available, skipping`);
                      continue;
                    }

                    await segmentationService.addSegmentationRepresentation(
                      viewportId,
                      {
                        segmentationId: segState.id,
                        type: cstSegmentationEnums.SegmentationRepresentations.Labelmap,
                      }
                    );
                    console.log(`     ✅ Added representation to viewport ${viewportId}`);
                  } catch (error) {
                    console.warn(`     ⚠️ Failed to add representation to viewport ${viewportId}:`, error.message);
                  }
                }

                // Apply segment visibility settings from segmentation mode
                segState.segments.forEach(segment => {
                  commandsManager.runCommand('setSegmentVisibility', {
                    segmentationId: segState.id,
                    segmentIndex: segment.segmentIndex,
                    visible: segment.visible,
                  });
                });

              } else {
                console.warn(`   ⚠️ Segmentation ${segState.id} not found in Cornerstone state`);
              }
            }

            console.log('✅ [Planner Mode] Segmentation restoration complete');
            sessionStorage.removeItem('segmentationStateFromSegmentation'); // Clean up

          } catch (error) {
            console.error('❌ [Planner Mode] Error restoring segmentations:', error);
          }

          unsubscribe();
        }
      );
    }

  } catch (error) {
    console.error('❌ [Planner Mode] Error in segmentation restoration:', error);
    sessionStorage.removeItem('segmentationStateFromSegmentation'); // Clean up on error
  }
}

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

  // Restore segmentations from segmentation mode if available
  restoreSegmentationsFromSegmentationMode(servicesManager, commandsManager).catch(error => {
    console.error('❌ [Planner Mode] Error restoring segmentations:', error);
  });

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

  // Register planner-specific toolbar buttons
  try {
    if (toolbarService && plannerToolbarButtons) {
      // Register the buttons first
      toolbarService.register(plannerToolbarButtons);
      console.log('✅ [Planner Mode] Planner toolbar buttons registered');

      // Note: Hotkeys are registered via customization service (ohif.hotkeyBindings)
      // Add custom hotkey using keyboard event listener as fallback
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.shiftKey && event.key.toLowerCase() === 'v') {
          event.preventDefault();
          commandsManager.runCommand('toggleVolumeVisibility');
          console.log('🔧 [Planner Mode] toggleVolumeVisibility triggered via Shift+V');
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      // Store for cleanup
      (window as any).__plannerModeHotkeyHandler = handleKeyDown;
      console.log('✅ [Planner Mode] Hotkey Shift+V registered for toggleVolumeVisibility');

      // Add ToggleVolumeVisibility to primary toolbar for easy access
      toolbarService.addButtons([
        {
          id: 'ToggleVolumeVisibility',
          sectionId: 'primary',
          uiType: 'ohif.toolButton',
          props: {
            icon: 'VolumeRendering',
            label: 'Volume',
            tooltip: 'Toggle volume rendering visibility (Shift+V)',
            commands: {
              commandName: 'toggleVolumeVisibility',
              commandOptions: {},
            },
            evaluate: 'evaluate.action',
          },
        },
      ]);
      console.log('✅ [Planner Mode] ToggleVolumeVisibility button added to primary toolbar');

      // Update MoreTools section to include orientation marker
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
        'PlannerOrientationMarker',
      ]);
      console.log('✅ [Planner Mode] PlannerOrientationMarker button added to MoreTools section');
    }
  } catch (error) {
    console.error('❌ [Planner Mode] Failed to register toolbar buttons:', error);
  }

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

  // Clean up hotkey event listener
  const hotkeyHandler = (window as any).__plannerModeHotkeyHandler;
  if (hotkeyHandler) {
    document.removeEventListener('keydown', hotkeyHandler);
    delete (window as any).__plannerModeHotkeyHandler;
    console.log('✅ [Planner Mode] Hotkey handler cleaned up');
  }

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
