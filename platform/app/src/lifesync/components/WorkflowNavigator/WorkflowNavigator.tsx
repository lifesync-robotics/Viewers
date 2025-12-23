/**
 * Workflow Navigator Component
 * Provides navigation and progress display for surgical workflow
 * 
 * NOTE: Now uses configuration-driven stage management
 * Stage definitions are loaded from workflow-config.yaml
 */

import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useWorkflow } from '../../contexts/WorkflowContext';
import { StageIndicator } from './StageIndicator';
import { getWorkflowConfig } from '../../config';
import { getUserConfirmationMessage } from '../../utils/configValidation';

export interface WorkflowNavigatorProps {
  // Optional: custom styling
  className?: string;
  // Optional: show/hide controls
  showNavButtons?: boolean;
  showStageList?: boolean;
  compact?: boolean;
}

/**
 * WorkflowNavigator Component
 * Main navigation component for the surgical workflow
 */
export function WorkflowNavigator({
  className = '',
  showNavButtons = true,
  showStageList = true,
  compact = false,
}: WorkflowNavigatorProps) {
  const {
    workflowState,
    currentStage,
    advanceStage,
    goBackStage,
    canAdvanceCurrentStage,
    getNextStage,
    getPreviousStage,
    workflowService,
  } = useWorkflow();

  // Get managers from workflowService
  const servicesManager = workflowService.getServicesManager();
  const commandsManager = workflowService.getCommandsManager();

  // Load configuration-driven stage data
  const { stageOrder, stageLabels, uiConfig } = useMemo(() => {
    try {
      const configLoader = getWorkflowConfig();
      return {
        stageOrder: configLoader.getStageOrder(),
        stageLabels: configLoader.getStageLabels(),
        uiConfig: configLoader.getUIConfig(),
      };
    } catch (error) {
      console.error('❌ [WorkflowNavigator] Error loading configuration:', error);
      // Fallback to defaults
      return {
        stageOrder: ['overview', 'segmentation', 'planning', 'navigation', 'review'],
        stageLabels: {
          overview: 'Start',
          segmentation: 'Segmentation',
          planning: 'Surgical Planning',
          navigation: 'Navigation',
          review: 'Review & Approval',
        },
        uiConfig: null,
      };
    }
  }, []);

  console.log('🧭 [WorkflowNavigator] Rendering (config-driven)', {
    currentStage,
    stageCount: stageOrder.length,
    stagesCompleted: Object.entries(workflowState.stages)
      .filter(([_, data]) => data.completed)
      .map(([stage]) => stage),
    hasServicesManager: !!servicesManager,
    hasCommandsManager: !!commandsManager,
  });

  // Get validation for current stage with null safety
  const currentValidation = workflowState.validation[currentStage] || {
    canAdvance: false,
    reason: 'Validation not initialized',
    isFinalStage: false,
  };
  const canAdvance = currentValidation.canAdvance;
  const validationReason = currentValidation.reason;

  // Get next and previous stages
  const nextStage = getNextStage();
  const previousStage = getPreviousStage();

  // Handle advance - Always prompt user for confirmation (Configuration-Driven)
  const handleAdvance = useCallback(() => {
    console.log('⏭️ [WorkflowNavigator] Advance button clicked');

    if (!nextStage) {
      alert('Already at final stage');
      return;
    }

    if (!servicesManager || !commandsManager) {
      console.error('❌ [WorkflowNavigator] servicesManager or commandsManager not available');
      alert('System not ready. Please try again.');
      return;
    }

    // Get configuration-driven confirmation message
    const confirmationMessage = getUserConfirmationMessage(currentStage);
    const defaultMessage = 
      `Ready to advance to ${stageLabels[nextStage]}?\n\n` +
      `Please confirm you have completed all work in the current stage (${stageLabels[currentStage]}).`;

    // Prompt user to confirm advancement
    const confirmed = window.confirm(confirmationMessage || defaultMessage);

    if (!confirmed) {
      console.log('ℹ️ [WorkflowNavigator] User cancelled advancement');
      return;
    }

    console.log('✅ [WorkflowNavigator] User confirmed advancement');

    // Use command manager to advance (handles both state update AND navigation)
    try {
      const result = commandsManager.runCommand('advanceWorkflowStage', {
        servicesManager,
        validate: false, // User already confirmed
      });

      if (!result || !result.success) {
        console.error('❌ [WorkflowNavigator] Failed to advance:', result?.error);
        alert(`Failed to advance: ${result?.error || 'Unknown error'}`);
        return;
      }

      console.log(`✅ [WorkflowNavigator] Successfully advanced to: ${result.stage}`);
    } catch (error) {
      console.error('❌ [WorkflowNavigator] Error during advancement:', error);
      alert(`Failed to advance: ${error.message}`);
    }
  }, [nextStage, currentStage, servicesManager, commandsManager, stageLabels]);

  // Handle go back
  const handleGoBack = useCallback(() => {
    console.log('⏮️ [WorkflowNavigator] Back button clicked');

    if (!servicesManager || !commandsManager) {
      console.error('❌ [WorkflowNavigator] servicesManager or commandsManager not available');
      alert('System not ready. Please try again.');
      return;
    }

    // Use command manager to go back (handles both state update AND navigation)
    try {
      const result = commandsManager.runCommand('goBackWorkflowStage', {
        servicesManager,
      });

      if (!result || !result.success) {
        console.error('❌ [WorkflowNavigator] Failed to go back:', result?.error);
        alert(`Failed to go back: ${result?.error || 'Unknown error'}`);
        return;
      }

      console.log(`✅ [WorkflowNavigator] Successfully went back to: ${result.stage}`);
    } catch (error) {
      console.error('❌ [WorkflowNavigator] Error during go back:', error);
      alert(`Failed to go back: ${error.message}`);
    }
  }, [servicesManager, commandsManager]);

  // Handle stage click (navigation) - Configuration-Driven
  const handleStageClick = useCallback((stage: string) => {
    console.log(`🎯 [WorkflowNavigator] Stage clicked: ${stage}`);
    
    // Only allow navigation to completed stages or current stage
    const stageIndex = stageOrder.indexOf(stage);
    const currentIndex = stageOrder.indexOf(currentStage);
    
    if (stageIndex > currentIndex) {
      console.warn('⚠️ [WorkflowNavigator] Cannot navigate to future stage');
      alert('Please complete current stage before advancing');
      return;
    }

    if (!servicesManager || !commandsManager) {
      console.error('❌ [WorkflowNavigator] servicesManager or commandsManager not available');
      alert('System not ready. Please try again.');
      return;
    }

    if (stage !== currentStage) {
      // Use command manager to navigate (handles both state update AND route navigation)
      try {
        const result = commandsManager.runCommand('navigateToStage', {
          stage,
          servicesManager,
          preserveQueryParams: true,
        });

        if (!result || !result.success) {
          console.error('❌ [WorkflowNavigator] Failed to navigate to stage:', result?.error);
          alert(`Failed to navigate: ${result?.error || 'Unknown error'}`);
          return;
        }

        console.log(`✅ [WorkflowNavigator] Successfully navigated to: ${stage}`);
      } catch (error) {
        console.error('❌ [WorkflowNavigator] Error during navigation:', error);
        alert(`Failed to navigate: ${error.message}`);
      }
    }
  }, [currentStage, servicesManager, commandsManager, stageOrder]);

  // Get current stage index
  const currentIndex = stageOrder.indexOf(currentStage);

  return (
    <div className={`workflow-navigator bg-gray-900 border-b border-gray-700 ${className}`}>
      <div className="container mx-auto px-4 py-3">
        {/* Current Stage Info Header */}
        {!compact && (
          <div className="flex flex-col items-center mb-3">
            <span className="text-xs text-gray-400">Current Stage</span>
            <span className="text-lg font-bold text-white">
              {stageLabels[currentStage] || currentStage}
            </span>
            <span className="text-xs text-gray-500">
              Step {currentIndex + 1} of {stageOrder.length}
            </span>
          </div>
        )}

        {/* Info Message - User controls advancement */}
        {nextStage && !compact && (
          <div className="mb-3 p-3 bg-blue-900 border border-blue-700 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-blue-400 text-xl">ℹ️</span>
              <div>
                <p className="text-sm font-semibold text-blue-300">Ready to advance?</p>
                <p className="text-xs text-blue-200">
                  Click "Forward" when you've completed all work in {stageLabels[currentStage] || currentStage}.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stage Indicators with Dynamic Navigation Buttons */}
        {showStageList && !compact && (
          <div className="flex items-center justify-center gap-2 overflow-x-auto">
            {stageOrder.map((stage, index) => {
              const stageData = workflowState.stages[stage];
              const isActive = stage === currentStage;
              const isCompleted = stageData.completed;
              const isPending = !isCompleted && !isActive;
              const hasError = false; // Could add error detection logic

              return (
                <React.Fragment key={stage}>
                  {/* Show Back button before current stage */}
                  {isActive && showNavButtons && previousStage && (
                    <>
                      <button
                        onClick={handleGoBack}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition"
                        title={`Go back to ${stageLabels[previousStage] || previousStage}`}
                      >
                        <span>←</span>
                        <span className="text-sm">Back</span>
                      </button>
                      <span className="text-gray-600">→</span>
                    </>
                  )}

                  {/* Arrow between stages (except before current stage with back button) */}
                  {index > 0 && !(isActive && showNavButtons && previousStage) && (
                    <div className="flex items-center">
                      <span className="text-gray-600">→</span>
                    </div>
                  )}

                  {/* Stage Indicator */}
                  <StageIndicator
                    stage={stage}
                    isActive={isActive}
                    isCompleted={isCompleted}
                    isPending={isPending}
                    hasError={hasError}
                    index={index}
                    onClick={isCompleted ? () => handleStageClick(stage) : undefined}
                  />

                  {/* Show Forward button after current stage */}
                  {isActive && showNavButtons && nextStage && (
                    <>
                      <span className="text-gray-600">→</span>
                      <button
                        onClick={handleAdvance}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition"
                        title={`Advance to ${stageLabels[nextStage] || nextStage}`}
                      >
                        <span className="text-sm">Forward</span>
                        <span>→</span>
                      </button>
                    </>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Compact Stage Progress Bar */}
        {showStageList && compact && (
          <div className="flex items-center gap-1 mt-2">
            {stageOrder.map((stage, index) => {
              const isCompleted = workflowState.stages[stage]?.completed ?? false;
              const isActive = stage === currentStage;

              return (
                <div
                  key={stage}
                  className={`flex-1 h-2 rounded-full transition ${
                    isCompleted
                      ? 'bg-green-600'
                      : isActive
                      ? 'bg-blue-600'
                      : 'bg-gray-700'
                  }`}
                  title={stageLabels[stage] || stage}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

WorkflowNavigator.propTypes = {
  className: PropTypes.string,
  showNavButtons: PropTypes.bool,
  showStageList: PropTypes.bool,
  compact: PropTypes.bool,
};

export default WorkflowNavigator;

