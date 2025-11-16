/**
 * LifeSync Extension Commands Module
 * 
 * Provides commands for surgical navigation and tracking functionality
 */

const commandsModule = ({ servicesManager, commandsManager }) => {
  const { uiNotificationService } = servicesManager.services;

  const actions = {
    /**
     * Start Navigation Mode
     * Connects to tracking server and starts receiving position updates
     */
    startNavigation: ({ mode = 'circular' }) => {
      console.log('🧭 [startNavigation] Starting navigation mode:', mode);

      const { trackingService } = servicesManager.services;

      if (!trackingService) {
        console.error('❌ TrackingService not available');
        uiNotificationService?.show({
          title: 'Navigation Error',
          message: 'Tracking service is not available',
          type: 'error',
        });
        return;
      }

      // Import NavigationController dynamically
      import('./utils/navigationController')
        .then(({ default: NavigationController }) => {
          // Create or get singleton instance
          if (!window.__navigationController) {
            window.__navigationController = new NavigationController(servicesManager);
          }

          // Connect to tracking server and start navigation
          return trackingService.connect();
        })
        .then(() => {
          // Start navigation after connection is established
          window.__navigationController.startNavigation(mode);

          uiNotificationService?.show({
            title: 'Navigation Started',
            message: `Navigation mode: ${mode}`,
            type: 'success',
            duration: 2000,
          });
        })
        .catch(error => {
          console.error('❌ Failed to start navigation:', error);
          uiNotificationService?.show({
            title: 'Navigation Error',
            message: error.message || 'Failed to start navigation',
            type: 'error',
            duration: 3000,
          });
        });
    },

    /**
     * Stop Navigation Mode
     */
    stopNavigation: () => {
      console.log('🛑 [stopNavigation] Stopping navigation');

      const { trackingService } = servicesManager.services;

      if (window.__navigationController) {
        window.__navigationController.stopNavigation();

        uiNotificationService?.show({
          title: 'Navigation Stopped',
          message: 'Navigation mode deactivated',
          type: 'info',
          duration: 2000,
        });
      }

      if (trackingService) {
        trackingService.disconnect();
      }
    },

    /**
     * Toggle Navigation Mode
     */
    toggleNavigation: ({ mode = 'circular' }) => {
      console.log('🔄 [toggleNavigation] Toggling navigation');

      if (window.__navigationController?.getStatus().navigating) {
        commandsManager.runCommand('stopNavigation');
      } else {
        commandsManager.runCommand('startNavigation', { mode });
      }
    },

    /**
     * Set tracking center to current crosshair position
     */
    setTrackingCenter: () => {
      console.log('📍 [setTrackingCenter] Setting tracking center');

      if (window.__navigationController) {
        window.__navigationController.setCenterToCurrentPosition();

        uiNotificationService?.show({
          title: 'Center Set',
          message: 'Tracking center updated to current position',
          type: 'success',
          duration: 2000,
        });
      } else {
        uiNotificationService?.show({
          title: 'Error',
          message: 'Navigation not active',
          type: 'error',
          duration: 2000,
        });
      }
    },
  };

  const definitions = {
    startNavigation: {
      commandFn: actions.startNavigation,
      storeContexts: [],
      options: {},
    },
    stopNavigation: {
      commandFn: actions.stopNavigation,
      storeContexts: [],
      options: {},
    },
    toggleNavigation: {
      commandFn: actions.toggleNavigation,
      storeContexts: [],
      options: {},
    },
    setTrackingCenter: {
      commandFn: actions.setTrackingCenter,
      storeContexts: [],
      options: {},
    },
  };

  return {
    actions,
    definitions,
  };
};

export default commandsModule;

