# Coordinate Systems and Viewport States in OHIF/Cornerstone3D

## Executive Summary

This guide explains how DICOM medical images are transformed through multiple coordinate systems to be rendered in OHIF Viewer using Cornerstone3D and VTK.js. We'll trace the journey from raw DICOM data to rendered 3D views and understand how viewport states capture and restore camera positions.

---

## Table of Contents

1. [Coordinate System Fundamentals](#1-coordinate-system-fundamentals)
2. [The Transformation Pipeline](#2-the-transformation-pipeline)
3. [Key Conversion Matrices](#3-key-conversion-matrices)
4. [Viewport State Architecture](#4-viewport-state-architecture)
5. [Visual Illustrations](#5-visual-illustrations)

---

## 1. Coordinate System Fundamentals

### 1.1 DICOM LPS Coordinate System

**DICOM (Digital Imaging and Communications in Medicine)** uses the **LPS (Left-Posterior-Superior)** coordinate system:

```
L (Left)      ←→  +X axis (patient's left)
P (Posterior) ←→  +Y axis (patient's back)
S (Superior)  ←→  +Z axis (patient's head)
```

**Key DICOM Tags:**
- **ImagePositionPatient (0020,0032)**: 3D coordinates of the first pixel (top-left corner) in world space
- **ImageOrientationPatient (0020,0037)**: 6 values defining row and column direction cosines
  - First 3 values: Row direction cosines [Xx, Xy, Xz]
  - Last 3 values: Column direction cosines [Yx, Yy, Yz]
- **PixelSpacing (0028,0030)**: Physical distance between pixels [row spacing, column spacing]
- **SliceThickness (0018,0050)**: Distance between slices
- **FrameOfReferenceUID (0020,0052)**: Unique identifier for the coordinate system

### 1.2 VTK.js World Coordinate System

**VTK.js** (Visualization Toolkit) also uses a **world coordinate system** (LPS-compatible):

```
World coordinates are continuous 3D floating-point values
Represents physical space in millimeters
All rendering is performed in this coordinate system
```

### 1.3 Image IJK Coordinate System

**IJK** represents discrete **voxel indices** in the image:

```
I ←→ Column index (width dimension)
J ←→ Row index (height dimension)
K ←→ Slice index (depth dimension)
```

**Characteristics:**
- Integer indices: [0, 0, 0] to [width-1, height-1, depth-1]
- Local to each image volume
- Natural storage format for pixel data

---

## 2. The Transformation Pipeline

The rendering pipeline involves multiple coordinate transformations:

```
┌─────────────────────────────────────────────────────────────────┐
│                    DICOM DATA (Orthanc Server)                  │
│                                                                   │
│  • ImagePositionPatient     [x₀, y₀, z₀]                        │
│  • ImageOrientationPatient  [Xx, Xy, Xz, Yx, Yy, Yz]           │
│  • PixelSpacing             [ΔRow, ΔCol]                        │
│  • SliceThickness           ΔSlice                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    IJK (Image) Coordinates                       │
│                                                                   │
│  Voxel indices: [i, j, k]                                        │
│  Range: [0..width-1, 0..height-1, 0..depth-1]                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ [M_IJK→World] Transformation Matrix
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    World (LPS) Coordinates                       │
│                                                                   │
│  Physical 3D space: [x, y, z] in millimeters                    │
│  Shared across all viewports                                     │
│  Defined by FrameOfReferenceUID                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ Camera Transformation
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Camera Coordinate System                      │
│                                                                   │
│  Camera parameters:                                              │
│  • position        - camera location in world space             │
│  • focalPoint      - where camera looks at                      │
│  • viewUp          - camera "up" direction                      │
│  • viewPlaneNormal - perpendicular to viewing plane             │
│  • parallelScale   - zoom level (orthographic projection)       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ Projection & Viewport Transformation
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Screen (Canvas) Coordinates                   │
│                                                                   │
│  2D pixel coordinates: [x, y] on canvas                         │
│  Used for rendering and user interaction                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Key Conversion Matrices

### 3.1 IJK to World Transformation Matrix

The transformation from **IJK (voxel indices)** to **World coordinates** uses a 4x4 affine transformation matrix:

```
┌     ┐   ┌                                          ┐   ┌   ┐
│  x  │   │ Xx·ΔCol   Yx·ΔRow   Zx·ΔSlice    x₀    │   │ i │
│  y  │ = │ Xy·ΔCol   Yy·ΔRow   Zy·ΔSlice    y₀    │ × │ j │
│  z  │   │ Xz·ΔCol   Yz·ΔRow   Zz·ΔSlice    z₀    │   │ k │
│  1  │   │    0         0          0          1    │   │ 1 │
└     ┘   └                                          ┘   └   ┘

Where:
• [Xx, Xy, Xz] = Row direction cosines (ImageOrientationPatient[0:3])
• [Yx, Yy, Yz] = Column direction cosines (ImageOrientationPatient[3:6])
• [Zx, Zy, Zz] = Slice direction (cross product of row × column)
• ΔCol, ΔRow   = PixelSpacing values
• ΔSlice       = SliceThickness or spacing between slices
• [x₀, y₀, z₀] = ImagePositionPatient (origin)
```

**In Cornerstone3D Code:**

The VTK.js `imageData` object provides the `indexToWorld()` method:

```javascript
// From Viewport.js line 170
const imageData = viewport.getDefaultImageData();
const dimensions = imageData.getDimensions(); // [width, height, depth]
const middleIJK = dimensions.map(d => Math.floor(d / 2)); // [i, j, k]

// Convert IJK to World
const worldCoords = imageData.indexToWorld(middleIJK, vec3.create());
// worldCoords = [x, y, z] in LPS world space
```

**Mathematical Formula:**

```
WorldPosition = Direction · Spacing · IJK + Origin

Where Direction is the 3×3 matrix:
┌                           ┐
│ Xx  Yx  Zx │
│ Xy  Yy  Zy │
│ Xz  Yz  Zz │
└                           ┘
```

### 3.2 Camera to World Coordinate System

The **camera** defines the viewing transformation in VTK.js. It doesn't use a traditional transformation matrix but instead defines the view using geometric parameters:

**Camera Properties (from your snapshot):**

```javascript
camera: {
  viewUp: [0.219, -0.494, -0.840],           // Camera's "up" vector in world space
  viewPlaneNormal: [0.365, 0.840, -0.399],   // Direction camera is looking (perpendicular to view plane)
  position: [77.490, 240.717, -877.467],     // Camera location in world space
  focalPoint: [-1.271, 59.502, -791.400],    // Point camera is focused on
  parallelProjection: true,                   // Orthographic vs perspective
  parallelScale: 234.207,                     // Zoom level (half-height of view in world units)
  rotation: 60.344                            // In-plane rotation angle (degrees)
}
```

**View Right Vector (computed):**

```javascript
// The "right" direction is computed as cross product
viewRight = viewPlaneNormal × viewUp
```

**Camera Coordinate Frame:**

```
            viewUp (V)
               ↑
               │
               │
               │
        ┌──────┼──────┐
        │      │      │
        │      ●──────┼────→ viewRight (U)
        │  focalPoint │
        └─────────────┘
              ↙
        viewPlaneNormal (N)
        (coming out toward viewer)
```

**Camera to World Transformation:**

The camera transformation is **implicit** in VTK.js rendering pipeline:

1. **View Matrix** (World → Camera):
   ```
   V = [U V N]ᵀ · T(-position)

   Where:
   U = viewRight
   V = viewUp
   N = -viewPlaneNormal (VTK convention)
   T(-position) = translation to move camera to origin
   ```

2. **Projection Matrix** (Camera → Normalized Device Coordinates):

   For orthographic projection:
   ```
   P = Orthographic(left, right, bottom, top, near, far)

   Where:
   top = parallelScale
   bottom = -parallelScale
   right = parallelScale × aspectRatio
   left = -parallelScale × aspectRatio
   ```

### 3.3 World to Canvas Transformation

From **world coordinates** to **screen pixels**:

```javascript
// From ImageOverlayViewerTool.tsx lines 111-117
const worldPos = utilities.imageToWorldCoords(imageId, [x, y]);
const canvasPos = viewport.worldToCanvas(worldPos);

// canvasPos = [screenX, screenY] in pixels
```

**Full Pipeline:**

```
worldToCanvas(worldPos):
  1. Apply View Matrix → Camera coordinates
  2. Apply Projection Matrix → Normalized device coordinates [-1, 1]
  3. Apply Viewport Transform → Screen pixels [0, width] × [0, height]
```

---

## 4. Viewport State Architecture

### 4.1 What is Captured in a Viewport State?

When you save a snapshot using `viewportStateService.saveSnapshot()`, the following is captured for **each viewport**:

```typescript
// From viewportStateService.ts lines 136-148
interface ViewportState {
  // Frame of reference (coordinate system identifier)
  frameOfReferenceUID: string;

  // Camera configuration (viewing transformation)
  camera: {
    viewUp: [x, y, z],                // Camera up direction
    viewPlaneNormal: [x, y, z],       // Camera look direction
    position: [x, y, z],              // Camera location
    focalPoint: [x, y, z],            // Where camera looks at
    parallelProjection: boolean,
    parallelScale: number,            // Zoom
    viewAngle: number,
    rotation: number                  // In-plane rotation
  };

  // Slice location and orientation
  viewReference: {
    FrameOfReferenceUID: string,
    cameraFocalPoint: [x, y, z],      // Redundant with camera
    viewPlaneNormal: [x, y, z],       // Redundant with camera
    viewUp: [x, y, z],                // Redundant with camera
    sliceIndex: number,               // Current slice number
    planeRestriction: {               // Defines the slicing plane
      point: [x, y, z],
      inPlaneVector1: [x, y, z],
      inPlaneVector2: [x, y, z]
    },
    volumeId: string                  // Which volume is displayed
  };

  // View presentation (UI-level transforms)
  viewPresentation: {
    rotation: number,                 // In-plane rotation
    zoom: number,                     // Zoom factor (usually 1)
    pan: [dx, dy],                    // Pan offset in world units
    flipHorizontal: boolean,
    flipVertical: boolean
  };

  // Metadata
  metadata: {
    viewportId: string,               // "mpr-axial", "mpr-sagittal", "mpr-coronal"
    viewportType: string,             // "orthographic"
    renderingEngineId: string,        // "OHIFCornerstoneRenderingEngine"
    zoom: number,
    pan: [dx, dy]
  };
}
```

### 4.2 How Viewport State Relates to Fundamentals

Let's trace your snapshot data back to fundamentals:

**Example: Axial Viewport (lines 7-96 of your snapshot)**

```javascript
{
  "frameOfReferenceUID": "1.2.826.0.1.3680043.8.498...",
  "camera": {
    "viewPlaneNormal": [0.365, 0.840, -0.399],  // ← Defines slice orientation
    "focalPoint": [-1.271, 59.502, -791.400],   // ← World position of slice center
    "position": [77.490, 240.717, -877.467],    // ← Camera location in 3D space
    "parallelScale": 234.207                     // ← Zoom level
  },
  "viewReference": {
    "sliceIndex": 760,                          // ← Which slice (out of ~1000)
    "planeRestriction": {
      "point": [-1.271, 59.502, -791.400],      // ← Plane anchor point
      "inPlaneVector1": [0.219, -0.494, -0.840], // ← Defines plane orientation
      "inPlaneVector2": [0.904, -0.219, 0.365]   // ← Orthogonal in-plane vector
    }
  }
}
```

**How it works:**

1. **Slice Selection**: The `sliceIndex: 760` tells us we're viewing the 760th slice of the volume

2. **Slice Plane Definition**: The plane is defined by:
   - **Point**: `[-1.271, 59.502, -791.400]` - A point on the plane (the focal point)
   - **Normal**: `viewPlaneNormal = [0.365, 0.840, -0.399]` - Perpendicular to the plane

   **Plane equation**: `0.365(x + 1.271) + 0.840(y - 59.502) - 0.399(z + 791.400) = 0`

3. **In-Plane Basis**: The two vectors define a 2D coordinate system on the slice:
   - `inPlaneVector1`: "up" direction on the slice
   - `inPlaneVector2`: "right" direction on the slice

4. **Camera Position**:
   - Distance from focal point: `||position - focalPoint|| = 86.2 mm`
   - Direction: Along the `viewPlaneNormal`

5. **Rotation**: `rotation: 60.344°` - The image is rotated 60° in-plane

6. **Pan**: `pan: [17.481, 40.220]` - The focal point is shifted from center

### 4.3 How Viewports Are Restored

```typescript
// From viewportStateService.ts lines 177-196
restoreSnapshot(name: string) {
  snapshot.viewports.forEach(savedState => {
    const vp = engine.getViewport(savedState.metadata.viewportId);

    // 1. Set camera parameters (viewing transformation)
    vp.setCamera(savedState.camera);
    //    → Updates viewPlaneNormal, position, focalPoint, viewUp, parallelScale
    //    → Triggers CAMERA_MODIFIED event

    // 2. Set view presentation (UI transforms)
    vp.setViewPresentation(savedState.viewPresentation);
    //    → Updates zoom, pan, rotation, flips

    // 3. Set view reference (slice position)
    vp.setViewReference(savedState.viewReference);
    //    → Updates sliceIndex, planeRestriction

    // 4. Render the viewport
    vp.render();
    //    → Triggers IMAGE_RENDERED event
  });
}
```

**What happens internally:**

1. **Camera Update**:
   - VTK.js camera object is updated with new parameters
   - View matrix is recomputed
   - Projection matrix may be recomputed (if parallelScale changed)

2. **Slice Update**:
   - The volume is resliced along the new `viewPlaneNormal`
   - Texture is generated from the slice data
   - Pixels are resampled using interpolation

3. **Rendering**:
   - VTK.js rendering pipeline executes
   - Geometry is transformed through View and Projection matrices
   - Fragments are rasterized to canvas

---

## 5. Visual Illustrations

### 5.1 Coordinate System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      DICOM LPS World Space                       │
│                                                                   │
│                         S (Superior)                              │
│                              ↑                                    │
│                              │ +Z                                 │
│                              │                                    │
│                              │                                    │
│                              ●───────→ +X  L (Left)              │
│                            ╱                                      │
│                          ╱                                        │
│                        ↙ +Y                                       │
│                  P (Posterior)                                    │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    CT Volume                               │  │
│  │                                                            │  │
│  │    ┌──────────────────┐                                  │  │
│  │    │                  │ ← Slice K                        │  │
│  │    │  [i,j,k]         │                                  │  │
│  │    │     ●────────→ I (columns)                          │  │
│  │    │     │            │                                  │  │
│  │    │     │            │                                  │  │
│  │    │     ↓            │                                  │  │
│  │    │     J (rows)     │                                  │  │
│  │    └──────────────────┘                                  │  │
│  │           │                                                │  │
│  │           └─→ K (slices)                                  │  │
│  │                                                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Transformation:                                                  │
│  [x, y, z] = ImagePositionPatient                                │
│            + i × (ImageOrientationPatient[0:3] · PixelSpacing[1])│
│            + j × (ImageOrientationPatient[3:6] · PixelSpacing[0])│
│            + k × SliceSpacing × (Row × Col)                      │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Camera and Viewing Geometry

```
                          Camera Coordinate System

                    World Space              Camera Space

      position ●                                  ↑ viewUp (V)
              ╱│╲                                 │
             ╱ │ ╲                                │
            ╱  │  ╲                               │
           ╱   │   ╲                              │
          ╱    │    ╲                             │
         ╱     │     ╲                            │
        ╱      │      ╲                           │
       ╱       │       ╲                          ●───→ viewRight (U)
      ╱        │        ╲                        ╱
     ╱         │         ╲                      ╱
    ╱          │          ╲                    ╱
   ╱           │           ╲                  ↙ -viewPlaneNormal (N)
  ╱            │            ╲
 ╱             │ viewPlaneNormal
╱              ↓              ╲
●──────────────────────────────●
focalPoint    View Plane
              (Slice)

              │←  distance  →│

┌──────────────────────────────────────────────────────┐
│              View Plane (Slice Plane)                │
│                                                       │
│   ┌─────────────────────────────────────┐           │
│   │          parallelScale               │           │
│   │      ↕                               │           │
│   │   ┌──────────────────────┐           │           │
│   │   │                      │           │           │
│   │   │    Rendered Image    │           │           │
│   │   │                      │           │           │
│   │   └──────────────────────┘           │           │
│   │                                       │           │
│   └─────────────────────────────────────┘           │
│                                                       │
└──────────────────────────────────────────────────────┘
        │← parallelScale × aspectRatio →│
```

### 5.3 Three Orthogonal Viewports

```
┌─────────────────────────────────────────────────────────────────┐
│              Standard MPR (Multi-Planar Reconstruction)         │
│                                                                   │
│   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│   │   AXIAL VIEW     │  │  SAGITTAL VIEW   │  │ CORONAL VIEW │ │
│   │                  │  │                  │  │              │ │
│   │        R         │  │        A         │  │       A      │ │
│   │        ↑         │  │        ↑         │  │       ↑      │ │
│   │        │         │  │        │         │  │       │      │ │
│   │    ●───┼───→ A   │  │    ●───┼───→ L   │  │   ●───┼───→ R│ │
│   │   P    │         │  │   P    │         │  │  L    │      │ │
│   │        │         │  │        │         │  │       │      │ │
│   │                  │  │                  │  │              │ │
│   └──────────────────┘  └──────────────────┘  └──────────────┘ │
│   viewPlaneNormal:      viewPlaneNormal:      viewPlaneNormal:  │
│   [0, 0, 1]             [1, 0, 0]             [0, 1, 0]         │
│   (Looking down)        (Looking from right)  (Looking from back)│
│                                                                   │
│   Each viewport has:                                              │
│   • Independent camera (position, focalPoint)                    │
│   • Shared world coordinate system                               │
│   • Different sliceIndex                                         │
│   • Potentially different zoom/pan                               │
└─────────────────────────────────────────────────────────────────┘
```

### 5.4 Oblique (Rotated) Slice Plane

```
From your snapshot (Axial viewport with rotation):

                          World Space (LPS)

                   S (Superior)
                        ↑
                        │
                        │
                        │
         ╔══════════════╬══════════════╗
        ╔╝              │              ╚╗
       ╔╝               │               ╚╗
      ╔╝                │                ╚╗  ← Oblique slice plane
     ╔╝                 ●                 ╚╗   (rotated 60.34°)
    ╔╝             focalPoint             ╚╗
   ╔╝          [-1.27, 59.50, -791.40]     ╚╗
  ╔╝                                         ╚╗
 ╔═════════════════════════════════════════════╗
 ╚═════════════════════════════════════════════╝
                        │
                        │
                        ↓
                   P (Posterior)

viewPlaneNormal = [0.365, 0.840, -0.399]
(Not aligned with standard axes)

This allows:
• Oblique/custom plane views
• Double oblique reformations
• Arbitrary plane navigation
```

### 5.5 Pan and Zoom Transformations

```
┌─────────────────────────────────────────────────────────────────┐
│                    Pan (Translation)                             │
│                                                                   │
│  Original focal point          After pan [17.48, 40.22]         │
│                                                                   │
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │                  │         │                  │             │
│  │        ●         │   →     │                  │             │
│  │     (center)     │         │            ●     │             │
│  │                  │         │       (shifted)  │             │
│  └──────────────────┘         └──────────────────┘             │
│                                                                   │
│  focalPoint = focalPoint₀ + pan.x × viewRight + pan.y × viewUp  │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                    Zoom (Parallel Scale)                         │
│                                                                   │
│  parallelScale = 234.207      parallelScale = 117.103           │
│  (zoom = 1.0)                 (zoom = 2.0)                      │
│                                                                   │
│  ┌────────────────────┐       ┌──────────┐                     │
│  │                    │       │          │                     │
│  │                    │       │          │                     │
│  │     ●  Image       │   →   │   ●  2×  │                     │
│  │                    │       │          │                     │
│  │                    │       │          │                     │
│  └────────────────────┘       └──────────┘                     │
│                                                                   │
│  Smaller parallelScale = More zoom (less scene visible)         │
│  Larger parallelScale  = Less zoom (more scene visible)         │
└─────────────────────────────────────────────────────────────────┘
```

### 5.6 Complete Rendering Pipeline Flowchart

```
┌──────────────────────────────────────────────────────────────────┐
│                    START: DICOM Image on Server                  │
│                                                                    │
│  DICOM Tags: ImagePositionPatient, ImageOrientationPatient,      │
│              PixelSpacing, PixelData                              │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│            Step 1: Load Image with Cornerstone3D                 │
│                                                                    │
│  • imageLoader fetches DICOM data                                │
│  • Metadata extracted and cached                                 │
│  • Volume constructed (for volume viewports)                     │
│  • ImageData created (VTK.js data structure)                     │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│       Step 2: Create VTK ImageData with Transformation           │
│                                                                    │
│  imageData properties:                                            │
│  • dimensions: [width, height, depth]                            │
│  • spacing: [ΔCol, ΔRow, ΔSlice]                                │
│  • direction: 3×3 matrix from ImageOrientationPatient            │
│  • origin: ImagePositionPatient                                  │
│                                                                    │
│  Now have: indexToWorld(i,j,k) → (x,y,z)                        │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│           Step 3: Initialize Viewport and Camera                 │
│                                                                    │
│  viewport.setCamera({                                             │
│    viewPlaneNormal,  // Define slice orientation                 │
│    position,         // Camera location in world space           │
│    focalPoint,       // Slice center in world space              │
│    viewUp,           // Camera up direction                      │
│    parallelScale     // Zoom level                               │
│  })                                                               │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│            Step 4: VTK.js Rendering Pipeline                     │
│                                                                    │
│  a) Volume Reslicing                                              │
│     • Compute plane intersection with volume                     │
│     • Sample voxels along the plane                              │
│     • Interpolate (linear, cubic, etc.)                          │
│                                                                    │
│  b) View Transformation (World → Camera)                         │
│     • Apply view matrix: M_view = [U V N]ᵀ · T(-pos)            │
│     • Transform vertices to camera space                         │
│                                                                    │
│  c) Projection (Camera → NDC)                                    │
│     • Apply orthographic projection matrix                       │
│     • Normalize to [-1, 1]³                                      │
│                                                                    │
│  d) Viewport Transform (NDC → Screen)                           │
│     • Scale to canvas dimensions                                 │
│     • Apply pan offsets                                          │
│                                                                    │
│  e) Rasterization                                                 │
│     • Convert geometry to fragments                              │
│     • Apply textures (slice image)                               │
│     • Blend and composite                                        │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│              Step 5: Render to Canvas                            │
│                                                                    │
│  • WebGL draws to offscreen render target                        │
│  • Composited to on-screen canvas                                │
│  • Overlays and annotations added (SVG layer)                    │
│                                                                    │
│  USER SEES: Medical image with correct orientation and zoom      │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│         Step 6: User Interaction & State Updates                 │
│                                                                    │
│  User actions:                                                    │
│  • Scroll → Change sliceIndex → Update focalPoint                │
│  • Pan → Update focalPoint                                       │
│  • Zoom → Update parallelScale                                   │
│  • Rotate → Update viewUp (in-plane rotation)                    │
│                                                                    │
│  Each change triggers re-render (Steps 4-5)                      │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│           Step 7: Save/Restore Viewport State                    │
│                                                                    │
│  Save:   viewportStateService.saveSnapshot(name)                 │
│          → Captures camera, viewReference, viewPresentation      │
│                                                                    │
│  Restore: viewportStateService.restoreSnapshot(name)             │
│           → Applies saved state to viewports                     │
│           → Returns to exact same view                           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Practical Examples

