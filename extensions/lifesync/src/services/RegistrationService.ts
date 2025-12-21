/**
 * RegistrationService
 *
 * Series-centric registration service for patient-to-image registration
 * Connects to SyncForge Registration API (series-centric architecture)
 */

import { PubSubService } from '@ohif/core';
import { getApiUrl } from '../utils/apiConfig';
import type {
  Fiducial,
  RegistrationSession,
  RegistrationResult,
} from '../components/Registration/types';

const EVENTS = {
  SESSION_STARTED: 'event::registration_session_started',
  TEMPLATE_LOADED: 'event::registration_template_loaded',
  POINT_CAPTURED: 'event::registration_point_captured',
  QUALITY_UPDATED: 'event::registration_quality_updated',
  REGISTRATION_COMPUTED: 'event::registration_computed',
  CONNECTION_STATUS: 'event::registration_connection_status',
};

interface StartRegistrationOptions {
  case_id?: string;
  method?: 'MANUAL_POINT_BASED' | 'PHANTOM_AUTO' | 'ICP_SURFACE';
  load_premarked?: boolean;
  expected_points?: number;
}

interface SaveFiducialsOptions {
  case_id?: string;
  created_by?: string;
  template_id?: string; // Optional template ID to update existing template
}

interface LoadFiducialsOptions {
  case_id?: string;
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
  private isConnected: boolean = false;

  constructor(servicesManager: any, config: any = {}) {
    super(EVENTS);
    this.servicesManager = servicesManager;
    console.log('📋 RegistrationService initialized (series-centric)');
    this._checkConnection();
  }

  /**
   * Check API connection
   */
  private async _checkConnection(): Promise<void> {
    try {
      const response = await fetch(getApiUrl('/api/health'));
      const data = await response.json();

      this.isConnected = data.status === 'ok';
      this._broadcastEvent(EVENTS.CONNECTION_STATUS, {
        connected: this.isConnected,
      });

      if (this.isConnected) {
        console.log('✅ Registration API connected');
      }
    } catch (error: any) {
      this.isConnected = false;
      this._broadcastEvent(EVENTS.CONNECTION_STATUS, {
        connected: false,
        error: error.message,
      });
      console.warn('⚠️ Registration API not available:', error.message);
    }
  }

  /**
   * Check if connected
   */
  public isApiConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Start registration session for a DICOM series
   */
  public async startRegistration(
    seriesInstanceUID: string,
    options: StartRegistrationOptions = {}
  ): Promise<RegistrationSession> {
    const {
      case_id = null,
      method = 'MANUAL_POINT_BASED',
      load_premarked = false,
      expected_points = 6,
    } = options;

    console.log(`📋 Starting registration session for series: ${seriesInstanceUID}`);

    try {
      const response = await fetch(
        getApiUrl(`/api/registration/series/${encodeURIComponent(seriesInstanceUID)}/start`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            case_id,
            method,
            load_premarked,
            expected_points,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || data.message || 'Failed to start registration session');
      }

      const session: RegistrationSession = {
        registration_id: data.registration_id,
        series_instance_uid: data.series_instance_uid || seriesInstanceUID,
        case_id: data.case_id || case_id || undefined,
        method: data.method || method,
        status: data.status || 'collecting_points',
        points_collected: data.points_collected || 0,
        points_with_tracker: data.points_with_tracker || 0,
        created_at: data.created_at
          ? new Date(data.created_at).getTime() / 1000
          : Date.now() / 1000,
        operator: 'OHIF User',
        using_template: load_premarked,
        template_id: data.template_id || undefined,
      };

      this._broadcastEvent(EVENTS.SESSION_STARTED, session);

      console.log('✅ Registration session started:', session.registration_id);
      return session;
    } catch (error: any) {
      console.error('❌ Failed to start registration session:', error);
      throw error;
    }
  }

