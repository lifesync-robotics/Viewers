/**
 * Navigation Controller
 * Manages navigation modes and coordinates tracking data updates
 * Uses inheritance pattern with mode-specific implementations
 */

import { vec3 } from 'gl-matrix';
import { Types as cs3DTypes, utilities as cs3DUtilities, getRenderingEngine } from '@cornerstonejs/core';
import { annotation, utilities } from '@cornerstonejs/tools';
import CoordinateTransformer from './CoordinateTransformer';
import NavigationMode from './navigationModes/NavigationMode';
import { CameraFollowingMode } from './navigationModes/CameraFollowingMode';
import { InstrumentProjectionMode } from './navigationModes/InstrumentProjectionMode';

// Navigation mode type
export type NavigationModeName = 'camera-follow' | 'instrument-projection';
export type ModeChangeListener = (mode: NavigationModeName, previousMode: NavigationModeName | null) => void;

class NavigationController {
  private servicesManager: any;
  private trackingSubscription: any = null;
  private isNavigating: boolean = false;
  private updateCount: number = 0;
  private lastUpdateTime: number = 0;
  private lastRenderTime: number = 0;
  private targetFPS: number = 20; // Target UI update rate (Hz)
  private minFrameTime: number = 1000 / this.targetFPS; // Min time between UI updates (ms)
  private coordinateTransformer: CoordinateTransformer;

  // Mode management
  private currentMode: NavigationMode | null = null;
  private modeInstances: Map<string, NavigationMode> = new Map();
  private modeChangeListeners: Set<ModeChangeListener> = new Set();

  constructor(servicesManager: any) {
    this.servicesManager = servicesManager;
    this.coordinateTransformer = new CoordinateTransformer();

    // Initialize mode instances
    this._initializeModes();

    // Set default mode
    const savedMode = localStorage.getItem('lifesync_navigation_mode') as NavigationModeName;
    const defaultMode: NavigationModeName = savedMode || 'camera-follow';
    this.setNavigationMode(defaultMode, true); // Silent init

    console.log('🧭 NavigationController initialized', {
      targetFPS: this.targetFPS,
      defaultMode: defaultMode
    });
  }

  /**
   * Initialize all navigation mode instances
   */
  private _initializeModes(): void {
    // Create mode instances
    this.modeInstances.set('camera-follow', new CameraFollowingMode(
      this.servicesManager,
      this.coordinateTransformer
    ));

    this.modeInstances.set('instrument-projection', new InstrumentProjectionMode(
      this.servicesManager,
      this.coordinateTransformer
    ));
  }

  /**
   * Get current navigation mode name
   */
  public getNavigationMode(): NavigationModeName | null {
    if (!this.currentMode) return null;

    for (const [name, mode] of this.modeInstances.entries()) {
      if (mode === this.currentMode) {
        return name as NavigationModeName;
      }
    }
    return null;
  }

  /**
   * Set navigation mode
   */
  public setNavigationMode(
    modeName: NavigationModeName,
    silent: boolean = false,
    force: boolean = false
  ): void {
    const previousModeName = this.getNavigationMode();

    // Only skip if mode is the same AND not forcing
    // force=true allows re-entering the same mode (useful for re-initialization)
    if (modeName === previousModeName && !force) {
      console.log(`ℹ️ Navigation mode already set to: ${modeName}`);
      if (!silent) {
        console.log(`   Use force=true to re-enter the same mode`);
      }
      return; // No change
    }

    // Get mode instance
    const modeInstance = this.modeInstances.get(modeName);
    if (!modeInstance) {
      console.error(`❌ Navigation mode not found: ${modeName}`);
      console.error(`   Available modes: ${Array.from(this.modeInstances.keys()).join(', ')}`);
      return;
    }

    console.log(`🔄 Switching navigation mode: ${previousModeName || 'none'} → ${modeName}`);

    // Exit previous mode
    if (this.currentMode) {
      console.log(`   Exiting previous mode: ${previousModeName}`);
      this.currentMode.onModeExit();
      this.currentMode.cleanup();
    }

    // Enter new mode
    this.currentMode = modeInstance;
    console.log(`   Entering new mode: ${modeName}`);
    this.currentMode.onModeEnter();

    // Save preference
    localStorage.setItem('lifesync_navigation_mode', modeName);

    // Notify listeners
    if (!silent) {
      this._notifyModeChange(modeName, previousModeName);
    }

    console.log(`✅ Navigation mode changed successfully: ${previousModeName || 'none'} → ${modeName}`);
    console.log(`   Current mode: ${this.getNavigationMode()}`);
  }

