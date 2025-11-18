# Add function to get crosshairs tool center
_Exported on 11/4/2025 at 17:02:19 GMT+8 from Cursor (2.0.43)_

---

**User**

in viewportstateservice.ts, add an analogus function to get teh camera focal point, but this time the function should obtain the cross hairs toolcenter. 1) check if cross hair tool is available 2) obtain center by command

---

**Cursor**

I'll help you add a function to get the crosshairs tool center in the viewport state service. Let me first examine the current file to understand the structure and existing camera focal point function.

Now let me search for how to check if the crosshairs tool is available and how to get its center:

Let me search for the commandsModule to see how crosshairs commands are implemented:

Let me search for crosshairs-related commands in the file:

Let me search for methods to get the crosshairs tool center:

Now let me check how to get annotations from the tool:

Perfect! Now I have enough information to create the function. Let me add a function to get the crosshairs tool center in the `viewportStateService.ts` file:

```typescript
import { getRenderingEngine } from '@cornerstonejs/core';

interface ViewportState {
  frameOfReferenceUID: string;
  camera: any;
  viewReference: any;
  viewPresentation: any;
  metadata: {
    viewportId: string;
    viewportType: string;
    renderingEngineId: string;
    zoom: number;
    pan: number[];
  };
}

interface Snapshot {
  name: string;
  timestamp: string;
  viewports: ViewportState[];
}

class ViewportStateService {
  public static REGISTRATION = {
    name: 'viewportStateService',
    create: () => new ViewportStateService(),
  };

  private snapshots: Map<string, Snapshot>;
  private readonly MAX_SNAPSHOTS = 10;
  private readonly STORAGE_KEY = 'ohif_viewport_snapshots';
  private cameraLoggingEnabled: boolean = false;
  private cameraEventListeners: Map<string, any> = new Map();

  constructor() {
    // Clear all existing snapshots on initialization
    this.clearCacheOnInit();

    // Initialize with empty snapshots
    this.snapshots = new Map();

    // console.log('🧹 ViewportStateService initialized with clean cache');
  }

  // Clear cache on initialization
  private clearCacheOnInit() {
    try {
      // Clear from localStorage
      localStorage.removeItem(this.STORAGE_KEY);

      // Also clear any legacy storage keys if they exist
      localStorage.removeItem('ohif_viewport_states');

      console.log('🗑️ Cleared all existing viewport snapshots from cache');
    } catch (error) {
      console.error('❌ Error clearing cache:', error);
    }
  }

  private getEngine() {
    return getRenderingEngine('OHIFCornerstoneRenderingEngine');
  }

  private getOrthographicViewports() {
    const engine = this.getEngine();

    if (!engine) {
      console.warn('⚠️ Rendering engine not found');
      return [];
    }

    const viewports = engine.getViewports();

    if (!Array.isArray(viewports)) {
      console.warn('⚠️ getViewports() did not return an array');
      return [];
    }

    const orthoViewports = viewports.filter(vp => vp?.type === 'orthographic');

    if (orthoViewports.length !== 3) {
      console.warn(`⚠️ Expected 3 orthographic viewports, found ${orthoViewports.length}`);
    }

    return orthoViewports;
  }

  private saveToStorage() {
    try {
      const serialized = JSON.stringify(Array.from(this.snapshots.entries()));
      localStorage.setItem(this.STORAGE_KEY, serialized);
    } catch (error) {
      console.error('❌ Error saving to storage:', error);
    }
  }

  // Generate unique name
  private getUniqueName(baseName: string): string {
    let name = baseName;
    let counter = 1;

    while (this.snapshots.has(name)) {
      name = `${baseName} (${counter})`;
      counter++;
    }

    return name;
  }

  // Check if we've reached the limit
  private canAddSnapshot(): boolean {
    return this.snapshots.size < this.MAX_SNAPSHOTS;
  }

  // Save all orthographic viewports as one snapshot
  saveSnapshot(name: string): Snapshot {
    const engine = this.getEngine();
    if (!engine) throw new Error('Rendering engine not found');

    // Ensure unique name
    const uniqueName = this.getUniqueName(name);

    // Check limit
    if (!this.canAddSnapshot()) {
      // Remove oldest snapshot
      const firstKey = this.snapshots.keys().next().value;
      this.snapshots.delete(firstKey);
      console.warn(`⚠️ Snapshot limit reached. Removed oldest: ${firstKey}`);
    }

    const viewports = this.getOrthographicViewports();

    if (viewports.length === 0) {
      throw new Error('No orthographic viewports found');
    }

    // Capture state of all viewports
    const viewportStates: ViewportState[] = viewports.map(vp => ({
      frameOfReferenceUID: vp.getFrameOfReferenceUID(),
      camera: vp.getCamera(),
      viewReference: vp.getViewReference?.() || null,
      viewPresentation: vp.getViewPresentation?.() || null,
      metadata: {
        viewportId: vp.id,
        viewportType: vp.type,
        renderingEngineId: engine.id,
        zoom: vp.getZoom?.() || 1,
        pan: vp.getPan?.() || [0, 0],
      }
    }));

    const snapshot: Snapshot = {
      name: uniqueName,
      timestamp: new Date().toISOString(),
      viewports: viewportStates,
    };

    this.snapshots.set(uniqueName, snapshot);
    this.saveToStorage();

    console.log(`💾 Saved snapshot: "${uniqueName}" with ${viewportStates.length} viewports`);
    return snapshot;
  }

  // Restore specific snapshot by name
  restoreSnapshot(name: string): boolean {
    const snapshot = this.snapshots.get(name);

    if (!snapshot) {
      throw new Error(`Snapshot "${name}" not found`);
    }

    const engine = this.getEngine();
    if (!engine) throw new Error('Rendering engine not found');

    let restoredCount = 0;

    // Restore each viewport from the snapshot
    snapshot.viewports.forEach(savedState => {
      try {
        const vp = engine.getViewport(savedState.metadata.viewportId);

        if (!vp) {
          console.warn(`⚠️ Viewport ${savedState.metadata.viewportId} not found`);
          return;
        }

        vp.setCamera(savedState.camera);

        if (savedState.viewPresentation && typeof vp.setViewPresentation === 'function') {
          vp.setViewPresentation(savedState.viewPresentation);
        }

        if (savedState.viewReference && typeof vp.setViewReference === 'function') {
          vp.setViewReference(savedState.viewReference);
        }

        vp.render();
        restoredCount++;

      } catch (error) {
        console.error(`❌ Failed to restore viewport ${savedState.metadata.viewportId}:`, error);
      }
    });

    console.log(`✅ Restored snapshot: "${name}" (${restoredCount}/${snapshot.viewports.length} viewports)`);
    return restoredCount > 0;
  }

  // Get all snapshots
  getAllSnapshots(): Snapshot[] {
    return Array.from(this.snapshots.values());
  }

  // Get snapshot by name
  getSnapshot(name: string): Snapshot | undefined {
    return this.snapshots.get(name);
  }

  // Delete specific snapshot
  deleteSnapshot(name: string): boolean {
    const deleted = this.snapshots.delete(name);
    if (deleted) {
      this.saveToStorage();
      console.log(`🗑️ Deleted snapshot: "${name}"`);
    }
    return deleted;
  }

  // Clear all snapshots (also available as public method)
  clearAll() {
    this.snapshots.clear();
    this.saveToStorage();
    console.log('🧹 All snapshots cleared');
  }

  // Get remaining slots
  getRemainingSlots(): number {
    return this.MAX_SNAPSHOTS - this.snapshots.size;
  }

  // Check if name exists
  hasSnapshot(name: string): boolean {
    return this.snapshots.has(name);
  }

  // Export to JSON
  exportJSON(): string {
    return JSON.stringify(Array.from(this.snapshots.entries()), null, 2);
  }

  // Import from JSON
  importJSON(jsonString: string) {
    try {
      const data = JSON.parse(jsonString);
      this.snapshots = new Map(data);
      this.saveToStorage();
      console.log(`✅ Imported ${this.snapshots.size} snapshots`);
    } catch (error) {
      console.error('❌ Error importing:', error);
      throw new Error('Invalid JSON format');
    }
  }

  // Real-time camera focal point logging for MPR viewports
  private readonly MPR_VIEWPORT_IDS = ['mpr-axial', 'mpr-sagittal', 'mpr-coronal'];

  private isMPRViewport(viewportId: string): boolean {
    return this.MPR_VIEWPORT_IDS.some(id => viewportId.includes(id));
  }

  private logCameraFocalPoint(viewport: any) {
    try {
      const camera = viewport.getCamera();
      const viewportId = viewport.id;

      if (!camera || !camera.focalPoint) {
        return;
      }

      const [x, y, z] = camera.focalPoint;

      // Clean, compact output - just viewport and coordinates
      console.log(`📸 [${viewportId}] Focal Point: [${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}]`);

      // Verbose output (commented out for clarity)
      // console.log(`📸 [${viewportId}] Camera Focal Point:`, {
      //   x: x.toFixed(2),
      //   y: y.toFixed(2),
      //   z: z.toFixed(2),
      //   raw: camera.focalPoint,
      //   timestamp: new Date().toISOString()
      // });
    } catch (error) {
      console.error('❌ Error logging focal point:', error);
    }
  }

  enableCameraLogging(): void {
    if (this.cameraLoggingEnabled) {
      // console.log('⚠️ Camera logging is already enabled');
      return;
    }

    const engine = this.getEngine();
    if (!engine) {
      console.error('❌ Cannot enable camera logging: Rendering engine not found');
      return;
    }

    const viewports = engine.getViewports();
    let enabledCount = 0;

    viewports.forEach(viewport => {
      if (this.isMPRViewport(viewport.id)) {
        const element = viewport.element;

        if (!element) {
          // console.warn(`⚠️ No element found for viewport: ${viewport.id}`);
          return;
        }

        // Log initial focal point (commented out for clarity)
        // console.log(`🎬 Starting camera logging for: ${viewport.id}`);
        // this.logCameraFocalPoint(viewport);

        // Debounced handler to avoid excessive logging
        let debounceTimeout;
        const debouncedHandler = () => {
          clearTimeout(debounceTimeout);
          debounceTimeout = setTimeout(() => {
            this.logCameraFocalPoint(viewport);
          }, 100); // 100ms debounce
        };

        // Handler for camera modified events
        const cameraHandler = (evt: any) => {
          const { element: evtElement } = evt.detail;
          if (evtElement === element) {
            this.logCameraFocalPoint(viewport);
          }
        };

        // Handler for image rendered (fires when scrolling slices)
        const imageRenderedHandler = (evt: any) => {
          const { element: evtElement } = evt.detail;
          if (evtElement === element) {
            debouncedHandler();
          }
        };

        // Store handlers for cleanup
        this.cameraEventListeners.set(viewport.id, {
          element,
          cameraHandler,
          imageRenderedHandler,
          debounceTimeout
        });

        // Listen for camera changes (pan, zoom, rotate)
        element.addEventListener('cornerstonecameramodified', cameraHandler);

        // Listen for image rendered (slice scrolling in MPR)
        element.addEventListener('cornerstoneimagerendered', imageRenderedHandler);

        enabledCount++;
      }
    });

    this.cameraLoggingEnabled = true;
    console.log(`✅ Camera logging enabled (${enabledCount} viewports)`);
    // console.log(`📌 Monitoring viewports: ${this.MPR_VIEWPORT_IDS.join(', ')}`);
    // console.log(`📌 Tracking: Camera changes (pan/zoom/rotate) and slice scrolling`);
  }

  disableCameraLogging(): void {
    if (!this.cameraLoggingEnabled) {
      // console.log('⚠️ Camera logging is already disabled');
      return;
    }

    this.cameraEventListeners.forEach(({ element, cameraHandler, imageRenderedHandler, debounceTimeout }, viewportId) => {
      // Clear any pending debounce timeout
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      // Remove both event listeners
      element.removeEventListener('cornerstonecameramodified', cameraHandler);
      element.removeEventListener('cornerstoneimagerendered', imageRenderedHandler);

      // console.log(`🛑 Stopped camera logging for: ${viewportId}`);
    });

    this.cameraEventListeners.clear();
    this.cameraLoggingEnabled = false;
    console.log('✅ Camera logging disabled');
  }

  isCameraLoggingEnabled(): boolean {
    return this.cameraLoggingEnabled;
  }

  toggleCameraLogging(): void {
    if (this.cameraLoggingEnabled) {
      this.disableCameraLogging();
    } else {
      this.enableCameraLogging();
    }
  }

  // Get current focal points for all MPR viewports
  getCurrentFocalPoints(): Record<string, number[]> {
    const engine = this.getEngine();
    if (!engine) {
      return {};
    }

    const focalPoints: Record<string, number[]> = {};
    const viewports = engine.getViewports();

    viewports.forEach(viewport => {
      if (this.isMPRViewport(viewport.id)) {
        try {
          const camera = viewport.getCamera();
          if (camera && camera.focalPoint) {
            focalPoints[viewport.id] = camera.focalPoint;
          }
        } catch (error) {
          console.error(`❌ Error getting focal point for ${viewport.id}:`, error);
        }
      }
    });

    return focalPoints;
  }

  // Get crosshairs tool center for all MPR viewports
  getCrosshairsToolCenter(): Record<string, { center: number[] | null; isActive: boolean }> {
    const engine = this.getEngine();
    if (!engine) {
      return {};
    }

    const result: Record<string, { center: number[] | null; isActive: boolean }> = {};
    
    // We need access to the ToolGroupManager and annotation state
    // These are typically available from @cornerstonejs/tools
    try {
      // @ts-ignore - importing from global cornerstone tools
      const { ToolGroupManager, annotation } = window.cornerstoneTools || {};
      
      if (!ToolGroupManager || !annotation) {
        console.warn('⚠️ Cornerstone Tools not available');
        return result;
      }

      const viewports = engine.getViewports();

      viewports.forEach(viewport => {
        if (this.isMPRViewport(viewport.id)) {
          try {
            // Find the tool group for this viewport
            const toolGroupIds = ToolGroupManager.getToolGroupIds();
            let crosshairsTool = null;
            let toolGroupId = null;

            // Find which tool group has the Crosshairs tool for this viewport
            for (const tgId of toolGroupIds) {
              const toolGroup = ToolGroupManager.getToolGroup(tgId);
              const viewportIds = toolGroup.getViewportIds();
              
              if (viewportIds.includes(viewport.id)) {
                const toolInstance = toolGroup.getToolInstance('Crosshairs');
                if (toolInstance) {
                  crosshairsTool = toolInstance;
                  toolGroupId = tgId;
                  break;
                }
              }
            }

            // Check if crosshairs tool is available and active
            const isActive = crosshairsTool && crosshairsTool.mode === 'Active';

            if (!crosshairsTool) {
              result[viewport.id] = {
                center: null,
                isActive: false,
              };
              return;
            }

            // Get annotations for the crosshairs tool
            const element = viewport.element;
            if (!element) {
              result[viewport.id] = {
                center: null,
                isActive: !!isActive,
              };
              return;
            }

            const annotations = annotation.state.getAnnotations('Crosshairs', element);
            
            // Get the center from the first annotation (crosshairs typically has one annotation per viewport)
            let center = null;
            if (annotations && annotations.length > 0) {
              const firstAnnotation = annotations[0];
              // The center is typically stored in data.handles.rotationPoints or data.handles.toolCenter
              if (firstAnnotation.data?.handles?.rotationPoints) {
                center = firstAnnotation.data.handles.rotationPoints[0]; // World coordinates
              } else if (firstAnnotation.data?.handles?.toolCenter) {
                center = firstAnnotation.data.handles.toolCenter;
              }
            }

            result[viewport.id] = {
              center: center ? [center[0], center[1], center[2]] : null,
              isActive: !!isActive,
            };

          } catch (error) {
            console.error(`❌ Error getting crosshairs center for ${viewport.id}:`, error);
            result[viewport.id] = {
              center: null,
              isActive: false,
            };
          }
        }
      });

    } catch (error) {
      console.error('❌ Error accessing Cornerstone Tools:', error);
    }

    return result;
  }
}

export default ViewportStateService;

```

Now let me check if there are any linter errors and also improve the implementation by using proper imports:

Let me improve the implementation by using proper imports:

```typescript
import { getRenderingEngine } from '@cornerstonejs/core';
import { ToolGroupManager, annotation } from '@cornerstonejs/tools';

interface ViewportState {
  frameOfReferenceUID: string;
  camera: any;
  viewReference: any;
  viewPresentation: any;
  metadata: {
    viewportId: string;
    viewportType: string;
    renderingEngineId: string;
    zoom: number;
    pan: number[];
  };
}

interface Snapshot {
  name: string;
  timestamp: string;
  viewports: ViewportState[];
}

class ViewportStateService {
  public static REGISTRATION = {
    name: 'viewportStateService',
    create: () => new ViewportStateService(),
  };

  private snapshots: Map<string, Snapshot>;
  private readonly MAX_SNAPSHOTS = 10;
  private readonly STORAGE_KEY = 'ohif_viewport_snapshots';
  private cameraLoggingEnabled: boolean = false;
  private cameraEventListeners: Map<string, any> = new Map();

  constructor() {
    // Clear all existing snapshots on initialization
    this.clearCacheOnInit();

    // Initialize with empty snapshots
    this.snapshots = new Map();

    // console.log('🧹 ViewportStateService initialized with clean cache');
  }

  // Clear cache on initialization
  private clearCacheOnInit() {
    try {
      // Clear from localStorage
      localStorage.removeItem(this.STORAGE_KEY);

      // Also clear any legacy storage keys if they exist
      localStorage.removeItem('ohif_viewport_states');

      console.log('🗑️ Cleared all existing viewport snapshots from cache');
    } catch (error) {
      console.error('❌ Error clearing cache:', error);
    }
  }

  private getEngine() {
    return getRenderingEngine('OHIFCornerstoneRenderingEngine');
  }

  private getOrthographicViewports() {
    const engine = this.getEngine();

    if (!engine) {
      console.warn('⚠️ Rendering engine not found');
      return [];
    }

    const viewports = engine.getViewports();

    if (!Array.isArray(viewports)) {
      console.warn('⚠️ getViewports() did not return an array');
      return [];
    }

    const orthoViewports = viewports.filter(vp => vp?.type === 'orthographic');

    if (orthoViewports.length !== 3) {
      console.warn(`⚠️ Expected 3 orthographic viewports, found ${orthoViewports.length}`);
    }

    return orthoViewports;
  }

  private saveToStorage() {
    try {
      const serialized = JSON.stringify(Array.from(this.snapshots.entries()));
      localStorage.setItem(this.STORAGE_KEY, serialized);
    } catch (error) {
      console.error('❌ Error saving to storage:', error);
    }
  }

  // Generate unique name
  private getUniqueName(baseName: string): string {
    let name = baseName;
    let counter = 1;

    while (this.snapshots.has(name)) {
      name = `${baseName} (${counter})`;
      counter++;
    }

    return name;
  }

  // Check if we've reached the limit
  private canAddSnapshot(): boolean {
    return this.snapshots.size < this.MAX_SNAPSHOTS;
  }

  // Save all orthographic viewports as one snapshot
  saveSnapshot(name: string): Snapshot {
    const engine = this.getEngine();
    if (!engine) throw new Error('Rendering engine not found');

    // Ensure unique name
    const uniqueName = this.getUniqueName(name);

    // Check limit
    if (!this.canAddSnapshot()) {
      // Remove oldest snapshot
      const firstKey = this.snapshots.keys().next().value;
      this.snapshots.delete(firstKey);
      console.warn(`⚠️ Snapshot limit reached. Removed oldest: ${firstKey}`);
    }

    const viewports = this.getOrthographicViewports();

    if (viewports.length === 0) {
      throw new Error('No orthographic viewports found');
    }

    // Capture state of all viewports
    const viewportStates: ViewportState[] = viewports.map(vp => ({
      frameOfReferenceUID: vp.getFrameOfReferenceUID(),
      camera: vp.getCamera(),
      viewReference: vp.getViewReference?.() || null,
      viewPresentation: vp.getViewPresentation?.() || null,
      metadata: {
        viewportId: vp.id,
        viewportType: vp.type,
        renderingEngineId: engine.id,
        zoom: vp.getZoom?.() || 1,
        pan: vp.getPan?.() || [0, 0],
      }
    }));

    const snapshot: Snapshot = {
      name: uniqueName,
      timestamp: new Date().toISOString(),
      viewports: viewportStates,
    };

    this.snapshots.set(uniqueName, snapshot);
    this.saveToStorage();

    console.log(`💾 Saved snapshot: "${uniqueName}" with ${viewportStates.length} viewports`);
    return snapshot;
  }

  // Restore specific snapshot by name
  restoreSnapshot(name: string): boolean {
    const snapshot = this.snapshots.get(name);

    if (!snapshot) {
      throw new Error(`Snapshot "${name}" not found`);
    }

    const engine = this.getEngine();
    if (!engine) throw new Error('Rendering engine not found');

    let restoredCount = 0;

    // Restore each viewport from the snapshot
    snapshot.viewports.forEach(savedState => {
      try {
        const vp = engine.getViewport(savedState.metadata.viewportId);

        if (!vp) {
          console.warn(`⚠️ Viewport ${savedState.metadata.viewportId} not found`);
          return;
        }

        vp.setCamera(savedState.camera);

        if (savedState.viewPresentation && typeof vp.setViewPresentation === 'function') {
          vp.setViewPresentation(savedState.viewPresentation);
        }

        if (savedState.viewReference && typeof vp.setViewReference === 'function') {
          vp.setViewReference(savedState.viewReference);
        }

        vp.render();
        restoredCount++;

      } catch (error) {
        console.error(`❌ Failed to restore viewport ${savedState.metadata.viewportId}:`, error);
      }
    });

    console.log(`✅ Restored snapshot: "${name}" (${restoredCount}/${snapshot.viewports.length} viewports)`);
    return restoredCount > 0;
  }

  // Get all snapshots
  getAllSnapshots(): Snapshot[] {
    return Array.from(this.snapshots.values());
  }

  // Get snapshot by name
  getSnapshot(name: string): Snapshot | undefined {
    return this.snapshots.get(name);
  }

  // Delete specific snapshot
  deleteSnapshot(name: string): boolean {
    const deleted = this.snapshots.delete(name);
    if (deleted) {
      this.saveToStorage();
      console.log(`🗑️ Deleted snapshot: "${name}"`);
    }
    return deleted;
  }

  // Clear all snapshots (also available as public method)
  clearAll() {
    this.snapshots.clear();
    this.saveToStorage();
    console.log('🧹 All snapshots cleared');
  }

  // Get remaining slots
  getRemainingSlots(): number {
    return this.MAX_SNAPSHOTS - this.snapshots.size;
  }

  // Check if name exists
  hasSnapshot(name: string): boolean {
    return this.snapshots.has(name);
  }

  // Export to JSON
  exportJSON(): string {
    return JSON.stringify(Array.from(this.snapshots.entries()), null, 2);
  }

  // Import from JSON
  importJSON(jsonString: string) {
    try {
      const data = JSON.parse(jsonString);
      this.snapshots = new Map(data);
      this.saveToStorage();
      console.log(`✅ Imported ${this.snapshots.size} snapshots`);
    } catch (error) {
      console.error('❌ Error importing:', error);
      throw new Error('Invalid JSON format');
    }
  }

  // Real-time camera focal point logging for MPR viewports
  private readonly MPR_VIEWPORT_IDS = ['mpr-axial', 'mpr-sagittal', 'mpr-coronal'];

  private isMPRViewport(viewportId: string): boolean {
    return this.MPR_VIEWPORT_IDS.some(id => viewportId.includes(id));
  }

  private logCameraFocalPoint(viewport: any) {
    try {
      const camera = viewport.getCamera();
      const viewportId = viewport.id;

      if (!camera || !camera.focalPoint) {
        return;
      }

      const [x, y, z] = camera.focalPoint;

      // Clean, compact output - just viewport and coordinates
      console.log(`📸 [${viewportId}] Focal Point: [${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}]`);

      // Verbose output (commented out for clarity)
      // console.log(`📸 [${viewportId}] Camera Focal Point:`, {
      //   x: x.toFixed(2),
      //   y: y.toFixed(2),
      //   z: z.toFixed(2),
      //   raw: camera.focalPoint,
      //   timestamp: new Date().toISOString()
      // });
    } catch (error) {
      console.error('❌ Error logging focal point:', error);
    }
  }

  enableCameraLogging(): void {
    if (this.cameraLoggingEnabled) {
      // console.log('⚠️ Camera logging is already enabled');
      return;
    }

    const engine = this.getEngine();
    if (!engine) {
      console.error('❌ Cannot enable camera logging: Rendering engine not found');
      return;
    }

    const viewports = engine.getViewports();
    let enabledCount = 0;

    viewports.forEach(viewport => {
      if (this.isMPRViewport(viewport.id)) {
        const element = viewport.element;

        if (!element) {
          // console.warn(`⚠️ No element found for viewport: ${viewport.id}`);
          return;
        }

        // Log initial focal point (commented out for clarity)
        // console.log(`🎬 Starting camera logging for: ${viewport.id}`);
        // this.logCameraFocalPoint(viewport);

        // Debounced handler to avoid excessive logging
        let debounceTimeout;
        const debouncedHandler = () => {
          clearTimeout(debounceTimeout);
          debounceTimeout = setTimeout(() => {
            this.logCameraFocalPoint(viewport);
          }, 100); // 100ms debounce
        };

        // Handler for camera modified events
        const cameraHandler = (evt: any) => {
          const { element: evtElement } = evt.detail;
          if (evtElement === element) {
            this.logCameraFocalPoint(viewport);
          }
        };

        // Handler for image rendered (fires when scrolling slices)
        const imageRenderedHandler = (evt: any) => {
          const { element: evtElement } = evt.detail;
          if (evtElement === element) {
            debouncedHandler();
          }
        };

        // Store handlers for cleanup
        this.cameraEventListeners.set(viewport.id, {
          element,
          cameraHandler,
          imageRenderedHandler,
          debounceTimeout
        });

        // Listen for camera changes (pan, zoom, rotate)
        element.addEventListener('cornerstonecameramodified', cameraHandler);

        // Listen for image rendered (slice scrolling in MPR)
        element.addEventListener('cornerstoneimagerendered', imageRenderedHandler);

        enabledCount++;
      }
    });

    this.cameraLoggingEnabled = true;
    console.log(`✅ Camera logging enabled (${enabledCount} viewports)`);
    // console.log(`📌 Monitoring viewports: ${this.MPR_VIEWPORT_IDS.join(', ')}`);
    // console.log(`📌 Tracking: Camera changes (pan/zoom/rotate) and slice scrolling`);
  }

  disableCameraLogging(): void {
    if (!this.cameraLoggingEnabled) {
      // console.log('⚠️ Camera logging is already disabled');
      return;
    }

    this.cameraEventListeners.forEach(({ element, cameraHandler, imageRenderedHandler, debounceTimeout }, viewportId) => {
      // Clear any pending debounce timeout
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      // Remove both event listeners
      element.removeEventListener('cornerstonecameramodified', cameraHandler);
      element.removeEventListener('cornerstoneimagerendered', imageRenderedHandler);

      // console.log(`🛑 Stopped camera logging for: ${viewportId}`);
    });

    this.cameraEventListeners.clear();
    this.cameraLoggingEnabled = false;
    console.log('✅ Camera logging disabled');
  }

  isCameraLoggingEnabled(): boolean {
    return this.cameraLoggingEnabled;
  }

  toggleCameraLogging(): void {
    if (this.cameraLoggingEnabled) {
      this.disableCameraLogging();
    } else {
      this.enableCameraLogging();
    }
  }

  // Get current focal points for all MPR viewports
  getCurrentFocalPoints(): Record<string, number[]> {
    const engine = this.getEngine();
    if (!engine) {
      return {};
    }

    const focalPoints: Record<string, number[]> = {};
    const viewports = engine.getViewports();

    viewports.forEach(viewport => {
      if (this.isMPRViewport(viewport.id)) {
        try {
          const camera = viewport.getCamera();
          if (camera && camera.focalPoint) {
            focalPoints[viewport.id] = camera.focalPoint;
          }
        } catch (error) {
          console.error(`❌ Error getting focal point for ${viewport.id}:`, error);
        }
      }
    });

    return focalPoints;
  }

  // Get crosshairs tool center for all MPR viewports
  getCrosshairsToolCenter(): Record<string, { center: number[] | null; isActive: boolean }> {
    const engine = this.getEngine();
    if (!engine) {
      return {};
    }

    const result: Record<string, { center: number[] | null; isActive: boolean }> = {};
    
    // We need access to the ToolGroupManager and annotation state
    // These are typically available from @cornerstonejs/tools
    try {
      // @ts-ignore - importing from global cornerstone tools
      const { ToolGroupManager, annotation } = window.cornerstoneTools || {};
      
      if (!ToolGroupManager || !annotation) {
        console.warn('⚠️ Cornerstone Tools not available');
        return result;
      }

      const viewports = engine.getViewports();

      viewports.forEach(viewport => {
        if (this.isMPRViewport(viewport.id)) {
          try {
            // Find the tool group for this viewport
            const toolGroupIds = ToolGroupManager.getToolGroupIds();
            let crosshairsTool = null;
            let toolGroupId = null;

            // Find which tool group has the Crosshairs tool for this viewport
            for (const tgId of toolGroupIds) {
              const toolGroup = ToolGroupManager.getToolGroup(tgId);
              const viewportIds = toolGroup.getViewportIds();
              
              if (viewportIds.includes(viewport.id)) {
                const toolInstance = toolGroup.getToolInstance('Crosshairs');
                if (toolInstance) {
                  crosshairsTool = toolInstance;
                  toolGroupId = tgId;
                  break;
                }
              }
            }

            // Check if crosshairs tool is available and active
            const isActive = crosshairsTool && crosshairsTool.mode === 'Active';

            if (!crosshairsTool) {
              result[viewport.id] = {
                center: null,
                isActive: false,
              };
              return;
            }

            // Get annotations for the crosshairs tool
            const element = viewport.element;
            if (!element) {
              result[viewport.id] = {
                center: null,
                isActive: !!isActive,
              };
              return;
            }

            const annotations = annotation.state.getAnnotations('Crosshairs', element);
            
            // Get the center from the first annotation (crosshairs typically has one annotation per viewport)
            let center = null;
            if (annotations && annotations.length > 0) {
              const firstAnnotation = annotations[0];
              // The center is typically stored in data.handles.rotationPoints or data.handles.toolCenter
              if (firstAnnotation.data?.handles?.rotationPoints) {
                center = firstAnnotation.data.handles.rotationPoints[0]; // World coordinates
              } else if (firstAnnotation.data?.handles?.toolCenter) {
                center = firstAnnotation.data.handles.toolCenter;
              }
            }

            result[viewport.id] = {
              center: center ? [center[0], center[1], center[2]] : null,
              isActive: !!isActive,
            };

          } catch (error) {
            console.error(`❌ Error getting crosshairs center for ${viewport.id}:`, error);
            result[viewport.id] = {
              center: null,
              isActive: false,
            };
          }
        }
      });

    } catch (error) {
      console.error('❌ Error accessing Cornerstone Tools:', error);
    }

    return result;
  }
}

export default ViewportStateService;

```