  /**
   * Save pre-marked fiducials for a DICOM series
   */
  public async saveFiducials(
    seriesInstanceUID: string,
    fiducials: Fiducial[],
    options: SaveFiducialsOptions = {}
  ): Promise<{
    success: boolean;
    message: string;
    fiducials_saved: number;
    template_id: string;
  }> {
    const { case_id = null, created_by = 'OHIF User', template_id } = options;

    const action = template_id ? 'Updating' : 'Saving';
    console.log(
      `💾 ${action} ${fiducials.length} fiducials for series: ${seriesInstanceUID}${template_id ? ` (template: ${template_id})` : ''}`
    );

    try {
      // Convert fiducials to API format
      const apiFiducials = fiducials.map(fid => ({
        point_id: fid.point_id,
        label: fid.label,
        anatomical_landmark: fid.anatomical_landmark || '',
        dicom_position_mm: fid.dicom_position_mm,
        dicom_voxel_coords: fid.dicom_voxel_coords || [0, 0, 0],
        placed_by: fid.placed_by || created_by,
        placed_at: fid.placed_at || Date.now() / 1000,
        confidence: fid.confidence || 'high',
        notes: fid.notes || '',
      }));

      const response = await fetch(
        getApiUrl(`/api/registration/series/${encodeURIComponent(seriesInstanceUID)}/fiducials`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            case_id,
            fiducials: apiFiducials,
            created_by,
            template_id, // Pass template_id for updates
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || data.message || 'Failed to save fiducials');
      }

      console.log('✅ Fiducials saved:', data.fiducials_saved, 'points');
      return {
        success: true,
        message: data.message || 'Fiducials saved successfully',
        fiducials_saved: data.fiducials_saved || fiducials.length,
        template_id: data.template_id,
      };
    } catch (error: any) {
      console.error('❌ Failed to save fiducials:', error);
      throw error;
    }
  }

