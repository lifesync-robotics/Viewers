/**
 * TrackingPanelLayout - UI Layout Component for Tracking Panel
 *
 * This component contains all the UI rendering logic for the tracking panel,
 * separated from the business logic in TrackingPanel.tsx for better maintainability.
 */

import React from 'react';
import TrackingConfigDialog from './TrackingConfigDialog';

interface PatientReferenceStatus {
  id: string;
  name: string | null;
  visible: boolean;
  quality: number;
  moved: boolean;
  movement_mm: number;
}

interface ToolTrackingData {
  tool_name?: string;
  visible: boolean;
  quality: string;
  quality_score: number;
  is_patient_reference: boolean;
  quaternion?: [number, number, number, number];
  delta_position_mm?: number;
  delta_rotation_deg?: number;
  rom_file?: string;
  coordinates: {
    tracker: {
      position_mm: [number, number, number];
      rotation_deg: [number, number, number];
    };
    patient_reference: {
      position_mm: [number, number, number];
      rotation_deg: [number, number, number];
    };
  };
}

interface TrackingFrame {
  type: string;
  patient_reference: PatientReferenceStatus;
  tools: {
    [toolId: string]: ToolTrackingData;
  };
  timestamp: string;
  frame_number: number;
}

interface TrackingConfig {
  config_id?: string;
  name?: string;
  description?: string;
  settings?: {
    tracking_mode?: 'simulation' | 'hardware';
  };
}

interface TrackingPanelLayoutProps {
  // State
  config: TrackingConfig | null;
  status: any | null;
  trackingFrame: TrackingFrame | null;
  loading: boolean;
  error: string | null;
  isNavigating: boolean;
  selectedToolId: string | null;
  availableConfigs: any[];
  selectedConfigId: string | null;
  currentTrackingConfig: any;
  configDialogOpen: boolean;
  coordinateSystem: 'tracker' | 'patient_reference';
  isRealTimeDistanceEnabled: boolean;
  alerts: Array<{id: string; message: string; severity: string; timestamp: string}>;
  navigationMode: 'camera-follow' | 'instrument-projection';

  // Handlers
  handleStartNavigation: () => void;
  handleStopNavigation: () => void;
  handleSetCenter: () => void;
  handleOpenConfigDialog: () => void;
  handleCloseConfigDialog: () => void;
  handleConfigSaved: (config: any) => void;
  handleConfigApplied: (config: any) => void;
  loadSpecificConfig: (configId: string) => void;
  setSelectedToolId: (toolId: string | null) => void;
  setSelectedConfigId: (configId: string | null) => void;
  setAlerts: React.Dispatch<React.SetStateAction<Array<{id: string; message: string; severity: string; timestamp: string}>>>;
  setNavigationMode: (mode: 'camera-follow' | 'instrument-projection') => void;
  trackingService: any;
  onToggleRealTimeDistance: (enabled: boolean) => void;
}

