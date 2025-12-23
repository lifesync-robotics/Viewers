/**
 * Workflow Configuration Loader
 * Loads and parses the workflow configuration from YAML
 * Provides typed access to workflow configuration
 */

import yaml from 'js-yaml';

/**
 * Configuration types matching the YAML structure
 */

export interface WorkflowConfigMetadata {
  defaultSurgeon: string;
  requiresCaseId: boolean;
  autoSaveInterval: number;
}

export interface StageProperties {
  isInitial: boolean;
  isFinal: boolean;
  canSkip: boolean;
  requiresCompletion: boolean;
}

export interface ValidationRule {
  rule: string;
  message: string;
}

export interface UserConfirmation {
  enabled: boolean;
  message: string;
}

export interface FinalStageValidation {
  canAdvance: boolean;
  reason: string;
  completionAction: string;
}

export interface StageValidation {
  auto: ValidationRule[];
  userConfirmation: UserConfirmation;
  finalStage?: FinalStageValidation;
}

export interface DataSchema {
  required: string[];
  optional: string[];
}

export interface StageAction {
  type: string;
  target?: string;
  source?: string;
}

export interface StageConfig {
  id: string;
  name: string;
  description: string;
  route: string;
  order: number;
  properties: StageProperties;
  validation: StageValidation;
  dependencies: string[];
  dataSchema: DataSchema;
  actions: {
    onEnter: StageAction[];
    onExit: StageAction[];
  };
}

export interface ValidationRuleDefinition {
  type: 'data_check' | 'service_check' | 'custom';
  path?: string;
  condition?: string;
  value?: any;
  service?: string;
  method?: string;
  implementation?: string;
}

export interface NavigationConfig {
  allowBackNavigation: boolean;
  allowForwardNavigation: boolean;
  allowDirectNavigation: boolean;
  preserveQueryParams: boolean;
  backNavigation: {
    markIncomplete: boolean;
    clearData: boolean;
  };
  forwardNavigation: {
    requireValidation: boolean;
    requireUserConfirmation: boolean;
    markPreviousComplete: boolean;
  };
}

export interface UIColors {
  pending: string;
  active: string;
  completed: string;
  error: string;
}

export interface NavigatorUI {
  showStageList: boolean;
  showNavButtons: boolean;
  compactMode: boolean;
  colors: UIColors;
  confirmations: {
    advancement: {
      enabled: boolean;
      style: string;
    };
    backNavigation: {
      enabled: boolean;
      style: string;
    };
  };
}

export interface StageUIConfig {
  icon: string;
  color: string;
}

export interface UIConfig {
  navigator: NavigatorUI;
  stageUI: Record<string, StageUIConfig>;
}

export interface WorkflowConfig {
  name: string;
  version: string;
  description: string;
  metadata: WorkflowConfigMetadata;
  stages: StageConfig[];
  validationRules: Record<string, ValidationRuleDefinition>;
  navigation: NavigationConfig;
}

export interface FullConfig {
  workflow: WorkflowConfig;
  ui: UIConfig;
}

/**
 * WorkflowConfigLoader
 * Singleton class to load and provide access to workflow configuration
 */
export class WorkflowConfigLoader {
  private static instance: WorkflowConfigLoader;
  private config: FullConfig | null = null;
  private initialized: boolean = false;

  private constructor() {
    console.log('🏗️ [WorkflowConfigLoader] Creating instance');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): WorkflowConfigLoader {
    if (!WorkflowConfigLoader.instance) {
      WorkflowConfigLoader.instance = new WorkflowConfigLoader();
    }
    return WorkflowConfigLoader.instance;
  }

  /**
   * Initialize configuration from YAML string
   */
  public async initialize(yamlContent: string): Promise<void> {
    if (this.initialized) {
      console.log('ℹ️ [WorkflowConfigLoader] Already initialized');
      return;
    }

    console.log('📂 [WorkflowConfigLoader] Loading workflow configuration...');

    try {
      // Parse YAML
      this.config = yaml.load(yamlContent) as FullConfig;

      // Validate configuration
      this.validateConfig();

      // Sort stages by order
      this.config.workflow.stages.sort((a, b) => a.order - b.order);

      this.initialized = true;
      console.log('✅ [WorkflowConfigLoader] Configuration loaded successfully', {
        name: this.config.workflow.name,
        version: this.config.workflow.version,
        stageCount: this.config.workflow.stages.length,
      });
    } catch (error) {
      console.error('❌ [WorkflowConfigLoader] Failed to load configuration:', error);
      throw new Error(`Failed to load workflow configuration: ${error.message}`);
    }
  }

