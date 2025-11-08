/**
 * Coordinate Transformer
 *
 * Transforms tracking data from register (r) coordinates to DICOM (d) coordinates
 * Uses the rMd transformation matrix from case.json
 *
 * Coordinate Systems:
 * - Register (r): Surgical planning frame (from CT/MRI)
 * - Tracker (t): Optical tracker frame
 * - Patient Reference (pr): Patient-attached marker frame
 * - DICOM (d): Medical imaging frame (what OHIF uses)
 *
 * Transformation: dPos = inv(rMd) @ rPos
 */

export interface TransformMatrix {
  matrix: number[][];  // 4x4 transformation matrix
  description?: string;
  notes?: string;
}

export interface CoordinateTransform {
  rMd: TransformMatrix;  // Register to DICOM
  invRMd?: TransformMatrix;  // DICOM to register (computed)
}

class CoordinateTransformer {
  private rMd: number[][] | null = null;  // Register → DICOM
  private invRMd: number[][] | null = null;  // DICOM → Register (inverse)
  private isIdentity: boolean = false;

  /**
   * Load transformation matrix from case.json
   */
  public loadTransform(rMd: number[][] | TransformMatrix): void {
    // Handle both matrix array and TransformMatrix object
    const matrix = Array.isArray(rMd) ? rMd : rMd.matrix;

    if (!this._validateMatrix(matrix)) {
      console.error('❌ Invalid transformation matrix');
      throw new Error('Invalid rMd matrix - must be 4x4');
    }

    this.rMd = matrix;
    this.invRMd = this._invertMatrix4x4(matrix);
    this.isIdentity = this._isIdentityMatrix(matrix);

    if (this.isIdentity) {
      console.log('🔄 Transformation is identity matrix (register = DICOM)');
    } else {
      console.log('🔄 Transformation matrix loaded:');
      console.log('   rMd (register → DICOM):', this.rMd);
      console.log('   inv(rMd) (DICOM → register):', this.invRMd);
    }
  }

  /**
   * Transform position from register (r) to DICOM (d) coordinates
   *
   * dPos = inv(rMd) @ rPos
   *
   * Why inverse? Because rMd goes from register TO DICOM frame,
   * but we have positions in register and need them in DICOM.
   */
  public registerToDICOM(rPos: number[]): number[] {
    if (!this.invRMd) {
      console.warn('⚠️ No transformation loaded, returning original position');
      return [...rPos];
    }

    // For identity matrix, skip computation
    if (this.isIdentity) {
      return [...rPos];
    }

    // Apply inverse transformation: dPos = inv(rMd) @ rPos
    const [x, y, z] = rPos;
    const invRMd = this.invRMd;

    const dX = invRMd[0][0] * x + invRMd[0][1] * y + invRMd[0][2] * z + invRMd[0][3];
    const dY = invRMd[1][0] * x + invRMd[1][1] * y + invRMd[1][2] * z + invRMd[1][3];
    const dZ = invRMd[2][0] * x + invRMd[2][1] * y + invRMd[2][2] * z + invRMd[2][3];

    return [dX, dY, dZ];
  }

  /**
   * Transform position from DICOM (d) to register (r) coordinates
   *
   * rPos = rMd @ dPos
   */
  public dicomToRegister(dPos: number[]): number[] {
    if (!this.rMd) {
      console.warn('⚠️ No transformation loaded, returning original position');
      return [...dPos];
    }

    // For identity matrix, skip computation
    if (this.isIdentity) {
      return [...dPos];
    }

    // Apply transformation: rPos = rMd @ dPos
    const [x, y, z] = dPos;
    const rMd = this.rMd;

    const rX = rMd[0][0] * x + rMd[0][1] * y + rMd[0][2] * z + rMd[0][3];
    const rY = rMd[1][0] * x + rMd[1][1] * y + rMd[1][2] * z + rMd[1][3];
    const rZ = rMd[2][0] * x + rMd[2][1] * y + rMd[2][2] * z + rMd[2][3];

    return [rX, rY, rZ];
  }

  /**
   * Check if transformation is loaded
   */
  public hasTransform(): boolean {
    return this.rMd !== null;
  }

  /**
   * Check if transformation is identity (no transformation needed)
   */
  public isIdentityTransform(): boolean {
    return this.isIdentity;
  }

  /**
   * Get current transformation matrix
   */
  public getTransform(): { rMd: number[][] | null; invRMd: number[][] | null } {
    return {
      rMd: this.rMd ? this._deepCopy(this.rMd) : null,
      invRMd: this.invRMd ? this._deepCopy(this.invRMd) : null,
    };
  }

