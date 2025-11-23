/**
 * AutoRegistrationPanel
 *
 * Panel for phantom-based automatic registration
 */

import React, { useState } from 'react';
import type { PhantomConfig, RegistrationPanelProps } from './types';
import './RegistrationPanel.css';

interface AutoRegistrationPanelProps extends RegistrationPanelProps {
  seriesInstanceUID: string | null;
  caseId: string | null;
  studyInstanceUID: string | null;
}

export default function AutoRegistrationPanel({
  servicesManager,
  commandsManager,
  extensionManager,
  seriesInstanceUID,
  caseId,
  studyInstanceUID,
}: AutoRegistrationPanelProps) {
  const [selectedPhantom, setSelectedPhantom] = useState<string>('');
  const [phantomConfig, setPhantomConfig] = useState<PhantomConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'running' | 'completed' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Available phantom configurations
  const phantomOptions = [
    { id: 'Medtronic_StealthStation', label: 'Medtronic StealthStation', type: '3D_O_Arm' },
    { id: 'BrainLab_ExacTrac', label: 'BrainLab ExacTrac', type: 'CT_Phantom' },
    { id: 'Stryker_Navigation', label: 'Stryker Navigation', type: '3D_O_Arm' },
  ];

  const handlePhantomSelect = (phantomId: string) => {
    setSelectedPhantom(phantomId);
    setError(null);

    // Load default configuration for selected phantom
    const phantom = phantomOptions.find(p => p.id === phantomId);
    if (phantom) {
      setPhantomConfig({
        phantom_id: phantom.id,
        phantom_type: phantom.type,
        num_markers: 6, // Default
        marker_spacing_mm: 50, // Default
      });
    }
  };

  const handleLoadPhantom = async () => {
    if (!selectedPhantom || !phantomConfig) {
      setError('Please select a phantom configuration');
      return;
    }

    if (!seriesInstanceUID) {
      setError('No DICOM series loaded. Please load a study first.');
      return;
    }

    setIsLoading(true);
    setStatus('loading');
    setError(null);

    try {
      // TODO: Implement phantom loading logic
      console.log('📦 Loading phantom configuration:', phantomConfig);

      // Simulate loading
      await new Promise(resolve => setTimeout(resolve, 1000));

      setStatus('idle');
      console.log('✅ Phantom configuration loaded');
    } catch (err: any) {
      setError(err.message || 'Failed to load phantom configuration');
      setStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartAutoRegistration = async () => {
    if (!seriesInstanceUID) {
      setError('No DICOM series loaded. Please load a study first.');
      return;
    }

    if (!phantomConfig) {
      setError('Please load a phantom configuration first');
      return;
    }

    setIsLoading(true);
    setStatus('running');
    setError(null);

    try {
      // Get registration service
      const registrationService = servicesManager.services.registrationService;
      if (!registrationService) {
        throw new Error('Registration service not available');
      }

      if (!registrationService.isApiConnected()) {
        throw new Error('Registration API not connected. Please check if the server is running.');
      }

      console.log('🚀 Starting auto registration...');
      console.log(`   Series UID: ${seriesInstanceUID}`);
      console.log(`   Phantom: ${phantomConfig.phantom_id}`);

      // Start registration session with PHANTOM_AUTO method
      const session = await registrationService.startRegistration(seriesInstanceUID, {
        case_id: caseId || undefined,
        method: 'PHANTOM_AUTO',
        load_premarked: false,
        expected_points: phantomConfig.num_markers,
      });

      // TODO: The API should handle phantom configuration
      // For now, we just start the session
      // In the future, phantom_config will be passed to the API

      setStatus('completed');
      console.log('✅ Auto registration session started:', session.session_id);

      // Show success message
      alert(`✅ Auto registration session started!\nSession ID: ${session.session_id}\n\nNote: Phantom-based registration will be fully implemented when the server supports it.`);
    } catch (err: any) {
      setError(err.message || 'Failed to start auto registration');
      setStatus('error');
      console.error('❌ Error starting auto registration:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auto-registration-panel">
      {/* Phantom Selection */}
      <div className="section">
        <h3>Phantom Configuration</h3>
        <div className="phantom-selector">
          <label>Select Phantom:</label>
          <select
            value={selectedPhantom}
            onChange={(e) => handlePhantomSelect(e.target.value)}
            className="select-field"
            disabled={isLoading}
          >
            <option value="">-- Select Phantom --</option>
            {phantomOptions.map(phantom => (
              <option key={phantom.id} value={phantom.id}>
                {phantom.label}
              </option>
            ))}
          </select>
        </div>

        {phantomConfig && (
          <div className="phantom-info">
            <div className="info-row">
              <span className="info-label">Type:</span>
              <span className="info-value">{phantomConfig.phantom_type}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Markers:</span>
              <span className="info-value">{phantomConfig.num_markers}</span>
            </div>
            {phantomConfig.marker_spacing_mm && (
              <div className="info-row">
                <span className="info-label">Spacing:</span>
                <span className="info-value">{phantomConfig.marker_spacing_mm}mm</span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleLoadPhantom}
          className="btn-secondary"
          disabled={!selectedPhantom || isLoading}
        >
          {isLoading && status === 'loading' ? '⏳ Loading...' : '📦 Load Phantom'}
        </button>
      </div>

      {/* Status Display */}
      {status !== 'idle' && (
        <div className="section">
          <h3>Status</h3>
          <div className={`status-display status-${status}`}>
            {status === 'loading' && '⏳ Loading phantom configuration...'}
            {status === 'running' && '🔄 Running auto registration...'}
            {status === 'completed' && '✅ Registration completed successfully'}
            {status === 'error' && `❌ Error: ${error || 'Unknown error'}`}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="section error-section">
          <div className="error-message">⚠️ {error}</div>
        </div>
      )}

      {/* Start Registration Button */}
      <div className="section">
        <button
          onClick={handleStartAutoRegistration}
          className="btn-primary btn-large"
          disabled={!phantomConfig || !seriesInstanceUID || isLoading}
        >
          {isLoading && status === 'running' ? '⏳ Running...' : '🚀 Start Auto Registration'}
        </button>
        {!seriesInstanceUID && (
          <p className="hint">⚠️ Please load a DICOM study first</p>
        )}
      </div>

      {/* Results (to be implemented in later phases) */}
      {status === 'completed' && (
        <div className="section result-section">
          <h3>✅ Registration Complete</h3>
          <p className="hint">Registration results will be displayed here</p>
        </div>
      )}
    </div>
  );
}
