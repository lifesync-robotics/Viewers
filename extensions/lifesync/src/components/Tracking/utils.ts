/**
 * Tracking Utilities
 *
 * Utility functions for tracking system components
 * Extracted from TrackingPanel and other components for better maintainability
 */

import { getRenderingEngine } from '@cornerstonejs/core';
import { annotation as annotationManager } from '@cornerstonejs/tools';
import { vec3 } from 'gl-matrix';

const TRACKING_DISTANCE_LABEL = 'Screw ↔ Tool';
const TRACKING_DISTANCE_TOOL = 'Length';
const TRACKING_DISTANCE_FLAG = 'lifesync-distance';
const MPR_VIEWPORT_IDS = ['mpr-axial', 'mpr-coronal', 'mpr-sagittal'];

// Extend Window interface for viewport ID storage
declare global {
  interface Window {
    __viewportIds?: {
      [viewportId: string]: string; // Maps viewport ID to its imageId or volumeId
    };
  }
}

/**
 * Get viewport target ID for annotation creation
 * @param viewportId - The viewport ID to get targetId for
 * @returns targetId with proper prefix (imageId: or volumeId:)
 */
export function getViewportTargetId(viewportId: string): string | null {
  console.log('🔍 [TrackingUtils] Getting targetId for viewport:', viewportId);

  // PRIORITY 1: Try to use globally stored viewport ID (captured on mode enter)
  if (window.__viewportIds && window.__viewportIds[viewportId]) {
    const targetId = window.__viewportIds[viewportId];
    console.log('✅ [TrackingUtils] Using stored viewport ID:', targetId);
    return targetId;
  }

  // PRIORITY 2: Find viewport and get ID directly
  const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
  if (!renderingEngine) {
    console.warn('⚠️ [TrackingUtils] No rendering engine found');
    return null;
  }

  const viewport = renderingEngine.getViewports().find(vp => vp.id === viewportId);
  if (!viewport) {
    console.warn(`⚠️ [TrackingUtils] Viewport not found: ${viewportId}`);
    return null;
  }

  let targetId = null;

  // PRIORITY 3: For volume/MPR viewports, try getImageIds (most reliable for axial/coronal/sagittal)
  const imageIds = (viewport as any).getImageIds?.();
  if (imageIds && imageIds.length > 0) {
    const rawId = imageIds[0];
    targetId = rawId.startsWith('imageId:') || rawId.startsWith('volumeId:')
      ? rawId
      : `imageId:${rawId}`;
    console.log(`📐 [TrackingUtils] MPR viewport ${viewportId} -> ${targetId}`);
  }

  // PRIORITY 4: For stack viewports, get the current image ID
  if (!targetId && typeof (viewport as any).getCurrentImageId === 'function') {
    const imageId = (viewport as any).getCurrentImageId();
    console.log('🔍 [TrackingUtils] Got stack imageId:', imageId);
    if (imageId) {
      targetId = imageId.startsWith('imageId:') ? imageId : `imageId:${imageId}`;
      console.log('✅ [TrackingUtils] Formatted stack targetId:', targetId);
    }
  }

  // PRIORITY 5: For volume viewports, get the volume ID
  if (!targetId) {
    const volumeIds = (viewport as any).getVolumeIds?.();
    console.log('🔍 [TrackingUtils] Got volume IDs:', volumeIds);
    if (volumeIds && volumeIds.length > 0) {
      const volumeId = volumeIds[0];
      targetId = volumeId.startsWith('volumeId:') ? volumeId : `volumeId:${volumeId}`;
      console.log('✅ [TrackingUtils] Formatted volume targetId:', targetId);
    }
  }

  if (targetId) {
    console.log('✅ [TrackingUtils] Final targetId for annotation:', targetId);
  } else {
    console.error('❌ [TrackingUtils] No valid target ID available');
    console.error('   Viewport ID:', viewportId);
    console.error('   Viewport type:', viewport.type);
    console.error('   Global storage:', window.__viewportIds);
  }

  return targetId;
}

/**
 * Find the appropriate viewport for distance annotations
 * @returns The viewport element and viewport object
 */
export function findAnnotationViewport() {
  const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
  if (!renderingEngine) {
    console.log('❌ [TrackingUtils] No rendering engine found');
    return null;
  }

  const viewport = renderingEngine
    .getViewports()
    .find(
      vp =>
        vp.type !== 'stack' &&
        vp.constructor.name !== 'VolumeViewport3D' &&
        vp.element
    );

  if (!viewport) {
    return null;
  }

  return {
    viewport,
    element: viewport.element,
    camera: viewport.getCamera(),
    viewportId: (viewport as any).id
  };
}

