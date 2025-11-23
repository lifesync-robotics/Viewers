/**
 * FiducialTemplateEditorPanel
 *
 * Tab 2: Fiducial Template Editing
 * Similar to ScrewManagementPanel but for managing fiducial templates
 * - Create new template
 * - Open existing template to modify
 * - Add, edit, delete fiducials
 * - Save template
 */

import React, { useState, useEffect } from 'react';
import type { Fiducial, RegistrationPanelProps } from './types';
import FiducialList from './FiducialList';
import FiducialEditDialog from './FiducialEditDialog';
import {
  addFiducialAtCrosshairPosition,
  jumpToFiducialPosition,
  syncFiducialsToViewport,
  removeFiducialFromViewport,
} from './fiducialUtils';
import './RegistrationPanel.css';

interface FiducialTemplateEditorPanelProps extends RegistrationPanelProps {
  seriesInstanceUID: string | null;
  caseId: string | null;
  studyInstanceUID: string | null;
}

export default function FiducialTemplateEditorPanel({
  servicesManager,
  commandsManager,
  extensionManager,
  seriesInstanceUID,
  caseId,
  studyInstanceUID,
}: FiducialTemplateEditorPanelProps) {
  const [fiducials, setFiducials] = useState<Fiducial[]>([]);
  const [selectedFiducialId, setSelectedFiducialId] = useState<string | null>(null);
  const [editingFiducial, setEditingFiducial] = useState<Fiducial | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);

  // Sync fiducials to viewport when they change
  useEffect(() => {
    if (fiducials.length > 0) {
      syncFiducialsToViewport(servicesManager, fiducials);
    }
  }, [fiducials, servicesManager]);

  // Check API connection status
  useEffect(() => {
    const registrationService = servicesManager.services.registrationService;
    if (registrationService) {
      const isConnected = registrationService.isApiConnected();
      if (!isConnected) {
        setError('Registration API not connected. Please check if the server is running on port 5002.');
      }
    }
  }, [servicesManager]);

  const handleCreateNewTemplate = () => {
    setFiducials([]);
    setTemplateLoaded(false);
    setTemplateId(null);
    setSelectedFiducialId(null);
    setSuccessMessage('New template created. Start adding fiducials below.');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

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

      setFiducials(result.fiducials);
      setTemplateLoaded(true);
      setTemplateId(result.template_id);
      setSuccessMessage(`Template loaded: ${result.fiducials.length} fiducials`);
      setError(null);

      // Sync fiducials to viewport
      syncFiducialsToViewport(servicesManager, result.fiducials);

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to load template');
      console.error('❌ Error loading template:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!seriesInstanceUID || fiducials.length === 0) {
      setError('No fiducials to save');
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

      console.log('💾 Saving fiducial template...');
      const result = await registrationService.saveFiducials(seriesInstanceUID, fiducials, {
        case_id: caseId || undefined,
        created_by: 'OHIF User',
      });

      setTemplateLoaded(true);
      setTemplateId(result.template_id);
      setSuccessMessage(`Template saved successfully! Template ID: ${result.template_id}`);
      setError(null);

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to save template');
      console.error('❌ Error saving template:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFiducial = async () => {
    if (!seriesInstanceUID) {
      setError('Please load a DICOM study first');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = addFiducialAtCrosshairPosition(servicesManager);

      if (!result.success) {
        setError(result.error || 'Failed to add fiducial. Make sure crosshairs are active.');
        return;
      }

      if (result.fiducial) {
        // Generate next point ID
        const existingIds = fiducials.map(f => f.point_id);
        let pointId = result.fiducial.point_id;
        if (existingIds.includes(pointId)) {
          let nextId = 1;
          while (existingIds.includes(`F${nextId}`)) {
            nextId++;
          }
          pointId = `F${nextId}`;
        }

        const newFiducial: Fiducial = {
          ...result.fiducial,
          point_id: pointId,
          label: `Fiducial ${fiducials.length + 1}`,
          placed_by: 'OHIF User',
        };

        setFiducials(prev => [...prev, newFiducial]);
        setSelectedFiducialId(newFiducial.point_id);
        setSuccessMessage(`Fiducial ${pointId} added`);
        setTimeout(() => setSuccessMessage(null), 3000);

        console.log('✅ Fiducial added:', newFiducial);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add fiducial');
      console.error('❌ Error adding fiducial:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditFiducial = (fiducialId: string) => {
    const fiducial = fiducials.find(f => f.point_id === fiducialId);
    if (fiducial) {
      setEditingFiducial(fiducial);
      setSelectedFiducialId(fiducialId);
    }
  };

  const handleSaveFiducial = (updatedFiducial: Fiducial) => {
    setFiducials(prev =>
      prev.map(f => (f.point_id === updatedFiducial.point_id ? updatedFiducial : f))
    );
    setSuccessMessage(`Fiducial ${updatedFiducial.point_id} updated`);
    setTimeout(() => setSuccessMessage(null), 3000);
    console.log('✅ Fiducial updated:', updatedFiducial);
  };

  const handleJumpToFiducial = (fiducialId: string) => {
    const fiducial = fiducials.find(f => f.point_id === fiducialId);
    if (!fiducial) {
      setError(`Fiducial ${fiducialId} not found`);
      return;
    }

    const success = jumpToFiducialPosition(
      servicesManager,
      fiducial.dicom_position_mm as [number, number, number]
    );

    if (success) {
      setSelectedFiducialId(fiducialId);
      console.log(`✅ Jumped to fiducial ${fiducialId}`);
    } else {
      setError('Failed to jump to fiducial position');
    }
  };

  const handleDeleteFiducial = (fiducialId: string) => {
    if (window.confirm('Are you sure you want to delete this fiducial?')) {
      removeFiducialFromViewport(servicesManager, fiducialId);
      setFiducials(prev => prev.filter(f => f.point_id !== fiducialId));
      if (selectedFiducialId === fiducialId) {
        setSelectedFiducialId(null);
      }
      setSuccessMessage(`Fiducial ${fiducialId} deleted`);
      setTimeout(() => setSuccessMessage(null), 3000);
      console.log(`✅ Deleted fiducial ${fiducialId}`);
    }
  };

  return (
    <div className="fiducial-template-editor-panel">
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

      {/* Template Management */}
      <div className="section template-management-section">
        <h3>Template Management</h3>
        <div className="button-group">
          <button
            onClick={handleCreateNewTemplate}
            className="btn-secondary"
            disabled={isLoading}
          >
            ➕ Create New Template
          </button>
          <button
            onClick={handleLoadTemplate}
            className={`btn-secondary ${isLoading ? 'loading' : ''}`}
            disabled={!seriesInstanceUID || isLoading}
          >
            {isLoading ? 'Loading...' : '📂 Open Existing Template'}
          </button>
        </div>
        {templateLoaded && templateId && (
          <div className="template-info">
            <p>✅ Template loaded: {templateId}</p>
            <p>Fiducials: {fiducials.length}</p>
          </div>
        )}
      </div>

      {/* Add Fiducial */}
      <div className="section">
        <h3>Add Fiducial</h3>
        <p className="hint" style={{ marginBottom: '12px', fontSize: '12px' }}>
          Position the crosshair on an anatomical landmark in the viewport, then click to add a fiducial point.
        </p>
        <button
          onClick={handleAddFiducial}
          className={`btn-primary ${isLoading ? 'loading' : ''}`}
          disabled={!seriesInstanceUID || isLoading}
        >
          {isLoading ? 'Adding...' : '📍 Add Fiducial at Crosshair'}
        </button>
        {!seriesInstanceUID && (
          <p className="hint" style={{ color: '#fbbf24', marginTop: '8px' }}>
            ⚠️ Please load a DICOM study first
          </p>
        )}
      </div>

      {/* Fiducial List */}
      {fiducials.length > 0 ? (
        <div className="section">
          <h3>Fiducials ({fiducials.length})</h3>
          <FiducialList
            fiducials={fiducials}
            selectedFiducialId={selectedFiducialId}
            onSelectFiducial={setSelectedFiducialId}
            onEditFiducial={handleEditFiducial}
            onDeleteFiducial={handleDeleteFiducial}
            onJumpToFiducial={handleJumpToFiducial}
          />
        </div>
      ) : (
        <div className="section">
          <h3>Fiducials</h3>
          <p className="hint" style={{ textAlign: 'center', padding: '20px', color: '#8892b0' }}>
            No fiducials yet. Create a new template or open an existing one, then add your first fiducial point above.
          </p>
        </div>
      )}

      {/* Save Template */}
      {fiducials.length > 0 && (
        <div className="section">
          <button
            onClick={handleSaveTemplate}
            className={`btn-success btn-large ${isLoading ? 'loading' : ''}`}
            disabled={!seriesInstanceUID || fiducials.length === 0 || isLoading}
          >
            {isLoading ? 'Saving...' : '💾 Save Template'}
          </button>
          <p className="hint" style={{ marginTop: '8px', fontSize: '12px' }}>
            Save the current fiducials as a template for this DICOM series
          </p>
        </div>
      )}

      {/* Edit Dialog */}
      <FiducialEditDialog
        fiducial={editingFiducial}
        isOpen={editingFiducial !== null}
        onClose={() => setEditingFiducial(null)}
        onSave={handleSaveFiducial}
      />
    </div>
  );
}
