/**
 * Type definitions for the Surgical Workflow Management System
 * Defines the structure of workflow state, stages, and validation
 */





/**
 * WorkflowStage - Dynamic type loaded from configuration
 * Default stages: 'overview' | 'segmentation' | 'planning' | 'navigation' | 'review'
 */
export type WorkflowStage = string;

export type WorkflowStageStatus = 'pending' | 'active' | 'completed' | 'error';

export interface WorkflowValidation {
  canAdvance: boolean;
  reason?: string;
  isFinalStage?: boolean;  // Explicitly marks if this is the final stage
}

export interface WorkflowStageData {
  completed: boolean;
  timestamp?: number;
  data?: any;
}

export interface BeginningStageData extends WorkflowStageData {
  patient?: {
    id: string;
    name: string;
  };
  study?: {
    studyInstanceUID: string;
    studyDescription?: string;
  };
  series?: {
    seriesInstanceUID: string;
  };
}




// Simplified: Backend handles all the data, workflow state stores only reference IDs
// When we need to restore data, call backend API with seriesInstanceUID or sessionId

export interface SegmentationStageData extends WorkflowStageData {
  seriesInstanceUID?: string;  // Reference to segmentation series
  sessionId?: string;           // Backend session ID for this segmentation
  segmentationCount?: number;   // Optional: for display purposes only
}

export interface PlanningStageData extends WorkflowStageData {
  sessionId?: string;  // Backend session ID for this planning session
  planId?: string;     // Reference to saved plan in backend
  screwCount?: number; // Optional: for display purposes only
}

export interface NavigationStageData extends WorkflowStageData {
  sessionId?: string;      // Backend session ID for navigation
  trackingData?: string;   // Reference to tracking data in backend
  calibration?: string;    // Reference to calibration data
  instruments?: string[];  // List of instrument IDs
}

export interface ReviewStageData extends WorkflowStageData {
  reviewed: boolean;
  reviewer?: string;
  comments?: string[];
}

export interface WorkflowState {
  currentStage: WorkflowStage;
  stages: {
    [key: string]: WorkflowStageData;  // Configuration-driven stages - dynamic keys
  };
  validation: {
    [key: string]: WorkflowValidation;  // Configuration-driven validation
  };
  metadata: {
    caseId?: string;
    sessionId?: string;
    surgeon?: string;
    createdAt: number;
    lastModified: number;
  };
}

export interface WorkflowNavigationOptions {
  validate?: boolean;
  saveCurrentStage?: boolean;
  preserveQueryParams?: boolean;
}

export interface WorkflowServiceEvents {
  STAGE_CHANGED: 'workflow:stage_changed';
  DATA_UPDATED: 'workflow:data_updated';
  VALIDATION_CHANGED: 'workflow:validation_changed';
  WORKFLOW_RESET: 'workflow:reset';
}

export interface WorkflowEventData {
  stage?: WorkflowStage;
  previousStage?: WorkflowStage;
  stageData?: Partial<WorkflowStageData>;
  validation?: WorkflowValidation;
}

export const WORKFLOW_EVENTS: WorkflowServiceEvents = {
  STAGE_CHANGED: 'workflow:stage_changed',
  DATA_UPDATED: 'workflow:data_updated',
  VALIDATION_CHANGED: 'workflow:validation_changed',
  WORKFLOW_RESET: 'workflow:reset',
};

/**
 * CONFIGURATION-DRIVEN EXPORTS
 * These exports dynamically load from workflow-config.yaml (single source of truth)
 * They are getter functions that always return the current configuration
 * 
 * IMPORTANT: Do NOT hardcode stage names, labels, or routes here!
 * All workflow configuration comes from workflow-config.yaml
 */

import { getWorkflowConfig } from '../config/WorkflowConfigLoader';

/**
 * Get stage order from configuration
 * @returns Array of stage IDs in order
 */
export function getStageOrder(): WorkflowStage[] {
  try {
    return getWorkflowConfig().getStageOrder();
  } catch (error) {
    console.error('❌ [workflow.types] Failed to get stage order:', error);
    // Return empty array if config not loaded yet
    return [];
  }
}

/**
 * Get stage labels from configuration
 * @returns Map of stage ID to display name
 */
export function getStageLabels(): Record<string, string> {
  try {
    return getWorkflowConfig().getStageLabels();
  } catch (error) {
    console.error('❌ [workflow.types] Failed to get stage labels:', error);
    return {};
  }
}

/**
 * Get stage routes from configuration
 * @returns Map of stage ID to route path
 */
