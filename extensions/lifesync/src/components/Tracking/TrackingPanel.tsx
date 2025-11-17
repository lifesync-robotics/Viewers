/**
 * PanelTracking - Panel for tracking system configuration and control (Phase 4: Enhanced)
 *
 * This panel provides controls for:
 * - Switching between simulation/hardware tracking modes
 * - Enabling/disabling specific tracking tools
 * - Viewing tracking status and quality metrics
 * - Starting/stopping tracking sessions
 * - Patient reference status monitoring (Phase 4)
 * - Real-time tool coordinates display (Phase 4)
 * - Coordinate system toggle (tracker vs PR) (Phase 4)
 */

import React from 'react';
import { useSystem } from '@ohif/core';

interface TrackingConfig {
  version: string;
  tracking_mode: {
    current: string;
    type: string;
    options: string[];
  };
  active_tools: {
    [toolKey: string]: {
      asset_id: string;
      enabled: boolean;
      required?: boolean;
      description?: string;
    };
  };
  quality_thresholds: {
    min_quality_score: number;
  };
  patient_reference?: {
    asset_id: string;
    name: string;
    tool_id: string;
    movement_threshold_mm: number;
  };
  coordinate_output?: {
    primary: string;
    include_tracker_space: boolean;
    include_pr_space: boolean;
  };
}

interface TrackingStatus {
  connected: boolean;
  mode: string;
  tools: {
    [toolId: string]: {
      visible: boolean;
      quality_score: number;
      position: [number, number, number];
    };
  };
}

// Phase 4: Patient Reference Status
interface PatientReferenceStatus {
  id: string;
  visible: boolean;
  quality: number;
  moved: boolean;
  movement_mm: number;
}

// Phase 4: Tool Tracking Data
interface ToolTrackingData {
  visible: boolean;
  quality: string;
  quality_score: number;
  is_patient_reference: boolean;
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

// Phase 4: Real-time Tracking Frame
interface TrackingFrame {
  type: string;
  patient_reference: PatientReferenceStatus;
  tools: {
    [toolId: string]: ToolTrackingData;
  };
  timestamp: string;
  frame_number: number;
}

function PanelTracking() {
  const { servicesManager, commandsManager } = useSystem();
  const [config, setConfig] = React.useState<TrackingConfig | null>(null);
  const [status, setStatus] = React.useState<TrackingStatus | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Phase 4: Real-time tracking state
  const [trackingFrame, setTrackingFrame] = React.useState<TrackingFrame | null>(null);
  const [wsConnected, setWsConnected] = React.useState(false);
  const [coordinateSystem, setCoordinateSystem] = React.useState<'tracker' | 'patient_reference'>('patient_reference');
  const [alerts, setAlerts] = React.useState<Array<{id: string; message: string; severity: string; timestamp: string}>>([]);

  // Navigation state
  const [isNavigating, setIsNavigating] = React.useState(false);

  // Update rate tracking (Hz)
  const [updateHz, setUpdateHz] = React.useState<number>(0);
  const frameTimestampsRef = React.useRef<number[]>([]);

  // Get TrackingService
  const trackingService = servicesManager?.services?.trackingService;

  // Load tracking configuration
  const loadConfig = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Use relative URL if served through Nginx, otherwise localhost:3001
      const apiBase = window.location.port === '8081' ? '' : 'http://localhost:3001';
      const response = await fetch(`${apiBase}/api/tracking/config`);
      const result = await response.json();

      if (result.success) {
        setConfig(result.config);
      } else {
        setError('Failed to load tracking configuration');
      }
    } catch (err) {
      setError('Failed to connect to tracking service');
      console.error('Error loading tracking config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Switch tracking mode
  const switchMode = React.useCallback(async (mode: string) => {
    try {
      setLoading(true);
      const apiBase = window.location.port === '8081' ? '' : 'http://localhost:3001';
      const response = await fetch(`${apiBase}/api/tracking/mode`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });

      const result = await response.json();
      if (result.success) {
        // Update local config
        if (config) {
          setConfig({
            ...config,
            tracking_mode: { ...config.tracking_mode, current: mode }
          });
        }
        setError(null);
      } else {
        setError(result.error || 'Failed to switch mode');
      }
    } catch (err) {
      setError('Failed to switch tracking mode');
      console.error('Error switching mode:', err);
    } finally {
      setLoading(false);
    }
  }, [config]);

  // Toggle tool enable/disable
  const toggleTool = React.useCallback(async (toolKey: string, enabled: boolean) => {
    try {
      setLoading(true);
      const apiBase = window.location.port === '8081' ? '' : 'http://localhost:3001';
      const response = await fetch(`${apiBase}/api/tracking/tools/${toolKey}/enable`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });

      const result = await response.json();
      if (result.success) {
        // Update local config
        if (config) {
          setConfig({
            ...config,
            active_tools: {
              ...config.active_tools,
              [toolKey]: { ...config.active_tools[toolKey], enabled }
            }
          });
        }
        setError(null);
      } else {
        setError(result.error || 'Failed to update tool status');
      }
    } catch (err) {
      setError('Failed to update tool status');
      console.error('Error updating tool:', err);
    } finally {
      setLoading(false);
    }
  }, [config]);

