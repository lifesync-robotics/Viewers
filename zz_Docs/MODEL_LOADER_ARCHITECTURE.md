# 3D Model Loader Architecture

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     OHIF Viewer Application                     │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Services Manager                            │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Model State Service                          │ │
│  │  • Load Models (OBJ, STL, PLY)                           │ │
│  │  • Render in Viewports                                    │ │
│  │  • Manage Model State                                     │ │
│  │  • Event Broadcasting                                     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                               │                                  │
│      ┌────────────────────────┼────────────────────────┐        │
│      ▼                        ▼                        ▼        │
│  ┌────────┐            ┌───────────┐          ┌─────────────┐  │
│  │Viewport│            │ToolGroup  │          │Segmentation │  │
│  │Service │            │  Service  │          │   Service   │  │
│  └────────┘            └───────────┘          └─────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  vtk.js      │      │Cornerstone3D │      │  File API    │
│              │      │              │      │              │
│ • OBJReader  │      │ • Rendering  │      │ • Load Files │
│ • STLReader  │      │   Engine     │      │ • File Input │
│ • PLYReader  │      │ • Viewports  │      │              │
│ • Mapper     │      │ • Actors     │      │              │
│ • Actor      │      │              │      │              │
└──────────────┘      └──────────────┘      └──────────────┘
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               ▼
                    ┌──────────────────────┐
                    │   3D Viewport        │
                    │   (WebGL Rendering)  │
                    └──────────────────────┘
```

## 🔄 Data Flow

### Loading a Model

```
User Action
    │
    ▼
┌─────────────────────┐
│ Load Model Request  │
│ (URL or File)       │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ ModelStateService   │
│ .loadModel()        │
└─────────────────────┘
    │
    ├──────────────────────┐
    ▼                      ▼
┌──────────────┐    ┌──────────────┐
│ From URL     │    │ From File    │
│ fetch()      │    │ FileReader   │
└──────────────┘    └──────────────┘
    │                      │
    └──────────────────────┘
               ▼
    ┌──────────────────────┐
    │ Parse Model Data     │
    │ (OBJ/STL/PLY)        │
    └──────────────────────┘
               ▼
    ┌──────────────────────┐
    │ Create vtk Objects   │
    │ • Reader             │
    │ • Mapper             │
    │ • Actor              │
    └──────────────────────┘
               ▼
    ┌──────────────────────┐
    │ Apply Properties     │
    │ • Color              │
    │ • Opacity            │
    │ • Position/Scale     │
    └──────────────────────┘
               ▼
    ┌──────────────────────┐
    │ Add to Viewport      │
    │ (Cornerstone3D)      │
    └──────────────────────┘
               ▼
    ┌──────────────────────┐
    │ Broadcast Events     │
    │ • MODEL_ADDED        │
    │ • LOADING_COMPLETE   │
    └──────────────────────┘
               ▼
    ┌──────────────────────┐
    │ Render in 3D View    │
    │ (WebGL)              │
    └──────────────────────┘
```

## 📦 Component Structure

### ModelStateService Class

```typescript
ModelStateService
├── Properties
│   ├── servicesManager
│   ├── loadedModels: Map<string, LoadedModel>
│   ├── modelDirectory: string
│   └── EVENTS: Object
│
├── Loading Methods
│   ├── loadModel()
│   ├── loadModelFromFileInput()
│   ├── _loadFromUrl()
│   ├── _loadFromFile()
│   └── _createModelFromText()
│
├── Management Methods
│   ├── getAllModels()
│   ├── getModel()
│   ├── getModelsByViewport()
│   ├── removeModel()
│   ├── removeModelFromViewport()
│   └── clearAllModels()
│
├── Property Methods
│   ├── setModelVisibility()
│   ├── setModelColor()
│   └── setModelOpacity()
│
├── File Operations
│   ├── deleteModelFile()
│   ├── setModelDirectory()
│   └── getModelDirectory()
│
└── Event System (PubSub)
    ├── subscribe()
    └── _broadcastEvent()
```

## 🎭 Event Flow

```
┌──────────────────────────────────────────────────┐
│              Event System Flow                    │
└──────────────────────────────────────────────────┘

User Action
    │
    ▼
Service Method Called
    │
    ▼
┌─────────────────────┐
│ _broadcastEvent()   │
└─────────────────────┘
    │
    ├─────────────────────────────────┐
    ▼                                 ▼
