/**
 * RegistrationWorkflowPanel
 *
 * Tab 1: Registration Workflow Control
 * - Select registration method (Manual Point-based or Auto)
 * - Load Template button
 * - Start Session button
 * - API connection status
 */

import React, { useState, useEffect } from 'react';
import type { RegistrationPanelProps } from './types';
import './RegistrationPanel.css';

interface RegistrationWorkflowPanelProps extends RegistrationPanelProps {
  seriesInstanceUID: string | null;
  caseId: string | null;
  studyInstanceUID: string | null;
  onSessionStarted?: (sessionId: string) => void;
}

export default function RegistrationWorkflowPanel({
  servicesManager,
  commandsManager,
  extensionManager,
  seriesInstanceUID,
  caseId,
  studyInstanceUID,
  onSessionStarted,
}: RegistrationWorkflowPanelProps) {
  const [method, setMethod] = useState<'MANUAL_POINT_BASED' | 'PHANTOM_AUTO'>('MANUAL_POINT_BASED');
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [apiConnected, setApiConnected] = useState<boolean>(false);
  const [templateLoaded, setTemplateLoaded] = useState(false);

  // Check API connection status
  useEffect(() => {
    const registrationService = servicesManager.services.registrationService;
    if (registrationService) {
      const checkConnection = () => {
        const isConnected = registrationService.isApiConnected();
        setApiConnected(isConnected);
      };

      checkConnection();

      const subscription = registrationService.subscribe(
        'event::registration_connection_status',
        (data: any) => {
          setApiConnected(data.connected || false);
        }
      );

      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    }
  }, [servicesManager]);

  const handleLoadTemplate = async () => {
    if (!seriesInstanceUID) {
      setError('No DICOM series loaded. Please load a study first.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const registrationService = servicesManager.services.registrationService;
      if (!registrationService) {
        throw new Error('Registration service not available');
      }

      if (!registrationService.isApiConnected()) {
        throw new Error('Registration API not connected. Please check if the server is running.');
      }

      console.log('📥 Loading fiducial template...');
      const result = await registrationService.loadFiducials(seriesInstanceUID, {
        case_id: caseId || undefined,
      });

      setTemplateLoaded(true);
      setSuccessMessage(`Template loaded: ${result.fiducials.length} fiducials`);
      setError(null);

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to load template');
      console.error('❌ Error loading template:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSession = async () => {
    if (!seriesInstanceUID) {
      setError('No DICOM series loaded. Please load a study first.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const registrationService = servicesManager.services.registrationService;
      if (!registrationService) {
        throw new Error('Registration service not available');
      }

      if (!registrationService.isApiConnected()) {
        throw new Error('Registration API not connected. Please check if the server is running.');
      }

      console.log('🚀 Starting registration session...');
      const newSession = await registrationService.startRegistration(seriesInstanceUID, {
        case_id: caseId || undefined,
        method: method,
        load_premarked: templateLoaded,
        expected_points: method === 'MANUAL_POINT_BASED' ? 6 : 4,
      });

      setSession(newSession);
      setSuccessMessage(`Session started: ${newSession.session_id}`);
      setError(null);

      if (onSessionStarted) {
        onSessionStarted(newSession.session_id);
      }

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to start session');
      console.error('❌ Error starting session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="registration-workflow-panel">
      {/* Error Message */}
      {error && (
        <div className="error-section">
          <div className="error-message">{error}</div>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="success-message">{successMessage}</div>
      )}

      {/* API Connection Status */}
      <div className="section api-status">
        <h3>API Connection</h3>
        <div className="status-indicator">
          <span className={`status-dot ${apiConnected ? 'connected' : 'disconnected'}`} />
          <span>{apiConnected ? 'API Connected' : 'API Disconnected'}</span>
        </div>
        {!apiConnected && (
          <p className="hint">⚠️ Please start the Registration gRPC server (port 5002)</p>
        )}
      </div>

      {/* Registration Method Selection */}
      <div className="section">
        <h3>Registration Method</h3>
        <div className="method-selector">
          <label>
            <input
              type="radio"
              name="registrationMethod"
              value="MANUAL_POINT_BASED"
              checked={method === 'MANUAL_POINT_BASED'}
              onChange={(e) => setMethod(e.target.value as 'MANUAL_POINT_BASED')}
            />
            <span>Manual Point-based</span>
          </label>
          <label>
            <input
              type="radio"
              name="registrationMethod"
              value="PHANTOM_AUTO"
              checked={method === 'PHANTOM_AUTO'}
              onChange={(e) => setMethod(e.target.value as 'PHANTOM_AUTO')}
            />
            <span>Auto (Phantom)</span>
          </label>
        </div>
        <p className="hint">
          {method === 'MANUAL_POINT_BASED'
            ? 'Manually mark fiducial points on anatomical landmarks'
            : 'Automatic registration using phantom configuration'}
        </p>
      </div>

      {/* Template Management */}
      <div className="section">
        <h3>Template</h3>
        {templateLoaded ? (
          <div className="template-info">
            <p>✅ Template loaded</p>
          </div>
        ) : (
          <p className="hint">No template loaded</p>
        )}
        <button
          onClick={handleLoadTemplate}
          className={`btn-secondary ${isLoading ? 'loading' : ''}`}
          disabled={!seriesInstanceUID || isLoading}
        >
          {isLoading ? 'Loading...' : '📥 Load Template'}
        </button>
        <p className="hint" style={{ fontSize: '12px', marginTop: '8px' }}>
          Load a previously saved fiducial template for this series
        </p>
      </div>

      {/* Session Control */}
      <div className="section">
        <h3>Registration Session</h3>
        {session ? (
          <div className="session-info">
            <div className="info-row">
              <span className="info-label">Session ID:</span>
              <span className="info-value">{session.session_id}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Status:</span>
              <span className="info-value">{session.status}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Method:</span>
              <span className="info-value">{session.method}</span>
            </div>
            <p className="hint" style={{ marginTop: '8px', fontSize: '12px' }}>
              ✅ Session active - Ready for registration operations
            </p>
          </div>
        ) : (
          <>
            <button
              onClick={handleStartSession}
              className={`btn-primary ${isLoading ? 'loading' : ''}`}
              disabled={!seriesInstanceUID || isLoading || !apiConnected}
            >
              {isLoading ? 'Starting...' : '🚀 Start Registration Session'}
            </button>
            {!seriesInstanceUID && (
              <p className="hint" style={{ color: '#fbbf24' }}>⚠️ Please load a DICOM study first</p>
            )}
            {!apiConnected && (
              <p className="hint" style={{ color: '#fbbf24' }}>⚠️ API not connected</p>
            )}
          </>
        )}
      </div>

      {/* DICOM Info (Read-only) */}
      {seriesInstanceUID && (
        <div className="section dicom-info">
          <h3>DICOM Information</h3>
          <div className="info-row">
            <span className="info-label">Series UID:</span>
            <span className="info-value" title={seriesInstanceUID}>
              {seriesInstanceUID.slice(0, 30)}...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
