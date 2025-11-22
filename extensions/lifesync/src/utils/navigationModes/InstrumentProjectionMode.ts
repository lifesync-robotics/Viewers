/**
 * Instrument Projection Mode
 *
 * Tool is projected on fixed viewport with axis and extension line.
 * Viewport camera remains fixed while tool representation is overlaid.
 *
 * Phase 2: Full projection rendering with SVG overlay
 */

import NavigationMode from './NavigationMode';
import { ToolProjectionRenderer, ToolRepresentation } from './ToolProjectionRenderer';

export class InstrumentProjectionMode extends NavigationMode {
  private toolProjectionRenderer: ToolProjectionRenderer | null = null;
  private lastPosition: number[] | null = null;
  private extensionLength: number = 100; // 100mm = 10cm default
  private savedCameraStates: Map<string, any> = new Map(); // Save camera states to restore later

  constructor(servicesManager: any, coordinateTransformer: any) {
    super(servicesManager, coordinateTransformer);
  }

  getModeName(): string {
    return 'instrument-projection';
  }

  onModeEnter(): void {
    console.log('🎯🎯🎯 Instrument Projection mode activated');
    console.log(`   Extension length: ${this.extensionLength}mm (${this.extensionLength / 10}cm)`);
    console.log('   Viewport cameras will remain fixed - only projection will update');
    this.lastPosition = null;
    this.updateCount = 0; // Reset update count for fresh logs

    // Initialize projection renderer first
    this.toolProjectionRenderer = new ToolProjectionRenderer(
      this.servicesManager,
      this.extensionLength
    );

    // Try to save camera states immediately
    // If viewports aren't ready yet, we'll save them on first tracking update
    const viewports = this.getViewports();
    console.log(`   🔍 Found ${viewports.length} viewports on mode enter`);

    if (viewports.length > 0) {
      this._saveCameraStates();
      const savedCount = this.savedCameraStates.size;
      if (savedCount > 0) {
        console.log(`   ✅ Saved camera states for ${savedCount} viewports`);
        // Log each saved viewport for debugging
        this.savedCameraStates.forEach((state, vpId) => {
          console.log(`      - ${vpId}: focal=[${state.focalPoint.map(v => v.toFixed(1)).join(', ')}]`);
        });
      } else {
        console.warn(`   ⚠️ No camera states were saved (${viewports.length} viewports found but none usable)`);
        console.log(`   📝 Will save camera states on first tracking update instead`);
      }
    } else {
      console.log('   ⚠️ No viewports found yet - will save camera states on first tracking update');
    }

    console.log('   🎯 Instrument Projection mode is now active and ready');
  }

  /**
   * Save current camera states for all viewports
   * This ensures cameras remain fixed during projection mode
   */
  private _saveCameraStates(): void {
    const viewports = this.getViewports();

    if (viewports.length === 0) {
      console.warn('⚠️ [Instrument Projection] No viewports found when trying to save camera states');
      return;
    }

    // Don't clear existing states - merge with new ones
    // This allows saving states progressively as viewports become available
    let savedCount = 0;

    viewports.forEach(vp => {
      if (!vp || vp.type === 'stack') {
        return;
      }

      try {
        const camera = vp.getCamera();

        if (!camera || !camera.focalPoint || !camera.position || !camera.viewUp) {
          console.warn(`⚠️ [Instrument Projection] Invalid camera for ${vp.id}`);
          return;
        }

        this.savedCameraStates.set(vp.id, {
          focalPoint: [...camera.focalPoint],
          position: [...camera.position],
          viewUp: [...camera.viewUp],
        });
        savedCount++;

        if (this.updateCount <= 2) {
          console.log(`📸 Saved camera state for ${vp.id}:`, {
            focalPoint: camera.focalPoint,
            position: camera.position
          });
        }
      } catch (error) {
        console.error(`❌ Failed to save camera state for ${vp.id}:`, error);
      }
    });

    if (savedCount === 0) {
      console.warn('⚠️ [Instrument Projection] No camera states were saved!');
    }
  }

