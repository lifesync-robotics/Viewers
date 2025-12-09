# DICOM Coordinate System and Plane Normals Reference

## 🧭 DICOM RAS Coordinate System

```
                     +Z (Superior / Head)
                      ↑
                      |
                      |
                      |
                      |
       (Left) -X ←────┼────→ +X (Right)
                     /|
                    / |
                   /  |
                  ↓   |
            -Y (Posterior)
            Back

         +Y (Anterior / Front)
```

### Axes Definition:
- **X-axis**: Left (-X) ← → Right (+X)
- **Y-axis**: Posterior (-Y) ← → Anterior (+Y)
- **Z-axis**: Inferior (-Z) ← → Superior (+Z)

---

## 📐 Standard MPR Planes

### 1. Axial Plane (Transverse / Horizontal)
```
        ┌─────────────────┐
        │                 │
        │    👤 Top View  │   Looking DOWN from head
        │                 │   Slices perpendicular to Z-axis
        │     (Slice)     │
        └─────────────────┘
        
        Plane Normal: [0, 0, 1] → Points along +Z axis
        View Direction: Looking down from superior
        Orientation: XY plane (Right-Anterior plane)
```

**What you see:**
- Horizontal cross-section through body
- Left side on right, right side on left (radiological view)
- Anterior (front) at top, posterior (back) at bottom

---

### 2. Sagittal Plane (Side View)
```
        ┌─────────────────┐
        │                 │
        │   👤 Side View  │   Looking from LEFT side
        │                 │   Slices perpendicular to X-axis
        │     (Slice)     │
        └─────────────────┘
        
        Plane Normal: [1, 0, 0] → Points along +X axis
        View Direction: Looking from left to right
        Orientation: YZ plane (Anterior-Superior plane)
```

**What you see:**
- Side profile of body
- Anterior (front) on left, posterior (back) on right
- Superior (head) at top, inferior (feet) at bottom

---

### 3. Coronal Plane (Front View)
```
        ┌─────────────────┐
        │                 │
        │   👤 Front View │   Looking from FRONT
        │                 │   Slices perpendicular to Y-axis
        │     (Slice)     │
        └─────────────────┘
        
        Plane Normal: [0, 1, 0] → Points along +Y axis
        View Direction: Looking from anterior to posterior
        Orientation: XZ plane (Right-Superior plane)
```

**What you see:**
- Front view of body
- Left side on right, right side on left (radiological view)
- Superior (head) at top, inferior (feet) at bottom

---

## 🎯 2D Projection on Each Plane

### Axial Plane Projection
```
Tool Position: [100, 50, 30]
Tool Direction: [0, 0, 1] (pointing up)

Axial Plane at Z=30:
┌─────────────────────────┐
│                         │
│          ●              │  ← Tool intersects here (100, 50, 30)
│          |              │
│          | (projection) │
│          ↓              │
│                         │
└─────────────────────────┘

Plane Normal: [0, 0, 1]
Intersection: Tool Z matches plane Z → intersection at (100, 50, 30)
Canvas Projection: viewport.worldToCanvas([100, 50, 30])
```

---

### Sagittal Plane Projection
```
Tool Position: [100, 50, 30]
Tool Direction: [1, 0, 0] (pointing right)

Sagittal Plane at X=100:
┌─────────────────────────┐
│                         │
│          ●──────→       │  ← Tool intersects here (100, 50, 30)
│        (projection)     │
│                         │
│                         │
│                         │
└─────────────────────────┘

Plane Normal: [1, 0, 0]
Intersection: Tool X matches plane X → intersection at (100, 50, 30)
Canvas Projection: viewport.worldToCanvas([100, 50, 30])
```

---

### Coronal Plane Projection
```
Tool Position: [100, 50, 30]
Tool Direction: [0, 1, 0] (pointing forward)

Coronal Plane at Y=50:
┌─────────────────────────┐
│                         │
│          ●              │  ← Tool intersects here (100, 50, 30)
│          |              │
│          | (projection) │
│          ↓              │
│                         │
└─────────────────────────┘

Plane Normal: [0, 1, 0]
Intersection: Tool Y matches plane Y → intersection at (100, 50, 30)
Canvas Projection: viewport.worldToCanvas([100, 50, 30])
```

---

## 🔍 Line-Plane Intersection Formula

### Mathematical Definition:
```
Plane: n · (P - P₀) = 0
  where:
    n  = plane normal vector
    P  = any point on the plane
    P₀ = known point on the plane (focal point)

Line: P = L₀ + t·d
  where:
    L₀ = line origin (tool origin)
    d  = line direction (tool direction)
    t  = parameter (distance along line)

Intersection: Solve for t
    n · (L₀ + t·d - P₀) = 0
    n · (L₀ - P₀) + t·(n · d) = 0
    t = n · (P₀ - L₀) / (n · d)
```

### Example Calculation:

**Given:**
- Tool origin: `L₀ = [100, 50, 20]`
- Tool tip: `[100, 50, 40]`
- Tool direction: `d = [0, 0, 1]` (normalized)
- Axial plane at Z=30: `P₀ = [128, 128, 30]`
- Plane normal: `n = [0, 0, 1]`

**Calculate:**
```
P₀ - L₀ = [128, 128, 30] - [100, 50, 20] = [28, 78, 10]

n · (P₀ - L₀) = [0, 0, 1] · [28, 78, 10] = 10

n · d = [0, 0, 1] · [0, 0, 1] = 1

t = 10 / 1 = 10

Intersection: P = L₀ + t·d = [100, 50, 20] + 10·[0, 0, 1] = [100, 50, 30]
```

**Result:** Tool intersects axial plane at `[100, 50, 30]`

