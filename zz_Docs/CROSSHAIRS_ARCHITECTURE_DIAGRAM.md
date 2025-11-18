# Crosshairs Architecture - Visual Flow Diagrams

## 1. Component Interaction Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          OHIF Application Layer                          │
│                                                                          │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐            │
│  │  Toolbar UI    │  │  Viewport    │  │  Service Layer  │            │
│  │  Components    │  │  Components  │  │                 │            │
│  └────────┬───────┘  └──────┬───────┘  └────────┬────────┘            │
└───────────┼──────────────────┼──────────────────┼──────────────────────┘
            │                  │                  │
            │ Commands         │ View State       │ State Management
            ↓                  ↓                  ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      OHIF Services & Managers                            │
│                                                                          │
│  ┌─────────────────────┐  ┌────────────────────┐  ┌──────────────────┐│
│  │  CommandsManager    │  │  ToolGroupService  │  │  Viewport        ││
│  │                     │  │                    │  │  Service         ││
│  │  - setToolActive    │←→│  - getToolGroup    │←→│  - updateViewport││
│  │  - resetCrosshairs  │  │  - createToolGroup │  │  - getViewport   ││
│  └──────────┬──────────┘  └──────────┬─────────┘  └────────┬─────────┘│
└─────────────┼────────────────────────┼────────────────────┼───────────┘
              │                        │                    │
              │ Tool State Mgmt        │ Tool Operations    │ Viewport Ops
              ↓                        ↓                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                       Cornerstone3D Library                              │
│                                                                          │
│  ┌────────────────────┐  ┌───────────────────┐  ┌───────────────────┐ │
│  │  ToolGroupManager  │  │  CrosshairsTool   │  │  RenderingEngine  │ │
│  │                    │  │                   │  │                   │ │
│  │  - Tool Registry   │  │  - Tool Instance  │  │  - Viewports      │ │
│  │  - State Machine   │  │  - Annotations    │  │  - Rendering      │ │
│  │  - Event Dispatch  │  │  - Interactions   │  │  - Event Target   │ │
│  └──────────┬─────────┘  └─────────┬─────────┘  └─────────┬─────────┘ │
└─────────────┼────────────────────────┼──────────────────────┼───────────┘
              │                        │                      │
              │ Events                 │ Rendering            │ Canvas
              ↓                        ↓                      ↓
         ┌─────────────────────────────────────────────────────┐
         │          Browser (Canvas/SVG/Events)                 │
         └─────────────────────────────────────────────────────┘
