/**
 * Adjacent Screw Finder
 * 
 * Utilities for finding adjacent screws to copy orientation and angles.
 * Used to speed up screw placement by reusing angles from nearby screws.
 */

import { isAdjacentLevel, parseVertebralLevel } from '../../utils/vertebralLevelUtils';

/**
 * Adjacent screw data structure
 * Contains all information needed to copy orientation and angles
 */
export interface AdjacentScrewData {
  screw_id: string;
  screw_label: string;
  vertebralLevel: string;
  side: string;
  transform_matrix: number[];
  trajectory: {
    convergenceAngle: number;
    cephaladAngle: number;
    direction: number[];
  };
  radius: number;
  length: number;
}

/**
 * Find adjacent screw for orientation copying
 * 
 * Searches for screws on the same side at vertebral level ±1
 * Priority: closest level, then most recently placed
 * 
 * @param targetLevel - Target vertebral level (e.g., "L3")
 * @param targetSide - Target side ("left" or "right")
 * @param existingScrews - Array of existing screw data from backend
 * @returns Adjacent screw data or null if not found
 * 
 * @example
 * // Placing L3L, finds L2L or L4L
 * findAdjacentScrew("L3", "left", screws)
 * 
 * // Placing L1L, can find T12L (cross-region)
 * findAdjacentScrew("L1", "left", screws)
 */
export function findAdjacentScrew(
  targetLevel: string,
  targetSide: string,
  existingScrews: any[]
): AdjacentScrewData | null {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 [AdjacentScrewFinder] SEARCHING FOR ADJACENT SCREW');
  console.log(`   Target: ${targetLevel} (${targetSide})`);
  console.log(`   Existing screws: ${existingScrews.length}`);
  console.log('═══════════════════════════════════════════════════════');

  if (!targetLevel || !targetSide || !existingScrews || existingScrews.length === 0) {
    console.log('⚠️ No existing screws to search');
    return null;
  }

  // Parse target level for validation
  const parsedTarget = parseVertebralLevel(targetLevel);
  if (!parsedTarget) {
    console.warn(`⚠️ Invalid target level: ${targetLevel}`);
    return null;
  }

  // Normalize side for comparison (handle "left", "L", "right", "R")
  const normalizedTargetSide = normalizeSide(targetSide);
  if (!normalizedTargetSide) {
    console.warn(`⚠️ Invalid target side: ${targetSide}`);
    return null;
  }

  // Filter screws by:
  // 1. Same side
  // 2. Adjacent vertebral level (±1)
  // 3. Has valid transform matrix and trajectory data
  const candidates: Array<{screw: any; distance: number}> = [];

  for (const screw of existingScrews) {
    // Skip if no vertebral level or side
    const screwLevel = screw.vertebral_level || screw.vertebralLevel;
    const screwSide = screw.side;
    
    if (!screwLevel || !screwSide) {
      continue;
    }

    // Check if same side
    const normalizedScrewSide = normalizeSide(screwSide);
    if (normalizedScrewSide !== normalizedTargetSide) {
      continue;
    }

    // Check if adjacent level
    if (!isAdjacentLevel(targetLevel, screwLevel)) {
      continue;
    }

    // Check if has transform matrix
    const transformMatrix = screw.transform_matrix || screw.transformMatrix;
    if (!transformMatrix || !Array.isArray(transformMatrix) || transformMatrix.length !== 16) {
      console.warn(`⚠️ Screw ${screw.screw_id} at ${screwLevel} has invalid transform matrix`);
      continue;
    }

    // Check if has trajectory data
    const trajectory = screw.trajectory;
    if (!trajectory) {
      console.warn(`⚠️ Screw ${screw.screw_id} at ${screwLevel} has no trajectory data`);
      continue;
    }

    // Valid candidate - calculate distance for prioritization
    const parsedScrewLevel = parseVertebralLevel(screwLevel);
    if (!parsedScrewLevel) {
      continue;
    }

    const distance = Math.abs(parsedScrewLevel.number - parsedTarget.number);
    
    candidates.push({
      screw,
      distance,
    });

    console.log(`✅ Found candidate: ${screwLevel} (${screwSide}) - distance ${distance}`);
  }

  if (candidates.length === 0) {
    console.log('❌ No adjacent screws found');
    return null;
  }

  // Sort by distance (closest first), then by placement time (most recent first)
  candidates.sort((a, b) => {
    if (a.distance !== b.distance) {
      return a.distance - b.distance;
    }
    
    // If same distance, prefer most recently placed
    const timeA = new Date(a.screw.placed_at || a.screw.placedAt || 0).getTime();
    const timeB = new Date(b.screw.placed_at || b.screw.placedAt || 0).getTime();
    return timeB - timeA; // Descending (most recent first)
  });

  // Use the best candidate (closest, most recent)
  const bestCandidate = candidates[0].screw;
  
  // Get transform matrix - prefer backend data, but validate it's not identity
  let transformMatrix = bestCandidate.transform_matrix || bestCandidate.transformMatrix;
  
  // Check if transform is identity-like (might be placeholder data)
  if (transformMatrix && transformMatrix.length === 16) {
    const isIdentityLike = 
      Math.abs(transformMatrix[0] - 1) < 0.01 && Math.abs(transformMatrix[5] - 1) < 0.01 && Math.abs(transformMatrix[10] - 1) < 0.01 &&
      Math.abs(transformMatrix[1]) < 0.01 && Math.abs(transformMatrix[2]) < 0.01 && 
      Math.abs(transformMatrix[4]) < 0.01 && Math.abs(transformMatrix[6]) < 0.01 &&
      Math.abs(transformMatrix[8]) < 0.01 && Math.abs(transformMatrix[9]) < 0.01;
    
    if (isIdentityLike) {
      console.warn('⚠️ Backend transform is identity-like (placeholder) - this is NOT the real screw orientation!');
      console.warn('   The screw in 3D viewer has a different transform than what was saved to backend');
      console.warn('   This happens when transform is not properly saved or loaded from backend');
    }
  }

  const adjacentScrewData: AdjacentScrewData = {
    screw_id: bestCandidate.screw_id || bestCandidate.id,
    screw_label: bestCandidate.screw_label || bestCandidate.name,
    vertebralLevel: bestCandidate.vertebral_level || bestCandidate.vertebralLevel,
    side: bestCandidate.side,
    transform_matrix: transformMatrix,
    trajectory: {
      convergenceAngle: bestCandidate.trajectory?.convergence_angle ?? bestCandidate.trajectory?.convergenceAngle ?? 0,
      cephaladAngle: bestCandidate.trajectory?.cephalad_angle ?? bestCandidate.trajectory?.cephaladAngle ?? 0,
      direction: bestCandidate.trajectory?.direction || [0, 1, 0],
    },
    radius: parseFloat(bestCandidate.radius || 0),
    length: parseFloat(bestCandidate.length || 0),
  };

  console.log('✅ Selected adjacent screw:');
  console.log(`   ID: ${adjacentScrewData.screw_id}`);
  console.log(`   Label: ${adjacentScrewData.screw_label}`);
  console.log(`   Level: ${adjacentScrewData.vertebralLevel} (${adjacentScrewData.side})`);
  console.log('═══════════════════════════════════════════════════════');

  return adjacentScrewData;
}

