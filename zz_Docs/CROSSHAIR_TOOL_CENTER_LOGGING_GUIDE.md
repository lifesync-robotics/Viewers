# Crosshair Tool Center Logging Guide

## 🎯 Overview

Console logging has been added to track when the crosshair tool center is computed and updated. This guide explains all the listeners and triggers that are now logged.

---

## 📊 Listeners That Track Crosshair Changes

### 1. **Tool Lifecycle Listeners**

These are called when the tool state changes:

#### `onSetToolActive()`
- **Trigger:** When crosshairs tool becomes the active tool
- **Console Log:** `🟢 onSetToolActive TRIGGERED - Computing tool center`
- **Action:** Computes tool center and subscribes to volume changes

#### `onSetToolPassive()`
- **Trigger:** When crosshairs tool becomes passive (another tool active)
- **Console Log:** `🟡 onSetToolPassive TRIGGERED - Computing tool center`
- **Action:** Recomputes tool center

#### `onSetToolEnabled()`
- **Trigger:** When crosshairs tool is enabled (but not active)
- **Console Log:** `🔵 onSetToolEnabled TRIGGERED - Computing tool center`
- **Action:** Computes tool center

---

### 2. **Camera Modification Listener**

#### `onCameraModified()`
- **Trigger:** When viewport camera changes (pan, zoom, rotate)
- **Console Log:** `📷 onCameraModified TRIGGERED`
- **Details Logged:**
  - Viewport ID
  - Camera position delta
  - Camera focal point delta
  - Whether it's a rotation
  - Whether camera moved in plane
  - If tool center will be updated

**Tool Center Update Logic:**
```javascript
if (!isRotation && !cameraModifiedInPlane) {
  // Tool center is updated by adding the camera delta
  // Console shows: "🎯 Tool Center UPDATED via Camera Modification"
}
```

---

### 3. **Volume Change Listener**

#### `_onNewVolume()`
- **Trigger:** When a new volume is loaded into a viewport
- **Console Log:** `📦 _onNewVolume TRIGGERED - New volume loaded, computing tool center`
- **Action:** Recomputes tool center for new volume

---

### 4. **Manual Triggers**

#### `resetCrosshairs()`
- **Trigger:** Called by OHIF when camera is reset or viewport data changes
- **Console Log:** `🔄 resetCrosshairs TRIGGERED - Resetting all viewports and computing tool center`
- **Action:** Resets all viewport cameras and recomputes tool center

#### `computeToolCenter()` (Public Method)
- **Trigger:** Called externally (e.g., from OHIF commands)
- **Console Log:** `🎲 computeToolCenter PUBLIC METHOD CALLED - User/external trigger`
- **Action:** Recomputes tool center

---

## 🎯 Core Calculation Method

### `_computeToolCenter(viewportsInfo)`

This is the **core method** that calculates the tool center from viewport planes.

**Console Logs:**

```
🎯 _computeToolCenter CALLED
📊 Number of viewports: 3

📍 Viewport Info: {
  firstViewport: "viewport-1",
  secondViewport: "viewport-2",
  thirdViewport: "viewport-3"
}

✈️ Viewport 1 Plane: {
  viewportId: "viewport-1",
  normal: [0, 0, 1],           // View plane normal (direction)
  point: [128, 128, 64]        // Point on plane (center)
}

✈️ Viewport 2 Plane: {
  viewportId: "viewport-2",
  normal: [1, 0, 0],
  point: [128, 128, 64]
}

✈️ Viewport 3 Plane: {
  viewportId: "viewport-3",
  normal: [0, 1, 0],
  point: [128, 128, 64]
}

📐 Plane Equations: {
  plane1: [A1, B1, C1, D1],    // Plane equation: A1x + B1y + C1z = D1
  plane2: [A2, B2, C2, D2],
  plane3: [A3, B3, C3, D3]
}

⭐ CALCULATED TOOL CENTER: {
  x: 128.456,
  y: 128.789,
  z: 64.123,
  raw: [128.456, 128.789, 64.123]
}
```

---

## 🔧 Tool Center Setting

