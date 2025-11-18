# How to Access ServicesManager and ModelStateService

Complete guide showing all the ways to access `servicesManager` and use the `ModelStateService` in different contexts.

## 🎯 Quick Answer

```typescript
// Method 1: Use the custom hook (Recommended for React)
import { useModelStateService } from '@ohif/extension-cornerstone';

function MyComponent() {
  const modelStateService = useModelStateService();
  // Use it!
}

// Method 2: Global access (Console/debugging)
const modelStateService = window.services.modelStateService;

// Method 3: Props (Components)
function MyComponent({ servicesManager }) {
  const { modelStateService } = servicesManager.services;
}

// Method 4: useSystem hook
import { useSystem } from '@ohif/core';

function MyComponent() {
  const { servicesManager } = useSystem();
  const { modelStateService } = servicesManager.services;
}
```

## 📖 Detailed Guide

### 1️⃣ In React Components (Recommended)

#### Option A: Custom Hook (Best Practice)
```typescript
import { useModelStateService } from '@ohif/extension-cornerstone';

function ModelLoader() {
  const modelStateService = useModelStateService();

  const loadModel = async () => {
    await modelStateService.loadModel('path/to/model.obj', {
      viewportId: 'viewport-1',
      color: [1, 0, 0],
    });
  };

  return <button onClick={loadModel}>Load Model</button>;
}
```

#### Option B: Custom Hook with Helpers
```typescript
import { useModelState } from '@ohif/extension-cornerstone';

function ModelManager({ viewportId }) {
  const {
    loadModel,
    getAllModels,
    removeModel,
    toggleVisibility,
    setColor,
  } = useModelState(viewportId);

  const handleFileUpload = async (file) => {
    await loadModel(file, { color: [0, 1, 0] });
  };

  return (
    <div>
      <input
        type="file"
        accept=".obj,.stl,.ply"
        onChange={(e) => handleFileUpload(e.target.files[0])}
      />
      <p>Total Models: {getAllModels().length}</p>
    </div>
  );
}
```

#### Option C: useSystem Hook
```typescript
import { useSystem } from '@ohif/core';

function MyComponent() {
  const { servicesManager } = useSystem();
  const { modelStateService } = servicesManager.services;

  // Use modelStateService
}
```

#### Option D: Via Props (withAppTypes)
```typescript
import { withAppTypes } from '@ohif/core';

function MyComponent({ servicesManager }: withAppTypes) {
  const { modelStateService } = servicesManager.services;

  // Use modelStateService
}

export default MyComponent;
```

---

### 2️⃣ In Command Modules

```typescript
// extensions/cornerstone/src/commandsModule.ts

const commandsModule = ({ servicesManager, commandsManager }) => {
  const { modelStateService } = servicesManager.services;

  return {
    actions: {
      loadModel: ({ modelUrl, viewportId, options = {} }) => {
        return modelStateService.loadModel(modelUrl, {
          viewportId,
          ...options,
        });
      },

      removeModel: ({ modelId }) => {
        return modelStateService.removeModel(modelId);
      },

      setModelColor: ({ modelId, color }) => {
        return modelStateService.setModelColor(modelId, color);
      },

      getAllModels: () => {
        return modelStateService.getAllModels();
      },

      clearAllModels: () => {
        return modelStateService.clearAllModels();
      },
    },
  };
};
```

---

### 3️⃣ In Extension Methods

```typescript
// extensions/my-extension/src/index.tsx

const myExtension = {
  id: 'my-extension',

  preRegistration: async ({ servicesManager }) => {
    const { modelStateService } = servicesManager.services;
    // Use it during extension initialization
  },

  onModeEnter: ({ servicesManager, commandsManager }) => {
    const { modelStateService } = servicesManager.services;
    // Use it when mode is entered
  },

  getViewportModule: ({ servicesManager, commandsManager }) => {
    const { modelStateService } = servicesManager.services;
    // Use it in viewport module
  },
};
```

---

### 4️⃣ Global Access (Browser Console / Debugging)

#### Method A: Via window.services (Already Available)
```javascript
// In browser console
const modelStateService = window.services.modelStateService;

// Load a model
await modelStateService.loadModel('path/to/model.obj', {
  viewportId: 'viewport-1',
  color: [1, 0, 0],
});

// Get all models
const models = modelStateService.getAllModels();
console.log('Loaded models:', models);

// Remove a model
modelStateService.removeModel(modelId);
```