  // Navigation handlers
  const handleStartNavigation = React.useCallback(async () => {
    try {
      console.log('🚀 Starting navigation from TrackingPanel...');
      console.log('  - TrackingService available:', !!trackingService);
      console.log('  - CommandsManager available:', !!commandsManager);

      if (!trackingService) {
        setError('TrackingService not available');
        return;
      }

      if (!commandsManager) {
        setError('CommandsManager not available');
        return;
      }

      // Start navigation (this will connect TrackingService automatically)
      await commandsManager.runCommand('startNavigation', { mode: 'circular' });
      setIsNavigating(true);
      console.log('✅ Navigation started successfully');

    } catch (error) {
      console.error('❌ Failed to start navigation:', error);
      setError(`Failed to start navigation: ${error.message}`);
    }
  }, [commandsManager, trackingService]);

  const handleStopNavigation = React.useCallback(() => {
    try {
      if (commandsManager) {
        commandsManager.runCommand('stopNavigation');
        setIsNavigating(false);
      }
    } catch (error) {
      console.error('Failed to stop navigation:', error);
      setError('Failed to stop navigation');
    }
  }, [commandsManager]);

  const handleSetCenter = React.useCallback(() => {
    try {
      if (commandsManager) {
        commandsManager.runCommand('setTrackingCenter');
      }
    } catch (error) {
      console.error('Failed to set center:', error);
      setError('Failed to set center');
    }
  }, [commandsManager]);

  // Subscribe to TrackingService events
  React.useEffect(() => {
    if (!trackingService) {
      console.warn('⚠️ TrackingService not available in TrackingPanel');
      return;
    }

    console.log('📡 TrackingPanel: Subscribing to TrackingService events');

    // Subscribe to connection status
    const connectionSub = trackingService.subscribe(
      'event::connection_status',
      (data) => {
        console.log('📡 TrackingPanel: Connection status:', data.connected);
        setWsConnected(data.connected);
      }
    );

    // Subscribe to tracking updates
    const trackingSub = trackingService.subscribe(
      'event::tracking_update',
      (data) => {
        // Calculate update Hz
        const now = Date.now();
        frameTimestampsRef.current.push(now);

        // Keep only last 2 seconds of timestamps
        const twoSecondsAgo = now - 2000;
        frameTimestampsRef.current = frameTimestampsRef.current.filter(t => t > twoSecondsAgo);

        // Calculate Hz (frames in last 2 seconds / 2)
        if (frameTimestampsRef.current.length > 1) {
          const hz = frameTimestampsRef.current.length / 2;
          setUpdateHz(Math.round(hz * 10) / 10); // Round to 1 decimal
        }

        // Update tracking frame
        setTrackingFrame({
          type: 'tracking_data',
          patient_reference: {
            id: data.patient_reference_id || '',
            visible: data.patient_reference_visible || false,
            quality: data.patient_reference_quality || 0,
            moved: data.patient_reference_moved || false,
            movement_mm: data.patient_reference_movement || 0
          },
          tools: data.tools || {},
          timestamp: data.timestamp || new Date().toISOString(),
          frame_number: data.frame_number || 0
        });

        // Log periodically (every 100th frame)
        if (data.frame_number % 100 === 0) {
          console.log('📊 TrackingPanel: Tracking data received:', {
            frame: data.frame_number,
            tools: Object.keys(data.tools || {}),
            hz: updateHz
          });
        }
      }
    );

    return () => {
      connectionSub?.unsubscribe();
      trackingSub?.unsubscribe();
    };
  }, [trackingService, updateHz]);

