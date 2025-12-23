/**
 * Configuration-Driven Validation Utilities
 * Validates workflow stages based on rules defined in workflow-config.yaml
 */

import { getWorkflowConfig, type StageConfig, type ValidationRule } from '../config';
import { WorkflowState, WorkflowValidation } from '../types';
import * as _ from 'lodash';

/**
 * Validate a stage based on configuration rules
 */
export function validateStageFromConfig(
  stageId: string,
  workflowState: WorkflowState,
  services?: any
): WorkflowValidation {
  console.log(`🔍 [configValidation] Validating stage: ${stageId}`);

  try {
    const configLoader = getWorkflowConfig();
    const stageConfig = configLoader.getStage(stageId);

    if (!stageConfig) {
      console.error(`❌ [configValidation] Stage not found in config: ${stageId}`);
      return {
        canAdvance: false,
        reason: `Invalid stage: ${stageId}`,
        isFinalStage: false,
      };
    }

    // Check if this is the final stage
    if (stageConfig.properties.isFinal) {
      console.log(`ℹ️ [configValidation] Stage ${stageId} is the FINAL stage`);
      
      // Final stage cannot advance
      const finalValidation = stageConfig.validation.finalStage;
      return {
        canAdvance: finalValidation?.canAdvance ?? false,
        reason: finalValidation?.reason ?? 'This is the final stage of the workflow',
        isFinalStage: true,
      };
    }

    // Validate dependencies
    const dependenciesValid = validateDependencies(stageConfig, workflowState);
    if (!dependenciesValid.isValid) {
      console.log(`❌ [configValidation] Dependencies not met for ${stageId}`);
      return {
        canAdvance: false,
        reason: dependenciesValid.reason,
        isFinalStage: false,
      };
    }

    // Run auto-validation rules
    const autoValidation = validateAutoRules(stageConfig, workflowState, services);
    if (!autoValidation.isValid) {
      console.log(`❌ [configValidation] Auto-validation failed for ${stageId}`);
      return {
        canAdvance: false,
        reason: autoValidation.reason,
        isFinalStage: false,
      };
    }

    // If user confirmation is enabled, we still allow advancement
    // (confirmation happens in UI)
    console.log(`✅ [configValidation] Stage ${stageId} can advance (user will confirm)`);
    return {
      canAdvance: true,
      reason: stageConfig.validation.userConfirmation.enabled
        ? 'User confirmation required'
        : undefined,
      isFinalStage: false,
    };
  } catch (error) {
    console.error(`❌ [configValidation] Error validating stage ${stageId}:`, error);
    return {
      canAdvance: false,
      reason: `Validation error: ${error.message}`,
      isFinalStage: false,
    };
  }
}

/**
 * Validate all stages in the workflow
 */
export function validateAllStagesFromConfig(
  workflowState: WorkflowState,
  services?: any
): Record<string, WorkflowValidation> {
  console.log('🔍 [configValidation] Validating all stages...');

  const validations: Record<string, WorkflowValidation> = {};

  try {
    const configLoader = getWorkflowConfig();
    const stages = configLoader.getStages();

    stages.forEach(stage => {
      validations[stage.id] = validateStageFromConfig(stage.id, workflowState, services);
    });

    console.log('✅ [configValidation] All stages validated');
  } catch (error) {
    console.error('❌ [configValidation] Error validating all stages:', error);
  }

  return validations;
}

/**
 * Validate stage dependencies
 */
