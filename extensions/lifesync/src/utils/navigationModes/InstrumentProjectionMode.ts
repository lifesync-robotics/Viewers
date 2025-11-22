/**
 * Instrument Projection Mode
 *
 * Displays tool projection (Z-axis and extension line) as SVG overlay on viewports.
 * Camera is FREE - user can pan/zoom/rotate viewports as needed.
 * Projection dynamically updates based on tool position and current viewport state.
 *
 * Key features:
 * - Real-time SVG projection overlay (Z-axis, origin marker, arrowhead)
 * - Dynamic 3D to 2D projection using viewport.worldToCanvas()
 * - Camera manipulation allowed - projection adapts automatically
 * - Configurable extension line length (default: 100mm)
 */

import NavigationMode from './NavigationMode';
import { ToolProjectionRenderer, ToolRepresentation } from './ToolProjectionRenderer';

export class InstrumentProjectionMode extends NavigationMode {
  private toolProjectionRenderer: ToolProjectionRenderer | null = null;
  private lastPosition: number[] | null = null;
  private extensionLength: number = 100; // 100mm = 10cm default

  constructor(servicesManager: any, coordinateTransformer: any) {
    super(servicesManager, coordinateTransformer);
  }

  getModeName(): string {
    return 'instrument-projection';
  }

  onModeEnter(): void {
    console.log('🎯🎯🎯 Instrument Projection mode activated');
    console.log(`   Extension length: ${this.extensionLength}mm (${this.extensionLength / 10}cm)`);
    console.log('   📹 Camera is FREE - user can pan/zoom/rotate viewports');
    console.log('   📐 Projection will dynamically update based on viewport state');
    this.lastPosition = null;
    this.updateCount = 0; // Reset update count for fresh logs

    // Initialize projection renderer
    this.toolProjectionRenderer = new ToolProjectionRenderer(
      this.servicesManager,
      this.extensionLength
    );

    const viewports = this.getViewports();
    console.log(`   🔍 Found ${viewports.length} viewports on mode enter`);
    console.log('   🎯 Instrument Projection mode is now active and ready');
  }

  // NOTE: Camera state saving/restoring removed - camera is now free to move
  // Projection rendering handles dynamic viewport changes automatically

  onModeExit(): void {
    console.log('🎯 Instrument Projection mode deactivated');
    this.lastPosition = null;

    // Cleanup projection renderer
    if (this.toolProjectionRenderer) {
      this.toolProjectionRenderer.cleanup();
      this.toolProjectionRenderer = null;
    }
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
   * IMPORTANT: This mode updates projection overlay dynamically based on viewport state
   * Camera is FREE - user can pan/zoom/rotate, projection updates accordingly
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
      console.log('   📹 Camera is FREE - projection updates dynamically with viewport changes');
    }

    // Store initial position
    if (!this.lastPosition) {
      this.lastPosition = position;
      console.log(`📍 [Instrument Projection] Initial position: [${position.map(v => v.toFixed(1)).join(', ')}]`);
      console.log('   📐 Projection will update based on tool position and viewport state');
    }

    // Extract tool representation from matrix
    const toolRepresentation = this._extractToolRepresentation(position, matrix);

    // Update projection rendering - ToolProjectionRenderer will handle
    // viewport.worldToCanvas() conversion dynamically based on current camera state
    if (this.toolProjectionRenderer) {
      this.toolProjectionRenderer.updateProjection(toolRepresentation);
    }

    // Log periodically
    if (this.updateCount % 100 === 0) {
      console.log('🎯 [Instrument Projection] Mode active');
      console.log(`   Tool position: [${position.map(v => v.toFixed(1)).join(', ')}]`);
      console.log(`   Z-axis: [${toolRepresentation.zAxis.map(v => v.toFixed(3)).join(', ')}]`);
      console.log(`   Update count: ${this.updateCount}`);
      console.log('   📐 Dynamic projection based on viewport state');
    }

    this.lastPosition = position;
  }

  // NOTE: Camera restoration removed - camera is now free to move
  // ToolProjectionRenderer handles dynamic projection based on current viewport state

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
