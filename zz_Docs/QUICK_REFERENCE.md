# 3D Model Loader - Quick Reference Guide

## 🚀 One-Minute Quick Start

### Option 1: Toolbar Button (Easiest! ✨)

**Just click the "Upload Models" button in your toolbar!**

- No coding required
- Drag & drop interface
- Supports OBJ, STL, PLY files
- Add to toolbar: See [TOOLBAR_MODEL_UPLOAD_GUIDE.md](./TOOLBAR_MODEL_UPLOAD_GUIDE.md)

### Option 2: In React Component
```typescript
import { useModelStateService } from '@ohif/extension-cornerstone';

function MyComponent() {
  const modelStateService = useModelStateService();

  // Load a model
  const model = await modelStateService.loadModel('path/to/model.obj', {
    viewportId: 'viewport-1',
    color: [0.8, 0.2, 0.2], // Red
    opacity: 1.0,
  });

  // Manage it
  modelStateService.setModelVisibility(model.metadata.id, false); // Hide
  modelStateService.setModelColor(model.metadata.id, [0, 1, 0]); // Green
  modelStateService.removeModel(model.metadata.id); // Remove
}
```

### Option 3: In Browser Console (Testing with URL)
```javascript
// Already exposed globally!
const modelStateService = window.services.modelStateService;

// ⚠️ Note: Can't load from local paths (browser security)
// Use HTTP URL instead:
await modelStateService.loadModel('https://example.com/models/model.obj', {
  viewportId: 'viewport-1',
  color: [1, 0, 0],
});

// Or use the ModelUpload GUI component for file uploads
```

### Option 4: In Commands/Extensions
```typescript
function myCommand({ servicesManager }) {
  const { modelStateService } = servicesManager.services;
  // Use it!
}
```

## 🚨 Important: Browser Security Warning

**❌ Local file paths DON'T work in browsers due to security!**

```javascript
// ❌ THIS WILL FAIL:
await modelStateService.loadModel('C:\\path\\to\\model.obj', ...);
// Error: Not allowed to load local resource
```

**✅ Use these methods instead:**
- File input (user selects file)
- ModelUpload GUI component (drag & drop)
- HTTP URLs (if models are hosted)

📖 **Why?** See `BROWSER_SECURITY_ISSUE.md`
🎨 **Solution:** See `COMPLETE_FILE_UPLOAD_SOLUTION.md`

---

## 📋 Common Tasks

### Upload Files (Toolbar Button - Recommended)

**Click the "Upload Models" button in the toolbar**, then:
1. Drag & drop your model files
2. Or click to browse for files
3. Models will automatically load into the viewport

See [TOOLBAR_MODEL_UPLOAD_GUIDE.md](./TOOLBAR_MODEL_UPLOAD_GUIDE.md) to add the button.

### Upload Local Files with GUI (Alternative) (✅ RECOMMENDED)
```typescript
import { ModelUpload } from '@ohif/extension-cornerstone';

function MyComponent({ viewportId }) {
  return (
    <ModelUpload
      viewportId={viewportId}
      onComplete={() => console.log('Done!')}
      defaultColor={[1, 0, 0]}
      defaultOpacity={0.8}
    />
  );
}
```

### Load from File Input (Manual)
```typescript
const input = document.createElement('input');
input.type = 'file';
input.accept = '.obj,.stl,.ply';
input.onchange = async (e) => {
  const file = e.target.files[0];
  await modelStateService.loadModelFromFileInput(file, {
    viewportId: 'viewport-1',
    color: [1, 0, 0],
  });
};
input.click();
```

### Load from URL
```typescript
await modelStateService.loadModel(
  'https://example.com/model.obj',
  { viewportId: 'viewport-1' }
);
```

### Get All Models
```typescript
const models = modelStateService.getAllModels();
console.log(`${models.length} models loaded`);
```

### Toggle Visibility
```typescript
const model = modelStateService.getModel(modelId);
modelStateService.setModelVisibility(modelId, !model.metadata.visible);
```

### Change Color (RGB 0-1 range)
```typescript
modelStateService.setModelColor(modelId, [1, 0, 0]); // Red
modelStateService.setModelColor(modelId, [0, 1, 0]); // Green
modelStateService.setModelColor(modelId, [0, 0, 1]); // Blue
```

### Change Opacity
```typescript
modelStateService.setModelOpacity(modelId, 0.5); // 50% transparent
```

### Remove Model
```typescript
modelStateService.removeModel(modelId); // Remove from all viewports
modelStateService.removeModelFromViewport(modelId, 'viewport-1'); // From specific viewport
```

### Clear All
```typescript
modelStateService.clearAllModels();
```

### Subscribe to Events
```typescript
const unsubscribe = modelStateService.subscribe(
  modelStateService.EVENTS.MODEL_ADDED,
  ({ metadata }) => console.log('Added:', metadata.name)
);
// Later: unsubscribe.unsubscribe();
```

## 🎨 Color Reference

```typescript
// Common colors (RGB values 0-1)
const colors = {
  red: [1, 0, 0],
  green: [0, 1, 0],
  blue: [0, 0, 1],
  yellow: [1, 1, 0],
  cyan: [0, 1, 1],
  magenta: [1, 0, 1],
  white: [1, 1, 1],
  black: [0, 0, 0],
  gray: [0.5, 0.5, 0.5],
  orange: [1, 0.5, 0],
  purple: [0.5, 0, 0.5],
  pink: [1, 0.75, 0.8],
  brown: [0.6, 0.4, 0.2],
  gold: [1, 0.84, 0],
  silver: [0.75, 0.75, 0.75],
};

modelStateService.setModelColor(modelId, colors.gold);
```

