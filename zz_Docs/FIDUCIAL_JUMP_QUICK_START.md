# Fiducial Crosshair Jump - Quick Start Guide

## ✨ What Was Implemented

When a user clicks on a fiducial marker in the measurement table, the crosshairs now **automatically move to that fiducial's 3D position**.

---

## 🎯 How to Use

1. **Create Fiducials:**
   - Select FiducialMarker tool
   - Click on image to place fiducials
   - Fiducials appear in measurement panel

2. **Jump to Fiducial:**
   - Click on any fiducial row in measurement table
   - ✨ **Crosshairs automatically move to that fiducial**
   - All MPR viewports update to show the fiducial location

---

## 📝 What Changed

**File Modified:** `extensions/cornerstone/src/commandsModule.ts`

**Lines:** 188-219

**What It Does:**
- Detects when a FiducialMarker is clicked in measurement table
- Extracts the fiducial's 3D world coordinates
- Moves all active crosshair instances to that position
- Updates all linked viewports

---

## 🧪 Quick Test

```bash
1. Load a CT scan in MPR mode
2. Enable Crosshairs tool (toolbar button)
3. Enable FiducialMarker tool
4. Place 2-3 fiducials in different locations
5. Open measurement panel
6. Click on different fiducials in the list
   ✅ Crosshairs should jump to each fiducial's position
```

---

## 💡 Key Points

✅ **Works automatically** - No extra configuration needed
✅ **Only for fiducials** - Other measurements work normally
✅ **Crosshairs must be active** - Enable crosshairs tool first
✅ **Console logging** - Check browser console for debug info
✅ **Backwards compatible** - Doesn't break existing functionality

---

## 🔍 Debug Console Logs

When you click a fiducial, you'll see in the console:

```
🎯 FiducialMarker clicked - Moving crosshairs to fiducial position
📍 Fiducial world position: [128.5, 64.2, 92.7]
🎯 Moving crosshairs in tool group mpr to fiducial position
```

---

## 📚 Full Documentation

See `FIDUCIAL_CROSSHAIR_JUMP_IMPLEMENTATION.md` for complete details.

---

**Status:** ✅ Ready to test
**Last Updated:** 2025-11-07
