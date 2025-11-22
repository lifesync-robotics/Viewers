/**
 * 3D Model Loader Example Usage
 *
 * This file demonstrates how to use the ModelStateService to load, render,
 * and manage 3D models (OBJ, STL, PLY) in the OHIF Viewer.
 *
 * Based on:
 * - Cornerstone.js mesh loader: https://www.cornerstonejs.org/live-examples/meshloader
 * - vtk.js OBJ Viewer: https://kitware.github.io/vtk-js/examples/OBJViewer.html
 */

import { ModelStateService } from '@ohif/extension-lifesync';

/**
 * Example 1: Load a model from a URL
 */
export async function example1LoadModelFromURL(
  modelStateService: ModelStateService,
  viewportId: string
) {
  console.log('📦 Example 1: Loading model from URL...');

  const modelUrl = 'https://data.kitware.com/api/v1/item/59cdbb588d777f31ac63de08/download';

  const loadedModel = await modelStateService.loadModel(modelUrl, {
    viewportId,
    color: [0.8, 0.2, 0.2], // Red color
    opacity: 1.0,
    visible: true,
  });

  if (loadedModel) {
    console.log('✅ Model loaded successfully:', loadedModel.metadata);
  } else {
    console.error('❌ Failed to load model');
  }
}

/**
 * Example 2: Load a model from local file (with file input)
 */
export function example2LoadModelFromFileInput(
  modelStateService: ModelStateService,
  viewportId: string
) {
  console.log('📦 Example 2: Loading model from file input...');

  // Create a file input element
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.obj,.stl,.ply';

  input.onchange = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log(`Loading file: ${file.name}`);

    const loadedModel = await modelStateService.loadModelFromFileInput(file, {
      viewportId,
      color: [0.2, 0.8, 0.2], // Green color
      opacity: 0.8,
      visible: true,
      scale: [1, 1, 1],
    });

    if (loadedModel) {
      console.log('✅ Model loaded successfully:', loadedModel.metadata);
    } else {
      console.error('❌ Failed to load model');
    }
  };

  // Trigger file selection
  input.click();
}

/**
 * Example 3: Load multiple models
 */
export async function example3LoadMultipleModels(
  modelStateService: ModelStateService,
  viewportId: string
) {
  console.log('📦 Example 3: Loading multiple models...');

  const modelUrls = [
    'https://example.com/model1.obj',
    'https://example.com/model2.stl',
    'https://example.com/model3.ply',
  ];

  const colors: [number, number, number][] = [
    [1, 0, 0], // Red
    [0, 1, 0], // Green
    [0, 0, 1], // Blue
  ];

  const loadedModels = [];

  for (let i = 0; i < modelUrls.length; i++) {
    const loadedModel = await modelStateService.loadModel(modelUrls[i], {
      viewportId,
      color: colors[i],
      opacity: 0.7,
      visible: true,
    });

    if (loadedModel) {
      loadedModels.push(loadedModel);
      console.log(`✅ Model ${i + 1} loaded:`, loadedModel.metadata.name);
    }
  }

  return loadedModels;
}

/**
 * Example 4: Toggle model visibility
 */
export function example4ToggleModelVisibility(
  modelStateService: ModelStateService,
  modelId: string
) {
  console.log('👁️ Example 4: Toggling model visibility...');

  const model = modelStateService.getModel(modelId);

  if (model) {
    const newVisibility = !model.metadata.visible;
    modelStateService.setModelVisibility(modelId, newVisibility);
    console.log(`✅ Model visibility set to: ${newVisibility}`);
  } else {
    console.error('❌ Model not found');
  }
}

/**
 * Example 5: Change model color
 */
export function example5ChangeModelColor(
  modelStateService: ModelStateService,
  modelId: string,
  color: [number, number, number]
) {
  console.log('🎨 Example 5: Changing model color...');

  const success = modelStateService.setModelColor(modelId, color);

  if (success) {
    console.log('✅ Model color changed to:', color);
  } else {
    console.error('❌ Failed to change color');
  }
}

/**
 * Example 6: Adjust model opacity
 */
export function example6AdjustModelOpacity(
  modelStateService: ModelStateService,
  modelId: string,
  opacity: number
) {
  console.log('🔆 Example 6: Adjusting model opacity...');

  const success = modelStateService.setModelOpacity(modelId, opacity);

  if (success) {
    console.log('✅ Model opacity set to:', opacity);
  } else {
    console.error('❌ Failed to set opacity');
  }
}

/**
 * Example 7: Get all loaded models
 */
export function example7GetAllModels(modelStateService: ModelStateService) {
  console.log('📋 Example 7: Getting all loaded models...');

  const models = modelStateService.getAllModels();

  console.log(`Found ${models.length} loaded models:`);
  models.forEach((model, index) => {
    console.log(`  ${index + 1}. ${model.metadata.name} (${model.metadata.format})`);
  });

  return models;
}

/**
 * Example 8: Remove a specific model
 */
export function example8RemoveModel(modelStateService: ModelStateService, modelId: string) {
  console.log('🗑️ Example 8: Removing model...');

  const success = modelStateService.removeModel(modelId);

  if (success) {
    console.log('✅ Model removed successfully');
  } else {
    console.error('❌ Failed to remove model');
  }
}

/**
 * Example 9: Delete model file from disk
 */
