/**
 * REFACTORING EXAMPLE
 *
 * This file shows how to refactor ScrewManagementPanel.tsx
 * to use the new planningBackendService
 *
 * Compare the BEFORE and AFTER sections below
 */

import { planningBackendService } from './planningBackendService';

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 1: Initialize Session
// ═══════════════════════════════════════════════════════════════════════════

// ❌ BEFORE (Direct fetch call)
const initializeSession_OLD = async () => {
  try {
    setIsLoading(true);
    const newCaseId = null;
    const newStudyUID = '1.2.3.4.5';
    const newSeriesUID = '1.2.3.4.5.6';
    const newSurgeon = 'OHIF User';

    const response = await fetch('http://localhost:3001/api/planning/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studyInstanceUID: newStudyUID,
        seriesInstanceUID: newSeriesUID,
        surgeon: newSurgeon
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.success && data.session_id) {
      setSessionId(data.session_id);
      setSessionStatus('ready');
      await loadScrews(data.session_id);
    } else {
      throw new Error(data.error || 'Session creation failed');
    }
  } catch (error) {
    console.error('Error initializing session:', error);
    setSessionStatus('error');
    loadScrewsLocal();
  } finally {
    setIsLoading(false);
  }
};

// ✅ AFTER (Using planningBackendService)
const initializeSession_NEW = async () => {
  try {
    setIsLoading(true);
    setSessionStatus('initializing');

    const newCaseId = null;
    const newStudyUID = '1.2.3.4.5';
    const newSeriesUID = '1.2.3.4.5.6';
    const newSurgeon = 'OHIF User';

    // Store in state
    setCaseId(newCaseId);
    setStudyInstanceUID(newStudyUID);
    setSeriesInstanceUID(newSeriesUID);
    setSurgeon(newSurgeon);

    // Start session using the service
    const response = await planningBackendService.startSession({
      studyInstanceUID: newStudyUID,
      seriesInstanceUID: newSeriesUID,
      surgeon: newSurgeon
    });

    if (response.success && response.session_id) {
      setSessionId(response.session_id);
      setSessionStatus('ready');
      await loadScrews(response.session_id);
    } else {
      throw new Error(response.error || 'Session creation failed');
    }
  } catch (error) {
    console.error('Error initializing session:', error);
    setSessionStatus('error');
    loadScrewsLocal();
  } finally {
    setIsLoading(false);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 2: Load Screws
// ═══════════════════════════════════════════════════════════════════════════

// ❌ BEFORE
const loadScrews_OLD = async (sessionId) => {
  if (!sessionId) return;

  try {
    const response = await fetch(`http://localhost:3001/api/planning/screws/${sessionId}/list`);
    const data = await response.json();

    if (data.success) {
      setScrews(data.screws || []);
    } else {
      loadScrewsLocal();
    }
  } catch (error) {
    console.error('Error loading screws:', error);
    loadScrewsLocal();
  }
};

// ✅ AFTER
const loadScrews_NEW = async (sessionId) => {
  if (!sessionId) return;

  try {
    const response = await planningBackendService.listScrews(sessionId);

    if (response.success) {
      setScrews(response.screws || []);
    } else {
      loadScrewsLocal();
    }
  } catch (error) {
    console.error('Error loading screws:', error);
    loadScrewsLocal();
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 3: Save Screw
// ═══════════════════════════════════════════════════════════════════════════

// ❌ BEFORE
const saveScrew_OLD = async (screwData) => {
  try {
    const response = await fetch('http://localhost:3001/api/planning/screws/add-with-transform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionId,
        screw: {
          caseId: 'OHIF-CASE-' + Date.now(),
          radius: screwData.radius,
          length: screwData.length,
          screwLabel: screwData.name,
          screwVariantId: 'generated-' + screwData.radius + '-' + screwData.length,
          // ... more fields
        }
      })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to save screw');
    }

    await loadScrews(sessionId);
  } catch (error) {
    console.error('Failed to save screw:', error);
    alert('Failed to save screw. Please check the console for details.');
  }
};

// ✅ AFTER
const saveScrew_NEW = async (screwData) => {
  try {
    const transformMatrix = constructScrewTransform();
    const viewportStates = viewportStateService.getCurrentViewportStates();
    const transform = transformMatrix ? Array.from(transformMatrix) : [];

    const entryPoint = transform ? {
      x: transform[3],
      y: transform[7],
      z: transform[11]
    } : { x: 0, y: 0, z: 0 };

    const direction = transform ? [
      transform[4],
      transform[5],
      transform[6]
    ] : [0, 1, 0];

    const response = await planningBackendService.addScrew({
      sessionId: sessionId,
      screw: {
        caseId: 'OHIF-CASE-' + Date.now(),
        radius: screwData.radius,
        length: screwData.length,
        screwLabel: screwData.name,
        screwVariantId: screwData.variantId || `generated-${screwData.radius}-${screwData.length}`,
        vertebralLevel: 'unknown',
        side: 'unknown',
        entryPoint: entryPoint,
        trajectory: {
          direction: direction,
          insertionDepth: screwData.length,
          convergenceAngle: 0,
          cephaladAngle: 0
        },
        notes: `Screw: ${screwData.name}`,
        transformMatrix: transform,
        viewportStatesJson: JSON.stringify(viewportStates),
        placedAt: new Date().toISOString()
      }
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to save screw');
    }

    // Load model and update UI
    await loadScrewModel(screwData.radius, screwData.length, transform, screwData.name);
    await loadScrews(sessionId);

  } catch (error) {
    console.error('Failed to save screw:', error);
    alert('Failed to save screw. Please check the console for details.');
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 4: Delete Screw
// ═══════════════════════════════════════════════════════════════════════════

// ❌ BEFORE
const deleteScrew_OLD = async (screwData) => {
  try {
    const screwId = screwData.screw_id || screwData.id || screwData.name;

    if (sessionId && screwId) {
      const response = await fetch(`http://localhost:3001/api/planning/screws/${screwId}?sessionId=${sessionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (!data.success) {
        console.warn('API delete failed:', data.error);
      }
    }

    // Remove 3D models
    modelStateService.removeModel(screwId);

    // Reload screws
    await loadScrews(sessionId);
  } catch (error) {
    console.error('Error deleting screw:', error);
  }
};

// ✅ AFTER
const deleteScrew_NEW = async (screwData) => {
  try {
    const screwId = screwData.screw_id || screwData.id || screwData.name;
    const displayInfo = getScrewDisplayInfo(screwData);

    // Delete from backend
    if (sessionId && screwId) {
      const response = await planningBackendService.deleteScrew(screwId, sessionId);

      if (!response.success) {
        console.warn('API delete failed:', response.error);
      }
    }

    // Remove 3D models
    const loadedModels = modelStateService.getAllModels();
    for (const model of loadedModels) {
      const modelName = model.metadata.name.toLowerCase();
      if (modelName.includes(displayInfo.radius.toString()) ||
          modelName.includes(displayInfo.length.toString()) ||
          modelName.includes(displayInfo.label.toLowerCase())) {
        modelStateService.removeModel(model.metadata.id);
      }
    }

    // Reload screws from backend
    await loadScrews(sessionId);

  } catch (error) {
    console.error('Error deleting screw:', error);
    alert('Failed to delete screw. Please check the console for details.');
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 5: Query and Load Model
// ═══════════════════════════════════════════════════════════════════════════

// ❌ BEFORE
const loadScrewModel_OLD = async (radius, length, transform, screwLabel) => {
  try {
    // Query model from planning API
    const queryResponse = await fetch(
      `http://localhost:3001/api/planning/models/query?radius=${radius}&length=${length}`
    );

    const queryData = await queryResponse.json();

    if (!queryData.success || !queryData.model) {
      throw new Error('Model query failed');
    }

    const modelUrl = `http://localhost:3001/api/planning/models/${queryData.model.model_id}/obj`;

    // Load model
    await modelStateService.loadModelFromServer(modelUrl, {
      viewportId: getCurrentViewportId(),
      color: getScrewColor(screwLabel),
      opacity: 0.9
    });

    // Apply transform
    if (transform && transform.length === 16) {
      const loadedModels = modelStateService.getAllModels();
      const latestModel = loadedModels[loadedModels.length - 1];
      if (latestModel) {
        await modelStateService.setModelTransform(latestModel.metadata.id, transform, length);
      }
    }
  } catch (error) {
    console.error('Failed to load screw model:', error);
  }
};

// ✅ AFTER
const loadScrewModel_NEW = async (radius, length, transform, screwLabel) => {
  try {
    // Query model using the service
    const queryResponse = await planningBackendService.queryModel(radius, length);

    if (!queryResponse.success || !queryResponse.model) {
      throw new Error('Model query failed');
    }

    // Get model URL from service
    const modelUrl = planningBackendService.getModelUrl(queryResponse.model.model_id);

    // Determine color
    const screwColor = screwLabel ? getScrewColor(screwLabel) : [1.0, 0.84, 0.0];

    // Load model
    await modelStateService.loadModelFromServer(modelUrl, {
      viewportId: getCurrentViewportId(),
      color: screwColor,
      opacity: 0.9
    });

    // Apply transform
    if (transform && transform.length === 16) {
      const loadedModels = modelStateService.getAllModels();
      const latestModel = loadedModels[loadedModels.length - 1];
      if (latestModel) {
        await modelStateService.setModelTransform(latestModel.metadata.id, transform, length);
      }
    }
  } catch (error) {
    console.error('Failed to load screw model:', error);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 6: Save Plan
// ═══════════════════════════════════════════════════════════════════════════

// ❌ BEFORE
const savePlan_OLD = async () => {
  try {
    const planName = prompt('Enter a name for this plan:');
    if (!planName) return;

    const response = await fetch('http://localhost:3001/api/planning/plan/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        caseId: caseId,
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
      alert(`Plan saved successfully!\nPlan ID: ${data.plan_id}`);
    } else {
      throw new Error(data.error || 'Failed to save plan');
    }
  } catch (error) {
    console.error('Error saving plan:', error);
    alert(`Failed to save plan: ${error.message}`);
  }
};

// ✅ AFTER
const savePlan_NEW = async () => {
  try {
    const planName = prompt('Enter a name for this plan:');
    if (!planName) return;

    const response = await planningBackendService.savePlan({
      sessionId,
      caseId: caseId,
      studyInstanceUID,
      seriesInstanceUID,
      planData: {
        name: planName,
        description: `Plan with ${screws.length} screws`,
        surgeon
      }
    });

    if (response.success) {
      alert(`Plan saved successfully!\nPlan ID: ${response.plan_id}`);
    } else {
      throw new Error(response.error || 'Failed to save plan');
    }
  } catch (error) {
    console.error('Error saving plan:', error);
    alert(`Failed to save plan: ${error.message}`);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 7: Load Plan
// ═══════════════════════════════════════════════════════════════════════════

// ❌ BEFORE
const loadPlan_OLD = async (planId: string) => {
  try {
    setIsLoading(true);

    const response = await fetch(
      `http://localhost:3001/api/planning/plan/${planId}/restore-session`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to restore session from plan');
    }

    setSessionId(data.session_id);
    await loadScrews(data.session_id);

    // Restore 3D models
    for (const screw of data.plan.screws) {
      const displayInfo = getScrewDisplayInfo(screw);
      await loadScrewModel(displayInfo.radius, displayInfo.length, screw.transform_matrix, displayInfo.label);
    }

    alert('Plan restored!');
  } catch (error) {
    console.error('Error restoring plan:', error);
    alert(`Failed to restore plan: ${error.message}`);
  } finally {
    setIsLoading(false);
  }
};

// ✅ AFTER
const loadPlan_NEW = async (planId: string) => {
  try {
    setIsLoading(true);

    // Restore session from plan using the service
    const response = await planningBackendService.restoreSessionFromPlan(planId);

    if (!response.success) {
      throw new Error(response.error || 'Failed to restore session from plan');
    }

    const plan = response.plan;

    // Update UI state
    setSessionId(response.session_id);
    setStudyInstanceUID(plan.study_instance_uid);
    setSeriesInstanceUID(plan.series_instance_uid);
    setSurgeon(plan.surgeon || surgeon);
    if (plan.case_id) {
      setCaseId(plan.case_id);
    }
    setSessionStatus('ready');

    // Load screws
    await loadScrews(response.session_id);

    // Restore 3D models
    let modelsLoaded = 0;
    for (const screw of plan.screws) {
      try {
        const displayInfo = getScrewDisplayInfo(screw);
        const transform = screw.transform_matrix && Array.isArray(screw.transform_matrix) && screw.transform_matrix.length === 16
          ? new Float32Array(screw.transform_matrix)
          : null;

        await loadScrewModel(displayInfo.radius, displayInfo.length, transform, displayInfo.label);
        modelsLoaded++;
      } catch (modelError) {
        console.warn(`Failed to load model:`, modelError.message);
      }
    }

    alert(`Plan restored!\n${plan.name}\nSession: ${response.session_id.substring(0, 8)}...\nScrews: ${response.screws_count}\nModels loaded: ${modelsLoaded}/${plan.screws.length}`);

  } catch (error) {
    console.error('Error restoring plan:', error);
    alert(`Failed to restore plan: ${error.message}`);
  } finally {
    setIsLoading(false);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY OF BENEFITS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Benefits of using planningBackendService:
 *
 * 1. ✅ Type Safety - Full TypeScript types for all requests/responses
 * 2. ✅ Centralized - All API calls in one place
 * 3. ✅ Consistent Error Handling - Same pattern everywhere
 * 4. ✅ Better Logging - Built-in logging for debugging
 * 5. ✅ Maintainable - Easy to update endpoints
 * 6. ✅ Testable - Easy to mock for unit tests
 * 7. ✅ DRY - Don't repeat yourself - reuse code
 * 8. ✅ Less Boilerplate - Cleaner, more readable code
 */