  /**
   * Clear transformation
   */
  public clear(): void {
    this.rMd = null;
    this.invRMd = null;
    this.isIdentity = false;
    console.log('🔄 Transformation cleared');
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  /**
   * Validate 4x4 matrix
   */
  private _validateMatrix(matrix: any): boolean {
    if (!Array.isArray(matrix) || matrix.length !== 4) {
      return false;
    }

    for (const row of matrix) {
      if (!Array.isArray(row) || row.length !== 4) {
        return false;
      }
      for (const val of row) {
        if (typeof val !== 'number' || !isFinite(val)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if matrix is identity
   */
  private _isIdentityMatrix(matrix: number[][]): boolean {
    const epsilon = 1e-6;

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const expected = i === j ? 1.0 : 0.0;
        if (Math.abs(matrix[i][j] - expected) > epsilon) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Invert 4x4 transformation matrix
   * Uses adjugate matrix method
   */
  private _invertMatrix4x4(m: number[][]): number[][] {
    const result: number[][] = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];

    // Calculate determinant
    const det = this._det4x4(m);

    if (Math.abs(det) < 1e-10) {
      console.error('❌ Matrix is singular (determinant near zero), cannot invert');
      throw new Error('Singular matrix - cannot invert');
    }

    // Calculate adjugate matrix
    const adj = this._adjugate4x4(m);

    // Inverse = adjugate / determinant
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[i][j] = adj[i][j] / det;
      }
    }

    return result;
  }

  /**
   * Calculate determinant of 4x4 matrix
   */
  private _det4x4(m: number[][]): number {
    const m00 = m[0][0], m01 = m[0][1], m02 = m[0][2], m03 = m[0][3];
    const m10 = m[1][0], m11 = m[1][1], m12 = m[1][2], m13 = m[1][3];
    const m20 = m[2][0], m21 = m[2][1], m22 = m[2][2], m23 = m[2][3];
    const m30 = m[3][0], m31 = m[3][1], m32 = m[3][2], m33 = m[3][3];

    return (
      m03 * m12 * m21 * m30 - m02 * m13 * m21 * m30 -
      m03 * m11 * m22 * m30 + m01 * m13 * m22 * m30 +
      m02 * m11 * m23 * m30 - m01 * m12 * m23 * m30 -
      m03 * m12 * m20 * m31 + m02 * m13 * m20 * m31 +
      m03 * m10 * m22 * m31 - m00 * m13 * m22 * m31 -
      m02 * m10 * m23 * m31 + m00 * m12 * m23 * m31 +
      m03 * m11 * m20 * m32 - m01 * m13 * m20 * m32 -
      m03 * m10 * m21 * m32 + m00 * m13 * m21 * m32 +
      m01 * m10 * m23 * m32 - m00 * m11 * m23 * m32 -
      m02 * m11 * m20 * m33 + m01 * m12 * m20 * m33 +
      m02 * m10 * m21 * m33 - m00 * m12 * m21 * m33 -
      m01 * m10 * m22 * m33 + m00 * m11 * m22 * m33
    );
  }

  /**
   * Calculate adjugate (adjoint) of 4x4 matrix
   */
  private _adjugate4x4(m: number[][]): number[][] {
    const result: number[][] = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];

    // Calculate cofactor matrix (with sign alternation)
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const sign = ((i + j) % 2 === 0) ? 1 : -1;
        const minor = this._minor3x3(m, i, j);
        result[j][i] = sign * minor;  // Note: transposed (j, i)
      }
    }

    return result;
  }

  /**
   * Calculate 3x3 minor (determinant of submatrix)
   */
  private _minor3x3(m: number[][], row: number, col: number): number {
    const sub: number[] = [];

    for (let i = 0; i < 4; i++) {
      if (i === row) continue;
      for (let j = 0; j < 4; j++) {
        if (j === col) continue;
        sub.push(m[i][j]);
      }
    }

    // Calculate 3x3 determinant
    return (
      sub[0] * (sub[4] * sub[8] - sub[5] * sub[7]) -
      sub[1] * (sub[3] * sub[8] - sub[5] * sub[6]) +
      sub[2] * (sub[3] * sub[7] - sub[4] * sub[6])
    );
  }

  /**
   * Deep copy matrix
   */
  private _deepCopy(matrix: number[][]): number[][] {
    return matrix.map(row => [...row]);
  }
}

export default CoordinateTransformer;

