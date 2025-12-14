/**
 * ROI Selection Types
 *
 * Uses rectangle annotations on coronal and sagittal views to define the ROI region.
 * The system then zooms/pans the camera to focus on the ROI - NO clipping or new DICOM generation.
 *
 * Workflow:
 * 1. User activates ROI mode - preset rectangles appear on coronal and sagittal views
 * 2. User adjusts rectangles by dragging/resizing
 * 3. System calculates 3D bounds from rectangle intersection
 * 4. User confirms - camera zooms to focus on ROI region
 */

/**
 * 2D rectangle bounds in world coordinates
 */
export interface Rectangle2DBounds {
  /** Minimum value on horizontal axis */
  min1: number;
  /** Maximum value on horizontal axis */
  max1: number;
  /** Minimum value on vertical axis */
  min2: number;
  /** Maximum value on vertical axis */
  max2: number;
}

/**
 * Rectangle annotation info
 */
export interface RectangleAnnotationInfo {
  /** Annotation UID for tracking */
  annotationUID: string;
  /** Viewport orientation */
  viewportType: 'coronal' | 'sagittal';
  /** Rectangle bounds in world coordinates */
  bounds: Rectangle2DBounds;
}

/**
 * 3D bounding box in world coordinates
 */
export interface ROI3DBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

/**
 * Complete ROI selection state
 */
export interface ROISelection {
  /** Coronal rectangle annotation */
  coronalRect?: RectangleAnnotationInfo;
  /** Sagittal rectangle annotation */
  sagittalRect?: RectangleAnnotationInfo;
  /** Calculated 3D world bounds */
  worldBounds?: ROI3DBounds;
  /** Whether both rectangles are defined */
  isComplete: boolean;
  /** Whether camera has been zoomed to ROI */
  isApplied: boolean;
}

/**
 * Volume information for coordinate calculations
 */
export interface VolumeInfo {
  volumeId: string;
  dimensions: [number, number, number];
  spacing: [number, number, number];
  origin: [number, number, number];
  direction: number[];
  bounds: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    zMin: number;
    zMax: number;
  };
}

/**
 * Default ROI size for spine (in mm)
 */
export const DEFAULT_ROI_SIZE = {
  /** X extent (left-right) */
  xExtent: 120,
  /** Y extent (anterior-posterior) */
  yExtent: 80,
  /** Z extent (superior-inferior) */
  zExtent: 150,
} as const;

/**
 * Selection mode states
 */
export type SelectionMode = 'idle' | 'selecting' | 'confirmed' | 'applied';

/**
 * Events emitted by ROISelectionService
 */
export const ROI_SELECTION_EVENTS = {
  /** ROI selection mode started */
  SELECTION_STARTED: 'roiSelectionStarted',
  /** Rectangle annotation updated */
  RECTANGLE_UPDATED: 'rectangleUpdated',
  /** ROI bounds recalculated */
  BOUNDS_UPDATED: 'boundsUpdated',
  /** Selection confirmed by user */
  SELECTION_CONFIRMED: 'roiSelectionConfirmed',
  /** Camera zoomed to ROI */
  ROI_APPLIED: 'roiApplied',
  /** ROI reset/cleared */
  ROI_RESET: 'roiReset',
} as const;
