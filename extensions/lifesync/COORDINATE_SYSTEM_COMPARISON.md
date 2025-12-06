# Coordinate System Comparison: Screw Models vs Tracking Instruments

## 🎯 Summary

**Different transformation pipelines require different coordinate system corrections:**

| Model Type | Transform Source | Coordinate System | Needs -90° Rotation? |
|------------|-----------------|-------------------|---------------------|
| **Screw Models (Static)** | OHIF Viewport Cameras | VTK/Rendering Space | ❌ NO |
| **Tracking Instruments (Dynamic)** | NDI Tracker + Registration | DICOM LPS → VTK | ✅ YES |

---

## 🔬 Detailed Analysis

### 1️⃣ **Screw Models** - Static Planning

#### Transform Construction
**File**: `ScrewManagementPanel.tsx` - `constructScrewTransform()` (lines 320-438)

```typescript
// Get camera normals from OHIF viewports
const axialNormal = axialCamera.viewPlaneNormal;
const coronalNormal = [-coronalCamera.viewPlaneNormal[0], 
                       -coronalCamera.viewPlaneNormal[1], 
                       -coronalCamera.viewPlaneNormal[2]];
const sagittalNormal = sagittalCamera.viewPlaneNormal;

// Construct transform matrix (row-major)
const transform = new Float32Array([
  // Column 0: Axial normal
  axialNormal[0], coronalNormal[0], sagittalNormal[0], translation[0],
  axialNormal[1], coronalNormal[1], sagittalNormal[1], translation[1],
  axialNormal[2], coronalNormal[2], sagittalNormal[2], translation[2],
  0, 0, 0, 1
]);
```

#### Why No Coordinate Correction Needed?

**Camera normals are already in VTK/rendering coordinate system!**

- `axialCamera.viewPlaneNormal` → Already in VTK world space
- `coronalCamera.viewPlaneNormal` → Already in VTK world space  
- `sagittalCamera.viewPlaneNormal` → Already in VTK world space
- These vectors define the **rendering orientation** directly

#### Transform Application
**File**: `modelStateService.ts` - `setModelTransform()` (lines 1610-1616)

```typescript
// Simple transpose: row-major → column-major for VTK
const finalTransform = new Float32Array([
  adjustedTransform[0], adjustedTransform[4], adjustedTransform[8],  adjustedTransform[12],
  adjustedTransform[1], adjustedTransform[5], adjustedTransform[9],  adjustedTransform[13],
  adjustedTransform[2], adjustedTransform[6], adjustedTransform[10], adjustedTransform[14],
  adjustedTransform[3], adjustedTransform[7], adjustedTransform[11], adjustedTransform[15]
]);
```

**Result**: ✅ Screw models render correctly

---

### 2️⃣ **Tracking Instruments** - Real-Time Navigation

#### Transform Source
**File**: `TrackingService.ts` - PR to DICOM transformation (lines 1046-1091)

```typescript
// Transform pipeline: PR-relative marker → tooltip → DICOM space
// Step 1: Apply instrument calibration (marker → tooltip)
const tooltipMatrix = this._multiplyMatrix4x4(markerMatrix4x4, this.markerToTooltipMatrix);

// Step 2: Apply PR to DICOM registration
const dicomMatrix = this._multiplyMatrix4x4(this.prToDicomMatrix, tooltipMatrix);
```

