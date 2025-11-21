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
     * @param mode - Navigation mode (e.g., 'circular')
     * @param trackingMode - Tracking mode ('simulation' or 'hardware')
     */
    startNavigation: ({ mode = 'circular', trackingMode }) => {
      console.log('🧭 [startNavigation] Starting navigation mode:', mode);
      console.log('🎯 [startNavigation] Tracking mode:', trackingMode || 'from config');

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

          // Connect to tracking server with specified mode
          return trackingService.connect(trackingMode);
        })
        .then(() => {
          // Start navigation after connection is established
          window.__navigationController.startNavigation(mode);

          const modeText = trackingMode ? ` (${trackingMode})` : '';
          uiNotificationService?.show({
            title: 'Navigation Started',
            message: `Navigation mode: ${mode}${modeText}`,
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
          message: 'Navigation mode deactivated. Click "Start Navigation" to reconnect.',
          type: 'info',
          duration: 3000,
        });
      }

      // Disconnect WebSocket (Python server keeps running)
      if (trackingService) {
        trackingService.disconnect();
        console.log('✅ WebSocket disconnected (Python server still running)');
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