  /**
   * Load pre-marked fiducials for a DICOM series
   */
  public async loadFiducials(
    seriesInstanceUID: string,
    options: LoadFiducialsOptions = {}
  ): Promise<{
    success: boolean;
    template_id: string;
    status: string;
    count: number;
    fiducials: Fiducial[];
  }> {
    const { case_id = null } = options;

    console.log(`📥 Loading fiducials for series: ${seriesInstanceUID}`);

    try {
      let apiUrl = getApiUrl(
        `/api/registration/series/${encodeURIComponent(seriesInstanceUID)}/fiducials`
      );

      // 如果需要添加查询参数，手动拼接（避免使用 new URL() 处理相对路径的问题）
      if (case_id) {
        const separator = apiUrl.includes('?') ? '&' : '?';
        apiUrl = `${apiUrl}${separator}case_id=${encodeURIComponent(case_id)}`;
      }

      const response = await fetch(apiUrl);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('No fiducial template found for this series');
        }
        const errorText = await response.text();
        throw new Error(
          `API request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || data.message || 'Failed to load fiducials');
      }

      // Convert API response to Fiducial format
      const fiducials: Fiducial[] = (data.fiducials || []).map((fid: any) => ({
        point_id: fid.point_id,
        label: fid.label,
        anatomical_landmark: fid.anatomical_landmark,
        dicom_position_mm: fid.dicom_position_mm || [fid.dicom_x, fid.dicom_y, fid.dicom_z],
        dicom_voxel_coords:
          fid.dicom_voxel_coords ||
          (fid.voxel_i !== undefined ? [fid.voxel_i, fid.voxel_j, fid.voxel_k] : undefined),
        tracker_position_mm: fid.tracker_position_mm,
        quality_score: fid.quality_score,
        stability_mm: fid.stability_mm,
        status: fid.status || 'pending',
        source: fid.source || 'template',
        placed_by: fid.placed_by,
        placed_at: fid.placed_at,
        confidence: fid.confidence,
        notes: fid.notes,
      }));

      this._broadcastEvent(EVENTS.TEMPLATE_LOADED, {
        template_id: data.template_id,
        count: data.count || fiducials.length,
        fiducials,
      });

      console.log('✅ Fiducials loaded:', fiducials.length, 'points');
      return {
        success: true,
        template_id: data.template_id,
        status: data.status || 'approved',
        count: data.count || fiducials.length,
        fiducials,
      };
    } catch (error: any) {
      console.error('❌ Failed to load fiducials:', error);
      throw error;
    }
  }

  /**
   * Capture tracker position for a fiducial point
   * The point must already exist in the backend session (added during session start or from template)
   */
  public async captureTrackerPosition(
    seriesInstanceUID: string,
    pointId: string,
    registrationId: string,
    options: {
      auto_capture?: boolean;
      num_samples?: number;
      tracker_position_mm?: number[];
      dicom_position_mm?: number[]; // NEW: DICOM position for creating new point
      label?: string; // NEW: Point label
      source?: string; // NEW: Point source
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
    const {
      auto_capture = true,
      num_samples = 50,
      tracker_position_mm,
      dicom_position_mm, // NEW
      label, // NEW
      source, // NEW
    } = options;

    console.log(`📍 Capturing tracker position for ${pointId} (registration: ${registrationId})`);

    try {
      // Point should already exist in backend session
      const response = await fetch(
        getApiUrl(
          `/api/registration/series/${encodeURIComponent(seriesInstanceUID)}/fiducials/${pointId}/tracker`
        ),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registration_id: registrationId,
            auto_capture,
            num_samples,
            tracker_position_mm,
            dicom_position_mm, // NEW: Include DICOM position
            label, // NEW: Include label
            source, // NEW: Include source
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to capture tracker position');
      }

      this._broadcastEvent(EVENTS.POINT_CAPTURED, data);

      console.log(
        `✅ Point captured: ${data.point_id}, quality: ${data.quality_score?.toFixed(2)}, stability: ${data.stability_mm?.toFixed(2)}mm`
      );
      return {
        success: data.success,
        point_id: data.point_id || pointId,
        label: data.label || pointId,
        dicom_position_mm: data.dicom_position_mm || [
          data.dicom_x || 0,
          data.dicom_y || 0,
          data.dicom_z || 0,
        ],
        tracker_position_mm: data.tracker_position_mm || [
          data.tracker_x || 0,
          data.tracker_y || 0,
          data.tracker_z || 0,
        ],
        quality_score: data.quality_score || 0,
        stability_mm: data.stability_mm || 0,
        can_compute: data.can_compute || false,
      };
    } catch (error: any) {
      console.error('❌ Failed to capture tracker position:', error);
      throw error;
    }
  }

  /**
   * Add intraoperative fiducial to registration session
   */
  public async addIntraopFiducial(
    seriesInstanceUID: string,
    registrationId: string,
    fiducial: {
      point_id: string;
      label: string;
      dicom_position_mm: number[];
      reason?: string;
    },
    caseId?: string
  ): Promise<{
    success: boolean;
    point_id: string;
    label: string;
    total_points: number;
  }> {
    console.log(`➕ Adding intraop fiducial ${fiducial.point_id} to session ${registrationId}`);

    try {
      // Use case-centric endpoint (requires caseId)
      if (!caseId) {
        throw new Error('Case ID is required to add intraop fiducial');
      }

      const response = await fetch(getApiUrl(`/api/registration/${caseId}/fiducials/add-intraop`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_id: registrationId,
          point_id: fiducial.point_id,
          label: fiducial.label,
          dicom_position_mm: fiducial.dicom_position_mm,
          reason: fiducial.reason || 'Added during registration workflow',
          capture_tracker_now: false, // Don't capture now, will capture later
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to add intraop fiducial');
      }

      console.log(`✅ Added intraop fiducial: ${data.point_id}`);
      return {
        success: data.success,
        point_id: data.point_id || fiducial.point_id,
        label: data.label || fiducial.label,
        total_points: data.total_points || 0,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to add intraop fiducial';
      console.error('❌ Failed to add intraop fiducial:', errorMessage);
      throw error;
    }
  }

  /**
   * Add intraoperative fiducial asynchronously (non-blocking, for auto-save)
   * Returns a promise that resolves in the background without blocking UI
   */
  public addIntraopFiducialAsync(
    seriesInstanceUID: string,
    registrationId: string,
    fiducial: {
      point_id: string;
      label: string;
      dicom_position_mm: number[];
      reason?: string;
    },
    caseId?: string
  ): Promise<void> {
    // Fire and forget - don't wait for result, don't throw errors to caller
    return this.addIntraopFiducial(seriesInstanceUID, registrationId, fiducial, caseId)
      .then(() => {
        console.log(`✅ Auto-saved fiducial ${fiducial.point_id} to backend`);
      })
      .catch(error => {
        // Log error but don't throw - this is background save
        console.warn(`⚠️ Auto-save failed for fiducial ${fiducial.point_id}:`, error.message);
      });
  }

  /**
   * Update tracker position asynchronously (non-blocking, for auto-save)
   */
  public async updateTrackerPositionAsync(
    seriesInstanceUID: string,
    registrationId: string,
    pointId: string,
    trackerPosition: number[],
    caseId?: string,
    options?: {
      // NEW: Additional options
      dicom_position_mm?: number[];
      label?: string;
      source?: string;
    }
  ): Promise<void> {
    try {
      await this.captureTrackerPosition(seriesInstanceUID, pointId, registrationId, {
        auto_capture: false,
        tracker_position_mm: trackerPosition,
        dicom_position_mm: options?.dicom_position_mm, // NEW
        label: options?.label, // NEW
        source: options?.source, // NEW
      });
      console.log(`✅ Auto-saved tracker position for ${pointId}`);
    } catch (error: any) {
      // Log error but don't throw - this is background save
      console.warn(`⚠️ Auto-save tracker position failed for ${pointId}:`, error.message);
    }
  }

  /**
   * Get registration status for a DICOM series
   */
  public async getStatus(seriesInstanceUID: string): Promise<RegistrationSession | null> {
    console.log(`📊 Getting registration status for series: ${seriesInstanceUID}`);

    try {
      const response = await fetch(
        getApiUrl(`/api/registration/series/${encodeURIComponent(seriesInstanceUID)}/status`)
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null; // No active session
        }
        const errorText = await response.text();
        throw new Error(
          `API request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();

      if (!data.success || !data.session) {
        return null;
      }

      const session: RegistrationSession = {
        registration_id: data.session.registration_id,
        series_instance_uid: data.session.series_instance_uid || seriesInstanceUID,
        case_id: data.session.case_id || undefined,
        method: data.session.method,
        status: data.session.status,
        points_collected: data.session.points_collected || 0,
        points_with_tracker: data.session.points_with_tracker || 0,
        created_at: data.session.created_at
          ? new Date(data.session.created_at).getTime() / 1000
          : Date.now() / 1000,
        operator: data.session.operator || 'OHIF User',
        using_template: data.session.using_template || false,
        template_id: data.session.template_id || undefined,
      };

      return session;
    } catch (error: any) {
      console.error('❌ Failed to get registration status:', error);
      throw error;
    }
  }

