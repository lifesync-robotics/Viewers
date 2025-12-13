/**
 * Camera Following Mode
 *
 * Viewport camera follows tool movement and rotation.
 * Supports both 3-DOF (position only) and 6-DOF (position + orientation) tracking.
 */

import { vec3 } from 'gl-matrix';
import { Types as cs3DTypes } from '@cornerstonejs/core';
import NavigationMode from './NavigationMode';
import { ToolProjectionRenderer, ToolRepresentation } from './ToolProjectionRenderer';
import {
  convertTo2DMatrix,
  updateMatrixTranslation,
  extractRotationMatrix,
  getViewportOrientation,
  getCameraConfigForView,
  extractToolRepresentation,
  Logger,
  isValidCanvasPoint
} from './utils';

export class CameraFollowingMode extends NavigationMode {
  private useOrientationTracking: boolean = true; // Default: 6-DOF
  private lastPosition: number[] | null = null;
  private tooltipProjectionRenderer: ToolProjectionRenderer | null = null;

  // Camera distance from tooltip (in mm)
  private readonly CAMERA_DISTANCE: number = 350;

  // Tool visualization configuration (matching InstrumentProjectionMode)
  private extensionLength: number = 30;  // 30mm extension line (3cm)
  private instrumentLength: number = 50; // 50mm instrument body (5cm)

  // Diagnostic state: Track which matrices have been logged as identity (prevent spam)
  private loggedIdentityMatrices: Set<string> = new Set();

  // Logger for consistent logging
  private logger = new Logger('[CameraFollow]');

  constructor(servicesManager: any, coordinateTransformer: any) {
    super(servicesManager, coordinateTransformer);
  }

  getModeName(): string {
    return 'camera-follow';
  }

  onModeEnter(): void {
    console.log('📹 Camera Follow mode activated - CORRECT IMPLEMENTATION');
    console.log('   Camera will follow tooltip, DICOM stays stationary');
    console.log('   Camera distance: 350mm from tooltip');
    console.log(`   Tool visualization: ${this.extensionLength}mm extension + ${this.instrumentLength}mm body`);
    this.lastPosition = null;
    
    // Initialize ToolProjectionRenderer for tool visualization
    this.tooltipProjectionRenderer = new ToolProjectionRenderer(
      this.servicesManager,
      this.extensionLength,
      this.instrumentLength
    );
    
    console.log('✅ Camera Follow mode ready - tool visualization enabled');
  }

  onModeExit(): void {
    console.log('📹 Camera Follow mode deactivated');
    this.lastPosition = null;
    this.loggedIdentityMatrices.clear(); // Reset diagnostic logging state

    // Cleanup tooltip projection renderer
    if (this.tooltipProjectionRenderer) {
      this.tooltipProjectionRenderer.cleanup();
      this.tooltipProjectionRenderer = null;
    }
  }

  cleanup(): void {
    this.lastPosition = null;
    this.loggedIdentityMatrices.clear(); // Reset diagnostic logging state

    // Cleanup tooltip projection renderer
    if (this.tooltipProjectionRenderer) {
      this.tooltipProjectionRenderer.cleanup();
      this.tooltipProjectionRenderer = null;
    }
  }

