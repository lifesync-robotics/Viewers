# 2D Projection Fix - Implementation Summary

## Problem Identified ✅

### Root Cause
The 2D projections were appearing on wrong axes because of a **coordinate system mismatch** between:
1. **3D Intersection Calculation**: Used standard axis-aligned normals `[0,0,1]`, `[0,1,0]`, `[1,0,0]`
2. **2D Canvas Projection**: Used actual camera normals via `worldToCanvas()` 

### Camera Normal Analysis

| Viewport | Camera Normal (Actual) | Standard Normal | Status |
|----------|------------------------|-----------------|--------|
| **Axial** | `[0, 0, -1]` | `[0, 0, 1]` | ❌ Flipped 180° |
| **Coronal** | `[0, -1, 0]` | `[0, 1, 0]` | ❌ Flipped 180° |
| **Sagittal** | `[1, 0, 0]` | `[1, 0, 0]` | ✅ Matches |

### Why This Caused Issues

**Example - Coronal Viewport**:
- Tool pointing in +Y direction (anterior)
- 3D intersection used standard normal `[0, 1, 0]` → Calculated intersection as "into screen"
- `worldToCanvas()` used camera normal `[0, -1, 0]` → Projected as "across screen"
- **Result**: Projection appeared rotated 90° or on wrong axis

**Why Sagittal Looked Right**:
- Camera normal matched standard normal
- No mismatch between 3D calculation and 2D projection

## Solution Implemented ✅

### The Fix
**Use the actual camera normal for BOTH 3D intersection and 2D projection.**

This ensures consistency between the two coordinate systems.

### Code Changes

**File**: `ToolProjectionRenderer.ts`

**Before** (Problematic):
```typescript
// Step 3: Determine which normal to use
let planeNormal: vec3;

if (viewportType) {
  // Use axis-aligned normal for known viewport types
  const standardNormal = this._getStandardPlaneNormal(viewportType);
  planeNormal = standardNormal;  // ❌ MISMATCH WITH CAMERA
  
  if (!this._normalsMatch(cameraNormal, standardNormal, 0.2)) {
    this._warn(`⚠️ Camera normal mismatch!`);
    this._warn(`   Using standard normal for intersection calculation`);
  }
} else {
  planeNormal = cameraNormal;
}
```

**After** (Fixed):
```typescript
// Step 3: Determine which normal to use
// FIX: Always use camera's actual normal to ensure 3D intersection and 2D projection
// use the same coordinate system. The camera normal may be flipped from the standard
// (e.g., axial camera looks in -Z instead of +Z), but worldToCanvas() uses the camera's
// coordinate system, so we must use it for consistency.
const planeNormal: vec3 = cameraNormal;  // ✅ CONSISTENT WITH CANVAS
const normalSource: string = `camera (${viewportType || 'unknown'})`;

if (viewportType) {
  const standardNormal = this._getStandardPlaneNormal(viewportType);
  
  // Cross-validate camera normal with expected normal (informational only)
  if (!this._normalsMatch(cameraNormal, standardNormal, 0.2)) {
    if (shouldLog) {
      this._log(`ℹ️ Camera normal differs from standard for ${viewportType} viewport`);
      this._log(`   ✅ Using camera normal for consistency with worldToCanvas()`);
    }
  }
}
```

### Key Changes

1. **Always use camera normal**: Removed conditional logic that chose between standard and camera normals
2. **Single source of truth**: Both intersection calculation and canvas projection now use the same coordinate system
3. **Informational logging**: Changed warning to info log - normal mismatch is expected and handled correctly

## Why This Fix Works 🎯

### Coordinate System Consistency

**Before**:
```
3D World → [Standard Normal] → Intersection Point → [Camera Coords] → Canvas
                                        ↑                     ↑
                                    Mismatch!          Different system!
```

**After**:
```
3D World → [Camera Normal] → Intersection Point → [Camera Coords] → Canvas
                                     ↑                     ↑
                              Same system!          Consistent!
```

### What Happens Now

1. **Tool position in 3D world**: `[-48.1, 292.8, -105.3]`
2. **Calculate intersection**: Using actual camera normal `[0, -1, 0]` for coronal
3. **Find intersection point**: In camera's coordinate system
4. **Project to canvas**: `worldToCanvas()` uses same camera coordinate system
5. **Draw on screen**: Projection now correctly represents the 3D intersection

### Expected Results

After this fix:

**Axial Viewport**:
- Camera looks in -Z direction
- Tool projection should appear correctly oriented
- No longer looks flipped

**Coronal Viewport**:
- Camera looks in -Y direction  
- Tool pointing "anterior" should project "into screen"
- No longer goes "across screen"

**Sagittal Viewport**:
- Camera looks in +X direction (already correct)
- Should continue working correctly

## Testing Instructions 🧪

### Step 1: Test the Fix

1. Restart the OHIF Viewer (to load updated code)
2. Load a dataset and enter tracking mode
3. Position tool in known orientations

### Step 2: Verify Each Viewport

