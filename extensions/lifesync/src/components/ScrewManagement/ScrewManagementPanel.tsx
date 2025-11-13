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
import { getRenderingEngine } from '@cornerstonejs/core';
import { crosshairsHandler } from '../../utils/crosshairsHandler';
import PlanSelectionDialog from './PlanSelectionDialog';

export default function ScrewManagementPanel({ servicesManager }) {
  const { viewportStateService, modelStateService, planeCutterService } = servicesManager.services;
  const [screws, setScrews] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [caseId, setCaseId] = useState(null);
  const [studyInstanceUID, setStudyInstanceUID] = useState(null);
  const [seriesInstanceUID, setSeriesInstanceUID] = useState(null);
  const [surgeon, setSurgeon] = useState('OHIF User');
  const [screwName, setScrewName] = useState('');
  const [radius, setRadius] = useState('');
  const [length, setLength] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionStatus, setSessionStatus] = useState('initializing'); // 'initializing', 'ready', 'error'
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

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

      // Get case information (would come from case manager service)
      // For now, use null caseId to allow sessions without cases
      const newCaseId = null; // TODO: Get from actual case service when available
      const newStudyUID = '1.2.3.4.5'; // TODO: Get from actual DICOM data
      const newSeriesUID = '1.2.3.4.5.6'; // TODO: Get from actual DICOM data
      const newSurgeon = 'OHIF User'; // TODO: Get from user service

      // Store in state for later use in save/load
      setCaseId(newCaseId);
      setStudyInstanceUID(newStudyUID);
      setSeriesInstanceUID(newSeriesUID);
      setSurgeon(newSurgeon);

      console.log('🔄 Initializing planning session...');
      console.log(`   API: http://localhost:3001/api/planning/session/start`);
      console.log(`   Case ID: ${newCaseId || 'none (session without case)'}`);

      // Start planning session (caseId is now optional)
      const response = await fetch('http://localhost:3001/api/planning/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studyInstanceUID: newStudyUID,
          seriesInstanceUID: newSeriesUID,
          surgeon: newSurgeon
          // caseId is optional and omitted when null
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📡 Session API response:', data);

      if (data.success && data.session_id) {
        setSessionId(data.session_id);
        setSessionStatus('ready');
        console.log('✅ Planning session started:', data.session_id);

        // Load existing screws for this session
        await loadScrews(data.session_id);
      } else {
        throw new Error(data.error || 'Session creation failed');
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

      const response = await fetch(`http://localhost:3001/api/planning/screws/${sessionId}/list`);
      const data = await response.json();

      if (data.success) {
        setScrews(data.screws || []);
        console.log(`✅ Loaded ${data.screws?.length || 0} screws from API`);
      } else {
        console.error('❌ Failed to load screws:', data.error);
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
   */
  const loadScrewsLocal = () => {
    console.log('📁 Falling back to localStorage...');
    const allScrews = viewportStateService.getAllSnapshots();
    setScrews(allScrews);
    console.log(`✅ Loaded ${allScrews.length} screws from localStorage`);
  };

  /**
   * Load and display a 3D screw model using the planning API
   */
  const loadScrewModel = async (radius, length, transform) => {
    try {
      console.log(`🔍 Querying model for radius=${radius}, length=${length}`);
      console.log(`🔍 transform:`, transform);
      console.log(`🔍 transform.length:`, transform.length);
      // Query model from planning API
      const queryResponse = await fetch(
        `http://localhost:3001/api/planning/models/query?radius=${radius}&length=${length}`
      );

      const queryData = await queryResponse.json();

      if (!queryData.success || !queryData.model) {
        throw new Error('Model query failed');
      }

      const modelInfo = queryData.model;
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

      // Get model OBJ file URL
      const modelUrl = `http://localhost:3001/api/planning/models/${modelInfo.model_id}/obj`;

      // Load model using modelStateService
      await modelStateService.loadModelFromServer(modelUrl, {
        viewportId: getCurrentViewportId(),
        color: [1.0, 0.84, 0.0],  // Gold color for screws
        opacity: 0.9
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
   * Get the current 3D viewport ID
   */
  const getCurrentViewportId = () => {
    try {
      const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
      if (!renderingEngine) return 'volume3d-viewport';

      const viewports = renderingEngine.getViewports();
      for (const vp of viewports) {
        if (vp.type === 'volume3d' || vp.type === 'VOLUME_3D') {
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

  const saveScrew = async () => {
    try {
      const name = screwName.trim() || `Screw ${new Date().toLocaleString()}`;
      const radiusValue = parseFloat(radius) || 0;
      const lengthValue = parseFloat(length) || 0;

      // Validate input - use defaults if invalid
      let finalRadiusValue = radiusValue;
      let finalLengthValue = lengthValue;

      if (radiusValue <= 0 || lengthValue <= 0) {
        console.warn('⚠️ Please enter valid radius and length values (must be greater than 0)');
        finalRadiusValue = 3.5;
        finalLengthValue = 40;
        console.log('Using default radius and length values: 3.5mm and 40mm');
      }

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

      try {
        const response = await fetch('http://localhost:3001/api/planning/screws/add-with-transform', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId,
            screw: {
              caseId: 'OHIF-CASE-' + Date.now(), // TODO: Get from actual case service
              radius: finalRadiusValue,
              length: finalLengthValue,
              name: name,
              screwVariantId: `generated-${finalRadiusValue}-${finalLengthValue}`,
              vertebralLevel: 'unknown',  // Could be auto-detected later
              side: 'unknown',           // Could be auto-detected later
              entryPoint: entryPoint,    // Now extracted from crosshair position
              trajectory: {
                direction: direction,    // Now extracted from transform matrix
                insertionDepth: finalLengthValue,
                convergenceAngle: 0,
                cephaladAngle: 0
              },
              notes: `Saved from OHIF Viewer: ${name}`,
              transformMatrix: transform,
              viewportStatesJson: JSON.stringify(viewportStates),
              placedAt: new Date().toISOString()
            }
          })
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to save screw');
        }

        console.log(`✅ Screw saved to planning API: ${data.screw_id}`);

      } catch (apiError) {
        console.error('❌ Failed to save screw to API:', apiError);
        // TODO: Could fallback to localStorage here, but for now just show error
        alert('Failed to save screw. Please check the console for details.');
        return;
      }

      // ═════════════════════════════════════════════════════════
      // STEP 2: Load and display the 3D model
      // ═════════════════════════════════════════════════════════
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔧 [ScrewManagement] LOADING 3D MODEL');
      console.log('═══════════════════════════════════════════════════════');

      // Check model limit
      const existingModels = modelStateService.getAllModels();
      const maxModels = 20; // TODO: Get from service

      if (existingModels.length >= maxModels) {
        console.warn(`⚠️ Maximum number of models (${maxModels}) reached.`);
        alert(`Maximum of ${maxModels} screws reached. Please delete some screws before adding more.`);
        return;
      }

      console.log(`📊 Current models: ${existingModels.length}/${maxModels}`);

      // Load the 3D model using the new API
      try {
        await loadScrewModel(finalRadiusValue, finalLengthValue, transform);
        console.log(`✅ Model loaded successfully - Total: ${modelStateService.getAllModels().length}/${maxModels}`);
      } catch (modelError) {
        console.warn('⚠️ Could not load model:', modelError.message);
        console.warn('⚠️ Screw saved but model may not be visible');
      }

      // ═════════════════════════════════════════════════════════
      // STEP 3: Update UI
      // ═════════════════════════════════════════════════════════
      setScrewName('');
      setRadius('');
      setLength('');

      // Reload screws from API
      if (sessionId) {
        await loadScrews(sessionId);
      }

      console.log(`✅ Saved screw: "${name}" (R: ${finalRadiusValue}mm, L: ${finalLengthValue}mm)`);

    } catch (error) {
      console.error('Failed to save screw:', error);
      alert('Failed to save screw. Please check the console for details.');
    }
  };

  const restoreScrew = async (screwData) => {
    try {
      setIsRestoring(true);

      // Check if we've reached the maximum number of models
      const existingModels = modelStateService.getAllModels();
      const maxModels = 20; // TODO: Get from service

      if (existingModels.length >= maxModels) {
        console.warn(`⚠️ Maximum number of models (${maxModels}) reached. Cannot restore more screws.`);
        alert(`Maximum of ${maxModels} screws reached. Please delete some screws before restoring more.`);
        setIsRestoring(false);
        return;
      }

      console.log(`🔄 Restoring screw: "${screwData.name || screwData.screw_id}" (${existingModels.length + 1}/${maxModels} models)`);

      // For API-based screws, we need to load the model manually
      const radius = screwData.radius || screwData.screw_variant_id?.split('-')[1] || 3.5;
      const length = screwData.length || screwData.screw_variant_id?.split('-')[2] || 40;

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
        // Keep as regular number[] array (modelStateService expects number[], not Float32Array)
        console.log(`✅ Valid transform array`);
        console.log(`📐 Translation: (${transformArray[3].toFixed(2)}, ${transformArray[7].toFixed(2)}, ${transformArray[11].toFixed(2)})`);
      }

      // Load and display the 3D model
      await loadScrewModel(radius, length, transformArray);

      // Restore viewport states if available
      if (screwData.viewport_states_json || screwData.viewportStates) {
        try {
          const viewportStates = screwData.viewport_states_json ?
            JSON.parse(screwData.viewport_states_json) :
            screwData.viewportStates;

          viewportStateService.restoreViewportStates(viewportStates);
          console.log('✅ Viewport states restored');
        } catch (stateError) {
          console.warn('⚠️ Could not restore viewport states:', stateError);
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
      const screwName = screwData.name || screwData.screw_id || 'Unknown Screw';

      console.log(`🗑️ Deleting screw: "${screwName}" (${screwId})`);

      // Try to delete from API first
      if (sessionId && screwId) {
        try {
          const response = await fetch(`http://localhost:3001/api/planning/screws/${screwId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
          });

          const data = await response.json();

          if (!data.success) {
            console.warn('⚠️ API delete failed, continuing with local cleanup:', data.error);
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

      // Try to match by dimensions first
      const radius = screwData.radius || screwData.screw_variant_id?.split('-')[1];
      const length = screwData.length || screwData.screw_variant_id?.split('-')[2];

      for (const model of loadedModels) {
        const modelName = model.metadata.name.toLowerCase();

        // Check if model matches screw dimensions
        if ((radius && modelName.includes(radius.toString())) ||
            (length && modelName.includes(length.toString())) ||
            modelName.includes(screwName.toLowerCase())) {
          console.log(`🗑️ Removing model: ${model.metadata.id} (${model.metadata.name})`);
          modelStateService.removeModel(model.metadata.id);
          modelsRemoved++;
        }
      }

      if (modelsRemoved === 0) {
        // If no specific models found, remove the most recently loaded model as fallback
        const latestModel = loadedModels[loadedModels.length - 1];
        if (latestModel) {
          console.log(`🗑️ Removing latest model as fallback: ${latestModel.metadata.id}`);
          modelStateService.removeModel(latestModel.metadata.id);
          modelsRemoved = 1;
        }
      }

      console.log(`✅ Removed ${modelsRemoved} model(s)`);

      // Reload screws from API
      if (sessionId) {
        await loadScrews(sessionId);
      } else {
        loadScrewsLocal();
      }

      console.log(`✅ Deleted screw: "${screwName}"`);

    } catch (error) {
      console.error('Error deleting screw:', error);
      alert('Failed to delete screw. Please check the console for details.');
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

  const clearAllScrews = () => {
    try {
      // Clear all models first
      console.log('🗑️ Clearing all 3D models...');
      modelStateService.clearAllModels();

      // Clear all screws
      viewportStateService.clearAll();
      loadScrews();

      console.log('✅ All screws and models cleared');
    } catch (error) {
      console.error('Error clearing all screws:', error);
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
      console.log(`   Screws: ${screws.length}`);

      // Determine case ID to use
      let effectiveCaseId = caseId;

      if (!effectiveCaseId) {
        // No case ID - inform user and create a default case
        const userConfirmed = confirm(
          '⚠️ No case is currently selected.\n\n' +
          'This plan will be saved to a default case for now.\n\n' +
          'You can organize cases properly later through the case management system.\n\n' +
          'Continue?'
        );

        if (!userConfirmed) {
          setIsSavingPlan(false);
          return; // User cancelled
        }

        // Create a default case
        console.log('🏥 Creating default case for plan...');
        const caseResponse = await fetch('http://localhost:3001/api/cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientInfo: {
              mrn: 'DEFAULT-PATIENT',
              name: 'Default Patient',
              dateOfBirth: null
            },
            caseId: `DEFAULT-CASE-${Date.now()}`
          })
        });

        if (!caseResponse.ok) {
          throw new Error(`Failed to create default case: ${caseResponse.status}`);
        }

        const caseData = await caseResponse.json();
        if (!caseData.success) {
          throw new Error(`Case creation failed: ${caseData.error}`);
        }

        effectiveCaseId = caseData.caseId;
        console.log(`✅ Created default case: ${effectiveCaseId}`);

        // Update our local caseId state
        setCaseId(effectiveCaseId);
      }

      const response = await fetch('http://localhost:3001/api/planning/plan/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          caseId: effectiveCaseId,
          studyInstanceUID,
          seriesInstanceUID,
          planData: {
            name: planName,
            description: `Plan with ${screws.length} screws`,
            surgeon
          }
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Plan saved successfully:', data.plan_id);
        alert(`Plan saved successfully!\nPlan ID: ${data.plan_id}`);
      } else {
        throw new Error(data.error || 'Failed to save plan');
      }
    } catch (error) {
      console.error('❌ Error saving plan:', error);
      alert(`Failed to save plan: ${error.message}`);
    } finally {
      setIsSavingPlan(false);
    }
  };

  /**
   * Load a saved plan
   */
  const loadPlan = async (planId: string) => {
    try {
      setIsLoading(true);
      console.log('📥 Loading plan:', planId);

      const response = await fetch(`http://localhost:3001/api/planning/plan/${planId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load plan');
      }

      const plan = data.plan;
      console.log('✅ Plan loaded:', plan);
      console.log(`   Screws: ${plan.screws.length}`);
      console.log(`   Rods: ${plan.rods.length}`);

      // Update screws in UI
      setScrews(plan.screws || []);

      // TODO: Restore 3D models for each screw
      // This would require iterating through plan.screws and calling loadScrewModel for each

      alert(`Plan loaded successfully!\n${plan.name}\nScrews: ${plan.screws.length}\nRods: ${plan.rods.length}`);
    } catch (error) {
      console.error('❌ Error loading plan:', error);
      alert(`Failed to load plan: ${error.message}`);
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
              loadScrews();
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

  const maxScrews = viewportStateService.getMaxSnapshots();
  const remainingSlots = viewportStateService.getRemainingSlots();

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-gray-900 text-white p-4 space-y-4 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">🔄</div>
          <h2 className="text-xl font-bold text-white mb-2">🔗 Initializing Planning Session</h2>
          <p className="text-gray-400">Connecting to planning service...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">
          🔩 Screw Management
          {sessionId && <span className="text-sm font-normal text-green-400 ml-2">(API Connected)</span>}
        </h2>
        <div className="flex gap-1">
          <button
            onClick={testCrosshairDetection}
            className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-base"
            title="Test Crosshair Detection"
          >
            🧪
          </button>
          <button
            onClick={() => setShowPlanDialog(true)}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-base"
            title="Load Plan"
          >
            📂
          </button>
          {screws.length > 0 && (
            <>
              <button
                onClick={savePlan}
                disabled={isSavingPlan}
                className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-base disabled:opacity-50 disabled:cursor-not-allowed"
                title="Save Plan"
              >
                {isSavingPlan ? '⏳' : '💾'}
              </button>
              <button
                onClick={clearAllScrews}
                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-base"
                title="Clear All Screws"
              >
                🧹
              </button>
            </>
          )}
        </div>
      </div>

      {/* Plan Selection Dialog */}
      <PlanSelectionDialog
        isOpen={showPlanDialog}
        onClose={() => setShowPlanDialog(false)}
        onSelectPlan={loadPlan}
        caseId={caseId}
        seriesInstanceUID={seriesInstanceUID}
      />

      {/* Session Status Indicator */}
      {sessionStatus === 'initializing' && (
        <div className="p-2 bg-yellow-900 bg-opacity-30 border border-yellow-600 rounded text-xs text-yellow-300">
          🔄 Connecting to planning service...
        </div>
      )}
      {sessionStatus === 'ready' && sessionId && (
        <div className="p-2 bg-green-900 bg-opacity-30 border border-green-600 rounded text-xs text-green-300">
          ✅ Planning session ready ({sessionId.substring(0, 8)}...)
        </div>
      )}
      {sessionStatus === 'error' && (
        <div className="p-2 bg-red-900 bg-opacity-30 border border-red-600 rounded text-xs">
          <div className="text-red-300 mb-1">⚠️ Planning API unavailable</div>
          <button
            onClick={initializeSession}
            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
          >
            🔄 Retry Connection
          </button>
        </div>
      )}

      {/* Save Section */}
      <div className="space-y-2 border border-blue-600 rounded p-3 bg-blue-900 bg-opacity-20">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-sm">💾 Save Screw Placement</h3>
          <span className="text-xs text-gray-400">
            {remainingSlots} / {maxScrews} slots remaining
          </span>
        </div>
        <input
          type="text"
          placeholder="Screw name (optional)"
          value={screwName}
          onChange={(e) => setScrewName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && saveScrew()}
          className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Radius (mm) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              placeholder="e.g., 2.0"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              step="0.1"
              min="0.1"
              className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Length (mm) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              placeholder="e.g., 40.0"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              step="0.1"
              min="0.1"
              className="w-full px-3 py-2 bg-gray-800 text-white border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <button
          onClick={saveScrew}
          disabled={remainingSlots === 0}
          className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded font-bold text-sm transition disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          🔩 Save Screw Placement
        </button>
        {remainingSlots === 0 && (
          <p className="text-xs text-red-400">
            ⚠️ Maximum screws reached. Delete old screws or oldest will be removed.
          </p>
        )}
        <p className="text-xs text-gray-400">
          💡 Saves current viewport state, screw dimensions, and model transform
        </p>
      </div>

      {/* Screws List */}
      <div className="flex-1 flex flex-col min-h-0">
        <h3 className="font-bold text-white text-sm mb-2">
          📋 Saved Screws ({screws.length} / {maxScrews})
        </h3>

        <div className="flex-1 overflow-y-auto space-y-2">
          {screws.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">No screws saved yet</p>
              <p className="text-gray-600 text-xs mt-2">
                Enter radius and length, then click "Save Screw Placement"
              </p>
            </div>
          ) : (
            screws.map((screw, index) => {
              // Handle both old localStorage format and new API format
              const screwName = screw.name || screw.screw_id || `Screw ${index + 1}`;
              const screwRadius = screw.radius || (screw.screw_variant_id?.split('-')[1] ?
                parseFloat(screw.screw_variant_id.split('-')[1]) / 10 : 3.25);
              const screwLength = screw.length || (screw.screw_variant_id?.split('-')[2] ?
                parseFloat(screw.screw_variant_id.split('-')[2]) : 40);
              const timestamp = screw.timestamp || screw.placed_at || screw.created_at || Date.now();

              // Check if this is API data (has screw_id) or localStorage data (has name)
              const isApiData = !!screw.screw_id;

              return (
                <div
                  key={screw.screw_id || screw.name || index}
                  className="border border-gray-700 rounded p-3 hover:border-blue-500 transition bg-gray-800 bg-opacity-50"
                >
                  <div className="flex justify-between items-start gap-2">
                    {/* Screw Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🔩</span>
                        <p className="font-medium text-sm text-white truncate" title={screwName}>
                          {screwName}
                        </p>
                        {isApiData && (
                          <span className="inline-block px-1 py-0.5 bg-green-900 bg-opacity-50 border border-green-700 rounded text-xs text-green-300">
                            API
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mb-2">
                        {new Date(timestamp).toLocaleString()}
                      </p>
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="inline-block px-2 py-1 bg-blue-900 bg-opacity-50 border border-blue-700 rounded text-xs text-blue-300 font-semibold">
                          ⌀ {(screwRadius * 2).toFixed(1)} mm
                        </span>
                        <span className="inline-block px-2 py-1 bg-green-900 bg-opacity-50 border border-green-700 rounded text-xs text-green-300 font-semibold">
                          ↕ {screwLength.toFixed(1)} mm
                        </span>
                        {screw.viewports && (
                          <span className="inline-block px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-400">
                            {screw.viewports.length} views
                          </span>
                        )}
                        {screw.transform_matrix && (
                          <span className="inline-block px-2 py-0.5 bg-purple-900 bg-opacity-50 border border-purple-700 rounded text-xs text-purple-300">
                            3D transform
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => restoreScrew(screw)}
                        disabled={isRestoring}
                        className="px-2 py-2 bg-blue-600 hover:bg-blue-700 text-white text-base rounded transition disabled:bg-gray-600 disabled:cursor-not-allowed"
                        title={`Load "${screwName}"`}
                      >
                        {isRestoring ? '⏳' : '🔄'}
                      </button>
                      <button
                        onClick={() => deleteScrew(screw)}
                        className="px-2 py-2 bg-red-600 hover:bg-red-700 text-white text-base rounded transition"
                        title={`Delete "${screwName}"`}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Info Footer */}
      <div className="text-xs text-gray-500 border-t border-gray-700 pt-2 space-y-1">
        <p>💡 <strong>Save:</strong> Captures current viewport state and screw dimensions</p>
        <p>💡 <strong>Load:</strong> Restores viewport state and loads matching 3D model</p>
        <p>💡 <strong>Delete:</strong> Removes screw placement AND associated 3D model</p>
        <p>💡 <strong>Limit:</strong> Maximum {maxScrews} screws (oldest auto-removed when full)</p>
      </div>
    </div>
  );
}
