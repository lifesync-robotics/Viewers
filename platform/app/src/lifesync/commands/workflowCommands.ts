/**
 * Workflow Navigation Commands
 * Commands for navigating between workflow stages
 */

import { WorkflowStage, STAGE_ROUTES } from '../types';
import WorkflowService from '../services/WorkflowService';
import { history } from '../../utils/history';

/**
 * Navigate to a specific workflow stage
 */
export function navigateToStageCommand({
  stage,
  studyInstanceUIDs,
  servicesManager,
  preserveQueryParams = true,
}: {
  stage: WorkflowStage;
  studyInstanceUIDs?: string[];
  servicesManager: any;
  preserveQueryParams?: boolean;
}) {
  console.log(`🧭 [WorkflowCommands] navigateToStage: ${stage}`);

  const workflowService = servicesManager.services.surgicalWorkflowService as WorkflowService;
  
  if (!workflowService) {
    console.error('❌ [WorkflowCommands] WorkflowService not found');
    return {
      success: false,
      error: 'WorkflowService not available',
    };
  }

  // Get route for stage
  const route = STAGE_ROUTES[stage];
  if (!route) {
    console.error(`❌ [WorkflowCommands] Invalid stage: ${stage}`);
    return {
      success: false,
      error: `Invalid stage: ${stage}`,
    };
  }

  // Build URL with query parameters
  const currentUrl = new URL(window.location.href);
  const params = new URLSearchParams();

  // Preserve existing query params if requested
  if (preserveQueryParams) {
    currentUrl.searchParams.forEach((value, key) => {
      params.set(key, value);
    });
  }

  // Add/update studyInstanceUIDs if provided
  if (studyInstanceUIDs && studyInstanceUIDs.length > 0) {
    params.set('StudyInstanceUIDs', studyInstanceUIDs.join(','));
  }

  // Construct full URL
  const fullUrl = `${route}?${params.toString()}`;
  
  console.log(`🧭 [WorkflowCommands] Navigating from ${workflowService.getCurrentStage()} to ${stage}`);
  console.log(`📍 [WorkflowCommands] Target route: ${fullUrl}`);
  console.log(`📦 [WorkflowCommands] Study UIDs: ${studyInstanceUIDs?.join(', ') || 'none'}`);

  // Update workflow service state BEFORE navigation
  // This ensures onModeEnter can access the correct stage
  workflowService.setCurrentStage(stage);

  // Navigate using React Router (SPA navigation, no page reload)
  if (history.navigate) {
    history.navigate(fullUrl);
    console.log(`✅ [WorkflowCommands] Navigation initiated via React Router`);
  } else {
    // Fallback to full page reload if history.navigate not available
    console.warn('⚠️ [WorkflowCommands] React Router navigate not available, using fallback');
    window.location.href = fullUrl;
  }

  return {
    success: true,
    stage,
    url: fullUrl,
  };
}

/**
 * Advance to next workflow stage with validation
 */
export function advanceWorkflowStageCommand({
  servicesManager,
  validate = true,
}: {
  servicesManager: any;
  validate?: boolean;
}) {
  console.log('⏭️ [WorkflowCommands] advanceWorkflowStage');

  const workflowService = servicesManager.services.surgicalWorkflowService as WorkflowService;
  
  if (!workflowService) {
    console.error('❌ [WorkflowCommands] WorkflowService not found');
    return {
      success: false,
      error: 'WorkflowService not available',
    };
  }

  // Validate if requested
  if (validate) {
    const canAdvance = workflowService.canAdvanceCurrentStage();
    if (!canAdvance) {
      const currentStage = workflowService.getCurrentStage();
      const validation = workflowService.validateStage(currentStage);
      console.error('❌ [WorkflowCommands] Cannot advance:', validation.reason);
      return {
        success: false,
        error: validation.reason || 'Validation failed',
      };
    }
  }

  // Advance stage
  const currentStage = workflowService.getCurrentStage();
  const result = workflowService.advanceStage();
  
  if (!result.success) {
    console.error('❌ [WorkflowCommands] Failed to advance:', result.error);
    return result;
  }

  console.log(`⏭️ [WorkflowCommands] Stage advanced: ${currentStage} → ${result.nextStage}`);

  // Get study instance UIDs from current URL
  const urlParams = new URLSearchParams(window.location.search);
  const studyUIDs = urlParams.get('StudyInstanceUIDs')?.split(',') || [];

  // Get workflow data for next stage (for debugging/logging)
  const nextStageData = workflowService.getStageData(result.nextStage);
  console.log(`📊 [WorkflowCommands] Next stage data:`, {
    stage: result.nextStage,
    completed: nextStageData.completed,
    hasData: Object.keys(nextStageData).length > 2, // more than just 'completed' and 'timestamp'
  });

  // Navigate to next stage
  if (result.nextStage) {
    return navigateToStageCommand({
      stage: result.nextStage,
      studyInstanceUIDs: studyUIDs,
      servicesManager,
      preserveQueryParams: true,
    });
  }

  return result;
}