### `setToolCenter(toolCenter, suppressEvents)`

Called after tool center is calculated.

**Console Logs:**

```
🔧 setToolCenter CALLED: {
  newToolCenter: [128.456, 128.789, 64.123],
  previousToolCenter: [128.000, 128.000, 64.000],
  suppressEvents: false,
  toolGroupId: "mpr"
}

🎨 Triggering render for viewports: ["viewport-1", "viewport-2", "viewport-3"]

📡 Broadcasting CROSSHAIR_TOOL_CENTER_CHANGED event: {
  toolGroupId: "mpr",
  toolCenter: [128.456, 128.789, 64.123]
}
```

---

## 📝 Event Flow Examples

### Example 1: User Activates Crosshairs Tool

```
🟢 onSetToolActive TRIGGERED - Computing tool center
🎯 _computeToolCenter CALLED
📊 Number of viewports: 3
📍 Viewport Info: {...}
✈️ Viewport 1 Plane: {...}
✈️ Viewport 2 Plane: {...}
✈️ Viewport 3 Plane: {...}
📐 Plane Equations: {...}
⭐ CALCULATED TOOL CENTER: {x: 128.5, y: 128.5, z: 64.5}
🔧 setToolCenter CALLED: {...}
🎨 Triggering render for viewports: [...]
📡 Broadcasting CROSSHAIR_TOOL_CENTER_CHANGED event: {...}
```

### Example 2: User Pans a Viewport

```
📷 onCameraModified TRIGGERED
📷 Camera Change Details: {
  viewportId: "viewport-1",
  deltaCameraPosition: [10, 0, 0],
  deltaCameraFocalPoint: [10, 0, 0],
  ...
}
📷 Camera Modification Type: {
  isRotation: false,
  cameraModifiedInPlane: true,
  willUpdateToolCenter: false
}
```

### Example 3: User Scrolls Through Slices (Out-of-Plane Pan)

```
📷 onCameraModified TRIGGERED
📷 Camera Change Details: {...}
📷 Camera Modification Type: {
  isRotation: false,
  cameraModifiedInPlane: false,
  willUpdateToolCenter: true
}
🎯 Tool Center UPDATED via Camera Modification: {
  oldToolCenter: [128.5, 128.5, 64.5],
  newToolCenter: [128.5, 128.5, 65.5],
  delta: [0, 0, 1]
}
```

### Example 4: Viewport Data Changed (OHIF Event)

```
🔄 resetCrosshairs TRIGGERED - Resetting all viewports and computing tool center
🎯 _computeToolCenter CALLED
📊 Number of viewports: 3
[... full calculation logs ...]
⭐ CALCULATED TOOL CENTER: {x: 130.2, y: 130.8, z: 65.3}
🔧 setToolCenter CALLED: {...}
```

---

## 🔍 What to Look For

### When Debugging Crosshair Position Issues:

1. **Check if `_computeToolCenter` is being called**
   - Look for: `🎯 _computeToolCenter CALLED`
   - Should appear when tool activates or viewports change

2. **Verify viewport plane data**
   - Look for: `✈️ Viewport X Plane`
   - Check that normals are correct (e.g., axial: [0,0,1], sagittal: [1,0,0])
   - Check that points are reasonable

3. **Verify calculated tool center**
   - Look for: `⭐ CALCULATED TOOL CENTER`
   - Should be roughly at the center of your volume
   - Check x, y, z values make sense for your data

4. **Check camera modifications**
   - Look for: `📷 onCameraModified TRIGGERED`
   - See if `willUpdateToolCenter` is true when expected
   - Verify delta values match your pan/scroll action

5. **Monitor event broadcasting**
   - Look for: `📡 Broadcasting CROSSHAIR_TOOL_CENTER_CHANGED event`
   - This event synchronizes other viewports

---

## 🎮 Testing Instructions

1. **Open the OHIF Viewer** with MPR viewports
2. **Open Browser Console** (F12 → Console tab)
3. **Activate Crosshairs Tool**
   - Look for `🟢 onSetToolActive TRIGGERED`
   - Should see full calculation with plane equations

