/**
 * LifeSync Surgical Workflow Module
 * Main barrel export for all workflow-related features
 */

// Configuration (must be exported before services)
export * from './config';

// Types
export * from './types';

// Services
export * from './services';

// Contexts and Hooks
export * from './contexts';

// Components
export * from './components';

// Utilities
export * from './utils';

// Commands
export * from './commands';

// Default exports
export { WorkflowService as default } from './services';

