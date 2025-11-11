/**
 * Fiducial Marker Tool
 * Creates 3D sphere markers for registration purposes
 *
 * Based on Cornerstone3D annotation tools
 * Renders spheres that are visible in all MPR views
 */

import { vec3 } from 'gl-matrix';
import {
  AnnotationTool,
  Enums as csToolsEnums,
  annotation,
  drawing,
  eventTarget,
  triggerEvent,
  utilities as csToolsUtils,
} from '@cornerstonejs/tools';
import { Types as cs3DTypes, utilities as csUtils, getEnabledElement } from '@cornerstonejs/core';

const { MouseBindings } = csToolsEnums;

/**
 * Fiducial Marker Annotation
 */
interface FiducialMarkerAnnotation extends annotation.Annotation {
  data: {
    handles: {
      points: cs3DTypes.Point3[]; // World coordinates [x, y, z]
    };
    label?: string;
    radius?: number; // Sphere radius in mm
  };
}

/**
 * FiducialMarkerTool class for creating 3D sphere markers
 */
class FiducialMarkerTool extends AnnotationTool {
  static toolName = 'FiducialMarker';

  // Default configuration
  private defaultRadius = 0.5; // mm (small fixed circle)
  private defaultColor = [255, 255, 0]; // Yellow

  constructor(
    toolProps = {},
    defaultToolProps = {
      supportedInteractionTypes: ['Mouse', 'Touch'],
      configuration: {
        radius: 0.5, // Fixed circle radius in mm
        preventHandleOutsideImage: false,
      },
    }
  ) {
    super(toolProps, defaultToolProps);
  }

  /**
   * Add new annotation on click
   */
  addNewAnnotation = (evt: any): FiducialMarkerAnnotation => {
    const eventDetail = evt.detail;
    const { currentPoints, element } = eventDetail;
    const worldPos = currentPoints.world;

    const enabledElement = getEnabledElement(element);
    const { viewport, renderingEngine } = enabledElement;

    this.isDrawing = true;

    // Create annotation
    const annotation: FiducialMarkerAnnotation = {
      annotationUID: csUtils.uuidv4(),
      highlighted: true,
      invalidated: true,
      metadata: {
        viewPlaneNormal: [0, 0, 1], // Will be updated
        viewUp: [0, -1, 0],
        FrameOfReferenceUID: viewport.getFrameOfReferenceUID(),
        referencedImageId: '',
        toolName: FiducialMarkerTool.toolName,
      },
      data: {
        label: `F${annotation.state.getNumberOfAnnotations(FiducialMarkerTool.toolName, element) + 1}`,
        handles: {
          points: [[...worldPos] as cs3DTypes.Point3],
        },
        radius: this.configuration.radius || this.defaultRadius,
      },
    };

    annotation.state.addAnnotation(annotation, element);

    const viewportIdsToRender = csToolsUtils.getViewportIdsWithToolToRender(
      element,
      FiducialMarkerTool.toolName
    );

    this.editData = {
      annotation,
      viewportIdsToRender,
      handleIndex: 0,
      movingTextBox: false,
      newAnnotation: true,
      hasMoved: false,
    };

    this._activateModify(element);

    evt.preventDefault();

    // Trigger annotation completed event
    const eventType = csToolsEnums.Events.ANNOTATION_COMPLETED;
    const completedEventDetail = {
      annotation,
    };

    triggerEvent(eventTarget, eventType, completedEventDetail);

    return annotation;
  };

  /**
   * Check if mouse is near annotation (for interaction)
   */
  isPointNearTool = (element: HTMLDivElement, annotation: FiducialMarkerAnnotation, canvasCoords: cs3DTypes.Point2, proximity: number): boolean => {
    const enabledElement = getEnabledElement(element);
    const { viewport } = enabledElement;

    const { data } = annotation;
    const point = data.handles.points[0];

    // Project 3D point to canvas
    const canvasPoint = viewport.worldToCanvas(point);

    // Calculate distance in canvas space
    const dist = vec3.distance([canvasPoint[0], canvasPoint[1], 0], [canvasCoords[0], canvasCoords[1], 0]);

    return dist < proximity;
  };

  /**
   * Tool-specific annotation style
   */
  toolSelectedCallback = (evt: any, annotation: FiducialMarkerAnnotation): void => {
    annotation.highlighted = true;
  };