## 📊 Events Reference

```typescript
// All available events
modelStateService.EVENTS = {
  MODEL_ADDED: 'event::model_added',
  MODEL_REMOVED: 'event::model_removed',
  MODEL_UPDATED: 'event::model_updated',
  MODEL_VISIBILITY_CHANGED: 'event::model_visibility_changed',
  MODEL_LOADING_START: 'event::model_loading_start',
  MODEL_LOADING_COMPLETE: 'event::model_loading_complete',
  MODEL_LOADING_ERROR: 'event::model_loading_error',
  MODELS_CLEARED: 'event::models_cleared',
};
```

## 🗂️ File Format Support

| Format | Extension | Notes |
|--------|-----------|-------|
| OBJ | `.obj` | Supports materials (`.mtl`) |
| STL | `.stl` | Binary and ASCII |
| PLY | `.ply` | Polygon format |

## 🎯 React Hook Example

```typescript
import { useEffect, useState } from 'react';

function useModelLoader(servicesManager, viewportId) {
  const { modelStateService } = servicesManager.services;
  const [models, setModels] = useState([]);

  useEffect(() => {
    const unsubscribe = modelStateService.subscribe(
      modelStateService.EVENTS.MODEL_ADDED,
      () => setModels(modelStateService.getAllModels())
    );

    return () => unsubscribe.unsubscribe();
  }, [modelStateService]);

  const loadModel = async (file) => {
    return await modelStateService.loadModelFromFileInput(file, { viewportId });
  };

  return { models, loadModel, modelStateService };
}
```

## 🔧 Command Registration

```typescript
// In your commandsModule.ts
const commands = {
  // Load model
  loadModel: ({ modelUrl, viewportId, options }) => {
    const { modelStateService } = servicesManager.services;
    return modelStateService.loadModel(modelUrl, { viewportId, ...options });
  },

  // Remove model
  removeModel: ({ modelId }) => {
    const { modelStateService } = servicesManager.services;
    return modelStateService.removeModel(modelId);
  },

  // Toggle visibility
  toggleModelVisibility: ({ modelId }) => {
    const { modelStateService } = servicesManager.services;
    const model = modelStateService.getModel(modelId);
    if (model) {
      return modelStateService.setModelVisibility(
        modelId,
        !model.metadata.visible
      );
    }
  },

  // Change color
  setModelColor: ({ modelId, color }) => {
    const { modelStateService } = servicesManager.services;
    return modelStateService.setModelColor(modelId, color);
  },

  // Get all models
  getAllModels: () => {
    const { modelStateService } = servicesManager.services;
    return modelStateService.getAllModels();
  },

  // Clear all
  clearAllModels: () => {
    const { modelStateService } = servicesManager.services;
    return modelStateService.clearAllModels();
  },
};
```

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Model not visible | Check `visible: true` and viewport ID |
| Wrong color | Use RGB 0-1 range, not 0-255 |
| File won't load | Check file format (.obj, .stl, .ply) |
| CORS error | Load from same domain or configure CORS |
| Backend 404 | Start backend server on port 3001 |

## 📱 Backend Quick Start

```bash
# 1. Navigate to backend directory
cd extensions/cornerstone/src/utils

# 2. Install dependencies
npm install express cors

# 3. Run server
node backendExample.js

# Server runs on http://localhost:3001
```

## 🔑 Key Properties

```typescript
interface ModelLoadOptions {
  viewportId?: string;              // Required for rendering
  color?: [number, number, number]; // RGB 0-1
  opacity?: number;                 // 0-1
  visible?: boolean;                // true/false
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
}
```

## 💡 Pro Tips

1. **Always specify viewportId** for automatic rendering
2. **Use RGB values 0-1**, not 0-255
3. **Subscribe to events** for reactive UI updates
4. **Unsubscribe** when component unmounts
5. **Use async/await** for loading operations
6. **Cache model IDs** for later manipulation
7. **Set reasonable opacity** (0.7-0.9) for medical overlay
8. **Check model bounds** for proper scaling
9. **Handle loading errors** gracefully
10. **Clean up** with removeModel() when done

## 📚 Full Documentation

- **Complete API**: `MODEL_LOADER_README.md`
- **Architecture**: `MODEL_LOADER_ARCHITECTURE.md`
- **Implementation**: `IMPLEMENTATION_SUMMARY.md`
- **Examples**: `examples/modelLoaderExample.ts`

## 🎓 Learning Path

1. ✅ Read this quick reference
2. ✅ Try loading a simple OBJ file
3. ✅ Experiment with colors and opacity
4. ✅ Subscribe to events
5. ✅ Load multiple models
6. ✅ Build a UI component
7. ✅ Integrate with commands
8. ✅ Set up backend (if needed)
9. ✅ Read full documentation
10. ✅ Build your feature!

## 🔗 Quick Links

- [vtk.js Docs](https://kitware.github.io/vtk-js/)
- [Cornerstone3D](https://www.cornerstonejs.org/)
- [OHIF Viewer](https://docs.ohif.org/)

---

**Need Help?** Check the full documentation in `MODEL_LOADER_README.md`

**Version**: 1.0.0 | **Last Updated**: November 4, 2025
