/**
 * CaseService
 * Manages surgical case lifecycle, study enrollment, and primary reference tracking
 * Connects to SyncForge Case Management API
 */

import { PubSubService } from '@ohif/core';

const EVENTS = {
  CASE_CREATED: 'event::case_created',
  CASE_UPDATED: 'event::case_updated',
  CASE_DELETED: 'event::case_deleted',
  STUDY_ENROLLED: 'event::study_enrolled',
  STUDY_REMOVED: 'event::study_removed',
  PHASE_UPDATED: 'event::phase_updated',
  PRIMARY_REFERENCE_SET: 'event::primary_reference_set',
  ACTIVE_CASE_CHANGED: 'event::active_case_changed',
  CONNECTION_STATUS: 'event::case_connection_status',
};

// Clinical phase constants
export const CLINICAL_PHASES = {
  DIAGNOSTIC: 'Diagnostic',
  PRE_SURGICAL_OPTIMIZATION: 'PreSurgicalOptimization',
  PRE_OPERATIVE_PLANNING: 'PreOperativePlanning',
  PRE_OPERATIVE_CHECK: 'PreOperativeCheck',
  INTRA_OPERATIVE: 'IntraOperative',
  POST_OPERATIVE_IMMEDIATE: 'PostOperativeImmediate',
  POST_OPERATIVE_SHORT_TERM: 'PostOperativeShortTerm',
  POST_OPERATIVE_LONG_TERM: 'PostOperativeLongTerm',
  SURVEILLANCE: 'Surveillance',
  REVISION: 'Revision',
};

// Get display names for phases
export const CLINICAL_PHASE_LABELS = {
  Diagnostic: 'Diagnostic',
  PreSurgicalOptimization: 'Pre-Surgical Optimization',
  PreOperativePlanning: 'Pre-Operative Planning',
  PreOperativeCheck: 'Pre-Operative Check',
  IntraOperative: 'Intra-Operative',
  PostOperativeImmediate: 'Post-Operative (Immediate)',
  PostOperativeShortTerm: 'Post-Operative (Short-Term)',
  PostOperativeLongTerm: 'Post-Operative (Long-Term)',
  Surveillance: 'Surveillance',
  Revision: 'Revision',
};

interface PatientInfo {
  mrn: string;
  name?: string;
  dateOfBirth?: string;
}

interface PrimaryReference {
  studyInstanceUID: string;
  seriesInstanceUID: string;
  modality: string;
  description?: string;
}

interface Study {
  studyInstanceUID: string;
  clinicalPhase: string | null;
  studyDate: string | null;
  modalities: string[];
  description: string;
  enrolledAt: string;
}

interface RegistrationStatus {
  hasRegistration: boolean;
  lastRegistrationId: string | null;
  targetSeries: string | null;
}

interface Case {
  caseId: string;
  patientInfo: PatientInfo;
  primaryReference: PrimaryReference | null;
  studies: Study[];
  registrationStatus: RegistrationStatus;
  createdAt: string;
  updatedAt: string;
}

interface CaseSummary {
  caseId: string;
  patientInfo: PatientInfo;
  primaryReference: PrimaryReference | null;
  studyCount: number;
  createdAt: string;
  updatedAt: string;
}

class CaseService extends PubSubService {
  public static REGISTRATION = {
    name: 'caseService',
    create: ({ servicesManager }) => {
      return new CaseService(servicesManager);
    },
  };

  public static EVENTS = EVENTS;
  public static CLINICAL_PHASES = CLINICAL_PHASES;
  public static CLINICAL_PHASE_LABELS = CLINICAL_PHASE_LABELS;

  private servicesManager: any;
  private apiUrl: string = 'http://localhost:3001';
  private isConnected: boolean = false;
  private activeCaseId: string | null = null;
  private activeCase: Case | null = null;

  constructor(servicesManager, config: any = {}) {
    super(EVENTS);
    this.servicesManager = servicesManager;

    // Get global config for API URL determination
    const globalConfig = (window as any).config || {};
    const hostname = window.location.hostname;

    // Check if we're being served through a proxy (nginx)
    // If so, use same origin so API calls go through the proxy
    const isProxied = window.location.port === '8081' ||
                      window.location.port === '8080' ||
                      (window.location.port === '' && window.location.protocol === 'https:');

    // Default API URL logic
    let defaultApiUrl: string;
    if (isProxied) {
      // Use same origin when served through nginx (relative to current URL)
      defaultApiUrl = window.location.origin;
    } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Use localhost:3001 for direct development access
      defaultApiUrl = 'http://localhost:3001';
    } else {
      // Allow remote access from other machines on the LAN (wireless network)
      defaultApiUrl = `http://${hostname}:3001`;
    }

