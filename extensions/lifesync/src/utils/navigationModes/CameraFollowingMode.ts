/**
 * Camera Following Mode
 *
 * Viewport camera follows tool movement and rotation.
 * Supports both 3-DOF (position only) and 6-DOF (position + orientation) tracking.
 */

import { vec3 } from 'gl-matrix';
import { Types as cs3DTypes } from '@cornerstonejs/core';
import NavigationMode from './NavigationMode';

export class CameraFollowingMode extends NavigationMode {
  private useOrientationTracking: boolean = true; // Default: 6-DOF
  private lastPosition: number[] | null = null;

  constructor(servicesManager: any, coordinateTransformer: any) {
    super(servicesManager, coordinateTransformer);
  }

  getModeName(): string {
    return 'camera-follow';
  }

  onModeEnter(): void {
    console.log('📹 Camera Follow mode activated');
    this.lastPosition = null;
  }

  onModeExit(): void {
    console.log('📹 Camera Follow mode deactivated');
    this.lastPosition = null;
  }

  cleanup(): void {
    // No special cleanup needed for camera follow mode
    this.lastPosition = null;
  }

  /**
   * Handle tracking update - update camera position/orientation
   */
  handleTrackingUpdate(
    position: number[],
    orientation: number[],
    matrix?: number[] | number[][]
  ): void {
    this.incrementUpdateCount();

    const viewports = this.getViewports();

    if (viewports.length === 0) {
      return;
    }

    // Clamp position to volume bounds
    let clampedPosition = this.clampToVolumeBounds(position);
    if (!clampedPosition) {
      clampedPosition = position; // Use original if bounds unavailable
    }

    // Store initial position
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
      // Too small movement, skip
      if (this.updateCount % 100 === 0) {
        console.log(`⏭️ Skipping small movement: ${movement.toFixed(2)}mm`);
      }
      return;
    }

    // Update each viewport
    viewports.forEach(vp => {
      try {
        if (!vp || vp.type === 'stack') {
          return;
        }

        const camera = vp.getCamera();

        // Decide whether to update orientation based on configuration
        const hasValidMatrix = matrix && (
          (Array.isArray(matrix) && matrix.length === 4 && Array.isArray(matrix[0])) ||  // 2D array
          (Array.isArray(matrix) && matrix.length >= 16 && typeof matrix[0] === 'number')  // Flat array
        );

        if (this.useOrientationTracking && hasValidMatrix) {
          // 6-DOF Mode: Update both position and orientation
          this._updateCameraWithOrientation(vp, clampedPosition, matrix);
        } else {
          // 3-DOF Mode: Update position only
          this._updateCameraPositionOnly(vp, clampedPosition, camera);
        }

        // Render the viewport
        vp.render();
      } catch (error) {
        if (this.updateCount <= 5) {
          console.error(`❌ Error updating ${vp.id}:`, error);
        }
      }
    });