Now let me update the function to use the proper imports:

```typescript
import { getRenderingEngine } from '@cornerstonejs/core';
import { ToolGroupManager, annotation } from '@cornerstonejs/tools';

interface ViewportState {
  frameOfReferenceUID: string;
  camera: any;
  viewReference: any;
  viewPresentation: any;
  metadata: {
    viewportId: string;
    viewportType: string;
    renderingEngineId: string;
    zoom: number;
    pan: number[];
  };
}

interface Snapshot {
  name: string;
  timestamp: string;
  viewports: ViewportState[];
}

class ViewportStateService {
  public static REGISTRATION = {
    name: 'viewportStateService',
    create: () => new ViewportStateService(),
  };

  private snapshots: Map<string, Snapshot>;
  private readonly MAX_SNAPSHOTS = 10;
  private readonly STORAGE_KEY = 'ohif_viewport_snapshots';
  private cameraLoggingEnabled: boolean = false;
  private cameraEventListeners: Map<string, any> = new Map();

  constructor() {
    // Clear all existing snapshots on initialization
    this.clearCacheOnInit();

    // Initialize with empty snapshots
    this.snapshots = new Map();

    // console.log('🧹 ViewportStateService initialized with clean cache');
  }

  // Clear cache on initialization
  private clearCacheOnInit() {
    try {
      // Clear from localStorage
      localStorage.removeItem(this.STORAGE_KEY);

      // Also clear any legacy storage keys if they exist
      localStorage.removeItem('ohif_viewport_states');

      console.log('🗑️ Cleared all existing viewport snapshots from cache');
    } catch (error) {
      console.error('❌ Error clearing cache:', error);
    }
  }

  private getEngine() {
    return getRenderingEngine('OHIFCornerstoneRenderingEngine');
  }

  private getOrthographicViewports() {
    const engine = this.getEngine();

    if (!engine) {
      console.warn('⚠️ Rendering engine not found');
      return [];
    }

    const viewports = engine.getViewports();

    if (!Array.isArray(viewports)) {
      console.warn('⚠️ getViewports() did not return an array');
      return [];
    }

    const orthoViewports = viewports.filter(vp => vp?.type === 'orthographic');

    if (orthoViewports.length !== 3) {
      console.warn(`⚠️ Expected 3 orthographic viewports, found ${orthoViewports.length}`);
    }

    return orthoViewports;
  }

  private saveToStorage() {
    try {
      const serialized = JSON.stringify(Array.from(this.snapshots.entries()));
      localStorage.setItem(this.STORAGE_KEY, serialized);
    } catch (error) {
      console.error('❌ Error saving to storage:', error);
    }
  }

  // Generate unique name
  private getUniqueName(baseName: string): string {
    let name = baseName;
    let counter = 1;

    while (this.snapshots.has(name)) {
      name = `${baseName} (${counter})`;
      counter++;
    }

    return name;
  }

  // Check if we've reached the limit
  private canAddSnapshot(): boolean {
    return this.snapshots.size < this.MAX_SNAPSHOTS;
  }

  // Save all orthographic viewports as one snapshot
  saveSnapshot(name: string): Snapshot {
    const engine = this.getEngine();
    if (!engine) throw new Error('Rendering engine not found');

    // Ensure unique name
    const uniqueName = this.getUniqueName(name);

    // Check limit
    if (!this.canAddSnapshot()) {
      // Remove oldest snapshot
      const firstKey = this.snapshots.keys().next().value;
      this.snapshots.delete(firstKey);
      console.warn(`⚠️ Snapshot limit reached. Removed oldest: ${firstKey}`);
    }

    const viewports = this.getOrthographicViewports();

    if (viewports.length === 0) {
      throw new Error('No orthographic viewports found');
    }

    // Capture state of all viewports
    const viewportStates: ViewportState[] = viewports.map(vp => ({
      frameOfReferenceUID: vp.getFrameOfReferenceUID(),
      camera: vp.getCamera(),
      viewReference: vp.getViewReference?.() || null,
      viewPresentation: vp.getViewPresentation?.() || null,
      metadata: {
        viewportId: vp.id,
        viewportType: vp.type,
        renderingEngineId: engine.id,
        zoom: vp.getZoom?.() || 1,
        pan: vp.getPan?.() || [0, 0],
      }
    }));

    const snapshot: Snapshot = {
      name: uniqueName,
      timestamp: new Date().toISOString(),
      viewports: viewportStates,
    };

    this.snapshots.set(uniqueName, snapshot);
    this.saveToStorage();

    console.log(`💾 Saved snapshot: "${uniqueName}" with ${viewportStates.length} viewports`);
    return snapshot;
  }

  // Restore specific snapshot by name
  restoreSnapshot(name: string): boolean {
    const snapshot = this.snapshots.get(name);

    if (!snapshot) {
      throw new Error(`Snapshot "${name}" not found`);
    }

    const engine = this.getEngine();
    if (!engine) throw new Error('Rendering engine not found');

    let restoredCount = 0;

    // Restore each viewport from the snapshot
    snapshot.viewports.forEach(savedState => {
      try {
        const vp = engine.getViewport(savedState.metadata.viewportId);

        if (!vp) {
          console.warn(`⚠️ Viewport ${savedState.metadata.viewportId} not found`);
          return;
        }

        vp.setCamera(savedState.camera);

        if (savedState.viewPresentation && typeof vp.setViewPresentation === 'function') {
          vp.setViewPresentation(savedState.viewPresentation);
        }

        if (savedState.viewReference && typeof vp.setViewReference === 'function') {
          vp.setViewReference(savedState.viewReference);
        }

        vp.render();
        restoredCount++;

      } catch (error) {
        console.error(`❌ Failed to restore viewport ${savedState.metadata.viewportId}:`, error);
      }
    });

    console.log(`✅ Restored snapshot: "${name}" (${restoredCount}/${snapshot.viewports.length} viewports)`);
    return restoredCount > 0;
  }

  // Get all snapshots
  getAllSnapshots(): Snapshot[] {
    return Array.from(this.snapshots.values());
  }

  // Get snapshot by name
  getSnapshot(name: string): Snapshot | undefined {
    return this.snapshots.get(name);
  }

  // Delete specific snapshot
  deleteSnapshot(name: string): boolean {
    const deleted = this.snapshots.delete(name);
    if (deleted) {
      this.saveToStorage();
      console.log(`🗑️ Deleted snapshot: "${name}"`);
    }
    return deleted;
  }

  // Clear all snapshots (also available as public method)
  clearAll() {
    this.snapshots.clear();
    this.saveToStorage();
    console.log('🧹 All snapshots cleared');
  }

  // Get remaining slots
  getRemainingSlots(): number {
    return this.MAX_SNAPSHOTS - this.snapshots.size;
  }

  // Check if name exists
  hasSnapshot(name: string): boolean {
    return this.snapshots.has(name);
  }

  // Export to JSON
  exportJSON(): string {
    return JSON.stringify(Array.from(this.snapshots.entries()), null, 2);
  }

  // Import from JSON
  importJSON(jsonString: string) {
    try {
      const data = JSON.parse(jsonString);
      this.snapshots = new Map(data);
      this.saveToStorage();
      console.log(`✅ Imported ${this.snapshots.size} snapshots`);
    } catch (error) {
      console.error('❌ Error importing:', error);
      throw new Error('Invalid JSON format');
    }
  }

  // Real-time camera focal point logging for MPR viewports
  private readonly MPR_VIEWPORT_IDS = ['mpr-axial', 'mpr-sagittal', 'mpr-coronal'];

  private isMPRViewport(viewportId: string): boolean {
    return this.MPR_VIEWPORT_IDS.some(id => viewportId.includes(id));
  }

  private logCameraFocalPoint(viewport: any) {
    try {
      const camera = viewport.getCamera();
      const viewportId = viewport.id;

      if (!camera || !camera.focalPoint) {
        return;
      }

      const [x, y, z] = camera.focalPoint;

      // Clean, compact output - just viewport and coordinates
      console.log(`📸 [${viewportId}] Focal Point: [${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}]`);

      // Verbose output (commented out for clarity)
      // console.log(`📸 [${viewportId}] Camera Focal Point:`, {
      //   x: x.toFixed(2),
      //   y: y.toFixed(2),
      //   z: z.toFixed(2),
      //   raw: camera.focalPoint,
      //   timestamp: new Date().toISOString()
      // });
    } catch (error) {
      console.error('❌ Error logging focal point:', error);
    }
  }

  enableCameraLogging(): void {
    if (this.cameraLoggingEnabled) {
      // console.log('⚠️ Camera logging is already enabled');
      return;
    }

    const engine = this.getEngine();
    if (!engine) {
      console.error('❌ Cannot enable camera logging: Rendering engine not found');
      return;
    }

    const viewports = engine.getViewports();
    let enabledCount = 0;

    viewports.forEach(viewport => {
      if (this.isMPRViewport(viewport.id)) {
        const element = viewport.element;

        if (!element) {
          // console.warn(`⚠️ No element found for viewport: ${viewport.id}`);
          return;
        }

        // Log initial focal point (commented out for clarity)
        // console.log(`🎬 Starting camera logging for: ${viewport.id}`);
        // this.logCameraFocalPoint(viewport);

        // Debounced handler to avoid excessive logging
        let debounceTimeout;
        const debouncedHandler = () => {
          clearTimeout(debounceTimeout);
          debounceTimeout = setTimeout(() => {
            this.logCameraFocalPoint(viewport);
          }, 100); // 100ms debounce
        };

        // Handler for camera modified events
        const cameraHandler = (evt: any) => {
          const { element: evtElement } = evt.detail;
          if (evtElement === element) {
            this.logCameraFocalPoint(viewport);
          }
        };

        // Handler for image rendered (fires when scrolling slices)
        const imageRenderedHandler = (evt: any) => {
          const { element: evtElement } = evt.detail;
          if (evtElement === element) {
            debouncedHandler();
          }
        };

        // Store handlers for cleanup
        this.cameraEventListeners.set(viewport.id, {
          element,
          cameraHandler,
          imageRenderedHandler,
          debounceTimeout
        });

        // Listen for camera changes (pan, zoom, rotate)
        element.addEventListener('cornerstonecameramodified', cameraHandler);

        // Listen for image rendered (slice scrolling in MPR)
        element.addEventListener('cornerstoneimagerendered', imageRenderedHandler);

        enabledCount++;
      }
    });

    this.cameraLoggingEnabled = true;
    console.log(`✅ Camera logging enabled (${enabledCount} viewports)`);
    // console.log(`📌 Monitoring viewports: ${this.MPR_VIEWPORT_IDS.join(', ')}`);
    // console.log(`📌 Tracking: Camera changes (pan/zoom/rotate) and slice scrolling`);
  }

  disableCameraLogging(): void {
    if (!this.cameraLoggingEnabled) {
      // console.log('⚠️ Camera logging is already disabled');
      return;
    }

    this.cameraEventListeners.forEach(({ element, cameraHandler, imageRenderedHandler, debounceTimeout }, viewportId) => {
      // Clear any pending debounce timeout
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      // Remove both event listeners
      element.removeEventListener('cornerstonecameramodified', cameraHandler);
      element.removeEventListener('cornerstoneimagerendered', imageRenderedHandler);

      // console.log(`🛑 Stopped camera logging for: ${viewportId}`);
    });

    this.cameraEventListeners.clear();
    this.cameraLoggingEnabled = false;
    console.log('✅ Camera logging disabled');
  }

  isCameraLoggingEnabled(): boolean {
    return this.cameraLoggingEnabled;
  }

  toggleCameraLogging(): void {
    if (this.cameraLoggingEnabled) {
      this.disableCameraLogging();
    } else {
      this.enableCameraLogging();
    }
  }

  // Get current focal points for all MPR viewports
  getCurrentFocalPoints(): Record<string, number[]> {
    const engine = this.getEngine();
    if (!engine) {
      return {};
    }

    const focalPoints: Record<string, number[]> = {};
    const viewports = engine.getViewports();

    viewports.forEach(viewport => {
      if (this.isMPRViewport(viewport.id)) {
        try {
          const camera = viewport.getCamera();
          if (camera && camera.focalPoint) {
            focalPoints[viewport.id] = camera.focalPoint;
          }
        } catch (error) {
          console.error(`❌ Error getting focal point for ${viewport.id}:`, error);
        }
      }
    });

    return focalPoints;
  }

  // Get crosshairs tool center for all MPR viewports
  getCrosshairsToolCenter(): Record<string, { center: number[] | null; isActive: boolean }> {
    const engine = this.getEngine();
    if (!engine) {
      return {};
    }

    const result: Record<string, { center: number[] | null; isActive: boolean }> = {};
    
    try {
      const viewports = engine.getViewports();

      viewports.forEach(viewport => {
        if (this.isMPRViewport(viewport.id)) {
          try {
            // Find the tool group for this viewport
            const toolGroupIds = ToolGroupManager.getToolGroupIds();
            let crosshairsTool = null;
            let toolGroupId = null;

            // Find which tool group has the Crosshairs tool for this viewport
            for (const tgId of toolGroupIds) {
              const toolGroup = ToolGroupManager.getToolGroup(tgId);
              const viewportIds = toolGroup.getViewportIds();
              
              if (viewportIds.includes(viewport.id)) {
                const toolInstance = toolGroup.getToolInstance('Crosshairs');
                if (toolInstance) {
                  crosshairsTool = toolInstance;
                  toolGroupId = tgId;
                  break;
                }
              }
            }

            // Check if crosshairs tool is available and active
            const isActive = crosshairsTool && crosshairsTool.mode === 'Active';

            if (!crosshairsTool) {
              result[viewport.id] = {
                center: null,
                isActive: false,
              };
              return;
            }

            // Get annotations for the crosshairs tool
            const element = viewport.element;
            if (!element) {
              result[viewport.id] = {
                center: null,
                isActive: !!isActive,
              };
              return;
            }

            const annotations = annotation.state.getAnnotations('Crosshairs', element);
            
            // Get the center from the first annotation (crosshairs typically has one annotation per viewport)
            let center = null;
            if (annotations && annotations.length > 0) {
              const firstAnnotation = annotations[0];
              // The center is typically stored in data.handles.rotationPoints or data.handles.toolCenter
              if (firstAnnotation.data?.handles?.rotationPoints) {
                center = firstAnnotation.data.handles.rotationPoints[0]; // World coordinates
              } else if (firstAnnotation.data?.handles?.toolCenter) {
                center = firstAnnotation.data.handles.toolCenter;
              }
            }

            result[viewport.id] = {
              center: center ? [center[0], center[1], center[2]] : null,
              isActive: !!isActive,
            };

          } catch (error) {
            console.error(`❌ Error getting crosshairs center for ${viewport.id}:`, error);
            result[viewport.id] = {
              center: null,
              isActive: false,
            };
          }
        }
      });

    } catch (error) {
      console.error('❌ Error accessing Cornerstone Tools:', error);
    }

    return result;
  }
}

export default ViewportStateService;

```

```typescript
import { getRenderingEngine } from '@cornerstonejs/core';
import { ToolGroupManager, annotation } from '@cornerstonejs/tools';

interface ViewportState {
  frameOfReferenceUID: string;
  camera: any;
  viewReference: any;
  viewPresentation: any;
  metadata: {
    viewportId: string;
    viewportType: string;
    renderingEngineId: string;
    zoom: number;
    pan: number[];
  };
}

interface Snapshot {
  name: string;
  timestamp: string;
  viewports: ViewportState[];
}

class ViewportStateService {
  public static REGISTRATION = {
    name: 'viewportStateService',
    create: () => new ViewportStateService(),
  };

  private snapshots: Map<string, Snapshot>;
  private readonly MAX_SNAPSHOTS = 10;
  private readonly STORAGE_KEY = 'ohif_viewport_snapshots';
  private cameraLoggingEnabled: boolean = false;
  private cameraEventListeners: Map<string, any> = new Map();

  constructor() {
    // Clear all existing snapshots on initialization
    this.clearCacheOnInit();

    // Initialize with empty snapshots
    this.snapshots = new Map();

    // console.log('🧹 ViewportStateService initialized with clean cache');
  }

  // Clear cache on initialization
  private clearCacheOnInit() {
    try {
      // Clear from localStorage
      localStorage.removeItem(this.STORAGE_KEY);

      // Also clear any legacy storage keys if they exist
      localStorage.removeItem('ohif_viewport_states');

      console.log('🗑️ Cleared all existing viewport snapshots from cache');
    } catch (error) {
      console.error('❌ Error clearing cache:', error);
    }
  }

  private getEngine() {
    return getRenderingEngine('OHIFCornerstoneRenderingEngine');
  }

  private getOrthographicViewports() {
    const engine = this.getEngine();

    if (!engine) {
      console.warn('⚠️ Rendering engine not found');
      return [];
    }

    const viewports = engine.getViewports();

    if (!Array.isArray(viewports)) {
      console.warn('⚠️ getViewports() did not return an array');
      return [];
    }

    const orthoViewports = viewports.filter(vp => vp?.type === 'orthographic');

    if (orthoViewports.length !== 3) {
      console.warn(`⚠️ Expected 3 orthographic viewports, found ${orthoViewports.length}`);
    }

    return orthoViewports;
  }

  private saveToStorage() {
    try {
      const serialized = JSON.stringify(Array.from(this.snapshots.entries()));
      localStorage.setItem(this.STORAGE_KEY, serialized);
    } catch (error) {
      console.error('❌ Error saving to storage:', error);
    }
  }

  // Generate unique name
  private getUniqueName(baseName: string): string {
    let name = baseName;
    let counter = 1;

    while (this.snapshots.has(name)) {
      name = `${baseName} (${counter})`;
      counter++;
    }

    return name;
  }

  // Check if we've reached the limit
  private canAddSnapshot(): boolean {
    return this.snapshots.size < this.MAX_SNAPSHOTS;
  }

  // Save all orthographic viewports as one snapshot
  saveSnapshot(name: string): Snapshot {
    const engine = this.getEngine();
    if (!engine) throw new Error('Rendering engine not found');

    // Ensure unique name
    const uniqueName = this.getUniqueName(name);

    // Check limit
    if (!this.canAddSnapshot()) {
      // Remove oldest snapshot
      const firstKey = this.snapshots.keys().next().value;
      this.snapshots.delete(firstKey);
      console.warn(`⚠️ Snapshot limit reached. Removed oldest: ${firstKey}`);
    }

    const viewports = this.getOrthographicViewports();

    if (viewports.length === 0) {
      throw new Error('No orthographic viewports found');
    }

    // Capture state of all viewports
    const viewportStates: ViewportState[] = viewports.map(vp => ({
      frameOfReferenceUID: vp.getFrameOfReferenceUID(),
      camera: vp.getCamera(),
      viewReference: vp.getViewReference?.() || null,
      viewPresentation: vp.getViewPresentation?.() || null,
      metadata: {
        viewportId: vp.id,
        viewportType: vp.type,
        renderingEngineId: engine.id,
        zoom: vp.getZoom?.() || 1,
        pan: vp.getPan?.() || [0, 0],
      }
    }));

    const snapshot: Snapshot = {
      name: uniqueName,
      timestamp: new Date().toISOString(),
      viewports: viewportStates,
    };

    this.snapshots.set(uniqueName, snapshot);
    this.saveToStorage();

    console.log(`💾 Saved snapshot: "${uniqueName}" with ${viewportStates.length} viewports`);
    return snapshot;
  }

  // Restore specific snapshot by name
  restoreSnapshot(name: string): boolean {
    const snapshot = this.snapshots.get(name);

    if (!snapshot) {
      throw new Error(`Snapshot "${name}" not found`);
    }

    const engine = this.getEngine();
    if (!engine) throw new Error('Rendering engine not found');

    let restoredCount = 0;

    // Restore each viewport from the snapshot
    snapshot.viewports.forEach(savedState => {
      try {
        const vp = engine.getViewport(savedState.metadata.viewportId);

        if (!vp) {
          console.warn(`⚠️ Viewport ${savedState.metadata.viewportId} not found`);
          return;
        }

        vp.setCamera(savedState.camera);

        if (savedState.viewPresentation && typeof vp.setViewPresentation === 'function') {
          vp.setViewPresentation(savedState.viewPresentation);
        }

        if (savedState.viewReference && typeof vp.setViewReference === 'function') {
          vp.setViewReference(savedState.viewReference);
        }

        vp.render();
        restoredCount++;

      } catch (error) {
        console.error(`❌ Failed to restore viewport ${savedState.metadata.viewportId}:`, error);
      }
    });

    console.log(`✅ Restored snapshot: "${name}" (${restoredCount}/${snapshot.viewports.length} viewports)`);
    return restoredCount > 0;
  }

  // Get all snapshots
  getAllSnapshots(): Snapshot[] {
    return Array.from(this.snapshots.values());
  }

  // Get snapshot by name
  getSnapshot(name: string): Snapshot | undefined {
    return this.snapshots.get(name);
  }

  // Delete specific snapshot
  deleteSnapshot(name: string): boolean {
    const deleted = this.snapshots.delete(name);
    if (deleted) {
      this.saveToStorage();
      console.log(`🗑️ Deleted snapshot: "${name}"`);
    }
    return deleted;
  }

  // Clear all snapshots (also available as public method)
  clearAll() {
    this.snapshots.clear();
    this.saveToStorage();
    console.log('🧹 All snapshots cleared');
  }

  // Get remaining slots
  getRemainingSlots(): number {
    return this.MAX_SNAPSHOTS - this.snapshots.size;
  }

  // Check if name exists
  hasSnapshot(name: string): boolean {
    return this.snapshots.has(name);
  }

  // Export to JSON
  exportJSON(): string {
    return JSON.stringify(Array.from(this.snapshots.entries()), null, 2);
  }

  // Import from JSON
  importJSON(jsonString: string) {
    try {
      const data = JSON.parse(jsonString);
      this.snapshots = new Map(data);
      this.saveToStorage();
      console.log(`✅ Imported ${this.snapshots.size} snapshots`);
    } catch (error) {
      console.error('❌ Error importing:', error);
      throw new Error('Invalid JSON format');
    }
  }

  // Real-time camera focal point logging for MPR viewports
  private readonly MPR_VIEWPORT_IDS = ['mpr-axial', 'mpr-sagittal', 'mpr-coronal'];

  private isMPRViewport(viewportId: string): boolean {
    return this.MPR_VIEWPORT_IDS.some(id => viewportId.includes(id));
  }

  private logCameraFocalPoint(viewport: any) {
    try {
      const camera = viewport.getCamera();
      const viewportId = viewport.id;

      if (!camera || !camera.focalPoint) {
        return;
      }

      const [x, y, z] = camera.focalPoint;

      // Clean, compact output - just viewport and coordinates
      console.log(`📸 [${viewportId}] Focal Point: [${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}]`);

      // Verbose output (commented out for clarity)
      // console.log(`📸 [${viewportId}] Camera Focal Point:`, {
      //   x: x.toFixed(2),
      //   y: y.toFixed(2),
      //   z: z.toFixed(2),
      //   raw: camera.focalPoint,
      //   timestamp: new Date().toISOString()
      // });
    } catch (error) {
      console.error('❌ Error logging focal point:', error);
    }
  }

  enableCameraLogging(): void {
    if (this.cameraLoggingEnabled) {
      // console.log('⚠️ Camera logging is already enabled');
      return;
    }

    const engine = this.getEngine();
    if (!engine) {
      console.error('❌ Cannot enable camera logging: Rendering engine not found');
      return;
    }

    const viewports = engine.getViewports();
    let enabledCount = 0;

    viewports.forEach(viewport => {
      if (this.isMPRViewport(viewport.id)) {
        const element = viewport.element;

        if (!element) {
          // console.warn(`⚠️ No element found for viewport: ${viewport.id}`);
          return;
        }

        // Log initial focal point (commented out for clarity)
        // console.log(`🎬 Starting camera logging for: ${viewport.id}`);
        // this.logCameraFocalPoint(viewport);

        // Debounced handler to avoid excessive logging
        let debounceTimeout;
        const debouncedHandler = () => {
          clearTimeout(debounceTimeout);
          debounceTimeout = setTimeout(() => {
            this.logCameraFocalPoint(viewport);
          }, 100); // 100ms debounce
        };

        // Handler for camera modified events
        const cameraHandler = (evt: any) => {
          const { element: evtElement } = evt.detail;
          if (evtElement === element) {
            this.logCameraFocalPoint(viewport);
          }
        };

        // Handler for image rendered (fires when scrolling slices)
        const imageRenderedHandler = (evt: any) => {
          const { element: evtElement } = evt.detail;
          if (evtElement === element) {
            debouncedHandler();
          }
        };

        // Store handlers for cleanup
        this.cameraEventListeners.set(viewport.id, {
          element,
          cameraHandler,
          imageRenderedHandler,
          debounceTimeout
        });

        // Listen for camera changes (pan, zoom, rotate)
        element.addEventListener('cornerstonecameramodified', cameraHandler);

        // Listen for image rendered (slice scrolling in MPR)
        element.addEventListener('cornerstoneimagerendered', imageRenderedHandler);

        enabledCount++;
      }
    });

    this.cameraLoggingEnabled = true;
    console.log(`✅ Camera logging enabled (${enabledCount} viewports)`);
    // console.log(`📌 Monitoring viewports: ${this.MPR_VIEWPORT_IDS.join(', ')}`);
    // console.log(`📌 Tracking: Camera changes (pan/zoom/rotate) and slice scrolling`);
  }

  disableCameraLogging(): void {
    if (!this.cameraLoggingEnabled) {
      // console.log('⚠️ Camera logging is already disabled');
      return;
    }

    this.cameraEventListeners.forEach(({ element, cameraHandler, imageRenderedHandler, debounceTimeout }, viewportId) => {
      // Clear any pending debounce timeout
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      // Remove both event listeners
      element.removeEventListener('cornerstonecameramodified', cameraHandler);
      element.removeEventListener('cornerstoneimagerendered', imageRenderedHandler);

      // console.log(`🛑 Stopped camera logging for: ${viewportId}`);
    });

    this.cameraEventListeners.clear();
    this.cameraLoggingEnabled = false;
    console.log('✅ Camera logging disabled');
  }

  isCameraLoggingEnabled(): boolean {
    return this.cameraLoggingEnabled;
  }

  toggleCameraLogging(): void {
    if (this.cameraLoggingEnabled) {
      this.disableCameraLogging();
    } else {
      this.enableCameraLogging();
    }
  }

  // Get current focal points for all MPR viewports
  getCurrentFocalPoints(): Record<string, number[]> {
    const engine = this.getEngine();
    if (!engine) {
      return {};
    }

    const focalPoints: Record<string, number[]> = {};
    const viewports = engine.getViewports();

    viewports.forEach(viewport => {
      if (this.isMPRViewport(viewport.id)) {
        try {
          const camera = viewport.getCamera();
          if (camera && camera.focalPoint) {
            focalPoints[viewport.id] = camera.focalPoint;
          }
        } catch (error) {
          console.error(`❌ Error getting focal point for ${viewport.id}:`, error);
        }
      }
    });

    return focalPoints;
  }

  // Get crosshairs tool center for all MPR viewports
  getCrosshairsToolCenter(): Record<string, { center: number[] | null; isActive: boolean }> {
    const engine = this.getEngine();
    if (!engine) {
      return {};
    }

    const result: Record<string, { center: number[] | null; isActive: boolean }> = {};
    
    try {
      const viewports = engine.getViewports();

      viewports.forEach(viewport => {
        if (this.isMPRViewport(viewport.id)) {
          try {
            // Find the tool group for this viewport using the ToolGroupManager
            const toolGroup = ToolGroupManager.getToolGroupForViewport(
              viewport.id,
              engine.id
            );

            if (!toolGroup) {
              result[viewport.id] = {
                center: null,
                isActive: false,
              };
              return;
            }

            // Get the Crosshairs tool instance from the tool group
            const crosshairsTool = toolGroup.getToolInstance('Crosshairs');

            // Check if crosshairs tool is available and active
            const isActive = crosshairsTool && crosshairsTool.mode === 'Active';

            if (!crosshairsTool) {
              result[viewport.id] = {
                center: null,
                isActive: false,
              };
              return;
            }

            // Get annotations for the crosshairs tool
            const element = viewport.element;
            if (!element) {
              result[viewport.id] = {
                center: null,
                isActive: !!isActive,
              };
              return;
            }

            const annotations = annotation.state.getAnnotations('Crosshairs', element);
            
            // Get the center from the first annotation (crosshairs typically has one annotation per viewport)
            let center = null;
            if (annotations && annotations.length > 0) {
              const firstAnnotation = annotations[0];
              // The center is typically stored in data.handles.rotationPoints or data.handles.toolCenter
              if (firstAnnotation.data?.handles?.rotationPoints) {
                center = firstAnnotation.data.handles.rotationPoints[0]; // World coordinates
              } else if (firstAnnotation.data?.handles?.toolCenter) {
                center = firstAnnotation.data.handles.toolCenter;
              }
            }

            result[viewport.id] = {
              center: center ? [center[0], center[1], center[2]] : null,
              isActive: !!isActive,
            };

          } catch (error) {
            console.error(`❌ Error getting crosshairs center for ${viewport.id}:`, error);
            result[viewport.id] = {
              center: null,
              isActive: false,
            };
          }
        }
      });

    } catch (error) {
      console.error('❌ Error accessing Cornerstone Tools:', error);
    }

    return result;
  }
}

export default ViewportStateService;

```

Perfect! Let me read the final implementation to verify it's complete:

Excellent! I've successfully added the `getCrosshairsToolCenter()` function to `viewportStateService.ts`. Here's what was implemented:

## Summary

### Function Added: `getCrosshairsToolCenter()`

This function is analogous to `getCurrentFocalPoints()` but retrieves the crosshairs tool center instead of the camera focal point.

#### Key Features:

1. **Checks if crosshairs tool is available** ✅
   - Uses `ToolGroupManager.getToolGroupForViewport()` to find the tool group for each viewport
   - Gets the Crosshairs tool instance via `toolGroup.getToolInstance('Crosshairs')`
   - Checks if the tool exists before attempting to get its center

2. **Obtains center by command/API** ✅
   - Uses the annotation state API: `annotation.state.getAnnotations('Crosshairs', element)`
   - Extracts the center coordinates from the annotation data structure
   - Looks for center in two possible locations:
     - `firstAnnotation.data.handles.rotationPoints[0]` (preferred)
     - `firstAnnotation.data.handles.toolCenter` (fallback)

3. **Returns comprehensive information**:
   - Returns a record with viewport IDs as keys
   - Each value contains:
     - `center`: The world coordinates `[x, y, z]` or `null` if not available
     - `isActive`: Boolean indicating if the crosshairs tool is currently active

#### Example Usage:

