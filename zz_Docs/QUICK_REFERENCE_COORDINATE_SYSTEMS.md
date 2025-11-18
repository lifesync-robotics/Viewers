# Quick Reference: Coordinate Systems & Transformations

## 📚 Document Overview

This is a **quick reference** companion to the comprehensive guides. Use this for:
- Quick lookups during development
- Debugging coordinate issues
- Understanding snapshot data
- API reference for common operations

---

## 🎯 Three Coordinate Systems at a Glance

| System | Units | Range | Purpose | Example |
|--------|-------|-------|---------|---------|
| **IJK** | Voxel indices | [0, 0, 0] to [width-1, height-1, depth-1] | Image storage | [128, 256, 50] |
| **World (LPS)** | Millimeters | Continuous 3D | Physical space | [-10.5, 45.2, -800.3] |
| **Canvas** | Pixels | [0, 0] to [width, height] | Screen display | [512, 384] |

---

## 🔄 Transformation Quick Reference

### IJK → World

```javascript
// Get world coordinates from voxel indices
const imageData = viewport.getDefaultImageData();
const worldPos = imageData.indexToWorld([i, j, k], vec3.create());
// Returns: [x, y, z] in mm (LPS coordinates)
```

**Matrix Form:**
```
[x]   [Dx·Sx  0      0      Ox] [i]
[y] = [0      Dy·Sy  0      Oy] [j]
[z]   [0      0      Dz·Sz  Oz] [k]
[1]   [0      0      0      1 ] [1]

D = Direction matrix (3×3 from ImageOrientationPatient)
S = Spacing [column, row, slice]
O = Origin (ImagePositionPatient)
```

### World → IJK

```javascript
// Get voxel indices from world coordinates
const ijkPos = imageData.worldToIndex([x, y, z], vec3.create());
// Returns: [i, j, k] indices (may be fractional for interpolation)
```

### World → Canvas

```javascript
// Get screen pixel from world coordinates
const canvasPos = viewport.worldToCanvas([x, y, z]);
// Returns: [px, py] screen coordinates
```

### Canvas → World

```javascript
// Get world coordinates from screen click
const worldPos = viewport.canvasToWorld([px, py]);
// Returns: [x, y, z] in mm
```

### Image → World

```javascript
// Get world coordinates from 2D image coordinates
import { utilities } from '@cornerstonejs/core';
const worldPos = utilities.imageToWorldCoords(imageId, [x, y]);
// Returns: [x, y, z] in mm
```

### World → Image

```javascript
// Get 2D image coordinates from world position
const imagePos = utilities.worldToImageCoords(imageId, [x, y, z]);
// Returns: [x, y] in pixels
```

---

## 📐 DICOM Tags Reference

### Essential Tags for Coordinate Systems

| Tag | Name | Example | Description |
|-----|------|---------|-------------|
| `(0020,0032)` | ImagePositionPatient | `[-100, -100, -800]` | 3D position of top-left pixel (mm) |
| `(0020,0037)` | ImageOrientationPatient | `[1,0,0, 0,1,0]` | Row & column direction cosines |
| `(0028,0030)` | PixelSpacing | `[0.5, 0.5]` | Pixel size [row, column] (mm) |
| `(0018,0050)` | SliceThickness | `1.0` | Distance between slices (mm) |
| `(0020,0052)` | FrameOfReferenceUID | `"1.2.826..."` | Coordinate system identifier |
| `(0020,0013)` | InstanceNumber | `45` | Slice number in series |

### Extracting from DICOM

```javascript
// Using Cornerstone metadata provider
import { metaData } from '@cornerstonejs/core';

const imagePlane = metaData.get('imagePlaneModule', imageId);
// Returns: {
//   imagePositionPatient: [x, y, z],
//   imageOrientationPatient: [Xx, Xy, Xz, Yx, Yy, Yz],
//   pixelSpacing: [row, col],
//   frameOfReferenceUID: "...",
//   rowCosines: [Xx, Xy, Xz],
//   columnCosines: [Yx, Yy, Yz]
// }
```

