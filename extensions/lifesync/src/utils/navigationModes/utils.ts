/**
 * Navigation Modes Utilities
 *
 * Common utility functions for navigation modes, including:
 * - Debugging and logging functions
 * - Matrix calculation and manipulation
 * - Validation and checking functions
 * - Camera and viewport utilities
 * - Tool representation utilities
 */

import { vec3 } from 'gl-matrix';
import { Types as cs3DTypes } from '@cornerstonejs/core';

// ============================================================================
// DEBUGGING UTILITIES
// ============================================================================

/**
 * Debug counter for tracking per-viewport debug state
 */
export class DebugCounter {
  private counters = new Map<string, number>();

  /**
   * Get current count for a viewport, incrementing it
   */
  getAndIncrement(viewportId: string): number {
    const current = this.counters.get(viewportId) || 0;
    this.counters.set(viewportId, current + 1);
    return current + 1;
  }

  /**
   * Get current count for a viewport without incrementing
   */
  get(viewportId: string): number {
    return this.counters.get(viewportId) || 0;
  }

  /**
   * Reset counter for a viewport
   */
  reset(viewportId: string): void {
    this.counters.delete(viewportId);
  }

  /**
   * Reset all counters
   */
  resetAll(): void {
    this.counters.clear();
  }
}

/**
 * Prefixed logging utilities with consistent formatting
 */
export class Logger {
  private prefix: string;

  constructor(prefix: string = '[NavMode]') {
    this.prefix = prefix;
  }

  log(...args: any[]): void {
    console.log(this.prefix, ...args);
  }

  warn(...args: any[]): void {
    console.warn(this.prefix, ...args);
  }

  error(...args: any[]): void {
    console.error(this.prefix, ...args);
  }
}

/**
 * Check if debug logging should be enabled for current frame
 * Logs first N frames for each viewport to avoid spam
 */
export function shouldLogDebug(currentCount: number, maxFrames: number = 20): boolean {
  return currentCount >= 1 && currentCount <= maxFrames;
}

/**
 * Log matrix in readable format with proper labeling
 */
export function logMatrix(matrix: number[] | number[][], label: string = 'Matrix'): void {
  console.log(`\n📐 ${label}:`);
  if (Array.isArray(matrix) && matrix.length === 4 && Array.isArray(matrix[0])) {
    console.log('   Format: 2D array [row][col]');
    (matrix as number[][]).forEach((row, i) => {
      const rowLabel = i === 0 ? 'X-axis + Tx' : i === 1 ? 'Y-axis + Ty' : i === 2 ? 'Z-axis + Tz' : 'Homogeneous';
      console.log(`   Row ${i} (${rowLabel}): [${row.map(v => v.toFixed(3)).join(', ')}]`);
    });
  } else if (Array.isArray(matrix) && matrix.length >= 16) {
    console.log('   Format: Flat 16-element array (row-major layout)');
    const flat = matrix as number[];
    console.log(`   Row 0: [${flat.slice(0, 4).map(v => v.toFixed(3)).join(', ')}] (X-axis + Tx)`);
    console.log(`   Row 1: [${flat.slice(4, 8).map(v => v.toFixed(3)).join(', ')}] (Y-axis + Ty)`);
    console.log(`   Row 2: [${flat.slice(8, 12).map(v => v.toFixed(3)).join(', ')}] (Z-axis + Tz)`);
    console.log(`   Row 3: [${flat.slice(12, 16).map(v => v.toFixed(3)).join(', ')}] (Homogeneous)`);
  }
}

// ============================================================================
// MATRIX CALCULATION UTILITIES
// ============================================================================

/**
 * Convert matrix to 2D format (4x4 row-major)
 */
export function convertTo2DMatrix(matrix: number[] | number[][]): number[][] {
  // Check if already 2D array
  if (Array.isArray(matrix) && matrix.length === 4 && Array.isArray(matrix[0])) {
    return matrix as number[][];
  }

  // Convert flat array to 2D
  if (Array.isArray(matrix) && matrix.length >= 16 && typeof matrix[0] === 'number') {
    const flat = matrix as number[];
    return [
      [flat[0], flat[1], flat[2], flat[3]],
      [flat[4], flat[5], flat[6], flat[7]],
      [flat[8], flat[9], flat[10], flat[11]],
      [flat[12], flat[13], flat[14], flat[15]]
    ];
  }

  // Invalid format, return identity
  console.warn('⚠️ Invalid matrix format, returning identity');
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ];
}

/**
 * Update matrix translation component with new position
 * Preserves rotation, updates only translation (last column)
 */
export function updateMatrixTranslation(matrix: number[][], newPosition: number[]): number[][] {
  return [
    [matrix[0][0], matrix[0][1], matrix[0][2], newPosition[0]],
    [matrix[1][0], matrix[1][1], matrix[1][2], newPosition[1]],
    [matrix[2][0], matrix[2][1], matrix[2][2], newPosition[2]],
    [matrix[3][0], matrix[3][1], matrix[3][2], matrix[3][3]]
  ];
}

