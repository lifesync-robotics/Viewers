# 2D Projection Debugging Guide

## Overview

Enhanced debugging features have been added to `ToolProjectionRenderer.ts` to diagnose why 2D projections appear on the wrong axes despite correct 3D calculations.

## Problem Statement

- **Axial**: Looks like it should be flipped (position correct)
- **Coronal**: Should go into screen but goes across (wrong axis)
- **Sagittal**: Looks similar to be right
- **3D Model**: SE3 is correct (verified)
- **Viewport normals**: Verified correct

## Root Cause Hypothesis

The issue is likely in how `viewport.worldToCanvas()` transforms 3D world coordinates to 2D canvas coordinates. The transformation uses the camera's local coordinate frame (viewRight, viewUp, viewPlaneNormal), which may not align with expected anatomical directions.

## Debugging Features Added

### 1. Camera Parameter Logging

**Location**: `_renderProjectionOnViewport()` method, after getting camera info

**Logs**:
- Camera position and focal point
- `viewPlaneNormal`: Direction camera is looking
- `viewUp`: Which direction is "up" in the camera's view
- `viewRight`: Computed as `viewPlaneNormal × viewUp`
- `parallelScale`: Zoom level
- Viewport rotation and flip settings (flipHorizontal, flipVertical)
- Canvas dimensions and aspect ratio

**Look for**:
- Check if `viewUp` vectors differ between viewports
- Note any unexpected rotation values
- Verify viewPlaneNormal matches expected plane normals

### 2. World-to-Canvas Transformation Logging

**Location**: After calculating intersection point or in parallel case

**Logs**:
- Origin: `[x, y, z]` → `[px, py]`
- Intersection/Tip: `[x, y, z]` → `[px, py]`
- Canvas direction vector: `[dx, dy]`
- Canvas angle: Angle from +X axis in degrees
- Canvas length: Length in pixels
- 3D tool direction vs 2D canvas direction (normalized)

**Look for**:
- Compare 3D direction `[dx, dy, dz]` with 2D direction `[px_dx, py_dy]`
- Check if canvas angle makes sense for the viewport type
- Identify any unexpected coordinate flips or rotations

### 3. Visual Coordinate Axes Overlay

**Location**: `_drawCoordinateAxes()` method, called when `shouldLog` is true

**Visualization**:
- Red arrow: X-axis (world +X direction)
- Green arrow: Y-axis (world +Y direction)  
- Blue arrow: Z-axis (world +Z direction)
- White circle: Origin point
- All projected from tool origin onto viewport

**Purpose**:
- Shows how world coordinate axes map to canvas coordinates
- Helps identify which world direction corresponds to which canvas direction
- Example: If Z-axis (blue) points horizontally in axial view, something is wrong

### 4. Tool Direction Indicator

**Location**: `_drawDirectionIndicator()` method, called when `shouldLog` is true

**Visualization**:
- Magenta dashed arrow: Shows tool Z-axis direction projected onto canvas
- Label: Shows canvas angle in degrees
- Starts from tool origin

**Purpose**:
- Directly visualizes where the tool is "pointing" on each viewport
- Compare with the actual projection line to see if they match
- Angle display helps quantify any rotation issues

## How to Use These Debugging Features

### Step 1: Run the System

1. Start the tracking server
2. Start the OHIF Viewer
3. Load a dataset and enter tracking mode
4. Position the tool/instrument in a known orientation

### Step 2: Collect Console Logs

Open browser console and look for logs with `[ToolProj]` prefix. The first 5 render cycles per viewport will be logged.

**Key things to check**:

```
📷 Camera Parameters:
   viewPlaneNormal: Should match viewport type
   viewUp: Note this value - it defines canvas orientation
   viewRight: Perpendicular to both

🔄 World → Canvas Transformation:
   Origin: [x, y, z] → [px, py]
   Check if the mapping makes sense

📊 Direction Analysis:
   3D Tool direction (world): [dx, dy, dz]
   2D Canvas direction: [canvas_dx, canvas_dy]
   Are these consistent?
```

### Step 3: Analyze Visual Overlays

Look at each viewport and observe:

1. **Coordinate axes (RGB)**:
   - In axial view: Z (blue) should point perpendicular to screen
   - In sagittal view: X (red) should point perpendicular to screen
   - In coronal view: Y (green) should point perpendicular to screen
   
2. **Tool direction (magenta)**:
   - Should match the actual tool projection line
   - If angle is off, note the difference in degrees

### Step 4: Identify the Issue

Compare observations across all three viewports:

