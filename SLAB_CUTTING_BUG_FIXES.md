# Slab Cutting Bug Fixes

## Summary

Fixed two critical bugs in the slab cutting logic that were causing:
1. **Directional asymmetry** - cuts only appearing on one side of the plane
2. **Non-persistent/flashing output** - cross-sections disappearing when scrolling stops

---

## Bug 1: Directional Asymmetry

### Root Cause
The `slabCutters` and `slabPlanes` arrays were not being properly sized when the slab thickness changed. When transitioning from a thicker slab to a thinner one, **excess cutters remained in the arrays** with stale plane positions from previous builds.

#### The Problem
```typescript
// OLD CODE - Only added new cutters, never removed old ones
while (modelCutterData.slabCutters.length < offsets.length) {
  modelCutterData.slabPlanes.push(vtkPlane.newInstance());
  modelCutterData.slabCutters.push(vtkCutter.newInstance());
}
```

If you had:
- Previous slab: 20mm thickness → 40 cutters (20 positive + 20 negative offsets)
- Current slab: 10mm thickness → 20 cutters needed
- **Result**: 40 cutters exist, but only 20 are updated with new positions
- The remaining 20 cutters have **stale positions** and could interfere with rendering

### The Fix
```typescript
// **BUG FIX 1: Directional Asymmetry**
// Properly size the arrays - remove excess cutters/planes from previous thicker slabs
while (modelCutterData.slabCutters.length > offsets.length) {
  const oldCutter = modelCutterData.slabCutters.pop();
  const oldPlane = modelCutterData.slabPlanes.pop();
  if (oldCutter) oldCutter.delete();
  if (oldPlane) oldPlane.delete();
}

// Then add new ones if needed
while (modelCutterData.slabCutters.length < offsets.length) {
  modelCutterData.slabPlanes.push(vtkPlane.newInstance());
  modelCutterData.slabCutters.push(vtkCutter.newInstance());
}
```

This ensures:
- Array sizes exactly match the number of offsets needed
- No stale cutters from previous builds
- Both positive and negative offsets are processed symmetrically

---

## Bug 2: Non-Persistent / Flashing Output

### Root Cause
When `totalHits === 0` (no slab slices intersected the model), the code **permanently hid the actor** by setting visibility to false and deleting the append filter. This created a cascade of problems:

1. During scrolling, the plane might temporarily move through a region with no intersection
2. The rebuild triggered at that position would hide the actor
3. Even when scrolling continued to a valid intersection position, the actor remained hidden unless another rebuild was triggered
4. This caused the "flash and disappear" behavior

#### The Problem
```typescript
// OLD CODE - Permanently hid the actor when no hits
if (totalHits === 0) {
  if (modelCutterData.appendFilter) {
    modelCutterData.appendFilter.delete();
    modelCutterData.appendFilter = null;
  }
  modelCutterData.actor.setVisibility(false);  // ❌ PERMANENT HIDE!
  return;
}
```

### The Fix
Instead of hiding the actor, **fall back to thin-slice mode**:

```typescript
// **BUG FIX 2: Non-persistent / Flashing Output**
// Fall back to thin-slice mode instead of hiding
if (totalHits === 0) {
  // Clean up slab mode
  if (modelCutterData.appendFilter) {
    modelCutterData.appendFilter.delete();
    modelCutterData.appendFilter = null;
  }

  // Connect mapper to the base cutter (thin slice at plane origin)
  modelCutterData.cutter.setCutFunction(planeCutter.plane);
  modelCutterData.cutter.setInputData(modelCutterData.polyData);
  modelCutterData.cutter.modified();
  modelCutterData.cutter.update();
  
  modelCutterData.mapper.setInputConnection(modelCutterData.cutter.getOutputPort());
  modelCutterData.mapper.modified();
  
  // Keep actor visible with thin-slice fallback ✅
  modelCutterData.actor.setVisibility(true);
  modelCutterData.actor.modified();
  
  return;
}
```

This ensures:
- The cross-section remains visible even when the slab temporarily has no hits
- A single thin slice at the plane origin is shown as a fallback
- The actor never "disappears" during scrolling
- More graceful degradation when the slab doesn't fully intersect the model

---

## Additional Improvements

### Enhanced Diagnostic Logging

Added logging to detect asymmetric hit patterns:

```typescript
if (totalHits > 0 && (positiveHits === 0 || negativeHits === 0) && offsets.length > 1) {
  console.warn(`⚠️ ASYMMETRIC HITS DETECTED: Only ${positiveHits > 0 ? 'positive' : 'negative'} offsets produced intersections!`);
  console.warn(`⚠️ This suggests a directional asymmetry bug`);
}
```

Also added array size logging:
```typescript
console.log(`🔍 Array sizes: slabCutters=${modelCutterData.slabCutters.length}, slabPlanes=${modelCutterData.slabPlanes.length}, offsets=${offsets.length}`);
```

### Increased Debug Logging Frequency

Changed from 2% to 10% logging probability for better debugging:
```typescript
const shouldLog = Math.random() < 0.10; // 10% chance (increased from 2% for better debugging)
```

---

## Expected Behavior After Fix

### Directional Symmetry ✅
- Cutting should work when the model is on **either side** of the plane
- Scrolling in both directions (left→right and right→left) should produce intersections
- Both positive and negative slab offsets should produce valid hits when appropriate

### Persistent Rendering ✅
- Cross-sections should remain visible while the plane intersects the model
- No more "flash and disappear" when scrolling stops
- Graceful fallback to thin-slice mode when slab has no hits
- Smooth transitions between slab mode and thin-slice mode

---

## Testing Recommendations

1. **Test directional symmetry:**
   - Load a model in sagittal view (normal = [1, 0, 0])
   - Scroll left→right through the model
   - Scroll right→left through the model
   - Both directions should show cross-sections

2. **Test persistence:**
   - Enable thick slab mode (e.g., 10mm)
   - Scroll through the model
   - Stop at various positions
   - Cross-section should remain visible as long as plane intersects model

3. **Monitor console logs:**
   - Look for "ASYMMETRIC HITS DETECTED" warnings (should not appear with fix)
   - Check array sizes match offsets array (should always be equal)
   - Verify slice distribution shows both +side and -side hits

4. **Edge cases:**
   - Very thin models (should work in both slab and thin modes)
   - Models with gaps (should gracefully fall back to thin slice in gap regions)
   - Changing slab thickness during interaction (should properly resize arrays)

---

## Files Modified

- `Viewers/extensions/cornerstone/src/services/PlaneCutterService/PlaneCutterService.ts`
  - Lines ~878-895: Added proper array sizing logic (Bug 1 fix)
  - Lines ~954-1010: Changed zero-hit logic to use thin-slice fallback (Bug 2 fix)
  - Lines ~946-958: Enhanced diagnostic logging
  - Lines ~593: Increased logging frequency from 2% to 10%

