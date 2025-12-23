/**
 * Planning Workflow Context
 * SIMPLIFIED: Use existing OHIF planning functionality (ScrewManagementPanel)
 * This is just a pass-through wrapper - no need to duplicate existing planning logic
 */

import React from 'react';
import PropTypes from 'prop-types';

export interface PlanningWorkflowProviderProps {
  children: React.ReactNode;
}

/**
 * Simplified PlanningWorkflowProvider - just passes children through
 * Use existing ScrewManagementPanel and planningBackendService directly
 */
export function PlanningWorkflowProvider({ children }: PlanningWorkflowProviderProps) {
  console.log('ℹ️ [PlanningWorkflowProvider] Pass-through provider - use existing planning services');
  
  // Just pass children through - no context needed
  // Components should use ScrewManagementPanel and planningBackendService directly
  return <>{children}</>;
}

PlanningWorkflowProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Note: Use existing planning services directly:
 * - ScrewManagementPanel for screw management UI
 * - planningBackendService for backend API calls
 * - WorkflowService for stage metadata (sessionId, planId)
 */

