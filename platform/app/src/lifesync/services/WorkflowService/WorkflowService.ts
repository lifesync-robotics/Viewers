/**
 * Surgical Workflow Service
 * Manages workflow state, stage transitions, and validation
 * 
 * NOTE: This service uses configuration-driven workflow management
 * Stage definitions, validation rules, and navigation logic are loaded from workflow-config.yaml
 * 
 * STATE MANAGEMENT: In-memory only (no persistence)
 * The workflow state is ephemeral and resets on page refresh
 * This ensures state always matches the current config
 */

import {
  WorkflowState,
  WorkflowStage,
  WorkflowValidation,
  WorkflowStageData,
  WORKFLOW_EVENTS,
} from '../../types';
import { 
  validateStageFromConfig, 
  validateAllStagesFromConfig,
  getUserConfirmationMessage 
} from '../../utils/configValidation';
import { getWorkflowConfig } from '../../config';

export default class WorkflowService {
  static REGISTRATION = {
    name: 'surgicalWorkflowService',
    altName: 'WorkflowService',
    create: ({ configuration = {} }) => {
      return new WorkflowService({ configuration });
    },
  };

  private _state: WorkflowState;
  private _listeners: Map<string, Set<Function>>;
  private _servicesManager: any;
  private _commandsManager: any;

  constructor({ configuration = {} }) {
    console.log('🚀 [WorkflowService] Initializing Surgical Workflow Service...');

    this._listeners = new Map();
    this._servicesManager = null;
    this._commandsManager = null;

    // Initialize with fresh state from YAML config (single source of truth)
    // State is in-memory only and resets on page refresh
    this._state = this._createDefaultState();
    
    console.log('✅ [WorkflowService] Fresh workflow state created from config (in-memory only)');

    // Initialize event listeners
    Object.values(WORKFLOW_EVENTS).forEach(event => {
      this._listeners.set(event, new Set());
    });

    console.log('✅ [WorkflowService] Service initialized:', {
      currentStage: this._state.currentStage,
      stateSource: 'fresh-from-config',
    });
  }

  /**
   * Set the services manager reference
   */
  public setServicesManager(servicesManager: any): void {
    console.log('🔗 [WorkflowService] Setting services manager reference');
    this._servicesManager = servicesManager;
  }

  /**
   * Get the services manager reference
   */
  public getServicesManager(): any {
    return this._servicesManager;
  }

  /**
   * Set the commands manager reference
   */
  public setCommandsManager(commandsManager: any): void {
    console.log('🔗 [WorkflowService] Setting commands manager reference');
    this._commandsManager = commandsManager;
  }

  /**
   * Get the commands manager reference
   */
  public getCommandsManager(): any {
    return this._commandsManager;
  }

  // State compatibility and restore methods removed - no longer needed
  // State is in-memory only and always created fresh from config

  /**
   * Create default workflow state from YAML config (single source of truth)
   * No fallbacks - config must be valid
   */
  private _createDefaultState(): WorkflowState {
    console.log('🏗️ [WorkflowService] Creating default workflow state from configuration');

    const configLoader = getWorkflowConfig();
    const stages = configLoader.getStages();
    const initialStage = configLoader.getInitialStage();

    console.log(`📋 [WorkflowService] Config loaded: ${stages.length} stages, initial stage: ${initialStage.id}`);

    // Create stage data dynamically from configuration
    const stageData: Record<string, WorkflowStageData> = {};
    const validation: Record<string, WorkflowValidation> = {};

    stages.forEach(stage => {
      // Initialize stage data with required properties based on stage type
      const baseStageData: WorkflowStageData = { completed: false };
      
      // Add special properties for review stage (TypeScript requirement)
      if (stage.properties.isFinal && stage.id === 'review') {
        stageData[stage.id] = { ...baseStageData, reviewed: false } as any;
      } else {
        stageData[stage.id] = baseStageData;
      }
      
      // Initial validation - only initial stage can advance, others require completion of dependencies
      if (stage.properties.isInitial) {
        validation[stage.id] = { 
          canAdvance: true,
          isFinalStage: false,
        };
      } else if (stage.properties.isFinal) {
        validation[stage.id] = {
          canAdvance: false,
          reason: 'This is the final stage of the workflow',
          isFinalStage: true,
        };
      } else {
        validation[stage.id] = { 
          canAdvance: false,
          isFinalStage: false,
        };
      }
      
      console.log(`  ✓ Stage: ${stage.id}, canAdvance: ${validation[stage.id].canAdvance}, isFinal: ${stage.properties.isFinal}`);
    });

    return {
      currentStage: initialStage.id,
      stages: stageData,
      validation,
      metadata: {
        createdAt: Date.now(),
        lastModified: Date.now(),
      },
    };
  }

