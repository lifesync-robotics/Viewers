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
 * - Auto-refreshes cache when stale (50ms cache for 20Hz refresh rate)
 */
class CrosshairsHandler {
  private globalCache: CrosshairGlobalCache | null = null;
  private readonly CACHE_TTL = 50; // 50ms cache validity (20Hz refresh rate)

  /**
   * Get the shared crosshair center (world coordinate)
   * Since crosshairs use a single shared point across all viewports,
   * this returns the same center regardless of which viewport you query
   * Returns only the center point for efficiency
   */
  public getCrosshairCenter(): [number, number, number] | null {
    try {
      // Check if we have valid cached data
      const now = Date.now();
      if (this.globalCache && (now - this.globalCache.lastChecked) < this.CACHE_TTL) {
        return this.globalCache.center;
      }

      // Cache is stale or doesn't exist - fetch fresh data
      this._refreshGlobalCache();

      return this.globalCache?.center || null;

    } catch (error) {
      console.warn(`⚠️ [CrosshairsHandler] Error getting crosshair center:`, error.message);
      return null;
    }
  }

  /**
   * Get crosshair centers for multiple viewports
   * Note: Since all viewports share the same world coordinate,
   * this returns the same center for each viewport
   */
  public getCrosshairCenters(viewportIds: string[]): Record<string, [number, number, number] | null> {
    const result: Record<string, [number, number, number] | null> = {};

    // Get the shared center once
    const sharedCenter = this.getCrosshairCenter();

    // Return same center for all viewports
    for (const viewportId of viewportIds) {
      result[viewportId] = sharedCenter;
    }

    return result;
  }

