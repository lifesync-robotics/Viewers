/**
 * FiducialEditDialog Component
 *
 * Dialog for editing fiducial properties
 */

import React, { useState, useEffect } from 'react';
import type { Fiducial } from './types';
import './RegistrationPanel.css';

interface FiducialEditDialogProps {
  fiducial: Fiducial | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (fiducial: Fiducial) => void;
}

export default function FiducialEditDialog({
  fiducial,
  isOpen,
  onClose,
  onSave,
}: FiducialEditDialogProps) {
  const [label, setLabel] = useState('');
  const [anatomicalLandmark, setAnatomicalLandmark] = useState('');
  const [notes, setNotes] = useState('');
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('high');

  useEffect(() => {
    if (fiducial) {
      setLabel(fiducial.label || '');
      setAnatomicalLandmark(fiducial.anatomical_landmark || '');
      setNotes(fiducial.notes || '');
      setConfidence((fiducial.confidence as 'high' | 'medium' | 'low') || 'high');
    }
  }, [fiducial]);

  if (!isOpen || !fiducial) {
    return null;
  }

  const handleSave = () => {
    const updatedFiducial: Fiducial = {
      ...fiducial,
      label,
      anatomical_landmark: anatomicalLandmark,
      notes,
      confidence,
    };
    onSave(updatedFiducial);
    onClose();
  };

  const handleCancel = () => {
    // Reset to original values
    if (fiducial) {
      setLabel(fiducial.label || '');
      setAnatomicalLandmark(fiducial.anatomical_landmark || '');
      setNotes(fiducial.notes || '');
      setConfidence((fiducial.confidence as 'high' | 'medium' | 'low') || 'high');
    }
    onClose();
  };

  return (
    <div className="dialog-overlay" onClick={handleCancel}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Edit Fiducial: {fiducial.point_id}</h3>
          <button className="dialog-close" onClick={handleCancel}>
            ✕
          </button>
        </div>

        <div className="dialog-body">
          <div className="form-group">
            <label>Label:</label>
            <input
              type="text"
              className="input-field"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Fiducial label"
            />
          </div>

          <div className="form-group">
            <label>Anatomical Landmark:</label>
            <input
              type="text"
              className="input-field"
              value={anatomicalLandmark}
              onChange={(e) => setAnatomicalLandmark(e.target.value)}
              placeholder="e.g., C7_spinous, L1_spinous"
            />
          </div>

          <div className="form-group">
            <label>Confidence:</label>
            <select
              className="select-field"
              value={confidence}
              onChange={(e) => setConfidence(e.target.value as 'high' | 'medium' | 'low')}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="form-group">
            <label>Notes:</label>
            <textarea
              className="input-field"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>DICOM Position (mm):</label>
            <div className="position-display">
              [{fiducial.dicom_position_mm.map(v => v.toFixed(2)).join(', ')}]
            </div>
          </div>

          {fiducial.tracker_position_mm && (
            <div className="form-group">
              <label>Tracker Position (mm):</label>
              <div className="position-display">
                [{fiducial.tracker_position_mm.map(v => v.toFixed(2)).join(', ')}]
              </div>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