```

---

## 2. Crosshairs Activation Flow

```
USER CLICKS CROSSHAIRS BUTTON
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│ Step 1: UI Button Click Handler                                │
│                                                                 │
│ File: modes/basic/src/toolbarButtons.ts                        │
│                                                                 │
│  {                                                              │
│    id: 'Crosshairs',                                           │
│    commands: {                                                 │
│      commandName: 'setToolActiveToolbar',                      │
│      commandOptions: { toolGroupIds: ['mpr'] }                 │
│    }                                                            │
│  }                                                              │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ Step 2: Command Execution                                      │
│                                                                 │
│ File: extensions/cornerstone/src/commandsModule.ts             │
│                                                                 │
│  commandsManager.runCommand('setToolActiveToolbar', {          │
│    toolName: 'Crosshairs',                                     │
│    toolGroupIds: ['mpr']                                       │
│  })                                                             │
│         │                                                       │
│         ↓                                                       │
│  setToolActiveToolbar() {                                      │
│    toolGroupIds.forEach(toolGroupId => {                       │
│      actions.setToolActive({                                   │
│        toolName: 'Crosshairs',                                 │
│        toolGroupId: 'mpr'                                      │
│      })                                                         │
│    })                                                           │
│  }                                                              │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ Step 3: Tool State Change                                      │
│                                                                 │
│ File: extensions/cornerstone/src/commandsModule.ts             │
│                                                                 │
│  setToolActive({ toolName, toolGroupId }) {                    │
│                                                                 │
│    const toolGroup = toolGroupService.getToolGroup('mpr')      │
│                                                                 │
│    // Get currently active tool                                │
│    const activeToolName =                                      │
│      toolGroup.getActivePrimaryMouseButtonTool()               │
│    // → Returns 'WindowLevel' (currently active)               │
│                                                                 │
│    // Deactivate WindowLevel                                   │
│    const activeToolConfig =                                    │
│      toolGroup.getToolConfiguration('WindowLevel')             │
│    // → { disableOnPassive: undefined }                        │
│                                                                 │
│    if (activeToolConfig?.disableOnPassive) {                   │
│      toolGroup.setToolDisabled('WindowLevel')                  │
│    } else {                                                     │
│      toolGroup.setToolPassive('WindowLevel') ✓                 │
│    }                                                            │
│                                                                 │
│    // Activate Crosshairs                                      │
│    toolGroup.setToolActive('Crosshairs', {                     │
│      bindings: [{ mouseButton: Primary }]                      │
│    })                                                           │
│  }                                                              │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ Step 4: Cornerstone3D Tool Activation                          │
│                                                                 │
│ Library: @cornerstonejs/tools                                  │
│                                                                 │
│  ToolGroup.setToolActive('Crosshairs') {                       │
│                                                                 │
│    // Update internal state                                    │
│    this._toolInstances['Crosshairs'].mode = 'Active'           │
│                                                                 │
│    // Get tool instance                                        │
│    const crosshairTool =                                       │
│      this._toolInstances['Crosshairs']                         │
│                                                                 │
│    // Call tool's activation lifecycle                         │
│    crosshairTool.onSetToolActive()                             │
│  }                                                              │
│         │                                                       │
│         ↓                                                       │
│  CrosshairsTool.onSetToolActive() {                            │
│    // Compute initial center point                             │
│    this.computeToolCenter()                                    │
│                                                                 │
│    // Create annotation objects                                │
│    this.createAnnotations()                                    │
│                                                                 │
│    // Register event listeners                                 │
│    this.addEventListeners()                                    │
│                                                                 │
│    // Trigger initial render                                   │
│    this.renderAnnotations()                                    │
│  }                                                              │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ Step 5: Rendering                                              │
│                                                                 │
│ Library: @cornerstonejs/core                                   │
│                                                                 │
│  RenderingEngine.render() {                                    │
│                                                                 │
│    // For each viewport (axial, sagittal, coronal)             │
│    viewportIds.forEach(viewportId => {                         │
│                                                                 │
│      const viewport = this.getViewport(viewportId)             │
│                                                                 │
│      // Render volume slice                                    │
│      viewport.renderVolume()                                   │
│                                                                 │
│      // Get SVG layer for annotations                          │
│      const svgLayer = viewport.getSvgLayer()                   │
│                                                                 │
│      // Render crosshair lines                                 │
│      crosshairTool.renderAnnotation(svgLayer, {                │
│        viewport,                                               │
│        viewportId                                              │
│      })                                                         │
│           │                                                     │
│           ↓                                                     │
│      // Call getReferenceLineColor callback                    │
│      const color = config.getReferenceLineColor(viewportId)    │
│           │                                                     │
│           ↓                                                     │
│      OHIF: cornerstoneViewportService.getViewportInfo()        │
│           │                                                     │
│           ↓                                                     │
│      Returns: 'rgb(200, 0, 0)' for axial view                  │
│      Returns: 'rgb(200, 200, 0)' for sagittal view             │
│      Returns: 'rgb(0, 200, 0)' for coronal view                │
│                                                                 │
│      // Draw colored reference lines                           │
│      svgLayer.drawLine(...)                                    │
│                                                                 │
│      // Draw viewport indicators (circles)                     │
│      svgLayer.drawCircle(...)                                  │
│    })                                                           │
│  }                                                              │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ Step 6: UI Update                                              │
│                                                                 │
│ RESULT: Crosshairs visible in all three MPR viewports          │
│         Button highlighted in toolbar                           │
│         Tool responds to mouse interactions                     │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. Bug #1 - Viewport Change (Without Fix)

```
USER DRAGS NEW SERIES INTO VIEWPORT
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│ ViewportGridService.setDisplaySetsForViewport()                │
└───────────────────────────────┬────────────────────────────────┘
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ CornerstoneViewportService.updateViewport()                    │
│                                                                 │
│  - Loads new volume data                                       │
│  - Updates viewport camera                                     │
│  - Calls viewport.render()                                     │
│  - Broadcasts VIEWPORT_DATA_CHANGED event                      │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ ❌ NO LISTENER FOR THIS EVENT                                  │
│                                                                 │
│ CrosshairsTool still uses old center point calculation!        │
│ Crosshairs appear at incorrect position                        │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Bug #1 - Viewport Change (With Fix)

```
USER DRAGS NEW SERIES INTO VIEWPORT
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│ ViewportGridService.setDisplaySetsForViewport()                │
└───────────────────────────────┬────────────────────────────────┘
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ CornerstoneViewportService.updateViewport()                    │
│                                                                 │
│  - Loads new volume data                                       │
│  - Updates viewport camera                                     │
│  - Calls viewport.render()                                     │
│  - Broadcasts VIEWPORT_DATA_CHANGED event ◄─────┐              │
└───────────────────────────────┬────────────────│──────────────┘
                                │                │
                                │                │
                                │                │ Listens
                                ↓                │