### 6.1 Computing World Position from Snapshot

Given your snapshot data for the **Axial viewport**:

```javascript
{
  "camera": {
    "focalPoint": [-1.2716, 59.5021, -791.4004],
    "viewPlaneNormal": [0.3654, 0.8408, -0.3993],
    "viewUp": [0.2196, -0.4948, -0.8408]
  },
  "viewReference": {
    "sliceIndex": 760
  }
}
```

**Question**: What is the world coordinate of the voxel at position [128, 128] on this slice?

**Answer**:

1. **Slice plane equation**:
   ```
   Plane: P = focalPoint + u × inPlaneVector1 + v × inPlaneVector2

   Where:
   • u, v are 2D coordinates on the slice (in pixels)
   • inPlaneVector1 = viewUp (camera space)
   • inPlaneVector2 = viewRight = viewPlaneNormal × viewUp
   ```

2. **Compute viewRight**:
   ```javascript
   viewRight = cross(viewPlaneNormal, viewUp)
             = cross([0.3654, 0.8408, -0.3993], [0.2196, -0.4948, -0.8408])
             = [0.9046, -0.2196, 0.3654]
   ```

3. **Convert pixel [128, 128] to world position**:
   ```javascript
   // Assuming 256×256 canvas, center at [128, 128]
   u = (128 - 128) × pixelSpacing × zoom = 0
   v = (128 - 128) × pixelSpacing × zoom = 0

   worldPos = focalPoint + u × viewUp + v × viewRight
            = [-1.2716, 59.5021, -791.4004] + 0 + 0
            = [-1.2716, 59.5021, -791.4004]  // This is the center point
   ```