4. **Pan a viewport** (in-plane)
   - Look for `📷 onCameraModified`
   - `cameraModifiedInPlane` should be `true`
   - Tool center should NOT update

5. **Scroll through slices** (out-of-plane)
   - Look for `📷 onCameraModified`
   - `cameraModifiedInPlane` should be `false`
   - Tool center SHOULD update
   - Look for `🎯 Tool Center UPDATED via Camera Modification`

6. **Load new series**
   - Look for `📦 _onNewVolume TRIGGERED` or `🔄 resetCrosshairs TRIGGERED`
   - Should see full recalculation

---

## 📍 File Modified

**File:** `node_modules/@cornerstonejs/tools/dist/esm/tools/CrosshairsTool.js`

**Modified Sections:**
- `_computeToolCenter()` - Lines ~144-214
- `setToolCenter()` - Lines ~1231-1257
- `onSetToolActive()` - Lines ~1201-1207
- `onSetToolPassive()` - Lines ~1208-1212
- `onSetToolEnabled()` - Lines ~1213-1217
- `onCameraModified()` - Lines ~272-341
- `_onNewVolume()` - Lines ~740-744
- `resetCrosshairs()` - Lines ~111-140
- `computeToolCenter()` - Lines ~141-145

---

## 🚨 Important Notes

1. **This modifies node_modules** - Changes will be lost if you reinstall packages
2. **Development Only** - Remove these logs before production
3. **Performance** - Extensive logging may impact performance in production
4. **Browser Console** - Filter by emoji (🎯, 📷, etc.) to find relevant logs

---

## 🔗 Related Events in OHIF

The OHIF viewer also has listeners that call these methods:

**In:** `extensions/cornerstone/src/init.tsx`

```typescript
// Camera Reset Event → resetCrosshairs
element.addEventListener(EVENTS.CAMERA_RESET, evt => {
  commandsManager.runCommand('resetCrosshairs', { viewportId });
});

// Camera Modified Event → resetCrosshairs (debounced)
element.addEventListener(EVENTS.CAMERA_MODIFIED, evt => {
  // After 100ms debounce
  commandsManager.runCommand('resetCrosshairs', { viewportId });
});

// Viewport Data Changed → resetCrosshairs
cornerstoneViewportService.subscribe(
  cornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED,
  ({ viewportId }) => {
    commandsManager.runCommand('resetCrosshairs', { viewportId });
  }
);
```

These OHIF listeners will trigger `🎲 computeToolCenter PUBLIC METHOD CALLED` or `🔄 resetCrosshairs TRIGGERED`.

---

## 📖 Quick Reference

| Emoji | Meaning |
|-------|---------|
| 🎯 | Core computation method |
| ⭐ | Final calculated tool center |
| 🔧 | Setting tool center |
| 🟢 | Tool activated |
| 🟡 | Tool passive |
| 🔵 | Tool enabled |
| 📷 | Camera modified |
| 📦 | New volume loaded |
| 🔄 | Crosshairs reset |
| 🎲 | Public method called |
| 📊 | Viewport count |
| 📍 | Viewport IDs |
| ✈️ | Viewport plane data |
| 📐 | Plane equations |
| 🎨 | Render trigger |
| 📡 | Event broadcast |

---

## 🎓 Understanding the Output

### World Coordinates
The tool center is in **world coordinates** (patient/DICOM coordinate system):
- **X**: Left (-) to Right (+)
- **Y**: Posterior (-) to Anterior (+)
- **Z**: Inferior (-) to Superior (+)

### Plane Normals
- **Axial viewport**: normal ≈ [0, 0, 1] (perpendicular to Z)
- **Sagittal viewport**: normal ≈ [1, 0, 0] (perpendicular to X)
- **Coronal viewport**: normal ≈ [0, 1, 0] (perpendicular to Y)

### Tool Center Calculation
The tool center is where all three viewport planes intersect - this is calculated using **Cramer's Rule** to solve the system of three plane equations.

---

Happy debugging! 🐛🔍
