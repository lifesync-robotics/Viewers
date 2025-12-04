/**
 * OrientationMarkerRenderer - Defensive Programming Pattern
 * 
 * This class implements graceful handling of viewport initialization issues
 * when working with OrientationMarker tools in Cornerstone3D.
 * 
 * Key defensive patterns:
 * 1. Viewport status checking before operations
 * 2. Event-driven initialization with ELEMENT_ENABLED
 * 3. Safe null/iterator checking with try-catch blocks
 * 4. Guard clauses for early exit
 * 5. Debouncing to prevent redundant updates
 */

import { Types, Enums, getRenderingEngine } from '@cornerstonejs/core';

/**
 * Viewport readiness states
 * Based on Cornerstone3D internal viewport lifecycle
 */
enum ViewportReadiness {
  NOT_READY = 'NOT_READY',       // Viewport just created
  INITIALIZING = 'INITIALIZING', // Viewport being set up
  READY = 'READY',                // Viewport has image data and can be used
  ERROR = 'ERROR',                // Viewport encountered an error
  DESTROYED = 'DESTROYED'         // Viewport has been cleaned up
}

interface OrientationMarkerConfig {
  renderingEngineId: string;
  viewportId: string;
  toolName: string;
  toolGroupId?: string;
  configuration?: any;
}

export class OrientationMarkerRenderer {
  private renderingEngineId: string;
  private viewportId: string;
  private toolName: string;
  private toolGroupId?: string;
  private configuration: any;
  private readiness: ViewportReadiness = ViewportReadiness.NOT_READY;
  private eventListeners: Map<string, EventListener> = new Map();
  private initializationPromise: Promise<boolean> | null = null;

  constructor(config: OrientationMarkerConfig) {
    this.renderingEngineId = config.renderingEngineId;
    this.viewportId = config.viewportId;
    this.toolName = config.toolName;
    this.toolGroupId = config.toolGroupId;
    this.configuration = config.configuration || {};
  }

  /**
   * PATTERN 1: Check viewport existence and readiness
   * Returns the viewport only if it's safe to use
   */
  private getViewportSafely(): Types.IViewport | null {
    try {
      const renderingEngine = getRenderingEngine(this.renderingEngineId);
      
      // Guard: Check rendering engine exists
      if (!renderingEngine) {
        console.debug(`[OrientationMarker] Rendering engine ${this.renderingEngineId} not found`);
        return null;
      }

      const viewport = renderingEngine.getViewport(this.viewportId);
      
      // Guard: Check viewport exists
      if (!viewport) {
        console.debug(`[OrientationMarker] Viewport ${this.viewportId} not found`);
        return null;
      }

      return viewport;
    } catch (error) {
      console.warn(`[OrientationMarker] Error getting viewport:`, error);
      return null;
    }
  }

  /**
   * PATTERN 2: Check if viewport has required data
   * Performs comprehensive readiness checks
   */
  private isViewportReady(): boolean {
    const viewport = this.getViewportSafely();
    
    if (!viewport) {
      return false;
    }

    try {
      // Check if viewport has an element attached
      if (!viewport.element) {
        console.debug(`[OrientationMarker] Viewport ${this.viewportId} has no element`);
        return false;
      }

      // Check if viewport has a canvas
      const canvas = viewport.canvas;
      if (!canvas) {
        console.debug(`[OrientationMarker] Viewport ${this.viewportId} has no canvas`);
        return false;
      }

      // Check if viewport has camera data (critical for orientation markers)
      const camera = viewport.getCamera?.();
      if (!camera) {
        console.debug(`[OrientationMarker] Viewport ${this.viewportId} has no camera`);
        return false;
      }

      // For stack/volume viewports, check for image data
      if ('hasImageData' in viewport && typeof viewport.hasImageData === 'function') {
        const hasData = viewport.hasImageData();
        if (!hasData) {
          console.debug(`[OrientationMarker] Viewport ${this.viewportId} has no image data`);
          return false;
        }
      }

      // Additional check: try to get image data if available
      if ('getImageData' in viewport && typeof viewport.getImageData === 'function') {
        try {
          const imageData = viewport.getImageData?.();
          if (!imageData) {
            console.debug(`[OrientationMarker] Viewport ${this.viewportId} image data is null`);
            return false;
          }
        } catch (error) {
          console.debug(`[OrientationMarker] Error getting image data:`, error);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.warn(`[OrientationMarker] Error checking viewport readiness:`, error);
      return false;
    }
  }

  /**
   * PATTERN 3: Event-driven initialization
   * Waits for ELEMENT_ENABLED event to ensure viewport is ready
   */
  private waitForViewportReady(timeoutMs: number = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      const viewport = this.getViewportSafely();
      
      if (!viewport) {
        console.warn(`[OrientationMarker] Cannot wait for viewport - not found`);
        resolve(false);
        return;
      }

      // If already ready, resolve immediately
      if (this.isViewportReady()) {
        console.log(`[OrientationMarker] Viewport ${this.viewportId} is already ready`);
        this.readiness = ViewportReadiness.READY;
        resolve(true);
        return;
      }

      const element = viewport.element;
      if (!element) {
        console.warn(`[OrientationMarker] No element to attach event listener`);
        resolve(false);
        return;
      }

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          console.warn(`[OrientationMarker] Timeout waiting for viewport ${this.viewportId} to be ready`);
          this.readiness = ViewportReadiness.ERROR;
          resolve(false);
        }
      }, timeoutMs);

