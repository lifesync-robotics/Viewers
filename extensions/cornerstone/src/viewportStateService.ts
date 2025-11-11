import { getRenderingEngine } from '@cornerstonejs/core';
import { crosshairsHandler } from './utils/crosshairsHandler';

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
  radius: number;
  length: number;
  // 4x4 transformation matrix - can be either:
  // - Flattened: 16-element array (row-major)
  // - Nested: 4x4 2D array [[row0], [row1], [row2], [row3]]
  transform: number[] | number[][];
}

class ViewportStateService {
  public static REGISTRATION = {
    name: 'viewportStateService',
    create: ({ servicesManager }) => new ViewportStateService({ servicesManager }),
  };

  private snapshots: Map<string, Snapshot>;
  private readonly MAX_SNAPSHOTS = 40;
  private readonly STORAGE_KEY = 'ohif_viewport_snapshots';
  private cameraLoggingEnabled: boolean = false;
  private cameraEventListeners: Map<string, any> = new Map();
  private servicesManager: any;

  constructor({ servicesManager = null } = {}) {
    this.servicesManager = servicesManager;

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
  saveSnapshot(name: string, radius?: number, length?: number, transform?: number[] | number[][]): Snapshot {
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
      radius: radius ?? 0,
      length: length ?? 0,
      transform: transform ?? [],
    };

    this.snapshots.set(uniqueName, snapshot);
    this.saveToStorage();

    console.log(`💾 Saved snapshot: "${uniqueName}" with ${viewportStates.length} viewports (radius: ${radius ?? 0}, length: ${length ?? 0})`);
    return snapshot;
  }

