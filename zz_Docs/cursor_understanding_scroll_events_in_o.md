# Understanding scroll events in OHIF viewport
_Exported on 10/31/2025 at 14:06:20 GMT+8 from Cursor (2.0.43)_

---

**User**

read through all the source code relating to cornerstone 3d and stack viewport in OHIF. explain and draw a diagrom to show how scroll leads to viewport update / event

---

**Cursor**

I'll help you understand how scroll events lead to viewport updates in OHIF with Cornerstone 3D. Let me read through the relevant source code files.

Let me search for more specific information about scroll event handling and stack viewport updates.

Now I have a comprehensive understanding of the scroll-to-viewport-update flow in OHIF with Cornerstone 3D. Let me create a detailed explanation with a diagram.

## **How Scroll Leads to Viewport Update in OHIF with Cornerstone 3D**

Based on the source code analysis, here's a comprehensive explanation of the event flow:

### **Architecture Overview**

```mermaid
graph TB
    subgraph "User Interaction Layer"
        A[User Scrolls Mouse Wheel]
    end
    
    subgraph "Tool Binding Layer"
        B[StackScroll Tool<br/>Bound to MouseBindings.Wheel]
    end
    
    subgraph "Cornerstone 3D Core"
        C[StackScroll Tool Handler]
        D[viewport.scroll<wbr/>]
        E[Update Image Index]
        F[Load New Image]
        G[Render Image]
    end
    
    subgraph "Event System"
        H[STACK_VIEWPORT_SCROLL Event]
        I[STACK_NEW_IMAGE Event]
        J[IMAGE_RENDERED Event]
        K[CAMERA_MODIFIED Event]
    end
    
    subgraph "OHIF Listeners & Updates"
        L[ViewportImageScrollbar<br/>Updates slice indicator]
        M[ViewportLoadingIndicator<br/>Shows loading state]
        N[CustomizableViewportOverlay<br/>Updates metadata display]
        O[ViewportOrientationMarkers<br/>Updates orientation]
        P[CornerstoneViewportService<br/>Manages viewport state]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    
    E --> H
    F --> I
    G --> J
    G --> K
    
    H --> M
    I --> L
    I --> M
    J --> L
    J --> N
    K --> N
    K --> O
    
    style A fill:#ff9999
    style B fill:#ffcc99
    style C fill:#99ccff
    style D fill:#99ccff
    style H fill:#99ff99
    style I fill:#99ff99
    style J fill:#99ff99
    style L fill:#ffff99
    style M fill:#ffff99
    style N fill:#ffff99
```

### **Detailed Event Flow**

#### **1. Tool Binding Configuration**

```typescript:36:37:modes/basic/src/initToolGroups.ts
        toolName: toolNames.StackScroll,
        bindings: [{ mouseButton: Enums.MouseBindings.Wheel }, { numTouchPoints: 3 }],
```

The StackScroll tool is configured as an **active tool** bound to the mouse wheel.

#### **2. Scroll Command Execution**

```typescript:1158:1171:extensions/cornerstone/src/commandsModule.ts
    scroll: (options: ToolTypes.ScrollOptions) => {
      const enabledElement = _getActiveViewportEnabledElement();
      // Allow either or direction for consistency in scroll implementation
      options.delta ??= options.direction || 1;
      options.direction ??= options.delta;

      if (!enabledElement) {
        return;
      }

      const { viewport } = enabledElement;

      csUtils.scroll(viewport, options);
    },
```

The scroll command calls Cornerstone 3D's utility `scroll()` function.

#### **3. Event Cascade**

When scrolling occurs in a **Stack Viewport**, the following events are triggered:

| Event | When Triggered | Purpose |
|-------|---------------|---------|
| `STACK_VIEWPORT_SCROLL` | Immediately when scroll starts | Signals scroll has begun |
| `STACK_NEW_IMAGE` | When new image loads | Indicates image change complete |
| `IMAGE_RENDERED` | After rendering completes | Signals viewport is ready |
| `CAMERA_MODIFIED` | Camera position changes | Updates camera-dependent overlays |

#### **4. Event Listeners & Updates**

**A. ViewportImageScrollbar** - Updates the slice position indicator:

