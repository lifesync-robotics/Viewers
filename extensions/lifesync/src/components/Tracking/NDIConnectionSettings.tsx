/**
 * NDIConnectionSettings - Component for configuring NDI hardware connection
 */

import React from 'react';

interface NDIConfig {
  ip_address: string;
  port: number;
  tracker_type: string;
  timeout_seconds: number;
  auto_reconnect: boolean;
}

interface ConnectionStatus {
  success: boolean;
  message: string;
  tracker_info?: {
    serial_number: string;
    model: string;
    firmware_version: string;
    port_count: number;
    status: string;
    additional_info?: any;
  };
  error?: string;
}

interface NDIConnectionSettingsProps {
  ndiConfig: NDIConfig;
  onChange: (config: NDIConfig) => void;
  onTestConnection: () => void;
  connectionStatus: ConnectionStatus | null;
  disabled?: boolean;
}

const NDIConnectionSettings: React.FC<NDIConnectionSettingsProps> = ({
  ndiConfig,
  onChange,
  onTestConnection,
  connectionStatus,
  disabled = false,
}) => {
  const handleChange = (field: keyof NDIConfig, value: any) => {
    onChange({
      ...ndiConfig,
      [field]: value,
    });
  };

  return (
    <div className="ndi-connection-settings">
      {/* IP Address */}
      <div className="form-group">
        <label htmlFor="ndi-ip">IP Address *</label>
        <input
          id="ndi-ip"
          type="text"
          value={ndiConfig.ip_address}
          onChange={(e) => handleChange('ip_address', e.target.value)}
          placeholder="e.g., 172.16.0.4"
          className="form-input"
          disabled={disabled}
        />
        <small className="form-help">
          IP address of the NDI Polaris tracker
        </small>
      </div>

      {/* Port */}
      <div className="form-group">
        <label htmlFor="ndi-port">Port *</label>
        <input
          id="ndi-port"
          type="number"
          value={ndiConfig.port}
          onChange={(e) => handleChange('port', parseInt(e.target.value))}
          placeholder="8765"
          className="form-input"
          disabled={disabled}
          min={1}
          max={65535}
        />
        <small className="form-help">
          TCP port for tracker communication (default: 8765)
        </small>
      </div>

      {/* Tracker Type */}
      <div className="form-group">
        <label htmlFor="ndi-type">Tracker Type *</label>
        <select
          id="ndi-type"
          value={ndiConfig.tracker_type}
          onChange={(e) => handleChange('tracker_type', e.target.value)}
          className="form-select"
          disabled={disabled}
        >
          <option value="polaris_vega">Polaris Vega</option>
          <option value="polaris_vicra">Polaris Vicra</option>
          <option value="polaris_spectra">Polaris Spectra</option>
          <option value="aurora">Aurora</option>
        </select>
      </div>

      {/* Timeout */}
      <div className="form-group">
        <label htmlFor="ndi-timeout">Connection Timeout (seconds)</label>
        <input
          id="ndi-timeout"
          type="number"
          value={ndiConfig.timeout_seconds}
          onChange={(e) => handleChange('timeout_seconds', parseInt(e.target.value))}
          className="form-input"
          disabled={disabled}
          min={1}
          max={60}
        />
      </div>

      {/* Auto Reconnect */}
      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={ndiConfig.auto_reconnect}
            onChange={(e) => handleChange('auto_reconnect', e.target.checked)}
            disabled={disabled}
          />
          <span>Auto Reconnect</span>
        </label>
        <small className="form-help">
          Automatically reconnect if connection is lost
        </small>
      </div>

      {/* Test Connection Button */}
      <div className="form-group">
        <button
          className="btn btn-secondary btn-block"
          onClick={onTestConnection}
          disabled={disabled}
        >
          Test Connection
        </button>
      </div>

      {/* Connection Status */}
      {connectionStatus && (
        <div className={`connection-status ${connectionStatus.success ? 'success' : 'error'}`}>
          <div className="status-header">
            <span className="status-icon">
              {connectionStatus.success ? '✓' : '✗'}
            </span>
            <span className="status-message">{connectionStatus.message}</span>
          </div>

          {/* Tracker Info (on success) */}
          {connectionStatus.success && connectionStatus.tracker_info && (
            <div className="tracker-info">
              <h4>Tracker Information</h4>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Model:</span>
                  <span className="info-value">{connectionStatus.tracker_info.model}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Serial Number:</span>
                  <span className="info-value">{connectionStatus.tracker_info.serial_number}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Firmware:</span>
                  <span className="info-value">{connectionStatus.tracker_info.firmware_version}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Ports:</span>
                  <span className="info-value">{connectionStatus.tracker_info.port_count}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Status:</span>
                  <span className="info-value status-badge">{connectionStatus.tracker_info.status}</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Details (on failure) */}
          {!connectionStatus.success && connectionStatus.error && (
            <div className="error-details">
              <strong>Error:</strong> {connectionStatus.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NDIConnectionSettings;

