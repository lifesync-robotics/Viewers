# DICOM Alignment - Quick Start Guide

## ✅ What's New

Your 3D models now **automatically align with DICOM images** in patient space!

---

## 🚀 How to Use

### Step 1: Load DICOM Study
Load any CT/MRI study in OHIF viewer

### Step 2: Switch to 3D View (IMPORTANT!)
- Click **3D** or **Volume Rendering** button
- Or select a layout with Volume3D viewport
- **Don't use MPR/2D views** - they can't render 3D models properly

### Step 3: Upload Model
- Click **Upload 3D Models** button in toolbar
- Drag & drop or select your OBJ/STL/PLY file
- Model will automatically align with DICOM origin

### Step 4: Check Console
Open browser console (F12) to see detailed alignment info!

---

## 📊 What You'll See in Console

```
═══════════════════════════════════════════════════════
🎯 [ModelStateService] DICOM SPATIAL ALIGNMENT
═══════════════════════════════════════════════════════
📋 DICOM Origin (ImagePositionPatient): [-125.50, -250.25, 100.00]
   Tag: (0020,0032) - Patient position in 3D space (mm)
   X (LR): -125.50 mm  ← Left/Right
   Y (AP): -250.25 mm  ← Anterior/Posterior
   Z (SI): 100.00 mm   ← Superior/Inferior

📋 DICOM Orientation (ImageOrientationPatient): [1,0,0,0,1,0]
   Tag: (0020,0037) - Image orientation cosines
   Row direction: [1, 0, 0]
   Column direction: [0, 1, 0]

───────────────────────────────────────────────────────
📍 Model Original Position: [0.00, 0.00, 0.00]
   X: 0.00  ← Your model's origin
   Y: 0.00
   Z: 0.00

───────────────────────────────────────────────────────
📍 Model New Position (Merged with DICOM origin): [-125.50, -250.25, 100.00]
   X: -125.50 mm  ← Model moved to DICOM space
   Y: -250.25 mm
   Z: 100.00 mm

───────────────────────────────────────────────────────
📐 Position Delta (Change in origin):
   ΔX: -125.50 mm  ← How much model moved
   ΔY: -250.25 mm
   ΔZ: 100.00 mm
   Magnitude: 286.32 mm  ← Total distance moved
═══════════════════════════════════════════════════════
✅ [ModelStateService] Model position successfully updated to DICOM space
```

---

## 🎯 What the Alignment Does

### Before Alignment:
- **Model origin:** (0, 0, 0) - Model's local coordinate system
- **DICOM origin:** (-125.5, -250.25, 100.0) - Patient space coordinates

### After Alignment:
- **Model position:** (-125.5, -250.25, 100.0) - Now in patient space!
- **Result:** Model appears in correct anatomical location

---

## 🧪 Test It

### Quick Test:
```javascript
// In browser console after uploading a model
const models = window.servicesManager.services.modelStateService.getAllModels();
const model = models[0];

console.table({
  'Original Position': model.metadata.originalPosition,
  'DICOM Origin': model.metadata.dicomOrigin,
  'Aligned Position': model.metadata.alignedPosition,
  'Position Delta': [
    model.metadata.alignedPosition[0] - model.metadata.originalPosition[0],
    model.metadata.alignedPosition[1] - model.metadata.originalPosition[1],
    model.metadata.alignedPosition[2] - model.metadata.originalPosition[2],
  ]
});
```

---

## 🎓 Understanding the Coordinates

### DICOM Coordinate System (RAS)
- **X axis:** Left (-) → Right (+)
- **Y axis:** Posterior (-) → Anterior (+)
- **Z axis:** Inferior (-) → Superior (+)
- **Units:** Millimeters (mm)

### Example Values:
```
X = -125.5 mm  → 125.5 mm to the LEFT of origin
Y = -250.25 mm → 250.25 mm POSTERIOR to origin
Z = 100.0 mm   → 100 mm SUPERIOR to origin
```

---

## ⚠️ Important Notes

### ✅ DO:
- Use **Volume3D viewport** for 3D model rendering
- Load DICOM study **before** uploading models
- Check console logs to verify alignment

### ❌ DON'T:
- Don't use MPR (Axial/Sagittal/Coronal) viewports
- Don't use Stack viewports for 3D models
- Don't skip loading DICOM study first

---

## 🐛 Troubleshooting

### No Alignment Logs?
**Cause:** DICOM origin not available
**Fix:** Make sure DICOM study is loaded and metadata is available

### Model Not Visible?
**Cause:** Model might be outside viewport clipping planes
**Fix:** Reset camera or adjust clipping planes

### Wrong Alignment?
**Cause:** Model coordinate system doesn't match DICOM
**Fix:** Check model's original coordinate system in modeling software

---

## 📖 DICOM Tags Reference

| Tag | Name | Purpose | Example |
|-----|------|---------|---------|
| (0020,0032) | ImagePositionPatient | 3D position of image corner | [-125.5, -250.25, 100.0] |
| (0020,0037) | ImageOrientationPatient | Image plane orientation | [1,0,0,0,1,0] |
| (0028,0030) | PixelSpacing | Physical spacing between pixels | [0.5, 0.5] |
| (0018,0050) | SliceThickness | Thickness of slice | 2.0 |

---

## 🎉 Result

Your 3D models are now **automatically positioned in patient coordinate space**, making them perfectly aligned with DICOM images for:

- ✅ Surgical planning
- ✅ Implant positioning
- ✅ Registration verification
- ✅ 3D segmentation overlay

**Just upload and watch the magic happen!** 🚀

---

## 📚 Learn More

- **Full Documentation:** `DICOM_ALIGNMENT_IMPLEMENTATION.md`
- **Viewport Requirements:** `VIEWPORT_3D_REQUIREMENT.md`
- **Complete Setup:** `FINAL_DIAGNOSIS_AND_SOLUTION.md`

