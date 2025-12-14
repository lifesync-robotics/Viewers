# ROI Selection - User-Drawn Rectangles Approach

## Overview

The ROI selection system allows users to **manually draw rectangles** on coronal and sagittal views to define a 3D region of interest. When confirmed, the camera **zooms to focus** on the ROI.

## Workflow

1. **Start ROI Selection** → RectangleROI tool is enabled
2. **Draw on Coronal View** → User draws a rectangle (defines X and Z range)
3. **Draw on Sagittal View** → User draws a rectangle (defines Y and Z range)
4. **Zoom to ROI** → Camera zooms/pans to the 3D intersection
5. **Reset** → Restores original camera state

## How It Works

### Rectangle Mapping

```
Coronal View:
  - X axis (horizontal) → ROI X range
  - Z axis (vertical)   → ROI Z range

Sagittal View:
  - Y axis (horizontal) → ROI Y range
  - Z axis (vertical)   → ROI Z range (intersection)

3D ROI Bounds:
  - X: from Coronal rectangle
  - Y: from Sagittal rectangle
  - Z: intersection of both rectangles
```

### Camera Zoom

When confirmed, each viewport:
1. Moves focal point to ROI center
2. Adjusts parallelScale to fit ROI with 10% padding
3. Maintains original viewing direction

## Benefits

✅ **Simple** - User draws rectangles naturally
✅ **Intuitive** - Standard drawing interaction
✅ **Fast** - Instant zoom, no processing
✅ **Reversible** - Easy reset to original view
✅ **Flexible** - User controls exact ROI shape

## UI Elements

### Status Indicators
- **Coronal: ✓ Drawn** - Rectangle drawn on coronal view
- **Sagittal: ✓ Drawn** - Rectangle drawn on sagittal view

### Buttons
- **Start ROI Selection** - Enable drawing mode
- **Zoom to ROI** - Confirm and zoom (requires both rectangles)
- **Cancel** - Cancel without zooming
- **Reset View** - Restore original camera

## Files

- `types.ts` - Rectangle2DBounds, RectangleAnnotationInfo, ROI3DBounds
- `ROISelectionService.ts` - Event handling, bounds calculation, camera zoom
- `ROIPanel.tsx` - UI for ROI selection workflow

## Events

| Event | Description |
|-------|-------------|
| `SELECTION_STARTED` | ROI mode enabled |
| `RECTANGLE_UPDATED` | Rectangle drawn or modified |
| `BOUNDS_UPDATED` | 3D bounds calculated |
| `SELECTION_CONFIRMED` | User clicked Zoom |
| `ROI_APPLIED` | Camera zoomed |
| `ROI_RESET` | Selection cleared |

## Usage

```tsx
// Start selection - enable RectangleROI tool
roiSelectionService.startSelection();

// User draws rectangles on views...

// Confirm and zoom
roiSelectionService.confirmSelection();

// Reset to original view
roiSelectionService.reset();
```

## Future Enhancements

1. **Remember Last ROI** - Store rectangle positions per study
2. **Quick Presets** - Buttons for common spine regions
3. **ROI Outline** - Show 3D box overlay in volume rendering
4. **Annotation Labels** - Custom labels for rectangles
