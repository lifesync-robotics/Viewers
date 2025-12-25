# Segmentation Mode Toolbar Inheritance

## Summary

The segmentation mode has been refactored to **inherit the toolbar configuration from the basic mode** instead of duplicating toolbar button definitions. This improves code maintainability and ensures consistency across modes.

## Changes Made

### File: `src/toolbarButtons.ts`

**Before:**
- Defined all toolbar buttons locally (800+ lines)
- Duplicated many common buttons from basic mode (WindowLevel, Pan, Zoom, etc.)
- Made maintenance difficult as changes to basic buttons required updates in both modes

**After:**
- Imports `basicToolbarButtons` from `@ohif/mode-basic/src/toolbarButtons`
- Defines only **segmentation-specific** buttons (sections and tools)
- Combines both using spread operator: `[...basicToolbarButtons, ...segmentationSpecificButtons]`
- Reduced code duplication by ~400 lines

### Segmentation-Specific Buttons Retained

The following segmentation-specific toolbar buttons are still defined locally:

#### Section Containers
- `BrushTools` - Brush tool section
- `LabelMapUtilities` - Label map utilities toolbar
- `ContourUtilities` - Contour utilities toolbar
- `LabelMapTools` - Label map tools section
- `ContourTools` - Contour tools section

#### Contour Segmentation Tools
- `PlanarFreehandContourSegmentationTool` - Freehand contour drawing
- `LivewireContourSegmentationTool` - Livewire contour tool
- `SplineContourSegmentationTool` - Spline contour tool
- `SculptorTool` - Sculptor tool for contours

#### Label Map Segmentation Tools
- `Brush` - Brush tool (Circle/Sphere)
- `Eraser` - Eraser tool (Circle/Sphere)
- `Threshold` - Threshold tool with dynamic/range modes
- `Shapes` - Shape tools (Circle/Sphere/Rectangle scissors)
- `RegionSegmentPlus` - One-click segment tool
- `LabelmapSlicePropagation` - AI-assisted labelmap propagation
- `MarkerLabelmap` - Marker-guided labelmap (SAM)
- `LabelMapEditWithContour` - Edit labelmap with contour

#### Utilities
- `InterpolateLabelmap` - Interpolate between drawn slices
- `SegmentBidirectional` - Automatic bidirectional measurement
- `SimplifyContours` - Simplify contour points
- `SmoothContours` - Smooth contour edges
- `LogicalContourOperations` - Combine/subtract contours

## Inherited Buttons from Basic Mode

The segmentation mode now automatically inherits all basic mode toolbar buttons, including:

### Navigation & Viewing Tools
- WindowLevel
- Pan
- Zoom
- TrackballRotate (3D Rotate)
- Crosshairs
- Layout selector
- Capture (screenshot)

### Measurement Tools
- Length
- Bidirectional
- Angle
- CobbAngle
- EllipticalROI
- RectangleROI
- CircleROI
- PlanarFreehandROI
- SplineROI
- ArrowAnnotate

### More Tools
- Reset
- Rotate Right
- Flip Horizontal
- Reference Lines
- Image Overlay Viewer
- Stack Scroll
- Invert
- Cine
- Magnify
- Tag Browser
- Model Upload
- Fiducial Marker
- Save/Load Measurements

### Menus & Components
- modalityLoadBadge
- navigationComponent
- trackingStatus
- dataOverlayMenu
- orientationMenu
- windowLevelMenu / windowLevelMenuEmbedded
- voiManualControlMenu
- thresholdMenu
- opacityMenu
- Colorbar

## Benefits

1. **Reduced Code Duplication**: Eliminated ~400 lines of duplicated button definitions
2. **Easier Maintenance**: Updates to basic mode buttons automatically propagate to segmentation mode
3. **Consistency**: Ensures toolbar behavior is consistent between modes
4. **Extensibility**: New buttons added to basic mode are automatically available in segmentation mode
5. **Clear Separation**: Segmentation-specific buttons are clearly identified and maintained separately

## Implementation Pattern

```typescript
// Import basic mode toolbar
import basicToolbarButtons from '@ohif/mode-basic/src/toolbarButtons';

// Define segmentation-specific buttons
const segmentationSpecificButtons: Button[] = [
  // ... segmentation tools ...
];

// Combine both
const toolbarButtons: Button[] = [
  ...basicToolbarButtons,
  ...segmentationSpecificButtons,
];

export default toolbarButtons;
```

## Testing

After making these changes, verify:

1. ✅ **Basic Tools Work**: Pan, Zoom, WindowLevel, etc. function correctly
2. ✅ **Segmentation Tools Work**: Brush, Contour, Threshold tools are available
3. ✅ **No Duplicate Buttons**: Check that buttons aren't appearing twice
4. ✅ **Toolbar Sections**: Verify proper grouping in MoreTools and segmentation sections
5. ✅ **No Linting Errors**: TypeScript compilation succeeds

## Future Improvements

1. **Consider Exporting Base Buttons**: Basic mode could export button groups for easier composition
2. **Shared Button Registry**: Create a central registry for common buttons used across modes
3. **Button Override Mechanism**: Allow segmentation mode to override specific basic mode buttons if needed
4. **Documentation**: Update OHIF mode development guide with this inheritance pattern

## Related Files

- `Viewers/modes/segmentation/src/toolbarButtons.ts` - Modified file
- `Viewers/modes/segmentation/src/index.tsx` - Uses these toolbar buttons (unchanged)
- `Viewers/modes/basic/src/toolbarButtons.ts` - Source of inherited buttons

## References

- OHIF Modes Documentation: https://docs.ohif.org/platform/modes/
- Mode Inheritance Guide: `Viewers/modes/AGENTS.md`

