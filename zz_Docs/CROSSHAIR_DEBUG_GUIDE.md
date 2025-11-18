# Crosshair Detection Debug Guide

## Issue: "Crosshairs not active or center not available"

If you see this warning when trying to save a screw, it means the crosshair detection system cannot find or access the crosshairs tool data.

## Quick Fix - Use the Test Button

### Step 1: Click the Test Button
In the Screw Management panel, you'll now see a **🧪 Test Crosshairs** button in the top right corner (purple button).

### Step 2: Activate Crosshairs
1. Click the crosshairs icon in the OHIF toolbar
2. Click and drag in any viewport to position the crosshairs
3. Click the **🧪 Test Crosshairs** button again

### Step 3: Check Results
The test will show you one of three results:

#### ✅ Success: "Crosshairs Detected!"
```
Position: [x, y, z]
```
**Meaning**: Crosshairs are working correctly. You can now save screws.

#### ❌ Error: "Crosshairs Not Active"
**Meaning**: The crosshairs tool is not activated.

**Solution**:
1. Find the crosshairs icon in the toolbar (usually looks like ✛ or ⊕)
2. Click it to activate
3. Click and drag in a viewport to position crosshairs
4. Test again

#### ⚠️ Warning: "Crosshairs Active but No Center"
**Meaning**: Tool is active but position data unavailable.

**Solution**:
1. Click and drag the crosshairs in a viewport
2. Scroll through a few slices
3. Wait 1-2 seconds for data to update
4. Test again

## Detailed Console Output

When you click **🧪 Test Crosshairs**, open the browser console (F12) to see detailed diagnostics:

### What to Look For

```javascript
═══════════════════════════════════════════════════════
🧪 [DEBUG] TESTING CROSSHAIR DETECTION
═══════════════════════════════════════════════════════
✅ Cache cleared

📊 Crosshair Detection Results:
  - isActive: true/false      ← Tool activation status
  - hasCenter: true/false     ← Position data available
  - center: [x, y, z] or null ← 3D coordinates
  - viewportId: "viewport-id" ← Viewport reference

📊 MPR Crosshair Centers:
  mpr-axial: { isActive: true, center: [x, y, z] }
  mpr-sagittal: { isActive: true, center: [x, y, z] }
  mpr-coronal: { isActive: true, center: [x, y, z] }

📊 Available Viewports:
  [
    { id: "mpr-axial", type: "orthographic", element: true },
    { id: "mpr-sagittal", type: "orthographic", element: true },
    ...
  ]
═══════════════════════════════════════════════════════
```

## Common Issues and Solutions

### Issue 1: `isActive: false`

**Problem**: Crosshairs tool not activated

**Solutions**:
- Click the crosshairs icon in toolbar
- Check if another tool is active (might need to switch)
- Try clicking directly on a viewport after activating

### Issue 2: `hasCenter: false` but `isActive: true`

**Problem**: Tool active but no position data

**Solutions**:
- Click and drag crosshairs to update position
- Scroll through a few slices
- Try switching between viewports
- Wait 1-2 seconds after moving crosshairs

### Issue 3: No viewports found

**Problem**: Rendering engine or viewports not initialized

**Console shows**: `❌ Rendering engine not found` or empty viewport list

**Solutions**:
- Wait for images to fully load
- Refresh the page
- Check if study loaded correctly
- Try a different hanging protocol

### Issue 4: Viewports don't have `element: true`

**Problem**: Viewport DOM elements not attached

**Solutions**:
- Wait a few seconds for viewport initialization
- Try resizing the browser window
- Switch to a different hanging protocol and back

## Enhanced Debugging (Added Features)

### Automatic Cache Refresh

The system now automatically clears the crosshair cache before checking, ensuring fresh data:

```javascript
// Old behavior: might use stale cached data
const crosshairData = crosshairsHandler.getCrosshairCenter();

// New behavior: always gets fresh data
crosshairsHandler.clearCache();
const crosshairData = crosshairsHandler.getCrosshairCenter();
```

### Detailed Logging

Enhanced console logs show exactly what's happening:

```javascript
📋 Crosshair data received: {
  isActive: true,
  hasCenter: true,
  center: [12.5, -45.3, 78.9],
  viewportId: "mpr-axial"
}

✅ Crosshair center (translation): [12.5, -45.3, 78.9]
```

If crosshairs not found:
```javascript
⚠️ Crosshairs tool is not active
💡 Hint: Activate the crosshairs tool from the toolbar
```

or

```javascript
⚠️ Crosshair center is not available
💡 Hint: Make sure crosshairs are positioned in the viewport
```

## Step-by-Step Troubleshooting

### 1. Verify Tool is Active

```
Action: Click 🧪 Test Crosshairs button
Look for: isActive: true in console
If false: Click crosshairs icon in toolbar
```

### 2. Verify Position Data

```
Action: Click and drag crosshairs
Look for: center: [x, y, z] in console
If null: Drag crosshairs again, wait 2 seconds
```

