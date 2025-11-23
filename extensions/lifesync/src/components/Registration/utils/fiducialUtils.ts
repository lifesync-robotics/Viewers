/**
 * Fiducial Utilities
 *
 * Helper functions for managing fiducial annotations and viewport navigation
 */

import { getRenderingEngine, utilities as csUtils } from '@cornerstonejs/core';
import { annotation } from '@cornerstonejs/tools';
import { vec3 } from 'gl-matrix';
import type { Fiducial } from '../types';

/**
 * Get crosshair position from viewport
 */
export function getCrosshairPosition(): number[] | null {
  try {
    const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
    if (!renderingEngine) {
      console.warn('⚠️ No rendering engine found');
      return null;
    }

    const viewports = renderingEngine.getViewports();
    for (const viewport of viewports) {
      try {
        const element = viewport.element;
        if (!element) continue;

        const annotations = annotation.state.getAnnotations('Crosshairs', element);
        if (annotations && annotations.length > 0) {
          const crosshairAnnotation = annotations[0];

          // Get position from toolCenter (preferred)
          if (crosshairAnnotation.data?.handles?.toolCenter) {
            const pos = crosshairAnnotation.data.handles.toolCenter;
            if (Array.isArray(pos) && pos.length >= 3) {
              return [pos[0], pos[1], pos[2]];
            }
          }

          // Fallback to rotationPoints
          if (crosshairAnnotation.data?.handles?.rotationPoints) {
            const rotPoints = crosshairAnnotation.data.handles.rotationPoints;
            if (Array.isArray(rotPoints) && rotPoints.length > 0) {
              const firstPoint = rotPoints[0];
              if (Array.isArray(firstPoint) && firstPoint.length > 0) {
                const pos = Array.isArray(firstPoint[0]) ? firstPoint[0] : firstPoint;
                if (pos.length >= 3) {
                  return [pos[0], pos[1], pos[2]];
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error getting crosshair from viewport:`, error);
      }
    }

    // Fallback to first viewport's camera focal point
    if (viewports.length > 0) {
      const camera = viewports[0].getCamera();
      if (camera.focalPoint) {
        return [camera.focalPoint[0], camera.focalPoint[1], camera.focalPoint[2]];
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Error getting crosshair position:', error);
    return null;
  }
}

/**
 * Jump viewport camera to a specific 3D position
 * Based on jumpToMeasurementViewport implementation in commandsModule
 */
export function jumpToPosition(
  position: number[],
  servicesManager: any
): boolean {
  try {
    const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
    if (!renderingEngine) {
      console.warn('⚠️ No rendering engine found');
      return false;
    }

    const viewports = renderingEngine.getViewports();
    if (viewports.length === 0) {
      console.warn('⚠️ No viewports found');
      return false;
    }

    const targetPosition: [number, number, number] = [
      position[0],
      position[1],
      position[2],
    ];

    // Update all viewports' cameras to focus on the position
    for (const viewport of viewports) {
      try {
        const camera = viewport.getCamera();
        const { position: cameraPosition, focalPoint: cameraFocalPoint } = camera;

        // Calculate new camera position maintaining the same viewing direction
        // This is similar to how jumpToMeasurementViewport works
        const viewDirection = vec3.sub(
          vec3.create(),
          cameraPosition as [number, number, number],
          cameraFocalPoint as [number, number, number]
        );
        const newPosition = vec3.add(
          vec3.create(),
          targetPosition,
          viewDirection
        ) as [number, number, number];

        // Update camera
        viewport.setCamera({
          focalPoint: targetPosition,
          position: newPosition,
        });

        // For stack viewports, try to jump to the slice containing this position
        if (viewport.type === 'stack') {
          try {
            // Try to find the closest slice to the target position
            const imageIds = (viewport as any).getImageIds?.();
            if (imageIds && imageIds.length > 0) {
              // Use utilities.jumpToSlice if available
              const { utilities } = require('@cornerstonejs/core');
              if (utilities && utilities.jumpToSlice) {
                // For now, just update the camera - slice jumping can be enhanced later
                viewport.render();
              }
            }
          } catch (sliceError) {
            // If slice jumping fails, just update the camera
            console.debug('⚠️ Could not jump to slice, updating camera only:', sliceError);
            viewport.render();
          }
        } else {
          // For volume viewports, just update the camera
          viewport.render();
        }
      } catch (error) {
        console.warn(`⚠️ Error updating viewport ${viewport.id}:`, error);
      }
    }

    // Also update crosshairs if available
    try {
      const { cornerstoneViewportService } = servicesManager?.services;
      if (cornerstoneViewportService && typeof cornerstoneViewportService.setCameraForViewports === 'function') {
        cornerstoneViewportService.setCameraForViewports({
          focalPoint: targetPosition,
        });
      }
    } catch (error) {
      // Crosshair update is optional, don't fail if it doesn't work
      console.debug('⚠️ Could not update crosshairs (optional):', error);
    }

    console.log(`✅ Jumped to position: [${targetPosition[0].toFixed(1)}, ${targetPosition[1].toFixed(1)}, ${targetPosition[2].toFixed(1)}]`);
    return true;
  } catch (error) {
    console.error('❌ Error jumping to position:', error);
    return false;
  }
}

/**
 * Convert DICOM position (LPS) to World position (RAS)
 * DICOM: Left(+X), Posterior(+Y), Superior(+Z)
 * World: Right(+X), Anterior(+Y), Superior(+Z)
 */
export function dicomToWorld(dicomPos: number[]): number[] {
  return [-dicomPos[0], -dicomPos[1], dicomPos[2]];
}

/**
 * Convert World position (RAS) to DICOM position (LPS)
 */
export function worldToDicom(worldPos: number[]): number[] {
  return [-worldPos[0], -worldPos[1], worldPos[2]];
}

/**
 * Get all fiducial annotations from measurement service
 */
export function getFiducialAnnotations(servicesManager: any): any[] {
  try {
    const { measurementService } = servicesManager.services;
    if (!measurementService) {
      console.warn('⚠️ Measurement service not available');
      return [];
    }

    const measurements = measurementService.getMeasurements();
    const fiducialMeasurements = measurements.filter(
      (m: any) => m.toolName === 'FiducialMarker'
    );

    return fiducialMeasurements;
  } catch (error) {
    console.error('❌ Error getting fiducial annotations:', error);
    return [];
  }
}

/**
 * Convert annotation to Fiducial type
 */
export function annotationToFiducial(annotation: any, pointId?: string): Fiducial | null {
  try {
    const points = annotation.data?.handles?.points;
    if (!points || points.length === 0) {
      return null;
    }

    const position = points[0];
    if (!position || position.length < 3) {
      return null;
    }

    // Convert world position (RAS) to DICOM position (LPS)
    const dicomPos = worldToDicom([position[0], position[1], position[2]]);

    return {
      point_id: pointId || annotation.data?.label || `F${Date.now()}`,
      label: annotation.data?.label || 'Unnamed',
      dicom_position_mm: dicomPos as [number, number, number],
      status: 'pending',
      source: 'intraop',
      confidence: 'high',
    };
  } catch (error) {
    console.error('❌ Error converting annotation to fiducial:', error);
    return null;
  }
}

/**
 * Add fiducial annotation at crosshair position
 * This is a wrapper that creates the annotation directly
 */
export function addFiducialAnnotationAtCrosshair(
  servicesManager: any,
  label?: string
): { success: boolean; position?: number[]; annotationUID?: string } {
  try {
    const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
    if (!renderingEngine) {
      console.warn('⚠️ No rendering engine found');
      return { success: false };
    }

    // Get crosshair position
    const crosshairPos = getCrosshairPosition();
    if (!crosshairPos) {
      console.warn('⚠️ No crosshair position found');
      return { success: false };
    }

    // Find element with crosshair
    let element = null;
    for (const viewport of renderingEngine.getViewports()) {
      const vpElement = viewport.element;
      if (!vpElement) continue;

      const annotations = annotation.state.getAnnotations('Crosshairs', vpElement);
      if (annotations && annotations.length > 0) {
        element = vpElement;
        break;
      }
    }

    if (!element) {
      element = renderingEngine.getViewports()[0]?.element;
    }

    if (!element) {
      console.warn('⚠️ No viewport element found');
      return { success: false };
    }

    // Get existing fiducials to determine next label
    const existingFiducials = annotation.state.getAnnotations('FiducialMarker', element);
    const fiducialCount = existingFiducials ? existingFiducials.length : 0;
    const fiducialLabel = label || `F${fiducialCount + 1}`;

    // Get viewport info
    const viewport = renderingEngine.getViewports().find(vp => vp.element === element);
    if (!viewport) {
      console.warn('⚠️ Could not find viewport');
      return { success: false };
    }

    const frameOfReferenceUID = viewport.getFrameOfReferenceUID();
    const camera = viewport.getCamera();

    // Create fiducial annotation
    const fiducialAnnotation: any = {
      annotationUID: csUtils.uuidv4(),
      highlighted: true,
      invalidated: false,
      isLocked: false,
      isVisible: true,
      metadata: {
        viewPlaneNormal: camera.viewPlaneNormal || [0, 0, 1],
        viewUp: camera.viewUp || [0, -1, 0],
        FrameOfReferenceUID: frameOfReferenceUID,
        referencedImageId: '',
        toolName: 'FiducialMarker',
      },
      data: {
        label: fiducialLabel,
        handles: {
          points: [[
            parseFloat(crosshairPos[0]),
            parseFloat(crosshairPos[1]),
            parseFloat(crosshairPos[2])
          ]],
        },
        radius: 0.5,
        cachedStats: {},
      },
    };

    // Add to annotation state
    annotation.state.addAnnotation(fiducialAnnotation, element);

    // Force render all viewports
    const allViewports = renderingEngine.getViewports();
    allViewports.forEach(vp => {
      try {
        vp.render();
      } catch (error) {
        console.warn('⚠️ Error rendering viewport:', error);
      }
    });

    console.log(`✅ Added fiducial ${fiducialLabel} at world coordinates:`, crosshairPos);
    return {
      success: true,
      position: crosshairPos,
      annotationUID: fiducialAnnotation.annotationUID,
    };
  } catch (error) {
    console.error('❌ Error adding fiducial annotation:', error);
    return { success: false };
  }
}

/**
 * Sync fiducials from annotations to panel state
 */
export function syncFiducialsFromAnnotations(
  servicesManager: any,
  existingFiducials: Fiducial[]
): Fiducial[] {
  try {
    const annotations = getFiducialAnnotations(servicesManager);
    const syncedFiducials: Fiducial[] = [...existingFiducials];

    // Add new annotations that aren't in existing fiducials
    for (const annotation of annotations) {
      const annotationLabel = annotation.data?.label;
      const existing = syncedFiducials.find(f => f.point_id === annotationLabel);

      if (!existing) {
        const fiducial = annotationToFiducial(annotation, annotationLabel);
        if (fiducial) {
          syncedFiducials.push(fiducial);
        }
      }
    }

    return syncedFiducials;
  } catch (error) {
    console.error('❌ Error syncing fiducials:', error);
    return existingFiducials;
  }
}
