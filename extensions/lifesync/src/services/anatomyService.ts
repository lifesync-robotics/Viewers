/**
 * Anatomy Service
 *
 * Service for querying anatomical data from AnatomyGuru via SyncForge API.
 * Handles screw placement information, vertebrae queries, and intersection analysis.
 *
 * Backend: http://localhost:3001/api/anatomy
 * gRPC Service: AnatomyGuru (Python, port 50058)
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface ScrewPlacementInfo {
  entryPoint: Vector3D;
  targetPoint: Vector3D;
  trajectoryVector: Vector3D;
  lengthMm: number;
  sagittalAngleDeg: number;
  transverseAngleDeg: number;
}

export interface IntersectionAnalysis {
  hasIntersection: boolean;
  iou: number; // Intersection over Union (0.0-1.0)
  intersectionCenter: Vector3D;
  intersectionVolume: number; // mm³
  vertebraVolume: number; // mm³
}

export interface ScrewPlacementResponse {
  success: boolean;
  message: string;
  seriesId: string;
  vertebraLabel: string;
  hasLeftScrew: boolean;
  hasRightScrew: boolean;
  leftScrew?: ScrewPlacementInfo;
  rightScrew?: ScrewPlacementInfo;
  intersectionAnalysis?: IntersectionAnalysis;
}

export interface AvailableVertebraeResponse {
  success: boolean;
  vertebrae: string[];
  count: number;
  error?: string;
}

export interface AvailableDatasetsResponse {
  success: boolean;
  series_ids: string[];
  count: number;
  error?: string;
}

export interface AnatomyHealthResponse {
  healthy: boolean;
  message: string;
  datasetsLoaded?: number;
  version?: string;
  grpcConnected?: boolean;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// ANATOMY SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════

class AnatomyService {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    // If baseUrl is explicitly provided, use it
    if (baseUrl) {
      this.baseUrl = baseUrl;
      return;
    }

    // Otherwise, auto-detect API URL similar to PlanningBackendService
    const globalConfig = (typeof window !== 'undefined' && (window as any).config) || {};
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

    // Check if we're being served through a proxy (nginx)
    const isProxied =
      typeof window !== 'undefined' &&
      (window.location.port === '8081' ||
        window.location.port === '8080' ||
        (window.location.port === '' && window.location.protocol === 'https:'));

    // Default API URL logic
    let defaultApiUrl: string;
    if (isProxied) {
      // Use same origin when served through nginx
      defaultApiUrl = `${window.location.origin}/api/anatomy`;
    } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Use localhost:3001 for direct development access
      defaultApiUrl = 'http://localhost:3001/api/anatomy';
    } else {
      // Allow remote access from other machines on the LAN
      defaultApiUrl = `http://${hostname}:3001/api/anatomy`;
    }

    // Check for syncforge config
    const syncforgeApiUrl = globalConfig.syncforge?.apiUrl;
    if (syncforgeApiUrl) {
      // Append /api/anatomy if not already present
      defaultApiUrl = syncforgeApiUrl.endsWith('/api/anatomy')
        ? syncforgeApiUrl
        : `${syncforgeApiUrl.replace(/\/$/, '')}/api/anatomy`;
    }

    // Check localStorage for saved API URL (for remote access via ngrok)
    const savedApiUrl =
      typeof window !== 'undefined' ? localStorage.getItem('syncforge_api_url') : null;
    if (savedApiUrl) {
      // Append /api/anatomy if not already present
      defaultApiUrl = savedApiUrl.endsWith('/api/anatomy')
        ? savedApiUrl
        : `${savedApiUrl.replace(/\/$/, '')}/api/anatomy`;
    }

    this.baseUrl = defaultApiUrl;

    if (typeof window !== 'undefined') {
      console.log('🦴 AnatomyService initialized', {
        baseUrl: this.baseUrl,
        isProxied,
        fromLocalStorage: !!savedApiUrl,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREW PLACEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get screw placement information for a vertebra
   * @param seriesId - DICOM series identifier
   * @param vertebraLabel - Vertebra label (e.g., "L5", "T12")
   * @returns Screw placement response with left/right screws and intersection analysis
   */
  async getScrewPlacement(
    seriesId: string,
    vertebraLabel: string
  ): Promise<ScrewPlacementResponse> {
    try {
      console.log('🔄 [AnatomyService] Getting screw placement...');
      console.log(`   Series ID: ${seriesId}`);
      console.log(`   Vertebra: ${vertebraLabel}`);

      const response = await fetch(`${this.baseUrl}/screw-placement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          seriesId,
          vertebraLabel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();

      if (data.success) {
        console.log(`✅ [AnatomyService] Retrieved screw placement for ${vertebraLabel}`);
        if (data.hasLeftScrew) {
          console.log(
            `   Left: Entry [${data.leftScrew.entryPoint.x.toFixed(1)}, ${data.leftScrew.entryPoint.y.toFixed(1)}, ${data.leftScrew.entryPoint.z.toFixed(1)}]`
          );
        }
        if (data.hasRightScrew) {
          console.log(
            `   Right: Entry [${data.rightScrew.entryPoint.x.toFixed(1)}, ${data.rightScrew.entryPoint.y.toFixed(1)}, ${data.rightScrew.entryPoint.z.toFixed(1)}]`
          );
        }
        if (data.intersectionAnalysis?.hasIntersection) {
          console.warn(
            `   ⚠️ Spinal cord intersection: IoU ${data.intersectionAnalysis.iou.toFixed(4)}`
          );
        }
      }

      return data;
    } catch (error) {
      console.error('❌ [AnatomyService] Error getting screw placement:', error);
      return {
        success: false,
        message: error.message || 'Failed to get screw placement',
        seriesId,
        vertebraLabel,
        hasLeftScrew: false,
        hasRightScrew: false,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VERTEBRAE QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get list of available vertebrae for a series
   * @param seriesId - DICOM series identifier
   * @returns List of vertebra labels
   */
  async getAvailableVertebrae(seriesId: string): Promise<AvailableVertebraeResponse> {
    try {
      console.log('📋 [AnatomyService] Getting available vertebrae...');
      console.log(`   Series ID: ${seriesId}`);

      const response = await fetch(`${this.baseUrl}/available-vertebrae/${seriesId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log(`✅ [AnatomyService] Found ${data.count} vertebrae`);
      }

      return data;
    } catch (error) {
      console.error('❌ [AnatomyService] Error getting available vertebrae:', error);
      return {
        success: false,
        vertebrae: [],
        count: 0,
        error: error.message || 'Failed to get available vertebrae',
      };
    }
  }

  /**
   * Get list of all available datasets (series IDs)
   * @returns List of series IDs with anatomical data available
   */
  async getAvailableDatasets(): Promise<AvailableDatasetsResponse> {
    try {
      console.log('📚 [AnatomyService] Getting available datasets...');

      const response = await fetch(`${this.baseUrl}/datasets`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log(`✅ [AnatomyService] Found ${data.count} datasets`);
      }

      return data;
    } catch (error) {
      console.error('❌ [AnatomyService] Error getting available datasets:', error);
      return {
        success: false,
        series_ids: [],
        count: 0,
        error: error.message || 'Failed to get available datasets',
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HEALTH CHECK
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if AnatomyGuru service is available
   * @returns Health status
   */
  async healthCheck(): Promise<AnatomyHealthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        credentials: 'include',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ [AnatomyService] Health check error:', error);
      return {
        healthy: false,
        message: error.message || 'Service unavailable',
        grpcConnected: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if the service is available (wrapper for healthCheck)
   * @returns true if service is healthy
   */
  async isAvailable(): Promise<boolean> {
    try {
      const health = await this.healthCheck();
      return health.healthy && health.grpcConnected === true;
    } catch (error) {
      console.warn('⚠️ [AnatomyService] Service not available:', error.message);
      return false;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════

// Export a singleton instance
export const anatomyService = new AnatomyService();

// Also export the class for custom instances
export default AnatomyService;