---

## 🎥 Camera Properties Reference

### Camera Object Structure

```typescript
interface Camera {
  position: [x, y, z];          // Camera location in world space (mm)
  focalPoint: [x, y, z];        // Point camera looks at (mm)
  viewUp: [x, y, z];            // "Up" direction (unit vector)
  viewPlaneNormal: [x, y, z];   // Look direction (unit vector, perpendicular to view)
  parallelProjection: boolean;  // true = orthographic, false = perspective
  parallelScale: number;        // Half-height of view (mm) - smaller = more zoom
  viewAngle: number;            // FOV angle (degrees) - for perspective only
  flipHorizontal: boolean;      // Mirror left-right
  flipVertical: boolean;        // Mirror top-bottom
}
```

### Getting and Setting Camera

```javascript
// Get current camera
const camera = viewport.getCamera();

// Set camera (partial update)
viewport.setCamera({
  focalPoint: [10, 20, 30],
  parallelScale: 200
});

// Set camera without triggering events
viewport.setCameraNoEvent(camera);

// Reset camera to default
viewport.resetCamera();
```

### Standard MPR Camera Values

```javascript
// From OHIF/Cornerstone constants
const MPR_CAMERA_VALUES = {
  axial: {
    viewPlaneNormal: [0, 0, 1],      // Looking down (S → I)
    viewUp: [0, -1, 0],               // Anterior is up
  },
  sagittal: {
    viewPlaneNormal: [1, 0, 0],      // Looking from right (R → L)
    viewUp: [0, 0, 1],                // Superior is up
  },
  coronal: {
    viewPlaneNormal: [0, 1, 0],      // Looking from back (P → A)
    viewUp: [0, 0, 1],                // Superior is up
  }
};
```

### Camera Derived Properties

```javascript
// Compute view right vector (perpendicular to viewUp and viewPlaneNormal)
const viewRight = vec3.cross(vec3.create(), viewPlaneNormal, viewUp);

// Camera to focal point distance
const distance = vec3.distance(camera.position, camera.focalPoint);

// Normalize vectors (ensure unit length)
vec3.normalize(viewUp, viewUp);
vec3.normalize(viewPlaneNormal, viewPlaneNormal);
```

---

## 📊 Viewport State Structure

### Complete State Interface

```typescript
interface ViewportState {
  // Frame of reference
  frameOfReferenceUID: string;

  // Camera configuration
  camera: {
    viewUp: Point3;
    viewPlaneNormal: Point3;
    position: Point3;
    focalPoint: Point3;
    parallelProjection: boolean;
    parallelScale: number;
    viewAngle: number;
    flipHorizontal: boolean;
    flipVertical: boolean;
    rotation?: number;
  };

  // View reference (slice info)
  viewReference: {
    FrameOfReferenceUID: string;
    cameraFocalPoint: Point3;
    viewPlaneNormal: Point3;
    viewUp: Point3;
    sliceIndex: number;
    planeRestriction: {
      FrameOfReferenceUID: string;
      point: Point3;
      inPlaneVector1: Point3;
      inPlaneVector2: Point3 | { 0: number; 1: number; 2: number };
    };
    volumeId: string;
  };

  // View presentation (UI transforms)
  viewPresentation: {
    rotation: number;
    zoom: number;
    pan: [number, number];
    flipHorizontal: boolean;
    flipVertical: boolean;
  };

  // Metadata
  metadata: {
    viewportId: string;
    viewportType: string;
    renderingEngineId: string;
    zoom: number;
    pan: [number, number];
  };
}
```

### Viewport State API

```javascript
// Save snapshot
const snapshot = viewportStateService.saveSnapshot("My View 1");
// Returns: { name, timestamp, viewports: [...] }

// Restore snapshot
viewportStateService.restoreSnapshot("My View 1");

// Get all snapshots
const snapshots = viewportStateService.getAllSnapshots();

// Get specific snapshot
const snapshot = viewportStateService.getSnapshot("My View 1");

// Delete snapshot
viewportStateService.deleteSnapshot("My View 1");

// Export to JSON
const json = viewportStateService.exportJSON();
// Download or save to file

// Import from JSON
viewportStateService.importJSON(jsonString);
```

