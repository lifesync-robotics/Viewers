import React, { useState, useEffect, useRef } from 'react';
import { useSystem } from '@ohif/core';
import './RegistrationPanel.css';

interface Fiducial {
  point_id: string;
  label: string;
  dicom_position_mm: number[];
  tracker_position_mm?: number[];
  quality_score?: number;
  stability_mm?: number;
  status?: string;
  source?: string;
}

interface RegistrationState {
  connected: boolean;
  sessionId: string | null;
  caseId: string;
  status: 'idle' | 'collecting' | 'computing' | 'completed';
  fiducials: Fiducial[];
  currentIndex: number;
  template: any | null;
  quality: any | null;
  result: any | null;
  method: string;
}

export default function RegistrationPanel() {
  const { servicesManager, commandsManager } = useSystem();
  const { registrationService, displaySetService, cornerstoneViewportService } =
    servicesManager.services;

  const [caseId, setCaseId] = useState<string>('');
  const [seriesInstanceUID, setSeriesInstanceUID] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState<string>('http://localhost:3001');

  const [state, setState] = useState<RegistrationState>({
    connected: false,
    sessionId: null,
    caseId: '',
    status: 'idle',
    fiducials: [],
    currentIndex: 0,
    template: null,
    quality: null,
    result: null,
    method: 'manual_point_based',
  });

  // Get current Study ID and Series UID on mount
  useEffect(() => {
    const activeDisplaySets = displaySetService?.getActiveDisplaySets() || [];
    if (activeDisplaySets.length > 0) {
      const studyInstanceUID = activeDisplaySets[0]?.StudyInstanceUID;
      const seriesUID = activeDisplaySets[0]?.SeriesInstanceUID;
      if (studyInstanceUID) {
        const extractedCaseId = `CASE_${studyInstanceUID.slice(-8)}`;
        setCaseId(extractedCaseId);
        setState(prev => ({ ...prev, caseId: extractedCaseId }));
      }
      if (seriesUID) {
        setSeriesInstanceUID(seriesUID);
      }
    }
  }, [displaySetService]);

  // Subscribe to registration service events
  useEffect(() => {
    if (!registrationService) {
      console.warn('⚠️ RegistrationService not available');
      return;
    }

    const subscriptions = [];

    // Connection status
    subscriptions.push(
      registrationService.subscribe('event::registration_connection_status', data => {
        setState(prev => ({ ...prev, connected: data.connected }));
      })
    );

    // Session started
    subscriptions.push(
      registrationService.subscribe('event::registration_session_started', data => {
        setState(prev => ({
          ...prev,
          sessionId: data.registration_id,  // 使用 registration_id
          status: 'collecting',
          fiducials: data.fiducials || [],
          currentIndex: 0,
        }));
      })
    );

    // Template loaded
    subscriptions.push(
      registrationService.subscribe('event::registration_template_loaded', data => {
        setState(prev => ({
          ...prev,
          template: data,
          fiducials: data.fiducials || [],
        }));
      })
    );

    // Point captured
    subscriptions.push(
      registrationService.subscribe('event::registration_point_captured', data => {
        setState(prev => {
          const updatedFiducials = [...prev.fiducials];
          const index = updatedFiducials.findIndex(f => f.point_id === data.point_id);

          if (index >= 0) {
            updatedFiducials[index] = {
              ...updatedFiducials[index],
              tracker_position_mm: data.tracker_position_mm,
              quality_score: data.quality_score,
              stability_mm: data.stability_mm,
              status: 'captured',
            };
          }

          return {
            ...prev,
            fiducials: updatedFiducials,
            currentIndex: Math.min(prev.currentIndex + 1, updatedFiducials.length - 1),
          };
        });
      })
    );

    // Quality updated
    subscriptions.push(
      registrationService.subscribe('event::registration_quality_updated', data => {
        setState(prev => ({ ...prev, quality: data }));
      })
    );

    // Registration computed
    subscriptions.push(
      registrationService.subscribe('event::registration_computed', data => {
        setState(prev => ({
          ...prev,
          result: data,
          status: 'completed',
        }));
      })
    );

    // Check initial connection
    setState(prev => ({ ...prev, connected: registrationService.isApiConnected() }));

    return () => {
      subscriptions.forEach(sub => sub.unsubscribe());
    };
  }, [registrationService]);

  // Handlers
  const handleUpdateApiUrl = () => {
    if (registrationService) {
      registrationService.setApiUrl(apiUrl);
    }
  };

  const handleStartSession = async () => {
    if (!registrationService || !caseId) return;

    try {
      await registrationService.startSession(caseId, {
        method: state.method,
        load_premarked: state.template !== null,
        expected_points: 6,
      });
    } catch (error) {
      console.error('Failed to start session:', error);
      alert(`Failed to start session: ${error.message}`);
    }
  };

  const handleLoadTemplate = async () => {
    if (!registrationService || !caseId) return;

    try {
      const template = await registrationService.loadTemplate(caseId);
      // Template loaded event will update state
    } catch (error) {
      console.error('Failed to load template:', error);
      alert(`No template found for ${caseId}`);
    }
  };

  const handleCaptureFromCrosshair = async () => {
    if (!state.sessionId || state.currentIndex >= state.fiducials.length) return;

    const currentFiducial = state.fiducials[state.currentIndex];

    // Get crosshair position from viewport
    const crosshairPosition = getCrosshairPosition();

    if (!crosshairPosition) {
      alert('Please activate Crosshairs tool and position it on the anatomical landmark');
      return;
    }

    try {
      await registrationService.captureTrackerPosition(
        caseId,
        currentFiducial.point_id,
        state.sessionId,
        {
          auto_capture: true,
          num_samples: 50,
        }
      );
    } catch (error) {
      console.error('Failed to capture point:', error);
      alert(`Failed to capture point: ${error.message}`);
    }
  };

  const handlePreviewQuality = async () => {
    if (!state.sessionId) return;

    try {
      await registrationService.previewQuality(caseId, state.sessionId);
      // Quality event will update state
    } catch (error) {
      console.error('Failed to preview quality:', error);
      alert(`Failed to preview quality: ${error.message}`);
    }
  };

  const handleComputeRegistration = async () => {
    if (!state.sessionId) return;

    try {
      setState(prev => ({ ...prev, status: 'computing' }));
      await registrationService.computeRegistration(caseId, state.sessionId, {
        method: 'least_squares',
      });
      // Result event will update state
    } catch (error) {
      console.error('Failed to compute registration:', error);
      alert(`Failed to compute registration: ${error.message}`);
      setState(prev => ({ ...prev, status: 'collecting' }));
    }
  };

  const handleSaveRegistration = async () => {
    if (!state.sessionId || !seriesInstanceUID) {
      alert('❌ Missing session ID or series UID');
      return;
    }

    try {
      await registrationService.saveRegistration(seriesInstanceUID, state.sessionId, true);
      alert('✅ Registration saved successfully');
    } catch (error: any) {
      console.error('Failed to save registration:', error);
      alert(`Failed to save registration: ${error.message}`);
    }
  };

  // Helper: Get crosshair position from viewport
  const getCrosshairPosition = (): number[] | null => {
    try {
      const renderingEngine = cornerstoneViewportService.getRenderingEngine();
      if (!renderingEngine) return null;

      const viewports = renderingEngine.getViewports();

      for (const viewport of viewports) {
        const element = viewport.element;
        if (!element) continue;

        // Get crosshair annotations (similar to addFiducialAtCrosshair.ts)
        const { annotation } = window.cornerstone3D || {};
        if (!annotation) continue;

        const annotations = annotation.state.getAnnotations('Crosshairs', element);
        if (annotations && annotations.length > 0) {
          const crosshairAnnotation = annotations[0];

          // Get center position
          if (crosshairAnnotation.data?.handles?.toolCenter) {
            return crosshairAnnotation.data.handles.toolCenter;
          } else if (crosshairAnnotation.data?.handles?.rotationPoints) {
            return crosshairAnnotation.data.handles.rotationPoints[0];
          }
        }
      }
    } catch (error) {
      console.error('Error getting crosshair position:', error);
    }

    return null;
  };

  const capturedCount = state.fiducials.filter(f => f.status === 'captured').length;
  const canCompute = capturedCount >= 3;
  const currentFiducial = state.fiducials[state.currentIndex];

  return (
    <div className="registration-panel">
      <div className="panel-header">
        <h2>📋 Registration</h2>
      </div>

      {/* API Configuration */}
      <div className="section api-config">
        <h3>API Connection</h3>
        <div className="status-indicator">
          <span className={`status-dot ${state.connected ? 'connected' : 'disconnected'}`} />
          <span>{state.connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <input
          type="text"
          value={apiUrl}
          onChange={e => setApiUrl(e.target.value)}
          placeholder="http://localhost:3001"
          className="input-field"
        />
        <button onClick={handleUpdateApiUrl} className="btn-secondary">
          Update URL
        </button>
      </div>

      {/* Case ID */}
      <div className="section case-info">
        <h3>Case ID</h3>
        <input
          type="text"
          value={caseId}
          onChange={e => setCaseId(e.target.value)}
          placeholder="CASE_2025_001"
          className="input-field"
        />
      </div>

      {/* Template Management */}
      <div className="section template-section">
        <h3>Fiducial Template</h3>
        {state.template ? (
          <div className="template-info">
            <p>✅ Template loaded: {state.template.count} points</p>
            <p>Status: {state.template.status}</p>
          </div>
        ) : (
          <p className="hint">No template loaded</p>
        )}
        <button onClick={handleLoadTemplate} className="btn-secondary" disabled={!caseId}>
          Load Template
        </button>
      </div>

      {/* Session Control */}
      <div className="section session-control">
        <h3>Registration Session</h3>
        {!state.sessionId ? (
          <>
            <div className="method-selector">
              <label>Method:</label>
              <select
                value={state.method}
                onChange={e => setState(prev => ({ ...prev, method: e.target.value }))}
                className="select-field"
              >
                <option value="manual_point_based">Manual Point-Based</option>
                <option value="phantom">Phantom (Auto)</option>
              </select>
            </div>
            <button
              onClick={handleStartSession}
              className="btn-primary"
              disabled={!caseId || !state.connected}
            >
              Start Session
            </button>
          </>
        ) : (
          <div className="session-info">
            <p>Session: {state.sessionId}</p>
            <p>Status: {state.status}</p>
            <p>
              Progress: {capturedCount}/{state.fiducials.length}
            </p>
          </div>
        )}
      </div>

      {/* Fiducial List */}
      {state.sessionId && state.fiducials.length > 0 && (
        <div className="section fiducial-list">
          <h3>Fiducials ({state.fiducials.length})</h3>
          <div className="fiducial-scroll">
            {state.fiducials.map((fid, index) => (
              <div
                key={fid.point_id}
                className={`fiducial-item ${index === state.currentIndex ? 'active' : ''} ${
                  fid.status === 'captured' ? 'captured' : ''
                }`}
                onClick={() => setState(prev => ({ ...prev, currentIndex: index }))}
              >
                <div className="fid-header">
                  <span className="fid-id">{fid.point_id}</span>
                  <span className="fid-status">
                    {fid.status === 'captured' ? '✓' : index === state.currentIndex ? '▶' : '○'}
                  </span>
                </div>
                <div className="fid-label">{fid.label}</div>
                <div className="fid-position">
                  DICOM: [{fid.dicom_position_mm.map(v => v.toFixed(1)).join(', ')}]
                </div>
                {fid.tracker_position_mm && (
                  <div className="fid-tracker">
                    Tracker: [{fid.tracker_position_mm.map(v => v.toFixed(1)).join(', ')}]
                  </div>
                )}
                {fid.quality_score !== undefined && (
                  <div className="fid-quality">Quality: {fid.quality_score.toFixed(2)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Capture Controls */}
      {state.sessionId && currentFiducial && state.status === 'collecting' && (
        <div className="section capture-section">
          <h3>Capture: {currentFiducial.label}</h3>
          <div className="current-fid-info">
            <p>Point: {currentFiducial.point_id}</p>
            <p>
              DICOM: [{currentFiducial.dicom_position_mm.map(v => v.toFixed(1)).join(', ')}]
            </p>
          </div>
          <button onClick={handleCaptureFromCrosshair} className="btn-primary btn-large">
            📍 Capture from Crosshair
          </button>
          <div className="capture-hint">
            Position crosshair on the anatomical landmark, then click capture
          </div>
        </div>
      )}

      {/* Quality Preview */}
      {state.sessionId && capturedCount >= 3 && (
        <div className="section quality-section">
          <h3>Quality Check</h3>
          <button onClick={handlePreviewQuality} className="btn-secondary">
            Preview Quality
          </button>
          {state.quality && (
            <div className="quality-info">
              <p>Can compute: {state.quality.can_compute ? 'Yes' : 'No'}</p>
              <p>Points captured: {state.quality.points_captured}</p>
              <p>Estimated FRE: {state.quality.estimated_quality.fre_mm.toFixed(2)}mm</p>
              <p>Quality: {state.quality.estimated_quality.quality}</p>
              {state.quality.warnings && state.quality.warnings.length > 0 && (
                <div className="warnings">
                  {state.quality.warnings.map((w, i) => (
                    <p key={i} className="warning">
                      ⚠️ {w}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Compute Registration */}
      {state.sessionId && canCompute && state.status !== 'completed' && (
        <div className="section compute-section">
          <h3>Compute Registration</h3>
          <button
            onClick={handleComputeRegistration}
            className="btn-success btn-large"
            disabled={state.status === 'computing'}
          >
            {state.status === 'computing' ? '⏳ Computing...' : '🧮 Compute Registration'}
          </button>
        </div>
      )}

      {/* Results */}
      {state.result && (
        <div className="section result-section">
          <h3>✅ Registration Complete</h3>
          <div className="result-metrics">
            <div className="metric">
              <span className="metric-label">FRE:</span>
              <span className="metric-value">{state.result.quality_metrics.fre_mm.toFixed(2)}mm</span>
            </div>
            <div className="metric">
              <span className="metric-label">Quality:</span>
              <span className={`metric-value quality-${state.result.quality_metrics.quality}`}>
                {state.result.quality_metrics.quality}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Points:</span>
              <span className="metric-value">{state.result.quality_metrics.points_used}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Max Residual:</span>
              <span className="metric-value">
                {state.result.quality_metrics.max_residual_mm.toFixed(2)}mm
              </span>
            </div>
          </div>

          {state.result.point_residuals && (
            <div className="residuals-list">
              <h4>Point Residuals:</h4>
              {state.result.point_residuals.map((r, i) => (
                <div key={i} className="residual-item">
                  <span>
                    {r.point_id} ({r.label}):
                  </span>
                  <span className="residual-value">{r.error_mm.toFixed(2)}mm</span>
                </div>
              ))}
            </div>
          )}

          <button onClick={handleSaveRegistration} className="btn-primary">
            💾 Save Registration
          </button>
        </div>
      )}
    </div>
  );
}
