/**
 * FiducialItem Component
 *
 * Displays a single fiducial point with edit/delete actions
 */

import React, { useState } from 'react';
import type { Fiducial } from './types';
import './RegistrationPanel.css';

interface FiducialItemProps {
  fiducial: Fiducial;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onJumpTo: () => void;
}

export default function FiducialItem({
  fiducial,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onJumpTo,
}: FiducialItemProps) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleDelete = () => {
    if (showConfirmDelete) {
      onDelete();
      setShowConfirmDelete(false);
    } else {
      setShowConfirmDelete(true);
      // Auto-hide confirmation after 3 seconds
      setTimeout(() => setShowConfirmDelete(false), 3000);
    }
  };

  const getStatusIcon = () => {
    switch (fiducial.status) {
      case 'captured':
        return '✓';
      case 'validated':
        return '✓✓';
      default:
        return '○';
    }
  };

  const getStatusColor = () => {
    switch (fiducial.status) {
      case 'captured':
        return '#10b981';
      case 'validated':
        return '#3b82f6';
      default:
        return '#8892b0';
    }
  };

  const formatPosition = (pos: number[]) => {
    return `[${pos.map(v => v.toFixed(1)).join(', ')}]`;
  };

  return (
    <div
      className={`fiducial-item ${isSelected ? 'active' : ''} ${
        fiducial.status === 'captured' || fiducial.status === 'validated' ? 'captured' : ''
      }`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="fid-header">
        <div className="fid-id-section">
          <span className="fid-id">{fiducial.point_id}</span>
          <span
            className="fid-status"
            style={{ color: getStatusColor() }}
            title={fiducial.status}
          >
            {getStatusIcon()}
          </span>
        </div>
        <div className="fid-source-badge">
          {fiducial.source === 'template' ? '📋' : '📍'}
        </div>
      </div>

      {/* Label */}
      <div className="fid-label">{fiducial.label}</div>
      {fiducial.anatomical_landmark && (
        <div className="fid-landmark">{fiducial.anatomical_landmark}</div>
      )}

      {/* DICOM Position */}
      <div className="fid-position">
        <span className="position-label">DICOM:</span>
        <span className="position-value">{formatPosition(fiducial.dicom_position_mm)}</span>
      </div>

      {/* Tracker Position (if captured) */}
      {fiducial.tracker_position_mm && (
        <div className="fid-tracker">
          <span className="position-label">Tracker:</span>
          <span className="position-value">{formatPosition(fiducial.tracker_position_mm)}</span>
        </div>
      )}

      {/* Quality Score */}
      {fiducial.quality_score !== undefined && (
        <div className="fid-quality">
          <span className="quality-label">Quality:</span>
          <span className="quality-value">{fiducial.quality_score.toFixed(2)}</span>
          <div className="quality-bar">
            <div
              className="quality-bar-fill"
              style={{
                width: `${fiducial.quality_score * 100}%`,
                backgroundColor:
                  fiducial.quality_score > 0.8
                    ? '#10b981'
                    : fiducial.quality_score > 0.6
                    ? '#fbbf24'
                    : '#ef4444',
              }}
            />
          </div>
        </div>
      )}

      {/* Stability (if available) */}
      {fiducial.stability_mm !== undefined && (
        <div className="fid-stability">
          <span className="stability-label">Stability:</span>
          <span className="stability-value">{fiducial.stability_mm.toFixed(2)}mm</span>
        </div>
      )}

      {/* Confidence */}
      {fiducial.confidence && (
        <div className="fid-confidence">
          <span className="confidence-label">Confidence:</span>
          <span
            className={`confidence-value confidence-${fiducial.confidence}`}
          >
            {fiducial.confidence}
          </span>
        </div>
      )}

      {/* Notes */}
      {fiducial.notes && (
        <div className="fid-notes" title={fiducial.notes}>
          📝 {fiducial.notes.length > 30 ? `${fiducial.notes.slice(0, 30)}...` : fiducial.notes}
        </div>
      )}

      {/* Actions */}
      <div className="fid-actions" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onJumpTo}
          className="btn-small btn-jump"
          title="Jump to fiducial position"
        >
          🎯 Jump
        </button>
        <button
          onClick={onEdit}
          className="btn-small"
          title="Edit fiducial"
        >
          ✏️ Edit
        </button>
        <button
          onClick={handleDelete}
          className={`btn-small btn-danger ${showConfirmDelete ? 'confirm' : ''}`}
          title={showConfirmDelete ? 'Click again to confirm' : 'Delete fiducial'}
        >
          {showConfirmDelete ? '⚠️ Confirm' : '🗑️ Delete'}
        </button>
      </div>
    </div>
  );
}