  /**
   * Validate loaded configuration
   */
  private validateConfig(): void {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    const { workflow } = this.config;

    // Check required fields
    if (!workflow.name || !workflow.stages || workflow.stages.length === 0) {
      throw new Error('Invalid configuration: missing required fields');
    }

    // Validate stages
    const stageIds = new Set<string>();
    let hasInitial = false;
    let hasFinal = false;

    workflow.stages.forEach((stage, index) => {
      // Check for duplicate IDs
      if (stageIds.has(stage.id)) {
        throw new Error(`Duplicate stage ID: ${stage.id}`);
      }
      stageIds.add(stage.id);

      // Check required stage fields
      if (!stage.id || !stage.name || !stage.route) {
        throw new Error(`Stage at index ${index} missing required fields`);
      }

      // Track initial and final stages
      if (stage.properties.isInitial) {
        if (hasInitial) {
          throw new Error('Multiple initial stages defined');
        }
        hasInitial = true;
      }

      if (stage.properties.isFinal) {
        if (hasFinal) {
          throw new Error('Multiple final stages defined');
        }
        hasFinal = true;
      }

      // Validate dependencies exist
      stage.dependencies.forEach(depId => {
        if (!stageIds.has(depId) && !workflow.stages.some(s => s.id === depId)) {
          throw new Error(`Stage ${stage.id} has invalid dependency: ${depId}`);
        }
      });
    });

    if (!hasInitial) {
      throw new Error('No initial stage defined');
    }

    if (!hasFinal) {
      throw new Error('No final stage defined');
    }

    console.log('✅ [WorkflowConfigLoader] Configuration validation passed');
  }

  /**
   * Get full configuration
   */
  public getConfig(): FullConfig {
    if (!this.initialized || !this.config) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
    return this.config;
  }

  /**
   * Get workflow configuration
   */
  public getWorkflowConfig(): WorkflowConfig {
    return this.getConfig().workflow;
  }

  /**
   * Get UI configuration
   */
  public getUIConfig(): UIConfig {
    return this.getConfig().ui;
  }

  /**
   * Get all stages in order
   */
  public getStages(): StageConfig[] {
    return this.getWorkflowConfig().stages;
  }

  /**
   * Get stage by ID
   */
  public getStage(stageId: string): StageConfig | undefined {
    return this.getStages().find(stage => stage.id === stageId);
  }

  /**
   * Get initial stage
   */
  public getInitialStage(): StageConfig {
    const initial = this.getStages().find(stage => stage.properties.isInitial);
    if (!initial) {
      throw new Error('No initial stage found in configuration');
    }
    return initial;
  }

  /**
   * Get final stage
   */
  public getFinalStage(): StageConfig {
    const final = this.getStages().find(stage => stage.properties.isFinal);
    if (!final) {
      throw new Error('No final stage found in configuration');
    }
    return final;
  }

  /**
   * Get stage order (array of stage IDs)
   */
  public getStageOrder(): string[] {
    return this.getStages().map(stage => stage.id);
  }

  /**
   * Get stage labels (map of ID to name)
   */
  public getStageLabels(): Record<string, string> {
    const labels: Record<string, string> = {};
    this.getStages().forEach(stage => {
      labels[stage.id] = stage.name;
    });
    return labels;
  }

  /**
   * Get stage routes (map of ID to route)
   */
  public getStageRoutes(): Record<string, string> {
    const routes: Record<string, string> = {};
    this.getStages().forEach(stage => {
      routes[stage.id] = stage.route;
    });
    return routes;
  }

  /**
   * Get next stage after given stage
   */
  public getNextStage(currentStageId: string): StageConfig | null {
    const stages = this.getStages();
    const currentIndex = stages.findIndex(s => s.id === currentStageId);
    
    if (currentIndex === -1 || currentIndex === stages.length - 1) {
      return null;
    }
    
    return stages[currentIndex + 1];
  }

  /**
   * Get previous stage before given stage
   */
  public getPreviousStage(currentStageId: string): StageConfig | null {
    const stages = this.getStages();
    const currentIndex = stages.findIndex(s => s.id === currentStageId);
    
    if (currentIndex <= 0) {
      return null;
    }
    
    return stages[currentIndex - 1];
  }

  /**
   * Check if stage is final
   */
  public isFinalStage(stageId: string): boolean {
    const stage = this.getStage(stageId);
    return stage?.properties.isFinal ?? false;
  }

  /**
   * Check if stage is initial
   */
  public isInitialStage(stageId: string): boolean {
    const stage = this.getStage(stageId);
    return stage?.properties.isInitial ?? false;
  }

  /**
   * Get navigation configuration
   */
  public getNavigationConfig(): NavigationConfig {
    return this.getWorkflowConfig().navigation;
  }

  /**
   * Get validation rule definition
   */
  public getValidationRule(ruleName: string): ValidationRuleDefinition | undefined {
    return this.getWorkflowConfig().validationRules[ruleName];
  }

  /**
   * Get stage UI configuration
   */
  public getStageUI(stageId: string): StageUIConfig | undefined {
    return this.getUIConfig().stageUI[stageId];
  }

  /**
   * Reset configuration (for testing)
   */
  public reset(): void {
    console.log('🔄 [WorkflowConfigLoader] Resetting configuration');
    this.config = null;
    this.initialized = false;
  }
}

/**
 * Helper function to get the singleton instance
 */
export function getWorkflowConfig(): WorkflowConfigLoader {
  return WorkflowConfigLoader.getInstance();
}

export default WorkflowConfigLoader;

