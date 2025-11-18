# Visual Teaching Guide: Understanding Medical Image Coordinates
## A Step-by-Step Illustrated Tutorial

---

## Chapter 1: The Big Picture - Three Worlds

Think of medical image viewing as translating between three different "worlds":

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   🏥 WORLD 1: THE HOSPITAL (DICOM Server - Orthanc)               │
│                                                                     │
│   This is where the CT/MRI scan lives as raw DICOM files          │
│   Contains: Pixels + Metadata (position, spacing, orientation)     │
│                                                                     │
└────────────────────┬───────────────────────────────────────────────┘
                     │
                     │  Load & Parse DICOM
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   🌍 WORLD 2: THE PATIENT'S BODY (3D World Space - LPS)           │
│                                                                     │
│   This is a 3D coordinate system representing physical space       │
│   Units: Millimeters                                                │
│   All viewports share this common reference frame                  │
│                                                                     │
└────────────────────┬───────────────────────────────────────────────┘
                     │
                     │  Camera Transformation
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   🖥️ WORLD 3: THE SCREEN (Canvas Pixels)                          │
│                                                                     │
│   This is what you see on your monitor                             │
│   Units: Pixels                                                     │
│   Each viewport (axial, sagittal, coronal) has its own view       │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

**Key Insight**: When you save a viewport state, you're saving how to translate from World 2 (patient body) to World 3 (your screen).

---

## Chapter 2: World 1 - Understanding DICOM Data

### 2.1 What is DICOM?

DICOM = Digital Imaging and Communications in Medicine