/**
 * Calculate 3D distance between two points
 * @param point1 - First 3D point [x, y, z]
 * @param point2 - Second 3D point [x, y, z]
 * @returns Distance in the same units as input coordinates
 */
export function calculate3DDistance(point1: number[], point2: number[]): number {
  return vec3.distance(
    vec3.fromValues(point1[0], point1[1], point1[2]),
    vec3.fromValues(point2[0], point2[1], point2[2])
  );
}

/**
 * Extract tooltip position from tracking tool data
 * @param toolData - Raw tool tracking data
 * @param toolId - Tool identifier (e.g., "dM1", "dM2")
 * @returns Position array [x, y, z] or null if not found
 */
export function extractTooltipPosition(toolData: any, toolId: string): [number, number, number] | null {
  try {
    const dicomCoords = toolData?.coordinates?.dicom;
    const key = `dM${toolId}`;
    const matrix = dicomCoords?.[key];
    if (matrix && matrix.length === 4 && matrix[0].length === 4) {
      return [matrix[0][3], matrix[1][3], matrix[2][3]];
    }
  } catch (error) {
    console.warn('⚠️ [TrackingUtils] Could not extract tooltip position:', error);
  }
  return null;
}

/**
 * Create a length annotation for distance measurement
 * @param screwPos - Screw position [x, y, z]
 * @param tooltipPos - Tool position [x, y, z]
 * @param viewport - Cornerstone viewport object
 * @param element - Viewport HTML element
 * @param targetId - Target ID for annotation
 * @param annotationUID - Optional custom annotation UID
 * @returns The created annotation object
 */
export function createDistanceAnnotation(
  screwPos: number[],
  tooltipPos: number[],
  viewport: any,
  element: HTMLElement,
  targetId: string,
  annotationUID?: string
) {
  const camera = viewport.getCamera();
  const distance = calculate3DDistance(screwPos, tooltipPos);

  // Extract raw image ID (without "imageId:" or "volumeId:" prefix) for metadata
  const rawImageId = targetId.replace(/^(imageId:|volumeId:)/, '');
  console.log('📝 [TrackingUtils] Raw image ID for metadata:', rawImageId);

  const uid = annotationUID ||
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `length-${Date.now()}-${Math.random()}`);

  const lengthAnnotation: any = {
    annotationUID: uid,
    highlighted: true,
    invalidated: false,
    isLocked: false,
    isVisible: true,
    metadata: {
      viewPlaneNormal: camera.viewPlaneNormal || [0, 0, 1],
      viewUp: camera.viewUp || [0, -1, 0],
      viewPlaneOrigin: camera?.focalPoint || [0, 0, 0],
      FrameOfReferenceUID: viewport.getFrameOfReferenceUID?.(),
      referencedImageId: rawImageId,  // Use raw ID without prefix for metadata
      toolName: TRACKING_DISTANCE_TOOL,
    },
    data: {
      label: TRACKING_DISTANCE_LABEL,
      handles: {
        points: [
          [screwPos[0], screwPos[1], screwPos[2]],
          [tooltipPos[0], tooltipPos[1], tooltipPos[2]],
        ],
        activeHandleIndex: null,
        textBox: {
          hasMoved: false,
          worldPosition: null,
        },
      },
      cachedStats: {
        // Use targetId as the key for cachedStats (CornerstoneJS requirement)
        [targetId]: {
          length: distance,
          unit: 'mm',
        },
      },
    },
  };

  return lengthAnnotation;
}

/**
 * Update an existing distance annotation's content and metadata
 * The annotation should already be registered with the annotation manager
 */
export function updateDistanceAnnotation(
  distanceAnnotation: any,
  viewport: any,
  targetId: string,
  screwPos: number[],
  tooltipPos: number[]
) {
  const camera = viewport?.getCamera?.();
  const distance = calculate3DDistance(screwPos, tooltipPos);
  const rawImageId = targetId.replace(/^(imageId:|volumeId:)/, '');
  const focalPoint =
    camera?.focalPoint ||
    (distanceAnnotation.metadata && (distanceAnnotation.metadata as any).viewPlaneOrigin) ||
    [0, 0, 0];

  distanceAnnotation.data = {
    ...(distanceAnnotation.data || {}),
    label: TRACKING_DISTANCE_LABEL,
    handles: {
      ...(distanceAnnotation.data?.handles || {}),
      points: [
        [...screwPos],
        [...tooltipPos],
      ],
      activeHandleIndex: null,
      textBox:
        distanceAnnotation.data?.handles?.textBox || {
          hasMoved: false,
          worldPosition: null,
        },
    },
    cachedStats: {
      [targetId]: {
        length: distance,
        unit: 'mm',
      },
    },
  };

  distanceAnnotation.metadata = {
    ...(distanceAnnotation.metadata || {}),
    viewPlaneNormal: camera?.viewPlaneNormal || [0, 0, 1],
    viewUp: camera?.viewUp || [0, -1, 0],
    viewPlaneOrigin: focalPoint,
    FrameOfReferenceUID: viewport?.getFrameOfReferenceUID?.(),
    referencedImageId: rawImageId,
    toolName: TRACKING_DISTANCE_TOOL,
  };
 
  distanceAnnotation.invalidated = true;
}

