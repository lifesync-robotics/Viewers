// @ts-ignore - i18next types may not be available at build time
import i18n from 'i18next';
import { id } from './id';
import {
  initToolGroups,
  toolbarButtons as basicToolbarButtons,
  cornerstone,
  ohif,
  dicomsr,
  dicomvideo,
  basicLayout,
  basicRoute,
  extensionDependencies as basicDependencies,
  mode as basicMode,
  modeInstance as basicModeInstance,
} from '@ohif/mode-basic';

/**
 * Registration Mode
 *
 * Dedicated workflow for patient-to-image registration operations.
 * Integrates with RegistrationPanel from @ohif/extension-lifesync.
 */

// Define registration mode specific extension modules
export const registration = {
  registrationPanel: '@ohif/extension-lifesync.panelModule.registration-panel',
  trackingPanel: '@ohif/extension-lifesync.panelModule.trackingPanel',  // 添加 tracking panel 用于开启 NDI
  // 注释掉segmentation和measurements面板
  // measurements: '@ohif/extension-cornerstone.panelModule.panelMeasurement',
  // segmentation: '@ohif/extension-cornerstone.panelModule.panelSegmentation',
  viewport: '@ohif/extension-cornerstone.viewportModule.cornerstone',
};

// Extension dependencies - includes lifesync for registration panel
export const extensionDependencies = {
  ...basicDependencies,
  '@ohif/extension-lifesync': '^3.12.0-beta.56',
};

// Define layout instance with registration panel
export const registrationInstance = {
  ...basicLayout,
  id: ohif.layout,
  props: {
    ...basicLayout.props,
    leftPanels: [
      ohif.thumbnailList,
      registration.trackingPanel,  // 添加 tracking panel 到左侧，用于开启 NDI 和配置 tracking
    ],
    leftPanelResizable: true,
    rightPanels: [
      registration.registrationPanel,  // Main registration panel - 保留
      // registration.segmentation,    // 已移除 - 注释掉
      // registration.measurements,    // 已移除 - 注释掉
    ],
    rightPanelClosed: false,  // 保留隐藏/打开按钮功能
    rightPanelResizable: true, // 保留可调整大小功能
    viewports: [
      {
        namespace: registration.viewport,
        displaySetsToDisplay: basicLayout.props.viewports[0].displaySetsToDisplay,
      },
      ...basicLayout.props.viewports.slice(1),
    ],
  },
};

// Define route
export const registrationRoute = {
  ...basicRoute,
  path: 'registration',
  layoutInstance: registrationInstance,
};

/**
 * Registration mode entry hook
 * Initializes registration-specific tools and activates Crosshairs for point marking
 */
function registrationOnModeEnter(args) {
  const { commandsManager, servicesManager, extensionManager } = args;
  const { toolbarService, toolGroupService, viewportGridService } = servicesManager.services;

  // Call the base mode's onModeEnter first to initialize tool groups
  const baseOnModeEnter = basicModeInstance.onModeEnter;
  if (baseOnModeEnter) {
    try {
      baseOnModeEnter.call(this, args);
      console.log('✅ [Registration Mode] Base mode initialization complete');
    } catch (error) {
      console.error('❌ [Registration Mode] Error in base mode initialization:', error);
    }
  }

  // Subscribe to VIEWPORTS_READY event to activate tools when viewports are ready
  try {
    if (viewportGridService?.subscribe) {
      const { unsubscribe } = viewportGridService.subscribe(
        viewportGridService.EVENTS.VIEWPORTS_READY,
        () => {
          console.log('📋 [Registration Mode] VIEWPORTS_READY event received');

          setTimeout(() => {
            // Check if MPR tool group exists (if tool group exists, viewports are ready)
            const toolGroup = toolGroupService.getToolGroup('mpr');
            if (!toolGroup) {
              console.warn('⚠️ [Registration Mode] MPR tool group not found, skipping Crosshairs activation');
              return;
            }

            // Check if Crosshairs tool is already in the tool group
            if (!toolGroup.hasTool('Crosshairs')) {
              console.warn('⚠️ [Registration Mode] Crosshairs tool not in MPR tool group');
              return;
            }

            // Activate Crosshairs tool for fiducial point marking
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
                  console.log('✅ [Registration Mode] Crosshairs tool activated for fiducial marking');
                }
              }
            } catch (error) {
              console.warn('⚠️ [Registration Mode] Error activating Crosshairs:', error);
            }
          }, 500); // Increased delay to ensure MPR viewports are fully initialized

          try {
            unsubscribe();
          } catch (error) {
            console.warn('⚠️ [Registration Mode] Error unsubscribing:', error);
          }
        }
      );

      this._viewportReadySubscription = unsubscribe;
    }
  } catch (error) {
    console.error('❌ [Registration Mode] Failed to subscribe to viewport events:', error);
  }

  console.log('✅ [Registration Mode] Initialization complete');
}

/**
 * Registration mode exit hook
 * Cleanup subscriptions and resources
 */
function registrationOnModeExit(args) {
  console.log('🧹 [Registration Mode] Starting cleanup...');

  // Clean up viewport ready subscription
  if (this._viewportReadySubscription) {
    try {
      this._viewportReadySubscription();
      this._viewportReadySubscription = null;
    } catch (error) {
      console.warn('⚠️ [Registration Mode] Error cleaning up viewport subscription:', error);
    }
  }

  // Call base mode's onModeExit
  const baseOnModeExit = basicModeInstance.onModeExit;
  if (baseOnModeExit) {
    baseOnModeExit.call(this, args);
  }

  console.log('✅ [Registration Mode] Cleanup complete');
}

// Mode instance configuration
export const modeInstance = {
  ...basicModeInstance,
  id,
  routeName: 'registration',
  displayName: i18n.t('Modes:Registration') || 'Registration',
  routes: [registrationRoute],
  hangingProtocol: 'mpr',  // Use MPR hanging protocol to show three MPR viewports (axial, sagittal, coronal)
  extensions: extensionDependencies,
  onModeEnter: registrationOnModeEnter,
  onModeExit: registrationOnModeExit,
  toolbarButtons: basicToolbarButtons,
  _viewportReadySubscription: null,
};

// Export mode object
const mode = {
  ...basicMode,
  id,
  modeInstance,
  extensionDependencies,
};

export default mode;
export { initToolGroups, basicToolbarButtons as toolbarButtons };