  /**
   * 将16元素数组转换为4x4矩阵
   */
  private _flatToMatrix4x4(flat: number[]): number[][] {
    if (!flat || flat.length < 16) {
      return [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ];
    }
    return [
      [flat[0], flat[1], flat[2], flat[3]],
      [flat[4], flat[5], flat[6], flat[7]],
      [flat[8], flat[9], flat[10], flat[11]],
      [flat[12], flat[13], flat[14], flat[15]],
    ];
  }

  /**
   * 将 prMd (PR → DICOM) 应用到导航系统
   * 现在直接使用从数据库获取的 prMd，无需计算逆矩阵
   */
  public applyRegistrationToNavigation(
    prMd: number[] | number[][],
    servicesManager?: any
  ): boolean {
    try {
      if (!servicesManager) {
        console.warn('⚠️ ServicesManager not provided, cannot apply to navigation');
        return false;
      }

      const trackingService = servicesManager.services?.trackingService;
      if (!trackingService) {
        console.warn('⚠️ TrackingService not available, cannot apply to navigation');
        return false;
      }

      // 转换为4x4矩阵
      let prMdMatrix: number[][];
      if (Array.isArray(prMd[0])) {
        prMdMatrix = prMd as number[][];
      } else {
        prMdMatrix = this._flatToMatrix4x4(prMd as number[]);
      }

      // 直接设置到 TrackingService（无需求逆，已从数据库获取）
      trackingService.setPrToDicomMatrix(prMdMatrix);

      console.log('✅ Registration matrix applied to navigation system');
      return true;
    } catch (error: any) {
      console.error('❌ Failed to apply registration to navigation:', error);
      return false;
    }
  }

