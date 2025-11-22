/**
 * Tool Projection Renderer
 *
 * Renders tool Z-axis and extension line projection on fixed viewports.
 * Uses SVG overlay to draw projections without affecting viewport camera.
 */

import { getRenderingEngine } from '@cornerstonejs/core';
import { vec3 } from 'gl-matrix';

export interface ToolRepresentation {
  origin: number[]; // [x, y, z] in world coordinates
  zAxis: number[]; // [x, y, z] normalized direction vector
  extensionLength: number; // Length of extension line in mm (default: 100mm = 10cm)
  tipPoint?: number[]; // Calculated: origin + zAxis * extensionLength
}

export class ToolProjectionRenderer {
  private servicesManager: any;
  private projectionSVGElements: Map<string, SVGElement> = new Map(); // viewportId -> SVG element
  private extensionLength: number = 200; // 200mm = 20cm default (increased for better visibility)
  private debugCount: Map<string, number> = new Map(); // Per-viewport debug counter

  constructor(servicesManager: any, extensionLength: number = 200) {
    this.servicesManager = servicesManager;
    this.extensionLength = extensionLength;
  }

  /**
   * Update projection for all viewports
   * Only renders on ORTHOGRAPHIC (MPR) viewports, not on 3D or stack viewports
   */
  public updateProjection(toolRep: ToolRepresentation): void {
    const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
    if (!renderingEngine) {
      return;
    }

    // Calculate tip point if not provided
    const tipPoint = toolRep.tipPoint || this._calculateTipPoint(toolRep);

    const viewports = renderingEngine.getViewports();

    viewports.forEach(viewport => {
      // Skip non-MPR viewports
      // - stack viewports: 2D image stacks
      // - volume3d viewports: 3D rendering
      // Only render on orthographic (MPR) viewports: Axial, Sagittal, Coronal
      if (viewport.type === 'stack') {
        return; // Skip stack viewports
      }

      // Check if this is a 3D viewport by checking viewport class
      const viewportClassName = viewport.constructor.name;
      if (viewportClassName === 'VolumeViewport3D') {
        return; // Skip 3D viewports
      }

      this._renderProjectionOnViewport(viewport, toolRep.origin, tipPoint, toolRep.zAxis);
    });
  }

  /**
   * Calculate tip point: origin + zAxis * extensionLength
   */
  private _calculateTipPoint(toolRep: ToolRepresentation): number[] {
    const zAxis = vec3.fromValues(
      toolRep.zAxis[0],
      toolRep.zAxis[1],
      toolRep.zAxis[2]
    );

    // Scale zAxis by extension length
    vec3.scale(zAxis, zAxis, toolRep.extensionLength);

    return [
      toolRep.origin[0] + zAxis[0],
      toolRep.origin[1] + zAxis[1],
      toolRep.origin[2] + zAxis[2]
    ];
  }

