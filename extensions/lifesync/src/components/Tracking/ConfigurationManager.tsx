/**
 * ConfigurationManager - Component for loading/deleting saved configurations
 */

import React, { useState, useEffect } from 'react';

interface TrackingConfiguration {
  config_id: string;
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
    ndi_config?: any;
  };
  alternative_rom_selections: { [key: string]: string };
  created_at: string;
  updated_at: string;
}

interface ConfigurationManagerProps {
  onConfigurationLoad: (config: TrackingConfiguration) => void;
  currentConfigId?: string;
}

const ConfigurationManager: React.FC<ConfigurationManagerProps> = ({
  onConfigurationLoad,
  currentConfigId,
}) => {
  const [configurations, setConfigurations] = useState<TrackingConfiguration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Get API base URL
  const getApiBase = () => {
    return window.location.port === '8081' ? '' : 'http://localhost:3001';
  };

  // Load configurations
  const loadConfigurations = async () => {
    try {
      setLoading(true);
      setError(null);

      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/api/tracking/configurations?limit=100`);

      if (!response.ok) {
        throw new Error(`Failed to load configurations: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        setConfigurations(result.configurations || []);
      } else {
        setError(result.error || 'Failed to load configurations');
      }
    } catch (err) {
      setError(`Failed to load configurations: ${err.message}`);
      console.error('Error loading configurations:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load on mount
  useEffect(() => {
    loadConfigurations();
  }, []);

  // Load configuration
  const handleLoad = async (configId: string) => {
    try {
      setLoading(true);
      setError(null);

      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/api/tracking/configurations/${configId}`);

      if (!response.ok) {
        throw new Error(`Failed to load configuration: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        onConfigurationLoad(result.configuration);
      } else {
        setError(result.error || 'Failed to load configuration');
      }
    } catch (err) {
      setError(`Failed to load configuration: ${err.message}`);
      console.error('Error loading configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  // Delete configuration
  const handleDelete = async (configId: string) => {
    try {
      setLoading(true);
      setError(null);

      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/api/tracking/configurations/${configId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete configuration: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        // Reload configurations
        await loadConfigurations();
        setDeleteConfirmId(null);
      } else {
        setError(result.error || 'Failed to delete configuration');
      }
    } catch (err) {
      setError(`Failed to delete configuration: ${err.message}`);
      console.error('Error deleting configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter configurations by search term
  const filteredConfigurations = configurations.filter(config =>
    config.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (config.description && config.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="configuration-manager">
      {loading && <div className="loading-spinner">Loading configurations...</div>}

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          {error}
        </div>
      )}

      {!loading && (
        <>
          {/* Search */}
          <div className="form-group">
            <input
              type="text"
              placeholder="Search configurations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
            />
          </div>

          {/* Configuration List */}
          <div className="configuration-list">
            {filteredConfigurations.length === 0 ? (
              <div className="no-results">
                {configurations.length === 0
                  ? 'No saved configurations. Create and save a configuration to see it here.'
                  : `No configurations found matching "${searchTerm}"`}
              </div>
            ) : (
              filteredConfigurations.map(config => (
                <div
                  key={config.config_id}
                  className={`configuration-item ${config.config_id === currentConfigId ? 'active' : ''}`}
                >
                  <div className="config-header">
                    <div className="config-info">
                      <h4 className="config-name">{config.name}</h4>
                      {config.description && (
                        <p className="config-description">{config.description}</p>
                      )}
                    </div>
                    <div className="config-badge">
                      <span className={`mode-badge mode-${config.settings.tracking_mode}`}>
                        {config.settings.tracking_mode}
                      </span>
                    </div>
                  </div>

                  <div className="config-details">
                    <div className="detail-row">
                      <span className="detail-label">Instruments:</span>
                      <span className="detail-value">
                        {config.default_instrument_ids.length} selected
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Reference:</span>
                      <span className="detail-value">
                        {config.default_reference_marker_id || 'None'}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Created:</span>
                      <span className="detail-value">
                        {formatDate(config.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="config-actions">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleLoad(config.config_id)}
                      disabled={loading}
                    >
                      Load
                    </button>

                    {deleteConfirmId === config.config_id ? (
                      <div className="delete-confirm">
                        <span className="confirm-text">Delete?</span>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(config.config_id)}
                          disabled={loading}
                        >
                          Yes
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setDeleteConfirmId(null)}
                          disabled={loading}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => setDeleteConfirmId(config.config_id)}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Refresh Button */}
          <div className="manager-footer">
            <button
              className="btn btn-secondary"
              onClick={loadConfigurations}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ConfigurationManager;