```typescript
const crosshairsData = viewportStateService.getCrosshairsToolCenter();
// Result:
// {
//   'mpr-axial': { center: [100.5, 200.3, 150.7], isActive: true },
//   'mpr-sagittal': { center: [100.5, 200.3, 150.7], isActive: true },
//   'mpr-coronal': { center: [100.5, 200.3, 150.7], isActive: true }
// }
```

The function includes proper error handling and follows the same pattern as the existing `getCurrentFocalPoints()` function.

```typescript
const crosshairsData = viewportStateService.getCrosshairsToolCenter();
// Result:
// {
//   'mpr-axial': { center: [100.5, 200.3, 150.7], isActive: true },
//   'mpr-sagittal': { center: [100.5, 200.3, 150.7], isActive: true },
//   'mpr-coronal': { center: [100.5, 200.3, 150.7], isActive: true }
// }
```

---

**User**

add the command @viewportStateService.ts (440-526)  to command manager 

---

**Cursor**

I'll add the `getCrosshairsToolCenter` function as a command in the command manager. Let me first examine how other viewport state service commands are registered.

```typescript
import {
  getEnabledElement,
  StackViewport,
  VolumeViewport,
  utilities as csUtils,
  Enums as CoreEnums,
  Types as CoreTypes,
  BaseVolumeViewport,
  getRenderingEngines,
} from '@cornerstonejs/core';
import {
  ToolGroupManager,
  Enums,
  utilities as cstUtils,
  annotation,
  Types as ToolTypes,
} from '@cornerstonejs/tools';
import * as cornerstoneTools from '@cornerstonejs/tools';
import * as labelmapInterpolation from '@cornerstonejs/labelmap-interpolation';
import { ONNXSegmentationController } from '@cornerstonejs/ai';

import { Types as OhifTypes, utils } from '@ohif/core';
import i18n from '@ohif/i18n';
import {
  callInputDialogAutoComplete,
  createReportAsync,
  colorPickerDialog,
  callInputDialog,
} from '@ohif/extension-default';
import { vec3, mat4 } from 'gl-matrix';
import toggleImageSliceSync from './utils/imageSliceSync/toggleImageSliceSync';
import { getFirstAnnotationSelected } from './utils/measurementServiceMappings/utils/selection';
import { getViewportEnabledElement } from './utils/getViewportEnabledElement';
import getActiveViewportEnabledElement from './utils/getActiveViewportEnabledElement';
import toggleVOISliceSync from './utils/toggleVOISliceSync';
import { usePositionPresentationStore, useSegmentationPresentationStore } from './stores';
import { toolNames } from './initCornerstoneTools';
import CornerstoneViewportDownloadForm from './utils/CornerstoneViewportDownloadForm';
import { updateSegmentBidirectionalStats } from './utils/updateSegmentationStats';
import { generateSegmentationCSVReport } from './utils/generateSegmentationCSVReport';
import { getUpdatedViewportsForSegmentation } from './utils/hydrationUtils';
import { SegmentationRepresentations } from '@cornerstonejs/tools/enums';
import { isMeasurementWithinViewport } from './utils/isMeasurementWithinViewport';
import { getCenterExtent } from './utils/getCenterExtent';
import { EasingFunctionEnum } from './utils/transitions';

const { DefaultHistoryMemo } = csUtils.HistoryMemo;
const toggleSyncFunctions = {
  imageSlice: toggleImageSliceSync,
  voi: toggleVOISliceSync,
};

const { segmentation: segmentationUtils } = cstUtils;

const getLabelmapTools = ({ toolGroupService }) => {
  const labelmapTools = [];
  const toolGroupIds = toolGroupService.getToolGroupIds();
  toolGroupIds.forEach(toolGroupId => {
    const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
    const tools = toolGroup.getToolInstances();
    // tools is an object with toolName as the key and tool as the value
    Object.keys(tools).forEach(toolName => {
      const tool = tools[toolName];
      if (tool instanceof cornerstoneTools.LabelmapBaseTool) {
        labelmapTools.push(tool);
      }
    });
  });
  return labelmapTools;
};

const getPreviewTools = ({ toolGroupService }) => {
  const labelmapTools = getLabelmapTools({ toolGroupService });

  const previewTools = labelmapTools.filter(tool => tool.acceptPreview || tool.rejectPreview);

  return previewTools;
};

const segmentAI = new ONNXSegmentationController({
  autoSegmentMode: true,
  models: {
    sam_b: [
      {
        name: 'sam-b-encoder',
        url: 'https://huggingface.co/schmuell/sam-b-fp16/resolve/main/sam_vit_b_01ec64.encoder-fp16.onnx',
        size: 180,
        key: 'encoder',
      },
      {
        name: 'sam-b-decoder',
        url: 'https://huggingface.co/schmuell/sam-b-fp16/resolve/main/sam_vit_b_01ec64.decoder.onnx',
        size: 17,
        key: 'decoder',
      },
    ],
  },
  modelName: 'sam_b',
});
let segmentAIEnabled = false;

function commandsModule({
  servicesManager,
  commandsManager,
  extensionManager,
}: OhifTypes.Extensions.ExtensionParams): OhifTypes.Extensions.CommandsModule {
  const {
    viewportGridService,
    toolGroupService,
    cineService,
    uiDialogService,
    cornerstoneViewportService,
    uiNotificationService,
    measurementService,
    customizationService,
    colorbarService,
    hangingProtocolService,
    syncGroupService,
    segmentationService,
    displaySetService,
    viewportStateService,
  } = servicesManager.services as AppTypes.Services;

  function _getActiveViewportEnabledElement() {
    return getActiveViewportEnabledElement(viewportGridService);
  }

  function _getViewportEnabledElement(viewportId: string) {
    return getViewportEnabledElement(viewportId);
  }

  function _getActiveViewportToolGroupId() {
    const viewport = _getActiveViewportEnabledElement();
    return toolGroupService.getToolGroupForViewport(viewport.id);
  }

  function _getActiveSegmentationInfo() {
    const viewportId = viewportGridService.getActiveViewportId();
    const activeSegmentation = segmentationService.getActiveSegmentation(viewportId);
    const segmentationId = activeSegmentation?.segmentationId;
    const activeSegmentIndex = segmentationService.getActiveSegment(viewportId).segmentIndex;

    return {
      segmentationId,
      segmentIndex: activeSegmentIndex,
    };
  }

  const actions = {
    jumpToMeasurementViewport: ({ annotationUID, measurement }) => {
      cornerstoneTools.annotation.selection.setAnnotationSelected(annotationUID, true);
      const { metadata } = measurement;

      const activeViewportId = viewportGridService.getActiveViewportId();
      // Finds the best viewport to jump to for showing the annotation view reference
      // This may be different from active if there is a viewport already showing the display set.
      const viewportId = cornerstoneViewportService.findNavigationCompatibleViewportId(
        activeViewportId,
        metadata
      );
      if (viewportId) {
        const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);
        viewport.setViewReference(metadata);
        viewport.render();

        /**
         * If the measurement is not visible inside the current viewport,
         * we need to move the camera to the measurement.
         */
        if (!isMeasurementWithinViewport(viewport, measurement)) {
          const camera = viewport.getCamera();
          const { focalPoint: cameraFocalPoint, position: cameraPosition } = camera;
          const { center, extent } = getCenterExtent(measurement);
          const position = vec3.sub(vec3.create(), cameraPosition, cameraFocalPoint);
          vec3.add(position, position, center);
          viewport.setCamera({ focalPoint: center, position: position as any });
          /** Zoom out if the measurement is too large */
          const measurementSize = vec3.dist(extent.min, extent.max);
          if (measurementSize > camera.parallelScale) {
            const scaleFactor = measurementSize / camera.parallelScale;
            viewport.setZoom(viewport.getZoom() / scaleFactor);
          }
          viewport.render();
        }

        return;
      }

      const { displaySetInstanceUID: referencedDisplaySetInstanceUID } = measurement;
      if (!referencedDisplaySetInstanceUID) {
        console.warn('ViewportGrid::No display set found in', measurement);
        return;
      }

      // Finds the viewport to update to show the given displayset/orientation.
      // This will choose a view already containing the measurement display set
      // if possible, otherwise will fallback to the active.
      const viewportToUpdate = cornerstoneViewportService.findUpdateableViewportConfiguration(
        activeViewportId,
        measurement
      );

      if (!viewportToUpdate) {
        console.warn('Unable to find a viewport to show this in');
        return;
      }
      const updatedViewports = hangingProtocolService.getViewportsRequireUpdate(
        viewportToUpdate.viewportId,
        referencedDisplaySetInstanceUID
      );

      if (!updatedViewports?.[0]) {
        console.warn(
          'ViewportGrid::Unable to navigate to viewport containing',
          referencedDisplaySetInstanceUID
        );
        return;
      }

      updatedViewports[0].viewportOptions = viewportToUpdate.viewportOptions;

      // Update stored position presentation
      commandsManager.run('updateStoredPositionPresentation', {
        viewportId: viewportToUpdate.viewportId,
        displaySetInstanceUIDs: [referencedDisplaySetInstanceUID],
        referencedImageId: measurement.referencedImageId,
        options: {
          ...measurement.metadata,
        },
      });

      commandsManager.run('setDisplaySetsForViewports', { viewportsToUpdate: updatedViewports });
    },

    hydrateSecondaryDisplaySet: async ({ displaySet, viewportId }) => {
      if (!displaySet) {
        return;
      }

      if (displaySet.isOverlayDisplaySet) {
        // update the previously stored segmentationPresentation with the new viewportId
        // presentation so that when we put the referencedDisplaySet back in the viewport
        // it will have the correct segmentation representation hydrated
        commandsManager.runCommand('updateStoredSegmentationPresentation', {
          displaySet,
          type:
            displaySet.Modality === 'SEG'
              ? SegmentationRepresentations.Labelmap
              : SegmentationRepresentations.Contour,
        });
      }

      const referencedDisplaySetInstanceUID = displaySet.referencedDisplaySetInstanceUID;

      const storePositionPresentation = refDisplaySet => {
        // update the previously stored positionPresentation with the new viewportId
        // presentation so that when we put the referencedDisplaySet back in the viewport
        // it will be in the correct position zoom and pan
        commandsManager.runCommand('updateStoredPositionPresentation', {
          viewportId,
          displaySetInstanceUIDs: [refDisplaySet.displaySetInstanceUID],
        });
      };

      if (displaySet.Modality === 'SEG' || displaySet.Modality === 'RTSTRUCT') {
        const referencedDisplaySet = displaySetService.getDisplaySetByUID(
          referencedDisplaySetInstanceUID
        );
        storePositionPresentation(referencedDisplaySet);
        return commandsManager.runCommand('loadSegmentationDisplaySetsForViewport', {
          viewportId,
          displaySetInstanceUIDs: [referencedDisplaySet.displaySetInstanceUID],
        });
      } else if (displaySet.Modality === 'SR') {
        const results = commandsManager.runCommand('hydrateStructuredReport', {
          displaySetInstanceUID: displaySet.displaySetInstanceUID,
        });
        const { SeriesInstanceUIDs } = results;
        const referencedDisplaySets = displaySetService.getDisplaySetsForSeries(
          SeriesInstanceUIDs[0]
        );
        referencedDisplaySets.forEach(storePositionPresentation);

        if (referencedDisplaySets.length) {
          actions.setDisplaySetsForViewports({
            viewportsToUpdate: [
              {
                viewportId: viewportGridService.getActiveViewportId(),
                displaySetInstanceUIDs: [referencedDisplaySets[0].displaySetInstanceUID],
              },
            ],
          });
        }
        return results;
      }
    },
    runSegmentBidirectional: async ({ segmentationId, segmentIndex } = {}) => {
      // Get active segmentation if not specified
      const targetSegmentation =
        segmentationId && segmentIndex
          ? { segmentationId, segmentIndex }
          : _getActiveSegmentationInfo();

      const { segmentationId: targetId, segmentIndex: targetIndex } = targetSegmentation;

      // Get bidirectional measurement data
      const bidirectionalData = await cstUtils.segmentation.getSegmentLargestBidirectional({
        segmentationId: targetId,
        segmentIndices: [targetIndex],
      });

      const activeViewportId = viewportGridService.getActiveViewportId();

      // Process each bidirectional measurement
      bidirectionalData.forEach(measurement => {
        const { segmentIndex, majorAxis, minorAxis } = measurement;

        // Create annotation
        const annotation = cornerstoneTools.SegmentBidirectionalTool.hydrate(
          activeViewportId,
          [majorAxis, minorAxis],
          {
            segmentIndex,
            segmentationId: targetId,
          }
        );

        measurement.annotationUID = annotation.annotationUID;

        // Update segmentation stats
        const updatedSegmentation = updateSegmentBidirectionalStats({
          segmentationId: targetId,
          segmentIndex: targetIndex,
          bidirectionalData: measurement,
          segmentationService,
          annotation,
        });

        // Save changes if needed
        if (updatedSegmentation) {
          segmentationService.addOrUpdateSegmentation({
            segmentationId: targetId,
            segments: updatedSegmentation.segments,
          });
        }
      });

      // get the active segmentIndex bidirectional annotation and jump to it
      const activeBidirectional = bidirectionalData.find(
        measurement => measurement.segmentIndex === targetIndex
      );
      commandsManager.run('jumpToMeasurement', {
        uid: activeBidirectional.annotationUID,
      });
    },
    interpolateLabelmap: () => {
      const { segmentationId, segmentIndex } = _getActiveSegmentationInfo();
      labelmapInterpolation.interpolate({
        segmentationId,
        segmentIndex,
      });
    },
    /**
     * Generates the selector props for the context menu, specific to
     * the cornerstone viewport, and then runs the context menu.
     */
    showCornerstoneContextMenu: options => {
      const element = _getActiveViewportEnabledElement()?.viewport?.element;

      const optionsToUse = { ...options, element };
      const { useSelectedAnnotation, nearbyToolData, event } = optionsToUse;

      // This code is used to invoke the context menu via keyboard shortcuts
      if (useSelectedAnnotation && !nearbyToolData) {
        const firstAnnotationSelected = getFirstAnnotationSelected(element);
        // filter by allowed selected tools from config property (if there is any)
        const isToolAllowed =
          !optionsToUse.allowedSelectedTools ||
          optionsToUse.allowedSelectedTools.includes(firstAnnotationSelected?.metadata?.toolName);
        if (isToolAllowed) {
          optionsToUse.nearbyToolData = firstAnnotationSelected;
        } else {
          return;
        }
      }

      optionsToUse.defaultPointsPosition = [];
      // if (optionsToUse.nearbyToolData) {
      //   optionsToUse.defaultPointsPosition = commandsManager.runCommand(
      //     'getToolDataActiveCanvasPoints',
      //     { toolData: optionsToUse.nearbyToolData }
      //   );
      // }

      // TODO - make the selectorProps richer by including the study metadata and display set.
      optionsToUse.selectorProps = {
        toolName: optionsToUse.nearbyToolData?.metadata?.toolName,
        value: optionsToUse.nearbyToolData,
        uid: optionsToUse.nearbyToolData?.annotationUID,
        nearbyToolData: optionsToUse.nearbyToolData,
        event,
        ...optionsToUse.selectorProps,
      };

      commandsManager.run(options, optionsToUse);
    },
    updateStoredSegmentationPresentation: ({ displaySet, type }) => {
      const { addSegmentationPresentationItem } = useSegmentationPresentationStore.getState();

      const referencedDisplaySetInstanceUID = displaySet.referencedDisplaySetInstanceUID;
      addSegmentationPresentationItem(referencedDisplaySetInstanceUID, {
        segmentationId: displaySet.displaySetInstanceUID,
        hydrated: true,
        type,
      });
    },

    /** Stores the changed position presentation */
    updateStoredPositionPresentation: ({
      viewportId,
      displaySetInstanceUIDs,
      referencedImageId,
      options,
    }) => {
      const presentations = cornerstoneViewportService.getPresentations(viewportId);
      const { positionPresentationStore, setPositionPresentation, getPositionPresentationId } =
        usePositionPresentationStore.getState();

      // Look inside positionPresentationStore and find the key that includes ALL the displaySetInstanceUIDs
      // and the value has viewportId as activeViewportId.
      let previousReferencedDisplaySetStoreKey;

      if (
        displaySetInstanceUIDs &&
        Array.isArray(displaySetInstanceUIDs) &&
        displaySetInstanceUIDs.length > 0
      ) {
        previousReferencedDisplaySetStoreKey = Object.entries(positionPresentationStore).find(
          ([key, value]) => {
            return (
              displaySetInstanceUIDs.every(uid => key.includes(uid)) &&
              value?.viewportId === viewportId
            );
          }
        )?.[0];
      }

      // Create presentation data with referencedImageId and options if provided
      const presentationData =
        referencedImageId || options?.FrameOfReferenceUID
          ? {
              ...presentations.positionPresentation,
              viewReference: {
                referencedImageId,
                ...options,
              },
            }
          : presentations.positionPresentation;

      if (previousReferencedDisplaySetStoreKey) {
        setPositionPresentation(previousReferencedDisplaySetStoreKey, presentationData);
        return;
      }

      // if not found means we have not visited that referencedDisplaySetInstanceUID before
      // so we need to grab the positionPresentationId directly from the store,
      // Todo: this is really hacky, we should have a better way for this
      const positionPresentationId = getPositionPresentationId({
        displaySetInstanceUIDs,
        viewportId,
      });

      setPositionPresentation(positionPresentationId, presentationData);
    },
    getNearbyToolData({ nearbyToolData, element, canvasCoordinates }) {
      return nearbyToolData ?? cstUtils.getAnnotationNearPoint(element, canvasCoordinates);
    },
    getNearbyAnnotation({ element, canvasCoordinates }) {
      const nearbyToolData = actions.getNearbyToolData({
        nearbyToolData: null,
        element,
        canvasCoordinates,
      });

      const isAnnotation = toolName => {
        const enabledElement = getEnabledElement(element);

        if (!enabledElement) {
          return;
        }

        const { renderingEngineId, viewportId } = enabledElement;
        const toolGroup = ToolGroupManager.getToolGroupForViewport(viewportId, renderingEngineId);

        const toolInstance = toolGroup.getToolInstance(toolName);

        return toolInstance?.constructor?.isAnnotation ?? true;
      };

      return nearbyToolData?.metadata?.toolName && isAnnotation(nearbyToolData.metadata.toolName)
        ? nearbyToolData
        : null;
    },
    /**
     * Common logic for handling measurement label updates through dialog
     * @param uid - measurement uid
     * @returns Promise that resolves when the label is updated
     */
    _handleMeasurementLabelDialog: async uid => {
      const labelConfig = customizationService.getCustomization('measurementLabels');
      const renderContent = customizationService.getCustomization('ui.labellingComponent');
      const measurement = measurementService.getMeasurement(uid);

      if (!measurement) {
        console.debug('No measurement found for label editing');
        return;
      }

      if (!labelConfig) {
        const label = await callInputDialog({
          uiDialogService,
          title: i18n.t('Tools:Edit Measurement Label'),
          placeholder: measurement.label || i18n.t('Tools:Enter new label'),
          defaultValue: measurement.label,
        });

        if (label !== undefined && label !== null) {
          measurementService.update(uid, { ...measurement, label }, true);
        }
        return;
      }

      const val = await callInputDialogAutoComplete({
        measurement,
        uiDialogService,
        labelConfig,
        renderContent,
      });

      if (val !== undefined && val !== null) {
        measurementService.update(uid, { ...measurement, label: val }, true);
      }
    },
    /**
     * Show the measurement labelling input dialog and update the label
     * on the measurement with a response if not cancelled.
     */
    setMeasurementLabel: async ({ uid }) => {
      await actions._handleMeasurementLabelDialog(uid);
    },
    renameMeasurement: async ({ uid }) => {
      await actions._handleMeasurementLabelDialog(uid);
    },
    /**
     *
     * @param props - containing the updates to apply
     * @param props.measurementKey - chooses the measurement key to apply the
     *        code to.  This will typically be finding or site to apply a
     *        finding code or a findingSites code.
     * @param props.code - A coding scheme value from DICOM, including:
     *       * CodeValue - the language independent code, for example '1234'
     *       * CodingSchemeDesignator - the issue of the code value
     *       * CodeMeaning - the text value shown to the user
     *       * ref - a string reference in the form `<designator>:<codeValue>`
     *       * type - defaulting to 'finding'.  Will replace other codes of same type
     *       * style - a styling object to use
     *       * Other fields
     *     Note it is a valid option to remove the finding or site values by
     *     supplying null for the code.
     * @param props.uid - the measurement UID to find it with
     * @param props.label - the text value for the code.  Has NOTHING to do with
     *        the measurement label, which can be set with textLabel
     * @param props.textLabel is the measurement label to apply.  Set to null to
     *            delete.
     *
     * If the measurementKey is `site`, then the code will also be added/replace
     * the 0 element of findingSites.  This behaviour is expected to be enhanced
     * in the future with ability to set other site information.
     */
    updateMeasurement: props => {
      const { code, uid, textLabel, label } = props;
      let { style } = props;
      const measurement = measurementService.getMeasurement(uid);
      if (!measurement) {
        console.warn('No measurement found to update', uid);
        return;
      }
      const updatedMeasurement = {
        ...measurement,
      };
      // Call it textLabel as the label value
      // TODO - remove the label setting when direct rendering of findingSites is enabled
      if (textLabel !== undefined) {
        updatedMeasurement.label = textLabel;
      }
      if (code !== undefined) {
        const measurementKey = code.type || 'finding';

        if (code.ref && !code.CodeValue) {
          const split = code.ref.indexOf(':');
          code.CodeValue = code.ref.substring(split + 1);
          code.CodeMeaning = code.text || label;
          code.CodingSchemeDesignator = code.ref.substring(0, split);
        }
        updatedMeasurement[measurementKey] = code;
        if (measurementKey !== 'finding') {
          if (updatedMeasurement.findingSites) {
            updatedMeasurement.findingSites = updatedMeasurement.findingSites.filter(
              it => it.type !== measurementKey
            );
            updatedMeasurement.findingSites.push(code);
          } else {
            updatedMeasurement.findingSites = [code];
          }
        }
      }

      style ||= updatedMeasurement.finding?.style;
      style ||= updatedMeasurement.findingSites?.find(site => site?.style)?.style;

      if (style) {
        // Reset the selected values to preserve appearance on selection
        style.lineDashSelected ||= style.lineDash;
        annotation.config.style.setAnnotationStyles(measurement.uid, style);

        // this is a bit ugly, but given the underlying behavior, this is how it needs to work.
        switch (measurement.toolName) {
          case toolNames.PlanarFreehandROI: {
            const targetAnnotation = annotation.state.getAnnotation(measurement.uid);
            targetAnnotation.data.isOpenUShapeContour = !!style.isOpenUShapeContour;
            break;
          }
          default:
            break;
        }
      }
      measurementService.update(updatedMeasurement.uid, updatedMeasurement, true);
    },

    /**
     * Jumps to the specified (by uid) measurement in the active viewport.
     * Also marks any provided display measurements isActive value
     */
    jumpToMeasurement: ({ uid, displayMeasurements = [] }) => {
      measurementService.jumpToMeasurement(viewportGridService.getActiveViewportId(), uid);
      for (const measurement of displayMeasurements) {
        measurement.isActive = measurement.uid === uid;
      }
    },

    removeMeasurement: ({ uid }) => {
      if (Array.isArray(uid)) {
        measurementService.removeMany(uid);
      } else {
        measurementService.remove(uid);
      }
    },

    toggleLockMeasurement: ({ uid }) => {
      measurementService.toggleLockMeasurement(uid);
    },

    toggleVisibilityMeasurement: ({ uid, items, visibility }) => {
      if (visibility === undefined && items?.length) {
        visibility = !items[0].isVisible;
      }
      if (Array.isArray(uid)) {
        measurementService.toggleVisibilityMeasurementMany(uid, visibility);
      } else {
        measurementService.toggleVisibilityMeasurement(uid, visibility);
      }
    },

    /**
     * Download the CSV report for the measurements.
     */
    downloadCSVMeasurementsReport: ({ measurementFilter }) => {
      utils.downloadCSVReport(measurementService.getMeasurements(measurementFilter));
    },

    downloadCSVSegmentationReport: ({ segmentationId }) => {
      const segmentation = segmentationService.getSegmentation(segmentationId);

      const { representationData } = segmentation;
      const { Labelmap } = representationData;
      const { referencedImageIds } = Labelmap;

      const firstImageId = referencedImageIds[0];

      // find displaySet for firstImageId
      const displaySet = displaySetService
        .getActiveDisplaySets()
        .find(ds => ds.imageIds?.some(i => i === firstImageId));

      const {
        SeriesNumber,
        SeriesInstanceUID,
        StudyInstanceUID,
        SeriesDate,
        SeriesTime,
        SeriesDescription,
      } = displaySet;

      const additionalInfo = {
        reference: {
          SeriesNumber,
          SeriesInstanceUID,
          StudyInstanceUID,
          SeriesDate,
          SeriesTime,
          SeriesDescription,
        },
      };

      generateSegmentationCSVReport(segmentation, additionalInfo);
    },

    // Retrieve value commands
    getActiveViewportEnabledElement: _getActiveViewportEnabledElement,

    setViewportActive: ({ viewportId }) => {
      const viewportInfo = cornerstoneViewportService.getViewportInfo(viewportId);
      if (!viewportInfo) {
        console.warn('No viewport found for viewportId:', viewportId);
        return;
      }

      viewportGridService.setActiveViewportId(viewportId);
    },
    arrowTextCallback: async ({ callback, data }) => {
      const labelConfig = customizationService.getCustomization('measurementLabels');
      const renderContent = customizationService.getCustomization('ui.labellingComponent');

      if (!labelConfig) {
        const label = await callInputDialog({
          uiDialogService,
          title: i18n.t('Tools:Edit Arrow Text'),
          placeholder: data?.data?.label || i18n.t('Tools:Enter new text'),
          defaultValue: data?.data?.label || '',
        });

        callback?.(label);
        return;
      }

      const value = await callInputDialogAutoComplete({
        uiDialogService,
        labelConfig,
        renderContent,
      });
      callback?.(value);
    },

    toggleCine: () => {
      const { viewports } = viewportGridService.getState();
      const { isCineEnabled } = cineService.getState();
      cineService.setIsCineEnabled(!isCineEnabled);
      viewports.forEach((_, index) => cineService.setCine({ id: index, isPlaying: false }));
    },

    setViewportWindowLevel({
      viewportId,
      windowWidth,
      windowCenter,
      displaySetInstanceUID,
    }: {
      viewportId: string;
      windowWidth: number;
      windowCenter: number;
      displaySetInstanceUID?: string;
    }) {
      // convert to numbers
      const windowWidthNum = Number(windowWidth);
      const windowCenterNum = Number(windowCenter);

      // get actor from the viewport
      const renderingEngine = cornerstoneViewportService.getRenderingEngine();
      const viewport = renderingEngine.getViewport(viewportId);

      const { lower, upper } = csUtils.windowLevel.toLowHighRange(windowWidthNum, windowCenterNum);

      if (viewport instanceof BaseVolumeViewport) {
        const volumeId = actions.getVolumeIdForDisplaySet({
          viewportId,
          displaySetInstanceUID,
        });
        viewport.setProperties(
          {
            voiRange: {
              upper,
              lower,
            },
          },
          volumeId
        );
      } else {
        viewport.setProperties({
          voiRange: {
            upper,
            lower,
          },
        });
      }
      viewport.render();
    },
    toggleViewportColorbar: ({ viewportId, displaySetInstanceUIDs, options = {} }) => {
      const hasColorbar = colorbarService.hasColorbar(viewportId);
      if (hasColorbar) {
        colorbarService.removeColorbar(viewportId);
        return;
      }
      colorbarService.addColorbar(viewportId, displaySetInstanceUIDs, options);
    },
    setWindowLevel(props) {
      const { toolGroupId } = props;
      const { viewportId } = _getActiveViewportEnabledElement();
      const viewportToolGroupId = toolGroupService.getToolGroupForViewport(viewportId);

      if (toolGroupId && toolGroupId !== viewportToolGroupId) {
        return;
      }

      actions.setViewportWindowLevel({ ...props, viewportId });
    },
    setWindowLevelPreset: ({ presetName, presetIndex }) => {
      const windowLevelPresets = customizationService.getCustomization(
        'cornerstone.windowLevelPresets'
      );

      const activeViewport = viewportGridService.getActiveViewportId();
      const viewport = cornerstoneViewportService.getCornerstoneViewport(activeViewport);
      const metadata = viewport.getImageData().metadata;

      const modality = metadata.Modality;

      if (!modality) {
        return;
      }

      const windowLevelPresetForModality = windowLevelPresets[modality];

      if (!windowLevelPresetForModality) {
        return;
      }

      const windowLevelPreset =
        windowLevelPresetForModality[presetName] ??
        Object.values(windowLevelPresetForModality)[presetIndex];

      actions.setViewportWindowLevel({
        viewportId: activeViewport,
        windowWidth: windowLevelPreset.window,
        windowCenter: windowLevelPreset.level,
      });
    },
    getVolumeIdForDisplaySet: ({ viewportId, displaySetInstanceUID }) => {
      const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);
      if (viewport instanceof BaseVolumeViewport) {
        const volumeIds = viewport.getAllVolumeIds();
        const volumeId = volumeIds.find(id => id.includes(displaySetInstanceUID));
        return volumeId;
      }
      return null;
    },
    setToolEnabled: ({ toolName, toggle, toolGroupId }) => {
      const { viewports } = viewportGridService.getState();

      if (!viewports.size) {
        return;
      }

      const toolGroup = toolGroupService.getToolGroup(toolGroupId ?? null);

      if (!toolGroup || !toolGroup.hasTool(toolName)) {
        return;
      }

      const toolIsEnabled = toolGroup.getToolOptions(toolName).mode === Enums.ToolModes.Enabled;

      // Toggle the tool's state only if the toggle is true
      if (toggle) {
        toolIsEnabled ? toolGroup.setToolDisabled(toolName) : toolGroup.setToolEnabled(toolName);
      } else {
        toolGroup.setToolEnabled(toolName);
      }

      const renderingEngine = cornerstoneViewportService.getRenderingEngine();
      renderingEngine.render();
    },
    toggleEnabledDisabledToolbar({ value, itemId, toolGroupId }) {
      const toolName = itemId || value;
      toolGroupId = toolGroupId ?? _getActiveViewportToolGroupId();

      const toolGroup = toolGroupService.getToolGroup(toolGroupId);
      if (!toolGroup || !toolGroup.hasTool(toolName)) {
        return;
      }

      const toolIsEnabled = toolGroup.getToolOptions(toolName).mode === Enums.ToolModes.Enabled;

      toolIsEnabled ? toolGroup.setToolDisabled(toolName) : toolGroup.setToolEnabled(toolName);
    },
    toggleActiveDisabledToolbar({ value, itemId, toolGroupId }) {
      const toolName = itemId || value;
      toolGroupId = toolGroupId ?? _getActiveViewportToolGroupId();
      const toolGroup = toolGroupService.getToolGroup(toolGroupId);
      if (!toolGroup || !toolGroup.hasTool(toolName)) {
        return;
      }

      const toolIsActive = [
        Enums.ToolModes.Active,
        Enums.ToolModes.Enabled,
        Enums.ToolModes.Passive,
      ].includes(toolGroup.getToolOptions(toolName).mode);

      toolIsActive
        ? toolGroup.setToolDisabled(toolName)
        : actions.setToolActive({ toolName, toolGroupId });

      // we should set the previously active tool to active after we set the
      // current tool disabled
      if (toolIsActive) {
        const prevToolName = toolGroup.getPrevActivePrimaryToolName();
        if (prevToolName !== toolName) {
          actions.setToolActive({ toolName: prevToolName, toolGroupId });
        }
      }
    },
    setToolActiveToolbar: ({ value, itemId, toolName, toolGroupIds = [] }) => {
      // Sometimes it is passed as value (tools with options), sometimes as itemId (toolbar buttons)
      toolName = toolName || itemId || value;

      toolGroupIds = toolGroupIds.length ? toolGroupIds : toolGroupService.getToolGroupIds();

      toolGroupIds.forEach(toolGroupId => {
        actions.setToolActive({ toolName, toolGroupId });
      });
    },
    setToolActive: ({ toolName, toolGroupId = null }) => {
      const { viewports } = viewportGridService.getState();

      if (!viewports.size) {
        return;
      }

      const toolGroup = toolGroupService.getToolGroup(toolGroupId);

      if (!toolGroup) {
        return;
      }

      if (!toolGroup?.hasTool(toolName)) {
        return;
      }

      const activeToolName = toolGroup.getActivePrimaryMouseButtonTool();

      if (activeToolName) {
        const activeToolOptions = toolGroup.getToolConfiguration(activeToolName);
        activeToolOptions?.disableOnPassive
          ? toolGroup.setToolDisabled(activeToolName)
          : toolGroup.setToolPassive(activeToolName);
      }

      // Set the new toolName to be active
      toolGroup.setToolActive(toolName, {
        bindings: [
          {
            mouseButton: Enums.MouseBindings.Primary,
          },
        ],
      });
    },
    // capture viewport
    showDownloadViewportModal: () => {
      const { activeViewportId } = viewportGridService.getState();

      if (!cornerstoneViewportService.getCornerstoneViewport(activeViewportId)) {
        // Cannot download a non-cornerstone viewport (image).
        uiNotificationService.show({
          title: i18n.t('Tools:Download Image'),
          message: i18n.t('Tools:Image cannot be downloaded'),
          type: 'error',
        });
        return;
      }

      const { uiModalService } = servicesManager.services;

      if (uiModalService) {
        uiModalService.show({
          content: CornerstoneViewportDownloadForm,
          title: i18n.t('Tools:Download High Quality Image'),
          contentProps: {
            activeViewportId,
            cornerstoneViewportService,
          },
          containerClassName: 'max-w-4xl p-4',
        });
      }
    },
    /**
     * Rotates the viewport by `rotation` relative to its current rotation.
     */
    rotateViewportBy: ({ rotation, viewportId }: { rotation: number; viewportId?: string }) => {
      actions._rotateViewport({ rotation, viewportId, rotationMode: 'apply' });
    },
    /**
     * Sets the viewport rotation to an absolute value `rotation`.
     */
    setViewportRotation: ({ rotation, viewportId }: { rotation: number; viewportId?: string }) => {
      actions._rotateViewport({ rotation, viewportId, rotationMode: 'set' });
    },
    flipViewportHorizontal: ({
      viewportId,
      newValue = 'toggle',
    }: {
      viewportId?: string;
      newValue?: 'toggle' | boolean;
    }) => {
      const enabledElement = viewportId
        ? _getViewportEnabledElement(viewportId)
        : _getActiveViewportEnabledElement();

      if (!enabledElement) {
        return;
      }

      const { viewport } = enabledElement;

      let flipHorizontal: boolean;
      if (newValue === 'toggle') {
        const { flipHorizontal: currentHorizontalFlip } = viewport.getCamera();
        flipHorizontal = !currentHorizontalFlip;
      } else {
        flipHorizontal = newValue;
      }

      viewport.setCamera({ flipHorizontal });
      viewport.render();
    },
    flipViewportVertical: ({
      viewportId,
      newValue = 'toggle',
    }: {
      viewportId?: string;
      newValue?: 'toggle' | boolean;
    }) => {
      const enabledElement = viewportId
        ? _getViewportEnabledElement(viewportId)
        : _getActiveViewportEnabledElement();

      if (!enabledElement) {
        return;
      }

      const { viewport } = enabledElement;

      let flipVertical: boolean;
      if (newValue === 'toggle') {
        const { flipVertical: currentVerticalFlip } = viewport.getCamera();
        flipVertical = !currentVerticalFlip;
      } else {
        flipVertical = newValue;
      }
      viewport.setCamera({ flipVertical });
      viewport.render();
    },
    invertViewport: ({ element }) => {
      let enabledElement;

      if (element === undefined) {
        enabledElement = _getActiveViewportEnabledElement();
      } else {
        enabledElement = element;
      }

      if (!enabledElement) {
        return;
      }

      const { viewport } = enabledElement;

      const { invert } = viewport.getProperties();
      viewport.setProperties({ invert: !invert });
      viewport.render();
    },
    resetViewport: () => {
      const enabledElement = _getActiveViewportEnabledElement();

      if (!enabledElement) {
        return;
      }

      const { viewport } = enabledElement;

      viewport.resetProperties?.();
      viewport.resetCamera();

      viewport.render();
    },
    scaleViewport: ({ direction }) => {
      const enabledElement = _getActiveViewportEnabledElement();
      const scaleFactor = direction > 0 ? 0.9 : 1.1;

      if (!enabledElement) {
        return;
      }
      const { viewport } = enabledElement;

      if (viewport instanceof StackViewport) {
        if (direction) {
          const { parallelScale } = viewport.getCamera();
          viewport.setCamera({ parallelScale: parallelScale * scaleFactor });
          viewport.render();
        } else {
          viewport.resetCamera();
          viewport.render();
        }
      }
    },

    /** Jumps the active viewport or the specified one to the given slice index */
    jumpToImage: ({ imageIndex, viewport: gridViewport }): void => {
      // Get current active viewport (return if none active)
      let viewport;
      if (!gridViewport) {
        const enabledElement = _getActiveViewportEnabledElement();
        if (!enabledElement) {
          return;
        }
        viewport = enabledElement.viewport;
      } else {
        viewport = cornerstoneViewportService.getCornerstoneViewport(gridViewport.id);
      }

      // Get number of slices
      // -> Copied from cornerstone3D jumpToSlice\_getImageSliceData()
      let numberOfSlices = 0;

      if (viewport instanceof StackViewport) {
        numberOfSlices = viewport.getImageIds().length;
      } else if (viewport instanceof VolumeViewport) {
        numberOfSlices = csUtils.getImageSliceDataForVolumeViewport(viewport).numberOfSlices;
      } else {
        throw new Error('Unsupported viewport type');
      }

      const jumpIndex = imageIndex < 0 ? numberOfSlices + imageIndex : imageIndex;
      if (jumpIndex >= numberOfSlices || jumpIndex < 0) {
        throw new Error(`Can't jump to ${imageIndex}`);
      }

      // Set slice to last slice
      const options = { imageIndex: jumpIndex };
      csUtils.jumpToSlice(viewport.element, options);
    },
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
    setViewportColormap: ({
      viewportId,
      displaySetInstanceUID,
      colormap,
      opacity = 1,
      immediate = false,
    }) => {
      const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);

      let hpOpacity;
      // Retrieve active protocol's viewport match details
      const { viewportMatchDetails } = hangingProtocolService.getActiveProtocol();
      // Get display set options for the specified viewport ID
      const displaySetsInfo = viewportMatchDetails.get(viewportId)?.displaySetsInfo;

      if (displaySetsInfo) {
        // Find the display set that matches the given UID
        const matchingDisplaySet = displaySetsInfo.find(
          displaySet => displaySet.displaySetInstanceUID === displaySetInstanceUID
        );
        // If a matching display set is found, update the opacity with its value
        hpOpacity = matchingDisplaySet?.displaySetOptions?.options?.colormap?.opacity;
      }

      // HP takes priority over the default opacity
      colormap = { ...colormap, opacity: hpOpacity || opacity };

      if (viewport instanceof StackViewport) {
        viewport.setProperties({ colormap });
      }

      if (viewport instanceof VolumeViewport) {
        if (!displaySetInstanceUID) {
          const { viewports } = viewportGridService.getState();
          displaySetInstanceUID = viewports.get(viewportId)?.displaySetInstanceUIDs[0];
        }

        // ToDo: Find a better way of obtaining the volumeId that corresponds to the displaySetInstanceUID
        const volumeId =
          viewport
            .getAllVolumeIds()
            .find((_volumeId: string) => _volumeId.includes(displaySetInstanceUID)) ??
          viewport.getVolumeId();
        viewport.setProperties({ colormap }, volumeId);
      }

      if (immediate) {
        viewport.render();
      }
    },
    changeActiveViewport: ({ direction = 1 }) => {
      const { activeViewportId, viewports } = viewportGridService.getState();
      const viewportIds = Array.from(viewports.keys());
      const currentIndex = viewportIds.indexOf(activeViewportId);
      const nextViewportIndex =
        (currentIndex + direction + viewportIds.length) % viewportIds.length;
      viewportGridService.setActiveViewportId(viewportIds[nextViewportIndex] as string);
    },
    /**
     * If the syncId is given and a synchronizer with that ID already exists, it will
     * toggle it on/off for the provided viewports. If not, it will attempt to create
     * a new synchronizer using the given syncId and type for the specified viewports.
     * If no viewports are provided, you may notice some default behavior.
     * - 'voi' type, we will aim to synchronize all viewports with the same modality
     * -'imageSlice' type, we will aim to synchronize all viewports with the same orientation.
     *
     * @param options
     * @param options.viewports - The viewports to synchronize
     * @param options.syncId - The synchronization group ID
     * @param options.type - The type of synchronization to perform
     */
    toggleSynchronizer: ({ type, viewports, syncId }) => {
      const synchronizer = syncGroupService.getSynchronizer(syncId);

      if (synchronizer) {
        synchronizer.isDisabled() ? synchronizer.setEnabled(true) : synchronizer.setEnabled(false);
        return;
      }

      const fn = toggleSyncFunctions[type];

      if (fn) {
        fn({
          servicesManager,
          viewports,
          syncId,
        });
      }
    },
    setViewportForToolConfiguration: ({ viewportId, toolName }) => {
      if (!viewportId) {
        const { activeViewportId } = viewportGridService.getState();
        viewportId = activeViewportId ?? 'default';
      }

      const toolGroup = toolGroupService.getToolGroupForViewport(viewportId);

      if (!toolGroup?.hasTool(toolName)) {
        return;
      }

      const prevConfig = toolGroup?.getToolConfiguration(toolName);
      toolGroup?.setToolConfiguration(
        toolName,
        {
          ...prevConfig,
          sourceViewportId: viewportId,
        },
        true // overwrite
      );

      const renderingEngine = cornerstoneViewportService.getRenderingEngine();
      renderingEngine.render();
    },
    storePresentation: ({ viewportId }) => {
      cornerstoneViewportService.storePresentation({ viewportId });
    },
    updateVolumeData: ({ volume }) => {
      // update vtkOpenGLTexture and imageData of computed volume
      const { imageData, vtkOpenGLTexture } = volume;
      const numSlices = imageData.getDimensions()[2];
      const slicesToUpdate = [...Array(numSlices).keys()];
      slicesToUpdate.forEach(i => {
        vtkOpenGLTexture.setUpdatedFrame(i);
      });
      imageData.modified();
    },

    attachProtocolViewportDataListener: ({ protocol, stageIndex }) => {
      const EVENT = cornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED;
      const command = protocol.callbacks.onViewportDataInitialized;
      const numPanes = protocol.stages?.[stageIndex]?.viewports.length ?? 1;
      let numPanesWithData = 0;
      const { unsubscribe } = cornerstoneViewportService.subscribe(EVENT, evt => {
        numPanesWithData++;

        if (numPanesWithData === numPanes) {
          commandsManager.run(...command);

          // Unsubscribe from the event
          unsubscribe(EVENT);
        }
      });
    },

    setViewportPreset: ({ viewportId, preset }) => {
      const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);
      if (!viewport) {
        return;
      }
      viewport.setProperties({
        preset,
      });

      // After setting preset, ensure sample distance is safe for volume rendering (3D and MPR)
      // This prevents "steps required exceeds maximum" errors by adjusting the sample distance
      const isVolumeViewport = viewport.type === CoreEnums.ViewportType.VOLUME_3D ||
                               viewport.type === CoreEnums.ViewportType.ORTHOGRAPHIC;

      if (isVolumeViewport) {
        console.log(`[setViewportPreset] Processing viewport type: ${viewport.type}, preset: ${preset}`);
        try {
          const actors = viewport.getActors();
          if (actors && actors.length > 0) {
            const { actor } = actors[0];
            const mapper = actor.getMapper();
            if (mapper && mapper.setSampleDistance) {
              const image = mapper.getInputData?.();
              if (image) {
                const dims = image.getDimensions();
                const spacing = image.getSpacing();
                const spatialDiagonal = Math.sqrt(
                  (dims[0] * spacing[0]) ** 2 +
                  (dims[1] * spacing[1]) ** 2 +
                  (dims[2] * spacing[2]) ** 2
                );
                const maxSamples = mapper.getMaximumSamplesPerRay?.() || 4000;
                const minRequiredDistance = (spatialDiagonal / (maxSamples * 0.8));
                const currentDistance = mapper.getSampleDistance?.();

                if (!currentDistance || currentDistance < minRequiredDistance) {
                  console.log(`[setViewportPreset] Adjusting sample distance: ${currentDistance?.toFixed(4)} → ${minRequiredDistance.toFixed(4)}`);
                  mapper.setSampleDistance(minRequiredDistance);
                }
              }
            }
          }
        } catch (error) {
          console.error('Failed to adjust sample distance after preset:', error);
        }
      }

      viewport.render();
    },

    /**
     * Sets the volume quality for a given viewport.
     * @param {string} viewportId - The ID of the viewport to set the volume quality.
     * @param {number} volumeQuality - The desired quality level of the volume rendering.
     */

    setVolumeRenderingQulaity: ({ viewportId, volumeQuality }) => {
      const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);

      // console.log(`[setVolumeRenderingQuality] Viewport type: ${viewport.type}, quality: ${volumeQuality}, id: ${viewportId}`);

      const { actor } = viewport.getActors()[0];
      const mapper = actor.getMapper();
      const image = mapper.getInputData();
      const dims = image.getDimensions();
      const spacing = image.getSpacing();
      const spatialDiagonal = vec3.length(
        vec3.fromValues(dims[0] * spacing[0], dims[1] * spacing[1], dims[2] * spacing[2])
      );

      // Calculate desired sample distance based on quality
      let sampleDistance = spacing.reduce((a, b) => a + b) / 3.0;
      sampleDistance /= volumeQuality > 1 ? 0.5 * volumeQuality ** 2 : 1.0;

      // Ensure sample distance is large enough to stay under the maximum samples limit
      const maxSamples = mapper.getMaximumSamplesPerRay?.() || 4000;
      const minRequiredDistance = (spatialDiagonal / (maxSamples * 0.8));

      // Use the larger of the two (safer)
      const safeSampleDistance = Math.max(sampleDistance, minRequiredDistance);

      console.log(`[setVolumeRenderingQuality] Quality: ${volumeQuality}, desired: ${sampleDistance.toFixed(4)}, minRequired: ${minRequiredDistance.toFixed(4)}, final: ${safeSampleDistance.toFixed(4)}`);
      mapper.setSampleDistance(safeSampleDistance);
      viewport.render();
    },

    /**
     * Shifts opacity points for a given viewport id.
     * @param {string} viewportId - The ID of the viewport to set the mapping range.
     * @param {number} shift - The shift value to shift the points by.
     */
    shiftVolumeOpacityPoints: ({ viewportId, shift }) => {
      const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);
      const { actor } = viewport.getActors()[0];
      const ofun = actor.getProperty().getScalarOpacity(0);

      const opacityPointValues = []; // Array to hold values
      // Gather Existing Values
      const size = ofun.getSize();
      for (let pointIdx = 0; pointIdx < size; pointIdx++) {
        const opacityPointValue = [0, 0, 0, 0];
        ofun.getNodeValue(pointIdx, opacityPointValue);
        // opacityPointValue now holds [xLocation, opacity, midpoint, sharpness]
        opacityPointValues.push(opacityPointValue);
      }
      // Add offset
      opacityPointValues.forEach(opacityPointValue => {
        opacityPointValue[0] += shift; // Change the location value
      });
      // Set new values
      ofun.removeAllPoints();
      opacityPointValues.forEach(opacityPointValue => {
        ofun.addPoint(...opacityPointValue);
      });
      viewport.render();
    },

    /**
     * Sets the volume lighting settings for a given viewport.
     * @param {string} viewportId - The ID of the viewport to set the lighting settings.
     * @param {Object} options - The lighting settings to be set.
     * @param {boolean} options.shade - The shade setting for the lighting.
     * @param {number} options.ambient - The ambient setting for the lighting.
     * @param {number} options.diffuse - The diffuse setting for the lighting.
     * @param {number} options.specular - The specular setting for the lighting.
     **/

    setVolumeLighting: ({ viewportId, options }) => {
      const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);
      const { actor } = viewport.getActors()[0];
      const property = actor.getProperty();

      if (options.shade !== undefined) {
        property.setShade(options.shade);
      }

      if (options.ambient !== undefined) {
        property.setAmbient(options.ambient);
      }

      if (options.diffuse !== undefined) {
        property.setDiffuse(options.diffuse);
      }

      if (options.specular !== undefined) {
        property.setSpecular(options.specular);
      }

      viewport.render();
    },
    resetCrosshairs: ({ viewportId }) => {
      const crosshairInstances = [];

      const getCrosshairInstances = toolGroupId => {
        const toolGroup = toolGroupService.getToolGroup(toolGroupId);
        crosshairInstances.push(toolGroup.getToolInstance('Crosshairs'));
      };

      if (!viewportId) {
        const toolGroupIds = toolGroupService.getToolGroupIds();
        toolGroupIds.forEach(getCrosshairInstances);
      } else {
        const toolGroup = toolGroupService.getToolGroupForViewport(viewportId);
        getCrosshairInstances(toolGroup.id);
      }

      crosshairInstances.forEach(ins => {
        ins?.computeToolCenter();
      });
    },
    /**
     * Creates a labelmap for the active viewport
     *
     * The created labelmap will be registered as a display set and also added
     * as a segmentation representation to the viewport.
     */
    createLabelmapForViewport: async ({ viewportId, options = {} }) => {
      const { viewportGridService, displaySetService, segmentationService } =
        servicesManager.services;
      const { viewports } = viewportGridService.getState();
      const targetViewportId = viewportId;

      const viewport = viewports.get(targetViewportId);

      // Todo: add support for multiple display sets
      const displaySetInstanceUID =
        options.displaySetInstanceUID || viewport.displaySetInstanceUIDs[0];

      const segs = segmentationService.getSegmentations();

      const label = options.label || `${i18n.t('Tools:Segmentation')} ${segs.length + 1}`;
      const segmentationId = options.segmentationId || `${csUtils.uuidv4()}`;

      const displaySet = displaySetService.getDisplaySetByUID(displaySetInstanceUID);

      // This will create the segmentation and register it as a display set
      const generatedSegmentationId = await segmentationService.createLabelmapForDisplaySet(
        displaySet,
        {
          label,
          segmentationId,
          segments: options.createInitialSegment
            ? {
                1: {
                  label: `${i18n.t('Tools:Segment')} 1`,
                  active: true,
                },
              }
            : {},
        }
      );

      // Also add the segmentation representation to the viewport
      await segmentationService.addSegmentationRepresentation(viewportId, {
        segmentationId,
        type: Enums.SegmentationRepresentations.Labelmap,
      });

      return generatedSegmentationId;
    },

    /**
     * Sets the active segmentation for a viewport
     * @param props.segmentationId - The ID of the segmentation to set as active
     */
    setActiveSegmentation: ({ segmentationId }) => {
      const { viewportGridService, segmentationService } = servicesManager.services;
      segmentationService.setActiveSegmentation(
        viewportGridService.getActiveViewportId(),
        segmentationId
      );
    },

    /**
     * Adds a new segment to a segmentation
     * @param props.segmentationId - The ID of the segmentation to add the segment to
     */
    addSegmentCommand: ({ segmentationId }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.addSegment(segmentationId);
    },

    /**
     * Sets the active segment and jumps to its center
     * @param props.segmentationId - The ID of the segmentation
     * @param props.segmentIndex - The index of the segment to activate
     */
    setActiveSegmentAndCenterCommand: ({ segmentationId, segmentIndex }) => {
      const { segmentationService, viewportGridService } = servicesManager.services;
      // set both active segmentation and active segment
      segmentationService.setActiveSegmentation(
        viewportGridService.getActiveViewportId(),
        segmentationId
      );
      segmentationService.setActiveSegment(segmentationId, segmentIndex);

      const { highlightAlpha, highlightSegment, animationLength, animationFunctionType } =
        (customizationService.getCustomization(
          'panelSegmentation.jumpToSegmentHighlightAnimationConfig'
        ) as Object as {
          highlightAlpha?: number;
          highlightSegment?: boolean;
          animationLength?: number;
          animationFunctionType?: EasingFunctionEnum;
        }) ?? {};

      const validAnimationFunctionType = Object.values(EasingFunctionEnum).includes(
        animationFunctionType
      )
        ? animationFunctionType
        : undefined;

      segmentationService.jumpToSegmentCenter(
        segmentationId,
        segmentIndex,
        undefined,
        highlightAlpha,
        highlightSegment,
        animationLength,
        undefined,
        validAnimationFunctionType
      );
    },

    /**
     * Toggles the visibility of a segment
     * @param props.segmentationId - The ID of the segmentation
     * @param props.segmentIndex - The index of the segment
     * @param props.type - The type of visibility to toggle
     */
    toggleSegmentVisibilityCommand: ({ segmentationId, segmentIndex, type }) => {
      const { segmentationService, viewportGridService } = servicesManager.services;
      segmentationService.toggleSegmentVisibility(
        viewportGridService.getActiveViewportId(),
        segmentationId,
        segmentIndex,
        type
      );
    },

    /**
     * Toggles the lock state of a segment
     * @param props.segmentationId - The ID of the segmentation
     * @param props.segmentIndex - The index of the segment
     */
    toggleSegmentLockCommand: ({ segmentationId, segmentIndex }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.toggleSegmentLocked(segmentationId, segmentIndex);
    },

    /**
     * Toggles the visibility of a segmentation representation
     * @param props.segmentationId - The ID of the segmentation
     * @param props.type - The type of representation
     */
    toggleSegmentationVisibilityCommand: ({ segmentationId, type }) => {
      const { segmentationService, viewportGridService } = servicesManager.services;
      segmentationService.toggleSegmentationRepresentationVisibility(
        viewportGridService.getActiveViewportId(),
        { segmentationId, type }
      );
    },

    /**
     * Downloads a segmentation
     * @param props.segmentationId - The ID of the segmentation to download
     */
    downloadSegmentationCommand: ({ segmentationId }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.downloadSegmentation(segmentationId);
    },

    /**
     * Stores a segmentation and shows it in the viewport
     * @param props.segmentationId - The ID of the segmentation to store
     */
    storeSegmentationCommand: async ({ segmentationId }) => {
      const { segmentationService, viewportGridService } = servicesManager.services;

      const displaySetInstanceUIDs = await createReportAsync({
        servicesManager,
        getReport: () =>
          commandsManager.runCommand('storeSegmentation', {
            segmentationId,
          }),
        reportType: 'Segmentation',
      });

      if (displaySetInstanceUIDs) {
        segmentationService.remove(segmentationId);
        viewportGridService.setDisplaySetsForViewport({
          viewportId: viewportGridService.getActiveViewportId(),
          displaySetInstanceUIDs,
        });
      }
    },

    /**
     * Downloads a segmentation as RTSS
     * @param props.segmentationId - The ID of the segmentation
     */
    downloadRTSSCommand: ({ segmentationId }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.downloadRTSS(segmentationId);
    },

    /**
     * Sets the style for a segmentation
     * @param props.segmentationId - The ID of the segmentation
     * @param props.type - The type of style
     * @param props.key - The style key to set
     * @param props.value - The style value
     */
    setSegmentationStyleCommand: ({ type, key, value }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.setStyle({ type }, { [key]: value });
    },

    /**
     * Deletes a segment from a segmentation
     * @param props.segmentationId - The ID of the segmentation
     * @param props.segmentIndex - The index of the segment to delete
     */
    deleteSegmentCommand: ({ segmentationId, segmentIndex }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.removeSegment(segmentationId, segmentIndex);
    },

    /**
     * Deletes an entire segmentation
     * @param props.segmentationId - The ID of the segmentation to delete
     */
    deleteSegmentationCommand: ({ segmentationId }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.remove(segmentationId);
    },

    /**
     * Removes a segmentation from the viewport
     * @param props.segmentationId - The ID of the segmentation to remove
     */
    removeSegmentationFromViewportCommand: ({ segmentationId }) => {
      const { segmentationService, viewportGridService } = servicesManager.services;
      segmentationService.removeSegmentationRepresentations(
        viewportGridService.getActiveViewportId(),
        { segmentationId }
      );
    },

    /**
     * Toggles rendering of inactive segmentations
     */
    toggleRenderInactiveSegmentationsCommand: () => {
      const { segmentationService, viewportGridService } = servicesManager.services;
      const viewportId = viewportGridService.getActiveViewportId();
      const renderInactive = segmentationService.getRenderInactiveSegmentations(viewportId);
      segmentationService.setRenderInactiveSegmentations(viewportId, !renderInactive);
    },

    /**
     * Sets the fill alpha value for a segmentation type
     * @param props.type - The type of segmentation
     * @param props.value - The alpha value to set
     */
    setFillAlphaCommand: ({ type, value }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.setStyle({ type }, { fillAlpha: value });
    },

    /**
     * Sets the outline width for a segmentation type
     * @param props.type - The type of segmentation
     * @param props.value - The width value to set
     */
    setOutlineWidthCommand: ({ type, value }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.setStyle({ type }, { outlineWidth: value });
    },

    /**
     * Sets whether to render fill for a segmentation type
     * @param props.type - The type of segmentation
     * @param props.value - Whether to render fill
     */
    setRenderFillCommand: ({ type, value }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.setStyle({ type }, { renderFill: value });
    },

    /**
     * Sets whether to render outline for a segmentation type
     * @param props.type - The type of segmentation
     * @param props.value - Whether to render outline
     */
    setRenderOutlineCommand: ({ type, value }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.setStyle({ type }, { renderOutline: value });
    },

    /**
     * Sets the fill alpha for inactive segmentations
     * @param props.type - The type of segmentation
     * @param props.value - The alpha value to set
     */
    setFillAlphaInactiveCommand: ({ type, value }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.setStyle({ type }, { fillAlphaInactive: value });
    },

    editSegmentLabel: async ({ segmentationId, segmentIndex }) => {
      const { segmentationService, uiDialogService } = servicesManager.services;
      const segmentation = segmentationService.getSegmentation(segmentationId);

      if (!segmentation) {
        return;
      }

      const segment = segmentation.segments[segmentIndex];

      callInputDialog({
        uiDialogService,
        title: i18n.t('Tools:Edit Segment Label'),
        placeholder: i18n.t('Tools:Enter new label'),
        defaultValue: segment.label,
      }).then(label => {
        segmentationService.setSegmentLabel(segmentationId, segmentIndex, label);
      });
    },

    editSegmentationLabel: ({ segmentationId }) => {
      const { segmentationService, uiDialogService } = servicesManager.services;
      const segmentation = segmentationService.getSegmentation(segmentationId);

      if (!segmentation) {
        return;
      }

      const { label } = segmentation;

      callInputDialog({
        uiDialogService,
        title: i18n.t('Tools:Edit Segmentation Label'),
        placeholder: i18n.t('Tools:Enter new label'),
        defaultValue: label,
      }).then(label => {
        segmentationService.addOrUpdateSegmentation({ segmentationId, label });
      });
    },

    editSegmentColor: ({ segmentationId, segmentIndex }) => {
      const { segmentationService, uiDialogService, viewportGridService } =
        servicesManager.services;
      const viewportId = viewportGridService.getActiveViewportId();
      const color = segmentationService.getSegmentColor(viewportId, segmentationId, segmentIndex);

      const rgbaColor = {
        r: color[0],
        g: color[1],
        b: color[2],
        a: color[3] / 255.0,
      };

      uiDialogService.show({
        content: colorPickerDialog,
        title: i18n.t('Tools:Segment Color'),
        contentProps: {
          value: rgbaColor,
          onSave: newRgbaColor => {
            const color = [newRgbaColor.r, newRgbaColor.g, newRgbaColor.b, newRgbaColor.a * 255.0];
            segmentationService.setSegmentColor(viewportId, segmentationId, segmentIndex, color);
          },
        },
      });
    },

    getRenderInactiveSegmentations: () => {
      const { segmentationService, viewportGridService } = servicesManager.services;
      return segmentationService.getRenderInactiveSegmentations(
        viewportGridService.getActiveViewportId()
      );
    },

    deleteActiveAnnotation: () => {
      const activeAnnotationsUID = cornerstoneTools.annotation.selection.getAnnotationsSelected();
      activeAnnotationsUID.forEach(activeAnnotationUID => {
        measurementService.remove(activeAnnotationUID);
      });
    },
    setDisplaySetsForViewports: ({ viewportsToUpdate }) => {
      const { cineService, viewportGridService } = servicesManager.services;
      // Stopping the cine of modified viewports before changing the viewports to
      // avoid inconsistent state and lost references
      viewportsToUpdate.forEach(viewport => {
        const state = cineService.getState();
        const currentCineState = state.cines?.[viewport.viewportId];
        cineService.setCine({
          id: viewport.viewportId,
          frameRate: currentCineState?.frameRate ?? state.default?.frameRate ?? 24,
          isPlaying: false,
        });
      });

      viewportGridService.setDisplaySetsForViewports(viewportsToUpdate);
    },
    undo: () => {
      DefaultHistoryMemo.undo();
    },
    redo: () => {
      DefaultHistoryMemo.redo();
    },
    toggleSegmentPreviewEdit: ({ toggle }) => {
      let labelmapTools = getLabelmapTools({ toolGroupService });
      labelmapTools = labelmapTools.filter(tool => !tool.toolName.includes('Eraser'));
      labelmapTools.forEach(tool => {
        tool.configuration = {
          ...tool.configuration,
          preview: {
            ...tool.configuration.preview,
            enabled: toggle,
          },
        };
      });
    },
    toggleSegmentSelect: ({ toggle }) => {
      const toolGroupIds = toolGroupService.getToolGroupIds();
      toolGroupIds.forEach(toolGroupId => {
        const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
        if (toggle) {
          toolGroup.setToolActive(cornerstoneTools.SegmentSelectTool.toolName);
        } else {
          toolGroup.setToolDisabled(cornerstoneTools.SegmentSelectTool.toolName);
        }
      });
    },
    toggleSegmentLabel: ({ enabled }: { enabled?: boolean }) => {
      const toolName = cornerstoneTools.SegmentLabelTool.toolName;
      const toolGroupIds = toolGroupService.getToolGroupIds();

      const isToolOn = toolGroupIds.some(toolGroupId => {
        const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
        const mode = toolGroup.getToolInstance(toolName)?.mode;
        return mode === 'Active';
      });

      const enableTool = enabled !== undefined ? enabled : !isToolOn;

      toolGroupIds.forEach(toolGroupId => {
        const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
        if (enableTool) {
          toolGroup.setToolActive(toolName);
        } else {
          toolGroup.setToolDisabled(toolName);
        }
      });
    },
    /**
     * Used to sync the apps initial state with the config file settings.
     *
     * Will mutate the tools object of the given tool group and add the segmentLabelTool to the proper place.
     *
     * Use it before initializing the toolGroup with the tools.
     */
    initializeSegmentLabelTool: ({ tools }) => {
      const appConfig = extensionManager.appConfig;
      const segmentLabelConfig = appConfig.segmentation?.segmentLabel;

      if (segmentLabelConfig?.enabledByDefault) {
        const activeTools = tools?.active ?? [];
        activeTools.push({
          toolName: toolNames.SegmentLabel,
          configuration: {
            hoverTimeout: segmentLabelConfig?.hoverTimeout ?? 1,
            color: segmentLabelConfig?.labelColor,
            background: segmentLabelConfig?.background,
          },
        });

        tools.active = activeTools;
        return tools;
      }

      const disabledTools = tools?.disabled ?? [];
      disabledTools.push({
        toolName: toolNames.SegmentLabel,
        configuration: {
          hoverTimeout: segmentLabelConfig?.hoverTimeout ?? 1,
          color: segmentLabelConfig?.labelColor,
        },
      });
      tools.disabled = disabledTools;
      return tools;
    },
    // Camera focal point logging for MPR viewports
    enableCameraLogging: () => {
      viewportStateService.enableCameraLogging();
    },
    disableCameraLogging: () => {
      viewportStateService.disableCameraLogging();
    },
    toggleCameraLogging: () => {
      viewportStateService.toggleCameraLogging();
    },
    getCameraFocalPoints: () => {
      const focalPoints = viewportStateService.getCurrentFocalPoints();
      // console.log('📸 Current Camera Focal Points:', focalPoints);
      return focalPoints;
    },
    getCrosshairsToolCenter: () => {
      const crosshairsData = viewportStateService.getCrosshairsToolCenter();
      console.log('🎯 Crosshairs Tool Center:', crosshairsData);
      return crosshairsData;
    },
    toggleUseCenterSegmentIndex: ({ toggle }) => {
      let labelmapTools = getLabelmapTools({ toolGroupService });
      labelmapTools = labelmapTools.filter(tool => !tool.toolName.includes('Eraser'));
      labelmapTools.forEach(tool => {
        tool.configuration = {
          ...tool.configuration,
          useCenterSegmentIndex: toggle,
        };
      });
    },
    _handlePreviewAction: action => {
      const { viewport } = _getActiveViewportEnabledElement();
      const previewTools = getPreviewTools({ toolGroupService });

      previewTools.forEach(tool => {
        try {
          tool[`${action}Preview`]();
        } catch (error) {
          console.debug('Error accepting preview for tool', tool.toolName);
        }
      });

      if (segmentAI.enabled) {
        segmentAI[`${action}Preview`](viewport.element);
      }
    },
    acceptPreview: () => {
      actions._handlePreviewAction('accept');
    },
    rejectPreview: () => {
      actions._handlePreviewAction('reject');
    },
    clearMarkersForMarkerLabelmap: () => {
      const { viewport } = _getActiveViewportEnabledElement();
      const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroupForViewport(viewport.id);
      const toolInstance = toolGroup.getToolInstance('MarkerLabelmap');

      if (!toolInstance) {
        return;
      }

      toolInstance.clearMarkers(viewport);
    },
    interpolateScrollForMarkerLabelmap: () => {
      const { viewport } = _getActiveViewportEnabledElement();
      const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroupForViewport(viewport.id);
      const toolInstance = toolGroup.getToolInstance('MarkerLabelmap');

      if (!toolInstance) {
        return;
      }

      toolInstance.interpolateScroll(viewport, 1);
    },
    toggleLabelmapAssist: async () => {
      const { viewport } = _getActiveViewportEnabledElement();
      const newState = !segmentAI.enabled;
      segmentAI.enabled = newState;

      if (!segmentAIEnabled) {
        await segmentAI.initModel();
        segmentAIEnabled = true;
      }

      // set the brush tool to active
      const toolGroupIds = toolGroupService.getToolGroupIds();
      if (newState) {
        actions.setToolActiveToolbar({
          toolName: 'CircularBrushForAutoSegmentAI',
          toolGroupIds: toolGroupIds,
        });
      } else {
        toolGroupIds.forEach(toolGroupId => {
          const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
          toolGroup.setToolPassive('CircularBrushForAutoSegmentAI');
        });
      }

      if (segmentAI.enabled) {
        segmentAI.initViewport(viewport);
      }
    },
    setBrushSize: ({ value, toolNames }) => {
      const brushSize = Number(value);

      toolGroupService.getToolGroupIds()?.forEach(toolGroupId => {
        if (toolNames?.length === 0) {
          segmentationUtils.setBrushSizeForToolGroup(toolGroupId, brushSize);
        } else {
          toolNames?.forEach(toolName => {
            segmentationUtils.setBrushSizeForToolGroup(toolGroupId, brushSize, toolName);
          });
        }
      });
    },
    setThresholdRange: ({
      value,
      toolNames = [
        'ThresholdCircularBrush',
        'ThresholdSphereBrush',
        'ThresholdCircularBrushDynamic',
        'ThresholdSphereBrushDynamic',
      ],
    }) => {
      const toolGroupIds = toolGroupService.getToolGroupIds();
      if (!toolGroupIds?.length) {
        return;
      }

      for (const toolGroupId of toolGroupIds) {
        const toolGroup = toolGroupService.getToolGroup(toolGroupId);
        toolNames?.forEach(toolName => {
          toolGroup.setToolConfiguration(toolName, {
            threshold: {
              range: value,
            },
          });
        });
      }
    },
    increaseBrushSize: () => {
      const toolGroupIds = toolGroupService.getToolGroupIds();
      if (!toolGroupIds?.length) {
        return;
      }

      for (const toolGroupId of toolGroupIds) {
        const brushSize = segmentationUtils.getBrushSizeForToolGroup(toolGroupId);
        segmentationUtils.setBrushSizeForToolGroup(toolGroupId, brushSize + 3);
      }
    },
    decreaseBrushSize: () => {
      const toolGroupIds = toolGroupService.getToolGroupIds();
      if (!toolGroupIds?.length) {
        return;
      }

      for (const toolGroupId of toolGroupIds) {
        const brushSize = segmentationUtils.getBrushSizeForToolGroup(toolGroupId);
        segmentationUtils.setBrushSizeForToolGroup(toolGroupId, brushSize - 3);
      }
    },
    addNewSegment: () => {
      const { segmentationService } = servicesManager.services;
      const { activeViewportId } = viewportGridService.getState();
      const activeSegmentation = segmentationService.getActiveSegmentation(activeViewportId);
      if (!activeSegmentation) {
        return;
      }
      segmentationService.addSegment(activeSegmentation.segmentationId);
    },
    loadSegmentationDisplaySetsForViewport: ({ viewportId, displaySetInstanceUIDs }) => {
      const updatedViewports = getUpdatedViewportsForSegmentation({
        viewportId,
        servicesManager,
        displaySetInstanceUIDs,
      });

      actions.setDisplaySetsForViewports({
        viewportsToUpdate: updatedViewports.map(viewport => ({
          viewportId: viewport.viewportId,
          displaySetInstanceUIDs: viewport.displaySetInstanceUIDs,
        })),
      });
    },
    setViewportOrientation: ({ viewportId, orientation }) => {
      const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);

      if (!viewport || viewport.type !== CoreEnums.ViewportType.ORTHOGRAPHIC) {
        console.warn('Orientation can only be set on volume viewports');
        return;
      }

      // Get display sets for this viewport to verify at least one is reconstructable
      const displaySetUIDs = viewportGridService.getDisplaySetsUIDsForViewport(viewportId);
      const displaySets = displaySetUIDs.map(uid => displaySetService.getDisplaySetByUID(uid));

      if (!displaySets.some(ds => ds.isReconstructable)) {
        console.warn('Cannot change orientation: No reconstructable display sets in viewport');
        return;
      }

      viewport.setOrientation(orientation);
      viewport.render();

      // update the orientation in the viewport info
      const viewportInfo = cornerstoneViewportService.getViewportInfo(viewportId);
      viewportInfo.setOrientation(orientation);
    },
    /**
     * Toggles the horizontal flip state of the viewport.
     */
    toggleViewportHorizontalFlip: ({ viewportId }: { viewportId?: string } = {}) => {
      actions.flipViewportHorizontal({ viewportId, newValue: 'toggle' });
    },

    /**
     * Explicitly sets the horizontal flip state of the viewport.
     */
    setViewportHorizontalFlip: ({
      flipped,
      viewportId,
    }: {
      flipped: boolean;
      viewportId?: string;
    }) => {
      actions.flipViewportHorizontal({ viewportId, newValue: flipped });
    },

    /**
     * Toggles the vertical flip state of the viewport.
     */
    toggleViewportVerticalFlip: ({ viewportId }: { viewportId?: string } = {}) => {
      actions.flipViewportVertical({ viewportId, newValue: 'toggle' });
    },

    /**
     * Explicitly sets the vertical flip state of the viewport.
     */
    setViewportVerticalFlip: ({
      flipped,
      viewportId,
    }: {
      flipped: boolean;
      viewportId?: string;
    }) => {
      actions.flipViewportVertical({ viewportId, newValue: flipped });
    },
    /**
     * Internal helper to rotate or set absolute rotation for a viewport.
     */
    _rotateViewport: ({
      rotation,
      viewportId,
      rotationMode = 'apply',
    }: {
      rotation: number;
      viewportId?: string;
      rotationMode?: 'apply' | 'set';
    }) => {
      const enabledElement = viewportId
        ? _getViewportEnabledElement(viewportId)
        : _getActiveViewportEnabledElement();

      if (!enabledElement) {
        return;
      }

      const { viewport } = enabledElement;

      if (viewport instanceof BaseVolumeViewport) {
        const camera = viewport.getCamera();
        const rotAngle = (rotation * Math.PI) / 180;
        const rotMat = mat4.identity(new Float32Array(16));
        mat4.rotate(rotMat, rotMat, rotAngle, camera.viewPlaneNormal);
        const rotatedViewUp = vec3.transformMat4(vec3.create(), camera.viewUp, rotMat);
        viewport.setCamera({ viewUp: rotatedViewUp as CoreTypes.Point3 });
        viewport.render();
        return;
      }

      if (viewport.getRotation !== undefined) {
        const { rotation: currentRotation } = viewport.getViewPresentation();
        const newRotation =
          rotationMode === 'apply'
            ? (currentRotation + rotation + 360) % 360
            : (() => {
                // In 'set' mode, account for the effect horizontal/vertical flips
                // have on the perceived rotation direction. A single flip mirrors
                // the image and inverses rotation direction, while two flips
                // restore the original parity. We therefore invert the rotation
                // angle when an odd number of flips are applied so that the
                // requested absolute rotation matches the user expectation.
                const { flipHorizontal = false, flipVertical = false } =
                  viewport.getViewPresentation();

                const flipsParity = (flipHorizontal ? 1 : 0) + (flipVertical ? 1 : 0);
                const effectiveRotation = flipsParity % 2 === 1 ? -rotation : rotation;

                return (effectiveRotation + 360) % 360;
              })();
        viewport.setViewPresentation({ rotation: newRotation });
        viewport.render();
      }
    },
    startRecordingForAnnotationGroup: () => {
      cornerstoneTools.AnnotationTool.startGroupRecording();
    },
    endRecordingForAnnotationGroup: () => {
      cornerstoneTools.AnnotationTool.endGroupRecording();
    },
    triggerCreateAnnotationMemo: ({
      annotation,
      FrameOfReferenceUID,
      options,
    }: {
      annotation: ToolTypes.Annotation;
      FrameOfReferenceUID: string;
      options: { newAnnotation?: boolean; deleting?: boolean };
    }): void => {
      const { newAnnotation, deleting } = options;
      const renderingEngines = getRenderingEngines();
      const viewports = renderingEngines.flatMap(re => re.getViewports());
      const validViewport = viewports.find(
        vp => vp.getFrameOfReferenceUID() === FrameOfReferenceUID
      );

      if (!validViewport) {
        return;
      }

      cornerstoneTools.AnnotationTool.createAnnotationMemo(validViewport.element, annotation, {
        newAnnotation,
        deleting,
      });
    },
  };

  const definitions = {
    // The command here is to show the viewer context menu, as being the
    // context menu
    showCornerstoneContextMenu: {
      commandFn: actions.showCornerstoneContextMenu,
      options: {
        menuCustomizationId: 'measurementsContextMenu',
        commands: [
          {
            commandName: 'showContextMenu',
          },
        ],
      },
    },

    getNearbyToolData: {
      commandFn: actions.getNearbyToolData,
    },
    getNearbyAnnotation: {
      commandFn: actions.getNearbyAnnotation,
      storeContexts: [],
      options: {},
    },
    toggleViewportColorbar: {
      commandFn: actions.toggleViewportColorbar,
    },
    setMeasurementLabel: {
      commandFn: actions.setMeasurementLabel,
    },
    renameMeasurement: {
      commandFn: actions.renameMeasurement,
    },
    updateMeasurement: {
      commandFn: actions.updateMeasurement,
    },
    jumpToMeasurement: actions.jumpToMeasurement,
    removeMeasurement: {
      commandFn: actions.removeMeasurement,
    },
    toggleLockMeasurement: {
      commandFn: actions.toggleLockMeasurement,
    },
    toggleVisibilityMeasurement: {
      commandFn: actions.toggleVisibilityMeasurement,
    },
    downloadCSVMeasurementsReport: {
      commandFn: actions.downloadCSVMeasurementsReport,
    },
    setViewportWindowLevel: {
      commandFn: actions.setViewportWindowLevel,
    },
    setWindowLevel: {
      commandFn: actions.setWindowLevel,
    },
    setWindowLevelPreset: {
      commandFn: actions.setWindowLevelPreset,
    },
    setToolActive: {
      commandFn: actions.setToolActive,
    },
    setToolActiveToolbar: {
      commandFn: actions.setToolActiveToolbar,
    },
    setToolEnabled: {
      commandFn: actions.setToolEnabled,
    },
    rotateViewportCW: {
      commandFn: actions.rotateViewportBy,
      options: { rotation: 90 },
    },
    rotateViewportCCW: {
      commandFn: actions.rotateViewportBy,
      options: { rotation: -90 },
    },
    rotateViewportCWSet: {
      commandFn: actions.setViewportRotation,
      options: { rotation: 90 },
    },
    incrementActiveViewport: {
      commandFn: actions.changeActiveViewport,
    },
    decrementActiveViewport: {
      commandFn: actions.changeActiveViewport,
      options: { direction: -1 },
    },
    flipViewportHorizontal: {
      commandFn: actions.toggleViewportHorizontalFlip,
    },
    flipViewportVertical: {
      commandFn: actions.toggleViewportVerticalFlip,
    },
    setViewportHorizontalFlip: {
      commandFn: actions.setViewportHorizontalFlip,
      options: { flipped: true },
    },
    setViewportVerticalFlip: {
      commandFn: actions.setViewportVerticalFlip,
      options: { flipped: true },
    },
    invertViewport: {
      commandFn: actions.invertViewport,
    },
    resetViewport: {
      commandFn: actions.resetViewport,
    },
    scaleUpViewport: {
      commandFn: actions.scaleViewport,
      options: { direction: 1 },
    },
    scaleDownViewport: {
      commandFn: actions.scaleViewport,
      options: { direction: -1 },
    },
    fitViewportToWindow: {
      commandFn: actions.scaleViewport,
      options: { direction: 0 },
    },
    nextImage: {
      commandFn: actions.scroll,
      options: { direction: 1 },
    },
    previousImage: {
      commandFn: actions.scroll,
      options: { direction: -1 },
    },
    firstImage: {
      commandFn: actions.jumpToImage,
      options: { imageIndex: 0 },
    },
    lastImage: {
      commandFn: actions.jumpToImage,
      options: { imageIndex: -1 },
    },
    jumpToImage: {
      commandFn: actions.jumpToImage,
    },
    showDownloadViewportModal: {
      commandFn: actions.showDownloadViewportModal,
    },
    toggleCine: {
      commandFn: actions.toggleCine,
    },
    arrowTextCallback: {
      commandFn: actions.arrowTextCallback,
    },
    setViewportActive: {
      commandFn: actions.setViewportActive,
    },
    setViewportColormap: {
      commandFn: actions.setViewportColormap,
    },
    setViewportForToolConfiguration: {
      commandFn: actions.setViewportForToolConfiguration,
    },
    storePresentation: {
      commandFn: actions.storePresentation,
    },
    attachProtocolViewportDataListener: {
      commandFn: actions.attachProtocolViewportDataListener,
    },
    setViewportPreset: {
      commandFn: actions.setViewportPreset,
    },
    setVolumeRenderingQulaity: {
      commandFn: actions.setVolumeRenderingQulaity,
    },
    shiftVolumeOpacityPoints: {
      commandFn: actions.shiftVolumeOpacityPoints,
    },
    setVolumeLighting: {
      commandFn: actions.setVolumeLighting,
    },
    resetCrosshairs: {
      commandFn: actions.resetCrosshairs,
    },
    toggleSynchronizer: {
      commandFn: actions.toggleSynchronizer,
    },
    updateVolumeData: {
      commandFn: actions.updateVolumeData,
    },
    toggleEnabledDisabledToolbar: {
      commandFn: actions.toggleEnabledDisabledToolbar,
    },
    toggleActiveDisabledToolbar: {
      commandFn: actions.toggleActiveDisabledToolbar,
    },
    updateStoredPositionPresentation: {
      commandFn: actions.updateStoredPositionPresentation,
    },
    updateStoredSegmentationPresentation: {
      commandFn: actions.updateStoredSegmentationPresentation,
    },
    createLabelmapForViewport: {
      commandFn: actions.createLabelmapForViewport,
    },
    setActiveSegmentation: {
      commandFn: actions.setActiveSegmentation,
    },
    addSegment: {
      commandFn: actions.addSegmentCommand,
    },
    setActiveSegmentAndCenter: {
      commandFn: actions.setActiveSegmentAndCenterCommand,
    },
    toggleSegmentVisibility: {
      commandFn: actions.toggleSegmentVisibilityCommand,
    },
    toggleSegmentLock: {
      commandFn: actions.toggleSegmentLockCommand,
    },
    toggleSegmentationVisibility: {
      commandFn: actions.toggleSegmentationVisibilityCommand,
    },
    downloadSegmentation: {
      commandFn: actions.downloadSegmentationCommand,
    },
    storeSegmentation: {
      commandFn: actions.storeSegmentationCommand,
    },
    downloadRTSS: {
      commandFn: actions.downloadRTSSCommand,
    },
    setSegmentationStyle: {
      commandFn: actions.setSegmentationStyleCommand,
    },
    deleteSegment: {
      commandFn: actions.deleteSegmentCommand,
    },
    deleteSegmentation: {
      commandFn: actions.deleteSegmentationCommand,
    },
    removeSegmentationFromViewport: {
      commandFn: actions.removeSegmentationFromViewportCommand,
    },
    toggleRenderInactiveSegmentations: {
      commandFn: actions.toggleRenderInactiveSegmentationsCommand,
    },
    setFillAlpha: {
      commandFn: actions.setFillAlphaCommand,
    },
    setOutlineWidth: {
      commandFn: actions.setOutlineWidthCommand,
    },
    setRenderFill: {
      commandFn: actions.setRenderFillCommand,
    },
    setRenderOutline: {
      commandFn: actions.setRenderOutlineCommand,
    },
    setFillAlphaInactive: {
      commandFn: actions.setFillAlphaInactiveCommand,
    },
    editSegmentLabel: {
      commandFn: actions.editSegmentLabel,
    },
    editSegmentationLabel: {
      commandFn: actions.editSegmentationLabel,
    },
    editSegmentColor: {
      commandFn: actions.editSegmentColor,
    },
    getRenderInactiveSegmentations: {
      commandFn: actions.getRenderInactiveSegmentations,
    },
    deleteActiveAnnotation: {
      commandFn: actions.deleteActiveAnnotation,
    },
    setDisplaySetsForViewports: actions.setDisplaySetsForViewports,
    undo: actions.undo,
    redo: actions.redo,
    interpolateLabelmap: actions.interpolateLabelmap,
    runSegmentBidirectional: actions.runSegmentBidirectional,
    downloadCSVSegmentationReport: actions.downloadCSVSegmentationReport,
    toggleSegmentPreviewEdit: actions.toggleSegmentPreviewEdit,
    toggleSegmentSelect: actions.toggleSegmentSelect,
    acceptPreview: actions.acceptPreview,
    rejectPreview: actions.rejectPreview,
    toggleUseCenterSegmentIndex: actions.toggleUseCenterSegmentIndex,
    toggleLabelmapAssist: actions.toggleLabelmapAssist,
    interpolateScrollForMarkerLabelmap: actions.interpolateScrollForMarkerLabelmap,
    clearMarkersForMarkerLabelmap: actions.clearMarkersForMarkerLabelmap,
    setBrushSize: actions.setBrushSize,
    setThresholdRange: actions.setThresholdRange,
    increaseBrushSize: actions.increaseBrushSize,
    decreaseBrushSize: actions.decreaseBrushSize,
    addNewSegment: actions.addNewSegment,
    loadSegmentationDisplaySetsForViewport: actions.loadSegmentationDisplaySetsForViewport,
    setViewportOrientation: actions.setViewportOrientation,
    hydrateSecondaryDisplaySet: actions.hydrateSecondaryDisplaySet,
    getVolumeIdForDisplaySet: actions.getVolumeIdForDisplaySet,
    triggerCreateAnnotationMemo: actions.triggerCreateAnnotationMemo,
    startRecordingForAnnotationGroup: actions.startRecordingForAnnotationGroup,
    endRecordingForAnnotationGroup: actions.endRecordingForAnnotationGroup,
    toggleSegmentLabel: actions.toggleSegmentLabel,
    jumpToMeasurementViewport: actions.jumpToMeasurementViewport,
    initializeSegmentLabelTool: actions.initializeSegmentLabelTool,
    enableCameraLogging: {
      commandFn: actions.enableCameraLogging,
      storeContexts: [],
      options: {},
    },
    disableCameraLogging: {
      commandFn: actions.disableCameraLogging,
      storeContexts: [],
      options: {},
    },
    toggleCameraLogging: {
      commandFn: actions.toggleCameraLogging,
      storeContexts: [],
      options: {},
    },
    getCameraFocalPoints: {
      commandFn: actions.getCameraFocalPoints,
      storeContexts: [],
      options: {},
    },
  };

  return {
    actions,
    definitions,
    defaultContext: 'CORNERSTONE',
  };
}