/**
 * Extract 3x3 rotation matrix from 4x4 transformation matrix
 * Handles both flat array and 2D array formats
 */
export function extractRotationMatrix(matrix: number[] | number[][]): number[][] {
  if (!matrix) {
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  }

  // Check if matrix is 2D array (4x4)
  if (Array.isArray(matrix) && matrix.length === 4 && Array.isArray(matrix[0])) {
    return [
      [matrix[0][0], matrix[0][1], matrix[0][2]],  // Row 0
      [matrix[1][0], matrix[1][1], matrix[1][2]],  // Row 1
      [matrix[2][0], matrix[2][1], matrix[2][2]],  // Row 2
    ];
  }

  // Check if matrix is flat array (16 elements, row-major layout)
  if (Array.isArray(matrix) && matrix.length >= 16 && typeof matrix[0] === 'number') {
    const flat = matrix as number[];
    return [
      [flat[0], flat[1], flat[2]],     // Row 0
      [flat[4], flat[5], flat[6]],     // Row 1
      [flat[8], flat[9], flat[10]],    // Row 2
    ];
  }

  return [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
}

/**
 * Extract axis from rotation matrix (column-major convention)
 */
export function extractAxis(rotationMatrix: number[][], axisIndex: number): number[] {
  return [
    rotationMatrix[0][axisIndex],
    rotationMatrix[1][axisIndex],
    rotationMatrix[2][axisIndex]
  ];
}

// ============================================================================
// VALIDATION AND CHECKING UTILITIES
// ============================================================================

/**
 * Check if canvas point is valid and within viewport bounds
 */
export function isValidCanvasPoint(point: number[] | null): boolean {
  if (!point || point.length < 2) {
    return false;
  }

  const [x, y] = point;

  // Check for NaN or Infinity
  if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
    return false;
  }

  // Points can be outside viewport bounds but still valid
  // (we'll clip the line if needed)
  return true;
}

/**
 * Check if two normals are approximately equal (within tolerance)
 */
export function normalsMatch(normal1: vec3, normal2: vec3, tolerance: number = 0.1): boolean {
  const diff = vec3.subtract(vec3.create(), normal1, normal2);
  const distance = vec3.length(diff);
  return distance < tolerance;
}

/**
 * Identify viewport type by name (axial, coronal, sagittal)
 * Returns the viewport type or null if unknown
 */
export function identifyViewportType(viewport: any): 'axial' | 'coronal' | 'sagittal' | null {
  const viewportId = viewport.id;
  if (!viewportId) {
    return null;  // Handle null/undefined gracefully
  }

  const viewportIdLower = viewportId.toLowerCase();

  if (viewportIdLower.includes('axial')) {
    return 'axial';
  } else if (viewportIdLower.includes('coronal')) {
    return 'coronal';
  } else if (viewportIdLower.includes('sagittal')) {
    return 'sagittal';
  }

  return null;
}

/**
 * Get the expected plane normal for a viewport type
 */
export function getStandardPlaneNormal(viewportType: 'axial' | 'coronal' | 'sagittal'): vec3 {
  const standardNormals = {
    'axial': vec3.fromValues(0, 0, 1),      // Z-axis (superior-inferior)
    'sagittal': vec3.fromValues(1, 0, 0),   // X-axis (left-right)
    'coronal': vec3.fromValues(0, 1, 0)     // Y-axis (anterior-posterior)
  };

  return standardNormals[viewportType];
}

// ============================================================================
// CAMERA AND VIEWPORT UTILITIES
// ============================================================================

/**
 * Determine viewport orientation type from viewport ID
 */
export function getViewportOrientation(viewportId: string): string {
  const id = viewportId.toLowerCase();

  if (id.includes('axial')) {
    return 'axial';
  } else if (id.includes('sagittal')) {
    return 'sagittal';
  } else if (id.includes('coronal')) {
    return 'coronal';
  }

  // Default to axial for unrecognized viewports
  return 'axial';
}

/**
 * Get camera configuration for a specific view type
 */