┌────────────────────────────────────────────────│──────────────┐
│ ✅ NEW EVENT LISTENER (Added in init.tsx)      │              │
│                                                 │              │
│  cornerstoneViewportService.subscribe(          │              │
│    VIEWPORT_DATA_CHANGED, ──────────────────────┘              │
│    ({ viewportId }) => {                                       │
│                                                                 │
│      const toolGroup =                                         │
│        toolGroupService.getToolGroupForViewport(viewportId)    │
│                                                                 │
│      const crosshairInstance =                                 │
│        toolGroup.getToolInstance('Crosshairs')                 │
│                                                                 │
│      if (crosshairInstance.mode === 'Active') {                │
│        commandsManager.runCommand('resetCrosshairs', {         │
│          viewportId                                            │
│        })                                                       │
│      }                                                          │
│    }                                                            │
│  )                                                              │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ resetCrosshairs Command                                        │
│                                                                 │
│  const crosshairInstance =                                     │
│    toolGroup.getToolInstance('Crosshairs')                     │
│                                                                 │
│  crosshairInstance.computeToolCenter()                         │
│    │                                                            │
│    ↓                                                            │
│  - Queries all viewports in tool group                         │
│  - Gets current image dimensions                               │
│  - Calculates new center point in world coordinates            │
│  - Updates internal state                                      │
│  - Triggers re-render                                          │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ ✅ RESULT: Crosshairs update to correct position!              │
└────────────────────────────────────────────────────────────────┘
```

---

## 5. Bug #2 - Toggle Off (Without Fix)

```
USER CLICKS CROSSHAIRS BUTTON AGAIN (Currently Active)
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│ setToolActiveToolbar('Crosshairs')                             │
└───────────────────────────────┬────────────────────────────────┘
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ setToolActive({ toolName: 'Crosshairs', toolGroupId: 'mpr' }) │
│                                                                 │
│  const activeToolName =                                        │
│    toolGroup.getActivePrimaryMouseButtonTool()                 │
│  // → Returns 'Crosshairs' (currently active)                  │
│                                                                 │
│  ❌ NO CHECK if activeToolName === toolName                    │
│                                                                 │
│  // BUG: Proceeds to deactivate and reactivate same tool       │
│                                                                 │
│  if (activeToolName) {  // True                                │
│    const activeToolOptions =                                   │
│      toolGroup.getToolConfiguration('Crosshairs')              │
│    // → { disableOnPassive: true }                             │
│                                                                 │
│    if (activeToolOptions?.disableOnPassive) {                  │
│      toolGroup.setToolDisabled('Crosshairs') ✓                 │
│    }                                                            │
│  }                                                              │
│                                                                 │
│  // Then immediately reactivates!                              │
│  toolGroup.setToolActive('Crosshairs', ...)  ❌                │
│                                                                 │
│  // Result: Tool stays active!                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 6. Bug #2 - Toggle Off (With Fix)

```
USER CLICKS CROSSHAIRS BUTTON AGAIN (Currently Active)
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│ setToolActiveToolbar('Crosshairs')                             │
└───────────────────────────────┬────────────────────────────────┘
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ ✅ FIXED setToolActive()                                       │
│                                                                 │
│  const activeToolName =                                        │
│    toolGroup.getActivePrimaryMouseButtonTool()                 │
│  // → Returns 'Crosshairs'                                     │
│                                                                 │
│  ✅ NEW CHECK: Toggle detection                                │
│  if (activeToolName === toolName) {  // TRUE!                  │
│                                                                 │
│    // Get the configuration of the tool being deactivated      │
│    const toolConfig =                                          │
│      toolGroup.getToolConfiguration('Crosshairs')              │
│    // → { disableOnPassive: true }                             │
│                                                                 │
│    if (toolConfig?.disableOnPassive) {                         │
│      toolGroup.setToolDisabled('Crosshairs') ✓                 │
│    } else {                                                     │
│      toolGroup.setToolPassive('Crosshairs')                    │
│    }                                                            │
│                                                                 │
│    // Restore previous tool                                    │
│    const prevToolName =                                        │
│      toolGroup.getPrevActivePrimaryToolName()                  │
│    // → Returns 'WindowLevel'                                  │
│                                                                 │
│    if (prevToolName && prevToolName !== toolName) {            │
│      toolGroup.setToolActive('WindowLevel', ...)  ✓            │
│    }                                                            │
│                                                                 │
│    renderingEngine.render() ✓                                  │
│                                                                 │
│    return; // Exit early ✓                                     │
│  }                                                              │
│                                                                 │
│  // Rest of function never executes in toggle case             │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ ✅ RESULT:                                                      │
│  - Crosshairs tool → DISABLED                                  │
│  - WindowLevel tool → ACTIVE                                   │
│  - Crosshairs disappear from viewport                          │
│  - Button no longer highlighted                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 7. Tool State Synchronization

```
┌───────────────────────────────────────────────────────────────┐
│               Tool State in Different Layers                   │
└───────────────────────────────────────────────────────────────┘

