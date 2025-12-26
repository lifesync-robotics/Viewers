/**
 * Screw Update Event Types
 * 
 * Refined event system to distinguish between different sources of screw dimension updates.
 * This prevents unwanted side effects like camera movement during slider drag.
 * 
 * Event Type Hierarchy:
 * 
 * 1. SLIDER_DRAG - User is actively dragging slider (in-progress)
 *    - Should update visual feedback only
 *    - NO model reload
 *    - NO backend sync
 *    - NO camera movement
 * 
 * 2. SLIDER_COMMIT - User released slider (mouse up)
 *    - Full update with model reload
 *    - Backend sync
 *    - Camera can update if needed
 * 
 * 3. DROPDOWN_SELECT - User selected from dropdown menu
 *    - Full update with model reload
 *    - Backend sync
 * 
 * 4. VIEWPORT_INTERACTION_DRAG - User is dragging screw in viewport (in-progress)
 *    - Other viewports update (edited viewport stays stationary)
 *    - NO model reload
 *    - NO backend sync
 * 
 * 5. VIEWPORT_INTERACTION - User completed screw adjustment in viewport
 *    - Full update with model reload
 *    - Backend sync
 *    - Other viewports update (edited viewport stays stationary)
 * 
 * 6. SVG_CLICK - User clicked screw in 2D SVG overlay
 *    - Navigation to screw position
 *    - May trigger dimension display
 * 
 * 7. PROGRAMMATIC - System-triggered update (restore, sync, etc.)
 *    - Full update with model reload
 *    - Backend sync
 *    - NO camera movement
 * 
 * 8. BACKEND_SYNC - Update from backend refresh
 *    - Update local state only
 *    - NO model reload (already loaded)
 *    - NO backend sync (circular)
 */

export enum ScrewUpdateEventType {
  /**
   * User is actively dragging slider (in-progress edit)
   * - Visual feedback only
   * - No model reload
   * - No backend sync
   * - No camera movement
   */
  SLIDER_DRAG = 'SLIDER_DRAG',

  /**
   * User released slider (committed edit)
   * - Full model reload
   * - Backend sync
   * - Camera can update
   */
  SLIDER_COMMIT = 'SLIDER_COMMIT',

  /**
   * User selected from dropdown menu
   * - Full model reload
   * - Backend sync
   */
  DROPDOWN_SELECT = 'DROPDOWN_SELECT',

  /**
   * User is actively dragging screw in 3D viewport (in-progress)
   * - Other viewports update (not edited viewport)
   * - No backend sync during drag
   * - Edited viewport camera stays stationary
   */
  VIEWPORT_INTERACTION_DRAG = 'VIEWPORT_INTERACTION_DRAG',

  /**
   * User completed screw adjustment in 3D viewport (mouse release)
   * - Full model reload
   * - Backend sync
   * - Other viewports update (not edited viewport)
   */
  VIEWPORT_INTERACTION = 'VIEWPORT_INTERACTION',

  /**
   * User clicked screw in 2D SVG overlay
   * - Navigation event
   * - May trigger dimension display
   */
  SVG_CLICK = 'SVG_CLICK',

  /**
   * System-triggered update (restore, sync, etc.)
   * - Full model reload
   * - Backend sync
   * - No camera movement
   */
  PROGRAMMATIC = 'PROGRAMMATIC',

  /**
   * Update from backend refresh
   * - Update local state only
   * - No model reload
   * - No backend sync
   */
  BACKEND_SYNC = 'BACKEND_SYNC',
}

/**
 * Update options based on event type
 */
export interface ScrewUpdateOptions {
  /** Should reload 3D model? */
  reloadModel: boolean;
  
  /** Should sync with backend? */
  syncBackend: boolean;
  
  /** Should update camera position? */
  updateCamera: boolean;
  
  /** Should show visual feedback (loading indicator)? */
  showFeedback: boolean;
  
  /** Should recalculate transform from cap? */
  recalculateTransform: boolean;
}

/**
 * Get update options for a specific event type
 */
export function getScrewUpdateOptions(eventType: ScrewUpdateEventType): ScrewUpdateOptions {
  switch (eventType) {
    case ScrewUpdateEventType.SLIDER_DRAG:
      return {
        reloadModel: false,        // No reload during drag
        syncBackend: false,        // No backend sync during drag
        updateCamera: false,       // No camera movement during drag
        showFeedback: false,       // No loading indicator
        recalculateTransform: false, // Keep transform stable
      };

    case ScrewUpdateEventType.SLIDER_COMMIT:
      return {
        reloadModel: true,         // Reload model on commit
        syncBackend: true,         // Sync with backend
        updateCamera: false,       // No camera movement on commit
        showFeedback: true,        // Show loading indicator
        recalculateTransform: true, // Recalculate transform
      };

    case ScrewUpdateEventType.DROPDOWN_SELECT:
      return {
        reloadModel: true,
        syncBackend: true,
        updateCamera: false,
        showFeedback: true,
        recalculateTransform: true,
      };

    case ScrewUpdateEventType.VIEWPORT_INTERACTION_DRAG:
      return {
        reloadModel: false,        // No reload during drag
        syncBackend: false,        // No backend sync during drag
        updateCamera: true,        // Other viewports update (edited viewport excluded by tool)
        showFeedback: false,       // No loading indicator during drag
        recalculateTransform: false, // Transform updated by tool directly
      };

    case ScrewUpdateEventType.VIEWPORT_INTERACTION:
      return {
        reloadModel: true,         // Reload on commit
        syncBackend: true,         // Sync with backend on commit
        updateCamera: true,        // Other viewports update (edited viewport excluded by tool)
        showFeedback: true,
        recalculateTransform: true,
      };

    case ScrewUpdateEventType.SVG_CLICK:
      return {
        reloadModel: false,        // Navigation only
        syncBackend: false,
        updateCamera: true,        // Jump to screw
        showFeedback: false,
        recalculateTransform: false,
      };

    case ScrewUpdateEventType.PROGRAMMATIC:
      return {
        reloadModel: true,
        syncBackend: true,
        updateCamera: false,       // No camera movement for system updates
        showFeedback: true,
        recalculateTransform: true,
      };

    case ScrewUpdateEventType.BACKEND_SYNC:
      return {
        reloadModel: false,        // Already loaded
        syncBackend: false,        // Circular sync
        updateCamera: false,
        showFeedback: false,
        recalculateTransform: false,
      };

    default:
      // Safe defaults: full update
      return {
        reloadModel: true,
        syncBackend: true,
        updateCamera: false,
        showFeedback: true,
        recalculateTransform: true,
      };
  }
}

/**
 * Event payload for screw dimension updates
 */
export interface ScrewDimensionUpdateEvent {
  /** Event type (source of update) */
  eventType: ScrewUpdateEventType;
  
  /** Screw data being updated */
  screwData: any;
  
  /** New radius (diameter/2), if updated */
  newRadius?: number;
  
  /** New length, if updated */
  newLength?: number;
  
  /** Additional context/metadata */
  metadata?: {
    /** Is this part of a linked update? */
    isLinked?: boolean;
    
    /** Original event source (e.g., viewportId) */
    source?: string;
    
    /** Timestamp */
    timestamp?: number;
  };
}

/**
 * Helper to create a dimension update event
 */
export function createScrewUpdateEvent(
  eventType: ScrewUpdateEventType,
  screwData: any,
  newRadius?: number,
  newLength?: number,
  metadata?: any
): ScrewDimensionUpdateEvent {
  return {
    eventType,
    screwData,
    newRadius,
    newLength,
    metadata: {
      ...metadata,
      timestamp: Date.now(),
    },
  };
}

