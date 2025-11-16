/**
 * RegistrationService
 * Connects to SyncForge Registration API for patient-to-image registration
 * Supports point-based, phantom, and future registration methods
 */

import { PubSubService } from '@ohif/core';

const EVENTS = {
  SESSION_STARTED: 'event::registration_session_started',
  TEMPLATE_LOADED: 'event::registration_template_loaded',
  POINT_CAPTURED: 'event::registration_point_captured',
  QUALITY_UPDATED: 'event::registration_quality_updated',
  REGISTRATION_COMPUTED: 'event::registration_computed',
  CONNECTION_STATUS: 'event::registration_connection_status',
};

interface Fiducial {
  point_id: string;
  label: string;
  dicom_position_mm: number[];
  tracker_position_mm?: number[];
  quality_score?: number;
  status?: string;
  source?: string;
}

interface RegistrationSession {
  registration_id: string;
  case_id: string;
  method: string;
  status: string;
  points_collected: number;
  points_required: number;
  fiducials: Fiducial[];
}

interface QualityMetrics {
  fre_mm: number;
  fre_std_mm: number;
  tre_estimated_mm: number;
  max_residual_mm: number;
  min_residual_mm: number;
  quality: string;
  points_used: number;
}

class RegistrationService extends PubSubService {
  public static REGISTRATION = {
    name: 'registrationService',
    create: ({ servicesManager }) => {
      return new RegistrationService(servicesManager);
    },
  };

  public static EVENTS = EVENTS;

  private servicesManager: any;
  private apiUrl: string = 'http://localhost:3001';
  private currentSession: RegistrationSession | null = null;
  private isConnected: boolean = false;

