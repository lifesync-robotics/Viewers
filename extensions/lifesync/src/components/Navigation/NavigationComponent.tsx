import React, { useCallback, useState, useEffect } from 'react';
import { ViewportActionArrows } from '@ohif/ui-next';
import { useSystem } from '@ohif/core/src';
import utils from '../../utils';
import { useViewportSegmentations } from '../../hooks/useViewportSegmentations';
import { useMeasurementTracking } from '../../hooks/useMeasurementTracking';
import { useViewportDisplaySets } from '../../hooks/useViewportDisplaySets';

/**
 * NavigationComponent provides navigation controls for viewports containing
 * special displaySets (SR, SEG, RTSTRUCT) to navigate between segments or measurements
 */
function NavigationComponent({ viewportId }: { viewportId: string }) {
  const { servicesManager } = useSystem();
  const { segmentationService, cornerstoneViewportService, measurementService } =
    servicesManager.services;

  // Get tracking information
  const { isTracked, trackedMeasurementUIDs } = useMeasurementTracking({ viewportId });
  const { viewportDisplaySets } = useViewportDisplaySets(viewportId);
  const [measurementSelected, setMeasurementSelected] = useState(0);
  const isSRDisplaySet = viewportDisplaySets.some(displaySet => displaySet?.Modality === 'SR');
  const cornerstoneViewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);

  // Get segmentation information
  const { segmentationsWithRepresentations } = useViewportSegmentations({
    viewportId,
  });

  const hasSegmentations = segmentationsWithRepresentations.length > 0;

  // prefer segment navigation if available
  const navigationMode = hasSegmentations
    ? 'segment'
    : isSRDisplaySet
      ? 'measurement'
      : isTracked
        ? 'measurement'
        : null;

  const handleMeasurementNavigation = useCallback(
    (direction: number) => {
      const measurementDisplaySet = viewportDisplaySets.find(
        displaySet => displaySet?.Modality === 'SR'
      );

      if (measurementDisplaySet) {
        const measurements = measurementDisplaySet.measurements;
        if (measurements.length <= 0) {
          return;
        }

        const newIndex = getNextIndex(measurementSelected, direction, measurements.length);
        setMeasurementSelected(newIndex);

        const measurement = measurements[newIndex];
        cornerstoneViewport.setViewReference({
          referencedImageId: measurement.imageId,
        });
        return;
      }

      if (isTracked && trackedMeasurementUIDs.length > 0) {
        const newIndex = getNextIndex(
          measurementSelected,
          direction,
          trackedMeasurementUIDs.length
        );
        setMeasurementSelected(newIndex);
        measurementService.jumpToMeasurement(viewportId, trackedMeasurementUIDs[newIndex]);
      }
    },
    [
      viewportId,
      cornerstoneViewport,
      measurementSelected,
      measurementService,
      isTracked,
      trackedMeasurementUIDs,
      viewportDisplaySets,
    ]
  );

  const handleSegmentNavigation = useCallback(
    (direction: number) => {
      if (!segmentationsWithRepresentations.length) {
        return;
      }

      const segmentationId = segmentationsWithRepresentations[0].segmentation.segmentationId;

      utils.handleSegmentChange({
        direction,
        segmentationId,
        viewportId,
        selectedSegmentObjectIndex: 0,
        segmentationService,
      });
    },
    [segmentationsWithRepresentations, viewportId, segmentationService]
  );

  // Handle navigation between segments/measurements
  const handleNavigate = useCallback(
    (direction: number) => {
      if (navigationMode === 'segment') {
        handleSegmentNavigation(direction);
      } else if (navigationMode === 'measurement') {
        handleMeasurementNavigation(direction);
      }
    },
    [navigationMode, handleSegmentNavigation, handleMeasurementNavigation]
  );

  // Extension length control for instrument projection mode
  const [extensionLength, setExtensionLength] = useState(50); // Default 50mm (5cm)
  const [isInstrumentProjectionMode, setIsInstrumentProjectionMode] = useState(false);

  // Check if instrument projection mode is active
  useEffect(() => {
    const checkMode = () => {
      if ((window as any).__navigationController) {
        const currentMode = (window as any).__navigationController.getNavigationMode();
        const isActive = currentMode === 'instrument-projection';
        setIsInstrumentProjectionMode(isActive);

        if (isActive) {
          const modeInstance = (window as any).__navigationController.getInstrumentProjectionMode();
          if (modeInstance) {
            const currentLength = modeInstance.getExtensionLength();
            setExtensionLength(currentLength);
          }
        }
      }
    };

    checkMode();
    // Check periodically in case mode changes
    const interval = setInterval(checkMode, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle extension length change
  const handleExtensionLengthChange = useCallback((value: number) => {
    setExtensionLength(value);
    if ((window as any).__navigationController) {
      const modeInstance = (window as any).__navigationController.getInstrumentProjectionMode();
      if (modeInstance) {
        modeInstance.setExtensionLength(value);
        console.log(`📏 Extension length set to: ${value}mm (${value / 10}cm)`);
      }
    }
  }, []);

  // Only render if we have a navigation mode
  if (!navigationMode) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <ViewportActionArrows
        onArrowsClick={handleNavigate}
        className="h-6"
      />

      {/* Extension Length Control for Instrument Projection Mode */}
      {isInstrumentProjectionMode && (
        <div className="flex flex-col gap-1 mt-2 p-2 bg-gray-800 rounded border border-gray-700">
          <label className="text-xs text-gray-300 font-medium">
            Extension Length (mm)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="10"
              max="500"
              step="5"
              value={extensionLength}
              onChange={(e) => handleExtensionLengthChange(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <input
              type="number"
              min="10"
              max="500"
              step="5"
              value={extensionLength}
              onChange={(e) => handleExtensionLengthChange(Number(e.target.value))}
              className="w-16 px-2 py-1 text-sm text-white bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
            />
            <span className="text-xs text-gray-400 w-8">
              {extensionLength / 10}cm
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Calculate the next index with circular navigation support
 * @param currentIndex Current index position
 * @param direction Direction of movement (1 for next, -1 for previous)
 * @param totalItems Total number of items to navigate through
 * @returns The next index with wrap-around support
 */
function getNextIndex(currentIndex: number, direction: number, totalItems: number): number {
  if (totalItems <= 0) {
    return 0;
  }

  // Use modulo to handle circular navigation
  let nextIndex = (currentIndex + direction) % totalItems;

  // Handle negative index when going backwards from index 0
  if (nextIndex < 0) {
    nextIndex = totalItems - 1;
  }

  return nextIndex;
}

export default NavigationComponent;
