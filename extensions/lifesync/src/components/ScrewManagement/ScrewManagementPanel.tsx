/**
 * ScrewManagementPanel Component
 *
 * Manages screw placements with viewport states and 3D models
 * - Save screw placements with radius, length, and transform data
 * - Restore screw placements (loads both viewport state and 3D model)
 * - Delete screws (removes both snapshot and 3D model)
 * - Save/Load surgical plans to/from database
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getRenderingEngine } from '@cornerstonejs/core';
import { crosshairsHandler } from '../../utils/crosshairsHandler';
import { getScrewColor } from '../../utils/screwColorScheme';
import { planningBackendService } from '../../services';
import PlanSelectionDialog from './PlanSelectionDialog';
import ScrewSelectionDialog from './ScrewSelectionDialog';
import {
  Header,
  SessionStatus,
  LoadingScreen,
  SaveScrewButton,
  ScrewToolbar,
  ScrewListHeader,
  EmptyScrewList,
  ScrewTable,
  ScrewCard,
  InvalidScrewCard,
  ScrewManagementContainer,
  ScrewListContainer,
  ScrewListScrollArea,
  SessionStateDialog,
} from './ScrewManagementUI';
import { ToolGroupManager, addTool, state as cornerstoneToolsState } from '@cornerstonejs/tools';
import ScrewInteractionTool from '../../tools/ScrewInteractionTool';

// Register ScrewInteractionTool globally (only once)
let screwToolRegistered = false;
function registerScrewInteractionTool() {
  console.log('🔧 [ScrewManagement] registerScrewInteractionTool() called');
  console.log('   screwToolRegistered:', screwToolRegistered);

  if (screwToolRegistered) {
    console.log('   Already registered, skipping');
    return true;
  }

  try {
    // Check if tool is already registered in cornerstoneTools state
    const existingTools = cornerstoneToolsState.tools;
    console.log('   cornerstoneToolsState.tools:', existingTools ? Object.keys(existingTools) : 'undefined');

    if (existingTools && existingTools[ScrewInteractionTool.toolName]) {
      console.log('✅ [ScrewManagement] ScrewInteractionTool already registered globally');
      screwToolRegistered = true;
      return true;
    }

    console.log('   Calling addTool(ScrewInteractionTool)...');
    console.log('   ScrewInteractionTool:', ScrewInteractionTool);
    console.log('   ScrewInteractionTool.toolName:', ScrewInteractionTool.toolName);

    addTool(ScrewInteractionTool);
    screwToolRegistered = true;
    console.log('✅ [ScrewManagement] ScrewInteractionTool registered globally SUCCESS!');
    return true;
  } catch (error) {
    console.error('❌ [ScrewManagement] addTool error:', error);
    if (error.message?.includes('already registered')) {
      console.log('✅ [ScrewManagement] ScrewInteractionTool already registered (caught)');
      screwToolRegistered = true;
      return true;
    } else {
      console.error('❌ [ScrewManagement] Failed to register ScrewInteractionTool:', error);
      return false;
    }
  }
}

// Try to register tool immediately when module loads
console.log('🚀 [ScrewManagement] Module loading - attempting early tool registration');
try {
  registerScrewInteractionTool();
} catch (e) {
  console.log('⚠️ [ScrewManagement] Early registration failed (will retry later):', e.message);
}

export default function ScrewManagementPanel({ servicesManager }) {
  const { viewportStateService, modelStateService, planeCutterService } = servicesManager.services;

  // Get caseId from URL parameters
  const [searchParams] = useSearchParams();
  const urlCaseId = searchParams.get('caseId');

  const [screws, setScrews] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [caseId, setCaseId] = useState(urlCaseId);
  const [studyInstanceUID, setStudyInstanceUID] = useState(null);
  const [seriesInstanceUID, setSeriesInstanceUID] = useState(null);
  const [surgeon, setSurgeon] = useState('OHIF User');
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'initializing' | 'ready' | 'error'>('initializing');
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showScrewDialog, setShowScrewDialog] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [showSessionStateDialog, setShowSessionStateDialog] = useState(false);
  const [backendSummary, setBackendSummary] = useState<any | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Screw Interaction Tool state
  const [isMoveToolActive, setIsMoveToolActive] = useState(false);
  const [selectedScrew, setSelectedScrew] = useState<{ label: string } | null>(null);
  const [modelCount, setModelCount] = useState(0);

  // Debug: Log screws whenever they change
  useEffect(() => {
    console.log(`🔍 [ScrewManagement] Screws state changed. Count: ${screws.length}`);
    if (screws.length > 0) {
      console.log('🔍 [ScrewManagement] Screws data:', screws);
    }
  }, [screws]);

  useEffect(() => {
    initializeSession();
  }, []);

  /**
   * Initialize planning session and load existing screws
   */
  const initializeSession = async () => {
    try {
      setIsLoading(true);
      setSessionStatus('initializing');

      // Get real DICOM UIDs from active viewport
      const { displaySetService, viewportGridService } = servicesManager.services;
      const { activeViewportId, viewports } = viewportGridService.getState();
      const viewport = viewports.get(activeViewportId);

      let newStudyUID = null;
      let newSeriesUID = null;

      if (viewport && viewport.displaySetInstanceUIDs && viewport.displaySetInstanceUIDs.length > 0) {
        const displaySetInstanceUID = viewport.displaySetInstanceUIDs[0];
        const displaySet = displaySetService.getDisplaySetByUID(displaySetInstanceUID);

        if (displaySet) {
          newStudyUID = displaySet.StudyInstanceUID;
          newSeriesUID = displaySet.SeriesInstanceUID;
          console.log('✅ Got real DICOM UIDs from active viewport:');
          console.log(`   Study UID: ${newStudyUID}`);
          console.log(`   Series UID: ${newSeriesUID}`);
        }
      }

      // Fallback if no viewport data available
      if (!newStudyUID || !newSeriesUID) {
        console.warn('⚠️ Could not get DICOM UIDs from viewport, using placeholders');
        console.warn('   Make sure a study is loaded before using planning features');
        newStudyUID = 'NO_STUDY_LOADED';
        newSeriesUID = 'NO_SERIES_LOADED';
      }

      // Get case information from URL params (set during navigation from WorkList)
      const newCaseId = urlCaseId; // Read from URL query parameter
      const newSurgeon = 'OHIF User'; // TODO: Get from user service

      // Store in state for later use in save/load (redundant if already set, but kept for clarity)
      if (newCaseId && newCaseId !== caseId) {
        setCaseId(newCaseId);
      }
      setStudyInstanceUID(newStudyUID);
      setSeriesInstanceUID(newSeriesUID);
      setSurgeon(newSurgeon);

      console.log('🔄 Initializing planning session...');
      console.log(`   Case ID: ${newCaseId || 'none (session without case)'}`);

      // Check for old session_id before creating new session
      const CACHED_SESSION_KEY = 'ohif_planning_session_id';
      const oldSessionId = localStorage.getItem(CACHED_SESSION_KEY);

      // Start planning session using backend service
      const response = await planningBackendService.startSession({
        studyInstanceUID: newStudyUID,
        seriesInstanceUID: newSeriesUID,
        surgeon: newSurgeon,
        ...(newCaseId && { caseId: newCaseId })
      });

      if (response.success && response.session_id) {
        const newSessionId = response.session_id;

        // If new session_id is different from old one, clear old models
        if (oldSessionId && oldSessionId !== newSessionId) {
          console.log('🔄 New session detected - clearing old session data');
          console.log(`   Old session: ${oldSessionId.substring(0, 8)}...`);
          console.log(`   New session: ${newSessionId.substring(0, 8)}...`);

          // Clear old 3D models
          modelStateService.clearAllModels();
          // Clear old viewport snapshots
          viewportStateService.clearAll();
          // Clear old screws state
          setScrews([]);
          console.log('🧹 Cleared old session data (models, snapshots, screws)');
        }

        setSessionId(newSessionId);
        setSessionStatus('ready');
        console.log('✅ Planning session started:', newSessionId);

        // Save new session_id to localStorage
        localStorage.setItem(CACHED_SESSION_KEY, newSessionId);
        console.log(`💾 Saved session_id to localStorage: ${newSessionId.substring(0, 8)}...`);

        // Load existing screws for this session
        await loadScrews(newSessionId);
      } else {
        throw new Error(response.error || 'Session creation failed');
      }
    } catch (error) {
      console.error('❌ Error initializing session:', error);
      setSessionStatus('error');

      // Show user-friendly error
      console.warn('⚠️ Falling back to localStorage-only mode');
      console.warn('   Planning API may not be available. Check:');
      console.warn('   1. Is SyncForge API running on port 3001?');
      console.warn('   2. Is Planning Service running on port 6000?');

      // Fallback to localStorage
      loadScrewsLocal();
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load screws from planning API
   */
  const loadScrews = async (sessionId) => {
    if (!sessionId) {
      console.warn('⚠️ No session ID available, cannot load screws');
      return;
    }

    try {
      console.log('📥 Loading screws from API...');

      const response = await planningBackendService.listScrews(sessionId);

      if (response.success) {
        setScrews(response.screws || []);
        console.log(`✅ Loaded ${response.screws?.length || 0} screws from API`);
      } else {
        console.error('❌ Failed to load screws:', response.error);
        // Fallback to localStorage
        loadScrewsLocal();
      }
    } catch (error) {
      console.error('❌ Error loading screws:', error);
      // Fallback to localStorage
      loadScrewsLocal();
    }
  };

  /**
   * Load screws from localStorage (fallback)
   * Only loads if cached session_id matches current session_id
   */
  const loadScrewsLocal = () => {
    console.log('📁 Checking localStorage for cached screws...');

    // Get cached session_id from localStorage
    const CACHED_SESSION_KEY = 'ohif_planning_session_id';
    const cachedSessionId = localStorage.getItem(CACHED_SESSION_KEY);

    // Check if cached session_id matches current session_id
    if (cachedSessionId && sessionId && cachedSessionId === sessionId) {
      console.log('✅ Cached session_id matches current session_id');
      console.log(`   Cached: ${cachedSessionId.substring(0, 8)}...`);
      console.log(`   Current: ${sessionId.substring(0, 8)}...`);

      const allScrews = viewportStateService.getAllSnapshots();
      setScrews(allScrews);
      console.log(`✅ Loaded ${allScrews.length} screws from localStorage`);
    } else {
      console.log('⚠️ Session ID mismatch or missing - clearing cached screws and 3D models');
      console.log(`   Cached session_id: ${cachedSessionId || 'none'}`);
      console.log(`   Current session_id: ${sessionId || 'none'}`);

      // Clear cached screws if session_id doesn't match
      viewportStateService.clearAll();
      setScrews([]);

      // Clear all rendered 3D models (this is critical!)
      modelStateService.clearAllModels();
      console.log('🧹 Cleared cached screws and 3D models due to session mismatch');
    }
  };

  /**
   * Load and display a 3D screw model using the planning API
   */
  const loadScrewModel = async (radius, length, transform, screwLabel = null, screwId = null) => {
    try {
      console.log(`�� Querying model for radius=${radius}, length=${length}`);
      console.log(`🔍 Screw label: ${screwLabel}, Screw ID: ${screwId}`);
      console.log(`🔍 transform:`, transform);
      console.log(`🔍 transform.length:`, transform?.length);

      // Determine color based on screw label
      const screwColor = screwLabel ? getScrewColor(screwLabel) : [1.0, 0.84, 0.0];
      console.log(`🎨 Using color [${screwColor}] for screw "${screwLabel || 'default'}"`);

      // Query model from planning API using backend service
      const queryResponse = await planningBackendService.queryModel(radius, length);

      if (!queryResponse.success || !queryResponse.model) {
        throw new Error('Model query failed');
      }

      const modelInfo = queryResponse.model;
      console.log(`📦 Model found: ${modelInfo.model_id} (${modelInfo.source})`);

      // Ensure plane cutters are initialized and enabled
      if (planeCutterService) {
        if (!planeCutterService.getIsEnabled()) {
          console.log('🔪 [ScrewManagement] Auto-enabling plane cutters for 2D views...');
          try {
            await planeCutterService.initialize();
            planeCutterService.enable();
            console.log('✅ [ScrewManagement] Plane cutters enabled - screws will appear in 2D MPR views');
          } catch (error) {
            console.warn('⚠️ [ScrewManagement] Could not enable plane cutters:', error);
          }
        }
      }

      // Get model OBJ file URL using backend service
      const modelUrl = planningBackendService.getModelUrl(modelInfo.model_id);

      // Load model using modelStateService
      // Use screwId as modelId (unique identifier) and screwLabel as modelName (human-readable)
      await modelStateService.loadModelFromServer(modelUrl, {
        viewportId: getCurrentViewportId(),
        color: screwColor,  // Color based on screw name/label
        opacity: 0.9,
        modelId: screwId,      // Unique ID from database (if available)
        modelName: screwLabel  // Human-readable label (e.g., "L3-R1", "L2L")
      });

      // Apply transform if provided
      if (transform && transform.length === 16) {
        console.log('🔧 Applying transform to loaded model...');
        console.log(`   Transform type: ${transform.constructor.name}`);
        console.log(`   Translation: (${transform[3].toFixed(2)}, ${transform[7].toFixed(2)}, ${transform[11].toFixed(2)})`);

        // Find the loaded model and apply transform
        const loadedModels = modelStateService.getAllModels();
        const latestModel = loadedModels[loadedModels.length - 1];

        if (latestModel) {
          // CRITICAL: Pass length as 3rd parameter for proper offset
          await modelStateService.setModelTransform(
            latestModel.metadata.id,
            transform,
            length
          );
          console.log(`✅ Applied transform to model: ${latestModel.metadata.id} with length offset: ${length}mm`);
        } else {
          console.error('❌ No model found to apply transform to!');
        }
      } else {
        console.warn(`⚠️ No valid transform to apply (length: ${transform?.length || 0})`);
      }

    } catch (error) {
      console.error('❌ Failed to load screw model:', error);

      // Fallback: Try to load using old method
      try {
        console.log('⚠️ Falling back to old model loading method...');
        await viewportStateService.queryAndLoadModel(radius, length, transform);
      } catch (fallbackError) {
        console.error('❌ Fallback model loading also failed:', fallbackError);
        throw error; // Re-throw original error
      }
    }
  };

  /**
   * Load and display cap model using the planning API
   */
  const loadCapModel = async (transform, length, screwLabel = null, screwId = null) => {
    try {
      console.log(`🔍 Loading cap model for screw: "${screwLabel}" (length: ${length}mm)`);
      console.log(`🔍 Transform:`, transform);

      // Use the same color as the screw body
      const capColor = screwLabel ? getScrewColor(screwLabel) : [1.0, 0.84, 0.0];
      console.log(`🎨 Using color [${capColor}] for cap "${screwLabel || 'default'}"`);

      // Query cap model (returns fixed information)
      const queryResponse = await planningBackendService.queryCapModel();

      if (!queryResponse.success || !queryResponse.model) {
        throw new Error('Cap model query failed');
      }

      const modelInfo = queryResponse.model;
      console.log(`📦 Cap model: ${modelInfo.filename}`);

      // Get cap model OBJ file URL
      const modelUrl = planningBackendService.getCapModelUrl();

      // Load model
      await modelStateService.loadModelFromServer(modelUrl, {
        viewportId: getCurrentViewportId(),
        color: capColor,
        opacity: 0.9,
        modelId: screwId ? `${screwId}-cap` : null,
        modelName: screwLabel ? `${screwLabel}-Cap` : 'Screw Cap'
      });

      // Apply transform matrix (cap needs to be placed at the top of the screw)
      if (transform && transform.length === 16 && length && length > 0) {
        console.log('🔧 Applying transform to loaded cap model...');
        console.log(`   Translation: (${transform[3].toFixed(2)}, ${transform[7].toFixed(2)}, ${transform[11].toFixed(2)})`);

        // Extract coronal direction (same as screw, used for offset calculation)
        const coronalX = transform[1];  // Row 0, Col 1
        const coronalY = transform[5];  // Row 1, Col 1
        const coronalZ = transform[9];  // Row 2, Col 1

        // Cap height (fixed value, unit: millimeters)
        const capHeight = 15.0;

        // Cap should be placed at the top of the screw
        // Screw body already has length/2 offset to center-align to entry point
        // Cap needs offset: length/2 (reach screw top) + capHeight/2 (if origin is at center, align bottom)
        const otherOffset = 2.5;
        const capOffset = (length / 2) + (capHeight / 2) + otherOffset; // Total offset = half screw length + half cap height + offset

        console.log(`📏 Screw length: ${length}mm`);
        console.log(`📏 Cap height: ${capHeight}mm`);
        console.log(`📏 Applying cap offset: +${capOffset}mm (${length/2}mm screw + ${capHeight/2}mm cap) along coronal direction`);

        // Create offset transform
        const capTransform = [...transform];
        const originalTransX = transform[3];
        const originalTransY = transform[7];
        const originalTransZ = transform[11];

        console.log(`📍 Original translation: [${originalTransX}, ${originalTransY}, ${originalTransZ}]`);

        // Adjust translation: offset forward by length/2 + capHeight/2, so cap bottom is at screw top
        capTransform[3] = originalTransX + (coronalX * capOffset);
        capTransform[7] = originalTransY + (coronalY * capOffset);
        capTransform[11] = originalTransZ + (coronalZ * capOffset);

        console.log(`📍 Adjusted translation: [${capTransform[3]}, ${capTransform[7]}, ${capTransform[11]}]`);
        console.log(`📐 Offset vector: [${coronalX * capOffset}, ${coronalY * capOffset}, ${coronalZ * capOffset}]`);

        const loadedModels = modelStateService.getAllModels();
        const latestModel = loadedModels[loadedModels.length - 1];

        if (latestModel) {
          // Apply offset transform (don't pass length parameter, as OBJ model won't auto-offset)
          await modelStateService.setModelTransform(
            latestModel.metadata.id,
            capTransform
            // Note: OBJ model doesn't apply length offset in setModelTransform, so manual calculation is needed
          );
          console.log(`✅ Applied transform to cap model: ${latestModel.metadata.id} with offset: ${capOffset}mm`);
        } else {
          console.error('❌ No cap model found to apply transform to!');
        }
      } else {
        console.warn(`⚠️ No valid transform or length to apply to cap (transform length: ${transform?.length || 0}, length: ${length})`);
      }

    } catch (error) {
      console.error('❌ Failed to load cap model:', error);
      console.warn('⚠️ Continuing without cap model visualization');
    }
  };

  /**
   * Get the current 3D viewport ID
   */
  const getCurrentViewportId = () => {
    try {
      const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
      if (!renderingEngine) return 'volume3d-viewport';

      const viewports = renderingEngine.getViewports();
      for (const vp of viewports) {
        if (vp.type === 'volume3d' || (vp.type as string) === 'VOLUME_3D') {
          return vp.id;
        }
      }
    } catch (error) {
      console.error('Error getting viewport ID:', error);
    }

    return 'volume3d-viewport'; // Default fallback
  };

  /**
   * Construct screw transform matrix from viewport cameras and crosshair center
   *
   * Transform matrix structure (4x4 in row-major order):
   * - Column 0 [0:3, 0]: Axial plane normal (X-axis of screw coordinate system)
   * - Column 1 [0:3, 1]: Axial view up (Y-axis of screw coordinate system)
   * - Column 2 [0:3, 2]: Sagittal view normal (Z-axis of screw coordinate system)
   * - Column 3 [0:3, 3]: Crosshair center (translation/position)
   * - Row 3: [0, 0, 0, 1] (homogeneous coordinates)
   *
   * @returns Float32Array(16) - 4x4 transform matrix in row-major order, or null if data unavailable
   */
  const constructScrewTransform = () => {
    try {
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔧 [ScrewManagement] CONSTRUCTING SCREW TRANSFORM');
      console.log('═══════════════════════════════════════════════════════');

      // Step 1: Clear cache and get fresh crosshair data
      console.log('🔄 Clearing crosshair cache to get fresh data...');
      crosshairsHandler.clearCache();

      // Get crosshair center (translation)
      const crosshairCenter = crosshairsHandler.getCrosshairCenter();

      console.log('📋 Crosshair center received:', crosshairCenter);

      if (!crosshairCenter) {
        console.warn('⚠️ Crosshair center is not available');
        console.warn('💡 Hint: Activate the crosshairs tool from the toolbar and position it');
        return null;
      }

      const translation = crosshairCenter;
      console.log('✅ Crosshair center (translation):', translation);

      // Step 2: Get rendering engine and viewports
      const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
      if (!renderingEngine) {
        console.error('❌ Rendering engine not found');
        return null;
      }

      // Step 3: Find axial and sagittal viewports
      let axialViewport = null;
      let sagittalViewport = null;
      let coronalViewport = null;

      const viewports = renderingEngine.getViewports();
      for (const vp of viewports) {
        const vpId = vp.id.toLowerCase();
        if (vpId.includes('axial')) {
          axialViewport = vp;
          console.log(`✅ Found axial viewport: ${vp.id}`);
        } else if (vpId.includes('sagittal')) {
          sagittalViewport = vp;
          console.log(`✅ Found sagittal viewport: ${vp.id}`);
        } else if (vpId.includes('coronal')) {
          coronalViewport = vp;
          console.log(`✅ Found coronal viewport: ${vp.id}`);
        }
      }

      if (!axialViewport || !sagittalViewport || !coronalViewport) {
        console.error('❌ Could not find required viewports (axial, sagittal, and coronal)');
        console.log('Available viewports:', viewports.map(vp => vp.id));
        return null;
      }

      // Step 4: Get camera data from viewports
      const axialCamera = axialViewport.getCamera();
      const sagittalCamera = sagittalViewport.getCamera();
      const coronalCamera = coronalViewport.getCamera();

      const axialNormal = axialCamera.viewPlaneNormal;
      const coronalNormal = [-coronalCamera.viewPlaneNormal[0], -coronalCamera.viewPlaneNormal[1], -coronalCamera.viewPlaneNormal[2]];
      const sagittalNormal = sagittalCamera.viewPlaneNormal;



      console.log('───────────────────────────────────────────────────────');
      console.log('📐 Camera vectors:');
      console.log('  Axial Normal (col 0):', axialNormal);
      console.log('  Coronal Normal (col 1, negated):', coronalNormal);
      console.log('  Sagittal Normal (col 2):', sagittalNormal);

      // Step 5: Construct 4x4 transform matrix in row-major order
      // Row-major layout for a 4x4 matrix:
      // [
      //   m00, m01, m02, m03,  <- Row 0
      //   m10, m11, m12, m13,  <- Row 1
      //   m20, m21, m22, m23,  <- Row 2
      //   m30, m31, m32, m33   <- Row 3
      // ]
      //
      // Where columns are:
      // Column 0 (m00, m10, m20, m30): Axial normal + 0
      // Column 1 (m01, m11, m21, m31): Axial up + 0
      // Column 2 (m02, m12, m22, m32): Sagittal normal + 0
      // Column 3 (m03, m13, m23, m33): Translation + 1

      const transform = new Float32Array([
        // Row 0: X-components of basis vectors + translation X
        axialNormal[0], coronalNormal[0], sagittalNormal[0], translation[0],

        // Row 1: Y-components of basis vectors + translation Y
        axialNormal[1], coronalNormal[1], sagittalNormal[1], translation[1],

        // Row 2: Z-components of basis vectors + translation Z
        axialNormal[2], coronalNormal[2], sagittalNormal[2], translation[2],

        // Row 3: Homogeneous coordinates
        0, 0, 0, 1
      ]);

      console.log('───────────────────────────────────────────────────────');
      console.log('✅ Transform matrix constructed (4x4 row-major):');
      console.log('  Row 0:', [transform[0], transform[1], transform[2], transform[3]]);
      console.log('  Row 1:', [transform[4], transform[5], transform[6], transform[7]]);
      console.log('  Row 2:', [transform[8], transform[9], transform[10], transform[11]]);
      console.log('  Row 3:', [transform[12], transform[13], transform[14], transform[15]]);
      console.log('═══════════════════════════════════════════════════════');

      return transform;

    } catch (error) {
      console.error('❌ Error constructing screw transform:', error);
      console.error('Stack:', error.stack);
      return null;
    }
  };

  /**
   * Get only screw body models, excluding cap models
   * Cap models are identified by modelName ending with "-Cap" or being "Screw Cap"
   */
  const getScrewBodyModels = () => {
    const allModels = modelStateService.getAllModels();
    return allModels.filter(model => {
      const modelName = model.metadata.name || '';
      return !modelName.endsWith('-Cap') && modelName !== 'Screw Cap';
    });
  };

  /**
   * Parse vertebral level and side from screw label
   * Format: "L3L" -> { level: "L3", side: "left" }
   *         "L3R" -> { level: "L3", side: "right" }
   *         "T5L" -> { level: "T5", side: "left" }
   *         "C7R" -> { level: "C7", side: "right" }
   */
  const parseLevelAndSideFromLabel = (label: string): { level: string; side: string } => {
    // Match format: L3L, L3R, T5L, C7R, etc.
    // Pattern: {level}{side_abbr}, where level = L/T/C/S + number, side_abbr = L or R
    const pattern = /^([LTCS]\d+)([LR])$/i;
    const match = label.trim().match(pattern);

    if (match) {
      const level = match[1].toUpperCase(); // L3, T5, C7, S1, etc.
      const sideAbbr = match[2].toUpperCase(); // L or R
      const side = sideAbbr === 'L' ? 'left' : 'right';
      return { level, side };
    }

    // If parsing fails, return default values
    console.warn(`⚠️ Cannot parse vertebral level and side from label "${label}", using default values`);
    return { level: 'Unknown', side: 'unknown' };
  };

  const saveScrew = async (screwData: {
    name: string;
    radius: number;
    length: number;
    source: 'custom' | 'catalog';
    variantId?: string;
    manufacturer?: string;
    screwType?: string;
  }) => {
    try {
      const { name: screwLabel, radius: radiusValue, length: lengthValue, source, variantId, manufacturer, screwType } = screwData;

      console.log('💾 Saving screw:', screwData);
      console.log('📝 Screw label:', screwLabel);

      // Construct screw transform from viewport cameras and crosshair center
      const transformMatrix = constructScrewTransform();

      if (!transformMatrix) {
        console.warn('⚠️ Could not construct transform matrix - crosshairs may not be active');
        console.warn('This usually means:');
        console.warn('- Crosshairs tool is not active');
        console.warn('- Required viewports (axial/sagittal) not found');
        console.warn('Proceeding to save without transform data');
      }

      // Convert Float32Array to regular array for JSON serialization
      const transform = transformMatrix ? Array.from(transformMatrix) : [];

      if (transform.length > 0) {
        console.log('✅ Screw transform captured from viewport cameras and crosshair center');
      } else {
        console.log('⚠️ Saving screw without transform data');
      }

      // ═════════════════════════════════════════════════════════
      // STEP 1: Save screw to planning API
      // ═════════════════════════════════════════════════════════
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔧 [ScrewManagement] SAVING SCREW TO PLANNING API');
      console.log('═══════════════════════════════════════════════════════');

      if (!sessionId) {
        console.error('❌ No active session. Cannot save screw.');
        console.error('   Session status:', sessionStatus);
        console.error('   Attempting to create session now...');

        // Try to create session now
        await initializeSession();

        // Check if session was created
        if (!sessionId) {
          alert('⚠️ Planning API not available.\n\nScrew will be saved locally only.\nCheck console for details.');
          // Continue with localStorage save as fallback
          console.warn('⚠️ Saving to localStorage only (no backend session)');
        } else {
          console.log('✅ Session created successfully, continuing with save...');
        }
      }

      // Get current viewport states for UI restoration
      const viewportStates = viewportStateService.getCurrentViewportStates();

      // Extract position and direction from transform matrix
      const entryPoint = transform ? {
        x: transform[3],  // Translation X (index 3)
        y: transform[7],  // Translation Y (index 7)
        z: transform[11]  // Translation Z (index 11)
      } : { x: 0, y: 0, z: 0 };

      // Extract direction from Y-axis of transform (column 1, indices 4, 5, 6)
      // This represents the screw's long axis
      const direction = transform ? [
        transform[4],  // Y-axis X component
        transform[5],  // Y-axis Y component
        transform[6]   // Y-axis Z component
      ] : [0, 1, 0];

      console.log('📍 Extracted screw position:', entryPoint);
      console.log('🎯 Extracted screw direction:', direction);

      // Construct screw variant ID based on source
      let screwVariantId;
      let notes;

      if (source === 'catalog' && variantId) {
        screwVariantId = variantId;
        notes = `Catalog screw from ${manufacturer} - ${screwType}: ${screwLabel}`;
        console.log(`📦 Using catalog screw variant: ${screwVariantId}`);
      } else {
        screwVariantId = `generated-${radiusValue}-${lengthValue}`;
        notes = `Custom screw: ${screwLabel}`;
        console.log(`⚙️ Using custom screw variant: ${screwVariantId}`);
      }

      const { level, side } = parseLevelAndSideFromLabel(screwLabel);
      console.log(`🏷️ Parsed from label "${screwLabel}": level=${level}, side=${side}`);

      let savedScrewId = null;
      try {
        const response = await planningBackendService.addScrew({
          sessionId: sessionId,
          screw: {
            caseId: 'OHIF-CASE-' + Date.now(), // TODO: Get from actual case service
            radius: radiusValue,
            length: lengthValue,
            screwLabel: screwLabel,  // Send user's label
            screwVariantId: screwVariantId,
            // vertebralLevel: 'unknown',  // Could be auto-detected later
            // side: 'unknown',           // Could be auto-detected later
            vertebralLevel: level,
            side: side,
            entryPoint: entryPoint,    // Now extracted from crosshair position
            trajectory: {
              direction: direction,    // Now extracted from transform matrix
              insertionDepth: lengthValue,
              convergenceAngle: 0,
              cephaladAngle: 0
            },
            notes: notes,
            transformMatrix: transform,
            viewportStatesJson: JSON.stringify(viewportStates),
            placedAt: new Date().toISOString(),
            autoLabel: false
          }
        });

        if (!response.success) {
          throw new Error(response.error || 'Failed to save screw');
        }

        savedScrewId = response.screw_id;

        console.log(`✅ Screw saved to planning API: ${response.screw_id}`);

      } catch (apiError) {
        console.error('❌ Failed to save screw to API:', apiError);

        // Check if error is about maximum limit reached
        const errorMessage = apiError?.message || apiError?.error || String(apiError);
        console.log('🔍 Error message for limit check:', errorMessage);

        const isLimitError = errorMessage.toLowerCase().includes('maximum limit') ||
                            errorMessage.toLowerCase().includes('capacity') ||
                            errorMessage.toLowerCase().includes('maximum of') ||
                            errorMessage.toLowerCase().includes('screws reached') ||
                            errorMessage.toLowerCase().includes('cannot add screw');

        console.log('🔍 Is limit error?', isLimitError);

        if (isLimitError) {
          // Show the proper limit error message
          alert(`Maximum of 10 screws reached. Please delete some screws before adding more.`);
        } else {
          // Show generic error for other issues
          alert('Failed to save screw. Please check the console for details.');
        }
        return;
      }

      // ═════════════════════════════════════════════════════════
      // STEP 2: Load and display the 3D model
      // ═════════════════════════════════════════════════════════
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔧 [ScrewManagement] LOADING 3D MODEL');
      console.log('═══════════════════════════════════════════════════════');

       // Check model limit - only count screw body models, exclude cap models
       const screwBodyModels = getScrewBodyModels();
       const maxModels = 10; // Match Python backend MAX_SCREWS limit

       if (screwBodyModels.length >= maxModels) {
         console.warn(`⚠️ Maximum number of screws (${maxModels}) reached.`);
         alert(`Maximum of ${maxModels} screws reached. Please delete some screws before adding more.`);
         return;
       }

       const allModels = modelStateService.getAllModels();
       console.log(`📊 Current screw bodies: ${screwBodyModels.length}/${maxModels} (total models: ${allModels.length})`);

      // Load the 3D model using the new API
      try {
        await loadScrewModel(radiusValue, lengthValue, transform, screwLabel);
        console.log(`✅ Model loaded successfully - Total: ${modelStateService.getAllModels().length}/${maxModels}`);

        // ═════════════════════════════════════════════════════════
        // Load cap model after loading screw body (cap doesn't count toward model limit)
        // ═════════════════════════════════════════════════════════
        if (transform && transform.length === 16) {
          try {
            await loadCapModel(transform, lengthValue, screwLabel, savedScrewId);
            console.log(`✅ Cap model loaded successfully for screw "${screwLabel}"`);
          } catch (capError) {
            console.warn('⚠️ Could not load cap model:', capError.message);
            console.warn('⚠️ Cap model failed but screw model loaded successfully');
            // Don't throw - cap is optional, continue execution
          }
        } else {
          console.warn('⚠️ Skipping cap model load - no valid transform available');
        }
      } catch (modelError) {
        console.warn('⚠️ Could not load model:', modelError.message);
        console.warn('⚠️ Screw saved but model may not be visible');
      }

      // ═════════════════════════════════════════════════════════
      // STEP 3: Update UI
      // ═════════════════════════════════════════════════════════

      // Reload screws from API
      if (sessionId) {
        await loadScrews(sessionId);
      }

      console.log(`✅ Saved screw: "${screwLabel}" (R: ${radiusValue}mm, L: ${lengthValue}mm)`);

    } catch (error) {
      console.error('Failed to save screw:', error);
      alert('Failed to save screw. Please check the console for details.');
    }
  };

  const restoreScrew = async (screwData) => {
    try {
      setIsRestoring(true);

      const allModels = modelStateService.getAllModels();


      let displayInfo;
      try {
        displayInfo = getScrewDisplayInfo(screwData);
      } catch (error) {
        console.error('❌ Cannot restore screw - invalid dimensions:', error);
        alert(`Cannot restore screw: ${error.message}\n\nThis screw has invalid or missing dimensions and cannot be loaded.`);
        setIsRestoring(false);
        return;
      }

      console.log(`🔄 Restoring screw: "${displayInfo.label}"`);
      console.log(`   Source: ${displayInfo.source}`);
      console.log(`   Dimensions: R=${displayInfo.radius}mm, L=${displayInfo.length}mm`);

      // ═══════════════════════════════════════════════════════════
      // Get transform - API now returns it already parsed as array
      // ═══════════════════════════════════════════════════════════
      let transformArray = screwData.transform_matrix;

      console.log(`🔍 transform_matrix type: ${typeof transformArray}`);
      console.log(`🔍 transform_matrix is array: ${Array.isArray(transformArray)}`);
      console.log(`🔍 transform_matrix length: ${transformArray?.length}`);

      // Validate it's a proper array with 16 elements
      if (!transformArray || !Array.isArray(transformArray) || transformArray.length !== 16) {
        console.error(`❌ Invalid transform_matrix! Type: ${typeof transformArray}, Length: ${transformArray?.length}`);
        console.warn(`⚠️ Loading screw without transform - will appear at origin`);
        transformArray = null;
      } else {
        // Convert to Float32Array for VTK
        transformArray = new Float32Array(transformArray);
        console.log(`✅ Valid transform array converted to Float32Array`);
        console.log(`📐 Translation: (${transformArray[3].toFixed(2)}, ${transformArray[7].toFixed(2)}, ${transformArray[11].toFixed(2)})`);
      }

      // Check if model already exists for this screw
      const loadedModels = modelStateService.getAllModels();
      let modelExists = false;

      for (const model of loadedModels) {
        // PRIORITY 1: Check by name (which stores screwLabel) - most reliable exact match
        if (model.metadata.name && model.metadata.name === displayInfo.label) {
          modelExists = true;
          console.log(`ℹ️ Model already exists for screw "${displayInfo.label}"`);
          console.log(`   Existing model: ${model.metadata.id} (${model.metadata.name})`);
          console.log(`   Matched by name (exact match)`);
          console.log(`   Skipping model load to avoid duplicates`);
          break;
        }

        // FALLBACK: Check if model matches by dimensions/filename (for legacy models without custom names)
        const modelName = model.metadata.name.toLowerCase();
        if (modelName.includes(displayInfo.label.toLowerCase()) ||
            (displayInfo.radius && modelName.includes(displayInfo.radius.toString())) ||
            (displayInfo.length && modelName.includes(displayInfo.length.toString()))) {
          modelExists = true;
          console.log(`ℹ️ Model already exists for screw "${displayInfo.label}"`);
          console.log(`   Existing model: ${model.metadata.id} (${model.metadata.name})`);
          console.log(`   Matched by dimensions/filename (legacy)`);
          console.log(`   Skipping model load to avoid duplicates`);
          break;
        }
      }

      // Define maxModels outside the if block so it's available for the final log statement
      const maxModels = 10; // Match Python backend MAX_SCREWS limit

      // Only check limit if we need to load a new model
      // If model already exists, we can just restore viewport state (view/locate operation)
      if (!modelExists) {
        // Check if we've reached the maximum number of models - only count screw body models
        const screwBodyModels = getScrewBodyModels();

        if (screwBodyModels.length >= maxModels) {
          console.warn(`⚠️ Maximum number of screws (${maxModels}) reached. Cannot restore more screws.`);
          alert(`Maximum of ${maxModels} screws reached. Please delete some screws before restoring more.`);
          setIsRestoring(false);
          return;
        }

        // Load and display the 3D model
        const screwId = screwData.screw_id || screwData.id || null;
        await loadScrewModel(displayInfo.radius, displayInfo.length, transformArray, displayInfo.label, screwId);

        // ═════════════════════════════════════════════════════════
        // Load cap model after loading screw body (cap doesn't count toward model limit)
        // ═════════════════════════════════════════════════════════
        if (transformArray && transformArray.length === 16) {
          try {
            await loadCapModel(transformArray, displayInfo.length, displayInfo.label, screwId);
            console.log(`✅ Cap model loaded successfully for screw "${displayInfo.label}"`);
          } catch (capError) {
            console.warn('⚠️ Could not load cap model:', capError.message);
            // Don't throw - cap is optional, continue execution
          }
        } else {
          console.warn(`⚠️ Skipping cap model load for "${displayInfo.label}" - no valid transform available`);
        }
      } else {
        console.log(`✅ Skipped loading duplicate model for "${displayInfo.label}"`);
      }

      // Restore viewport states if available
      if (screwData.viewport_states_json || screwData.viewportStates) {
        try {
          // API now returns viewport_states_json already parsed as object
          // Check if it's already an object or still a string
          let viewportStates = screwData.viewport_states_json || screwData.viewportStates;

          if (typeof viewportStates === 'string') {
            console.log('🔄 Parsing viewport_states_json from string');
            viewportStates = JSON.parse(viewportStates);
          }

          console.log('📊 Viewport states type:', typeof viewportStates);
          console.log('📊 Viewport IDs:', Object.keys(viewportStates || {}));

          viewportStateService.restoreViewportStates(viewportStates);
          console.log('✅ Viewport states restored');
        } catch (stateError) {
          console.warn('⚠️ Could not restore viewport states:', stateError);
          console.error('   Error details:', stateError);
        }
      }

      console.log(`✅ Restored screw - Total models: ${modelStateService.getAllModels().length}/${maxModels}`);

    } catch (error) {
      console.error('Failed to restore screw:', error);
      alert('Failed to restore screw. Please check the console for details.');
    } finally {
      setIsRestoring(false);
    }
  };

  const deleteScrew = async (screwData) => {
    try {
      const screwId = screwData.screw_id || screwData.id || screwData.name;

      // Try to get display info, but allow deletion even if dimensions are invalid
      let displayInfo;
      try {
        displayInfo = getScrewDisplayInfo(screwData);
      } catch (error) {
        console.warn('⚠️ Deleting screw with invalid dimensions:', error);
        displayInfo = {
          label: screwId,
          source: 'unknown',
          radius: 0,
          length: 0,
          description: 'Invalid Data'
        };
      }

      console.log(`🗑️ Deleting screw: "${displayInfo.label}" (${screwId})`);
      console.log(`   Source: ${displayInfo.source}`);

      // Try to delete from API first
      if (sessionId && screwId) {
        try {
          console.log('🔍 [DeleteScrew] sessionId:', sessionId);
          console.log('   screwId:', screwId);

          const response = await planningBackendService.deleteScrew(screwId, sessionId);

          if (!response.success) {
            console.warn('⚠️ API delete failed, continuing with local cleanup:', response.error);
          } else {
            console.log('✅ Deleted screw from API');
          }
        } catch (apiError) {
          console.warn('⚠️ API delete failed, continuing with local cleanup:', apiError);
        }
      }

      // Remove associated 3D models
      const loadedModels = modelStateService.getAllModels();
      let modelsRemoved = 0;

      // Use displayInfo for better matching
      console.log(`   Looking for models with label="${displayInfo.label}", R=${displayInfo.radius}mm, L=${displayInfo.length}mm`);

      for (const model of loadedModels) {
        // PRIORITY 1: Check by name (which stores screwLabel) - most reliable exact match
        if (model.metadata.name && model.metadata.name === displayInfo.label) {
          console.log(`🗑️ Removing model: ${model.metadata.id} (${model.metadata.name}) - matched by name (exact match)`);
          modelStateService.removeModel(model.metadata.id);
          modelsRemoved++;
          break; // Found exact match, stop searching
        }
      }

      // FALLBACK: If no exact name match, try matching by dimensions/filename (for legacy models)
      if (modelsRemoved === 0) {
        for (const model of loadedModels) {
          const modelName = model.metadata.name.toLowerCase();

          // Check if model matches screw dimensions or partial label
          if ((displayInfo.radius && modelName.includes(displayInfo.radius.toString())) ||
              (displayInfo.length && modelName.includes(displayInfo.length.toString())) ||
              modelName.includes(displayInfo.label.toLowerCase())) {
            console.log(`🗑️ Removing model: ${model.metadata.id} (${model.metadata.name}) - matched by dimensions/filename`);
            modelStateService.removeModel(model.metadata.id);
            modelsRemoved++;
            break; // Remove only one model
          }
        }
      }

      // Step 2: Remove associated cap model (screw and cap are a pair)
      const updatedModels = modelStateService.getAllModels(); // Get updated list after removing screw body
      let capRemoved = false;

      // Try matching cap by modelId (format: `${screwId}-cap`)
      if (screwId) {
        const capModelId = `${screwId}-cap`;
        for (const model of updatedModels) {
          if (model.metadata.id === capModelId) {
            console.log(`🗑️ Removing cap model: ${model.metadata.id} (${model.metadata.name}) - matched by modelId`);
            modelStateService.removeModel(model.metadata.id);
            modelsRemoved++;
            capRemoved = true;
            break;
          }
        }
      }

      // Try matching cap by modelName (format: `${screwLabel}-Cap`)
      if (!capRemoved && displayInfo.label) {
        const capModelName = `${displayInfo.label}-Cap`;
        for (const model of updatedModels) {
          if (model.metadata.name === capModelName) {
            console.log(`🗑️ Removing cap model: ${model.metadata.id} (${model.metadata.name}) - matched by modelName`);
            modelStateService.removeModel(model.metadata.id);
            modelsRemoved++;
            capRemoved = true;
            break;
          }
        }
      }

      // FALLBACK: Try matching cap by name pattern (contains "-Cap" suffix)
      if (!capRemoved && displayInfo.label) {
        for (const model of updatedModels) {
          const modelName = model.metadata.name || '';
          if (modelName.includes('-Cap') && modelName.includes(displayInfo.label)) {
            console.log(`🗑️ Removing cap model: ${model.metadata.id} (${model.metadata.name}) - matched by name pattern`);
            modelStateService.removeModel(model.metadata.id);
            modelsRemoved++;
            break;
          }
        }
      }



      console.log(`✅ Removed ${modelsRemoved} model(s)`);

      // Reload screws from API
      if (sessionId) {
        await loadScrews(sessionId);
      } else {
        loadScrewsLocal();
      }

      console.log(`✅ Deleted screw: "${displayInfo.label}"`);

    } catch (error) {
      console.error('Error deleting screw:', error);
      alert('Failed to delete screw. Please check the console for details.');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREW INTERACTION TOOL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Debug function to check screw interaction state and plane cutters
   */
  const debugScrewInteraction = async () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔍 [DEBUG] SCREW & PLANE CUTTER STATE');
    console.log('═══════════════════════════════════════════════════════');

    // Check models
    const allModels = modelStateService.getAllModels();
    console.log(`📦 Loaded models: ${allModels.length}`);
    allModels.forEach((model, i) => {
      console.log(`   ${i + 1}. ${model.metadata?.name || model.metadata?.id}`);
      console.log(`      - fileUrl: ${model.metadata?.fileUrl || 'unknown'}`);
      console.log(`      - hasPolyData: ${!!model.polyData}`);
      console.log(`      - hasActor: ${!!model.actor}`);
    });

    // Check screws from API
    console.log(`\n🔩 Screws from API: ${screws.length}`);
    screws.forEach((screw, i) => {
      console.log(`   ${i + 1}. ${screw.screw_label || screw.name || 'unnamed'}`);
    });

    // Check PlaneCutterService
    console.log(`\n🔪 PlaneCutterService:`);
    if (planeCutterService) {
      console.log(`   - isEnabled: ${planeCutterService.getIsEnabled()}`);
      const planeCutters = planeCutterService.getPlaneCutters?.() || [];
      console.log(`   - planeCutters count: ${planeCutters.length}`);
      planeCutters.forEach((pc, i) => {
        console.log(`   ${i + 1}. viewportId: ${pc.viewportId}, orientation: ${pc.orientation}`);
        console.log(`      - modelCutters: ${pc.modelCutters?.size || 0}`);
      });

      // Try to reinitialize if no plane cutters
      if (planeCutters.length === 0) {
        console.log('\n⚠️ No plane cutters found! Attempting to initialize...');
        try {
          await planeCutterService.initialize();
          planeCutterService.enable();
          console.log('✅ Plane cutters initialized and enabled');
        } catch (error) {
          console.error('❌ Failed to initialize plane cutters:', error);
        }
      }
    } else {
      console.log(`   ❌ PlaneCutterService not available!`);
    }

    // Check viewports
    console.log(`\n🖼️ Available Viewports:`);
    const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
    if (renderingEngine) {
      const viewports = renderingEngine.getViewports();
      viewports.forEach((vp, i) => {
        console.log(`   ${i + 1}. ${vp.id} (type: ${vp.type})`);
      });
    }

    // Check tool groups
    const allToolGroups = ToolGroupManager.getAllToolGroups();
    console.log(`\n🛠️ Tool groups: ${allToolGroups.length}`);
    allToolGroups.forEach((tg, i) => {
      console.log(`   ${i + 1}. ${tg.id}`);
      const viewportIds = tg.getViewportIds?.() || [];
      console.log(`      viewports: ${viewportIds.join(', ')}`);
    });

    console.log('═══════════════════════════════════════════════════════');

    // Show alert with summary
    const planeCutters = planeCutterService?.getPlaneCutters?.() || [];
    alert(`Debug Info:\n\nModels: ${allModels.length}\nScrews (API): ${screws.length}\nPlaneCutters: ${planeCutters.length}\nPlaneCutter Enabled: ${planeCutterService?.getIsEnabled()}\n\nCheck console for details.`);
  };

  /**
   * Toggle the Screw Interaction Tool (Move Screw)
   * When active, users can click and drag screws on MPR planes
   */
  const toggleMoveTool = () => {
    try {
      // First, ensure the tool is registered globally with cornerstoneTools
      registerScrewInteractionTool();

      const toolName = 'ScrewInteraction';

      // Get all tool groups and find one that has viewports
      const allToolGroups = ToolGroupManager.getAllToolGroups();
      console.log('📋 [ScrewManagement] All tool groups:', allToolGroups.map(g => `${g.id} (${g.getViewportIds?.()?.length || 0} viewports)`));

      // Find the tool group that contains MPR viewports (fourUpMesh viewports)
      let foundToolGroup = null;

      for (const tg of allToolGroups) {
        const viewportIds = tg.getViewportIds?.() || [];
        console.log(`   Checking "${tg.id}": ${viewportIds.length} viewport(s)`);

        // Check if this tool group has MPR viewports
        const hasMPRViewports = viewportIds.some(vpId =>
          vpId.includes('mpr') || vpId.includes('axial') || vpId.includes('coronal') || vpId.includes('sagittal')
        );

        if (hasMPRViewports && viewportIds.length > 0) {
          foundToolGroup = tg;
          console.log(`✅ [ScrewManagement] Found tool group with MPR viewports: ${tg.id}`);
          break;
        }

        // Also accept any tool group with viewports
        if (!foundToolGroup && viewportIds.length > 0) {
          foundToolGroup = tg;
        }
      }

      if (!foundToolGroup) {
        console.error('❌ [ScrewManagement] No tool group with viewports found!');
        console.error('   This usually means the viewports are not properly set up.');
        return;
      }

      const toolGroup = foundToolGroup;
      console.log(`✅ [ScrewManagement] Using tool group: ${toolGroup.id}`);

      // Check if tool is already in the tool group, if not add it
      let toolInstance = toolGroup.getToolInstance(toolName);
      if (!toolInstance) {
        console.log(`📦 [ScrewManagement] Adding ${toolName} to tool group`);
        try {
          toolGroup.addTool(toolName);
          toolInstance = toolGroup.getToolInstance(toolName);
        } catch (addError) {
          console.error(`❌ [ScrewManagement] Failed to add tool: ${addError.message}`);
        }
      }

      if (isMoveToolActive) {
        // Deactivate: Set to Passive (or Disabled)
        console.log('🔴 [ScrewManagement] Deactivating ScrewInteraction tool');
        try {
          toolGroup.setToolPassive(toolName);
        } catch (e) {
          toolGroup.setToolDisabled(toolName);
        }
        setIsMoveToolActive(false);
        setSelectedScrew(null);
      } else {
        // Activate: Set tool active with primary mouse button
        console.log('🟢 [ScrewManagement] Activating ScrewInteraction tool');
        console.log(`   ToolGroup ID: ${toolGroup.id}`);
        console.log(`   ToolGroup viewportsInfo:`, toolGroup.viewportsInfo);

        // Log all viewports in this tool group
        const viewportIds = toolGroup.getViewportIds?.() || [];
        console.log(`   Viewports in toolGroup: ${viewportIds.length}`);
        viewportIds.forEach((vpId, i) => {
          console.log(`      ${i + 1}. ${vpId}`);
        });

        // Set the servicesManager on the tool instance
        if (toolInstance && toolInstance.setServicesManager) {
          toolInstance.setServicesManager(servicesManager);
          console.log('✅ [ScrewManagement] ServicesManager set on tool instance');
        } else {
          console.warn('⚠️ [ScrewManagement] Could not set servicesManager on tool');
          console.warn('   toolInstance:', toolInstance);
        }

        // Log current tool states before activation
        console.log('📋 Current tool options in toolGroup:');
        const toolOptions = toolGroup.toolOptions;
        if (toolOptions) {
          Object.keys(toolOptions).forEach(tn => {
            console.log(`   - ${tn}: mode=${toolOptions[tn]?.mode}, bindings=${JSON.stringify(toolOptions[tn]?.bindings)}`);
          });
        }

        toolGroup.setToolActive(toolName, {
          bindings: [{ mouseButton: 1 }] // Left mouse button (Primary)
        });

        console.log('✅ [ScrewManagement] Tool activated with primary mouse button binding');

        // Verify activation
        const toolOptionsAfter = toolGroup.toolOptions;
        if (toolOptionsAfter && toolOptionsAfter[toolName]) {
          console.log(`   Tool mode after activation: ${toolOptionsAfter[toolName]?.mode}`);
          console.log(`   Tool bindings after activation: ${JSON.stringify(toolOptionsAfter[toolName]?.bindings)}`);
        }

        // Debug: Check which viewports are in this tool group
        console.log('');
        console.log('🔍 [DEBUG] Tool Group Viewport Check:');
        const toolGroupViewportIds = toolGroup.getViewportIds?.() || [];
        console.log(`   Tool group "${toolGroup.id}" has ${toolGroupViewportIds.length} viewport(s):`);
        toolGroupViewportIds.forEach((vpId, i) => {
          console.log(`      ${i + 1}. ${vpId}`);
        });

        // Check all viewports in rendering engine
        const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
        if (renderingEngine) {
          const allViewports = renderingEngine.getViewports();
          console.log(`   Rendering engine has ${allViewports.length} viewport(s):`);
          allViewports.forEach((vp, i) => {
            const isInToolGroup = toolGroupViewportIds.includes(vp.id);
            console.log(`      ${i + 1}. ${vp.id} (type: ${vp.type}) - ${isInToolGroup ? '✅ IN tool group' : '❌ NOT in tool group'}`);
          });
        }
        console.log('');
        console.log('⚠️ NOTE: ScrewInteraction tool will ONLY respond to clicks in viewports that are IN the tool group!');
        console.log('');

        setIsMoveToolActive(true);
      }
    } catch (error) {
      console.error('❌ [ScrewManagement] Error toggling move tool:', error);
    }
  };

  const testCrosshairDetection = () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🧪 [DEBUG] TESTING CROSSHAIR DETECTION');
    console.log('═══════════════════════════════════════════════════════');

    try {
      // Clear cache first
      crosshairsHandler.clearCache();
      console.log('✅ Cache cleared');

      // Get crosshair center (single shared center)
      const crosshairCenter = crosshairsHandler.getCrosshairCenter();

      console.log('📊 Crosshair Detection Results (Shared Center):');
      console.log('  - hasCenter:', !!crosshairCenter);
      console.log('  - center:', crosshairCenter);

      // Test with all MPR viewports (more reliable check)
      const mprData = crosshairsHandler.getAllMPRCrosshairCenters();
      console.log('📊 MPR Crosshair Centers (All Viewports):');

      let validViewportCount = 0;
      for (const [vpId, center] of Object.entries(mprData)) {
        console.log(`  ${vpId}:`, {
          center: center
        });
        if (center) {
          validViewportCount++;
        }
      }

      console.log(`📊 Valid viewports with crosshairs: ${validViewportCount}/${Object.keys(mprData).length}`);

      // Check rendering engines and viewports
      const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
      if (renderingEngine) {
        const viewports = renderingEngine.getViewports();
        console.log('📊 Available Viewports:', viewports.map(vp => ({
          id: vp.id,
          type: vp.type,
          element: !!vp.element
        })));
      } else {
        console.error('❌ Rendering engine not found');
      }

      // Log result to console
      if (crosshairCenter) {
        console.log('✅ Crosshairs Detected!');
        console.log(`Position: [${crosshairCenter[0].toFixed(2)}, ${crosshairCenter[1].toFixed(2)}, ${crosshairCenter[2].toFixed(2)}]`);
        console.log('Check browser console (F12) for detailed information.');
      } else {
        console.warn('❌ Crosshairs Not Detected');
        console.warn('The crosshairs tool may not be active or position data is unavailable.');
        console.warn('How to activate:');
        console.warn('1. Click the crosshairs icon in the toolbar');
        console.warn('2. Click and drag in any viewport');
        console.warn('3. Try this test again');
      }

      console.log('═══════════════════════════════════════════════════════');

    } catch (error) {
      console.error('❌ Error testing crosshair detection:', error);
      console.error('Stack:', error.stack);
    }
  };

  /**
   * Show session state dialog with comparison of UI state and backend state
   */
  const showSessionState = async () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 [SessionState] Opening session state dialog');
    console.log('═══════════════════════════════════════════════════════');

    // Open dialog immediately
    setShowSessionStateDialog(true);
    setSummaryLoading(true);
    setSummaryError(null);
    setBackendSummary(null);

    // Fetch backend summary if session exists
    if (sessionId) {
      try {
        console.log('📊 [SessionState] Fetching backend summary...');
        const response = await planningBackendService.getSessionSummary(sessionId);

        if (response.success && response.summary) {
          setBackendSummary(response.summary);
          console.log('✅ [SessionState] Backend summary loaded');
        } else {
          throw new Error(response.error || 'Failed to fetch session summary');
        }
      } catch (error) {
        console.error('❌ [SessionState] Error fetching backend summary:', error);
        setSummaryError(error.message || 'Failed to fetch backend summary');
      }
    } else {
      console.warn('⚠️ [SessionState] No active session ID');
      setSummaryError('No active session');
    }

    setSummaryLoading(false);
  };

  const editScrew = async (screwData) => {
    try {
      const screwId = screwData.screw_id || screwData.id || screwData.name;
      const displayInfo = getScrewDisplayInfo(screwData);

      console.log('✏️ Edit screw requested:', displayInfo.label);
      alert(`Edit functionality coming soon!\n\nScrew: ${displayInfo.label}\nRadius: ${displayInfo.radius}mm\nLength: ${displayInfo.length}mm\n\nFor now, please delete and recreate the screw with new values.`);

      // TODO: Implement edit functionality
      // - Open edit dialog with current values
      // - Update screw in backend
      // - Reload 3D model with new dimensions

    } catch (error) {
      console.error('Failed to edit screw:', error);
      alert('Failed to edit screw. Please check the console for details.');
    }
  };

  const clearAllScrews = async () => {
    try {
      console.log('═══════════════════════════════════════════════════════');
      console.log('🧹 [ClearAll] Clearing all screws from frontend and backend');
      console.log('═══════════════════════════════════════════════════════');

      // Confirm action
      const confirmed = confirm(
        `⚠️ Clear All Screws?\n\n` +
        `This will permanently delete all ${screws.length} screw(s) from:\n` +
        `• Frontend UI\n` +
        `• 3D Models\n` +
        `• Backend Session\n\n` +
        `This action cannot be undone.\n\n` +
        `Continue?`
      );

      if (!confirmed) {
        console.log('❌ [ClearAll] User cancelled');
        return;
      }

      // Step 1: Delete all screws from backend
      if (sessionId) {
        console.log('🗑️ [ClearAll] Step 1: Deleting screws from backend...');
        const deleteResponse = await planningBackendService.deleteAllScrews(sessionId);

        if (deleteResponse.success) {
          console.log(`✅ [ClearAll] Deleted ${deleteResponse.deleted_count || 0} screws from backend`);
          if (deleteResponse.failed_screw_ids && deleteResponse.failed_screw_ids.length > 0) {
            console.warn(`⚠️ [ClearAll] Failed to delete ${deleteResponse.failed_screw_ids.length} screws from backend`);
          }
        } else {
          console.error('❌ [ClearAll] Failed to delete screws from backend:', deleteResponse.error);
          const continueAnyway = confirm(
            `⚠️ Backend Delete Failed\n\n` +
            `Failed to delete screws from backend:\n${deleteResponse.error}\n\n` +
            `Do you want to clear the frontend anyway?`
          );

          if (!continueAnyway) {
            console.log('❌ [ClearAll] User cancelled after backend error');
            return;
          }
        }
      } else {
        console.warn('⚠️ [ClearAll] No active session - skipping backend delete');
      }

      // Step 2: Clear all 3D models from frontend
      console.log('🗑️ [ClearAll] Step 2: Clearing all 3D models from frontend...');
      modelStateService.clearAllModels();
      console.log('✅ [ClearAll] 3D models cleared');

      // Step 3: Clear local viewport state
      console.log('🗑️ [ClearAll] Step 3: Clearing local viewport state...');
      viewportStateService.clearAll();
      console.log('✅ [ClearAll] Viewport state cleared');

      // Step 4: Reload screws from backend (should now be empty)
      console.log('🔄 [ClearAll] Step 4: Reloading screws from backend...');
      if (sessionId) {
        await loadScrews(sessionId);
      } else {
        loadScrewsLocal();
      }

      console.log('═══════════════════════════════════════════════════════');
      console.log('✅ [ClearAll] All screws cleared successfully!');
      console.log(`   Frontend screws: ${screws.length}`);
      console.log('═══════════════════════════════════════════════════════');

    } catch (error) {
      console.error('❌ [ClearAll] Error clearing all screws:', error);
      alert(`Failed to clear all screws: ${error.message}\n\nCheck console for details.`);
    }
  };

  /**
   * Save current planning session as a plan
   */
  const savePlan = async () => {
    if (!sessionId || !studyInstanceUID || !seriesInstanceUID) {
      alert('Cannot save plan: Missing session or DICOM information');
      return;
    }

    if (screws.length === 0) {
      alert('Cannot save plan: No screws placed yet');
      return;
    }

    try {
      setIsSavingPlan(true);

      // Prompt for plan name
      const planName = prompt('Enter a name for this plan:', `Plan ${new Date().toLocaleString()}`);
      if (!planName) {
        setIsSavingPlan(false);
        return; // User cancelled
      }

      console.log('💾 Saving plan...');
      console.log(`   Session ID: ${sessionId}`);
      console.log(`   Case ID: ${caseId || 'none (standalone plan)'}`);
      console.log(`   Screws: ${screws.length}`);

      // Use caseId from URL params if available
      // Plans can be saved without a case (standalone plans)
      const effectiveCaseId = caseId || null;

      if (!effectiveCaseId) {
        const userConfirmed = confirm(
          '⚠️ No case is currently selected.\n\n' +
          'This plan will be saved as a standalone plan (not associated with any case).\n\n' +
          'To associate plans with cases, please open planning from a case in the WorkList.\n\n' +
          'Continue saving as standalone plan?'
        );

        if (!userConfirmed) {
          setIsSavingPlan(false);
          return; // User cancelled
        }

        console.log('ℹ️ Saving as standalone plan (no case association)');
      }

      const response = await planningBackendService.savePlan({
        sessionId,
        caseId: effectiveCaseId,
        studyInstanceUID,
        seriesInstanceUID,
        planData: {
          name: planName,
          description: `Plan with ${screws.length} screws`,
          surgeon
        }
      });

      if (response.success) {
        console.log('✅ Plan saved successfully:', response.plan_id);
        alert(`Plan saved successfully!\nPlan ID: ${response.plan_id}`);
      } else {
        throw new Error(response.error || 'Failed to save plan');
      }
    } catch (error) {
      console.error('❌ Error saving plan:', error);
      alert(`Failed to save plan: ${error.message}`);
    } finally {
      setIsSavingPlan(false);
    }
  };

  /**
   * Get display name and metadata for a screw
   * Throws error if radius/length are missing (no defaults)
   */
  const getScrewDisplayInfo = (screw) => {
    // Validate required fields
    if (!screw.radius || !screw.length) {
      const screwId = screw.screw_id || screw.name || 'unknown';
      throw new Error(
        `❌ Missing required screw dimensions for screw: ${screwId}\n` +
        `   radius: ${screw.radius}, length: ${screw.length}\n` +
        `   This indicates a data integrity issue - screws must have valid dimensions.`
      );
    }

    const radius = parseFloat(screw.radius);
    const length = parseFloat(screw.length);

    // Validate parsed values
    if (isNaN(radius) || isNaN(length) || radius <= 0 || length <= 0) {
      const screwId = screw.screw_id || screw.name || 'unknown';
      throw new Error(
        `❌ Invalid screw dimensions for screw: ${screwId}\n` +
        `   radius: ${radius}, length: ${length}\n` +
        `   Dimensions must be positive numbers.`
      );
    }

    // Use screw_label if available (e.g., "L3-R1", "L4-L2")
    const label = screw.screw_label || screw.name || screw.screw_id || 'Unknown Screw';

    // Determine source and parse manufacturer info from screw_variant_id
    let source: 'catalog' | 'generated' | 'unknown' = 'unknown';
    let manufacturerInfo = null;
    let description = 'Unknown Source';

    if (screw.screw_variant_id) {
      const variantId = screw.screw_variant_id;

      // Check if it's a generated/custom screw
      if (variantId.startsWith('generated-') || variantId.startsWith('screw-')) {
        source = 'generated';
        description = 'Custom Screw';
      } else {
        // It's a catalog screw - parse manufacturer info
        source = 'catalog';
        const parts = variantId.split('-');
        if (parts.length >= 4) {
          manufacturerInfo = {
            vendor: parts[0].toUpperCase(),
            model: parts.slice(1, -2).join('-').toUpperCase()
          };
          description = `${manufacturerInfo.vendor} ${manufacturerInfo.model}`;
        } else {
          description = 'Catalog Screw';
        }
      }
    }

    return {
      label,
      description,
      source,
      radius,
      length,
      manufacturerInfo
    };
  };

  /**
   * Load a saved plan
   */
  const loadPlan = async (planId: string) => {
    try {
      // Check if there are existing screws in the current session
      if (screws.length > 0) {
        const confirmed = confirm(
          '⚠️ Warning: Current Session Has Unsaved Work\n\n' +
          `You currently have ${screws.length} screw(s) in this session.\n\n` +
          'Loading another plan will DISCARD your current work.\n\n' +
          'Do you want to:\n' +
          '  ✓ YES - Discard current session and load the selected plan\n' +
          '  ✗ NO - Cancel and keep working on current session\n\n' +
          '💡 Tip: Save your current plan first if you want to keep it!'
        );

        if (!confirmed) {
          console.log('❌ Load plan cancelled by user - keeping current session');
          return; // User chose to keep current session
        }

        console.log('✅ User confirmed: discarding current session and loading plan');

        // Clear current screws and models before loading new plan
        console.log('🗑️ Clearing current session data...');
        modelStateService.clearAllModels();
        setScrews([]);
      }

      setIsLoading(true);
      console.log('📥 Loading and restoring plan:', planId);

      // Restore session from plan using backend service
      const response = await planningBackendService.restoreSessionFromPlan(planId);

      if (!response.success) {
        throw new Error(response.error || 'Failed to restore session from plan');
      }

      const plan = response.plan;
      console.log('✅ Session restored from plan:', plan.name);
      console.log(`   Session ID: ${response.session_id}`);
      console.log(`   Screws: ${response.screws_count}, Rods: ${response.rods_count}`);

      // Update UI state with restored session
      setSessionId(response.session_id);
      setStudyInstanceUID(plan.study_instance_uid);
      setSeriesInstanceUID(plan.series_instance_uid);
      setSurgeon(plan.surgeon || surgeon);
      if (plan.case_id) {
        setCaseId(plan.case_id);
      }
      setSessionStatus('ready');

      // Load screws from restored session
      await loadScrews(response.session_id);

      // Restore 3D models for visualization
      console.log('🎨 Restoring 3D models...');
      let modelsLoaded = 0;
      let modelsFailed = 0;

      for (const screw of plan.screws) {
        try {
          // Extract dimensions and metadata using helper function
          const displayInfo = getScrewDisplayInfo(screw);

          console.log(`   Loading model for ${displayInfo.label}: R=${displayInfo.radius}mm, L=${displayInfo.length}mm (${displayInfo.source})`);

          // Parse transform matrix
          let transform = null;
          if (screw.transform_matrix && Array.isArray(screw.transform_matrix) && screw.transform_matrix.length === 16) {
            transform = new Float32Array(screw.transform_matrix);
            console.log(`   Transform: [${transform[3].toFixed(1)}, ${transform[7].toFixed(1)}, ${transform[11].toFixed(1)}]`);
          } else {
            console.warn(`   ⚠️ No valid transform matrix for ${displayInfo.label}`);
          }

          const screwId = screw.screw_id || screw.id || null;
          await loadScrewModel(displayInfo.radius, displayInfo.length, transform, displayInfo.label, screwId);

          // ═════════════════════════════════════════════════════════
          // Load cap model after loading screw body (cap doesn't count toward model limit)
          // ═════════════════════════════════════════════════════════
          if (transform && transform.length === 16) {
            try {
              await loadCapModel(transform, displayInfo.length, displayInfo.label, screwId);
              console.log(`   ✅ Cap model loaded for ${displayInfo.label}`);
            } catch (capError) {
              console.warn(`   ⚠️ Could not load cap model for ${displayInfo.label}:`, capError.message);
              // Don't throw - cap is optional, continue with next screw
            }
          } else {
            console.warn(`   ⚠️ Skipping cap model load for ${displayInfo.label} - no valid transform`);
          }

          modelsLoaded++;
        } catch (modelError) {
          modelsFailed++;
          const screwIdForLog = screw.screw_id || screw.screw_label || 'unknown';
          console.warn(`   ❌ Failed to load model for ${screwIdForLog}:`, modelError.message);
        }
      }

      console.log(`✅ Plan restored successfully!`);
      console.log(`   Models loaded: ${modelsLoaded}/${plan.screws.length}`);
      if (modelsFailed > 0) {
        console.warn(`   ⚠️ Failed to load ${modelsFailed} model(s)`);
      }

      alert(`Plan restored!\n${plan.name}\nSession: ${response.session_id.substring(0, 8)}...\nScrews: ${response.screws_count}\nModels loaded: ${modelsLoaded}/${plan.screws.length}`);

      // Close the dialog
      setShowPlanDialog(false);

    } catch (error) {
      console.error('❌ Error restoring plan:', error);
      alert(`Failed to restore plan: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToJSON = () => {
    try {
      if (screws.length === 0) {
        console.warn('⚠️ No screws to export');
        alert('No screws to export. Please add some screws first.');
        return;
      }

      console.log(`📤 Exporting ${screws.length} screws...`);

      // Export the screws from React state (not from viewportStateService)
      // This includes all screw data from the API/localStorage
      const exportData = {
        exportDate: new Date().toISOString(),
        sessionId: sessionId,
        screwCount: screws.length,
        screws: screws
      };

      const jsonString = JSON.stringify(exportData, null, 2);

      // Create blob and download
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `screw-placements-${timestamp}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`✅ Exported ${screws.length} screws to: ${filename}`);
      console.log('Export data:', exportData);

    } catch (error) {
      console.error('Failed to export:', error);
      alert('Failed to export screws. Check console for details.');
    }
  };

  const importFromJSON = () => {
    try {
      // Create file input element
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';

      input.onchange = async (e) => {
        try {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;

          // Use the file loading method
          viewportStateService.loadSnapshotsFromFile(file)
            .then((count) => {
              // Reload screws in UI
              if (sessionId) {
                loadScrews(sessionId);
              } else {
                loadScrewsLocal();
              }
              console.log(`✅ Successfully imported ${count} screws from: ${file.name}`);
            })
            .catch((error) => {
              console.error('Failed to import:', error);
            });

        } catch (error) {
          console.error('Failed to process file:', error);
        }
      };

      // Trigger file selection
      input.click();

    } catch (error) {
      console.error('Failed to import:', error);
    }
  };

  // Use screws.length for actual screw count, not viewport snapshots
  const maxScrews = 10; // Maximum screws allowed
  const remainingSlots = Math.max(0, maxScrews - screws.length);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <ScrewManagementContainer>
      {/* Header */}
      <Header
        sessionId={sessionId}
        onTestCrosshair={testCrosshairDetection}
        onShowSessionState={showSessionState}
        onLoadPlan={() => setShowPlanDialog(true)}
        onSavePlan={savePlan}
        onClearAll={clearAllScrews}
        isSavingPlan={isSavingPlan}
        hasScrews={screws.length > 0}
      />

      {/* Plan Selection Dialog */}
      <PlanSelectionDialog
        isOpen={showPlanDialog}
        onClose={() => setShowPlanDialog(false)}
        onSelectPlan={loadPlan}
        caseId={caseId}
        seriesInstanceUID={seriesInstanceUID}
      />

      {/* Screw Selection Dialog */}
      <ScrewSelectionDialog
        isOpen={showScrewDialog}
        onClose={() => setShowScrewDialog(false)}
        onSelectScrew={saveScrew}
      />

      {/* Session State Dialog */}
      <SessionStateDialog
        isOpen={showSessionStateDialog}
        onClose={() => setShowSessionStateDialog(false)}
        uiState={{
          screws,
          sessionId,
          caseId,
          studyInstanceUID,
          seriesInstanceUID,
          surgeon,
        }}
        backendSummary={backendSummary}
        isLoading={summaryLoading}
        error={summaryError}
      />

      {/* Session Status Indicator */}
      <SessionStatus
        status={sessionStatus}
        sessionId={sessionId}
        onRetry={initializeSession}
      />

      {/* Screw Interaction Toolbar */}
      <ScrewToolbar
        isMoveToolActive={isMoveToolActive}
        onToggleMoveTool={toggleMoveTool}
        hasScrews={screws.length > 0}
        selectedScrew={selectedScrew}
        modelCount={modelStateService.getAllModels().length}
        screwCount={screws.length}
        onDebug={debugScrewInteraction}
      />

      {/* Save Screw Placement Button - Above the table */}
      <SaveScrewButton
        remainingSlots={remainingSlots}
        maxScrews={maxScrews}
        onOpenDialog={() => setShowScrewDialog(true)}
      />

      {/* Screws List - Table Layout */}
      <ScrewListContainer>
        <ScrewListHeader screwCount={screws.length} maxScrews={maxScrews} />

        <ScrewListScrollArea>
          {screws.length === 0 ? (
            <EmptyScrewList />
          ) : (
            <ScrewTable
              screws={screws}
              displayInfoGetter={getScrewDisplayInfo}
              isRestoring={isRestoring}
              onView={restoreScrew}
              onEdit={editScrew}
              onDelete={deleteScrew}
            />
          )}
        </ScrewListScrollArea>
      </ScrewListContainer>
    </ScrewManagementContainer>
  );
}