---

## 🔍 Analyzing Your Snapshot Data

### Snapshot from `viewport-snapshots-2025-10-31T05-22-44.json`

#### Axial Viewport (mpr-axial)

```json
{
  "frameOfReferenceUID": "1.2.826.0.1.3680043.8.498.12744708373461474980719638850705044872",
  "camera": {
    "viewUp": [0.220, -0.495, -0.841],
    "viewPlaneNormal": [0.365, 0.841, -0.399],
    "position": [77.490, 240.718, -877.467],
    "focalPoint": [-1.272, 59.502, -791.400],
    "parallelScale": 234.207,
    "rotation": 60.345
  },
  "viewReference": {
    "sliceIndex": 760,
    "volumeId": "cornerstoneStreamingImageVolume:c8962ff8-ee12-bcc4-f3f2-83e148912a93"
  },
  "viewPresentation": {
    "zoom": 1,
    "pan": [17.481, 40.220],
    "rotation": 60.345
  }
}
```

**Decoded:**

| Property | Value | Meaning |
|----------|-------|---------|
| **Slice** | 760 | Viewing slice 760 out of ~1000 slices (76% through volume) |
| **Camera Distance** | 215.5 mm | `√[(77.49-(-1.27))² + (240.72-59.50)² + (-877.47-(-791.40))²]` |
| **View Height** | 468.4 mm | `2 × parallelScale = 2 × 234.207` |
| **Focal Point** | [-1.27, 59.50, -791.40] mm | Looking at point 1.27mm right, 59.5mm back, 791.4mm below origin |
| **Oblique Angle** | ~60° | Not a standard axial view - rotated and tilted |
| **Pan Offset** | [17.5, 40.2] mm | Focal point shifted right and up from default |
| **Zoom** | 1.0 | No additional zoom beyond parallelScale |

**View Direction Analysis:**
```
viewPlaneNormal = [0.365, 0.841, -0.399]

Components:
• 36.5% toward +X (patient's left)
• 84.1% toward +Y (patient's back)
• 39.9% toward -Z (inferior)

This is an oblique double-angle view, not aligned with standard planes.
```

---

## 🛠️ Common Operations

### Scrolling Through Slices

```javascript
// Get current slice
const sliceInfo = viewport.getSliceViewInfo();
const currentSlice = sliceInfo.sliceIndex;

// Move to specific slice
viewport.setSliceIndex(currentSlice + 1);  // Next slice
viewport.setSliceIndex(currentSlice - 1);  // Previous slice

// Jump to slice by world position
const camera = viewport.getCamera();
camera.focalPoint[2] += spacing; // Move in Z direction
viewport.setCamera(camera);
viewport.render();
```

### Pan Operation

```javascript
// Get current camera
const camera = viewport.getCamera();
const { viewUp, viewPlaneNormal, focalPoint } = camera;

// Compute view right
const viewRight = vec3.cross(vec3.create(), viewPlaneNormal, viewUp);

// Pan by delta in world space
const panDelta = [10, 20]; // [dx, dy] in mm
const newFocalPoint = vec3.create();
vec3.scaleAndAdd(newFocalPoint, focalPoint, viewRight, panDelta[0]);
vec3.scaleAndAdd(newFocalPoint, newFocalPoint, viewUp, panDelta[1]);

// Update camera
viewport.setCamera({ focalPoint: newFocalPoint });
viewport.render();
```

### Zoom Operation

```javascript
// Zoom in (reduce parallelScale)
const camera = viewport.getCamera();
const newScale = camera.parallelScale * 0.8; // 20% zoom in
viewport.setCamera({ parallelScale: newScale });
viewport.render();

// Zoom out (increase parallelScale)
const newScale = camera.parallelScale * 1.2; // 20% zoom out
viewport.setCamera({ parallelScale: newScale });
viewport.render();
```