**Scenario A: viewUp is causing rotation**
- If axes appear rotated by specific angles (90°, 180°, etc.)
- If all viewports show consistent rotation pattern
- **Solution**: Apply inverse rotation based on viewUp

**Scenario B: Canvas coordinates are flipped**
- If direction is correct but inverted
- If only certain viewports are affected
- **Solution**: Apply flip transformation based on viewport type

**Scenario C: Wrong projection plane**
- If axes show tool projecting onto wrong anatomical plane
- If intersection calculation is correct but canvas mapping is wrong
- **Solution**: Transform points to viewport-local coordinates before worldToCanvas

## Expected vs Actual Patterns

### Axial Viewport (Z-normal)
**Expected**:
- X-axis (red): Points right →
- Y-axis (green): Points down ↓ (or up ↑ depending on viewUp)
- Z-axis (blue): Not visible (perpendicular to screen)

**Check**: If Z-axis is visible in-plane, something is wrong

### Coronal Viewport (Y-normal)
**Expected**:
- X-axis (red): Points right →
- Y-axis (green): Not visible (perpendicular to screen)
- Z-axis (blue): Points up ↑

**Check**: If Y-axis is visible in-plane, something is wrong

### Sagittal Viewport (X-normal)
**Expected**:
- X-axis (red): Not visible (perpendicular to screen)
- Y-axis (green): Points right → (or left ← depending on viewUp)
- Z-axis (blue): Points up ↑

**Check**: If X-axis is visible in-plane, something is wrong

## Next Steps After Diagnosis

Based on what you observe, choose the appropriate fix:

### Fix Option A: Account for viewUp Rotation

Add a rotation correction after worldToCanvas:

```typescript
// Get canvas coordinates
const originCanvas = viewport.worldToCanvas([x, y, z]);

// Get camera viewUp to determine rotation
const camera = viewport.getCamera();
const viewUp = camera.viewUp;

// Calculate rotation angle from standard orientation
const rotationAngle = calculateRotationFromViewUp(viewportType, viewUp);

// Apply rotation correction
const correctedCanvas = rotatePoint(originCanvas, rotationAngle);
```

### Fix Option B: Viewport-Specific Transform

Define coordinate transforms for each viewport type:

```typescript
const transforms = {
  axial: (canvas) => [canvas[0], canvas[1]], // No change
  coronal: (canvas) => [-canvas[1], canvas[0]], // 90° rotation
  sagittal: (canvas) => [canvas[0], -canvas[1]] // Flip Y
};

const correctedCanvas = transforms[viewportType](originCanvas);
```

### Fix Option C: Pre-transform to Viewport Space

Transform 3D points before worldToCanvas:

```typescript
// Get viewport's local coordinate system
const viewRight = cross(viewPlaneNormal, viewUp);

// Project 3D point onto viewport plane
const localX = dot(worldPoint - focalPoint, viewRight);
const localY = dot(worldPoint - focalPoint, viewUp);

// Use local coordinates directly
const canvasX = localX * scale + centerX;
const canvasY = localY * scale + centerY;
```

## Disabling Debug Features

To disable the visual overlays after debugging:

Change:
```typescript
if (shouldLog) {
  this._drawCoordinateAxes(viewport, originVec);
  this._drawDirectionIndicator(viewport, originVec, toolDirection, 'Tool Dir');
}
```

To:
```typescript
const enableVisualDebug = false; // Toggle this
if (shouldLog && enableVisualDebug) {
  this._drawCoordinateAxes(viewport, originVec);
  this._drawDirectionIndicator(viewport, originVec, toolDirection, 'Tool Dir');
}
```

## Files Modified

- `Viewers/extensions/lifesync/src/utils/navigationModes/ToolProjectionRenderer.ts`
  - Added camera parameter logging
  - Added world-to-canvas transformation logging
  - Added `_drawCoordinateAxes()` method
  - Added `_drawDirectionIndicator()` method
  - Enhanced logging in intersection and parallel cases

## Testing Procedure

1. **Known Tool Poses**: Test with tool in pure +X, +Y, +Z directions
2. **Visual Inspection**: Check if projections match anatomical expectations
3. **3D Comparison**: Verify 2D projections align with 3D model rendering
4. **All Viewports**: Ensure consistency across axial, coronal, sagittal

## Contact & Support

If issues persist after debugging:
- Collect full console logs (first 5 cycles for each viewport)
- Take screenshots showing visual overlays
- Note specific viewport types where issues occur
- Describe expected vs actual behavior clearly

