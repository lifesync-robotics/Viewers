/**
 * TrackingConfigDialog - Main dialog for tracking configuration management
 *
 * This component provides a comprehensive interface for:
 * - Creating new tracking configurations
 * - Loading saved configurations
 * - Selecting reference markers and instruments
 * - Configuring tracking mode (Simulation/Hardware)
 * - Testing NDI connections
 * - Saving configurations to database
 */

import React, { useState, useEffect, useCallback } from 'react';
import ReferenceMarkerSelector from './ReferenceMarkerSelector';
import InstrumentSelector from './InstrumentSelector';
import TrackingModeToggle from './TrackingModeToggle';
import NDIConnectionSettings from './NDIConnectionSettings';
import ConfigurationManager from './ConfigurationManager';
import './TrackingConfigDialog.css';

interface TrackingConfiguration {
  config_id?: string;
  name: string;
  description?: string;
  default_reference_marker_id?: string;
  default_instrument_ids: string[];
  settings: {
    tracking_frequency: number;
    coordinate_system: string;
    quality_threshold: number;
    auto_reference_detection: boolean;
    tracking_mode: 'simulation' | 'hardware';
    ndi_config?: {
      ip_address: string;
      port: number;
      tracker_type: string;
      timeout_seconds: number;
      auto_reconnect: boolean;
    };
    custom_settings?: { [key: string]: string };
  };
  alternative_rom_selections: { [instrumentId: string]: string };
  created_at?: string;
  updated_at?: string;
}

interface TrackingConfigDialogProps {
  open: boolean;
  onClose: () => void;
  onConfigurationSaved?: (config: TrackingConfiguration) => void;
  onConfigurationApplied?: (config: TrackingConfiguration) => void;
}