┌──────────────────┐      ┌──────────────────┐
│ CustomEvent      │      │ Listener         │
│ (DOM)            │      │ Callbacks        │
└──────────────────┘      └──────────────────┘
    │                                 │
    ▼                                 ▼
Subscribers Notified        React Components Update
```

## 🗂️ State Management

```
┌─────────────────────────────────────────────────┐
│        loadedModels: Map<string, LoadedModel>   │
├─────────────────────────────────────────────────┤
│                                                 │
│  model_123456 → {                               │
│    metadata: {                                  │
│      id: "model_123456",                        │
│      name: "screw.obj",                         │
│      format: "obj",                             │
│      filePath: "path/to/screw.obj",            │
│      viewportId: "viewport-1",                  │
│      visible: true,                             │
│      color: [0.8, 0.2, 0.2],                   │
│      opacity: 1.0                               │
│    },                                           │
│    actor: vtkActor,                             │
│    mapper: vtkMapper,                           │
│    reader: vtkOBJReader,                        │
│    polyData: vtkPolyData                        │
│  }                                              │
│                                                 │
│  model_789012 → { ... }                         │
│                                                 │
└─────────────────────────────────────────────────┘
```

## 🔌 Integration Points

### 1. Service Registration

```typescript
// extensions/cornerstone/src/index.tsx
preRegistration() {
  servicesManager.registerService(ModelStateService.REGISTRATION);
}
```

### 2. Service Access

```typescript
// In any component or command
const { modelStateService } = servicesManager.services;
```

### 3. Command Integration

```typescript
// commandsModule.ts
{
  loadModel: ({ modelUrl, viewportId }) => {
    return servicesManager.services.modelStateService
      .loadModel(modelUrl, { viewportId });
  }
}
```

### 4. React Component Integration

```typescript
function Component({ servicesManager }) {
  const { modelStateService } = servicesManager.services;

  useEffect(() => {
    const unsubscribe = modelStateService.subscribe(
      modelStateService.EVENTS.MODEL_ADDED,
      handleModelAdded
    );

    return () => unsubscribe.unsubscribe();
  }, []);
}
```

## 🌐 Network Architecture (with Backend)

```
┌──────────────────┐
│   Frontend       │
│   (Browser)      │
│                  │
│  Model State     │
│  Service         │
└────────┬─────────┘
         │
         │ HTTP/HTTPS
         │
         ▼
┌──────────────────┐
│   Backend API    │
│   (Node.js)      │
│                  │
│  Express Server  │
│  Port: 3001      │
└────────┬─────────┘
         │
         │ File System
         │
         ▼
┌──────────────────┐
│   File System    │
│                  │
│  Model Files     │
│  • .obj          │
│  • .stl          │
│  • .ply          │
└──────────────────┘
```

## 📊 Sequence Diagram: Complete Workflow

```
User          UI          ModelStateService    vtk.js     Cornerstone3D    Backend
 │             │                  │               │              │            │
 │  Click      │                  │               │              │            │
 │  Load Model │                  │               │              │            │
 ├────────────>│                  │               │              │            │
 │             │  loadModel()     │               │              │            │
 │             ├─────────────────>│               │              │            │
 │             │                  │  fetch()      │              │            │
 │             │                  ├──────────────────────────────────────────>│
 │             │                  │               │              │  file data │
 │             │                  │<──────────────────────────────────────────┤
 │             │                  │               │              │            │
 │             │                  │  parse()      │              │            │
 │             │                  ├──────────────>│              │            │
 │             │                  │  polyData     │              │            │
 │             │                  │<──────────────┤              │            │
 │             │                  │               │              │            │
 │             │                  │  create actor │              │            │
 │             │                  ├──────────────>│              │            │
 │             │                  │  actor        │              │            │
 │             │                  │<──────────────┤              │            │
 │             │                  │               │              │            │
 │             │                  │  addActor()   │              │            │
 │             │                  ├─────────────────────────────>│            │
 │             │                  │               │  render()    │            │
 │             │                  │               │<─────────────┤            │
 │             │                  │               │              │            │
 │             │  MODEL_ADDED     │               │              │            │
 │             │<─────────────────┤               │              │            │
 │             │                  │               │              │            │
 │  See Model  │                  │               │              │            │
 │<────────────┤                  │               │              │            │
 │             │                  │               │              │            │
