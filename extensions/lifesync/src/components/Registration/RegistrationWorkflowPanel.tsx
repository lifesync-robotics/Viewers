/**
 * RegistrationWorkflowPanel
 *
 * Tab 1: Registration Workflow Control
 * - Select registration method (Manual Point-based or Auto)
 * - Load Template button
 * - Start Session button
 * - API connection status
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  Fiducial,
  RegistrationPanelProps,
  RegistrationSession,
  RegistrationResult,
} from './types';
import './RegistrationPanel.css';
import FiducialList from './FiducialList';
import FiducialEditDialog from './FiducialEditDialog';
import {
  addFiducialAtCrosshairPosition,
  syncFiducialsToViewport,
  jumpToFiducialPosition,
  removeFiducialFromViewport,
  getCrosshairPosition,
  updateFiducialAnnotationInViewport,
  projectPatientPointsToDicom,
  transformPointWithMatrix,
} from './fiducialUtils';
import type { TrackingUpdateEvent } from '../../types/tracking.types';
import { saveBackup, loadBackup, clearBackup, getBackupAge } from '../../utils/localStorageBackup';

interface RegistrationWorkflowPanelProps extends RegistrationPanelProps {
  seriesInstanceUID: string | null;
  caseId: string | null;
  studyInstanceUID: string | null;
  onSessionStarted?: (registrationId: string) => void;
}

export default function RegistrationWorkflowPanel({
  servicesManager,
  commandsManager,
  extensionManager,
  seriesInstanceUID,
  caseId,
  studyInstanceUID,
  onSessionStarted,
}: RegistrationWorkflowPanelProps) {
  const [method] = useState<'MANUAL_POINT_BASED' | 'PHANTOM_AUTO'>('MANUAL_POINT_BASED');
  const [session, setSession] = useState<RegistrationSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [apiConnected, setApiConnected] = useState<boolean>(false);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [fiducials, setFiducials] = useState<Fiducial[]>([]);
  const [selectedFiducialId, setSelectedFiducialId] = useState<string | null>(null);
  const [currentToolPosition, setCurrentToolPosition] = useState<[number, number, number] | null>(
    null
  );
  const [trackingConnected, setTrackingConnected] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<RegistrationResult | null>(null);
  // Add editing-related state
  const [editingFiducial, setEditingFiducial] = useState<Fiducial | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  // Add algorithm selection and point modification state
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<'least_squares' | 'icp'>(
    'least_squares'
  );
  const [pointsModified, setPointsModified] = useState(false);
  // Track if we've restored from backup to avoid duplicate prompts
  const backupRestoredRef = useRef(false);

  // ========================================================================
  // LOCAL STORAGE BACKUP & RECOVERY
  // ========================================================================

  /**
   * Save current state to localStorage as backup
   */
  const saveToBackup = useCallback(() => {
    if (!seriesInstanceUID || fiducials.length === 0) {
      return;
    }

    saveBackup(seriesInstanceUID, {
      fiducials,
      templateId,
      registrationId: session?.registration_id || null,
      mode: templateLoaded ? 'template' : 'registration',
    });
  }, [seriesInstanceUID, fiducials, templateId, session, templateLoaded]);

  /**
   * Load backup from localStorage and prompt user to restore
   */
  useEffect(() => {
    if (!seriesInstanceUID || backupRestoredRef.current) {
      return;
    }

    const backup = loadBackup(seriesInstanceUID);
    if (!backup) {
      return;
    }

    // Only prompt if we don't have current data
    if (fiducials.length === 0 && !session) {
      const ageHours = getBackupAge(seriesInstanceUID) || 0;
      const ageText =
        ageHours < 1 ? `${Math.round(ageHours * 60)} minutes` : `${ageHours.toFixed(1)} hours`;

      if (window.confirm(`Found unsaved work from ${ageText} ago. Restore?`)) {
        setFiducials(backup.fiducials);
        if (backup.templateId) {
          setTemplateId(backup.templateId);
          setTemplateLoaded(true);
        }
        if (backup.registrationId) {
          // Note: We can't fully restore session without API call, but we can restore points
          setSuccessMessage(`Restored ${backup.fiducials.length} points from backup`);
          setTimeout(() => setSuccessMessage(null), 5000);
        }
        backupRestoredRef.current = true;
      } else {
        // User chose not to restore, clear the backup
        clearBackup(seriesInstanceUID);
      }
    }
  }, [seriesInstanceUID, fiducials.length, session]);

  /**
   * Auto-save to backup whenever fiducials change
   */
  useEffect(() => {
    if (seriesInstanceUID && fiducials.length > 0) {
      saveToBackup();
    }
  }, [seriesInstanceUID, fiducials, saveToBackup]);

  // Check API connection status
  useEffect(() => {
    const registrationService = servicesManager.services.registrationService;
    if (registrationService) {
      const checkConnection = () => {
        const isConnected = registrationService.isApiConnected();
        setApiConnected(isConnected);
      };

      checkConnection();

      const subscription = registrationService.subscribe(
        'event::registration_connection_status',
        (data: { connected?: boolean }) => {
          setApiConnected(data.connected || false);
        }
      );

      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    }
  }, [servicesManager]);

  /**
   * Check if a 4x4 matrix is an identity matrix (with floating point tolerance)
   */
  const isIdentityMatrix = (
    matrix: number[] | number[][] | null | undefined,
    tolerance: number = 1e-6
  ): boolean => {
    if (!matrix) {
      return true;
    }

    // Convert to 2D array
    let matrix2D: number[][];

    if (Array.isArray(matrix[0])) {
      matrix2D = matrix as number[][];
    } else {
      // Convert 1D array to 2D (16 elements)
      const flat = matrix as number[];
      if (flat.length !== 16) {
        return false;
      }
      matrix2D = [
        [flat[0], flat[1], flat[2], flat[3]],
        [flat[4], flat[5], flat[6], flat[7]],
        [flat[8], flat[9], flat[10], flat[11]],
        [flat[12], flat[13], flat[14], flat[15]],
      ];
    }

    // Check dimensions
    if (matrix2D.length !== 4 || matrix2D.some(row => row.length !== 4)) {
      return false;
    }

    // Check if identity matrix
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const expected = i === j ? 1 : 0;
        const actual = matrix2D[i][j];
        if (Math.abs(actual - expected) > tolerance) {
          return false;
        }
      }
    }

    return true;
  };

  // Load existing registration matrix and auto-select algorithm
  useEffect(() => {
    const loadExistingRegistration = async () => {
      if (!seriesInstanceUID || !caseId) {
        return;
      }

      try {
        const registrationService = servicesManager.services?.registrationService;
        const trackingService = servicesManager.services?.trackingService;

        if (!registrationService || !trackingService) {
          return;
        }

        // Load registration matrix
        const loaded = await trackingService.loadRegistrationMatrix(seriesInstanceUID, caseId);

        if (loaded) {
          console.log('✅ Loaded registration matrix from database');

          // Check if matrix is identity
          const prMdMatrix = trackingService.getPrToDicomMatrix();
          const isIdentity = isIdentityMatrix(prMdMatrix);

          if (!isIdentity) {
            console.log('🔍 Non-identity registration matrix found - auto-selecting ICP algorithm');
            setSelectedAlgorithm('icp');
          } else {
            console.log('ℹ️ Identity matrix found - using least squares');
            setSelectedAlgorithm('least_squares');
          }
        } else {
          console.log('ℹ️ No registration matrix found - using identity matrix (not registered)');
          setSelectedAlgorithm('least_squares');
        }
      } catch (error) {
        console.log('ℹ️ No existing registration found or failed to load');
        setSelectedAlgorithm('least_squares');
      }
    };

    loadExistingRegistration();
  }, [seriesInstanceUID, caseId, servicesManager]);

  // Sync fiducials to viewport when they change
  useEffect(() => {
    if (fiducials.length > 0) {
      syncFiducialsToViewport(servicesManager, fiducials);
    }
  }, [fiducials, servicesManager]);

  // Subscribe to TrackingService to get NDI data (use data already processed by TrackingService)
  useEffect(() => {
    const trackingService = servicesManager.services.trackingService;
    if (!trackingService) {
      console.warn('⚠️ TrackingService not available');
      return;
    }

    // Subscribe to tracking update events (TrackingService has already processed all data)
    const trackingSubscription = trackingService.subscribe(
      'event::tracking_update',
      (data: TrackingUpdateEvent) => {
        // Use tool data already processed by TrackingService
        if (data.tools && Object.keys(data.tools).length > 0) {
          // Find first non-PR tool (usually pointer/stylus) for capture
          for (const [toolId, toolData] of Object.entries(data.tools)) {
            if (!toolData.is_patient_reference && toolData.visible) {
              // ✅  tooltip_position_mm
              const tooltipPosition = toolData.coordinates?.patient_reference?.tooltip_position_mm;

              if (
                tooltipPosition &&
                Array.isArray(tooltipPosition) &&
                tooltipPosition.length >= 3
              ) {
                setCurrentToolPosition(tooltipPosition as [number, number, number]);
              } else {
                console.error(
                  `❌ Tooltip position not available for tool ${toolId} - calibration may be missing`
                );
                setCurrentToolPosition(null);
              }
              break; // Only use the first tool found
            }
          }
        }

        setTrackingConnected(true);
      }
    );

    const connectionSubscription = trackingService.subscribe(
      'event::connection_status',
      (data: { connected?: boolean }) => {
        setTrackingConnected(data.connected || false);
      }
    );

    return () => {
      if (trackingSubscription) {
        trackingSubscription.unsubscribe();
      }
      if (connectionSubscription) {
        connectionSubscription.unsubscribe();
      }
    };
  }, [servicesManager]);

  const handleLoadTemplate = async () => {
    if (!seriesInstanceUID) {
      setError('No DICOM series loaded. Please load a study first.');
      return;
    }

    if (!caseId) {
      setError('Case ID is required to load template. Please ensure case ID is available.');
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
        case_id: caseId,
      });

      const templateFiducials: Fiducial[] = result.fiducials.map((f: Fiducial) => ({
        ...f,
        source: 'template' as const,
      }));

      setFiducials(templateFiducials);
      setTemplateLoaded(true);
      setTemplateId(result.template_id); // Save template_id
      setSuccessMessage(`Template loaded: ${result.fiducials.length} fiducials`);
      setError(null);

      // Sync to viewport to display points
      syncFiducialsToViewport(servicesManager, templateFiducials);

      console.log(`✅ Loaded template with ${result.fiducials.length} fiducials`);

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load template';
      setError(errorMessage);
      console.error('❌ Error loading template:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Add fiducial point (Registration mode)
   * - Only updates frontend state immediately
   * - Auto-saves to backend asynchronously (non-blocking)
   * - Saves to localStorage backup
   */
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
          label: pointId,
          source: 'intraop', // Points on patient
          placed_by: 'OHIF User',
        };

        // Update frontend state immediately (UI responds instantly)
        const updatedFiducials = [...fiducials, newFiducial];
        setFiducials(updatedFiducials);
        setSelectedFiducialId(newFiducial.point_id);

        // Sync fiducials to viewport to display points on DICOM
        syncFiducialsToViewport(servicesManager, updatedFiducials);

        // If registration result exists, mark points as modified to show recompute button
        if (registrationResult) {
          setPointsModified(true);
          setSuccessMessage(
            `✅ Point ${pointId} added. Please recompute registration to include the new point.`
          );
          setTimeout(() => setSuccessMessage(null), 5000);
        }

        // Auto-save to backend asynchronously (non-blocking, doesn't wait for result)
        if (session?.registration_id) {
          const registrationService = servicesManager.services.registrationService;
          if (registrationService && registrationService.isApiConnected()) {
            // Fire and forget - saves in background
            registrationService.addIntraopFiducialAsync(
              seriesInstanceUID,
              session.registration_id,
              {
                point_id: newFiducial.point_id,
                label: newFiducial.label,
                dicom_position_mm: newFiducial.dicom_position_mm,
                reason: 'Added new point during registration workflow',
              },
              caseId || undefined
            );
          }
        }

        console.log('✅ Fiducial added (auto-saving in background):', newFiducial);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add fiducial';
      setError(errorMessage);
      console.error('❌ Error adding fiducial:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJumpToFiducial = (fiducialId: string) => {
    const fiducial = fiducials.find(f => f.point_id === fiducialId);
    if (!fiducial) {
      setError(`Fiducial ${fiducialId} not found`);
      return;
    }

    // Note: dicom_position_mm stores RAS coordinates (same as Cornerstone3D world coordinates)
    const success = jumpToFiducialPosition(
      servicesManager,
      fiducial.dicom_position_mm as [number, number, number]
    );

    if (success) {
      setSelectedFiducialId(fiducialId);
    } else {
      setError('Failed to jump to fiducial position');
    }
  };

  // Edit point
  const handleEditFiducial = (fiducialId: string) => {
    const fiducial = fiducials.find(f => f.point_id === fiducialId);
    if (fiducial) {
      // Get current crosshair position as new DICOM position
      const crosshairPos = getCrosshairPosition(servicesManager);
      const fiducialToEdit = { ...fiducial };
      if (crosshairPos) {
        fiducialToEdit.dicom_position_mm = crosshairPos as [number, number, number];
      }
      setEditingFiducial(fiducialToEdit);
    }
  };

  /**
   * Save edited fiducial
   * - Registration mode: Only updates frontend state, saves will happen during compute
   * - Template mode: Should not be used here (use FiducialTemplateEditorPanel instead)
   */
  const handleSaveFiducial = async (updatedFiducial: Fiducial) => {
    // Update frontend state immediately
    const updatedFiducials = fiducials.map(f =>
      f.point_id === updatedFiducial.point_id ? updatedFiducial : f
    );
    setFiducials(updatedFiducials);

    // Update viewport display
    updateFiducialAnnotationInViewport(servicesManager, updatedFiducial);

    // Mark points as modified
    setPointsModified(true);

    // If registration result exists, prompt for recomputation
    if (registrationResult) {
      setSuccessMessage(
        `✅ Point ${updatedFiducial.point_id} updated. Please recompute registration to update transformation matrix.`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    }

    // Auto-save to backend asynchronously (only in Registration mode with active session)
    if (session?.registration_id && !templateLoaded) {
      const registrationService = servicesManager.services.registrationService;
      if (registrationService && registrationService.isApiConnected()) {
        // Auto-save in background (non-blocking)
        if (seriesInstanceUID) {
          registrationService.addIntraopFiducialAsync(
            seriesInstanceUID,
            session.registration_id,
            {
              point_id: updatedFiducial.point_id,
              label: updatedFiducial.label,
              dicom_position_mm: updatedFiducial.dicom_position_mm,
              reason: 'Updated point position during registration workflow',
            },
            caseId || undefined
          );
        }
      }
    }

    // Note: Template mode editing should be done in FiducialTemplateEditorPanel
    // This panel is for Registration workflow only
    setSuccessMessage(`✅ Point ${updatedFiducial.point_id} updated (auto-saving in background)`);
    setTimeout(() => setSuccessMessage(null), 3000);

    setEditingFiducial(null);
  };

  const handleDeleteFiducial = (fiducialId: string) => {
    if (window.confirm('Are you sure you want to delete this fiducial?')) {
      removeFiducialFromViewport(servicesManager, fiducialId);
      setFiducials(prev => prev.filter(f => f.point_id !== fiducialId));
      if (selectedFiducialId === fiducialId) {
        setSelectedFiducialId(null);
      }
    }
  };

  /**
   * Capture tracker position for a fiducial (Registration mode)
   * - Updates frontend state immediately
   * - Auto-saves to backend asynchronously (non-blocking)
   * - Saves to localStorage backup
   */
  const handleCaptureFromTracker = async (fiducialId: string) => {
    if (!session || !seriesInstanceUID) {
      setError('Session not started. Please start registration session first.');
      return;
    }

    // Check if tracking service is connected
    const trackingService = servicesManager.services.trackingService;
    if (!trackingService || !trackingConnected) {
      setError('NDI tracker not connected. Please connect tracking system first.');
      return;
    }

    // Check if current tool position is available (must be tooltip position, not marker position)
    if (!currentToolPosition) {
      setError(
        'No tooltip position available. Make sure the tracking tool is visible and calibration matrix is loaded.'
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Find the fiducial to get its DICOM position
      const fiducial = fiducials.find(f => f.point_id === fiducialId);
      if (!fiducial) {
        setError(`Fiducial ${fiducialId} not found in local state`);
        return;
      }

      console.log(`📍 Capturing tracker position for ${fiducialId}...`);
      console.log(
        `   Tooltip position (PR space): [${currentToolPosition.map(v => v.toFixed(2)).join(', ')}]`
      );
      console.log(
        `   DICOM position: [${fiducial.dicom_position_mm.map(v => v.toFixed(2)).join(', ')}]`
      );

      // Update frontend state immediately (UI responds instantly)
      const updatedFiducials = fiducials.map(f =>
        f.point_id === fiducialId
          ? {
              ...f,
              tracker_position_mm: currentToolPosition as [number, number, number],
              status: 'captured' as const,
              // Quality scores will be updated when we save to backend
            }
          : f
      );
      setFiducials(updatedFiducials);

      // Sync fiducials to viewport to display points on DICOM
      syncFiducialsToViewport(servicesManager, updatedFiducials);

      // If registration result exists, mark points as modified to show recompute button
      // Check if this is a new capture (point didn't have tracker position before)
      const wasNewCapture = !fiducial.tracker_position_mm;
      if (registrationResult && wasNewCapture) {
        setPointsModified(true);
        setSuccessMessage(
          `✅ Captured ${fiducialId}. Please recompute registration to include this point.`
        );
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setSuccessMessage(`✅ Captured ${fiducialId} (auto-saving in background)`);
        setTimeout(() => setSuccessMessage(null), 5000);
      }

      // Auto-save to backend asynchronously (non-blocking)
      // Pass DICOM + tracker position together to create/update point
      const registrationService = servicesManager.services.registrationService;
      if (registrationService && registrationService.isApiConnected()) {
        // Save complete point pair (DICOM + tracker) in one operation
        registrationService.updateTrackerPositionAsync(
          seriesInstanceUID,
          session.registration_id,
          fiducialId,
          currentToolPosition,
          caseId || undefined,
          {
            dicom_position_mm: fiducial.dicom_position_mm, // Also pass DICOM position
            label: fiducial.label,
            source: fiducial.source || 'intraop',
          }
        );
      }

      console.log(`✅ Successfully captured ${fiducialId} from tracker (auto-saving)`);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to capture from tracker. Make sure NDI tracker is connected and tool is visible.';
      setError(errorMessage);
      console.error('❌ Error capturing from tracker:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSession = async () => {
    if (!seriesInstanceUID) {
      setError('No DICOM series loaded. Please load a study first.');
      return;
    }

    // Check: If no template, at least need fiducials
    if (!templateLoaded && fiducials.length === 0) {
      setError('Please load a template or select at least one point on DICOM first.');
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

      console.log('🚀 Starting registration session...');
      const newSession = await registrationService.startRegistration(seriesInstanceUID, {
        case_id: caseId || undefined,
        method: method,
        load_premarked: templateLoaded,
        expected_points: templateLoaded
          ? method === 'MANUAL_POINT_BASED'
            ? 6
            : 4
          : fiducials.length,
      });

      // Validate session response
      if (!newSession || !newSession.registration_id) {
        throw new Error('Invalid session response: registration_id is missing');
      }

      // Note: Points are stored in frontend state only
      // They will be saved to backend when:
      // 1. User captures tracker position (auto-save in background)
      // 2. User computes registration (all points saved before computation)

      setSession(newSession);
      setSuccessMessage(`Session started: ${newSession.registration_id}`);
      setError(null);

      if (onSessionStarted) {
        onSessionStarted(newSession.registration_id);
      }

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start session';
      setError(errorMessage);
      console.error('❌ Error starting session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const capturedCount = fiducials.filter(f => f.tracker_position_mm).length;
  const totalTemplatePoints = fiducials.filter(f => f.source === 'template').length;
  const totalPoints = fiducials.length;
  const captureProgress = totalPoints > 0 ? (capturedCount / totalPoints) * 100 : 0;
  // Include all points that need tracker capture (both template and intraop)
  const pendingPoints = fiducials.filter(f => !f.tracker_position_mm);
  const nextPointToCapture = pendingPoints.length > 0 ? pendingPoints[0] : null;

  // Recapture tracker position for a fiducial
  const handleRecaptureTracker = async (fiducialId: string) => {
    if (!session || !seriesInstanceUID) {
      setError('Session not started');
      return;
    }

    const trackingService = servicesManager.services.trackingService;
    if (!trackingService || !trackingConnected) {
      setError('NDI tracker not connected');
      return;
    }

    if (!currentToolPosition) {
      setError('No tooltip position available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const registrationService = servicesManager.services.registrationService;
      const result = await registrationService.captureTrackerPosition(
        seriesInstanceUID,
        fiducialId,
        session.registration_id,
        {
          auto_capture: !currentToolPosition,
          num_samples: currentToolPosition ? 1 : 50,
          tracker_position_mm: currentToolPosition || undefined,
        }
      );

      // Update fiducial
      setFiducials(prev =>
        prev.map(f =>
          f.point_id === fiducialId
            ? {
                ...f,
                tracker_position_mm: result.tracker_position_mm as [number, number, number],
                quality_score: result.quality_score,
                stability_mm: result.stability_mm,
                status: 'captured' as const,
              }
            : f
        )
      );

      setPointsModified(true);
      setSuccessMessage(`✅ Recaptured ${fiducialId} successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to recapture tracker position';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Compute registration transformation
   * - First ensures all points (DICOM + tracker) are saved to backend
   * - Then computes registration matrix
   * - Finally saves registration result
   */
  const handleComputeRegistration = async () => {
    if (!session?.registration_id || !seriesInstanceUID) {
      setError('Missing session ID or series UID');
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

      // Get all captured points (with both DICOM and tracker positions)
      const capturedPoints = fiducials.filter(
        f =>
          f.tracker_position_mm &&
          f.status === 'captured' &&
          f.dicom_position_mm &&
          Array.isArray(f.tracker_position_mm) &&
          Array.isArray(f.dicom_position_mm) &&
          f.tracker_position_mm.length === 3 &&
          f.dicom_position_mm.length === 3
      );

      if (capturedPoints.length < 3) {
        throw new Error(
          `Insufficient points: ${capturedPoints.length} points captured (minimum 3 required)`
        );
      }

      console.log(
        `🧮 Computing registration with ${capturedPoints.length} points using frontend data...`
      );

      const algorithm = selectedAlgorithm;

      // If ICP is selected, check if we need initial transform
      let initialTransform = null;
      if (algorithm === 'icp') {
        // Check if we have existing registration result
        if (registrationResult?.prMd_matrix) {
          initialTransform = registrationResult.prMd_matrix;
        } else {
          // Check if we have loaded registration matrix
          const trackingService = servicesManager.services.trackingService;
          if (trackingService) {
            const prMdMatrix = trackingService.getPrToDicomMatrix();
            if (!isIdentityMatrix(prMdMatrix)) {
              // Convert 2D to flat array for API
              initialTransform = prMdMatrix.flat();
            }
          }

          // If still no initial transform, compute with least squares first
          if (!initialTransform) {
            console.log('🔄 ICP requires initial transform, computing with Least Squares first...');
            const initialResult = await registrationService.computeRegistration(
              seriesInstanceUID,
              session.registration_id,
              {
                method: 'least_squares',
                outlier_threshold_mm: 3.0,
                validate: true,
                autoApplyToNavigation: false,
                servicesManager: servicesManager,
                points: capturedPoints, // NEW: Pass points data
              }
            );
            initialTransform = initialResult.prMd_matrix;
          }
        }
      }

      // Compute registration - pass points data directly from frontend
      const result = await registrationService.computeRegistration(
        seriesInstanceUID,
        session.registration_id,
        {
          method: algorithm,
          outlier_threshold_mm: 3.0,
          validate: true,
          autoApplyToNavigation: true,
          servicesManager: servicesManager,
          points: capturedPoints, // NEW: Pass points data directly
          // ICP parameters
          initial_transform: initialTransform,
          icp_max_iterations: algorithm === 'icp' ? 30 : undefined,
          icp_tolerance: algorithm === 'icp' ? 0.001 : undefined,
        }
      );

      // Save result to state
      setRegistrationResult(result);
      setPointsModified(false);

      // Clear backup after successful registration computation
      // Note: Registration is automatically saved to database during computation
      if (seriesInstanceUID) {
        clearBackup(seriesInstanceUID);
      }

      // Show success message indicating automatic save
      setSuccessMessage(
        `✅ Registration computed and automatically saved to database! ` +
          `FRE: ${result.quality_metrics.fre_mm.toFixed(2)}mm, ` +
          `Quality: ${result.quality_metrics.quality}`
      );
      setTimeout(() => setSuccessMessage(null), 8000);

      // Check result matrix and update algorithm selection for next time
      if (result.prMd_matrix) {
        const isIdentity = isIdentityMatrix(result.prMd_matrix);
        if (!isIdentity && algorithm === 'least_squares') {
          // If we used least squares and got non-identity result, next time use ICP
          setSelectedAlgorithm('icp');
          console.log(
            '💡 Registration completed with Least Squares. Next computation will use ICP.'
          );
        }
      }

      // Project patient points to DICOM space
      if (result.prMd_matrix && fiducials.length > 0) {
        const capturedFiducials = fiducials.filter(f => f.tracker_position_mm);

        if (capturedFiducials.length > 0) {
          const updatedFiducials = fiducials.map(fiducial => {
            if (fiducial.tracker_position_mm && result.prMd_matrix) {
              const projectedDicomPos = transformPointWithMatrix(
                fiducial.tracker_position_mm,
                result.prMd_matrix
              );

              return {
                ...fiducial,
                projected_dicom_position_mm: projectedDicomPos,
              };
            }
            return fiducial;
          });

          setFiducials(updatedFiducials);
          projectPatientPointsToDicom(servicesManager, capturedFiducials, result.prMd_matrix);

          console.log('✅ Patient points projected to DICOM space for verification');
        }
      }

      // Success message is already set above with automatic save notification
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to compute registration';
      setError(errorMessage);
      console.error('❌ Error computing registration:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // DEPRECATED: Registration is now automatically saved to database during computation
  // No need for separate save operation
  // const handleSaveRegistration = async () => {
  //   if (!session?.registration_id || !seriesInstanceUID) {
  //     setError('Missing session ID or series UID');
  //     return;
  //   }

  //   setIsLoading(true);
  //   setError(null);

  //   try {
  //     const registrationService = servicesManager.services.registrationService;
  //     if (!registrationService) {
  //       throw new Error('Registration service not available');
  //     }

  //     console.log('💾 Saving registration to database...');
  //     const result = await registrationService.saveRegistration(
  //       seriesInstanceUID,
  //       session.registration_id,
  //       true // create_backup
  //     );

  //     setSuccessMessage(`✅ ${result.message}`);
  //     setTimeout(() => setSuccessMessage(null), 5000);
  //   } catch (err) {
  //     const errorMessage = err instanceof Error ? err.message : 'Failed to save registration';
  //     setError(errorMessage);
  //     console.error('❌ Error saving registration:', err);
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  // Check if registration can be computed (at least 3 points captured)
  const canCompute = capturedCount >= 3;

  return (
    <div className="registration-workflow-panel">
      {/* Error Message */}
      {error && (
        <div className="error-section">
          <div className="error-message">{error}</div>
        </div>
      )}

      {/* Success Message */}
      {successMessage && <div className="success-message">{successMessage}</div>}

      {/* API Connection Status */}
      <div className="section api-status">
        <h3>API Connection</h3>
        <div className="status-indicator">
          <span className={`status-dot ${apiConnected ? 'connected' : 'disconnected'}`} />
          <span>{apiConnected ? 'API Connected' : 'API Disconnected'}</span>
        </div>
        {!apiConnected && (
          <p className="hint">⚠️ Please start the Registration gRPC server (port 5002)</p>
        )}
      </div>

      {/* Registration Method Selection - Removed, default to MANUAL_POINT_BASED */}
      {/*
      <div className="section">
        <h3>Registration Method</h3>
        <div className="method-selector">
          <label>
            <input
              type="radio"
              name="registrationMethod"
              value="MANUAL_POINT_BASED"
              checked={method === 'MANUAL_POINT_BASED'}
              onChange={(e) => setMethod(e.target.value as 'MANUAL_POINT_BASED')}
            />
            <span>Manual Point-based</span>
          </label>
          <label>
            <input
              type="radio"
              name="registrationMethod"
              value="PHANTOM_AUTO"
              checked={method === 'PHANTOM_AUTO'}
              onChange={(e) => setMethod(e.target.value as 'PHANTOM_AUTO')}
            />
            <span>Auto (Phantom)</span>
          </label>
        </div>
        <p className="hint">
          {method === 'MANUAL_POINT_BASED'
            ? 'Manually mark fiducial points on anatomical landmarks'
            : 'Automatic registration using phantom configuration'}
        </p>
      </div>
      */}

      {/* Template Management */}
      <div className="section template-section">
        <div className="section-header-row">
          <h3>Template</h3>
          {templateLoaded && (
            <span className="status-badge badge-success">{totalTemplatePoints} points</span>
          )}
        </div>
        {templateLoaded ? (
          <div className="template-status-box">
            <div className="template-status-icon">✅</div>
            <div className="template-status-text">
              <div className="template-status-title">Template Loaded</div>
              <div className="template-status-subtitle">
                {totalTemplatePoints} fiducial points ready for capture
              </div>
            </div>
          </div>
        ) : (
          <div className="template-empty">
            <p
              className="hint"
              style={{ marginBottom: '12px' }}
            >
              No template loaded
            </p>
            <button
              onClick={handleLoadTemplate}
              className={`btn-secondary ${isLoading ? 'loading' : ''}`}
              disabled={!seriesInstanceUID || isLoading}
            >
              {isLoading ? 'Loading...' : '📥 Load Template'}
            </button>
            <p
              className="hint"
              style={{ fontSize: '12px', marginTop: '8px' }}
            >
              Load a previously saved fiducial template for this series
            </p>
          </div>
        )}
      </div>

      {/* Add: Display fiducials list - collapsible */}
      {fiducials.length > 0 && (
        <details
          className="section fiducial-list-section"
          open={fiducials.length <= 8}
        >
          <summary className="fiducial-list-header">
            <h3>Fiducial Points ({fiducials.length})</h3>
            <span className="collapse-icon">▼</span>
          </summary>
          <FiducialList
            fiducials={fiducials}
            selectedFiducialId={selectedFiducialId}
            onSelectFiducial={setSelectedFiducialId}
            onEditFiducial={handleEditFiducial}
            onDeleteFiducial={handleDeleteFiducial}
            onJumpToFiducial={handleJumpToFiducial}
          />
        </details>
      )}

      {/* Select points on DICOM - does not depend on template */}
      {!templateLoaded && (
        <div className="section select-points-section">
          <div className="section-header-row">
            <h3>�� Select Points on DICOM</h3>
            {fiducials.length > 0 && (
              <span className="status-badge badge-info">{fiducials.length} points</span>
            )}
          </div>
          <p className="section-description">
            Position the crosshair on anatomical landmarks in the DICOM image, then click to add
            points. These points will be saved for registration.
          </p>
          <button
            onClick={handleAddFiducial}
            className={`btn-primary ${isLoading ? 'loading' : ''}`}
            disabled={!seriesInstanceUID || isLoading}
          >
            {isLoading ? 'Adding...' : '📍 Add Point at Crosshair'}
          </button>
          {fiducials.length > 0 && (
            <div className="points-summary">
              <p
                className="hint"
                style={{ marginTop: '12px', fontSize: '12px', color: '#4ade80' }}
              >
                ✅ {fiducials.length} point(s) selected. You can start a session to capture tracker
                positions.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Capture tracker positions for fiducial points */}
      {session && pendingPoints.length > 0 && (
        <div className="section capture-section">
          {/* Add tracking status indicator */}
          <div className="tracking-status-indicator">
            <span className={`status-dot ${trackingConnected ? 'connected' : 'disconnected'}`} />
            <span>{trackingConnected ? 'NDI Tracker Connected' : 'NDI Tracker Disconnected'}</span>
            {currentToolPosition && (
              <span className="tool-position-hint">
                Tool: [{currentToolPosition.map(v => v.toFixed(1)).join(', ')}] mm
              </span>
            )}
          </div>

          {nextPointToCapture && (
            <div className="next-point-banner">
              <span className="next-point-icon">📍</span>
              <span className="next-point-text">
                Next: <strong>{nextPointToCapture.label || nextPointToCapture.point_id}</strong>
                {nextPointToCapture.anatomical_landmark && (
                  <span className="next-point-landmark">
                    {' '}
                    ({nextPointToCapture.anatomical_landmark})
                  </span>
                )}
              </span>
            </div>
          )}
          <p className="section-description">
            Touch each anatomical landmark with the NDI tracking tool, then click
            &quot;Capture&quot; to record the position.
          </p>
          <div className="fiducial-capture-list">
            {pendingPoints.map((fiducial, index) => (
              <div
                key={fiducial.point_id}
                className={`fiducial-capture-item ${index === 0 ? 'next-item' : ''}`}
              >
                <div className="capture-item-number">{index + 1}</div>
                <div className="fiducial-capture-info">
                  <span className="fiducial-label">{fiducial.label || fiducial.point_id}</span>
                  {fiducial.anatomical_landmark && (
                    <span className="fiducial-landmark">{fiducial.anatomical_landmark}</span>
                  )}
                </div>
                <button
                  onClick={() => handleCaptureFromTracker(fiducial.point_id)}
                  className={`btn-capture ${isLoading ? 'loading' : ''} ${index === 0 ? 'btn-capture-primary' : ''}`}
                  disabled={isLoading || !session}
                  title={`Capture tracker position for ${fiducial.label || fiducial.point_id}`}
                >
                  {isLoading ? '⏳' : '📍 Capture'}
                </button>
              </div>
            ))}
          </div>
          {capturedCount > 0 && (
            <div className="capture-summary">
              <span className="capture-summary-icon">✅</span>
              <span className="capture-summary-text">
                {capturedCount} of {totalPoints} points captured
              </span>
            </div>
          )}
        </div>
      )}

      {/* Session Control */}
      <div className="section session-section">
        <div className="section-header-row">
          <h3>Registration Session</h3>
          {session && <span className="status-badge badge-active">Active</span>}
        </div>
        {session ? (
          <div className="session-info-box">
            <div className="session-info-grid">
              <div className="session-info-item">
                <span className="session-info-label">Session ID</span>
                <span className="session-info-value">
                  {session?.registration_id ? `${session.registration_id.slice(0, 12)}...` : 'N/A'}
                </span>
              </div>
              <div className="session-info-item">
                <span className="session-info-label">Status</span>
                <span className="session-info-value">{session.status}</span>
              </div>
              <div className="session-info-item">
                <span className="session-info-label">Progress</span>
                <span className="session-info-value highlight">
                  {capturedCount}/{totalPoints}
                </span>
              </div>
            </div>
            {totalPoints > 0 && (
              <div className="progress-indicator">
                <div className="progress-bar-wrapper">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${captureProgress}%` }}
                  />
                </div>
                <span className="progress-text">{Math.round(captureProgress)}%</span>
              </div>
            )}
          </div>
        ) : (
          <div className="session-start">
            <button
              onClick={handleStartSession}
              className={`btn-primary btn-large ${isLoading ? 'loading' : ''}`}
              disabled={
                !seriesInstanceUID ||
                isLoading ||
                !apiConnected ||
                (!templateLoaded && fiducials.length === 0) // Modified: If no template, at least need fiducials
              }
            >
              {isLoading ? 'Starting...' : '🚀 Start Registration Session'}
            </button>
            {!templateLoaded && fiducials.length === 0 && (
              <p
                className="hint"
                style={{ color: '#fbbf24', marginTop: '8px' }}
              >
                ⚠️ Please load a template or select points on DICOM first
              </p>
            )}
            {!templateLoaded && fiducials.length > 0 && (
              <p
                className="hint"
                style={{ color: '#4ade80', marginTop: '8px' }}
              >
                ✅ {fiducials.length} point(s) selected. Ready to start session.
              </p>
            )}
            {!seriesInstanceUID && (
              <p
                className="hint"
                style={{ color: '#fbbf24', marginTop: '8px' }}
              >
                ⚠️ Please load a DICOM study first
              </p>
            )}
            {!apiConnected && (
              <p
                className="hint"
                style={{ color: '#fbbf24', marginTop: '8px' }}
              >
                ⚠️ API not connected
              </p>
            )}
          </div>
        )}
      </div>

      {/* Compute Registration */}
      {session && canCompute && !registrationResult && (
        <div className="section compute-section">
          <div className="section-header-row">
            <h3>Compute Registration</h3>
            <span className="status-badge badge-info">{capturedCount} points ready</span>
          </div>
          {selectedAlgorithm === 'icp' && (
            <div
              className="algorithm-hint"
              style={{
                padding: '8px 12px',
                backgroundColor: '#fef3c7',
                border: '1px solid #fbbf24',
                borderRadius: '4px',
                marginBottom: '12px',
                fontSize: '13px',
              }}
            >
              💡 Non-identity registration matrix detected. Using ICP algorithm for refinement.
            </div>
          )}
          <p className="section-description">
            Calculate the transformation matrix from DICOM space to Patient Reference space.
            {selectedAlgorithm === 'icp' && ' Using ICP algorithm for precision refinement.'}
          </p>
          <button
            onClick={handleComputeRegistration}
            className={`btn-success btn-large ${isLoading ? 'loading' : ''}`}
            disabled={isLoading || !canCompute}
          >
            {isLoading
              ? '⏳ Computing...'
              : selectedAlgorithm === 'icp'
                ? '🎯 Compute Registration (ICP)'
                : '🧮 Compute Registration (Least Squares)'}
          </button>
        </div>
      )}

      {/* Registration Results */}
      {registrationResult && (
        <div className="section result-section">
          <div className="section-header-row">
            <h3>✅ Registration Complete</h3>
            <span
              className={`status-badge badge-${registrationResult.quality_metrics?.quality || 'info'}`}
            >
              {registrationResult.quality_metrics?.quality || 'N/A'}
            </span>
          </div>

          {/* Applied to navigation system notification */}
          <div
            className="applied-badge"
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '4px',
              marginBottom: '16px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>✅</span>
            <span>Matrix applied to navigation system</span>
          </div>

          <div className="result-metrics">
            <div className="metric">
              <span className="metric-label">FRE:</span>
              <span className="metric-value">
                {registrationResult.quality_metrics?.fre_mm?.toFixed(2) || 'N/A'}mm
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">FRE Std Dev:</span>
              <span className="metric-value">
                {registrationResult.quality_metrics?.fre_std_mm?.toFixed(2) || 'N/A'}mm
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">TRE (Estimated):</span>
              <span className="metric-value">
                {registrationResult.quality_metrics?.tre_estimated_mm?.toFixed(2) || 'N/A'}mm
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Quality:</span>
              <span
                className={`metric-value quality-${registrationResult.quality_metrics?.quality || 'unknown'}`}
              >
                {registrationResult.quality_metrics?.quality || 'N/A'}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Points Used:</span>
              <span className="metric-value">
                {registrationResult.quality_metrics?.points_used || 'N/A'}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Max Residual:</span>
              <span className="metric-value">
                {registrationResult.quality_metrics?.max_residual_mm?.toFixed(2) || 'N/A'}mm
              </span>
            </div>
          </div>

          {registrationResult.point_residuals && registrationResult.point_residuals.length > 0 && (
            <details
              className="residuals-section"
              open={pointsModified}
            >
              <summary className="residuals-header">
                <span>Point Residuals</span>
                {pointsModified && (
                  <span
                    className="modified-badge"
                    style={{ marginLeft: '8px', color: '#f59e0b' }}
                  >
                    ⚠️ Points modified - recomputation recommended
                  </span>
                )}
              </summary>
              <div className="residuals-list-with-actions">
                {registrationResult.point_residuals.map(r => {
                  const fiducial = fiducials.find(f => f.point_id === r.point_id);
                  const isOutlier = (r.error_mm || 0) > 3.0;

                  return (
                    <div
                      key={r.point_id}
                      className={`residual-item-with-actions ${isOutlier ? 'outlier' : ''}`}
                    >
                      <div className="residual-info">
                        <span className="point-label">{r.label || r.point_id}</span>
                        <span className={`residual-value ${isOutlier ? 'error' : ''}`}>
                          {r.error_mm?.toFixed(2) || 'N/A'}mm
                        </span>
                        {isOutlier && (
                          <span
                            className="outlier-warning"
                            style={{ marginLeft: '8px', color: '#ef4444' }}
                          >
                            ⚠️ Outlier
                          </span>
                        )}
                      </div>
                      {fiducial && (
                        <div className="residual-actions">
                          <button
                            onClick={() => handleEditFiducial(fiducial.point_id)}
                            className="btn-small btn-secondary"
                            title="Edit DICOM position"
                          >
                            ✏️ Edit DICOM
                          </button>
                          <button
                            onClick={() => handleRecaptureTracker(fiducial.point_id)}
                            className="btn-small btn-secondary"
                            title="Recapture tracker position"
                          >
                            📍 Recapture
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </details>
          )}

          {/* Fine-tune and recompute section */}
          <div className="fine-tune-section">
            <h4>Fine-tune Registration</h4>

            {pointsModified ? (
              <div className="recompute-prompt">
                <p
                  className="warning-text"
                  style={{ color: '#f59e0b', marginBottom: '12px' }}
                >
                  ⚠️ Point positions have been modified. Recompute registration to update
                  transformation matrix.
                </p>
                <button
                  onClick={handleComputeRegistration}
                  className="btn-warning btn-large"
                  disabled={isLoading || !canCompute}
                >
                  {isLoading ? '⏳ Recomputing...' : '🔄 Recompute Registration'}
                </button>
              </div>
            ) : (
              <div className="fine-tune-options">
                <p className="hint">If registration quality is not satisfactory, you can:</p>
                <ul
                  className="fine-tune-list"
                  style={{ marginLeft: '20px', marginTop: '8px' }}
                >
                  <li>Edit DICOM positions (click ✏️ button above)</li>
                  <li>Recapture tracker positions (click 📍 button above)</li>
                  <li>Add more points to improve registration quality</li>
                </ul>
              </div>
            )}

            {/* Add new point */}
            <div
              className="add-point-section"
              style={{ marginTop: '16px' }}
            >
              <button
                onClick={handleAddFiducial}
                className="btn-secondary"
                disabled={isLoading}
              >
                ➕ Add New Point
              </button>
              <p
                className="hint"
                style={{ fontSize: '12px', marginTop: '8px' }}
              >
                Add more points to improve registration quality
              </p>
            </div>
          </div>

          <div className="result-actions">
            {/* DEPRECATED: Save button removed - registration is automatically saved during computation */}
            {/* <button
              onClick={handleSaveRegistration}
              className={`btn-primary btn-large ${isLoading ? 'loading' : ''}`}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : '💾 Save Registration to Database'}
            </button>
            <p
              className="hint"
              style={{ fontSize: '12px', marginTop: '8px' }}
            >
              Save the registration result to the database for future use
            </p> */}
            <p
              className="hint"
              style={{ fontSize: '12px', marginTop: '8px', color: '#4CAF50' }}
            >
              ✅ Registration result has been automatically saved to database
            </p>
          </div>
        </div>
      )}

      {/* DICOM Info (Read-only) - collapsible */}
      {seriesInstanceUID && (
        <details className="section dicom-info-collapsed">
          <summary className="dicom-info-header">
            <h3>DICOM Information</h3>
            <span className="collapse-icon">▼</span>
          </summary>
          <div className="info-row">
            <span className="info-label">Series UID:</span>
            <span
              className="info-value"
              title={seriesInstanceUID}
            >
              {seriesInstanceUID ? `${seriesInstanceUID.slice(0, 30)}...` : 'N/A'}
            </span>
          </div>
        </details>
      )}

      {/* Fiducial Edit Dialog */}
      {editingFiducial && (
        <FiducialEditDialog
          fiducial={editingFiducial}
          isOpen={true}
          onClose={() => setEditingFiducial(null)}
          onSave={handleSaveFiducial}
        />
      )}
    </div>
  );
}