    this.lastPosition = clampedPosition;
  }

  /**
   * Enable/disable orientation tracking
   */
  public enableOrientationTracking(enable: boolean): void {
    this.useOrientationTracking = enable;
    console.log(`🔄 Orientation tracking: ${enable ? 'ENABLED ✅' : 'DISABLED ❌'}`);
    console.log(`   Mode: ${enable ? '6-DOF (position + orientation)' : '3-DOF (position only)'}`);
  }

  /**
   * Get orientation tracking status
   */
  public isOrientationTrackingEnabled(): boolean {
    return this.useOrientationTracking;
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
   * Transforms each viewport's view based on tool rotation while maintaining MPR orthogonality
   */
  private _updateCameraWithOrientation(vp: any, position: number[], matrix: number[] | number[][]): void {
    const camera = vp.getCamera();

    if (this.updateCount <= 10) {
      console.log(`🔄 [CameraFollowingMode] _updateCameraWithOrientation called for ${vp.id}`, {
        hasMatrix: !!matrix,
        position: position
      });
    }

    // Extract rotation matrix from 4x4 transformation matrix
    const rotationMatrix = this._extractRotationMatrix(matrix);

    // Get current viewport's view direction and viewUp
    const currentViewPlaneNormal = vec3.create();
    vec3.subtract(currentViewPlaneNormal, camera.position, camera.focalPoint);
    vec3.normalize(currentViewPlaneNormal, currentViewPlaneNormal);

    const currentViewUp = vec3.fromValues(camera.viewUp[0], camera.viewUp[1], camera.viewUp[2]);

    // Transform the viewport's current view vectors by the tool's rotation matrix
    const transformedViewPlaneNormal = this._transformVector(currentViewPlaneNormal, rotationMatrix);
    const transformedViewUp = this._transformVector(currentViewUp, rotationMatrix);

    // Normalize transformed vectors
    vec3.normalize(transformedViewPlaneNormal, transformedViewPlaneNormal);
    vec3.normalize(transformedViewUp, transformedViewUp);

    // Ensure viewUp is orthogonal to viewPlaneNormal (Gram-Schmidt orthogonalization)
    const dot = vec3.dot(transformedViewUp, transformedViewPlaneNormal);
    const projection = vec3.scale(vec3.create(), transformedViewPlaneNormal, dot);
    const orthogonalViewUp = vec3.subtract(vec3.create(), transformedViewUp, projection);
    vec3.normalize(orthogonalViewUp, orthogonalViewUp);

    // Calculate camera position (behind the focal point)
    const distance = vec3.length(vec3.subtract(vec3.create(), camera.position, camera.focalPoint));

    const newFocalPoint: cs3DTypes.Point3 = [
      position[0],
      position[1],
      position[2]
    ];

    const newPosition: cs3DTypes.Point3 = [
      newFocalPoint[0] + transformedViewPlaneNormal[0] * distance,
      newFocalPoint[1] + transformedViewPlaneNormal[1] * distance,
      newFocalPoint[2] + transformedViewPlaneNormal[2] * distance,
    ];

    // Update camera with transformed orientation
    try {
      vp.setCamera({
        focalPoint: newFocalPoint,
        position: newPosition,
        viewUp: [orthogonalViewUp[0], orthogonalViewUp[1], orthogonalViewUp[2]],
      });
    } catch (error) {
      console.error(`   ❌ Error setting camera:`, error);
      throw error;
    }
  }

  /**
   * Transform a 3D vector by a 3x3 rotation matrix
   */
  private _transformVector(vector: vec3, rotationMatrix: number[][]): vec3 {
    const result = vec3.create();
    result[0] = rotationMatrix[0][0] * vector[0] + rotationMatrix[0][1] * vector[1] + rotationMatrix[0][2] * vector[2];
    result[1] = rotationMatrix[1][0] * vector[0] + rotationMatrix[1][1] * vector[1] + rotationMatrix[1][2] * vector[2];
    result[2] = rotationMatrix[2][0] * vector[0] + rotationMatrix[2][1] * vector[1] + rotationMatrix[2][2] * vector[2];
    return result;
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
      return [
        [matrix[0][0], matrix[0][1], matrix[0][2]],  // X-axis (right)
        [matrix[1][0], matrix[1][1], matrix[1][2]],  // Y-axis (up)
        [matrix[2][0], matrix[2][1], matrix[2][2]],  // Z-axis (forward)
      ];
    }

    // Check if matrix is flat array (16 elements)
    if (Array.isArray(matrix) && matrix.length >= 16 && typeof matrix[0] === 'number') {
      return [
        [matrix[0], matrix[1], matrix[2]],   // X-axis (right)
        [matrix[4], matrix[5], matrix[6]],   // Y-axis (up)
        [matrix[8], matrix[9], matrix[10]],  // Z-axis (forward)
      ];
    }

    console.warn('⚠️ Invalid matrix format, using identity');
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  }
}