      const handleElementEnabled = (event: Event) => {
        if (!resolved) {
          const customEvent = event as CustomEvent;
          const { viewportId } = customEvent.detail || {};
          
          if (viewportId === this.viewportId) {
            resolved = true;
            cleanup();
            console.log(`[OrientationMarker] Viewport ${this.viewportId} enabled via event`);
            
            // Double-check readiness after event
            if (this.isViewportReady()) {
              this.readiness = ViewportReadiness.READY;
              resolve(true);
            } else {
              console.warn(`[OrientationMarker] Viewport enabled but still not ready`);
              this.readiness = ViewportReadiness.ERROR;
              resolve(false);
            }
          }
        }
      };

      const handleImageRendered = (event: Event) => {
        if (!resolved && this.isViewportReady()) {
          resolved = true;
          cleanup();
          console.log(`[OrientationMarker] Viewport ${this.viewportId} ready via IMAGE_RENDERED`);
          this.readiness = ViewportReadiness.READY;
          resolve(true);
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        if (element) {
          element.removeEventListener(Enums.Events.ELEMENT_ENABLED, handleElementEnabled);
          element.removeEventListener(Enums.Events.IMAGE_RENDERED, handleImageRendered);
        }
      };

      // Listen for both events
      element.addEventListener(Enums.Events.ELEMENT_ENABLED, handleElementEnabled);
      element.addEventListener(Enums.Events.IMAGE_RENDERED, handleImageRendered);

      this.eventListeners.set('enabled', handleElementEnabled);
      this.eventListeners.set('rendered', handleImageRendered);
    });
  }

  /**
   * PATTERN 4: Safe initialization with comprehensive checks
   * Main entry point for initializing the orientation marker
   */
  async initialize(): Promise<boolean> {
    // Prevent multiple simultaneous initializations
    if (this.initializationPromise) {
      console.debug(`[OrientationMarker] Initialization already in progress for ${this.viewportId}`);
      return this.initializationPromise;
    }

    this.initializationPromise = this._doInitialize();
    const result = await this.initializationPromise;
    this.initializationPromise = null;
    
    return result;
  }

  private async _doInitialize(): Promise<boolean> {
    console.log(`[OrientationMarker] Initializing for viewport ${this.viewportId}...`);
    this.readiness = ViewportReadiness.INITIALIZING;

    try {
      // Step 1: Check if viewport exists
      const viewport = this.getViewportSafely();
      if (!viewport) {
        console.warn(`[OrientationMarker] Viewport ${this.viewportId} not found during initialization`);
        this.readiness = ViewportReadiness.ERROR;
        return false;
      }

      // Step 2: Check immediate readiness
      if (this.isViewportReady()) {
        console.log(`[OrientationMarker] Viewport ${this.viewportId} is immediately ready`);
        this.readiness = ViewportReadiness.READY;
        return true;
      }

      // Step 3: Wait for viewport to become ready
      console.log(`[OrientationMarker] Waiting for viewport ${this.viewportId} to be ready...`);
      const isReady = await this.waitForViewportReady();
      
      if (!isReady) {
        console.warn(`[OrientationMarker] Viewport ${this.viewportId} failed to become ready`);
        this.readiness = ViewportReadiness.ERROR;
        return false;
      }

      console.log(`[OrientationMarker] Successfully initialized for viewport ${this.viewportId}`);
      this.readiness = ViewportReadiness.READY;
      return true;

    } catch (error) {
      console.error(`[OrientationMarker] Error during initialization:`, error);
      this.readiness = ViewportReadiness.ERROR;
      return false;
    }
  }

  /**
   * PATTERN 5: Safe rendering with guard clauses
   * Only attempts to render if viewport is ready
   */
  canRender(): boolean {
    // Guard: Check initialization state
    if (this.readiness !== ViewportReadiness.READY) {
      console.debug(`[OrientationMarker] Cannot render - not ready (state: ${this.readiness})`);
      return false;
    }

    // Guard: Check viewport is still valid
    if (!this.isViewportReady()) {
      console.debug(`[OrientationMarker] Cannot render - viewport no longer ready`);
      this.readiness = ViewportReadiness.ERROR;
      return false;
    }

    return true;
  }

  /**
   * PATTERN 6: Safe property access
   * Safely gets viewport properties with fallback values
   */
  getViewportInfo(): { camera: any; imageData: any; element: any } | null {
    if (!this.canRender()) {
      return null;
    }

    try {
      const viewport = this.getViewportSafely();
      if (!viewport) {
        return null;
      }

      const camera = viewport.getCamera?.();
      const element = viewport.element;
      
      let imageData = null;
      if ('getImageData' in viewport && typeof viewport.getImageData === 'function') {
        try {
          imageData = viewport.getImageData?.();
        } catch (error) {
          console.debug(`[OrientationMarker] Could not get image data:`, error);
        }
      }

      return { camera, imageData, element };
    } catch (error) {
      console.error(`[OrientationMarker] Error getting viewport info:`, error);
      return null;
    }
  }

  /**
   * PATTERN 7: Graceful cleanup
   * Removes event listeners and clears state
   */
  destroy(): void {
    console.log(`[OrientationMarker] Destroying renderer for viewport ${this.viewportId}`);
    
    // Remove all event listeners
    const viewport = this.getViewportSafely();
    if (viewport?.element) {
      this.eventListeners.forEach((listener, key) => {
        viewport.element.removeEventListener(key, listener);
      });
    }
    
    this.eventListeners.clear();
    this.readiness = ViewportReadiness.DESTROYED;
    this.initializationPromise = null;
  }

  /**
   * Get current readiness state
   */
  getReadinessState(): ViewportReadiness {
    return this.readiness;
  }

  /**
   * Check if renderer is ready
   */
  isReady(): boolean {
    return this.readiness === ViewportReadiness.READY && this.isViewportReady();
  }
}