type MprViewportInfo = {
  viewport: any;
  element: HTMLElement;
  viewportId: string;
  targetId: string;
};

function isMprViewport(viewportId?: string) {
  if (!viewportId) {
    return false;
  }
  return MPR_VIEWPORT_IDS.some(id => viewportId.includes(id));
}

function getMprViewportInfos(renderingEngine: any): MprViewportInfo[] {
  if (!renderingEngine) {
    return [];
  }

  const viewports = renderingEngine.getViewports();
  const infos: MprViewportInfo[] = [];

  viewports.forEach(viewport => {
    const viewportId = (viewport as any).id;

    if (!isMprViewport(viewportId)) {
      return;
    }

    if (!viewport.element) {
      console.warn('⚠️ [TrackingUtils] MPR viewport missing element, skipping', viewportId);
      return;
    }

    const targetId = getViewportTargetId(viewportId);
    if (!targetId) {
      console.warn('⚠️ [TrackingUtils] No targetId for MPR viewport, skipping', viewportId);
      return;
    }

    infos.push({
      viewport,
      element: viewport.element as HTMLElement,
      viewportId,
      targetId,
    });
  });

  console.log('📌 [TrackingUtils] MPR viewport infos', infos.map(i => i.viewportId));
  return infos;
}

function isTrackingDistanceAnnotation(candidate: any, viewportId: string) {
  if (!candidate) {
    return false;
  }

  const { metadata, data } = candidate;
  // Check tracking flag AND viewport ID to ensure we find the correct annotation for this viewport
  if (metadata?.trackingFlag === TRACKING_DISTANCE_FLAG && metadata?.viewportId === viewportId) {
    return true;
  }

  if (metadata?.viewportId === viewportId && data?.label === TRACKING_DISTANCE_LABEL) {
    return true;
  }

  return false;
}

function findTrackingDistanceAnnotation(element: HTMLElement, viewportId: string) {
  const annotations =
    annotationManager.state.getAnnotations(TRACKING_DISTANCE_TOOL, element as any) || [];

  return annotations.find(candidate => isTrackingDistanceAnnotation(candidate, viewportId));
}

function createTrackingDistanceAnnotation(
  screwPos: number[],
  tooltipPos: number[],
  viewport: any,
  element: HTMLElement,
  targetId: string,
  viewportId: string
) {
  const annotationUID = generateAnnotationUID('distance');
  const distanceAnnotation = createDistanceAnnotation(
    screwPos,
    tooltipPos,
    viewport,
    element,
    targetId,
    annotationUID
  );

  distanceAnnotation.metadata = {
    ...((distanceAnnotation.metadata as any) || {}),
    trackingFlag: TRACKING_DISTANCE_FLAG,
    viewportId,
    targetId,
  } as any;

  return distanceAnnotation;
}

/**
 * Ensure each MPR viewport (axial, coronal, sagittal) has a tracking distance annotation
 * Create it if missing, update geometry/content if present, then render once for all
 */
