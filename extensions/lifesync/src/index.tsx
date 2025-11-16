import getPanelModule from './panels/getPanelModule';
import getToolbarModule from './tools/getToolbarModule';
import TrackingService from './services/TrackingService';
import { id } from './id.js';

const lifesyncExtension = {
  /**
   * Only required property. Should be a unique value across all extensions.
   */
  id,

  getPanelModule,
  getToolbarModule,

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

