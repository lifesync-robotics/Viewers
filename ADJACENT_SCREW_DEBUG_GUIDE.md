# Adjacent Screw Orientation Copy - Debug Guide

## Overview
This guide helps you debug why adjacent screw orientation copying might not be working. The code now includes extensive debug logging to trace the entire process.

## Debug Console Output

When adding a new screw, you should see these debug sections in order:

### 1. Adjacent Screw Search Start
```
═══════════════════════════════════════════════════════
🔍 [saveScrew] ADJACENT SCREW SEARCH - START
═══════════════════════════════════════════════════════
📝 New screw label: "L4L"
📊 Parsed: level="L4", side="left"
📋 Total existing screws in state: 2
   Existing screws:
   1. L3L - L3 (left) - transform:✅
   2. L3R - L3 (right) - transform:✅
```

**What to check:**
- ✅ Is the label being parsed correctly?
- ✅ Are existing screws showing in the list?
- ✅ Do existing screws have transforms (✅)?
- ❌ If "No existing screws in state!" → **screws array is empty**

### 2. Adjacent Screw Search Result

**If found:**
```
═══════════════════════════════════════════════════════
✅✅✅ ADJACENT SCREW FOUND! ✅✅✅
═══════════════════════════════════════════════════════
   Adjacent screw ID: screw_123
   Adjacent screw label: L3L
   Adjacent screw level: L3 (left)
   Convergence angle: 10.50°
   Cephalad angle: 5.20°
   Adjacent transform matrix (first 3 rows):
   Row 0: [0.998, 0.052, -0.034, 123.45]
   Row 1: [-0.053, 0.998, -0.012, 234.56]
   Row 2: [0.033, 0.014, 0.999, 345.67]
   🎯 WILL COPY ORIENTATION (rotation matrix)
═══════════════════════════════════════════════════════
```

**If NOT found:**
```
═══════════════════════════════════════════════════════
❌ NO ADJACENT SCREW FOUND
═══════════════════════════════════════════════════════
ℹ️ Will reset to anatomical default and use crosshairs
```

**What to check:**
- ❌ If not found but should be → check `findAdjacentScrew()` logic
- ❌ If found but no transform → adjacent screw missing transform data

### 3. Transform Construction

**With adjacent orientation:**
```
═══════════════════════════════════════════════════════
🎯🎯🎯 COPYING ORIENTATION FROM ADJACENT SCREW 🎯🎯🎯
═══════════════════════════════════════════════════════
   Method: constructScrewTransformWithAdjacentOrientation()
   Input: Adjacent transform matrix
   Output: New transform with copied orientation + new entry point

✅ Transform constructed with adjacent orientation!
   New transform (first 3 rows):
   Row 0: [0.998, 0.052, -0.034, 150.00]  ← New entry point
   Row 1: [-0.053, 0.998, -0.012, 250.00]  ← New entry point
   Row 2: [0.033, 0.014, 0.999, 350.00]  ← New entry point

   🔍 Comparing rotation matrices:
   Adjacent rotation (3x3):
     [0.998, 0.052, -0.034]
     [-0.053, 0.998, -0.012]
     [0.033, 0.014, 0.999]
   New rotation (3x3):
     [0.998, 0.052, -0.034]  ← Should match!
     [-0.053, 0.998, -0.012]  ← Should match!
     [0.033, 0.014, 0.999]  ← Should match!

   ✅ Rotation matrices should match!
═══════════════════════════════════════════════════════
```

**What to check:**
- ✅ Do the rotation matrices match? (first 3x3 values)
- ✅ Is the entry point different? (last column: indices 3, 7, 11)
- ❌ If matrices don't match → bug in `createTransformWithAdjacentOrientation()`

### 4. Trajectory Angles

**With adjacent screw:**
```
═══════════════════════════════════════════════════════
📐📐📐 COPYING TRAJECTORY ANGLES FROM ADJACENT 📐📐📐
═══════════════════════════════════════════════════════
   Source: L3L (L3)
   Convergence angle: 10.50° (copied)
   Cephalad angle: 5.20° (copied)
   ✅ Angles will be saved to backend
═══════════════════════════════════════════════════════
```

**Without adjacent screw:**
```
═══════════════════════════════════════════════════════
ℹ️ NO ADJACENT SCREW - USING DEFAULT ANGLES
   Convergence angle: 0°
   Cephalad angle: 0°
═══════════════════════════════════════════════════════
```

### 5. Final Transform Matrix
```
═══════════════════════════════════════════════════════
🔍 [saveScrew] FINAL TRANSFORM MATRIX
═══════════════════════════════════════════════════════
   Translation (entry point): [150.00, 250.00, 350.00]
   Axial (X-axis): [0.998, -0.053, 0.033]
   Coronal (Y-axis): [0.052, 0.998, 0.014]
   Sagittal (Z-axis): [-0.034, -0.012, 0.999]
═══════════════════════════════════════════════════════
```

## Common Issues & Solutions

### Issue 1: "No existing screws in state!"

**Symptom:**
```
📋 Total existing screws in state: 0
   ⚠️ No existing screws in state!
```

