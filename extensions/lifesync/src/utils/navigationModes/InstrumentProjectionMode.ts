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

// Import configuration (optional - will use defaults if not available)
let projectionConfig: { extensionLength?: number; instrumentLength?: number } | null = null;
try {
  // Try to load configuration file (this will be bundled at build time)
  projectionConfig = require('./instrumentProjection.config.json');
} catch (e) {
  // Configuration file not found, use defaults
  projectionConfig = null;
}

export class InstrumentProjectionMode extends NavigationMode {
  private toolProjectionRenderer: ToolProjectionRenderer | null = null;
  private lastPosition: number[] | null = null;
  private extensionLength: number = projectionConfig?.extensionLength ?? 50; // 50mm = 5cm default
  private instrumentLength: number = projectionConfig?.instrumentLength ?? 200; // 200mm = 20cm default

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
    this.lastPosition = null;
    this.updateCount = 0; // Reset update count for fresh logs

    // Initialize projection renderer
    this.toolProjectionRenderer = new ToolProjectionRenderer(
      this.servicesManager,
      this.extensionLength,
      this.instrumentLength
    );

    const viewports = this.getViewports();
    console.log(`   🔍 Found ${viewports.length} viewports on mode enter`);
    console.log('   🎯 Instrument Projection mode is now active (projection rendering enabled)');
  }

  // NOTE: Camera state saving/restoring removed - camera is now free to move
  // Projection rendering handles dynamic viewport changes automatically

  onModeExit(): void {
    console.log('🎯 Instrument Projection mode deactivated');
    this.lastPosition = null;

    // Cleanup projection renderer and clear all projections
    if (this.toolProjectionRenderer) {
      // Clear all viewport projections before cleanup
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

    // Debug logging (frames 1-20 for matrix extraction, then 10-30 for projection)
    const shouldLog = this.updateCount >= 1 && this.updateCount <= 20;

    // Extract Z-axis from transformation matrix
    if (matrix) {
      const rotationMatrix = this._extractRotationMatrix(matrix);

      if (shouldLog) {
        console.log(`\n🔧 ====== TOOL MATRIX DEBUG (Frame ${this.updateCount}) ======`);
        console.log(`📍 Tool Position (Translation): [${position.map(v => v.toFixed(3)).join(', ')}]`);
        
        // Log raw matrix
        console.log('\n📐 Raw Transformation Matrix (4x4):');
        if (Array.isArray(matrix[0])) {
          console.log('   Format: 2D array [row][col]');
          (matrix as number[][]).forEach((row, i) => {
            const rowLabel = i === 0 ? 'X-axis + Tx' : i === 1 ? 'Y-axis + Ty' : i === 2 ? 'Z-axis + Tz' : 'Homogeneous';
            console.log(`   Row ${i} (${rowLabel}): [${row.map(v => v.toFixed(3)).join(', ')}]`);
          });
          console.log('   Matrix Structure:');
          console.log('   [Xx  Xy  Xz  Tx]');
          console.log('   [Yx  Yy  Yz  Ty]');
          console.log('   [Zx  Zy  Zz  Tz]');
          console.log('   [0   0   0   1 ]');
        } else {
          console.log('   Format: Flat 16-element array (row-major layout)');
          console.log(`   Row 0: [${(matrix as number[]).slice(0, 4).map(v => v.toFixed(3)).join(', ')}] (X-axis + Tx)`);
          console.log(`   Row 1: [${(matrix as number[]).slice(4, 8).map(v => v.toFixed(3)).join(', ')}] (Y-axis + Ty)`);
          console.log(`   Row 2: [${(matrix as number[]).slice(8, 12).map(v => v.toFixed(3)).join(', ')}] (Z-axis + Tz)`);
          console.log(`   Row 3: [${(matrix as number[]).slice(12, 16).map(v => v.toFixed(3)).join(', ')}] (Homogeneous)`);
        }
        
        console.log('\n🔄 Extracted Rotation Matrix (3x3):');
        console.log('   (Top-left 3x3 of transformation matrix)');
        rotationMatrix.forEach((row, i) => {
          const axisName = i === 0 ? 'Row 0 (X components)' : i === 1 ? 'Row 1 (Y components)' : 'Row 2 (Z components)';
          console.log(`   ${axisName}: [${row.map(v => v.toFixed(3)).join(', ')}]`);
        });
        
        // Extract all axes for verification
        const xAxisCol = [rotationMatrix[0][0], rotationMatrix[1][0], rotationMatrix[2][0]];
        const yAxisCol = [rotationMatrix[0][1], rotationMatrix[1][1], rotationMatrix[2][1]];
        const zAxisCol = [rotationMatrix[0][2], rotationMatrix[1][2], rotationMatrix[2][2]];
        
        console.log('\n📊 Extracted Axes (Column-Major - Standard Graphics):');
        console.log(`   X-axis (Col 0): [${xAxisCol.map(v => v.toFixed(3)).join(', ')}]`);
        console.log(`   Y-axis (Col 1): [${yAxisCol.map(v => v.toFixed(3)).join(', ')}]`);
        console.log(`   Z-axis (Col 2): [${zAxisCol.map(v => v.toFixed(3)).join(', ')}] ⬅ TOOL POINTING DIRECTION`);
        
        // Verify orthonormality
        const xLen = Math.sqrt(xAxisCol[0]**2 + xAxisCol[1]**2 + xAxisCol[2]**2);
        const yLen = Math.sqrt(yAxisCol[0]**2 + yAxisCol[1]**2 + yAxisCol[2]**2);
        const zLen = Math.sqrt(zAxisCol[0]**2 + zAxisCol[1]**2 + zAxisCol[2]**2);
        console.log('\n✓ Verification:');
        console.log(`   |X-axis| = ${xLen.toFixed(3)} ${Math.abs(xLen - 1.0) < 0.01 ? '✓' : '⚠️ Should be 1.0'}`);
        console.log(`   |Y-axis| = ${yLen.toFixed(3)} ${Math.abs(yLen - 1.0) < 0.01 ? '✓' : '⚠️ Should be 1.0'}`);
        console.log(`   |Z-axis| = ${zLen.toFixed(3)} ${Math.abs(zLen - 1.0) < 0.01 ? '✓' : '⚠️ Should be 1.0'}`);
      }

      // Z-axis is the third column of the rotation matrix
      // In transformation matrices, the Z-axis represents the forward direction
      
      // COLUMN-MAJOR (Standard OpenGL/Graphics convention)
      // Axes are stored in COLUMNS of the rotation matrix:
      //   Column 0 = X-axis (right)
      //   Column 1 = Y-axis (up) 
      //   Column 2 = Z-axis (forward)
      const zAxisColumnMajor = [
        rotationMatrix[0][2], // Z-axis X component (row 0, col 2)
        rotationMatrix[1][2], // Z-axis Y component (row 1, col 2)
        rotationMatrix[2][2]  // Z-axis Z component (row 2, col 2)
      ];

      // ROW-MAJOR (Alternative convention - NOT standard for graphics)
      // Axes stored in ROWS of the rotation matrix:
      //   Row 0 = X-axis (right)
      //   Row 1 = Y-axis (up)
      //   Row 2 = Z-axis (forward)
      const zAxisRowMajor = [
        rotationMatrix[2][0], // Z-axis X component (row 2, col 0)
        rotationMatrix[2][1], // Z-axis Y component (row 2, col 1)
        rotationMatrix[2][2]  // Z-axis Z component (row 2, col 2) - same for both
      ];

      if (shouldLog) {
        console.log('\n🎯 Z-Axis Extraction Comparison:');
        console.log(`   ✅ Column-major (OpenGL standard): [${zAxisColumnMajor.map(v => v.toFixed(3)).join(', ')}]`);
        console.log(`   ❌ Row-major (old/incorrect):      [${zAxisRowMajor.map(v => v.toFixed(3)).join(', ')}]`);
        
        // Check if they're the same (symmetric matrix)
        const areSame = zAxisRowMajor.every((v, i) => Math.abs(v - zAxisColumnMajor[i]) < 0.001);
        if (areSame) {
          console.log('   ℹ️ Both conventions give same result (symmetric matrix or Z-aligned)');
        } else {
          console.log('   ⚠️ CONVENTIONS DIFFER - Using COLUMN-MAJOR (correct for graphics)');
          console.log(`   ΔX: ${(zAxisColumnMajor[0] - zAxisRowMajor[0]).toFixed(3)}`);
          console.log(`   ΔY: ${(zAxisColumnMajor[1] - zAxisRowMajor[1]).toFixed(3)}`);
          console.log(`   ΔZ: ${(zAxisColumnMajor[2] - zAxisRowMajor[2]).toFixed(3)}`);
        }
      }

      // ✅ FIX: Use COLUMN-MAJOR extraction (standard OpenGL/graphics convention)
      zAxis = zAxisColumnMajor;

      // Normalize z-axis
      const length = Math.sqrt(
        zAxis[0] * zAxis[0] +
        zAxis[1] * zAxis[1] +
        zAxis[2] * zAxis[2]
      );

      if (length > 0.001) {
        const normalizedZAxis = [
          zAxis[0] / length,
          zAxis[1] / length,
          zAxis[2] / length
        ];
        
        if (shouldLog) {
          console.log(`📏 Normalization:`);
          console.log(`   Length: ${length.toFixed(3)}`);
          console.log(`   Normalized: [${normalizedZAxis.map(v => v.toFixed(3)).join(', ')}]`);
        }
        
        zAxis = normalizedZAxis;
      } else {
        // Fallback to default if matrix is invalid
        if (shouldLog) {
          console.log('⚠️ Invalid Z-axis length, using default [0, 0, 1]');
        }
        zAxis = [0, 0, 1];
      }

      if (shouldLog) {
        console.log(`\n✅ FINAL EXTRACTED Z-AXIS (Tool Direction):`);
        console.log(`   Vector: [${zAxis.map(v => v.toFixed(3)).join(', ')}]`);
        console.log(`   Length: ${Math.sqrt(zAxis[0]**2 + zAxis[1]**2 + zAxis[2]**2).toFixed(3)} (should be 1.0)`);
        console.log(`   X-component: ${zAxis[0].toFixed(3)} ${zAxis[0] > 0 ? '(+X/right)' : zAxis[0] < 0 ? '(-X/left)' : '(no X)'}`);
        console.log(`   Y-component: ${zAxis[1].toFixed(3)} ${zAxis[1] > 0 ? '(+Y/anterior)' : zAxis[1] < 0 ? '(-Y/posterior)' : '(no Y)'}`);
        console.log(`   Z-component: ${zAxis[2].toFixed(3)} ${zAxis[2] > 0 ? '(+Z/superior)' : zAxis[2] < 0 ? '(-Z/inferior)' : '(no Z)'}`);
        console.log('====== END MATRIX DEBUG ======\n');
      }
    } else {
      if (shouldLog) {
        console.log('⚠️ No matrix provided, using default Z-axis [0, 0, 1]');
      }
    }

    // Calculate derived points for comprehensive logging
    if (shouldLog) {
      const tipPoint = [
        position[0] + zAxis[0] * this.extensionLength,
        position[1] + zAxis[1] * this.extensionLength,
        position[2] + zAxis[2] * this.extensionLength
      ];
      
      const basePoint = [
        position[0] - zAxis[0] * this.instrumentLength,
        position[1] - zAxis[1] * this.instrumentLength,
        position[2] - zAxis[2] * this.instrumentLength
      ];

      console.log('\n📦 Tool Representation (World Coordinates):');
      console.log(`   Origin (tool tip): [${position.map(v => v.toFixed(1)).join(', ')}]`);
      console.log(`   Z-Axis (direction): [${zAxis.map(v => v.toFixed(3)).join(', ')}]`);
      console.log(`   Extension length: ${this.extensionLength}mm`);
      console.log(`   Instrument length: ${this.instrumentLength}mm`);
      console.log(`\n   Calculated Points:`);
      console.log(`   • Base (origin - Z×${this.instrumentLength}): [${basePoint.map(v => v.toFixed(1)).join(', ')}]`);
      console.log(`   • Origin (tool tip):                         [${position.map(v => v.toFixed(1)).join(', ')}]`);
      console.log(`   • Tip (origin + Z×${this.extensionLength}):  [${tipPoint.map(v => v.toFixed(1)).join(', ')}]`);
      console.log(`\n   3D Line Total Length: ${(this.instrumentLength + this.extensionLength).toFixed(1)}mm`);
      console.log(`   (Base → Origin: ${this.instrumentLength}mm, Origin → Tip: ${this.extensionLength}mm)`);
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
   * 
   * Matrix layout (row-major storage, column-major semantics):
   * [Xx  Xy  Xz  Tx]    [m00 m01 m02 m03]    [0  1  2  3 ]
   * [Yx  Yy  Yz  Ty] =  [m10 m11 m12 m13] =  [4  5  6  7 ]
   * [Zx  Zy  Zz  Tz]    [m20 m21 m22 m23]    [8  9  10 11]
   * [0   0   0   1 ]    [m30 m31 m32 m33]    [12 13 14 15]
   * 
   * The extracted 3x3 rotation matrix preserves the layout:
   * Row 0: [Xx, Xy, Xz] - Contains X, Y, Z components of X-axis
   * Row 1: [Yx, Yy, Yz] - Contains X, Y, Z components of Y-axis
   * Row 2: [Zx, Zy, Zz] - Contains X, Y, Z components of Z-axis
   * 
   * To extract axes (COLUMN-MAJOR):
   * - X-axis = Column 0 = [Xx, Yx, Zx] = [row0[0], row1[0], row2[0]]
   * - Y-axis = Column 1 = [Xy, Yy, Zy] = [row0[1], row1[1], row2[1]]
   * - Z-axis = Column 2 = [Xz, Yz, Zz] = [row0[2], row1[2], row2[2]]
   */
  private _extractRotationMatrix(matrix: number[] | number[][]): number[][] {
    if (!matrix) {
      console.warn('⚠️ [Matrix Extraction] Matrix is null, using identity');
      return [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];
    }

    // Check if matrix is 2D array (4x4)
    if (Array.isArray(matrix) && matrix.length === 4 && Array.isArray(matrix[0])) {
      // Extract top-left 3x3 submatrix
      const rotation = [
        [matrix[0][0], matrix[0][1], matrix[0][2]],  // Row 0: [Xx, Xy, Xz]
        [matrix[1][0], matrix[1][1], matrix[1][2]],  // Row 1: [Yx, Yy, Yz]
        [matrix[2][0], matrix[2][1], matrix[2][2]],  // Row 2: [Zx, Zy, Zz]
      ];
      return rotation;
    }

    // Check if matrix is flat array (16 elements, row-major layout)
    if (Array.isArray(matrix) && matrix.length >= 16 && typeof matrix[0] === 'number') {
      const flatMatrix = matrix as number[];
      // Flat array indices for row-major 4x4:
      // Row 0: indices 0,1,2,3   Row 1: indices 4,5,6,7
      // Row 2: indices 8,9,10,11 Row 3: indices 12,13,14,15
      const rotation = [
        [flatMatrix[0], flatMatrix[1], flatMatrix[2]],     // Row 0: [Xx, Xy, Xz]
        [flatMatrix[4], flatMatrix[5], flatMatrix[6]],     // Row 1: [Yx, Yy, Yz]
        [flatMatrix[8], flatMatrix[9], flatMatrix[10]],    // Row 2: [Zx, Zy, Zz]
      ];
      return rotation;
    }

    console.warn('⚠️ [Matrix Extraction] Invalid matrix format, using identity');
    console.warn(`   Matrix type: ${typeof matrix}, length: ${Array.isArray(matrix) ? matrix.length : 'N/A'}`);
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
    // Enforce non-negative values to prevent inverted or undefined projections
    const safeLength = Number.isFinite(length) ? Math.max(0, length) : 0;
    this.extensionLength = safeLength;

    if (this.toolProjectionRenderer) {
      this.toolProjectionRenderer.setExtensionLength(safeLength);
    }
  }

  /**
   * Get extension length
   */
  public getExtensionLength(): number {
    return this.extensionLength;
  }

  /**
   * Set instrument length
   */
  public setInstrumentLength(length: number): void {
    this.instrumentLength = length;
    if (this.toolProjectionRenderer) {
      this.toolProjectionRenderer.setInstrumentLength(length);
    }
  }

  /**
   * Get instrument length
   */
  public getInstrumentLength(): number {
    return this.instrumentLength;
  }
}
