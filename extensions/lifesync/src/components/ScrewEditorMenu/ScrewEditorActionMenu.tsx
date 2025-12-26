/**
 * ScrewEditorActionMenu Component
 * 
 * A compact screw editor menu for the viewport action corner.
 * Uses ScrewTable component directly from ScrewManagementUI for consistency.
 * 
 * Features:
 * - Shows list of implanted screws using the same table format as ScrewManagementPanel
 * - Allows editing diameter and length via dropdown selectors
 * - Linked screws (same vertebral level, opposite sides) update together
 * - Delete functionality removes both backend data and 3D models
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSystem } from '@ohif/core';
import { getRenderingEngine } from '@cornerstonejs/core';
import { vec3 } from 'gl-matrix';
import { planningBackendService } from '../../services';
import { ScrewDimensionSlider } from '../ScrewManagement/ScrewManagementUI';
import { useScrewOperations } from '../../hooks';
import { jumpToPosition } from '../Registration/utils/fiducialUtils';
import { getScrewColor } from '../../utils/screwColorScheme';
import { ScrewUpdateEventType } from '../../types/screwEvents';

interface ScrewEditorActionMenuProps {
  viewportId: string;
  align?: string;
  side?: string;
  onClose?: () => void;
}

/**
 * Get display information for a screw (matches ScrewManagementPanel.getScrewDisplayInfo)
 */
const getScrewDisplayInfo = (screw: any) => {
  // Validate required fields
  if (!screw.radius || !screw.length) {
    const screwId = screw.screw_id || screw.name || 'unknown';
    throw new Error(`Missing dimensions for screw: ${screwId}`);
  }

  const radius = parseFloat(screw.radius);
  const length = parseFloat(screw.length);

  if (isNaN(radius) || isNaN(length) || radius <= 0 || length <= 0) {
    const screwId = screw.screw_id || screw.name || 'unknown';
    throw new Error(`Invalid dimensions for screw: ${screwId}`);
  }

  const label = screw.screw_label || screw.name || screw.screw_id || 'Unknown';

  let source: 'catalog' | 'generated' | 'unknown' = 'unknown';
  let description = '';

  if (screw.screw_variant_id) {
    if (screw.screw_variant_id.startsWith('generated-') || screw.screw_variant_id.startsWith('screw-')) {
      source = 'generated';
      description = `${(radius * 2).toFixed(1)}×${length}mm`;
    } else {
      source = 'catalog';
      description = screw.screw_variant_id;
    }
  } else {
    source = 'generated';
    description = `${(radius * 2).toFixed(1)}×${length}mm`;
  }

  return { label, description, source, radius, length };
};

