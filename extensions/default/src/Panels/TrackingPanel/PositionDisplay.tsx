import React from 'react';

interface PositionDisplayProps {
  position: {
    register: number[];
    dicom: number[];
  } | null;
  quality: string | null;
  qualityScore: number | null;
  visible: boolean;
  transformation: {
    loaded: boolean;
    isIdentity: boolean;
  };
}

export default function PositionDisplay({
  position,
  quality,
  qualityScore,
  visible,
  transformation,
}: PositionDisplayProps) {
  const formatCoords = (coords: number[] | null | undefined) => {
    if (!coords || coords.length !== 3) return '[-, -, -]';
    return `[${coords.map(v => v.toFixed(1)).join(', ')}]`;
  };

  const getQualityStars = (score: number | null) => {
    if (score === null) return '';
    const stars = Math.round((score / 100) * 5);
    return '⭐'.repeat(stars);
  };

  return (
    <div className="position-display-section">
      <h3 className="section-title">Position (Crosshair Tool)</h3>

      <div className="position-grid">
        <div className="position-row">
          <span className="position-label">Register:</span>
          <span className="position-value mono">
            {formatCoords(position?.register)} mm
          </span>
        </div>

        {transformation.loaded && !transformation.isIdentity && (
          <div className="position-row">
            <span className="position-label">DICOM:</span>
            <span className="position-value mono">
              {formatCoords(position?.dicom)} mm
            </span>
          </div>
        )}

        <div className="position-row">
          <span className="position-label">Visibility:</span>
          <span className={`position-value ${visible ? 'visible' : 'hidden'}`}>
            {visible ? '✓ Visible' : '✗ Not Visible'}
          </span>
        </div>

        {quality && (
          <div className="position-row">
            <span className="position-label">Quality:</span>
            <span className="position-value">
              {getQualityStars(qualityScore)} ({quality})
            </span>
          </div>
        )}

        <div className="position-row">
          <span className="position-label">Transform:</span>
          <span className="position-value">
            {transformation.loaded ? (
              transformation.isIdentity ? (
                <span className="transform-status identity">Identity ✅</span>
              ) : (
                <span className="transform-status loaded">Loaded ✅</span>
              )
            ) : (
              <span className="transform-status none">None</span>
            )}
          </span>
        </div>
      </div>

      {!position && (
        <div className="no-data-message">
          <span className="no-data-icon">📡</span>
          <span className="no-data-text">Waiting for tracking data...</span>
        </div>
      )}
    </div>
  );
}

