/**
 * Workflow Context Provider
 * Provides workflow state and methods to all components
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  WorkflowState,
  WorkflowStage,
  WorkflowValidation,
  WorkflowStageData,
  WORKFLOW_EVENTS,
} from '../types';
import WorkflowService from '../services/WorkflowService';

export interface WorkflowContextValue {
  // State
  workflowState: WorkflowState;
  currentStage: WorkflowStage;
  
  // Stage navigation
  advanceStage: () => { success: boolean; nextStage?: WorkflowStage; error?: string };
  goBackStage: () => { success: boolean; previousStage?: WorkflowStage; error?: string };
  setCurrentStage: (stage: WorkflowStage) => void;
  
  // Stage data management
  getStageData: <T extends WorkflowStageData>(stage: WorkflowStage) => T;
  updateStageData: (stage: WorkflowStage, data: Partial<WorkflowStageData>) => void;
  markStageCompleted: (stage: WorkflowStage) => void;
  
  // Validation
  validateStage: (stage: WorkflowStage) => WorkflowValidation;
  validateAllStages: () => void;
  canAdvanceCurrentStage: () => boolean;
  
  // Navigation helpers
  getNextStage: (fromStage?: WorkflowStage) => WorkflowStage | null;
  getPreviousStage: (fromStage?: WorkflowStage) => WorkflowStage | null;
  getStageRoute: (stage: WorkflowStage) => string;
  
  // Workflow management
  resetWorkflow: () => void;
  setCaseMetadata: (metadata: any) => void;
  
  // Service access
  workflowService: WorkflowService;
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

export interface WorkflowProviderProps {
  children: React.ReactNode;
  service: WorkflowService;
}

/**
 * WorkflowProvider component
 * Wraps the application to provide workflow state and methods
 */