A DICOM file contains:
1. **Pixel Data**: The actual image (like a photo's pixels)
2. **Metadata**: Instructions on how to position the image in 3D space

### 2.2 The Crucial DICOM Tags

Imagine you're building a 3D puzzle. Each CT slice is one puzzle piece. These DICOM tags tell you:

```
┌─────────────────────────────────────────────────────────────────┐
│                    One CT Slice (DICOM File)                    │
│                                                                  │
│  📋 Tag (0020,0032) ImagePositionPatient: [-50.0, 100.0, 200.0]│
│     ↳ "Place this slice's TOP-LEFT corner at this 3D point"   │
│                                                                  │
│  📋 Tag (0020,0037) ImageOrientationPatient:                   │
│     [1.0, 0.0, 0.0,  ← Row direction (X-axis of image)        │
│      0.0, 1.0, 0.0]  ← Column direction (Y-axis of image)      │
│     ↳ "The image is aligned like this in 3D space"            │
│                                                                  │
│  📋 Tag (0028,0030) PixelSpacing: [0.5, 0.5]                   │
│     ↳ "Each pixel is 0.5mm × 0.5mm"                           │
│                                                                  │
│  📋 Tag (0018,0050) SliceThickness: 1.0                        │
│     ↳ "Distance to next slice is 1.0mm"                       │
│                                                                  │
│  📷 Pixel Data: 512×512 array of grayscale values              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Visual Example - Stacking Slices

```
                    Slice K+2    ← ImagePosition: [x, y, z+2.0]
                   ┌──────────┐
                   │  ∴  ∴  ∴ │
                   └──────────┘
                        ↕ 1.0mm (SliceThickness)

                    Slice K+1    ← ImagePosition: [x, y, z+1.0]
                   ┌──────────┐
                   │  ∴  ∴  ∴ │
                   └──────────┘
                        ↕ 1.0mm

                    Slice K      ← ImagePosition: [x, y, z]
                   ┌──────────┐
                   │  ∴  ∴  ∴ │  ← One pixel = 0.5mm × 0.5mm
                   └──────────┘

           Each slice is precisely positioned in 3D space!
```

---

## Chapter 3: World 2 - The LPS Coordinate System

### 3.1 What is LPS?

LPS = **L**eft, **P**osterior, **S**uperior

It's the coordinate system used to describe positions in the patient's body:

```
                    Patient Lying on CT Table

                         S (Superior)
                            Head ↑
                            ╱│╲
                           ╱ │ ╲
                          ╱  │  ╲
                         ╱   │+Z ╲
                        ╱    │    ╲
                       ╱     │     ╲
                    L ╱      │      ╲ R
              Left  ╱        │       ╲  Right
               +X ←●─────────┼─────────●→ -X
                    ╲        │        ╱
                     ╲       │       ╱
                      ╲      │+Y    ╱
                       ╲     │     ╱
                        ╲    │    ╱
                         ╲   │   ╱
                          ╲  │  ╱
                           ╲ │ ╱
                            ╲│╱
                             ↓
                        P (Posterior)
                            Back

                    Feet pointing into page
```

**Memory Trick**:
- **L** = Left hand (X-axis)
- **P** = Push away (Y-axis, going back)
- **S** = Sky above (Z-axis, going up)

### 3.2 IJK to LPS Transformation

Each voxel has two addresses:

1. **IJK Address** (like apartment number): [128, 256, 50]
   - I = column number (0 to 511)
   - J = row number (0 to 511)
   - K = slice number (0 to 200)

2. **LPS Address** (like GPS coordinates): [-10.5, 45.2, -800.3] mm
   - X = how far left from origin
   - Y = how far back from origin
   - Z = how far up from origin

**The Transformation Formula:**

```
┌─────────────────────────────────────────────────────────────────┐
│                 From IJK to LPS (World)                          │
│                                                                   │
│  Given a voxel at [i, j, k]:                                     │
│                                                                   │
│  World_X = Origin_X + i × (Row_Direction_X × Pixel_Spacing_Col) │
│                     + j × (Col_Direction_X × Pixel_Spacing_Row) │
│                     + k × (Slice_Direction_X × Slice_Spacing)   │
│                                                                   │
│  World_Y = Origin_Y + i × (Row_Direction_Y × Pixel_Spacing_Col) │
│                     + j × (Col_Direction_Y × Pixel_Spacing_Row) │
│                     + k × (Slice_Direction_Y × Slice_Spacing)   │
│                                                                   │
│  World_Z = Origin_Z + i × (Row_Direction_Z × Pixel_Spacing_Col) │
│                     + j × (Col_Direction_Z × Pixel_Spacing_Row) │
│                     + k × (Slice_Direction_Z × Slice_Spacing)   │
│                                                                   │
│  In matrix form:                                                  │
│                                                                   │
│  ┌   ┐   ┌                              ┐   ┌   ┐              │
│  │ X │   │ Rx×Sc  Cx×Sr  Nx×Ss   Ox   │   │ i │              │
│  │ Y │ = │ Ry×Sc  Cy×Sr  Ny×Ss   Oy   │ × │ j │              │
│  │ Z │   │ Rz×Sc  Cz×Sr  Nz×Ss   Oz   │   │ k │              │
│  │ 1 │   │   0      0      0       1   │   │ 1 │              │
│  └   ┘   └                              ┘   └   ┘              │
│                                                                   │
│  Where:                                                           │
│  R = Row direction, C = Column direction, N = Normal (slice)    │
│  Sc = Column spacing, Sr = Row spacing, Ss = Slice spacing      │
│  O = Origin (ImagePositionPatient)                               │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Example Calculation

Let's find the world position of voxel [100, 200, 50]:

```
Given:
  Origin (ImagePositionPatient) = [-100.0, -100.0, -800.0] mm
  Row Direction = [1, 0, 0]     (pointing right)
  Column Direction = [0, 1, 0]  (pointing down)
  Slice Direction = [0, 0, 1]   (pointing superior)
  Pixel Spacing = [0.5, 0.5] mm
  Slice Spacing = 1.0 mm

Calculate:
  World_X = -100.0 + 100×(1×0.5) + 200×(0×0.5) + 50×(0×1.0)
          = -100.0 + 50.0 + 0 + 0
          = -50.0 mm  (50mm to the right of origin)

  World_Y = -100.0 + 100×(0×0.5) + 200×(1×0.5) + 50×(0×1.0)
          = -100.0 + 0 + 100.0 + 0
          = 0.0 mm  (exactly at origin's Y position)

  World_Z = -800.0 + 100×(0×0.5) + 200×(0×0.5) + 50×(1×1.0)
          = -800.0 + 0 + 0 + 50.0
          = -750.0 mm  (50mm superior to origin)

Result: Voxel [100, 200, 50] is at world position [-50.0, 0.0, -750.0] mm
```

---

## Chapter 4: World 3 - The Camera and Screen

### 4.1 The Virtual Camera

Think of the camera like a real camera photographing the 3D patient data:

```
                          The Virtual Camera

     Camera Position                          View Plane (Film)
          ●                                   ┌─────────────┐
        ╱ │ ╲                                │             │
       ╱  │  ╲                               │             │
      ╱   │   ╲                              │   Slice     │
     ╱    │    ╲                             │   Image     │
    ╱     │     ╲                            │             │
   ╱      │      ╲                           │             │
  ╱       │       ╲                          └─────────────┘
 ╱        │        ╲                              ↑
╱         │viewPlane╲                            │
          │Normal   │                         viewUp
          ↓         │                         (up direction)
    ┌─────●─────────┐
    │  Focal Point  │ ← This is what the camera looks at
    └───────────────┘

    │←   distance  →│
```

**Camera Parameters Explained:**

1. **position**: Where is the camera?
   - Example: `[77.49, 240.72, -877.47]` mm in world space

2. **focalPoint**: What is the camera looking at?
   - Example: `[-1.27, 59.50, -791.40]` mm in world space
   - This is typically the center of the slice

3. **viewPlaneNormal**: Which direction is the camera pointing?
   - Example: `[0.365, 0.841, -0.399]`
   - This is a unit vector (length = 1.0)

4. **viewUp**: Which way is "up" for the camera?
   - Example: `[0.220, -0.495, -0.841]`
   - Defines the orientation/rotation

5. **parallelScale**: How much zoom?
   - Example: `234.207` mm
   - This is half the height of the visible scene
   - Smaller number = more zoom

### 4.2 The Three Standard Views

```
┌────────────────────────────────────────────────────────────────────┐
│                    Standard MPR Views                               │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │  AXIAL (Top)     │  │ SAGITTAL (Side)  │  │  CORONAL (Front) │ │
│  │                  │  │                  │  │                  │ │
│  │    viewPlane     │  │    viewPlane     │  │    viewPlane     │ │
│  │    Normal        │  │    Normal        │  │    Normal        │ │
│  │      ↓           │  │      →           │  │      ↗           │ │
│  │   [0,0,1]        │  │   [1,0,0]        │  │   [0,1,0]        │ │
│  │                  │  │                  │  │                  │ │
│  │  Looking down    │  │ Looking from     │  │ Looking from     │ │
│  │  at patient      │  │ patient's right  │  │ behind patient   │ │
│  │                  │  │                  │  │                  │ │
│  │       R          │  │       S          │  │       S          │ │
│  │       ↑          │  │       ↑          │  │       ↑          │ │
│  │   L ←●→ R        │  │   P ←●→ A        │  │   L ←●→ R        │ │
│  │       ↓          │  │       ↓          │  │       ↓          │ │
│  │       L          │  │       I          │  │       I          │ │
│  │                  │  │                  │  │                  │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
│                                                                      │
│  All three cameras look at the SAME 3D data but from different     │
│  angles. They all share the same world coordinate system (LPS).    │
└────────────────────────────────────────────────────────────────────┘

Legend: R=Right, L=Left, A=Anterior, P=Posterior, S=Superior, I=Inferior
```

### 4.3 How Your Oblique View Works

From your snapshot, the axial viewport has:
- `viewPlaneNormal: [0.365, 0.841, -0.399]`
- `rotation: 60.34°`

This creates an **oblique slice** - not aligned with standard planes:

```
                    Standard Axial Slice
                         (flat)
                    ┌─────────────┐
                    │             │
                    │             │
                    └─────────────┘
                    viewPlaneNormal: [0, 0, 1]

                           ↓
                    (Rotate & tilt)
                           ↓

                    Oblique Slice
                  (tilted and rotated)
                    ╱─────────────╲
                   ╱               ╲
                  ╱                 ╲
                 ╱───────────────────╲
                 viewPlaneNormal: [0.365, 0.841, -0.399]

      This allows you to view anatomy at any arbitrary angle!
```

---

## Chapter 5: Viewport State - The Complete Recipe

### 5.1 What Gets Saved?

When you call `viewportStateService.saveSnapshot()`, it's like taking a **photograph of the photograph**:

```
┌────────────────────────────────────────────────────────────────────┐
│                    Viewport State Snapshot                          │
│                    (Complete Recipe to Recreate View)               │
│                                                                      │
│  📷 CAMERA (Where and How We're Looking)                           │
│     ├─ position: [x, y, z]        Camera location in 3D space      │
│     ├─ focalPoint: [x, y, z]      What we're looking at            │
│     ├─ viewUp: [x, y, z]          Camera orientation (up)          │
│     ├─ viewPlaneNormal: [x, y, z] Camera direction (forward)       │
│     └─ parallelScale: 234.2        Zoom level                       │
│                                                                      │
│  🎯 VIEW REFERENCE (Which Slice)                                    │
│     ├─ sliceIndex: 760             Slice number (out of ~1000)      │
│     ├─ volumeId: "..."             Which scan dataset               │
│     └─ planeRestriction:           Exact slice plane definition     │
│         ├─ point: [x, y, z]        Point on the plane               │
│         ├─ normal: [x, y, z]       Perpendicular to plane           │
│         └─ inPlaneVectors          Basis vectors within plane       │
│                                                                      │
│  🎨 VIEW PRESENTATION (UI Adjustments)                              │
│     ├─ zoom: 1.0                   Additional zoom factor           │
│     ├─ pan: [17.5, 40.2]           Pan offset                       │
│     ├─ rotation: 60.3°             In-plane rotation                │
│     ├─ flipHorizontal: false       Mirror horizontally?             │
│     └─ flipVertical: false         Mirror vertically?               │
│                                                                      │
│  📝 METADATA (Identification)                                        │
│     ├─ viewportId: "mpr-axial"     Which viewport                   │
│     ├─ viewportType: "orthographic" Projection type                 │
│     └─ renderingEngineId: "..."    Which renderer                   │
│                                                                      │
└────────────────────────────────────────────────────────────────────┘
```

### 5.2 The Relationship Between Components

```
                  How the Components Work Together

┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  FrameOfReferenceUID                                            │
│  (Which coordinate system?)                                      │
│         │                                                        │
│         ├─→ Defines world space for all viewports               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────┐                  │
│  │         World Coordinate System          │                  │
│  │              (LPS mm)                    │                  │
│  └──────────────────────────────────────────┘                  │
│         │                                                        │
│         │                                                        │
│         ├─→ Camera.focalPoint (where to look)                   │
│         ├─→ Camera.position (where camera is)                   │
│         └─→ ViewReference.sliceIndex (which slice)              │
│                     │                                            │
│                     ▼                                            │
│         ┌───────────────────────┐                               │
│         │   Camera Transform    │                               │
│         │  (viewing geometry)   │                               │
│         └───────────────────────┘                               │
│                     │                                            │
│                     ├─→ viewPlaneNormal (look direction)        │
│                     ├─→ viewUp (orientation)                    │
│                     └─→ parallelScale (zoom)                    │
│                     │                                            │
│                     ▼                                            │
│         ┌───────────────────────┐                               │
│         │  View Presentation    │                               │
│         │   (UI adjustments)    │                               │
│         └───────────────────────┘                               │
│                     │                                            │
│                     ├─→ rotation (in-plane spin)                │
│                     ├─→ pan (shift focal point)                 │
│                     ├─→ zoom (scale view)                       │
│                     └─→ flip (mirror)                           │
│                     │                                            │
│                     ▼                                            │
│         ┌───────────────────────┐                               │
│         │   Final Canvas View   │                               │
│         │  (what you see)       │                               │
│         └───────────────────────┘                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Restoration Process

When you call `viewportStateService.restoreSnapshot(name)`:

```
Step 1: Retrieve saved state from memory
   ↓
   {camera: {...}, viewReference: {...}, viewPresentation: {...}}

Step 2: Find the viewport
   ↓
   viewport = engine.getViewport("mpr-axial")

Step 3: Apply camera
   ↓
   viewport.setCamera(savedCamera)
   → VTK camera updated
   → View matrix recomputed

Step 4: Apply view reference
   ↓
   viewport.setViewReference(savedViewReference)
   → Slice position updated
   → Plane restriction applied

Step 5: Apply view presentation
   ↓
   viewport.setViewPresentation(savedViewPresentation)
   → Zoom applied
   → Pan applied
   → Rotation applied

Step 6: Render
   ↓
   viewport.render()
   → VTK renders new view
   → Canvas updated
   → You see the same view as before!
```

---

## Chapter 6: Practical Walkthrough - Your Snapshot

Let's decode your actual snapshot data step by step:

### 6.1 Axial Viewport Analysis

```json
{
  "frameOfReferenceUID": "1.2.826.0.1.3680043.8.498...",
  "camera": {
    "viewUp": [0.220, -0.495, -0.841],
    "viewPlaneNormal": [0.365, 0.841, -0.399],
    "position": [77.49, 240.72, -877.47],
    "focalPoint": [-1.27, 59.50, -791.40],
    "parallelScale": 234.21,
    "rotation": 60.34
  }
}
```

**What This Means in Plain English:**

1. **Coordinate System**: `frameOfReferenceUID`
   - This CT scan uses coordinate system #12744708...
   - All three viewports (axial, sagittal, coronal) reference the same system

2. **Camera Location**: `position: [77.49, 240.72, -877.47]`
   - Camera is 77.49mm to the left of center
   - 240.72mm posterior (toward back)
   - -877.47mm inferior (below head) - negative because of LPS system

3. **Looking At**: `focalPoint: [-1.27, 59.50, -791.40]`
   - Looking at a point 1.27mm to the right of center
   - 59.50mm posterior
   - -791.40mm inferior
   - This is the center of the slice

4. **Camera-to-Focal Distance**:
   ```
   distance = √[(77.49-(-1.27))² + (240.72-59.50)² + (-877.47-(-791.40))²]
            = √[78.76² + 181.22² + 86.07²]
            = √[6203 + 32840 + 7408]
            = √46451
            = 215.5 mm
   ```
   Camera is 215.5mm away from the slice

5. **View Direction**: `viewPlaneNormal: [0.365, 0.841, -0.399]`
   - Pointing 36.5% in +X direction (toward left)
   - Pointing 84.1% in +Y direction (toward back)
   - Pointing -39.9% in Z direction (downward)
   - This is NOT a standard axial view (which would be [0, 0, 1])

6. **Orientation**: `viewUp: [0.220, -0.495, -0.841]`
   - The "up" direction in the image
   - Combined with `rotation: 60.34°`, the image is significantly rotated

7. **Zoom Level**: `parallelScale: 234.21`
   - The view shows 468.42mm height (2× parallelScale)
   - If canvas is 512px tall: 468.42mm / 512px ≈ 0.91 mm/pixel

8. **Slice Number**: `sliceIndex: 760`
   - Showing slice #760 out of approximately 1000 slices
   - About 76% through the volume

### 6.2 Comparing Three Viewports

Here's how your three viewports differ:

```
┌───────────────┬──────────────┬───────────────┬──────────────┐
│   Property    │    Axial     │   Sagittal    │   Coronal    │
├───────────────┼──────────────┼───────────────┼──────────────┤
│ sliceIndex    │     760      │      550      │     586      │
│               │ (76%)        │ (55%)         │ (59%)        │
├───────────────┼──────────────┼───────────────┼──────────────┤
│ focalPoint Z  │   -791.40    │   -758.79     │   -758.79    │
│               │ (Superior)   │ (Same level)  │ (Same level) │
├───────────────┼──────────────┼───────────────┼──────────────┤
│ rotation      │    60.34°    │      0°       │   293.54°    │
│               │ (Rotated)    │ (Standard)    │ (Rotated)    │
├───────────────┼──────────────┼───────────────┼──────────────┤
│ pan [X, Y]    │ [17.5, 40.2] │ [-16.6, 0]    │ [27.0, -67.0]│
│               │ (Off-center) │ (Left pan)    │ (Off-center) │
└───────────────┴──────────────┴───────────────┴──────────────┘
```

**Observations**:
- All three are looking at approximately the same region of the body
- Axial and Coronal are rotated; Sagittal is standard orientation
- All have been panned away from their default centers
- They maintain spatial consistency (same world coordinates)

---

## Chapter 7: Summary - The Flow of Data

### Final Diagram: Complete Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        START: DICOM File                          │
│  Tags: Position [x,y,z], Orientation [6 values], Spacing [2]    │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│              1. Build IJK→World Matrix                           │
│  Using: Origin, Direction Cosines, Spacing                       │
│  Result: imageData.indexToWorld(i,j,k) = [x,y,z]                │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│              2. Create VTK Volume                                 │
│  imageData = vtkImageData with geometry                          │
│  All voxels now have world coordinates                           │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│              3. Position Camera                                   │
│  camera.position, camera.focalPoint, camera.viewUp               │
│  Defines: what we see and from where                             │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│              4. VTK Rendering Pipeline                            │
│  • Reslice volume along viewPlaneNormal                          │
│  • Apply camera transformations                                  │
│  • Project to 2D canvas                                          │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│              5. Apply View Presentation                           │
│  • Zoom factor                                                    │
│  • Pan offset                                                     │
│  • Rotation angle                                                 │
│  • Flips                                                          │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│              6. Display on Canvas                                 │
│  WebGL renders to screen                                          │
│  User sees medical image                                          │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│              7. Save Viewport State (Optional)                    │
│  Capture: camera, viewReference, viewPresentation                │
│  Can restore exact view later                                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways for Students

### The Three Essential Transformations

1. **IJK → World** (Voxel to Millimeters)
   - Uses: DICOM position + orientation + spacing
   - Formula: World = Origin + Direction·Spacing·IJK
   - Purpose: Place image in 3D space

2. **World → Camera** (Physical Space to View Space)
   - Uses: Camera position, focal point, viewUp, viewPlaneNormal
   - Formula: Camera matrix transforms world coordinates
   - Purpose: Define what we see

3. **Camera → Screen** (View Space to Pixels)
   - Uses: Projection matrix + viewport transform
   - Formula: Canvas = Projection(Camera(World))
   - Purpose: Draw on screen

### The Viewport State Contains

✅ **Camera** - Where we're looking from and at
✅ **ViewReference** - Which slice and exact plane
✅ **ViewPresentation** - UI-level zoom/pan/rotation
✅ **Metadata** - Identification information

### Why This Matters

- 🔄 **Consistency**: All viewports share the same world space
- 💾 **Reproducibility**: Save and restore exact views
- 🎯 **Precision**: Accurate spatial relationships
- 🔧 **Flexibility**: Support arbitrary oblique planes
- 🤝 **Integration**: Tools and annotations work across viewports

---

## Practice Questions

1. **If a voxel is at IJK [100, 150, 50] and the voxel spacing is 0.5mm, how far is it from the origin in the I direction?**
   - Answer: 100 × 0.5mm = 50mm

2. **What does `parallelScale: 200` mean?**
   - Answer: The view shows 400mm of height (200mm above and below center)

3. **If `viewPlaneNormal: [0, 0, 1]`, which standard view is this?**
   - Answer: Standard axial view (looking down along Z-axis)

4. **What happens if you double the `parallelScale`?**
   - Answer: The view zooms out (shows twice as much scene)

5. **Why do all three viewports share the same `frameOfReferenceUID`?**
   - Answer: They all view the same 3D volume in the same coordinate system

---

**Document Purpose**: Educational guide for new developers learning medical imaging coordinate systems
**Target Audience**: Junior developers, students, new team members
**Estimated Reading Time**: 45 minutes
**Prerequisites**: Basic linear algebra, understanding of 3D coordinates
