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
import { HangingProtocol } from 'platform/core/src/types';

export const tracked = {
  screwManagement: '@ohif/extension-lifesync.panelModule.screw-management',
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
    rightPanels: [tracked.screwManagement],
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
      path: 'planner2d',
        /*init: ({ servicesManager, extensionManager }) => {
          //defaultViewerRouteInit
        },*/
      layoutInstance: plannerInstance,
    };

/**
 * Planner-specific mode entry hook
 * Extends the basic mode's onModeEnter to auto-activate Crosshairs tool
 */
function plannerOnModeEnter(args) {
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
    console.log('✅ [Planner Mode] Crosshairs tool activated on mpr tool group');
  }, 100);
}

export const modeInstance = {
    ...basicModeInstance,
    // TODO: We're using this as a route segment
    // We should not be.
    id,
    routeName: 'planner2d',
    displayName: i18n.t('Modes:2D Surgical Planner'),
    routes: [
      plannerRoute
    ],
    hangingProtocol: 'mpr',
    extensions: extensionDependencies,
    onModeEnter: plannerOnModeEnter,
  };

const mode = {
  ...basicMode,
  id,
  modeInstance,
  extensionDependencies,
};

export default mode;
export { initToolGroups, toolbarButtons };
