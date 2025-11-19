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
  const [trackingMode, setTrackingMode] = useState<'simulation' | 'hardware'>('simulation');
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

  // Get API base URL
  const getApiBase = () => {
    return window.location.port === '8081' ? '' : 'http://localhost:3001';
  };

  // Reset form
  const resetForm = useCallback(() => {
    setConfigName('');
    setConfigDescription('');
    setSelectedReferenceMarkerId(undefined);
    setSelectedInstrumentIds([]);
    setAlternativeRomSelections({});
    setTrackingMode('simulation');
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

      // Build configuration object
      const configuration: TrackingConfiguration = {
        name: configName,
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

      // Save via API
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/api/tracking/configurations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configuration),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(`Configuration "${configName}" saved successfully`);
        if (onConfigurationSaved) {
          onConfigurationSaved(result.configuration);
        }
      } else {
        setError(result.error || 'Failed to save configuration');
      }
    } catch (err) {
      setError(`Failed to save configuration: ${err.message}`);
      console.error('Error saving configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  // Apply configuration (without saving)
  const applyConfiguration = () => {
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

    if (onConfigurationApplied) {
      onConfigurationApplied(configuration);
    }
    setSuccess('Configuration applied');
    setTimeout(() => {
      onClose();
    }, 1000);
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

          {/* Configuration Manager Toggle */}
          <div className="config-manager-toggle">
            <button
              className="btn btn-secondary"
              onClick={() => setShowConfigManager(!showConfigManager)}
            >
              {showConfigManager ? 'Hide' : 'Load'} Saved Configurations
            </button>
          </div>

          {/* Configuration Manager */}
          {showConfigManager && (
            <ConfigurationManager
              onConfigurationLoad={loadConfiguration}
              currentConfigId={undefined}
            />
          )}

          {/* Basic Settings */}
          <div className="config-section">
            <h3>Basic Information</h3>
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

          {/* Reference Marker Selection */}
          <div className="config-section">
            <h3>Reference Marker</h3>
            <ReferenceMarkerSelector
              selectedMarkerId={selectedReferenceMarkerId}
              onSelect={setSelectedReferenceMarkerId}
              disabled={loading}
            />
          </div>

          {/* Instrument Selection */}
          <div className="config-section">
            <h3>Instruments</h3>
            <InstrumentSelector
              selectedInstrumentIds={selectedInstrumentIds}
              alternativeRomSelections={alternativeRomSelections}
              onInstrumentToggle={handleInstrumentToggle}
              onAlternativeRomChange={handleAlternativeRomChange}
              disabled={loading}
            />
          </div>

          {/* Tracking Mode */}
          <div className="config-section">
            <h3>Tracking Mode</h3>
            <TrackingModeToggle
              mode={trackingMode}
              onChange={setTrackingMode}
              disabled={loading}
            />
          </div>

          {/* NDI Connection Settings (Hardware Mode Only) */}
          {trackingMode === 'hardware' && (
            <div className="config-section">
              <h3>NDI Connection</h3>
              <NDIConnectionSettings
                ndiConfig={ndiConfig}
                onChange={setNdiConfig}
                onTestConnection={testConnection}
                connectionStatus={connectionStatus}
                disabled={loading}
              />
            </div>
          )}

          {/* Test Connection Button (Simulation Mode) */}
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

          {/* Advanced Settings */}
          <div className="config-section">
            <div className="advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
              <h3>Advanced Settings</h3>
              <span className="toggle-icon">{showAdvanced ? '▼' : '▶'}</span>
            </div>
            {showAdvanced && (
              <div className="advanced-settings">
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
