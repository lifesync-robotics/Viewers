/**
 * Planning Backend Service
 *
 * Centralized service for interacting with the Python planning server API
 * Handles all backend operations for:
 * - Session management
 * - Screw CRUD operations
 * - Model queries and retrieval
 * - Plan save/load operations
 *
 * Base URL: http://localhost:3001/api/planning
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface SessionStartRequest {
  studyInstanceUID: string;
  seriesInstanceUID: string;
  surgeon: string;
  caseId?: string; // Optional - can create sessions without cases
}

export interface SessionStartResponse {
  success: boolean;
  session_id?: string;
  error?: string;
}

export interface ScrewData {
  caseId: string;
  radius: number;
  length: number;
  screwLabel: string;
  screwVariantId: string;
  vertebralLevel?: string;
  side?: string;
  entryPoint: {
    x: number;
    y: number;
    z: number;
  };
  trajectory: {
    direction: number[];
    insertionDepth: number;
    convergenceAngle: number;
    cephaladAngle: number;
  };
  notes?: string;
  transformMatrix: number[];
  viewportStatesJson?: string;
  placedAt: string;
  autoLabel?: boolean;  // ✅ added autoLabel field
}

export interface AddScrewRequest {
  sessionId: string;
  screw: ScrewData;
}

export interface AddScrewResponse {
  success: boolean;
  screw_id?: string;
  error?: string;
}

export interface ScrewListResponse {
  success: boolean;
  screws?: any[];
  error?: string;
}

export interface DeleteScrewResponse {
  success: boolean;
  error?: string;
}

export interface ModelQueryRequest {
  radius: number;
  length: number;
}

export interface ModelQueryResponse {
  success: boolean;
  model?: {
    model_id: string;
    radius: number;
    length: number;
    source: 'generated' | 'catalog';
    file_path?: string;
  };
  error?: string;
}

export interface SavePlanRequest {
  sessionId: string;
  caseId: string;
  studyInstanceUID: string;
  seriesInstanceUID: string;
  planData: {
    name: string;
    description?: string;
    surgeon: string;
  };
}

export interface SavePlanResponse {
  success: boolean;
  plan_id?: string;
  error?: string;
}

export interface LoadPlanResponse {
  success: boolean;
  plan?: {
    plan_id: string;
    name: string;
    case_id: string;
    study_instance_uid: string;
    series_instance_uid: string;
    surgeon: string;
    screws: any[];
    rods?: any[];
    created_at: string;
  };
  error?: string;
}

export interface RestoreSessionResponse {
  success: boolean;
  session_id?: string;
  plan?: any;
  screws_count?: number;
  rods_count?: number;
  error?: string;
}

export interface ListPlansResponse {
  success: boolean;
  plans?: any[];
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// PLANNING BACKEND SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════

class PlanningBackendService {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    // If baseUrl is explicitly provided, use it
    if (baseUrl) {
      this.baseUrl = baseUrl;
      return;
    }

    // Otherwise, auto-detect API URL similar to CaseService
    const globalConfig = (typeof window !== 'undefined' && (window as any).config) || {};
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

    // Check if we're being served through a proxy (nginx)
    const isProxied = typeof window !== 'undefined' && (
      window.location.port === '8081' ||
      window.location.port === '8080' ||
      (window.location.port === '' && window.location.protocol === 'https:')
    );

    // Default API URL logic
    let defaultApiUrl: string;
    if (isProxied) {
      // Use same origin when served through nginx (relative to current URL)
      defaultApiUrl = `${window.location.origin}/api/planning`;
    } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Use localhost:3001 for direct development access
      defaultApiUrl = 'http://localhost:3001/api/planning';
    } else {
      // Allow remote access from other machines on the LAN
      defaultApiUrl = `http://${hostname}:3001/api/planning`;
    }

    // Check for syncforge config
    const syncforgeApiUrl = globalConfig.syncforge?.apiUrl;
    if (syncforgeApiUrl) {
      // Append /api/planning if not already present
      defaultApiUrl = syncforgeApiUrl.endsWith('/api/planning')
        ? syncforgeApiUrl
        : `${syncforgeApiUrl.replace(/\/$/, '')}/api/planning`;
    }

    // Check localStorage for saved API URL (for remote access via ngrok)
    const savedApiUrl = typeof window !== 'undefined'
      ? localStorage.getItem('syncforge_api_url')
      : null;
    if (savedApiUrl) {
      // Append /api/planning if not already present
      defaultApiUrl = savedApiUrl.endsWith('/api/planning')
        ? savedApiUrl
        : `${savedApiUrl.replace(/\/$/, '')}/api/planning`;
    }

    this.baseUrl = defaultApiUrl;

    if (typeof window !== 'undefined') {
      console.log('📋 PlanningBackendService initialized', {
        baseUrl: this.baseUrl,
        isProxied,
        fromLocalStorage: !!savedApiUrl,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Start a new planning session
   */
  async startSession(request: SessionStartRequest): Promise<SessionStartResponse> {
    try {
      console.log('🔄 [PlanningBackend] Starting session...');
      console.log(`   API: ${this.baseUrl}/session/start`);
      console.log(`   Case ID: ${request.caseId || 'none (session without case)'}`);

      const response = await fetch(`${this.baseUrl}/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📡 [PlanningBackend] Session API response:', data);

      if (data.success && data.session_id) {
        console.log('✅ [PlanningBackend] Session started:', data.session_id);
      }

      return data;
    } catch (error) {
      console.error('❌ [PlanningBackend] Error starting session:', error);
      return {
        success: false,
        error: error.message || 'Failed to start session',
      };
    }
  }

  /**
   * End a planning session
   */
  async endSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔄 [PlanningBackend] Ending session:', sessionId);

      const response = await fetch(`${this.baseUrl}/session/${sessionId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ [PlanningBackend] Session ended');
      }

      return data;
    } catch (error) {
      console.error('❌ [PlanningBackend] Error ending session:', error);
      return {
        success: false,
        error: error.message || 'Failed to end session',
      };
    }
  }

  /**
   * Get session summary (screws, rods, etc.)
   */
  async getSessionSummary(sessionId: string): Promise<{ success: boolean; summary?: any; error?: string }> {
    try {
      console.log('📊 [PlanningBackend] Getting session summary:', sessionId);

      const response = await fetch(`${this.baseUrl}/session/${sessionId}/summary`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log('✅ [PlanningBackend] Session summary retrieved');
        console.log('   Screws:', data.screws?.count || 0);
        console.log('   Rods:', data.rods?.count || 0);
      }

      return {
        success: true,
        summary: data,
      };
    } catch (error) {
      console.error('❌ [PlanningBackend] Error getting session summary:', error);
      return {
        success: false,
        error: error.message || 'Failed to get session summary',
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREW OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Add a screw to the current session
   */
  async addScrew(request: AddScrewRequest): Promise<AddScrewResponse> {
    try {
      console.log('💾 [PlanningBackend] Adding screw...');
      console.log(`   Session ID: ${request.sessionId}`);
      console.log(`   Screw: ${request.screw.screwLabel}`);

      const response = await fetch(`${this.baseUrl}/screws/add-with-transform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!response.ok) {
        // Try to extract error message from response body
        const errorMessage = data?.error || data?.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      if (data.success) {
        console.log(`✅ [PlanningBackend] Screw added: ${data.screw_id}`);
      }

      return data;
    } catch (error) {
      console.error('❌ [PlanningBackend] Error adding screw:', error);
      return {
        success: false,
        error: error.message || 'Failed to add screw',
      };
    }
  }

  /**
   * List all screws in a session
   */
  async listScrews(sessionId: string): Promise<ScrewListResponse> {
    try {
      console.log('📥 [PlanningBackend] Loading screws from API...');
      console.log(`   Session ID: ${sessionId}`);

      const response = await fetch(`${this.baseUrl}/screws/${sessionId}/list`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log(`✅ [PlanningBackend] Loaded ${data.screws?.length || 0} screws`);
      }

      return data;
    } catch (error) {
      console.error('❌ [PlanningBackend] Error loading screws:', error);
      return {
        success: false,
        error: error.message || 'Failed to load screws',
      };
    }
  }

  /**
   * Get a single screw by ID
   */
  async getScrew(
    screwId: string,
    sessionId: string
  ): Promise<{ success: boolean; screw?: any; error?: string }> {
    try {
      console.log('📥 [PlanningBackend] Getting screw:', screwId);

      const response = await fetch(`${this.baseUrl}/screws/${screwId}?sessionId=${sessionId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log(`✅ [PlanningBackend] Screw retrieved: ${screwId}`);
      }

      return data;
    } catch (error) {
      console.error('❌ [PlanningBackend] Error getting screw:', error);
      return {
        success: false,
        error: error.message || 'Failed to get screw',
      };
    }
  }

  /**
   * Update a screw
   */
  async updateScrew(
    screwId: string,
    sessionId: string,
    updates: Partial<ScrewData>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('✏️ [PlanningBackend] Updating screw:', screwId);
      console.log('   Session ID:', sessionId);
      console.log('   Updates:', updates);

      // sessionId goes as query parameter, updates go directly in body
      const response = await fetch(`${this.baseUrl}/screws/${screwId}?sessionId=${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log(`✅ [PlanningBackend] Screw updated: ${screwId}`);
      }

      return data;
    } catch (error) {
      console.error('❌ [PlanningBackend] Error updating screw:', error);
      return {
        success: false,
        error: error.message || 'Failed to update screw',
      };
    }
  }

  /**
   * Delete a screw
   */
  async deleteScrew(screwId: string, sessionId: string): Promise<DeleteScrewResponse> {
    try {
      console.log('🗑️ [PlanningBackend] Deleting screw:', screwId);
      console.log(`   Session ID: ${sessionId}`);

      const response = await fetch(`${this.baseUrl}/screws/${screwId}?sessionId=${sessionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log('✅ [PlanningBackend] Screw deleted');
      }

      return data;
    } catch (error) {
      console.error('❌ [PlanningBackend] Error deleting screw:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete screw',
      };
    }
  }

  /**
   * Delete all screws in a session
   */
  async deleteAllScrews(sessionId: string): Promise<{
    success: boolean;
    deleted_count?: number;
    failed_screw_ids?: string[];
    failed_reasons?: string[];
    error?: string;
  }> {
    try {
      console.log('🗑️ [PlanningBackend] Deleting all screws in session:', sessionId);

      // First, get all screws in the session
      const listResponse = await this.listScrews(sessionId);

      if (!listResponse.success || !listResponse.screws || listResponse.screws.length === 0) {
        console.log('✅ [PlanningBackend] No screws to delete');
        return {
          success: true,
          deleted_count: 0,
        };
      }

      // Extract screw IDs
      const screwIds = listResponse.screws.map(screw => screw.screw_id || screw.id).filter(Boolean);

      if (screwIds.length === 0) {
        console.log('✅ [PlanningBackend] No valid screw IDs found');
        return {
          success: true,
          deleted_count: 0,
        };
      }

      console.log(`   Deleting ${screwIds.length} screws...`);

      // Call batch delete endpoint
      const response = await fetch(`${this.baseUrl}/screws/delete-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sessionId,
          screwIds,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log(`✅ [PlanningBackend] Deleted ${data.deleted_count} screws`);
        if (data.failed_screw_ids && data.failed_screw_ids.length > 0) {
          console.warn(`⚠️ [PlanningBackend] Failed to delete ${data.failed_screw_ids.length} screws`);
        }
      }

      return data;
    } catch (error) {
      console.error('❌ [PlanningBackend] Error deleting all screws:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete all screws',
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODEL OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Query for a screw model by dimensions
   * @param radius - Screw radius in mm
   * @param length - Screw length in mm
   * @param forceProcedural - If true, force procedural generation instead of using asset library
   */
  async queryModel(radius: number, length: number, forceProcedural: boolean = false): Promise<ModelQueryResponse> {
    try {
      console.log(`🔍 [PlanningBackend] Querying model: R=${radius}mm, L=${length}mm${forceProcedural ? ' (FORCED PROCEDURAL)' : ''}`);

      const url = forceProcedural
        ? `${this.baseUrl}/models/query?radius=${radius}&length=${length}&force_procedural=true`
        : `${this.baseUrl}/models/query?radius=${radius}&length=${length}`;

      const response = await fetch(
        url,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.model) {
        console.log(`📦 [PlanningBackend] Model found: ${data.model.model_id} (${data.model.source})`);
      }

      return data;
    } catch (error) {
      console.error('❌ [PlanningBackend] Error querying model:', error);
      return {
        success: false,
        error: error.message || 'Failed to query model',
      };
    }
  }

  /**
   * Query a cap model
   * Cap model is a fixed file, doesn't have dimensions
   */
  async queryCapModel(): Promise<CapModelQueryResponse> {
    try {
      console.log(`🔍 [PlanningBackend] Querying cap model ...`);
      return {
        success: true,
        model: {
          model_id: 'cap',
          filename: '7300-T10_Top.obj',
          type: 'cap',
          description: 'Screw cap'
        }
      };

    } catch (error) {
      console.error('❌ [PlanningBackend] Error querying model:', error);
      return {
        success: false,
        error: error.message || 'Failed to query model',
      };
    }
  }

  /**
   * Get model OBJ file URL
   */
  getModelUrl(modelId: string): string {
    return `${this.baseUrl}/models/${modelId}/obj`;
  }

  /**
   * Get cap model OBJ file URL
   */
  getCapModelUrl(): string {
    return `${this.baseUrl}/models/cap/obj`;
  }

  /**
   * Get full URL for model file path
   */
  getModelFileUrl(filePath: string): string {
    // If it's already a full URL, return as-is
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }

    // Otherwise, construct URL from base
    const baseUrl = this.baseUrl.replace('/api/planning', '');
    return `${baseUrl}${filePath.startsWith('/') ? '' : '/'}${filePath}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAN OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Save current session as a plan
   */
  async savePlan(request: SavePlanRequest): Promise<SavePlanResponse> {
    try {
      console.log('💾 [PlanningBackend] Saving plan...');
      console.log(`   Session ID: ${request.sessionId}`);
      console.log(`   Plan name: ${request.planData.name}`);

      const response = await fetch(`${this.baseUrl}/plan/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log('✅ [PlanningBackend] Plan saved:', data.plan_id);
      }

      return data;
    } catch (error) {
      console.error('❌ [PlanningBackend] Error saving plan:', error);
      return {
        success: false,
        error: error.message || 'Failed to save plan',
      };
    }
  }

  /**
   * Load a saved plan
   */
  async loadPlan(planId: string): Promise<LoadPlanResponse> {
    try {
      console.log('📥 [PlanningBackend] Loading plan:', planId);

      const response = await fetch(`${this.baseUrl}/plan/${planId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.plan) {
        console.log('✅ [PlanningBackend] Plan loaded:', data.plan.name);
      }

      return data;
    } catch (error) {
      console.error('❌ [PlanningBackend] Error loading plan:', error);
      return {
        success: false,
        error: error.message || 'Failed to load plan',
      };
    }
  }

  /**
   * Restore a session from a saved plan
   */
  async restoreSessionFromPlan(planId: string): Promise<RestoreSessionResponse> {
    try {
      console.log('📥 [PlanningBackend] Restoring session from plan:', planId);

      const response = await fetch(`${this.baseUrl}/plan/${planId}/restore-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log('✅ [PlanningBackend] Session restored from plan');
        console.log(`   Session ID: ${data.session_id}`);
        console.log(`   Screws: ${data.screws_count}, Rods: ${data.rods_count}`);
      }

      return data;
    } catch (error) {
      console.error('❌ [PlanningBackend] Error restoring session from plan:', error);
      return {
        success: false,
        error: error.message || 'Failed to restore session from plan',
      };
    }
  }

  /**
   * List all plans (optionally filtered by case or series)
   */
  async listPlans(filters?: {
    caseId?: string;
    seriesInstanceUID?: string;
  }): Promise<ListPlansResponse> {
    try {
      console.log('📥 [PlanningBackend] Listing plans...');

      let url = `${this.baseUrl}/plan/list`;
      const params = new URLSearchParams();

      if (filters?.caseId) {
        params.append('caseId', filters.caseId);
      }
      if (filters?.seriesInstanceUID) {
        params.append('seriesInstanceUID', filters.seriesInstanceUID);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log(`✅ [PlanningBackend] Found ${data.plans?.length || 0} plans`);
      }

      return data;
    } catch (error) {
      console.error('❌ [PlanningBackend] Error listing plans:', error);
      return {
        success: false,
        error: error.message || 'Failed to list plans',
      };
    }
  }

  /**
   * Delete a saved plan
   */
  async deletePlan(planId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🗑️ [PlanningBackend] Deleting plan:', planId);

      const response = await fetch(`${this.baseUrl}/plan/${planId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log('✅ [PlanningBackend] Plan deleted');
      }

      return data;
    } catch (error) {
      console.error('❌ [PlanningBackend] Error deleting plan:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete plan',
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if the backend API is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        credentials: 'include',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      return response.ok;
    } catch (error) {
      console.warn('⚠️ [PlanningBackend] Backend not available:', error.message);
      return false;
    }
  }

  /**
   * Get backend status and version info
   */
  async getStatus(): Promise<{ success: boolean; version?: string; uptime?: number; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/status`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ [PlanningBackend] Error getting status:', error);
      return {
        success: false,
        error: error.message || 'Failed to get status',
      };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════

// Export a singleton instance
export const planningBackendService = new PlanningBackendService();

// Also export the class for custom instances
export default PlanningBackendService;
