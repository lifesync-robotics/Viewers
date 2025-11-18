# 3D Fiducial Markers - Complete Implementation

## Overview

This document describes the complete implementation of 3D fiducial markers in OHIF for surgical navigation and registration. Fiducial markers are 3D points placed in medical images for registration, tracking, and surgical planning.

## Features

### ✅ Crosshair-Based Placement
- Use the crosshair tool to precisely position in 3D space
- Click "Add Fiducial" button to place marker at exact crosshair center
- Ensures accurate placement across all three MPR views

### ✅ 3D World Coordinates
- Stores true 3D world coordinates (RAS - Right, Anterior, Superior)
- X: Left-Right axis
- Y: Anterior-Posterior axis
- Z: Superior-Inferior axis

### ✅ Slice-Aware Rendering
- Fiducial only appears when slice passes through its location
- Uses point-to-plane distance calculation
- Configurable threshold (default 2mm)
- Disappears when scrolling away from marker location

### ✅ Visual Design
- 0.5mm yellow circle for visibility
- Labeled as F1, F2, F3... in sequence
- Automatic measurement panel integration
- Shows X, Y, Z coordinates in millimeters

### ✅ Integration with OHIF
- Fully integrated with MeasurementService
- Appears in measurement panel with coordinates
- Can be edited, deleted, and exported
- Persists in viewport state

## Usage

### Placing a Fiducial

1. **Position the crosshair** in all three MPR views to the desired 3D location
2. **Click the "Add Fiducial" button** in the toolbar (circle icon in Measurements section)
3. **The marker appears** at the exact crosshair center in all views
4. **Check the measurement panel** to see the X, Y, Z coordinates

### Reading Coordinates

The measurement panel displays:
```
F1
X: 102.40 mm
Y: 179.84 mm
Z: 61.50 mm
```

### Deleting a Fiducial

- Click the trash icon in the measurement panel
- Or use the standard OHIF annotation deletion tools

## Technical Implementation

### Files Created

1. **`extensions/cornerstone/src/tools/FiducialMarkerTool.ts`**
   - Custom annotation tool extending Cornerstone3D `AnnotationTool`
   - Implements slice-aware rendering with distance calculation
   - Handles 0.5mm circle drawing and labeling

2. **`extensions/cornerstone/src/utils/addFiducialAtCrosshair.ts`**
   - Utility to extract crosshair center position
   - Creates fiducial annotation at that position
   - Handles measurement service integration

3. **`extensions/cornerstone/src/utils/measurementServiceMappings/FiducialMarker.ts`**
   - Mapping for MeasurementService integration
   - Formats coordinates for display
   - Generates reports with X, Y, Z values

### Files Modified

1. **`extensions/cornerstone/src/initCornerstoneTools.js`**
   - Registered FiducialMarkerTool with Cornerstone3D

2. **`modes/basic/src/initToolGroups.ts`**
   - Added FiducialMarker to passive tools list

3. **`modes/basic/src/toolbarButtons.ts`**
   - Added "Add Fiducial" button definition

4. **`modes/basic/src/index.tsx`**
   - Added FiducialMarker to MeasurementTools section

5. **`extensions/cornerstone/src/commandsModule.ts`**
   - Added `addFiducialAtCrosshair` command

6. **`extensions/cornerstone/src/utils/measurementServiceMappings/constants/supportedTools.js`**
   - Added 'FiducialMarker' to supported tools list

7. **`extensions/cornerstone/src/utils/measurementServiceMappings/measurementServiceMappingsFactory.ts`**
   - Added FiducialMarker factory registration

8. **`extensions/cornerstone/src/initMeasurementService.ts`**
   - Registered FiducialMarker measurement mapping

## Key Technical Details

### Crosshair Center Extraction

**Critical: Use `toolCenter`, NOT `rotationPoints`!**

```typescript
// ✅ CORRECT - toolCenter is the actual crosshair center
if (crosshairAnnotation.data?.handles?.toolCenter) {
  position = crosshairAnnotation.data.handles.toolCenter;
}

// ❌ WRONG - rotationPoints are UI rotation handles (offset from center!)
if (crosshairAnnotation.data?.handles?.rotationPoints) {
  position = crosshairAnnotation.data.handles.rotationPoints[0];
}
```

### Slice-Distance Calculation

Only render when fiducial is on current slice:

