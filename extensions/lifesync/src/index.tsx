import getPanelModule from './panels/getPanelModule';
import getToolbarModule from './tools/getToolbarModule';
import getCustomizationModule from './getCustomizationModule';
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
  getCustomizationModule,

  /**
   * Service configuration
   */
  preRegistration({ servicesManager }) {
    // Register LifeSync-specific services here if needed
    console.log('LifeSync extension pre-registration completed');
  },

  onModeEnter({ servicesManager }) {
    console.log('LifeSync extension mode enter');
  },
};

export default lifesyncExtension;
