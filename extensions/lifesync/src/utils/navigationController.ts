/**
 * Navigation Controller
 * Updates crosshair position and MPR orientation from tracking data
 * Includes coordinate transformation from register (r) to DICOM (d) coordinates
 */

import { vec3 } from 'gl-matrix';
import { Types as cs3DTypes, utilities as cs3DUtilities, getRenderingEngine } from '@cornerstonejs/core';
import { annotation, utilities } from '@cornerstonejs/tools';
import CoordinateTransformer from './CoordinateTransformer';

class NavigationController {
  private servicesManager: any;
  private trackingSubscription: any = null;
  private isNavigating: boolean = false;
  private updateCount: number = 0;
  private lastUpdateTime: number = 0;
  private lastRenderTime: number = 0;
  private targetFPS: number = 25; // Target UI update rate (Hz)
  private minFrameTime: number = 1000 / this.targetFPS; // Min time between UI updates (ms)
  private coordinateTransformer: CoordinateTransformer;

  // Orientation tracking configuration
  private useOrientationTracking: boolean = true; // Default: 6-DOF (position + orientation)
  private lastPosition: number[] | null = null;

  constructor(servicesManager: any) {
    this.servicesManager = servicesManager;
    this.coordinateTransformer = new CoordinateTransformer();
    console.log('🧭 NavigationController initialized', {
      targetFPS: this.targetFPS,
      orientationTracking: this.useOrientationTracking
    });
  }

  /**
   * Enable or disable orientation tracking
   * When enabled, MPR views will rotate to align with tracked tool orientation
   * When disabled, only position is tracked (current behavior)
   */
  public enableOrientationTracking(enable: boolean): void {
    this.useOrientationTracking = enable;
    console.log(`🔄 Orientation tracking: ${enable ? 'ENABLED ✅' : 'DISABLED ❌'}`);
    console.log(`   Mode: ${enable ? '6-DOF (position + orientation)' : '3-DOF (position only)'}`);
  }