export default commandsModule;

```

```typescript
import {
  getEnabledElement,
  StackViewport,
  VolumeViewport,
  utilities as csUtils,
  Enums as CoreEnums,
  Types as CoreTypes,
  BaseVolumeViewport,
  getRenderingEngines,
} from '@cornerstonejs/core';
import {
  ToolGroupManager,
  Enums,
  utilities as cstUtils,
  annotation,
  Types as ToolTypes,
} from '@cornerstonejs/tools';
import * as cornerstoneTools from '@cornerstonejs/tools';
import * as labelmapInterpolation from '@cornerstonejs/labelmap-interpolation';
import { ONNXSegmentationController } from '@cornerstonejs/ai';

import { Types as OhifTypes, utils } from '@ohif/core';
import i18n from '@ohif/i18n';
import {
  callInputDialogAutoComplete,
  createReportAsync,
  colorPickerDialog,
  callInputDialog,
} from '@ohif/extension-default';
import { vec3, mat4 } from 'gl-matrix';
import toggleImageSliceSync from './utils/imageSliceSync/toggleImageSliceSync';
import { getFirstAnnotationSelected } from './utils/measurementServiceMappings/utils/selection';
import { getViewportEnabledElement } from './utils/getViewportEnabledElement';
import getActiveViewportEnabledElement from './utils/getActiveViewportEnabledElement';
import toggleVOISliceSync from './utils/toggleVOISliceSync';
import { usePositionPresentationStore, useSegmentationPresentationStore } from './stores';
import { toolNames } from './initCornerstoneTools';
import CornerstoneViewportDownloadForm from './utils/CornerstoneViewportDownloadForm';
import { updateSegmentBidirectionalStats } from './utils/updateSegmentationStats';
import { generateSegmentationCSVReport } from './utils/generateSegmentationCSVReport';
import { getUpdatedViewportsForSegmentation } from './utils/hydrationUtils';
import { SegmentationRepresentations } from '@cornerstonejs/tools/enums';
import { isMeasurementWithinViewport } from './utils/isMeasurementWithinViewport';
import { getCenterExtent } from './utils/getCenterExtent';
import { EasingFunctionEnum } from './utils/transitions';

