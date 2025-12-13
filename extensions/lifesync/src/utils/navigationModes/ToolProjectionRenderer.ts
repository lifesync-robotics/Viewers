/**
 * Tool Projection Renderer
 *
 * Renders tool Z-axis and extension line projection on fixed viewports.
 * Uses SVG overlay to draw projections without affecting viewport camera.
 */

import { getRenderingEngine } from '@cornerstonejs/core';
import { vec3 } from 'gl-matrix';
import {
  isValidCanvasPoint,
  identifyViewportType,
  getStandardPlaneNormal,
  normalsMatch,
  Logger
} from './utils';

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

  // Logger for consistent logging
  private logger = new Logger('[ToolProj]');

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

      // Debug logging for alignment check
      const currentCount = this.debugCount.get(viewport.id) || 0;
      const shouldLog = currentCount >= 1 && currentCount <= 20;

      if (shouldLog) {
        this.logger.log(`\n${'='.repeat(80)}`);
        this.logger.log(`🎯 VIEWPORT PROJECTION UPDATE: ${viewport.id} (Frame ${currentCount + 1})`);
        this.logger.log(`${'='.repeat(80)}`);
      }

      // Render instrument body (solid line from base to origin)
      this._renderInstrumentBody(viewport, instrumentBase, toolRep.origin, toolRep.zAxis);

      // Render extension part (from origin to tip)
      this._renderProjectionOnViewport(viewport, toolRep.origin, tipPoint, toolRep.zAxis);

      // Post-render alignment verification
      if (shouldLog) {
        this._verifyAlignment(viewport, instrumentBase, toolRep.origin, tipPoint, toolRep.zAxis);
      }
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
   * Render projection on a single viewport with intersection-based styling
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
    const shouldLog = currentCount >= 1 && currentCount <= 20; // Log frames 1-20 per viewport (aligned with InstrumentProjectionMode)

    try {
      // Step 1: Identify viewport type by name
      const viewportType = identifyViewportType(viewport);
      const viewportName = viewport.id || 'unknown';

      if (shouldLog) {
        this.logger.log(`\n🎯 ====== PROJECTION RENDER [${viewportName}] (call #${currentCount + 1}) ======`);
        this.logger.log(`📍 Tool Origin: [${origin.map(v => v.toFixed(1)).join(', ')}]`);
        this.logger.log(`📍 Tool Tip: [${tipPoint.map(v => v.toFixed(1)).join(', ')}]`);
        this.logger.log(`📍 Tool Z-Axis: [${zAxis.map(v => v.toFixed(3)).join(', ')}]`);
        this.logger.log(`📏 Extension Length: ${this.extensionLength}mm (${this.extensionLength / 10}cm)`);
      }

      // Step 2: Get viewport camera info (for slice plane)
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

      // Intersection-aware workflow:
      // - Compute extension end strictly along the tool's z-axis using the configured length.
      // - Use signed distances to decide if the segment crosses the slice plane.
      // - Render solid when crossing, dashed otherwise.

      const originVec = vec3.fromValues(origin[0], origin[1], origin[2]);
      const zAxisVec = vec3.fromValues(zAxis[0], zAxis[1], zAxis[2]);
      const hasDirection = vec3.length(zAxisVec) > 0.001;

      if (!hasDirection) {
        if (shouldLog) {
          this.logger.warn('⚠️ Missing or invalid tool direction, skipping projection');
        }
        return;
      }

      vec3.normalize(zAxisVec, zAxisVec);

      // Use configured extension length only (simple extrusion along z-axis)
      const effectiveExtensionLength = Math.max(0, Number.isFinite(this.extensionLength) ? this.extensionLength : 0);

      const extensionEnd = vec3.scaleAndAdd(vec3.create(), originVec, zAxisVec, effectiveExtensionLength);

      // Signed distances to plane
      const signedOrigin = vec3.dot(planeNormal, vec3.subtract(vec3.create(), originVec, planePoint));
      const signedExtension = vec3.dot(planeNormal, vec3.subtract(vec3.create(), extensionEnd, planePoint));
      const denom = vec3.dot(planeNormal, zAxisVec);
      const PARALLEL_THRESHOLD = 0.05; // ~87° to plane normal
      const isParallelOrNearlyParallel = Math.abs(denom) < PARALLEL_THRESHOLD;
      const crossesPlane =
        signedOrigin === 0 ||
        signedExtension === 0 ||
        (signedOrigin > 0) !== (signedExtension > 0);
      const minDistance = Math.min(Math.abs(signedOrigin), Math.abs(signedExtension));

      if (shouldLog) {
        this.logger.log(`\n🔧 Extension Geometry (With Intersection):`);
        this.logger.log(`   Direction (normalized): [${zAxisVec[0].toFixed(3)}, ${zAxisVec[1].toFixed(3)}, ${zAxisVec[2].toFixed(3)}]`);
        this.logger.log(`   Length: ${effectiveExtensionLength.toFixed(2)}mm`);
        this.logger.log(`   Extension end: [${extensionEnd[0].toFixed(1)}, ${extensionEnd[1].toFixed(1)}, ${extensionEnd[2].toFixed(1)}]`);
        this.logger.log(`   Signed origin dist: ${signedOrigin.toFixed(3)}mm`);
        this.logger.log(`   Signed extension dist: ${signedExtension.toFixed(3)}mm`);
        this.logger.log(`   n·dir: ${denom.toFixed(6)} (parallel thresh ${PARALLEL_THRESHOLD})`);
        this.logger.log(`   Drawing on viewport: ${viewport.id || 'unknown'}`);
      }

      if (isParallelOrNearlyParallel) {
        if (shouldLog) {
          this.logger.log(`   ⚠️ Parallel/nearly-parallel to plane → dashed projection`);
        }
        this._renderProjectedLine(viewport, originVec, extensionEnd, minDistance);
        return;
      }

      if (!crossesPlane) {
        if (shouldLog) {
          this.logger.log(`   ℹ️ Same side of plane → dashed projection (distance ${minDistance.toFixed(2)}mm)`);
        }
        this._renderProjectedLine(viewport, originVec, extensionEnd, minDistance);
        return;
      }

      // Compute intersection param t on segment origin→extensionEnd
      const denomT = signedOrigin - signedExtension;
      if (!Number.isFinite(denomT) || Math.abs(denomT) < 1e-6) {
        if (shouldLog) {
          this.logger.log(`   ⚠️ Degenerate intersection denominator; using projection`);
        }
        this._renderProjectedLine(viewport, originVec, extensionEnd, minDistance);
        return;
      }

      const t = signedOrigin / denomT; // expected within [0,1]
      if (!Number.isFinite(t) || t < 0 || t > 1) {
        if (shouldLog) {
          this.logger.log(`   ⚠️ Intersection t out of range (${t.toFixed(4)}); using projection`);
        }
        this._renderProjectedLine(viewport, originVec, extensionEnd, minDistance);
        return;
      }

      const intersectionPoint = vec3.lerp(vec3.create(), originVec, extensionEnd, t);

      if (shouldLog) {
        this.logger.log(`   ✅ Intersection on segment (t=${t.toFixed(4)})`);
        this.logger.log(`   Intersection: [${intersectionPoint[0].toFixed(1)}, ${intersectionPoint[1].toFixed(1)}, ${intersectionPoint[2].toFixed(1)}]`);
      }

      // Solid line to intersection (distance 0 => green)
      this._renderIntersectionLine(viewport, originVec, intersectionPoint, 0.0);

    } catch (error) {
      this.logger.error(`❌ Error rendering projection on ${viewport.id}:`, error);
      // Clear projection on error to avoid showing incorrect visualization
      this._clearViewportProjection(viewport.id);
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
      // Get debug counter for this viewport
      const currentCount = this.debugCount.get(viewport.id) || 0;
      const shouldLog = currentCount >= 1 && currentCount <= 20;

      if (shouldLog) {
        this.logger.log(`\n🔧 ====== INSTRUMENT BODY RENDER [${viewport.id}] ======`);
        this.logger.log(`📍 Base (world):   [${base.map(v => v.toFixed(1)).join(', ')}]`);
        this.logger.log(`📍 Origin (world): [${origin.map(v => v.toFixed(1)).join(', ')}]`);
        this.logger.log(`📍 Z-Axis: [${zAxis.map(v => v.toFixed(3)).join(', ')}]`);

        // Calculate expected direction in 3D
        const dx3D = origin[0] - base[0];
        const dy3D = origin[1] - base[1];
        const dz3D = origin[2] - base[2];
        const len3D = Math.sqrt(dx3D*dx3D + dy3D*dy3D + dz3D*dz3D);
        this.logger.log(`📐 3D Direction (base→origin): [${(dx3D/len3D).toFixed(3)}, ${(dy3D/len3D).toFixed(3)}, ${(dz3D/len3D).toFixed(3)}]`);
        this.logger.log(`📏 3D Length: ${len3D.toFixed(2)}mm`);
      }

      // Revert to direct worldToCanvas - viewUp correction was overcorrecting
      const baseCanvas = viewport.worldToCanvas([base[0], base[1], base[2]]);
      const originCanvas = viewport.worldToCanvas([origin[0], origin[1], origin[2]]);

      if (shouldLog) {
        this.logger.log(`\n🔄 World → Canvas (Instrument Body):`);
        this.logger.log(`   Base:   [${base.map(v => v.toFixed(1)).join(', ')}] → [${baseCanvas[0].toFixed(1)}, ${baseCanvas[1].toFixed(1)}]`);
        this.logger.log(`   Origin: [${origin.map(v => v.toFixed(1)).join(', ')}] → [${originCanvas[0].toFixed(1)}, ${originCanvas[1].toFixed(1)}]`);

        // Calculate canvas direction
        const dxCanvas = originCanvas[0] - baseCanvas[0];
        const dyCanvas = originCanvas[1] - baseCanvas[1];
        const lenCanvas = Math.sqrt(dxCanvas*dxCanvas + dyCanvas*dyCanvas);
        const angleCanvas = Math.atan2(dyCanvas, dxCanvas) * 180 / Math.PI;

        this.logger.log(`\n📊 Canvas Projection (Instrument Body):`);
        this.logger.log(`   Canvas ΔX: ${dxCanvas.toFixed(1)} px`);
        this.logger.log(`   Canvas ΔY: ${dyCanvas.toFixed(1)} px`);
        this.logger.log(`   Canvas Direction: [${(dxCanvas/lenCanvas).toFixed(3)}, ${(dyCanvas/lenCanvas).toFixed(3)}]`);
        this.logger.log(`   Canvas Angle: ${angleCanvas.toFixed(1)}° (from +X axis)`);
        this.logger.log(`   Canvas Length: ${lenCanvas.toFixed(1)} px`);
      }

      if (!isValidCanvasPoint(baseCanvas) || !isValidCanvasPoint(originCanvas)) {
        return; // Don't clear, just skip rendering
      }

      const svgElement = this._getOrCreateSVGOverlay(viewport);
      if (!svgElement) {
        this.logger.warn(`⚠️ Could not get SVG overlay for ${viewport.id}`);
        return;
      }

      // Draw instrument body as solid line (always visible, represents physical instrument)
      this._drawInstrumentBodyLine(svgElement, viewport.id, baseCanvas, originCanvas);
      
      if (shouldLog) {
        this.logger.log(`✅ Instrument body rendered\n`);
      }
    } catch (error) {
      this.logger.error(`❌ Error rendering instrument body on ${viewport.id}:`, error);
    }
  }

  /**
   * Render projected line (tool is parallel to plane or close to plane)
   * @param distanceToPlane - Distance from tool to plane in mm (optional, for opacity adjustment)
   */
  private _renderProjectedLine(viewport: any, origin: vec3, tip: vec3, distanceToPlane?: number): void {
    try {
      // Revert to direct worldToCanvas - viewUp correction was overcorrecting
      const originCanvas = viewport.worldToCanvas([origin[0], origin[1], origin[2]]);
      const tipCanvas = viewport.worldToCanvas([tip[0], tip[1], tip[2]]);

      if (!isValidCanvasPoint(originCanvas) || !isValidCanvasPoint(tipCanvas)) {
        this._clearViewportProjection(viewport.id);
        return;
      }

      const svgElement = this._getOrCreateSVGOverlay(viewport);
      if (!svgElement) {
        this.logger.warn(`⚠️ Could not get SVG overlay for ${viewport.id}`);
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
      this.logger.error(`❌ Error in _renderProjectedLine for ${viewport.id}:`, error);
    }
  }

  /**
   * Render intersection line (tool crosses the plane)
   * @param distanceToPlane - Distance from tool origin to plane in mm (for color determination)
   */
  private _renderIntersectionLine(viewport: any, origin: vec3, intersection: vec3, distanceToPlane?: number): void {
    try {
      // Revert to direct worldToCanvas - viewUp correction was overcorrecting
      const originCanvas = viewport.worldToCanvas([origin[0], origin[1], origin[2]]);
      const intersectionCanvas = viewport.worldToCanvas([intersection[0], intersection[1], intersection[2]]);

      if (!isValidCanvasPoint(originCanvas) || !isValidCanvasPoint(intersectionCanvas)) {
        this._clearViewportProjection(viewport.id);
        return;
      }

      const svgElement = this._getOrCreateSVGOverlay(viewport);
      if (!svgElement) {
        this.logger.warn(`⚠️ Could not get SVG overlay for ${viewport.id}`);
        return;
      }

      // Draw as solid line to indicate actual intersection
      // Pass distance to determine color (green if within ±2mm, red otherwise)
      this._drawProjectionLine(svgElement, viewport.id, originCanvas, intersectionCanvas, false, undefined, distanceToPlane);
      this._drawOriginCircle(svgElement, viewport.id, originCanvas);
      this._drawIntersectionMarker(svgElement, viewport.id, intersectionCanvas);
    } catch (error) {
      this.logger.error(`❌ Error in _renderIntersectionLine for ${viewport.id}:`, error);
    }
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
    // Remove existing line if any
    const existingLine = svg.querySelector(`[data-id="projection-line-${viewportId}"]`);
    if (existingLine) {
      existingLine.remove();
    }

    // Create line element
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('data-id', `projection-line-${viewportId}`);
    line.setAttribute('x1', originCanvas[0].toString());
    line.setAttribute('y1', originCanvas[1].toString());
    line.setAttribute('x2', tipCanvas[0].toString());
    line.setAttribute('y2', tipCanvas[1].toString());

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
    this._drawRulerTicks(svg, viewportId, originCanvas, tipCanvas, lineColor, lineOpacity);

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
   * Draw tool direction indicator showing 3D direction vs 2D projection
   */
  private _drawDirectionIndicator(
    viewport: any, 
    originWorld: vec3, 
    directionWorld: vec3,
    label: string
  ): void {
    const svg = this._getOrCreateSVGOverlay(viewport);
    if (!svg) return;

    const viewportId = viewport.id;
    
    // Remove existing indicator if any
    const existingIndicator = svg.querySelector(`[data-id="debug-direction-${viewportId}"]`);
    if (existingIndicator) {
      existingIndicator.remove();
    }

    // Create group
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-id', `debug-direction-${viewportId}`);

    // Project origin and direction endpoint
    const originCanvas = viewport.worldToCanvas([originWorld[0], originWorld[1], originWorld[2]]);
    const dirEndWorld = [
      originWorld[0] + directionWorld[0] * 30, // 30mm arrow
      originWorld[1] + directionWorld[1] * 30,
      originWorld[2] + directionWorld[2] * 30
    ];
    const dirEndCanvas = viewport.worldToCanvas(dirEndWorld);

    if (!isValidCanvasPoint(originCanvas) || !isValidCanvasPoint(dirEndCanvas)) {
      return;
    }

    // Draw direction arrow
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', originCanvas[0].toString());
    line.setAttribute('y1', originCanvas[1].toString());
    line.setAttribute('x2', dirEndCanvas[0].toString());
    line.setAttribute('y2', dirEndCanvas[1].toString());
    line.setAttribute('stroke', '#ff00ff'); // Magenta
    line.setAttribute('stroke-width', '3');
    line.setAttribute('opacity', '0.8');
    line.setAttribute('stroke-dasharray', '5,3');

    // Arrow head
    const dx = dirEndCanvas[0] - originCanvas[0];
    const dy = dirEndCanvas[1] - originCanvas[1];
    const angle = Math.atan2(dy, dx);
    const arrowSize = 12;

    const arrowHead = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const arrow1X = dirEndCanvas[0] - arrowSize * Math.cos(angle - Math.PI / 6);
    const arrow1Y = dirEndCanvas[1] - arrowSize * Math.sin(angle - Math.PI / 6);
    const arrow2X = dirEndCanvas[0] - arrowSize * Math.cos(angle + Math.PI / 6);
    const arrow2Y = dirEndCanvas[1] - arrowSize * Math.sin(angle + Math.PI / 6);
    
    arrowHead.setAttribute('d', `M ${dirEndCanvas[0]} ${dirEndCanvas[1]} L ${arrow1X} ${arrow1Y} L ${arrow2X} ${arrow2Y} Z`);
    arrowHead.setAttribute('fill', '#ff00ff');
    arrowHead.setAttribute('opacity', '0.8');

    // Add label with canvas angle
    const canvasAngle = Math.atan2(dy, dx) * 180 / Math.PI;
    const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelText.setAttribute('x', (dirEndCanvas[0] + 15).toString());
    labelText.setAttribute('y', (dirEndCanvas[1] - 10).toString());
    labelText.setAttribute('fill', '#ff00ff');
    labelText.setAttribute('font-size', '12');
    labelText.setAttribute('font-weight', 'bold');
    labelText.setAttribute('opacity', '0.9');
    labelText.textContent = `${label}: ${canvasAngle.toFixed(0)}°`;

    group.appendChild(line);
    group.appendChild(arrowHead);
    group.appendChild(labelText);
    svg.appendChild(group);
  }

  /**
   * Verify alignment between instrument body and extension line
   * This checks if both lines point in the same direction on canvas
   */
  private _verifyAlignment(
    viewport: any,
    base: number[],
    origin: number[],
    tip: number[],
    zAxis: number[]
  ): void {
    try {
      // Project all three points
      const baseCanvas = viewport.worldToCanvas([base[0], base[1], base[2]]);
      const originCanvas = viewport.worldToCanvas([origin[0], origin[1], origin[2]]);
      const tipCanvas = viewport.worldToCanvas([tip[0], tip[1], tip[2]]);

      if (!isValidCanvasPoint(baseCanvas) || 
          !isValidCanvasPoint(originCanvas) || 
          !isValidCanvasPoint(tipCanvas)) {
        this.logger.warn(`⚠️ Invalid canvas points in alignment check for ${viewport.id}`);
        return;
      }

      // Calculate instrument body direction (base → origin)
      const bodyDx = originCanvas[0] - baseCanvas[0];
      const bodyDy = originCanvas[1] - baseCanvas[1];
      const bodyLength = Math.sqrt(bodyDx * bodyDx + bodyDy * bodyDy);
      const bodyAngle = Math.atan2(bodyDy, bodyDx) * 180 / Math.PI;
      const bodyDir = [bodyDx / bodyLength, bodyDy / bodyLength];

      // Calculate extension direction (origin → tip)
      const extDx = tipCanvas[0] - originCanvas[0];
      const extDy = tipCanvas[1] - originCanvas[1];
      const extLength = Math.sqrt(extDx * extDx + extDy * extDy);
      const extAngle = Math.atan2(extDy, extDx) * 180 / Math.PI;
      const extDir = [extDx / extLength, extDy / extLength];

      // Calculate angle difference
      let angleDiff = extAngle - bodyAngle;
      // Normalize to [-180, 180]
      while (angleDiff > 180) angleDiff -= 360;
      while (angleDiff < -180) angleDiff += 360;

      // Calculate dot product (should be ~1.0 if aligned, ~-1.0 if opposite)
      const dotProduct = bodyDir[0] * extDir[0] + bodyDir[1] * extDir[1];

      this.logger.log(`\n${'='.repeat(80)}`);
      this.logger.log(`🔍 ALIGNMENT VERIFICATION [${viewport.id}]`);
      this.logger.log(`${'='.repeat(80)}`);
      
      this.logger.log(`\n📍 Canvas Coordinates:`);
      this.logger.log(`   Base:   [${baseCanvas[0].toFixed(1)}, ${baseCanvas[1].toFixed(1)}]`);
      this.logger.log(`   Origin: [${originCanvas[0].toFixed(1)}, ${originCanvas[1].toFixed(1)}]`);
      this.logger.log(`   Tip:    [${tipCanvas[0].toFixed(1)}, ${tipCanvas[1].toFixed(1)}]`);

      this.logger.log(`\n📐 Instrument Body (Base → Origin):`);
      this.logger.log(`   Direction: [${bodyDir[0].toFixed(3)}, ${bodyDir[1].toFixed(3)}]`);
      this.logger.log(`   Angle: ${bodyAngle.toFixed(2)}°`);
      this.logger.log(`   Length: ${bodyLength.toFixed(1)} px`);

      this.logger.log(`\n📐 Extension Line (Origin → Tip):`);
      this.logger.log(`   Direction: [${extDir[0].toFixed(3)}, ${extDir[1].toFixed(3)}]`);
      this.logger.log(`   Angle: ${extAngle.toFixed(2)}°`);
      this.logger.log(`   Length: ${extLength.toFixed(1)} px`);

      this.logger.log(`\n⚖️ ALIGNMENT METRICS:`);
      this.logger.log(`   Angle Difference: ${angleDiff.toFixed(2)}°`);
      this.logger.log(`   Dot Product: ${dotProduct.toFixed(4)} (1.0 = perfect alignment, -1.0 = opposite)`);

      // Check alignment
      const ANGLE_THRESHOLD = 5.0; // 5 degrees tolerance
      const DOT_THRESHOLD = 0.996; // cos(5°) ≈ 0.996

      if (Math.abs(angleDiff) > ANGLE_THRESHOLD || dotProduct < DOT_THRESHOLD) {
        this.logger.log(`\n❌ MISALIGNMENT DETECTED!`);
        this.logger.log(`   Expected: Both lines should point in the same direction (angle diff ≈ 0°)`);
        this.logger.log(`   Actual: ${Math.abs(angleDiff).toFixed(2)}° difference`);
        this.logger.log(`\n🔍 Possible causes:`);
        this.logger.log(`   1. worldToCanvas() applying different transformations to body vs extension`);
        this.logger.log(`   2. Viewport-specific coordinate system flip or rotation`);
        this.logger.log(`   3. Camera viewUp vector causing inconsistent projection`);
        this.logger.log(`   4. Plane intersection math modifying the extension points incorrectly`);
        
        // Log camera info for debugging
        const camera = viewport.getCamera();
        this.logger.log(`\n📷 Camera Info for ${viewport.id}:`);
        this.logger.log(`   viewPlaneNormal: [${camera.viewPlaneNormal.map((v: number) => v.toFixed(3)).join(', ')}]`);
        this.logger.log(`   viewUp: [${camera.viewUp.map((v: number) => v.toFixed(3)).join(', ')}]`);
        if (viewport.getViewPresentation) {
          const pres = viewport.getViewPresentation();
          this.logger.log(`   rotation: ${pres.rotation || 0}°`);
          this.logger.log(`   flipHorizontal: ${pres.flipHorizontal || false}`);
          this.logger.log(`   flipVertical: ${pres.flipVertical || false}`);
        }
      } else {
        this.logger.log(`\n✅ ALIGNMENT OK: Lines are properly aligned (${Math.abs(angleDiff).toFixed(2)}° difference)`);
      }

      this.logger.log(`${'='.repeat(80)}\n`);
    } catch (error) {
      this.logger.error(`❌ Error in alignment verification for ${viewport.id}:`, error);
    }
  }

  /**
   * Draw coordinate axes overlay for debugging
   * Shows how world X, Y, Z axes project onto the viewport canvas
   */
  private _drawCoordinateAxes(viewport: any, originWorld: vec3): void {
    const svg = this._getOrCreateSVGOverlay(viewport);
    if (!svg) return;

    const viewportId = viewport.id;
    
    // Remove existing axes if any
    const existingAxes = svg.querySelector(`[data-id="debug-axes-${viewportId}"]`);
    if (existingAxes) {
      existingAxes.remove();
    }

    // Create group for all axes
    const axesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    axesGroup.setAttribute('data-id', `debug-axes-${viewportId}`);

    // Define axis length in world units (mm)
    const axisLength = 50; // 50mm = 5cm

    // Define axes in world space
    const axes = [
      { name: 'X', direction: [1, 0, 0], color: '#ff0000' }, // Red
      { name: 'Y', direction: [0, 1, 0], color: '#00ff00' }, // Green
      { name: 'Z', direction: [0, 0, 1], color: '#0000ff' }  // Blue
    ];

    // Project origin
    const originCanvas = viewport.worldToCanvas([originWorld[0], originWorld[1], originWorld[2]]);
    
    if (!isValidCanvasPoint(originCanvas)) {
      return;
    }

    // Draw each axis
    axes.forEach(axis => {
      const endWorld = [
        originWorld[0] + axis.direction[0] * axisLength,
        originWorld[1] + axis.direction[1] * axisLength,
        originWorld[2] + axis.direction[2] * axisLength
      ];

      const endCanvas = viewport.worldToCanvas(endWorld);
      
      if (!isValidCanvasPoint(endCanvas)) {
        return;
      }

      // Draw axis line
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', originCanvas[0].toString());
      line.setAttribute('y1', originCanvas[1].toString());
      line.setAttribute('x2', endCanvas[0].toString());
      line.setAttribute('y2', endCanvas[1].toString());
      line.setAttribute('stroke', axis.color);
      line.setAttribute('stroke-width', '2');
      line.setAttribute('opacity', '0.7');
      line.setAttribute('stroke-linecap', 'round');

      // Draw arrow at end
      const dx = endCanvas[0] - originCanvas[0];
      const dy = endCanvas[1] - originCanvas[1];
      const angle = Math.atan2(dy, dx);
      const arrowSize = 8;

      const arrowHead = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const arrow1X = endCanvas[0] - arrowSize * Math.cos(angle - Math.PI / 6);
      const arrow1Y = endCanvas[1] - arrowSize * Math.sin(angle - Math.PI / 6);
      const arrow2X = endCanvas[0] - arrowSize * Math.cos(angle + Math.PI / 6);
      const arrow2Y = endCanvas[1] - arrowSize * Math.sin(angle + Math.PI / 6);
      
      arrowHead.setAttribute('d', `M ${endCanvas[0]} ${endCanvas[1]} L ${arrow1X} ${arrow1Y} M ${endCanvas[0]} ${endCanvas[1]} L ${arrow2X} ${arrow2Y}`);
      arrowHead.setAttribute('stroke', axis.color);
      arrowHead.setAttribute('stroke-width', '2');
      arrowHead.setAttribute('opacity', '0.7');
      arrowHead.setAttribute('stroke-linecap', 'round');

      // Add text label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', (endCanvas[0] + 10).toString());
      label.setAttribute('y', (endCanvas[1] + 5).toString());
      label.setAttribute('fill', axis.color);
      label.setAttribute('font-size', '14');
      label.setAttribute('font-weight', 'bold');
      label.setAttribute('opacity', '0.9');
      label.textContent = axis.name;

      axesGroup.appendChild(line);
      axesGroup.appendChild(arrowHead);
      axesGroup.appendChild(label);
    });

    // Add origin marker
    const originMarker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    originMarker.setAttribute('cx', originCanvas[0].toString());
    originMarker.setAttribute('cy', originCanvas[1].toString());
    originMarker.setAttribute('r', '4');
    originMarker.setAttribute('fill', '#ffffff');
    originMarker.setAttribute('stroke', '#000000');
    originMarker.setAttribute('stroke-width', '2');
    axesGroup.appendChild(originMarker);

    svg.appendChild(axesGroup);
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
    // Remove existing instrument body line if any
    const existingLine = svg.querySelector(`[data-id="instrument-body-${viewportId}"]`);
    if (existingLine) {
      existingLine.remove();
    }

    // Create line element for instrument body
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('data-id', `instrument-body-${viewportId}`);
    line.setAttribute('x1', baseCanvas[0].toString());
    line.setAttribute('y1', baseCanvas[1].toString());
    line.setAttribute('x2', originCanvas[0].toString());
    line.setAttribute('y2', originCanvas[1].toString());

    // Style: solid line, thicker, yellow color to represent physical instrument
    line.setAttribute('stroke', '#ffff00'); // Yellow color for instrument body
    line.setAttribute('stroke-width', '4'); // Thicker line for instrument body
    line.setAttribute('opacity', '0.8');
    line.setAttribute('stroke-linecap', 'round');

    // Add line to SVG
    svg.appendChild(line);
  }
}