  // Load config on mount
  React.useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return (
    <div className="h-full overflow-hidden bg-black p-4">
      <div className="h-full overflow-auto">
        <h2 className="text-2xl font-bold text-white mb-4">Tracking Control</h2>

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
            <h3 className="text-lg font-semibold text-white mb-3">Patient Reference Status</h3>
            <div className={`p-4 rounded border ${
              !trackingFrame.patient_reference.visible
                ? 'bg-red-900 border-red-700'
                : trackingFrame.patient_reference.moved
                ? 'bg-yellow-900 border-yellow-700'
                : 'bg-green-900 border-green-700'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-white font-medium">
                  {trackingFrame.patient_reference.id?.toUpperCase() || 'PR'}
                </div>
                <div className={`text-sm font-medium ${
                  trackingFrame.patient_reference.visible ? 'text-green-300' : 'text-red-300'
                }`}>
                  {trackingFrame.patient_reference.visible ? '● Visible' : '● Not Visible'}
                </div>
              </div>

              {/* Quality Bar */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-300 mb-1">
                  <span>Quality</span>
                  <span>{(trackingFrame.patient_reference.quality * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      trackingFrame.patient_reference.quality > 0.8
                        ? 'bg-green-500'
                        : trackingFrame.patient_reference.quality > 0.5
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${trackingFrame.patient_reference.quality * 100}%` }}
                  />
                </div>
              </div>

