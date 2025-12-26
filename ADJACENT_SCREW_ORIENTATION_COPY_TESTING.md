# Adjacent Screw Orientation Copy - Testing Guide

## Overview
This feature automatically copies orientation and insertion angles from adjacent screws (vertebral level ±1, same side) to speed up screw placement workflow.

## Implementation Summary

### New Files Created
1. **`extensions/lifesync/src/utils/vertebralLevelUtils.ts`**
   - Vertebral level parsing (L3, T12, C7, S1, etc.)
   - Adjacency detection (handles cross-region: L1 ↔ T12, T1 ↔ C7)
   - Distance calculation between vertebral levels

2. **`extensions/lifesync/src/components/ScrewManagement/adjacentScrewFinder.ts`**
   - Search for adjacent screws (level ±1, same side)
   - Extract orientation matrix from transform
   - Create new transform with adjacent orientation + new entry point

### Modified Files
1. **`extensions/lifesync/src/components/ScrewManagement/ScrewManagementPanel.tsx`**
   - Added `resetCrosshairsToAnatomical()` - resets viewports to anatomical default
   - Added `constructScrewTransformWithAdjacentOrientation()` - constructs transform with copied orientation
   - Modified `saveScrew()` - integrates adjacent screw search and orientation copying

## How It Works

### Workflow Diagram

```
User Adds New Screw (e.g., L4L)
         ↓
Parse Label → Extract Level (L4) & Side (left)
         ↓
Search for Adjacent Screws (L3L or L5L)
         ↓
    ┌────┴────┐
    │         │
Found?     Not Found?
    │         │
    ↓         ↓
YES        NO
    │         │
    ↓         ↓
Copy:      Reset:
- Rotation  - Crosshairs to anatomical
- Angles    - Standard workflow
    │         │
    └────┬────┘
         ↓
Construct Transform Matrix
- Use current crosshair as entry point
- Apply copied/default orientation
         ↓
Save to Backend with Trajectory Angles
```

### Key Features

1. **Adjacent Screw Detection**
   - Same side (left/right)
   - Vertebral level ±1
   - Cross-region support (L1 ↔ T12, T1 ↔ C7)
   - Prioritizes closest level, then most recent

2. **Orientation Copying**
   - Copies 3x3 rotation matrix from adjacent screw
   - Preserves new entry point from current crosshair position
   - Copies convergence angle and cephalad angle

3. **Anatomical Default Reset**
   - When no adjacent screw is found
   - Resets viewports to standard anatomical axes
   - Ensures consistent starting point

## Testing Scenarios

### Test 1: Sequential Same-Side Screws (Basic)

**Purpose**: Verify orientation copying within same vertebral region

**Steps**:
1. Load a lumbar spine DICOM series
2. Place first screw: **L3L**
   - Position crosshair at L3 left pedicle entry point
   - Adjust orientation manually (convergence angle, cephalad angle)
   - Click "Add Screw" → Save as "L3L"
   - **Expected**: Standard placement workflow

3. Place second screw: **L4L**
   - Position crosshair at L4 left pedicle entry point
   - Click "Add Screw" → Save as "L4L"
   - **Expected**: 
     - Console shows "Adjacent screw found - will copy orientation"
     - Screw appears with same orientation as L3L
     - Only entry point is different

4. Place third screw: **L5L**
   - Position crosshair at L5 left pedicle entry point
   - Click "Add Screw" → Save as "L5L"
   - **Expected**: 
     - Console shows adjacent screw found (L4L)
     - Same orientation as L4L (which matched L3L)

**Verification**:
- Check console logs for "Adjacent screw found" messages
- Verify all screws have similar orientation
- Verify trajectory angles are copied (convergenceAngle, cephaladAngle)

### Test 2: Cross-Region Adjacency (L1 ↔ T12)

**Purpose**: Verify cross-region adjacency detection

**Steps**:
1. Place screw: **T12L**
   - Manual orientation adjustment
   - Save

2. Place screw: **L1L**
   - **Expected**: Finds T12L as adjacent (cross-region)
   - Console: "Adjacent screw found: T12L"
   - Orientation copied from T12L

3. Place screw: **T11L**
   - **Expected**: Finds T12L as adjacent
   - Orientation copied

**Verification**:
- T12L and L1L should have similar orientations
- T11L and T12L should have similar orientations

### Test 3: Isolated Screw (No Adjacent)

**Purpose**: Verify anatomical reset when no adjacent screw

**Steps**:
1. Place screw: **L3L** (manual placement)
2. Place screw: **L3R** (opposite side)
   - **Expected**: 
     - Console: "No adjacent screw found"
     - Console: "Resetting to anatomical default"
     - Viewports reset to anatomical axes
     - Standard placement workflow

3. Place screw: **L4R**
   - **Expected**: Finds L3R as adjacent
   - Orientation copied from L3R

**Verification**:
- L3R should NOT copy from L3L (different side)
- L4R should copy from L3R (same side, adjacent level)

### Test 4: Skip Level (Not Adjacent)

**Purpose**: Verify that non-adjacent screws are not copied

