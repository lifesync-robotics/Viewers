import getPanelModule from './panels/getPanelModule';
import getToolbarModule from './tools/getToolbarModule';
import getCommandsModule from './commandsModule';
import TrackingService from './services/TrackingService';
import RegistrationService from './services/RegistrationService';
import LifeSyncWorklist from './components/Worklist/LifeSyncWorklist';
import { id } from './id.js';

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
      {
        name: 'registrationService',
        create: ({ configuration = {} }) => {
          return new RegistrationService(servicesManager, configuration);
        },
      },
    ];
  },

  preRegistration({ servicesManager }) {
    // Register services using the REGISTRATION pattern
    servicesManager.registerService(TrackingService.REGISTRATION);
    servicesManager.registerService(RegistrationService.REGISTRATION);
    console.log('✅ LifeSync extension pre-registration completed - Services registered');
  },

  onModeEnter({ servicesManager }) {
    console.log('LifeSync extension mode enter');
  },
};

export default lifesyncExtension;
