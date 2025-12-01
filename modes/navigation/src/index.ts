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

export const tracked = {
  measurements: '@ohif/extension-measurement-tracking.panelModule.trackedMeasurements',
  thumbnailList: '@ohif/extension-measurement-tracking.panelModule.seriesList',
  viewport: '@ohif/extension-measurement-tracking.viewportModule.cornerstone-tracked',
  viewportState: '@ohif/extension-cornerstone.panelModule.viewport-state',
  screwManagement: '@ohif/extension-lifesync.panelModule.screw-management',
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
 * Navigation mode entry hook
 * Extends the basic mode's onModeEnter to auto-activate Crosshairs tool for screw planning
 */
function navigationOnModeEnter(args) {
  const { commandsManager } = args;

  // Call the base mode's onModeEnter first to initialize tool groups
  const baseOnModeEnter = basicModeInstance.onModeEnter;
  if (baseOnModeEnter) {
    baseOnModeEnter.call(this, args);
  }

  // Now that tool groups are initialized, activate Crosshairs on the mpr tool group
  // Use a small delay to ensure the tool group is fully ready
  setTimeout(() => {
    commandsManager.runCommand('setToolActive', {
      toolName: 'Crosshairs',
      toolGroupId: 'mpr',
    });
    console.log('✅ [Navigation Mode] Crosshairs tool activated on mpr tool group');
  }, 100);
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
  };

const mode = {
  ...basicMode,
  id,
  modeInstance,
  extensionDependencies,
};

export default mode;
export { initToolGroups, toolbarButtons };