const { DefaultHistoryMemo } = csUtils.HistoryMemo;
const toggleSyncFunctions = {
  imageSlice: toggleImageSliceSync,
  voi: toggleVOISliceSync,
};

const { segmentation: segmentationUtils } = cstUtils;

const getLabelmapTools = ({ toolGroupService }) => {
  const labelmapTools = [];
  const toolGroupIds = toolGroupService.getToolGroupIds();
  toolGroupIds.forEach(toolGroupId => {
    const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
    const tools = toolGroup.getToolInstances();
    // tools is an object with toolName as the key and tool as the value
    Object.keys(tools).forEach(toolName => {
      const tool = tools[toolName];
      if (tool instanceof cornerstoneTools.LabelmapBaseTool) {
        labelmapTools.push(tool);
      }
    });
  });
  return labelmapTools;
};

const getPreviewTools = ({ toolGroupService }) => {
  const labelmapTools = getLabelmapTools({ toolGroupService });

  const previewTools = labelmapTools.filter(tool => tool.acceptPreview || tool.rejectPreview);

  return previewTools;
};

const segmentAI = new ONNXSegmentationController({
  autoSegmentMode: true,
  models: {
    sam_b: [
      {
        name: 'sam-b-encoder',
        url: 'https://huggingface.co/schmuell/sam-b-fp16/resolve/main/sam_vit_b_01ec64.encoder-fp16.onnx',
        size: 180,
        key: 'encoder',
      },
      {
        name: 'sam-b-decoder',
        url: 'https://huggingface.co/schmuell/sam-b-fp16/resolve/main/sam_vit_b_01ec64.decoder.onnx',
        size: 17,
        key: 'decoder',
      },
    ],
  },
  modelName: 'sam_b',
});
let segmentAIEnabled = false;