export function updateDistanceAnnotationsForMprViewports(
  screwPos: number[],
  tooltipPos: number[]
) {
  const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
  if (!renderingEngine) {
    console.warn('⚠️ [TrackingUtils] No rendering engine found for distance annotations');
    return;
  }

  const viewportInfos = getMprViewportInfos(renderingEngine);
  const found = viewportInfos.map(v => v.viewportId);
  const missing = MPR_VIEWPORT_IDS.filter(id => !found.some(fid => fid.includes(id)));

  if (viewportInfos.length !== MPR_VIEWPORT_IDS.length) {
    console.warn(
      '⚠️ [TrackingUtils] MPR distance annotations expected 3 viewports (axial/coronal/sagittal)',
      { found, missing }
    );
    // Continue with available ones rather than returning; still update what we have.
  }

  const updatedViewportIds: string[] = [];

  viewportInfos.forEach(({ viewport, element, viewportId, targetId }) => {
    console.log('✏️ [TrackingUtils] Updating distance annotation for', viewportId);

    let distanceAnnotation = findTrackingDistanceAnnotation(element, viewportId);

    if (!distanceAnnotation) {
      distanceAnnotation = createTrackingDistanceAnnotation(
        screwPos,
        tooltipPos,
        viewport,
        element,
        targetId,
        viewportId
      );
      annotationManager.state.addAnnotation(distanceAnnotation, element as any);
    }

    distanceAnnotation.metadata = {
      ...((distanceAnnotation.metadata as any) || {}),
      trackingFlag: TRACKING_DISTANCE_FLAG,
      viewportId,
      targetId,
    } as any;

    updateDistanceAnnotation(distanceAnnotation, viewport, targetId, screwPos, tooltipPos);
    updatedViewportIds.push(viewportId);
  });

  if (updatedViewportIds.length) {
    try {
      console.log('🎬 [TrackingUtils] Rendering after distance updates', updatedViewportIds);
      renderingEngine.render();
    } catch (error) {
      console.warn('⚠️ [TrackingUtils] Failed to render after distance annotation updates', error);
    }
  }
}

/**
 * Validate tracking configuration
 * @param config - Tracking configuration object
 * @returns Validation result with success flag and error messages
 */
