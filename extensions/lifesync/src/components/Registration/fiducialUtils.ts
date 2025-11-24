/**
 * Fiducial Utilities
 *
 * Helper functions for managing fiducial annotations and viewport navigation
 */

import { getRenderingEngine, utilities as csUtils } from '@cornerstonejs/core';
import { annotation } from '@cornerstonejs/tools';
import type { Fiducial } from './types';

/**
 * Add a fiducial at the current crosshair position
 * Returns the created fiducial data or null if failed
 */
export function addFiducialAtCrosshairPosition(servicesManager: any): {
  success: boolean;
  fiducial?: Fiducial;
  error?: string;
} {
  try {
    console.log('📍 Adding fiducial at crosshair position...');

    // Get rendering engine
    const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
    if (!renderingEngine || renderingEngine.getViewports().length === 0) {
      return {
        success: false,
        error: 'No rendering engine or viewports found',
      };
    }

    // Find crosshair position from annotation
    let crosshairPosition = null;
    let element = null;

    for (const viewport of renderingEngine.getViewports()) {
      try {
        const vpElement = viewport.element;
        if (!vpElement) continue;

        const annotations = annotation.state.getAnnotations('Crosshairs', vpElement);
        if (annotations && annotations.length > 0) {
          const crosshairAnnotation = annotations[0];

          // Get position from toolCenter (the actual crosshair center)
          if (crosshairAnnotation.data?.handles?.toolCenter) {
            crosshairPosition = crosshairAnnotation.data.handles.toolCenter;
            element = vpElement;
            break;
          } else if (crosshairAnnotation.data?.handles?.rotationPoints) {
            // Fallback to rotationPoints
            crosshairPosition = crosshairAnnotation.data.handles.rotationPoints[0];
            element = vpElement;
            break;
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error getting crosshair from ${viewport.id}:`, error);
      }
    }

    // Fallback to first viewport's camera focal point
    if (!crosshairPosition) {
      console.warn('⚠️ No crosshair found, using camera focal point');
      const firstViewport = renderingEngine.getViewports()[0];
      const camera = firstViewport.getCamera();
      crosshairPosition = camera.focalPoint;
      element = firstViewport.element;
    }

    if (!crosshairPosition || !element) {
      return {
        success: false,
        error: 'Could not determine position for fiducial',
      };
    }

    // Extract the actual position from crosshairPosition
    let position: number[];

    if (Array.isArray(crosshairPosition)) {
      if (crosshairPosition.length === 3 && typeof crosshairPosition[0] === 'number') {
        // toolCenter: Simple [x, y, z] array
        position = crosshairPosition;
      } else if (Array.isArray(crosshairPosition[0])) {
        // rotationPoints[0]: Complex Array(4) where [0] contains [x, y, z]
        position = crosshairPosition[0];
      } else {
        // Fallback
        position = [crosshairPosition[0], crosshairPosition[1], crosshairPosition[2]];
      }
    } else {
      return {
        success: false,
        error: 'Crosshair position is not an array',
      };
    }

    // Get existing fiducials to determine next label
    const existingFiducials = annotation.state.getAnnotations('FiducialMarker', element);
    const fiducialCount = existingFiducials ? existingFiducials.length : 0;
    const label = `F${fiducialCount + 1}`;

    // Get viewport info for metadata
    const viewport = renderingEngine.getViewports().find(vp => vp.element === element);
    if (!viewport) {
      return {
        success: false,
        error: 'Could not find viewport for element',
      };
    }

    const frameOfReferenceUID = viewport.getFrameOfReferenceUID();
    const camera = viewport.getCamera();

    // Get referencedImageId from viewport
    let referencedImageId = '';
    try {
      if (viewport.type === 'orthographic' || viewport.type === 'volume3d') {
        const imageIds = (viewport as any).getImageIds?.();
        if (imageIds && imageIds.length > 0) {
          referencedImageId = imageIds[0];
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not get referencedImageId:', error);
    }

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
        referencedImageId: referencedImageId,
        toolName: 'FiducialMarker',
      },
      data: {
        label: label,
        handles: {
          points: [[
            parseFloat(position[0]),
            parseFloat(position[1]),
            parseFloat(position[2])
          ]],
        },
        radius: 0.5,
        cachedStats: {},
      },
    };

    // Add to annotation state
    annotation.state.addAnnotation(fiducialAnnotation, element);

    console.log(`✅ Added ${label} at world coordinates: [${position[0].toFixed(2)}, ${position[1].toFixed(2)}, ${position[2].toFixed(2)}] mm`);

    // Force render all viewports
    const allViewports = renderingEngine.getViewports();
    allViewports.forEach(vp => {
      try {
        vp.render();
      } catch (error) {
        console.warn('⚠️ Error rendering viewport:', error);
      }
    });

    // Convert to Fiducial format
    const fiducial: Fiducial = {
      point_id: label,
      label: label,
      dicom_position_mm: [position[0], position[1], position[2]],
      status: 'pending',
      source: 'intraop',
      placed_at: Date.now() / 1000,
    };

    return {
      success: true,
      fiducial,
    };
  } catch (error: any) {
    console.error('❌ Error adding fiducial at crosshair:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Jump viewport camera to a fiducial position
 */
export function jumpToFiducialPosition(
  servicesManager: any,
  position: [number, number, number]
): boolean {
  try {
    const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
    if (!renderingEngine) {
      console.error('❌ Rendering engine not found');
      return false;
    }

    const viewports = renderingEngine.getViewports();
    if (viewports.length === 0) {
      console.error('❌ No viewports found');
      return false;
    }

    // Jump all MPR viewports to the position
    for (const viewport of viewports) {
      try {
        const camera = viewport.getCamera();

        // Update camera focal point to the fiducial position
        camera.focalPoint = [position[0], position[1], position[2]];

        // Update camera position to maintain view
        const distance = Math.sqrt(
          Math.pow(camera.position[0] - camera.focalPoint[0], 2) +
          Math.pow(camera.position[1] - camera.focalPoint[1], 2) +
          Math.pow(camera.position[2] - camera.focalPoint[2], 2)
        );

        // Maintain the same distance from focal point
        const viewPlaneNormal = camera.viewPlaneNormal;
        camera.position = [
          camera.focalPoint[0] - viewPlaneNormal[0] * distance,
          camera.focalPoint[1] - viewPlaneNormal[1] * distance,
          camera.focalPoint[2] - viewPlaneNormal[2] * distance,
        ];

        viewport.setCamera(camera);
        viewport.render();
      } catch (error) {
        console.warn(`⚠️ Error jumping viewport ${viewport.id}:`, error);
      }
    }

    console.log(`✅ Jumped to position: [${position[0].toFixed(1)}, ${position[1].toFixed(1)}, ${position[2].toFixed(1)}]`);
    return true;
  } catch (error: any) {
    console.error('❌ Error jumping to fiducial position:', error);
    return false;
  }
}

/**
 * Get all fiducial annotations from viewport
 */
export function getFiducialAnnotationsFromViewport(servicesManager: any): Fiducial[] {
  try {
    const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
    if (!renderingEngine) {
      return [];
    }

    const viewports = renderingEngine.getViewports();
    if (viewports.length === 0) {
      return [];
    }

    const element = viewports[0].element;
    const fiducialAnnotations = annotation.state.getAnnotations('FiducialMarker', element);

    if (!fiducialAnnotations || fiducialAnnotations.length === 0) {
      return [];
    }

    // Convert annotations to Fiducial format
    return fiducialAnnotations.map((ann: any, index: number) => {
      const point = ann.data.handles.points[0];
      const label = ann.data.label || `F${index + 1}`;

      return {
        point_id: label,
        label: label,
        dicom_position_mm: [point[0], point[1], point[2]],
        status: 'pending',
        source: 'intraop',
        placed_at: Date.now() / 1000,
      } as Fiducial;
    });
  } catch (error) {
    console.error('Error getting fiducial annotations:', error);
    return [];
  }
}

/**
 * Sync fiducials from panel state to viewport annotations
 * Creates annotations for fiducials that don't exist in viewport
 */
export function syncFiducialsToViewport(
  servicesManager: any,
  fiducials: Fiducial[]
): void {
  try {
    const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
    if (!renderingEngine) {
      return;
    }

    const viewports = renderingEngine.getViewports();
    if (viewports.length === 0) {
      return;
    }

    const element = viewports[0].element;
    const existingAnnotations = annotation.state.getAnnotations('FiducialMarker', element) || [];
    const existingLabels = new Set(existingAnnotations.map((ann: any) => ann.data.label));

    // Create annotations for fiducials that don't exist
    for (const fiducial of fiducials) {
      if (!existingLabels.has(fiducial.point_id)) {
        const viewport = viewports[0];
        const frameOfReferenceUID = viewport.getFrameOfReferenceUID();
        const camera = viewport.getCamera();

        const fiducialAnnotation: any = {
          annotationUID: `fiducial-${fiducial.point_id}-${Date.now()}`,
          highlighted: false,
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
            label: fiducial.point_id,
            handles: {
              points: [[
                fiducial.dicom_position_mm[0],
                fiducial.dicom_position_mm[1],
                fiducial.dicom_position_mm[2],
              ]],
            },
            radius: 0.5,
            cachedStats: {},
          },
        };

        annotation.state.addAnnotation(fiducialAnnotation, element);
      }
    }

    // Render all viewports
    viewports.forEach(vp => {
      try {
        vp.render();
      } catch (error) {
        console.warn('⚠️ Error rendering viewport:', error);
      }
    });
  } catch (error) {
    console.error('Error syncing fiducials to viewport:', error);
  }
}

/**
 * Remove fiducial annotation from viewport
 */
export function removeFiducialFromViewport(
  servicesManager: any,
  pointId: string
): boolean {
  try {
    const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
    if (!renderingEngine) {
      return false;
    }

    const viewports = renderingEngine.getViewports();
    if (viewports.length === 0) {
      return false;
    }

    const element = viewports[0].element;
    const fiducialAnnotations = annotation.state.getAnnotations('FiducialMarker', element) || [];

    // Find and remove the annotation with matching label
    const annotationToRemove = fiducialAnnotations.find(
      (ann: any) => ann.data.label === pointId
    );

    if (annotationToRemove) {
      annotation.state.removeAnnotation(annotationToRemove.annotationUID);

      // Render all viewports
      viewports.forEach(vp => {
        try {
          vp.render();
        } catch (error) {
          console.warn('⚠️ Error rendering viewport:', error);
        }
      });

      return true;
    }

    return false;
  } catch (error) {
    console.error('Error removing fiducial from viewport:', error);
    return false;
  }
}