### 6.2 Understanding Rotation

The `rotation: 60.3449°` means the in-plane vectors are rotated:

```javascript
// Original (no rotation)
inPlaneVector1 = viewUp
inPlaneVector2 = viewRight

// After 60.3449° rotation
inPlaneVector1_rotated = cos(60.3449°) × viewUp + sin(60.3449°) × viewRight
inPlaneVector2_rotated = -sin(60.3449°) × viewUp + cos(60.3449°) × viewRight
```

This rotates the image **within the plane**, not the plane itself.

---

## 7. Key Takeaways for Developers

### 7.1 Coordinate System Hierarchy

```
DICOM Tags
    ↓
IJK (Voxel Indices) ←──[M_IJK→World]──→ World (LPS mm)
    ↓                                        ↓
Store pixels                           [Camera Transform]
                                            ↓
                                       Camera Space
                                            ↓
                                       [Projection]
                                            ↓
                                       Screen Pixels
```

### 7.2 Critical Components

1. **ImageData** (VTK.js):
   - Stores: dimensions, spacing, direction, origin
   - Provides: `indexToWorld()`, `worldToIndex()`
   - Created from DICOM metadata

2. **Camera** (VTK.js):
   - Defines: viewing transformation
   - Properties: position, focalPoint, viewUp, viewPlaneNormal, parallelScale
   - Controls: what you see and from where

