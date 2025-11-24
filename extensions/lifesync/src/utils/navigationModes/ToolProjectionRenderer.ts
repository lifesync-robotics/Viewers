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
  private extensionLength: number = 50; // 50mm = 5cm default
  private instrumentLength: number = 200; // 200mm = 20cm default (instrument body length in -z direction)
  private debugCount: Map<string, number> = new Map(); // Per-viewport debug counter

  constructor(servicesManager: any, extensionLength: number = 50, instrumentLength: number = 200) {
    this.servicesManager = servicesManager;
    this.extensionLength = extensionLength;
    this.instrumentLength = instrumentLength;
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

    // Calculate tip point if not provided (extension part)
    const tipPoint = toolRep.tipPoint || this._calculateTipPoint(toolRep);

    // Calculate instrument base point (origin - zAxis * instrumentLength)
    // This represents the back end of the instrument body
    const instrumentBase = this._calculateInstrumentBase(toolRep);

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

      // Render instrument body (solid line from base to origin)
      this._renderInstrumentBody(viewport, instrumentBase, toolRep.origin, toolRep.zAxis);

      // Render extension part (from origin to tip)
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
   * Calculate instrument base point: origin - zAxis * instrumentLength
   * This represents the back end of the instrument body (in -z direction)
   */
  private _calculateInstrumentBase(toolRep: ToolRepresentation): number[] {
    const zAxis = vec3.fromValues(
      toolRep.zAxis[0],
      toolRep.zAxis[1],
      toolRep.zAxis[2]
    );

    // Scale zAxis by instrument length (negative direction)
    vec3.scale(zAxis, zAxis, -this.instrumentLength);

    return [
      toolRep.origin[0] + zAxis[0],
      toolRep.origin[1] + zAxis[1],
      toolRep.origin[2] + zAxis[2]
    ];
  }

  /**
   * Calculate instrument base point: origin - zAxis * instrumentLength
   * This represents the back end of the instrument body (in -z direction)
   */
  private _calculateInstrumentBase(toolRep: ToolRepresentation): number[] {
    const zAxis = vec3.fromValues(
      toolRep.zAxis[0],
      toolRep.zAxis[1],
      toolRep.zAxis[2]
    );

    // Scale zAxis by instrument length (negative direction)
    vec3.scale(zAxis, zAxis, -this.instrumentLength);

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
        // Always show projection, even if tool is far from plane
        const distanceToPlane = Math.abs(vec3.dot(planeNormal, originToPlane));

        if (shouldLog) {
          console.log(`   ⚠️ Tool is PARALLEL to plane`);
          console.log(`   Distance to plane: ${distanceToPlane.toFixed(2)}mm`);
          console.log(`   ✅ Always showing projected line (dashed) regardless of distance`);
        }

        // Always show projection, even if far from plane
        // Pass distance to determine color (green if within ±2mm, red otherwise)
        this._renderProjectedLine(viewport, originVec, tipVec, distanceToPlane);
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
        const minDistance = Math.min(originDistance, tipDistance);

        if (shouldLog) {
          console.log(`   ⚠️ Intersection OUTSIDE tool segment`);
          console.log(`   Origin distance from plane: ${originDistance.toFixed(2)}mm`);
          console.log(`   Tip distance from plane: ${tipDistance.toFixed(2)}mm`);
          console.log(`   ✅ Always showing projected line (dashed) regardless of distance`);
          }

        // Always show projection, even if far from plane
        // Pass minimum distance to adjust color (green if within ±2mm, red otherwise)
        this._renderProjectedLine(viewport, originVec, tipVec, minDistance);
        return;
      }

      // Calculate intersection point
      const intersectionPoint = vec3.scaleAndAdd(vec3.create(), originVec, toolDirection, t);

      // Since the line intersects the plane, the distance from line to plane is 0
      // This means the tool is crossing the slice, so it should be green
      const distanceToPlane = 0.0;

      if (shouldLog) {
        console.log(`   ✅ INTERSECTION FOUND!`);
        console.log(`   Intersection point: [${intersectionPoint[0].toFixed(1)}, ${intersectionPoint[1].toFixed(1)}, ${intersectionPoint[2].toFixed(1)}]`);
        console.log(`   Line-to-plane distance: ${distanceToPlane.toFixed(2)}mm (line intersects plane)`);
        console.log(`   → Drawing SOLID line from origin to intersection`);
      }

      this._renderIntersectionLine(viewport, originVec, intersectionPoint, distanceToPlane);

    } catch (error) {
      console.error(`❌ Error rendering projection on ${viewport.id}:`, error);
      // Fallback to simple worldToCanvas projection if complex math fails
      this._renderSimpleProjectionFallback(viewport, origin, tipPoint);
    }
  }

  /**
   * Render instrument body (solid line from base to origin, representing the physical instrument)
   * @param base - Instrument base point (back end)
   * @param origin - Instrument origin point (tip of instrument body)
   * @param zAxis - Tool Z-axis direction
   */
  private _renderInstrumentBody(viewport: any, base: number[], origin: number[], zAxis: number[]): void {
    try {
      const baseCanvas = viewport.worldToCanvas([base[0], base[1], base[2]]);
      const originCanvas = viewport.worldToCanvas([origin[0], origin[1], origin[2]]);

      if (!this._isValidCanvasPoint(baseCanvas) || !this._isValidCanvasPoint(originCanvas)) {
        return; // Don't clear, just skip rendering
      }

      const svgElement = this._getOrCreateSVGOverlay(viewport);
      if (!svgElement) {
        console.warn(`⚠️ Could not get SVG overlay for ${viewport.id}`);
        return;
      }

      // Draw instrument body as solid line (always visible, represents physical instrument)
      this._drawInstrumentBodyLine(svgElement, viewport.id, baseCanvas, originCanvas);
    } catch (error) {
      console.error(`❌ Error rendering instrument body on ${viewport.id}:`, error);
    }
  }

  /**
   * Render projected line (tool is parallel to plane or close to plane)
   * @param distanceToPlane - Distance from tool to plane in mm (optional, for opacity adjustment)
   */
  private _renderProjectedLine(viewport: any, origin: vec3, tip: vec3, distanceToPlane?: number): void {
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
      // Adjust opacity based on distance: closer = more opaque, farther = more transparent
      // Distance > 50mm: opacity 0.3, distance < 5mm: opacity 0.8
      const opacity = distanceToPlane !== undefined
        ? Math.max(0.3, Math.min(0.8, 0.8 - (distanceToPlane / 50.0) * 0.5))
        : 0.7;

      // Pass distance to determine color (green if within ±2mm, red otherwise)
      this._drawProjectionLine(svgElement, viewport.id, originCanvas, tipCanvas, true, opacity, distanceToPlane);
      this._drawOriginCircle(svgElement, viewport.id, originCanvas, opacity);
    } catch (error) {
      console.error(`❌ Error in _renderProjectedLine for ${viewport.id}:`, error);
    }
  }

  /**
   * Render intersection line (tool crosses the plane)
   * @param distanceToPlane - Distance from tool origin to plane in mm (for color determination)
   */
  private _renderIntersectionLine(viewport: any, origin: vec3, intersection: vec3, distanceToPlane?: number): void {
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
      // Pass distance to determine color (green if within ±2mm, red otherwise)
      this._drawProjectionLine(svgElement, viewport.id, originCanvas, intersectionCanvas, false, undefined, distanceToPlane);
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
   * @param opacity - Opacity value (0-1), defaults to 0.7 for dashed, 0.9 for solid
   * @param distanceToPlane - Distance from tool to plane in mm (for color determination: green if within ±2mm, red otherwise)
   */
  private _drawProjectionLine(
    svg: SVGElement,
    viewportId: string,
    originCanvas: number[],
    tipCanvas: number[],
    isDashed: boolean = false,
    opacity?: number,
    distanceToPlane?: number
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

    // Style based on line type and distance to plane
    const lineOpacity = opacity !== undefined ? opacity : (isDashed ? 0.7 : 0.9);

    // Determine color: green if within ±2mm of plane, red otherwise
    const SLICE_THRESHOLD = 2.0; // 2mm threshold
    const isWithinSlice = distanceToPlane !== undefined && distanceToPlane <= SLICE_THRESHOLD;
    const lineColor = isWithinSlice ? '#00ff00' : '#ff0000'; // Green if within slice, red otherwise

    // Thicker line for better visibility
    const lineWidth = isDashed ? '4' : '5'; // Increased from 2/3 to 4/5

    if (isDashed) {
      // Dashed line = projection (tool parallel to plane or near plane)
      line.setAttribute('stroke', lineColor);
      line.setAttribute('stroke-width', lineWidth);
      line.setAttribute('stroke-dasharray', '8,4'); // Dashed line
      line.setAttribute('opacity', lineOpacity.toString());
    } else {
      // Solid line = intersection (tool crosses plane)
      line.setAttribute('stroke', lineColor);
      line.setAttribute('stroke-width', lineWidth);
      line.setAttribute('opacity', lineOpacity.toString());
    }

    // Add ruler-like tick marks instead of arrow
    this._drawRulerTicks(svg, viewportId, origin, tip, lineColor, lineOpacity);

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
   * Draw ruler-like tick marks along the extension line
   * @param origin - Start point of the line [x, y]
   * @param tip - End point of the line [x, y]
   * @param color - Color for the ticks
   * @param opacity - Opacity for the ticks
   */
  private _drawRulerTicks(
    svg: SVGElement,
    viewportId: string,
    origin: number[],
    tip: number[],
    color: string,
    opacity: number
  ): void {
    // Remove existing ruler ticks if any
    const existingGroup = svg.querySelector(`[data-id="ruler-ticks-${viewportId}"]`);
    if (existingGroup) {
      existingGroup.remove();
    }

    // Calculate line direction and length
    const dx = tip[0] - origin[0];
    const dy = tip[1] - origin[1];
    const lineLength = Math.sqrt(dx * dx + dy * dy);

    if (lineLength < 10) {
      return; // Line too short to draw ticks
    }

    // Normalize direction vector
    const dirX = dx / lineLength;
    const dirY = dy / lineLength;

    // Perpendicular vector for tick marks (rotated 90 degrees)
    const perpX = -dirY;
    const perpY = dirX;

    // Create group for all ticks
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-id', `ruler-ticks-${viewportId}`);

    // Tick mark parameters
    const tickSpacing = 20; // Pixels between major ticks (adjust based on zoom level)
    const majorTickLength = 8; // Length of major ticks (every 10mm)
    const minorTickLength = 4; // Length of minor ticks (every 5mm)
    const numTicks = Math.floor(lineLength / tickSpacing);

    // Draw tick marks along the line
    for (let i = 0; i <= numTicks; i++) {
      const t = (i * tickSpacing) / lineLength;
      if (t > 1) break;

      const tickX = origin[0] + t * dx;
      const tickY = origin[1] + t * dy;

      // Determine if this is a major or minor tick
      const isMajorTick = (i % 2 === 0); // Every other tick is major
      const tickLength = isMajorTick ? majorTickLength : minorTickLength;

      // Create tick line
      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', tickX.toString());
      tick.setAttribute('y1', tickY.toString());
      tick.setAttribute('x2', (tickX + perpX * tickLength).toString());
      tick.setAttribute('y2', (tickY + perpY * tickLength).toString());
      tick.setAttribute('stroke', color);
      tick.setAttribute('stroke-width', isMajorTick ? '2' : '1');
      tick.setAttribute('opacity', opacity.toString());
      tick.setAttribute('stroke-linecap', 'round');

      group.appendChild(tick);

      // Add text labels for major ticks (optional, can be enabled if needed)
      // if (isMajorTick && i > 0) {
      //   const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      //   label.setAttribute('x', (tickX + perpX * (tickLength + 5)).toString());
      //   label.setAttribute('y', (tickY + perpY * (tickLength + 5)).toString());
      //   label.setAttribute('fill', color);
      //   label.setAttribute('font-size', '10');
      //   label.setAttribute('opacity', opacity.toString());
      //   label.textContent = `${i * 10}mm`;
      //   group.appendChild(label);
      // }
    }

    // Add end tick at the tip
    const endTick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    endTick.setAttribute('x1', tip[0].toString());
    endTick.setAttribute('y1', tip[1].toString());
    endTick.setAttribute('x2', (tip[0] + perpX * majorTickLength).toString());
    endTick.setAttribute('y2', (tip[1] + perpY * majorTickLength).toString());
    endTick.setAttribute('stroke', color);
    endTick.setAttribute('stroke-width', '2');
    endTick.setAttribute('opacity', opacity.toString());
    endTick.setAttribute('stroke-linecap', 'round');
    group.appendChild(endTick);

    svg.appendChild(group);
  }

  /**
   * Draw origin circle
   * @param opacity - Opacity value (0-1), defaults to 0.9
   */
  private _drawOriginCircle(svg: SVGElement, viewportId: string, originCanvas: number[], opacity: number = 0.9): void {
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
    circle.setAttribute('opacity', opacity.toString());

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

    // Remove projection elements (but keep instrument body)
    const line = svg.querySelector(`[data-id="projection-line-${viewportId}"]`);
    const origin = svg.querySelector(`[data-id="projection-origin-${viewportId}"]`);

    if (line) line.remove();
    if (origin) origin.remove();
  }

  /**
   * Clear all elements for a specific viewport (including instrument body)
   */
  private _clearAllViewportElements(viewportId: string): void {
    const svg = this.projectionSVGElements.get(viewportId);
    if (!svg) {
      return;
    }

    // Remove all elements
    const line = svg.querySelector(`[data-id="projection-line-${viewportId}"]`);
    const origin = svg.querySelector(`[data-id="projection-origin-${viewportId}"]`);
    const instrumentBody = svg.querySelector(`[data-id="instrument-body-${viewportId}"]`);

    if (line) line.remove();
    if (origin) origin.remove();
    if (instrumentBody) instrumentBody.remove();
  }

  /**
   * Clear all projections and cleanup
   */
  public cleanup(): void {
    // Clear all viewport projections (including instrument body)
    this.projectionSVGElements.forEach((svg, viewportId) => {
      this._clearAllViewportElements(viewportId);

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

  /**
   * Set instrument length
   */
  public setInstrumentLength(length: number): void {
    this.instrumentLength = length;
  }

  /**
   * Get instrument length
   */
  public getInstrumentLength(): number {
    return this.instrumentLength;
  }

  /**
   * Draw instrument body line (solid line representing physical instrument)
   */
  private _drawInstrumentBodyLine(
    svg: SVGElement,
    viewportId: string,
    baseCanvas: number[],
    originCanvas: number[]
  ): void {
    // Get canvas bounds for clipping
    const canvasWidth = parseFloat(svg.getAttribute('width') || '0');
    const canvasHeight = parseFloat(svg.getAttribute('height') || '0');

    // Clip line to canvas bounds
    const clipped = this._clipLineToBounds(
      baseCanvas,
      originCanvas,
      [0, 0, canvasWidth, canvasHeight]
    );

    if (!clipped) {
      return; // Line is completely outside bounds
    }

    const [base, origin] = clipped;

    // Remove existing instrument body line if any
    const existingLine = svg.querySelector(`[data-id="instrument-body-${viewportId}"]`);
    if (existingLine) {
      existingLine.remove();
    }

    // Create line element for instrument body
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('data-id', `instrument-body-${viewportId}`);
    line.setAttribute('x1', base[0].toString());
    line.setAttribute('y1', base[1].toString());
    line.setAttribute('x2', origin[0].toString());
    line.setAttribute('y2', origin[1].toString());

    // Style: solid line, thicker, yellow color to represent physical instrument
    line.setAttribute('stroke', '#ffff00'); // Yellow color for instrument body
    line.setAttribute('stroke-width', '4'); // Thicker line for instrument body
    line.setAttribute('opacity', '0.8');
    line.setAttribute('stroke-linecap', 'round');

    // Add line to SVG
    svg.appendChild(line);
  }
}