  /**
   * Get current workflow state
   */
  public getState(): WorkflowState {
    return { ...this._state };
  }

  /**
   * Get current stage
   */
  public getCurrentStage(): WorkflowStage {
    return this._state.currentStage;
  }

  /**
   * Set current stage
   */
  public setCurrentStage(stage: WorkflowStage): void {
    console.log(`🔄 [WorkflowService] Setting current stage: ${stage}`);

    const previousStage = this._state.currentStage;
    this._state.currentStage = stage;
    this._state.metadata.lastModified = Date.now();

    // State is in-memory only - no persistence
    this._emit(WORKFLOW_EVENTS.STAGE_CHANGED, {
      stage,
      previousStage,
    });

    console.log(`✅ [WorkflowService] Stage changed: ${previousStage} → ${stage}`);
  }

  /**
   * Get data for a specific stage
   */
  public getStageData<T extends WorkflowStageData>(stage: WorkflowStage): T {
    console.log(`📊 [WorkflowService] Getting stage data for: ${stage}`);
    return this._state.stages[stage] as T;
  }

  /**
   * Update data for a specific stage
   */
  public updateStageData(
    stage: WorkflowStage,
    data: Partial<WorkflowStageData>
  ): void {
    console.log(`💾 [WorkflowService] Updating stage data for: ${stage}`, {
      completed: data.completed,
      hasData: !!data.data,
    });

    this._state.stages[stage] = {
      ...this._state.stages[stage],
      ...data,
      timestamp: Date.now(),
    };
    this._state.metadata.lastModified = Date.now();

    // State is in-memory only - no persistence
    this._emit(WORKFLOW_EVENTS.DATA_UPDATED, {
      stage,
      stageData: data,
    });

    console.log(`✅ [WorkflowService] Stage data updated for: ${stage}`);

    // Re-validate stages after data update
    this.validateAllStages();
  }

  /**
   * Mark a stage as completed
   */
  public markStageCompleted(stage: WorkflowStage): void {
    console.log(`✅ [WorkflowService] Marking stage as completed: ${stage}`);
    this.updateStageData(stage, { completed: true });
  }

  /**
   * Mark a stage as active
   */
  public markStageActive(stage: WorkflowStage): void {
    console.log(`🎯 [WorkflowService] Marking stage as active: ${stage}`);
    this.setCurrentStage(stage);
  }

  /**
   * Validate a specific stage from config (single source of truth)
   * No fallbacks - validation must come from config
   */
  public validateStage(stage: WorkflowStage): WorkflowValidation {
    console.log(`🔍 [WorkflowService] Validating stage: ${stage} from config`);

    // Use configuration-based validation - this is the ONLY source of truth
    const validation = validateStageFromConfig(
      stage, 
      this._state, 
      this._servicesManager?.services
    );
    
    this._state.validation[stage] = validation;

    this._emit(WORKFLOW_EVENTS.VALIDATION_CHANGED, {
      stage,
      validation,
    });

    console.log(`✅ [WorkflowService] Validation for ${stage}:`, validation);
    return validation;
  }

  /**
   * Validate all stages (Configuration-Driven)
   */
  /**
   * Validate all stages using config (single source of truth)
   * No fallbacks - validation must come from config
   */
  public validateAllStages(): void {
    console.log('🔍 [WorkflowService] Validating all stages from config...');

    // Use configuration-based validation - this is the ONLY source of truth
    const newValidation = validateAllStagesFromConfig(
      this._state,
      this._servicesManager?.services
    );
    
    this._state.validation = newValidation;

    this._emit(WORKFLOW_EVENTS.VALIDATION_CHANGED, {
      validation: this._state.validation,
    });

    console.log('✅ [WorkflowService] All stages validated:', Object.keys(newValidation));
  }