function commandsModule({
  servicesManager,
  commandsManager,
  extensionManager,
}: OhifTypes.Extensions.ExtensionParams): OhifTypes.Extensions.CommandsModule {
  const {
    viewportGridService,
    toolGroupService,
    cineService,
    uiDialogService,
    cornerstoneViewportService,
    uiNotificationService,
    measurementService,
    customizationService,
    colorbarService,
    hangingProtocolService,
    syncGroupService,
    segmentationService,
    displaySetService,
    viewportStateService,
  } = servicesManager.services as AppTypes.Services;

  function _getActiveViewportEnabledElement() {
    return getActiveViewportEnabledElement(viewportGridService);
  }

  function _getViewportEnabledElement(viewportId: string) {
    return getViewportEnabledElement(viewportId);
  }

  function _getActiveViewportToolGroupId() {
    const viewport = _getActiveViewportEnabledElement();
    return toolGroupService.getToolGroupForViewport(viewport.id);
  }

  function _getActiveSegmentationInfo() {
    const viewportId = viewportGridService.getActiveViewportId();
    const activeSegmentation = segmentationService.getActiveSegmentation(viewportId);
    const segmentationId = activeSegmentation?.segmentationId;
    const activeSegmentIndex = segmentationService.getActiveSegment(viewportId).segmentIndex;

    return {
      segmentationId,
      segmentIndex: activeSegmentIndex,
    };
  }

  const actions = {
    jumpToMeasurementViewport: ({ annotationUID, measurement }) => {
      cornerstoneTools.annotation.selection.setAnnotationSelected(annotationUID, true);
      const { metadata } = measurement;

      const activeViewportId = viewportGridService.getActiveViewportId();
      // Finds the best viewport to jump to for showing the annotation view reference
      // This may be different from active if there is a viewport already showing the display set.
      const viewportId = cornerstoneViewportService.findNavigationCompatibleViewportId(
        activeViewportId,
        metadata
      );
      if (viewportId) {
        const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);
        viewport.setViewReference(metadata);
        viewport.render();

        /**
         * If the measurement is not visible inside the current viewport,
         * we need to move the camera to the measurement.
         */
        if (!isMeasurementWithinViewport(viewport, measurement)) {
          const camera = viewport.getCamera();
          const { focalPoint: cameraFocalPoint, position: cameraPosition } = camera;
          const { center, extent } = getCenterExtent(measurement);
          const position = vec3.sub(vec3.create(), cameraPosition, cameraFocalPoint);
          vec3.add(position, position, center);
          viewport.setCamera({ focalPoint: center, position: position as any });
          /** Zoom out if the measurement is too large */
          const measurementSize = vec3.dist(extent.min, extent.max);
          if (measurementSize > camera.parallelScale) {
            const scaleFactor = measurementSize / camera.parallelScale;
            viewport.setZoom(viewport.getZoom() / scaleFactor);
          }
          viewport.render();
        }

        return;
      }

      const { displaySetInstanceUID: referencedDisplaySetInstanceUID } = measurement;
      if (!referencedDisplaySetInstanceUID) {
        console.warn('ViewportGrid::No display set found in', measurement);
        return;
      }

      // Finds the viewport to update to show the given displayset/orientation.
      // This will choose a view already containing the measurement display set
      // if possible, otherwise will fallback to the active.
      const viewportToUpdate = cornerstoneViewportService.findUpdateableViewportConfiguration(
        activeViewportId,
        measurement
      );

      if (!viewportToUpdate) {
        console.warn('Unable to find a viewport to show this in');
        return;
      }
      const updatedViewports = hangingProtocolService.getViewportsRequireUpdate(
        viewportToUpdate.viewportId,
        referencedDisplaySetInstanceUID
      );

      if (!updatedViewports?.[0]) {
        console.warn(
          'ViewportGrid::Unable to navigate to viewport containing',
          referencedDisplaySetInstanceUID
        );
        return;
      }

      updatedViewports[0].viewportOptions = viewportToUpdate.viewportOptions;

      // Update stored position presentation
      commandsManager.run('updateStoredPositionPresentation', {
        viewportId: viewportToUpdate.viewportId,
        displaySetInstanceUIDs: [referencedDisplaySetInstanceUID],
        referencedImageId: measurement.referencedImageId,
        options: {
          ...measurement.metadata,
        },
      });

      commandsManager.run('setDisplaySetsForViewports', { viewportsToUpdate: updatedViewports });
    },

    hydrateSecondaryDisplaySet: async ({ displaySet, viewportId }) => {
      if (!displaySet) {
        return;
      }

      if (displaySet.isOverlayDisplaySet) {
        // update the previously stored segmentationPresentation with the new viewportId
        // presentation so that when we put the referencedDisplaySet back in the viewport
        // it will have the correct segmentation representation hydrated
        commandsManager.runCommand('updateStoredSegmentationPresentation', {
          displaySet,
          type:
            displaySet.Modality === 'SEG'
              ? SegmentationRepresentations.Labelmap
              : SegmentationRepresentations.Contour,
        });
      }

      const referencedDisplaySetInstanceUID = displaySet.referencedDisplaySetInstanceUID;

      const storePositionPresentation = refDisplaySet => {
        // update the previously stored positionPresentation with the new viewportId
        // presentation so that when we put the referencedDisplaySet back in the viewport
        // it will be in the correct position zoom and pan
        commandsManager.runCommand('updateStoredPositionPresentation', {
          viewportId,
          displaySetInstanceUIDs: [refDisplaySet.displaySetInstanceUID],
        });
      };

      if (displaySet.Modality === 'SEG' || displaySet.Modality === 'RTSTRUCT') {
        const referencedDisplaySet = displaySetService.getDisplaySetByUID(
          referencedDisplaySetInstanceUID
        );
        storePositionPresentation(referencedDisplaySet);
        return commandsManager.runCommand('loadSegmentationDisplaySetsForViewport', {
          viewportId,
          displaySetInstanceUIDs: [referencedDisplaySet.displaySetInstanceUID],
        });
      } else if (displaySet.Modality === 'SR') {
        const results = commandsManager.runCommand('hydrateStructuredReport', {
          displaySetInstanceUID: displaySet.displaySetInstanceUID,
        });
        const { SeriesInstanceUIDs } = results;
        const referencedDisplaySets = displaySetService.getDisplaySetsForSeries(
          SeriesInstanceUIDs[0]
        );
        referencedDisplaySets.forEach(storePositionPresentation);

        if (referencedDisplaySets.length) {
          actions.setDisplaySetsForViewports({
            viewportsToUpdate: [
              {
                viewportId: viewportGridService.getActiveViewportId(),
                displaySetInstanceUIDs: [referencedDisplaySets[0].displaySetInstanceUID],
              },
            ],
          });
        }
        return results;
      }
    },
    runSegmentBidirectional: async ({ segmentationId, segmentIndex } = {}) => {
      // Get active segmentation if not specified
      const targetSegmentation =
        segmentationId && segmentIndex
          ? { segmentationId, segmentIndex }
          : _getActiveSegmentationInfo();

      const { segmentationId: targetId, segmentIndex: targetIndex } = targetSegmentation;

      // Get bidirectional measurement data
      const bidirectionalData = await cstUtils.segmentation.getSegmentLargestBidirectional({
        segmentationId: targetId,
        segmentIndices: [targetIndex],
      });

      const activeViewportId = viewportGridService.getActiveViewportId();

      // Process each bidirectional measurement
      bidirectionalData.forEach(measurement => {
        const { segmentIndex, majorAxis, minorAxis } = measurement;

        // Create annotation
        const annotation = cornerstoneTools.SegmentBidirectionalTool.hydrate(
          activeViewportId,
          [majorAxis, minorAxis],
          {
            segmentIndex,
            segmentationId: targetId,
          }
        );

        measurement.annotationUID = annotation.annotationUID;

        // Update segmentation stats
        const updatedSegmentation = updateSegmentBidirectionalStats({
          segmentationId: targetId,
          segmentIndex: targetIndex,
          bidirectionalData: measurement,
          segmentationService,
          annotation,
        });

        // Save changes if needed
        if (updatedSegmentation) {
          segmentationService.addOrUpdateSegmentation({
            segmentationId: targetId,
            segments: updatedSegmentation.segments,
          });
        }
      });

      // get the active segmentIndex bidirectional annotation and jump to it
      const activeBidirectional = bidirectionalData.find(
        measurement => measurement.segmentIndex === targetIndex
      );
      commandsManager.run('jumpToMeasurement', {
        uid: activeBidirectional.annotationUID,
      });
    },
    interpolateLabelmap: () => {
      const { segmentationId, segmentIndex } = _getActiveSegmentationInfo();
      labelmapInterpolation.interpolate({
        segmentationId,
        segmentIndex,
      });
    },
    /**
     * Generates the selector props for the context menu, specific to
     * the cornerstone viewport, and then runs the context menu.
     */
    showCornerstoneContextMenu: options => {
      const element = _getActiveViewportEnabledElement()?.viewport?.element;

      const optionsToUse = { ...options, element };
      const { useSelectedAnnotation, nearbyToolData, event } = optionsToUse;

      // This code is used to invoke the context menu via keyboard shortcuts
      if (useSelectedAnnotation && !nearbyToolData) {
        const firstAnnotationSelected = getFirstAnnotationSelected(element);
        // filter by allowed selected tools from config property (if there is any)
        const isToolAllowed =
          !optionsToUse.allowedSelectedTools ||
          optionsToUse.allowedSelectedTools.includes(firstAnnotationSelected?.metadata?.toolName);
        if (isToolAllowed) {
          optionsToUse.nearbyToolData = firstAnnotationSelected;
        } else {
          return;
        }
      }

      optionsToUse.defaultPointsPosition = [];
      // if (optionsToUse.nearbyToolData) {
      //   optionsToUse.defaultPointsPosition = commandsManager.runCommand(
      //     'getToolDataActiveCanvasPoints',
      //     { toolData: optionsToUse.nearbyToolData }
      //   );
      // }

      // TODO - make the selectorProps richer by including the study metadata and display set.
      optionsToUse.selectorProps = {
        toolName: optionsToUse.nearbyToolData?.metadata?.toolName,
        value: optionsToUse.nearbyToolData,
        uid: optionsToUse.nearbyToolData?.annotationUID,
        nearbyToolData: optionsToUse.nearbyToolData,
        event,
        ...optionsToUse.selectorProps,
      };

      commandsManager.run(options, optionsToUse);
    },
    updateStoredSegmentationPresentation: ({ displaySet, type }) => {
      const { addSegmentationPresentationItem } = useSegmentationPresentationStore.getState();

      const referencedDisplaySetInstanceUID = displaySet.referencedDisplaySetInstanceUID;
      addSegmentationPresentationItem(referencedDisplaySetInstanceUID, {
        segmentationId: displaySet.displaySetInstanceUID,
        hydrated: true,
        type,
      });
    },

    /** Stores the changed position presentation */
    updateStoredPositionPresentation: ({
      viewportId,
      displaySetInstanceUIDs,
      referencedImageId,
      options,
    }) => {
      const presentations = cornerstoneViewportService.getPresentations(viewportId);
      const { positionPresentationStore, setPositionPresentation, getPositionPresentationId } =
        usePositionPresentationStore.getState();

      // Look inside positionPresentationStore and find the key that includes ALL the displaySetInstanceUIDs
      // and the value has viewportId as activeViewportId.
      let previousReferencedDisplaySetStoreKey;

      if (
        displaySetInstanceUIDs &&
        Array.isArray(displaySetInstanceUIDs) &&
        displaySetInstanceUIDs.length > 0
      ) {
        previousReferencedDisplaySetStoreKey = Object.entries(positionPresentationStore).find(
          ([key, value]) => {
            return (
              displaySetInstanceUIDs.every(uid => key.includes(uid)) &&
              value?.viewportId === viewportId
            );
          }
        )?.[0];
      }

      // Create presentation data with referencedImageId and options if provided
      const presentationData =
        referencedImageId || options?.FrameOfReferenceUID
          ? {
              ...presentations.positionPresentation,
              viewReference: {
                referencedImageId,
                ...options,
              },
            }
          : presentations.positionPresentation;

      if (previousReferencedDisplaySetStoreKey) {
        setPositionPresentation(previousReferencedDisplaySetStoreKey, presentationData);
        return;
      }

      // if not found means we have not visited that referencedDisplaySetInstanceUID before
      // so we need to grab the positionPresentationId directly from the store,
      // Todo: this is really hacky, we should have a better way for this
      const positionPresentationId = getPositionPresentationId({
        displaySetInstanceUIDs,
        viewportId,
      });

      setPositionPresentation(positionPresentationId, presentationData);
    },
    getNearbyToolData({ nearbyToolData, element, canvasCoordinates }) {
      return nearbyToolData ?? cstUtils.getAnnotationNearPoint(element, canvasCoordinates);
    },
    getNearbyAnnotation({ element, canvasCoordinates }) {
      const nearbyToolData = actions.getNearbyToolData({
        nearbyToolData: null,
        element,
        canvasCoordinates,
      });

      const isAnnotation = toolName => {
        const enabledElement = getEnabledElement(element);

        if (!enabledElement) {
          return;
        }

        const { renderingEngineId, viewportId } = enabledElement;
        const toolGroup = ToolGroupManager.getToolGroupForViewport(viewportId, renderingEngineId);

        const toolInstance = toolGroup.getToolInstance(toolName);

        return toolInstance?.constructor?.isAnnotation ?? true;
      };

      return nearbyToolData?.metadata?.toolName && isAnnotation(nearbyToolData.metadata.toolName)
        ? nearbyToolData
        : null;
    },
    /**
     * Common logic for handling measurement label updates through dialog
     * @param uid - measurement uid
     * @returns Promise that resolves when the label is updated
     */
    _handleMeasurementLabelDialog: async uid => {
      const labelConfig = customizationService.getCustomization('measurementLabels');
      const renderContent = customizationService.getCustomization('ui.labellingComponent');
      const measurement = measurementService.getMeasurement(uid);

      if (!measurement) {
        console.debug('No measurement found for label editing');
        return;
      }

      if (!labelConfig) {
        const label = await callInputDialog({
          uiDialogService,
          title: i18n.t('Tools:Edit Measurement Label'),
          placeholder: measurement.label || i18n.t('Tools:Enter new label'),
          defaultValue: measurement.label,
        });

        if (label !== undefined && label !== null) {
          measurementService.update(uid, { ...measurement, label }, true);
        }
        return;
      }

      const val = await callInputDialogAutoComplete({
        measurement,
        uiDialogService,
        labelConfig,
        renderContent,
      });

      if (val !== undefined && val !== null) {
        measurementService.update(uid, { ...measurement, label: val }, true);
      }
    },
    /**
     * Show the measurement labelling input dialog and update the label
     * on the measurement with a response if not cancelled.
     */
    setMeasurementLabel: async ({ uid }) => {
      await actions._handleMeasurementLabelDialog(uid);
    },
    renameMeasurement: async ({ uid }) => {
      await actions._handleMeasurementLabelDialog(uid);
    },
    /**
     *
     * @param props - containing the updates to apply
     * @param props.measurementKey - chooses the measurement key to apply the
     *        code to.  This will typically be finding or site to apply a
     *        finding code or a findingSites code.
     * @param props.code - A coding scheme value from DICOM, including:
     *       * CodeValue - the language independent code, for example '1234'
     *       * CodingSchemeDesignator - the issue of the code value
     *       * CodeMeaning - the text value shown to the user
     *       * ref - a string reference in the form `<designator>:<codeValue>`
     *       * type - defaulting to 'finding'.  Will replace other codes of same type
     *       * style - a styling object to use
     *       * Other fields
     *     Note it is a valid option to remove the finding or site values by
     *     supplying null for the code.
     * @param props.uid - the measurement UID to find it with
     * @param props.label - the text value for the code.  Has NOTHING to do with
     *        the measurement label, which can be set with textLabel
     * @param props.textLabel is the measurement label to apply.  Set to null to
     *            delete.
     *
     * If the measurementKey is `site`, then the code will also be added/replace
     * the 0 element of findingSites.  This behaviour is expected to be enhanced
     * in the future with ability to set other site information.
     */
    updateMeasurement: props => {
      const { code, uid, textLabel, label } = props;
      let { style } = props;
      const measurement = measurementService.getMeasurement(uid);
      if (!measurement) {
        console.warn('No measurement found to update', uid);
        return;
      }
      const updatedMeasurement = {
        ...measurement,
      };
      // Call it textLabel as the label value
      // TODO - remove the label setting when direct rendering of findingSites is enabled
      if (textLabel !== undefined) {
        updatedMeasurement.label = textLabel;
      }
      if (code !== undefined) {
        const measurementKey = code.type || 'finding';

        if (code.ref && !code.CodeValue) {
          const split = code.ref.indexOf(':');
          code.CodeValue = code.ref.substring(split + 1);
          code.CodeMeaning = code.text || label;
          code.CodingSchemeDesignator = code.ref.substring(0, split);
        }
        updatedMeasurement[measurementKey] = code;
        if (measurementKey !== 'finding') {
          if (updatedMeasurement.findingSites) {
            updatedMeasurement.findingSites = updatedMeasurement.findingSites.filter(
              it => it.type !== measurementKey
            );
            updatedMeasurement.findingSites.push(code);
          } else {
            updatedMeasurement.findingSites = [code];
          }
        }
      }

      style ||= updatedMeasurement.finding?.style;
      style ||= updatedMeasurement.findingSites?.find(site => site?.style)?.style;

      if (style) {
        // Reset the selected values to preserve appearance on selection
        style.lineDashSelected ||= style.lineDash;
        annotation.config.style.setAnnotationStyles(measurement.uid, style);

        // this is a bit ugly, but given the underlying behavior, this is how it needs to work.
        switch (measurement.toolName) {
          case toolNames.PlanarFreehandROI: {
            const targetAnnotation = annotation.state.getAnnotation(measurement.uid);
            targetAnnotation.data.isOpenUShapeContour = !!style.isOpenUShapeContour;
            break;
          }
          default:
            break;
        }
      }
      measurementService.update(updatedMeasurement.uid, updatedMeasurement, true);
    },

    /**
     * Jumps to the specified (by uid) measurement in the active viewport.
     * Also marks any provided display measurements isActive value
     */
    jumpToMeasurement: ({ uid, displayMeasurements = [] }) => {
      measurementService.jumpToMeasurement(viewportGridService.getActiveViewportId(), uid);
      for (const measurement of displayMeasurements) {
        measurement.isActive = measurement.uid === uid;
      }
    },

    removeMeasurement: ({ uid }) => {
      if (Array.isArray(uid)) {
        measurementService.removeMany(uid);
      } else {
        measurementService.remove(uid);
      }
    },

    toggleLockMeasurement: ({ uid }) => {
      measurementService.toggleLockMeasurement(uid);
    },

    toggleVisibilityMeasurement: ({ uid, items, visibility }) => {
      if (visibility === undefined && items?.length) {
        visibility = !items[0].isVisible;
      }
      if (Array.isArray(uid)) {
        measurementService.toggleVisibilityMeasurementMany(uid, visibility);
      } else {
        measurementService.toggleVisibilityMeasurement(uid, visibility);
      }
    },

    /**
     * Download the CSV report for the measurements.
     */
    downloadCSVMeasurementsReport: ({ measurementFilter }) => {
      utils.downloadCSVReport(measurementService.getMeasurements(measurementFilter));
    },

    downloadCSVSegmentationReport: ({ segmentationId }) => {
      const segmentation = segmentationService.getSegmentation(segmentationId);

      const { representationData } = segmentation;
      const { Labelmap } = representationData;
      const { referencedImageIds } = Labelmap;

      const firstImageId = referencedImageIds[0];

      // find displaySet for firstImageId
      const displaySet = displaySetService
        .getActiveDisplaySets()
        .find(ds => ds.imageIds?.some(i => i === firstImageId));

      const {
        SeriesNumber,
        SeriesInstanceUID,
        StudyInstanceUID,
        SeriesDate,
        SeriesTime,
        SeriesDescription,
      } = displaySet;

      const additionalInfo = {
        reference: {
          SeriesNumber,
          SeriesInstanceUID,
          StudyInstanceUID,
          SeriesDate,
          SeriesTime,
          SeriesDescription,
        },
      };

      generateSegmentationCSVReport(segmentation, additionalInfo);
    },

    // Retrieve value commands
    getActiveViewportEnabledElement: _getActiveViewportEnabledElement,

    setViewportActive: ({ viewportId }) => {
      const viewportInfo = cornerstoneViewportService.getViewportInfo(viewportId);
      if (!viewportInfo) {
        console.warn('No viewport found for viewportId:', viewportId);
        return;
      }

      viewportGridService.setActiveViewportId(viewportId);
    },
    arrowTextCallback: async ({ callback, data }) => {
      const labelConfig = customizationService.getCustomization('measurementLabels');
      const renderContent = customizationService.getCustomization('ui.labellingComponent');

      if (!labelConfig) {
        const label = await callInputDialog({
          uiDialogService,
          title: i18n.t('Tools:Edit Arrow Text'),
          placeholder: data?.data?.label || i18n.t('Tools:Enter new text'),
          defaultValue: data?.data?.label || '',
        });

        callback?.(label);
        return;
      }

      const value = await callInputDialogAutoComplete({
        uiDialogService,
        labelConfig,
        renderContent,
      });
      callback?.(value);
    },

    toggleCine: () => {
      const { viewports } = viewportGridService.getState();
      const { isCineEnabled } = cineService.getState();
      cineService.setIsCineEnabled(!isCineEnabled);
      viewports.forEach((_, index) => cineService.setCine({ id: index, isPlaying: false }));
    },

    setViewportWindowLevel({
      viewportId,
      windowWidth,
      windowCenter,
      displaySetInstanceUID,
    }: {
      viewportId: string;
      windowWidth: number;
      windowCenter: number;
      displaySetInstanceUID?: string;
    }) {
      // convert to numbers
      const windowWidthNum = Number(windowWidth);
      const windowCenterNum = Number(windowCenter);

      // get actor from the viewport
      const renderingEngine = cornerstoneViewportService.getRenderingEngine();
      const viewport = renderingEngine.getViewport(viewportId);

      const { lower, upper } = csUtils.windowLevel.toLowHighRange(windowWidthNum, windowCenterNum);

      if (viewport instanceof BaseVolumeViewport) {
        const volumeId = actions.getVolumeIdForDisplaySet({
          viewportId,
          displaySetInstanceUID,
        });
        viewport.setProperties(
          {
            voiRange: {
              upper,
              lower,
            },
          },
          volumeId
        );
      } else {
        viewport.setProperties({
          voiRange: {
            upper,
            lower,
          },
        });
      }
      viewport.render();
    },
    toggleViewportColorbar: ({ viewportId, displaySetInstanceUIDs, options = {} }) => {
      const hasColorbar = colorbarService.hasColorbar(viewportId);
      if (hasColorbar) {
        colorbarService.removeColorbar(viewportId);
        return;
      }
      colorbarService.addColorbar(viewportId, displaySetInstanceUIDs, options);
    },
    setWindowLevel(props) {
      const { toolGroupId } = props;
      const { viewportId } = _getActiveViewportEnabledElement();
      const viewportToolGroupId = toolGroupService.getToolGroupForViewport(viewportId);

      if (toolGroupId && toolGroupId !== viewportToolGroupId) {
        return;
      }

      actions.setViewportWindowLevel({ ...props, viewportId });
    },
    setWindowLevelPreset: ({ presetName, presetIndex }) => {
      const windowLevelPresets = customizationService.getCustomization(
        'cornerstone.windowLevelPresets'
      );

      const activeViewport = viewportGridService.getActiveViewportId();
      const viewport = cornerstoneViewportService.getCornerstoneViewport(activeViewport);
      const metadata = viewport.getImageData().metadata;

      const modality = metadata.Modality;

      if (!modality) {
        return;
      }

      const windowLevelPresetForModality = windowLevelPresets[modality];

      if (!windowLevelPresetForModality) {
        return;
      }

      const windowLevelPreset =
        windowLevelPresetForModality[presetName] ??
        Object.values(windowLevelPresetForModality)[presetIndex];

      actions.setViewportWindowLevel({
        viewportId: activeViewport,
        windowWidth: windowLevelPreset.window,
        windowCenter: windowLevelPreset.level,
      });
    },
    getVolumeIdForDisplaySet: ({ viewportId, displaySetInstanceUID }) => {
      const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);
      if (viewport instanceof BaseVolumeViewport) {
        const volumeIds = viewport.getAllVolumeIds();
        const volumeId = volumeIds.find(id => id.includes(displaySetInstanceUID));
        return volumeId;
      }
      return null;
    },
    setToolEnabled: ({ toolName, toggle, toolGroupId }) => {
      const { viewports } = viewportGridService.getState();

      if (!viewports.size) {
        return;
      }

      const toolGroup = toolGroupService.getToolGroup(toolGroupId ?? null);

      if (!toolGroup || !toolGroup.hasTool(toolName)) {
        return;
      }

      const toolIsEnabled = toolGroup.getToolOptions(toolName).mode === Enums.ToolModes.Enabled;

      // Toggle the tool's state only if the toggle is true
      if (toggle) {
        toolIsEnabled ? toolGroup.setToolDisabled(toolName) : toolGroup.setToolEnabled(toolName);
      } else {
        toolGroup.setToolEnabled(toolName);
      }

      const renderingEngine = cornerstoneViewportService.getRenderingEngine();
      renderingEngine.render();
    },
    toggleEnabledDisabledToolbar({ value, itemId, toolGroupId }) {
      const toolName = itemId || value;
      toolGroupId = toolGroupId ?? _getActiveViewportToolGroupId();

      const toolGroup = toolGroupService.getToolGroup(toolGroupId);
      if (!toolGroup || !toolGroup.hasTool(toolName)) {
        return;
      }

      const toolIsEnabled = toolGroup.getToolOptions(toolName).mode === Enums.ToolModes.Enabled;

      toolIsEnabled ? toolGroup.setToolDisabled(toolName) : toolGroup.setToolEnabled(toolName);
    },
    toggleActiveDisabledToolbar({ value, itemId, toolGroupId }) {
      const toolName = itemId || value;
      toolGroupId = toolGroupId ?? _getActiveViewportToolGroupId();
      const toolGroup = toolGroupService.getToolGroup(toolGroupId);
      if (!toolGroup || !toolGroup.hasTool(toolName)) {
        return;
      }

      const toolIsActive = [
        Enums.ToolModes.Active,
        Enums.ToolModes.Enabled,
        Enums.ToolModes.Passive,
      ].includes(toolGroup.getToolOptions(toolName).mode);

      toolIsActive
        ? toolGroup.setToolDisabled(toolName)
        : actions.setToolActive({ toolName, toolGroupId });

      // we should set the previously active tool to active after we set the
      // current tool disabled
      if (toolIsActive) {
        const prevToolName = toolGroup.getPrevActivePrimaryToolName();
        if (prevToolName !== toolName) {
          actions.setToolActive({ toolName: prevToolName, toolGroupId });
        }
      }
    },
    setToolActiveToolbar: ({ value, itemId, toolName, toolGroupIds = [] }) => {
      // Sometimes it is passed as value (tools with options), sometimes as itemId (toolbar buttons)
      toolName = toolName || itemId || value;

      toolGroupIds = toolGroupIds.length ? toolGroupIds : toolGroupService.getToolGroupIds();

      toolGroupIds.forEach(toolGroupId => {
        actions.setToolActive({ toolName, toolGroupId });
      });
    },
    setToolActive: ({ toolName, toolGroupId = null }) => {
      const { viewports } = viewportGridService.getState();

      if (!viewports.size) {
        return;
      }

      const toolGroup = toolGroupService.getToolGroup(toolGroupId);

      if (!toolGroup) {
        return;
      }

      if (!toolGroup?.hasTool(toolName)) {
        return;
      }

      const activeToolName = toolGroup.getActivePrimaryMouseButtonTool();

      if (activeToolName) {
        const activeToolOptions = toolGroup.getToolConfiguration(activeToolName);
        activeToolOptions?.disableOnPassive
          ? toolGroup.setToolDisabled(activeToolName)
          : toolGroup.setToolPassive(activeToolName);
      }

      // Set the new toolName to be active
      toolGroup.setToolActive(toolName, {
        bindings: [
          {
            mouseButton: Enums.MouseBindings.Primary,
          },
        ],
      });
    },
    // capture viewport
    showDownloadViewportModal: () => {
      const { activeViewportId } = viewportGridService.getState();

      if (!cornerstoneViewportService.getCornerstoneViewport(activeViewportId)) {
        // Cannot download a non-cornerstone viewport (image).
        uiNotificationService.show({
          title: i18n.t('Tools:Download Image'),
          message: i18n.t('Tools:Image cannot be downloaded'),
          type: 'error',
        });
        return;
      }

      const { uiModalService } = servicesManager.services;

      if (uiModalService) {
        uiModalService.show({
          content: CornerstoneViewportDownloadForm,
          title: i18n.t('Tools:Download High Quality Image'),
          contentProps: {
            activeViewportId,
            cornerstoneViewportService,
          },
          containerClassName: 'max-w-4xl p-4',
        });
      }
    },
    /**
     * Rotates the viewport by `rotation` relative to its current rotation.
     */
    rotateViewportBy: ({ rotation, viewportId }: { rotation: number; viewportId?: string }) => {
      actions._rotateViewport({ rotation, viewportId, rotationMode: 'apply' });
    },
    /**
     * Sets the viewport rotation to an absolute value `rotation`.
     */
    setViewportRotation: ({ rotation, viewportId }: { rotation: number; viewportId?: string }) => {
      actions._rotateViewport({ rotation, viewportId, rotationMode: 'set' });
    },
    flipViewportHorizontal: ({
      viewportId,
      newValue = 'toggle',
    }: {
      viewportId?: string;
      newValue?: 'toggle' | boolean;
    }) => {
      const enabledElement = viewportId
        ? _getViewportEnabledElement(viewportId)
        : _getActiveViewportEnabledElement();

      if (!enabledElement) {
        return;
      }

      const { viewport } = enabledElement;

      let flipHorizontal: boolean;
      if (newValue === 'toggle') {
        const { flipHorizontal: currentHorizontalFlip } = viewport.getCamera();
        flipHorizontal = !currentHorizontalFlip;
      } else {
        flipHorizontal = newValue;
      }

      viewport.setCamera({ flipHorizontal });
      viewport.render();
    },
    flipViewportVertical: ({
      viewportId,
      newValue = 'toggle',
    }: {
      viewportId?: string;
      newValue?: 'toggle' | boolean;
    }) => {
      const enabledElement = viewportId
        ? _getViewportEnabledElement(viewportId)
        : _getActiveViewportEnabledElement();

      if (!enabledElement) {
        return;
      }

      const { viewport } = enabledElement;

      let flipVertical: boolean;
      if (newValue === 'toggle') {
        const { flipVertical: currentVerticalFlip } = viewport.getCamera();
        flipVertical = !currentVerticalFlip;
      } else {
        flipVertical = newValue;
      }
      viewport.setCamera({ flipVertical });
      viewport.render();
    },
    invertViewport: ({ element }) => {
      let enabledElement;

      if (element === undefined) {
        enabledElement = _getActiveViewportEnabledElement();
      } else {
        enabledElement = element;
      }

      if (!enabledElement) {
        return;
      }

      const { viewport } = enabledElement;

      const { invert } = viewport.getProperties();
      viewport.setProperties({ invert: !invert });
      viewport.render();
    },
    resetViewport: () => {
      const enabledElement = _getActiveViewportEnabledElement();

      if (!enabledElement) {
        return;
      }

      const { viewport } = enabledElement;

      viewport.resetProperties?.();
      viewport.resetCamera();

      viewport.render();
    },
    scaleViewport: ({ direction }) => {
      const enabledElement = _getActiveViewportEnabledElement();
      const scaleFactor = direction > 0 ? 0.9 : 1.1;

      if (!enabledElement) {
        return;
      }
      const { viewport } = enabledElement;

      if (viewport instanceof StackViewport) {
        if (direction) {
          const { parallelScale } = viewport.getCamera();
          viewport.setCamera({ parallelScale: parallelScale * scaleFactor });
          viewport.render();
        } else {
          viewport.resetCamera();
          viewport.render();
        }
      }
    },

    /** Jumps the active viewport or the specified one to the given slice index */
    jumpToImage: ({ imageIndex, viewport: gridViewport }): void => {
      // Get current active viewport (return if none active)
      let viewport;
      if (!gridViewport) {
        const enabledElement = _getActiveViewportEnabledElement();
        if (!enabledElement) {
          return;
        }
        viewport = enabledElement.viewport;
      } else {
        viewport = cornerstoneViewportService.getCornerstoneViewport(gridViewport.id);
      }

      // Get number of slices
      // -> Copied from cornerstone3D jumpToSlice\_getImageSliceData()
      let numberOfSlices = 0;

      if (viewport instanceof StackViewport) {
        numberOfSlices = viewport.getImageIds().length;
      } else if (viewport instanceof VolumeViewport) {
        numberOfSlices = csUtils.getImageSliceDataForVolumeViewport(viewport).numberOfSlices;
      } else {
        throw new Error('Unsupported viewport type');
      }

      const jumpIndex = imageIndex < 0 ? numberOfSlices + imageIndex : imageIndex;
      if (jumpIndex >= numberOfSlices || jumpIndex < 0) {
        throw new Error(`Can't jump to ${imageIndex}`);
      }

      // Set slice to last slice
      const options = { imageIndex: jumpIndex };
      csUtils.jumpToSlice(viewport.element, options);
    },
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
    setViewportColormap: ({
      viewportId,
      displaySetInstanceUID,
      colormap,
      opacity = 1,
      immediate = false,
    }) => {
      const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);

      let hpOpacity;
      // Retrieve active protocol's viewport match details
      const { viewportMatchDetails } = hangingProtocolService.getActiveProtocol();
      // Get display set options for the specified viewport ID
      const displaySetsInfo = viewportMatchDetails.get(viewportId)?.displaySetsInfo;

      if (displaySetsInfo) {
        // Find the display set that matches the given UID
        const matchingDisplaySet = displaySetsInfo.find(
          displaySet => displaySet.displaySetInstanceUID === displaySetInstanceUID
        );
        // If a matching display set is found, update the opacity with its value
        hpOpacity = matchingDisplaySet?.displaySetOptions?.options?.colormap?.opacity;
      }

      // HP takes priority over the default opacity
      colormap = { ...colormap, opacity: hpOpacity || opacity };

      if (viewport instanceof StackViewport) {
        viewport.setProperties({ colormap });
      }

      if (viewport instanceof VolumeViewport) {
        if (!displaySetInstanceUID) {
          const { viewports } = viewportGridService.getState();
          displaySetInstanceUID = viewports.get(viewportId)?.displaySetInstanceUIDs[0];
        }

        // ToDo: Find a better way of obtaining the volumeId that corresponds to the displaySetInstanceUID
        const volumeId =
          viewport
            .getAllVolumeIds()
            .find((_volumeId: string) => _volumeId.includes(displaySetInstanceUID)) ??
          viewport.getVolumeId();
        viewport.setProperties({ colormap }, volumeId);
      }

      if (immediate) {
        viewport.render();
      }
    },
    changeActiveViewport: ({ direction = 1 }) => {
      const { activeViewportId, viewports } = viewportGridService.getState();
      const viewportIds = Array.from(viewports.keys());
      const currentIndex = viewportIds.indexOf(activeViewportId);
      const nextViewportIndex =
        (currentIndex + direction + viewportIds.length) % viewportIds.length;
      viewportGridService.setActiveViewportId(viewportIds[nextViewportIndex] as string);
    },
    /**
     * If the syncId is given and a synchronizer with that ID already exists, it will
     * toggle it on/off for the provided viewports. If not, it will attempt to create
     * a new synchronizer using the given syncId and type for the specified viewports.
     * If no viewports are provided, you may notice some default behavior.
     * - 'voi' type, we will aim to synchronize all viewports with the same modality
     * -'imageSlice' type, we will aim to synchronize all viewports with the same orientation.
     *
     * @param options
     * @param options.viewports - The viewports to synchronize
     * @param options.syncId - The synchronization group ID
     * @param options.type - The type of synchronization to perform
     */
    toggleSynchronizer: ({ type, viewports, syncId }) => {
      const synchronizer = syncGroupService.getSynchronizer(syncId);

      if (synchronizer) {
        synchronizer.isDisabled() ? synchronizer.setEnabled(true) : synchronizer.setEnabled(false);
        return;
      }

      const fn = toggleSyncFunctions[type];

      if (fn) {
        fn({
          servicesManager,
          viewports,
          syncId,
        });
      }
    },
    setViewportForToolConfiguration: ({ viewportId, toolName }) => {
      if (!viewportId) {
        const { activeViewportId } = viewportGridService.getState();
        viewportId = activeViewportId ?? 'default';
      }

      const toolGroup = toolGroupService.getToolGroupForViewport(viewportId);

      if (!toolGroup?.hasTool(toolName)) {
        return;
      }

      const prevConfig = toolGroup?.getToolConfiguration(toolName);
      toolGroup?.setToolConfiguration(
        toolName,
        {
          ...prevConfig,
          sourceViewportId: viewportId,
        },
        true // overwrite
      );

      const renderingEngine = cornerstoneViewportService.getRenderingEngine();
      renderingEngine.render();
    },
    storePresentation: ({ viewportId }) => {
      cornerstoneViewportService.storePresentation({ viewportId });
    },
    updateVolumeData: ({ volume }) => {
      // update vtkOpenGLTexture and imageData of computed volume
      const { imageData, vtkOpenGLTexture } = volume;
      const numSlices = imageData.getDimensions()[2];
      const slicesToUpdate = [...Array(numSlices).keys()];
      slicesToUpdate.forEach(i => {
        vtkOpenGLTexture.setUpdatedFrame(i);
      });
      imageData.modified();
    },

    attachProtocolViewportDataListener: ({ protocol, stageIndex }) => {
      const EVENT = cornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED;
      const command = protocol.callbacks.onViewportDataInitialized;
      const numPanes = protocol.stages?.[stageIndex]?.viewports.length ?? 1;
      let numPanesWithData = 0;
      const { unsubscribe } = cornerstoneViewportService.subscribe(EVENT, evt => {
        numPanesWithData++;

        if (numPanesWithData === numPanes) {
          commandsManager.run(...command);

          // Unsubscribe from the event
          unsubscribe(EVENT);
        }
      });
    },

    setViewportPreset: ({ viewportId, preset }) => {
      const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);
      if (!viewport) {
        return;
      }
      viewport.setProperties({
        preset,
      });

      // After setting preset, ensure sample distance is safe for volume rendering (3D and MPR)
      // This prevents "steps required exceeds maximum" errors by adjusting the sample distance
      const isVolumeViewport = viewport.type === CoreEnums.ViewportType.VOLUME_3D ||
                               viewport.type === CoreEnums.ViewportType.ORTHOGRAPHIC;

      if (isVolumeViewport) {
        console.log(`[setViewportPreset] Processing viewport type: ${viewport.type}, preset: ${preset}`);
        try {
          const actors = viewport.getActors();
          if (actors && actors.length > 0) {
            const { actor } = actors[0];
            const mapper = actor.getMapper();
            if (mapper && mapper.setSampleDistance) {
              const image = mapper.getInputData?.();
              if (image) {
                const dims = image.getDimensions();
                const spacing = image.getSpacing();
                const spatialDiagonal = Math.sqrt(
                  (dims[0] * spacing[0]) ** 2 +
                  (dims[1] * spacing[1]) ** 2 +
                  (dims[2] * spacing[2]) ** 2
                );
                const maxSamples = mapper.getMaximumSamplesPerRay?.() || 4000;
                const minRequiredDistance = (spatialDiagonal / (maxSamples * 0.8));
                const currentDistance = mapper.getSampleDistance?.();

                if (!currentDistance || currentDistance < minRequiredDistance) {
                  console.log(`[setViewportPreset] Adjusting sample distance: ${currentDistance?.toFixed(4)} → ${minRequiredDistance.toFixed(4)}`);
                  mapper.setSampleDistance(minRequiredDistance);
                }
              }
            }
          }
        } catch (error) {
          console.error('Failed to adjust sample distance after preset:', error);
        }
      }

      viewport.render();
    },

    /**
     * Sets the volume quality for a given viewport.
     * @param {string} viewportId - The ID of the viewport to set the volume quality.
     * @param {number} volumeQuality - The desired quality level of the volume rendering.
     */

    setVolumeRenderingQulaity: ({ viewportId, volumeQuality }) => {
      const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);

      // console.log(`[setVolumeRenderingQuality] Viewport type: ${viewport.type}, quality: ${volumeQuality}, id: ${viewportId}`);

      const { actor } = viewport.getActors()[0];
      const mapper = actor.getMapper();
      const image = mapper.getInputData();
      const dims = image.getDimensions();
      const spacing = image.getSpacing();
      const spatialDiagonal = vec3.length(
        vec3.fromValues(dims[0] * spacing[0], dims[1] * spacing[1], dims[2] * spacing[2])
      );

      // Calculate desired sample distance based on quality
      let sampleDistance = spacing.reduce((a, b) => a + b) / 3.0;
      sampleDistance /= volumeQuality > 1 ? 0.5 * volumeQuality ** 2 : 1.0;

      // Ensure sample distance is large enough to stay under the maximum samples limit
      const maxSamples = mapper.getMaximumSamplesPerRay?.() || 4000;
      const minRequiredDistance = (spatialDiagonal / (maxSamples * 0.8));

      // Use the larger of the two (safer)
      const safeSampleDistance = Math.max(sampleDistance, minRequiredDistance);

      console.log(`[setVolumeRenderingQuality] Quality: ${volumeQuality}, desired: ${sampleDistance.toFixed(4)}, minRequired: ${minRequiredDistance.toFixed(4)}, final: ${safeSampleDistance.toFixed(4)}`);
      mapper.setSampleDistance(safeSampleDistance);
      viewport.render();
    },

    /**
     * Shifts opacity points for a given viewport id.
     * @param {string} viewportId - The ID of the viewport to set the mapping range.
     * @param {number} shift - The shift value to shift the points by.
     */
    shiftVolumeOpacityPoints: ({ viewportId, shift }) => {
      const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);
      const { actor } = viewport.getActors()[0];
      const ofun = actor.getProperty().getScalarOpacity(0);

      const opacityPointValues = []; // Array to hold values
      // Gather Existing Values
      const size = ofun.getSize();
      for (let pointIdx = 0; pointIdx < size; pointIdx++) {
        const opacityPointValue = [0, 0, 0, 0];
        ofun.getNodeValue(pointIdx, opacityPointValue);
        // opacityPointValue now holds [xLocation, opacity, midpoint, sharpness]
        opacityPointValues.push(opacityPointValue);
      }
      // Add offset
      opacityPointValues.forEach(opacityPointValue => {
        opacityPointValue[0] += shift; // Change the location value
      });
      // Set new values
      ofun.removeAllPoints();
      opacityPointValues.forEach(opacityPointValue => {
        ofun.addPoint(...opacityPointValue);
      });
      viewport.render();
    },

    /**
     * Sets the volume lighting settings for a given viewport.
     * @param {string} viewportId - The ID of the viewport to set the lighting settings.
     * @param {Object} options - The lighting settings to be set.
     * @param {boolean} options.shade - The shade setting for the lighting.
     * @param {number} options.ambient - The ambient setting for the lighting.
     * @param {number} options.diffuse - The diffuse setting for the lighting.
     * @param {number} options.specular - The specular setting for the lighting.
     **/

    setVolumeLighting: ({ viewportId, options }) => {
      const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);
      const { actor } = viewport.getActors()[0];
      const property = actor.getProperty();

      if (options.shade !== undefined) {
        property.setShade(options.shade);
      }

      if (options.ambient !== undefined) {
        property.setAmbient(options.ambient);
      }

      if (options.diffuse !== undefined) {
        property.setDiffuse(options.diffuse);
      }

      if (options.specular !== undefined) {
        property.setSpecular(options.specular);
      }

      viewport.render();
    },
    resetCrosshairs: ({ viewportId }) => {
      const crosshairInstances = [];

      const getCrosshairInstances = toolGroupId => {
        const toolGroup = toolGroupService.getToolGroup(toolGroupId);
        crosshairInstances.push(toolGroup.getToolInstance('Crosshairs'));
      };

      if (!viewportId) {
        const toolGroupIds = toolGroupService.getToolGroupIds();
        toolGroupIds.forEach(getCrosshairInstances);
      } else {
        const toolGroup = toolGroupService.getToolGroupForViewport(viewportId);
        getCrosshairInstances(toolGroup.id);
      }

      crosshairInstances.forEach(ins => {
        ins?.computeToolCenter();
      });
    },
    /**
     * Creates a labelmap for the active viewport
     *
     * The created labelmap will be registered as a display set and also added
     * as a segmentation representation to the viewport.
     */
    createLabelmapForViewport: async ({ viewportId, options = {} }) => {
      const { viewportGridService, displaySetService, segmentationService } =
        servicesManager.services;
      const { viewports } = viewportGridService.getState();
      const targetViewportId = viewportId;

      const viewport = viewports.get(targetViewportId);

      // Todo: add support for multiple display sets
      const displaySetInstanceUID =
        options.displaySetInstanceUID || viewport.displaySetInstanceUIDs[0];

      const segs = segmentationService.getSegmentations();

      const label = options.label || `${i18n.t('Tools:Segmentation')} ${segs.length + 1}`;
      const segmentationId = options.segmentationId || `${csUtils.uuidv4()}`;

      const displaySet = displaySetService.getDisplaySetByUID(displaySetInstanceUID);

      // This will create the segmentation and register it as a display set
      const generatedSegmentationId = await segmentationService.createLabelmapForDisplaySet(
        displaySet,
        {
          label,
          segmentationId,
          segments: options.createInitialSegment
            ? {
                1: {
                  label: `${i18n.t('Tools:Segment')} 1`,
                  active: true,
                },
              }
            : {},
        }
      );

      // Also add the segmentation representation to the viewport
      await segmentationService.addSegmentationRepresentation(viewportId, {
        segmentationId,
        type: Enums.SegmentationRepresentations.Labelmap,
      });

      return generatedSegmentationId;
    },

    /**
     * Sets the active segmentation for a viewport
     * @param props.segmentationId - The ID of the segmentation to set as active
     */
    setActiveSegmentation: ({ segmentationId }) => {
      const { viewportGridService, segmentationService } = servicesManager.services;
      segmentationService.setActiveSegmentation(
        viewportGridService.getActiveViewportId(),
        segmentationId
      );
    },

    /**
     * Adds a new segment to a segmentation
     * @param props.segmentationId - The ID of the segmentation to add the segment to
     */
    addSegmentCommand: ({ segmentationId }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.addSegment(segmentationId);
    },

    /**
     * Sets the active segment and jumps to its center
     * @param props.segmentationId - The ID of the segmentation
     * @param props.segmentIndex - The index of the segment to activate
     */
    setActiveSegmentAndCenterCommand: ({ segmentationId, segmentIndex }) => {
      const { segmentationService, viewportGridService } = servicesManager.services;
      // set both active segmentation and active segment
      segmentationService.setActiveSegmentation(
        viewportGridService.getActiveViewportId(),
        segmentationId
      );
      segmentationService.setActiveSegment(segmentationId, segmentIndex);

      const { highlightAlpha, highlightSegment, animationLength, animationFunctionType } =
        (customizationService.getCustomization(
          'panelSegmentation.jumpToSegmentHighlightAnimationConfig'
        ) as Object as {
          highlightAlpha?: number;
          highlightSegment?: boolean;
          animationLength?: number;
          animationFunctionType?: EasingFunctionEnum;
        }) ?? {};

      const validAnimationFunctionType = Object.values(EasingFunctionEnum).includes(
        animationFunctionType
      )
        ? animationFunctionType
        : undefined;

      segmentationService.jumpToSegmentCenter(
        segmentationId,
        segmentIndex,
        undefined,
        highlightAlpha,
        highlightSegment,
        animationLength,
        undefined,
        validAnimationFunctionType
      );
    },

    /**
     * Toggles the visibility of a segment
     * @param props.segmentationId - The ID of the segmentation
     * @param props.segmentIndex - The index of the segment
     * @param props.type - The type of visibility to toggle
     */
    toggleSegmentVisibilityCommand: ({ segmentationId, segmentIndex, type }) => {
      const { segmentationService, viewportGridService } = servicesManager.services;
      segmentationService.toggleSegmentVisibility(
        viewportGridService.getActiveViewportId(),
        segmentationId,
        segmentIndex,
        type
      );
    },

    /**
     * Toggles the lock state of a segment
     * @param props.segmentationId - The ID of the segmentation
     * @param props.segmentIndex - The index of the segment
     */
    toggleSegmentLockCommand: ({ segmentationId, segmentIndex }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.toggleSegmentLocked(segmentationId, segmentIndex);
    },

    /**
     * Toggles the visibility of a segmentation representation
     * @param props.segmentationId - The ID of the segmentation
     * @param props.type - The type of representation
     */
    toggleSegmentationVisibilityCommand: ({ segmentationId, type }) => {
      const { segmentationService, viewportGridService } = servicesManager.services;
      segmentationService.toggleSegmentationRepresentationVisibility(
        viewportGridService.getActiveViewportId(),
        { segmentationId, type }
      );
    },

    /**
     * Downloads a segmentation
     * @param props.segmentationId - The ID of the segmentation to download
     */
    downloadSegmentationCommand: ({ segmentationId }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.downloadSegmentation(segmentationId);
    },

    /**
     * Stores a segmentation and shows it in the viewport
     * @param props.segmentationId - The ID of the segmentation to store
     */
    storeSegmentationCommand: async ({ segmentationId }) => {
      const { segmentationService, viewportGridService } = servicesManager.services;

      const displaySetInstanceUIDs = await createReportAsync({
        servicesManager,
        getReport: () =>
          commandsManager.runCommand('storeSegmentation', {
            segmentationId,
          }),
        reportType: 'Segmentation',
      });

      if (displaySetInstanceUIDs) {
        segmentationService.remove(segmentationId);
        viewportGridService.setDisplaySetsForViewport({
          viewportId: viewportGridService.getActiveViewportId(),
          displaySetInstanceUIDs,
        });
      }
    },

    /**
     * Downloads a segmentation as RTSS
     * @param props.segmentationId - The ID of the segmentation
     */
    downloadRTSSCommand: ({ segmentationId }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.downloadRTSS(segmentationId);
    },

    /**
     * Sets the style for a segmentation
     * @param props.segmentationId - The ID of the segmentation
     * @param props.type - The type of style
     * @param props.key - The style key to set
     * @param props.value - The style value
     */
    setSegmentationStyleCommand: ({ type, key, value }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.setStyle({ type }, { [key]: value });
    },

    /**
     * Deletes a segment from a segmentation
     * @param props.segmentationId - The ID of the segmentation
     * @param props.segmentIndex - The index of the segment to delete
     */
    deleteSegmentCommand: ({ segmentationId, segmentIndex }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.removeSegment(segmentationId, segmentIndex);
    },

    /**
     * Deletes an entire segmentation
     * @param props.segmentationId - The ID of the segmentation to delete
     */
    deleteSegmentationCommand: ({ segmentationId }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.remove(segmentationId);
    },

    /**
     * Removes a segmentation from the viewport
     * @param props.segmentationId - The ID of the segmentation to remove
     */
    removeSegmentationFromViewportCommand: ({ segmentationId }) => {
      const { segmentationService, viewportGridService } = servicesManager.services;
      segmentationService.removeSegmentationRepresentations(
        viewportGridService.getActiveViewportId(),
        { segmentationId }
      );
    },

    /**
     * Toggles rendering of inactive segmentations
     */
    toggleRenderInactiveSegmentationsCommand: () => {
      const { segmentationService, viewportGridService } = servicesManager.services;
      const viewportId = viewportGridService.getActiveViewportId();
      const renderInactive = segmentationService.getRenderInactiveSegmentations(viewportId);
      segmentationService.setRenderInactiveSegmentations(viewportId, !renderInactive);
    },

    /**
     * Sets the fill alpha value for a segmentation type
     * @param props.type - The type of segmentation
     * @param props.value - The alpha value to set
     */
    setFillAlphaCommand: ({ type, value }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.setStyle({ type }, { fillAlpha: value });
    },

    /**
     * Sets the outline width for a segmentation type
     * @param props.type - The type of segmentation
     * @param props.value - The width value to set
     */
    setOutlineWidthCommand: ({ type, value }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.setStyle({ type }, { outlineWidth: value });
    },

    /**
     * Sets whether to render fill for a segmentation type
     * @param props.type - The type of segmentation
     * @param props.value - Whether to render fill
     */
    setRenderFillCommand: ({ type, value }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.setStyle({ type }, { renderFill: value });
    },

    /**
     * Sets whether to render outline for a segmentation type
     * @param props.type - The type of segmentation
     * @param props.value - Whether to render outline
     */
    setRenderOutlineCommand: ({ type, value }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.setStyle({ type }, { renderOutline: value });
    },

    /**
     * Sets the fill alpha for inactive segmentations
     * @param props.type - The type of segmentation
     * @param props.value - The alpha value to set
     */
    setFillAlphaInactiveCommand: ({ type, value }) => {
      const { segmentationService } = servicesManager.services;
      segmentationService.setStyle({ type }, { fillAlphaInactive: value });
    },

    editSegmentLabel: async ({ segmentationId, segmentIndex }) => {
      const { segmentationService, uiDialogService } = servicesManager.services;
      const segmentation = segmentationService.getSegmentation(segmentationId);

      if (!segmentation) {
        return;
      }

      const segment = segmentation.segments[segmentIndex];

      callInputDialog({
        uiDialogService,
        title: i18n.t('Tools:Edit Segment Label'),
        placeholder: i18n.t('Tools:Enter new label'),
        defaultValue: segment.label,
      }).then(label => {
        segmentationService.setSegmentLabel(segmentationId, segmentIndex, label);
      });
    },

    editSegmentationLabel: ({ segmentationId }) => {
      const { segmentationService, uiDialogService } = servicesManager.services;
      const segmentation = segmentationService.getSegmentation(segmentationId);

      if (!segmentation) {
        return;
      }

      const { label } = segmentation;

      callInputDialog({
        uiDialogService,
        title: i18n.t('Tools:Edit Segmentation Label'),
        placeholder: i18n.t('Tools:Enter new label'),
        defaultValue: label,
      }).then(label => {
        segmentationService.addOrUpdateSegmentation({ segmentationId, label });
      });
    },

    editSegmentColor: ({ segmentationId, segmentIndex }) => {
      const { segmentationService, uiDialogService, viewportGridService } =
        servicesManager.services;
      const viewportId = viewportGridService.getActiveViewportId();
      const color = segmentationService.getSegmentColor(viewportId, segmentationId, segmentIndex);

      const rgbaColor = {
        r: color[0],
        g: color[1],
        b: color[2],
        a: color[3] / 255.0,
      };

      uiDialogService.show({
        content: colorPickerDialog,
        title: i18n.t('Tools:Segment Color'),
        contentProps: {
          value: rgbaColor,
          onSave: newRgbaColor => {
            const color = [newRgbaColor.r, newRgbaColor.g, newRgbaColor.b, newRgbaColor.a * 255.0];
            segmentationService.setSegmentColor(viewportId, segmentationId, segmentIndex, color);
          },
        },
      });
    },

    getRenderInactiveSegmentations: () => {
      const { segmentationService, viewportGridService } = servicesManager.services;
      return segmentationService.getRenderInactiveSegmentations(
        viewportGridService.getActiveViewportId()
      );
    },

    deleteActiveAnnotation: () => {
      const activeAnnotationsUID = cornerstoneTools.annotation.selection.getAnnotationsSelected();
      activeAnnotationsUID.forEach(activeAnnotationUID => {
        measurementService.remove(activeAnnotationUID);
      });
    },
    setDisplaySetsForViewports: ({ viewportsToUpdate }) => {
      const { cineService, viewportGridService } = servicesManager.services;
      // Stopping the cine of modified viewports before changing the viewports to
      // avoid inconsistent state and lost references
      viewportsToUpdate.forEach(viewport => {
        const state = cineService.getState();
        const currentCineState = state.cines?.[viewport.viewportId];
        cineService.setCine({
          id: viewport.viewportId,
          frameRate: currentCineState?.frameRate ?? state.default?.frameRate ?? 24,
          isPlaying: false,
        });
      });

      viewportGridService.setDisplaySetsForViewports(viewportsToUpdate);
    },
    undo: () => {
      DefaultHistoryMemo.undo();
    },
    redo: () => {
      DefaultHistoryMemo.redo();
    },
    toggleSegmentPreviewEdit: ({ toggle }) => {
      let labelmapTools = getLabelmapTools({ toolGroupService });
      labelmapTools = labelmapTools.filter(tool => !tool.toolName.includes('Eraser'));
      labelmapTools.forEach(tool => {
        tool.configuration = {
          ...tool.configuration,
          preview: {
            ...tool.configuration.preview,
            enabled: toggle,
          },
        };
      });
    },
    toggleSegmentSelect: ({ toggle }) => {
      const toolGroupIds = toolGroupService.getToolGroupIds();
      toolGroupIds.forEach(toolGroupId => {
        const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
        if (toggle) {
          toolGroup.setToolActive(cornerstoneTools.SegmentSelectTool.toolName);
        } else {
          toolGroup.setToolDisabled(cornerstoneTools.SegmentSelectTool.toolName);
        }
      });
    },
    toggleSegmentLabel: ({ enabled }: { enabled?: boolean }) => {
      const toolName = cornerstoneTools.SegmentLabelTool.toolName;
      const toolGroupIds = toolGroupService.getToolGroupIds();

      const isToolOn = toolGroupIds.some(toolGroupId => {
        const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
        const mode = toolGroup.getToolInstance(toolName)?.mode;
        return mode === 'Active';
      });

      const enableTool = enabled !== undefined ? enabled : !isToolOn;

      toolGroupIds.forEach(toolGroupId => {
        const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
        if (enableTool) {
          toolGroup.setToolActive(toolName);
        } else {
          toolGroup.setToolDisabled(toolName);
        }
      });
    },
    /**
     * Used to sync the apps initial state with the config file settings.
     *
     * Will mutate the tools object of the given tool group and add the segmentLabelTool to the proper place.
     *
     * Use it before initializing the toolGroup with the tools.
     */
    initializeSegmentLabelTool: ({ tools }) => {
      const appConfig = extensionManager.appConfig;
      const segmentLabelConfig = appConfig.segmentation?.segmentLabel;

      if (segmentLabelConfig?.enabledByDefault) {
        const activeTools = tools?.active ?? [];
        activeTools.push({
          toolName: toolNames.SegmentLabel,
          configuration: {
            hoverTimeout: segmentLabelConfig?.hoverTimeout ?? 1,
            color: segmentLabelConfig?.labelColor,
            background: segmentLabelConfig?.background,
          },
        });

        tools.active = activeTools;
        return tools;
      }

      const disabledTools = tools?.disabled ?? [];
      disabledTools.push({
        toolName: toolNames.SegmentLabel,
        configuration: {
          hoverTimeout: segmentLabelConfig?.hoverTimeout ?? 1,
          color: segmentLabelConfig?.labelColor,
        },
      });
      tools.disabled = disabledTools;
      return tools;
    },
    // Camera focal point logging for MPR viewports
    enableCameraLogging: () => {
      viewportStateService.enableCameraLogging();
    },
    disableCameraLogging: () => {
      viewportStateService.disableCameraLogging();
    },
    toggleCameraLogging: () => {
      viewportStateService.toggleCameraLogging();
    },
    getCameraFocalPoints: () => {
      const focalPoints = viewportStateService.getCurrentFocalPoints();
      // console.log('📸 Current Camera Focal Points:', focalPoints);
      return focalPoints;
    },
    getCrosshairsToolCenter: () => {
      const crosshairsData = viewportStateService.getCrosshairsToolCenter();
      console.log('🎯 Crosshairs Tool Center:', crosshairsData);
      return crosshairsData;
    },
    toggleUseCenterSegmentIndex: ({ toggle }) => {
      let labelmapTools = getLabelmapTools({ toolGroupService });
      labelmapTools = labelmapTools.filter(tool => !tool.toolName.includes('Eraser'));
      labelmapTools.forEach(tool => {
        tool.configuration = {
          ...tool.configuration,
          useCenterSegmentIndex: toggle,
        };
      });
    },
    _handlePreviewAction: action => {
      const { viewport } = _getActiveViewportEnabledElement();
      const previewTools = getPreviewTools({ toolGroupService });

      previewTools.forEach(tool => {
        try {
          tool[`${action}Preview`]();
        } catch (error) {
          console.debug('Error accepting preview for tool', tool.toolName);
        }
      });

      if (segmentAI.enabled) {
        segmentAI[`${action}Preview`](viewport.element);
      }
    },
    acceptPreview: () => {
      actions._handlePreviewAction('accept');
    },
    rejectPreview: () => {
      actions._handlePreviewAction('reject');
    },
    clearMarkersForMarkerLabelmap: () => {
      const { viewport } = _getActiveViewportEnabledElement();
      const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroupForViewport(viewport.id);
      const toolInstance = toolGroup.getToolInstance('MarkerLabelmap');

      if (!toolInstance) {
        return;
      }

      toolInstance.clearMarkers(viewport);
    },
    interpolateScrollForMarkerLabelmap: () => {
      const { viewport } = _getActiveViewportEnabledElement();
      const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroupForViewport(viewport.id);
      const toolInstance = toolGroup.getToolInstance('MarkerLabelmap');

      if (!toolInstance) {
        return;
      }

      toolInstance.interpolateScroll(viewport, 1);
    },
    toggleLabelmapAssist: async () => {
      const { viewport } = _getActiveViewportEnabledElement();
      const newState = !segmentAI.enabled;
      segmentAI.enabled = newState;

      if (!segmentAIEnabled) {
        await segmentAI.initModel();
        segmentAIEnabled = true;
      }

      // set the brush tool to active
      const toolGroupIds = toolGroupService.getToolGroupIds();
      if (newState) {
        actions.setToolActiveToolbar({
          toolName: 'CircularBrushForAutoSegmentAI',
          toolGroupIds: toolGroupIds,
        });
      } else {
        toolGroupIds.forEach(toolGroupId => {
          const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
          toolGroup.setToolPassive('CircularBrushForAutoSegmentAI');
        });
      }

      if (segmentAI.enabled) {
        segmentAI.initViewport(viewport);
      }
    },
    setBrushSize: ({ value, toolNames }) => {
      const brushSize = Number(value);

      toolGroupService.getToolGroupIds()?.forEach(toolGroupId => {
        if (toolNames?.length === 0) {
          segmentationUtils.setBrushSizeForToolGroup(toolGroupId, brushSize);
        } else {
          toolNames?.forEach(toolName => {
            segmentationUtils.setBrushSizeForToolGroup(toolGroupId, brushSize, toolName);
          });
        }
      });
    },
    setThresholdRange: ({
      value,
      toolNames = [
        'ThresholdCircularBrush',
        'ThresholdSphereBrush',
        'ThresholdCircularBrushDynamic',
        'ThresholdSphereBrushDynamic',
      ],
    }) => {
      const toolGroupIds = toolGroupService.getToolGroupIds();
      if (!toolGroupIds?.length) {
        return;
      }

      for (const toolGroupId of toolGroupIds) {
        const toolGroup = toolGroupService.getToolGroup(toolGroupId);
        toolNames?.forEach(toolName => {
          toolGroup.setToolConfiguration(toolName, {
            threshold: {
              range: value,
            },
          });
        });
      }
    },
    increaseBrushSize: () => {
      const toolGroupIds = toolGroupService.getToolGroupIds();
      if (!toolGroupIds?.length) {
        return;
      }

      for (const toolGroupId of toolGroupIds) {
        const brushSize = segmentationUtils.getBrushSizeForToolGroup(toolGroupId);
        segmentationUtils.setBrushSizeForToolGroup(toolGroupId, brushSize + 3);
      }
    },
    decreaseBrushSize: () => {
      const toolGroupIds = toolGroupService.getToolGroupIds();
      if (!toolGroupIds?.length) {
        return;
      }

      for (const toolGroupId of toolGroupIds) {
        const brushSize = segmentationUtils.getBrushSizeForToolGroup(toolGroupId);
        segmentationUtils.setBrushSizeForToolGroup(toolGroupId, brushSize - 3);
      }
    },
    addNewSegment: () => {
      const { segmentationService } = servicesManager.services;
      const { activeViewportId } = viewportGridService.getState();
      const activeSegmentation = segmentationService.getActiveSegmentation(activeViewportId);
      if (!activeSegmentation) {
        return;
      }
      segmentationService.addSegment(activeSegmentation.segmentationId);
    },
    loadSegmentationDisplaySetsForViewport: ({ viewportId, displaySetInstanceUIDs }) => {
      const updatedViewports = getUpdatedViewportsForSegmentation({
        viewportId,
        servicesManager,
        displaySetInstanceUIDs,
      });

      actions.setDisplaySetsForViewports({
        viewportsToUpdate: updatedViewports.map(viewport => ({
          viewportId: viewport.viewportId,
          displaySetInstanceUIDs: viewport.displaySetInstanceUIDs,
        })),
      });
    },
    setViewportOrientation: ({ viewportId, orientation }) => {
      const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);

      if (!viewport || viewport.type !== CoreEnums.ViewportType.ORTHOGRAPHIC) {
        console.warn('Orientation can only be set on volume viewports');
        return;
      }

      // Get display sets for this viewport to verify at least one is reconstructable
      const displaySetUIDs = viewportGridService.getDisplaySetsUIDsForViewport(viewportId);
      const displaySets = displaySetUIDs.map(uid => displaySetService.getDisplaySetByUID(uid));

      if (!displaySets.some(ds => ds.isReconstructable)) {
        console.warn('Cannot change orientation: No reconstructable display sets in viewport');
        return;
      }

      viewport.setOrientation(orientation);
      viewport.render();

      // update the orientation in the viewport info
      const viewportInfo = cornerstoneViewportService.getViewportInfo(viewportId);
      viewportInfo.setOrientation(orientation);
    },
    /**
     * Toggles the horizontal flip state of the viewport.
     */
    toggleViewportHorizontalFlip: ({ viewportId }: { viewportId?: string } = {}) => {
      actions.flipViewportHorizontal({ viewportId, newValue: 'toggle' });
    },

    /**
     * Explicitly sets the horizontal flip state of the viewport.
     */
    setViewportHorizontalFlip: ({
      flipped,
      viewportId,
    }: {
      flipped: boolean;
      viewportId?: string;
    }) => {
      actions.flipViewportHorizontal({ viewportId, newValue: flipped });
    },

    /**
     * Toggles the vertical flip state of the viewport.
     */
    toggleViewportVerticalFlip: ({ viewportId }: { viewportId?: string } = {}) => {
      actions.flipViewportVertical({ viewportId, newValue: 'toggle' });
    },

    /**
     * Explicitly sets the vertical flip state of the viewport.
     */
    setViewportVerticalFlip: ({
      flipped,
      viewportId,
    }: {
      flipped: boolean;
      viewportId?: string;
    }) => {
      actions.flipViewportVertical({ viewportId, newValue: flipped });
    },
    /**
     * Internal helper to rotate or set absolute rotation for a viewport.
     */
    _rotateViewport: ({
      rotation,
      viewportId,
      rotationMode = 'apply',
    }: {
      rotation: number;
      viewportId?: string;
      rotationMode?: 'apply' | 'set';
    }) => {
      const enabledElement = viewportId
        ? _getViewportEnabledElement(viewportId)
        : _getActiveViewportEnabledElement();

      if (!enabledElement) {
        return;
      }

      const { viewport } = enabledElement;

      if (viewport instanceof BaseVolumeViewport) {
        const camera = viewport.getCamera();
        const rotAngle = (rotation * Math.PI) / 180;
        const rotMat = mat4.identity(new Float32Array(16));
        mat4.rotate(rotMat, rotMat, rotAngle, camera.viewPlaneNormal);
        const rotatedViewUp = vec3.transformMat4(vec3.create(), camera.viewUp, rotMat);
        viewport.setCamera({ viewUp: rotatedViewUp as CoreTypes.Point3 });
        viewport.render();
        return;
      }

      if (viewport.getRotation !== undefined) {
        const { rotation: currentRotation } = viewport.getViewPresentation();
        const newRotation =
          rotationMode === 'apply'
            ? (currentRotation + rotation + 360) % 360
            : (() => {
                // In 'set' mode, account for the effect horizontal/vertical flips
                // have on the perceived rotation direction. A single flip mirrors
                // the image and inverses rotation direction, while two flips
                // restore the original parity. We therefore invert the rotation
                // angle when an odd number of flips are applied so that the
                // requested absolute rotation matches the user expectation.
                const { flipHorizontal = false, flipVertical = false } =
                  viewport.getViewPresentation();

                const flipsParity = (flipHorizontal ? 1 : 0) + (flipVertical ? 1 : 0);
                const effectiveRotation = flipsParity % 2 === 1 ? -rotation : rotation;

                return (effectiveRotation + 360) % 360;
              })();
        viewport.setViewPresentation({ rotation: newRotation });
        viewport.render();
      }
    },
    startRecordingForAnnotationGroup: () => {
      cornerstoneTools.AnnotationTool.startGroupRecording();
    },
    endRecordingForAnnotationGroup: () => {
      cornerstoneTools.AnnotationTool.endGroupRecording();
    },
    triggerCreateAnnotationMemo: ({
      annotation,
      FrameOfReferenceUID,
      options,
    }: {
      annotation: ToolTypes.Annotation;
      FrameOfReferenceUID: string;
      options: { newAnnotation?: boolean; deleting?: boolean };
    }): void => {
      const { newAnnotation, deleting } = options;
      const renderingEngines = getRenderingEngines();
      const viewports = renderingEngines.flatMap(re => re.getViewports());
      const validViewport = viewports.find(
        vp => vp.getFrameOfReferenceUID() === FrameOfReferenceUID
      );

      if (!validViewport) {
        return;
      }

      cornerstoneTools.AnnotationTool.createAnnotationMemo(validViewport.element, annotation, {
        newAnnotation,
        deleting,
      });
    },
  };

  const definitions = {
    // The command here is to show the viewer context menu, as being the
    // context menu
    showCornerstoneContextMenu: {
      commandFn: actions.showCornerstoneContextMenu,
      options: {
        menuCustomizationId: 'measurementsContextMenu',
        commands: [
          {
            commandName: 'showContextMenu',
          },
        ],
      },
    },

    getNearbyToolData: {
      commandFn: actions.getNearbyToolData,
    },
    getNearbyAnnotation: {
      commandFn: actions.getNearbyAnnotation,
      storeContexts: [],
      options: {},
    },
    toggleViewportColorbar: {
      commandFn: actions.toggleViewportColorbar,
    },
    setMeasurementLabel: {
      commandFn: actions.setMeasurementLabel,
    },
    renameMeasurement: {
      commandFn: actions.renameMeasurement,
    },
    updateMeasurement: {
      commandFn: actions.updateMeasurement,
    },
    jumpToMeasurement: actions.jumpToMeasurement,
    removeMeasurement: {
      commandFn: actions.removeMeasurement,
    },
    toggleLockMeasurement: {
      commandFn: actions.toggleLockMeasurement,
    },
    toggleVisibilityMeasurement: {
      commandFn: actions.toggleVisibilityMeasurement,
    },
    downloadCSVMeasurementsReport: {
      commandFn: actions.downloadCSVMeasurementsReport,
    },
    setViewportWindowLevel: {
      commandFn: actions.setViewportWindowLevel,
    },
    setWindowLevel: {
      commandFn: actions.setWindowLevel,
    },
    setWindowLevelPreset: {
      commandFn: actions.setWindowLevelPreset,
    },
    setToolActive: {
      commandFn: actions.setToolActive,
    },
    setToolActiveToolbar: {
      commandFn: actions.setToolActiveToolbar,
    },
    setToolEnabled: {
      commandFn: actions.setToolEnabled,
    },
    rotateViewportCW: {
      commandFn: actions.rotateViewportBy,
      options: { rotation: 90 },
    },
    rotateViewportCCW: {
      commandFn: actions.rotateViewportBy,
      options: { rotation: -90 },
    },
    rotateViewportCWSet: {
      commandFn: actions.setViewportRotation,
      options: { rotation: 90 },
    },
    incrementActiveViewport: {
      commandFn: actions.changeActiveViewport,
    },
    decrementActiveViewport: {
      commandFn: actions.changeActiveViewport,
      options: { direction: -1 },
    },
    flipViewportHorizontal: {
      commandFn: actions.toggleViewportHorizontalFlip,
    },
    flipViewportVertical: {
      commandFn: actions.toggleViewportVerticalFlip,
    },
    setViewportHorizontalFlip: {
      commandFn: actions.setViewportHorizontalFlip,
      options: { flipped: true },
    },
    setViewportVerticalFlip: {
      commandFn: actions.setViewportVerticalFlip,
      options: { flipped: true },
    },
    invertViewport: {
      commandFn: actions.invertViewport,
    },
    resetViewport: {
      commandFn: actions.resetViewport,
    },
    scaleUpViewport: {
      commandFn: actions.scaleViewport,
      options: { direction: 1 },
    },
    scaleDownViewport: {
      commandFn: actions.scaleViewport,
      options: { direction: -1 },
    },
    fitViewportToWindow: {
      commandFn: actions.scaleViewport,
      options: { direction: 0 },
    },
    nextImage: {
      commandFn: actions.scroll,
      options: { direction: 1 },
    },
    previousImage: {
      commandFn: actions.scroll,
      options: { direction: -1 },
    },
    firstImage: {
      commandFn: actions.jumpToImage,
      options: { imageIndex: 0 },
    },
    lastImage: {
      commandFn: actions.jumpToImage,
      options: { imageIndex: -1 },
    },
    jumpToImage: {
      commandFn: actions.jumpToImage,
    },
    showDownloadViewportModal: {
      commandFn: actions.showDownloadViewportModal,
    },
    toggleCine: {
      commandFn: actions.toggleCine,
    },
    arrowTextCallback: {
      commandFn: actions.arrowTextCallback,
    },
    setViewportActive: {
      commandFn: actions.setViewportActive,
    },
    setViewportColormap: {
      commandFn: actions.setViewportColormap,
    },
    setViewportForToolConfiguration: {
      commandFn: actions.setViewportForToolConfiguration,
    },
    storePresentation: {
      commandFn: actions.storePresentation,
    },
    attachProtocolViewportDataListener: {
      commandFn: actions.attachProtocolViewportDataListener,
    },
    setViewportPreset: {
      commandFn: actions.setViewportPreset,
    },
    setVolumeRenderingQulaity: {
      commandFn: actions.setVolumeRenderingQulaity,
    },
    shiftVolumeOpacityPoints: {
      commandFn: actions.shiftVolumeOpacityPoints,
    },
    setVolumeLighting: {
      commandFn: actions.setVolumeLighting,
    },
    resetCrosshairs: {
      commandFn: actions.resetCrosshairs,
    },
    toggleSynchronizer: {
      commandFn: actions.toggleSynchronizer,
    },
    updateVolumeData: {
      commandFn: actions.updateVolumeData,
    },
    toggleEnabledDisabledToolbar: {
      commandFn: actions.toggleEnabledDisabledToolbar,
    },
    toggleActiveDisabledToolbar: {
      commandFn: actions.toggleActiveDisabledToolbar,
    },
    updateStoredPositionPresentation: {
      commandFn: actions.updateStoredPositionPresentation,
    },
    updateStoredSegmentationPresentation: {
      commandFn: actions.updateStoredSegmentationPresentation,
    },
    createLabelmapForViewport: {
      commandFn: actions.createLabelmapForViewport,
    },
    setActiveSegmentation: {
      commandFn: actions.setActiveSegmentation,
    },
    addSegment: {
      commandFn: actions.addSegmentCommand,
    },
    setActiveSegmentAndCenter: {
      commandFn: actions.setActiveSegmentAndCenterCommand,
    },
    toggleSegmentVisibility: {
      commandFn: actions.toggleSegmentVisibilityCommand,
    },
    toggleSegmentLock: {
      commandFn: actions.toggleSegmentLockCommand,
    },
    toggleSegmentationVisibility: {
      commandFn: actions.toggleSegmentationVisibilityCommand,
    },
    downloadSegmentation: {
      commandFn: actions.downloadSegmentationCommand,
    },
    storeSegmentation: {
      commandFn: actions.storeSegmentationCommand,
    },
    downloadRTSS: {
      commandFn: actions.downloadRTSSCommand,
    },
    setSegmentationStyle: {
      commandFn: actions.setSegmentationStyleCommand,
    },
    deleteSegment: {
      commandFn: actions.deleteSegmentCommand,
    },
    deleteSegmentation: {
      commandFn: actions.deleteSegmentationCommand,
    },
    removeSegmentationFromViewport: {
      commandFn: actions.removeSegmentationFromViewportCommand,
    },
    toggleRenderInactiveSegmentations: {
      commandFn: actions.toggleRenderInactiveSegmentationsCommand,
    },
    setFillAlpha: {
      commandFn: actions.setFillAlphaCommand,
    },
    setOutlineWidth: {
      commandFn: actions.setOutlineWidthCommand,
    },
    setRenderFill: {
      commandFn: actions.setRenderFillCommand,
    },
    setRenderOutline: {
      commandFn: actions.setRenderOutlineCommand,
    },
    setFillAlphaInactive: {
      commandFn: actions.setFillAlphaInactiveCommand,
    },
    editSegmentLabel: {
      commandFn: actions.editSegmentLabel,
    },
    editSegmentationLabel: {
      commandFn: actions.editSegmentationLabel,
    },
    editSegmentColor: {
      commandFn: actions.editSegmentColor,
    },
    getRenderInactiveSegmentations: {
      commandFn: actions.getRenderInactiveSegmentations,
    },
    deleteActiveAnnotation: {
      commandFn: actions.deleteActiveAnnotation,
    },
    setDisplaySetsForViewports: actions.setDisplaySetsForViewports,
    undo: actions.undo,
    redo: actions.redo,
    interpolateLabelmap: actions.interpolateLabelmap,
    runSegmentBidirectional: actions.runSegmentBidirectional,
    downloadCSVSegmentationReport: actions.downloadCSVSegmentationReport,
    toggleSegmentPreviewEdit: actions.toggleSegmentPreviewEdit,
    toggleSegmentSelect: actions.toggleSegmentSelect,
    acceptPreview: actions.acceptPreview,
    rejectPreview: actions.rejectPreview,
    toggleUseCenterSegmentIndex: actions.toggleUseCenterSegmentIndex,
    toggleLabelmapAssist: actions.toggleLabelmapAssist,
    interpolateScrollForMarkerLabelmap: actions.interpolateScrollForMarkerLabelmap,
    clearMarkersForMarkerLabelmap: actions.clearMarkersForMarkerLabelmap,
    setBrushSize: actions.setBrushSize,
    setThresholdRange: actions.setThresholdRange,
    increaseBrushSize: actions.increaseBrushSize,
    decreaseBrushSize: actions.decreaseBrushSize,
    addNewSegment: actions.addNewSegment,
    loadSegmentationDisplaySetsForViewport: actions.loadSegmentationDisplaySetsForViewport,
    setViewportOrientation: actions.setViewportOrientation,
    hydrateSecondaryDisplaySet: actions.hydrateSecondaryDisplaySet,
    getVolumeIdForDisplaySet: actions.getVolumeIdForDisplaySet,
    triggerCreateAnnotationMemo: actions.triggerCreateAnnotationMemo,
    startRecordingForAnnotationGroup: actions.startRecordingForAnnotationGroup,
    endRecordingForAnnotationGroup: actions.endRecordingForAnnotationGroup,
    toggleSegmentLabel: actions.toggleSegmentLabel,
    jumpToMeasurementViewport: actions.jumpToMeasurementViewport,
    initializeSegmentLabelTool: actions.initializeSegmentLabelTool,
    enableCameraLogging: {
      commandFn: actions.enableCameraLogging,
      storeContexts: [],
      options: {},
    },
    disableCameraLogging: {
      commandFn: actions.disableCameraLogging,
      storeContexts: [],
      options: {},
    },
    toggleCameraLogging: {
      commandFn: actions.toggleCameraLogging,
      storeContexts: [],
      options: {},
    },
    getCameraFocalPoints: {
      commandFn: actions.getCameraFocalPoints,
      storeContexts: [],
      options: {},
    },
    getCrosshairsToolCenter: {
      commandFn: actions.getCrosshairsToolCenter,
      storeContexts: [],
      options: {},
    },
  };

  return {
    actions,
    definitions,
    defaultContext: 'CORNERSTONE',
  };
}

