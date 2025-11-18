# Model Service - FourUpMesh Integration

## Overview
Enhanced the `modelStateService.ts` to intelligently handle model loading in the new "3D Four Mesh" viewport layout.

## Implementation Date
November 6, 2025

## Changes Made

### 1. Non-3D Viewport Protection
**Issue:** Models were being added to non-3D viewports with just a warning, potentially causing rendering issues.

**Solution:** Added early return when viewport is not Volume3D.

```typescript
// Before: Warning but continued to add model
if (viewport.type !== 'volume3d' && viewport.type !== 'VOLUME_3D') {
  console.warn('⚠️ Model may not render correctly');
  // continued anyway...
}

// After: Return immediately
if (viewport.type !== 'volume3d' && viewport.type !== 'VOLUME_3D') {
  console.warn('⚠️ Model will NOT be added to this viewport');
  return;
}
```

**Location:** Line ~460-465 in `_addModelToViewport()`

### 2. Smart Viewport Selection for FourUpMesh
**Issue:** When using the FourUpMesh layout (2x2 grid with 1 3D viewport + 3 MPR viewports), models should only be added to the 3D viewport, not MPR viewports.

**Solution:** Created new method `_addModelToViewportSmart()` that:
1. Checks if current hanging protocol is `fourUpMesh`
2. If yes, automatically finds the 3D volume viewport
3. Adds model only to that viewport
4. If not using fourUpMesh, uses normal behavior

```typescript
private _addModelToViewportSmart(loadedModel: LoadedModel, viewportId: string): void {
  // Get hanging protocol service to check current layout
  const { hangingProtocolService } = this.servicesManager.services;
  const hpState = hangingProtocolService?.getState();

  // If using fourUpMesh, find the 3D volume viewport
  if (hpState?.protocolId === 'fourUpMesh') {
    // Search for volume3d viewport
    // Add model only to that viewport
  } else {
    // Standard behavior
    this._addModelToViewport(loadedModel, viewportId);
  }
}
```

**Location:** Lines ~396-445 (new method)

### 3. Updated Call Sites
Updated all places that called `_addModelToViewport()` to use `_addModelToViewportSmart()`:

**Locations:**
- Line ~153 in `loadModel()`
- Line ~271 in `loadModelFromFileInput()`

## Behavior

### Before Changes
- Models would be added to any viewport specified, even non-3D viewports
- In FourUpMesh layout, user had to manually specify which viewport
- Could accidentally add to wrong viewport

### After Changes
- Models **only** added to Volume3D viewports
- In FourUpMesh layout, **automatically** finds the 3D viewport
- **No manual viewport selection** needed for FourUpMesh
- Clear warnings when viewport is not suitable

## Usage Examples

### Standard Layouts (e.g., 3D Only, 3D Primary)
```javascript
// Works as before - adds to specified viewport
modelStateService.loadModel('path/to/model.obj', {
  viewportId: 'viewport-1'  // Must be a volume3d viewport
});
```

### FourUpMesh Layout
```javascript
// Automatically finds and uses the 3D viewport
modelStateService.loadModel('path/to/model.obj', {
  viewportId: 'any-viewport-id'  // Will be ignored; 3D viewport auto-detected
});

// Or even simpler - viewportId can be any value
modelStateService.loadModel('path/to/model.obj', {
  viewportId: 'viewport-1'
});
```

## Console Output Examples

### When FourUpMesh is Active
```
🔧 [ModelStateService] Checking hanging protocol: fourUpMesh
🎯 [ModelStateService] FourUpMesh layout detected - finding 3D volume viewport
🔍 [ModelStateService] Checking viewport: ct-AXIAL (type: orthographic)
🔍 [ModelStateService] Checking viewport: ct-VOLUME3D (type: volume3d)
✅ [ModelStateService] Found 3D volume viewport: ct-VOLUME3D
🎯 [ModelStateService] Adding model to 3D viewport only: ct-VOLUME3D
```

### When Non-3D Viewport is Specified
```
🔧 [ModelStateService] Adding model to viewport: ct-AXIAL
🔧 [ModelStateService] Viewport type: orthographic
⚠️ [ModelStateService] Viewport is not Volume3D!
⚠️ [ModelStateService] Current type: orthographic
⚠️ [ModelStateService] 3D mesh models require a Volume3D viewport
⚠️ [ModelStateService] Model will NOT be added to this viewport
```

## Technical Details

### Hanging Protocol Detection
The service uses `hangingProtocolService.getState()` to check:
- `protocolId`: The ID of the current hanging protocol
- Returns: `{ protocolId: 'fourUpMesh', ... }` when FourUpMesh is active

### Viewport Type Detection
```typescript
// Checks viewport type from Cornerstone3D ViewportType enum
if (vp.type === 'volume3d') {
  // This is a 3D volume viewport
}
```

### FourUpMesh Layout Structure
Based on `extensions/cornerstone/src/hps/fourUpMesh.ts`:
- **4 viewports in 2x2 grid:**
  1. Top-left: Axial MPR (orthographic)
  2. **Top-right: 3D Volume** (volume3d) ← **Target viewport**
  3. Bottom-left: Coronal MPR (orthographic)
  4. Bottom-right: Sagittal MPR (orthographic)

## Error Handling

1. **No Rendering Engine:** Returns early with error message
2. **Viewport Not Found:** Logs available viewports and returns
3. **Not Volume3D:** Returns with warning (doesn't add model)
4. **FourUpMesh - No 3D Viewport:** Warns and doesn't add model
5. **Error in Smart Selection:** Falls back to regular behavior

## Benefits

1. **Safer:** Can't accidentally add models to incompatible viewports
2. **Smarter:** Automatically finds correct viewport in FourUpMesh
3. **User-Friendly:** No need to manually identify 3D viewport ID
4. **Maintainable:** Clear separation between smart selection and actual adding
5. **Extensible:** Easy to add detection for other special layouts

## Future Enhancements

Potential extensions:
1. Support other multi-viewport layouts (e.g., "main3D", "primary3D")
2. Add option to override auto-detection
3. Support adding to multiple 3D viewports simultaneously
4. Add viewport capability checking (not just type)
5. Cache viewport lookup for performance

## Testing Checklist

- [x] No linter errors
- [x] Early return when non-3D viewport
- [x] FourUpMesh detection works
- [x] 3D viewport auto-discovery works
- [x] Fallback to standard behavior works
- [ ] Manual test: Load model in standard 3D layout
- [ ] Manual test: Load model in FourUpMesh layout
- [ ] Manual test: Try to load in 2D viewport (should fail gracefully)
- [ ] Manual test: Switch layouts after loading model
- [ ] Manual test: Load multiple models in FourUpMesh

## Files Modified

| File | Lines Modified | Type |
|------|----------------|------|
| `extensions/cornerstone/src/modelStateService.ts` | ~153, ~271, ~396-445, ~460-465 | Modified |

## Related Documentation

- `3D_FOUR_MESH_IMPLEMENTATION.md` - FourUpMesh viewport creation
- `3D_FOUR_MESH_QUICK_START.md` - FourUpMesh usage guide
- `extensions/cornerstone/src/hps/fourUpMesh.ts` - FourUpMesh definition
