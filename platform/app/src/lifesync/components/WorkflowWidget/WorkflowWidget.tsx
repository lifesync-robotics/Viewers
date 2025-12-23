/**
 * Compact Workflow Widget Component
 * Icon-only workflow navigation for toolbar integration
 */

import React, { useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { useWorkflow } from '../../contexts/WorkflowContext';
import { STAGE_ORDER, STAGE_LABELS } from '../../types';

export interface WorkflowWidgetProps {
  className?: string;
}

/**
 * WorkflowWidget Component
 * Compact, icon-only workflow navigation that fits in the toolbar
 */
export function WorkflowWidget({ className = '' }: WorkflowWidgetProps) {
  const {
    workflowState,
    currentStage,
    advanceStage,
    workflowService,
  } = useWorkflow();

  // 🔧 FIX: Prevent rapid/duplicate clicks to avoid navigation getting stuck
  const isHandlingClick = useRef(false);
  const lastClickTime = useRef(0);

  // Get status icon for a stage
  const getStatusIcon = (stage: string) => {
    const stageData = workflowState.stages[stage];
    const isActive = stage === currentStage;
    const isCompleted = stageData.completed;

    if (isCompleted && !isActive) return '✅';
    if (isActive && isCompleted) return '🔵';
    if (isActive && !isCompleted) return '🔵';
    return '⏸️';
  };

  // Get status color classes
  const getStatusClasses = (stage: string) => {
    const stageData = workflowState.stages[stage];
    const isActive = stage === currentStage;
    const isCompleted = stageData.completed;

    const baseClasses = 'flex items-center justify-center w-7 h-7 rounded-full transition-all text-base';

    if (isActive && !isCompleted) {
      return `${baseClasses} bg-blue-600/30 ring-2 ring-blue-500`;
    }
    if (isActive && isCompleted) {
      return `${baseClasses} bg-blue-600/30 ring-2 ring-green-500`;
    }
    if (isCompleted && !isActive) {
      return `${baseClasses} bg-green-700/30`;
    }
    return `${baseClasses} bg-gray-700/30`;
  };

  // Get cursor style
  const getCursorClass = (stage: string) => {
    const stageData = workflowState.stages[stage];
    const isActive = stage === currentStage;
    const isCompleted = stageData.completed;
    const stageIndex = STAGE_ORDER.indexOf(stage as any);
    const currentIndex = STAGE_ORDER.indexOf(currentStage);
    const isNextStage = stageIndex === currentIndex + 1;

    // Allow clicking on completed stages, current stage, or next stage (for advancement)
    if (isCompleted || isActive || isNextStage) {
      return 'cursor-pointer hover:opacity-80';
    }
    return 'cursor-not-allowed opacity-50';
  };

  // Handle stage click
  const handleStageClick = useCallback(async (stage: string) => {
    const now = Date.now();
    
    // 🔧 FIX: Debounce clicks - ignore clicks within 500ms
    if (now - lastClickTime.current < 500) {
      console.warn('⚠️ [WorkflowWidget] Click debounced (too fast)');
      return;
    }
    
    // 🔧 FIX: Prevent concurrent handling
    if (isHandlingClick.current) {
      console.warn('⚠️ [WorkflowWidget] Click ignored (already handling)');
      return;
    }
    
    isHandlingClick.current = true;
    lastClickTime.current = now;
    
    console.log(`🎯 [WorkflowWidget] Stage clicked: ${stage}`);

    const stageIndex = STAGE_ORDER.indexOf(stage as any);
    const currentIndex = STAGE_ORDER.indexOf(currentStage);
    const isNextStage = stageIndex === currentIndex + 1;
    const stageData = workflowState.stages[stage];

    // Case 1: Navigate to any completed stage (forward or back, no confirmation needed)
    if (stageData.completed && stage !== currentStage) {
      console.log(`📍 [WorkflowWidget] Navigating to completed stage: ${stage}`);
      
      try {
        // 🔍 Validate current stage before exiting (config-driven validation)
        console.log(`🔍 [WorkflowWidget] Validating current stage (${currentStage}) before exit`);
        workflowService.validateAllStages();
        
        // Update workflow state
        workflowService.setCurrentStage(stage as any);

        // Navigate to the stage route
        const route = workflowService.getStageRoute(stage as any);
        
        // Get study instance UIDs from current URL
        const urlParams = new URLSearchParams(window.location.search);
        const studyUIDs = urlParams.get('StudyInstanceUIDs');
        
        // Construct full URL with query params
        const fullUrl = studyUIDs ? `${route}?StudyInstanceUIDs=${studyUIDs}` : route;
        
        console.log(`🧭 [WorkflowWidget] Navigating to: ${fullUrl}`);
        
        // Use React Router history to navigate
        const { history } = await import('../../../utils/history');
        if (history.navigate) {
          history.navigate(fullUrl);
          console.log('✅ [WorkflowWidget] Navigation successful');
          // Reset flag after navigation starts (with delay to allow navigation to complete)
          setTimeout(() => {
            isHandlingClick.current = false;
          }, 500);
        } else {
          console.warn('⚠️ [WorkflowWidget] history.navigate not available, using fallback');
          window.location.href = fullUrl;
          // Window will reload, so flag will reset naturally
        }
      } catch (error) {
        console.error('❌ [WorkflowWidget] Error during navigation:', error);
        // Reset flag on error
        isHandlingClick.current = false;
      }
      return;
    }

    // Case 2: Advance to next uncompleted stage (requires confirmation)
    if (isNextStage && !stageData.completed) {
      console.log('⏭️ [WorkflowWidget] Attempting to advance to next stage');

      // Prompt user to confirm advancement
      const confirmed = window.confirm(
        `Ready to advance to ${STAGE_LABELS[stage]}?\n\n` +
        `Please confirm you have completed all work in the current stage (${STAGE_LABELS[currentStage]}).`
      );

      if (!confirmed) {
        console.log('ℹ️ [WorkflowWidget] User cancelled advancement');
        // Reset flag on cancellation
        isHandlingClick.current = false;
        return;
      }

      console.log('✅ [WorkflowWidget] User confirmed advancement');

      // 🔍 Validate all stages before advancing (config-driven validation)
      console.log(`🔍 [WorkflowWidget] Validating current stage (${currentStage}) before advancement`);
      workflowService.validateAllStages();

      // Call advance function to properly mark current stage as completed
      try {
        const result = advanceStage();

        if (!result.success) {
          console.error('❌ [WorkflowWidget] Failed to advance:', result.error);
          alert(`Failed to advance: ${result.error}`);
          // Reset flag on error
          isHandlingClick.current = false;
          return;
        }

        console.log(`⏭️ [WorkflowWidget] Stage advanced: ${currentStage} → ${result.nextStage}`);

        // Navigate to next stage
        if (result.nextStage) {
          const route = workflowService.getStageRoute(result.nextStage);
          
          // Get study instance UIDs from current URL
          const urlParams = new URLSearchParams(window.location.search);
          const studyUIDs = urlParams.get('StudyInstanceUIDs');
          
          // Construct full URL with query params
          const fullUrl = studyUIDs ? `${route}?StudyInstanceUIDs=${studyUIDs}` : route;
          
          console.log(`🧭 [WorkflowWidget] Navigating to: ${fullUrl}`);
          
          // Use React Router history to navigate
          const { history } = await import('../../../utils/history');
          if (history.navigate) {
            history.navigate(fullUrl);
            console.log('✅ [WorkflowWidget] Navigation successful');
            // Reset flag after navigation starts (with delay to allow navigation to complete)
            setTimeout(() => {
              isHandlingClick.current = false;
            }, 500);
          } else {
            console.warn('⚠️ [WorkflowWidget] history.navigate not available, using fallback');
            window.location.href = fullUrl;
            // Window will reload, so flag will reset naturally
          }
        } else {
          // No next stage, reset flag
          isHandlingClick.current = false;
        }
      } catch (error) {
        console.error('❌ [WorkflowWidget] Error during advancement:', error);
        alert(`Failed to advance: ${error.message}`);
        // Reset flag on error
        isHandlingClick.current = false;
      }
      return;
    }

    // Case 3: Block navigation to uncompleted future stages
    if (stageIndex > currentIndex && !stageData.completed && !isNextStage) {
      console.warn('⚠️ [WorkflowWidget] Cannot navigate to uncompleted future stage');
      alert('Please complete stages in order');
      // Reset flag
      isHandlingClick.current = false;
      return;
    }

    // Case 4: All other cases (same stage clicked, etc.) - reset flag
    console.log('ℹ️ [WorkflowWidget] No navigation action needed');
    isHandlingClick.current = false;
  }, [currentStage, advanceStage, workflowState, workflowService]);

  // Get tooltip text
  const getTooltip = (stage: string) => {
    const stageData = workflowState.stages[stage];
    const isActive = stage === currentStage;
    const isCompleted = stageData.completed;
    const stageIndex = STAGE_ORDER.indexOf(stage as any);
    const currentIndex = STAGE_ORDER.indexOf(currentStage);
    const isNextStage = stageIndex === currentIndex + 1;

    const label = STAGE_LABELS[stage];
    if (isActive && isCompleted) return `${label} (Current - Completed)`;
    if (isActive) return `${label} (Current)`;
    if (isCompleted) return `${label} (Completed - Click to return)`;
    if (isNextStage) return `${label} (Click to advance)`;
    return `${label} (Pending)`;
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {STAGE_ORDER.map((stage, index) => (
        <div
          key={stage}
          className={`${getStatusClasses(stage)} ${getCursorClass(stage)}`}
          onClick={() => handleStageClick(stage)}
          title={getTooltip(stage)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleStageClick(stage);
            }
          }}
        >
          <span>{getStatusIcon(stage)}</span>
        </div>
      ))}
    </div>
  );
}

WorkflowWidget.propTypes = {
  className: PropTypes.string,
};

export default WorkflowWidget;

