# Viewport Freeze Debug Test - Finding Who Updates the Camera

## Current State

We've disabled ALL viewport camera updates in `ScrewInteractionTool.mouseUpCallback`.  
**If viewports STILL move, something ELSE is updating the camera.**

## Installed Debug Tools

### 1. Camera Monitor (Global Event Listener)
- Catches **EVERY** camera update from ANY source
- Logs which viewport changed
- Shows **stack trace** to identify the code causing the update
- Look for: `[VIEWPORT_DEBUG] 🚨 EXTERNAL CAMERA UPDATE DETECTED`

### 2. Crosshairs Verification
- Logs Crosshairs state BEFORE and AFTER disabling
- Verifies Crosshairs is actually set to "Disabled" mode
- Look for: `[VIEWPORT_DEBUG] ❌ FAILED to disable Crosshairs`

### 3. Viewport ID Tracking
- Confirms viewport ID is correctly captured on mouse down
- Ensures exclusion logic would work (even though it's currently disabled)

---

## Test Procedure

### Step 1: Hard Refresh
```
Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
```
This clears build cache and ensures latest code is loaded.

### Step 2: Open Console & Filter
```
Console → Filter: [VIEWPORT_DEBUG]
```
This shows only our diagnostic messages.

### Step 3: Click on a Screw
**Watch for these logs:**

```
[VIEWPORT_DEBUG] 🔄 Disabling Crosshairs to prevent viewport camera conflicts...
[VIEWPORT_DEBUG]    🔍 Crosshairs in toolGroup XXXX:
[VIEWPORT_DEBUG]       Before: mode="Active", active=true
[VIEWPORT_DEBUG]       After: mode="Disabled", disabled=true
[VIEWPORT_DEBUG]    ✅ Successfully disabled Crosshairs in toolGroup: XXXX
```

**✅ PASS:** Crosshairs disabled successfully  
**❌ FAIL:** If you see `❌ FAILED to disable Crosshairs` → Crosshairs is fighting us

### Step 4: Drag the Screw
**Watch the viewport:**
- Does the edited viewport move? YES / NO
- Do other viewports move? YES / NO (they shouldn't either in test mode)

**Watch the console for camera monitor alerts:**

```
[VIEWPORT_DEBUG] 🚨 EXTERNAL CAMERA UPDATE DETECTED on EDITED VIEWPORT: fourUpMesh-mpr-sagittal
[VIEWPORT_DEBUG]    This should NOT happen during drag!
[VIEWPORT_DEBUG]    Camera focal point: [x, y, z]
[VIEWPORT_DEBUG]    Stack trace:
    at <function name>  ← WHO IS UPDATING THE CAMERA?
    at <file:line>
    ...
```

### Step 5: Release Mouse
**With ALL updates disabled, nothing should change.**

**Watch console:**

```
[VIEWPORT_DEBUG] 🧪 TEST MODE: ALL viewport updates DISABLED
[VIEWPORT_DEBUG] 📷 Mouse released - viewport update would normally happen here
[VIEWPORT_DEBUG] 🧪 TEST: Skipping viewport update to isolate drag behavior
```

---

## What We're Looking For

### Scenario A: Crosshairs Not Actually Disabled
**Symptom:** Logs show Crosshairs is still "Active" after disable attempt  
**Fix:** Need to force disable crosshairs more aggressively

### Scenario B: External Tool Updating Camera
**Symptom:** Camera monitor shows external updates with stack trace  
**Fix:** Identify the tool/code and disable it during screw editing

### Scenario C: Model Rendering Triggers Camera Update
**Symptom:** Camera updates happen right after `engine.render()` calls  
**Fix:** Need to prevent render from affecting camera

### Scenario D: Viewport Actually Frozen (Visual Illusion)
**Symptom:** No camera monitor alerts, but viewport "appears" to move  
**Reality:** Screw model is moving, camera is stationary, creates illusion of movement  
**Fix:** This is actually correct behavior!

---

## Questions to Answer

1. **Does Crosshairs successfully disable?**
   - Check for: `✅ Successfully disabled Crosshairs` in logs
   - If NO → This is the bug

2. **Does camera monitor catch any external updates during drag?**
   - Check for: `🚨 EXTERNAL CAMERA UPDATE DETECTED`
   - If YES → Check stack trace to see WHO is updating it

3. **Does the same behavior occur for BOTH left and right screws?**
   - Test LEFT screw: Crosshairs disabled? Camera updates?
   - Test RIGHT screw: Crosshairs disabled? Camera updates?
   - Compare the two

4. **Is it the same viewport for both screws?**
   - LEFT screw: Edited viewport ID = _______________
   - RIGHT screw: Edited viewport ID = _______________
   - Different viewports might have different tool configurations

---

## Next Steps

**After running this test, share:**

1. Screenshot of console logs (filter by `[VIEWPORT_DEBUG]`)
2. Answer the 4 questions above
3. Any error messages or unexpected behavior

This will pinpoint exactly what's causing the viewport movement!