  onModeExit(): void {
    console.log('🎯 Instrument Projection mode deactivated');
    console.log('   Restoring camera states (if any)');
    this.lastPosition = null;

    // Cleanup projection renderer
    if (this.toolProjectionRenderer) {
      this.toolProjectionRenderer.cleanup();
      this.toolProjectionRenderer = null;
    }

    // Clear saved camera states
    this.savedCameraStates.clear();
  }

  cleanup(): void {
    // Full cleanup
    if (this.toolProjectionRenderer) {
      this.toolProjectionRenderer.cleanup();
      this.toolProjectionRenderer = null;
    }
    this.lastPosition = null;
  }

  /**
   * Handle tracking update - project tool on viewport
   * IMPORTANT: This mode does NOT move the camera - only updates projection overlay
   */
  handleTrackingUpdate(
    position: number[],
    orientation: number[],
    matrix?: number[] | number[][]
  ): void {
    this.incrementUpdateCount();

    // Log mode confirmation on first update
    if (this.updateCount === 1) {
      console.log('🎯🎯🎯 [Instrument Projection Mode] HANDLE TRACKING UPDATE CALLED');
      console.log('   This confirms Instrument Projection mode is active!');
      console.log('   Cameras will remain FIXED - only projection updates');
    }

    // CRITICAL: If camera states haven't been saved yet (e.g., viewports weren't ready on mode enter),
    // save them NOW before doing anything else
    if (this.savedCameraStates.size === 0) {
      console.log('📸 [Instrument Projection] Saving camera states on first tracking update...');
      this._saveCameraStates();
      console.log(`   ✅ Saved camera states for ${this.savedCameraStates.size} viewports`);

      if (this.savedCameraStates.size === 0) {
        console.error('   ❌ ERROR: Still no camera states saved! Viewports may not be available.');
      }
    }

    // Ensure cameras remain fixed - restore saved states on EVERY update
    // This aggressively prevents any camera movement
    this._restoreCameraStates();

    // Store initial position
    if (!this.lastPosition) {
      this.lastPosition = position;
      console.log(`📍 [Instrument Projection] Initial position: [${position.map(v => v.toFixed(1)).join(', ')}]`);
      console.log('   ✅ Cameras are fixed - only projection will update');
      console.log(`   Saved camera states for ${this.savedCameraStates.size} viewports`);
    }

    // Extract tool representation from matrix
    const toolRepresentation = this._extractToolRepresentation(position, matrix);

    // Update projection rendering ONLY - do NOT touch camera
    if (this.toolProjectionRenderer) {
      this.toolProjectionRenderer.updateProjection(toolRepresentation);
    }

    // Log periodically
    if (this.updateCount % 100 === 0) {
      console.log('🎯 [Instrument Projection] Mode active');
      console.log(`   Tool position: [${position.map(v => v.toFixed(1)).join(', ')}]`);
      console.log(`   Z-axis: [${toolRepresentation.zAxis.map(v => v.toFixed(3)).join(', ')}]`);
      console.log(`   Update count: ${this.updateCount}`);
      console.log('   ✅ Camera fixed - projection only');
    }

    this.lastPosition = position;
  }