  /**
   * Check if current stage can advance (Configuration-Driven)
   */
  public canAdvanceCurrentStage(): boolean {
    const validation = this._state.validation[this._state.currentStage];
    
    // Null safety: If validation doesn't exist, cannot advance
    if (!validation) {
      console.warn(`⚠️ [WorkflowService] No validation data for stage: ${this._state.currentStage}`);
      return false;
    }
    
    const result = validation.canAdvance;
    
    console.log(`🔍 [WorkflowService] Can advance from ${this._state.currentStage}:`, result, {
      isFinalStage: validation.isFinalStage,
      reason: validation.reason,
    });
    
    return result;
  }

  /**
   * Get next stage in workflow (Configuration-Driven)
   */
  public getNextStage(fromStage?: WorkflowStage): WorkflowStage | null {
    const stage = fromStage || this._state.currentStage;
    
    try {
      const configLoader = getWorkflowConfig();
      const nextStageConfig = configLoader.getNextStage(stage);
      
      if (!nextStageConfig) {
        console.log(`ℹ️ [WorkflowService] No next stage after: ${stage}`);
        return null;
      }

      console.log(`➡️ [WorkflowService] Next stage after ${stage}: ${nextStageConfig.id}`);
      return nextStageConfig.id;
    } catch (error) {
      console.error(`❌ [WorkflowService] Error getting next stage:`, error);
      return null;
    }
  }

  /**
   * Get previous stage in workflow (Configuration-Driven)
   */
  public getPreviousStage(fromStage?: WorkflowStage): WorkflowStage | null {
    const stage = fromStage || this._state.currentStage;
    
    try {
      const configLoader = getWorkflowConfig();
      const previousStageConfig = configLoader.getPreviousStage(stage);
      
      if (!previousStageConfig) {
        console.log(`ℹ️ [WorkflowService] No previous stage before: ${stage}`);
        return null;
      }

      console.log(`⬅️ [WorkflowService] Previous stage before ${stage}: ${previousStageConfig.id}`);
      return previousStageConfig.id;
    } catch (error) {
      console.error(`❌ [WorkflowService] Error getting previous stage:`, error);
      return null;
    }
  }

  /**
   * Get route for a specific stage from config (single source of truth)
   * No fallbacks - route must come from config
   */
  public getStageRoute(stage: WorkflowStage): string {
    const configLoader = getWorkflowConfig();
    const stageConfig = configLoader.getStage(stage);
    
    if (!stageConfig || !stageConfig.route) {
      throw new Error(`No route configured for stage: ${stage}`);
    }
    
    console.log(`🗺️ [WorkflowService] Route for ${stage}: ${stageConfig.route}`);
    return stageConfig.route;
  }

  /**
   * Advance to next stage
   */
  public advanceStage(): { success: boolean; nextStage?: WorkflowStage; error?: string } {
    console.log('⏭️ [WorkflowService] Attempting to advance to next stage...');

    // Check if advancement is possible (only blocks at final stage)
    if (!this.canAdvanceCurrentStage()) {
      const validation = this._state.validation[this._state.currentStage];
      const reason = validation?.reason || 'Cannot advance from current stage';
      console.log('ℹ️ [WorkflowService] Cannot advance:', reason);
      return {
        success: false,
        error: reason,
      };
    }
    
    // Note: User confirmation happens in WorkflowNavigator UI

    const nextStage = this.getNextStage();
    if (!nextStage) {
      console.error('❌ [WorkflowService] No next stage available');
      return {
        success: false,
        error: 'Already at final stage',
      };
    }

    // Mark current stage as completed
    this.markStageCompleted(this._state.currentStage);

    // Move to next stage
    this.setCurrentStage(nextStage);

    console.log(`✅ [WorkflowService] Advanced to stage: ${nextStage}`);
    return {
      success: true,
      nextStage,
    };
  }