  /**
   * Render projection on a single viewport with correct plane intersection math
   *
   * For MPR viewports, we need to:
   * 1. Calculate if/where the tool intersects the MPR slice plane
   * 2. Draw the intersection correctly, not just project 3D points
   */
  private _renderProjectionOnViewport(
    viewport: any,
    origin: number[],
    tipPoint: number[],
    zAxis: number[]
  ): void {
    // Increment debug counter for this viewport
    const currentCount = this.debugCount.get(viewport.id) || 0;
    this.debugCount.set(viewport.id, currentCount + 1);
    const shouldLog = currentCount < 5; // Log first 5 times per viewport

    try {
      // Get viewport name for debugging
      const viewportName = viewport.id || 'unknown';
      
      if (shouldLog) {
        console.log(`\n🎯 ====== PROJECTION RENDER [${viewportName}] (call #${currentCount + 1}) ======`);
        console.log(`📍 Tool Origin: [${origin.map(v => v.toFixed(1)).join(', ')}]`);
        console.log(`📍 Tool Tip: [${tipPoint.map(v => v.toFixed(1)).join(', ')}]`);
        console.log(`📍 Tool Z-Axis: [${zAxis.map(v => v.toFixed(3)).join(', ')}]`);
        console.log(`📏 Extension Length: ${this.extensionLength}mm (${this.extensionLength / 10}cm)`);
      }

      // Get viewport camera info
      const camera = viewport.getCamera();
      const planeNormal = vec3.fromValues(
        camera.viewPlaneNormal[0],
        camera.viewPlaneNormal[1],
        camera.viewPlaneNormal[2]
      );
      const planePoint = vec3.fromValues(
        camera.focalPoint[0],
        camera.focalPoint[1],
        camera.focalPoint[2]
      );

      if (shouldLog) {
        console.log(`\n📐 Viewport Plane Info:`);
        console.log(`   Plane Normal: [${planeNormal[0].toFixed(3)}, ${planeNormal[1].toFixed(3)}, ${planeNormal[2].toFixed(3)}]`);
        console.log(`   Plane Point (focal): [${planePoint[0].toFixed(1)}, ${planePoint[1].toFixed(1)}, ${planePoint[2].toFixed(1)}]`);
        
        // Identify plane type based on normal
        let planeType = 'Unknown';
        if (Math.abs(planeNormal[2]) > 0.9) planeType = 'Axial (Z-normal)';
        else if (Math.abs(planeNormal[0]) > 0.9) planeType = 'Sagittal (X-normal)';
        else if (Math.abs(planeNormal[1]) > 0.9) planeType = 'Coronal (Y-normal)';
        console.log(`   Plane Type: ${planeType}`);
      }

      // Calculate tool line intersection with MPR plane
      const originVec = vec3.fromValues(origin[0], origin[1], origin[2]);
      const tipVec = vec3.fromValues(tipPoint[0], tipPoint[1], tipPoint[2]);
      const toolDirection = vec3.subtract(vec3.create(), tipVec, originVec);
      const toolLength = vec3.length(toolDirection);
      vec3.normalize(toolDirection, toolDirection);

      if (shouldLog) {
        console.log(`\n🔧 Tool Line Info:`);
        console.log(`   Direction (normalized): [${toolDirection[0].toFixed(3)}, ${toolDirection[1].toFixed(3)}, ${toolDirection[2].toFixed(3)}]`);
        console.log(`   Length: ${toolLength.toFixed(2)}mm`);
      }

      // Line-plane intersection math:
      // Plane equation: n · (P - P0) = 0, where n = planeNormal, P0 = planePoint
      // Line equation: P = origin + t * toolDirection
      // Solve for t: t = n · (P0 - origin) / (n · toolDirection)

      const originToPlane = vec3.subtract(vec3.create(), planePoint, originVec);
      const numerator = vec3.dot(planeNormal, originToPlane);
      const denominator = vec3.dot(planeNormal, toolDirection);

      if (shouldLog) {
        console.log(`\n🧮 Intersection Math:`);
        console.log(`   Numerator (n · (P0 - origin)): ${numerator.toFixed(4)}`);
        console.log(`   Denominator (n · direction): ${denominator.toFixed(4)}`);
      }

      // Check if line is parallel to plane
      const PARALLEL_THRESHOLD = 0.001;
      if (Math.abs(denominator) < PARALLEL_THRESHOLD) {
        // Tool is parallel to plane
        // Check if origin is close to plane (within 1mm)
        const distanceToPlane = Math.abs(vec3.dot(planeNormal, originToPlane));

        if (shouldLog) {
          console.log(`   ⚠️ Tool is PARALLEL to plane`);
          console.log(`   Distance to plane: ${distanceToPlane.toFixed(2)}mm`);
        }

        if (distanceToPlane < 1.0) {
          // Tool is on or very close to plane - project entire line
          if (shouldLog) {
            console.log(`   ✅ Tool is ON the plane - showing projected line (dashed)`);
          }
          this._renderProjectedLine(viewport, originVec, tipVec);
        } else {
          // Tool is parallel but far from plane - don't show
          if (shouldLog) {
            console.log(`   ❌ Tool is too far from plane - not showing`);
          }
          this._clearViewportProjection(viewport.id);
        }
        return;
      }

      // Calculate intersection parameter t
      const t = numerator / denominator;

      if (shouldLog) {
        console.log(`   t parameter: ${t.toFixed(4)}`);
        console.log(`   t range: [0, ${toolLength.toFixed(2)}]`);
      }

      // Check if intersection is within tool segment
      if (t < 0 || t > toolLength) {
        const originDistance = Math.abs(vec3.dot(planeNormal, vec3.subtract(vec3.create(), originVec, planePoint)));
        const tipDistance = Math.abs(vec3.dot(planeNormal, vec3.subtract(vec3.create(), tipVec, planePoint)));

        if (shouldLog) {
          console.log(`   ⚠️ Intersection OUTSIDE tool segment`);
          console.log(`   Origin distance from plane: ${originDistance.toFixed(2)}mm`);
          console.log(`   Tip distance from plane: ${tipDistance.toFixed(2)}mm`);
        }

        const MIN_DISTANCE = 5.0; // 5mm threshold
        if (originDistance < MIN_DISTANCE || tipDistance < MIN_DISTANCE) {
          if (shouldLog) {
            console.log(`   ✅ Close enough - showing projected line (dashed)`);
          }
          this._renderProjectedLine(viewport, originVec, tipVec);
        } else {
          if (shouldLog) {
            console.log(`   ❌ Too far - not showing`);
          }
          this._clearViewportProjection(viewport.id);
        }
        return;
      }

      // Calculate intersection point
      const intersectionPoint = vec3.scaleAndAdd(vec3.create(), originVec, toolDirection, t);
      
      if (shouldLog) {
        console.log(`   ✅ INTERSECTION FOUND!`);
        console.log(`   Intersection point: [${intersectionPoint[0].toFixed(1)}, ${intersectionPoint[1].toFixed(1)}, ${intersectionPoint[2].toFixed(1)}]`);
        console.log(`   → Drawing SOLID GREEN line from origin to intersection`);
      }

      this._renderIntersectionLine(viewport, originVec, intersectionPoint);

    } catch (error) {
      console.error(`❌ Error rendering projection on ${viewport.id}:`, error);
      // Fallback to simple worldToCanvas projection if complex math fails
      this._renderSimpleProjectionFallback(viewport, origin, tipPoint);
    }
  }
      const t = numerator / denominator;
      const toolLength = vec3.distance(originVec, tipVec);