#### Method B: Via window.servicesManager (Now Available)
```javascript
// In browser console
const { modelStateService } = window.servicesManager.services;

// Or destructure multiple services
const {
  modelStateService,
  cornerstoneViewportService,
  displaySetService,
} = window.servicesManager.services;
```

---

### 5️⃣ In Utility Functions

```typescript
// utils/modelUtils.ts

/**
 * Get servicesManager from global window object
 * Useful for utility functions outside React components
 */
function getModelStateService() {
  if (typeof window === 'undefined' || !window.servicesManager) {
    throw new Error('ServicesManager not available');
  }

  return window.servicesManager.services.modelStateService;
}

export async function loadModelFromPath(path: string, viewportId: string) {
  const modelStateService = getModelStateService();

  return await modelStateService.loadModel(path, {
    viewportId,
    color: [0.8, 0.2, 0.2],
    opacity: 1.0,
  });
}

export function getAllLoadedModels() {
  const modelStateService = getModelStateService();
  return modelStateService.getAllModels();
}
```

---

### 6️⃣ In Custom Panels

```typescript
// extensions/my-extension/src/panels/ModelPanel.tsx

import React from 'react';
import { useModelStateService } from '@ohif/extension-cornerstone';

function ModelPanel({ servicesManager, commandsManager }) {
  // Option 1: Use the hook
  const modelStateService = useModelStateService();

  // Option 2: Or from props
  // const { modelStateService } = servicesManager.services;

  const [models, setModels] = React.useState([]);

  React.useEffect(() => {
    // Load models
    setModels(modelStateService.getAllModels());

    // Subscribe to events
    const unsubscribe = modelStateService.subscribe(
      modelStateService.EVENTS.MODEL_ADDED,
      () => setModels(modelStateService.getAllModels())
    );

    return () => unsubscribe.unsubscribe();
  }, [modelStateService]);

  return (
    <div>
      <h3>3D Models ({models.length})</h3>
      {models.map((model) => (
        <div key={model.metadata.id}>
          <span>{model.metadata.name}</span>
          <button
            onClick={() =>
              modelStateService.setModelVisibility(
                model.metadata.id,
                !model.metadata.visible
              )
            }
          >
            Toggle
          </button>
        </div>
      ))}
    </div>
  );
}

export default ModelPanel;
```

---

## 🎨 Complete Examples

### Example 1: Model Loader Component

```typescript
import React, { useState, useEffect } from 'react';
import { useModelStateService } from '@ohif/extension-cornerstone';

function ModelLoaderComponent({ viewportId }) {
  const modelStateService = useModelStateService();
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Initialize models
    setModels(modelStateService.getAllModels());

    // Subscribe to events
    const subscriptions = [
      modelStateService.subscribe(
        modelStateService.EVENTS.MODEL_ADDED,
        ({ metadata }) => {
          console.log('Model added:', metadata.name);
          setModels(modelStateService.getAllModels());
        }
      ),
      modelStateService.subscribe(
        modelStateService.EVENTS.MODEL_REMOVED,
        ({ modelId }) => {
          console.log('Model removed:', modelId);
          setModels(modelStateService.getAllModels());
        }
      ),
    ];

    return () => {
      subscriptions.forEach((sub) => sub.unsubscribe());
    };
  }, [modelStateService]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      await modelStateService.loadModelFromFileInput(file, {
        viewportId,
        color: [0.8, 0.2, 0.2],
        opacity: 0.8,
      });
    } catch (error) {
      console.error('Failed to load model:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept=".obj,.stl,.ply"
        onChange={handleFileUpload}
        disabled={loading}
      />

      <div>
        <h3>Loaded Models: {models.length}</h3>
        {models.map((model) => (
          <div key={model.metadata.id}>
            <span>{model.metadata.name}</span>
            <button
              onClick={() =>
                modelStateService.setModelVisibility(
                  model.metadata.id,
                  !model.metadata.visible
                )
              }
            >
              {model.metadata.visible ? 'Hide' : 'Show'}
            </button>
            <button
              onClick={() => modelStateService.removeModel(model.metadata.id)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {loading && <div>Loading model...</div>}
    </div>
  );
}

export default ModelLoaderComponent;
```

### Example 2: Using Custom Hook with Helpers