### Rotation Operation

```javascript
// Rotate in-plane
const camera = viewport.getCamera();
const rotationAngle = (45 * Math.PI) / 180; // 45 degrees

// Create rotation matrix around viewPlaneNormal
const rotMat = mat4.identity(mat4.create());
mat4.rotate(rotMat, rotMat, rotationAngle, camera.viewPlaneNormal);

// Rotate viewUp vector
const rotatedViewUp = vec3.transformMat4(vec3.create(), camera.viewUp, rotMat);

viewport.setCamera({ viewUp: rotatedViewUp });
viewport.render();
```

### Reset to Standard View

```javascript
// Reset to standard axial
viewport.setCamera({
  viewPlaneNormal: [0, 0, 1],
  viewUp: [0, -1, 0]
});
viewport.resetCamera();

// Reset to standard sagittal
viewport.setCamera({
  viewPlaneNormal: [1, 0, 0],
  viewUp: [0, 0, 1]
});
viewport.resetCamera();

// Reset to standard coronal
viewport.setCamera({
  viewPlaneNormal: [0, 1, 0],
  viewUp: [0, 0, 1]
});
viewport.resetCamera();
```

---

## 🐛 Debugging Tips

### Check Coordinate System Validity

```javascript
// 1. Verify vectors are unit length
const length = vec3.length(viewPlaneNormal);
console.log('viewPlaneNormal length:', length); // Should be ~1.0

// 2. Verify vectors are perpendicular
const dotProduct = vec3.dot(viewUp, viewPlaneNormal);
console.log('Dot product:', dotProduct); // Should be ~0.0

// 3. Check FrameOfReferenceUID consistency
const viewport1 = viewports[0];
const viewport2 = viewports[1];
console.log('Same FrameOfReference?',
  viewport1.getFrameOfReferenceUID() === viewport2.getFrameOfReferenceUID()
);

// 4. Verify camera distance is reasonable
const distance = vec3.distance(camera.position, camera.focalPoint);
console.log('Camera distance:', distance); // Should be 50-500mm typically
```

### Inspect Transformation Matrix

```javascript
// Get the IJK→World transformation matrix
const imageData = viewport.getDefaultImageData();
const direction = imageData.getDirection(); // 3×3 matrix
const spacing = imageData.getSpacing();     // [sx, sy, sz]
const origin = imageData.getOrigin();       // [ox, oy, oz]

console.log('Direction:', direction);
console.log('Spacing:', spacing);
console.log('Origin:', origin);

// Manually compute world position
function ijkToWorld(i, j, k) {
  const x = origin[0] + i * direction[0] * spacing[0]
                      + j * direction[3] * spacing[1]
                      + k * direction[6] * spacing[2];
  const y = origin[1] + i * direction[1] * spacing[0]
                      + j * direction[4] * spacing[1]
                      + k * direction[7] * spacing[2];
  const z = origin[2] + i * direction[2] * spacing[0]
                      + j * direction[5] * spacing[1]
                      + k * direction[8] * spacing[2];
  return [x, y, z];
}
```

### Common Issues and Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| **Upside-down image** | Image appears inverted | Check `viewUp` vector, may need to negate |
| **Wrong slice shown** | Unexpected anatomy | Verify `sliceIndex` and `focalPoint` Z-coordinate |
| **Blurry/pixelated** | Poor image quality | Check `parallelScale` - may be too large (zoomed out too much) |
| **Pan not working** | Image doesn't move | Ensure pan is applied to `focalPoint` along view plane |
| **Rotation wrong axis** | Rotates 3D space | Ensure rotation is around `viewPlaneNormal`, not world axes |
| **Coordinates don't match** | World coords seem wrong | Verify `FrameOfReferenceUID` matches across viewports |

---

## 📖 API Quick Links

### Cornerstone3D Core

```javascript
import { getRenderingEngine, utilities } from '@cornerstonejs/core';

// Get rendering engine
const engine = getRenderingEngine('OHIFCornerstoneRenderingEngine');

// Get viewport
const viewport = engine.getViewport('mpr-axial');

// Utilities
utilities.imageToWorldCoords(imageId, [x, y]);
utilities.worldToImageCoords(imageId, [x, y, z]);
```