/**
 * Utility function to create and initialize orientation marker renderers
 * for multiple viewports
 */
export async function initializeOrientationMarkers(
  renderingEngineId: string,
  viewportIds: string[],
  toolName: string,
  configuration?: any
): Promise<Map<string, OrientationMarkerRenderer>> {
  const renderers = new Map<string, OrientationMarkerRenderer>();

  console.log(`[OrientationMarker] Initializing for ${viewportIds.length} viewports...`);

  const initPromises = viewportIds.map(async (viewportId) => {
    const renderer = new OrientationMarkerRenderer({
      renderingEngineId,
      viewportId,
      toolName,
      configuration,
    });

    const success = await renderer.initialize();
    
    if (success) {
      renderers.set(viewportId, renderer);
      console.log(`✅ [OrientationMarker] Successfully initialized for ${viewportId}`);
    } else {
      console.warn(`⚠️ [OrientationMarker] Failed to initialize for ${viewportId}`);
    }

    return { viewportId, success };
  });

  const results = await Promise.all(initPromises);
  
  const successCount = results.filter(r => r.success).length;
  console.log(`[OrientationMarker] Initialized ${successCount}/${viewportIds.length} viewports`);

  return renderers;
}

/**
 * Utility function to safely cleanup all orientation marker renderers
 */
export function cleanupOrientationMarkers(
  renderers: Map<string, OrientationMarkerRenderer>
): void {
  console.log(`[OrientationMarker] Cleaning up ${renderers.size} renderers...`);
  
  renderers.forEach((renderer, viewportId) => {
    try {
      renderer.destroy();
    } catch (error) {
      console.warn(`[OrientationMarker] Error destroying renderer for ${viewportId}:`, error);
    }
  });
  
  renderers.clear();
  console.log(`[OrientationMarker] Cleanup complete`);
}

export default OrientationMarkerRenderer;