Layer 1: Cornerstone3D ToolGroup (Source of Truth)
┌─────────────────────────────────────────────────────────┐
│ ToolGroup 'mpr' {                                        │
│   _toolInstances: {                                      │
│     'WindowLevel': {                                     │
│       mode: 'Passive',  ← State stored here             │
│       bindings: [],                                      │
│       configuration: { ... }                             │
│     },                                                   │
│     'Crosshairs': {                                      │
│       mode: 'Active',  ← State stored here              │
│       bindings: [{ mouseButton: 1 }],                    │
│       configuration: {                                   │
│         disableOnPassive: true,                          │
│         getReferenceLineColor: fn,                       │
│         ...                                              │
│       }                                                  │
│     },                                                   │
│     'Pan': { mode: 'Passive', ... },                    │
│     'Zoom': { mode: 'Passive', ... }                    │
│   },                                                     │
│   _activePrimaryTool: 'Crosshairs',                     │
│   _prevActivePrimaryTool: 'WindowLevel'                 │
│ }                                                        │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Queried by
                   ↓
Layer 2: OHIF ToolGroupService (Proxy)
┌─────────────────────────────────────────────────────────┐
│ ToolGroupService {                                       │
│   getToolGroup(toolGroupId) {                            │
│     return ToolGroupManager.getToolGroup(toolGroupId)    │
│     // Returns reference to Cornerstone ToolGroup        │
│   }                                                       │
│                                                           │
│   getToolGroupForViewport(viewportId) {                  │
│     return ToolGroupManager.getToolGroupForViewport(...)  │
│   }                                                       │
│                                                           │
│   getActivePrimaryMouseButtonTool(toolGroupId) {         │
│     return toolGroup.getActivePrimaryMouseButtonTool()   │
│     // → 'Crosshairs'                                    │
│   }                                                       │
│ }                                                         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Used by
                   ↓
Layer 3: OHIF UI Evaluators (Reactive)
┌─────────────────────────────────────────────────────────┐
│ evaluate.cornerstoneTool() {                             │
│   const toolGroup =                                      │
│     toolGroupService.getToolGroupForViewport(viewportId) │
│                                                           │
│   const toolName =                                       │
│     toolbarService.getToolNameForButton(button)          │
│   // → 'Crosshairs'                                      │
│                                                           │
│   const isPrimaryActive =                                │
│     toolGroup.getActivePrimaryMouseButtonTool() ===      │
│     toolName                                             │
│   // → true                                              │
│                                                           │
│   return {                                               │
│     disabled: false,                                     │
│     isActive: isPrimaryActive  ← Drives UI state         │
│   }                                                       │
│ }                                                         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Updates
                   ↓
Layer 4: UI Button (Visual Representation)
┌─────────────────────────────────────────────────────────┐
│ <ToolButton                                              │
│   id="Crosshairs"                                        │
│   isActive={true}  ← From evaluator                      │
│   className="!text-black bg-primary-light" ← Highlighted│
│   onClick={...}                                          │
│ />                                                        │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Event Flow During Crosshairs Interaction