/**
 * Normalize side string to "left" or "right"
 * Handles various formats: "left", "L", "right", "R"
 */
function normalizeSide(side: string): 'left' | 'right' | null {
  if (!side || typeof side !== 'string') {
    return null;
  }

  const normalized = side.trim().toLowerCase();
  
  if (normalized === 'left' || normalized === 'l') {
    return 'left';
  }
  
  if (normalized === 'right' || normalized === 'r') {
    return 'right';
  }
  
  return null;
}

/**
 * Extract orientation matrix (3x3 rotation) from 4x4 transform
 * 
 * @param transform - 4x4 transform matrix in row-major format
 * @returns 3x3 rotation matrix (first 3x3 of transform)
 */
export function extractOrientationMatrix(transform: number[]): number[] {
  if (!transform || transform.length !== 16) {
    throw new Error('Invalid transform matrix');
  }

  // Extract 3x3 rotation part (indices 0-2, 4-6, 8-10)
  return [
    transform[0], transform[1], transform[2],
    transform[4], transform[5], transform[6],
    transform[8], transform[9], transform[10],
  ];
}

/**
 * Create transform matrix with orientation from adjacent screw and new entry point
 * 
 * @param adjacentTransform - Transform matrix from adjacent screw
 * @param newEntryPoint - Entry point for new screw [x, y, z]
 * @returns New transform matrix (4x4 row-major)
 */
export function createTransformWithAdjacentOrientation(
  adjacentTransform: number[],
  newEntryPoint: [number, number, number]
): Float32Array {
  if (!adjacentTransform || adjacentTransform.length !== 16) {
    throw new Error('Invalid adjacent transform matrix');
  }

  if (!newEntryPoint || newEntryPoint.length !== 3) {
    throw new Error('Invalid entry point');
  }

  // Create new transform:
  // - Copy rotation from adjacent (indices 0-2, 4-6, 8-10)
  // - Use new entry point for translation (indices 3, 7, 11)
  // - Preserve homogeneous row (indices 12-15)
  const newTransform = new Float32Array([
    // Row 0: X-components of basis vectors + new translation X
    adjacentTransform[0], adjacentTransform[1], adjacentTransform[2], newEntryPoint[0],
    
    // Row 1: Y-components of basis vectors + new translation Y
    adjacentTransform[4], adjacentTransform[5], adjacentTransform[6], newEntryPoint[1],
    
    // Row 2: Z-components of basis vectors + new translation Z
    adjacentTransform[8], adjacentTransform[9], adjacentTransform[10], newEntryPoint[2],
    
    // Row 3: Homogeneous coordinates
    0, 0, 0, 1
  ]);

  console.log('📐 Created transform with adjacent orientation:');
  console.log(`   Entry point: [${newEntryPoint[0].toFixed(2)}, ${newEntryPoint[1].toFixed(2)}, ${newEntryPoint[2].toFixed(2)}]`);
  console.log(`   Orientation copied from adjacent screw`);

  return newTransform;
}