      if (debugCount < 3) {
        console.log(`   t: ${t.toFixed(2)}, toolLength: ${toolLength.toFixed(2)}`);
      }

      // Check if intersection is within tool length
      if (t < 0 || t > toolLength) {
        // Intersection is outside tool range
        // Check if tool is close enough to show projection anyway
        const originDistance = Math.abs(vec3.dot(planeNormal,
          vec3.subtract(vec3.create(), originVec, planePoint)));
        const tipDistance = Math.abs(vec3.dot(planeNormal,
          vec3.subtract(vec3.create(), tipVec, planePoint)));

        if (debugCount < 3) {
          console.log(`   → Intersection outside range`);
          console.log(`   Origin distance: ${originDistance.toFixed(2)}mm, Tip distance: ${tipDistance.toFixed(2)}mm`);
        }

        const MIN_DISTANCE = 5.0; // 5mm threshold
        if (originDistance < MIN_DISTANCE || tipDistance < MIN_DISTANCE) {
          // Close enough - show projected line
          if (debugCount < 3) {
            console.log(`   → Close enough, showing projected line (dashed)`);
          }
          this._renderProjectedLine(viewport, originVec, tipVec);
        } else {
          // Too far - don't show
          if (debugCount < 3) {
            console.log(`   → Too far, not showing`);
          }
          this._clearViewportProjection(viewport.id);
        }
        return;
      }

      // Calculate intersection point
      const intersectionPoint = vec3.scaleAndAdd(
        vec3.create(),
        originVec,
        toolDirection,
        t
      );

      if (debugCount < 3) {
        console.log(`   → Intersection found, showing solid line`);
      }

