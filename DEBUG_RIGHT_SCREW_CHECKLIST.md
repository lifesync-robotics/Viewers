# Debug Checklist for "Right Screw Not Freezing" Issue

## Critical Log Messages to Watch

When you click and drag a RIGHT screw, check for these in the console:

### 1. Viewport ID Capture (Mouse Down)
```
[VIEWPORT_DEBUG] 📍 Clicked viewport: "fourUpMesh-mpr-sagittal" - This viewport will remain STATIONARY
```
**✅ PASS**: If you see this with a valid viewport ID
**❌ FAIL**: If viewport ID is `null` or `undefined`

### 2. Crosshairs Conflict Detection (Mouse Down)
```
[VIEWPORT_DEBUG] 🚨 EXTERNAL CAMERA UPDATE DETECTED on EDITED VIEWPORT
```
**✅ PASS**: If you DON'T see this during drag
**❌ FAIL**: If you see this repeatedly during drag → Something is fighting with our freeze

### 3. Viewport Update Check (Mouse Up)
```
[VIEWPORT_DEBUG] 📷 Mouse released - updating OTHER viewports (excluding: fourUpMesh-mpr-sagittal)
```
**✅ PASS**: If the excluded viewport matches the one you were editing
**❌ FAIL**: If it says "No editedViewportId available!" → Viewport ID wasn't captured

### 4. Camera Monitor Activity (During Drag)
```
[VIEWPORT_DEBUG] 📷 Camera update on viewport: XXXXX (different from edited, this is OK)
```
**✅ PASS**: If you only see this for OTHER viewports, not the edited one
**❌ FAIL**: If you see camera updates on the edited viewport

---

## Test Procedure

1. **Fresh start**: Hard refresh browser (Ctrl+Shift+R)
2. **Open console**: Filter by `[VIEWPORT_DEBUG]` or `[ScrewInteractionTool]`
3. **Click on RIGHT screw** (e.g., L3-R)
4. **Drag the screw** slowly
5. **Watch the edited viewport**: Does it stay still or move?
6. **Watch console logs**: Copy ALL `[VIEWPORT_DEBUG]` logs
7. **Release mouse**
8. **Share the logs**

---

## What We're Looking For

### Hypothesis 1: Viewport ID not captured for right screws
- Check if `state.viewportId` is `null` in the logs
- This would cause ALL viewports to update instead of excluding the edited one

### Hypothesis 2: External tool fighting with our freeze
- Check if camera monitor detects external updates on the edited viewport
- Could be crosshairs, could be some other tool

### Hypothesis 3: Different viewport for left vs right
- Check if left screws are edited in one viewport (e.g., axial)
- Check if right screws are edited in a different viewport (e.g., sagittal)
- Maybe one viewport has different tool configuration?

---

## Quick Test

**Left screw (working)**:
1. Click on L3-L
2. Viewport ID in logs: ________________
3. Viewport stays frozen: YES / NO
4. Camera monitor shows external updates: YES / NO

**Right screw (not working)**:
1. Click on L3-R
2. Viewport ID in logs: ________________
3. Viewport stays frozen: YES / NO
4. Camera monitor shows external updates: YES / NO

Compare the two. What's different?