    // Check for syncforge config (automatically determined based on current location)
    const syncforgeApiUrl = globalConfig.syncforge?.apiUrl;

    // Check localStorage for saved API URL (for remote access via ngrok or manual override)
    const savedApiUrl = localStorage.getItem('syncforge_api_url');

    // Priority: config.apiUrl > syncforge config > saved localStorage > default
    this.apiUrl = config.apiUrl || syncforgeApiUrl || savedApiUrl || defaultApiUrl;

    // Load active case from localStorage
    this.activeCaseId = localStorage.getItem('syncforge_active_case_id');

    console.log('📁 CaseService initialized', {
      apiUrl: this.apiUrl,
      isProxied: isProxied,
      hostname: hostname,
      currentOrigin: window.location.origin,
      fromLocalStorage: !!savedApiUrl,
      remoteAccess: hostname !== 'localhost' && hostname !== '127.0.0.1',
      activeCaseId: this.activeCaseId,
    });

    this._checkConnection();

    // Load active case if set
    if (this.activeCaseId) {
      this.loadActiveCase();
    }
  }

  /**
   * Check API connection
   */
  private async _checkConnection(): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/api/health`);
      const data = await response.json();

      this.isConnected = data.status === 'ok';
      this._broadcastEvent(EVENTS.CONNECTION_STATUS, {
        connected: this.isConnected,
        apiUrl: this.apiUrl,
        caseManagement: data.caseManagement,
      });

      console.log('✅ Case Management API connected:', this.apiUrl);
    } catch (error) {
      this.isConnected = false;
      this._broadcastEvent(EVENTS.CONNECTION_STATUS, {
        connected: false,
        error: error.message,
      });
      console.warn('⚠️ Case Management API not available:', error.message);
    }
  }

  /**
   * Check if connected
   */
  public isApiConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Set API URL (for ngrok or remote access)
   */
  public setApiUrl(url: string): void {
    this.apiUrl = url.replace(/\/$/, '');
    this._checkConnection();
  }

  /**
   * Get active case ID
   */
  public getActiveCaseId(): string | null {
    return this.activeCaseId;
  }

  /**
   * Get active case data
   */
  public getActiveCase(): Case | null {
    return this.activeCase;
  }

  /**
   * Set active case ID and load case data
   */
  public async setActiveCaseId(caseId: string | null): Promise<void> {
    this.activeCaseId = caseId;

    if (caseId) {
      localStorage.setItem('syncforge_active_case_id', caseId);
      await this.loadActiveCase();
    } else {
      localStorage.removeItem('syncforge_active_case_id');
      this.activeCase = null;
    }

    this._broadcastEvent(EVENTS.ACTIVE_CASE_CHANGED, {
      caseId: this.activeCaseId,
      case: this.activeCase,
    });

    console.log('📁 Active case changed:', this.activeCaseId);
  }

  /**
   * Load active case data
   */
  private async loadActiveCase(): Promise<void> {
    if (!this.activeCaseId) {
      this.activeCase = null;
      return;
    }

    try {
      const caseData = await this.getCase(this.activeCaseId);
      this.activeCase = caseData;
      console.log('📁 Active case loaded:', this.activeCase.caseId);
    } catch (error) {
      console.error('❌ Failed to load active case:', error);
      this.activeCase = null;
    }
  }

  /**
   * Get all studies from Orthanc with case ID check
   */
  public async getAllOrthancStudies(): Promise<any[]> {
    try {
      const response = await fetch(`${this.apiUrl}/api/dicom/studies`);
      if (!response.ok) {
        throw new Error(`Failed to get Orthanc studies: ${response.statusText}`);
      }
      const data = await response.json();
      return data.studies || [];
    } catch (error) {
      console.error('❌ Failed to get Orthanc studies:', error);
      throw error;
    }
  }

  /**
   * Check if a study has an existing case ID
   * Uses the new /api/dicom/studies/:studyUID endpoint which includes case info
   */
  public async checkStudyCaseId(
    studyInstanceUID: string
  ): Promise<{ hasCaseId: boolean; caseId: string | null }> {
    try {
      const response = await fetch(`${this.apiUrl}/api/dicom/studies/${studyInstanceUID}`);
      if (!response.ok) {
        throw new Error(`Failed to check study case ID: ${response.statusText}`);
      }
      const data = await response.json();
      const caseInfo = data.study?.caseInfo;
      return {
        hasCaseId: caseInfo !== null && caseInfo !== undefined,
        caseId: caseInfo?.caseId || null,
      };
    } catch (error) {
      console.error('❌ Failed to check study case ID:', error);
      throw error;
    }
  }

  /**
   * List all cases
   */
  public async getCases(): Promise<CaseSummary[]> {
    console.log('📁 Fetching all cases');

    try {
      const response = await fetch(`${this.apiUrl}/api/cases`);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch cases');
      }

      console.log(`✅ Fetched ${data.count} cases`);
      return data.cases;
    } catch (error) {
      console.error('❌ Failed to fetch cases:', error);
      throw error;
    }
  }

  // List cases with search filters (uses /api/cases/search)
  public async searchCases(params: {
    patientName?: string;
    patientMRN?: string;
    status?: string;
    createdAfter?: string;
    createdBefore?: string;
    page?: number;
    limit?: number;
    includeStudies?: boolean;
  }): Promise<{ cases: CaseSummary[]; pagination: any }> {
    console.log('📁 Searching cases with params:', params);

    // 构建 query string，只带有有值的字段
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        qs.append(key, String(value));
      }
    });

    try {
      const queryString = qs.toString();
      const url = queryString
        ? `${this.apiUrl}/api/cases/search?${queryString}`
        : `${this.apiUrl}/api/cases/search`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        // 后端错误格式可能是 { error: { message, code, timestamp } } 或 { error: string }
        const errorMessage =
          typeof data.error === 'object' && data.error?.message
            ? data.error.message
            : data.error || 'Failed to search cases';
        throw new Error(errorMessage);
      }

      // 注意：后端 search 返回的是 { success, data: { cases, pagination, query } }
      // 添加防御性检查，确保 data.data 存在
      if (!data.data) {
        throw new Error('Invalid response format: missing data field');
      }

      const { cases, pagination } = data.data;

      // 确保 cases 是数组，如果不存在则使用空数组
      const safeCases = Array.isArray(cases) ? cases : [];
      const safePagination = pagination || {};

      console.log(`✅ Search returned ${safeCases.length} cases`, {
        url,
        params,
        responseData: data.data,
        cases: safeCases,
        pagination: safePagination,
      });

      if (safeCases.length === 0) {
        console.warn('⚠️ No cases returned from search. Check backend API and database.');
      }

      return { cases: safeCases, pagination: safePagination };
    } catch (error) {
      console.error('❌ Failed to search cases:', error);
      throw error;
    }
  }

  /**
   * Get all unique case IDs
   */
  public async getUniqueCaseIds(): Promise<
    { caseId: string; patientName: string; mrn: string; studyCount: number; createdAt: string }[]
  > {
    console.log('📁 Fetching unique case IDs');

    try {
      const response = await fetch(`${this.apiUrl}/api/cases/unique-ids`);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch unique case IDs');
      }

      console.log(`✅ Fetched ${data.count} unique case IDs`);
      return data.cases;
    } catch (error) {
      console.error('❌ Failed to fetch unique case IDs:', error);
      throw error;
    }
  }

  /**
   * Get studies for a specific case
   */
  public async getStudiesForCase(
    caseId: string
  ): Promise<{ caseId: string; patientInfo: PatientInfo; studies: Study[] }> {
    console.log(`📁 Fetching studies for case: ${caseId}`);

    try {
      const response = await fetch(`${this.apiUrl}/api/cases/${caseId}/studies`);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch studies for case');
      }

      console.log(`✅ Fetched ${data.count || 0} studies for case: ${caseId}`);

      // API returns { success, count, studies }
      // Transform to expected format
      return {
        caseId: caseId,
        patientInfo: null, // Not included in this endpoint
        studies: data.studies || []
      };
    } catch (error) {
      console.error(`❌ Failed to fetch studies for case ${caseId}:`, error);
      throw error;
    }
  }

  /**
   * Get single case details
   */
  public async getCase(caseId: string): Promise<Case> {
    console.log(`📁 Fetching case: ${caseId}`);

    try {
      const response = await fetch(`${this.apiUrl}/api/cases/${caseId}`);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch case');
      }

      console.log(`✅ Case fetched: ${caseId}`);
      return data.case;
    } catch (error) {
      console.error(`❌ Failed to fetch case ${caseId}:`, error);
      throw error;
    }
  }

  /**
   * Create new case (simplified - matches new API)
   *
   * @param patientInfo - Optional patient information (all fields optional)
   * @returns Promise<Case> - Created case with auto-generated ID
   *
   * Case ID is automatically generated by API using MAC address + timestamp
   * All patient info fields are optional
   */
  public async createCase(patientInfo?: Partial<PatientInfo>): Promise<Case> {
    console.log('📁 Creating new case with auto-generated ID');

    try {
      const response = await fetch(`${this.apiUrl}/api/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientInfo: patientInfo || {},
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create case');
      }

      this._broadcastEvent(EVENTS.CASE_CREATED, data.case);

      console.log(`✅ Case created: ${data.caseId} (auto-generated)`);
      return data.case;
    } catch (error) {
      console.error('❌ Failed to create case:', error);
      throw error;
    }
  }

  /**
   * Update case
   */
  public async updateCase(
    caseId: string,
    updates: { patientInfo?: Partial<PatientInfo> }
  ): Promise<Case> {
    console.log(`📁 Updating case: ${caseId}`);

    try {
      const response = await fetch(`${this.apiUrl}/api/cases/${caseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update case');
      }

      this._broadcastEvent(EVENTS.CASE_UPDATED, data.case);

      // Reload active case if this is it
      if (this.activeCaseId === caseId) {
        this.activeCase = data.case;
      }

      console.log(`✅ Case updated: ${caseId}`);
      return data.case;
    } catch (error) {
      console.error(`❌ Failed to update case ${caseId}:`, error);
      throw error;
    }
  }

  /**
   * Delete case
   */
  public async deleteCase(caseId: string): Promise<void> {
    console.log(`📁 Deleting case: ${caseId}`);

    try {
      const response = await fetch(`${this.apiUrl}/api/cases/${caseId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete case');
      }

      this._broadcastEvent(EVENTS.CASE_DELETED, { caseId });

      // Clear active case if this is it
      if (this.activeCaseId === caseId) {
        await this.setActiveCaseId(null);
      }

      console.log(`✅ Case deleted: ${caseId}`);
    } catch (error) {
      console.error(`❌ Failed to delete case ${caseId}:`, error);
      throw error;
    }
  }

  /**
   * Enroll study in case
   */
  public async enrollStudy(
    caseId: string,
    studyInstanceUID: string,
    clinicalPhase?: string,
    metadata?: {
      studyDate?: string;
      modalities?: string[];
      description?: string;
    }
  ): Promise<Study> {
    console.log(`📁 Enrolling study ${studyInstanceUID} in case ${caseId}`);

    try {
      // Convert modalities array to single string for API
      const modality = metadata?.modalities && metadata.modalities.length > 0
        ? metadata.modalities[0]
        : '';

      const response = await fetch(`${this.apiUrl}/api/cases/${caseId}/studies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studyInstanceUID,
          clinicalPhase,
          studyDate: metadata?.studyDate || '',
          modality: modality,
          studyDescription: metadata?.description || '',
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to enroll study');
      }

      this._broadcastEvent(EVENTS.STUDY_ENROLLED, {
        caseId,
        study: data.study,
      });

      // Reload active case if this is it
      if (this.activeCaseId === caseId) {
        await this.loadActiveCase();
      }

      console.log(`✅ Study enrolled: ${studyInstanceUID}`);
      return data.study;
    } catch (error) {
      console.error('❌ Failed to enroll study:', error);
      throw error;
    }
  }

  /**
   * Remove study from case
   */
  public async removeStudy(caseId: string, studyInstanceUID: string): Promise<void> {
    console.log(`📁 Removing study ${studyInstanceUID} from case ${caseId}`);

    try {
      const response = await fetch(
        `${this.apiUrl}/api/cases/${caseId}/studies/${studyInstanceUID}`,
        {
          method: 'DELETE',
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to remove study');
      }

      this._broadcastEvent(EVENTS.STUDY_REMOVED, {
        caseId,
        studyInstanceUID,
      });

      // Reload active case if this is it
      if (this.activeCaseId === caseId) {
        await this.loadActiveCase();
      }

      console.log(`✅ Study removed: ${studyInstanceUID}`);
    } catch (error) {
      console.error('❌ Failed to remove study:', error);
      throw error;
    }
  }

  /**
   * Update study clinical phase
   */
  public async updateStudyPhase(
    caseId: string,
    studyInstanceUID: string,
    clinicalPhase: string
  ): Promise<Study> {
    console.log(`📁 Updating study phase: ${studyInstanceUID} -> ${clinicalPhase}`);

    try {
      const response = await fetch(
        `${this.apiUrl}/api/cases/${caseId}/studies/${studyInstanceUID}/phase`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clinicalPhase,
          }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update study phase');
      }

      this._broadcastEvent(EVENTS.PHASE_UPDATED, {
        caseId,
        study: data.study,
      });

      // Reload active case if this is it
      if (this.activeCaseId === caseId) {
        await this.loadActiveCase();
      }

      console.log(`✅ Study phase updated: ${studyInstanceUID}`);
      return data.study;
    } catch (error) {
      console.error('❌ Failed to update study phase:', error);
      throw error;
    }
  }

  /**
   * Set primary reference (fixed image)
   */
  public async setPrimaryReference(
    caseId: string,
    studyInstanceUID: string,
    seriesInstanceUID: string,
    modality?: string,
    description?: string
  ): Promise<PrimaryReference> {
    console.log(`📁 Setting primary reference: ${seriesInstanceUID}`);

    try {
      const response = await fetch(`${this.apiUrl}/api/cases/${caseId}/primary-reference`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studyInstanceUID,
          seriesInstanceUID,
          modality,
          description,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to set primary reference');
      }

      this._broadcastEvent(EVENTS.PRIMARY_REFERENCE_SET, {
        caseId,
        primaryReference: data.primaryReference,
      });

      // Reload active case if this is it
      if (this.activeCaseId === caseId) {
        await this.loadActiveCase();
      }

      console.log(`✅ Primary reference set: ${seriesInstanceUID}`);
      return data.primaryReference;
    } catch (error) {
      console.error('❌ Failed to set primary reference:', error);
      throw error;
    }
  }

  /**
   * Get studies for active case
   */
  public getActiveCaseStudyUIDs(): string[] {
    if (!this.activeCase) {
      return [];
    }

    return this.activeCase.studies.map(s => s.studyInstanceUID);
  }

  /**
   * Check if study is in active case
   */
  public isStudyInActiveCase(studyInstanceUID: string): boolean {
    if (!this.activeCase) {
      return false;
    }

    return this.activeCase.studies.some(s => s.studyInstanceUID === studyInstanceUID);
  }

  /**
   * Get study info from active case
   */
  public getStudyInfo(studyInstanceUID: string): Study | null {
    if (!this.activeCase) {
      return null;
    }

    return this.activeCase.studies.find(s => s.studyInstanceUID === studyInstanceUID) || null;
  }

  /**
   * Broadcast event to subscribers
   */
  private _broadcastEvent(eventName: string, data: any): void {
    this.broadcastEvent(eventName, data);
  }

  // ============================================================================
  // SERIES MANAGEMENT
  // ============================================================================

  /**
   * Get all series for a study with enrollment status
   */
  public async getSeriesForStudy(caseId: string, studyInstanceUID: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.apiUrl}/api/cases/${caseId}/studies/${studyInstanceUID}/series`
      );

      if (!response.ok) {
        throw new Error(`Failed to get series: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Failed to get series for study:', error);
      throw error;
    }
  }

  /**
   * Toggle series enrollment
   */
  public async toggleSeriesEnrollment(
    caseId: string,
    studyInstanceUID: string,
    seriesInstanceUID: string,
    isEnrolled: boolean
  ): Promise<any> {
    try {
      const response = await fetch(
        `${this.apiUrl}/api/cases/${caseId}/studies/${studyInstanceUID}/series/${seriesInstanceUID}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ isEnrolled }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to toggle series enrollment: ${response.statusText}`);
      }

      const data = await response.json();

      // Reload active case if this is it
      if (this.activeCaseId === caseId) {
        await this.loadActiveCase();
      }

      console.log(`✅ Series ${isEnrolled ? 'enrolled' : 'unenrolled'}: ${seriesInstanceUID}`);
      return data;
    } catch (error) {
      console.error('❌ Failed to toggle series enrollment:', error);
      throw error;
    }
  }

  /**
   * Bulk update series enrollment
   */
  public async bulkUpdateSeries(
    caseId: string,
    studyInstanceUID: string,
    updates: Array<{ seriesInstanceUID: string; isEnrolled: boolean }>
  ): Promise<any> {
    try {
      const response = await fetch(
        `${this.apiUrl}/api/cases/${caseId}/studies/${studyInstanceUID}/series`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ updates }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to bulk update series: ${response.statusText}`);
      }

      const data = await response.json();

      // Reload active case if this is it
      if (this.activeCaseId === caseId) {
        await this.loadActiveCase();
      }

      console.log(`✅ Bulk updated ${updates.length} series`);
      return data;
    } catch (error) {
      console.error('❌ Failed to bulk update series:', error);
      throw error;
    }
  }
}

export default CaseService;
export { EVENTS as CaseServiceEvents };
export type { Case, CaseSummary, Study, PatientInfo, PrimaryReference, RegistrationStatus };