export function validateTrackingConfig(config: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.name || config.name.trim().length === 0) {
    errors.push('Configuration name is required');
  }

  if (!config.default_instrument_ids || config.default_instrument_ids.length === 0) {
    errors.push('At least one instrument must be selected');
  }

  if (!config.settings) {
    errors.push('Configuration settings are required');
  } else {
    const settings = config.settings;
    if (settings.tracking_frequency <= 0) {
      errors.push('Tracking frequency must be greater than 0');
    }
    if (settings.quality_threshold < 0 || settings.quality_threshold > 1) {
      errors.push('Quality threshold must be between 0 and 1');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate a unique annotation UID
 * @param prefix - Optional prefix for the UID
 * @returns Unique annotation UID
 */
export function generateAnnotationUID(prefix: string = 'annotation'): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format position array for display
 * @param position - Position array [x, y, z] or null
 * @param precision - Number of decimal places (default: 2)
 * @returns Formatted position string or 'N/A'
 */
export function formatPosition(position: number[] | null, precision: number = 2): string {
  if (!position || position.length !== 3) {
    return 'N/A';
  }
  return position.map(coord => coord.toFixed(precision)).join(', ');
}

/**
 * Check if a tool is visible and has good quality
 * @param toolData - Tool tracking data
 * @param qualityThreshold - Minimum quality threshold (default: 0.5)
 * @returns Object with visibility and quality status
 */
export function getToolStatus(toolData: any, qualityThreshold: number = 0.5): {
  visible: boolean;
  quality: number;
  isGoodQuality: boolean;
} {
  const visible = toolData?.visible || false;
  const quality = toolData?.quality_score || 0;
  const isGoodQuality = visible && quality >= qualityThreshold;

  return {
    visible,
    quality,
    isGoodQuality
  };
}

/**
 * HTTP API utilities for tracking configurations
 */
export const apiUtils = {
  /**
   * Get API base URL (handles both development and production)
   * @returns API base URL string
   */
  getApiBase: (): string => {
    // Phase 4: Always use relative paths (webpack proxy handles routing)
    return '';
  },

  /**
   * Make HTTP request with error handling
   * @param url - Request URL
   * @param options - Fetch options
   * @returns Promise with response data
   */
  fetchWithErrorHandling: async (url: string, options: RequestInit = {}) => {
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }

      return await response.text();
    } catch (error) {
      console.error(`API request failed: ${url}`, error);
      throw error;
    }
  },

  /**
   * Load tracking configurations from server
   * @returns Promise with configurations array
   */
  loadConfigurations: async () => {
    const baseUrl = apiUtils.getApiBase();
    return await apiUtils.fetchWithErrorHandling(`${baseUrl}/api/tracking/configurations`);
  },

  /**
   * Save tracking configuration to server
   * @param config - Configuration to save
   * @returns Promise with saved configuration
   */
  saveConfiguration: async (config: any) => {
    const baseUrl = apiUtils.getApiBase();
    return await apiUtils.fetchWithErrorHandling(`${baseUrl}/api/tracking/configurations`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  /**
   * Test NDI connection
   * @param ndiConfig - NDI connection configuration
   * @returns Promise with connection test result
   */
  testNDIConnection: async (ndiConfig: any) => {
    const baseUrl = apiUtils.getApiBase();
    return await apiUtils.fetchWithErrorHandling(`${baseUrl}/api/tracking/test-ndi`, {
      method: 'POST',
      body: JSON.stringify(ndiConfig),
    });
  },
};

/**
 * Configuration utilities for tracking setup
 */
export const configUtils = {
  /**
   * Create default tracking configuration
   * @param name - Configuration name
   * @returns Default configuration object
   */
  createDefaultConfig: (name: string = 'New Configuration') => ({
    name,
    description: '',
    default_reference_marker_id: null,
    default_instrument_ids: [],
    settings: {
      tracking_frequency: 60,
      coordinate_system: 'ndi',
      quality_threshold: 0.8,
      auto_reference_detection: true,
      tracking_mode: 'hardware' as const,
      ndi_config: {
        ip_address: '172.16.0.4',
        port: 8765,
        tracker_type: 'polaris_vega',
        timeout_seconds: 5,
        auto_reconnect: true,
      },
    },
    alternative_rom_selections: {},
  }),

  /**
   * Validate tracking configuration
   * @param config - Configuration to validate
   * @returns Validation result with success flag and error messages
   */
  validateConfig: (config: any): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!config.name || config.name.trim().length === 0) {
      errors.push('Configuration name is required');
    }

    if (!config.default_instrument_ids || config.default_instrument_ids.length === 0) {
      errors.push('At least one instrument must be selected');
    }

    if (!config.settings) {
      errors.push('Configuration settings are required');
    } else {
      const settings = config.settings;
      if (settings.tracking_frequency <= 0) {
        errors.push('Tracking frequency must be greater than 0');
      }
      if (settings.quality_threshold < 0 || settings.quality_threshold > 1) {
        errors.push('Quality threshold must be between 0 and 1');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Clone configuration with new name
   * @param config - Original configuration
   * @param newName - New configuration name
   * @returns Cloned configuration
   */
  cloneConfig: (config: any, newName: string) => ({
    ...config,
    name: newName,
    config_id: undefined, // Remove ID to create new config
    created_at: undefined,
    updated_at: undefined,
  }),
};

/**
 * UI utilities for tracking components
 */
export const uiUtils = {
  /**
   * Format quality score for display
   * @param quality - Quality score (0-1)
   * @returns Formatted quality string with color indicator
   */
  formatQuality: (quality: number): { text: string; color: string } => {
    const percentage = Math.round(quality * 100);
    let color = 'red';

    if (quality >= 0.8) color = 'green';
    else if (quality >= 0.6) color = 'yellow';
    else if (quality >= 0.4) color = 'orange';

    return {
      text: `${percentage}%`,
      color
    };
  },

  /**
   * Get status indicator for connection/visibility
   * @param isActive - Whether item is active/connected/visible
   * @returns Status indicator object
   */
  getStatusIndicator: (isActive: boolean): { symbol: string; color: string; text: string } => {
    return isActive
      ? { symbol: '●', color: 'green', text: 'Active' }
      : { symbol: '●', color: 'red', text: 'Inactive' };
  },

  /**
   * Debounce function for search/filter inputs
   * @param func - Function to debounce
   * @param wait - Wait time in milliseconds
   * @returns Debounced function
   */
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },
};

/**
 * Constants for tracking system
 */
export const TRACKING_CONSTANTS = {
  // Quality thresholds
  QUALITY_THRESHOLDS: {
    EXCELLENT: 0.9,
    GOOD: 0.7,
    FAIR: 0.5,
    POOR: 0.3,
  },

  // Default settings
  DEFAULTS: {
    TRACKING_FREQUENCY: 60,
    QUALITY_THRESHOLD: 0.8,
    COORDINATE_SYSTEM: 'ndi',
    NDI_IP: '172.16.0.4',
    NDI_PORT: 8765,
    TIMEOUT_SECONDS: 5,
  },

  // UI colors and styles
  COLORS: {
    EXCELLENT: '#22c55e', // green-500
    GOOD: '#84cc16',      // lime-500
    FAIR: '#eab308',      // yellow-500
    POOR: '#f97316',      // orange-500
    BAD: '#ef4444',       // red-500
    ACTIVE: '#22c55e',    // green-500
    INACTIVE: '#ef4444',  // red-500
  },

  // Message templates
  MESSAGES: {
    CONNECTION_SUCCESS: 'Successfully connected to tracking system',
    CONNECTION_FAILED: 'Failed to connect to tracking system',
    CONFIG_SAVED: 'Configuration saved successfully',
    CONFIG_LOADED: 'Configuration loaded successfully',
    VALIDATION_ERROR: 'Configuration validation failed',
  },
} as const;