export function getStageRoutes(): Record<string, string> {
  try {
    return getWorkflowConfig().getStageRoutes();
  } catch (error) {
    console.error('❌ [workflow.types] Failed to get stage routes:', error);
    return {};
  }
}

/**
 * BACKWARD COMPATIBILITY: Legacy constants
 * These are kept for backward compatibility only
 * They are computed from the configuration at runtime
 * 
 * @deprecated Use getter functions instead:
 * - getStageOrder() instead of STAGE_ORDER
 * - getStageLabels() instead of STAGE_LABELS
 * - getStageRoutes() instead of STAGE_ROUTES
 */

// Cache for lazy initialization
let _cachedOrder: WorkflowStage[] | null = null;
let _cachedLabels: Record<string, string> | null = null;
let _cachedRoutes: Record<string, string> | null = null;

// Lazy getter with cache
function getCachedOrder(): WorkflowStage[] {
  if (!_cachedOrder) {
    _cachedOrder = getStageOrder();
  }
  return _cachedOrder;
}

function getCachedLabels(): Record<string, string> {
  if (!_cachedLabels) {
    _cachedLabels = getStageLabels();
  }
  return _cachedLabels;
}

function getCachedRoutes(): Record<string, string> {
  if (!_cachedRoutes) {
    _cachedRoutes = getStageRoutes();
  }
  return _cachedRoutes;
}

// Reset cache when config changes
export function resetWorkflowTypeCache(): void {
  _cachedOrder = null;
  _cachedLabels = null;
  _cachedRoutes = null;
}

export const STAGE_ORDER: WorkflowStage[] = new Proxy([] as WorkflowStage[], {
  get(target, prop) {
    // Handle React Refresh type checking props
    if (prop === '$$typeof' || prop === 'constructor' || prop === 'prototype') {
      return undefined;
    }
    // Dynamically return values from config
    try {
      const order = getCachedOrder();
      return order[prop as any];
    } catch (error) {
      console.warn('[STAGE_ORDER] Config not ready, returning undefined for', prop);
      return undefined;
    }
  },
  ownKeys() {
    try {
      const order = getCachedOrder();
      return Reflect.ownKeys(order);
    } catch (error) {
      return [];
    }
  },
  getOwnPropertyDescriptor(target, prop) {
    try {
      const order = getCachedOrder();
      return Object.getOwnPropertyDescriptor(order, prop);
    } catch (error) {
      return undefined;
    }
  },
  has(target, prop) {
    try {
      const order = getCachedOrder();
      return prop in order;
    } catch (error) {
      return false;
    }
  },
});

export const STAGE_LABELS: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(target, prop) {
    // Handle React Refresh type checking props
    if (prop === '$$typeof' || prop === 'constructor' || prop === 'prototype') {
      return undefined;
    }
    try {
      const labels = getCachedLabels();
      return labels[prop as string];
    } catch (error) {
      console.warn('[STAGE_LABELS] Config not ready, returning undefined for', prop);
      return undefined;
    }
  },
  ownKeys() {
    try {
      const labels = getCachedLabels();
      return Reflect.ownKeys(labels);
    } catch (error) {
      return [];
    }
  },
  getOwnPropertyDescriptor(target, prop) {
    try {
      const labels = getCachedLabels();
      return Object.getOwnPropertyDescriptor(labels, prop);
    } catch (error) {
      return undefined;
    }
  },
  has(target, prop) {
    try {
      const labels = getCachedLabels();
      return prop in labels;
    } catch (error) {
      return false;
    }
  },
});

export const STAGE_ROUTES: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(target, prop) {
    // Handle React Refresh type checking props
    if (prop === '$$typeof' || prop === 'constructor' || prop === 'prototype') {
      return undefined;
    }
    try {
      const routes = getCachedRoutes();
      return routes[prop as string];
    } catch (error) {
      console.warn('[STAGE_ROUTES] Config not ready, returning undefined for', prop);
      return undefined;
    }
  },
  ownKeys() {
    try {
      const routes = getCachedRoutes();
      return Reflect.ownKeys(routes);
    } catch (error) {
      return [];
    }
  },
  getOwnPropertyDescriptor(target, prop) {
    try {
      const routes = getCachedRoutes();
      return Object.getOwnPropertyDescriptor(routes, prop);
    } catch (error) {
      return undefined;
    }
  },
  has(target, prop) {
    try {
      const routes = getCachedRoutes();
      return prop in routes;
    } catch (error) {
      return false;
    }
  },
});

