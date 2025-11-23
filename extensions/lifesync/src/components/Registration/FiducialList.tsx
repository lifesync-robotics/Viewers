/**
 * FiducialList Component
 *
 * Displays a list of fiducial points with selection and actions
 */

import React from 'react';
import type { Fiducial } from './types';
import FiducialItem from './FiducialItem';
import './RegistrationPanel.css';

interface FiducialListProps {
  fiducials: Fiducial[];
  selectedFiducialId?: string | null;
  onSelectFiducial: (fiducialId: string) => void;
  onEditFiducial: (fiducialId: string) => void;
  onDeleteFiducial: (fiducialId: string) => void;
  onJumpToFiducial: (fiducialId: string) => void;
}

export default function FiducialList({
  fiducials,
  selectedFiducialId,
  onSelectFiducial,
  onEditFiducial,
  onDeleteFiducial,
  onJumpToFiducial,
}: FiducialListProps) {
  if (fiducials.length === 0) {
    return (
      <div className="fiducial-list-empty">
        <p className="hint">No fiducials yet. Add fiducials using the "Add Fiducial at Crosshair" button.</p>
      </div>
    );
  }

  // Sort fiducials: captured first, then by point_id
  const sortedFiducials = [...fiducials].sort((a, b) => {
    // Captured/validated first
    if (a.status === 'captured' || a.status === 'validated') {
      if (b.status !== 'captured' && b.status !== 'validated') return -1;
    } else if (b.status === 'captured' || b.status === 'validated') {
      return 1;
    }
    // Then sort by point_id (F1, F2, F10, etc.)
    return a.point_id.localeCompare(b.point_id, undefined, { numeric: true, sensitivity: 'base' });
  });

  // Statistics
  const stats = {
    total: fiducials.length,
    pending: fiducials.filter(f => f.status === 'pending').length,
    captured: fiducials.filter(f => f.status === 'captured').length,
    validated: fiducials.filter(f => f.status === 'validated').length,
    fromTemplate: fiducials.filter(f => f.source === 'template').length,
    intraop: fiducials.filter(f => f.source === 'intraop').length,
  };

  return (
    <div className="fiducial-list-container">
      {/* Statistics */}
      <div className="fiducial-stats">
        <div className="stat-item">
          <span className="stat-label">Total:</span>
          <span className="stat-value">{stats.total}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Pending:</span>
          <span className="stat-value stat-pending">{stats.pending}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Captured:</span>
          <span className="stat-value stat-captured">{stats.captured}</span>
        </div>
        {stats.validated > 0 && (
          <div className="stat-item">
            <span className="stat-label">Validated:</span>
            <span className="stat-value stat-validated">{stats.validated}</span>
          </div>
        )}
        <div className="stat-item">
          <span className="stat-label">Template:</span>
          <span className="stat-value">{stats.fromTemplate}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Intraop:</span>
          <span className="stat-value">{stats.intraop}</span>
        </div>
      </div>

      {/* Fiducial List */}
      <div className="fiducial-scroll">
        {sortedFiducials.map((fiducial) => (
          <FiducialItem
            key={fiducial.point_id}
            fiducial={fiducial}
            isSelected={selectedFiducialId === fiducial.point_id}
            onSelect={() => onSelectFiducial(fiducial.point_id)}
            onEdit={() => onEditFiducial(fiducial.point_id)}
            onDelete={() => onDeleteFiducial(fiducial.point_id)}
            onJumpTo={() => onJumpToFiducial(fiducial.point_id)}
          />
        ))}
      </div>
    </div>
  );
}
