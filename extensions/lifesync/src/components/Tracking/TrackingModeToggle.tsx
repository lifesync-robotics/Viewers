/**
 * TrackingModeToggle - Component for toggling between Simulation and Hardware modes
 */

import React from 'react';

interface TrackingModeToggleProps {
  mode: 'simulation' | 'hardware';
  onChange: (mode: 'simulation' | 'hardware') => void;
  disabled?: boolean;
}

const TrackingModeToggle: React.FC<TrackingModeToggleProps> = ({
  mode,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="tracking-mode-toggle">
      <div className="mode-options">
        <label className={`mode-option ${mode === 'simulation' ? 'active' : ''}`}>
          <input
            type="radio"
            name="tracking-mode"
            value="simulation"
            checked={mode === 'simulation'}
            onChange={() => onChange('simulation')}
            disabled={disabled}
          />
          <span className="mode-icon">🖥️</span>
          <span className="mode-label">Simulation</span>
          <span className="mode-description">
            Virtual tracking for development and testing
          </span>
        </label>

        <label className={`mode-option ${mode === 'hardware' ? 'active' : ''}`}>
          <input
            type="radio"
            name="tracking-mode"
            value="hardware"
            checked={mode === 'hardware'}
            onChange={() => onChange('hardware')}
            disabled={disabled}
          />
          <span className="mode-icon">🔌</span>
          <span className="mode-label">Hardware</span>
          <span className="mode-description">
            Connect to NDI Polaris tracker
          </span>
        </label>
      </div>

      {/* Mode Info */}
      <div className="mode-info">
        {mode === 'simulation' ? (
          <div className="info-box info-simulation">
            <strong>Simulation Mode</strong>
            <p>
              Uses simulated tracking data for development and testing.
              No physical NDI tracker required.
            </p>
          </div>
        ) : (
          <div className="info-box info-hardware">
            <strong>Hardware Mode</strong>
            <p>
              Connects to physical NDI Polaris tracker.
              Requires tracker to be powered on and connected to network.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackingModeToggle;

