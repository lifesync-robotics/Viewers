import React from 'react';

interface ControlButtonsProps {
  navigating: boolean;
  onStart: () => void;
  onStop: () => void;
}

export default function ControlButtons({ navigating, onStart, onStop }: ControlButtonsProps) {
  return (
    <div className="control-buttons-section">
      <h3 className="section-title">Controls</h3>

      <div className="button-grid">
        {!navigating ? (
          <button className="control-button start-button" onClick={onStart}>
            <span className="button-icon">▶</span>
            <span className="button-text">Start Navigation</span>
          </button>
        ) : (
          <button className="control-button stop-button" onClick={onStop}>
            <span className="button-icon">⏸</span>
            <span className="button-text">Stop Navigation</span>
          </button>
        )}

        <button className="control-button settings-button" disabled>
          <span className="button-icon">⚙</span>
          <span className="button-text">Settings</span>
        </button>
      </div>

      {navigating && (
        <div className="navigation-notice">
          <span className="notice-icon">🔄</span>
          <span className="notice-text">Navigation active - tracking in real-time</span>
        </div>
      )}
    </div>
  );
}

