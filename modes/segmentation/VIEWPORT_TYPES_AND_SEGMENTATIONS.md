# Viewport Types and Segmentation Representations in OHIF

## Overview

This document explains why segmentations don't work on 3D volume viewports and how the segmentation panel should handle multi-viewport layouts.

## Viewport Types in OHIF

### 1. Orthographic Viewports (MPR - Multi-Planar Reconstruction)
- **Type**: `orthographic`
- **Examples**: Axial, Coronal, Sagittal views
- **Purpose**: 2D slice-based viewing of volumetric data
- **Segmentation Support**: ✅ **YES** - Labelmaps work as 2D overlays
- **Typical Use**: 
  - Viewing individual slices
  - Drawing/editing segmentations
  - Measuring distances/angles on slices

### 2. Volume 3D Viewports
- **Type**: `volume3d` or `VOLUME_3D`
- **Examples**: 3D volume rendering, VR (Volume Rendering)
- **Purpose**: 3D volumetric rendering with opacity/color transfer functions
- **Segmentation Support**: ❌ **NO** - Labelmaps don't work directly
- **Typical Use**:
  - 3D visualization of anatomy
  - Volume rendering with transfer functions
  - Loading 3D surface models (STL, OBJ, PLY)

## Why Segmentations Don't Work on 3D Viewports

### Technical Reasons

1. **Labelmap Format**: Segmentations in OHIF are stored as **2D labelmaps**
   - Each slice has a 2D array of segment indices
   - Works perfectly for slice-based (orthographic) viewports
   - Not compatible with 3D volume rendering pipeline

2. **Rendering Pipeline**: 
   - **MPR viewports**: Render a single slice + overlay labelmap as colored regions
   - **3D viewports**: Render entire volume using ray casting + transfer functions
   - Labelmaps would need to be converted to 3D surfaces for 3D rendering

3. **Performance**: 
   - 2D labelmap overlay: Fast, simple pixel-based rendering
   - 3D surface from labelmap: Requires marching cubes algorithm, mesh generation, etc.

### From the Code

```typescript
// SegmentationService.ts (line 306)
if (viewport.type === 'volume3d' || viewport.type === 'VOLUME_3D') {
  console.warn(
    `⚠️ [SegmentationService] Skipping automatic segmentation representation for 3D viewport: ${viewportId}`,
    '- Use Upload Models button to load pre-generated 3D models instead'
  );
  return; // ← Segmentations are NOT added to 3D viewports
}
```

## Multi-Viewport Layouts

### FourUpMesh Layout (Used in Segmentation Mode)

```
┌─────────────┬─────────────┐
│   Axial     │   Coronal   │
│ (MPR/Ortho) │ (MPR/Ortho) │
│  ✅ Segs    │  ✅ Segs    │
├─────────────┼─────────────┤
│  Sagittal   │   3D Volume │
│ (MPR/Ortho) │  (Volume3D) │
│  ✅ Segs    │  ❌ No Segs │
└─────────────┴─────────────┘
```

### Segmentation Representation Distribution

- **Axial viewport** (`fourUpMesh-mpr-axial`): Has labelmap representations ✅
- **Coronal viewport** (`fourUpMesh-mpr-coronal`): Has labelmap representations ✅
- **Sagittal viewport** (`fourUpMesh-mpr-sagittal`): Has labelmap representations ✅
- **3D Volume viewport** (`fourUpMesh-volume3d`): **NO** labelmap representations ❌

## The Panel Problem

### Before Fix

```typescript
// Panel queries active viewport
const activeViewportId = viewportGrid?.activeViewportId; // "fourUpMesh-volume3d"

// Query segmentations for that viewport
const representations = segmentationService.getSegmentationRepresentations(activeViewportId);
// Returns: [] (empty array)

// Panel shows: "No segmentations"
```

### After Fix

```typescript
// Panel detects 3D viewport and finds MPR viewport instead
const viewportIdToUse = useMemo(() => {
  if (viewport?.type === 'volume3d') {
    // Find first MPR viewport with segmentations
    return findMPRViewportWithSegmentations(); // "fourUpMesh-mpr-axial"
  }
  return activeViewportId;
}, [activeViewportId]);

// Query segmentations for MPR viewport
const representations = segmentationService.getSegmentationRepresentations(viewportIdToUse);
// Returns: [seg1, seg2, ...] ✅

// Panel shows: Segmentation list ✅
```

## Best Practices

### For Mode Developers

1. **Understand Viewport Types**: Know which viewports support segmentations
2. **Panel Design**: Don't blindly use active viewport for segmentation queries
3. **Fallback Strategy**: Always have a fallback to an MPR viewport
4. **User Communication**: Make it clear which viewport is being used for segmentation display

### For Extension Developers

1. **Viewport Type Checking**: Always check viewport type before adding segmentations
2. **Error Handling**: Provide clear error messages when operations aren't supported
3. **Documentation**: Document which viewport types support which features

### For Users

1. **Editing Segmentations**: Always use MPR viewports (Axial, Coronal, Sagittal)
2. **Viewing 3D Models**: Use the 3D volume viewport
3. **Viewing Segmentations in 3D**: Use the "Upload Models" button to load pre-generated 3D surface models

## Future Enhancements

### 1. Automatic Labelmap to Surface Conversion

```typescript
// Potential future feature
async function convertLabelmapToSurface(segmentationId: string, segmentIndex: number) {
  const labelmap = segmentationService.getSegmentation(segmentationId);
  const surface = await marchingCubes(labelmap, segmentIndex);
  return surface; // Can be added to 3D viewport
}
```

### 2. Unified Segmentation Panel

```typescript
// Show segmentations from all viewports
function useAllViewportSegmentations() {
  const state = viewportGridService.getState();
  const viewports = state?.viewports;
  const allSegmentations = [];
  if (viewports) {
    for (const [viewportId] of viewports.entries()) {
      const representations = segmentationService.getSegmentationRepresentations(viewportId);
      allSegmentations.push(...representations);
    }
  }
  return deduplicateBySegmentationId(allSegmentations);
}
```

### 3. Viewport Type Indicator

```typescript
// Show which viewport the segmentations are from
<SegmentationPanel>
  <ViewportIndicator>Showing segmentations from: Axial View</ViewportIndicator>
  <SegmentationList />
</SegmentationPanel>
```

## Conclusion

The key insight is that **segmentations are viewport-type-specific**:
- **MPR viewports**: Support 2D labelmap segmentations ✅
- **3D viewports**: Support 3D surface models ✅
- **3D viewports**: Do NOT support 2D labelmap segmentations ❌

The segmentation panel must be aware of this distinction and intelligently choose which viewport to query for segmentations based on the active viewport type.

## References

- OHIF Segmentation Documentation: https://docs.ohif.org/platform/extensions/modules/segmentation
- Cornerstone3D Segmentation: https://www.cornerstonejs.org/docs/concepts/cornerstone-tools/segmentation
- VTK.js Marching Cubes: https://kitware.github.io/vtk-js/examples/MarchingCubes.html