  /**
   * Subscribe to mode changes
   */
  public onModeChange(listener: ModeChangeListener): () => void {
    this.modeChangeListeners.add(listener);
    return () => {
      this.modeChangeListeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of mode change
   */
  private _notifyModeChange(
    mode: NavigationModeName,
    previousMode: NavigationModeName | null
  ): void {
    this.modeChangeListeners.forEach(listener => {
      try {
        listener(mode, previousMode);
      } catch (error) {
        console.error('Error in mode change listener:', error);
      }
    });
  }

  /**
   * Enable or disable orientation tracking (legacy method for CameraFollow mode)
   * Delegates to CameraFollowingMode if it's the current mode
   */
  public enableOrientationTracking(enable: boolean): void {
    const cameraFollowMode = this.modeInstances.get('camera-follow') as CameraFollowingMode;
    if (cameraFollowMode) {
      cameraFollowMode.enableOrientationTracking(enable);
    } else {
      console.warn('⚠️ enableOrientationTracking only works in camera-follow mode');
    }
  }

  /**
   * Get orientation tracking status (legacy method)
   */
  public isOrientationTrackingEnabled(): boolean {
    const cameraFollowMode = this.modeInstances.get('camera-follow') as CameraFollowingMode;
    return cameraFollowMode ? cameraFollowMode.isOrientationTrackingEnabled() : false;
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
    console.log(`   Active navigation mode: ${this.getNavigationMode()}`);

    // Auto-detect and set volume center before starting
    const volumeCenter = this._autoDetectVolumeCenter();
    if (volumeCenter) {
      console.log(`📍 Auto-detected volume center: [${volumeCenter.map(v => v.toFixed(1)).join(', ')}]`);
    }

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
    this.lastRenderTime = performance.now();

    // Connect to SyncForge tracking API
    console.log('🔗 Connecting to SyncForge tracking API...');

    // Subscribe to connection status
    const connectionSubscription = trackingService.subscribe(
      TRACKING_EVENTS.CONNECTION_STATUS,
      (status: any) => {
        if (status.connected) {
          console.log('✅ Connected! Tracking data streaming at 100Hz...');

          if (volumeCenter) {
            console.log(`📍 Volume center detected: [${volumeCenter.map(v => v.toFixed(1)).join(', ')}]`);
            // Note: setCenter() no longer needed - simulator runs independently
          }

          connectionSubscription.unsubscribe(); // Clean up this subscription
        } else if (status.error) {
          console.error('❌ Connection failed:', status.error);
          this.stopNavigation();
        }
      }
    );

    // Initiate connection (async)
    trackingService.connect().catch(error => {
      console.error('❌ Failed to connect to tracking API:', error);
      this.stopNavigation();
    });

    console.log('✅ Navigation initialized, connecting to API...');
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

    // Disconnect from tracking server
    if (trackingService) {
      try {
        trackingService.disconnect();
      } catch (error) {
        console.warn('⚠️ Error disconnecting from tracking service:', error);
      }
    }

    // Cleanup current mode
    if (this.currentMode) {
      this.currentMode.cleanup();
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
   * Handle tracking update - routes to current navigation mode
   * Data received at 100Hz, but UI updates throttled to 20Hz
   * Applies coordinate transformation from register to DICOM
   */
  private _handleTrackingUpdate(event: any): void {
    const { position, orientation, frame_id, matrix } = event;

    this.updateCount++;

    // Throttle UI updates to target FPS
    const now = performance.now();
    const timeSinceLastRender = now - this.lastRenderTime;

    if (timeSinceLastRender < this.minFrameTime) {
      // Skip this frame - too soon since last render
      if (this.updateCount % 100 === 0) {
        const dataHz = this.updateCount / ((now - this.lastUpdateTime) / 1000);
        const renderHz = 1000 / this.minFrameTime;
        console.log(`📊 Data: ${dataHz.toFixed(1)} Hz, Rendering: ${renderHz.toFixed(1)} Hz (throttled)`);
      }
      return;
    }

    // Transform coordinates from register to DICOM
    // Tracking data comes in register (r) coordinates
    // OHIF/Cornerstone needs DICOM (d) coordinates
    const registerPosition = position;
    const dicomPosition = this.coordinateTransformer.hasTransform()
      ? this.coordinateTransformer.registerToDICOM(registerPosition)
      : registerPosition;

    // Log every 20 renders (about once per second at 20 FPS)
    if (this.updateCount % 20 === 0) {
      const elapsed = (now - this.lastUpdateTime) / 1000;
      const dataHz = this.updateCount / elapsed;
      const renderHz = 1000 / timeSinceLastRender;

      if (this.coordinateTransformer.hasTransform() && !this.coordinateTransformer.isIdentityTransform()) {
        console.log(`🔄 Update #${this.updateCount} | Data: ${dataHz.toFixed(1)} Hz | UI: ${renderHz.toFixed(1)} Hz`);
        console.log(`   Register: [${registerPosition.map(v => v.toFixed(1)).join(', ')}]`);
        console.log(`   DICOM:    [${dicomPosition.map(v => v.toFixed(1)).join(', ')}]`);
      } else {
        console.log(`🔄 Update #${this.updateCount} | Data: ${dataHz.toFixed(1)} Hz | UI: ${renderHz.toFixed(1)} Hz → [${dicomPosition.map(v => v.toFixed(1)).join(', ')}]`);
      }
    }

    // Delegate to current navigation mode
    if (this.currentMode) {
      try {
        const modeName = this.currentMode.getModeName();

        // Log mode confirmation periodically
        if (this.updateCount % 100 === 0) {
          console.log(`🧭 [NavigationController] Current mode: ${modeName}`);
        }

        this.currentMode.handleTrackingUpdate(dicomPosition, orientation, matrix);
        this.lastRenderTime = now;
      } catch (error) {
        console.error('❌ Error in navigation mode handler:', error);
      }
    } else {
      console.warn('⚠️ No navigation mode active');
    }
  }

  // NOTE: Camera update methods have been moved to CameraFollowingMode class
  // These methods are no longer needed in NavigationController

  /**
   * Set center point for tracking simulation
   * Useful for setting the tracking origin to current crosshair position
   */
  public setCenterToCurrentPosition(): void {
    const { trackingService } = this.servicesManager.services;

    if (!trackingService) {
      console.warn('⚠️ TrackingService not available');
      return;
    }

    // Get current crosshair annotation position
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

    // Try to get actual crosshair annotation position
    let crosshairPosition = null;

    for (const viewport of viewports) {
      try {
        const element = viewport.element;
        if (!element) continue;

        // Get crosshairs annotations
        const annotations = annotation.state.getAnnotations('Crosshairs', element);

        if (annotations && annotations.length > 0) {
          const crosshairAnnotation = annotations[0];

          // Get position from toolCenter (the actual crosshair center)
          if (crosshairAnnotation.data?.handles?.toolCenter) {
            crosshairPosition = crosshairAnnotation.data.handles.toolCenter;
            console.log(`📍 Found crosshair CENTER from toolCenter in ${viewport.id}`);
            break;
          } else if (crosshairAnnotation.data?.handles?.rotationPoints) {
            // Fallback to rotationPoints (but this is a rotation handle, not the center!)
            crosshairPosition = crosshairAnnotation.data.handles.rotationPoints[0];
            console.log(`⚠️ Using rotationPoints[0] (rotation handle) in ${viewport.id}`);
            break;
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error getting crosshair from ${viewport.id}:`, error);
      }
    }

    // Fallback to camera focal point if no crosshair found
    if (!crosshairPosition) {
      console.warn('⚠️ No crosshair annotation found, using camera focal point as fallback');
      const firstViewport = viewports[0];
      const camera = firstViewport.getCamera();
      crosshairPosition = camera.focalPoint;
    }

    if (crosshairPosition) {
      const position = Array.isArray(crosshairPosition)
        ? crosshairPosition
        : [crosshairPosition[0], crosshairPosition[1], crosshairPosition[2]];

      // Send to tracking server
      trackingService.setCenter(position);

      console.log(`📍 Tracking center set to: [${position.map(v => v.toFixed(1)).join(', ')}]`);
    } else {
      console.error('❌ Could not determine center position');
    }
  }

  /**
   * Auto-detect volume center from loaded DICOM data
   * Returns the geometric center of the volume bounds
   */
  private _autoDetectVolumeCenter(): number[] | null {
    try {
      const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
      if (!renderingEngine) {
        console.warn('⚠️ No rendering engine found for auto-detect');
        return null;
      }

      const viewports = renderingEngine.getViewports();
      if (viewports.length === 0) {
        console.warn('⚠️ No viewports found for auto-detect');
        return null;
      }

      // Get bounds from the first volume viewport
      for (const viewport of viewports) {
        if (viewport.type === 'orthographic' || viewport.type === 'volume3d') {
          const defaultActor = viewport.getDefaultActor?.();
          if (defaultActor && defaultActor.actor) {
            const bounds = (defaultActor.actor as any).getBounds?.();
            if (bounds && bounds.length === 6) {
              // bounds = [xMin, xMax, yMin, yMax, zMin, zMax]
              const [xMin, xMax, yMin, yMax, zMin, zMax] = bounds;

              // Calculate geometric center
              const center = [
                (xMin + xMax) / 2,
                (yMin + yMax) / 2,
                (zMin + zMax) / 2,
              ];

              console.log(`📊 Volume bounds: X[${xMin.toFixed(1)}, ${xMax.toFixed(1)}] Y[${yMin.toFixed(1)}, ${yMax.toFixed(1)}] Z[${zMin.toFixed(1)}, ${zMax.toFixed(1)}]`);

              return center;
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error auto-detecting volume center:', error);
    }

    return null;
  }

  // NOTE: _clampToVolumeBounds has been moved to NavigationMode base class

  /**
   * Load coordinate transformation from case data
   * @param rMd 4x4 transformation matrix from register to DICOM
   */
  public loadTransformation(rMd: number[][] | any): void {
    try {
      this.coordinateTransformer.loadTransform(rMd);
      console.log('✅ Coordinate transformation loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load transformation:', error);
      throw error;
    }
  }

  /**
   * Load transformation from case.json file
   * Automatically extracts rMd from dicom_series.fixed_image
   */
  public async loadTransformationFromCase(caseId: string): Promise<void> {
    try {
      // Fetch case.json from SurgicalCase directory
      // This would need to be implemented based on how case data is accessed in OHIF
      console.log(`📋 Loading transformation for case: ${caseId}`);
      console.warn('⚠️ Auto-loading from case.json not yet implemented');
      console.warn('   Use loadTransformation() with explicit rMd matrix');
    } catch (error) {
      console.error('❌ Failed to load case transformation:', error);
      throw error;
    }
  }

  /**
   * Clear coordinate transformation (use raw tracking data)
   */
  public clearTransformation(): void {
    this.coordinateTransformer.clear();
    console.log('✅ Coordinate transformation cleared');
  }

  /**
   * Set target UI update rate (FPS)
   * @param fps Target frames per second (recommended: 20-30)
   */
  public setTargetFPS(fps: number): void {
    if (fps < 10 || fps > 60) {
      console.warn(`⚠️ Target FPS should be between 10-60, got ${fps}. Using default 25.`);
      fps = 25;
    }
    this.targetFPS = fps;
    this.minFrameTime = 1000 / fps;
    console.log(`🎯 Target UI update rate set to ${fps} Hz`);
  }

  /**
   * Get navigation status
   */
  public getStatus() {
    const transform = this.coordinateTransformer.getTransform();

    return {
      navigating: this.isNavigating,
      updateCount: this.updateCount,
      targetFPS: this.targetFPS,
      actualFPS: this.lastRenderTime > 0
        ? 1000 / (performance.now() - this.lastRenderTime)
        : 0,
      transformation: {
        loaded: this.coordinateTransformer.hasTransform(),
        isIdentity: this.coordinateTransformer.isIdentityTransform(),
        rMd: transform.rMd,
        invRMd: transform.invRMd,
      },
    };
  }
}

export default NavigationController;