export function getCameraConfigForView(
  viewType: string,
  tooltipPosition: cs3DTypes.Point3,
  tooltip2dicom: number[][],
  cameraDistance: number = 350
): { focalPoint: cs3DTypes.Point3; position: cs3DTypes.Point3; viewUp: cs3DTypes.Point3 } {
  // Extract tooltip orientation axes from matrix
  const tooltipXAxis = vec3.fromValues(tooltip2dicom[0][0], tooltip2dicom[1][0], tooltip2dicom[2][0]);
  const tooltipYAxis = vec3.fromValues(tooltip2dicom[0][1], tooltip2dicom[1][1], tooltip2dicom[2][1]);
  const tooltipZAxis = vec3.fromValues(tooltip2dicom[0][2], tooltip2dicom[1][2], tooltip2dicom[2][2]);

  vec3.normalize(tooltipXAxis, tooltipXAxis);
  vec3.normalize(tooltipYAxis, tooltipYAxis);
  vec3.normalize(tooltipZAxis, tooltipZAxis);

  let viewDirection: vec3;
  let viewUp: vec3;

  switch (viewType) {
    case 'axial':
      // Axial view: looking down along Z-axis (superior → inferior)
      viewDirection = vec3.fromValues(0, 0, -1); // Looking down
      viewUp = vec3.clone(tooltipYAxis); // Tooltip Y-axis points up in view
      break;

    case 'sagittal':
      // Sagittal view: looking from side along X-axis (left → right or right → left)
      viewDirection = vec3.clone(tooltipXAxis); // Looking along tooltip X-axis
      vec3.negate(viewDirection, viewDirection);
      viewUp = vec3.fromValues(0, 0, 1); // Z-axis (superior) points up
      break;

    case 'coronal':
      // Coronal view: looking from front/back along Y-axis (anterior → posterior or posterior → anterior)
      viewDirection = vec3.clone(tooltipYAxis); // Looking along tooltip Y-axis
      vec3.negate(viewDirection, viewDirection);
      viewUp = vec3.fromValues(0, 0, 1); // Z-axis (superior) points up
      break;

    default:
      // Default to axial
      viewDirection = vec3.fromValues(0, 0, -1);
      viewUp = vec3.clone(tooltipYAxis);
      break;
  }

  // Normalize vectors
  vec3.normalize(viewDirection, viewDirection);
  vec3.normalize(viewUp, viewUp);

  // Ensure viewUp is orthogonal to viewDirection
  const dot = vec3.dot(viewUp, viewDirection);
  const projection = vec3.scale(vec3.create(), viewDirection, dot);
  const orthogonalViewUp = vec3.subtract(vec3.create(), viewUp, projection);
  vec3.normalize(orthogonalViewUp, orthogonalViewUp);

  // Camera position: tooltip + viewDirection * CAMERA_DISTANCE
  const cameraPosition: cs3DTypes.Point3 = [
    tooltipPosition[0] - viewDirection[0] * cameraDistance,
    tooltipPosition[1] - viewDirection[1] * cameraDistance,
    tooltipPosition[2] - viewDirection[2] * cameraDistance
  ];

  return {
    focalPoint: tooltipPosition,
    position: cameraPosition,
    viewUp: [orthogonalViewUp[0], orthogonalViewUp[1], orthogonalViewUp[2]]
  };
}

// ============================================================================
// TOOL REPRESENTATION UTILITIES
// ============================================================================

export interface ToolRepresentation {
  origin: number[]; // [x, y, z] in world coordinates
  zAxis: number[]; // [x, y, z] normalized direction vector
  extensionLength: number; // Length of extension line in mm
  tipPoint?: number[]; // Calculated: origin + zAxis * extensionLength
}

/**
 * Extract tool representation from position and matrix
 */
export function extractToolRepresentation(
  position: number[],
  matrix: number[] | number[][] | undefined,
  extensionLength: number = 50
): ToolRepresentation {
  // Default z-axis (pointing forward in tool space)
  let zAxis: number[] = [0, 0, 1];

  // Extract Z-axis from transformation matrix
  if (matrix) {
    const rotationMatrix = extractRotationMatrix(matrix);

    // COLUMN-MAJOR extraction (standard OpenGL/graphics convention)
    const zAxisColumnMajor = extractAxis(rotationMatrix, 2); // Z-axis is column 2

    zAxis = zAxisColumnMajor;

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
    extensionLength: extensionLength,
  };
}

/**
 * Calculate tip point: origin + zAxis * extensionLength
 */
export function calculateTipPoint(toolRep: ToolRepresentation): number[] {
  const zAxis = vec3.fromValues(
    toolRep.zAxis[0],
    toolRep.zAxis[1],
    toolRep.zAxis[2]
  );

  // Scale zAxis by extension length
  vec3.scale(zAxis, zAxis, toolRep.extensionLength);

  return [
    toolRep.origin[0] + zAxis[0],
    toolRep.origin[1] + zAxis[1],
    toolRep.origin[2] + zAxis[2]
  ];
}

/**
 * Calculate instrument base point: origin - zAxis * instrumentLength
 */
export function calculateInstrumentBase(toolRep: ToolRepresentation, instrumentLength: number): number[] {
  const zAxis = vec3.fromValues(
    toolRep.zAxis[0],
    toolRep.zAxis[1],
    toolRep.zAxis[2]
  );

  // Scale zAxis by instrument length (negative direction)
  vec3.scale(zAxis, zAxis, -instrumentLength);

  return [
    toolRep.origin[0] + zAxis[0],
    toolRep.origin[1] + zAxis[1],
    toolRep.origin[2] + zAxis[2]
  ];
}
