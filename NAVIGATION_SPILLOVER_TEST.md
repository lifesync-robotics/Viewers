# Navigation Spillover Bug Investigation

##  The Smoking Gun

You were RIGHT! "Camera follows screw" is a NAVIGATION MODE feature!

## Key Findings:

### 1. Default Navigation Mode
```javascript
// navigationController.ts line 44
const defaultMode: NavigationModeName = savedMode || 'camera-follow';
```

**The system defaults to `'camera-follow'` mode!**

### 2. What Camera Follow Mode Does
From the architecture docs:
> "Viewport follows tool movement and rotation"  
> "Camera will follow tooltip, DICOM stays stationary"

### 3. The Connection
When you drag a screw:
1. `translateScrew()` updates the screw model position
2. Broadcasts `MODEL_UPDATED` event
3. **Some service might be listening** and treating screw movement like tool movement
4. Camera Follow Mode updates viewport camera to center on the "tool"

## Critical Questions:

### Q1: Is navigation currently active?
Run in browser console:
```javascript
window.__navigationController?.getStatus()
```

Look for: `navigating: true/false`

### Q2: Can we check navigation mode?
Run in console:
```javascript
window.__navigationController?.getNavigationMode()
```

Expected: `'camera-follow'` or `'instrument-projection'` or `null`

### Q3: Is there a listener connecting MODEL_UPDATED to camera updates?
We need to search for any code that:
- Subscribes to `MODEL_UPDATED` events
- Updates camera position in response

## Test Plan:

### Test 1: Disable Navigation Mode Temporarily
Add to browser console while dragging:
```javascript
if (window.__navigationController) {
  const status = window.__navigationController.getStatus();
  console.log('Navigation Status:', status);
  console.log('Mode:', window.__navigationController.getNavigationMode());
}
```

### Test 2: Check for VTK Renderer Auto-Framing
The 3D viewport uses VTK.js renderers. VTK has auto-framing features that might be triggered by actor updates.

Check if these VTK methods are being called:
- `renderer.resetCamera()` - Centers camera on all actors
- `renderer.resetCameraClippingRange()` - Adjusts clipping planes

## Potential Fixes:

### Fix 1: Disable Navigation During Screw Editing
In `ScrewInteractionTool.onSetToolActive()`:
```javascript
// Store navigation state
this.wasNavigating = window.__navigationController?.getStatus().navigating;

// Temporarily stop navigation
if (this.wasNavigating) {
  window.__navigationController?.stopNavigation();
}
```

In `ScrewInteractionTool.onSetToolDisabled()`:
```javascript
// Restore navigation
if (this.wasNavigating) {
  window.__navigationController?.startNavigation();
}
```

### Fix 2: Add "screw editing" exception to Camera Follow Mode
Modify `CameraFollowingMode.handleTrackingUpdate()` to ignore updates when screw editing is active.

### Fix 3: Prevent VTK Renderer Auto-Framing
If VTK is auto-framing, we need to disable it during screw editing.

## Next Step:

**Run the console commands while dragging a screw and report back:**
1. What does `window.__navigationController?.getStatus()` show?
2. What does `window.__navigationController?.getNavigationMode()` return?
3. Do you see any navigation-related console logs while dragging?

This will tell us if navigation mode is the culprit!

