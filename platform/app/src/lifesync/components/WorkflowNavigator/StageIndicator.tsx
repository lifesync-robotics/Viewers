/**
 * Stage Indicator Component
 * Visual indicator for workflow stage status
 */

import React from 'react';
import PropTypes from 'prop-types';
import { WorkflowStage, STAGE_LABELS } from '../../types';

export interface StageIndicatorProps {
  stage: WorkflowStage;
  isActive: boolean;
  isCompleted: boolean;
  isPending: boolean;
  hasError: boolean;
  onClick?: () => void;
  index: number;
}

/**
 * StageIndicator Component
 * Shows the status of a single workflow stage
 */
export function StageIndicator({
  stage,
  isActive,
  isCompleted,
  isPending,
  hasError,
  onClick,
  index,
}: StageIndicatorProps) {
  console.log(`🎯 [StageIndicator] Rendering: ${stage}`, {
    isActive,
    isCompleted,
    isPending,
    hasError,
  });

  // Determine status icon
  const getStatusIcon = () => {
    if (hasError) return '⚠️';
    if (isCompleted) return '✅';
    if (isActive) return '🔵';
    if (isPending) return '⏸️';
    return '○';
  };

  // Determine status color classes
  const getStatusClasses = () => {
    const baseClasses = 'flex items-center gap-2 px-4 py-2 rounded-lg transition-all';
    
    // Priority: Error > Active > Completed > Pending
    // Note: If a stage is both active and completed, show as active (current stage)
    if (hasError) {
      return `${baseClasses} bg-red-700 text-white ring-2 ring-red-400`;
    }
    if (isActive && !isCompleted) {
      // Currently working on this stage
      return `${baseClasses} bg-blue-600 text-white font-bold ring-2 ring-blue-400`;
    }
    if (isActive && isCompleted) {
      // Currently on a completed stage (viewing/reviewing)
      return `${baseClasses} bg-blue-600 text-white font-bold ring-2 ring-green-400`;
    }
    if (isCompleted && !isActive) {
      // Completed previous stage
      return `${baseClasses} bg-green-700 text-white`;
    }
    // Pending (not started)
    return `${baseClasses} bg-gray-700 text-gray-400`;
  };

  // Determine if clickable
  const isClickable = onClick && !isActive;

  return (
    <div
      className={`${getStatusClasses()} ${isClickable ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      title={`${STAGE_LABELS[stage]} ${isCompleted ? '(Completed)' : isActive ? '(Current)' : '(Pending)'}`}
    >
      <span className="text-xl">{getStatusIcon()}</span>
      <div className="flex flex-col">
        <span className="text-xs opacity-75">Step {index + 1}</span>
        <span className="text-sm">{STAGE_LABELS[stage]}</span>
      </div>
    </div>
  );
}

StageIndicator.propTypes = {
  stage: PropTypes.string.isRequired,
  isActive: PropTypes.bool.isRequired,
  isCompleted: PropTypes.bool.isRequired,
  isPending: PropTypes.bool.isRequired,
  hasError: PropTypes.bool.isRequired,
  onClick: PropTypes.func,
  index: PropTypes.number.isRequired,
};

export default StageIndicator;

