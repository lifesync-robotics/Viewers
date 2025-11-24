/**
 * Abstract base class for navigation modes
 *
 * All navigation modes must extend this class and implement the abstract methods.
 * This provides a consistent interface for mode switching and data handling.
 */

import { getRenderingEngine } from '@cornerstonejs/core';
import CoordinateTransformer from '../CoordinateTransformer';

/**
 * Abstract base class for navigation modes
 */
export default abstract class NavigationMode {
  protected servicesManager: any;
  protected coordinateTransformer: CoordinateTransformer;
  protected updateCount: number = 0;

  constructor(servicesManager: any, coordinateTransformer: CoordinateTransformer) {
    this.servicesManager = servicesManager;
    this.coordinateTransformer = coordinateTransformer;
  }

  /**
   * Handle tracking update - MUST be implemented by child classes
   * @param position - Tool position in DICOM coordinates [x, y, z]
   * @param orientation - Tool orientation [rx, ry, rz] (optional)
   * @param matrix - 4x4 transformation matrix (optional)
   */
  abstract handleTrackingUpdate(
    position: number[],
    orientation: number[],
    matrix?: number[] | number[][]
  ): void;

  /**
   * Called when mode is activated
   */
  abstract onModeEnter(): void;

  /**
   * Called when mode is deactivated
   */
  abstract onModeExit(): void;

  /**
   * Cleanup resources when mode is removed
   */
  abstract cleanup(): void;

  /**
   * Get mode name for identification
   */
  abstract getModeName(): string;

  /**
   * Helper: Transform coordinates from register to DICOM
   */
  protected transformCoordinates(registerPosition: number[]): number[] {
    return this.coordinateTransformer.hasTransform()
      ? this.coordinateTransformer.registerToDICOM(registerPosition)
      : registerPosition;
  }

  /**
   * Helper: Get rendering engine
   */
  protected getRenderingEngine() {
    return getRenderingEngine('OHIFCornerstoneRenderingEngine');
  }

  /**
   * Helper: Get all viewports
   */
  protected getViewports() {
    const renderingEngine = this.getRenderingEngine();
    return renderingEngine ? renderingEngine.getViewports() : [];
  }

  /**
   * Increment update counter (for logging/debugging)
   */
  protected incrementUpdateCount(): void {
    this.updateCount++;
  }

  /**
   * Get current update count
   */
  public getUpdateCount(): number {
    return this.updateCount;
  }

  /**
   * Clamp position to volume bounds to prevent "No imageId found" errors
   * Helper method available to all navigation modes
   */
  protected clampToVolumeBounds(position: number[]): number[] | null {
    try {
      const renderingEngine = this.getRenderingEngine();
      if (!renderingEngine) {
        return null;
      }

      const viewports = renderingEngine.getViewports();
      if (viewports.length === 0) {
        return null;
      }

      // Get bounds from the first volume viewport
      for (const viewport of viewports) {
        if (viewport.type === 'orthographic' || viewport.type === 'volume3d') {
          const defaultActor = viewport.getDefaultActor?.();
          if (defaultActor && defaultActor.actor) {
            const bounds = defaultActor.actor.getBounds();
            if (bounds && bounds.length === 6) {
              // bounds = [xMin, xMax, yMin, yMax, zMin, zMax]
              const [xMin, xMax, yMin, yMax, zMin, zMax] = bounds;

              // Add a small margin to avoid edge cases
              const margin = 1.0; // mm

              const clampedPosition = [
                Math.max(xMin + margin, Math.min(xMax - margin, position[0])),
                Math.max(yMin + margin, Math.min(yMax - margin, position[1])),
                Math.max(zMin + margin, Math.min(zMax - margin, position[2])),
              ];

              return clampedPosition;
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error getting volume bounds:', error);
    }

    return null;
  }
}
