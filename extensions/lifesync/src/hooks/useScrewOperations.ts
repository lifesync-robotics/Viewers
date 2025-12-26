/**
 * useScrewOperations Hook
 * 
 * Shared hook for screw operations across components.
 * Provides consistent functionality for:
 * - Loading screw models with transforms
 * - Updating screw dimensions (diameter/length)
 * - Deleting screw models
 * - Loading cap models
 * - Transform calculations
 * 
 * Event-Driven Architecture:
 * - Distinguishes between different sources of updates (slider drag, commit, viewport, etc.)
 * - Prevents unwanted side effects like camera movement during slider drag
 * - Optimizes performance by skipping model reloads during in-progress edits
 * 
 * Used by:
 * - ScrewManagementPanel
 * - ScrewEditorActionMenu
 * - Any future screw management components
 */

import { useCallback } from 'react';
import { getRenderingEngine } from '@cornerstonejs/core';
import { planningBackendService } from '../services';
import { getScrewColor } from '../utils/screwColorScheme';
import { ScrewUpdateEventType, getScrewUpdateOptions, type ScrewDimensionUpdateEvent } from '../types/screwEvents';

interface ScrewOperationsHookProps {
  servicesManager: any;
  sessionId: string | null;
  onScrewsUpdate?: (updater: (prevScrews: any[]) => any[]) => void;
}

