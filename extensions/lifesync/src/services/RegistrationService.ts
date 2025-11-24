/**
 * RegistrationService
 *
 * Series-centric registration service for patient-to-image registration
 * Connects to SyncForge Registration API (series-centric architecture)
 */

import { PubSubService } from '@ohif/core';
import { getApiUrl } from '../utils/apiConfig';
import type { Fiducial, RegistrationSession, RegistrationResult } from '../components/Registration/types';

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
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || data.message || 'Failed to start registration session');
      }

      const session: RegistrationSession = {
        session_id: data.session_id,
        series_instance_uid: data.series_instance_uid || seriesInstanceUID,
        case_id: data.case_id || case_id || undefined,
        method: data.method || method,
        status: data.status || 'collecting_points',
        points_collected: data.points_collected || 0,
        points_with_tracker: data.points_with_tracker || 0,
        created_at: data.created_at ? new Date(data.created_at).getTime() / 1000 : Date.now() / 1000,
        operator: 'OHIF User',
        using_template: load_premarked,
        template_id: data.template_id || undefined,
      };

      this._broadcastEvent(EVENTS.SESSION_STARTED, session);

      console.log('✅ Registration session started:', session.session_id);
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
    const { case_id = null, created_by = 'OHIF User' } = options;

    console.log(`💾 Saving ${fiducials.length} fiducials for series: ${seriesInstanceUID}`);

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
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
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
      const url = new URL(
        getApiUrl(`/api/registration/series/${encodeURIComponent(seriesInstanceUID)}/fiducials`)
      );
      if (case_id) {
        url.searchParams.set('case_id', case_id);
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('No fiducial template found for this series');
        }
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
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
        dicom_voxel_coords: fid.dicom_voxel_coords || (fid.voxel_i !== undefined ? [fid.voxel_i, fid.voxel_j, fid.voxel_k] : undefined),
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
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.success || !data.session) {
        return null;
      }

      const session: RegistrationSession = {
        session_id: data.session.session_id,
        series_instance_uid: data.session.series_instance_uid || seriesInstanceUID,
        case_id: data.session.case_id || undefined,
        method: data.session.method,
        status: data.session.status,
        points_collected: data.session.points_collected || 0,
        points_with_tracker: data.session.points_with_tracker || 0,
        created_at: data.session.created_at ? new Date(data.session.created_at).getTime() / 1000 : Date.now() / 1000,
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
   * Compute registration transformation
   * TODO: Implement when API endpoint is available
   */
  public async computeRegistration(
    seriesInstanceUID: string,
    sessionId: string,
    options: {
      method?: string;
      outlier_threshold_mm?: number;
      validate?: boolean;
    } = {}
  ): Promise<RegistrationResult> {
    console.log('🧮 Computing registration transformation');
    console.warn('⚠️ Compute registration API endpoint not yet implemented');

    // TODO: Implement when API endpoint is available
    throw new Error('Compute registration API endpoint not yet implemented');
  }

  /**
   * Preview registration quality
   * TODO: Implement when API endpoint is available
   */
  public async previewQuality(
    seriesInstanceUID: string,
    sessionId: string
  ): Promise<any> {
    console.log('🔍 Previewing registration quality');
    console.warn('⚠️ Preview quality API endpoint not yet implemented');

    // TODO: Implement when API endpoint is available
    throw new Error('Preview quality API endpoint not yet implemented');
  }

  /**
   * Save registration result
   * TODO: Implement when API endpoint is available
   */
  public async saveRegistration(
    seriesInstanceUID: string,
    sessionId: string,
    createBackup: boolean = true
  ): Promise<{ success: boolean; message: string }> {
    console.log('💾 Saving registration');
    console.warn('⚠️ Save registration API endpoint not yet implemented');

    // TODO: Implement when API endpoint is available
    throw new Error('Save registration API endpoint not yet implemented');
  }
}

export default RegistrationService;
export { EVENTS as RegistrationServiceEvents };
