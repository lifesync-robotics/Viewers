# Screw Transform Construction

## Overview

The screw management extension now constructs proper screw transforms based on viewport camera orientations and crosshair position, ensuring accurate screw placement and orientation in the 3D surgical planning environment.

## Transform Matrix Structure

The screw transform is a **4x4 transformation matrix** stored in **row-major order** as a Float32Array(16).

### Matrix Layout

```
Transform Matrix (4x4):
┌─────────────────────────────────────────────────┐
│  axialNormal[0]    axialUp[0]    sagittalNormal[0]    translation[0] │
│  axialNormal[1]    axialUp[1]    sagittalNormal[1]    translation[1] │
│  axialNormal[2]    axialUp[2]    sagittalNormal[2]    translation[2] │
│       0                 0                0                   1        │
└─────────────────────────────────────────────────┘
   Column 0          Column 1         Column 2          Column 3
   (X-axis)          (Y-axis)         (Z-axis)       (Translation)
```

### Row-Major Storage

In row-major order, the matrix is stored as a flat array:

```javascript
[
  // Row 0
  axialNormal[0], axialUp[0], sagittalNormal[0], translation[0],

  // Row 1
  axialNormal[1], axialUp[1], sagittalNormal[1], translation[1],

  // Row 2
  axialNormal[2], axialUp[2], sagittalNormal[2], translation[2],

  // Row 3
  0, 0, 0, 1
]
```

## Transform Components

### Column 0: Axial Plane Normal (X-axis)

**Source**: Axial viewport camera's view plane normal

**Meaning**: Defines the X-axis of the screw coordinate system

**Access**:
```javascript
const axialViewport = renderingEngine.getViewport('mpr-axial');
const axialCamera = axialViewport.getCamera();
const axialNormal = axialCamera.viewPlaneNormal;  // [x, y, z]
```

**Physical Interpretation**: Direction perpendicular to the axial slice plane

### Column 1: Axial View Up (Y-axis)

**Source**: Axial viewport camera's view up vector

**Meaning**: Defines the Y-axis of the screw coordinate system

**Access**:
```javascript
const axialViewport = renderingEngine.getViewport('mpr-axial');
const axialCamera = axialViewport.getCamera();
const axialUp = axialCamera.viewUp;  // [x, y, z]
```

**Physical Interpretation**: "Up" direction in the axial view, typically anterior-posterior axis

### Column 2: Sagittal View Normal (Z-axis)

**Source**: Sagittal viewport camera's view plane normal

**Meaning**: Defines the Z-axis of the screw coordinate system (screw trajectory direction)

**Access**:
```javascript
const sagittalViewport = renderingEngine.getViewport('mpr-sagittal');
const sagittalCamera = sagittalViewport.getCamera();
const sagittalNormal = sagittalCamera.viewPlaneNormal;  // [x, y, z]
```

**Physical Interpretation**: Direction perpendicular to sagittal slice, typically left-right axis

### Column 3: Translation (Position)

**Source**: Crosshair center point

**Meaning**: World-space position where the screw is placed

**Access**:
```javascript
import { crosshairsHandler } from './utils/crosshairsHandler';

const crosshairData = crosshairsHandler.getCrosshairCenter();
const translation = crosshairData.center;  // [x, y, z]
```

**Physical Interpretation**: 3D coordinates of the screw entry point in world space

## Implementation

### Function: `constructScrewTransform()`

**Location**: `extensions/cornerstone/src/ScrewManagementPanel.tsx`

**Purpose**: Constructs the screw transform matrix from viewport cameras and crosshair position

**Returns**: `Float32Array(16)` in row-major order, or `null` if data unavailable

### Algorithm Steps

1. **Get Crosshair Center**
   ```javascript
   const crosshairData = crosshairsHandler.getCrosshairCenter();
   if (!crosshairData.isActive || !crosshairData.center) {
     return null;  // Crosshairs not active
   }
   const translation = crosshairData.center;
   ```

2. **Find Required Viewports**
   ```javascript
   const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
   const viewports = renderingEngine.getViewports();

   let axialViewport = null;
   let sagittalViewport = null;

   for (const vp of viewports) {
     if (vp.id.toLowerCase().includes('axial')) {
       axialViewport = vp;
     } else if (vp.id.toLowerCase().includes('sagittal')) {
       sagittalViewport = vp;
     }
   }
   ```

3. **Extract Camera Vectors**
   ```javascript
   const axialCamera = axialViewport.getCamera();
   const sagittalCamera = sagittalViewport.getCamera();

   const axialNormal = axialCamera.viewPlaneNormal;      // Column 0
   const axialUp = axialCamera.viewUp;                    // Column 1
   const sagittalNormal = sagittalCamera.viewPlaneNormal; // Column 2
   ```