function validateDependencies(
  stageConfig: StageConfig,
  workflowState: WorkflowState
): { isValid: boolean; reason?: string } {
  const { dependencies } = stageConfig;

  if (!dependencies || dependencies.length === 0) {
    return { isValid: true };
  }

  // Check if all dependencies are completed
  for (const depId of dependencies) {
    const depStage = workflowState.stages[depId];
    if (!depStage || !depStage.completed) {
      const configLoader = getWorkflowConfig();
      const depConfig = configLoader.getStage(depId);
      const depName = depConfig?.name ?? depId;
      
      return {
        isValid: false,
        reason: `Required stage "${depName}" must be completed first`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Validate auto-validation rules
 */
function validateAutoRules(
  stageConfig: StageConfig,
  workflowState: WorkflowState,
  services?: any
): { isValid: boolean; reason?: string } {
  const { validation } = stageConfig;

  // No auto-validation rules - always valid
  // Only user confirmation is used for validation
  if (!validation.auto || validation.auto.length === 0) {
    console.log(`✅ [configValidation] No auto-validation rules for ${stageConfig.id} - using user confirmation only`);
    return { isValid: true };
  }

  const configLoader = getWorkflowConfig();

  // Check each auto-validation rule (if any are defined in the future)
  for (const rule of validation.auto) {
    const ruleDefinition = configLoader.getValidationRule(rule.rule);
    
    if (!ruleDefinition) {
      console.warn(`⚠️ [configValidation] Rule definition not found: ${rule.rule} - skipping`);
      continue;
    }

    const ruleResult = evaluateRule(ruleDefinition, workflowState, services);
    
    if (!ruleResult.isValid) {
      return {
        isValid: false,
        reason: rule.message || ruleResult.reason,
      };
    }
  }

  return { isValid: true };
}

/**
 * Evaluate a validation rule
 */
function evaluateRule(
  rule: any,
  workflowState: WorkflowState,
  services?: any
): { isValid: boolean; reason?: string } {
  try {
    switch (rule.type) {
      case 'data_check':
        return evaluateDataCheck(rule, workflowState);
      
      case 'service_check':
        return evaluateServiceCheck(rule, services);
      
      case 'custom':
        return evaluateCustomRule(rule, workflowState, services);
      
      default:
        console.warn(`⚠️ [configValidation] Unknown rule type: ${rule.type}`);
        return { isValid: true }; // Don't block on unknown rules
    }
  } catch (error) {
    console.error(`❌ [configValidation] Error evaluating rule:`, error);
    return {
      isValid: false,
      reason: `Rule evaluation error: ${error.message}`,
    };
  }
}

/**
 * Evaluate a data check rule
 */
function evaluateDataCheck(
  rule: any,
  workflowState: WorkflowState
): { isValid: boolean; reason?: string } {
  const { path, condition, value } = rule;

  // Get the value at the path
  const dataValue = _.get(workflowState, path);

  switch (condition) {
    case 'exists':
      return {
        isValid: dataValue !== undefined && dataValue !== null,
        reason: `Data at path "${path}" does not exist`,
      };
    
    case 'not_empty':
      return {
        isValid: !!dataValue && (
          typeof dataValue === 'string' ? dataValue.trim().length > 0 : true
        ),
        reason: `Data at path "${path}" is empty`,
      };
    
    case 'equals':
      return {
        isValid: dataValue === value,
        reason: `Data at path "${path}" does not equal expected value`,
      };
    
    case 'greater_than':
      return {
        isValid: typeof dataValue === 'number' && dataValue > value,
        reason: `Data at path "${path}" is not greater than ${value}`,
      };
    
    default:
      console.warn(`⚠️ [configValidation] Unknown condition: ${condition}`);
      return { isValid: true };
  }
}

/**
 * Evaluate a service check rule
 */
function evaluateServiceCheck(
  rule: any,
  services?: any
): { isValid: boolean; reason?: string } {
  if (!services) {
    return {
      isValid: false,
      reason: 'Services not available for validation',
    };
  }

  const { service, method } = rule;
  const serviceInstance = services[service];

  if (!serviceInstance) {
    console.warn(`⚠️ [configValidation] Service not found: ${service}`);
    return { isValid: true }; // Don't block if service not available
  }

  if (typeof serviceInstance[method] !== 'function') {
    console.warn(`⚠️ [configValidation] Method not found: ${service}.${method}`);
    return { isValid: true }; // Don't block if method not available
  }

  try {
    const result = serviceInstance[method]();
    return {
      isValid: !!result,
      reason: `Service check failed: ${service}.${method}`,
    };
  } catch (error) {
    console.error(`❌ [configValidation] Service check error:`, error);
    return { isValid: true }; // Don't block on errors
  }
}

/**
 * Evaluate a custom rule
 */
function evaluateCustomRule(
  rule: any,
  workflowState: WorkflowState,
  services?: any
): { isValid: boolean; reason?: string } {
  const { implementation } = rule;

  // Custom rule implementations
  switch (implementation) {
    case 'checkAllPreviousStagesCompleted':
      return checkAllPreviousStagesCompleted(workflowState);
    
    default:
      console.warn(`⚠️ [configValidation] Unknown custom rule: ${implementation}`);
      return { isValid: true };
  }
}

/**
 * Check if all previous stages are completed
 */
function checkAllPreviousStagesCompleted(
  workflowState: WorkflowState
): { isValid: boolean; reason?: string } {
  const configLoader = getWorkflowConfig();
  const stages = configLoader.getStages();
  const currentStage = workflowState.currentStage;
  const currentIndex = stages.findIndex(s => s.id === currentStage);

  if (currentIndex === -1) {
    return {
      isValid: false,
      reason: 'Current stage not found',
    };
  }

  // Check all previous stages
  for (let i = 0; i < currentIndex; i++) {
    const stage = stages[i];
    const stageData = workflowState.stages[stage.id];
    
    if (!stageData || !stageData.completed) {
      return {
        isValid: false,
        reason: `Stage "${stage.name}" must be completed`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Get user confirmation message for a stage
 */
export function getUserConfirmationMessage(stageId: string): string | null {
  try {
    const configLoader = getWorkflowConfig();
    const stageConfig = configLoader.getStage(stageId);
    
    if (stageConfig?.validation.userConfirmation.enabled) {
      return stageConfig.validation.userConfirmation.message;
    }
    
    return null;
  } catch (error) {
    console.error(`❌ [configValidation] Error getting confirmation message:`, error);
    return null;
  }
}

export default {
  validateStageFromConfig,
  validateAllStagesFromConfig,
  getUserConfirmationMessage,
};