3. **Viewport** (Cornerstone3D):
   - Manages: rendering, interaction
   - Methods: `getCamera()`, `setCamera()`, `render()`, `worldToCanvas()`, `canvasToWorld()`
   - Events: `CAMERA_MODIFIED`, `IMAGE_RENDERED`, `CAMERA_RESET`

4. **ViewportState** (OHIF):
   - Captures: complete viewport configuration
   - Enables: save/restore functionality
   - Stores: camera, viewReference, viewPresentation, metadata

### 7.3 Common Operations

**Get world coordinates from canvas click**:
```javascript
const canvasPos = [event.clientX, event.clientY];
const worldPos = viewport.canvasToWorld(canvasPos);
```

**Get canvas position from world coordinates**:
```javascript
const canvasPos = viewport.worldToCanvas(worldPos);
```

**Convert IJK to world**:
```javascript
const imageData = viewport.getDefaultImageData();
const worldPos = imageData.indexToWorld([i, j, k], vec3.create());
```

**Convert world to IJK**:
```javascript
const ijkPos = imageData.worldToIndex(worldPos, vec3.create());
```

**Get current slice information**:
```javascript
const camera = viewport.getCamera();
const sliceInfo = viewport.getSliceViewInfo();
const sliceIndex = sliceInfo.sliceIndex;
```

