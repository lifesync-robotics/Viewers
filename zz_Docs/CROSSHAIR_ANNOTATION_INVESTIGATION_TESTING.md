# Crosshair Annotation Investigation - Testing Guide

## Purpose
This document guides you through testing the investigation code added to `modelStateService.ts` to examine the complete structure of the Cornerstone3D CrosshairsTool annotation data, specifically to find how to extract plane normal vectors.

## What Was Added
Comprehensive logging in `extensions/cornerstone/src/modelStateService.ts` (lines 361-430) to log the complete structure of the crosshair annotation when plane cutters are updated.

## Testing Steps

### 1. Start the Application
```bash
yarn run dev
```

### 2. Open Browser Console
- Press `F12` to open Developer Tools
- Navigate to the Console tab
- Clear any existing logs

### 3. Load DICOM Data
- Load a DICOM series with 3D volume data
- Make sure you have volumetric data (CT or MRI series)

### 4. Switch to 3D Four Mesh Layout
- Click the layout selector button in the toolbar
- Select "3D four mesh" from the layout options
- You should see:
  - Top-left: 3D volume viewport
  - Top-right: Axial (2D MPR)
  - Bottom-left: Sagittal (2D MPR)
  - Bottom-right: Coronal (2D MPR)

### 5. Activate Crosshairs Tool
- Click the Crosshairs tool button in the toolbar (cross icon)
- Crosshairs should appear in all three 2D viewports
- Reference lines should be visible showing the intersection planes

