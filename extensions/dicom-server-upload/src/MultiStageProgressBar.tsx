import React from 'react';
import type { Stage, MultiStageProgressBarProps } from './types';

const MultiStageProgressBar: React.FC<MultiStageProgressBarProps> = ({
  stages,
  currentStageIndex,
  currentStageProgress,
  errorMessage,
}) => {
  // Calculate overall progress
  const calculateOverallProgress = () => {
    if (currentStageIndex < 0 || currentStageIndex >= stages.length) {
      return 0;
    }

    const currentStage = stages[currentStageIndex];
    const stageRange = currentStage.endPercent - currentStage.startPercent;
    const progressInStage = (currentStageProgress / 100) * stageRange;
    
    return currentStage.startPercent + progressInStage;
  };

  const overallProgress = calculateOverallProgress();
  const hasError = stages.some(stage => stage.status === 'error');

  return (
    <div className="multi-stage-progress" style={{ width: '100%', padding: '20px' }}>
      {/* Overall Progress Bar */}
      <div style={{ marginBottom: '20px' }}>
        <div
          style={{
            width: '100%',
            height: '12px',
            backgroundColor: '#2d3748',
            borderRadius: '6px',
            overflow: 'hidden',
            border: '1px solid #4a5568',
          }}
        >
          <div
            style={{
              width: `${overallProgress}%`,
              height: '100%',
              backgroundColor: hasError ? '#e53e3e' : '#48bb78',
              transition: 'width 0.3s ease, background-color 0.3s ease',
              background: hasError
                ? '#e53e3e'
                : 'linear-gradient(90deg, #48bb78 0%, #38a169 100%)',
            }}
          />
        </div>
        <div
          style={{
            marginTop: '8px',
            textAlign: 'center',
            color: hasError ? '#fc8181' : '#a0aec0',
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
          {hasError ? 'Error' : `${Math.round(overallProgress)}%`}
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div
          style={{
            marginBottom: '15px',
            padding: '10px',
            backgroundColor: 'rgba(229, 62, 62, 0.1)',
            border: '1px solid #fc8181',
            borderRadius: '4px',
            color: '#fc8181',
            fontSize: '13px',
          }}
        >
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

      {/* Stage Stepper */}
      <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
        {/* Connection Line */}
        <div
          style={{
            position: 'absolute',
            top: '15px',
            left: '30px',
            right: '30px',
            height: '2px',
            backgroundColor: '#4a5568',
            zIndex: 0,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${(currentStageIndex / Math.max(stages.length - 1, 1)) * 100}%`,
              backgroundColor: '#48bb78',
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {/* Stage Circles */}
        {stages.map((stage, index) => {
          const isCompleted = stage.status === 'completed';
          const isInProgress = stage.status === 'in-progress';
          const isError = stage.status === 'error';
          const isPending = stage.status === 'pending';

          let circleColor = '#4a5568'; // pending
          let textColor = '#a0aec0';
          let iconContent: React.ReactNode = index + 1;

          if (isCompleted) {
            circleColor = '#48bb78';
            textColor = '#48bb78';
            iconContent = '✓';
          } else if (isInProgress) {
            circleColor = '#3182ce';
            textColor = '#63b3ed';
          } else if (isError) {
            circleColor = '#e53e3e';
            textColor = '#fc8181';
            iconContent = '✗';
          }

          return (
            <div
              key={index}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
                position: 'relative',
                zIndex: 1,
              }}
            >
              {/* Circle */}
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  backgroundColor: circleColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: isInProgress ? '3px solid #63b3ed' : 'none',
                  boxShadow: isInProgress ? '0 0 10px rgba(99, 179, 237, 0.5)' : 'none',
                  transition: 'all 0.3s ease',
                }}
              >
                {iconContent}
              </div>

              {/* Stage Name */}
              <div
                style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: textColor,
                  textAlign: 'center',
                  fontWeight: isInProgress ? '600' : '400',
                  maxWidth: '80px',
                }}
              >
                {stage.name}
              </div>

              {/* Stage Progress (only for in-progress) */}
              {isInProgress && (
                <div
                  style={{
                    marginTop: '4px',
                    fontSize: '11px',
                    color: '#63b3ed',
                    fontWeight: '600',
                  }}
                >
                  {Math.round(currentStageProgress)}%
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MultiStageProgressBar;