**Cause:** The `screws` state array is empty

**Solutions:**
1. Check if screws are being loaded from backend after session start
2. Check if `setScrews()` is being called after adding first screw
3. Verify `loadScrews()` function is working
4. Check if screws are saved to backend correctly

**Debug:**
```javascript
// Add this before saveScrew:
console.log('DEBUG: screws state:', screws);
console.log('DEBUG: screws.length:', screws.length);
```

### Issue 2: Adjacent screw found but orientation not copied

**Symptom:**
- Console shows "ADJACENT SCREW FOUND"
- But screw still follows crosshair orientation

**Cause:** Transform construction is not using adjacent orientation

**Check:**
1. Does console show "🎯🎯🎯 COPYING ORIENTATION FROM ADJACENT SCREW"?
2. If NO → `adjacentScrewTransform` is null or undefined
3. If YES → Check if rotation matrices match in comparison

**Debug:**
```javascript
// In constructScrewTransformWithAdjacentOrientation:
console.log('adjacentTransform:', adjacentTransform);
console.log('adjacentTransform valid?', adjacentTransform && adjacentTransform.length === 16);
```

### Issue 3: Rotation matrices don't match

**Symptom:**
```
Adjacent rotation (3x3):
  [0.998, 0.052, -0.034]
  [-0.053, 0.998, -0.012]
  [0.033, 0.014, 0.999]
New rotation (3x3):
  [1.000, 0.000, 0.000]  ← Different!
  [0.000, 1.000, 0.000]  ← Different!
  [0.000, 0.000, 1.000]  ← Different!
```

**Cause:** `createTransformWithAdjacentOrientation()` not copying correctly

**Solution:** Check the function in `adjacentScrewFinder.ts`

### Issue 4: Screw exists but not detected as adjacent

**Symptom:**
- L3L exists
- Adding L4L
- Console shows "NO ADJACENT SCREW FOUND"

**Causes:**
1. Vertebral level not parsed correctly
2. Side not matching
3. Transform matrix missing from L3L
4. `findAdjacentScrew()` logic issue

**Check the existing screws list:**
```
   Existing screws:
   1. L3L - L3 (left) - transform:✅  ← Should have ✅
```

If transform shows ❌, the screw doesn't have a valid transform matrix.

### Issue 5: Label parsing fails

**Symptom:**
```
📊 Parsed: level="Unknown", side="unknown"
⚠️ CANNOT PARSE VERTEBRAL LEVEL/SIDE FROM LABEL
```

**Cause:** Label format not recognized

**Supported formats:**
- `L3L`, `L3R` (no separator)
- `L3-L`, `L3-R` (with dash)
- `T12L`, `C7R`, `S1L` (all regions)

**Invalid formats:**
- `L3 Left` (space + full word)
- `L3_L` (underscore)
- `Lumbar3Left` (full words)

## Testing Checklist

Use this checklist when testing:

- [ ] First screw (L3L) added successfully
- [ ] Console shows L3L in existing screws list
- [ ] L3L has transform:✅ in the list
- [ ] Second screw (L4L) label parsed correctly
- [ ] Console shows "ADJACENT SCREW FOUND"
- [ ] Console shows "COPYING ORIENTATION FROM ADJACENT SCREW"
- [ ] Rotation matrices match in comparison
- [ ] Trajectory angles copied
- [ ] Final transform has correct rotation
- [ ] Screw appears in 3D with copied orientation

## Quick Test Script

Add this to your browser console to check screw state:

```javascript
// Get all screws from component state
const screwPanel = document.querySelector('[data-component="ScrewManagementPanel"]');
if (screwPanel) {
  console.log('Screws in state:', screwPanel.__reactInternalInstance$?.memoizedState);
}

// Or check via services
const { servicesManager } = window.OHIF;
const planningService = servicesManager.services.planningBackendService;
const sessionId = /* your session ID */;
planningService.listScrews(sessionId).then(response => {
  console.log('Screws from backend:', response.screws);
});
```

## Expected Behavior

### Scenario 1: First screw (no adjacent)
1. Add L3L
2. Console: "NO ADJACENT SCREW FOUND"
3. Console: "Using standard construction from crosshairs"
4. Screw follows crosshair orientation ✅

### Scenario 2: Second screw (adjacent exists)
1. Add L4L (after L3L exists)
2. Console: "ADJACENT SCREW FOUND" (L3L)
3. Console: "COPYING ORIENTATION FROM ADJACENT SCREW"
4. Console: Rotation matrices match
5. Screw appears with same orientation as L3L ✅

### Scenario 3: Opposite side (no adjacent)
1. Add L3R (L3L exists but opposite side)
2. Console: "NO ADJACENT SCREW FOUND"
3. Screw follows crosshair orientation ✅

## Contact Points for Issues

If orientation copying still doesn't work after checking all above:

1. **Check `screws` state:** Is it populated?
2. **Check `findAdjacentScrew()`:** Is it finding the right screw?
3. **Check `createTransformWithAdjacentOrientation()`:** Is it copying correctly?
4. **Check transform application:** Is the transform being applied to the 3D model?

Share the console output from all debug sections for further diagnosis.

