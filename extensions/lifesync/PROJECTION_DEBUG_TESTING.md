# 🔬 Tool Projection Debug Testing Guide

## Overview

This document provides step-by-step procedures to debug and validate the tool projection and intersection display system in the OHIF viewer.

## Problem Statement

Experimentation suggests that the current projection and intersection display is incorrect. The **direction or orientation is wrong** while the **position or displacement could be accurate**.

## Root Cause Analysis

### Suspected Bug: Matrix Axis Extraction

**File**: [`InstrumentProjectionMode.ts`](src/utils/navigationModes/InstrumentProjectionMode.ts) (Line 152-156)

```typescript
// CURRENT IMPLEMENTATION (Row-major extraction)
zAxis = [
  rotationMatrix[2][0], // Extracts ROW 2
  rotationMatrix[2][1],
  rotationMatrix[2][2]
];
```

**Issue**: This extracts the **third row** of the rotation matrix, which is correct for **row-major** matrices, but transformation matrices in graphics are typically **column-major** where axes are stored in **columns**.

**Correct Implementation for Column-Major**:
```typescript
zAxis = [
  rotationMatrix[0][2], // Extract COLUMN 2
  rotationMatrix[1][2],
  rotationMatrix[2][2]
];
```

### Matrix Convention Comparison

**Column-Major (Standard OpenGL/Graphics)**:
```
[X.x  Y.x  Z.x  T.x]
[X.y  Y.y  Z.y  T.y]
[X.z  Y.z  Z.z  T.z]
[0    0    0    1  ]
```
- Axes are COLUMNS: Column 0 = X-axis, Column 1 = Y-axis, Column 2 = Z-axis

**Row-Major (Some Engineering Conventions)**:
```
[X.x  X.y  X.z  T.x]
[Y.x  Y.y  Y.z  T.y]
[Z.x  Z.y  Z.z  T.z]
[0    0    0    1  ]
```
- Axes are ROWS: Row 0 = X-axis, Row 1 = Y-axis, Row 2 = Z-axis

## Debug Implementation

### 1. Enhanced Logging

The following files now include comprehensive debug logging:

**InstrumentProjectionMode.ts** (Lines 139-250):
- Logs raw transformation matrix (both 2D and flat array formats)
- Logs extracted rotation matrix (3x3)
- Compares row-major vs column-major Z-axis extraction
- Highlights differences when conventions disagree
- Limited to first 20 frames to avoid console spam

**ToolProjectionRenderer.ts** (Lines 142-286):
- Logs viewport plane information (normal, focal point)
- Identifies plane type (Axial/Sagittal/Coronal)
- Logs intersection calculation details
- Shows intersection parameter `t` and intersection point
- Limited to first 5 calls per viewport

### 2. Debug Simulation Scenarios

**tracking_simulator.py** now supports `--debug-mode` flag with 6 controlled scenarios:

