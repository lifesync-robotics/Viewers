import getPanelModule from './panels/getPanelModule';
import getToolbarModule from './tools/getToolbarModule';
import getCommandsModule from './commandsModule';
import TrackingService from './services/TrackingService';
import LifeSyncWorklist from './components/Worklist/LifeSyncWorklist';
import { id } from './id.js';

// Export services for use by other extensions
export { ModelStateService } from './components/CustomizedModels';
export { ViewportStateService, ViewportStatePanel } from './components/CustomizedViewport';

const lifesyncExtension = {
  /**
   * Only required property. Should be a unique value across all extensions.
   */
  id,

  getPanelModule,
  getToolbarModule,
  getCommandsModule,

  /**
   * Customization module to override default routes and components
   */
  getCustomizationModule() {
    return [
      {
        name: 'routes.customRoutes',
        value: {
          routes: [
            {
              path: '/',
              children: (props) => {
                const DataSourceWrapper = props.route.children;
                return (
                  <DataSourceWrapper {...props}>
                    {(childProps) => <LifeSyncWorklist {...childProps} />}
                  </DataSourceWrapper>
                );
              },
              private: true,
            },
          ],
        },
      },
    ];
  },

  /**
   * Service configuration
   */
  getServicesModule({ servicesManager }) {
    return [
      {
        name: 'trackingService',
        create: ({ configuration = {} }) => {
          return new TrackingService(servicesManager);
        },
      },
    ];
  },

  preRegistration({ servicesManager }) {
    // Register TrackingService using the REGISTRATION pattern
    servicesManager.registerService(TrackingService.REGISTRATION);
    console.log('✅ LifeSync extension pre-registration completed - TrackingService registered');
  },

  onModeEnter({ servicesManager }) {
    console.log('LifeSync extension mode enter');
  },
};

export default lifesyncExtension;