**Steps**:
1. Place screw: **L3L**
2. Place screw: **L5L** (skip L4)
   - **Expected**: 
     - Console: "No adjacent screw found" (L4L doesn't exist)
     - Anatomical reset
     - Manual placement

3. Place screw: **L4L** (fill the gap)
   - **Expected**: 
     - Finds either L3L or L5L as adjacent
     - Copies orientation from one of them

**Verification**:
- L5L should NOT copy from L3L (distance = 2)
- L4L should copy from L3L or L5L (whichever is prioritized)

### Test 5: Multiple Regions

**Purpose**: Test comprehensive spine coverage

**Steps**:
1. Place cervical screws: C6L, C7L
2. Place thoracic screws: T1L, T2L
3. Verify C7L → T1L cross-region copying
4. Place lumbar screws: L1L, L2L, L3L
5. Verify T12 → L1 cross-region if T12 placed

**Verification**:
- All adjacent pairs should copy orientation
- Cross-region transitions should work (C7↔T1, T12↔L1)

## Console Output Examples

### With Adjacent Screw Found
```
═══════════════════════════════════════════════════════
🔍 [saveScrew] SEARCHING FOR ADJACENT SCREW
   Target: L4 (left)
═══════════════════════════════════════════════════════
🔍 [AdjacentScrewFinder] SEARCHING FOR ADJACENT SCREW
   Target: L4 (left)
   Existing screws: 3
✅ Found candidate: L3 (left) - distance 1
✅ Selected adjacent screw:
   ID: screw_123
   Label: L3L
   Level: L3 (left)
   Convergence: 10.5°
   Cephalad: 5.2°
═══════════════════════════════════════════════════════
✅ Adjacent screw found - will copy orientation
🎯 Constructing transform with adjacent screw orientation
📐 [saveScrew] COPYING TRAJECTORY ANGLES FROM ADJACENT
   Convergence angle: 10.5°
   Cephalad angle: 5.2°
═══════════════════════════════════════════════════════
```

### Without Adjacent Screw
```
═══════════════════════════════════════════════════════
🔍 [saveScrew] SEARCHING FOR ADJACENT SCREW
   Target: L3 (right)
═══════════════════════════════════════════════════════
🔍 [AdjacentScrewFinder] SEARCHING FOR ADJACENT SCREW
   Target: L3 (right)
   Existing screws: 2
❌ No adjacent screws found
ℹ️ No adjacent screw found - resetting to anatomical default
🔄 [ScrewManagement] RESETTING CROSSHAIRS TO ANATOMICAL
═══════════════════════════════════════════════════════
ℹ️ No adjacent screw - using default trajectory angles (0°)
```

## Performance Benefits

### Time Savings
- **Without feature**: Each screw requires manual orientation adjustment
  - Average time: ~30-60 seconds per screw
  - 10 screws: 5-10 minutes

- **With feature**: Only first 1-2 screws per side need manual adjustment
  - First screw: ~30-60 seconds
  - Subsequent screws: ~10-15 seconds (only position crosshair)
  - 10 screws: 2-3 minutes

**Estimated time savings: 50-70% for multi-level cases**

## Troubleshooting

### Issue: Orientation not copied
**Check**:
- Screw label format correct? (L3L, L4R, etc.)
- Adjacent screw exists on same side?
- Console shows "Adjacent screw found"?
- Adjacent screw has valid transform matrix?

### Issue: Wrong orientation copied
**Check**:
- Is correct screw identified as adjacent?
- Multiple adjacent screws? (prioritizes closest, then most recent)
- Transform matrix valid in adjacent screw?

### Issue: Crosshairs not resetting
**Check**:
- Console shows "Resetting to anatomical default"?
- Viewport cameras updating properly?
- Crosshairs tool active?

## Technical Details

### Transform Matrix Format (Row-Major 4x4)
```
[
  ax, cx, sx, tx,  // Axial, Coronal, Sagittal normals + Translation X
  ay, cy, sy, ty,  // Y components
  az, cz, sz, tz,  // Z components
  0,  0,  0,  1    // Homogeneous
]
```

### Orientation Copying
- **Copied**: Indices 0,1,2,4,5,6,8,9,10 (3x3 rotation)
- **New**: Indices 3,7,11 (translation/entry point)
- **Preserved**: Indices 12,13,14,15 (homogeneous row)

### Trajectory Angles
- **convergenceAngle**: Medial/lateral insertion angle
- **cephaladAngle**: Superior/inferior insertion angle
- Both stored in backend and copied to new screw

## Future Enhancements

1. **Visual Indicator**: Show when orientation is copied (UI badge/icon)
2. **Override Option**: Allow user to disable auto-copy for specific screw
3. **Template Library**: Save common orientation patterns
4. **Smart Adjustment**: Automatically adjust angles based on anatomical curves

## Related Files

- Implementation: `extensions/lifesync/src/components/ScrewManagement/`
- Utilities: `extensions/lifesync/src/utils/vertebralLevelUtils.ts`
- Backend: `AsclepiusPrototype/03_Planning/screw_api.py`