  /**
   * Handle tracking update - update camera position to follow tooltip
   * 
   * CORRECT IMPLEMENTATION:
   * - DICOM volume stays stationary (efficient rendering)
   * - Camera moves to follow tooltip
   * - tooltip2dicom matrix tells us where tooltip is in DICOM space
   * - Camera is positioned relative to tooltip based on viewport orientation
   */
  handleTrackingUpdate(
    position: number[],
    orientation: number[],
    matrix?: number[] | number[][]
  ): void {
    this.incrementUpdateCount();

    const viewports = this.getViewports();

    if (viewports.length === 0) {
      return;
    }

    // Check if we have valid matrix for 6-DOF mode
    const hasValidMatrix = matrix && (
      (Array.isArray(matrix) && matrix.length === 4 && Array.isArray(matrix[0])) ||  // 2D array
      (Array.isArray(matrix) && matrix.length >= 16 && typeof matrix[0] === 'number')  // Flat array
    );

    if (!hasValidMatrix) {
      console.warn('⚠️ No valid transformation matrix, cannot update camera');
      return;
    }

    // Extract tooltip position from matrix (translation component)
    const matrix2D = convertTo2DMatrix(matrix);
    const tooltipPosition: number[] = [
      matrix2D[0][3],
      matrix2D[1][3],
      matrix2D[2][3]
    ];

    // Clamp tooltip position to volume bounds
    // This ensures camera focal point stays within visible DICOM volume
    const clampedPosition = this.clampToVolumeBounds(tooltipPosition);
    const finalPosition = clampedPosition || tooltipPosition;

    // Check if position was clamped (out of bounds warning)
    if (clampedPosition) {
      const delta = Math.sqrt(
        Math.pow(tooltipPosition[0] - clampedPosition[0], 2) +
        Math.pow(tooltipPosition[1] - clampedPosition[1], 2) +
        Math.pow(tooltipPosition[2] - clampedPosition[2], 2)
      );
      
      if (delta > 0.1 && this.updateCount % 50 === 0) {
        console.warn(`⚠️ [Camera Follow] Tooltip position clamped to volume bounds`);
        console.warn(`   Original: [${tooltipPosition.map(v => v.toFixed(1)).join(', ')}]`);
        console.warn(`   Clamped:  [${clampedPosition.map(v => v.toFixed(1)).join(', ')}]`);
        console.warn(`   Delta: ${delta.toFixed(1)}mm`);
      }
    }

    // Store initial position
    if (!this.lastPosition) {
      this.lastPosition = finalPosition;
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📹 [CameraFollowingMode] INITIAL TRACKING UPDATE`);
      console.log(`${'='.repeat(80)}`);
      console.log(`📍 Initial tooltip position: [${finalPosition.map(v => v.toFixed(1)).join(', ')}]`);
      console.log(`   DICOM stays stationary, camera will follow tooltip`);
      console.log(`   Position clamping: ENABLED (keeps camera within volume bounds)`);
      
      // Update matrix with clamped position if needed
      const clampedMatrix = updateMatrixTranslation(matrix2D, finalPosition);
      
      // Set initial cameras for all viewports
      this._setupInitialCameras(viewports, clampedMatrix);
      
      console.log(`${'='.repeat(80)}\n`);
    }

    // Update matrix with clamped position for rendering
    const clampedMatrix = updateMatrixTranslation(matrix2D, finalPosition);

    // Extract tool representation for visualization
    const toolRepresentation = extractToolRepresentation(finalPosition, clampedMatrix, this.extensionLength);
    
    // Update tool visualization (tip, body, extension line)
    if (this.tooltipProjectionRenderer) {
      this.tooltipProjectionRenderer.updateProjection(toolRepresentation);
    }

    // Update each viewport's camera to follow tooltip
    viewports.forEach(vp => {
      try {
        if (!vp || vp.type === 'stack') {
          return;
        }

        this._updateCameraToFollowTooltip(vp, clampedMatrix);

        // Render the viewport
        vp.render();
      } catch (error) {
        if (this.updateCount <= 5) {
          console.error(`❌ Error updating ${vp.id}:`, error);
        }
      }
    });

    this.lastPosition = finalPosition;
  }

  /**
   * Enable/disable orientation tracking
   */
  public enableOrientationTracking(enable: boolean): void {
    this.useOrientationTracking = enable;
    console.log(`🔄 Orientation tracking: ${enable ? 'ENABLED ✅' : 'DISABLED ❌'}`);
    console.log(`   Mode: ${enable ? '6-DOF (position + orientation)' : '3-DOF (position only)'}`);
  }

  /**
   * Get orientation tracking status
   */
  public isOrientationTrackingEnabled(): boolean {
    return this.useOrientationTracking;
  }

  /**
   * Setup initial cameras for all viewports based on tooltip position
   * Creates axial, sagittal, and coronal views centered on the tooltip
   * 
   * @param viewports - List of viewports to initialize
   * @param tooltip2dicom - Transformation matrix (tooltip → DICOM space)
   */
  private _setupInitialCameras(viewports: any[], tooltip2dicom: number[] | number[][]): void {
    console.log('\n🎬 [Initial Camera Setup] Setting up axial/sagittal/coronal views');
    
    // Convert matrix to 2D format
    const matrix2D = convertTo2DMatrix(tooltip2dicom);
    
    // Extract tooltip position in DICOM space (translation component)
    const tooltipPosition: cs3DTypes.Point3 = [
      matrix2D[0][3],
      matrix2D[1][3],
      matrix2D[2][3]
    ];
    
    // Extract tooltip orientation (Z-axis of tooltip in DICOM space)
    const tooltipZAxis = vec3.fromValues(
      matrix2D[0][2],
      matrix2D[1][2],
      matrix2D[2][2]
    );
    vec3.normalize(tooltipZAxis, tooltipZAxis);
    
    console.log(`   Tooltip position (focal point): [${tooltipPosition.map(v => v.toFixed(1)).join(', ')}]`);
    console.log(`   Tooltip Z-axis: [${tooltipZAxis[0].toFixed(3)}, ${tooltipZAxis[1].toFixed(3)}, ${tooltipZAxis[2].toFixed(3)}]`);
    
    viewports.forEach(vp => {
      if (!vp || vp.type === 'stack') {
        return;
      }
      
      // Determine viewport orientation from viewport ID
      const viewType = getViewportOrientation(vp.id);
      
      // Set up camera based on view type
      const cameraConfig = getCameraConfigForView(viewType, tooltipPosition, matrix2D, this.CAMERA_DISTANCE);
      
      console.log(`   ${vp.id} (${viewType}): focal=[${cameraConfig.focalPoint.map(v => v.toFixed(1)).join(', ')}], pos=[${cameraConfig.position.map(v => v.toFixed(1)).join(', ')}]`);
      
      vp.setCamera({
        focalPoint: cameraConfig.focalPoint,
        position: cameraConfig.position,
        viewUp: cameraConfig.viewUp
      });
      
      vp.render();
    });
    
    console.log('✅ Initial cameras set up for all viewports\n');
  }

  /**
   * Update camera to follow tooltip movement
   * Camera focal point follows tooltip position
   * Camera position maintains relative offset
   * ViewUp follows tooltip orientation
   * 
   * @param vp - Viewport to update
   * @param tooltip2dicom - Transformation matrix (tooltip → DICOM space)
   */
  private _updateCameraToFollowTooltip(vp: any, tooltip2dicom: number[] | number[][]): void {
    // Convert matrix to 2D format
    const matrix2D = convertTo2DMatrix(tooltip2dicom);
    
    // Extract tooltip position in DICOM space (focal point)
    const tooltipPosition: cs3DTypes.Point3 = [
      matrix2D[0][3],
      matrix2D[1][3],
      matrix2D[2][3]
    ];
    
    // Determine viewport orientation
    const viewType = getViewportOrientation(vp.id);
    
    // Get camera configuration for this view
    const cameraConfig = getCameraConfigForView(viewType, tooltipPosition, matrix2D, this.CAMERA_DISTANCE);
    
    // Update camera
    vp.setCamera({
      focalPoint: cameraConfig.focalPoint,
      position: cameraConfig.position,
      viewUp: cameraConfig.viewUp
    });
  }







  /**
   * Set extension length (for tool visualization)
   */
  public setExtensionLength(length: number): void {
    const safeLength = Number.isFinite(length) ? Math.max(0, length) : 0;
    this.extensionLength = safeLength;

    if (this.tooltipProjectionRenderer) {
      this.tooltipProjectionRenderer.setExtensionLength(safeLength);
    }
    
    console.log(`📐 Camera Follow: Extension length set to ${safeLength}mm`);
  }

  /**
   * Get extension length
   */
  public getExtensionLength(): number {
    return this.extensionLength;
  }

  /**
   * Set instrument length (for tool visualization)
   */
  public setInstrumentLength(length: number): void {
    const safeLength = Number.isFinite(length) ? Math.max(0, length) : 0;
    this.instrumentLength = safeLength;
    
    if (this.tooltipProjectionRenderer) {
      this.tooltipProjectionRenderer.setInstrumentLength(safeLength);
    }
    
    console.log(`📐 Camera Follow: Instrument length set to ${safeLength}mm`);
  }

  /**
   * Get instrument length
   */
  public getInstrumentLength(): number {
    return this.instrumentLength;
  }
}