```
┌───────────────────────────────────────────────────────────────┐
│              Crosshairs Mouse Drag Interaction                 │
└───────────────────────────────────────────────────────────────┘

User drags crosshair handle
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│ Browser MouseEvent                                             │
│  - type: 'mousemove'                                           │
│  - target: <canvas>                                            │
│  - clientX, clientY                                            │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ Cornerstone3D Event Target                                     │
│                                                                 │
│  eventTarget.dispatchEvent(new CustomEvent(                    │
│    'MOUSE_DRAG',                                               │
│    {                                                            │
│      detail: {                                                 │
│        element,                                                │
│        currentPoints: { canvas, world },                       │
│        deltaPoints: { canvas, world }                          │
│      }                                                          │
│    }                                                            │
│  ))                                                             │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ CrosshairsTool Event Handler                                   │
│                                                                 │
│  onMouseDrag(evt) {                                            │
│    // Get annotation being dragged                             │
│    const annotation = this.getAnnotationAtPoint(...)           │
│                                                                 │
│    // Update annotation position                               │
│    annotation.data.handles.center = evt.detail.currentPoints   │
│                                                                 │
│    // Update other viewports                                   │
│    this.updateLinkedViewports()                                │
│      │                                                          │
│      ↓                                                          │
│    For each linked viewport:                                   │
│      - Calculate new slice index                               │
│      - Update viewport camera                                  │
│      - Trigger render                                          │
│  }                                                              │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ Cornerstone3D Rendering Pipeline                               │
│                                                                 │
│  For each viewport:                                            │
│    1. Clear canvas                                             │
│    2. Render volume at new slice position                      │
│    3. Render crosshair annotations                             │
│    4. Draw reference lines with updated position               │
│                                                                 │
│  Broadcasts: IMAGE_RENDERED event                              │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────┐
│ OHIF Viewport Overlays Update                                  │
│                                                                 │
│  useEffect(() => {                                             │
│    element.addEventListener(                                   │
│      Enums.Events.IMAGE_RENDERED,                              │
│      updateOverlay                                             │
│    )                                                            │
│  })                                                             │
│                                                                 │
│  Updates slice number, orientation labels, etc.                │
└────────────────────────────────────────────────────────────────┘
```

---

## 9. Data Flow for getReferenceLineColor

```
┌───────────────────────────────────────────────────────────────┐
│           Dynamic Color Assignment for Reference Lines         │
└───────────────────────────────────────────────────────────────┘

CrosshairsTool needs to render reference lines
         │
         ↓
┌────────────────────────────────────────────────────────────────┐
│ CrosshairsTool.renderAnnotation(viewport, annotation)          │
│                                                                 │
│  For each viewport in tool group:                              │
│    const color = this.configuration.getReferenceLineColor(     │
│      targetViewportId                                          │
│    )                                                            │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓ Callback into OHIF
┌────────────────────────────────────────────────────────────────┐
│ OHIF Configuration Callback                                    │
│ (Defined in initToolGroups.ts)                                 │
│                                                                 │
│  getReferenceLineColor: viewportId => {                        │
│    // Step 1: Get viewport metadata from OHIF service          │
│    const viewportInfo =                                        │
│      cornerstoneViewportService.getViewportInfo(viewportId)    │
│         │                                                       │
│         ↓                                                       │
│    Returns: {                                                  │
│      viewportOptions: {                                        │
│        id: 'viewport-0',                                       │
│        orientation: 'axial',                                   │
│        viewportType: 'volume',                                 │
│        ...                                                      │
│      },                                                         │
│      ...                                                        │
│    }                                                            │
│                                                                 │
│    // Step 2: Lookup color by viewport ID or orientation       │
│    const viewportOptions = viewportInfo?.viewportOptions       │
│                                                                 │
│    if (viewportOptions) {                                      │
│      return (                                                  │
│        colours[viewportOptions.id] ||  // Try ID first         │
│        colorsByOrientation[viewportOptions.orientation] || //  │
│        '#0c0'  // Fallback green                               │
│      )                                                          │
│    }                                                            │
│                                                                 │
│    return '#0c0'  // Default fallback                          │
│  }                                                              │
│                                                                 │
│  Color Mappings:                                               │
│  ┌─────────────────┬──────────────────┬─────────────┐         │
│  │ Viewport        │ Orientation      │ Color       │         │
│  ├─────────────────┼──────────────────┼─────────────┤         │
│  │ viewport-0      │ axial            │ Red         │         │
│  │ viewport-1      │ sagittal         │ Yellow      │         │
│  │ viewport-2      │ coronal          │ Green       │         │
│  └─────────────────┴──────────────────┴─────────────┘         │
└───────────────────────────────┬────────────────────────────────┘
                                │
                                ↓ Returns color string
┌────────────────────────────────────────────────────────────────┐
│ CrosshairsTool receives color                                  │
│                                                                 │
│  color = 'rgb(200, 0, 0)'  (for axial view)                    │
│                                                                 │
│  Draws reference line with this color on SVG layer             │
└────────────────────────────────────────────────────────────────┘
```