```typescript:60:89:extensions/cornerstone/src/Viewport/Overlays/ViewportImageScrollbar.tsx
  useEffect(() => {
    if (!viewportData) {
      return;
    }
    const { viewportType } = viewportData;
    const eventId =
      (viewportType === Enums.ViewportType.STACK && Enums.Events.STACK_NEW_IMAGE) ||
      (viewportType === Enums.ViewportType.ORTHOGRAPHIC && Enums.Events.VOLUME_NEW_IMAGE) ||
      Enums.Events.IMAGE_RENDERED;

    const updateIndex = event => {
      const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);
      if (!viewport || viewport instanceof VolumeViewport3D) {
        return;
      }
      const { imageIndex, newImageIdIndex = imageIndex, imageIdIndex } = event.detail;
      const numberOfSlices = viewport.getNumberOfSlices();
      // find the index of imageId in the imageIds
      setImageSliceData({
        imageIndex: newImageIdIndex ?? imageIdIndex,
        numberOfSlices,
      });
    };

    element.addEventListener(eventId, updateIndex);

    return () => {
      element.removeEventListener(eventId, updateIndex);
    };
  }, [viewportData, element]);
```

**B. ViewportImageSliceLoadingIndicator** - Shows loading state:

```typescript:36:46:extensions/cornerstone/src/Viewport/Overlays/ViewportImageSliceLoadingIndicator.tsx
    element.addEventListener(Enums.Events.STACK_VIEWPORT_SCROLL, setLoadingState);
    element.addEventListener(Enums.Events.IMAGE_LOAD_ERROR, setErrorState);
    element.addEventListener(Enums.Events.STACK_NEW_IMAGE, setFinishLoadingState);

    return () => {
      element.removeEventListener(Enums.Events.STACK_VIEWPORT_SCROLL, setLoadingState);

      element.removeEventListener(Enums.Events.STACK_NEW_IMAGE, setFinishLoadingState);

      element.removeEventListener(Enums.Events.IMAGE_LOAD_ERROR, setErrorState);
    };
```

**C. Stack Viewport Setup** - Enables prefetching:

```typescript:736:744:extensions/cornerstone/src/services/ViewportService/CornerstoneViewportService.ts
    viewport.element.addEventListener(csEnums.Events.VIEWPORT_NEW_IMAGE_SET, evt => {
      const { element } = evt.detail;

      if (element !== viewport.element) {
        return;
      }

      csToolsUtils.stackContextPrefetch.enable(element);
    });
```

### **Complete Flow Diagram**

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCROLL EVENT FLOW                             │
└─────────────────────────────────────────────────────────────────┘

1. USER INTERACTION
   └─> Mouse Wheel Scroll ⚙️

2. TOOL LAYER (initToolGroups.ts)
   └─> StackScroll Tool (active, bound to Wheel)
       └─> Captures mouse wheel event

3. CORNERSTONE 3D TOOL HANDLER
   └─> StackScrollTool.mouseDragCallback()
       └─> Calculates delta direction
       └─> Calls csUtils.scroll(viewport, options)

4. VIEWPORT CORE (Cornerstone3D Stack Viewport)
   ├─> Calculate new image index
   ├─> Request image load (if not cached)
   ├─> Update viewport camera
   └─> Render new image

5. EVENT EMISSION (EventTarget)
   ├─> STACK_VIEWPORT_SCROLL ━━┓
   ├─> STACK_NEW_IMAGE ━━━━━━━┫
   ├─> IMAGE_RENDERED ━━━━━━━┫
   └─> CAMERA_MODIFIED ━━━━━━┫
                              ┃
6. OHIF LISTENERS ◄━━━━━━━━━━┛
   ├─> ViewportImageScrollbar
   │   └─> Updates slice indicator (e.g., "5/100")
   │
   ├─> ViewportImageSliceLoadingIndicator
   │   └─> Shows/hides loading spinner
   │
   ├─> CustomizableViewportOverlay
   │   └─> Updates metadata (patient info, series info)
   │
   ├─> ViewportOrientationMarkers
   │   └─> Updates orientation markers (if needed)
   │
   └─> CornerstoneViewportService
       └─> Manages viewport state tracking

7. VISUAL UPDATE
   └─> User sees new image rendered in viewport ✨