**Coordinate System**: DICOM LPS (Left-Posterior-Superior)
- +X = Left (patient's left side)
- +Y = Posterior (patient's back)
- +Z = Superior (head direction)

#### Why Coordinate Correction Needed?

**DICOM LPS ≠ VTK Rendering Coordinate System**

VTK rendering expects a different axis orientation than DICOM medical imaging:
- DICOM has Z pointing to head (superior)
- VTK rendering needs proper Y-up orientation
- Mismatch causes the observed bug:
  - ❌ Head-to-foot movement → model moves up-down (Y-Z swap)
  - ❌ Model upright when tool flat (90° rotation issue)

#### Transform Application (BEFORE FIX)
**File**: `TrackingPanel.tsx` - `matrix4x4ToFlat()` (INCORRECT)

```typescript
// WRONG: Simple transpose without coordinate correction
const matrix4x4ToFlat = (matrix: number[][]): number[] => {
  return [
    matrix[0][0], matrix[1][0], matrix[2][0], matrix[3][0],  // Column 0
    matrix[0][1], matrix[1][1], matrix[2][1], matrix[3][1],  // Column 1
    matrix[0][2], matrix[1][2], matrix[2][2], matrix[3][2],  // Column 2
    matrix[0][3], matrix[1][3], matrix[2][3], matrix[3][3]   // Column 3
  ];
};
```

**Result**: ❌ Incorrect orientation (Y-Z axes swapped, 90° rotation error)

#### Transform Application (AFTER FIX)
**File**: `TrackingPanel.tsx` - `matrix4x4ToFlat()` (CORRECT)

```typescript
// CORRECT: Apply -90° X-rotation before transpose
const matrix4x4ToFlat = (matrix: number[][]): number[] => {
  // Coordinate system correction: -90° rotation around X-axis
  const rotateX_Neg90 = [
    [1,  0,  0, 0],
    [0,  0,  1, 0],  // Y → Z
    [0, -1,  0, 0],  // Z → -Y
    [0,  0,  0, 1]
  ];
  
  // Apply rotation: corrected = rotateX_Neg90 × matrix
  const corrected = multiplyMatrices(rotateX_Neg90, matrix);
  
  // Then transpose to column-major for VTK
  return transposeToColumnMajor(corrected);
};
```

**Result**: ✅ Correct orientation matching physical tool

---

## 📊 Side-by-Side Comparison

### Transformation Pipeline

#### Screw Models (Static)
```
OHIF Viewport Cameras
    ↓
Extract viewPlaneNormals (already in VTK space)
    ↓
Construct 4x4 matrix (row-major)
    ↓
Transpose to column-major
    ↓
✅ setUserMatrix() → Correct rendering
```

#### Tracking Instruments (Dynamic)
```
NDI Tracker (Physical Space)
    ↓
Patient Reference Transformation
    ↓
Instrument Calibration (marker → tooltip)
    ↓
PR to DICOM Registration
    ↓
DICOM Matrix (DICOM LPS coordinates) ← MEDICAL IMAGING SPACE
    ↓
⚠️ COORDINATE SYSTEM MISMATCH
    ↓
Apply -90° X-rotation (DICOM LPS → VTK rendering) ← FIX APPLIED HERE
    ↓
Transpose to column-major
    ↓
✅ setUserMatrix() → Correct rendering
```

---

## 🔑 Key Insight

**The -90° rotation is ONLY needed when transforming from DICOM medical imaging coordinates to VTK rendering coordinates.**

### When to Apply Correction?

| Source Coordinate System | Needs Correction? |
|-------------------------|-------------------|
| OHIF Viewport Cameras | ❌ NO - Already in VTK space |
| DICOM Image Space (LPS) | ✅ YES - Need conversion |
| NDI Tracker → DICOM | ✅ YES - Final result is DICOM |
| Direct VTK Transforms | ❌ NO - Already in VTK space |

---

## 🎓 Lessons Learned

### 1. **Understand Your Data Source**
- OHIF cameras → VTK space (no correction)
- Medical imaging → DICOM space (needs correction)
- Tracking systems → Variable (depends on registration)

### 2. **Coordinate System Awareness**
Always ask:
- What coordinate system is the transform in?
- What coordinate system does VTK expect?
- Do I need conversion?

### 3. **Don't Assume Uniformity**
Different model types can legitimately need different transformations:
- Static models from viewport cameras: Direct transpose OK
- Dynamic models from tracking: Need coordinate correction

### 4. **Previous Fix Was Removed Incorrectly**
In `modelStateService.ts` (lines 551-552):
```typescript
// no longer needed as the transformation matrix should handle this rotation already
// DICOM coordinate system alignment: -90° rotation around X-axis
```

**This comment was WRONG for tracking instruments** (though correct for screw models from cameras).

The rotation IS needed for DICOM-sourced transforms, just not for VTK-sourced transforms.

---

## ✅ Current Status

### Screw Models
- **Status**: ✅ Working correctly
- **Method**: `setModelTransform()` in `modelStateService.ts`
- **Transformation**: Simple row-major → column-major transpose
- **No changes needed**

### Tracking Instruments  
- **Status**: ✅ Fixed (Dec 5, 2025)
- **Method**: `matrix4x4ToFlat()` in `TrackingPanel.tsx`
- **Transformation**: -90° X-rotation → transpose
- **Fix location**: Lines 316-362 in TrackingPanel.tsx

---

## 📚 Related Files

### Screw Model Transformation
- `ScrewManagementPanel.tsx` - Transform construction from cameras
- `modelStateService.ts::setModelTransform()` - Simple transpose application

### Tracking Instrument Transformation
- `TrackingPanel.tsx::matrix4x4ToFlat()` - Coordinate correction + transpose
- `TrackingService.ts::_applyPr2DicomTransform()` - DICOM matrix generation
- `modelStateService.ts::setInstrumentModelTransform()` - Application to VTK

### Documentation
- `BUGFIX_3D_MODEL_TRANSFORMATION.md` - Detailed bug analysis
- `COORDINATE_SYSTEMS_AND_VIEWPORT_STATES_GUIDE.md` - VTK/DICOM reference
- `test_matrix_transform.py` - Diagnostic tool

---

## 🧪 Testing Matrix

| Test Case | Screw Models | Tracking Instruments |
|-----------|--------------|---------------------|
| Right-Left movement | ✅ Correct | ✅ Correct |
| Head-Foot movement | ✅ Correct | ✅ Fixed |
| Up-Down movement | ✅ Correct | ✅ Fixed |
| Tool orientation | ✅ Correct | ✅ Fixed |
| 2D projections | ✅ Correct | ✅ Unchanged |

---

**Last Updated**: December 5, 2025  
**Status**: Both systems working correctly with appropriate transformations