export default commandsModule;

```

Perfect! I've successfully added the `getCrosshairsToolCenter` command to the command manager. Here's what was implemented:

## Changes Made to `commandsModule.ts`

### 1. **Action Definition** (Line 1985-1989)
Added the action function that calls the viewport state service method:

```1985:1989:extensions/cornerstone/src/commandsModule.ts
    getCrosshairsToolCenter: () => {
      const crosshairsData = viewportStateService.getCrosshairsToolCenter();
      console.log('🎯 Crosshairs Tool Center:', crosshairsData);
      return crosshairsData;
    },
```

### 2. **Command Registration** (Line 2625-2629)
Registered the command in the definitions object:

```2625:2629:extensions/cornerstone/src/commandsModule.ts
    getCrosshairsToolCenter: {
      commandFn: actions.getCrosshairsToolCenter,
      storeContexts: [],
      options: {},
    },
```

## Usage

Now you can call this command from anywhere in the application using the command manager:

```javascript
// From a button or UI component
commandsManager.runCommand('getCrosshairsToolCenter');

// The command returns:
// {
//   'mpr-axial': { center: [x, y, z], isActive: true },
//   'mpr-sagittal': { center: [x, y, z], isActive: true },
//   'mpr-coronal': { center: [x, y, z], isActive: true }
// }
```

The command:
- ✅ Checks if the crosshairs tool is available in each viewport
- ✅ Returns the tool center coordinates in world space
- ✅ Indicates whether the tool is currently active
- ✅ Logs the results to the console with a 🎯 emoji for easy identification
- ✅ No linter errors

The implementation follows the same pattern as the existing `getCameraFocalPoints` command for consistency.

```typescript
    getCrosshairsToolCenter: () => {
      const crosshairsData = viewportStateService.getCrosshairsToolCenter();
      console.log('🎯 Crosshairs Tool Center:', crosshairsData);
      return crosshairsData;
    },