      // Render line from origin to intersection point
      this._renderIntersectionLine(viewport, originVec, intersectionPoint);

    } catch (error) {
      console.error(`❌ Error rendering projection on ${viewport.id}:`, error);
      this._clearViewportProjection(viewport.id);
    }
  }

  /**
   * Render projected line (tool is parallel to plane or close to plane)
   */
  private _renderProjectedLine(viewport: any, origin: vec3, tip: vec3): void {
    try {
      const originCanvas = viewport.worldToCanvas([origin[0], origin[1], origin[2]]);
      const tipCanvas = viewport.worldToCanvas([tip[0], tip[1], tip[2]]);

      if (!this._isValidCanvasPoint(originCanvas) || !this._isValidCanvasPoint(tipCanvas)) {
        this._clearViewportProjection(viewport.id);
        return;
      }

      const svgElement = this._getOrCreateSVGOverlay(viewport);
      if (!svgElement) {
        console.warn(`⚠️ Could not get SVG overlay for ${viewport.id}`);
        return;
      }

      // Draw as dashed line to indicate it's a projection, not intersection
      this._drawProjectionLine(svgElement, viewport.id, originCanvas, tipCanvas, true);
      this._drawOriginCircle(svgElement, viewport.id, originCanvas);
    } catch (error) {
      console.error(`❌ Error in _renderProjectedLine for ${viewport.id}:`, error);
    }
  }

  /**
   * Render intersection line (tool crosses the plane)
   */
  private _renderIntersectionLine(viewport: any, origin: vec3, intersection: vec3): void {
    try {
      const originCanvas = viewport.worldToCanvas([origin[0], origin[1], origin[2]]);
      const intersectionCanvas = viewport.worldToCanvas([intersection[0], intersection[1], intersection[2]]);

      if (!this._isValidCanvasPoint(originCanvas) || !this._isValidCanvasPoint(intersectionCanvas)) {
        this._clearViewportProjection(viewport.id);
        return;
      }

      const svgElement = this._getOrCreateSVGOverlay(viewport);
      if (!svgElement) {
        console.warn(`⚠️ Could not get SVG overlay for ${viewport.id}`);
        return;
      }

      // Draw as solid line to indicate actual intersection
      this._drawProjectionLine(svgElement, viewport.id, originCanvas, intersectionCanvas, false);
      this._drawOriginCircle(svgElement, viewport.id, originCanvas);
      this._drawIntersectionMarker(svgElement, viewport.id, intersectionCanvas);
    } catch (error) {
      console.error(`❌ Error in _renderIntersectionLine for ${viewport.id}:`, error);
    }
  }

  /**
   * Check if canvas point is valid and within viewport
   */
  private _isValidCanvasPoint(point: number[] | null): boolean {
    if (!point || point.length < 2) {
      return false;
    }

    const [x, y] = point;

    // Check for NaN or Infinity
    if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
      return false;
    }

    // Points can be outside viewport bounds but still valid
    // (we'll clip the line if needed)
    return true;
  }

  /**
   * Get or create SVG overlay element for viewport
   */
  private _getOrCreateSVGOverlay(viewport: any): SVGElement {
    const viewportId = viewport.id;

    // Check if we already have an SVG element
    if (this.projectionSVGElements.has(viewportId)) {
      const existing = this.projectionSVGElements.get(viewportId);
      if (existing && document.body.contains(existing)) {
        return existing;
      }
    }

    // Get viewport container element (viewport.element is the canvas container)
    const container = viewport.element;
    if (!container) {
      throw new Error(`Viewport ${viewportId} has no element`);
    }

    // Find canvas element inside container
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) {
      throw new Error(`Viewport ${viewportId} has no canvas element`);
    }

    // Create SVG overlay
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'tool-projection-overlay');
    svg.setAttribute('style', `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1000;
    `);

    // Match canvas dimensions
    svg.setAttribute('width', canvas.width.toString());
    svg.setAttribute('height', canvas.height.toString());

    // Insert SVG as sibling to canvas (position it absolutely over canvas)
    if (canvas.parentElement) {
      // Make parent relative if not already
      const parentStyle = window.getComputedStyle(canvas.parentElement);
      if (parentStyle.position === 'static') {
        canvas.parentElement.style.position = 'relative';
      }

      canvas.parentElement.appendChild(svg);
    } else {
      throw new Error(`Canvas parent element not found for viewport ${viewportId}`);
    }

    // Store reference
    this.projectionSVGElements.set(viewportId, svg);

    // Update size on canvas resize
    const resizeObserver = new ResizeObserver(() => {
      svg.setAttribute('width', canvas.width.toString());
      svg.setAttribute('height', canvas.height.toString());
    });
    resizeObserver.observe(canvas);

    return svg;
  }

  /**
   * Draw projection line (origin to tip) on SVG
   */
  private _drawProjectionLine(
    svg: SVGElement,
    viewportId: string,
    originCanvas: number[],
    tipCanvas: number[],
    isDashed: boolean = false
  ): void {
    // Get canvas bounds for clipping (use SVG dimensions)
    const canvasWidth = parseFloat(svg.getAttribute('width') || '0');
    const canvasHeight = parseFloat(svg.getAttribute('height') || '0');

    // Clip line to canvas bounds (optional - could let it extend beyond)
    const clipped = this._clipLineToBounds(
      originCanvas,
      tipCanvas,
      [0, 0, canvasWidth, canvasHeight]
    );

    if (!clipped) {
      // Line is completely outside bounds
      this._clearViewportProjection(viewportId);
      return;
    }

    const [origin, tip] = clipped;

    // Remove existing line if any
    const existingLine = svg.querySelector(`[data-id="projection-line-${viewportId}"]`);
    if (existingLine) {
      existingLine.remove();
    }

    // Create line element
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('data-id', `projection-line-${viewportId}`);
    line.setAttribute('x1', origin[0].toString());
    line.setAttribute('y1', origin[1].toString());
    line.setAttribute('x2', tip[0].toString());
    line.setAttribute('y2', tip[1].toString());

    // Style based on line type
    if (isDashed) {
      // Dashed line = projection (tool parallel to plane or near plane)
      line.setAttribute('stroke', '#ffaa00'); // Orange color for projection
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-dasharray', '8,4'); // Dashed line
      line.setAttribute('opacity', '0.7');
      line.setAttribute('marker-end', `url(#arrowhead-dashed-${viewportId})`);
    } else {
      // Solid line = intersection (tool crosses plane)
      line.setAttribute('stroke', '#00ff00'); // Green color for intersection
      line.setAttribute('stroke-width', '3');
      line.setAttribute('opacity', '0.9');
      line.setAttribute('marker-end', `url(#arrowhead-solid-${viewportId})`);
    }

    // Create arrowhead marker
    this._createArrowheadMarker(svg, viewportId, isDashed);

    // Add line to SVG
    svg.appendChild(line);
  }

  /**
   * Clip line to bounds (optional - returns null if line is completely outside)
   */
  private _clipLineToBounds(
    p1: number[],
    p2: number[],
    bounds: [number, number, number, number] // [x, y, width, height]
  ): [number[], number[]] | null {
    const [bx, by, bw, bh] = bounds;
    const [x1, y1] = p1;
    const [x2, y2] = p2;

    // For simplicity, just check if points are in bounds
    // A full line clipping algorithm (like Cohen-Sutherland) could be used
    const p1InBounds = x1 >= bx && x1 <= bx + bw && y1 >= by && y1 <= by + bh;
    const p2InBounds = x2 >= bx && x2 <= bx + bw && y2 >= by && y2 <= by + bh;

    if (!p1InBounds && !p2InBounds) {
      // Both points outside - check if line intersects bounds (simplified)
      // For now, return null if both are outside
      return null;
    }

    // At least one point is in bounds - return clipped points
    return [
      [Math.max(bx, Math.min(bx + bw, x1)), Math.max(by, Math.min(by + bh, y1))],
      [Math.max(bx, Math.min(bx + bw, x2)), Math.max(by, Math.min(by + bh, y2))]
    ];
  }

  /**
   * Create arrowhead marker for line end
   */
  private _createArrowheadMarker(svg: SVGElement, viewportId: string, isDashed: boolean = false): void {
    const markerId = isDashed ? `arrowhead-dashed-${viewportId}` : `arrowhead-solid-${viewportId}`;

    // Check if marker already exists
    const existingMarker = svg.querySelector(`#${markerId}`);
    if (existingMarker) {
      return;
    }

    // Create defs element if it doesn't exist
    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      svg.appendChild(defs);
    }

    // Create marker
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', markerId);
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');

    // Create arrowhead path with color matching line type
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M 0 0 L 0 6 L 9 3 z');
    path.setAttribute('fill', isDashed ? '#ffaa00' : '#00ff00'); // Orange for dashed, green for solid

    marker.appendChild(path);
    defs.appendChild(marker);
  }

  /**
   * Draw origin circle
   */
  private _drawOriginCircle(svg: SVGElement, viewportId: string, originCanvas: number[]): void {
    // Remove existing circle if any
    const existingCircle = svg.querySelector(`[data-id="origin-circle-${viewportId}"]`);
    if (existingCircle) {
      existingCircle.remove();
    }

    // Create circle element
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('data-id', `origin-circle-${viewportId}`);
    circle.setAttribute('cx', originCanvas[0].toString());
    circle.setAttribute('cy', originCanvas[1].toString());
    circle.setAttribute('r', '5');
    circle.setAttribute('fill', '#0088ff'); // Blue color for origin
    circle.setAttribute('stroke', '#ffffff');
    circle.setAttribute('stroke-width', '2');
    circle.setAttribute('opacity', '0.9');

    svg.appendChild(circle);
  }

  /**
   * Draw intersection marker (where tool crosses the plane)
   */
  private _drawIntersectionMarker(svg: SVGElement, viewportId: string, intersectionCanvas: number[]): void {
    // Remove existing marker if any
    const existingMarker = svg.querySelector(`[data-id="intersection-marker-${viewportId}"]`);
    if (existingMarker) {
      existingMarker.remove();
    }

    // Create crosshair marker
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-id', `intersection-marker-${viewportId}`);

    // Horizontal line
    const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    hLine.setAttribute('x1', (intersectionCanvas[0] - 8).toString());
    hLine.setAttribute('y1', intersectionCanvas[1].toString());
    hLine.setAttribute('x2', (intersectionCanvas[0] + 8).toString());
    hLine.setAttribute('y2', intersectionCanvas[1].toString());
    hLine.setAttribute('stroke', '#ff0000'); // Red for intersection point
    hLine.setAttribute('stroke-width', '2');

    // Vertical line
    const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    vLine.setAttribute('x1', intersectionCanvas[0].toString());
    vLine.setAttribute('y1', (intersectionCanvas[1] - 8).toString());
    vLine.setAttribute('x2', intersectionCanvas[0].toString());
    vLine.setAttribute('y2', (intersectionCanvas[1] + 8).toString());
    vLine.setAttribute('stroke', '#ff0000');
    vLine.setAttribute('stroke-width', '2');

    // Center circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', intersectionCanvas[0].toString());
    circle.setAttribute('cy', intersectionCanvas[1].toString());
    circle.setAttribute('r', '3');
    circle.setAttribute('fill', '#ff0000');

    group.appendChild(hLine);
    group.appendChild(vLine);
    group.appendChild(circle);
    svg.appendChild(group);
  }

  /**
   * Clear projection for a specific viewport
   */
  private _clearViewportProjection(viewportId: string): void {
    const svg = this.projectionSVGElements.get(viewportId);
    if (!svg) {
      return;
    }

    // Remove projection elements
    const line = svg.querySelector(`[data-id="projection-line-${viewportId}"]`);
    const origin = svg.querySelector(`[data-id="projection-origin-${viewportId}"]`);

    if (line) line.remove();
    if (origin) origin.remove();
  }

  /**
   * Clear all projections and cleanup
   */
  public cleanup(): void {
    // Clear all viewport projections
    this.projectionSVGElements.forEach((svg, viewportId) => {
      this._clearViewportProjection(viewportId);

      // Remove SVG element
      if (svg && svg.parentElement) {
        svg.parentElement.removeChild(svg);
      }
    });

    this.projectionSVGElements.clear();
  }

  /**
   * Set extension length
   */
  public setExtensionLength(length: number): void {
    this.extensionLength = length;
  }

  /**
   * Get extension length
   */
  public getExtensionLength(): number {
    return this.extensionLength;
  }
}
