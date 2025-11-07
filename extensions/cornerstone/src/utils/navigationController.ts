/**
 * Navigation Controller
 * Updates crosshair position and MPR orientation from tracking data
 */

import { vec3 } from 'gl-matrix';
import { Types as cs3DTypes, utilities as cs3DUtilities, getRenderingEngine } from '@cornerstonejs/core';
import { annotation, utilities } from '@cornerstonejs/tools';

const { Crosshairs } = annotation.state;

class NavigationController {
  private servicesManager: any;
  private trackingSubscription: any = null;
  private isNavigating: boolean = false;
  private updateCount: number = 0;
  private lastUpdateTime: number = 0;

  constructor(servicesManager: any) {
    this.servicesManager = servicesManager;
    console.log('🧭 NavigationController initialized');
  }

  /**
   * Start navigation mode
   * Subscribes to tracking updates and applies them to crosshair
   */
  public startNavigation(mode: string = 'circular'): void {
    const { trackingService, cornerstoneViewportService } = this.servicesManager.services;

    if (!trackingService) {
      console.error('❌ TrackingService not available');
      return;
    }

    if (this.isNavigating) {
      console.warn('⚠️ Navigation already active');
      return;
    }

    console.log(`▶️ Starting navigation (mode: ${mode})`);

    // Subscribe to tracking updates
    const TRACKING_EVENTS = {
      TRACKING_UPDATE: 'event::tracking_update',
      CONNECTION_STATUS: 'event::connection_status',
    };

    this.trackingSubscription = trackingService.subscribe(
      TRACKING_EVENTS.TRACKING_UPDATE,
      this._handleTrackingUpdate.bind(this)
    );

    this.isNavigating = true;
    this.updateCount = 0;
    this.lastUpdateTime = performance.now();

    // Connect to tracking server and wait for connection
    console.log('🔗 Connecting to tracking server...');

    // Subscribe to connection status to know when we're connected
    const connectionSubscription = trackingService.subscribe(
      TRACKING_EVENTS.CONNECTION_STATUS,
      (status: any) => {
        if (status.connected) {
          console.log('✅ Connected! Starting tracking...');
          trackingService.startTracking(mode);
          connectionSubscription.unsubscribe(); // Clean up this subscription
        } else if (status.error) {
          console.error('❌ Connection failed:', status.error);
          this.stopNavigation();
        }
      }
    );

    // Initiate connection
    trackingService.connect();

    console.log('✅ Navigation initialized, waiting for connection...');
  }

  /**
   * Stop navigation mode
   */
  public stopNavigation(): void {
    if (!this.isNavigating) {
      return;
    }

    console.log('⏸️ Stopping navigation');

    // Set flag first to prevent any race conditions
    this.isNavigating = false;

    const { trackingService } = this.servicesManager.services;

    // Unsubscribe from tracking updates
    if (this.trackingSubscription) {
      try {
        this.trackingSubscription.unsubscribe();
      } catch (error) {
        console.warn('⚠️ Error unsubscribing from tracking:', error);
      }
      this.trackingSubscription = null;
    }

    // Stop tracking and disconnect from server
    if (trackingService) {
      try {
        trackingService.stopTracking();
        trackingService.disconnect();
      } catch (error) {
        console.warn('⚠️ Error disconnecting from tracking service:', error);
      }
    }

    // Log stats only if we had updates
    if (this.updateCount > 0 && this.lastUpdateTime > 0) {
      const totalTime = (performance.now() - this.lastUpdateTime) / 1000;
      if (totalTime > 0) {
        console.log(
          `📊 Navigation stats: ${this.updateCount} updates in ${totalTime.toFixed(2)}s (avg ${(this.updateCount / totalTime).toFixed(1)} Hz)`
        );
      }
    }

    console.log('✅ Navigation stopped successfully');
  }

  /**
   * Handle tracking update - update crosshair position
   * This is called at 20Hz from the tracking server
   */
  private _handleTrackingUpdate(event: any): void {
    const { position, orientation, frame_id } = event;
    const { cornerstoneViewportService } = this.servicesManager.services;

    this.updateCount++;

    // Log every 20 updates for visual feedback
    if (this.updateCount % 20 === 0) {
      const now = performance.now();
      const elapsed = (now - this.lastUpdateTime) / 1000;
      const hz = this.updateCount / elapsed;
      console.log(`🔄 Update #${this.updateCount} (${hz.toFixed(1)} Hz) → [${position.map(v => v.toFixed(1)).join(', ')}]`);
    }

    try {
      // Update crosshair for each viewport
      this._updateCrosshairPosition(position, orientation);
    } catch (error) {
      console.error('❌ Error updating crosshair:', error);
    }
  }

  /**
   * Update crosshair position across all viewports
   * Uses viewport state restoration approach (like snapshot restore)
   */
  private _updateCrosshairPosition(position: number[], orientation: number[]): void {
    const { cornerstoneViewportService } = this.servicesManager.services;

    if (!cornerstoneViewportService) {
      return;
    }

    // Use the proper viewport state update method
    this._updateViewportStates(position);
  }