export function ScrewEditorActionMenu({
  viewportId,
  align,
  side,
  onClose,
}: ScrewEditorActionMenuProps) {
  const { servicesManager } = useSystem();
  const [screws, setScrews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [updatingScrewId, setUpdatingScrewId] = useState<string | null>(null);
  const [availableDiameters, setAvailableDiameters] = useState<number[]>([3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0]);
  const [availableLengths, setAvailableLengths] = useState<number[]>([20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80]);
  const [linkScrews, setLinkScrews] = useState<boolean>(true); // Linkage checkbox state
  
  // Use ref to track if initial load has happened
  const hasLoadedRef = useRef(false);

  // Get session ID
  const getSessionId = useCallback(() => {
    return sessionStorage.getItem('ohif_session_id') || 
           localStorage.getItem('ohif_planning_session_id');
  }, []);

  const sessionId = getSessionId();

  // Use shared screw operations hook
  const screwOps = useScrewOperations({
    servicesManager,
    sessionId,
    onScrewsUpdate: setScrews
  });

  /**
   * Load screws from planning API - called only once on mount
   */
  const loadScrews = useCallback(async () => {
    const sessionId = getSessionId();
    if (!sessionId) {
      console.warn('[ScrewEditor] No session ID available');
      setIsLoading(false);
      return;
    }

    try {
      const response = await planningBackendService.listScrews(sessionId);
      if (response.success) {
        setScrews(response.screws || []);
        
        // Update available dimensions from screws (only once)
        const diameters = new Set<number>([3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0]);
        const lengths = new Set<number>([20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80]);
        
        (response.screws || []).forEach((screw: any) => {
          try {
            const info = getScrewDisplayInfo(screw);
            diameters.add(info.radius * 2);
            lengths.add(info.length);
          } catch (e) {
            // Skip invalid screws
          }
        });
        
        setAvailableDiameters(Array.from(diameters).sort((a, b) => a - b));
        setAvailableLengths(Array.from(lengths).sort((a, b) => a - b));
      }
    } catch (error) {
      console.error('[ScrewEditor] Error loading screws:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getSessionId]);

  // Load screws only once on mount
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadScrews();
    }
  }, [loadScrews]);

  // Subscribe to screw changes (Bug 4 fix)
  useEffect(() => {
    const { modelStateService } = (servicesManager.services as any);
    
    if (!modelStateService) return;

    // Subscribe to model changes
    const subscription = modelStateService.subscribe(
      modelStateService.EVENTS.MODEL_ADDED,
      () => {
        console.log('[ScrewEditor] Model added - refreshing screws');
        loadScrews();
      }
    );

    const deleteSubscription = modelStateService.subscribe(
      modelStateService.EVENTS.MODEL_REMOVED,
      () => {
        console.log('[ScrewEditor] Model removed - refreshing screws');
        loadScrews();
      }
    );

    const updateSubscription = modelStateService.subscribe(
      modelStateService.EVENTS.MODEL_UPDATED,
      (eventData: any) => {
        console.log('[ScrewEditor] Model updated - refreshing screws');
        console.log('[SCREW_UPDATE_DEBUG] Event data:', eventData);
        
        // ═══════════════════════════════════════════════════════════════════════════
        // BUG FIX: Don't reload screws during screw position/rotation updates
        // ═══════════════════════════════════════════════════════════════════════════
        // When ScrewInteractionTool drags a screw, it updates the model transform
        // This triggers MODEL_UPDATED, which would reload ALL screws
        //
        // Solution: Only reload for non-transform updates (color, opacity, etc.)
        if (eventData?.property === 'position' || 
            eventData?.property === 'rotation' || 
            eventData?.property === 'transform') {
          console.log('[SCREW_UPDATE_DEBUG] Skipping screw reload for transform update');
          return;
        }
        
        // For other updates (color, opacity, etc.), reload normally
        loadScrews();
      }
    );

    // Cleanup subscriptions on unmount
    return () => {
      if (subscription?.unsubscribe) subscription.unsubscribe();
      if (deleteSubscription?.unsubscribe) deleteSubscription.unsubscribe();
      if (updateSubscription?.unsubscribe) updateSubscription.unsubscribe();
    };
  }, [servicesManager, loadScrews]);

  /**
   * Find paired screw (same level, opposite side) for linked updates
   */
  const findPairedScrew = useCallback((screw: any): any | null => {
    try {
      const level = screw.vertebral_level || 'unknown';
      const screwSide = screw.side || 'unknown';
      
      if (screwSide === 'unknown' || level === 'unknown') return null;

      const oppositeSide = screwSide === 'left' ? 'right' : screwSide === 'right' ? 'left' : null;
      if (!oppositeSide) return null;

      return screws.find(s => 
        s.vertebral_level === level && 
        s.side === oppositeSide && 
        (s.screw_id || s.id) !== (screw.screw_id || screw.id)
      ) || null;
    } catch (e) {
      return null;
    }
  }, [screws]);

  /**
   * Handle diameter drag (in-progress) - visual feedback only, no model reload
   */
  const handleDragDiameter = useCallback(async (screwData: any, newDiameter: number) => {
    const screwId = screwData.screw_id || screwData.id;
    if (!screwId) return;

    try {
      const newRadius = newDiameter / 2;
      
      // Update main screw with SLIDER_DRAG event (no model reload)
      await screwOps.updateScrewDimensions(
        screwData, 
        newRadius, 
        undefined,
        ScrewUpdateEventType.SLIDER_DRAG
      );

      // Update paired screw ONLY if linkage is enabled
      if (linkScrews) {
        const pairedScrew = findPairedScrew(screwData);
        if (pairedScrew) {
          await screwOps.updateScrewDimensions(
            pairedScrew, 
            newRadius, 
            undefined,
            ScrewUpdateEventType.SLIDER_DRAG
          );
        }
      }

      console.log(`🔄 [ScrewEditor] Dragging diameter for screw ${screwId} (preview only)`);
    } catch (error) {
      console.error('[ScrewEditor] Error during diameter drag:', error);
    }
  }, [screwOps, findPairedScrew, linkScrews]);

  /**
   * Update screw diameter - commits change with backend sync and 3D model reload
   * Uses shared hook for consistency
   * Respects linkage checkbox state
   */
  const handleUpdateDiameter = useCallback(async (screwData: any, newDiameter: number) => {
    const screwId = screwData.screw_id || screwData.id;
    if (!screwId) return;

    setUpdatingScrewId(screwId);
    try {
      const newRadius = newDiameter / 2;
      
      // Update main screw using shared hook with SLIDER_COMMIT event
      await screwOps.updateScrewDimensions(
        screwData, 
        newRadius, 
        undefined,
        ScrewUpdateEventType.SLIDER_COMMIT
      );

      // Update paired screw ONLY if linkage is enabled
      if (linkScrews) {
        const pairedScrew = findPairedScrew(screwData);
        if (pairedScrew) {
          await screwOps.updateScrewDimensions(
            pairedScrew, 
            newRadius, 
            undefined,
            ScrewUpdateEventType.SLIDER_COMMIT
          );
        }
      }

      // Reload screws to refresh UI immediately (Bug 3 fix)
      await loadScrews();

      console.log(`✅ [ScrewEditor] Updated diameter for screw ${screwId}${linkScrews ? ' (linked)' : ' (individual)'}`);
    } catch (error) {
      console.error('[ScrewEditor] Error updating diameter:', error);
      alert(`Failed to update diameter: ${error.message}`);
    } finally {
      setUpdatingScrewId(null);
    }
  }, [screwOps, findPairedScrew, loadScrews, linkScrews]);

  /**
   * Handle length drag (in-progress) - visual feedback only, no model reload
   */
  const handleDragLength = useCallback(async (screwData: any, newLength: number) => {
    const screwId = screwData.screw_id || screwData.id;
    if (!screwId) return;

    try {
      // Update main screw with SLIDER_DRAG event (no model reload)
      await screwOps.updateScrewDimensions(
        screwData, 
        undefined, 
        newLength,
        ScrewUpdateEventType.SLIDER_DRAG
      );

      // Update paired screw ONLY if linkage is enabled
      if (linkScrews) {
        const pairedScrew = findPairedScrew(screwData);
        if (pairedScrew) {
          await screwOps.updateScrewDimensions(
            pairedScrew, 
            undefined, 
            newLength,
            ScrewUpdateEventType.SLIDER_DRAG
          );
        }
      }

      console.log(`🔄 [ScrewEditor] Dragging length for screw ${screwId} (preview only)`);
    } catch (error) {
      console.error('[ScrewEditor] Error during length drag:', error);
    }
  }, [screwOps, findPairedScrew, linkScrews]);

  /**
   * Update screw length - commits change with backend sync and 3D model reload
   * Uses shared hook for consistency
   * Respects linkage checkbox state
   */
  const handleUpdateLength = useCallback(async (screwData: any, newLength: number) => {
    const screwId = screwData.screw_id || screwData.id;
    if (!screwId) return;

    setUpdatingScrewId(screwId);
    try {
      // Update main screw using shared hook with SLIDER_COMMIT event
      await screwOps.updateScrewDimensions(
        screwData, 
        undefined, 
        newLength,
        ScrewUpdateEventType.SLIDER_COMMIT
      );

      // Update paired screw ONLY if linkage is enabled
      if (linkScrews) {
        const pairedScrew = findPairedScrew(screwData);
        if (pairedScrew) {
          await screwOps.updateScrewDimensions(
            pairedScrew, 
            undefined, 
            newLength,
            ScrewUpdateEventType.SLIDER_COMMIT
          );
        }
      }

      // Reload screws to refresh UI immediately (Bug 3 fix)
      await loadScrews();

      console.log(`✅ [ScrewEditor] Updated length for screw ${screwId}${linkScrews ? ' (linked)' : ' (individual)'}`);
    } catch (error) {
      console.error('[ScrewEditor] Error updating length:', error);
      alert(`Failed to update length: ${error.message}`);
    } finally {
      setUpdatingScrewId(null);
    }
  }, [screwOps, findPairedScrew, loadScrews, linkScrews]);

  /**
   * Delete screw - removes from backend and 3D models
   * Respects linkage checkbox state
   */
  const handleDeleteScrew = useCallback(async (screwData: any) => {
    const screwId = screwData.screw_id || screwData.id;
    if (!screwId) return;

    let label = 'Unknown';
    try {
      label = getScrewDisplayInfo(screwData).label;
    } catch (e) {
      label = screwId;
    }

    // Find paired screw before deletion (only if linkage is enabled)
    const pairedScrew = linkScrews ? findPairedScrew(screwData) : null;
    const pairedId = pairedScrew ? (pairedScrew.screw_id || pairedScrew.id) : null;
    let pairedLabel = null;
    if (pairedScrew) {
      try {
        pairedLabel = getScrewDisplayInfo(pairedScrew).label;
      } catch (e) {
        pairedLabel = pairedId;
      }
    }

    // Confirm deletion
    if (pairedScrew && linkScrews) {
      // Linked mode: confirm deletion of both screws
      const confirmed = confirm(
        `Delete linked screws?\n\n• ${label}\n• ${pairedLabel}\n\nBoth screws will be removed.`
      );
      if (!confirmed) return;
    } else {
      // Unlinked mode: confirm deletion of single screw
      const confirmed = confirm(
        `Delete screw?\n\n• ${label}\n\nOnly this screw will be removed.`
      );
      if (!confirmed) return;
    }

    setUpdatingScrewId(screwId);
    try {
      const sessionId = getSessionId();
      const modelStateService = (servicesManager.services as any).modelStateService;

      // Delete from backend
      if (sessionId && planningBackendService?.deleteScrew) {
        await planningBackendService.deleteScrew(screwId, sessionId);
      }

      // Delete 3D models
      if (modelStateService) {
        modelStateService.removeModel(screwId);
        modelStateService.removeModel(`${screwId}-cap`);
        // Try by label as well
        const allModels = modelStateService.getAllModels();
        for (const model of allModels) {
          if (model.metadata?.name === label || model.metadata?.name === `${label}-Cap`) {
            modelStateService.removeModel(model.metadata.id);
          }
        }
      }

      // Delete paired screw ONLY if linkage is enabled
      if (pairedId && linkScrews) {
        if (sessionId && planningBackendService?.deleteScrew) {
          await planningBackendService.deleteScrew(pairedId, sessionId);
        }
        if (modelStateService) {
          modelStateService.removeModel(pairedId);
          modelStateService.removeModel(`${pairedId}-cap`);
          if (pairedLabel) {
            const allModels = modelStateService.getAllModels();
            for (const model of allModels) {
              if (model.metadata?.name === pairedLabel || model.metadata?.name === `${pairedLabel}-Cap`) {
                modelStateService.removeModel(model.metadata.id);
              }
            }
          }
        }
      }

      // Update local state directly
      setScrews(prevScrews => prevScrews.filter(s => {
        const id = s.screw_id || s.id;
        // Only filter out paired screw if linkage is enabled
        return id !== screwId && (!linkScrews || !pairedId || id !== pairedId);
      }));

      console.log(`✅ [ScrewEditor] Deleted ${label}${pairedScrew && linkScrews ? ` and ${pairedLabel}` : ''}${!linkScrews ? ' (individual)' : ''}`);
    } catch (error) {
      console.error('[ScrewEditor] Error deleting screw:', error);
    } finally {
      setUpdatingScrewId(null);
    }
  }, [servicesManager, getSessionId, findPairedScrew, linkScrews]);

  /**
   * Parse transform matrix from screw data
   */
  const parseTransform = useCallback((screwData: any): Float32Array | null => {
    if (!screwData?.transform_matrix) return null;
    const arr = screwData.transform_matrix;
    if (Array.isArray(arr) && arr.length === 16) {
      return new Float32Array(arr);
    }
    return null;
  }, []);

  /**
   * Get current 3D viewport ID
   */
  const getCurrentViewportId = useCallback(() => {
    try {
      const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
      if (!renderingEngine) return 'volume3d-viewport';
      const viewports = renderingEngine.getViewports();
      for (const vp of viewports) {
        if (vp.type === 'volume3d' || (vp.type as string) === 'VOLUME_3D') {
          return vp.id;
        }
      }
    } catch (error) {
      console.warn('[ScrewEditor] Unable to resolve viewport id', error);
    }
    return 'volume3d-viewport';
  }, []);

  /**
   * Ensure screw model is loaded
   */
  const ensureModelLoaded = useCallback(async (
    screwData: any,
    displayInfo: { label: string; radius: number; length: number },
    transform: Float32Array | null
  ) => {
    const { modelStateService } = (servicesManager.services as any);
    
    // Check if model already exists
    const existing = modelStateService?.getAllModels?.()
      ?.find((m: any) => m.metadata?.name === displayInfo.label);
    if (existing) {
      console.log('[ScrewEditor] Model already loaded:', displayInfo.label);
      return existing.metadata?.id;
    }

    // Load model if not found
    const modelResult = await planningBackendService.queryModel(displayInfo.radius, displayInfo.length);
    if (!modelResult.success || !modelResult.model) {
      console.warn('[ScrewEditor] Could not query model');
      return null;
    }

    const modelUrl = planningBackendService.getModelUrl(modelResult.model.model_id);
    const color = getScrewColor(displayInfo.label);
    const loaded = await modelStateService.loadModelFromServer(modelUrl, {
      viewportId: getCurrentViewportId(),
      color,
      modelId: screwData?.screw_id || screwData?.id || undefined,
      modelName: displayInfo.label,
    });

    if (loaded && transform?.length === 16) {
      await modelStateService.setModelTransform(loaded.metadata.id, transform, displayInfo.length);
      
      // Load cap model
      try {
        await screwOps.loadCapModel(
          Array.from(transform),
          displayInfo.length,
          displayInfo.label,
          screwData?.screw_id || screwData?.id || undefined
        );
      } catch (capError) {
        console.warn('[ScrewEditor] Could not load cap model:', capError);
      }
    }

    return loaded?.metadata?.id;
  }, [servicesManager, screwOps, getCurrentViewportId]);

  /**
   * Set viewport orientations based on screw transform
   */
  const setViewportOrientationsFromScrew = useCallback((
    transform: number[],
    screwPosition: [number, number, number]
  ) => {
    try {
      if (!transform || transform.length !== 16) return;

      const axialNormal: [number, number, number] = [transform[0], transform[4], transform[8]];
      const coronalNormal: [number, number, number] = [-transform[1], -transform[5], -transform[9]];
      const sagittalNormal: [number, number, number] = [transform[2], transform[6], transform[10]];

      vec3.normalize(axialNormal, axialNormal);
      vec3.normalize(coronalNormal, coronalNormal);
      vec3.normalize(sagittalNormal, sagittalNormal);

      const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
      if (!renderingEngine) return;

      const viewports = renderingEngine.getViewports();
      for (const viewport of viewports) {
        const viewportId = viewport.id.toLowerCase();
        const camera = viewport.getCamera();
        const viewDirection = vec3.sub(
          vec3.create(),
          camera.position as [number, number, number],
          camera.focalPoint as [number, number, number]
        );
        vec3.normalize(viewDirection, viewDirection);

        let targetNormal: [number, number, number] | null = null;
        if (viewportId.includes('axial')) {
          targetNormal = axialNormal;
        } else if (viewportId.includes('coronal')) {
          targetNormal = coronalNormal;
        } else if (viewportId.includes('sagittal')) {
          targetNormal = sagittalNormal;
        }

        if (targetNormal) {
          const dot = vec3.dot(viewDirection, targetNormal);
          const finalViewDir = dot < 0 
            ? vec3.negate(vec3.create(), targetNormal) 
            : targetNormal;

          const dist = camera.parallelScale || 300;
          const newPos: [number, number, number] = [
            screwPosition[0] + finalViewDir[0] * dist,
            screwPosition[1] + finalViewDir[1] * dist,
            screwPosition[2] + finalViewDir[2] * dist,
          ];

          viewport.setCamera({
            position: newPos,
            focalPoint: screwPosition,
            viewUp: camera.viewUp,
          });
          viewport.render();
        }
      }
    } catch (error) {
      console.warn('[ScrewEditor] Error setting viewport orientations:', error);
    }
  }, []);

  /**
   * View screw - jump to screw position and load model
   */
  const handleViewScrew = useCallback(async (screwData: any) => {
    try {
      setIsRestoring(true);
      
      const displayInfo = getScrewDisplayInfo(screwData);
      const transformArray = parseTransform(screwData);
      const screwPosition = transformArray && transformArray.length === 16
        ? ([transformArray[3], transformArray[7], transformArray[11]] as [number, number, number])
        : screwData?.entry_point
          ? ([screwData.entry_point.x, screwData.entry_point.y, screwData.entry_point.z] as [number, number, number])
          : null;

      // Restore viewport states if available
      if (screwData.viewport_states_json || screwData.viewportStates) {
        let viewportStates = screwData.viewport_states_json || screwData.viewportStates;
        if (typeof viewportStates === 'string') {
          viewportStates = JSON.parse(viewportStates);
        }
        try {
          const { viewportStateService } = (servicesManager.services as any);
          viewportStateService?.restoreViewportStates?.(viewportStates);
        } catch (error) {
          console.warn('[ScrewEditor] Failed to restore viewport states:', error);
        }
      }

      // Ensure model is loaded
      if (transformArray) {
        await ensureModelLoaded(screwData, displayInfo, transformArray);
      }

      // Jump to screw position
      if (screwPosition) {
        jumpToPosition(screwPosition, servicesManager);
        if (transformArray) {
          setViewportOrientationsFromScrew(Array.from(transformArray), screwPosition);
        }
      }

      console.log('[ScrewEditor] Jumped to screw:', displayInfo.label);
    } catch (error) {
      console.error('[ScrewEditor] Error viewing screw:', error);
      alert(`Failed to view screw: ${error.message}`);
    } finally {
      setIsRestoring(false);
    }
  }, [servicesManager, parseTransform, ensureModelLoaded, setViewportOrientationsFromScrew]);

  /**
   * Edit screw - placeholder
   */
  const handleEditScrew = useCallback((screwData: any) => {
    console.log('[ScrewEditor] Edit screw:', screwData.screw_label || screwData.screw_id);
  }, []);

  // CONDITIONAL DISPLAY RESPONSIBILITY - Determines which UI state to show
  // Loading state
  if (isLoading) {
    return (
      <div className="bg-popover flex w-[420px] flex-col rounded-md p-3">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin text-2xl">🔄</div>
          <span className="ml-2 text-sm text-gray-400">Loading screws...</span>
        </div>
      </div>
    );
  }

  // Empty state
  if (screws.length === 0) {
    return (
      <div className="bg-popover flex w-[420px] flex-col rounded-md p-3">
        <div className="text-center py-4">
          <span className="text-sm text-gray-400">No screws implanted</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="bg-popover flex w-[480px] flex-col rounded-md p-2"
      data-cy={`screw-editor-menu-${viewportId}`}
    >
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-gray-700 pb-2 mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔩</span>
            <span className="text-sm font-semibold text-white">Screw Editor</span>
            <span className="text-xs text-gray-400">({screws.length})</span>
          </div>
        </div>
        
        {/* Linkage Checkbox */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={linkScrews}
              onChange={(e) => setLinkScrews(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-xs text-gray-300 group-hover:text-white transition">
              🔗 Link left/right screws
            </span>
          </label>
          <span 
            className="text-xs text-gray-500 cursor-help" 
            title={linkScrews 
              ? "Linked: Changes to one screw will apply to its paired screw (same level, opposite side)" 
              : "Unlinked: Edit screws individually without affecting their pairs"
            }
          >
            ⓘ
          </span>
        </div>
      </div>

      {/* Screw Table - Inline implementation with sliders */}
      <div className="max-h-[320px] overflow-y-auto">
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm text-left">
            {/* Table Header */}
            <thead className="text-xs uppercase bg-gray-800 text-gray-300 border-b border-gray-700">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Name</th>
                <th scope="col" className="px-4 py-2 font-semibold text-center">Diameter (mm)</th>
                <th scope="col" className="px-4 py-2 font-semibold text-center">Length (mm)</th>
                <th scope="col" className="px-4 py-2 font-semibold text-center">Actions</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {screws.map((screw, index) => {
                let displayInfo;
                try {
                  displayInfo = getScrewDisplayInfo(screw);
                } catch (error) {
                  // Render error row
                  return (
                    <tr key={screw.screw_id || index} className="border-b border-gray-700 bg-red-900 bg-opacity-20">
                      <td className="px-4 py-2 text-red-300" colSpan={3}>
                        ⚠️ Invalid Screw Data: {error.message}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => handleDeleteScrew(screw)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition"
                          title="Delete Invalid Screw"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                }

                const diameter = displayInfo.radius * 2;
                const screwId = screw.screw_id || screw.id || index;
                const isUpdating = updatingScrewId === screwId;

                return (
                  <tr
                    key={screwId}
                    className="border-b border-gray-700 bg-gray-800 bg-opacity-30 hover:bg-gray-700 hover:bg-opacity-40 transition"
                  >
                    {/* Name Column - Clickable */}
                    <td className="px-4 py-2">
                      <button
                        onClick={() => handleViewScrew(screw)}
                        disabled={isRestoring}
                        className="text-left w-full hover:text-blue-400 transition disabled:cursor-not-allowed"
                        title={isRestoring ? 'Loading...' : `Click to view "${displayInfo.label}"`}
                      >
                        <p className="font-medium text-white text-sm truncate">
                          {isRestoring ? '⏳ ' : ''}{displayInfo.label}
                        </p>
                      </button>
                    </td>

                    {/* Diameter Column */}
                    <td className="px-4 py-2 text-center">
                      {availableDiameters.length > 0 ? (
                        <ScrewDimensionSlider
                          value={diameter}
                          options={availableDiameters}
                          onChange={(newDiameter) => handleUpdateDiameter(screw, newDiameter)}
                          onDrag={handleDragDiameter ? (newDiameter) => handleDragDiameter(screw, newDiameter) : undefined}
                          onCommit={(newDiameter) => handleUpdateDiameter(screw, newDiameter)}
                          label="diameter"
                          isUpdating={isUpdating}
                        />
                      ) : (
                        <span className="inline-block px-2 py-1 bg-blue-900 bg-opacity-50 border border-blue-700 rounded text-sm text-blue-200 font-semibold">
                          ⌀ {diameter.toFixed(1)}
                        </span>
                      )}
                    </td>

                    {/* Length Column */}
                    <td className="px-4 py-2 text-center">
                      {availableLengths.length > 0 ? (
                        <ScrewDimensionSlider
                          value={displayInfo.length}
                          options={availableLengths}
                          onChange={(newLength) => handleUpdateLength(screw, newLength)}
                          onDrag={handleDragLength ? (newLength) => handleDragLength(screw, newLength) : undefined}
                          onCommit={(newLength) => handleUpdateLength(screw, newLength)}
                          label="length"
                          isUpdating={isUpdating}
                        />
                      ) : (
                        <span className="inline-block px-2 py-1 bg-green-900 bg-opacity-50 border border-green-700 rounded text-sm text-green-200 font-semibold">
                          ↕ {displayInfo.length.toFixed(1)}
                        </span>
                      )}
                    </td>

                    {/* Actions Column */}
                    <td className="px-4 py-2">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleDeleteScrew(screw)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition"
                          title={`Delete "${displayInfo.label}"`}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer hint */}
      <div className="mt-2 pt-2 border-t border-gray-700">
        <p className="text-xs text-gray-500 text-center">
          {linkScrews 
            ? '🔗 Linked: Changes apply to both left & right screws' 
            : '🔓 Unlinked: Edit screws individually'}
        </p>
      </div>
    </div>
  );
}

export default ScrewEditorActionMenu;
