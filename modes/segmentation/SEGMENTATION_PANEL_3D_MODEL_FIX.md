# Segmentation Panel Disappearing After 3D Model Upload - Root Cause & Fix

## Date
December 26, 2025

## Problem Statement

After loading segmentation masks in the segmentation mode, the right-hand panel displays all individual masks with a clickable list. However, once a 3D model is uploaded and rendered in the viewport, the segmentation list terminates and its function and appearance are disabled.

## Symptoms

1. ✅ Segmentation masks load correctly and display in the right panel
2. ✅ Individual masks are clickable and functional
3. ❌ After uploading a 3D model, the segmentation list disappears from the right panel
4. ❌ Segmentation functionality becomes disabled
5. ❌ The panel shows no segmentations even though they still exist in the service

## Root Cause Analysis

### The Issue

The problem occurs because of **viewport type mismatch** when using the `fourUpMesh` hanging protocol:

1. **Segmentation Mode Layout**: Uses `fourUpMesh` hanging protocol with:
   - 1x 3D Volume viewport (`volume3d` type) - for 3D rendering
   - 3x MPR viewports (`orthographic` type) - for axial, coronal, sagittal views

2. **Segmentation Representations**: Segmentations are added as **labelmap overlays** to the **MPR viewports** (orthographic), NOT to the 3D volume viewport.

3. **Active Viewport Tracking**: When a user clicks on the 3D viewport to upload a model:
   - The 3D viewport becomes the **active viewport**
   - The segmentation panel uses `useActiveViewportSegmentationRepresentations()` hook
   - This hook queries segmentations for the **active viewport ID**

4. **The Problem**: 
   - The 3D viewport (volume3d) has **NO segmentation representations** (segmentations are on MPR viewports)
   - The hook returns **empty array** for the 3D viewport
   - The panel shows "No segmentations" even though they exist on other viewports

### Code Flow

```typescript
// PanelSegmentation.tsx (line 61-62)
const { segmentationsWithRepresentations, disabled } =
  useActiveViewportSegmentationRepresentations();

// useActiveViewportSegmentationRepresentations.ts (BEFORE FIX)
function useActiveViewportSegmentationRepresentations() {
  const [viewportGrid] = useViewportGrid();
  const viewportId = viewportGrid?.activeViewportId;  // ← This is the 3D viewport!
  
  const segmentations = useViewportSegmentations({ viewportId });  // ← Returns empty for 3D viewport
  return segmentations;
}

// useViewportSegmentations.ts (line 153)
const representations = segmentationService.getSegmentationRepresentations(viewportId);
// ↑ Returns [] for 3D viewport because segmentations are on MPR viewports
```

### Why This Happens

From the console logs:
```
⚠️ [SegmentationService] Skipping automatic segmentation representation for 3D viewport: fourUpMesh-volume3d
   - Use Upload Models button to load pre-generated 3D models instead
```

This is **by design** - segmentations in OHIF are typically 2D labelmap overlays that work on slice-based viewports (MPR), not 3D volume viewports. The 3D viewport is meant for volumetric rendering and 3D models, not for segmentation editing.

## The Solution

### Strategy

Instead of showing segmentations for the **active viewport**, we need to:
1. Detect when the active viewport is a 3D volume viewport
2. Find an MPR viewport that has segmentations
3. Use that MPR viewport's ID to query segmentations
4. Display those segmentations in the panel

### Implementation

Modified `useActiveViewportSegmentationRepresentations.ts`:

```typescript
function useActiveViewportSegmentationRepresentations() {
  const [viewportGrid] = useViewportGrid();
  const { servicesManager } = useSystem();
  const { segmentationService, viewportGridService, cornerstoneViewportService } = servicesManager.services;

  const activeViewportId = viewportGrid?.activeViewportId;

  // Check if the active viewport is a 3D volume viewport
  // If so, find the first MPR viewport that has segmentations instead
  const viewportIdToUse = useMemo(() => {
    if (!activeViewportId) {
      return activeViewportId;
    }

    const viewport = cornerstoneViewportService.getCornerstoneViewport(activeViewportId);
    
    // If the active viewport is a 3D volume viewport (type 'volume3d' or 'VOLUME_3D'),
    // find the first MPR viewport with segmentations
    if (viewport?.type === 'volume3d' || viewport?.type === 'VOLUME_3D') {
      // Get all viewports from state (returns a Map)
      const state = viewportGridService.getState();
      const viewports = state?.viewports;
      
      // Look for MPR viewports (orthographic) that have segmentations
      // viewports is a Map, so iterate over entries
      for (const [viewportId, viewportData] of viewports.entries()) {
        const vpInstance = cornerstoneViewportService.getCornerstoneViewport(viewportId);
        
        // Check if this is an MPR viewport (orthographic type)
        const vpType = vpInstance?.type as string;
        if (vpType === 'orthographic') {
          // Check if this viewport has any segmentation representations
          const representations = segmentationService.getSegmentationRepresentations(viewportId);
          if (representations && representations.length > 0) {
            console.log(
              `🔍 [useActiveViewportSegmentationRepresentations] Active viewport is 3D (${activeViewportId}), ` +
              `using MPR viewport ${viewportId} for segmentation panel instead`
            );
            return viewportId;
          }
        }
      }
      
      // If no MPR viewport with segmentations found, try any MPR viewport
      for (const [viewportId, viewportData] of viewports.entries()) {
        const vpInstance = cornerstoneViewportService.getCornerstoneViewport(viewportId);
        const vpType = vpInstance?.type as string;
        if (vpType === 'orthographic') {
          console.log(
            `🔍 [useActiveViewportSegmentationRepresentations] Active viewport is 3D (${activeViewportId}), ` +
            `using first available MPR viewport ${viewportId} for segmentation panel`
          );
          return viewportId;
        }
      }
    }

    // Otherwise use the active viewport
    return activeViewportId;
  }, [
    activeViewportId,
    cornerstoneViewportService,
    viewportGridService,
    segmentationService,
  ]);

  const segmentations = useViewportSegmentations({ viewportId: viewportIdToUse });

  return segmentations;
}
```

