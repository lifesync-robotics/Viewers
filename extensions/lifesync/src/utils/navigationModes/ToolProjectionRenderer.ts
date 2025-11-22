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
  private extensionLength: number = 100; // 100mm = 10cm default

  constructor(servicesManager: any, extensionLength: number = 100) {
    this.servicesManager = servicesManager;
    this.extensionLength = extensionLength;
  }

  /**
   * Update projection for all viewports
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
      if (viewport.type === 'stack') {
        return; // Skip stack viewports
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
   * Render projection on a single viewport
   */
  private _renderProjectionOnViewport(
    viewport: any,
    origin: number[],
    tipPoint: number[],
    zAxis: number[]
  ): void {
    try {
      // Project 3D points to 2D canvas coordinates
      const originCanvas = viewport.worldToCanvas(origin as [number, number, number]);
      const tipCanvas = viewport.worldToCanvas(tipPoint as [number, number, number]);

      // Check if points are valid and within viewport bounds
      if (!this._isValidCanvasPoint(originCanvas) || !this._isValidCanvasPoint(tipCanvas)) {
        // Point is outside viewport or invalid - clear projection
        this._clearViewportProjection(viewport.id);
        return;
      }

      // Get or create SVG overlay element for this viewport
      const svgElement = this._getOrCreateSVGOverlay(viewport);

      // Render projection line
      this._drawProjectionLine(svgElement, viewport.id, originCanvas, tipCanvas);

    } catch (error) {
      console.warn(`⚠️ Error rendering projection on ${viewport.id}:`, error);
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
    tipCanvas: number[]
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
    line.setAttribute('stroke', '#00ff00'); // Green color
    line.setAttribute('stroke-width', '3');
    line.setAttribute('stroke-dasharray', '5,5'); // Dashed line
    line.setAttribute('marker-end', `url(#arrowhead-${viewportId})`);

    // Create arrowhead marker
    this._createArrowheadMarker(svg, viewportId);

    // Add line to SVG
    svg.appendChild(line);

    // Draw origin point (circle)
    const originCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    originCircle.setAttribute('data-id', `projection-origin-${viewportId}`);
    originCircle.setAttribute('cx', origin[0].toString());
    originCircle.setAttribute('cy', origin[1].toString());
    originCircle.setAttribute('r', '5');
    originCircle.setAttribute('fill', '#00ff00');
    originCircle.setAttribute('stroke', '#ffffff');
    originCircle.setAttribute('stroke-width', '2');

    // Remove existing origin circle if any
    const existingOrigin = svg.querySelector(`[data-id="projection-origin-${viewportId}"]`);
    if (existingOrigin) {
      existingOrigin.remove();
    }

    svg.appendChild(originCircle);
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
  private _createArrowheadMarker(svg: SVGElement, viewportId: string): void {
    // Check if marker already exists
    const existingMarker = svg.querySelector(`#arrowhead-${viewportId}`);
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
    marker.setAttribute('id', `arrowhead-${viewportId}`);
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');

    // Create arrowhead path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M 0 0 L 0 6 L 9 3 z');
    path.setAttribute('fill', '#00ff00');

    marker.appendChild(path);
    defs.appendChild(marker);
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
