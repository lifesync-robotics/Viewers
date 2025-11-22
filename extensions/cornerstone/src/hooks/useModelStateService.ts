/**
 * Custom React Hook for accessing ModelStateService
 *
 * This hook provides easy access to the ModelStateService in React components
 * without needing to manually destructure from servicesManager.
 */

import { useSystem } from '@ohif/core';
import type { ModelStateService } from '@ohif/extension-lifesync';
import type CornerstoneServices from '../types/CornerstoneServices';

/**
 * Hook to access the ModelStateService
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const modelStateService = useModelStateService();
 *
 *   const loadModel = async () => {
 *     await modelStateService.loadModel('path/to/model.obj', {
 *       viewportId: 'viewport-1',
 *     });
 *   };
 *
 *   return <button onClick={loadModel}>Load Model</button>;
 * }
 * ```
 */
export function useModelStateService(): ModelStateService {
  const { servicesManager } = useSystem();
  const services = servicesManager.services as CornerstoneServices;
  return services.modelStateService;
}

/**
 * Hook to access the ModelStateService with additional helpers
 *
 * @param viewportId - Optional default viewport ID for operations
 * @returns Object with modelStateService and helper functions
 *
 * @example
 * ```typescript
 * function MyComponent({ viewportId }) {
 *   const { modelStateService, loadModel, getAllModels } = useModelState(viewportId);
 *
 *   const handleLoad = async (file: File) => {
 *     await loadModel(file, { color: [1, 0, 0] });
 *   };
 *
 *   return <div>Models: {getAllModels().length}</div>;
 * }
 * ```
 */
export function useModelState(viewportId?: string) {
  const { servicesManager } = useSystem();
  const services = servicesManager.services as CornerstoneServices;
  const modelStateService = services.modelStateService;

  return {
    modelStateService,

    /**
     * Load a model with default viewport
     */
    loadModel: async (fileOrUrl: string | File, options = {}) => {
      const opts = { viewportId, ...options };

      if (typeof fileOrUrl === 'string') {
        return await modelStateService.loadModel(fileOrUrl, opts);
      } else {
        return await modelStateService.loadModelFromFileInput(fileOrUrl, opts);
      }
    },

    /**
     * Get all loaded models
     */
    getAllModels: () => modelStateService.getAllModels(),

    /**
     * Get models for the default viewport
     */
    getViewportModels: () => {
      if (!viewportId) return [];
      return modelStateService.getModelsByViewport(viewportId);
    },

    /**
     * Remove a model
     */
    removeModel: (modelId: string) => modelStateService.removeModel(modelId),

    /**
     * Toggle model visibility
     */
    toggleVisibility: (modelId: string) => {
      const model = modelStateService.getModel(modelId);
      if (model) {
        modelStateService.setModelVisibility(modelId, !model.metadata.visible);
      }
    },

    /**
     * Change model color
     */
    setColor: (modelId: string, color: [number, number, number]) => {
      modelStateService.setModelColor(modelId, color);
    },

    /**
     * Change model opacity
     */
    setOpacity: (modelId: string, opacity: number) => {
      modelStateService.setModelOpacity(modelId, opacity);
    },

    /**
     * Clear all models
     */
    clearAll: () => modelStateService.clearAllModels(),
  };
}

export default useModelStateService;