```

### **Key Event Details**

#### **STACK_VIEWPORT_SCROLL**
- **Triggered**: Immediately when scroll begins
- **Purpose**: Signal that scrolling has started
- **Used by**: Loading indicator (shows spinner immediately)

#### **STACK_NEW_IMAGE**
- **Triggered**: When new image is loaded and ready
- **Purpose**: Indicates image data is available
- **Used by**: Scrollbar (updates slice number), Loading indicator (hides spinner)
- **Event Detail**:
  ```typescript
  {
    imageIndex: number,      // Current image index
    imageIdIndex: number,    // Alternative index field
    imageId: string          // The image ID loaded
  }
  ```

#### **IMAGE_RENDERED**
- **Triggered**: After viewport rendering completes
- **Purpose**: Signals viewport is fully updated
- **Used by**: Overlays, timing metrics
- **Event Detail**:
  ```typescript
  {
    element: HTMLDivElement,    // The viewport element
    viewport: IStackViewport,   // The viewport instance
    renderTimeInMs: number      // Render performance metric
  }
  ```

#### **CAMERA_MODIFIED**
- **Triggered**: When camera properties change
- **Purpose**: Update camera-dependent displays
- **Used by**: Orientation markers, scale overlays, crosshairs

### **Stack vs Volume Viewport Differences**

| Aspect | Stack Viewport | Volume Viewport |
|--------|---------------|-----------------|
| Scroll Event | `STACK_VIEWPORT_SCROLL` | Volume scroll handled differently |
| Image Change Event | `STACK_NEW_IMAGE` | `VOLUME_NEW_IMAGE` |
| Data Structure | Array of 2D images | 3D volume data |
| Scrolling | Changes imageIndex | Changes slice through volume |

### **Performance Optimizations**

1. **Stack Context Prefetching**: Automatically prefetches adjacent slices
2. **Image Load Pool**: Prioritizes visible images over background loading
3. **Event Debouncing**: CAMERA_MODIFIED is debounced (100ms) to avoid excessive updates
4. **Lazy Loading**: Images load on-demand as user scrolls

### **Summary**

The scroll-to-viewport-update flow in OHIF follows a clean event-driven architecture:

1. **User scrolls** → Tool captures input
2. **Tool handler** → Calculates delta and calls Cornerstone 3D
3. **Cornerstone 3D** → Updates image index, loads image, renders
4. **Events emitted** → Multiple events signal different stages
5. **OHIF listeners** → Update UI components (scrollbar, overlays, indicators)
6. **Visual feedback** → User sees updated viewport

This architecture allows for:
- **Decoupled components**: Each overlay component independently listens to events
- **Extensibility**: New listeners can be added without modifying core code
- **Performance**: Events are emitted only when necessary
- **Debugging**: Event flow can be traced through console logs

The key insight is that **Cornerstone 3D handles the core rendering**, while **OHIF adds UI/UX layers** through event listeners that react to viewport changes.

```plaintext
graph TB
    subgraph "User Interaction Layer"
        A[User Scrolls Mouse Wheel]
    end
    
    subgraph "Tool Binding Layer"
        B[StackScroll Tool<br/>Bound to MouseBindings.Wheel]
    end
    
    subgraph "Cornerstone 3D Core"
        C[StackScroll Tool Handler]
        D[viewport.scroll<wbr/>]
        E[Update Image Index]
        F[Load New Image]
        G[Render Image]
    end
    
    subgraph "Event System"
        H[STACK_VIEWPORT_SCROLL Event]
        I[STACK_NEW_IMAGE Event]
        J[IMAGE_RENDERED Event]
        K[CAMERA_MODIFIED Event]
    end
    
    subgraph "OHIF Listeners & Updates"
        L[ViewportImageScrollbar<br/>Updates slice indicator]
        M[ViewportLoadingIndicator<br/>Shows loading state]
        N[CustomizableViewportOverlay<br/>Updates metadata display]
        O[ViewportOrientationMarkers<br/>Updates orientation]
        P[CornerstoneViewportService<br/>Manages viewport state]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    
    E --> H
    F --> I
    G --> J
    G --> K
    
    H --> M
    I --> L
    I --> M
    J --> L
    J --> N
    K --> N
    K --> O
    
    style A fill:#ff9999
    style B fill:#ffcc99
    style C fill:#99ccff
    style D fill:#99ccff
    style H fill:#99ff99
    style I fill:#99ff99
    style J fill:#99ff99
    style L fill:#ffff99
    style M fill:#ffff99
    style N fill:#ffff99
```

```plaintext
        toolName: toolNames.StackScroll,
        bindings: [{ mouseButton: Enums.MouseBindings.Wheel }, { numTouchPoints: 3 }],
