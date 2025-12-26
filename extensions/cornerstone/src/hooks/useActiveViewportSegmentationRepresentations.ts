import { useViewportGrid } from '@ohif/ui-next';
import { useViewportSegmentations } from './useViewportSegmentations';
import { useSystem } from '@ohif/core';
import { useMemo } from 'react';

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
    
    // If the active viewport is a 3D volume viewport (type 'volume3d'),
    // find the first MPR viewport with segmentations
    // Note: TypeScript types may not match runtime values, so we cast to string
    const viewportType = viewport?.type as string;
    if (viewportType === 'volume3d') {
      // Get all viewports from the state
      const state = viewportGridService.getState();
      const viewports = state?.viewports;
      
      if (!viewports) {
        return activeViewportId;
      }
      
      // Look for MPR viewports (orthographic) that have segmentations
      // viewports is a Map, so we iterate over entries
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

export { useActiveViewportSegmentationRepresentations };
