import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSystem } from '@ohif/core';

/**
 * Hook to track screw state from ModelStateService
 * 
 * @returns { hasScrews, screwCount, screws } - Screw availability and count
 */
export function useScrewState(): {
  hasScrews: boolean;
  screwCount: number;
  screws: any[];
  refreshScrews: () => void;
} {
  const { servicesManager } = useSystem();
  const [screws, setScrews] = useState<any[]>([]);

  // Get screw models from ModelStateService
  const getScrewModels = useCallback(() => {
    try {
      const { modelStateService } = servicesManager.services;
      if (!modelStateService) {
        return [];
      }

      const allModels = modelStateService.getAllModels();
      
      // Filter for screw models (type === 'screw' or name contains screw-related patterns)
      const screwModels = allModels.filter((model: any) => {
        const metadata = model.metadata || {};
        const modelType = metadata.type?.toLowerCase() || '';
        const modelName = (metadata.name || '').toLowerCase();
        
        // Check if it's a screw model
        return (
          modelType === 'screw' ||
          modelType.includes('pedicle') ||
          modelName.includes('screw') ||
          modelName.includes('pedicle') ||
          // Check for vertebral level patterns (e.g., "L1-L", "L2-R", "T12-L")
          /^[ltsc]\d+[-_]?[lr]$/i.test(metadata.label || '') ||
          /^[ltsc]\d+[-_]?[lr]/i.test(modelName)
        );
      });

      return screwModels;
    } catch (error) {
      console.warn('[useScrewState] Error getting screw models:', error);
      return [];
    }
  }, [servicesManager]);

  const refreshScrews = useCallback(() => {
    const screwModels = getScrewModels();
    setScrews(screwModels);
  }, [getScrewModels]);

  useEffect(() => {
    // Initial load
    refreshScrews();

    // Subscribe to model changes
    const { modelStateService } = servicesManager.services;
    if (!modelStateService) {
      return;
    }

    // Subscribe to model added/removed events
    const subscriptions: Array<{ unsubscribe: () => void }> = [];

    if (modelStateService.subscribe) {
      // Listen to MODEL_ADDED events
      const addedSub = modelStateService.subscribe(
        modelStateService.EVENTS?.MODEL_ADDED || 'MODEL_ADDED',
        () => {
          refreshScrews();
        }
      );
      if (addedSub) subscriptions.push(addedSub);

      // Listen to MODEL_REMOVED events
      const removedSub = modelStateService.subscribe(
        modelStateService.EVENTS?.MODEL_REMOVED || 'MODEL_REMOVED',
        () => {
          refreshScrews();
        }
      );
      if (removedSub) subscriptions.push(removedSub);

      // Listen to MODEL_UPDATED events
      // Skip transform updates to avoid reloading during screw dragging
      const updatedSub = modelStateService.subscribe(
        modelStateService.EVENTS?.MODEL_UPDATED || 'MODEL_UPDATED',
        (eventData: any) => {
          // Skip reload for transform updates (position, rotation, transform)
          if (eventData?.property === 'position' || 
              eventData?.property === 'rotation' || 
              eventData?.property === 'transform') {
            return;
          }
          refreshScrews();
        }
      );
      if (updatedSub) subscriptions.push(updatedSub);
      
      // Subscriptions are working - no need for polling
      return () => {
        subscriptions.forEach(sub => sub?.unsubscribe?.());
      };
    }

    // Polling as fallback only if subscriptions don't work
    console.warn('[useScrewState] Event subscriptions not available - using polling fallback');
    const intervalId = setInterval(refreshScrews, 2000);

    return () => {
      clearInterval(intervalId);
    };
  }, [servicesManager, refreshScrews]);

  return useMemo(() => ({
    hasScrews: screws.length > 0,
    screwCount: screws.length,
    screws,
    refreshScrews,
  }), [screws, refreshScrews]);
}

export default useScrewState;

