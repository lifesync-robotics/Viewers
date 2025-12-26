# Engine Render Test - Finding the Camera Auto-Following Bug

## The Mystery

**Observation:** When you drag a screw, the viewport updates so the screw stays centered on screen, AS IF the camera is following the screw.

**Evidence:** Camera monitor shows ZERO `CAMERA_MODIFIED` events during drag.

**Conclusion:** The camera IS moving, but through a mechanism that doesn't trigger `CAMERA_MODIFIED` events.

## The Hypothesis

In `modelStateService.translateScrew()` and `modelStateService.rotateScrew()`, after updating the screw model's transform, the code calls:

```javascript
// Trigger re-render
const renderingEngines = getRenderingEngines();
for (const engine of renderingEngines) {
  engine.render();
}
```

**Hypothesis:** This `engine.render()` call might be triggering:
1. Viewport auto-framing (automatically centering camera on scene bounds)
2. Camera synchronization between viewports
3. Some other camera update mechanism that bypasses the normal event system

## The Test

We've **temporarily disabled** the `engine.render()` calls in both:
- `translateScrew()` (line ~2712)
- `rotateScrew()` (line ~3001)

### What to Test:

1. **Hard refresh** (Ctrl+Shift+R)

2. **Drag a screw**:
   - Click on any screw (left or right)
   - Drag it around
   - **Watch the viewports**

3. **Expected Results:**

   **BEFORE (with engine.render enabled):**
   - ❌ Viewport "follows" the screw
   - ❌ Screw stays centered on screen
   - ❌ Anatomy appears to move relative to screen

   **AFTER (with engine.render disabled):**
   - ✅ Viewport stays frozen
   - ✅ Screw appears to "move off screen" (actually correct!)
   - ✅ Anatomy stays stationary

### What This Tells Us:

**If viewports NOW stay frozen:**
- ✅ **Bug found!** `engine.render()` is causing the camera to follow the screw
- We need to replace it with a selective render that doesn't update cameras
- Or we need to find why `engine.render()` is moving cameras

**If viewports STILL move:**
- ❌ The bug is elsewhere
- Need to investigate other potential causes:
  - Viewport synchronization service
  - 3D viewport auto-framing
  - CrosshairsTool (even though we disabled it)

## Side Effect of This Test

**Note:** With `engine.render()` disabled, the screw model updates won't be visible during drag. This is expected! The screw IS moving in 3D space, but the viewports aren't re-rendering to show the new position.

This is a temporary test to isolate the bug. Once we identify the culprit, we'll re-enable rendering in the correct way.

## Next Steps After Test

### If Freezing Works:
1. Re-enable `engine.render()` but make it smarter
2. Either:
   - Render only the edited viewport (not all viewports)
   - Or prevent camera updates during render
   - Or defer rendering until mouse up

### If Still Moving:
1. Check if there's a viewport sync service active
2. Check 3D viewport camera mode settings
3. Add more granular logging to track down the camera update

---

## Test Now!

**Hard refresh and drag a screw. Does the viewport stay frozen?**

Report back with YES/NO and we'll know exactly where the bug is!