### VTK.js (via Cornerstone)

```javascript
// Get VTK camera (usually not needed directly)
const vtkCamera = viewport.getVtkActiveCamera();

// Get VTK renderer
const renderer = viewport.getRenderer();

// Get image data
const imageData = viewport.getDefaultImageData();
imageData.indexToWorld([i, j, k], vec3.create());
imageData.worldToIndex([x, y, z], vec3.create());
imageData.getDimensions(); // [width, height, depth]
imageData.getSpacing();    // [sx, sy, sz]
imageData.getOrigin();     // [ox, oy, oz]
imageData.getDirection();  // 3×3 matrix
```

### gl-matrix (Vector Math)

```javascript
import { vec3, mat4 } from 'gl-matrix';

// Vector operations
vec3.create();                  // [0, 0, 0]
vec3.add(out, a, b);           // out = a + b
vec3.subtract(out, a, b);      // out = a - b
vec3.scale(out, a, s);         // out = a * s
vec3.dot(a, b);                // a · b (scalar)
vec3.cross(out, a, b);         // out = a × b
vec3.length(a);                // ||a||
vec3.normalize(out, a);        // out = a / ||a||
vec3.distance(a, b);           // ||b - a||

// Matrix operations
mat4.identity(out);            // Identity matrix
mat4.rotate(out, mat, angle, axis);
mat4.translate(out, mat, vec);
vec3.transformMat4(out, vec, mat);
```

---

## 🎓 Learning Path

### Beginner Level
1. ✅ Understand the three coordinate systems (IJK, World, Canvas)
2. ✅ Learn basic DICOM tags (Position, Orientation, Spacing)
3. ✅ Practice converting IJK ↔ World manually
4. ✅ Understand camera properties (position, focalPoint, viewUp)

### Intermediate Level
1. ✅ Work with transformation matrices
2. ✅ Compute view right vector from camera
3. ✅ Implement pan/zoom operations
4. ✅ Create custom oblique views

### Advanced Level
1. ✅ Understand VTK rendering pipeline
2. ✅ Implement viewport state save/restore
3. ✅ Handle multi-viewport synchronization
4. ✅ Debug complex coordinate issues

---

## 📚 Related Documents

- **[COORDINATE_SYSTEMS_AND_VIEWPORT_STATES_GUIDE.md](./COORDINATE_SYSTEMS_AND_VIEWPORT_STATES_GUIDE.md)** - Comprehensive technical reference
- **[VISUAL_TEACHING_GUIDE.md](./VISUAL_TEACHING_GUIDE.md)** - Step-by-step illustrated tutorial
- **[viewport-snapshots-2025-10-31T05-22-44.json](./viewport-snapshots-2025-10-31T05-22-44.json)** - Your actual snapshot data

---

## 🔖 Glossary of Key Terms

| Term | Definition |
|------|------------|
| **LPS** | Left-Posterior-Superior coordinate system (DICOM standard) |
| **IJK** | Image voxel index coordinates (I=column, J=row, K=slice) |
| **World Coordinates** | Physical 3D space in millimeters (LPS) |
| **Frame of Reference** | A coordinate system identified by a unique UID |
| **View Plane Normal** | Unit vector perpendicular to viewing plane |
| **View Up** | Unit vector defining camera's "up" direction |
| **Focal Point** | 3D point the camera is looking at |
| **Parallel Scale** | Half-height of orthographic view in world units |
| **MPR** | Multi-Planar Reconstruction (standard orthogonal views) |
| **Oblique View** | Non-standard viewing angle/plane |
| **Viewport** | A rendering region showing one view of the volume |
| **Voxel** | 3D pixel (volume element) |

---

**Document Version**: 1.0
**Last Updated**: 2025-10-31
**For**: OHIF Viewer / Cornerstone3D Development
**Quick Access**: Keep this open while coding!