  /**
   * Compute registration transformation
   * 使用 series-centric API（推荐）
   * 计算完成后自动应用到导航系统
   */
  public async computeRegistration(
    seriesInstanceUID: string,
    registrationId: string,
    options: {
      method?: string;
      outlier_threshold_mm?: number;
      validate?: boolean;
      caseId?: string; // 可选，用于向后兼容
      autoApplyToNavigation?: boolean; // 是否自动应用到导航（默认true）
      servicesManager?: any; // 用于访问 TrackingService
      points?: Array<{
        // NEW: Points data from frontend
        point_id: string;
        label: string;
        dicom_position_mm: number[];
        tracker_position_mm?: number[];
        [key: string]: any;
      }>;
    } = {}
  ): Promise<RegistrationResult> {
    const {
      method = 'least_squares',
      outlier_threshold_mm = 3.0,
      validate = true,
      autoApplyToNavigation = true,
      servicesManager,
      points, // NEW: Points data
    } = options;

    console.log(`🧮 Computing registration transformation for series: ${seriesInstanceUID}`);

    try {
      // 使用新的 series-centric API
      const response = await fetch(
        getApiUrl(`/api/registration/series/${encodeURIComponent(seriesInstanceUID)}/compute`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registration_id: registrationId,
            method,
            outlier_threshold_mm,
            validate,
            points: points
              ?.map(p => ({
                point_id: p.point_id,
                label: p.label,
                dicom_position_mm: p.dicom_position_mm,
                tracker_position_mm: p.tracker_position_mm || [0, 0, 0],
              }))
              .filter(
                p =>
                  // Only include points with tracker positions
                  p.tracker_position_mm &&
                  (p.tracker_position_mm[0] !== 0 ||
                    p.tracker_position_mm[1] !== 0 ||
                    p.tracker_position_mm[2] !== 0)
              ),
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to compute registration');
      }

      // 获取 dMpr 矩阵（优先使用 dMpr，如果没有则使用 rMpr，因为注释说 rMpr 实际上是 dMpr）
      const dMprMatrix = data.dMpr || data.rMpr;
      if (!dMprMatrix) {
        throw new Error('Registration result missing transformation matrix');
      }

      // 转换为16元素数组（用于返回）
      const dMprArray = Array.isArray(dMprMatrix[0]) ? dMprMatrix.flat() : dMprMatrix;

      // 获取 prMd 矩阵（用于返回和投影）
      let prMdArray: number[] | undefined;
      if (data.prMd) {
        prMdArray = Array.isArray(data.prMd[0]) ? data.prMd.flat() : data.prMd;
      }

      // 构建结果对象
      const result: RegistrationResult = {
        registration_id: data.registration_id || registrationId,
        transformation_matrix: dMprArray,
        prMd_matrix: prMdArray, // 保存 prMd 矩阵用于投影
        quality_metrics: {
          fre_mm: data.quality_metrics.fre_mm,
          fre_std_mm: data.quality_metrics.fre_std_mm,
          tre_estimated_mm: data.quality_metrics.tre_estimated_mm,
          max_residual_mm: data.quality_metrics.max_residual_mm,
          quality: data.quality_metrics.quality as 'excellent' | 'good' | 'fair' | 'poor',
          points_used: data.quality_metrics.points_used,
        },
        point_residuals: data.point_residuals || [],
      };

      // 自动应用到导航系统
      // 后端总是返回 prMd（已计算好的逆矩阵）
      if (autoApplyToNavigation && servicesManager) {
        if (!prMdArray) {
          console.error('❌ prMd not in response - this should not happen');
          throw new Error('Registration response missing prMd matrix');
        }

        const applied = this.applyRegistrationToNavigation(prMdArray, servicesManager);
        if (applied) {
          console.log('✅ Registration matrix automatically applied to navigation');
        } else {
          console.warn('⚠️ Failed to auto-apply registration to navigation');
        }
      }

      this._broadcastEvent(EVENTS.REGISTRATION_COMPUTED, {
        ...data,
        appliedToNavigation: autoApplyToNavigation && servicesManager ? true : false,
      });

      console.log(
        `✅ Registration computed: FRE=${data.quality_metrics.fre_mm.toFixed(2)}mm, quality=${data.quality_metrics.quality}`
      );

      return result;
    } catch (error: any) {
      console.error('❌ Failed to compute registration:', error);
      throw error;
    }
  }

  /**
   * Preview registration quality
   * TODO: Implement when API endpoint is available
   */
  public async previewQuality(seriesInstanceUID: string, registrationId: string): Promise<any> {
    console.log('🔍 Previewing registration quality');
    console.warn('⚠️ Preview quality API endpoint not yet implemented');

    // TODO: Implement when API endpoint is available
    throw new Error('Preview quality API endpoint not yet implemented');
  }

  /**
   * Get saved registration matrix from database
   * 获取已保存的配准矩阵（通过 seriesInstanceUID 和 caseId）
   */
  public async getRegistrationMatrix(
    seriesInstanceUID: string,
    caseId: number | string
  ): Promise<{
    dMpr: number[][]; // DICOM → PR (4x4矩阵)
    rMpr: number[][]; // Register → PR (4x4矩阵)
    prMd: number[][]; // PR → DICOM (4x4矩阵，已计算好的逆矩阵)
    registration_id: string;
    quality_metrics: {
      fre_mm: number;
      quality: string;
    };
  } | null> {
    try {
      const caseIdParam = typeof caseId === 'string' ? parseInt(caseId, 10) : caseId;
      if (!caseIdParam || isNaN(caseIdParam)) {
        throw new Error('caseId is required and must be a valid number');
      }

      const response = await fetch(
        getApiUrl(
          `/api/registration/series/${encodeURIComponent(seriesInstanceUID)}/matrix?case_id=${caseIdParam}`
        )
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null; // 没有找到配准结果
        }
        const errorText = await response.text();
        throw new Error(
          `Failed to get registration matrix: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();

      if (!data.success || !data.dMpr) {
        return null;
      }

      // 确保返回的是4x4数组格式
      let dMpr: number[][];
      let rMpr: number[][];
      let prMd: number[][];

      if (Array.isArray(data.dMpr[0])) {
        dMpr = data.dMpr;
      } else {
        dMpr = this._flatToMatrix4x4(data.dMpr);
      }

      if (data.rMpr) {
        if (Array.isArray(data.rMpr[0])) {
          rMpr = data.rMpr;
        } else {
          rMpr = this._flatToMatrix4x4(data.rMpr);
        }
      } else {
        // 如果没有 rMpr，使用单位矩阵
        rMpr = [
          [1, 0, 0, 0],
          [0, 1, 0, 0],
          [0, 0, 1, 0],
          [0, 0, 0, 1],
        ];
      }

      // prMd 从数据库直接获取（已计算好的逆矩阵）
      if (!data.prMd) {
        console.error('❌ prMd not found in response - this should not happen');
        throw new Error('Registration matrix response missing prMd');
      }

      if (Array.isArray(data.prMd[0])) {
        prMd = data.prMd;
      } else {
        prMd = this._flatToMatrix4x4(data.prMd);
      }

      return {
        dMpr,
        rMpr,
        prMd,
        registration_id: data.registration_id,
        quality_metrics: data.quality_metrics || {
          fre_mm: 0,
          quality: 'unknown',
        },
      };
    } catch (error: any) {
      console.error('❌ Failed to get registration matrix:', error);
      return null;
    }
  }

  /**
   * Save registration result to database
   * 保存配准结果到数据库
   */
  public async saveRegistration(
    seriesInstanceUID: string,
    registrationId: string,
    createBackup: boolean = true
  ): Promise<{ success: boolean; message: string }> {
    console.log(
      `💾 Saving registration for series: ${seriesInstanceUID}, registration: ${registrationId}`
    );

    try {
      const response = await fetch(
        getApiUrl(`/api/registration/series/${encodeURIComponent(seriesInstanceUID)}/save`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registration_id: registrationId,
            create_backup: createBackup,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API request failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || data.message || 'Failed to save registration');
      }

      console.log('✅ Registration saved successfully:', data.message);
      return {
        success: true,
        message: data.message || 'Registration saved successfully',
      };
    } catch (error: any) {
      console.error('❌ Failed to save registration:', error);
      throw error;
    }
  }
}

export default RegistrationService;
export { EVENTS as RegistrationServiceEvents };
