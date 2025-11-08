import React from 'react';

interface ConnectionStatusProps {
  apiConnected: boolean;
  wsConnected: boolean;
  dataHz: number;
  uiHz: number;
  navigating: boolean;
}

export default function ConnectionStatus({
  apiConnected,
  wsConnected,
  dataHz,
  uiHz,
  navigating,
}: ConnectionStatusProps) {
  return (
    <div className="connection-status-section">
      <h3 className="section-title">Connection Status</h3>

      <div className="status-grid">
        <div className="status-row">
          <span className="status-label">API:</span>
          <div className="status-indicator">
            <span className={`status-dot ${apiConnected ? 'connected' : 'disconnected'}`} />
            <span className="status-text">
              {apiConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="status-row">
          <span className="status-label">WebSocket:</span>
          <div className="status-indicator">
            <span className={`status-dot ${wsConnected ? 'connected' : 'disconnected'}`} />
            <span className="status-text">
              {wsConnected ? `${dataHz.toFixed(1)} Hz` : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="status-row">
          <span className="status-label">UI Update:</span>
          <div className="status-indicator">
            <span className={`status-dot ${navigating ? 'connected' : 'disconnected'}`} />
            <span className="status-text">
              {navigating ? `${uiHz.toFixed(1)} Hz` : 'Idle'}
            </span>
          </div>
        </div>

        <div className="status-row">
          <span className="status-label">Navigation:</span>
          <div className="status-indicator">
            <span className={`status-dot ${navigating ? 'connected' : 'disconnected'}`} />
            <span className="status-text">
              {navigating ? 'Active' : 'Stopped'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

