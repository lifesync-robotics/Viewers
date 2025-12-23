/**
 * Configuration module exports
 */

export { 
  WorkflowConfigLoader, 
  getWorkflowConfig,
  type WorkflowConfig,
  type StageConfig,
  type StageProperties,
  type StageValidation,
  type ValidationRule,
  type NavigationConfig,
  type UIConfig,
  type StageUIConfig,
  type FullConfig,
} from './WorkflowConfigLoader';

export { 
  initializeWorkflowConfig, 
  isWorkflowConfigInitialized,
  getConfigLoader,
} from './initializeWorkflowConfig';