### 3. Verify Viewports Loaded

```
Action: Check console for viewport list
Look for: mpr-axial, mpr-sagittal, mpr-coronal
If missing: Switch hanging protocol or refresh
```

### 4. Verify DOM Elements

```
Action: Check element: true for each viewport
Look for: All viewports have element: true
If false: Wait for initialization or refresh
```

### 5. Try Manual Activation

```
1. Click crosshairs icon
2. Click in center of axial viewport
3. Drag to move crosshairs
4. Release mouse
5. Wait 2 seconds
6. Click 🧪 Test Crosshairs
```

## Working Example Console Output

When everything is working correctly, you should see:

```
═══════════════════════════════════════════════════════
🧪 [DEBUG] TESTING CROSSHAIR DETECTION
═══════════════════════════════════════════════════════
✅ Cache cleared

📊 Crosshair Detection Results:
  - isActive: true
  - hasCenter: true
  - center: [12.456, -45.789, 78.123]
  - viewportId: mpr-axial

📊 MPR Crosshair Centers:
  mpr-axial: {
    isActive: true,
    center: [12.456, -45.789, 78.123]
  }
  mpr-sagittal: {
    isActive: true,
    center: [12.456, -45.789, 78.123]
  }
  mpr-coronal: {
    isActive: true,
    center: [12.456, -45.789, 78.123]
  }

📊 Available Viewports: [
  { id: "mpr-axial", type: "orthographic", element: true },
  { id: "mpr-sagittal", type: "orthographic", element: true },
  { id: "mpr-coronal", type: "orthographic", element: true }
]
═══════════════════════════════════════════════════════
```

Then the alert shows:
```
✅ Crosshairs Detected!

Position: [12.46, -45.79, 78.12]

Check browser console (F12) for detailed information.
```

## Saving a Screw After Successful Test

Once the test shows ✅ success:

1. Enter screw radius (e.g., 2.0 mm)
2. Enter screw length (e.g., 40.0 mm)
3. Click "🔩 Save Screw Placement"

The console will show:
```
═══════════════════════════════════════════════════════
🔧 [ScrewManagement] CONSTRUCTING SCREW TRANSFORM
═══════════════════════════════════════════════════════
🔄 Clearing crosshair cache to get fresh data...

📋 Crosshair data received: {
  isActive: true,
  hasCenter: true,
  center: [12.456, -45.789, 78.123],
  viewportId: "mpr-axial"
}

✅ Crosshair center (translation): [12.456, -45.789, 78.123]
✅ Found axial viewport: mpr-axial
✅ Found sagittal viewport: mpr-sagittal

📐 Camera vectors:
  Axial Normal (col 0): [0.0, 0.0, 1.0]
  Axial Up (col 1): [0.0, 1.0, 0.0]
  Sagittal Normal (col 2): [1.0, 0.0, 0.0]

✅ Transform matrix constructed (4x4 row-major):
  Row 0: [0.0, 0.0, 1.0, 12.456]
  Row 1: [0.0, 1.0, 0.0, -45.789]
  Row 2: [1.0, 0.0, 0.0, 78.123]
  Row 3: [0.0, 0.0, 0.0, 1.0]
═══════════════════════════════════════════════════════

✅ Screw transform captured from viewport cameras and crosshair center
✅ Saved screw: "Screw 11/11/2025, 3:45:23 PM" (R: 2.0mm, L: 40.0mm)
```

## Still Having Issues?

### Check crosshairsHandler.ts

If the test shows the tool is active but center is null, there might be an issue with how the crosshairs tool stores its annotation data.

**Check**:
1. Open browser console (F12)
2. Run: `window.cornerstoneTools.annotation.state.getAllAnnotations()`
3. Look for 'Crosshairs' annotations
4. Verify they have handles.rotationPoints or handles.toolCenter

### Check Tool Configuration

The crosshairs tool might be configured differently in your setup:

```javascript
// In browser console:
const toolGroup = window.cornerstoneTools.ToolGroupManager.getToolGroup('default');
const crosshairsTool = toolGroup.getToolInstance('Crosshairs');
console.log('Crosshairs config:', crosshairsTool);
```

### Fallback to Camera Focal Point

If crosshairs consistently fail, you could modify the code to use camera focal point as fallback:

```javascript
// In constructScrewTransform(), after checking crosshairs:
if (!crosshairData.center) {
  // Fallback to axial viewport camera focal point
  const axialCamera = axialViewport.getCamera();
  translation = axialCamera.focalPoint;
  console.log('⚠️ Using camera focal point as fallback:', translation);
}
```

## Summary

The **🧪 Test Crosshairs** button provides:
- ✅ Instant diagnostic information
- ✅ Clear, actionable error messages
- ✅ Detailed console logging
- ✅ Step-by-step guidance

Use it whenever you encounter crosshair detection issues to quickly identify and resolve the problem!