**Axial (Top View)**:
- Tool pointing superior → Should go up on screen
- Tool pointing anterior → Should match anatomical direction
- ✅ Check: No flip or rotation

**Coronal (Front View)**:
- Tool pointing anterior → Should go "into screen" (may appear as small projection)
- Tool pointing superior → Should go up on screen
- ✅ Check: "Into screen" direction now correct

**Sagittal (Side View)**:
- Tool pointing anterior → Should go left/right (depends on L/R side)
- Tool pointing superior → Should go up on screen
- ✅ Check: Should continue working (was already correct)

### Step 3: Compare with 3D Model

- The 2D projections should now match the 3D model orientation
- Tool direction in 3D should correspond to projection direction in 2D
- All three viewports should show consistent representations

### Step 4: Check Console Logs

Look for the updated logs:
```
ℹ️ Camera normal differs from standard for coronal viewport
   Camera normal: [0.000, -1.000, 0.000]
   Standard normal: [0.000, 1.000, 0.000]
   ✅ Using camera normal for consistency with worldToCanvas()
```

This is **informational only** - not a warning or error!

## Debugging Features Status 🔧

The debugging features added earlier are still active:

### Active Features
- ✅ Camera parameter logging (first 5 frames per viewport)
- ✅ World-to-canvas transformation logging
- ✅ Visual coordinate axes overlay (RGB arrows)
- ✅ Tool direction indicator (magenta arrow)

### To Disable Visual Overlays

If you want to disable the visual debugging after confirming the fix works:

**In `ToolProjectionRenderer.ts`**, find:
```typescript
// DEBUG: Draw coordinate axes overlay and direction indicator
if (shouldLog) {
  this._drawCoordinateAxes(viewport, originVec);
  this._drawDirectionIndicator(viewport, originVec, toolDirection, 'Tool Dir');
}
```

Change to:
```typescript
// DEBUG: Draw coordinate axes overlay and direction indicator
const enableVisualDebug = false; // Set to true to re-enable
if (shouldLog && enableVisualDebug) {
  this._drawCoordinateAxes(viewport, originVec);
  this._drawDirectionIndicator(viewport, originVec, toolDirection, 'Tool Dir');
}
```

## Technical Details 📚

### Camera Coordinate System

Each viewport has its own camera coordinate system defined by:
- **viewPlaneNormal**: Direction camera is looking (perpendicular to view)
- **viewUp**: Which direction is "up" in the camera view
- **viewRight**: Computed as `viewPlaneNormal × viewUp`

### VTK.js worldToCanvas() Behavior

The `worldToCanvas()` method:
1. Transforms world point to camera coordinates using view matrix
2. Applies orthographic projection based on parallelScale
3. Maps to canvas pixels based on viewport size

**Key insight**: This transformation is done in the camera's local coordinate frame, so the plane normal used for intersection MUST match the camera normal.

### Why Standard Normals Exist

Standard normals `[0,0,1]`, `[0,1,0]`, `[1,0,0]` define the expected anatomical axes:
- Useful for initializing viewports
- Helpful for validation
- But NOT necessarily the actual camera normals

The actual camera normals can be flipped (negative) based on:
- Viewport initialization
- DICOM orientation metadata
- User interactions (rotations/flips)

## Files Modified 📝

### Primary Changes
- `Viewers/extensions/lifesync/src/utils/navigationModes/ToolProjectionRenderer.ts`
  - Line ~285-310: Changed normal selection logic
  - Now always uses camera normal for consistency

### Documentation Created
- `Viewers/DEBUG_2D_PROJECTION_GUIDE.md` - Debugging guide
- `Viewers/PROJECTION_FIX_IMPLEMENTATION.md` - This file

## Validation Checklist ✓

Before closing this issue, verify:

- [ ] Axial viewport: Projections appear correctly oriented
- [ ] Coronal viewport: "Into screen" direction is correct
- [ ] Sagittal viewport: Still working correctly (was already right)
- [ ] 2D projections match 3D model orientation
- [ ] Console logs show camera normals being used (no warnings)
- [ ] Visual overlays (if enabled) show correct axes mapping

## Rollback Plan 🔄

If this fix causes unexpected issues, revert the change:

```typescript
// Revert to using standard normals (original problematic code)
if (viewportType) {
  const standardNormal = this._getStandardPlaneNormal(viewportType);
  planeNormal = standardNormal;
} else {
  planeNormal = cameraNormal;
}
```

However, this will bring back the original issue. Instead, investigate:
1. Is the camera orientation itself incorrect?
2. Should viewports be initialized with different normals?
3. Is there a coordinate system transformation missing elsewhere?

## Credits & Timeline 📅

- **Problem Reported**: 2D projections appearing on wrong axes
- **Debugging Phase**: Added comprehensive logging and visual overlays
- **Root Cause Found**: Camera normal mismatch between 3D intersection and 2D projection
- **Fix Implemented**: Use camera normal consistently for both calculations
- **Status**: ✅ Ready for testing

---

**Next Step**: Test the fix with live tracking and verify all viewports display correctly! 🎯

