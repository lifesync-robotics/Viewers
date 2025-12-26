# Adjacent Screw Transform Source - Critical Implementation Note

## Problem Discovery

When implementing adjacent screw orientation copying, we discovered a critical issue with transform data storage:

### The Issue
- ❌ **Backend transform**: Often contains identity/placeholder matrix
- ✅ **3D Model transform**: Contains the actual, correct orientation

### Why This Happens
1. Screw is placed and appears correctly in 3D viewer → transform applied to model
2. Screw is saved to backend → but backend may receive/store wrong transform
3. User clicks screw name to view → works correctly because it reads from 3D model
4. Adjacent screw search → failed initially because it read from backend

## Solution Implemented

When finding adjacent screw for orientation copying:

**WRONG (Original)**:
```typescript
adjacentScrewTransform = adjacentScrew.transform_matrix; // From backend - may be wrong!
```

**CORRECT (Fixed)**:
```typescript
// Get transform from 3D model in scene
const adjacentModel = modelStateService.getAllModels().find(
  (m: any) => m.metadata.name === adjacentScrew.screw_label
);

if (adjacentModel) {
  adjacentScrewTransform = modelStateService.getScrewTransform(adjacentModel.metadata.id);
  // This has the REAL orientation!
}
```

## Code Location

**File**: `ScrewManagementPanel.tsx`

**Function**: `saveScrew()` around line 1269-1295

**Key Change**: When adjacent screw is found, we now:
1. Find the corresponding 3D model in `modelStateService`
2. Call `modelStateService.getScrewTransform(modelId)` to get actual transform
3. Only fall back to backend transform if 3D model not found

## Why Viewing Works But Adjacent Copy Didn't

### Viewing a Screw (`restoreScrew` function)
```typescript
// Line 1896-1912
const existingModel = modelStateService.getAllModels().find(...);
if (existingModel) {
  const currentTransform = modelStateService.getScrewTransform(existingModel.metadata.id);
  // ✅ Gets REAL transform from 3D model
}
```

### Adjacent Screw Search (Before Fix)
```typescript
// Original code
const adjacentScrew = findAdjacentScrew(level, side, screws); // Gets data from backend
adjacentScrewTransform = adjacentScrew.transform_matrix; // ❌ Backend has wrong transform!
```

### Adjacent Screw Search (After Fix)
```typescript
// Fixed code
const adjacentScrew = findAdjacentScrew(level, side, screws);
const adjacentModel = modelStateService.getAllModels().find(...); // Look up 3D model
adjacentScrewTransform = modelStateService.getScrewTransform(adjacentModel.metadata.id); // ✅ Get REAL transform
```

## Root Cause (To Be Fixed Separately)

The underlying issue is that backend transform storage is not working correctly. This needs investigation:

### Possible Causes
1. **Frontend**: Transform not being sent correctly to backend during save
2. **Backend**: Transform not being stored correctly in database
3. **Frontend**: Transform not being loaded correctly from backend API response
4. **Timing**: Transform saved before model is fully positioned

### Debug Points
1. Check `saveScrew()` - what transform is being sent to backend?
2. Check backend API `/screws/add-with-transform` - what is received and stored?
3. Check backend API `/screws/{session_id}/list` - what transform is returned?
4. Check database schema - is transform stored as JSON or binary?

## Workaround Status

✅ **Adjacent screw orientation copying now works** by reading from 3D models

⚠️ **Backend transform storage issue remains** but doesn't break functionality

## Future Tasks

1. **Investigate backend transform storage** - why is it wrong?
2. **Fix at source** - ensure correct transform is saved to backend
3. **Add validation** - detect and warn when backend transform is identity
4. **Consider sync mechanism** - keep 3D model and backend in sync

## Testing Verification

To verify this fix works:

1. Place screw L4-L manually, adjust orientation in 3D viewer
2. L4-L appears with correct orientation ✅
3. Click L4-L in screw list to view → works ✅ (reads from 3D model)
4. Place L3-L next to L4-L
5. L3-L should copy L4-L's orientation ✅ (now reads from 3D model)

**Result**: All operations now work because they read from 3D model, not backend!

## Console Output

When adjacent screw copying works correctly, you'll see:

```
✅✅✅ ADJACENT SCREW FOUND! ✅✅✅
   Adjacent screw label: L4-L
   🔍 Looking for 3D model to get actual transform...
   ✅ Found 3D model: screw_123
   ✅ Using transform from 3D model (REAL orientation)
   
   📐 ADJACENT SCREW ROTATION MATRIX (3x3):
      [0.9980, 0.0520, -0.0340]  ← Real values, not identity!
      [-0.0530, 0.9980, -0.0120]
      [0.0330, 0.0140, 0.9990]
```

If 3D model not found (shouldn't happen for existing screws):

```
   ⚠️ 3D model not found in scene, using backend transform
      This may be identity/placeholder if screw was just loaded
```

## Related Files

- **`ScrewManagementPanel.tsx`**: Main implementation
- **`adjacentScrewFinder.ts`**: Helper to find adjacent screws (uses backend data only)
- **`modelStateService.ts`**: Manages 3D models and their transforms

## Summary

The key insight: **3D models are the source of truth for transforms**, not the backend. All transform reads should prioritize 3D models when available.

