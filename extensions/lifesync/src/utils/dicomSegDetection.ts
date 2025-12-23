/**
 * DICOM Segmentation Detection Utility
 * 
 * Utilities for automatically detecting DICOM segmentation series from the active viewport.
 * Used for auto-populating segmentation series IDs in API calls.
 * Falls back to segmentation detection when CT series detection fails.
 */

/**
 * Get the current DICOM Segmentation series ID from the active viewport
 * @param servicesManager - OHIF services manager
 * @returns Segmentation Series Instance UID, or null if not found
 */
export function getCurrentSeriesId(servicesManager: any): string | null {
  try {
    const { displaySetService, viewportGridService } = servicesManager.services;

    console.log('🔍 [DicomSegDetection] Starting DICOM segmentation series detection...');

    // Strategy 1: Check active viewport first
    const { activeViewportId, viewports } = viewportGridService.getState();
    
    if (activeViewportId) {
      console.log(`   Active viewport: ${activeViewportId}`);
      const viewport = viewports.get(activeViewportId);
      
      if (viewport && viewport.displaySetInstanceUIDs && viewport.displaySetInstanceUIDs.length > 0) {
        console.log(`   Display sets in active viewport: ${viewport.displaySetInstanceUIDs.length}`);
        
        // Try to find segmentation in active viewport
        const seriesId = findSegmentationSeriesInDisplaySets(viewport.displaySetInstanceUIDs, displaySetService);
        if (seriesId) {
          return seriesId;
        }
      }
    }

    // Strategy 2: Check all viewports if active viewport doesn't have segmentation
    console.log('   Checking all viewports for segmentation series...');
    for (const [viewportId, viewport] of viewports.entries()) {
      if (viewport.displaySetInstanceUIDs && viewport.displaySetInstanceUIDs.length > 0) {
        console.log(`   Checking viewport ${viewportId}: ${viewport.displaySetInstanceUIDs.length} display sets`);
        
        const seriesId = findSegmentationSeriesInDisplaySets(viewport.displaySetInstanceUIDs, displaySetService);
        if (seriesId) {
          return seriesId;
        }
      }
    }

    // Strategy 3: Search all display sets in the service (last resort)
    console.log('   Checking all available display sets for segmentations...');
    const allDisplaySets = displaySetService.getActiveDisplaySets();
    console.log(`   Total display sets available: ${allDisplaySets.length}`);
    
    for (const displaySet of allDisplaySets) {
      const isSegmentation = checkIfSegmentation(displaySet);
      
      console.log(`   Display set: ${displaySet.displaySetInstanceUID}`);
      console.log(`      Modality: ${displaySet.Modality || 'unknown'}`);
      console.log(`      SOPClassUID: ${displaySet.SOPClassUID || 'unknown'}`);
      console.log(`      Is Seg: ${isSegmentation}`);
      
      if (isSegmentation && displaySet.SeriesInstanceUID) {
        console.log('✅ [DicomSegDetection] Found segmentation series in all display sets:', displaySet.SeriesInstanceUID);
        console.log(`   Modality: ${displaySet.Modality || 'unknown'}`);
        console.log(`   Description: ${displaySet.SeriesDescription || 'unknown'}`);
        return displaySet.SeriesInstanceUID;
      }
    }

    console.warn('⚠️ [DicomSegDetection] No segmentation series found in any viewport or display set');
    return null;
    
  } catch (error) {
    console.error('❌ [DicomSegDetection] Error detecting segmentation series ID:', error);
    return null;
  }
}

/**
 * Helper function to check if a display set is a segmentation
 */
function checkIfSegmentation(displaySet: any): boolean {
  return (
    displaySet.SOPClassUID === '1.2.840.10008.5.1.4.1.1.66.4' || // Segmentation Storage
    displaySet.Modality === 'SEG' ||
    displaySet.isReconstructable === true || // OHIF specific flag for SEG
    displaySet.displaySetInstanceUID?.includes('cornerstoneStreamingImageVolume') === false // Volume-based check
  );
}

/**
 * Helper function to find segmentation series in a list of display set UIDs
 */
function findSegmentationSeriesInDisplaySets(displaySetUIDs: string[], displaySetService: any): string | null {
  for (const displaySetInstanceUID of displaySetUIDs) {
    const displaySet = displaySetService.getDisplaySetByUID(displaySetInstanceUID);

    if (!displaySet) {
      continue;
    }

    const isSegmentation = checkIfSegmentation(displaySet);

    if (!isSegmentation) {
      console.log('   ⏭️ Skipping non-segmentation:', displaySetInstanceUID);
      continue;
    }

    // Found segmentation display set
    const seriesInstanceUID = displaySet.SeriesInstanceUID;

    if (seriesInstanceUID) {
      console.log('✅ [DicomSegDetection] Found segmentation series:', seriesInstanceUID);
      console.log(`   Modality: ${displaySet.Modality || 'unknown'}`);
      console.log(`   Description: ${displaySet.SeriesDescription || 'unknown'}`);
      console.log(`   Display Set UID: ${displaySetInstanceUID}`);
      return seriesInstanceUID;
    }
  }
  
  return null;
}

/**
 * Get all segmentation series IDs from all viewports
 * @param servicesManager - OHIF services manager
 * @returns Array of unique segmentation series IDs
 */
export function getAllSeriesIds(servicesManager: any): string[] {
  try {
    const { displaySetService, viewportGridService } = servicesManager.services;
    const seriesIds = new Set<string>();

    // Get all viewports
    const { viewports } = viewportGridService.getState();

    viewports.forEach((viewport: any) => {
      if (viewport.displaySetInstanceUIDs) {
        viewport.displaySetInstanceUIDs.forEach((displaySetInstanceUID: string) => {
          const displaySet = displaySetService.getDisplaySetByUID(displaySetInstanceUID);
          // Only include segmentation series
          if (displaySet && displaySet.SeriesInstanceUID && checkIfSegmentation(displaySet)) {
            seriesIds.add(displaySet.SeriesInstanceUID);
          }
        });
      }
    });

    const result = Array.from(seriesIds);
    console.log('📋 [DicomSegDetection] Found segmentation series IDs:', result);
    return result;
    
  } catch (error) {
    console.error('❌ [DicomSegDetection] Error getting all segmentation series IDs:', error);
    return [];
  }
}

/**
 * Get study ID from active viewport (works with any display set type)
 * @param servicesManager - OHIF services manager
 * @returns Study Instance UID, or null if not found
 */
export function getCurrentStudyId(servicesManager: any): string | null {
  try {
    const { displaySetService, viewportGridService } = servicesManager.services;

    // Get active viewport
    const { activeViewportId } = viewportGridService.getState();
    
    if (!activeViewportId) {
      return null;
    }

    const viewport = viewportGridService.getState().viewports.get(activeViewportId);
    
    if (!viewport || !viewport.displaySetInstanceUIDs || viewport.displaySetInstanceUIDs.length === 0) {
      return null;
    }

    const displaySetInstanceUID = viewport.displaySetInstanceUIDs[0];
    const displaySet = displaySetService.getDisplaySetByUID(displaySetInstanceUID);

    if (!displaySet) {
      return null;
    }

    const studyInstanceUID = displaySet.StudyInstanceUID;
    
    if (studyInstanceUID) {
      console.log('✅ [DicomSegDetection] Detected study ID:', studyInstanceUID);
    }

    return studyInstanceUID || null;
    
  } catch (error) {
    console.error('❌ [DicomSegDetection] Error detecting study ID:', error);
    return null;
  }
}


