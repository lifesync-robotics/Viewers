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
     * @param enableOrientation - Enable 6-DOF orientation tracking (default: false)
     * @param navigationMode - Navigation visualization mode ('camera-follow' or 'instrument-projection')
     */
    startNavigation: ({ mode = 'circular', trackingMode, enableOrientation = false, navigationMode = 'camera-follow' }) => {
      console.log('🧭 [startNavigation] Starting navigation mode:', mode);
      console.log('🎯 [startNavigation] Tracking mode:', trackingMode || 'from config');
      console.log('🔄 [startNavigation] Orientation tracking:', enableOrientation ? 'ENABLED ✅' : 'DISABLED ❌');
      console.log('📹 [startNavigation] Navigation mode:', navigationMode);

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
            console.log('🔧 [startNavigation] Creating new NavigationController instance');
            window.__navigationController = new NavigationController(servicesManager);
          } else {
            console.log('🔧 [startNavigation] Using existing NavigationController instance');
          }

          // IMPORTANT: Always set navigation mode from the parameter, not from localStorage
          // This ensures the mode requested by the UI is used, even if it conflicts with saved preferences
          if (navigationMode) {
            console.log(`📹 [startNavigation] Setting navigation mode to: ${navigationMode}`);
            const currentModeBefore = window.__navigationController.getNavigationMode();
            console.log(`   Current mode before setting: ${currentModeBefore}`);
            
            // Always force set the mode to ensure proper initialization
            // This ensures mode is set correctly even if NavigationController was just created
            window.__navigationController.setNavigationMode(navigationMode, false, true); // force=true
            
            // Verify mode was set correctly
            const verifiedMode = window.__navigationController.getNavigationMode();
            console.log(`   Mode after setting: ${verifiedMode}`);
            
            if (verifiedMode !== navigationMode) {
              console.error(`   ⚠️ WARNING: Mode mismatch! Requested ${navigationMode} but got ${verifiedMode}`);
              console.error(`   This is a critical error - mode switching failed!`);
            } else {
              console.log(`   ✅ Mode successfully set to: ${verifiedMode}`);
              console.log(`   Mode verification: ${window.__navigationController.getNavigationMode()} === ${navigationMode}`);
            }
          }

          // Enable orientation tracking if requested (only for camera-follow mode)
          if (enableOrientation !== undefined && navigationMode === 'camera-follow') {
            window.__navigationController.enableOrientationTracking(enableOrientation);
          }

          // Connect to tracking server with specified mode
          return trackingService.connect(trackingMode);
        })
        .then(() => {
          // Start navigation after connection is established
          window.__navigationController.startNavigation(mode);

          const modeText = trackingMode ? ` (${trackingMode})` : '';
          const dofText = enableOrientation && navigationMode === 'camera-follow' ? ' [6-DOF]' : navigationMode === 'camera-follow' ? ' [3-DOF]' : '';
          const navModeText = navigationMode === 'camera-follow' ? 'Camera Follow' : 'Instrument Projection';
          uiNotificationService?.show({
            title: 'Navigation Started',
            message: `${navModeText}${modeText}${dofText}`,
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