  constructor(servicesManager, config: any = {}) {
    super(EVENTS);
    this.servicesManager = servicesManager;

    // Get global config for API URL determination
    const globalConfig = (window as any).config || {};

    // Default to localhost for local development (most common case)
    const defaultApiUrl = 'http://localhost:3001';

    // Check for syncforge config (automatically determined based on current location)
    const syncforgeApiUrl = globalConfig.syncforge?.apiUrl;

    // Check localStorage for saved API URL (for remote access via ngrok)
    const savedApiUrl = localStorage.getItem('syncforge_api_url');

    // Priority: config.apiUrl > syncforge config > saved localStorage > default
    this.apiUrl = config.apiUrl || syncforgeApiUrl || savedApiUrl || defaultApiUrl;
    console.log('📋 RegistrationService initialized', {
      apiUrl: this.apiUrl,
      fromLocalStorage: !!savedApiUrl,
    });

    this._checkConnection();
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
      });

      console.log('✅ Registration API connected:', this.apiUrl);
    } catch (error) {
      this.isConnected = false;
      this._broadcastEvent(EVENTS.CONNECTION_STATUS, {
        connected: false,
        error: error.message,
      });
      console.warn('⚠️ Registration API not available:', error.message);
    }
  }

  /**
   * Get current session
   */
  public getSession(): RegistrationSession | null {
    return this.currentSession;
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
   * Start registration session
   */
  public async startSession(
    caseId: string,
    options: {
      method?: string;
      load_premarked?: boolean;
      expected_points?: number;
      series_instance_uid?: string;
      modality?: string;
    } = {}
  ): Promise<RegistrationSession> {
    console.log(`📋 Starting registration session for case: ${caseId}`);

    const {
      method = 'manual_point_based',
      load_premarked = false,
      expected_points = 6,
      series_instance_uid = '',
      modality = 'CT',
    } = options;

    try {
      const response = await fetch(`${this.apiUrl}/api/registration/${caseId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          load_premarked,
          expected_points,
          series_instance_uid,
          modality,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to start registration session');
      }

      this.currentSession = {
        registration_id: data.registration_id,
        case_id: caseId,
        method: data.method,
        status: data.status,
        points_collected: data.points_collected,
        points_required: data.points_required,
        fiducials: data.fiducials || [],
      };

      this._broadcastEvent(EVENTS.SESSION_STARTED, this.currentSession);

      console.log('✅ Registration session started:', this.currentSession.registration_id);
      return this.currentSession;
    } catch (error) {
      console.error('❌ Failed to start registration session:', error);
      throw error;
    }
  }

  /**
   * Save fiducial template
   */
  public async saveTemplate(
    caseId: string,
    fiducials: Fiducial[],
    metadata: {
      series_instance_uid: string;
      frame_of_reference_uid: string;
      modality?: string;
      created_by?: string;
    }
  ): Promise<{ success: boolean; message: string; count: number }> {
    console.log(`📋 Saving template for case: ${caseId}`, fiducials.length, 'fiducials');

    try {
      const response = await fetch(`${this.apiUrl}/api/registration/${caseId}/fiducials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fiducials,
          ...metadata,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to save template');
      }

      console.log('✅ Template saved:', data.fiducials_saved, 'fiducials');
      return data;
    } catch (error) {
      console.error('❌ Failed to save template:', error);
      throw error;
    }
  }

  /**
   * Load fiducial template
   */
  public async loadTemplate(caseId: string): Promise<{
    success: boolean;
    template_id: string;
    status: string;
    count: number;
    fiducials: Fiducial[];
  }> {
    console.log(`📋 Loading template for case: ${caseId}`);

    try {
      const response = await fetch(`${this.apiUrl}/api/registration/${caseId}/fiducials`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Template not found');
      }

      this._broadcastEvent(EVENTS.TEMPLATE_LOADED, {
        template_id: data.template_id,
        count: data.count,
        fiducials: data.fiducials,
      });

      console.log('✅ Template loaded:', data.count, 'fiducials');
      return data;
    } catch (error) {
      console.error('❌ Failed to load template:', error);
      throw error;
    }
  }

  /**
   * Add tracker position to existing fiducial
   */
  public async captureTrackerPosition(
    caseId: string,
    pointId: string,
    sessionId: string,
    options: {
      auto_capture?: boolean;
      num_samples?: number;
      tracker_position_mm?: number[];
    } = {}
  ): Promise<{
    success: boolean;
    point_id: string;
    label: string;
    dicom_position_mm: number[];
    tracker_position_mm: number[];
    quality_score: number;
    stability_mm: number;
    can_compute: boolean;
  }> {
    const { auto_capture = true, num_samples = 50, tracker_position_mm } = options;

    console.log(`📍 Capturing tracker position for ${pointId}`);

    try {
      const response = await fetch(
        `${this.apiUrl}/api/registration/${caseId}/fiducials/${pointId}/tracker`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            auto_capture,
            num_samples,
            tracker_position_mm,
          }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to capture tracker position');
      }

      this._broadcastEvent(EVENTS.POINT_CAPTURED, data);

      console.log(`✅ Point captured: ${data.point_id}, quality: ${data.quality_score.toFixed(2)}`);
      return data;
    } catch (error) {
      console.error('❌ Failed to capture tracker position:', error);
      throw error;
    }
  }

  /**
   * Add new fiducial during OR (intraop)
   */
  public async addIntraopFiducial(
    caseId: string,
    sessionId: string,
    fiducial: {
      point_id?: string;
      label: string;
      dicom_position_mm: number[];
      reason?: string;
      capture_tracker_now?: boolean;
      num_samples?: number;
    }
  ): Promise<{
    success: boolean;
    point_id: string;
    label: string;
    modification_id: string;
    total_points: number;
  }> {
    console.log(`➕ Adding intraop fiducial: ${fiducial.label}`);

    try {
      const response = await fetch(
        `${this.apiUrl}/api/registration/${caseId}/fiducials/add-intraop`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            ...fiducial,
          }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to add intraop fiducial');
      }

      console.log(`✅ Intraop fiducial added: ${data.point_id}`);
      return data;
    } catch (error) {
      console.error('❌ Failed to add intraop fiducial:', error);
      throw error;
    }
  }

  /**
   * Remove fiducial
   */
  public async removeFiducial(
    caseId: string,
    pointId: string,
    sessionId: string,
    reason: string = ''
  ): Promise<{
    success: boolean;
    point_id: string;
    remaining_points: number;
    can_still_compute: boolean;
    warning: string | null;
  }> {
    console.log(`➖ Removing fiducial: ${pointId}`);

    try {
      const response = await fetch(
        `${this.apiUrl}/api/registration/${caseId}/fiducials/${pointId}/remove`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            reason,
          }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to remove fiducial');
      }

      console.log(`✅ Fiducial removed: ${data.point_id}, ${data.remaining_points} remaining`);
      return data;
    } catch (error) {
      console.error('❌ Failed to remove fiducial:', error);
      throw error;
    }
  }

  /**
   * Preview registration quality before computing
   */
  public async previewQuality(
    caseId: string,
    sessionId: string
  ): Promise<{
    can_compute: boolean;
    points_captured: number;
    points_required_min: number;
    points_recommended_min: number;
    distribution: {
      centroid_mm: number[];
      bounding_box_volume_cm3: number;
      quality: string;
    };
    estimated_quality: {
      fre_mm: number;
      quality: string;
      confidence: number;
    };
    warnings: string[];
    recommendations: string[];
  }> {
    console.log('🔍 Previewing registration quality');

    try {
      const response = await fetch(
        `${this.apiUrl}/api/registration/${caseId}/preview?session_id=${sessionId}`
      );

      const data = await response.json();

      this._broadcastEvent(EVENTS.QUALITY_UPDATED, data);

      console.log(
        `✅ Quality preview: ${data.points_captured} points, estimated FRE: ${data.estimated_quality.fre_mm.toFixed(
          2
        )}mm`
      );
      return data;
    } catch (error) {
      console.error('❌ Failed to preview quality:', error);
      throw error;
    }
  }

  /**
   * Compute registration transformation
   */
  public async computeRegistration(
    caseId: string,
    sessionId: string,
    options: {
      method?: string;
      outlier_threshold_mm?: number;
      validate?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    registration_id: string;
    method: string;
    rMpr: number[][];
    quality_metrics: QualityMetrics;
    point_residuals: Array<{ point_id: string; label: string; error_mm: number }>;
    outliers_detected: number;
  }> {
    const { method = 'least_squares', outlier_threshold_mm = 3.0, validate = true } = options;

    console.log('🧮 Computing registration transformation');

    try {
      const response = await fetch(`${this.apiUrl}/api/registration/${caseId}/compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          method,
          outlier_threshold_mm,
          validate,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to compute registration');
      }

      this._broadcastEvent(EVENTS.REGISTRATION_COMPUTED, data);

      console.log(
        `✅ Registration computed: FRE=${data.quality_metrics.fre_mm.toFixed(2)}mm, quality=${
          data.quality_metrics.quality
        }`
      );
      return data;
    } catch (error) {
      console.error('❌ Failed to compute registration:', error);
      throw error;
    }
  }

  /**
   * Save registration to file
   */
  public async saveRegistration(
    caseId: string,
    sessionId: string,
    createBackup: boolean = true
  ): Promise<{ success: boolean; message: string }> {
    console.log('💾 Saving registration');

    try {
      const response = await fetch(`${this.apiUrl}/api/registration/${caseId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          create_backup: createBackup,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to save registration');
      }

      console.log('✅ Registration saved');
      return data;
    } catch (error) {
      console.error('❌ Failed to save registration:', error);
      throw error;
    }
  }

  /**
   * Broadcast event to subscribers
   */
  private _broadcastEvent(eventName: string, data: any): void {
    this._broadcastEvent(eventName, data);
  }
}

export default RegistrationService;
export { EVENTS as RegistrationServiceEvents };