  /**
   * Get crosshair centers for all MPR viewports
   * Note: Since all viewports share the same world coordinate,
   * this returns the same center for each MPR viewport
   */
  public getAllMPRCrosshairCenters(): Record<string, [number, number, number] | null> {
    const MPR_VIEWPORT_IDS = ['mpr-axial', 'mpr-sagittal', 'mpr-coronal'];
    const result: Record<string, [number, number, number] | null> = {};

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
          result[viewport.id] = sharedCenter;
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
   * Get crosshair center with fresh read (bypasses cache)
   * Uses crosshairs annotation toolCenter as the authoritative source
   * This is the ACTUAL crosshair position, NOT the camera focal point
   */
  public getFreshCrosshairCenter(): [number, number, number] | null {
    try {
      // Clear cache to force fresh read
      this.clearCache();

      const renderingEngines = getRenderingEngines();

      for (const engine of renderingEngines) {
        const viewports = engine.getViewports();

        // Get from crosshairs annotation - this is the ACTUAL crosshair position
        for (const viewport of viewports) {
          try {
            if (!viewport.element) continue;

            // Get crosshairs annotations directly from annotation state
            const annotations = annotation.state.getAnnotations('Crosshairs', viewport.element);

            if (annotations && annotations.length > 0) {
              const crosshairAnnotation = annotations[0];

              // Debug: Log complete annotation structure
              console.log(`🔍 [CrosshairsHandler] === ANNOTATION STRUCTURE ===`);
              console.log(`   Viewport: ${viewport.id}`);
              console.log(`   Handle keys:`, Object.keys(crosshairAnnotation.data?.handles || {}));

              // Priority 1: toolCenter - this IS the actual crosshair center
              if (crosshairAnnotation.data?.handles?.toolCenter) {
                const tc = crosshairAnnotation.data.handles.toolCenter;
                console.log(`   toolCenter raw:`, tc);
                const center = this._normalizePoint(tc, true);
                if (center) {
                  console.log(`📍 [CrosshairsHandler] Fresh read from toolCenter: [${center[0].toFixed(2)}, ${center[1].toFixed(2)}, ${center[2].toFixed(2)}]`);
                  return center;
                }
              }

              // Priority 2: rotationPoints - examine structure
              if (crosshairAnnotation.data?.handles?.rotationPoints) {
                const rotPoints = crosshairAnnotation.data.handles.rotationPoints;
                console.log(`   rotationPoints type:`, typeof rotPoints);
                console.log(`   rotationPoints length:`, Array.isArray(rotPoints) ? rotPoints.length : 'N/A');

                if (Array.isArray(rotPoints) && rotPoints.length > 0) {
                  // Log first few rotation points to understand structure
                  for (let i = 0; i < Math.min(3, rotPoints.length); i++) {
                    console.log(`   rotationPoints[${i}]:`, JSON.stringify(rotPoints[i]).substring(0, 100));
                  }

                  // rotationPoints structure can be nested - try to extract
                  let rawPoint = rotPoints[0];

                  // Handle nested array structure [[x,y,z], ...]
                  if (Array.isArray(rawPoint) && rawPoint.length > 0 && Array.isArray(rawPoint[0])) {
                    rawPoint = rawPoint[0];
                  }

                  const center = this._normalizePoint(rawPoint, true);
                  if (center) {
                    console.log(`📍 [CrosshairsHandler] Fresh read from rotationPoints: [${center[0].toFixed(2)}, ${center[1].toFixed(2)}, ${center[2].toFixed(2)}]`);
                    return center;
                  }
                }
              }

              // Debug: log what we found
              console.log(`🔍 [CrosshairsHandler] Could not extract center from this annotation`);
            }
          } catch (e) {
            console.debug(`⚠️ Error reading crosshairs from viewport ${viewport.id}:`, e);
            continue;
          }
        }
      }

      console.warn(`⚠️ [CrosshairsHandler] Could not get fresh crosshair center from annotations`);
      return null;
    } catch (error) {
      console.error(`❌ [CrosshairsHandler] Error getting fresh crosshair center:`, error);
      return null;
    }
  }

  /**
   * Refresh the global cache by finding the first viewport with crosshairs
   * and extracting the shared world coordinate
   * Optimized to stop at first valid crosshair tool found
   * @private
   */
  private _refreshGlobalCache(): void {
    try {
      const renderingEngines = getRenderingEngines();

      // Search through rendering engines and viewports to find first crosshairs tool
      // Since crosshairs are the same across all viewports, we only need the first one
      for (const engine of renderingEngines) {
        const viewports = engine.getViewports();

        for (const viewport of viewports) {
          try {
            // Skip if viewport doesn't have an element
            if (!viewport.element) {
              continue;
            }

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

            // Found a crosshairs tool! Check if it's active
            const isActive = crosshairsTool.mode === 'Active';

            if (!isActive) {
              // Tool exists but not active - since all viewports share same tool state,
              // we can stop here and cache the inactive state
              this.globalCache = {
                center: null,
                lastChecked: Date.now(),
              };
              console.warn(`⚠️ [CrosshairsHandler] Crosshairs tool found but not active`);
              return;
            }

            // Tool is active, get annotations
            const annotations = annotation.state.getAnnotations('Crosshairs', viewport.element);

            // Extract center from the first annotation
            const center = this._extractCenterFromAnnotations(annotations);

            // Cache the result (even if center is null) and return
            this.globalCache = {
              center,
              lastChecked: Date.now(),
            };

            // Only log if we don't have a valid center (potential issue)
            if (!center) {
              console.warn(`⚠️ [CrosshairsHandler] Crosshairs tool active but no center found in ${viewport.id}`);
            }
            return;

          } catch (e) {
            // Error with this viewport, try next one
            continue;
          }
        }
      }

      // If we get here, no crosshairs tool was found in any viewport
      this.globalCache = {
        center: null,
        lastChecked: Date.now(),
      };
      console.warn(`⚠️ [CrosshairsHandler] No Crosshairs tool found in any viewport`);

    } catch (error) {
      console.warn(`⚠️ [CrosshairsHandler] Error refreshing global cache:`, error.message);
      this.globalCache = {
        center: null,
        lastChecked: Date.now(),
      };
    }
  }

  /**
   * Extract center coordinates from crosshair annotations
   * Handles both array [x,y,z] and object {x,y,z} formats
   * Tries multiple possible annotation data locations
   * @private
   */
  private _extractCenterFromAnnotations(annotations: any[]): [number, number, number] | null {
    if (!annotations || annotations.length === 0) {
      return null;
    }

    const firstAnnotation = annotations[0];

    // Try multiple possible locations for the center point
    const possiblePaths = [
      // Most common locations
      () => firstAnnotation.data?.handles?.rotationPoints?.[0],
      () => firstAnnotation.data?.handles?.toolCenter,
      () => firstAnnotation.data?.handles?.activeHandleIndex !== undefined &&
            firstAnnotation.data?.handles?.points?.[0],

      // Alternative locations
      () => firstAnnotation.data?.handles?.center,
      () => firstAnnotation.data?.cachedStats?.projectionPoints?.[0],
      () => firstAnnotation.metadata?.toolCenter,

      // Direct data access
      () => firstAnnotation.data?.center,
      () => firstAnnotation.handles?.rotationPoints?.[0],
      () => firstAnnotation.handles?.toolCenter,
    ];

    // Try each path until we find valid data
    for (const getPath of possiblePaths) {
      try {
        const rawPoint = getPath();
        if (rawPoint) {
          const normalizedPoint = this._normalizePoint(rawPoint, false); // Don't log warnings for each attempt
          if (normalizedPoint) {
            return normalizedPoint;
          }
        }
      } catch (e) {
        // Path failed, try next one
        continue;
      }
    }

    // Debug: log annotation structure if we couldn't find the center
    console.warn(`⚠️ [CrosshairsHandler] Could not extract center from annotation`);
    console.log(`📋 Annotation structure:`, {
      hasData: !!firstAnnotation.data,
      hasHandles: !!firstAnnotation.data?.handles,
      handleKeys: firstAnnotation.data?.handles ? Object.keys(firstAnnotation.data.handles) : [],
      hasMetadata: !!firstAnnotation.metadata,
    });

    return null;
  }

  /**
   * Normalize point from either array [x,y,z] or object {x,y,z} format
   * Validates that coordinates are actual numbers
   * @param point - The point to normalize
   * @param logWarnings - Whether to log validation warnings (default: false)
   * @private
   */
  private _normalizePoint(point: any, logWarnings: boolean = false): [number, number, number] | null {
    if (!point) {
      return null;
    }

    let coords: [number, number, number] | null = null;

    // Handle array format
    if (Array.isArray(point) && point.length >= 3) {
      coords = [point[0], point[1], point[2]];
    }
    // Handle object format
    else if (typeof point === 'object' && 'x' in point && 'y' in point && 'z' in point) {
      coords = [point.x, point.y, point.z];
    }

    // Validate coordinates are actual numbers
    if (coords) {
      if (
        typeof coords[0] === 'number' && !isNaN(coords[0]) &&
        typeof coords[1] === 'number' && !isNaN(coords[1]) &&
        typeof coords[2] === 'number' && !isNaN(coords[2])
      ) {
        return coords;
      } else {
        if (logWarnings) {
          console.warn(`⚠️ [CrosshairsHandler] Point has invalid number values:`, coords);
        }
        return null;
      }
    }

    return null;
  }
}

// Export singleton instance
export const crosshairsHandler = new CrosshairsHandler();

// Export class for testing or custom instances
export default CrosshairsHandler;