```

## 🧩 Module Dependencies

```
ModelStateService
    │
    ├── @ohif/core
    │   └── PubSubService (base class)
    │
    ├── @cornerstonejs/core
    │   └── getRenderingEngine
    │
    └── @kitware/vtk.js
        ├── vtkActor
        ├── vtkMapper
        ├── vtkOBJReader
        ├── vtkSTLReader
        └── vtkPLYReader
```

## 🎯 Use Cases

### Use Case 1: Load Surgical Implant Model
```
Actor: Surgeon
Goal: View 3D screw model in CT scan
Flow:
1. Open OHIF Viewer
2. Load CT scan
3. Click "Load 3D Model"
4. Select screw.obj file
5. Model rendered in 3D viewport
6. Adjust color/opacity for better visualization
```

### Use Case 2: Multiple Models Visualization
```
Actor: Medical Planner
Goal: View multiple implant options
Flow:
1. Load patient scan
2. Load implant option 1 (red)
3. Load implant option 2 (blue)
4. Load implant option 3 (green)
5. Toggle visibility to compare
6. Select best option
```

### Use Case 3: Model Management
```
Actor: Developer
Goal: Programmatically manage models
Flow:
1. Subscribe to model events
2. Load models from API
3. Listen for MODEL_ADDED events
4. Update UI with model list
5. Allow user to toggle/remove models
6. Clean up on component unmount
```

## 🔐 Security Architecture

```
┌──────────────────────────────────────────┐
│            Security Layers                │
├──────────────────────────────────────────┤
│                                          │
│  Frontend Validation                     │
│  • File type checking (.obj, .stl, .ply) │
│  • File size limits                      │
│  • Input sanitization                    │
│                                          │
├──────────────────────────────────────────┤
│                                          │
│  Backend Validation                      │
│  • Path normalization                    │
│  • Directory traversal prevention        │
│  • Extension whitelist                   │
│  • Authentication/Authorization          │
│                                          │
├──────────────────────────────────────────┤
│                                          │
│  File System Protection                  │
│  • Restricted access paths               │
│  • Permission checks                     │
│  • Logging and monitoring                │
│                                          │
└──────────────────────────────────────────┘
```

## 📈 Performance Considerations

```
┌────────────────────────────────────┐
│     Performance Optimizations      │
├────────────────────────────────────┤
│                                    │
│  Model Loading                     │
│  • Async/await pattern             │
│  • Non-blocking file reading       │
│  • Progressive loading support     │
│                                    │
│  Rendering                         │
│  • vtk.js GPU acceleration         │
│  • Efficient actor management      │
│  • Viewport-specific rendering     │
│                                    │
│  Memory Management                 │
│  • Model caching in Map            │
│  • Proper cleanup on removal       │
│  • vtk object deletion             │
│                                    │
│  Event System                      │
│  • PubSub pattern                  │
│  • Selective subscriptions         │
│  • Unsubscribe cleanup             │
│                                    │
└────────────────────────────────────┘
```

## 🧪 Testing Strategy

```
Unit Tests
  ├── ModelStateService initialization
  ├── Model loading from URL
  ├── Model loading from File
  ├── Color/opacity changes
  ├── Visibility toggling
  ├── Model removal
  └── Event broadcasting

Integration Tests
  ├── Service registration
  ├── Viewport integration
  ├── Multiple model handling
  ├── Event subscriptions
  └── Backend API calls

End-to-End Tests
  ├── Complete workflow
  ├── User interactions
  ├── File upload
  ├── Visual rendering
  └── Error handling
```

## 🚀 Deployment Checklist

- [ ] Service registered in extension
- [ ] Types updated
- [ ] Documentation complete
- [ ] Examples provided
- [ ] Backend API implemented (if needed)
- [ ] Security measures in place
- [ ] Performance optimized
- [ ] Error handling comprehensive
- [ ] Logging implemented
- [ ] Tests written
- [ ] Code reviewed
- [ ] Linting passed

## 📚 Further Reading

- **vtk.js Architecture**: https://kitware.github.io/vtk-js/docs/
- **Cornerstone3D Design**: https://www.cornerstonejs.org/docs/concepts/
- **OHIF Architecture**: https://docs.ohif.org/architecture/

---

**Document Version**: 1.0.0
**Last Updated**: November 4, 2025
**Maintained by**: OHIF Development Team