### 7.4 Debugging Tips

1. **Check FrameOfReferenceUID**: All viewports sharing the same UID use the same world coordinate system

2. **Verify Direction Matrix**: Should be orthonormal (unit vectors, mutually perpendicular)

3. **Camera Distance**: `||position - focalPoint||` - typical values: 50-200 mm for medical imaging

4. **Parallel Scale**: Half-height of view in world units - smaller = more zoomed in

5. **ViewPlaneNormal**: Should be unit vector (length ≈ 1.0)

---

## 8. References and Further Reading

### Cornerstone3D Documentation
- [Viewport API](https://www.cornerstonejs.org/api/core/namespace/Viewport)
- [Camera Properties](https://www.cornerstonejs.org/docs/concepts/cornerstone-core/camera)
- [Coordinate Systems](https://www.cornerstonejs.org/docs/concepts/cornerstone-core/volumes)

### VTK.js Documentation
- [vtkCamera](https://kitware.github.io/vtk-js/api/Rendering_Core_Camera.html)
- [vtkImageData](https://kitware.github.io/vtk-js/api/Common_DataModel_ImageData.html)
- [Coordinate Systems in VTK](https://kitware.github.io/vtk-js/docs/develop_concepts_coordinates.html)

### DICOM Standard
- [Part 3: Image Orientation](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_C.7.6.2.html)
- [Part 3: Image Position](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_C.7.6.2.html#sect_C.7.6.2.1.1)

### Medical Imaging Fundamentals
- [LPS vs RAS Coordinate Systems](https://www.slicer.org/wiki/Coordinate_systems)
- [Multi-Planar Reconstruction (MPR)](https://radiopaedia.org/articles/multiplanar-reformation-mpr)

---

## 9. Glossary

| Term | Definition |
|------|------------|
| **LPS** | Left-Posterior-Superior coordinate system used in DICOM |
| **IJK** | Image voxel indices (I=column, J=row, K=slice) |
| **World Coordinates** | Physical 3D space in millimeters (LPS) |
| **Camera** | VTK.js object defining viewing transformation |
| **viewPlaneNormal** | Unit vector perpendicular to viewing plane |
| **viewUp** | Unit vector defining "up" direction in camera |
| **focalPoint** | Point in world space where camera looks |
| **position** | Camera location in world space |
| **parallelScale** | Half-height of orthographic view in world units |
| **FrameOfReferenceUID** | DICOM identifier for coordinate system |
| **ImageOrientationPatient** | DICOM tag (0020,0037) defining row/column directions |
| **ImagePositionPatient** | DICOM tag (0020,0032) defining origin position |
| **MPR** | Multi-Planar Reconstruction (axial, sagittal, coronal views) |
| **Orthographic Projection** | Parallel projection (no perspective distortion) |
| **Viewport** | Rendering region displaying one view of the data |

---

**Document Created**: 2025-10-31
**For**: OHIF Viewer Development / Cornerstone3D Integration
**Target Audience**: New developers learning medical imaging coordinate systems