export async function example9DeleteModelFile(
  modelStateService: ModelStateService,
  modelId: string
) {
  console.log('💾 Example 9: Deleting model file from disk...');

  const success = await modelStateService.deleteModelFile(modelId);

  if (success) {
    console.log('✅ Model file deleted from disk');
  } else {
    console.error('❌ Failed to delete model file (requires backend API)');
  }
}

/**
 * Example 10: Clear all models
 */
export function example10ClearAllModels(modelStateService: ModelStateService) {
  console.log('🧹 Example 10: Clearing all models...');

  modelStateService.clearAllModels();
  console.log('✅ All models cleared');
}

/**
 * Example 11: Subscribe to model events
 */
export function example11SubscribeToEvents(modelStateService: ModelStateService) {
  console.log('📡 Example 11: Subscribing to model events...');

  // Subscribe to model added event
  const unsubscribeAdded = modelStateService.subscribe(
    modelStateService.EVENTS.MODEL_ADDED,
    ({ modelId, metadata }) => {
      console.log('🎉 Model added:', metadata.name);
    }
  );

  // Subscribe to model removed event
  const unsubscribeRemoved = modelStateService.subscribe(
    modelStateService.EVENTS.MODEL_REMOVED,
    ({ modelId }) => {
      console.log('👋 Model removed:', modelId);
    }
  );

  // Subscribe to model visibility changed event
  const unsubscribeVisibility = modelStateService.subscribe(
    modelStateService.EVENTS.MODEL_VISIBILITY_CHANGED,
    ({ modelId, visible }) => {
      console.log('👁️ Model visibility changed:', modelId, visible);
    }
  );

  // Subscribe to loading events
  const unsubscribeLoadingComplete = modelStateService.subscribe(
    modelStateService.EVENTS.MODEL_LOADING_COMPLETE,
    ({ modelId, metadata }) => {
      console.log('✅ Model loading complete:', metadata.name);
    }
  );

  const unsubscribeLoadingError = modelStateService.subscribe(
    modelStateService.EVENTS.MODEL_LOADING_ERROR,
    ({ fileName, error }) => {
      console.error('❌ Model loading error:', fileName, error);
    }
  );

  console.log('✅ Subscribed to all model events');

  // Return unsubscribe functions
  return {
    unsubscribeAdded,
    unsubscribeRemoved,
    unsubscribeVisibility,
    unsubscribeLoadingComplete,
    unsubscribeLoadingError,
  };
}

/**
 * Example 12: Complete workflow
 */
export async function example12CompleteWorkflow(
  modelStateService: ModelStateService,
  viewportId: string
) {
  console.log('🚀 Example 12: Complete workflow...');

  // 1. Subscribe to events
  const subscriptions = example11SubscribeToEvents(modelStateService);

  // 2. Load a model
  const modelUrl = 'C:\\Users\\hp\\tableTop\\mvisioner\\slicer\\slicer\\deployment\\addScrew\\addScrew\\Resources\\20250415_U-Peidcle Screw_7300_T10\\model.obj';

  const loadedModel = await modelStateService.loadModel(modelUrl, {
    viewportId,
    color: [0.8, 0.5, 0.2], // Orange
    opacity: 0.9,
    visible: true,
  });

  if (!loadedModel) {
    console.error('❌ Failed to load model');
    return;
  }

  const modelId = loadedModel.metadata.id;

  // 3. Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 4. Change color
  modelStateService.setModelColor(modelId, [0.2, 0.5, 0.8]); // Blue

  // 5. Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 6. Toggle visibility
  modelStateService.setModelVisibility(modelId, false);
  await new Promise(resolve => setTimeout(resolve, 500));
  modelStateService.setModelVisibility(modelId, true);

  // 7. Adjust opacity
  modelStateService.setModelOpacity(modelId, 0.5);

  // 8. Get all models
  const allModels = modelStateService.getAllModels();
  console.log(`Total models loaded: ${allModels.length}`);

  // 9. Clean up (optional)
  // modelStateService.removeModel(modelId);

  // 10. Unsubscribe from events (when done)
  // Object.values(subscriptions).forEach(unsub => unsub.unsubscribe());

  console.log('✅ Workflow complete!');
}

/**
 * Usage in a React component or command module:
 */

/*
// In a React component:
import { useEffect } from 'react';

function ModelViewerComponent({ servicesManager, viewportId }) {
  const { modelStateService } = servicesManager.services;

  useEffect(() => {
    // Load a model when component mounts
    example1LoadModelFromURL(modelStateService, viewportId);
  }, [modelStateService, viewportId]);

  return (
    <div>
      <button onClick={() => example2LoadModelFromFileInput(modelStateService, viewportId)}>
        Load Model from File
      </button>
      <button onClick={() => example10ClearAllModels(modelStateService)}>
        Clear All Models
      </button>
    </div>
  );
}

// In a command module:
const commands = {
  loadModel: ({ modelUrl, viewportId }) => {
    const { modelStateService } = servicesManager.services;
    return modelStateService.loadModel(modelUrl, { viewportId });
  },

  removeModel: ({ modelId }) => {
    const { modelStateService } = servicesManager.services;
    return modelStateService.removeModel(modelId);
  },

  toggleModelVisibility: ({ modelId }) => {
    const { modelStateService } = servicesManager.services;
    const model = modelStateService.getModel(modelId);
    if (model) {
      modelStateService.setModelVisibility(modelId, !model.metadata.visible);
    }
  },
};
*/