```

```typescript
    getCrosshairsToolCenter: {
      commandFn: actions.getCrosshairsToolCenter,
      storeContexts: [],
      options: {},
    },
```

```javascript
// From a button or UI component
commandsManager.runCommand('getCrosshairsToolCenter');

// The command returns:
// {
//   'mpr-axial': { center: [x, y, z], isActive: true },
//   'mpr-sagittal': { center: [x, y, z], isActive: true },
//   'mpr-coronal': { center: [x, y, z], isActive: true }
// }
```

---

**User**

// Universal helper - works even if OHIF isn't fully loaded

window.cameraLogging = (function() {

  function getCommandsManager() {

    return window.ohif?.commandsManager ||

           window.OHIF?.commandsManager ||

           window.commandsManager;

  }

  return {

    enable: () => getCommandsManager()?.runCommand('enableCameraLogging'),

    disable: () => getCommandsManager()?.runCommand('disableCameraLogging'),

    toggle: () => getCommandsManager()?.runCommand('toggleCameraLogging'),

    get: () => getCommandsManager()?.runCommand('getCameraFocalPoints'),

	center: () => getCommandsManager()?.runCommand('getCrosshairsToolCenter')

  };

})();

console.log('✅ Helper loaded! Use: cameraLogging.enable()');

VM329:16 ✅ Helper loaded! Use: cameraLogging.enable()

undefined

cameraLogging.center()

C:\Users\hp\tableTop\mvisioner\Viewers\platform\core\src\classes\CommandsManager.ts:161 Command "getCrosshairsToolCenter" not found in current context

---

**Cursor**

The command is defined but the application needs to be reloaded for the changes to take effect. However, let me verify the command registration is correct by checking the structure.

The command is correctly registered! The issue is that you need to **restart/rebuild the application** for the new command to be available. The changes won't take effect until the application is reloaded with the updated code.

## To apply the changes:

## Steps to Fix:

1. **Stop your development server** (if running)
   - Press `Ctrl+C` in the terminal where the dev server is running

2. **Restart the development server**
   - Run `yarn dev` or `npm run dev` (depending on your setup)

3. **Reload the browser** once the server is back up

4. **Test the command** again in the console:
   ```javascript
   cameraLogging.center()
   ```

## Verification

The command registration is correct and follows the same pattern as the existing commands:

```2625:2629:extensions/cornerstone/src/commandsModule.ts
    getCrosshairsToolCenter: {
      commandFn: actions.getCrosshairsToolCenter,
      storeContexts: [],
      options: {},
    },
```

After restarting the application, you should see the crosshairs tool center data logged to the console when you run `cameraLogging.center()`.

Expected output format:
```javascript
🎯 Crosshairs Tool Center: {
  'mpr-axial': { center: [x, y, z], isActive: true },
  'mpr-sagittal': { center: [x, y, z], isActive: true },
  'mpr-coronal': { center: [x, y, z], isActive: true }
}
```

```javascript
   cameraLogging.center()
```

```typescript
    getCrosshairsToolCenter: {
      commandFn: actions.getCrosshairsToolCenter,
      storeContexts: [],
      options: {},
    },
```

```javascript
🎯 Crosshairs Tool Center: {
  'mpr-axial': { center: [x, y, z], isActive: true },
  'mpr-sagittal': { center: [x, y, z], isActive: true },
  'mpr-coronal': { center: [x, y, z], isActive: true }
}
```

---

**User**

apart from its centers, what other properties do corsshairs have ? 

---

**Cursor**

Let me explore the CrosshairsTool to see what other properties and data it contains.

Based on the code analysis, here are **all the properties and configuration options** that the CrosshairsTool has:

## 📊 **Crosshairs Tool Properties**

### **1. Annotation Data Structure**

Each crosshairs annotation has the following structure:

```javascript
annotation = {
  highlighted: false,
  annotationUID: "unique-id",
  
  // Metadata
  metadata: {
    cameraPosition: [x, y, z],       // Camera position in world coordinates
    cameraFocalPoint: [x, y, z],     // Camera focal point
    FrameOfReferenceUID: "string",   // Frame of reference
    toolName: "Crosshairs",           // Tool identifier
  },
  
  // Data
  data: {
    handles: {
      rotationPoints: [],             // Points for rotation handles
      slabThicknessPoints: [],        // Points for slab thickness controls
      toolCenter: [x, y, z],          // Center point in world coordinates
      activeOperation: null,          // Current operation (DRAG, ROTATE, SLAB)
    },
    activeViewportIds: [],            // Array of viewport IDs being manipulated
    viewportId: "viewport-id",        // Viewport this annotation belongs to
  }
}
```

### **2. Configuration Options**

```javascript
configuration: {
  // Visual appearance
  shadow: true,                                    // Enable shadow rendering
  handleRadius: 3,                                 // Size of interaction handles
  enableHDPIHandles: false,                        // High DPI handle rendering
  referenceLinesCenterGapRadius: 20,               // Gap at center (pixels)
  referenceLinesCenterGapRatio: null,              // Gap as ratio (alternative)
  
  // Viewport indicators (colored circles in corners)
  viewportIndicators: true,                        // Show viewport indicators
  viewportIndicatorsConfig: {
    circleRadius: 5,                               // Radius of indicator circles
    xOffset: 0.95,                                 // Horizontal position (0-1)
    yOffset: 0.05,                                 // Vertical position (0-1)
    radius: 5,                                     // Alternative radius property
    x: null,                                       // Absolute X position
    y: null,                                       // Absolute Y position
  },
  
  // Behavior
  disableOnPassive: true,                          // Disable (not passive) when deactivated
  
  // Auto-pan feature
  autoPan: {
    enabled: false,                                // Enable auto-pan when dragging near edges
    panSize: 10,                                   // Pan distance in pixels
  },
  
  // Slab thickness rendering
  slabThicknessBlendMode: Enums.BlendModes.MAXIMUM_INTENSITY_BLEND,
  filterActorUIDsToSetSlabThickness: [],          // Filter which actors get slab thickness
  
  // Dynamic color assignment (function)
  getReferenceLineColor: (viewportId) => {        // Returns color for reference lines
    // Example: 'rgb(200, 0, 0)' for axial
    return '#0c0';
  },
  
  // Controllability (functions)
  getReferenceLineControllable: (viewportId) => true,        // Can user interact?
  getReferenceLineDraggableRotatable: (viewportId) => true,  // Can drag/rotate?
  getReferenceLineSlabThicknessControlsOn: (viewportId) => true, // Show slab controls?
  
  // Mobile-specific settings
  mobile: {
    enabled: false,                                // Enable mobile mode
    opacity: 0.8,                                  // Opacity for mobile
    handleRadius: 9,                               // Larger handles for touch
    referenceLinesCenterGapRatio: 0.05,            // Proportional gap for mobile
  }
}
```

### **3. Tool Instance Properties**

```javascript
crosshairsTool = {
  toolName: "Crosshairs",
  mode: "Active" | "Passive" | "Enabled" | "Disabled",
  toolCenter: [x, y, z],              // Current tool center
  toolGroupId: "mpr",                 // Tool group it belongs to
  configuration: { ... },              // Configuration object above
  
  // Methods
  computeToolCenter(),                // Recompute center for all viewports
  resetCrosshairs(),                  // Reset all crosshairs
  initializeViewport(),               // Initialize for a viewport
}
```

### **4. Active Operations**

```javascript
OPERATION = {
  DRAG: 1,        // Dragging crosshairs center
  ROTATE: 2,      // Rotating reference lines
  SLAB: 3,        // Adjusting slab thickness
}
```

### **5. Viewport-Specific Data**

For each viewport with crosshairs:
- **viewportId**: Unique identifier
- **renderingEngineId**: Engine managing the viewport
- **viewPlaneNormal**: Normal vector of the view plane
- **activeViewportIds**: Array of viewports being manipulated
- **Camera properties**: position, focalPoint, viewPlaneNormal

### **6. Visual Elements**

- **Reference lines**: Crosshair lines showing intersection planes
- **Center gap**: Gap at the center of crosshairs
- **Rotation handles**: Interactive points for rotating planes
- **Slab thickness handles**: Controls for adjusting slab thickness
- **Viewport indicators**: Colored circles showing related viewports
- **Colors**: Per-viewport colors (typically red/yellow/green for axial/sagittal/coronal)

### **7. Typical Color Mappings**

```javascript
colorsByOrientation = {
  axial: 'rgb(200, 0, 0)',      // Red
  sagittal: 'rgb(200, 200, 0)', // Yellow
  coronal: 'rgb(0, 200, 0)',    // Green
}
```

## 🎯 **Summary of Key Properties**

| Category | Properties |
|----------|-----------|
| **Position/Geometry** | `toolCenter`, `rotationPoints`, `slabThicknessPoints`, `cameraPosition`, `cameraFocalPoint` |
| **State** | `mode`, `activeOperation`, `activeViewportIds`, `highlighted` |
| **Visual** | `handleRadius`, `referenceLinesCenterGapRadius`, `shadow`, `viewportIndicators` |
| **Behavior** | `disableOnPassive`, `autoPan`, `getReferenceLineColor` |
| **Interaction** | `getReferenceLineControllable`, `getReferenceLineDraggableRotatable` |
| **Rendering** | `slabThicknessBlendMode`, `filterActorUIDsToSetSlabThickness` |

So apart from **center**, the crosshairs have rotation points, slab thickness controls, active operations, viewport associations, camera data, and extensive configuration options for visual appearance and behavior!

```javascript
annotation = {
  highlighted: false,
  annotationUID: "unique-id",
  
  // Metadata
  metadata: {
    cameraPosition: [x, y, z],       // Camera position in world coordinates
    cameraFocalPoint: [x, y, z],     // Camera focal point
    FrameOfReferenceUID: "string",   // Frame of reference
    toolName: "Crosshairs",           // Tool identifier
  },
  
  // Data
  data: {
    handles: {
      rotationPoints: [],             // Points for rotation handles
      slabThicknessPoints: [],        // Points for slab thickness controls
      toolCenter: [x, y, z],          // Center point in world coordinates
      activeOperation: null,          // Current operation (DRAG, ROTATE, SLAB)
    },
    activeViewportIds: [],            // Array of viewport IDs being manipulated
    viewportId: "viewport-id",        // Viewport this annotation belongs to
  }
}
```

```javascript
configuration: {
  // Visual appearance
  shadow: true,                                    // Enable shadow rendering
  handleRadius: 3,                                 // Size of interaction handles
  enableHDPIHandles: false,                        // High DPI handle rendering
  referenceLinesCenterGapRadius: 20,               // Gap at center (pixels)
  referenceLinesCenterGapRatio: null,              // Gap as ratio (alternative)
  
  // Viewport indicators (colored circles in corners)
  viewportIndicators: true,                        // Show viewport indicators
  viewportIndicatorsConfig: {
    circleRadius: 5,                               // Radius of indicator circles
    xOffset: 0.95,                                 // Horizontal position (0-1)
    yOffset: 0.05,                                 // Vertical position (0-1)
    radius: 5,                                     // Alternative radius property
    x: null,                                       // Absolute X position
    y: null,                                       // Absolute Y position
  },
  
  // Behavior
  disableOnPassive: true,                          // Disable (not passive) when deactivated
  
  // Auto-pan feature
  autoPan: {
    enabled: false,                                // Enable auto-pan when dragging near edges
    panSize: 10,                                   // Pan distance in pixels
  },
  
  // Slab thickness rendering
  slabThicknessBlendMode: Enums.BlendModes.MAXIMUM_INTENSITY_BLEND,
  filterActorUIDsToSetSlabThickness: [],          // Filter which actors get slab thickness
  
  // Dynamic color assignment (function)
  getReferenceLineColor: (viewportId) => {        // Returns color for reference lines
    // Example: 'rgb(200, 0, 0)' for axial
    return '#0c0';
  },
  
  // Controllability (functions)
  getReferenceLineControllable: (viewportId) => true,        // Can user interact?
  getReferenceLineDraggableRotatable: (viewportId) => true,  // Can drag/rotate?
  getReferenceLineSlabThicknessControlsOn: (viewportId) => true, // Show slab controls?
  
  // Mobile-specific settings
  mobile: {
    enabled: false,                                // Enable mobile mode
    opacity: 0.8,                                  // Opacity for mobile
    handleRadius: 9,                               // Larger handles for touch
    referenceLinesCenterGapRatio: 0.05,            // Proportional gap for mobile
  }
}
```

```javascript
crosshairsTool = {
  toolName: "Crosshairs",
  mode: "Active" | "Passive" | "Enabled" | "Disabled",
  toolCenter: [x, y, z],              // Current tool center
  toolGroupId: "mpr",                 // Tool group it belongs to
  configuration: { ... },              // Configuration object above
  
  // Methods
  computeToolCenter(),                // Recompute center for all viewports
  resetCrosshairs(),                  // Reset all crosshairs
  initializeViewport(),               // Initialize for a viewport
}
```

```javascript
OPERATION = {
  DRAG: 1,        // Dragging crosshairs center
  ROTATE: 2,      // Rotating reference lines
  SLAB: 3,        // Adjusting slab thickness
}
```

```javascript
colorsByOrientation = {
  axial: 'rgb(200, 0, 0)',      // Red
  sagittal: 'rgb(200, 200, 0)', // Yellow
  coronal: 'rgb(0, 200, 0)',    // Green
}
```

