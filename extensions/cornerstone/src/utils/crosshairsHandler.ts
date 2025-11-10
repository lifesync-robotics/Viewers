import { getRenderingEngines } from '@cornerstonejs/core';
import { ToolGroupManager, annotation } from '@cornerstonejs/tools';

/**
 * Crosshair data structure
 */
export interface CrosshairData {
  center: [number, number, number] | null;
  isActive: boolean;
  viewportId?: string;
}

/**
 * Cached crosshair information
 * Since crosshairs share a single world coordinate across all viewports,
 * we only need to cache one global reference
 */
interface CrosshairGlobalCache {
  center: [number, number, number] | null;
  isActive: boolean;
  toolGroup: any;
  crosshairsTool: any;
  lastChecked: number;
}

/**
 * CrosshairsHandler - Simplified utility for handling Crosshairs tool
 *
 * Features:
 * - Caches the single shared crosshair center (world coordinate)
 * - No per-viewport caching needed since all viewports share the same point
 * - Provides simple API to get crosshair center
 * - Handles both array [x,y,z] and object {x,y,z} formats
 * - Auto-refreshes cache when stale
 */
class CrosshairsHandler {
  private globalCache: CrosshairGlobalCache | null = null;
  private readonly CACHE_TTL = 5000; // 5 seconds cache validity

  /**
   * Get the shared crosshair center (world coordinate)
   * Since crosshairs use a single shared point across all viewports,
   * this returns the same center regardless of which viewport you query
   */
  public getCrosshairCenter(viewportId?: string): CrosshairData {
    try {
      // Check if we have valid cached data
      const now = Date.now();
      if (this.globalCache && (now - this.globalCache.lastChecked) < this.CACHE_TTL) {
        return {
          center: this.globalCache.center,
          isActive: this.globalCache.isActive,
          viewportId,
        };
      }

      // Cache is stale or doesn't exist - fetch fresh data
      this._refreshGlobalCache();

      return {
        center: this.globalCache?.center || null,
        isActive: this.globalCache?.isActive || false,
        viewportId,
      };

    } catch (error) {
      console.warn(`⚠️ [CrosshairsHandler] Error getting crosshair center:`, error.message);
      return {
        center: null,
        isActive: false,
        viewportId,
      };
    }
  }

  /**
   * Get crosshair centers for multiple viewports
   * Note: Since all viewports share the same world coordinate,
   * this returns the same center for each viewport
   */
  public getCrosshairCenters(viewportIds: string[]): Record<string, CrosshairData> {
    const result: Record<string, CrosshairData> = {};

    // Get the shared center once
    const sharedCenter = this.getCrosshairCenter();

    // Return same center for all viewports
    for (const viewportId of viewportIds) {
      result[viewportId] = {
        ...sharedCenter,
        viewportId,
      };
    }

    return result;
  }

  /**
   * Get crosshair centers for all MPR viewports
   * Note: Since all viewports share the same world coordinate,
   * this returns the same center for each MPR viewport
   */
  public getAllMPRCrosshairCenters(): Record<string, CrosshairData> {
    const MPR_VIEWPORT_IDS = ['mpr-axial', 'mpr-sagittal', 'mpr-coronal'];
    const result: Record<string, CrosshairData> = {};

    // Get the shared center once
    const sharedCenter = this.getCrosshairCenter();

    // Find all MPR viewports
    const renderingEngines = getRenderingEngines();

    for (const engine of renderingEngines) {
      const viewports = engine.getViewports();

      for (const viewport of viewports) {
        // Check if this is an MPR viewport
        const isMPR = MPR_VIEWPORT_IDS.some(id => viewport.id.includes(id));

        if (isMPR) {
          result[viewport.id] = {
            ...sharedCenter,
            viewportId: viewport.id,
          };
        }
      }
    }

    return result;
  }

  /**
   * Clear the global cache
   */
  public clearCache(): void {
    this.globalCache = null;
  }

  /**
   * Refresh the global cache by finding any viewport with crosshairs
   * and extracting the shared world coordinate
   * @private
   */
  private _refreshGlobalCache(): void {
    try {
      const renderingEngines = getRenderingEngines();

      // Search through all rendering engines and viewports to find crosshairs tool
      for (const engine of renderingEngines) {
        const viewports = engine.getViewports();

        for (const viewport of viewports) {
          try {
            // Get tool group for this viewport
            const toolGroup = ToolGroupManager.getToolGroupForViewport(
              viewport.id,
              engine.id
            );

            if (!toolGroup) {
              continue;
            }

            // Get the Crosshairs tool instance
            const crosshairsTool = toolGroup.getToolInstance('Crosshairs');

            if (!crosshairsTool) {
              continue;
            }

            // Check if crosshairs tool is active
            const isActive = crosshairsTool.mode === 'Active';

            if (!isActive || !viewport.element) {
              // Tool exists but not active
              this.globalCache = {
                center: null,
                isActive: false,
                toolGroup,
                crosshairsTool,
                lastChecked: Date.now(),
              };
              return;
            }

            // Get annotations for the crosshairs tool
            const annotations = annotation.state.getAnnotations('Crosshairs', viewport.element);

            // Extract center from the first annotation
            const center = this._extractCenterFromAnnotations(annotations);

            // Cache the shared center globally
            this.globalCache = {
              center,
              isActive: true,
              toolGroup,
              crosshairsTool,
              lastChecked: Date.now(),
            };

            // Found and cached - no need to check other viewports
            return;

          } catch (e) {
            // Error with this viewport, try next one
            continue;
          }
        }
      }

      // No crosshairs tool found in any viewport
      this.globalCache = {
        center: null,
        isActive: false,
        toolGroup: null,
        crosshairsTool: null,
        lastChecked: Date.now(),
      };

    } catch (error) {
      console.warn(`⚠️ [CrosshairsHandler] Error refreshing global cache:`, error.message);
      this.globalCache = {
        center: null,
        isActive: false,
        toolGroup: null,
        crosshairsTool: null,
        lastChecked: Date.now(),
      };
    }
  }

  /**
   * Extract center coordinates from crosshair annotations
   * Handles both array [x,y,z] and object {x,y,z} formats
   * @private
   */
  private _extractCenterFromAnnotations(annotations: any[]): [number, number, number] | null {
    if (!annotations || annotations.length === 0) {
      return null;
    }

    const firstAnnotation = annotations[0];

    // Try rotationPoints first
    if (firstAnnotation.data?.handles?.rotationPoints) {
      const rawOrigin = firstAnnotation.data.handles.rotationPoints[0];
      return this._normalizePoint(rawOrigin);
    }

    // Try toolCenter
    if (firstAnnotation.data?.handles?.toolCenter) {
      const rawOrigin = firstAnnotation.data.handles.toolCenter;
      return this._normalizePoint(rawOrigin);
    }

    return null;
  }

  /**
   * Normalize point from either array [x,y,z] or object {x,y,z} format
   * @private
   */
  private _normalizePoint(point: any): [number, number, number] | null {
    if (!point) {
      return null;
    }

    // Handle array format
    if (Array.isArray(point) && point.length === 3) {
      return [point[0], point[1], point[2]];
    }

    // Handle object format
    if (typeof point === 'object' && 'x' in point && 'y' in point && 'z' in point) {
      return [point.x, point.y, point.z];
    }

    return null;
  }
}

// Export singleton instance
export const crosshairsHandler = new CrosshairsHandler();

// Export class for testing or custom instances
export default CrosshairsHandler;
