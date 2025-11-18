# 🔧 Linear Mode Fix - Why It Was Still Circular

## ❌ **The Problem**

When you clicked the "Real-time Navigation" button in the toolbar, it was **still doing circular motion** even though we added linear mode to the server.

## 🔍 **Root Cause**

The toolbar button was calling `toggleNavigation` **without specifying the mode**, so it defaulted to `'circular'`:

```typescript
// ❌ OLD CODE (Default to circular)
commands: 'toggleNavigation',  // No mode specified!

// In commandsModule.ts:
toggleNavigation: ({ mode = 'circular' }) => {  // Defaults to 'circular'
  commandsManager.runCommand('startNavigation', { mode });
}
```

## ✅ **The Fix**

Updated the toolbar button to explicitly pass `mode: 'linear'`:

```typescript
// ✅ NEW CODE (Explicitly set to linear)
commands: [
  {
    commandName: 'toggleNavigation',
    commandOptions: { mode: 'linear' },  // ← Now passes linear!
  }
],
```

---

## 🚀 **Test It Now**

### **Step 1: Rebuild OHIF**

The toolbar button definition has changed, so you need to rebuild:

```bash
# Stop current OHIF (Ctrl+C in terminal running yarn dev)
# Then restart:
cd /home/asclepius/github/Viewers
yarn dev
```

### **Step 2: Hard Refresh**

Once OHIF restarts:

```bash
Ctrl + Shift + R  (hard refresh to clear cache)
```

### **Step 3: Test Linear Motion**

1. Load a DICOM study
2. Click **"Real-time Navigation (Linear)"** button
3. **Expected:** Viewport moves **up/down** (Z axis)
4. **Console shows:**
   ```
   🔄 Update #20 (19.8 Hz) → [102.4, 102.4, 95.3]  ← Z changing!
   🔄 Update #40 (19.9 Hz) → [102.4, 102.4, 120.0]
   🔄 Update #60 (20.0 Hz) → [102.4, 102.4, 70.0]
   ```

---

## 🎯 **What Changed**

| Aspect | Before | After |
|--------|--------|-------|
| **Button label** | "Real-time Navigation" | "Real-time Navigation (Linear)" |
| **Tooltip** | "Enable real-time surgical navigation..." | "Enable linear axial navigation (up/down through slices)" |
| **Default mode** | `circular` | `linear` ✅ |
| **Motion** | Circular in X-Y plane | Up/Down in Z axis ✅ |

---

## 🔄 **Switch Between Modes**

### **Option 1: Use Browser Console**

You can still use any mode via console:

```javascript
// Linear axial (up/down)
commandsManager.runCommand('startNavigation', { mode: 'linear' });

// Circular (default pattern)
commandsManager.runCommand('startNavigation', { mode: 'circular' });

// Linear sagittal (left/right)
commandsManager.runCommand('startNavigation', { mode: 'linear_sagittal' });

// Linear coronal (front/back)
commandsManager.runCommand('startNavigation', { mode: 'linear_coronal' });

// Random walk
commandsManager.runCommand('startNavigation', { mode: 'random' });
```

### **Option 2: Change Toolbar Button Default**

Edit `/home/asclepius/github/Viewers/modes/basic/src/toolbarButtons.ts` line ~655:

```typescript
commandOptions: { mode: 'linear' },  // Change to: 'circular', 'linear_sagittal', etc.
```

---

## 🧪 **Verification Checklist**

After rebuilding and refreshing:

- [ ] Button label shows: **"Real-time Navigation (Linear)"**
- [ ] Tooltip shows: **"Enable linear axial navigation (up/down through slices)"**
- [ ] Click button → viewport moves **up/down**
- [ ] Console shows Z coordinate changing: `[102.4, 102.4, Z]`
- [ ] X and Y coordinates stay constant
- [ ] Motion range: approximately ±50mm from center

---

## 📊 **Console Output (Expected)**

```
✅ Connected to tracking server
▶️ Starting tracking (mode: linear)  ← Should say "linear" not "circular"!
📍 Initial position stored: [102.4, 102.4, 70.0]
📊 Found 3 viewports: ['viewport-1', 'viewport-2', 'viewport-3']

🔄 Update #20 (19.8 Hz) → [102.4, 102.4, 85.3]  ← Z increasing
🔄 Update #40 (19.9 Hz) → [102.4, 102.4, 98.7]  ← Z increasing
🔄 Update #60 (20.0 Hz) → [102.4, 102.4, 107.2] ← Z near peak
🔄 Update #80 (20.1 Hz) → [102.4, 102.4, 98.7]  ← Z decreasing
🔄 Update #100 (19.9 Hz) → [102.4, 102.4, 85.3] ← Z decreasing
🔄 Update #120 (20.0 Hz) → [102.4, 102.4, 70.0] ← Z at center
```

**Key indicators:**
- ✅ Mode shows as `linear`
- ✅ Only Z coordinate changes
- ✅ X and Y stay at `102.4`
- ✅ Z oscillates between ~20 and ~120

---

## ⚠️ **If Still Circular After Rebuild**

### **Check 1: Verify Mode in Console**

```javascript
// Click navigation button, then check:
window.__navigationController?.getStatus()
```

**Expected:**
```javascript
{
  navigating: true,
  updateCount: 123,
  // Check what mode was used
}
```

### **Check 2: Check Python Server Log**

In the terminal running `tracking_server.py`, you should see:

```
▶️ Starting tracking mode: linear  ← Should say "linear"
```

If it says `"circular"`, the mode isn't being passed correctly.

### **Check 3: Force Mode via Console**

```javascript
// Stop current navigation
commandsManager.runCommand('stopNavigation');

// Wait a moment
setTimeout(() => {
  // Start with explicit mode
  commandsManager.runCommand('startNavigation', { mode: 'linear' });
}, 500);
```

---

## 🛠️ **Debugging Commands**

```javascript
// Check if button command is configured correctly
const toolbarService = servicesManager.services.toolbarService;
const buttons = toolbarService.getButtons();
const navButton = buttons.find(b => b.id === 'RealTimeNavigation');
console.log('Navigation button config:', navButton);

// Should show:
// commands: [{ commandName: 'toggleNavigation', commandOptions: { mode: 'linear' } }]
```

---

## ✅ **Summary**

| Issue | Solution | Status |
|-------|----------|--------|
| Button used circular mode | Changed button to pass `mode: 'linear'` | ✅ Fixed |
| Server supports linear mode | Already implemented | ✅ Ready |
| Need to rebuild | Restart `yarn dev` | ⚠️ Required |
| Need to refresh | Hard refresh browser | ⚠️ Required |

---

## 🚀 **Action Required**

1. **Stop OHIF:** `Ctrl+C` in terminal running `yarn dev`
2. **Restart OHIF:** `yarn dev`
3. **Wait for build:** "Compiled successfully!"
4. **Hard refresh browser:** `Ctrl + Shift + R`
5. **Test:** Click "Real-time Navigation (Linear)" button
6. **Verify:** Watch viewport move up/down in Z axis

---

**Status:** ✅ Fixed in code, needs rebuild to take effect!

**Commit:** `61189439` on `navigation-viewer` branch