---

## 10. Complete Lifecycle Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   Crosshairs Complete Lifecycle                  │
└─────────────────────────────────────────────────────────────────┘

INITIALIZATION (Mode Entry)
    │
    ├─► initToolGroups() → Creates 'mpr' tool group
    │       └─► Adds Crosshairs tool in DISABLED state
    │
    ├─► elementEnabledHandler() → Viewports created
    │       └─► Tool group assigned to viewports
    │
    └─► Ready for user interaction


USER ACTIVATION
    │
    ├─► Click Crosshairs button
    │       ↓
    ├─► setToolActiveToolbar('Crosshairs')
    │       ↓
    ├─► Tool state: DISABLED → ACTIVE
    │       ↓
    ├─► CrosshairsTool.onSetToolActive()
    │       ├─► computeToolCenter()
    │       ├─► createAnnotations()
    │       └─► addEventListeners()
    │           ├─► MOUSE_MOVE
    │           ├─► MOUSE_DOWN
    │           ├─► MOUSE_DRAG
    │           └─► CAMERA_MODIFIED
    │
    └─► Rendering → Crosshairs visible


USER INTERACTION
    │
    ├─► Drag crosshair handle
    │       ↓
    │   MOUSE_DRAG event
    │       ↓
    │   Update annotation position
    │       ↓
    │   Update linked viewports
    │       ↓
    │   Render all viewports
    │
    ├─► Pan/Zoom viewport
    │       ↓
    │   CAMERA_MODIFIED event
    │       ↓
    │   CrosshairsTool updates reference lines
    │       ↓
    │   Render
    │
    └─► Rotate slab
            ↓
        Update crosshair orientation
            ↓
        Render


VIEWPORT CHANGES
    │
    ├─► Load new series
    │       ↓
    │   updateViewport()
    │       ↓
    │   Broadcast VIEWPORT_DATA_CHANGED
    │       ↓
    │   ✅ Event listener (Fix #1)
    │       ↓
    │   resetCrosshairs()
    │       ├─► computeToolCenter()
    │       └─► Render
    │
    ├─► Change hanging protocol
    │       ↓
    │   PROTOCOL_CHANGED event
    │       ↓
    │   resetCrosshairs()
    │       └─► Recalculate centers
    │
    └─► Camera reset
            ↓
        CAMERA_RESET event
            ↓
        resetCrosshairs()
            └─► Restore default position


USER DEACTIVATION
    │
    ├─► Click Crosshairs button again (Toggle)
    │       ↓
    │   ✅ Detect toggle (Fix #2)
    │       ↓
    │   Tool state: ACTIVE → DISABLED
    │       ↓
    │   CrosshairsTool.onSetToolDisabled()
    │       ├─► Remove annotations
    │       ├─► Remove event listeners
    │       └─► Clear SVG layer
    │           ↓
    │   Restore previous tool (WindowLevel)
    │       ↓
    │   Render → Crosshairs disappear
    │
    └─► Click another tool (e.g., Pan)
            ↓
        Deactivate Crosshairs
            ↓
        Tool state: ACTIVE → DISABLED
            ↓
        Activate Pan
            ↓
        Render → Crosshairs disappear


CLEANUP (Mode Exit)
    │
    ├─► Unsubscribe event listeners
    │       └─► ✅ VIEWPORT_DATA_CHANGED listener
    │
    ├─► Destroy tool groups
    │       └─► ToolGroupManager.destroyToolGroup('mpr')
    │
    └─► Clean up viewports
```

---

## Summary

These diagrams illustrate:

1. **Component Architecture**: How OHIF layers on top of Cornerstone3D
2. **Activation Flow**: Step-by-step tool activation process
3. **Bug Scenarios**: Before and after fixes for both bugs
4. **State Synchronization**: How tool state flows through layers
5. **Event Handling**: Mouse interaction and viewport event flow
6. **Data Callbacks**: How OHIF configuration integrates with Cornerstone
7. **Complete Lifecycle**: From initialization to cleanup

The key takeaways:
- **Bug #1**: Missing event listener connection
- **Bug #2**: Incorrect toggle logic and config check
- **Solution**: Add event listener + improve toggle detection

All fixes are localized to two files:
- `extensions/cornerstone/src/init.tsx` (Bug #1)
- `extensions/cornerstone/src/commandsModule.ts` (Bug #2)