export function useScrewOperations({ 
  servicesManager, 
  sessionId,
  onScrewsUpdate 
}: ScrewOperationsHookProps) {
  const { modelStateService, planeCutterService, viewportGridService } = servicesManager.services;

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
      console.error('Error getting viewport ID:', error);
    }

    return 'volume3d-viewport';
  }, []);

  /**
   * Calculate screw transform from cap position
   * Used when updating screw length - cap stays fixed, screw body adjusts
   */
  const calculateScrewTransformFromCap = useCallback((
    capTransform: number[],
    newLength: number
  ): number[] => {
    // Extract coronal direction (Y-axis, column 1 in row-major)
    const coronalX = capTransform[1];
    const coronalY = capTransform[5];
    const coronalZ = capTransform[9];

    // Cap dimensions (must match loadCapModel)
    const capHeight = 15.0;
    const capCenterOffset = 2.5;

    // Calculate offset from model origin to cap position
    const newCapOffset = (newLength / 2) + (capHeight / 2) + capCenterOffset;

    // Create screw transform by offsetting backwards from cap position
    const screwTransform = capTransform instanceof Float32Array 
      ? Array.from(capTransform) 
      : [...capTransform];

    // Reverse the offset: move backwards along coronal direction
    screwTransform[3] = capTransform[3] - (coronalX * newCapOffset);
    screwTransform[7] = capTransform[7] - (coronalY * newCapOffset);
    screwTransform[11] = capTransform[11] - (coronalZ * newCapOffset);

    console.log(`📐 [ScrewOps] Calculated screw position from cap:`);
    console.log(`   Cap: [${capTransform[3].toFixed(2)}, ${capTransform[7].toFixed(2)}, ${capTransform[11].toFixed(2)}]`);
    console.log(`   Screw: [${screwTransform[3].toFixed(2)}, ${screwTransform[7].toFixed(2)}, ${screwTransform[11].toFixed(2)}]`);
    console.log(`   Offset: ${newCapOffset.toFixed(2)}mm`);

    return screwTransform;
  }, []);

  /**
   * Delete screw models (body and cap) by screw ID
   * @param deleteCap - If false, preserves cap (useful for dimension updates)
   */
  const deleteScrewModels = useCallback(async (
    screwId: string, 
    screwLabel: string, 
    deleteCap: boolean = true
  ): Promise<number> => {
    if (!modelStateService) {
      console.warn('[ScrewOps] modelStateService not available');
      return 0;
    }

    const allModels = modelStateService.getAllModels();
    let modelsRemoved = 0;

    // Delete body model
    const bodyModel = allModels.find(
      (m: any) => m.metadata.id === screwId || m.metadata.name === screwLabel
    );
    if (bodyModel) {
      console.log(`🗑️ [ScrewOps] Removing body model: ${bodyModel.metadata.id}`);
      modelStateService.removeModel(bodyModel.metadata.id);
      modelsRemoved++;
    }

    // Delete cap model only if explicitly requested
    if (deleteCap) {
      const capModelId = `${screwId}-cap`;
      const capModelName = `${screwLabel}-Cap`;
      const capModel = allModels.find(
        (m: any) => m.metadata.id === capModelId || m.metadata.name === capModelName
      );
      if (capModel) {
        console.log(`🗑️ [ScrewOps] Removing cap model: ${capModel.metadata.id}`);
        modelStateService.removeModel(capModel.metadata.id);
        modelsRemoved++;
      }
    } else {
      console.log(`ℹ️ [ScrewOps] Preserving cap model for screw ${screwId}`);
    }

    console.log(`✅ [ScrewOps] Removed ${modelsRemoved} model(s)`);
    return modelsRemoved;
  }, [modelStateService]);

  /**
   * Load cap model at specified position
   */
  const loadCapModel = useCallback(async (
    transform: number[],
    length: number,
    screwLabel: string | null = null,
    screwId: string | null = null
  ) => {
    try {
      if (!modelStateService) {
        console.error('[ScrewOps] modelStateService not available');
        return;
      }

      const capColor = screwLabel ? getScrewColor(screwLabel) : [1.0, 0.84, 0.0];

      // Query cap model
      const queryResponse = await planningBackendService.queryCapModel();
      if (!queryResponse.success || !queryResponse.model) {
        throw new Error('Cap model query failed');
      }

      const modelUrl = planningBackendService.getCapModelUrl();

      // Load model
      await modelStateService.loadModelFromServer(modelUrl, {
        viewportId: getCurrentViewportId(),
        color: capColor,
        opacity: 0.9,
        modelId: screwId ? `${screwId}-cap` : null,
        modelName: screwLabel ? `${screwLabel}-Cap` : 'Screw Cap'
      });

      // Apply transform with offset for cap position
      if (transform && transform.length === 16 && length && length > 0) {
        // Extract coronal direction
        const coronalX = transform[1];
        const coronalY = transform[5];
        const coronalZ = transform[9];

        // Cap dimensions
        const capHeight = 15.0;
        const capCenterOffset = 2.5;
        const capOffset = (length / 2) + (capHeight / 2) + capCenterOffset;

        // Create cap transform
        const capTransform = transform instanceof Float32Array 
          ? Array.from(transform) 
          : [...transform];

        capTransform[3] = transform[3] + (coronalX * capOffset);
        capTransform[7] = transform[7] + (coronalY * capOffset);
        capTransform[11] = transform[11] + (coronalZ * capOffset);

        const loadedModels = modelStateService.getAllModels();
        const latestModel = loadedModels[loadedModels.length - 1];

        if (latestModel) {
          await modelStateService.setModelTransform(
            latestModel.metadata.id,
            capTransform
          );
          console.log(`✅ [ScrewOps] Cap model loaded for ${screwLabel}`);
        }
      }
    } catch (error) {
      console.error('[ScrewOps] Failed to load cap model:', error);
      throw error;
    }
  }, [modelStateService, getCurrentViewportId]);

  /**
   * Load screw model with proper transform
   */
  const loadScrewModel = useCallback(async (
    radius: number,
    length: number,
    transform: number[],
    screwLabel: string,
    screwId: string | null = null
  ) => {
    try {
      if (!modelStateService) {
        console.error('[ScrewOps] modelStateService not available');
        return;
      }

      console.log(`📦 [ScrewOps] Loading screw model: ${screwLabel} (R=${radius}mm, L=${length}mm)`);

      const screwColor = getScrewColor(screwLabel);

      // Query model from planning API
      const queryResponse = await planningBackendService.queryModel(radius, length);
      if (!queryResponse.success || !queryResponse.model) {
        throw new Error('Model query failed');
      }

      const modelInfo = queryResponse.model;

      // Enable plane cutters if needed
      if (planeCutterService && !planeCutterService.getIsEnabled()) {
        console.log('[ScrewOps] Auto-enabling plane cutters');
        try {
          await planeCutterService.initialize();
          planeCutterService.enable();
        } catch (error) {
          console.warn('[ScrewOps] Could not enable plane cutters:', error);
        }
      }

      // Get model URL
      const modelUrl = planningBackendService.getModelUrl(modelInfo.model_id);

      // Get current viewport ID
      const { activeViewportId } = viewportGridService.getState();

      // Load model
      const transformCopy = transform instanceof Float32Array 
        ? Array.from(transform) 
        : [...transform];

      const loadedModel = await modelStateService.loadModelFromServer(modelUrl, {
        viewportId: activeViewportId,
        color: screwColor,
        opacity: 0.9,
        modelId: screwId,
        modelName: screwLabel,
        screwRadius: radius,
        screwLength: length
      });

      // Apply transform
      if (transformCopy && transformCopy.length === 16 && loadedModel) {
        await modelStateService.setModelTransform(
          loadedModel.metadata.id,
          transformCopy,
          length
        );
      }

      console.log(`✅ [ScrewOps] Screw model loaded: ${screwLabel}`);
      return loadedModel;
    } catch (error) {
      console.error('[ScrewOps] Failed to load screw model:', error);
      throw error;
    }
  }, [modelStateService, planeCutterService, viewportGridService, getCurrentViewportId]);

  /**
   * Update screw dimensions (radius and/or length)
   * Handles backend sync and 3D model reloading based on event type
   * 
   * @param screwData - Screw data object
   * @param newRadius - New radius (if updating diameter)
   * @param newLength - New length (if updating length)
   * @param eventType - Type of event triggering update (default: PROGRAMMATIC)
   */
  const updateScrewDimensions = useCallback(async (
    screwData: any,
    newRadius?: number,
    newLength?: number,
    eventType: ScrewUpdateEventType = ScrewUpdateEventType.PROGRAMMATIC
  ) => {
    const screwId = screwData.screw_id || screwData.id;
    if (!screwId) {
      console.error('[ScrewOps] Cannot update screw: no screw ID');
      throw new Error('Missing screw ID');
    }

    if (!modelStateService) {
      console.error('[ScrewOps] modelStateService not available');
      throw new Error('modelStateService not available');
    }

    try {
      // Get update options based on event type
      const updateOptions = getScrewUpdateOptions(eventType);
      
      console.log(`🔄 [ScrewOps] Update triggered by ${eventType}:`, updateOptions);
      
      // Get display info
      const radius = parseFloat(screwData.radius);
      const length = parseFloat(screwData.length);
      const label = screwData.screw_label || screwData.name || screwData.screw_id || 'Unknown';

      const updatedRadius = newRadius !== undefined ? newRadius : radius;
      const updatedLength = newLength !== undefined ? newLength : length;

      console.log(`🔄 [ScrewOps] Updating screw ${screwId}: R=${updatedRadius}mm, L=${updatedLength}mm`);
      
      // For SLIDER_DRAG events, only update local state - no model reload or backend sync
      if (eventType === ScrewUpdateEventType.SLIDER_DRAG) {
        console.log('📌 [ScrewOps] SLIDER_DRAG: Updating state only (no model reload/backend sync)');
        
        // Update frontend state only
        if (onScrewsUpdate) {
          onScrewsUpdate(prevScrews =>
            prevScrews.map(s => {
              const id = s.screw_id || s.id;
              if (id === screwId) {
                return {
                  ...s,
                  radius: updatedRadius,
                  length: updatedLength,
                };
              }
              return s;
            })
          );
        }
        
        // Return early - no model operations
        return { screwId, updatedRadius, updatedLength, skipped: true };
      }

      // Step 1: Get cap model and its transform (cap position is the reference)
      // Only recalculate transform if needed
      const allModels = modelStateService.getAllModels();
      const capModelId = `${screwId}-cap`;
      const capModelName = `${label}-Cap`;
      const capModel = allModels.find(
        (m: any) => m.metadata.id === capModelId || m.metadata.name === capModelName
      );

      let newScrewTransform: number[] | null = null;

      if (updateOptions.recalculateTransform) {
        if (capModel) {
          console.log('[ScrewOps] Found cap model - using cap position as reference');
          const capTransform = modelStateService.getScrewTransform(capModel.metadata.id);
          
          if (capTransform && capTransform.length === 16) {
            newScrewTransform = calculateScrewTransformFromCap(capTransform, updatedLength);
          } else {
            console.warn('[ScrewOps] Could not get cap transform, falling back to screw transform');
          }
        }
      } else {
        console.log('[ScrewOps] Skipping transform recalculation (not needed for this event type)');
      }

      // Fallback: Get transform from existing screw model if cap not found
      if (!newScrewTransform) {
        const existingModel = allModels.find(
          (m: any) => m.metadata.id === screwId || m.metadata.name === label
        );

        if (!existingModel) {
          throw new Error('Cannot find 3D model or cap model for this screw');
        }

        const currentTransform = modelStateService.getScrewTransform(existingModel.metadata.id);
        if (!currentTransform || currentTransform.length !== 16) {
          throw new Error('Cannot get transform matrix for screw');
        }

        newScrewTransform = currentTransform instanceof Float32Array 
          ? Array.from(currentTransform) 
          : [...currentTransform];
        console.log('[ScrewOps] Using existing screw transform');
      }

      // Step 2: Delete only the body model (preserve cap) - only if reloading model
      if (updateOptions.reloadModel) {
        await deleteScrewModels(screwId, label, false);
      } else {
        console.log('[ScrewOps] Skipping model deletion (not reloading for this event type)');
      }

      // Step 3: Update backend data - only if syncBackend is enabled
      if (updateOptions.syncBackend && sessionId && planningBackendService?.updateScrew) {
        console.log('[ScrewOps] Updating screw in backend...');
        const updateResponse = await planningBackendService.updateScrew(
          screwId,
          sessionId,
          {
            radius: updatedRadius,
            length: updatedLength,
            transformMatrix: newScrewTransform
          }
        );

        if (!updateResponse.success) {
          throw new Error(updateResponse.error || 'Backend update failed');
        }

        // Reload screw from backend to sync state
        if (onScrewsUpdate) {
          try {
            const getScrewResponse = await planningBackendService.getScrew(screwId, sessionId);
            if (getScrewResponse.success && getScrewResponse.screw) {
              onScrewsUpdate(prevScrews =>
                prevScrews.map(s => {
                  const id = s.screw_id || s.id;
                  if (id === screwId) {
                    return {
                      ...s,
                      ...getScrewResponse.screw,
                      radius: updatedRadius,
                      length: updatedLength,
                      transform_matrix: newScrewTransform
                    };
                  }
                  return s;
                })
              );
              console.log('[ScrewOps] Frontend state synced with backend');
            }
          } catch (reloadError) {
            console.warn('[ScrewOps] Error reloading screw from backend:', reloadError);
            // Fallback to frontend state update
            if (onScrewsUpdate) {
              onScrewsUpdate(prevScrews =>
                prevScrews.map(s => {
                  const id = s.screw_id || s.id;
                  if (id === screwId) {
                    return {
                      ...s,
                      radius: updatedRadius,
                      length: updatedLength,
                      transform_matrix: newScrewTransform
                    };
                  }
                  return s;
                })
              );
            }
          }
        }
      } else if (onScrewsUpdate) {
        // No sessionId - only update frontend state
        onScrewsUpdate(prevScrews =>
          prevScrews.map(s => {
            const id = s.screw_id || s.id;
            if (id === screwId) {
              return {
                ...s,
                radius: updatedRadius,
                length: updatedLength,
                transform_matrix: newScrewTransform
              };
            }
            return s;
          })
        );
      }

      // Step 4: Reload 3D body model with new dimensions and position - only if reloadModel is enabled
      if (updateOptions.reloadModel && newScrewTransform) {
        await loadScrewModel(
          updatedRadius,
          updatedLength,
          newScrewTransform,
          label,
          screwId
        );
        console.log(`✅ [ScrewOps] Model reloaded with new dimensions`);
      } else {
        console.log('[ScrewOps] Skipping model reload (not needed for this event type)');
      }

      console.log(`✅ [ScrewOps] Successfully updated screw ${screwId} (event: ${eventType})`);
      return { screwId, updatedRadius, updatedLength, newScrewTransform, eventType };

    } catch (error) {
      console.error('[ScrewOps] Failed to update screw dimensions:', error);
      throw error;
    }
  }, [
    modelStateService, 
    sessionId, 
    onScrewsUpdate, 
    calculateScrewTransformFromCap, 
    deleteScrewModels, 
    loadScrewModel
  ]);

  return {
    loadScrewModel,
    loadCapModel,
    deleteScrewModels,
    updateScrewDimensions,
    calculateScrewTransformFromCap,
    getCurrentViewportId
  };
}