  /**
   * Get current orientation tracking status
   */
  public isOrientationTrackingEnabled(): boolean {
    return this.useOrientationTracking;
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
   * Handle tracking update - update crosshair position and orientation
   * Data received at 100Hz, but UI updates throttled to 25Hz
   * Applies coordinate transformation from register to DICOM
   */
  private _handleTrackingUpdate(event: any): void {
    const { position, orientation, frame_id, matrix } = event;
    const { cornerstoneViewportService } = this.servicesManager.services;

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

    // Log every 25 renders (about once per second at 25 FPS)
    if (this.updateCount % 25 === 0) {
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

    try {
      // Update crosshair for each viewport using DICOM coordinates
      // Pass matrix for orientation tracking (if enabled)
      this._updateCrosshairPosition(dicomPosition, orientation, matrix);
      this.lastRenderTime = now;
    } catch (error) {
      console.error('❌ Error updating crosshair:', error);
    }
  }

  /**
   * Update crosshair position and orientation across all viewports
   * Uses viewport state restoration approach (like snapshot restore)
   */
  private _updateCrosshairPosition(position: number[], orientation: number[], matrix?: number[]): void {
    const { cornerstoneViewportService } = this.servicesManager.services;

    if (!cornerstoneViewportService) {
      return;
    }

    // Use the proper viewport state update method
    // Pass orientation and matrix for 6-DOF tracking
    this._updateViewportStates(position, orientation, matrix);
  }

  /**
   * Update viewport states using proper Cornerstone3D methods
   * Supports both position-only (3-DOF) and position+orientation (6-DOF) tracking
   * This follows the same pattern as ViewportStateService.restoreSnapshot()
   */
  private _updateViewportStates(position: number[], orientation?: number[], matrix?: number[]): void {
    const { cornerstoneViewportService } = this.servicesManager.services;

    if (!cornerstoneViewportService) {
      console.warn('⚠️ No cornerstoneViewportService');
      return;
    }

    // Get rendering engine to check bounds
    const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
    if (!renderingEngine) {
      return;
    }

    // Clamp position to volume bounds to avoid "No imageId found" errors
    let clampedPosition = this._clampToVolumeBounds(position, renderingEngine);
    if (!clampedPosition) {
      // Couldn't get bounds, use original position
      clampedPosition = position;
    }

    // Store the target position
    if (!this.lastPosition) {
      this.lastPosition = clampedPosition;
      console.log(`📍 Initial position stored: [${clampedPosition.map(v => v.toFixed(1)).join(', ')}]`);
      if (this.useOrientationTracking && matrix) {
        console.log(`🔄 Orientation tracking enabled - will update viewUp from matrix`);
      }
      return;
    }

    // Only update if there's significant movement
    const delta = [
      clampedPosition[0] - this.lastPosition[0],
      clampedPosition[1] - this.lastPosition[1],
      clampedPosition[2] - this.lastPosition[2],
    ];
    const movement = Math.sqrt(delta[0] * delta[0] + delta[1] * delta[1] + delta[2] * delta[2]);
    if (movement < 0.5) {
      // Too small movement, skip (log occasionally)
      if (this.updateCount % 100 === 0) {
        console.log(`⏭️ Skipping small movement: ${movement.toFixed(2)}mm`);
      }
      return;
    }

    // Get viewports from rendering engine (already have renderingEngine from above)
    const viewports = renderingEngine.getViewports();

    if (this.updateCount === 2) {
      console.log(`📊 Found ${viewports.length} viewports:`, viewports.map(v => v.id));
      console.log(`   Orientation tracking: ${this.useOrientationTracking ? 'ENABLED ✅' : 'DISABLED ❌'}`);
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

        // Decide whether to update orientation based on configuration
        const hasValidMatrix = matrix && (
          (Array.isArray(matrix) && matrix.length === 4 && Array.isArray(matrix[0])) ||  // 2D array
          (Array.isArray(matrix) && matrix.length >= 16 && typeof matrix[0] === 'number')  // Flat array
        );

        if (this.updateCount <= 10) {
          console.log(`📊 [NavigationController] Viewport ${vp.id} update decision:`, {
            useOrientationTracking: this.useOrientationTracking,
            hasMatrix: !!matrix,
            hasValidMatrix: hasValidMatrix,
            matrixInfo: matrix ? {
              isArray: Array.isArray(matrix),
              length: Array.isArray(matrix) ? matrix.length : 'N/A',
              firstElementType: Array.isArray(matrix) && matrix.length > 0 ? (Array.isArray(matrix[0]) ? 'Array' : typeof matrix[0]) : 'N/A',
              firstValue: Array.isArray(matrix) && matrix.length > 0 ? (Array.isArray(matrix[0]) ? matrix[0][0] : matrix[0]) : 'N/A'
            } : 'null',
            willUse6DOF: this.useOrientationTracking && hasValidMatrix
          });
        }

        if (this.useOrientationTracking && hasValidMatrix) {
          // 6-DOF Mode: Update both position and orientation
          if (this.updateCount <= 10) {
            console.log(`   → Using 6-DOF mode (position + orientation)`);
          }
          this._updateCameraWithOrientation(vp, clampedPosition, matrix);
        } else {
          // 3-DOF Mode: Update position only (current behavior)
          if (this.updateCount <= 10) {
            console.log(`   → Using 3-DOF mode (position only)`);
          }
          this._updateCameraPositionOnly(vp, clampedPosition, camera);

          if (this.useOrientationTracking && !hasValidMatrix && this.updateCount <= 10) {
            console.warn('⚠️ Orientation tracking enabled but no valid matrix available');
          }
        }

        // Render the viewport
        vp.render();
        updatedCount++;

        if (this.updateCount === 2) {
          console.log(`✅ Updated ${vp.id} to focal point [${clampedPosition.map(v => v.toFixed(1)).join(', ')}]`);
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

    this.lastPosition = clampedPosition;
  }

  /**
   * Update camera position only (3-DOF mode)
   * Maintains existing view direction and orientation
   */
  private _updateCameraPositionOnly(vp: any, position: number[], camera: any): void {
    // Calculate new camera position maintaining view direction
    const viewPlaneNormal = vec3.create();
    vec3.subtract(viewPlaneNormal, camera.position, camera.focalPoint);
    const distance = vec3.length(viewPlaneNormal);
    vec3.normalize(viewPlaneNormal, viewPlaneNormal);

    const newFocalPoint: cs3DTypes.Point3 = [
      position[0],
      position[1],
      position[2]
    ];
    const newPosition: cs3DTypes.Point3 = [
      newFocalPoint[0] + viewPlaneNormal[0] * distance,
      newFocalPoint[1] + viewPlaneNormal[1] * distance,
      newFocalPoint[2] + viewPlaneNormal[2] * distance,
    ];

    // Update camera - keep existing viewUp
    vp.setCamera({
      focalPoint: newFocalPoint,
      position: newPosition,
      viewUp: camera.viewUp,
    });
  }

  /**
   * Update camera with orientation (6-DOF mode)
   * Updates position, view direction, and viewUp from transformation matrix
   */
  private _updateCameraWithOrientation(vp: any, position: number[], matrix: number[] | number[][]): void {
    const camera = vp.getCamera();

    if (this.updateCount <= 10) {
      console.log(`🔄 [NavigationController] _updateCameraWithOrientation called for ${vp.id}`, {
        hasMatrix: !!matrix,
        matrixType: matrix ? (Array.isArray(matrix) ? `Array[${matrix.length}]` : typeof matrix) : 'null',
        position: position
      });
    }

    // Extract rotation matrix from 4x4 transformation matrix
    const rotationMatrix = this._extractRotationMatrix(matrix);

    if (this.updateCount <= 10) {
      console.log(`   Extracted rotation matrix:`, rotationMatrix);
    }

    // Extract view direction (Z-axis of tool - points forward)
    const viewDirection = [
      rotationMatrix[2][0],
      rotationMatrix[2][1],
      rotationMatrix[2][2],
    ];

    // Extract viewUp (Y-axis of tool - points up)
    const viewUp = [
      rotationMatrix[1][0],
      rotationMatrix[1][1],
      rotationMatrix[1][2],
    ];

    // Normalize vectors
    const viewDirLength = Math.sqrt(
      viewDirection[0] * viewDirection[0] +
      viewDirection[1] * viewDirection[1] +
      viewDirection[2] * viewDirection[2]
    );
    const normalizedViewDir = [
      viewDirection[0] / viewDirLength,
      viewDirection[1] / viewDirLength,
      viewDirection[2] / viewDirLength,
    ];

    const viewUpLength = Math.sqrt(
      viewUp[0] * viewUp[0] +
      viewUp[1] * viewUp[1] +
      viewUp[2] * viewUp[2]
    );
    const normalizedViewUp = [
      viewUp[0] / viewUpLength,
      viewUp[1] / viewUpLength,
      viewUp[2] / viewUpLength,
    ];

    // Calculate camera position (behind the focal point)
    const distance = vec3.length(vec3.subtract(vec3.create(), camera.position, camera.focalPoint));

    const newFocalPoint: cs3DTypes.Point3 = [
      position[0],
      position[1],
      position[2]
    ];

    const newPosition: cs3DTypes.Point3 = [
      newFocalPoint[0] - normalizedViewDir[0] * distance,
      newFocalPoint[1] - normalizedViewDir[1] * distance,
      newFocalPoint[2] - normalizedViewDir[2] * distance,
    ];

    // Log orientation update BEFORE setting camera (for debugging)
    if (this.updateCount <= 10) {
      console.log(`🔄 ${vp.id} orientation update:`);
      console.log(`   viewDirection: [${normalizedViewDir.map(v => v.toFixed(3)).join(', ')}]`);
      console.log(`   viewUp: [${normalizedViewUp.map(v => v.toFixed(3)).join(', ')}]`);
      console.log(`   focalPoint: [${newFocalPoint.map(v => v.toFixed(1)).join(', ')}]`);
      console.log(`   position: [${newPosition.map(v => v.toFixed(1)).join(', ')}]`);
    }

    // Update camera with new orientation
    try {
      vp.setCamera({
        focalPoint: newFocalPoint,
        position: newPosition,
        viewUp: normalizedViewUp,
      });

      if (this.updateCount <= 10) {
        console.log(`   ✅ Camera updated successfully`);
      }
    } catch (error) {
      console.error(`   ❌ Error setting camera:`, error);
      throw error;
    }
  }

  /**
   * Extract 3x3 rotation matrix from 4x4 transformation matrix
   * Handles both flat array and 2D array formats
   */
  private _extractRotationMatrix(matrix: number[] | number[][]): number[][] {
    if (!matrix) {
      console.warn('⚠️ Matrix is null, using identity');
      return [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];
    }

    // Check if matrix is 2D array (4x4)
    if (Array.isArray(matrix) && matrix.length === 4 && Array.isArray(matrix[0])) {
      // 2D array format: [[m00, m01, m02, m03], [m10, m11, m12, m13], ...]
      if (this.updateCount <= 10) {
        console.log('🔍 [NavigationController] Matrix is 2D array (4x4)');
        console.log('   First row:', matrix[0]);
      }
      return [
        [matrix[0][0], matrix[0][1], matrix[0][2]],  // X-axis (right)
        [matrix[1][0], matrix[1][1], matrix[1][2]],  // Y-axis (up)
        [matrix[2][0], matrix[2][1], matrix[2][2]],  // Z-axis (forward)
      ];
    }

    // Check if matrix is flat array (16 elements)
    if (Array.isArray(matrix) && matrix.length >= 16 && typeof matrix[0] === 'number') {
      // Flat array format: [m00, m01, m02, m03, m10, m11, m12, m13, ...]
      if (this.updateCount <= 10) {
        console.log('🔍 [NavigationController] Matrix is flat array (16 elements)');
        console.log('   First 4 elements:', matrix.slice(0, 4));
      }
      return [
        [matrix[0], matrix[1], matrix[2]],   // X-axis (right)
        [matrix[4], matrix[5], matrix[6]],   // Y-axis (up)
        [matrix[8], matrix[9], matrix[10]],  // Z-axis (forward)
      ];
    }

    console.warn('⚠️ Invalid matrix format, using identity. Matrix:', {
      isArray: Array.isArray(matrix),
      length: Array.isArray(matrix) ? matrix.length : 'N/A',
      firstElement: Array.isArray(matrix) && matrix.length > 0 ? matrix[0] : 'N/A'
    });

    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  }

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

  /**
   * Clamp position to volume bounds to prevent "No imageId found" errors
   */
  private _clampToVolumeBounds(position: number[], renderingEngine: any): number[] | null {
    try {
      const viewports = renderingEngine.getViewports();
      if (viewports.length === 0) {
        return null;
      }

      // Get bounds from the first volume viewport
      for (const viewport of viewports) {
        if (viewport.type === 'orthographic' || viewport.type === 'volume3d') {
          const defaultActor = viewport.getDefaultActor?.();
          if (defaultActor && defaultActor.actor) {
            const bounds = defaultActor.actor.getBounds();
            if (bounds && bounds.length === 6) {
              // bounds = [xMin, xMax, yMin, yMax, zMin, zMax]
              const [xMin, xMax, yMin, yMax, zMin, zMax] = bounds;

              // Add a small margin to avoid edge cases
              const margin = 1.0; // mm

              const clampedPosition = [
                Math.max(xMin + margin, Math.min(xMax - margin, position[0])),
                Math.max(yMin + margin, Math.min(yMax - margin, position[1])),
                Math.max(zMin + margin, Math.min(zMax - margin, position[2])),
              ];

              // Log if clamping occurred
              if (this.updateCount % 100 === 0 && (
                clampedPosition[0] !== position[0] ||
                clampedPosition[1] !== position[1] ||
                clampedPosition[2] !== position[2]
              )) {
                console.warn(`⚠️ Position clamped to volume bounds:`);
                console.warn(`   Original: [${position.map(v => v.toFixed(1)).join(', ')}]`);
                console.warn(`   Clamped:  [${clampedPosition.map(v => v.toFixed(1)).join(', ')}]`);
                console.warn(`   Bounds: X[${xMin.toFixed(1)}, ${xMax.toFixed(1)}] Y[${yMin.toFixed(1)}, ${yMax.toFixed(1)}] Z[${zMin.toFixed(1)}, ${zMax.toFixed(1)}]`);
              }

              return clampedPosition;
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error getting volume bounds:', error);
    }

    return null;
  }

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
