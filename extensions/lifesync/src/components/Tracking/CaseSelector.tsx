import React, { useState, useEffect } from 'react';

interface CaseSelectorProps {
  caseId?: string;
  disabled?: boolean;
}

export default function CaseSelector({ caseId: propCaseId = '', disabled = false }: CaseSelectorProps) {
  const [caseId, setCaseId] = useState<string>(propCaseId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseInfo, setCaseInfo] = useState<any>(null);

  // Update local state when prop changes
  useEffect(() => {
    if (propCaseId) {
      setCaseId(propCaseId);
    }
  }, [propCaseId]);

  const handleLoadCase = async () => {
    if (!caseId.trim()) {
      setError('Please enter a case ID');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Phase 4: Use relative paths (webpack proxy handles routing)
      const response = await fetch(`/api/cases/${caseId}`);

      if (!response.ok) {
        throw new Error(`Case not found: ${caseId}`);
      }

      const caseData = await response.json();
      setCaseInfo(caseData);

      // Extract and load transformation
      const rMd = caseData.dicom_series?.fixed_image?.rMd?.matrix;

      if (rMd && window.__navigationController) {
        window.__navigationController.loadTransformation(rMd);
        console.log('✅ Transformation loaded from case:', caseId);
      } else {
        console.warn('⚠️ No rMd matrix found in case data');
      }

      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load case');
      setLoading(false);
      console.error('❌ Error loading case:', err);
    }
  };

  const handleLoadIdentity = () => {
    const identityMatrix = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];

    if (window.__navigationController) {
      window.__navigationController.loadTransformation(identityMatrix);
      console.log('✅ Identity transformation loaded');
      setCaseInfo({ name: 'Identity Matrix', rMd: 'Identity' });
    }
  };

  return (
    <div className="case-selector-section">
      <h3 className="section-title">Case & Transformation</h3>

      <div className="case-input-group">
        <input
          type="text"
          className="case-input"
          placeholder="Enter Case ID..."
          value={caseId}
          onChange={e => setCaseId(e.target.value)}
          disabled={disabled || loading}
          title={disabled ? 'Auto-populated with current Study ID' : ''}
        />
        <button
          className="case-load-button"
          onClick={handleLoadCase}
          disabled={disabled || loading}
        >
          {loading ? '⏳' : '📂'} Load
        </button>
      </div>

      <button className="case-identity-button" onClick={handleLoadIdentity}>
        📐 Load Identity Matrix
      </button>

      {error && (
        <div className="case-error">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error}</span>
        </div>
      )}

      {caseInfo && (
        <div className="case-info">
          <div className="info-row">
            <span className="info-label">Case:</span>
            <span className="info-value">{caseInfo.name || caseId}</span>
          </div>
          {caseInfo.dicom_series && (
            <>
              <div className="info-row">
                <span className="info-label">Study:</span>
                <span className="info-value mono small">
                  {caseInfo.dicom_series.fixed_image?.StudyInstanceUID?.substring(0, 20)}...
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Transform:</span>
                <span className="info-value success">
                  ✅ {caseInfo.rMd === 'Identity' ? 'Identity' : 'Loaded'}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      <div className="case-hint">
        💡 Case ID auto-filled with Study ID. Use identity matrix for testing.
      </div>
    </div>
  );
}
