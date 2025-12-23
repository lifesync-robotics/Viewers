/**
 * Workflow Validation Utilities
 * 
 * @deprecated This module is deprecated - use configValidation.ts instead
 * 
 * REASON: This file contains hardcoded validation logic for specific stages.
 * The workflow system now uses configuration-driven validation from workflow-config.yaml.
 * 
 * Instead of hardcoding stage names and validation logic here, use:
 * - validateStageFromConfig() - validates based on YAML config
 * - validateAllStagesFromConfig() - validates all stages from YAML
 * 
 * This module is kept for backward compatibility only.
 * DO NOT ADD NEW VALIDATION LOGIC HERE - update workflow-config.yaml instead.
 */

import { WorkflowValidation, WorkflowStage, WorkflowState } from '../types';

/**
 * Validate stage - Simplified to always allow advancement
 * User will be prompted to confirm before advancing
 * @deprecated Use configValidation.ts instead
 */
export function validateOverviewStage(state: WorkflowState): WorkflowValidation {
  console.log('🔍 [WorkflowValidation] Overview stage - user will confirm advancement');
  return { canAdvance: true, reason: undefined };
}

// Backward compatibility alias
export const validateBeginningStage = validateOverviewStage;

/**
 * Validate segmentation stage - User confirms they've completed segmentation
 */
export function validateSegmentationStage(
  state: WorkflowState,
  segmentationService?: any
): WorkflowValidation {
  console.log('🔍 [WorkflowValidation] Segmentation stage - user will confirm advancement');
  return { canAdvance: true, reason: undefined };
}

/**
 * Validate planning stage - User confirms they've completed planning
 */
export function validatePlanningStage(state: WorkflowState): WorkflowValidation {
  console.log('🔍 [WorkflowValidation] Planning stage - user will confirm advancement');
  return { canAdvance: true, reason: undefined };
}

/**
 * Validate navigation stage - User confirms navigation setup is complete
 */
export function validateNavigationStage(state: WorkflowState): WorkflowValidation {
  console.log('🔍 [WorkflowValidation] Navigation stage - user will confirm advancement');
  return { canAdvance: true, reason: undefined };
}

// Backward compatibility alias
export const validateReportingStage = validateNavigationStage;

/**
 * Validate review stage - Final stage, cannot advance
 */
export function validateReviewStage(state: WorkflowState): WorkflowValidation {
  console.log('🔍 [WorkflowValidation] Review stage - final stage');
  return { canAdvance: false, reason: 'Review is the final stage' };
}

/**
 * Main validation function that routes to appropriate stage validator
 * @deprecated Use configValidation.ts instead
 */
export function validateStage(
  stage: WorkflowStage,
  state: WorkflowState,
  additionalServices?: any
): WorkflowValidation {
  console.log(`🔍 [WorkflowValidation] Validating stage: ${stage}`);

  switch (stage) {
    case 'overview':  // Updated from 'beginning'
      return validateOverviewStage(state);
    
    case 'beginning':  // Backward compatibility
      return validateOverviewStage(state);
    
    case 'segmentation':
      return validateSegmentationStage(state, additionalServices?.segmentationService);
    
    case 'planning':
      return validatePlanningStage(state);
    
    case 'navigation':
      return validateNavigationStage(state);
    
    case 'reporting':  // Backward compatibility
      return validateNavigationStage(state);
    
    case 'review':
      return validateReviewStage(state);
    
    default:
      console.warn(`⚠️ [WorkflowValidation] Unknown stage: ${stage}`);
      return {
        canAdvance: false,
        reason: `Unknown stage: ${stage}`,
      };
  }
}

/**
 * Validate all stages and update validation state
 * @deprecated Use configValidation.ts (validateAllStagesFromConfig) instead
 */
export function validateAllStages(
  state: WorkflowState,
  additionalServices?: any
): WorkflowState['validation'] {
  console.log('🔍 [WorkflowValidation] Validating all stages...');

  const validation = {
    overview: validateOverviewStage(state),  // Updated from 'beginning'
    segmentation: validateSegmentationStage(state, additionalServices?.segmentationService),
    planning: validatePlanningStage(state),
    navigation: validateNavigationStage(state),
    review: validateReviewStage(state),
  };

  console.log('✅ [WorkflowValidation] All stages validated:', validation);
  return validation;
}

