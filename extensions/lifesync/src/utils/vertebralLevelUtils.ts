/**
 * Vertebral Level Utilities
 * 
 * Utilities for parsing, comparing, and finding adjacent vertebral levels.
 * Supports lumbar (L), thoracic (T), cervical (C), and sacral (S) regions.
 * 
 * Features:
 * - Parse vertebral level strings (e.g., "L3", "T12", "C7", "S1")
 * - Calculate adjacent levels (handles cross-region: L1 ↔ T12, T1 ↔ C7)
 * - Compare vertebral levels for adjacency
 */

/**
 * Parsed vertebral level information
 */
export interface ParsedVertebralLevel {
  region: 'C' | 'T' | 'L' | 'S';  // Cervical, Thoracic, Lumbar, Sacral
  number: number;                   // Vertebral number within region
  raw: string;                      // Original string (e.g., "L3")
}

/**
 * Standard vertebral counts by region
 */
const VERTEBRAL_COUNTS = {
  C: 7,   // C1-C7 (cervical)
  T: 12,  // T1-T12 (thoracic)
  L: 5,   // L1-L5 (lumbar)
  S: 5,   // S1-S5 (sacral)
};

/**
 * Region order from superior to inferior
 */
const REGION_ORDER: Array<'C' | 'T' | 'L' | 'S'> = ['C', 'T', 'L', 'S'];

/**
 * Parse vertebral level string into structured format
 * 
 * @param level - Vertebral level string (e.g., "L3", "T12", "C7")
 * @returns Parsed level information or null if invalid
 * 
 * @example
 * parseVertebralLevel("L3") // { region: "L", number: 3, raw: "L3" }
 * parseVertebralLevel("T12") // { region: "T", number: 12, raw: "T12" }
 * parseVertebralLevel("Invalid") // null
 */
export function parseVertebralLevel(level: string): ParsedVertebralLevel | null {
  if (!level || typeof level !== 'string') {
    return null;
  }

  const trimmed = level.trim().toUpperCase();
  
  // Match pattern: [C|T|L|S][number]
  // Examples: L3, T12, C7, S1
  const match = trimmed.match(/^([CTLS])(\d+)$/);
  
  if (!match) {
    return null;
  }

  const region = match[1] as 'C' | 'T' | 'L' | 'S';
  const number = parseInt(match[2], 10);

  // Validate number is within valid range for region
  if (number < 1 || number > VERTEBRAL_COUNTS[region]) {
    console.warn(`⚠️ Vertebral level ${trimmed} has invalid number (max for ${region} is ${VERTEBRAL_COUNTS[region]})`);
    // Still return it - might be anatomical variant
  }

  return {
    region,
    number,
    raw: `${region}${number}`,
  };
}

/**
 * Get adjacent vertebral levels (±1 level)
 * Handles cross-region transitions (e.g., L1 ↔ T12, T1 ↔ C7)
 * 
 * @param level - Vertebral level string (e.g., "L3")
 * @returns Array of adjacent level strings (0, 1, or 2 levels)
 * 
 * @example
 * getAdjacentLevels("L3") // ["L2", "L4"]
 * getAdjacentLevels("L1") // ["T12", "L2"]  (cross-region)
 * getAdjacentLevels("T1") // ["C7", "T2"]   (cross-region)
 * getAdjacentLevels("S5") // ["S4"]         (no inferior level)
 */
export function getAdjacentLevels(level: string): string[] {
  const parsed = parseVertebralLevel(level);
  
  if (!parsed) {
    return [];
  }

  const adjacentLevels: string[] = [];

  // Superior adjacent (one level up)
  if (parsed.number > 1) {
    // Within same region
    adjacentLevels.push(`${parsed.region}${parsed.number - 1}`);
  } else if (parsed.number === 1) {
    // At boundary - check for superior region
    const regionIndex = REGION_ORDER.indexOf(parsed.region);
    if (regionIndex > 0) {
      // Has superior region (e.g., L1 → T12)
      const superiorRegion = REGION_ORDER[regionIndex - 1];
      const superiorMax = VERTEBRAL_COUNTS[superiorRegion];
      adjacentLevels.push(`${superiorRegion}${superiorMax}`);
    }
  }

  // Inferior adjacent (one level down)
  if (parsed.number < VERTEBRAL_COUNTS[parsed.region]) {
    // Within same region
    adjacentLevels.push(`${parsed.region}${parsed.number + 1}`);
  } else if (parsed.number === VERTEBRAL_COUNTS[parsed.region]) {
    // At boundary - check for inferior region
    const regionIndex = REGION_ORDER.indexOf(parsed.region);
    if (regionIndex < REGION_ORDER.length - 1) {
      // Has inferior region (e.g., T12 → L1)
      const inferiorRegion = REGION_ORDER[regionIndex + 1];
      adjacentLevels.push(`${inferiorRegion}1`);
    }
  }

  return adjacentLevels;
}

/**
 * Check if two vertebral levels are adjacent (±1 level)
 * Handles cross-region transitions
 * 
 * @param level1 - First vertebral level
 * @param level2 - Second vertebral level
 * @returns True if levels are adjacent
 * 
 * @example
 * isAdjacentLevel("L3", "L4") // true
 * isAdjacentLevel("L1", "T12") // true (cross-region)
 * isAdjacentLevel("L3", "L5") // false (skip level)
 * isAdjacentLevel("L3", "T3") // false (different regions)
 */
export function isAdjacentLevel(level1: string, level2: string): boolean {
  if (!level1 || !level2) {
    return false;
  }

  const adjacentLevels = getAdjacentLevels(level1);
  const level2Upper = level2.trim().toUpperCase();
  
  return adjacentLevels.some(adj => adj === level2Upper);
}

/**
 * Calculate the distance between two vertebral levels
 * Returns positive number (absolute distance)
 * 
 * @param level1 - First vertebral level
 * @param level2 - Second vertebral level
 * @returns Distance in vertebral levels (0 = same, 1 = adjacent, etc.) or null if invalid
 * 
 * @example
 * getVertebralDistance("L3", "L3") // 0
 * getVertebralDistance("L3", "L4") // 1
 * getVertebralDistance("L3", "L5") // 2
 * getVertebralDistance("L1", "T12") // 1 (cross-region)
 */
export function getVertebralDistance(level1: string, level2: string): number | null {
  const parsed1 = parseVertebralLevel(level1);
  const parsed2 = parseVertebralLevel(level2);

  if (!parsed1 || !parsed2) {
    return null;
  }

  // Same level
  if (parsed1.raw === parsed2.raw) {
    return 0;
  }

  // Calculate absolute position in spine (from superior to inferior)
  const getAbsolutePosition = (parsed: ParsedVertebralLevel): number => {
    let position = 0;
    const regionIndex = REGION_ORDER.indexOf(parsed.region);
    
    // Add all vertebrae from superior regions
    for (let i = 0; i < regionIndex; i++) {
      position += VERTEBRAL_COUNTS[REGION_ORDER[i]];
    }
    
    // Add position within current region
    position += parsed.number;
    
    return position;
  };

  const pos1 = getAbsolutePosition(parsed1);
  const pos2 = getAbsolutePosition(parsed2);

  return Math.abs(pos1 - pos2);
}

/**
 * Format a vertebral level for display
 * 
 * @param level - Vertebral level string
 * @returns Formatted string or original if invalid
 * 
 * @example
 * formatVertebralLevel("l3") // "L3"
 * formatVertebralLevel("L03") // "L3"
 */
export function formatVertebralLevel(level: string): string {
  const parsed = parseVertebralLevel(level);
  return parsed ? parsed.raw : level;
}

