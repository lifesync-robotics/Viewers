/**
 * ROI Selection Panel
 *
 * User interface for defining Region of Interest using rectangle annotations.
 * User draws rectangles on coronal and sagittal views, then zooms to the ROI.
 */

import React, { useState, useEffect } from 'react';
import { SelectionMode, ROI3DBounds } from '../../services/ROISelectionService/types';
import { ROI_SELECTION_EVENTS } from '../../services/ROISelectionService/types';

interface ROIPanelProps {
  servicesManager: any;
  commandsManager: any;
  extensionManager: any;
}

const ROIPanel: React.FC<ROIPanelProps> = ({ servicesManager }) => {
  const [status, setStatus] = useState<SelectionMode>('idle');
  const [hasCoronal, setHasCoronal] = useState(false);
  const [hasSagittal, setHasSagittal] = useState(false);
  const [worldBounds, setWorldBounds] = useState<ROI3DBounds | null>(null);

  const roiSelectionService = servicesManager.services.roiSelectionService;

  useEffect(() => {
    if (!roiSelectionService) {
      console.error('ROISelectionService not available');
      return;
    }

    const subscriptions: any[] = [];

    // Selection started
    subscriptions.push(
      roiSelectionService.subscribe(ROI_SELECTION_EVENTS.SELECTION_STARTED, (data: any) => {
        setStatus('selecting');
        setHasCoronal(false);
        setHasSagittal(false);
        setWorldBounds(null);
        console.log('ROI selection started');
      })
    );

    // Rectangle updated
    subscriptions.push(
      roiSelectionService.subscribe(ROI_SELECTION_EVENTS.RECTANGLE_UPDATED, (data: any) => {
        if (data.coronalRect) {
          setHasCoronal(true);
        }
        if (data.sagittalRect) {
          setHasSagittal(true);
        }
        if (data.worldBounds) {
          setWorldBounds(data.worldBounds);
        }
      })
    );

    // Bounds updated
    subscriptions.push(
      roiSelectionService.subscribe(ROI_SELECTION_EVENTS.BOUNDS_UPDATED, (data: any) => {
        if (data.worldBounds) {
          setWorldBounds(data.worldBounds);
        }
      })
    );

    // Selection confirmed
    subscriptions.push(
      roiSelectionService.subscribe(ROI_SELECTION_EVENTS.SELECTION_CONFIRMED, (data: any) => {
        setStatus('confirmed');
        if (data.worldBounds) {
          setWorldBounds(data.worldBounds);
        }
      })
    );

    // ROI applied (camera zoomed)
    subscriptions.push(
      roiSelectionService.subscribe(ROI_SELECTION_EVENTS.ROI_APPLIED, (data: any) => {
        setStatus('applied');
      })
    );

    // ROI reset
    subscriptions.push(
      roiSelectionService.subscribe(ROI_SELECTION_EVENTS.ROI_RESET, () => {
        setStatus('idle');
        setHasCoronal(false);
        setHasSagittal(false);
        setWorldBounds(null);
      })
    );

    // Cleanup
    return () => {
      subscriptions.forEach(sub => {
        if (typeof sub === 'function') {
          sub();
        } else if (sub && typeof sub.unsubscribe === 'function') {
          sub.unsubscribe();
        }
      });
    };
  }, [roiSelectionService]);

  const handleStartSelection = () => {
    roiSelectionService.startSelection();
  };

  const handleConfirm = () => {
    roiSelectionService.confirmSelection();
  };

  const handleReset = () => {
    roiSelectionService.reset();
  };

  const canZoom = hasCoronal && hasSagittal;

  return (
    <div className="p-4 bg-gray-900 text-white min-h-full">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-bold mb-2">ROI Selection</h2>
        <StatusBadge status={status} />
      </div>

      {/* Instructions */}
      <div className="mb-4 p-3 bg-gray-800 rounded text-sm">
        <p className="font-semibold mb-2">📍 Instructions:</p>
        <ol className="list-decimal list-inside space-y-1 text-gray-300">
          <li>Click "Start ROI Selection"</li>
          <li>Draw a rectangle on <span className="text-yellow-400">Coronal</span> view</li>
          <li>Draw a rectangle on <span className="text-blue-400">Sagittal</span> view</li>
          <li>Click "Zoom to ROI" when ready</li>
        </ol>
        <p className="text-xs text-gray-500 mt-2">
          💡 Click and drag to draw rectangles on the views
        </p>
      </div>

      {/* Rectangle Status */}
      {status === 'selecting' && (
        <div className="mb-4 p-3 bg-gray-800 rounded">
          <h3 className="text-sm font-semibold mb-2">Rectangle Status</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-yellow-400">Coronal:</span>
              {hasCoronal ? (
                <span className="text-green-400">✓ Drawn</span>
              ) : (
                <span className="text-gray-400">○ Waiting...</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-400">Sagittal:</span>
              {hasSagittal ? (
                <span className="text-green-400">✓ Drawn</span>
              ) : (
                <span className="text-gray-400">○ Waiting...</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* World Bounds */}
      {worldBounds && (
        <div className="mb-4 p-3 bg-gray-800 rounded">
          <h3 className="text-sm font-semibold mb-2">ROI 3D Bounds</h3>
          <div className="space-y-1 text-xs">
            <BoundsRow label="X" min={worldBounds.xMin} max={worldBounds.xMax} />
            <BoundsRow label="Y" min={worldBounds.yMin} max={worldBounds.yMax} />
            <BoundsRow label="Z" min={worldBounds.zMin} max={worldBounds.zMax} />
          </div>
          <div className="mt-2 pt-2 border-t border-gray-700 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Size:</span>
              <span>
                {(worldBounds.xMax - worldBounds.xMin).toFixed(0)} ×
                {(worldBounds.yMax - worldBounds.yMin).toFixed(0)} ×
                {(worldBounds.zMax - worldBounds.zMin).toFixed(0)} mm
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Applied Message */}
      {status === 'applied' && (
        <div className="mb-4 p-3 bg-green-900 bg-opacity-30 rounded">
          <p className="text-sm text-green-400 font-semibold">✅ Camera zoomed to ROI</p>
          <p className="text-xs text-gray-400 mt-1">
            Click "Reset" to restore the original view
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2">
        {status === 'idle' && (
          <button
            onClick={handleStartSelection}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded font-semibold transition-colors"
          >
            Start ROI Selection
          </button>
        )}

        {status === 'selecting' && (
          <>
            <button
              onClick={handleConfirm}
              disabled={!canZoom}
              className={`w-full py-2 px-4 rounded font-semibold transition-colors ${
                canZoom
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-600 cursor-not-allowed'
              }`}
            >
              {canZoom ? 'Zoom to ROI' : 'Draw both rectangles first'}
            </button>
            <button
              onClick={handleReset}
              className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-700 rounded font-semibold transition-colors"
            >
              Cancel
            </button>
          </>
        )}

        {(status === 'confirmed' || status === 'applied') && (
          <button
            onClick={handleReset}
            className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 rounded font-semibold transition-colors"
          >
            Reset View
          </button>
        )}
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: SelectionMode }> = ({ status }) => {
  const statusConfig = {
    idle: { label: 'Not Started', color: 'bg-gray-500' },
    selecting: { label: 'Draw Rectangles', color: 'bg-yellow-500' },
    confirmed: { label: 'Zooming...', color: 'bg-blue-500' },
    applied: { label: 'Zoomed to ROI', color: 'bg-green-500' },
  };

  const config = statusConfig[status] || statusConfig.idle;

  return (
    <span className={`${config.color} px-2 py-1 rounded text-xs text-white font-medium inline-block`}>
      {config.label}
    </span>
  );
};

const BoundsRow: React.FC<{ label: string; min: number; max: number }> = ({ label, min, max }) => (
  <div className="flex justify-between">
    <span className="text-gray-400">{label}:</span>
    <span>[{min.toFixed(1)}, {max.toFixed(1)}] mm</span>
  </div>
);

export default ROIPanel;
