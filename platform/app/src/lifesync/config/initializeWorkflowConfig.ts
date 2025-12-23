/**
 * Initialize Workflow Configuration
 * Loads the workflow-config.yaml file and initializes the configuration loader
 */

import { WorkflowConfigLoader } from './WorkflowConfigLoader';
import { resetWorkflowTypeCache } from '../types/workflow.types';
import workflowConfigYaml from './workflow-config.yaml?raw';

let initialized = false;

/**
 * Initialize the workflow configuration
 * This should be called once during application startup
 */
export async function initializeWorkflowConfig(): Promise<void> {
  if (initialized) {
    console.log('ℹ️ [initializeWorkflowConfig] Already initialized');
    return;
  }

  console.log('🚀 [initializeWorkflowConfig] Initializing workflow configuration...');

  try {
    const configLoader = WorkflowConfigLoader.getInstance();
    await configLoader.initialize(workflowConfigYaml);
    
    // Reset type cache to pick up new config
    resetWorkflowTypeCache();
    
    initialized = true;
    console.log('✅ [initializeWorkflowConfig] Workflow configuration initialized successfully');
  } catch (error) {
    console.error('❌ [initializeWorkflowConfig] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Check if configuration is initialized
 */
export function isWorkflowConfigInitialized(): boolean {
  return initialized;
}

/**
 * Get the configuration loader instance
 * Throws error if not initialized
 */
export function getConfigLoader(): WorkflowConfigLoader {
  if (!initialized) {
    throw new Error('Workflow configuration not initialized. Call initializeWorkflowConfig() first.');
  }
  return WorkflowConfigLoader.getInstance();
}

export default initializeWorkflowConfig;

