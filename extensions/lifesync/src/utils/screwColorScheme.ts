/**
 * Screw Color Scheme Utility
 *
 * Provides consistent color mapping for screws based on their names.
 * Colors are deterministic based on screw labels (e.g., L1L, L2R, T5L, etc.)
 *
 * Based on the color scheme from simple_gui.py
 */

// Define screw name patterns for vertebral levels
const LUMBAR_SCREWS = Array.from({ length: 5 }, (_, i) =>
  ['L', 'R'].map(side => `L${i + 1}${side}`)
).flat();

const SACRAL_SCREWS = ['S1L', 'S1R'];

const THORACIC_SCREWS = Array.from({ length: 12 }, (_, i) =>
  ['L', 'R'].map(side => `T${i + 1}${side}`)
).flat();

const CERVICAL_SCREWS = Array.from({ length: 7 }, (_, i) =>
  ['L', 'R'].map(side => `C${i + 1}${side}`)
).flat();

// All recognized screw names in order
const SCREW_NAMES = [
  ...LUMBAR_SCREWS,
  ...SACRAL_SCREWS,
  ...THORACIC_SCREWS,
  ...CERVICAL_SCREWS
];

// Create screw ID mapping (name -> index)
const SCREW_IDS: Record<string, number> = {};
SCREW_NAMES.forEach((name, index) => {
  SCREW_IDS[name] = index;
});

// Generate color palette (similar to Python: combinations of [1, 0.75, 0.25, 0])
const COLOR_VALUES = [1, 0.75, 0.25, 0];
const SCREW_COLORS: [number, number, number][] = [];

for (const r of COLOR_VALUES) {
  for (const g of COLOR_VALUES) {
    for (const b of COLOR_VALUES) {
      SCREW_COLORS.push([r, g, b]);
    }
  }
}

// Create screw name -> color mapping
const SCREW_COLOR_MAP: Record<string, [number, number, number]> = {};
SCREW_NAMES.forEach((name, index) => {
  SCREW_COLOR_MAP[name] = SCREW_COLORS[index % SCREW_COLORS.length];
});

/**
 * Extract screw label from various name formats
 * Examples:
 *   "L3-R1" -> "L3R"
 *   "L4-L2" -> "L4L"
 *   "T5-R1" -> "T5R"
 *   "Custom Screw L3-R" -> "L3R"
 */
function extractScrewLabel(name: string): string | null {
  // Try to match pattern like "L3-R1" or "L3R"
  const patterns = [
    /([LTCS]\d+)[-\s]*([LR])\d*/i,  // Matches L3-R1, L3R, L3-R, etc.
    /([LTCS]\d+)([LR])/i,            // Matches L3R directly
  ];

  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      const level = match[1].toUpperCase();
      const side = match[2].toUpperCase();
      return `${level}${side}`;
    }
  }

  return null;
}

/**
 * Generate a deterministic random color based on string hash
 * Used for screws that don't match the naming pattern
 */
function hashStringToColor(str: string): [number, number, number] {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Generate RGB values in range [0.3, 1.0] for visibility
  const r = 0.3 + (Math.abs(hash % 256) / 256) * 0.7;
  const g = 0.3 + (Math.abs((hash >> 8) % 256) / 256) * 0.7;
  const b = 0.3 + (Math.abs((hash >> 16) % 256) / 256) * 0.7;

  return [
    Math.round(r * 100) / 100,
    Math.round(g * 100) / 100,
    Math.round(b * 100) / 100
  ];
}

/**
 * Get color for a screw based on its name/label
 *
 * @param screwName - The screw name or label (e.g., "L3-R1", "L4-L2", "Custom Screw")
 * @returns RGB color array [r, g, b] with values in range [0, 1]
 */
export function getScrewColor(screwName: string): [number, number, number] {
  // Try to extract standard screw label
  const label = extractScrewLabel(screwName);

  if (label && SCREW_COLOR_MAP[label]) {
    // Use predefined color for recognized screw labels
    console.log(`🎨 [ScrewColorScheme] Screw "${screwName}" -> label "${label}" -> predefined color [${SCREW_COLOR_MAP[label]}]`);
    return SCREW_COLOR_MAP[label];
  }

  // Fallback: Generate deterministic color from hash
  const color = hashStringToColor(screwName);
  console.log(`🎨 [ScrewColorScheme] Screw "${screwName}" -> no pattern match -> generated color [${color}]`);
  return color;
}

/**
 * Check if a screw name matches a recognized pattern
 */
export function isRecognizedScrewLabel(screwName: string): boolean {
  const label = extractScrewLabel(screwName);
  return label !== null && SCREW_COLOR_MAP[label] !== undefined;
}

/**
 * Get all recognized screw names
 */
export function getRecognizedScrewNames(): string[] {
  return [...SCREW_NAMES];
}

/**
 * Get color palette size
 */
export function getColorPaletteSize(): number {
  return SCREW_COLORS.length;
}

// Export for testing/debugging
export const _internal = {
  SCREW_NAMES,
  SCREW_IDS,
  SCREW_COLOR_MAP,
  extractScrewLabel,
  hashStringToColor
};