```typescript
// Point-to-plane distance
const dx = worldPoint[0] - focalPoint[0];
const dy = worldPoint[1] - focalPoint[1];
const dz = worldPoint[2] - focalPoint[2];
const distance = Math.abs(
  dx * viewPlaneNormal[0] +
  dy * viewPlaneNormal[1] +
  dz * viewPlaneNormal[2]
);

const sliceThreshold = 2.0; // mm
if (distance > sliceThreshold) {
  continue; // Don't render on this slice
}
```

### World-to-Canvas Projection

```typescript
// Convert 3D world coordinates to 2D canvas for drawing
const worldPoint: Point3 = [x, y, z];
const canvasPoint = viewport.worldToCanvas(worldPoint);

// Calculate radius in canvas pixels
const radiusPointWorld: Point3 = [x + 0.5, y, z];
const radiusPointCanvas = viewport.worldToCanvas(radiusPointWorld);
const canvasRadius = Math.abs(radiusPointCanvas[0] - canvasPoint[0]);
```

### Coordinate System (RAS)

All coordinates use DICOM Patient Coordinate System (RAS):
- **X (Right)**: Increasing values go from patient's left → right
- **Y (Anterior)**: Increasing values go from patient's posterior → anterior
- **Z (Superior)**: Increasing values go from patient's inferior → superior

## Configuration

### Adjust Slice Threshold

In `FiducialMarkerTool.ts`:
```typescript
const sliceThreshold = 2.0; // mm - adjust as needed
```

- **Thicker slices**: Increase (e.g., 5.0mm)
- **Thinner slices**: Decrease (e.g., 1.0mm)

### Change Marker Size

In `FiducialMarkerTool.ts`:
```typescript
const fixedRadiusMm = 0.5; // Change radius in mm
```

### Change Marker Color

In `FiducialMarkerTool.ts`:
```typescript
static toolName = 'FiducialMarker';
public static defaultColor = 'yellow'; // Change to any CSS color
```

## Testing

### Test Placement Accuracy

1. Place fiducials at known anatomical landmarks
2. Verify coordinates match expected values
3. Check visibility in all three views (axial, sagittal, coronal)
4. Scroll through slices - marker should appear/disappear correctly

### Test Measurement Integration

1. Place multiple fiducials (F1, F2, F3...)
2. Check measurement panel shows all markers
3. Verify X, Y, Z coordinates are correct
4. Test deletion and export features

### Test Registration Workflow

1. Load patient scan
2. Place fiducials at surgical planning points
3. Export coordinates for registration software
4. Verify coordinates are in correct RAS format

## Troubleshooting

### Fiducial Not at Crosshair Center

**Cause**: Using `rotationPoints` instead of `toolCenter`
**Fix**: Ensure code checks `toolCenter` first (already fixed in current implementation)

### Fiducial Shows on All Slices

**Cause**: Slice distance check disabled or threshold too high
**Fix**: Verify slice-distance calculation is active and threshold is appropriate

### Coordinates Show NaN

**Cause**: Position not properly extracted as numeric array
**Fix**: Ensure `parseFloat()` conversion and proper array extraction (already fixed)

### Fiducial Not Visible

**Cause**: Not added to tool groups or measurement service
**Fix**: Verify tool is in passive tools list and registered with measurement service

## Use Cases

### Surgical Navigation
- Place fiducials at anatomical landmarks
- Use for intraoperative registration
- Track surgical instruments relative to fiducials

### Radiation Therapy Planning
- Mark tumor boundaries
- Define treatment isocenter
- Plan beam angles

### Image Registration
- Place corresponding fiducials in multiple scans
- Calculate transformation matrix
- Fuse multimodal images (CT, MRI, PET)

### Research & Analysis
- Mark regions of interest
- Measure distances between anatomical points
- Create reference coordinate systems

## Future Enhancements

### Potential Improvements
- [ ] Different marker shapes (cross, sphere, cube)
- [ ] Color-coded fiducials by category
- [ ] Measure distances between fiducials
- [ ] Import/export fiducial lists (CSV, JSON)
- [ ] 3D line connections between fiducials
- [ ] Fiducial groups/categories
- [ ] Confidence/accuracy indicators
- [ ] Semi-automatic placement based on image features

## References

- [Cornerstone3D Documentation](https://www.cornerstonejs.org/)
- [OHIF Viewer Documentation](https://docs.ohif.org/)
- [DICOM Coordinate Systems](http://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_C.7.6.2.html)

## Author & Date

Implementation completed: November 2025
Branch: `navigation-viewer`

---

**Status**: ✅ Complete and tested
**Next Steps**: Ready for production use in surgical navigation workflows