### 6. Load a 3D Model
- Click the "Upload Model" button in the 3D viewport toolbar
- Select an OBJ file to load
- Wait for the model to load (you'll see progress logs)

### 7. Observe Console Output
Once the model is loaded and crosshairs are active, the console will display detailed logging for each viewport. Look for sections like:

```
═══════════════════════════════════════════════════
🔍 CROSSHAIR ANNOTATION FOR AXIAL (Viewport: viewport-mpr-axial)
═══════════════════════════════════════════════════
📌 Annotation UID: [some-uuid]

📋 Metadata:
  toolName: Crosshairs
  FrameOfReferenceUID: [frame-reference-uid]
  referencedImageId: [image-id]
  viewPlaneNormal: [array]
  viewUp: [array]

📦 Data Structure:
  Keys: ['handles', 'cachedStats', ...]

🎯 Handles:
  rotationPoints: Array[4]
    [0]: [x, y, z]
    [1]: [x, y, z]
    [2]: [x, y, z]
    [3]: [x, y, z]
  slabThicknessPoints: Array[...]
  ...

📊 Other Data Properties:
  cachedStats: {...}
  ...
═══════════════════════════════════════════════════
```

### 8. Trigger Updates
To see the logging multiple times, perform these actions:
- **Scroll** through slices in any 2D viewport
- **Pan** in any 2D viewport
- **Zoom** in/out
- **Drag** the crosshair center point
- **Move** between slices

Each camera modification will trigger the logging.

### 9. Analyze the Output

#### Key Information to Look For:

**A. Center Position**
```
rotationPoints: Array[4]
  [0]: [x, y, z]  ← This is the center point
```
or
```
toolCenter: [x, y, z]  ← Alternative location for center
```

**B. Plane Normal Vectors**
Look for any of these properties:
```
metadata:
  viewPlaneNormal: [x, y, z]  ← Camera's plane normal
  viewUp: [x, y, z]           ← Camera's up vector
```

or in handles:
```
handles:
  slabThicknessPoints: Array[...]  ← Might contain plane bounds
  rotationPoints: Array[4]          ← Might contain orientation info
```

or in data:
```
data:
  planes: { axial: {...}, coronal: {...}, sagittal: {...} }
  normals: { axial: [...], coronal: [...], sagittal: [...] }
  referenceLines: [...]
```

**C. Cached Statistics**
```
cachedStats: {
  // Might contain computed normals or plane data
}
```

### 10. Document Findings

Based on the console output, answer these questions:

1. **Where is the center stored?**
   - [ ] `data.handles.rotationPoints[0]`
   - [ ] `data.handles.toolCenter`
   - [ ] Other: _________________

2. **Are plane normals stored in the annotation?**
   - [ ] Yes, in: _________________
   - [ ] No, must be computed

3. **If plane normals are stored, what is the structure?**
   ```
   Path to normal: _________________
   Example value: [x, y, z]
   ```

4. **Are there different normals for each viewport orientation?**
   - [ ] Yes, stored per-viewport
   - [ ] No, single normal
   - [ ] Must be computed from camera

5. **What is in rotationPoints array?**
   - [ ] 1 point (center)
   - [ ] 4 points (corners?)
   - [ ] Other: _________________
   - Values: _________________

6. **Is there slab thickness information?**
   - [ ] Yes, in: _________________
   - [ ] No

7. **Are reference line endpoints available?**
   - [ ] Yes, in: _________________
   - [ ] No

### 11. Compare Across Viewports
Note if the annotation structure differs between:
- Axial viewport
- Sagittal viewport
- Coronal viewport

Pay attention to:
- Does each have the same center point?
- Do normals differ per viewport?
- Is there viewport-specific data?

## Expected Outcomes

### Scenario A: Normals Are in Annotation
If plane normals are found in the annotation:
```typescript
// We can extract directly
const annotation = annotations[0];
planeNormal = annotation.data.normals[orientation]; // or similar path
```

### Scenario B: Normals Must Be Computed
If normals are NOT in the annotation:
```typescript
// Option 1: Use standard orientation normals
const standardNormals = {
  axial: [0, 0, 1],
  coronal: [0, 1, 0],
  sagittal: [1, 0, 0]
};

// Option 2: Calculate from rotationPoints
// If 4 points define a plane, use cross product

// Option 3: Keep using camera viewPlaneNormal (current approach)
```

### Scenario C: Normals in Metadata
If normals are in metadata:
```typescript
const annotation = annotations[0];
planeNormal = annotation.metadata.viewPlaneNormal;
```

## Next Steps After Investigation

### If Normals Found in Annotation:
1. Update `updatePlanePosition` in `modelStateService.ts` to extract normals from annotation
2. Remove fallback to camera viewPlaneNormal
3. Test accuracy of plane cutting
4. Remove investigation logging code

### If Normals NOT Found:
1. **Option A:** Use standard normals for each orientation (most reliable)
   ```typescript
   const standardNormals = {
     axial: [0, 0, 1],
     coronal: [0, 1, 0],
     sagittal: [1, 0, 0]
   };
   ```

2. **Option B:** Keep using camera viewPlaneNormal (current approach)
   - This works but may have slight inaccuracies with rotated/oblique slices

3. **Option C:** Access CrosshairsTool instance methods
   - Check if tool has `getReferenceLineNormal()` or similar methods

## Cleanup After Investigation

Once the investigation is complete and you've determined the best approach:

1. **Remove investigation logging:**
   - Delete lines 361-430 in `modelStateService.ts`
   - Keep only the actual plane origin/normal extraction code

2. **Implement the solution:**
   - Based on findings, implement the most accurate method

3. **Update documentation:**
   - Document the final approach in `CROSSHAIR_BASED_PLANE_CUTTING.md`

4. **Test thoroughly:**
   - Verify plane cutting accuracy
   - Test with oblique slices
   - Test with rotated volumes

## Troubleshooting

### No Console Output
- **Check:** Is the crosshairs tool active?
- **Check:** Is the model loaded in FourUpMesh layout?
- **Check:** Are you scrolling/panning to trigger CAMERA_MODIFIED events?

### Error Messages
- **"Could not get crosshair data"**: Crosshairs tool may not be active
- **Undefined properties**: Annotation structure different than expected

### Incomplete Data
- Try dragging the crosshair to ensure it's fully initialized
- Try switching between viewports
- Try loading different DICOM data

## Questions to Answer

Copy this checklist and fill it in based on your findings:

```
CROSSHAIR ANNOTATION STRUCTURE FINDINGS
========================================

1. Center Position:
   Location: ___________________________
   Example: [___, ___, ___]

2. Plane Normals:
   Found: [ ] Yes [ ] No
   Location: ___________________________
   Per-viewport: [ ] Yes [ ] No
   Example (axial): [___, ___, ___]
   Example (sagittal): [___, ___, ___]
   Example (coronal): [___, ___, ___]

3. RotationPoints:
   Count: ___
   Purpose: ___________________________
   Values: ___________________________

4. SlabThicknessPoints:
   Exists: [ ] Yes [ ] No
   Purpose: ___________________________

5. Metadata viewPlaneNormal:
   Exists: [ ] Yes [ ] No
   Matches camera: [ ] Yes [ ] No
   Per-viewport: [ ] Yes [ ] No

6. Other Relevant Properties:
   ___________________________
   ___________________________

7. Recommended Approach:
   [ ] Extract normals from annotation
   [ ] Use standard normals by orientation
   [ ] Keep using camera viewPlaneNormal
   [ ] Other: ___________________________

Reason: ___________________________
___________________________
```

## Success Criteria

The investigation is successful when you can answer:
1. ✅ Where is the crosshair center stored?
2. ✅ Are plane normals available in the annotation?
3. ✅ If yes, how to extract them for each orientation?
4. ✅ If no, what is the best alternative approach?
5. ✅ How to ensure accuracy and synchronization across viewports?

## References

- `extensions/cornerstone/src/modelStateService.ts` - Investigation code location
- `CROSSHAIR_ANNOTATION_STRUCTURE_INVESTIGATION.md` - Investigation design document
- `CROSSHAIR_BASED_PLANE_CUTTING.md` - Current implementation (to be updated)
- Cornerstone3D Docs: https://www.cornerstonejs.org/docs/concepts/cornerstone-tools/tools/crosshairs
