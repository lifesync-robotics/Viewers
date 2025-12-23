/**
 * Workflow Persistence Utilities
 * 
 * @deprecated This module is deprecated and no longer used
 * 
 * REASON: With the introduction of workflow-config.yaml as the single source of truth,
 * workflow state is now kept in-memory only and resets on page refresh.
 * 
 * This ensures:
 * - State always matches the current config
 * - No stale data from old config versions
 * - Simpler architecture (no persistence layer)
 * - No need for migration logic
 * 
 * The workflow state is ephemeral and this is intentional.
 * Each page load starts fresh from the YAML configuration.
 * 
 * DO NOT USE THIS MODULE - it is kept for reference only.
 */

import { WorkflowState } from '../types';

const STORAGE_KEY = 'ohif_surgical_workflow_state';
const STORAGE_VERSION = '1.0.0';
const PAGE_LOAD_FLAG_KEY = 'ohif_workflow_page_load_flag';

/**
 * Save workflow state to sessionStorage
 */
export function saveWorkflowState(state: WorkflowState): void {
  try {
    console.log('🔧 [WorkflowPersistence] Saving workflow state:', {
      currentStage: state.currentStage,
      caseId: state.metadata.caseId,
      timestamp: new Date().toISOString(),
    });

    const storageData = {
      version: STORAGE_VERSION,
      timestamp: Date.now(),
      state,
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
    console.log('✅ [WorkflowPersistence] Workflow state saved successfully');
  } catch (error) {
    console.error('❌ [WorkflowPersistence] Failed to save workflow state:', error);
  }
}

/**
 * Load workflow state from sessionStorage
 */
export function loadWorkflowState(): WorkflowState | null {
  try {
    console.log('🔍 [WorkflowPersistence] Loading workflow state from sessionStorage...');

    // Check if this is a page refresh/reload
    const isPageRefresh = detectPageRefresh();
    if (isPageRefresh) {
      console.log('🔄 [WorkflowPersistence] Page refresh detected - clearing workflow state');
      clearWorkflowState();
      return null;
    }

    const storedData = sessionStorage.getItem(STORAGE_KEY);
    if (!storedData) {
      console.log('ℹ️ [WorkflowPersistence] No stored workflow state found');
      return null;
    }

    const parsed = JSON.parse(storedData);
    
    // Check version compatibility
    if (parsed.version !== STORAGE_VERSION) {
      console.warn('⚠️ [WorkflowPersistence] Version mismatch, clearing old state', {
        stored: parsed.version,
        current: STORAGE_VERSION,
      });
      clearWorkflowState();
      return null;
    }

    // Check if state is stale (older than 24 hours)
    const age = Date.now() - parsed.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (age > maxAge) {
      console.warn('⚠️ [WorkflowPersistence] Workflow state is stale (>24h), clearing', {
        ageHours: (age / (60 * 60 * 1000)).toFixed(1),
      });
      clearWorkflowState();
      return null;
    }

    console.log('✅ [WorkflowPersistence] Workflow state loaded successfully:', {
      currentStage: parsed.state.currentStage,
      caseId: parsed.state.metadata.caseId,
      ageMinutes: (age / (60 * 1000)).toFixed(1),
    });

    return parsed.state;
  } catch (error) {
    console.error('❌ [WorkflowPersistence] Failed to load workflow state:', error);
    clearWorkflowState(); // Clear corrupted data
    return null;
  }
}

/**
 * Clear workflow state from sessionStorage
 */
export function clearWorkflowState(): void {
  try {
    console.log('🧹 [WorkflowPersistence] Clearing workflow state...');
    sessionStorage.removeItem(STORAGE_KEY);
    console.log('✅ [WorkflowPersistence] Workflow state cleared');
  } catch (error) {
    console.error('❌ [WorkflowPersistence] Failed to clear workflow state:', error);
  }
}

/**
 * Export workflow state as JSON file
 */
export function exportWorkflowState(state: WorkflowState, filename?: string): void {
  try {
    console.log('💾 [WorkflowPersistence] Exporting workflow state to file...');

    const exportData = {
      version: STORAGE_VERSION,
      exportedAt: new Date().toISOString(),
      state,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `workflow_${state.metadata.caseId}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('✅ [WorkflowPersistence] Workflow state exported successfully');
  } catch (error) {
    console.error('❌ [WorkflowPersistence] Failed to export workflow state:', error);
  }
}

/**
 * Import workflow state from JSON file
 */
export function importWorkflowState(file: File): Promise<WorkflowState> {
  return new Promise((resolve, reject) => {
    console.log('📂 [WorkflowPersistence] Importing workflow state from file:', file.name);

    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        
        if (data.version !== STORAGE_VERSION) {
          throw new Error(`Version mismatch: ${data.version} !== ${STORAGE_VERSION}`);
        }

        if (!data.state) {
          throw new Error('Invalid workflow state data');
        }

        console.log('✅ [WorkflowPersistence] Workflow state imported successfully:', {
          currentStage: data.state.currentStage,
          caseId: data.state.metadata.caseId,
        });

        resolve(data.state);
      } catch (error) {
        console.error('❌ [WorkflowPersistence] Failed to import workflow state:', error);
        reject(error);
      }
    };

    reader.onerror = () => {
      console.error('❌ [WorkflowPersistence] Failed to read file');
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Check if workflow state exists in storage
 */
export function hasWorkflowState(): boolean {
  const exists = sessionStorage.getItem(STORAGE_KEY) !== null;
  console.log(`🔍 [WorkflowPersistence] Workflow state exists: ${exists}`);
  return exists;
}

/**
 * Detect if this is a page refresh/reload
 * Uses sessionStorage flag that gets set on first load and checked on subsequent loads
 */
function detectPageRefresh(): boolean {
  try {
    // Check if the page load flag exists in sessionStorage
    const pageLoadFlag = sessionStorage.getItem(PAGE_LOAD_FLAG_KEY);
    
    if (pageLoadFlag) {
      // Flag exists - this is a page refresh
      console.log('🔄 [WorkflowPersistence] Page refresh detected (flag exists)');
      // Clear the flag so next navigation is treated as fresh
      sessionStorage.removeItem(PAGE_LOAD_FLAG_KEY);
      return true;
    } else {
      // Flag doesn't exist - this is initial load or navigation
      // Set the flag so next page load will be detected as refresh
      console.log('🆕 [WorkflowPersistence] Initial page load (setting flag)');
      sessionStorage.setItem(PAGE_LOAD_FLAG_KEY, Date.now().toString());
      return false;
    }
  } catch (error) {
    console.error('❌ [WorkflowPersistence] Error detecting page refresh:', error);
    return false;
  }
}

/**
 * Reset page load detection (call this when you want to preserve state on next load)
 */
export function resetPageLoadDetection(): void {
  try {
    sessionStorage.removeItem(PAGE_LOAD_FLAG_KEY);
    console.log('✅ [WorkflowPersistence] Page load detection reset');
  } catch (error) {
    console.error('❌ [WorkflowPersistence] Failed to reset page load detection:', error);
  }
}