  /**
   * Render the annotation
   */
  renderAnnotation = (enabledElement: cs3DTypes.IEnabledElement, svgDrawingHelper: any): boolean => {
    let renderStatus = false;
    const { viewport } = enabledElement;
    const { element } = viewport;

    const annotations = annotation.state.getAnnotations(FiducialMarkerTool.toolName, element);

    // Debug: Log rendering calls
    // console.log(`🎨 [FiducialMarker renderAnnotation] viewport=${viewport.id}, found ${annotations?.length || 0} annotations`);

    if (!annotations?.length) {
      return renderStatus;
    }

    // Style configuration
    const styleSpecifier: any = {
      toolGroupId: this.toolGroupId,
      toolName: FiducialMarkerTool.toolName,
      viewportId: enabledElement.viewport.id,
    };

    for (const annotation of annotations) {
      const { annotationUID, data, highlighted, metadata } = annotation as FiducialMarkerAnnotation;
      const { points } = data.handles;
      const point = points[0];

      styleSpecifier.annotationUID = annotationUID;

      const color = this.getStyle('color', styleSpecifier, annotation);
      const lineWidth = this.getStyle('lineWidth', styleSpecifier, annotation);
      const lineDash = this.getStyle('lineDash', styleSpecifier, annotation);

      // Check if point is valid
      if (!point || point.length !== 3) {
        console.warn('⚠️ Invalid point for fiducial:', point);
        continue;
      }

      // Ensure point is a clean numeric array for worldToCanvas
      const worldPoint: cs3DTypes.Point3 = [
        Number(point[0]),
        Number(point[1]),
        Number(point[2])
      ];

      // Get camera to check if point is on current slice
      const camera = viewport.getCamera();
      const viewPlaneNormal = camera.viewPlaneNormal;
      const focalPoint = camera.focalPoint;

      // Calculate distance from point to current slice plane
      // Distance = dot product of (point - focalPoint) with viewPlaneNormal
      const dx = worldPoint[0] - focalPoint[0];
      const dy = worldPoint[1] - focalPoint[1];
      const dz = worldPoint[2] - focalPoint[2];
      const distance = Math.abs(
        dx * viewPlaneNormal[0] +
        dy * viewPlaneNormal[1] +
        dz * viewPlaneNormal[2]
      );

      // Get slice spacing/thickness for this viewport
      // Typical slice spacing is 1-5mm, use a threshold
      const sliceThreshold = 5.0; // mm - increased from 2.0 to 5.0 for better visibility

      // Debug: Log slice check
      console.log(`🎯 [${data.label}] distance=${distance.toFixed(2)}mm, threshold=${sliceThreshold}mm, visible=${distance <= sliceThreshold}`);

      if (distance > sliceThreshold) {
        // Point is not on this slice, skip rendering
        continue;
      }

      // Project point to canvas (world coordinates → canvas coordinates)
      const canvasPoint = viewport.worldToCanvas(worldPoint);

      // Check if point is valid (within viewport bounds)
      if (!canvasPoint || isNaN(canvasPoint[0]) || isNaN(canvasPoint[1])) {
        console.warn(`⚠️ Cannot project point to canvas in viewport ${viewport.id}`);
        continue;
      }

      // Fixed radius: 0.5mm in world space
      const fixedRadiusMm = 0.5;

      // Calculate circle radius in canvas units by projecting a point offset by the radius
      const radiusPointWorld: cs3DTypes.Point3 = [
        worldPoint[0] + fixedRadiusMm,
        worldPoint[1],
        worldPoint[2]
      ];
      const radiusPointCanvas = viewport.worldToCanvas(radiusPointWorld);

      // Calculate radius in canvas pixels
      let canvasRadius = Math.abs(radiusPointCanvas[0] - canvasPoint[0]);

      // Fallback to a fixed pixel size if calculation fails
      if (isNaN(canvasRadius) || canvasRadius < 2) {
        canvasRadius = 5; // 5 pixels minimum for visibility
      }

      // Draw simple circle (0.5mm sphere in 2D projection)
      const circleUID = `${annotationUID}-circle`;
      drawing.drawCircle(
        svgDrawingHelper,
        annotationUID,
        circleUID,
        canvasPoint,
        canvasRadius,
        {
          color,
          lineDash: '',
          lineWidth: 2,
          fill: color, // Solid fill
        }
      );

      // Draw label next to circle
      if (data.label) {
        const textLines = [`${data.label}`];
        const textCanvasPoint: cs3DTypes.Point2 = [
          canvasPoint[0] + canvasRadius + 5,
          canvasPoint[1] - 5,
        ];

        const textUID = `${annotationUID}-text`;
        drawing.drawTextBox(
          svgDrawingHelper,
          annotationUID,
          textUID,
          textLines,
          textCanvasPoint,
          {
            color,
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontSize: '12px',
          }
        );
      }

      renderStatus = true;
    }

    return renderStatus;
  };

  /**
   * Cancel drawing
   */
  cancel = (element: HTMLDivElement) => {
    if (this.isDrawing) {
      this.isDrawing = false;
      this._deactivateModify(element);
      this._deactivateDraw(element);

      const annotations = annotation.state.getAnnotations(FiducialMarkerTool.toolName, element);
      const lastAnnotation = annotations[annotations.length - 1];

      if (lastAnnotation && this.editData?.newAnnotation) {
        annotation.state.removeAnnotation(lastAnnotation.annotationUID);
      }

      this.editData = null;
      return lastAnnotation?.annotationUID;
    }
  };
}

export default FiducialMarkerTool;