export function WorkflowProvider({ children, service }: WorkflowProviderProps) {
  const mountId = React.useRef(Math.random().toString(36).substr(2, 9));
  
  console.log(`🚀 [WorkflowProvider-${mountId.current}] Initializing provider...`);

  const [workflowState, setWorkflowState] = useState<WorkflowState>(service.getState());

  // Subscribe to workflow events
  useEffect(() => {
    console.log(`🔔 [WorkflowProvider-${mountId.current}] Setting up event subscriptions`);

    const unsubscribers: Array<() => void> = [];

    // Log current listener count BEFORE subscribing
    const listenersBefore = (service as any)._listeners.get(WORKFLOW_EVENTS.STAGE_CHANGED)?.size || 0;
    console.log(`📊 [WorkflowProvider-${mountId.current}] Listeners BEFORE: ${listenersBefore}`);

    // ... existing subscription code ...

    // Log current listener count AFTER subscribing
    const listenersAfter = (service as any)._listeners.get(WORKFLOW_EVENTS.STAGE_CHANGED)?.size || 0;
    console.log(`📊 [WorkflowProvider-${mountId.current}] Listeners AFTER: ${listenersAfter}`);

    // Cleanup subscriptions
    return () => {
      console.log(`🧹 [WorkflowProvider-${mountId.current}] Cleaning up event subscriptions`);
      
      const listenersBeforeCleanup = (service as any)._listeners.get(WORKFLOW_EVENTS.STAGE_CHANGED)?.size || 0;
      console.log(`📊 [WorkflowProvider-${mountId.current}] Listeners BEFORE cleanup: ${listenersBeforeCleanup}`);
      
      unsubscribers.forEach(unsub => unsub());
      
      const listenersAfterCleanup = (service as any)._listeners.get(WORKFLOW_EVENTS.STAGE_CHANGED)?.size || 0;
      console.log(`📊 [WorkflowProvider-${mountId.current}] Listeners AFTER cleanup: ${listenersAfterCleanup}`);
    };
  }, [service]);

  // Subscribe to workflow events
  useEffect(() => {
    console.log('🔔 [WorkflowProvider] Setting up event subscriptions');

    const unsubscribers: Array<() => void> = [];

    // Subscribe to stage changes
    const unsubStageChanged = service.subscribe(
      WORKFLOW_EVENTS.STAGE_CHANGED,
      (data: any) => {
        console.log('📢 [WorkflowProvider] Stage changed event received:', data);
        setWorkflowState(service.getState());
      }
    );
    unsubscribers.push(unsubStageChanged);

    // Subscribe to data updates
    const unsubDataUpdated = service.subscribe(
      WORKFLOW_EVENTS.DATA_UPDATED,
      (data: any) => {
        console.log('📢 [WorkflowProvider] Data updated event received:', data);
        setWorkflowState(service.getState());
      }
    );
    unsubscribers.push(unsubDataUpdated);

    // Subscribe to validation changes
    const unsubValidationChanged = service.subscribe(
      WORKFLOW_EVENTS.VALIDATION_CHANGED,
      (data: any) => {
        console.log('📢 [WorkflowProvider] Validation changed event received:', data);
        setWorkflowState(service.getState());
      }
    );
    unsubscribers.push(unsubValidationChanged);

    // Subscribe to workflow reset
    const unsubWorkflowReset = service.subscribe(
      WORKFLOW_EVENTS.WORKFLOW_RESET,
      () => {
        console.log('📢 [WorkflowProvider] Workflow reset event received');
        setWorkflowState(service.getState());
      }
    );
    unsubscribers.push(unsubWorkflowReset);

    console.log('✅ [WorkflowProvider] Event subscriptions set up');

    // Cleanup subscriptions
    return () => {
      console.log('🧹 [WorkflowProvider] Cleaning up event subscriptions');
      unsubscribers.forEach(unsub => unsub());
    };
  }, [service]);

  // Context value
  const contextValue: WorkflowContextValue = {
    // State
    workflowState,
    currentStage: workflowState.currentStage,

    // Stage navigation
    advanceStage: useCallback(() => {
      console.log('⏭️ [WorkflowProvider] advanceStage called');
      return service.advanceStage();
    }, [service]),

    goBackStage: useCallback(() => {
      console.log('⏮️ [WorkflowProvider] goBackStage called');
      return service.goBackStage();
    }, [service]),

    setCurrentStage: useCallback((stage: WorkflowStage) => {
      console.log(`🔄 [WorkflowProvider] setCurrentStage called: ${stage}`);
      service.setCurrentStage(stage);
    }, [service]),

    // Stage data management
    getStageData: useCallback(<T extends WorkflowStageData>(stage: WorkflowStage): T => {
      console.log(`📊 [WorkflowProvider] getStageData called: ${stage}`);
      return service.getStageData<T>(stage);
    }, [service]),

    updateStageData: useCallback((stage: WorkflowStage, data: Partial<WorkflowStageData>) => {
      console.log(`💾 [WorkflowProvider] updateStageData called: ${stage}`);
      service.updateStageData(stage, data);
    }, [service]),

    markStageCompleted: useCallback((stage: WorkflowStage) => {
      console.log(`✅ [WorkflowProvider] markStageCompleted called: ${stage}`);
      service.markStageCompleted(stage);
    }, [service]),

    // Validation
    validateStage: useCallback((stage: WorkflowStage): WorkflowValidation => {
      console.log(`🔍 [WorkflowProvider] validateStage called: ${stage}`);
      return service.validateStage(stage);
    }, [service]),

    validateAllStages: useCallback(() => {
      console.log('🔍 [WorkflowProvider] validateAllStages called');
      service.validateAllStages();
    }, [service]),

    canAdvanceCurrentStage: useCallback((): boolean => {
      console.log('🔍 [WorkflowProvider] canAdvanceCurrentStage called');
      return service.canAdvanceCurrentStage();
    }, [service]),

    // Navigation helpers
    getNextStage: useCallback((fromStage?: WorkflowStage): WorkflowStage | null => {
      console.log('➡️ [WorkflowProvider] getNextStage called');
      return service.getNextStage(fromStage);
    }, [service]),

    getPreviousStage: useCallback((fromStage?: WorkflowStage): WorkflowStage | null => {
      console.log('⬅️ [WorkflowProvider] getPreviousStage called');
      return service.getPreviousStage(fromStage);
    }, [service]),

    getStageRoute: useCallback((stage: WorkflowStage): string => {
      console.log(`🗺️ [WorkflowProvider] getStageRoute called: ${stage}`);
      return service.getStageRoute(stage);
    }, [service]),

    // Workflow management
    resetWorkflow: useCallback(() => {
      console.log('🔄 [WorkflowProvider] resetWorkflow called');
      service.resetWorkflow();
    }, [service]),

    setCaseMetadata: useCallback((metadata: any) => {
      console.log('📋 [WorkflowProvider] setCaseMetadata called');
      service.setCaseMetadata(metadata);
    }, [service]),

    // Service access
    workflowService: service,
  };

  console.log('✅ [WorkflowProvider] Provider initialized with state:', {
    currentStage: workflowState.currentStage,
    caseId: workflowState.metadata.caseId,
  });

  return (
    <WorkflowContext.Provider value={contextValue}>
      {children}
    </WorkflowContext.Provider>
  );
}

WorkflowProvider.propTypes = {
  children: PropTypes.node.isRequired,
  service: PropTypes.object.isRequired,
};

/**
 * Custom hook to use workflow context
 */
export function useWorkflow(): WorkflowContextValue {
  const context = useContext(WorkflowContext);

  if (!context) {
    const error = 'useWorkflow must be used within a WorkflowProvider';
    console.error(`❌ [useWorkflow] ${error}`);
    throw new Error(error);
  }

  return context;
}

/**
 * Custom hook to get current stage
 */
export function useCurrentStage(): WorkflowStage {
  const { currentStage } = useWorkflow();
  return currentStage;
}

/**
 * Custom hook to get stage data
 */
export function useStageData<T extends WorkflowStageData>(
  stage: WorkflowStage
): T {
  const { getStageData } = useWorkflow();
  return getStageData<T>(stage);
}

export { WorkflowContext };