const TrackingConfigDialog: React.FC<TrackingConfigDialogProps> = ({
  open,
  onClose,
  onConfigurationSaved,
  onConfigurationApplied,
}) => {
  // Configuration state
  const [configName, setConfigName] = useState('');
  const [configDescription, setConfigDescription] = useState('');
  const [selectedReferenceMarkerId, setSelectedReferenceMarkerId] = useState<string | undefined>();
  const [selectedInstrumentIds, setSelectedInstrumentIds] = useState<string[]>([]);
  const [alternativeRomSelections, setAlternativeRomSelections] = useState<{ [key: string]: string }>({});
  const [trackingMode, setTrackingMode] = useState<'simulation' | 'hardware'>('hardware');
  const [ndiConfig, setNdiConfig] = useState({
    ip_address: '172.16.0.4',
    port: 8765,
    tracker_type: 'polaris_vega',
    timeout_seconds: 5,
    auto_reconnect: true,
  });

  // Advanced settings
  const [trackingFrequency, setTrackingFrequency] = useState(60);
  const [coordinateSystem, setCoordinateSystem] = useState('ndi');
  const [qualityThreshold, setQualityThreshold] = useState(0.8);
  const [autoReferenceDetection, setAutoReferenceDetection] = useState(true);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showConfigManager, setShowConfigManager] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    success: boolean;
    message: string;
    tracker_info?: any;
  } | null>(null);

  // Phase 4: Always use relative paths (webpack proxy handles routing)
  const getApiBase = () => {
    return '';  // Empty string = relative paths
  };

  // Reset form
  const resetForm = useCallback(() => {
    setConfigName('');
    setConfigDescription('');
    setSelectedReferenceMarkerId(undefined);
    setSelectedInstrumentIds([]);
    setAlternativeRomSelections({});
    setTrackingMode('hardware');
    setNdiConfig({
      ip_address: '172.16.0.4',
      port: 8765,
      tracker_type: 'polaris_vega',
      timeout_seconds: 5,
      auto_reconnect: true,
    });
    setTrackingFrequency(60);
    setCoordinateSystem('ndi');
    setQualityThreshold(0.8);
    setAutoReferenceDetection(true);
    setError(null);
    setSuccess(null);
    setConnectionStatus(null);
  }, []);

  // Load configuration
  const loadConfiguration = useCallback((config: TrackingConfiguration) => {
    setConfigName(config.name);
    setConfigDescription(config.description || '');
    setSelectedReferenceMarkerId(config.default_reference_marker_id);
    setSelectedInstrumentIds(config.default_instrument_ids || []);
    setAlternativeRomSelections(config.alternative_rom_selections || {});
    setTrackingMode(config.settings.tracking_mode);
    if (config.settings.ndi_config) {
      setNdiConfig(config.settings.ndi_config);
    }
    setTrackingFrequency(config.settings.tracking_frequency);
    setCoordinateSystem(config.settings.coordinate_system);
    setQualityThreshold(config.settings.quality_threshold);
    setAutoReferenceDetection(config.settings.auto_reference_detection);
    setError(null);
    setSuccess(`Configuration "${config.name}" loaded successfully`);
    setShowConfigManager(false);
  }, []);

  // Auto-load the most recent configuration from the database when the dialog opens
  const fetchLatestConfiguration = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/api/tracking/configurations?limit=1`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Request failed with status ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.configurations?.length) {
        const latestConfig: TrackingConfiguration = result.configurations[0];
        loadConfiguration(latestConfig);
        setSuccess(`Auto-loaded "${latestConfig.name}" from database`);
      } else if (result.success) {
        setSuccess('No saved configurations found. Configure and save to get started.');
      } else {
        setError(result.error || 'Failed to load configuration from database');
      }
    } catch (err) {
      setError(`Failed to auto-load configuration: ${err.message}`);
      console.error('Error auto-loading configuration:', err);
    } finally {
      setLoading(false);
    }
  }, [loadConfiguration]);

  // Save configuration
  const saveConfiguration = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Validate
      if (!configName.trim()) {
        setError('Configuration name is required');
        return;
      }

      // Filter out null/undefined instrument IDs
      const validInstrumentIds = selectedInstrumentIds.filter(id => id && id !== 'null' && id !== 'undefined');

      // Filter out null/undefined keys from ROM selections
      const validRomSelections: { [key: string]: string } = {};
      Object.entries(alternativeRomSelections).forEach(([key, value]) => {
        if (key && key !== 'null' && key !== 'undefined' && value) {
          validRomSelections[key] = value;
        }
      });

      // Validate reference marker ID
      const validReferenceMarkerId = selectedReferenceMarkerId &&
                                     selectedReferenceMarkerId !== 'null' &&
                                     selectedReferenceMarkerId !== 'undefined'
                                     ? selectedReferenceMarkerId
                                     : undefined;

      console.log('Saving configuration:', {
        name: configName,
        reference_marker: validReferenceMarkerId,
        instruments: validInstrumentIds,
        rom_selections: validRomSelections,
      });

      // Build configuration object
      const configuration: TrackingConfiguration = {
        name: configName,
        description: configDescription,
        default_reference_marker_id: validReferenceMarkerId,
        default_instrument_ids: validInstrumentIds,
        settings: {
          tracking_frequency: trackingFrequency,
          coordinate_system: coordinateSystem,
          quality_threshold: qualityThreshold,
          auto_reference_detection: autoReferenceDetection,
          tracking_mode: trackingMode,
          ...(trackingMode === 'hardware' && { ndi_config: ndiConfig }),
        },
        alternative_rom_selections: validRomSelections,
      };

      // Step 1: Save to database
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/api/tracking/configurations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configuration),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to save configuration');
        return;
      }

      // Step 2: 🆕 Phase 4 - Sync configuration to backend tracking_config.json
      try {
        await syncConfigToBackend(configuration);
        console.log('✅ Configuration synced to backend');
      } catch (syncError) {
        console.warn('⚠️ Failed to sync to backend:', syncError);
        setSuccess(`Configuration "${configName}" saved (backend sync failed: ${syncError.message})`);
        return; // Early return if sync fails
      }

      // Step 3: 🆕 Phase 4 - Switch tracking mode
      try {
        // Disconnect first if tracking is active
        try {
          const statusResponse = await fetch(`${apiBase}/api/tracking/status`);
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            if (statusData.success && statusData.status?.active) {
              console.log('🔌 Disconnecting before mode switch...');
              await fetch(`${apiBase}/api/tracking/disconnect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              });
              // Wait a bit for cleanup
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        } catch (statusError) {
          console.warn('⚠️ Could not check tracking status');
        }

        console.log(`🔄 Switching tracking mode to: ${trackingMode}`);
        const modeResponse = await fetch(`${apiBase}/api/tracking/mode`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: trackingMode })
        });

        const modeResult = await modeResponse.json();
        if (modeResult.success) {
          console.log(`✅ Tracking mode switched to: ${trackingMode}`);
          setSuccess(`Configuration "${configName}" saved - Mode: ${trackingMode}`);
        } else {
          console.warn('⚠️ Failed to switch mode:', modeResult.error);
          setSuccess(`Configuration "${configName}" saved (mode switch failed)`);
        }
      } catch (modeError) {
        console.warn('⚠️ Error switching mode:', modeError);
        setSuccess(`Configuration "${configName}" saved (mode switch failed)`);
      }

      if (onConfigurationSaved) {
        onConfigurationSaved(result.configuration);
      }
    } catch (err) {
      setError(`Failed to save configuration: ${err.message}`);
      console.error('Error saving configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  // 🆕 Phase 4: Sync configuration to backend tracking_config.json
  const syncConfigToBackend = async (configuration: TrackingConfiguration) => {
    const apiBase = getApiBase();

    console.log('🔄 Syncing configuration to backend...', {
      reference: configuration.default_reference_marker_id,
      instruments: configuration.default_instrument_ids?.length || 0,
      mode: configuration.settings.tracking_mode
    });

    const response = await fetch(`${apiBase}/api/tracking/config/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ configuration }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to sync configuration to backend');
    }

    console.log('✅ Backend configuration synced successfully');
    return result.config;
  };

  // Apply configuration (without saving to database, but sync to backend)
  const applyConfiguration = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const configuration: TrackingConfiguration = {
        name: configName || 'Temporary Configuration',
        description: configDescription,
        default_reference_marker_id: selectedReferenceMarkerId,
        default_instrument_ids: selectedInstrumentIds,
        settings: {
          tracking_frequency: trackingFrequency,
          coordinate_system: coordinateSystem,
          quality_threshold: qualityThreshold,
          auto_reference_detection: autoReferenceDetection,
          tracking_mode: trackingMode,
          ...(trackingMode === 'hardware' && { ndi_config: ndiConfig }),
        },
        alternative_rom_selections: alternativeRomSelections,
      };

      const apiBase = getApiBase();

      // 🆕 Phase 4: Sync to backend when applying (even without saving to database)
      try {
        await syncConfigToBackend(configuration);
        console.log('✅ Configuration synced to backend');
      } catch (syncError) {
        console.warn('⚠️ Failed to sync to backend:', syncError);
        throw new Error(`Backend sync failed: ${syncError.message}`);
      }

      // 🆕 Phase 4: Switch tracking mode if needed
      try {
        // Disconnect first if tracking is active
        try {
          const statusResponse = await fetch(`${apiBase}/api/tracking/status`);
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            if (statusData.success && statusData.status?.active) {
              console.log('🔌 Disconnecting before mode switch...');
              await fetch(`${apiBase}/api/tracking/disconnect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              });
              // Wait a bit for cleanup
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        } catch (statusError) {
          console.warn('⚠️ Could not check tracking status');
        }

        console.log(`🔄 Switching tracking mode to: ${trackingMode}`);
        const modeResponse = await fetch(`${apiBase}/api/tracking/mode`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: trackingMode })
        });

        const modeResult = await modeResponse.json();
        if (!modeResult.success) {
          console.warn('⚠️ Failed to switch tracking mode:', modeResult.error);
          // Don't fail the whole operation, just warn
        } else {
          console.log(`✅ Tracking mode switched to: ${trackingMode}`);
        }
      } catch (modeError) {
        console.warn('⚠️ Error switching tracking mode:', modeError);
        // Don't fail the whole operation, just warn
      }

      setSuccess(`Configuration applied - Mode: ${trackingMode}`);

      if (onConfigurationApplied) {
        onConfigurationApplied(configuration);
      }

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(`Failed to apply configuration: ${err.message}`);
      console.error('Error applying configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  // Test connection
  const testConnection = async () => {
    try {
      setLoading(true);
      setConnectionStatus(null);
      setError(null);

      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/api/tracking/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ndi_config: trackingMode === 'simulation'
            ? { ...ndiConfig, ip_address: 'simulation' }
            : ndiConfig,
        }),
      });

      const result = await response.json();
      setConnectionStatus(result);
    } catch (err) {
      setError(`Connection test failed: ${err.message}`);
      console.error('Error testing connection:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle instrument toggle
  const handleInstrumentToggle = (instrumentId: string, enabled: boolean) => {
    // Validate instrument ID
    if (!instrumentId || instrumentId === 'null' || instrumentId === 'undefined') {
      console.error('Invalid instrument ID:', instrumentId);
      return;
    }

    console.log('handleInstrumentToggle:', instrumentId, enabled);

    if (enabled) {
      setSelectedInstrumentIds([...selectedInstrumentIds, instrumentId]);
      // Set default ROM selection
      if (!alternativeRomSelections[instrumentId]) {
        setAlternativeRomSelections({
          ...alternativeRomSelections,
          [instrumentId]: 'default',
        });
      }
    } else {
      setSelectedInstrumentIds(selectedInstrumentIds.filter(id => id !== instrumentId));
      // Remove ROM selection
      const newSelections = { ...alternativeRomSelections };
      delete newSelections[instrumentId];
      setAlternativeRomSelections(newSelections);
    }
  };

  // Handle alternative ROM change
  const handleAlternativeRomChange = (instrumentId: string, romName: string) => {
    setAlternativeRomSelections({
      ...alternativeRomSelections,
      [instrumentId]: romName,
    });
  };

  // Automatically pull the latest saved configuration when the dialog opens
  useEffect(() => {
    if (open) {
      fetchLatestConfiguration();
    }
  }, [open, fetchLatestConfiguration]);

  if (!open) return null;

  return (
    <div className="tracking-config-dialog-overlay" onClick={onClose}>
      <div className="tracking-config-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tracking-config-dialog-header">
          <h2>Configure Tracking</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {/* Content */}
        <div className="tracking-config-dialog-content">
          {/* Error/Success Messages */}
          {error && (
            <div className="alert alert-error">
              <span className="alert-icon">⚠️</span>
              {error}
            </div>
          )}
          {success && (
            <div className="alert alert-success">
              <span className="alert-icon">✓</span>
              {success}
            </div>
          )}

          {/* Advanced Settings */}
          <div className="config-section">
            <div className="advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
              <h3>Advanced</h3>
              <span className="toggle-icon">{showAdvanced ? '▼' : '▶'}</span>
            </div>
            {showAdvanced && (
              <div className="advanced-settings">
                <div className="config-section">
                  <h4>Basic Information</h4>
                  <div className="form-group">
                    <label htmlFor="config-name">Configuration Name *</label>
                    <input
                      id="config-name"
                      type="text"
                      value={configName}
                      onChange={(e) => setConfigName(e.target.value)}
                      placeholder="e.g., OR1 Simulation Setup"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="config-description">Description</label>
                    <textarea
                      id="config-description"
                      value={configDescription}
                      onChange={(e) => setConfigDescription(e.target.value)}
                      placeholder="Optional description"
                      className="form-textarea"
                      rows={2}
                    />
                  </div>
                </div>

                <div className="config-section">
                  <h4>Reference Marker</h4>
                  <ReferenceMarkerSelector
                    selectedMarkerId={selectedReferenceMarkerId}
                    onSelect={setSelectedReferenceMarkerId}
                    disabled={loading}
                  />
                </div>

                <div className="config-section">
                  <h4>Instruments</h4>
                  <InstrumentSelector
                    selectedInstrumentIds={selectedInstrumentIds}
                    alternativeRomSelections={alternativeRomSelections}
                    onInstrumentToggle={handleInstrumentToggle}
                    onAlternativeRomChange={handleAlternativeRomChange}
                    disabled={loading}
                  />
                </div>

                <div className="config-section">
                  <h4>Tracking Mode & Connection</h4>
                  <TrackingModeToggle
                    mode={trackingMode}
                    onChange={setTrackingMode}
                    disabled={loading}
                  />

                  {trackingMode === 'hardware' && (
                    <NDIConnectionSettings
                      ndiConfig={ndiConfig}
                      onChange={setNdiConfig}
                      onTestConnection={testConnection}
                      connectionStatus={connectionStatus}
                      disabled={loading}
                    />
                  )}

                  {trackingMode === 'simulation' && (
                    <div className="config-section">
                      <button
                        className="btn btn-secondary"
                        onClick={testConnection}
                        disabled={loading}
                      >
                        Test Simulation Connection
                      </button>
                      {connectionStatus && (
                        <div className={`connection-status ${connectionStatus.success ? 'success' : 'error'}`}>
                          <span className="status-icon">{connectionStatus.success ? '✓' : '✗'}</span>
                          {connectionStatus.message}
                          {connectionStatus.tracker_info && (
                            <div className="tracker-info">
                              <div>Model: {connectionStatus.tracker_info.model}</div>
                              <div>Serial: {connectionStatus.tracker_info.serial_number}</div>
                              <div>Status: {connectionStatus.tracker_info.status}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="config-section">
                  <h4>Advanced Tuning</h4>
                  <div className="form-group">
                    <label htmlFor="tracking-frequency">Tracking Frequency (Hz)</label>
                    <input
                      id="tracking-frequency"
                      type="number"
                      value={trackingFrequency}
                      onChange={(e) => setTrackingFrequency(parseInt(e.target.value))}
                      min={20}
                      max={120}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="coordinate-system">Coordinate System</label>
                    <select
                      id="coordinate-system"
                      value={coordinateSystem}
                      onChange={(e) => setCoordinateSystem(e.target.value)}
                      className="form-select"
                    >
                      <option value="ndi">NDI</option>
                      <option value="patient">Patient</option>
                      <option value="world">World</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="quality-threshold">Quality Threshold</label>
                    <input
                      id="quality-threshold"
                      type="number"
                      value={qualityThreshold}
                      onChange={(e) => setQualityThreshold(parseFloat(e.target.value))}
                      min={0}
                      max={1}
                      step={0.1}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={autoReferenceDetection}
                        onChange={(e) => setAutoReferenceDetection(e.target.checked)}
                      />
                      Auto Reference Detection
                    </label>
                  </div>
                </div>

                <div className="config-section">
                  <h4>Saved Configurations</h4>
                  <p className="config-description">
                    Latest configuration loads automatically when this dialog opens.
                  </p>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowConfigManager(!showConfigManager)}
                    disabled={loading}
                  >
                    {showConfigManager ? 'Hide' : 'Manage'} Saved Configurations
                  </button>
                  {showConfigManager && (
                    <ConfigurationManager
                      onConfigurationLoad={loadConfiguration}
                      currentConfigId={undefined}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="tracking-config-dialog-footer">
          <button
            className="btn btn-secondary"
            onClick={resetForm}
            disabled={loading}
          >
            Reset
          </button>
          <button
            className="btn btn-secondary"
            onClick={applyConfiguration}
            disabled={loading}
          >
            Apply
          </button>
          <button
            className="btn btn-primary"
            onClick={saveConfiguration}
            disabled={loading || !configName.trim()}
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrackingConfigDialog;