  /**
   * Go back to previous stage (Configuration-Driven)
   */
  public goBackStage(): { success: boolean; previousStage?: WorkflowStage; error?: string } {
    console.log('⏮️ [WorkflowService] Going back to previous stage...');

    const previousStage = this.getPreviousStage();
    if (!previousStage) {
      console.error('❌ [WorkflowService] No previous stage available');
      return {
        success: false,
        error: 'Already at first stage',
      };
    }

    try {
      const configLoader = getWorkflowConfig();
      const navigationConfig = configLoader.getNavigationConfig();
      const stages = configLoader.getStages();
      
      // Get stage order from configuration
      const stageOrder = stages.map(s => s.id);
      const currentStageIndex = stageOrder.indexOf(this._state.currentStage);
      const previousStageIndex = stageOrder.indexOf(previousStage);
      
      // Mark stages as incomplete based on navigation config
      if (navigationConfig.backNavigation.markIncomplete) {
        console.log(`🔄 [WorkflowService] Marking stages as incomplete from index ${previousStageIndex} onwards`);
        
        for (let i = previousStageIndex; i < stageOrder.length; i++) {
          const stage = stageOrder[i];
          if (this._state.stages[stage]?.completed) {
            console.log(`  ↳ Marking ${stage} as incomplete`);
            this._state.stages[stage] = {
              ...this._state.stages[stage],
              completed: false,
              timestamp: Date.now(),
            };
          }
        }
      }

      // Clear data if configured
      if (navigationConfig.backNavigation.clearData) {
        console.log(`🔄 [WorkflowService] Clearing data for stages from index ${previousStageIndex} onwards`);
        for (let i = previousStageIndex; i < stageOrder.length; i++) {
          const stage = stageOrder[i];
          this._state.stages[stage] = { completed: false };
        }
      }

      // Update metadata
      this._state.metadata.lastModified = Date.now();
      // State is in-memory only - no persistence

      // Emit data update event for all affected stages
      this._emit(WORKFLOW_EVENTS.DATA_UPDATED, {
        stage: previousStage,
        stageData: this._state.stages[previousStage],
      });

      // Now set current stage to previous stage
      this.setCurrentStage(previousStage);

      console.log(`✅ [WorkflowService] Went back to stage: ${previousStage} (marked as active/incomplete)`);
      return {
        success: true,
        previousStage,
      };
    } catch (error) {
      console.error(`❌ [WorkflowService] Error going back:`, error);
      return {
        success: false,
        error: `Failed to go back: ${error.message}`,
      };
    }
  }

  /**
   * Reset workflow to initial state
   */
  public resetWorkflow(): void {
    console.log('🔄 [WorkflowService] Resetting workflow to initial state...');

    this._state = this._createDefaultState();
    clearWorkflowState();

    this._emit(WORKFLOW_EVENTS.WORKFLOW_RESET, {});

    console.log('✅ [WorkflowService] Workflow reset complete');
  }

  /**
   * Set case metadata
   */
  public setCaseMetadata(metadata: {
    caseId?: string;
    sessionId?: string;
    surgeon?: string;
  }): void {
    console.log('📋 [WorkflowService] Setting case metadata:', metadata);

    this._state.metadata = {
      ...this._state.metadata,
      ...metadata,
      lastModified: Date.now(),
    };

    // State is in-memory only - no persistence
    console.log('✅ [WorkflowService] Case metadata updated');
  }

  /**
   * Subscribe to workflow events
   */
  public subscribe(event: string, callback: Function): () => void {
    console.log(`🔔 [WorkflowService] Subscribing to event: ${event}`);

    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }

    this._listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      console.log(`🔕 [WorkflowService] Unsubscribing from event: ${event}`);
      this._listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Emit event to listeners
   */
  private _emit(event: string, data: any): void {
    console.log(`📢 [WorkflowService] Emitting event: ${event}`, data);

    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ [WorkflowService] Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Persist state to storage
   */
  // Persistence method removed - state is in-memory only

  /**
   * Destroy service and cleanup
   */
  public destroy(): void {
    console.log('🧹 [WorkflowService] Destroying service...');

    this._listeners.clear();
    this._servicesManager = null;
    this._commandsManager = null;

    console.log('✅ [WorkflowService] Service destroyed');
  }
}