---

## ⚠️ Common Issues and Solutions

### Issue 1: Wrong Plane Normal
**Symptom:** Projection appears on wrong plane

**Example:**
```
Viewport: mpr-axial-viewport-1
Camera Normal: [1, 0, 0]  ← WRONG! This is sagittal normal
Expected Normal: [0, 0, 1] ← Correct for axial

Result: Projection calculated for sagittal plane, drawn on axial viewport
```

**Solution:** Use standard normal based on viewport name, not camera normal

---

### Issue 2: 90-Degree Rotation
**Symptom:** Projection is rotated 90 degrees

**Possible Causes:**
1. Camera's `up` vector is incorrect
2. Canvas coordinate transformation is using wrong orientation
3. Viewport initialization used wrong viewing direction

**Check:**
```javascript
const camera = viewport.getCamera();
console.log('Position:', camera.position);
console.log('Focal Point:', camera.focalPoint);
console.log('View Up:', camera.viewUp);
console.log('View Plane Normal:', camera.viewPlaneNormal);
```

**Expected for Axial (standard orientation):**
- `viewPlaneNormal`: `[0, 0, 1]` or `[0, 0, -1]`
- `viewUp`: `[0, -1, 0]` (Anterior points down on screen)

---

### Issue 3: Projection on Wrong Viewport
**Symptom:** Sagittal projection appears on coronal viewport

**Root Cause:** Viewport identification failed or camera normal was used incorrectly

**Fix Applied:**
```typescript
// OLD: Used camera normal directly
const planeNormal = camera.viewPlaneNormal; // Could be wrong!

// NEW: Identify viewport and use standard normal
const viewportType = this._identifyViewportType(viewport);
const planeNormal = this._getStandardPlaneNormal(viewportType);
```

---

## 🧪 Testing Coordinate System Understanding

### Test 1: Verify Viewport Camera Setup
```javascript
const engine = cornerstone3D.getRenderingEngine('OHIFCornerstoneRenderingEngine');
const viewports = engine.getViewports();

viewports.forEach(vp => {
  if (vp.id.toLowerCase().includes('axial')) {
    const camera = vp.getCamera();
    console.log('Axial Camera:');
    console.log('  Normal:', camera.viewPlaneNormal);
    console.log('  Expected: [0, 0, ±1]');
    console.log('  Match:', Math.abs(camera.viewPlaneNormal[2]) > 0.9 ? '✅' : '❌');
  }
});
```

### Test 2: Manual Intersection Test
```javascript
// Test line-plane intersection manually
const toolOrigin = [100, 100, 20];
const toolTip = [100, 100, 40];
const toolDirection = [0, 0, 1]; // Normalized

// Axial plane at Z=30
const planeNormal = [0, 0, 1];
const planePoint = [128, 128, 30];

// Calculate intersection
const numerator = planeNormal[0] * (planePoint[0] - toolOrigin[0]) +
                  planeNormal[1] * (planePoint[1] - toolOrigin[1]) +
                  planeNormal[2] * (planePoint[2] - toolOrigin[2]);
// numerator = 0*(128-100) + 0*(128-100) + 1*(30-20) = 10

const denominator = planeNormal[0] * toolDirection[0] +
                    planeNormal[1] * toolDirection[1] +
                    planeNormal[2] * toolDirection[2];
// denominator = 0*0 + 0*0 + 1*1 = 1

const t = numerator / denominator; // t = 10

const intersection = [
  toolOrigin[0] + t * toolDirection[0],  // 100 + 10*0 = 100
  toolOrigin[1] + t * toolDirection[1],  // 100 + 10*0 = 100
  toolOrigin[2] + t * toolDirection[2]   // 20 + 10*1 = 30
];
// Result: [100, 100, 30] ✅

console.log('Intersection:', intersection);
console.log('Expected: [100, 100, 30]');
```

---

## 📚 References

### DICOM Coordinate System:
- **Standard:** DICOM Part 3, Annex C.7.6.2.1.1
- **RAS System:** Right-Anterior-Superior (standard in medical imaging)
- **Alternative:** LPS (Left-Posterior-Superior) - used by some systems

### Plane Normal Convention:
- **Right-hand rule:** Thumb points in normal direction
- **Positive direction:** Normal points in increasing axis direction
- **Unit vectors:** All standard normals are unit length (magnitude = 1)

### VTK.js Camera System:
- `position`: Camera eye position
- `focalPoint`: Where camera is looking
- `viewUp`: Up direction for camera
- `viewPlaneNormal`: Direction camera is looking (derived from position and focalPoint)

---

## 🎓 Quick Reference Table

| Plane      | Normal Vector | View Direction | What You See | Viewport ID Pattern |
|------------|---------------|----------------|--------------|---------------------|
| **Axial**  | `[0, 0, 1]`  | Superior→Inferior | Top view (XY plane) | `*axial*` |
| **Sagittal** | `[1, 0, 0]` | Right→Left | Side view (YZ plane) | `*sagittal*` |
| **Coronal** | `[0, 1, 0]` | Anterior→Posterior | Front view (XZ plane) | `*coronal*` |

---

## 💡 Key Takeaways

1. **Viewport ID is Source of Truth**: Always check viewport.id to determine plane type
2. **Standard Normals are Known**: Use predefined normals for MPR planes
3. **Camera Can Drift**: Don't trust camera.viewPlaneNormal blindly
4. **Cross-Validate**: Compare camera normal with expected normal
5. **Right-Hand Rule**: All coordinate transformations follow right-hand rule
6. **Unit Vectors**: All normals should be normalized (length = 1)

---

*This reference document supports the projection fix implemented in `ToolProjectionRenderer.ts`*

