# 🚀 Quick Start: Projection Debug Testing

## Problem

Tool projection display shows **incorrect orientation** while position appears accurate.

## Solution

Added comprehensive debugging system with controlled test scenarios.

## Quick Test (5 minutes)

### 1. Start Debug Simulation

```bash
cd AsclepiusPrototype/04_Tracking
python tracking_simulator.py --debug-mode
```

You should see:
```
🔬 DEBUG MODE ENABLED
   Scenarios will cycle every 10.0s
   Order: z-axis → x-axis → y-axis → 45-xz → 45-yz → 45-xy
```

### 2. Start Services (if not running)

```bash
# Terminal 1: SyncForge API
cd 00_SyncForgeAPI
yarn start

# Terminal 2: OHIF Viewer
cd Viewers
yarn run dev
```

### 3. Open OHIF and Enable Tracking

1. Open http://localhost:3000
2. Load a study
3. Click **Tracking** button
4. Select **Instrument Projection** mode
5. Click **Connect**

### 4. Open Browser Console (F12)

Watch for debug output like:

```
🔧 ====== TOOL MATRIX DEBUG (Frame 1) ======
🎯 Z-Axis Extraction Comparison:
   Row-major (current): [0.000, 0.000, 1.000]
   Column-major (OpenGL): [0.000, 0.000, 1.000]
   ⚠️ CONVENTIONS DIFFER - This indicates the bug!
```

### 5. Key Observations

**0-10 seconds (Z-axis scenario)**:
- Console: Z-axis should be `[0, 0, 1]`
- Display: Tool should point vertically (perpendicular to axial)

**10-20 seconds (X-axis scenario)**:
- Console: Z-axis should be `[1, 0, 0]`
- Display: Tool should point horizontally (perpendicular to sagittal)
- **If row-major ≠ column-major → BUG FOUND!**

**20-30 seconds (Y-axis scenario)**:
- Console: Z-axis should be `[0, 1, 0]`
- Display: Tool should point anterior-posterior (perpendicular to coronal)

## Expected Results

### If Bug Exists (Row/Column Mismatch)

Console will show:
```
⚠️ CONVENTIONS DIFFER - This indicates the bug!
   Row-major (current): [0.000, 1.000, 0.000]
   Column-major (OpenGL): [1.000, 0.000, 0.000]
```

Visual display will be rotated 90° from expected.

### If Bug is Fixed

Console will show:
```
✓ Both conventions agree (symmetric matrix or aligned)
```

Visual display will match expected orientations.

## Quick Fix (If Bug Confirmed)

**File**: `Viewers/extensions/lifesync/src/utils/navigationModes/InstrumentProjectionMode.ts`

**Change Line 152-156 from**:
```typescript
zAxis = [
  rotationMatrix[2][0], // ROW extraction
  rotationMatrix[2][1],
  rotationMatrix[2][2]
];
```

**To**:
```typescript
zAxis = [
  rotationMatrix[0][2], // COLUMN extraction
  rotationMatrix[1][2],
  rotationMatrix[2][2]
];
```

Then restart the viewer and retest.

## Troubleshooting

### No console output?
- Check that Instrument Projection mode is active (not Camera Following)
- Refresh browser page and reconnect tracking

### Scenarios not cycling?
- Check simulator console - should show "SWITCHING TO SCENARIO" every 10s
- Verify tracking is connected (not just mode enabled)

### Can't see projection lines?
- Check viewport type (should be MPR, not 3D or stack)
- Look for SVG overlay elements in browser inspector
- Check z-index of projection overlay (should be 1000)

## Full Documentation

See [`PROJECTION_DEBUG_TESTING.md`](PROJECTION_DEBUG_TESTING.md) for complete testing procedures and validation criteria.

## Command-Line Options

```bash
# Default: cycles through all scenarios
python tracking_simulator.py --debug-mode

# Test single scenario
python tracking_simulator.py --debug-mode --debug-scenario x-axis

# Adjust simulation parameters
python tracking_simulator.py --debug-mode --center 0 0 0 --radius 100
```

Available scenarios:
- `z-axis` - Default orientation (vertical)
- `x-axis` - Horizontal pointing right
- `y-axis` - Horizontal pointing forward
- `45-xz` - 45° diagonal in XZ plane
- `45-yz` - 45° diagonal in YZ plane
- `45-xy` - Z-rotation (Z-axis unchanged)

## What Was Added

### Code Changes

1. **InstrumentProjectionMode.ts** - Added matrix extraction debug logging
   - Compares row-major vs column-major extraction
   - Logs first 20 frames only
   - Shows rotation matrix and extracted axes

2. **tracking_simulator.py** - Added debug mode with 6 test scenarios
   - `--debug-mode` flag
   - `--debug-scenario` option
   - Auto-cycles scenarios every 10 seconds
   - Validates Z-axis extraction from generated matrices

3. **PROJECTION_DEBUG_TESTING.md** - Complete testing guide
   - Step-by-step procedures
   - Expected results for each scenario
   - Diagnostic decision tree
   - Common issues and solutions

### No Breaking Changes

- Debug mode is opt-in (requires `--debug-mode` flag)
- Normal simulation still works without flags
- Existing tracking functionality unchanged
- Logging auto-limits to prevent console spam

## Next Steps

1. Run quick test above
2. Check console for "CONVENTIONS DIFFER" message
3. If found, apply the quick fix
4. Retest to verify fix
5. Document results

---

**Time to diagnose**: ~5 minutes
**Time to fix**: ~2 minutes (if bug confirmed)
**Total time**: ~7 minutes

Good luck! 🚀