/**
 * Go back to previous workflow stage
 */
export function goBackWorkflowStageCommand({
  servicesManager,
}: {
  servicesManager: any;
}) {
  console.log('⏮️ [WorkflowCommands] goBackWorkflowStage');

  const workflowService = servicesManager.services.surgicalWorkflowService as WorkflowService;
  
  if (!workflowService) {
    console.error('❌ [WorkflowCommands] WorkflowService not found');
    return {
      success: false,
      error: 'WorkflowService not available',
    };
  }

  // Go back
  const currentStage = workflowService.getCurrentStage();
  const result = workflowService.goBackStage();
  
  if (!result.success) {
    console.error('❌ [WorkflowCommands] Failed to go back:', result.error);
    return result;
  }

  console.log(`⏮️ [WorkflowCommands] Stage went back: ${currentStage} → ${result.previousStage}`);

  // Get study instance UIDs from current URL
  const urlParams = new URLSearchParams(window.location.search);
  const studyUIDs = urlParams.get('StudyInstanceUIDs')?.split(',') || [];

  // Get workflow data for previous stage (for debugging/logging)
  const prevStageData = workflowService.getStageData(result.previousStage);
  console.log(`📊 [WorkflowCommands] Previous stage data:`, {
    stage: result.previousStage,
    completed: prevStageData.completed,
    hasData: Object.keys(prevStageData).length > 2,
  });

  // Navigate to previous stage
  if (result.previousStage) {
    return navigateToStageCommand({
      stage: result.previousStage,
      studyInstanceUIDs: studyUIDs,
      servicesManager,
      preserveQueryParams: true,
    });
  }

  return result;
}

/**
 * Reset workflow to initial state
 */
export function resetWorkflowCommand({
  servicesManager,
}: {
  servicesManager: any;
}) {
  console.log('🔄 [WorkflowCommands] resetWorkflow');

  const workflowService = servicesManager.services.surgicalWorkflowService as WorkflowService;
  
  if (!workflowService) {
    console.error('❌ [WorkflowCommands] WorkflowService not found');
    return {
      success: false,
      error: 'WorkflowService not available',
    };
  }

  workflowService.resetWorkflow();

  console.log('✅ [WorkflowCommands] Workflow reset complete');

  return {
    success: true,
  };
}

/**
 * Export workflow commands for registration
 */
export const workflowCommands = {
  navigateToStage: navigateToStageCommand,
  advanceWorkflowStage: advanceWorkflowStageCommand,
  goBackWorkflowStage: goBackWorkflowStageCommand,
  resetWorkflow: resetWorkflowCommand,
};

/**
 * Register workflow commands with CommandsManager
 */
export function registerWorkflowCommands(commandsManager: any) {
  console.log('🔧 [WorkflowCommands] Registering workflow commands...');

  // Register navigateToStage command
  commandsManager.registerCommand(
    'navigateToStage',
    navigateToStageCommand,
    'Navigate to a specific workflow stage'
  );

  // Register advanceWorkflowStage command
  commandsManager.registerCommand(
    'advanceWorkflowStage',
    advanceWorkflowStageCommand,
    'Advance to next workflow stage'
  );

  // Register goBackWorkflowStage command
  commandsManager.registerCommand(
    'goBackWorkflowStage',
    goBackWorkflowStageCommand,
    'Go back to previous workflow stage'
  );

  // Register resetWorkflow command
  commandsManager.registerCommand(
    'resetWorkflow',
    resetWorkflowCommand,
    'Reset workflow to initial state'
  );

  console.log('✅ [WorkflowCommands] Workflow commands registered');
}

