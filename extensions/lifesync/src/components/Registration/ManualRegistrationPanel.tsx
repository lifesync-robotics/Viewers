/**
 * ManualRegistrationPanel
 *
 * Panel for manual fiducial-based registration
 * Similar to Planning Panel but for managing fiducial points
 */

import React, { useState, useEffect } from 'react';
import type { Fiducial, RegistrationSession, RegistrationPanelProps } from './types';
import FiducialList from './FiducialList';
import FiducialEditDialog from './FiducialEditDialog';
import {
  addFiducialAtCrosshairPosition,
  jumpToFiducialPosition,
  syncFiducialsToViewport,
  removeFiducialFromViewport,
  updateFiducialAnnotationInViewport,
  getCrosshairPosition,
} from './fiducialUtils';
import './RegistrationPanel.css';

interface ManualRegistrationPanelProps extends RegistrationPanelProps {
  seriesInstanceUID: string | null;
  caseId: string | null;
  studyInstanceUID: string | null;
}

export default function ManualRegistrationPanel({
  servicesManager,
  commandsManager,
  extensionManager,
  seriesInstanceUID,
  caseId,
  studyInstanceUID,
}: ManualRegistrationPanelProps) {
  const [session, setSession] = useState<RegistrationSession | null>(null);
  const [fiducials, setFiducials] = useState<Fiducial[]>([]);
  const [selectedFiducialId, setSelectedFiducialId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [editingFiducial, setEditingFiducial] = useState<Fiducial | null>(null);

  // Check API connection status
  useEffect(() => {
    const registrationService = servicesManager.services.registrationService;
    if (registrationService) {
      const isConnected = registrationService.isApiConnected();
      if (!isConnected) {
        setError(
          'Registration API not connected. Please check if the server is running on port 5002.'
        );
      }
    }
  }, [servicesManager]);

  // Sync fiducials to viewport when they change
  useEffect(() => {
    if (fiducials.length > 0 && session) {
      syncFiducialsToViewport(servicesManager, fiducials);
    }
  }, [fiducials, session]);

  const initializeSession = async () => {
    if (!seriesInstanceUID) {
      setError('No DICOM series loaded. Please load a study first.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get registration service
      const registrationService = servicesManager.services.registrationService;
      if (!registrationService) {
        throw new Error('Registration service not available');
      }

      if (!registrationService.isApiConnected()) {
        throw new Error('Registration API not connected. Please check if the server is running.');
      }

      console.log('🔄 Initializing registration session...');
      console.log(`   Series UID: ${seriesInstanceUID}`);
      console.log(`   Case ID: ${caseId || 'none'}`);

      // Start registration session via API
      const newSession = await registrationService.startRegistration(seriesInstanceUID, {
        case_id: caseId || undefined,
        method: 'MANUAL_POINT_BASED',
        load_premarked: false,
        expected_points: 6,
      });

      setSession(newSession);
      setSuccessMessage(`Session started: ${newSession.registration_id}`);
      setError(null);
      console.log('✅ Session initialized:', newSession.registration_id);

      // Auto-hide success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize session');
      console.error('❌ Error initializing session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadTemplate = async () => {
    if (!seriesInstanceUID) {
      setError('No DICOM series loaded. Please load a study first.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get registration service
      const registrationService = servicesManager.services.registrationService;
      if (!registrationService) {
        throw new Error('Registration service not available');
      }

      if (!registrationService.isApiConnected()) {
        throw new Error('Registration API not connected. Please check if the server is running.');
      }

      console.log('📥 Loading fiducial template...');
      console.log(`   Series UID: ${seriesInstanceUID}`);

      // Load template via API
      const result = await registrationService.loadFiducials(seriesInstanceUID, {
        case_id: caseId || undefined,
      });

      setFiducials(result.fiducials);
      setTemplateLoaded(true);
      setSuccessMessage(`Template loaded: ${result.fiducials.length} fiducials`);
      setError(null);

      // Sync fiducials to viewport (create annotations)
      syncFiducialsToViewport(servicesManager, result.fiducials);

      console.log(`✅ Loaded template with ${result.fiducials.length} fiducials`);

      // Auto-hide success message after 5 seconds
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
      // Get registration service
      const registrationService = servicesManager.services.registrationService;
      if (!registrationService) {
        throw new Error('Registration service not available');
      }

      if (!registrationService.isApiConnected()) {
        throw new Error('Registration API not connected. Please check if the server is running.');
      }

      console.log('💾 Saving fiducial template...');
      console.log(`   Series UID: ${seriesInstanceUID}`);
      console.log(`   Fiducials: ${fiducials.length}`);

      // Save template via API
      const result = await registrationService.saveFiducials(seriesInstanceUID, fiducials, {
        case_id: caseId || undefined,
        created_by: 'OHIF User',
      });

      setTemplateLoaded(true);
      setSuccessMessage(`Template saved successfully! Template ID: ${result.template_id}`);
      setError(null);
      console.log('✅ Template saved successfully:', result.template_id);

      // Auto-hide success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to save template');
      console.error('❌ Error saving template:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFiducial = async () => {
    // No session required for template editing
    // Session is only needed for actual registration operations (tracker capture, computation)

    if (!seriesInstanceUID) {
      setError('Please load a DICOM study first');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Add fiducial at crosshair position
      const result = addFiducialAtCrosshairPosition(servicesManager);

      if (!result.success) {
        setError(result.error || 'Failed to add fiducial. Make sure crosshairs are active.');
        return;
      }

      if (result.fiducial) {
        // Generate next point ID if needed
        const existingIds = fiducials.map(f => f.point_id);
        let pointId = result.fiducial.point_id;
        if (existingIds.includes(pointId)) {
          let nextId = 1;
          while (existingIds.includes(`F${nextId}`)) {
            nextId++;
          }
          pointId = `F${nextId}`;
        }

        // Add to fiducials list
        const newFiducial: Fiducial = {
          ...result.fiducial,
          point_id: pointId,
          label: pointId, // Use point_id as label (e.g., "F1"), user can edit later
          placed_by: 'OHIF User',
        };

        setFiducials(prev => [...prev, newFiducial]);
        setSelectedFiducialId(newFiducial.point_id);

        // Update session points count if session exists
        if (session) {
          setSession({
            ...session,
            points_collected: fiducials.length + 1,
          });
        }

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
    console.log('✏️ Edit fiducial:', fiducialId);
    const fiducial = fiducials.find(f => f.point_id === fiducialId);
    if (fiducial) {
      // Get current crosshair position
      const crosshairPos = getCrosshairPosition(servicesManager);

      if (crosshairPos && crosshairPos.length >= 3) {
        // Update fiducial position to crosshair position
        const updatedFiducial: Fiducial = {
          ...fiducial,
          dicom_position_mm: [crosshairPos[0], crosshairPos[1], crosshairPos[2]],
        };
        setEditingFiducial(updatedFiducial);
        console.log(`✅ Updated fiducial ${fiducialId} position to crosshair:`, crosshairPos);
      } else {
        // If no crosshair position found, use original position
        console.warn('⚠️ No crosshair position found, using original position');
        setEditingFiducial(fiducial);
      }

      setSelectedFiducialId(fiducialId);
    }
  };

  const handleSaveFiducial = (updatedFiducial: Fiducial) => {
    // Update React state
    setFiducials(prev =>
      prev.map(f => (f.point_id === updatedFiducial.point_id ? updatedFiducial : f))
    );

    // Update viewport annotation (position and label)
    updateFiducialAnnotationInViewport(servicesManager, updatedFiducial);

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

    // Jump to fiducial position in all viewports
    // Note: dicom_position_mm stores RAS coordinates (same as Cornerstone3D world coordinates)
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
      // Remove from viewport annotations
      removeFiducialFromViewport(servicesManager, fiducialId);

      // Remove from state
      setFiducials(prev => prev.filter(f => f.point_id !== fiducialId));
      if (selectedFiducialId === fiducialId) {
        setSelectedFiducialId(null);
      }

      // Update session points count
      if (session) {
        setSession({
          ...session,
          points_collected: Math.max(0, fiducials.length - 1),
        });
      }

      console.log(`✅ Deleted fiducial ${fiducialId}`);
    }
  };

  const handleComputeRegistration = async () => {
    if (!session || fiducials.length < 3) {
      setError('Need at least 3 fiducials to compute registration');
      return;
    }

    if (!seriesInstanceUID) {
      setError('No DICOM series loaded');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get registration service
      const registrationService = servicesManager.services.registrationService;
      if (!registrationService) {
        throw new Error('Registration service not available');
      }

      if (!registrationService.isApiConnected()) {
        throw new Error('Registration API not connected. Please check if the server is running.');
      }

      console.log('🧮 Computing registration...');
      console.log(`   Registration ID: ${session.registration_id}`);
      console.log(`   Series UID: ${seriesInstanceUID}`);
      console.log(`   Fiducials: ${fiducials.length}`);

      const result = await registrationService.computeRegistration(
        seriesInstanceUID,
        session.registration_id,
        {
          method: 'least_squares',
          caseId: caseId || undefined, // Pass caseId
        }
      );

      // Display result
      setSuccessMessage(
        `✅ Registration computed! FRE: ${result.quality_metrics.fre_mm.toFixed(2)}mm, Quality: ${result.quality_metrics.quality}`
      );
      setTimeout(() => setSuccessMessage(null), 10000);

      // Display point residuals
      if (result.point_residuals && result.point_residuals.length > 0) {
        console.log('Point Residuals:');
        result.point_residuals.forEach(residual => {
          console.log(
            `  ${residual.point_id} (${residual.label}): ${residual.error_mm.toFixed(2)}mm`
          );
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to compute registration');
      console.error('❌ Error computing registration:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="manual-registration-panel">
      {/* Error Message */}
      {error && (
        <div className="error-section">
          <div className="error-message">{error}</div>
        </div>
      )}

      {/* Success Message */}
      {successMessage && <div className="success-message">{successMessage}</div>}

      {/* Template Management - Moved to top for better visibility */}
      <div className="section template-management-section">
        <h3>📋 Fiducial Template Management</h3>
        <p
          className="hint"
          style={{ marginBottom: '12px', fontSize: '12px' }}
        >
          Create, edit, and manage fiducial templates. Templates can be saved and reused for
          registration.
        </p>

        {/* Template Status */}
        <div className="template-status">
          {templateLoaded ? (
            <div className="template-info">
              <p>
                ✅ <strong>Template loaded:</strong> {fiducials.length} fiducial
                {fiducials.length !== 1 ? 's' : ''}
              </p>
            </div>
          ) : fiducials.length > 0 ? (
            <div
              className="template-info"
              style={{ background: 'rgba(251, 191, 36, 0.1)', borderLeftColor: '#fbbf24' }}
            >
              <p>
                📝 <strong>Unsaved template:</strong> {fiducials.length} fiducial
                {fiducials.length !== 1 ? 's' : ''} (not saved yet)
              </p>
            </div>
          ) : (
            <p className="hint">
              No template loaded. Create a new template by adding fiducials below.
            </p>
          )}
        </div>

        {/* Template Actions */}
        <div className="button-group">
          <button
            onClick={handleLoadTemplate}
            className={`btn-secondary ${isLoading ? 'loading' : ''}`}
            disabled={!seriesInstanceUID || isLoading}
            title="Load a previously saved template for this DICOM series"
          >
            {isLoading ? 'Loading...' : '📥 Load Template'}
          </button>
          <button
            onClick={handleSaveTemplate}
            className={`btn-primary ${isLoading ? 'loading' : ''}`}
            disabled={fiducials.length === 0 || isLoading}
            title="Save current fiducials as a template"
          >
            {isLoading ? 'Saving...' : '💾 Save Template'}
          </button>
        </div>
      </div>

      {/* Add Fiducial Button - Available without session for template editing */}
      <div className="section">
        <h3>📍 Add Fiducial Points</h3>
        <p
          className="hint"
          style={{ marginBottom: '12px', fontSize: '12px' }}
        >
          Position the crosshair on an anatomical landmark in the viewport, then click to add a
          fiducial point.
        </p>
        <button
          onClick={handleAddFiducial}
          className={`btn-primary ${isLoading ? 'loading' : ''}`}
          disabled={!seriesInstanceUID || isLoading}
        >
          {isLoading ? 'Adding...' : '📍 Add Fiducial at Crosshair'}
        </button>
        {!seriesInstanceUID && (
          <p
            className="hint"
            style={{ color: '#fbbf24', marginTop: '8px' }}
          >
            ⚠️ Please load a DICOM study first
          </p>
        )}
      </div>

      {/* Fiducial List */}
      {fiducials.length > 0 ? (
        <div className="section">
          <h3>✏️ Edit Fiducials ({fiducials.length})</h3>
          <p
            className="hint"
            style={{ marginBottom: '12px', fontSize: '12px' }}
          >
            Click on a fiducial to select it, then use the buttons to edit, jump to, or delete it.
          </p>
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
          <h3>✏️ Edit Fiducials</h3>
          <p
            className="hint"
            style={{ textAlign: 'center', padding: '20px', color: '#8892b0' }}
          >
            No fiducials yet. Add your first fiducial point above to get started.
          </p>
        </div>
      )}

      {/* Compute Registration */}
      {session && fiducials.length >= 3 && (
        <div className="section">
          <button
            onClick={handleComputeRegistration}
            className={`btn-success btn-large ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? 'Computing...' : '🧮 Compute Registration'}
          </button>
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
