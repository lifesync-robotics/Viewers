# 3D Model Rendering Requirements

## ❌ **Problem: Wrong Viewport Type**

Your current viewport (`mpr-axial`) is a **2D MPR (Multi-Planar Reconstruction)** viewport, which **cannot properly render 3D mesh models**!

### What Happened:
```
Active viewport: mpr-axial
Viewport type: ORTHOGRAPHIC (2D slices)
Result: ❌ Cannot render 3D meshes
Error: WebGL context lost
```

---

## ✅ **Solution: Use a Volume3D Viewport**

3D model (OBJ, STL, PLY) rendering requires a **Volume3D viewport**.

### Viewport Types:

| Type | Can Render 3D Models? | Purpose |
|------|----------------------|---------|
| `STACK` | ❌ No | 2D image stack |
| `ORTHOGRAPHIC` (MPR) | ❌ No | 2D slice views (Axial, Sagittal, Coronal) |
| `VOLUME_3D` | ✅ **YES** | 3D volume rendering |

---

## 🔧 **How to Switch to 3D View**

### Option 1: Use Layout Selector

1. Click the **Layout** button in toolbar
2. Select a layout with a 3D viewport
3. Or switch the current viewport to 3D mode

### Option 2: Use 3D Mode

Look for a **3D** or **Volume Rendering** button/mode in the toolbar

### Option 3: Change Viewport Type Programmatically

```javascript
// In browser console or command
const { viewportGridService, cornerstoneViewportService } =
  window.servicesManager.services;

const activeViewportId = viewportGridService.getActiveViewportId();

// Check current type
const viewport = cornerstoneViewportService.getCornerstoneViewport(activeViewportId);
console.log('Current type:', viewport.type);
```

---

## 🎯 **Updated Workflow**

### Before Uploading Models:

1. **Load a study** (CT, MRI, etc.)
2. **Switch to 3D view** (Volume3D viewport)
3. **Then** click Upload Models button
4. Upload your OBJ/STL/PLY files

### Correct Sequence:
```
Study Loaded → 3D View Active → Upload Models → ✅ Models Render
```

### Wrong Sequence (What You Did):
```
Study Loaded → 2D MPR View Active → Upload Models → ❌ WebGL Error
```

---

## 📊 **Diagnostic Logs Added**

After restart, you'll see:

```
📦 [showModelUploadModal] Viewport type: ORTHOGRAPHIC
⚠️ [showModalUploadModal] Current viewport is NOT 3D capable!
⚠️ [showModalUploadModal] 3D models require a Volume3D viewport

🔧 [ModelStateService] Viewport type: ORTHOGRAPHIC
⚠️ [ModelStateService] Viewport is not Volume3D!
⚠️ [ModelStateService] The model may not render correctly
```

---

## 🐛 **WebGL Context Lost Issue**

The **WebGL: CONTEXT_LOST_WEBGL** errors occur because:

1. Trying to add 3D actors to a 2D viewport
2. VTK.js renderer gets confused
3. WebGL context becomes unstable
4. Browser loses WebGL context

**Fix:** Use the correct viewport type (Volume3D) from the start!

---

## 🔍 **Check Available Viewports**

Run this in browser console:

```javascript
const { viewportGridService, cornerstoneViewportService } =
  window.servicesManager.services;

const state = viewportGridService.getState();
console.log('All viewports:');

state.viewports.forEach((viewport, id) => {
  const csViewport = cornerstoneViewportService.getCornerstoneViewport(id);
  console.log(`${id}: type=${csViewport?.type}, active=${id === state.activeViewportId}`);
});
```

**Look for a viewport with `type=VOLUME_3D`** and switch to it!

---

## 🎨 **Example: Switching to 3D Viewport**

If you have multiple viewports in a grid layout:

```javascript
// Find a 3D viewport
const { viewportGridService, cornerstoneViewportService } =
  window.servicesManager.services;

const state = viewportGridService.getState();

for (const [id, viewport] of state.viewports) {
  const csViewport = cornerstoneViewportService.getCornerstoneViewport(id);
  if (csViewport?.type === 'VOLUME_3D') {
    console.log('Found 3D viewport:', id);
    viewportGridService.setActiveViewportId(id);
    console.log('Switched to 3D viewport!');
    break;
  }
}
```

Then try uploading again!

---

## 📝 **Summary**

| Issue | Status | Fix |
|-------|--------|-----|
| Modal shows | ✅ Fixed | Added viewportId prop |
| Component renders | ✅ Fixed | Props now passed correctly |
| Rendering engine found | ✅ Fixed | Now searches all engines |
| Viewport detection | ✅ Fixed | Finds correct viewport |
| **Viewport type wrong** | ⚠️ **USER ACTION NEEDED** | **Switch to 3D view first** |
| WebGL context lost | ⚠️ Consequence | Will stop after using 3D viewport |

---

## ✅ **Next Steps**

1. **Restart dev server** - Get new logging
2. **Load a study** - Any CT/MRI
3. **Switch to 3D view** - Find Volume3D viewport
4. **Click Upload Models** - Button in toolbar
5. **Upload model** - OBJ/STL/PLY file
6. **Check new logs** - Should show viewport type warnings

The new logs will tell you exactly what viewport type you're using and warn you if it's not suitable for 3D models!

---

## 🎓 **Understanding Viewport Types**

### MPR (Multi-Planar Reconstruction) - 2D
- Shows slices through volume data
- Axial, Sagittal, Coronal views
- **Cannot render 3D surface meshes**

### Volume3D - 3D
- Shows full 3D volume with ray casting
- Can add surface meshes (OBJ, STL, PLY)
- **Perfect for 3D model overlay**

---

**After switching to a Volume3D viewport, the model upload will work correctly!** 🚀