  /**
   * Update viewport states using proper Cornerstone3D methods
   * This follows the same pattern as ViewportStateService.restoreSnapshot()
   */
  private _updateViewportStates(position: number[]): void {
    const { cornerstoneViewportService } = this.servicesManager.services;

    if (!cornerstoneViewportService) {
      console.warn('⚠️ No cornerstoneViewportService');
      return;
    }

    // Store the target position
    if (!this.lastPosition) {
      this.lastPosition = position;
      console.log(`📍 Initial position stored: [${position.map(v => v.toFixed(1)).join(', ')}]`);
      return;
    }

    // Only update if there's significant movement
    const delta = [
      position[0] - this.lastPosition[0],
      position[1] - this.lastPosition[1],
      position[2] - this.lastPosition[2],
    ];
    const movement = Math.sqrt(delta[0] * delta[0] + delta[1] * delta[1] + delta[2] * delta[2]);
    if (movement < 0.5) {
      // Too small movement, skip (log occasionally)
      if (this.updateCount % 100 === 0) {
        console.log(`⏭️ Skipping small movement: ${movement.toFixed(2)}mm`);
      }
      return;
    }

    // Get rendering engine directly from Cornerstone3D
    const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
    if (!renderingEngine) {
      if (this.updateCount % 100 === 0) {
        console.warn('⚠️ No rendering engine found (OHIFCornerstoneRenderingEngine)');
      }
      return;
    }

    // Get viewports from rendering engine
    const viewports = renderingEngine.getViewports();

    if (this.updateCount === 2) {
      console.log(`📊 Found ${viewports.length} viewports:`, viewports.map(v => v.id));
    }

    let updatedCount = 0;

    viewports.forEach(vp => {
      try {
        if (!vp) {
          if (this.updateCount === 2) {
            console.warn(`⚠️ Viewport is null`);
          }
          return;
        }

        if (vp.type === 'stack') {
          if (this.updateCount === 2) {
            console.log(`⏭️ Skipping stack viewport: ${vp.id}`);
          }
          return;
        }

        const camera = vp.getCamera();

        if (this.updateCount === 2) {
          console.log(`📷 ${vp.id} camera:`, {
            focalPoint: camera.focalPoint,
            position: camera.position,
            viewUp: camera.viewUp,
          });
        }

        // Calculate new camera position maintaining view direction
        const viewPlaneNormal = vec3.create();
        vec3.subtract(viewPlaneNormal, camera.position, camera.focalPoint);
        const distance = vec3.length(viewPlaneNormal);
        vec3.normalize(viewPlaneNormal, viewPlaneNormal);

        const newFocalPoint = [position[0], position[1], position[2]];
        const newPosition = [
          newFocalPoint[0] + viewPlaneNormal[0] * distance,
          newFocalPoint[1] + viewPlaneNormal[1] * distance,
          newFocalPoint[2] + viewPlaneNormal[2] * distance,
        ];

        // Update camera WITHOUT triggering reference updates
        // Just pan the view smoothly
        vp.setCamera({
          focalPoint: newFocalPoint,
          position: newPosition,
          viewUp: camera.viewUp,
        });

        // Render the viewport
        vp.render();
        updatedCount++;

        if (this.updateCount === 2) {
          console.log(`✅ Updated ${vp.id} to focal point [${newFocalPoint.map(v => v.toFixed(1)).join(', ')}]`);
        }
      } catch (error) {
        if (this.updateCount <= 5) {
          console.error(`❌ Error updating ${vp.id}:`, error);
        }
      }
    });

    if (this.updateCount === 2) {
      console.log(`✅ Updated ${updatedCount}/${viewports.length} viewports`);
    }

    this.lastPosition = position;
  }

  private lastPosition: number[] | null = null;

  /**
   * Set center point for tracking simulation
   * Useful for setting the tracking origin to current crosshair position
   */
  public setCenterToCurrentPosition(): void {
    const { trackingService, cornerstoneViewportService } = this.servicesManager.services;

    if (!trackingService || !cornerstoneViewportService) {
      return;
    }

    // Get current crosshair position from the first viewport
    const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
    if (!renderingEngine) {
      console.warn('⚠️ No rendering engine found');
      return;
    }

    const viewports = renderingEngine.getViewports();
    if (viewports.length === 0) {
      console.warn('⚠️ No viewports found');
      return;
    }

    const firstViewport = viewports[0];
    if (firstViewport) {
      const camera = firstViewport.getCamera();
      const position = camera.focalPoint;

      // Send to tracking server
      trackingService.setCenter(position);

      console.log(`📍 Tracking center set to: ${position.map(v => v.toFixed(1)).join(', ')}`);
    }
  }

  /**
   * Get navigation status
   */
  public getStatus() {
    return {
      navigating: this.isNavigating,
      updateCount: this.updateCount,
    };
  }
}

export default NavigationController;