### Key Changes

1. **Viewport Type Detection**: Check if active viewport is `volume3d` or `VOLUME_3D`
2. **MPR Viewport Search**: Find the first `orthographic` (MPR) viewport with segmentations
3. **Fallback Strategy**: If no MPR with segmentations, use first available MPR viewport
4. **Logging**: Added console logs for debugging
5. **Memoization**: Used `useMemo` to avoid unnecessary recalculations

## Why This Fix Works

### Before Fix
```
User clicks 3D viewport → activeViewportId = "fourUpMesh-volume3d"
                       ↓
useActiveViewportSegmentationRepresentations() queries "fourUpMesh-volume3d"
                       ↓
segmentationService.getSegmentationRepresentations("fourUpMesh-volume3d") → []
                       ↓
Panel shows: "No segmentations"
```

### After Fix
```
User clicks 3D viewport → activeViewportId = "fourUpMesh-volume3d"
                       ↓
useActiveViewportSegmentationRepresentations() detects 3D viewport
                       ↓
Searches for MPR viewport with segmentations
                       ↓
Finds "fourUpMesh-mpr-axial" (has segmentations)
                       ↓
segmentationService.getSegmentationRepresentations("fourUpMesh-mpr-axial") → [seg1, seg2, ...]
                       ↓
Panel shows: Segmentation list with all masks ✅
```

## Decoupling Achieved

The fix ensures that:

1. **3D Model Upload**: Happens in the 3D volume viewport
2. **Segmentation Display**: Always shows from MPR viewports
3. **Independence**: These two features are now truly decoupled
4. **User Experience**: Segmentation list remains visible and functional regardless of which viewport is active

## Testing

### Test Case 1: Load Segmentations First
1. ✅ Load DICOM study
2. ✅ Load segmentation masks
3. ✅ Verify segmentation list appears in right panel
4. ✅ Click on 3D viewport
5. ✅ Upload 3D model
6. ✅ **Expected**: Segmentation list remains visible
7. ✅ **Expected**: All segmentation functionality works

### Test Case 2: Load Model First
1. ✅ Load DICOM study
2. ✅ Click on 3D viewport
3. ✅ Upload 3D model
4. ✅ Click on MPR viewport
5. ✅ Load segmentation masks
6. ✅ Click back on 3D viewport
7. ✅ **Expected**: Segmentation list remains visible
8. ✅ **Expected**: All segmentation functionality works

### Test Case 3: Switch Between Viewports
1. ✅ Load DICOM study with segmentations and 3D model
2. ✅ Click on different MPR viewports (axial, coronal, sagittal)
3. ✅ **Expected**: Segmentation list updates correctly
4. ✅ Click on 3D viewport
5. ✅ **Expected**: Segmentation list still shows (from MPR viewport)
6. ✅ Click back on MPR viewport
7. ✅ **Expected**: Segmentation list updates correctly

## Related Files

- **Fixed File**: `Viewers/extensions/cornerstone/src/hooks/useActiveViewportSegmentationRepresentations.ts`
- **Panel Component**: `Viewers/extensions/cornerstone/src/panels/PanelSegmentation.tsx`
- **Hook**: `Viewers/extensions/cornerstone/src/hooks/useViewportSegmentations.ts`
- **Mode Config**: `Viewers/modes/segmentation/src/index.tsx`

## Additional Notes

### Why Segmentations Don't Work on 3D Viewports

From `SegmentationService.ts` (line 306):
```typescript
console.warn(
  `⚠️ [SegmentationService] Skipping automatic segmentation representation for 3D viewport: ${viewportId}`,
  '- Use Upload Models button to load pre-generated 3D models instead'
);
```

This is intentional because:
1. Segmentations in OHIF are 2D labelmap overlays
2. They work on slice-based viewports (MPR)
3. 3D viewports are for volumetric rendering and surface models
4. To show segmentations in 3D, you need to convert them to 3D surface models (separate process)

### Future Enhancements

1. **3D Segmentation Surfaces**: Add support for converting labelmaps to 3D surface models
2. **Viewport Synchronization**: Ensure segmentation edits in MPR viewports update 3D surfaces
3. **Panel Customization**: Allow users to choose which viewport's segmentations to display
4. **Multi-Viewport Segmentation**: Show segmentations from all viewports in a unified list

## Conclusion

The issue was caused by the segmentation panel querying the active viewport (3D volume) which has no segmentation representations. The fix redirects the query to an MPR viewport when the active viewport is 3D, ensuring the segmentation list remains visible and functional regardless of which viewport is active.

**Status**: ✅ **FIXED** - Segmentation list now persists after 3D model upload