  /**
   * Restore saved camera states to keep cameras fixed
   * This is called on every update to aggressively prevent camera movement
   */
  private _restoreCameraStates(): void {
    if (this.savedCameraStates.size === 0) {
      if (this.updateCount <= 5) {
        console.warn('⚠️ [Instrument Projection] No saved camera states yet');
      }
      return; // No saved states
    }

    const viewports = this.getViewports();

    viewports.forEach(vp => {
      if (!vp || vp.type === 'stack') {
        return;
      }

      const savedState = this.savedCameraStates.get(vp.id);
      if (!savedState) {
        // First time seeing this viewport - save its state now
        try {
          const camera = vp.getCamera();
          this.savedCameraStates.set(vp.id, {
            focalPoint: [...camera.focalPoint],
            position: [...camera.position],
            viewUp: [...camera.viewUp],
          });
          if (this.updateCount <= 5) {
            console.log(`📸 [Instrument Projection] Saved camera state for ${vp.id} (late)`);
          }
        } catch (error) {
          // Ignore
        }
        return;
      }

      try {
        const camera = vp.getCamera();

        // Check if camera has moved from saved state
        const focalPointDiff = Math.sqrt(
          Math.pow(camera.focalPoint[0] - savedState.focalPoint[0], 2) +
          Math.pow(camera.focalPoint[1] - savedState.focalPoint[1], 2) +
          Math.pow(camera.focalPoint[2] - savedState.focalPoint[2], 2)
        );

        // Only restore if camera has moved (to avoid unnecessary updates)
        if (focalPointDiff > 0.01) {
          // CRITICAL: Restore camera to saved state to keep it fixed
          vp.setCamera({
            focalPoint: savedState.focalPoint,
            position: savedState.position,
            viewUp: savedState.viewUp,
          });

          // DO NOT call vp.render() here - it will be called by the viewport automatically

          if (this.updateCount <= 10 || this.updateCount % 100 === 0) {
            console.warn(`⚠️ [Instrument Projection] Camera moved by ${focalPointDiff.toFixed(2)}mm on ${vp.id}, restored to fixed position`);
          }
        }
      } catch (error) {
        if (this.updateCount <= 5) {
          console.warn(`⚠️ [Instrument Projection] Error restoring camera for ${vp.id}:`, error);
        }
      }
    });
  }

  /**
   * Extract tool representation from matrix
   * Extracts origin, z-axis, extension length, etc.
   */
  private _extractToolRepresentation(
    position: number[],
    matrix?: number[] | number[][]
  ): ToolRepresentation {
    // Default z-axis (pointing forward in tool space)
    let zAxis: number[] = [0, 0, 1];

    // Extract Z-axis from transformation matrix
    if (matrix) {
      const rotationMatrix = this._extractRotationMatrix(matrix);

      // Z-axis is the third column of the rotation matrix
      // In transformation matrices, the Z-axis represents the forward direction
      zAxis = [
        rotationMatrix[2][0], // Z-axis X component
        rotationMatrix[2][1], // Z-axis Y component
        rotationMatrix[2][2]  // Z-axis Z component
      ];

      // Normalize z-axis
      const length = Math.sqrt(
        zAxis[0] * zAxis[0] +
        zAxis[1] * zAxis[1] +
        zAxis[2] * zAxis[2]
      );

      if (length > 0.001) {
        zAxis = [
          zAxis[0] / length,
          zAxis[1] / length,
          zAxis[2] / length
        ];
      } else {
        // Fallback to default if matrix is invalid
        zAxis = [0, 0, 1];
      }
    }

    return {
      origin: position,
      zAxis: zAxis,
      extensionLength: this.extensionLength,
    };
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
      const flatMatrix = matrix as number[];
      return [
        [flatMatrix[0], flatMatrix[1], flatMatrix[2]],   // X-axis (right)
        [flatMatrix[4], flatMatrix[5], flatMatrix[6]],   // Y-axis (up)
        [flatMatrix[8], flatMatrix[9], flatMatrix[10]],  // Z-axis (forward)
      ];
    }

    console.warn('⚠️ Invalid matrix format, using identity');
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  }

  /**
   * Set extension length
   */
  public setExtensionLength(length: number): void {
    this.extensionLength = length;
    if (this.toolProjectionRenderer) {
      this.toolProjectionRenderer.setExtensionLength(length);
    }
  }

  /**
   * Get extension length
   */
  public getExtensionLength(): number {
    return this.extensionLength;
  }
}