  // Restore specific snapshot by name
  async restoreSnapshot(name: string): Promise<boolean> {
    const snapshot = this.snapshots.get(name);

    if (!snapshot) {
      throw new Error(`Snapshot "${name}" not found`);
    }

    const engine = this.getEngine();
    if (!engine) throw new Error('Rendering engine not found');

    let restoredCount = 0;

    console.log('═══════════════════════════════════════════════════════');
    console.log('🔄 [ViewportStateService] RESTORING SNAPSHOT');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📋 Snapshot name: "${name}"`);
    console.log(`📋 Radius: ${snapshot.radius}`);
    console.log(`📋 Length: ${snapshot.length}`);
    console.log(`📋 Viewports to restore: ${snapshot.viewports.length}`);

    // Restore each viewport from the snapshot
    for (const savedState of snapshot.viewports) {
      try {
        let vp = engine.getViewport(savedState.metadata.viewportId);

         // If exact match not found, try flexible matching
         if (!vp) {
          const allViewports = engine.getViewports();
          vp = allViewports.find(v =>
            v.id.includes(savedState.metadata.viewportId) ||
            savedState.metadata.viewportId.includes(v.id)
          );
        }

        if (!vp) {
          console.warn(`⚠️ Viewport ${savedState.metadata.viewportId} not found`);
          continue;
        }

        console.log(`───────────────────────────────────────────────────────`);
        console.log(`📍 Restoring viewport: ${savedState.metadata.viewportId}`);

        vp.setCamera(savedState.camera);

        if (savedState.viewPresentation && typeof vp.setViewPresentation === 'function') {
          vp.setViewPresentation(savedState.viewPresentation);
        }

        if (savedState.viewReference && typeof vp.setViewReference === 'function') {
          vp.setViewReference(savedState.viewReference);
        }

        vp.render();
        restoredCount++;

        console.log(`✅ Viewport camera and view state restored`);

      } catch (error) {
        console.error(`❌ Failed to restore viewport ${savedState.metadata.viewportId}:`, error);
      }
    }

    console.log(`───────────────────────────────────────────────────────`);
    console.log(`✅ Restored ${restoredCount}/${snapshot.viewports.length} viewports`);

    // Query and load model based on radius and length
    await this.queryAndLoadModel(snapshot.radius, snapshot.length, snapshot.transform);

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ [ViewportStateService] SNAPSHOT RESTORATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════');

    return restoredCount > 0;
  }

  /**
   * Query model server for a model with specific radius and length, then load it
   * This is a public method that can be called from external components
   */
  public async queryAndLoadModel(radius: number, length: number, transform?: number[] | number[][]): Promise<void> {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔍 [ViewportStateService] QUERYING MODEL SERVER');
    console.log('═══════════════════════════════════════════════════════');

    // Check if radius and length are valid
    if (!radius || radius <= 0 || !length || length <= 0) {
      console.warn(`⚠️ Invalid model dimensions: radius=${radius}, length=${length}`);
      console.warn(`⚠️ Skipping model loading`);
      return;
    }

    console.log(`📋 Looking for model with:`);
    console.log(`   Radius: ${radius} mm`);
    console.log(`   Length: ${length} mm`);

    // Check if modelStateService is available
    if (!this.servicesManager) {
      console.error(`❌ ServicesManager not available - cannot load model`);
      return;
    }

    const modelStateService = this.servicesManager.services?.modelStateService;
    if (!modelStateService) {
      console.error(`❌ ModelStateService not available - cannot load model`);
      return;
    }

    console.log(`✅ ModelStateService found`);

    try {
      // Get base URL for model server
      const baseUrl = window.location.origin;
      const queryUrl = `${baseUrl}/api/models/query?radius=${radius}&length=${length}`;

      console.log(`───────────────────────────────────────────────────────`);
      console.log(`🌐 Querying model server:`);
      console.log(`   URL: ${queryUrl}`);

      // Query the model server
      const response = await fetch(queryUrl);

      if (!response.ok) {
        throw new Error(`Model query failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      console.log(`───────────────────────────────────────────────────────`);
      console.log(`📦 Server response:`, data);

      if (!data.success) {
        console.warn(`⚠️ Model not found on server`);
        console.warn(`   Reason: ${data.message || 'Unknown'}`);
        return;
      }

      if (!data.model) {
        console.warn(`⚠️ Server response missing model data`);
        return;
      }

      console.log(`✅ Model found on server:`);
      console.log(`   Filename: ${data.model.filename}`);
      console.log(`   URL: ${data.model.url}`);
      console.log(`   Radius: ${data.model.radius} mm`);
      console.log(`   Length: ${data.model.length} mm`);
      console.log(`   Diameter: ${data.model.diameter} mm`);

      // Find the 3D viewport to load the model into
      const engine = this.getEngine();
      if (!engine) {
        console.error(`❌ Rendering engine not found - cannot load model`);
        return;
      }

      const viewports = engine.getViewports();
      const volume3DViewport = viewports.find(vp => vp.type === 'volume3d');

      if (!volume3DViewport) {
        console.warn(`⚠️ No 3D volume viewport found - cannot load model`);
        console.warn(`   Available viewport types: ${viewports.map(vp => vp.type).join(', ')}`);
        return;
      }

      console.log(`───────────────────────────────────────────────────────`);
      console.log(`🎯 Target 3D viewport found: ${volume3DViewport.id}`);
      console.log(`📥 Loading model into viewport...`);

      // Load the model using modelStateService
      const loadedModel = await modelStateService.loadModelFromServer(data.model.url, {
        viewportId: volume3DViewport.id,
        color: [1.0, 0.84, 0.0], // Gold color for screw
        opacity: 0.9,
        visible: true
      });

      if (loadedModel) {
        console.log(`✅ Model loaded successfully!`);
        console.log(`   Model ID: ${loadedModel.metadata.id}`);
        console.log(`   Model name: ${loadedModel.metadata.name}`);
        console.log(`   Viewport: ${loadedModel.metadata.viewportId}`);
        console.log(`   Color: [${loadedModel.metadata.color?.join(', ')}]`);
        console.log(`   Opacity: ${loadedModel.metadata.opacity}`);

        // Apply transform if available
        if (transform && Array.isArray(transform)) {
          console.log(`───────────────────────────────────────────────────────`);
          console.log(`🔧 Processing transform for model...`);

          // Check if transform is nested (2D array) or flat (1D array)
          let flattenedTransform: number[] | null = null;

          if (transform.length === 4 && Array.isArray(transform[0])) {
            // Transform is a nested 4x4 matrix - flatten it (row-major order)
            console.log(`   Transform format: Nested 4x4 matrix (4 rows)`);
            const temp: number[] = [];
            let isValid = true;

            for (let i = 0; i < 4; i++) {
              const row = transform[i];
              if (!Array.isArray(row) || row.length !== 4) {
                console.error(`❌ Invalid nested transform - row ${i} is not a 4-element array`);
                console.log(`ℹ️ Skipping transform application`);
                isValid = false;
                break;
              }
              temp.push(...(row as number[]));
            }

            if (isValid) {
              flattenedTransform = temp;
            }
          } else if (transform.length === 16 && !Array.isArray(transform[0])) {
            // Transform is already flattened
            console.log(`   Transform format: Flattened 16-element array`);
            flattenedTransform = transform as number[];
          } else {
            console.warn(`⚠️ Invalid transform format - expected 16-element array or 4x4 nested array`);
            console.warn(`   Received: ${transform.length} elements`);
            console.log(`ℹ️ Skipping transform application`);
          }

          // Apply the transform if we successfully flattened it
          if (flattenedTransform && flattenedTransform.length === 16) {
            console.log(`   Transform matrix (4x4 flattened, row-major):`, flattenedTransform);

            try {
              // Apply the transform to the loaded model (with length offset)
              const transformResult = await modelStateService.setModelTransform(
                loadedModel.metadata.id,
                flattenedTransform,
                length  // Pass length to offset model backward along coronal direction
              );

              if (transformResult) {
                console.log(`✅ Transform applied successfully to model`);
                console.log(`   Model positioned according to screw placement (offset by length/2)`);
              } else {
                console.warn(`⚠️ Transform application returned null/false`);
              }
            } catch (transformError) {
              console.error(`❌ Error applying transform to model:`, transformError);
              console.error(`   Transform error message: ${transformError.message}`);
            }
          }
        } else {
          console.log(`ℹ️ No transform provided for this model`);
        }
      } else {
        console.error(`❌ Model loading failed - loadModelFromServer returned null`);
      }

    } catch (error) {
      console.error(`❌ Error querying or loading model:`, error);
      console.error(`   Error message: ${error.message}`);
      if (error.stack) {
        console.error(`   Stack trace:`, error.stack);
      }
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ [ViewportStateService] MODEL QUERY AND LOAD COMPLETE');
    console.log('═══════════════════════════════════════════════════════');
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

  // Get maximum snapshot limit
  getMaxSnapshots(): number {
    return this.MAX_SNAPSHOTS;
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

  // Import snapshots from JSON file (Python script format)
  // Expected format: Array of [name, snapshot] pairs where snapshot has radius and length
  importFromJSONFile(jsonString: string) {
    try {
      const data = JSON.parse(jsonString);

      // Handle both formats:
      // 1. Python script format: Array of [name, snapshot] pairs
      // 2. Direct snapshot format: Map entries

      if (Array.isArray(data)) {
        // Python script format: [[name, snapshot], [name, snapshot], ...]
        data.forEach(([name, snapshot]) => {
          if (snapshot && typeof snapshot === 'object') {
            // Ensure snapshot has required fields
            const validSnapshot: Snapshot = {
              name: name || snapshot.name || 'Unnamed',
              timestamp: snapshot.timestamp || new Date().toISOString(),
              viewports: snapshot.viewports || [],
              radius: snapshot.radius ?? 0,
              length: snapshot.length ?? 0,
              transform: snapshot.transform ?? [],
            };

            // Use unique name
            const uniqueName = this.getUniqueName(validSnapshot.name);
            validSnapshot.name = uniqueName;

            this.snapshots.set(uniqueName, validSnapshot);
          }
        });
      } else if (typeof data === 'object') {
        // Map format: [[key, value], [key, value], ...]
        this.snapshots = new Map(data);
      } else {
        throw new Error('Unsupported JSON format');
      }

      this.saveToStorage();
      console.log(`✅ Imported ${this.snapshots.size} snapshots from JSON file`);
      return this.snapshots.size;
    } catch (error) {
      console.error('❌ Error importing from JSON file:', error);
      throw new Error(`Failed to import: ${error.message}`);
    }
  }

  // Load snapshots from file upload
  async loadSnapshotsFromFile(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event: any) => {
        try {
          const jsonString = event.target.result;
          const count = this.importFromJSONFile(jsonString);
          resolve(count);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsText(file);
    });
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
    try {
      const crosshairCenters = crosshairsHandler.getAllMPRCrosshairCenters();

      // Convert to the expected format (adding isActive based on whether center exists)
      const result: Record<string, { center: number[] | null; isActive: boolean }> = {};

      for (const [viewportId, center] of Object.entries(crosshairCenters)) {
        result[viewportId] = {
          center: center,
          isActive: !!center, // isActive is true if center exists
        };
      }

      return result;

    } catch (error) {
      console.error('❌ Error accessing crosshairs tool:', error);
      return {};
    }
  }
}

export default ViewportStateService;