const TrackingPanelLayout: React.FC<TrackingPanelLayoutProps> = ({
  config,
  status,
  trackingFrame,
  loading,
  error,
  isNavigating,
  selectedToolId,
  availableConfigs,
  selectedConfigId,
  currentTrackingConfig,
  configDialogOpen,
  coordinateSystem,
  isRealTimeDistanceEnabled,
  alerts,
  navigationMode,
  handleStartNavigation,
  handleStopNavigation,
  handleSetCenter,
  handleOpenConfigDialog,
  handleCloseConfigDialog,
  handleConfigSaved,
  handleConfigApplied,
  loadSpecificConfig,
  setSelectedToolId,
  setSelectedConfigId,
  setAlerts,
  setNavigationMode,
  trackingService,
  onToggleRealTimeDistance,
}) => {
  const identityMatrix = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ];

  // Matrix UI state - now managed locally in the layout component
  const [matricesExpanded, setMatricesExpanded] = React.useState(false);
  const [matricesApplied, setMatricesApplied] = React.useState(true); // Mark as applied since it's managed by service

  // Derive matrices from TrackingService for display
  const prToDicomMatrix = trackingService ? trackingService.getPrToDicomMatrix() : identityMatrix;
  const markerToTooltipMatrix = trackingService ? trackingService.getMarkerToTooltipMatrix() : identityMatrix;

  // Local editable state for matrix inputs (separate from service state)
  const [editablePrToDicomMatrix, setEditablePrToDicomMatrix] = React.useState<number[][]>(
    prToDicomMatrix.map(row => [...row])
  );
  const [editableMarkerToTooltipMatrix, setEditableMarkerToTooltipMatrix] = React.useState<number[][]>(
    markerToTooltipMatrix.map(row => [...row])
  );

  // String representations for input fields - maintained separately to allow intermediate input states
  const [prToDicomMatrixInput, setPrToDicomMatrixInput] = React.useState<string[][]>(
    prToDicomMatrix.map(row => row.map(val => val.toString()))
  );
  const [markerToTooltipMatrixInput, setMarkerToTooltipMatrixInput] = React.useState<string[][]>(
    markerToTooltipMatrix.map(row => row.map(val => val.toString()))
  );

  // Sync editable matrices when service matrices change
  React.useEffect(() => {
    setEditablePrToDicomMatrix(prToDicomMatrix.map(row => [...row]));
    setEditableMarkerToTooltipMatrix(markerToTooltipMatrix.map(row => [...row]));
    setPrToDicomMatrixInput(prToDicomMatrix.map(row => row.map(val => val.toString())));
    setMarkerToTooltipMatrixInput(markerToTooltipMatrix.map(row => row.map(val => val.toString())));
  }, [prToDicomMatrix, markerToTooltipMatrix]);

  const primaryButtonLabel = !selectedConfigId
    ? 'Select Configuration'
    : !currentTrackingConfig
      ? 'Load Configuration'
      : isNavigating
        ? 'Stop Navigation'
        : 'Start Navigation';

  const primaryButtonAction = () => {
    if (!selectedConfigId) {
      handleOpenConfigDialog();
      return;
    }
    if (!currentTrackingConfig) {
      if (selectedConfigId) {
        loadSpecificConfig(selectedConfigId);
      }
      return;
    }
    if (isNavigating) {
      handleStopNavigation();
      return;
    }
    handleStartNavigation();
  };

  const primaryButtonDisabled =
    (!selectedConfigId) ||
    (!!currentTrackingConfig && !isNavigating && (!trackingService || !window.commandsManager)) ||
    (selectedConfigId && !currentTrackingConfig && loading);

  const primaryButtonClass = !currentTrackingConfig
    ? 'bg-blue-600 hover:bg-blue-700'
    : isNavigating
      ? 'bg-red-600 hover:bg-red-700'
      : 'bg-green-600 hover:bg-green-700';

  return (
    <div className="h-full overflow-hidden bg-black p-4">
      <div className="h-full overflow-auto">
        <h2 className="text-2xl font-bold text-white mb-4">Navigation Control</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded text-red-200">
            ⚠️ {error}
          </div>
        )}

        {loading && (
          <div className="mb-4 text-center text-secondary-light">
            Loading...
          </div>
        )}

        {/* Simplified Workflow Info */}
        {availableConfigs.length === 0 && !loading && (
          <div className="mb-4 p-3 bg-blue-900 border border-blue-700 rounded">
            <div className="flex items-start gap-2">
              <span className="text-lg">💡</span>
              <div className="flex-1">
                <div className="text-blue-200 text-sm font-medium mb-1">Simplified Workflow</div>
                <div className="text-xs text-blue-300">
                  No configurations available. Click "Select Configuration" to create and save your first tracking setup.
                  Each configuration includes tracking mode (simulation/hardware) and all tool settings.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phase 4: Alerts */}
        {alerts.length > 0 && (
          <div className="mb-4 space-y-2">
            {alerts.map(alert => (
              <div
                key={alert.id}
                className={`p-3 rounded border ${
                  alert.severity === 'high'
                    ? 'bg-red-900 border-red-700 text-red-200'
                    : alert.severity === 'warning'
                      ? 'bg-yellow-900 border-yellow-700 text-yellow-200'
                      : 'bg-blue-900 border-blue-700 text-blue-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium">
                      {alert.severity === 'high' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️'} {alert.message}
                    </div>
                    <div className="text-xs mt-1 opacity-75">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <button
                    onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}
                    className="ml-2 text-white opacity-50 hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Phase 4: Patient Reference Status */}
        {trackingFrame && trackingFrame.patient_reference && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">Patient Reference</h3>
            <div className={`p-3 rounded border ${
              !trackingFrame.patient_reference.visible
                ? 'bg-red-900 border-red-700'
                : trackingFrame.patient_reference.moved
                  ? 'bg-yellow-900 border-yellow-700'
                  : 'bg-green-900 border-green-700'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-white font-mono text-lg font-bold">
                    <span>{trackingFrame.patient_reference.visible ? '🟢' : '🔴'}</span>
                    <span>{trackingFrame.patient_reference.id?.toUpperCase() || 'PR'}</span>
                  </div>
                  {trackingFrame.patient_reference.name && (
                    <div className="text-xs text-gray-400 mt-1">
                      {trackingFrame.patient_reference.name}
                    </div>
                  )}
                </div>
                <div className="text-right text-xs text-gray-200 space-y-1 font-mono">
                  <div>Quality: {(trackingFrame.patient_reference.quality * 100).toFixed(0)}%</div>
                  <div className={trackingFrame.patient_reference.moved ? 'text-yellow-200 font-semibold' : ''}>
                    Move: {trackingFrame.patient_reference.movement_mm.toFixed(2)} mm {trackingFrame.patient_reference.moved ? '⚠️' : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Registration Matrices */}
        <div className="mb-6">
          <div
            className="flex items-center justify-between mb-3 cursor-pointer p-2 rounded hover:bg-gray-800 transition-colors"
            onClick={() => setMatricesExpanded(!matricesExpanded)}
          >
            <h3 className="text-lg font-semibold text-white">🔧 Registration Matrices</h3>
            <div className="flex items-center gap-2">
              {matricesApplied && (
                <span className="text-xs text-green-400 font-medium">✅ Applied</span>
              )}
              <span className="text-gray-400 text-sm">{matricesExpanded ? '▼' : '▶'}</span>
            </div>
          </div>

          {matricesExpanded && (
            <div className="p-4 bg-gray-900 border border-gray-700 rounded space-y-4">
              <div className="text-xs text-gray-400 mb-3">
                Configure the transformation pipeline: Marker Array → Tooltip → DICOM Space
              </div>

              {/* PR to DICOM Matrix */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-300 font-medium">PR to DICOM Matrix (Registration)</label>
                  <button
                    onClick={() => {
                      const identity = identityMatrix.map(row => [...row]);
                      setEditablePrToDicomMatrix(identity);
                      setPrToDicomMatrixInput(identity.map(row => row.map(val => val.toString())));
                      setMatricesApplied(false);
                    }}
                    className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                  >
                    Reset to Identity
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {prToDicomMatrixInput.map((row, i) =>
                    row.map((val, j) => (
                      <input
                        key={`prdicom-${i}-${j}`}
                        type="text"
                        value={val}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          
                          // Allow intermediate input states for negative numbers and decimals
                          // Valid patterns: empty, "-", ".", "-.", valid numbers, partial numbers like "1.", "-1.", "-.5"
                          const isValidPartialInput = 
                            inputValue === '' || 
                            inputValue === '-' || 
                            inputValue === '.' || 
                            inputValue === '-.' ||
                            /^-?\d*\.?\d*$/.test(inputValue);
                          
                          if (isValidPartialInput) {
                            // Update string input immediately
                            const newInputMatrix = prToDicomMatrixInput.map(r => [...r]);
                            newInputMatrix[i][j] = inputValue;
                            setPrToDicomMatrixInput(newInputMatrix);
                            
                            // Update numeric matrix only if we have a valid complete number
                            const parsed = parseFloat(inputValue);
                            if (!isNaN(parsed)) {
                              const newMatrix = editablePrToDicomMatrix.map(r => [...r]);
                              newMatrix[i][j] = parsed;
                              setEditablePrToDicomMatrix(newMatrix);
                            }
                            
                            setMatricesApplied(false);
                          }
                        }}
                        onBlur={(e) => {
                          // On blur, ensure we have a valid number and clean up the display
                          const parsed = parseFloat(e.target.value);
                          const finalValue = isNaN(parsed) ? 0 : parsed;
                          
                          // Update both numeric matrix and string input
                          const newMatrix = editablePrToDicomMatrix.map(r => [...r]);
                          newMatrix[i][j] = finalValue;
                          setEditablePrToDicomMatrix(newMatrix);
                          
                          const newInputMatrix = prToDicomMatrixInput.map(r => [...r]);
                          newInputMatrix[i][j] = finalValue.toString();
                          setPrToDicomMatrixInput(newInputMatrix);
                        }}
                        className="w-full px-1 py-1 text-xs font-mono text-white bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Marker to Tooltip Matrix (Calibration) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-300 font-medium">Marker to Tooltip Matrix (Calibration)</label>
                  <button
                    onClick={() => {
                      const identity = identityMatrix.map(row => [...row]);
                      setEditableMarkerToTooltipMatrix(identity);
                      setMarkerToTooltipMatrixInput(identity.map(row => row.map(val => val.toString())));
                      setMatricesApplied(false);
                    }}
                    className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                  >
                    Reset to Identity
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {markerToTooltipMatrixInput.map((row, i) =>
                    row.map((val, j) => (
                      <input
                        key={`marker-${i}-${j}`}
                        type="text"
                        value={val}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          
                          // Allow intermediate input states for negative numbers and decimals
                          // Valid patterns: empty, "-", ".", "-.", valid numbers, partial numbers like "1.", "-1.", "-.5"
                          const isValidPartialInput = 
                            inputValue === '' || 
                            inputValue === '-' || 
                            inputValue === '.' || 
                            inputValue === '-.' ||
                            /^-?\d*\.?\d*$/.test(inputValue);
                          
                          if (isValidPartialInput) {
                            // Update string input immediately
                            const newInputMatrix = markerToTooltipMatrixInput.map(r => [...r]);
                            newInputMatrix[i][j] = inputValue;
                            setMarkerToTooltipMatrixInput(newInputMatrix);
                            
                            // Update numeric matrix only if we have a valid complete number
                            const parsed = parseFloat(inputValue);
                            if (!isNaN(parsed)) {
                              const newMatrix = editableMarkerToTooltipMatrix.map(r => [...r]);
                              newMatrix[i][j] = parsed;
                              setEditableMarkerToTooltipMatrix(newMatrix);
                            }
                            
                            setMatricesApplied(false);
                          }
                        }}
                        onBlur={(e) => {
                          // On blur, ensure we have a valid number and clean up the display
                          const parsed = parseFloat(e.target.value);
                          const finalValue = isNaN(parsed) ? 0 : parsed;
                          
                          // Update both numeric matrix and string input
                          const newMatrix = editableMarkerToTooltipMatrix.map(r => [...r]);
                          newMatrix[i][j] = finalValue;
                          setEditableMarkerToTooltipMatrix(newMatrix);
                          
                          const newInputMatrix = markerToTooltipMatrixInput.map(r => [...r]);
                          newInputMatrix[i][j] = finalValue.toString();
                          setMarkerToTooltipMatrixInput(newInputMatrix);
                        }}
                        className="w-full px-1 py-1 text-xs font-mono text-white bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Apply Button */}
              <button
                onClick={() => {
                  if (trackingService) {
                    trackingService.setPrToDicomMatrix(editablePrToDicomMatrix);
                    trackingService.setMarkerToTooltipMatrix(editableMarkerToTooltipMatrix);
                    setMatricesApplied(true);
                    console.log('✅ Transformation matrices applied to TrackingService:', {
                      prToDicom: editablePrToDicomMatrix,
                      markerToTooltip: editableMarkerToTooltipMatrix
                    });
                  }
                }}
                disabled={!trackingService}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:opacity-50 text-white rounded font-medium transition-colors text-sm"
              >
                Apply Matrices
              </button>

              {!matricesApplied && (
                <div className="text-xs text-yellow-400 text-center">
                  ⚠️ Changes not applied yet - click "Apply Matrices"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Phase 4: Real-time Tool Tracking */}
        {trackingFrame && trackingFrame.tools && Object.keys(trackingFrame.tools).length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">Tool Coordinates</h3>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <input
                id="tracking-distance-live-toggle"
                type="checkbox"
                checked={isRealTimeDistanceEnabled}
                onChange={(e) => onToggleRealTimeDistance(e.target.checked)}
                className="h-4 w-4 text-blue-500 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="tracking-distance-live-toggle" className="text-sm text-gray-200 select-none">
                Real-time distance updates
              </label>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {Object.entries(trackingFrame.tools)
                .filter(([toolId, toolData]) => !toolData.is_patient_reference)  // 🆕 过滤掉 Patient Reference
                .map(([toolId, toolData]) => {
                const coords = toolData.coordinates[coordinateSystem];
                const isSelected = selectedToolId === toolId;
                return (
                  <div
                    key={toolId}
                    onClick={() => {
                      if (toolData.visible) {
                        setSelectedToolId(toolId);
                        trackingService.setSelectedTool(toolId);
                        // console.log(`🎯 Selected tool for visualization: ${toolId}`);
                      }
                    }}
                    className={`p-3 rounded border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-900 border-blue-500 ring-2 ring-blue-400'
                        : toolData.visible
                          ? 'bg-gray-800 border-gray-600 hover:bg-gray-700'
                          : 'bg-gray-900 border-gray-700 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="text-white font-medium font-mono">
                          {toolData.visible ? (toolData.is_patient_reference ? '✅' : '🎯') : '❌'} {toolId.toUpperCase()}
                        </div>
                        {isSelected && (
                          <div className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">
                            VISUALIZED
                          </div>
                        )}
                      </div>
                      <div className={`text-xs font-mono ${
                        toolData.visible ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {toolData.visible ? '● Visible' : '● Hidden'}
                      </div>
                    </div>

                    {toolData.visible && coords && (
                      <div className="space-y-1 text-xs font-mono">
                        {/* Position */}
                        <div className="flex justify-between text-gray-300">
                          <span>Pos (mm):</span>
                          <span className="text-blue-300">
                            [{coords.position_mm[0].toFixed(1).padStart(7)}, {coords.position_mm[1].toFixed(1).padStart(7)}, {coords.position_mm[2].toFixed(1).padStart(7)}]
                          </span>
                        </div>

                        {/* Quaternion (w, x, y, z) */}
                        {toolData.quaternion && (
                          <div className="flex justify-between text-gray-300">
                            <span>Quat:</span>
                            <span className="text-purple-300">
                              [{toolData.quaternion[0] >= 0 ? '+' : ''}{toolData.quaternion[0].toFixed(3)},
                              {toolData.quaternion[1] >= 0 ? '+' : ''}{toolData.quaternion[1].toFixed(3)},
                              {toolData.quaternion[2] >= 0 ? '+' : ''}{toolData.quaternion[2].toFixed(3)},
                              {toolData.quaternion[3] >= 0 ? '+' : ''}{toolData.quaternion[3].toFixed(3)}]
                            </span>
                          </div>
                        )}

                        {/* Quality */}
                        <div className="flex justify-between text-gray-300">
                          <span>Q:</span>
                          <span className={
                            toolData.quality_score > 0.8 ? 'text-green-400' :
                            toolData.quality_score > 0.5 ? 'text-yellow-400' : 'text-red-400'
                          }>
                            {toolData.quality_score.toFixed(3)}
                          </span>
                        </div>

                        {/* Delta (frame-to-frame changes) */}
                        {(toolData.delta_position_mm !== undefined || toolData.delta_rotation_deg !== undefined) && (
                          <div className="flex justify-between text-gray-300">
                            <span>Δ:</span>
                            <span className="text-orange-300">
                              {(toolData.delta_position_mm || 0).toFixed(2)}mm, {(toolData.delta_rotation_deg || 0).toFixed(2)}°
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Not Found - Show ROM file */}
                    {!toolData.visible && toolData.rom_file && (
                      <div className="text-xs text-red-400 font-mono mt-2">
                        ❌ NOT FOUND (ROM: {toolData.rom_file})
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* Mode Selection - REMOVED: Now controlled by configuration only */}

        {/* Actions */}
        <div className="space-y-3">
          {/* Navigation Mode Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-white mb-3">Navigation Mode</label>
            <div className="space-y-2">
              {/* Camera Following Mode */}
              <label
                className={`flex items-start p-3 rounded border cursor-pointer transition-all ${
                  navigationMode === 'camera-follow'
                    ? 'bg-blue-900 border-blue-500 ring-2 ring-blue-400'
                    : 'bg-gray-800 border-gray-600 hover:border-gray-500'
                }`}
              >
                <input
                  type="radio"
                  name="navigationMode"
                  value="camera-follow"
                  checked={navigationMode === 'camera-follow'}
                  onChange={(e) => setNavigationMode(e.target.value as 'camera-follow')}
                  disabled={isNavigating}
                  className="mt-1 h-4 w-4 text-blue-500 bg-gray-700 border-gray-600 focus:ring-blue-500"
                />
                <div className="ml-3 flex-1">
                  <div className="text-white font-medium">Camera Following Mode</div>
                  <div className="text-xs text-gray-400 mt-1">
                    6-DOF tracking - Camera follows tool movement and rotation
                  </div>
                </div>
                {navigationMode === 'camera-follow' && (
                  <div className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded">
                    Active
                  </div>
                )}
              </label>

              {/* Instrument Projection Mode */}
              <label
                className={`flex items-start p-3 rounded border cursor-pointer transition-all ${
                  navigationMode === 'instrument-projection'
                    ? 'bg-blue-900 border-blue-500 ring-2 ring-blue-400'
                    : 'bg-gray-800 border-gray-600 hover:border-gray-500'
                }`}
              >
                <input
                  type="radio"
                  name="navigationMode"
                  value="instrument-projection"
                  checked={navigationMode === 'instrument-projection'}
                  onChange={(e) => setNavigationMode(e.target.value as 'instrument-projection')}
                  disabled={isNavigating}
                  className="mt-1 h-4 w-4 text-blue-500 bg-gray-700 border-gray-600 focus:ring-blue-500"
                />
                <div className="ml-3 flex-1">
                  <div className="text-white font-medium">Instrument Projection Mode</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Displays instrument projection at tool position
                  </div>
                </div>
                {navigationMode === 'instrument-projection' && (
                  <div className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded">
                    Active
                  </div>
                )}
              </label>
            </div>
            {isNavigating && (
              <div className="text-xs text-yellow-400 mt-2">
                ⚠️ Navigation mode cannot be changed while navigation is active
              </div>
            )}
          </div>

          {/* Configuration Selection */}
          {availableConfigs.length > 0 ? (
            <div>
              <label className="block text-sm font-medium text-white mb-2">Select Configuration</label>
              <select
                value={selectedConfigId || ''}
                onChange={(e) => {
                  const configId = e.target.value;
                  setSelectedConfigId(configId);
                  if (configId) {
                    loadSpecificConfig(configId);
                  }
                }}
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                disabled={loading}
              >
                <option value="">Select a configuration...</option>
                {availableConfigs.map((config) => (
                  <option key={config.config_id || config.name} value={config.config_id || config.name}>
                    {config.name} {config.settings?.tracking_mode === 'simulation' ? '(SIM)' : '(HW)'}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="p-3 bg-yellow-900 border border-yellow-700 rounded">
              <div className="text-yellow-200 text-sm">
                ⚠️ No configurations available
              </div>
              <div className="text-xs text-yellow-300 mt-1">
                Please create and save configurations using the "Select Configuration" button below
              </div>
            </div>
          )}

          {/* Current Configuration Display */}
          {currentTrackingConfig ? (
            <button
              type="button"
              onClick={handleOpenConfigDialog}
              className="w-full text-left p-3 bg-gray-800 border border-gray-600 rounded hover:border-blue-500 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-xs text-gray-400">Active Configuration (click to manage)</div>
                  <div className="text-white font-medium">{currentTrackingConfig.name}</div>
                  {currentTrackingConfig.description && (
                    <div className="text-xs text-gray-500 mt-1">{currentTrackingConfig.description}</div>
                  )}
                </div>
                <div className={`text-xs px-2 py-1 rounded ${
                  currentTrackingConfig.settings?.tracking_mode === 'simulation'
                    ? 'bg-blue-900 text-blue-300'
                    : 'bg-green-900 text-green-300'
                }`}>
                  {currentTrackingConfig.settings?.tracking_mode === 'simulation' ? '🖥️ SIM' : '🔧 HW'}
                </div>
              </div>
            </button>
          ) : selectedConfigId ? (
            <div className="p-3 bg-orange-900 border border-orange-700 rounded">
              <div className="text-orange-200 text-sm">
                ⚠️ Configuration selected but not loaded
              </div>
              <div className="text-xs text-orange-300 mt-1">
                Click "Load Configuration" to apply the selected configuration
              </div>
            </div>
          ) : null}

          <button
            onClick={primaryButtonAction}
            disabled={primaryButtonDisabled}
            className={`w-full p-3 ${primaryButtonClass} disabled:bg-gray-700 disabled:opacity-50 text-white rounded font-medium transition-colors flex items-center justify-center gap-2`}
          >
            <span className="text-lg">
              {!selectedConfigId ? '⚙️' : !currentTrackingConfig ? '📥' : isNavigating ? '⏹️' : '▶️'}
            </span>
            <span>{primaryButtonLabel}</span>
            {currentTrackingConfig && !isNavigating && (
              <span className="text-xs opacity-75">
                ({currentTrackingConfig.settings?.tracking_mode === 'simulation' ? 'SIM' : 'HW'})
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Phase 7: Tracking Configuration Dialog */}
      <TrackingConfigDialog
        open={configDialogOpen}
        onClose={handleCloseConfigDialog}
        onConfigurationSaved={handleConfigSaved}
        onConfigurationApplied={handleConfigApplied}
      />
    </div>
  );
};

export default TrackingPanelLayout;