```typescript
import React from 'react';
import { useModelState } from '@ohif/extension-cornerstone';

function SimpleModelManager({ viewportId }) {
  const {
    loadModel,
    getAllModels,
    toggleVisibility,
    setColor,
    removeModel,
  } = useModelState(viewportId);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      await loadModel(file);
    }
  };

  const models = getAllModels();

  return (
    <div>
      <input type="file" accept=".obj,.stl,.ply" onChange={handleFileChange} />

      {models.map((model) => (
        <div key={model.metadata.id}>
          <span>{model.metadata.name}</span>
          <button onClick={() => toggleVisibility(model.metadata.id)}>
            Toggle
          </button>
          <button onClick={() => setColor(model.metadata.id, [1, 0, 0])}>
            Red
          </button>
          <button onClick={() => removeModel(model.metadata.id)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
```

### Example 3: In Browser Console

```javascript
// Open browser console (F12) and try these:

// 1. Get the service
const modelService = window.services.modelStateService;

// 2. Load a model
await modelService.loadModel('C:\\path\\to\\model.obj', {
  viewportId: 'viewport-1',
  color: [1, 0, 0], // Red
  opacity: 1.0,
});

// 3. Get all models
const models = modelService.getAllModels();
console.log('Loaded models:', models);

// 4. Change color of first model
if (models.length > 0) {
  const modelId = models[0].metadata.id;
  modelService.setModelColor(modelId, [0, 1, 0]); // Green
}

// 5. Toggle visibility
if (models.length > 0) {
  const modelId = models[0].metadata.id;
  const model = modelService.getModel(modelId);
  modelService.setModelVisibility(modelId, !model.metadata.visible);
}

// 6. Remove all models
modelService.clearAllModels();
```

---

## 🔧 TypeScript Type Definitions

If you need type definitions:

```typescript
import type { ServicesManager } from '@ohif/core';
import type ModelStateService from '@ohif/extension-cornerstone/src/modelStateService';

// In your component
interface MyComponentProps {
  servicesManager: ServicesManager;
  viewportId: string;
}

function MyComponent({ servicesManager, viewportId }: MyComponentProps) {
  const modelStateService = servicesManager.services
    .modelStateService as ModelStateService;

  // Use with full type safety
}
```

---

## 🌐 Global Window Types

Add to your type declarations (e.g., `global.d.ts`):

```typescript
declare global {
  interface Window {
    services: AppTypes.Services;
    servicesManager: ServicesManager;
    commandsManager: CommandsManager;
    extensionManager: ExtensionManager;
    cornerstone3D: {
      core: typeof import('@cornerstonejs/core');
      tools: typeof import('@cornerstonejs/tools');
    };
  }
}

export {};
```

---

## 📚 Summary Table

| Context | Access Method | Use Case |
|---------|---------------|----------|
| **React Component** | `useModelStateService()` hook | ✅ Best for React |
| **React Component** | `useModelState()` hook | ✅ With helpers |
| **React Component** | `useSystem()` hook | Good for any service |
| **React Component** | Props (`withAppTypes`) | Legacy/explicit |
| **Command Module** | Function parameter | ✅ Standard |
| **Extension Method** | Function parameter | ✅ Standard |
| **Utility Function** | `window.services` | For non-React |
| **Browser Console** | `window.services` | ✅ Debugging |
| **Browser Console** | `window.servicesManager` | Alternative |

---

## ✅ Best Practices

1. **In React**: Use `useModelStateService()` or `useModelState()` hooks
2. **In Commands**: Use the provided `servicesManager` parameter
3. **For Debugging**: Use `window.services.modelStateService` in console
4. **For Utils**: Access via `window.servicesManager` with proper checks
5. **Always**: Handle cases where service might not be available

---

## 🎯 Quick Copy-Paste Snippets

### React Component (Quick)
```typescript
import { useModelStateService } from '@ohif/extension-cornerstone';

function MyComponent() {
  const modelStateService = useModelStateService();
  // Use it!
}
```

### Command (Quick)
```typescript
const commands = ({ servicesManager }) => ({
  actions: {
    myAction: () => {
      const { modelStateService } = servicesManager.services;
      // Use it!
    },
  },
});
```

### Console (Quick)
```javascript
// In browser console
const ms = window.services.modelStateService;
await ms.loadModel('path.obj', { viewportId: 'viewport-1' });
```

---

**Need More Help?**
- Check: `extensions/cornerstone/src/MODEL_LOADER_README.md`
- See: `extensions/cornerstone/src/examples/modelLoaderExample.ts`

**Happy Coding! 🚀**