4. **Construct Transform Matrix**
   ```javascript
   const transform = new Float32Array([
     // Row 0
     axialNormal[0], axialUp[0], sagittalNormal[0], translation[0],

     // Row 1
     axialNormal[1], axialUp[1], sagittalNormal[1], translation[1],

     // Row 2
     axialNormal[2], axialUp[2], sagittalNormal[2], translation[2],

     // Row 3
     0, 0, 0, 1
   ]);
   ```

## Usage in Screw Management

### Saving a Screw

When saving a screw placement:

```javascript
const saveScrew = () => {
  // ... validation ...

  // Construct transform from viewport data
  const transformMatrix = constructScrewTransform();

  if (!transformMatrix) {
    // Warn user that crosshairs are not active
    // Option to save without transform
  }

  // Convert to array for JSON serialization
  const transform = transformMatrix ? Array.from(transformMatrix) : [];

  // Save screw with transform
  viewportStateService.saveSnapshot(name, radius, length, transform);
};
```

### Loading a Screw

When loading a screw, the saved transform is applied to the 3D model:

```javascript
// In viewportStateService.restoreSnapshot()
const model = await modelStateService.loadModelFromServer(url, options);

if (snapshot.transform && snapshot.transform.length === 16) {
  // Apply saved transform to position model
  await modelStateService.setModelTransform(model.metadata.id, snapshot.transform);
}
```

## Coordinate System

### DICOM Coordinate System

The transform is constructed in the DICOM world coordinate system:
- **X-axis**: Patient's left → right (increasing)
- **Y-axis**: Patient's posterior → anterior (increasing)
- **Z-axis**: Patient's inferior → superior (increasing)

### Screw Coordinate System

The constructed transform defines a local coordinate system for the screw:
- **Local X** (Column 0): Aligned with axial plane normal
- **Local Y** (Column 1): Aligned with axial view up (anterior-posterior)
- **Local Z** (Column 2): Aligned with sagittal plane normal (screw trajectory)
- **Origin**: Positioned at crosshair center

## Example Transform

### Typical L4 Pedicle Screw Transform

```javascript
// Example values for a pedicle screw in L4 vertebra
const transform = new Float32Array([
  // Column 0: Axial Normal    Column 1: Axial Up    Column 2: Sagittal Normal    Column 3: Translation
     0.0,                        1.0,                   0.0,                        -12.5,   // Row 0 (X)
     0.0,                        0.0,                   1.0,                        145.3,   // Row 1 (Y)
     1.0,                        0.0,                   0.0,                        -78.2,   // Row 2 (Z)
     0.0,                        0.0,                   0.0,                          1.0    // Row 3
]);
```

**Interpretation**:
- Screw is positioned at world coordinates (-12.5, 145.3, -78.2) mm
- Screw trajectory follows the sagittal plane normal (0, 1, 0) → anterior direction
- Screw "up" direction follows (1, 0, 0) → left-right axis
- Screw "side" direction follows (0, 0, 1) → superior-inferior axis

## Validation

### Required Conditions

1. **Crosshairs Active**:
   - Crosshairs tool must be active and positioned
   - `crosshairsHandler.getCrosshairCenter().isActive === true`

2. **Viewports Available**:
   - Axial viewport must exist
   - Sagittal viewport must exist
   - Viewport IDs must contain "axial" and "sagittal" keywords

3. **Valid Camera Data**:
   - Camera must have `viewPlaneNormal` vector
   - Camera must have `viewUp` vector (for axial)
   - Vectors must be normalized (length = 1)

### Error Handling

```javascript
if (!transformMatrix) {
  // Prompt user with warning
  const proceed = confirm(
    '⚠️ Warning: Transform matrix could not be constructed.\n\n' +
    'This usually means:\n' +
    '- Crosshairs tool is not active\n' +
    '- Required viewports (axial/sagittal) not found\n\n' +
    'Do you want to save without transform data?'
  );

  if (!proceed) {
    return;  // Cancel save
  }
}
```

## Console Logging

The construction process logs detailed information:

```
═══════════════════════════════════════════════════════
🔧 [ScrewManagement] CONSTRUCTING SCREW TRANSFORM
═══════════════════════════════════════════════════════
📍 Crosshair center (translation): [x, y, z]
✅ Found axial viewport: mpr-axial
✅ Found sagittal viewport: mpr-sagittal
───────────────────────────────────────────────────────
📐 Camera vectors:
  Axial Normal (col 0): [x, y, z]
  Axial Up (col 1): [x, y, z]
  Sagittal Normal (col 2): [x, y, z]
───────────────────────────────────────────────────────
✅ Transform matrix constructed (4x4 row-major):
  Row 0: [m00, m01, m02, m03]
  Row 1: [m10, m11, m12, m13]
  Row 2: [m20, m21, m22, m23]
  Row 3: [m30, m31, m32, m33]
═══════════════════════════════════════════════════════
```