| Scenario | Tool Orientation | Expected Z-Axis | Expected Display |
|----------|-----------------|----------------|------------------|
| `z-axis` | Default (no rotation) | `[0, 0, 1]` | Vertical in sagittal/coronal, perpendicular to axial |
| `x-axis` | 90° Y-rotation | `[1, 0, 0]` | Horizontal in axial/coronal, perpendicular to sagittal |
| `y-axis` | -90° X-rotation | `[0, 1, 0]` | Vertical in sagittal/axial, perpendicular to coronal |
| `45-xz` | 45° Y-rotation | `[0.707, 0, 0.707]` | Diagonal in sagittal, angled in axial/coronal |
| `45-yz` | 45° X-rotation | `[0, 0.707, 0.707]` | Diagonal in coronal/sagittal |
| `45-xy` | 45° Z-rotation | `[0, 0, 1]` | Same as z-axis (Z-rotation doesn't change Z-axis) |

## Testing Procedure

### Prerequisites

1. Ensure OHIF Viewer is running (`yarn run dev` in `Viewers/`)
2. Ensure SyncForge API is running (`yarn start` in `00_SyncForgeAPI/`)
3. Have browser console open (F12 → Console tab)

### Step 1: Start Debug Simulation

```bash
cd AsclepiusPrototype/04_Tracking
python tracking_simulator.py --debug-mode
```

**Expected Output**:
```
🔬 DEBUG MODE ENABLED
   Scenarios will cycle every 10.0s
   Order: z-axis → x-axis → y-axis → 45-xz → 45-yz → 45-xy
   Use this mode to validate projection display accuracy
```

### Step 2: Enable Instrument Projection Mode

1. Open OHIF Viewer (http://localhost:3000)
2. Load a study with MPR views (Axial, Sagittal, Coronal)
3. Click **Tracking** button in toolbar
4. Select **Instrument Projection** mode
5. Click **Connect** to start tracking

### Step 3: Observe Console Output

**Look for these debug sections**:

#### Matrix Extraction Debug
```
🔧 ====== TOOL MATRIX DEBUG (Frame 1) ======
📍 Position: [0.000, 0.000, -150.000]
📐 Raw Matrix (4x4 2D array):
   Row 0: [1.000, 0.000, 0.000, 0.000]
   Row 1: [0.000, 1.000, 0.000, 0.000]
   Row 2: [0.000, 0.000, 1.000, -150.000]
   Row 3: [0.000, 0.000, 0.000, 1.000]
🔄 Extracted Rotation Matrix (3x3):
   X-axis: [1.000, 0.000, 0.000]
   Y-axis: [0.000, 1.000, 0.000]
   Z-axis: [0.000, 0.000, 1.000]
🎯 Z-Axis Extraction Comparison:
   Row-major (current): [0.000, 0.000, 1.000]
   Column-major (OpenGL): [0.000, 0.000, 1.000]
   ✓ Both conventions agree (symmetric matrix or aligned)
```

#### Projection Rendering Debug
```
🎯 ====== PROJECTION RENDER [axial] (call #1) ======
📍 Tool Origin: [0.0, 0.0, -150.0]
📍 Tool Tip: [0.0, 0.0, -100.0]
📍 Tool Z-Axis: [0.000, 0.000, 1.000]
📏 Extension Length: 50mm (5.0cm)

📐 Viewport Plane Info:
   Plane Normal: [0.000, 0.000, 1.000]
   Plane Point (focal): [0.0, 0.0, -150.0]
   Plane Type: Axial (Z-normal)

🔧 Tool Line Info:
   Direction (normalized): [0.000, 0.000, 1.000]
   Length: 50.00mm

🧮 Intersection Math:
   Numerator (n · (P0 - origin)): 0.0000
   Denominator (n · direction): 1.0000
   t parameter: 0.0000
   t range: [0, 50.00]
   ✅ INTERSECTION FOUND!
   Intersection point: [0.0, 0.0, -150.0]
   → Drawing SOLID line from origin to intersection
```

### Step 4: Validation Checklist

For each scenario (cycles every 10 seconds), verify:

#### Scenario: Z-Axis (0-10s)

**Expected Console Output**:
- Z-axis extraction: `[0.000, 0.000, 1.000]`
- Both conventions should agree

**Expected Visual Display**:
- [ ] **Axial view**: Tool appears as a **point** (perpendicular to plane)
- [ ] **Sagittal view**: Tool appears as **vertical line** (superior-inferior)
- [ ] **Coronal view**: Tool appears as **vertical line** (superior-inferior)

**If display is wrong**:
- Axial shows line instead of point → **Orientation bug confirmed**
- Lines not vertical in sagittal/coronal → **Direction reversed or wrong axis**

---

#### Scenario: X-Axis (10-20s)

**Expected Console Output**:
- Scenario change: `🔄 SWITCHING TO SCENARIO: X-AXIS`
- Z-axis extraction comparison should show **difference** if bug exists

**Expected Visual Display**:
- [ ] **Axial view**: Tool appears as **horizontal line** (left-right)
- [ ] **Sagittal view**: Tool appears as a **point** (perpendicular to plane)
- [ ] **Coronal view**: Tool appears as **horizontal line** (left-right)

**If display is wrong**:
- Wrong orientation in any view → **Matrix extraction bug**
- Row-major and column-major show different values → **Bug confirmed**

---

#### Scenario: Y-Axis (20-30s)

**Expected Console Output**:
- Z-axis extraction: `[0.000, 1.000, 0.000]`
- Check row-major vs column-major comparison

**Expected Visual Display**:
- [ ] **Axial view**: Tool appears as **vertical line** (anterior-posterior)
- [ ] **Sagittal view**: Tool appears as **vertical line** (anterior-posterior)
- [ ] **Coronal view**: Tool appears as a **point** (perpendicular to plane)

---

#### Scenario: 45-XZ (30-40s)

**Expected Console Output**:
- Z-axis extraction: `[0.707, 0.000, 0.707]`

**Expected Visual Display**:
- [ ] **Axial view**: Tool appears as **diagonal line** (45° from horizontal)
- [ ] **Sagittal view**: Tool appears as **diagonal line** (45° from vertical)
- [ ] **Coronal view**: Tool appears as **horizontal line with depth**

**Validation**:
- Measure angle in axial view: should be approximately 45°
- If angle is wrong → **Trigonometric validation failed**

---

#### Scenario: 45-YZ (40-50s)

**Expected Console Output**:
- Z-axis extraction: `[0.000, 0.707, 0.707]`

**Expected Visual Display**:
- [ ] **Axial view**: Tool appears as **vertical line with depth**
- [ ] **Sagittal view**: Tool appears as **diagonal line** (45° from vertical)
- [ ] **Coronal view**: Tool appears as **diagonal line** (45° from vertical)

---

#### Scenario: 45-XY (50-60s)

**Expected Console Output**:
- Z-axis extraction: `[0.000, 0.000, 1.000]` (same as Z-axis scenario)
- Note: Z-rotation doesn't change Z-axis direction

**Expected Visual Display**:
- [ ] Should be identical to Z-axis scenario
- [ ] Confirms that Z-rotation around Z-axis doesn't affect tool direction

---

## Diagnostic Decision Tree

```
Start Debug Mode
│
├─ Console shows "Both conventions agree" for all scenarios?
│  │
│  ├─ YES → Projection math might be wrong, not matrix extraction
│  │         Check ToolProjectionRenderer intersection calculations
│  │
│  └─ NO → Matrix extraction bug confirmed!
│            │
│            ├─ Column-major values match expected?
│            │  │
│            │  ├─ YES → Switch to column-major extraction
│            │  │         (Change rotationMatrix[2][i] to rotationMatrix[i][2])
│            │  │
│            │  └─ NO → Check coordinate system convention
│            │            (RAS vs LPS, right-handed vs left-handed)
│            │
│            └─ Visual display matches expected?
│               │
│               ├─ YES → Bug fixed!
│               │
│               └─ NO → Additional issues:
│                       - Plane normal calculation
│                       - worldToCanvas transformation
│                       - SVG coordinate system
```

## Common Issues and Solutions

### Issue 1: Console shows "Both conventions agree" but display is wrong

**Diagnosis**: Matrix is symmetric or identity
**Solution**: Wait for non-aligned scenarios (x-axis, y-axis, 45-xz, 45-yz)

### Issue 2: Lines appear in wrong orientation but correct plane

**Diagnosis**: Coordinate system handedness issue (RAS vs LPS)
**Solution**: Check if axes need to be negated (flip X or Y)

### Issue 3: Lines appear on wrong planes

**Diagnosis**: Plane normal vectors are incorrect
**Solution**: Verify plane identification logic in ToolProjectionRenderer

### Issue 4: No projection visible

**Diagnosis**: worldToCanvas() returning invalid coordinates
**Solution**: Check viewport bounds and clipping logic

### Issue 5: Projection flickers or disappears

**Diagnosis**: Intersection threshold too strict
**Solution**: Adjust `SLICE_THRESHOLD` and `PARALLEL_THRESHOLD` values

## Success Criteria

- [ ] Console debug output shows clear matrix extraction comparison
- [ ] Row-major vs column-major differences are visible for non-aligned scenarios
- [ ] Visual display matches expected projection for all 6 scenarios
- [ ] Tool orientation (Z-axis direction) is mathematically correct
- [ ] Intersection calculation produces expected solid/dashed lines
- [ ] Plane identification is correct (Axial/Sagittal/Coronal)

## Next Steps After Diagnosis

### If Bug is Confirmed (Row vs Column Major)

1. Update `InstrumentProjectionMode.ts` line 152-156:
   ```typescript
   // Change from ROW extraction to COLUMN extraction
   zAxis = [
     rotationMatrix[0][2], // Column 2, row 0
     rotationMatrix[1][2], // Column 2, row 1
     rotationMatrix[2][2]  // Column 2, row 2
   ];
   ```

2. Also update X-axis and Y-axis extraction in `_extractRotationMatrix()` if needed

3. Retest all scenarios

4. Document the fix in `PROJECTION_MATH_FIX_SUMMARY.md`

### If Bug is NOT Matrix Extraction

1. Review plane intersection math in `ToolProjectionRenderer.ts`
2. Verify plane normal calculation
3. Check worldToCanvas() coordinate transformation
4. Validate SVG overlay positioning

## Reference Documentation

- [`PROJECTION_MATH_FIX_SUMMARY.md`](PROJECTION_MATH_FIX_SUMMARY.md) - Previous projection math fixes
- [`PROJECTION_MATH_ANALYSIS.md`](PROJECTION_MATH_ANALYSIS.md) - Mathematical analysis of projection
- [`ORIENTATION_TRACKING_USAGE.md`](ORIENTATION_TRACKING_USAGE.md) - 6-DOF tracking overview
- [`tracking.types.ts`](src/types/tracking.types.ts) - Tracking data type definitions

## Contact and Support

If issues persist after following this guide:
1. Collect console output for all 6 scenarios
2. Take screenshots of each scenario's visual display
3. Document which specific tests failed
4. Review matrix conventions in tracking_simulator.py

---

**Last Updated**: December 2025
**Author**: AI Debugging Assistant
**Version**: 1.0

