/**
 * Fiducial Utilities
 *
 * Helper functions for managing fiducial annotations and viewport navigation
 */

import { getRenderingEngine, utilities as csUtils } from '@cornerstonejs/core';
import { annotation, ToolGroupManager } from '@cornerstonejs/tools';
import { vec3 } from 'gl-matrix';
import type { Fiducial } from './types';

// Extend Window interface for viewport ID storage
declare global {
  interface Window {
    __viewportIds?: {
      [viewportId: string]: string; // Maps viewport ID to its imageId or volumeId
    };
  }
}

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
        if (!vpElement) {
          continue;
        }

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
    const viewportId = (viewport as any).id;

    // Get referencedImageId from viewport
    let referencedImageId = '';

    // PRIORITY 1: Try to use globally stored viewport ID (captured on mode enter)
    if (window.__viewportIds && window.__viewportIds[viewportId]) {
      referencedImageId = window.__viewportIds[viewportId];
      console.log('✅ [FiducialUtils] Using stored viewport ID:', referencedImageId);
    }

    // PRIORITY 2: Fall back to getting from viewport
    if (!referencedImageId) {
      try {
        if (viewport.type === 'orthographic' || viewport.type === 'volume3d') {
          const imageIds = (viewport as any).getImageIds?.();
          if (imageIds && imageIds.length > 0) {
            const rawId = imageIds[0];
            // Ensure proper prefix format
            referencedImageId =
              rawId.startsWith('imageId:') || rawId.startsWith('volumeId:')
                ? rawId
                : `imageId:${rawId}`;
            console.log('✅ [FiducialUtils] Got viewport imageId:', referencedImageId);
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not get referencedImageId:', error);
      }
    }

    // Create fiducial annotation
    // Note: All coordinates use RAS (Right-Anterior-Superior) - no conversion needed
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
          points: [[position[0], position[1], position[2]]],
        },
        radius: 0.5,
        cachedStats: {},
      },
    };

    // Add to annotation state
    annotation.state.addAnnotation(fiducialAnnotation, element);

    console.log(
      `✅ Added ${label} at world coordinates: [${position[0].toFixed(2)}, ${position[1].toFixed(2)}, ${position[2].toFixed(2)}] mm`
    );

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
    // Note: dicom_position_mm stores RAS coordinates (same as Cornerstone3D world coordinates)
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
 * IMPORTANT: Updates both camera AND crosshairs to ensure synchronization
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

    const targetPosition: [number, number, number] = [position[0], position[1], position[2]];

    console.log(
      `📍 [jumpToFiducialPosition] Target: [${targetPosition.map(v => v.toFixed(2)).join(', ')}]`
    );

    // STEP 1: Update all viewports' cameras FIRST
    // This is critical because plane cutters use camera.focalPoint for cutting position
    for (const viewport of viewports) {
      try {
        const camera = viewport.getCamera();
        const { position: cameraPosition, focalPoint: cameraFocalPoint } = camera;

        // Calculate new camera position maintaining the same viewing direction
        // This preserves the view orientation (axial/sagittal/coronal)
        const viewDirection = vec3.sub(
          vec3.create(),
          cameraPosition as [number, number, number],
          cameraFocalPoint as [number, number, number]
        );
        const newPosition = vec3.add(vec3.create(), targetPosition, viewDirection) as [
          number,
          number,
          number,
        ];

        // Update camera focal point and position
        // This moves the view center to the fiducial position while maintaining orientation
        viewport.setCamera({
          focalPoint: targetPosition,
          position: newPosition,
        });

        // Render to trigger plane cutter updates
        viewport.render();
      } catch (error) {
        console.warn(`⚠️ Error updating viewport ${viewport.id}:`, error);
      }
    }

    console.log(`✅ [jumpToFiducialPosition] Camera focal points updated for all viewports`);

    // STEP 2: Update crosshairs AFTER camera is updated
    // This ensures crosshairs align with the new camera position
    let crosshairsUpdated = false;
    for (const viewport of viewports) {
      try {
        // Get tool group for this viewport
        const toolGroup = ToolGroupManager.getToolGroupForViewport(viewport.id, renderingEngine.id);

        if (!toolGroup) {
          continue;
        }

        // Get the Crosshairs tool instance
        const crosshairsTool = toolGroup.getToolInstance('Crosshairs');

        if (crosshairsTool && typeof crosshairsTool.setToolCenter === 'function') {
          // Use the tool's API to properly move crosshairs
          // Second parameter (false) means don't trigger an event
          crosshairsTool.setToolCenter(targetPosition, false);
          crosshairsUpdated = true;
          console.log(`✅ [jumpToFiducialPosition] Crosshairs setToolCenter called`);
          break; // Only need to call once, crosshairs are shared across viewports
        }
      } catch (e) {
        console.debug(`⚠️ Could not use setToolCenter in viewport ${viewport.id}:`, e);
      }
    }

    // STEP 3: Force a final render on all viewports to ensure everything is synced
    for (const viewport of viewports) {
      try {
        viewport.render();
      } catch (e) {
        // Ignore render errors
      }
    }

    console.log(
      `✅ [jumpToFiducialPosition] Completed - camera: ✓, crosshairs: ${crosshairsUpdated ? '✓' : '✗'}`
    );
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
    // Note: Annotation points are in RAS, and dicom_position_mm also stores RAS (no conversion needed)
    return fiducialAnnotations.map((ann: any, index: number) => {
      const point = ann.data.handles.points[0]; // RAS coordinates
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
export function syncFiducialsToViewport(servicesManager: any, fiducials: Fiducial[]): void {
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

        // Note: dicom_position_mm stores RAS coordinates (same as Cornerstone3D world coordinates)
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
              points: [
                [
                  fiducial.dicom_position_mm[0],
                  fiducial.dicom_position_mm[1],
                  fiducial.dicom_position_mm[2],
                ],
              ],
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
 * Get current crosshair position from viewport
 * Returns [x, y, z] in world coordinates (mm) or null if not found
 */
export function getCrosshairPosition(servicesManager: any): number[] | null {
  try {
    const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
    if (!renderingEngine) {
      console.warn('⚠️ No rendering engine found for getting crosshair position');
      return null;
    }

    const viewports = renderingEngine.getViewports();
    for (const viewport of viewports) {
      try {
        const element = viewport.element;
        if (!element) {
          continue;
        }

        const annotations = annotation.state.getAnnotations('Crosshairs', element);
        if (annotations && annotations.length > 0) {
          const crosshairAnnotation = annotations[0];

          // Get position from toolCenter (preferred - actual crosshair center)
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
 * Update existing fiducial annotation in viewport
 * Updates position and label when fiducial is edited
 */
export function updateFiducialAnnotationInViewport(servicesManager: any, fiducial: Fiducial): void {
  try {
    const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
    if (!renderingEngine) {
      console.warn('⚠️ No rendering engine found for updating fiducial annotation');
      return;
    }

    const viewports = renderingEngine.getViewports();
    if (viewports.length === 0) {
      console.warn('⚠️ No viewports found for updating fiducial annotation');
      return;
    }

    // Update annotation in all viewports
    for (const viewport of viewports) {
      try {
        const element = viewport.element;
        const existingAnnotations =
          annotation.state.getAnnotations('FiducialMarker', element) || [];

        // Find the annotation by matching label with point_id
        const annotationToUpdate = existingAnnotations.find(
          (ann: any) => ann.data.label === fiducial.point_id
        );

        if (annotationToUpdate) {
          // Update position (dicom_position_mm stores RAS coordinates)
          annotationToUpdate.data.handles.points[0] = [
            fiducial.dicom_position_mm[0],
            fiducial.dicom_position_mm[1],
            fiducial.dicom_position_mm[2],
          ];

          // Update label - use fiducial.label if it exists and is different from point_id, otherwise use point_id
          if (fiducial.label && fiducial.label !== fiducial.point_id) {
            annotationToUpdate.data.label = fiducial.label;
          } else {
            // If label is same as point_id or not set, use point_id for consistency
            annotationToUpdate.data.label = fiducial.point_id;
          }

          // Mark as invalidated to trigger re-render
          annotationToUpdate.invalidated = true;

          console.log(
            `✅ Updated annotation for fiducial ${fiducial.point_id} at position:`,
            fiducial.dicom_position_mm
          );
        }
      } catch (error) {
        console.warn(`⚠️ Error updating annotation in viewport ${viewport.id}:`, error);
      }
    }

    // Force render all viewports after updates
    viewports.forEach(vp => {
      try {
        vp.render();
      } catch (error) {
        console.warn('⚠️ Error rendering viewport:', error);
      }
    });
  } catch (error) {
    console.error('❌ Error updating fiducial annotation:', error);
  }
}

/**
 * Remove fiducial annotation from viewport
 */
export function removeFiducialFromViewport(servicesManager: any, pointId: string): boolean {
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
    const annotationToRemove = fiducialAnnotations.find((ann: any) => ann.data.label === pointId);

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

/**
 * 使用 4x4 变换矩阵转换 3D 点
 * @param point - 3D点坐标 [x, y, z]
 * @param matrix - 4x4变换矩阵（可以是16元素数组或4x4二维数组）
 * @returns 转换后的3D点坐标
 */
export function transformPointWithMatrix(
  point: [number, number, number],
  matrix: number[] | number[][]
): [number, number, number] {
  // 转换为 4x4 矩阵格式
  let m: number[][];
  if (Array.isArray(matrix[0])) {
    m = matrix as number[][];
  } else {
    // 扁平数组转换为 4x4 矩阵
    const flat = matrix as number[];
    m = [
      [flat[0], flat[1], flat[2], flat[3]],
      [flat[4], flat[5], flat[6], flat[7]],
      [flat[8], flat[9], flat[10], flat[11]],
      [flat[12], flat[13], flat[14], flat[15]],
    ];
  }

  const [x, y, z] = point;
  const [m00, m01, m02, m03] = m[0];
  const [m10, m11, m12, m13] = m[1];
  const [m20, m21, m22, m23] = m[2];

  return [
    m00 * x + m01 * y + m02 * z + m03,
    m10 * x + m11 * y + m12 * z + m13,
    m20 * x + m21 * y + m22 * z + m23,
  ];
}

/**
 * 将病人点的追踪器位置投影到DICOM空间并显示
 * @param servicesManager - OHIF services manager
 * @param fiducials - 包含 tracker_position_mm 的 fiducials
 * @param prMdMatrix - PR → DICOM 变换矩阵
 */
export function projectPatientPointsToDicom(
  servicesManager: any,
  fiducials: Fiducial[],
  prMdMatrix: number[] | number[][]
): void {
  try {
    const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
    if (!renderingEngine) {
      console.warn('⚠️ Rendering engine not found');
      return;
    }

    const viewports = renderingEngine.getViewports();
    if (viewports.length === 0) {
      console.warn('⚠️ No viewports found');
      return;
    }

    const element = viewports[0].element;
    const frameOfReferenceUID = viewports[0].getFrameOfReferenceUID();
    const camera = viewports[0].getCamera();

    // 清除之前所有视口的投影点注释
    viewports.forEach(viewport => {
      const vpElement = viewport.element;
      if (!vpElement) {
        return;
      }

      const existingAnnotations =
        annotation.state.getAnnotations('FiducialMarker', vpElement) || [];
      const existingProjectedAnnotations = existingAnnotations.filter(
        (ann: any) => ann.data?.label?.endsWith('*') || ann.data?.label?.includes('_proj')
      );

      if (existingProjectedAnnotations.length > 0) {
        existingProjectedAnnotations.forEach((ann: any) => {
          annotation.state.removeAnnotation(ann.annotationUID);
        });
      }
    });

    // 为每个已捕获的病人点创建投影注释
    let projectedCount = 0;
    const baseTimestamp = Date.now();
    for (let i = 0; i < fiducials.length; i++) {
      const fiducial = fiducials[i];
      if (fiducial.tracker_position_mm) {
        // 使用 prMd 矩阵将追踪器位置转换到 DICOM 空间
        const projectedDicomPos = transformPointWithMatrix(
          fiducial.tracker_position_mm,
          prMdMatrix
        );

        // 创建投影点注释（使用不同的样式）
        // 使用索引确保唯一性，避免时间戳冲突
        const projectedAnnotation: any = {
          annotationUID: `projected-${fiducial.point_id}-${baseTimestamp}-${i}`,
          highlighted: false,
          invalidated: false,
          isLocked: true, // 锁定，防止误编辑
          isVisible: true,
          metadata: {
            viewPlaneNormal: camera.viewPlaneNormal || [0, 0, 1],
            viewUp: camera.viewUp || [0, -1, 0],
            FrameOfReferenceUID: frameOfReferenceUID,
            referencedImageId: '',
            toolName: 'FiducialMarker',
          },
          data: {
            label: `${fiducial.point_id}*`, // 标记为投影点（使用*号）
            handles: {
              points: [[projectedDicomPos[0], projectedDicomPos[1], projectedDicomPos[2]]],
            },
            radius: 0.6, // 稍大一点，便于区分
            cachedStats: {},
            // 使用不同的颜色（红色）来区分投影点
            color: [255, 100, 100], // 浅红色
          },
        };

        annotation.state.addAnnotation(projectedAnnotation, element);
        projectedCount++;

        console.log(
          `📍 Projected ${fiducial.point_id}: ` +
            `Tracker [${fiducial.tracker_position_mm.map(v => v.toFixed(2)).join(', ')}] → ` +
            `DICOM [${projectedDicomPos.map(v => v.toFixed(2)).join(', ')}]`
        );
      }
    }

    // 渲染所有视口
    viewports.forEach(vp => {
      try {
        vp.render();
      } catch (error) {
        console.warn('⚠️ Error rendering viewport:', error);
      }
    });

    if (projectedCount > 0) {
      console.log(`✅ Projected ${projectedCount} patient points to DICOM space`);
    }
  } catch (error) {
    console.error('❌ Error projecting patient points to DICOM:', error);
  }
}