## Advantages of This Approach

### 1. Anatomically Accurate
- Transform is derived from actual patient anatomy (viewport orientations)
- Respects DICOM coordinate system
- Accounts for any patient positioning variations

### 2. Independent of Model Loading
- Transform is calculated from viewport data, not model data
- Works even if no model is currently loaded
- Consistent across different model types

### 3. Viewport-Synchronized
- Transform automatically adapts to viewport orientations
- Works with any hanging protocol layout
- Respects user's current view configuration

### 4. Crosshair-Centered
- Uses the shared crosshair center for position
- Ensures consistency across all viewports
- Intuitive for surgical planning workflow

## Troubleshooting

### Issue: Transform returns null

**Causes**:
1. Crosshairs tool not activated
2. Axial or sagittal viewport not found
3. Viewport naming doesn't include "axial" or "sagittal"

**Solutions**:
- Activate crosshairs tool (keyboard shortcut or toolbar)
- Verify viewport layout includes axial and sagittal views
- Check viewport IDs in console logs

### Issue: Incorrect screw orientation

**Causes**:
1. Camera vectors not normalized
2. Viewport orientations changed after construction
3. Row-major vs column-major confusion

**Solutions**:
- Check camera vectors in console logs (should be unit vectors)
- Reconstruct transform after viewport changes
- Verify matrix is in row-major order

### Issue: Screw not positioned at crosshair

**Causes**:
1. Crosshair center not correctly retrieved
2. DICOM coordinate system mismatch
3. Model has additional transforms

**Solutions**:
- Verify crosshair center in console logs
- Check DICOM metadata for coordinate system
- Ensure model transforms are cleared before applying screw transform

## Related Files

- **ScrewManagementPanel.tsx**: Contains `constructScrewTransform()` function
- **viewportStateService.ts**: Stores and restores transform
- **modelStateService.ts**: Applies transform to 3D models
- **crosshairsHandler.ts**: Provides crosshair center position

## API Reference

### `constructScrewTransform(): Float32Array | null`

Constructs a 4x4 transformation matrix for screw placement based on viewport cameras and crosshair position.

**Returns**:
- `Float32Array(16)`: Transform matrix in row-major order
- `null`: If crosshairs inactive or required viewports not found

**Matrix Structure**:
```
[
  axialNormal[0], axialUp[0], sagittalNormal[0], translation[0],
  axialNormal[1], axialUp[1], sagittalNormal[1], translation[1],
  axialNormal[2], axialUp[2], sagittalNormal[2], translation[2],
  0,              0,           0,                  1
]
```

**Usage**:
```javascript
const transform = constructScrewTransform();
if (transform) {
  // Save or apply transform
  const transformArray = Array.from(transform);
  viewportStateService.saveSnapshot(name, radius, length, transformArray);
}
```

## Testing

### Manual Test Procedure

1. **Load DICOM Study**
   - Open any CT or MRI study
   - Ensure axial and sagittal viewports visible

2. **Activate Crosshairs**
   - Click crosshairs tool in toolbar
   - Position crosshair at desired screw location

3. **Save Screw**
   - Open Screw Management panel
   - Enter radius and length
   - Click "Save Screw Placement"
   - Check console logs for transform matrix

4. **Verify Transform**
   ```javascript
   // Expected output in console:
   ✅ Transform matrix constructed (4x4 row-major):
     Row 0: [0.00, 1.00, 0.00, -12.50]
     Row 1: [0.00, 0.00, 1.00, 145.30]
     Row 2: [1.00, 0.00, 0.00, -78.20]
     Row 3: [0.00, 0.00, 0.00, 1.00]
   ```

5. **Load Screw**
   - Click "Load" on saved screw
   - Verify 3D model positioned at crosshair location
   - Verify model oriented correctly

### Automated Tests (Future)

```javascript
describe('constructScrewTransform', () => {
  it('should construct valid transform when crosshairs active', () => {
    // Setup: activate crosshairs, position viewports
    const transform = constructScrewTransform();
    expect(transform).toBeInstanceOf(Float32Array);
    expect(transform.length).toBe(16);
    expect(transform[15]).toBe(1);  // Homogeneous coordinate
  });

  it('should return null when crosshairs inactive', () => {
    // Setup: deactivate crosshairs
    const transform = constructScrewTransform();
    expect(transform).toBeNull();
  });

  it('should use crosshair center as translation', () => {
    // Setup: set crosshair to known position
    const transform = constructScrewTransform();
    const translation = [transform[3], transform[7], transform[11]];
    expect(translation).toEqual(expectedCrosshairCenter);
  });
});
```

## Conclusion

The screw transform construction provides a robust, anatomically accurate method for recording screw placements in surgical planning. By deriving the transform from viewport camera orientations and crosshair position, it ensures consistency with the DICOM coordinate system and user's current view configuration.
