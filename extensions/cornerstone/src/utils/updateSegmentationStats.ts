import * as cornerstoneTools from '@cornerstonejs/tools';
import * as csCore from '@cornerstonejs/core';
import cloneDeep from 'lodash.clonedeep';

interface BidirectionalAxis {
  length: number;
  // Add other axis properties as needed
}

interface BidirectionalData {
  majorAxis: BidirectionalAxis;
  minorAxis: BidirectionalAxis;
}

/**
 * Updates the statistics for a segmentation by calculating stats for each segment
 * and storing them in the segment's cachedStats property
 *
 * @param segmentation - The segmentation object containing segments to update stats for
 * @param segmentationId - The ID of the segmentation
 * @returns The updated segmentation object with new stats, or null if no updates were made
 */
export async function updateSegmentationStats({
  segmentation,
  segmentationId,
  readableText,
}: {
  segmentation: any;
  segmentationId: string;
  readableText: any;
}): Promise<any | null> {
  if (!segmentation) {
    console.debug('No segmentation found for id:', segmentationId);
    return null;
  }

  const segmentIndices = Object.keys(segmentation.segments)
    .map(index => parseInt(index))
    .filter(index => index > 0); // Filter out segment 0 which is typically background

  if (segmentIndices.length === 0) {
    console.debug('No segments found in segmentation:', segmentationId);
    return null;
  }

  const stats = await cornerstoneTools.utilities.segmentation.getStatistics({
    segmentationId,
    segmentIndices,
    mode: 'individual',
  });

  if (!stats) {
    return null;
  }

  const updatedSegmentation = cloneDeep(segmentation);
  let hasUpdates = false;

  // Loop through each segment's stats (using for...of to support await)
  for (const [segmentIndex, segmentStats] of Object.entries(stats)) {
    const index = parseInt(segmentIndex);

    if (!updatedSegmentation.segments[index].cachedStats) {
      updatedSegmentation.segments[index].cachedStats = {};
      hasUpdates = true;
    }

    // Get existing namedStats or initialize if not present
    const namedStats = updatedSegmentation.segments[index].cachedStats.namedStats || {};

    if (segmentStats.array) {
      segmentStats.array.forEach(stat => {
        // only gather stats that are in the readableText
        if (!readableText[stat.name]) {
          return;
        }

        if (stat && stat.name) {
          namedStats[stat.name] = {
            name: stat.name,
            label: readableText[stat.name],
            value: stat.value,
            unit: stat.unit,
            order: Object.keys(readableText).indexOf(stat.name),
          };
        }
      });

      if (readableText.volume) {
        // Add volume if it exists but isn't in the array
        if (segmentStats.volume && !namedStats.volume) {
          namedStats.volume = {
            name: 'volume',
            label: 'Volume',
            value: segmentStats.volume.value,
            unit: segmentStats.volume.unit,
            order: Object.keys(readableText).indexOf('volume'),
          };
        }
      }

      // Update the segment's cachedStats with namedStats
      updatedSegmentation.segments[index].cachedStats.namedStats = namedStats;
      hasUpdates = true;
    }

    // Calculate and store center point for segment navigation
    // This is needed for jumpToSegmentCenter to work correctly
    // Try to get center from stats, or calculate it from bounding box
    try {
      const volumeId = updatedSegmentation.representationData?.LABELMAP?.volumeId;
      if (volumeId) {
        const volume = csCore.cache.getVolume(volumeId);
        if (volume) {
          // Try to get center from segmentStats if available
          let imageCenter: csCore.Types.Point3 | null = null;

          if (segmentStats.centerOfMass) {
            imageCenter = [
              segmentStats.centerOfMass[0],
              segmentStats.centerOfMass[1],
              segmentStats.centerOfMass[2],
            ] as csCore.Types.Point3;
          } else {
            // Calculate center from volume bounds if centerOfMass is not available
            // Get the segmentation volume to calculate bounds
            try {
              const segmentation = updatedSegmentation;
              const volumeId = segmentation.representationData?.LABELMAP?.volumeId;
              if (volumeId) {
                const segVolume = csCore.cache.getVolume(volumeId);
                if (segVolume) {
                  // Get the bounds of the volume
                  const imageData = segVolume.imageData;
                  const dimensions = imageData.getDimensions();

                  // Calculate center from volume dimensions
                  imageCenter = [
                    dimensions[0] / 2,
                    dimensions[1] / 2,
                    dimensions[2] / 2,
                  ] as csCore.Types.Point3;
                }
              }
            } catch (error) {
              console.warn(`Failed to calculate center from volume bounds for segment ${index}:`, error);
            }
          }

          if (imageCenter) {
            // Convert image coordinates to world coordinates
            const worldCenter = volume.imageData.indexToWorld(imageCenter);

            // Store center in the format expected by _getSegmentCenter
            updatedSegmentation.segments[index].cachedStats.center = {
              image: imageCenter,
              world: worldCenter,
            };
            hasUpdates = true;
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to calculate center for segment ${index}:`, error);
    }
  }

  return hasUpdates ? updatedSegmentation : null;
}

/**
 * Updates a segment's statistics with bidirectional measurement data
 *
 * @param segmentationId - The ID of the segmentation
 * @param segmentIndex - The index of the segment to update
 * @param bidirectionalData - The bidirectional measurement data to add
 * @param segmentationService - The segmentation service to use for updating the segment
 * @returns Whether the update was successful
 */
export function updateSegmentBidirectionalStats({
  segmentationId,
  segmentIndex,
  bidirectionalData,
  segmentationService,
  annotation,
}: {
  segmentationId: string;
  segmentIndex: number;
  bidirectionalData: BidirectionalData;
  segmentationService: AppTypes.SegmentationService;
  annotation: any;
}) {
  if (!segmentationId || segmentIndex === undefined || !bidirectionalData) {
    console.debug('Missing required data for bidirectional stats update');
    return null;
  }

  const segmentation = segmentationService.getSegmentation(segmentationId);
  if (!segmentation || !segmentation.segments[segmentIndex]) {
    console.debug('Segment not found:', segmentIndex, 'in segmentation:', segmentationId);
    return null;
  }

  const updatedSegmentation = { ...segmentation };
  const segment = updatedSegmentation.segments[segmentIndex];

  if (!segment.cachedStats) {
    segment.cachedStats = { namedStats: {} };
  }

  if (!segment.cachedStats.namedStats) {
    segment.cachedStats.namedStats = {};
  }

  const { majorAxis, minorAxis, maxMajor, maxMinor } = bidirectionalData;
  if (!majorAxis || !minorAxis) {
    console.debug('Missing major or minor axis data');
    return null;
  }

  let hasUpdates = false;
  const namedStats = segment.cachedStats.namedStats;

  // Only calculate and update if we have valid measurements
  if (maxMajor > 0 && maxMinor > 0) {
    namedStats.bidirectional = {
      name: 'bidirectional',
      label: 'Bidirectional',
      annotationUID: annotation.annotationUID,
      value: {
        maxMajor,
        maxMinor,
        majorAxis,
        minorAxis,
      },
      unit: 'mm',
    };

    hasUpdates = true;
  }

  if (hasUpdates) {
    return updatedSegmentation;
  }

  return null;
}