              {/* Movement Status */}
              <div className="flex justify-between text-xs text-gray-300">
                <span>Movement</span>
                <span className={trackingFrame.patient_reference.moved ? 'text-red-300 font-bold' : ''}>
                  {trackingFrame.patient_reference.movement_mm.toFixed(2)} mm
                  {trackingFrame.patient_reference.moved && ' ⚠️ MOVED!'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Phase 4: Real-time Tool Tracking */}
        {trackingFrame && trackingFrame.tools && Object.keys(trackingFrame.tools).length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">Tool Coordinates</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCoordinateSystem('patient_reference')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    coordinateSystem === 'patient_reference'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  PR-Relative
                </button>
                <button
                  onClick={() => setCoordinateSystem('tracker')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    coordinateSystem === 'tracker'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Tracker
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {Object.entries(trackingFrame.tools).map(([toolId, toolData]) => {
                const coords = toolData.coordinates[coordinateSystem];
                return (
                  <div
                    key={toolId}
                    className={`p-3 rounded border ${
                      toolData.is_patient_reference
                        ? 'bg-purple-900 border-purple-700'
                        : toolData.visible
                        ? 'bg-gray-800 border-gray-600'
                        : 'bg-gray-900 border-gray-700 opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-white font-medium">
                        {toolId.toUpperCase()}
                        {toolData.is_patient_reference && ' 📍'}
                      </div>
                      <div className={`text-xs ${
                        toolData.visible ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {toolData.visible ? '● Visible' : '● Hidden'}
                      </div>
                    </div>

                    {toolData.visible && coords && (
                      <div className="space-y-1 text-xs font-mono">
                        <div className="flex justify-between text-gray-300">
                          <span>Position (mm):</span>
                          <span className="text-blue-300">
                            [{coords.position_mm[0].toFixed(1)}, {coords.position_mm[1].toFixed(1)}, {coords.position_mm[2].toFixed(1)}]
                          </span>
                        </div>
                        <div className="flex justify-between text-gray-300">
                          <span>Rotation (°):</span>
                          <span className="text-green-300">
                            [{coords.rotation_deg[0].toFixed(1)}, {coords.rotation_deg[1].toFixed(1)}, {coords.rotation_deg[2].toFixed(1)}]
                          </span>
                        </div>
                        <div className="flex justify-between text-gray-300">
                          <span>Quality:</span>
                          <span className={
                            toolData.quality_score > 0.8 ? 'text-green-400' :
                            toolData.quality_score > 0.5 ? 'text-yellow-400' : 'text-red-400'
                          }>
                            {(toolData.quality_score * 100).toFixed(0)}% ({toolData.quality})
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-2 text-xs text-gray-500 text-center">
              Frame #{trackingFrame.frame_number} • {wsConnected ? '🟢 Live' : '🔴 Disconnected'}
            </div>
          </div>
        )}

        {/* Mode Selection */}
        {config && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">Tracking Mode</h3>
            <div className="space-y-2">
              {config.tracking_mode.options.map(mode => (
                <button
                  key={mode}
                  onClick={() => switchMode(mode)}
                  disabled={loading}
                  className={`w-full p-3 rounded border transition-colors ${
                    config.tracking_mode.current === mode
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="capitalize">{mode}</span>
                    {config.tracking_mode.current === mode && (
                      <span className="text-green-400">● Active</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {mode === 'simulation' ? 'Use simulated tracking data' : 'Connect to NDI hardware'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tool Configuration */}
        {config && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">Tracking Tools</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {Object.entries(config.active_tools).map(([toolKey, tool]) => (
                <div
                  key={toolKey}
                  className={`p-3 rounded border transition-colors ${
                    tool.enabled
                      ? 'bg-green-900 border-green-700'
                      : 'bg-gray-800 border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-white font-medium">
                        {toolKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                      <div className="text-xs text-gray-400">
                        {tool.description || tool.asset_id}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {tool.required && (
                        <span className="text-xs bg-yellow-600 px-2 py-1 rounded text-white">
                          Required
                        </span>
                      )}
                      <button
                        onClick={() => toggleTool(toolKey, !tool.enabled)}
                        disabled={loading || tool.required}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          tool.enabled
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                      >
                        {tool.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation Controls */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">🧭 Navigation Control</h3>

          {/* Status Display */}
          <div className="mb-4 p-3 rounded border border-gray-600 bg-gray-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300 text-sm">Update Rate</span>
              <span className={`text-xs font-mono font-medium ${updateHz > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                {updateHz > 0 ? `${updateHz} Hz` : '-- Hz'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300 text-sm">Navigation</span>
              <span className={`text-xs font-medium ${isNavigating ? 'text-green-400' : 'text-gray-500'}`}>
                {isNavigating ? '● Active' : '● Inactive'}
              </span>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="space-y-2">
            {!isNavigating ? (
              <button
                onClick={handleStartNavigation}
                disabled={!trackingService || !commandsManager}
                className="w-full p-3 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 text-white rounded font-medium transition-colors"
              >
                ▶️ Start Navigation
              </button>
            ) : (
              <button
                onClick={handleStopNavigation}
                className="w-full p-3 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
              >
                ⏹️ Stop Navigation
              </button>
            )}

            <button
              onClick={handleSetCenter}
              disabled={!isNavigating}
              className="w-full p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded text-sm transition-colors"
            >
              📍 Set Center
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={loadConfig}
            disabled={loading}
            className="w-full p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded transition-colors"
          >
            Refresh Configuration
          </button>

          <button
            onClick={async () => {
              try {
                const apiBase = window.location.port === '8081' ? '' : 'http://localhost:3001';
                const response = await fetch(`${apiBase}/api/tracking/reload-config`, {
                  method: 'POST'
                });
                const result = await response.json();
                if (result.success) {
                  setError(null);
                  await loadConfig(); // Reload config after server reload
                } else {
                  setError('Failed to reload configuration');
                }
              } catch (err) {
                setError('Failed to reload configuration');
              }
            }}
            disabled={loading}
            className="w-full p-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white rounded transition-colors"
          >
            Reload Tracking Servers
          </button>
        </div>

        {/* Footer - Minimal Info */}
        {trackingFrame && (
        <div className="mt-6 pt-4 border-t border-gray-700">
          <div className="text-xs text-gray-500 space-y-1">
              <div className="flex justify-between text-blue-400 font-mono">
                <span>Last Update:</span>
                <span>{new Date(trackingFrame.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Frame #:</span>
                <span className="font-mono">{trackingFrame.frame_number}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PanelTracking;