```

```plaintext
    scroll: (options: ToolTypes.ScrollOptions) => {
      const enabledElement = _getActiveViewportEnabledElement();
      // Allow either or direction for consistency in scroll implementation
      options.delta ??= options.direction || 1;
      options.direction ??= options.delta;

      if (!enabledElement) {
        return;
      }

      const { viewport } = enabledElement;

      csUtils.scroll(viewport, options);
    },
```

```plaintext
  useEffect(() => {
    if (!viewportData) {
      return;
    }
    const { viewportType } = viewportData;
    const eventId =
      (viewportType === Enums.ViewportType.STACK && Enums.Events.STACK_NEW_IMAGE) ||
      (viewportType === Enums.ViewportType.ORTHOGRAPHIC && Enums.Events.VOLUME_NEW_IMAGE) ||
      Enums.Events.IMAGE_RENDERED;

    const updateIndex = event => {
      const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);
      if (!viewport || viewport instanceof VolumeViewport3D) {
        return;
      }
      const { imageIndex, newImageIdIndex = imageIndex, imageIdIndex } = event.detail;
      const numberOfSlices = viewport.getNumberOfSlices();
      // find the index of imageId in the imageIds
      setImageSliceData({
        imageIndex: newImageIdIndex ?? imageIdIndex,
        numberOfSlices,
      });
    };

    element.addEventListener(eventId, updateIndex);

    return () => {
      element.removeEventListener(eventId, updateIndex);
    };
  }, [viewportData, element]);
```

```plaintext
    element.addEventListener(Enums.Events.STACK_VIEWPORT_SCROLL, setLoadingState);
    element.addEventListener(Enums.Events.IMAGE_LOAD_ERROR, setErrorState);
    element.addEventListener(Enums.Events.STACK_NEW_IMAGE, setFinishLoadingState);

    return () => {
      element.removeEventListener(Enums.Events.STACK_VIEWPORT_SCROLL, setLoadingState);

      element.removeEventListener(Enums.Events.STACK_NEW_IMAGE, setFinishLoadingState);

      element.removeEventListener(Enums.Events.IMAGE_LOAD_ERROR, setErrorState);
    };
```

```plaintext
    viewport.element.addEventListener(csEnums.Events.VIEWPORT_NEW_IMAGE_SET, evt => {
      const { element } = evt.detail;

      if (element !== viewport.element) {
        return;
      }

      csToolsUtils.stackContextPrefetch.enable(element);
    });
```

```plaintext
┌─────────────────────────────────────────────────────────────────┐
│                    SCROLL EVENT FLOW                             │
└─────────────────────────────────────────────────────────────────┘

1. USER INTERACTION
   └─> Mouse Wheel Scroll ⚙️

2. TOOL LAYER (initToolGroups.ts)
   └─> StackScroll Tool (active, bound to Wheel)
       └─> Captures mouse wheel event

3. CORNERSTONE 3D TOOL HANDLER
   └─> StackScrollTool.mouseDragCallback()
       └─> Calculates delta direction
       └─> Calls csUtils.scroll(viewport, options)

4. VIEWPORT CORE (Cornerstone3D Stack Viewport)
   ├─> Calculate new image index
   ├─> Request image load (if not cached)
   ├─> Update viewport camera
   └─> Render new image

5. EVENT EMISSION (EventTarget)
   ├─> STACK_VIEWPORT_SCROLL ━━┓
   ├─> STACK_NEW_IMAGE ━━━━━━━┫
   ├─> IMAGE_RENDERED ━━━━━━━┫
   └─> CAMERA_MODIFIED ━━━━━━┫
                              ┃
6. OHIF LISTENERS ◄━━━━━━━━━━┛
   ├─> ViewportImageScrollbar
   │   └─> Updates slice indicator (e.g., "5/100")
   │
   ├─> ViewportImageSliceLoadingIndicator
   │   └─> Shows/hides loading spinner
   │
   ├─> CustomizableViewportOverlay
   │   └─> Updates metadata (patient info, series info)
   │
   ├─> ViewportOrientationMarkers
   │   └─> Updates orientation markers (if needed)
   │
   └─> CornerstoneViewportService
       └─> Manages viewport state tracking

7. VISUAL UPDATE
   └─> User sees new image rendered in viewport ✨
```

```typescript
  {
    imageIndex: number,      // Current image index
    imageIdIndex: number,    // Alternative index field
    imageId: string          // The image ID loaded
  }
```

```typescript
  {
    element: HTMLDivElement,    // The viewport element
    viewport: IStackViewport,   // The viewport instance
    renderTimeInMs: number      // Render performance metric
  }
```

