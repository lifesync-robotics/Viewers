import { PubSubService } from '@ohif/core';
import { getRenderingEngine, getRenderingEngines, metaData } from '@cornerstonejs/core';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkOBJReader from '@kitware/vtk.js/IO/Misc/OBJReader';  // models are all in obj format
import vtkMatrixBuilder from '@kitware/vtk.js/Common/Core/MatrixBuilder';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';
import vtkTransform from '@kitware/vtk.js/Common/Transform/Transform';

import { Types as OHIFTypes } from '@ohif/core';
/**
 *
 *
 * model should be placed at the origin 0,0,0 for screw planning at the beginning.
 * Then the model orientation should follow the viewport camera normal and the crosshairs center point.
 * Also, we may need to offset it depending on the design
 *
 *
 */
/**
 * Supported 3D model formats
 */
export enum ModelFormat {
  OBJ = 'obj',
}

/**
 * Model metadata interface
 */
export interface ModelMetadata {
  id: string;        // Unique identifier (e.g., screw_id from database, or auto-generated)
  name: string;      // Human-readable name/label (e.g., "L3-R1", "L2L", or filename)
  format: ModelFormat;
  filePath: string;
  fileUrl?: string;
  loadedAt: Date;
  viewportId?: string;
  visible: boolean;
  color?: [number, number, number];
  opacity?: number;
  // DICOM alignment information
  dicomOrigin?: [number, number, number];
  dicomOrientation?: number[];
  originalPosition?: [number, number, number];
  alignedPosition?: [number, number, number];
  // Note: All models are automatically transformed:
  //   - Rotated 90° around X-axis to align with DICOM coordinate system
  //   - Scaled 10x in all directions for better visibility
}

/**
 * Loaded model data structure
 */
export interface LoadedModel {
  metadata: ModelMetadata;
  actor: any; // vtkActor
  mapper: any; // vtkMapper
  reader: any; // vtkOBJReader
  polyData?: any; // vtkPolyData (with all transformations baked in, in world space)
}

/**
 * Model loading options
 */
export interface ModelLoadOptions {
  viewportId?: string; // Note: Model will be added to ALL viewports in the same rendering engine
  color?: [number, number, number];
  opacity?: number;
  visible?: boolean;
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
  modelId?: string;   // Custom ID for the model (e.g., screw_id from database)
  modelName?: string; // Custom name/label for the model (e.g., "L3-R1", "L2L")
}

/**
 * Service events
 */
const EVENTS = {
  MODEL_ADDED: 'event::model_added',
  MODEL_REMOVED: 'event::model_removed',
  MODEL_UPDATED: 'event::model_updated', // Note: not used yet
  MODEL_VISIBILITY_CHANGED: 'event::model_visibility_changed', // Note: not used yet
  MODEL_LOADING_START: 'event::model_loading_start', // Note: not used yet
  MODEL_LOADING_COMPLETE: 'event::model_loading_complete', // Note: not used yet
  MODEL_LOADING_ERROR: 'event::model_loading_error', // Note: not used yet
  MODELS_CLEARED: 'event::models_cleared', // Note: not used yet
};

/**
 * ModelStateService - Manages 3D model loading, rendering, and state management
 *
 * Based on:
 * - Cornerstone.js mesh loader: https://www.cornerstonejs.org/live-examples/meshloader
 * - vtk.js OBJ Viewer: https://kitware.github.io/vtk-js/examples/OBJViewer.html
 */
class ModelStateService extends PubSubService {
  static REGISTRATION = {
    name: 'modelStateService',
    altName: 'ModelStateService',
    create: ({ servicesManager }: OHIFTypes.Extensions.ExtensionParams): ModelStateService => {
      return new ModelStateService({ servicesManager });
    },
  };

  public readonly EVENTS = EVENTS;
  public static readonly EVENTS = EVENTS;

  private readonly servicesManager: any;
  private loadedModels: Map<string, LoadedModel>;
  private modelDirectory: string;

  constructor({ servicesManager }) {
    super(EVENTS);
    this.servicesManager = servicesManager;
    this.loadedModels = new Map();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // API INTEGRATION METHODS
  // Methods to interact with the model server for listing and uploading models
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get base URL for model server API
   * In development, this is proxied through webpack dev server
   */
  private _getModelServerBaseUrl(): string {
    // In development, webpack dev server proxies to localhost:5001
    // In production, you might want to use an environment variable
    return window.location.origin; // Proxied by webpack dev server
  }

  /**
   * Fetch list of available models from the server
   * Returns both server-provided models and user-uploaded models
   *
   * @returns Promise with list of available models
   * @example
   * const models = await modelStateService.fetchAvailableModels();
   * models.forEach(model => {
   *   console.log(model.name, model.url);
   * });
   */
  public async fetchAvailableModels(): Promise<any[]> {
    try {
      const baseUrl = this._getModelServerBaseUrl();
      const response = await fetch(`${baseUrl}/api/models/list`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.models) {
        console.log(`✅ [ModelStateService] Fetched ${data.count} models from server`);
        return data.models;
      } else {
        console.error('❌ [ModelStateService] Invalid response from model server:', data);
        return [];
      }
    } catch (error) {
      console.error('❌ [ModelStateService] Error fetching models:', error);
      return [];
    }
  }

  /**
   * Upload a model file to the server
   *
   * @param file - The File object to upload (must be .obj)
   * @returns Promise with upload result including model metadata
   * @example
   * const input = document.querySelector('input[type="file"]');
   * const file = input.files[0];
   * const result = await modelStateService.uploadModelToServer(file);
   * if (result.success) {
   *   console.log('Model uploaded:', result.model.url);
   * }
   */
  public async uploadModelToServer(file: File): Promise<any> {
    try {
      // Validate file type
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'obj') {
        throw new Error('Only .obj files are supported');
      }

      // Create FormData for upload
      const formData = new FormData();
      formData.append('model', file);

      const baseUrl = this._getModelServerBaseUrl();
      const response = await fetch(`${baseUrl}/api/models/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        console.log('✅ [ModelStateService] Model uploaded successfully:', result.model.filename);
        return result;
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('❌ [ModelStateService] Error uploading model:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Load a model from the server by its URL
   * This is a convenience method that combines fetching and loading
   *
   * @param modelUrl - The URL of the model (e.g., '/models/server/brain.obj')
   * @param options - Loading options (viewportId, color, etc.)
   * @returns Promise with loaded model
   * @example
   * // Load a server model
   * await modelStateService.loadModelFromServer('/models/server/brain.obj', {
   *   viewportId: 'viewport-3d',
   *   color: [1, 0, 0],
   *   opacity: 0.8
   * });
   */
  public async loadModelFromServer(
    modelUrl: string,
    options: ModelLoadOptions = {}
  ): Promise<LoadedModel | null> {
    try {
      // Prepend base URL if not already a full URL
      let fullUrl = modelUrl;
      if (!modelUrl.startsWith('http')) {
        const baseUrl = this._getModelServerBaseUrl();
        fullUrl = `${baseUrl}${modelUrl.startsWith('/') ? '' : '/'}${modelUrl}`;
      }

      console.log(`📥 [ModelStateService] Loading model from server: ${fullUrl}`);

      // Use existing loadModel method
      return await this.loadModel(fullUrl, options);
    } catch (error) {
      console.error('❌ [ModelStateService] Error loading model from server:', error);
      return null;
    }
  }

  /**
   * Upload a model and immediately load it into a viewport
   *
   * @param file - The File object to upload
   * @param options - Loading options (viewportId, color, etc.)
   * @returns Promise with loaded model
   * @example
   * const input = document.querySelector('input[type="file"]');
   * const file = input.files[0];
   * await modelStateService.uploadAndLoadModel(file, {
   *   viewportId: 'viewport-3d'
   * });
   */
  public async uploadAndLoadModel(
    file: File,
    options: ModelLoadOptions = {}
  ): Promise<LoadedModel | null> {
    try {
      console.log('📤 [ModelStateService] Uploading and loading model:', file.name);

      // First upload to server
      const uploadResult = await this.uploadModelToServer(file);

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      // Then load from server URL
      return await this.loadModelFromServer(uploadResult.model.url, options);
    } catch (error) {
      console.error('❌ [ModelStateService] Error uploading and loading model:', error);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // END API INTEGRATION METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Load a 3D model from file path or URL
   */
  public async loadModel(
    filePathOrUrl: string,
    options: ModelLoadOptions = {}
  ): Promise<LoadedModel | null> {
    const fileName = this._extractFileName(filePathOrUrl);
    const autoGeneratedId = this._generateModelId(fileName);
    const format = this._getModelFormat(fileName);

    if (!format) {
      console.error(`Unsupported file format: ${fileName}`);
      this._broadcastEvent(this.EVENTS.MODEL_LOADING_ERROR, { fileName, error: 'Unsupported format' });
      return null;
    }

    // Use custom id/name if provided, otherwise use auto-generated values
    const modelId = options.modelId || autoGeneratedId;
    const modelName = options.modelName || fileName;

    this._broadcastEvent(this.EVENTS.MODEL_LOADING_START, { modelId, fileName });

    try {
      const metadata: ModelMetadata = {
        id: modelId,
        name: modelName,
        format,
        filePath: filePathOrUrl,
        loadedAt: new Date(),
        viewportId: options.viewportId,
        visible: options.visible ?? true,
        color: options.color,
        opacity: options.opacity ?? 1.0,
      };

      let loadedModel: LoadedModel;

      // Check if loading from URL or local file
      if (this._isUrl(filePathOrUrl)) {
        loadedModel = await this._loadFromUrl(metadata, options);
      } else {
        loadedModel = await this._loadFromFile(metadata, options);
      }

      this.loadedModels.set(modelId, loadedModel);

      // Add to 3D volume viewport ONLY
      if (options.viewportId) {
        this._addModelToViewportSmart(loadedModel, options.viewportId);
      }
      // This event is very important; later when we deal with 2d plane cutting we need to start cutting after the model is added to the viewport
      this._broadcastEvent(this.EVENTS.MODEL_ADDED, { modelId, metadata });
      this._broadcastEvent(this.EVENTS.MODEL_LOADING_COMPLETE, { modelId, metadata });

      return loadedModel;
    } catch (error) {
      console.error(`Error loading model ${fileName}:`, error);
      this._broadcastEvent(this.EVENTS.MODEL_LOADING_ERROR, { modelId, fileName, error: error.message });
      return null;
    }
  }

  /**
   * Load model from URL
   */
  private async _loadFromUrl(
    metadata: ModelMetadata,
    options: ModelLoadOptions
  ): Promise<LoadedModel> {
    return new Promise((resolve, reject) => {
      fetch(metadata.filePath, {
        credentials: 'include'
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.text();
        })
        .then(content => {
          const loadedModel = this._createModelFromText(content, metadata, options);
          resolve(loadedModel);
        })
        .catch(error => reject(error));
    });
  }

  /**
   * Load model from local file
   */
  private async _loadFromFile(
    metadata: ModelMetadata,
    options: ModelLoadOptions
  ): Promise<LoadedModel> {
    return new Promise((resolve, reject) => {
      fetch(`file:///${metadata.filePath}`)
        .then(response => response.text())
        .then(content => {
          const loadedModel = this._createModelFromText(content, metadata, options);
          resolve(loadedModel);
        })
        .catch(error => {
          // Fallback: try to read as File object
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = `.${metadata.format}`;

          input.onchange = (e: any) => {
            const file = e.target.files[0];
            const reader = new FileReader();

            reader.onload = (event: any) => {
              const content = event.target.result;
              const loadedModel = this._createModelFromText(content, metadata, options);
              resolve(loadedModel);
            };

            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
          };

          // For automated loading without user interaction
          reject(new Error('Cannot read local file without user interaction. Use loadModelFromFileInput instead.'));
        });
    });
  }

  /**
   * Load model from file input element
   */
  public async loadModelFromFileInput(
    file: File,
    options: ModelLoadOptions = {}
  ): Promise<LoadedModel | null> {
    const fileName = file.name;
    const autoGeneratedId = this._generateModelId(fileName);
    const format = this._getModelFormat(fileName);

    if (!format) {
      console.error(`Unsupported file format: ${fileName}`);
      return null;
    }

    // Use custom id/name if provided, otherwise use auto-generated values
    const modelId = options.modelId || autoGeneratedId;
    const modelName = options.modelName || fileName;

    this._broadcastEvent(this.EVENTS.MODEL_LOADING_START, { modelId, fileName });

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event: any) => {
        try {
          const content = event.target.result;

          const metadata: ModelMetadata = {
            id: modelId,
            name: modelName,
            format,
            filePath: file.name,
            loadedAt: new Date(),
            viewportId: options.viewportId,
            visible: options.visible ?? true,
            color: options.color,
            opacity: options.opacity ?? 1.0,
          };

          const loadedModel = this._createModelFromText(content, metadata, options);
          this.loadedModels.set(modelId, loadedModel);

          if (options.viewportId) {
            this._addModelToViewportSmart(loadedModel, options.viewportId);
          }

          this._broadcastEvent(this.EVENTS.MODEL_ADDED, { modelId, metadata });
          this._broadcastEvent(this.EVENTS.MODEL_LOADING_COMPLETE, { modelId, metadata });

          resolve(loadedModel);
        } catch (error) {
          console.error(`Error loading model ${fileName}:`, error);
          this._broadcastEvent(this.EVENTS.MODEL_LOADING_ERROR, { modelId, fileName, error: error.message });
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(reader.error);
      };

      reader.readAsText(file);
    });
  }

  /**
   * Apply initial DICOM coordinate system transformation to actor
   * - Rotates -90° around X-axis to align with DICOM coordinate system
   * - Scales 10x for better visibility
   * - Applies custom position/rotation/scale from options
   */
  private _applyInitialDicomTransform(
    actor: any,
    options: ModelLoadOptions
  ): void {

    // no longer needed as the transformation matrix should handle this rotation already
    // DICOM coordinate system alignment: -90° rotation around X-axis
    // const dicomAlignmentRotation = [-90, 0, 0];
    // actor.setOrientation(dicomAlignmentRotation[0], dicomAlignmentRotation[1], dicomAlignmentRotation[2]);

    // Default scale
    const defaultScale = [1, 1, 1];
    actor.setScale(defaultScale[0], defaultScale[1], defaultScale[2]);

    // Apply custom position if provided
    // if (options.position) {
    //   actor.setPosition(options.position[0], options.position[1], options.position[2]);
    // }

    // Apply custom scale if provided (multiply with default)
    if (options.scale) {
      const combinedScale = [
        defaultScale[0] * options.scale[0],
        defaultScale[1] * options.scale[1],
        defaultScale[2] * options.scale[2],
      ];
      actor.setScale(combinedScale[0], combinedScale[1], combinedScale[2]);
    }

    // Apply custom rotation if provided (add to DICOM alignment)
    // if (options.rotation) {
    //   const combinedRotation = [
    //     dicomAlignmentRotation[0] + options.rotation[0],
    //     dicomAlignmentRotation[1] + options.rotation[1],
    //     dicomAlignmentRotation[2] + options.rotation[2],
    //   ];
    //   actor.setOrientation(combinedRotation[0], combinedRotation[1], combinedRotation[2]);
    // }

    // Apply visual properties
    if (options.color) {
      actor.getProperty().setColor(options.color[0], options.color[1], options.color[2]);
    }

    if (options.opacity !== undefined) {
      actor.getProperty().setOpacity(options.opacity);
    }
  }

  /**
   * Harden polyData transformations - bake actor transformations into polyData geometry
   * This modifies polyData IN-PLACE to save memory
   * After this, polyData exists in world space with all transformations applied
   */
  private _hardenPolyDataTransform(polyData: any, actor: any): void {
    // Get final transformation parameters from the actor
    const orientation = actor.getOrientation();
    const scale = actor.getScale();
    const position = actor.getPosition();

    // Build transformation matrix: scale -> rotate -> translate
    const transformMatrix = vtkMatrixBuilder
      .buildFromDegree()
      .scale(scale[0], scale[1], scale[2])
      .rotateX(orientation[0])
      .rotateY(orientation[1])
      .rotateZ(orientation[2])
      .translate(position[0], position[1], position[2])
      .getMatrix();

    // Get the points from polyData
    const points = polyData.getPoints();
    const pointsData = points.getData();
    const numPoints = points.getNumberOfPoints();

    // Transform each point IN-PLACE using the matrix
    for (let i = 0; i < numPoints; i++) {
      const idx = i * 3;
      const x = pointsData[idx];
      const y = pointsData[idx + 1];
      const z = pointsData[idx + 2];

      // Apply 4x4 transformation matrix (homogeneous coordinates)
      pointsData[idx] =
        transformMatrix[0] * x + transformMatrix[1] * y + transformMatrix[2] * z + transformMatrix[3];
      pointsData[idx + 1] =
        transformMatrix[4] * x + transformMatrix[5] * y + transformMatrix[6] * z + transformMatrix[7];
      pointsData[idx + 2] =
        transformMatrix[8] * x + transformMatrix[9] * y + transformMatrix[10] * z + transformMatrix[11];
    }

    // Notify that points have been modified
    points.modified();

    console.log(`✅ Hardened polyData transformations (${numPoints} points transformed in-place)`);
    console.log(`   Applied: rotation=${orientation}, scale=${scale}, position=${position}`);
  }

  /**
   * Create model from text content
   */
  private _createModelFromText(
    content: string,
    metadata: ModelMetadata,
    options: ModelLoadOptions
  ): LoadedModel {
    let reader: any;

    // Create OBJ reader
    switch (metadata.format) {
      case ModelFormat.OBJ:
        reader = vtkOBJReader.newInstance();
        reader.parseAsText(content);
        break;
      default:
        throw new Error(`Unsupported format: ${metadata.format}. Only OBJ format is supported.`);
    }

    // Create mapper and actor
    const mapper = vtkMapper.newInstance();
    const actor = vtkActor.newInstance();

    // Handle multiple outputs (OBJ files can have multiple objects)
    const numberOfOutputs = reader.getNumberOfOutputPorts ? reader.getNumberOfOutputPorts() : 1;

    if (numberOfOutputs > 1) {
      // For OBJ files with multiple objects, use the first one
      const polyData = reader.getOutputData(0);
      mapper.setInputData(polyData);
    } else {
      mapper.setInputConnection(reader.getOutputPort());
    }

    actor.setMapper(mapper);

    // Apply initial DICOM alignment transformation and custom options
    this._applyInitialDicomTransform(actor, options);
    actor.setVisibility(metadata.visible);

    // Get polyData and harden transformations (modifies polyData in-place to save memory)
    const polyData = mapper.getInputData();
    this._hardenPolyDataTransform(polyData, actor);

    // Reset actor transform to identity since geometry is now in world space
    actor.setOrientation(0, 0, 0);
    actor.setScale(1, 1, 1);
    actor.setPosition(0, 0, 0);

    return {
      metadata,
      actor,
      mapper,
      reader,
      polyData,
    };
  }

  /**
   * Smart viewport selection - checks if using fourUpMesh and adds to 3D viewport only
   */
  private _addModelToViewportSmart(loadedModel: LoadedModel, viewportId: string): void {
    try {
      // Get hanging protocol service to check current layout
      const { hangingProtocolService } = this.servicesManager.services;
      const hpState = hangingProtocolService?.getState();

      console.log('🔧 [ModelStateService] Checking hanging protocol:', hpState?.protocolId);

      // If using fourUpMesh, find the 3D volume viewport
      if (hpState?.protocolId === 'fourUpMesh') {
        console.log('🎯 [ModelStateService] FourUpMesh layout detected - finding 3D volume viewport');

        const renderingEngines = getRenderingEngines();
        let volume3DViewport = null;

        // Find the volume3d viewport in the fourUpMesh layout
        for (const engine of renderingEngines) {
          const viewports = engine.getViewports();

          for (const vp of viewports) {
            console.log(`🔍 [ModelStateService] Checking viewport: ${vp.id} (type: ${vp.type})`);

            // Check if viewport is a 3D volume viewport
            if (vp.type === 'volume3d') {
              volume3DViewport = vp;
              console.log(`✅ [ModelStateService] Found 3D volume viewport: ${vp.id}`);
              break;
            }
          }

          if (volume3DViewport) break;
        }

        if (volume3DViewport) {
          console.log('🎯 [ModelStateService] Adding model to 3D viewport only:', volume3DViewport.id);
          this._addModelToViewport(loadedModel, volume3DViewport.id);
        } else {
          console.warn('⚠️ [ModelStateService] No 3D volume viewport found in fourUpMesh layout');
          console.warn('⚠️ [ModelStateService] Model will not be added');
        }
      } else {
        // Not using fourUpMesh, add to specified viewport
        console.log('🔧 [ModelStateService] Standard layout - adding to specified viewport:', viewportId);
        this._addModelToViewport(loadedModel, viewportId);
      }
    } catch (error) {
      console.error('❌ [ModelStateService] Error in smart viewport selection:', error);
      // Fallback to regular behavior
      this._addModelToViewport(loadedModel, viewportId);
    }
  }

  /**
   * Add model to a specific viewport
   */
  private _addModelToViewport(loadedModel: LoadedModel, viewportId: string): void {
    try {
      console.log('🔧 [ModelStateService] Adding model to viewport:', viewportId);

      // Get all rendering engines and find the one with our viewport
      const renderingEngines = getRenderingEngines();
      console.log('🔧 [ModelStateService] Available rendering engines:', renderingEngines.length);

      // Log details about each rendering engine
      // there should be 2. 1 "OHIFCornerstoneRenderingEngine"; 2 thumbnail rendering engines
      // if (renderingEngines.length > 0) {
      //   console.log('🔍 [ModelStateService] Rendering engines details:');
      //   renderingEngines.forEach((engine, index) => {
      //     const viewports = engine.getViewports();
      //     console.log(`   Engine ${index + 1}:`);
      //     console.log(`     - ID: "${engine.id}"`);
      //     console.log(`     - Viewports: ${viewports.length}`);
      //     console.log(`     - Has been destroyed: ${engine.hasBeenDestroyed}`);
      //     viewports.forEach(vp => {
      //       console.log(`       • ${vp.id} (type: ${vp.type})`);
      //     });
      //   });
      // }

      if (renderingEngines.length === 0) {
        console.error('❌ [ModelStateService] No rendering engines found!');
        console.error('❌ [ModelStateService] Make sure Cornerstone3D is properly initialized');
        return;
      }

      let renderingEngine = null;
      let viewport = null;

      // Try to find the viewport in any rendering engine
      for (const engine of renderingEngines) {
        console.log('🔧 [ModelStateService] Checking rendering engine:', engine.id);
        try {
          const vp = engine.getViewport(viewportId);
          if (vp) {
            renderingEngine = engine;
            viewport = vp;
            console.log('✅ [ModelStateService] Found viewport in engine:', engine.id);
            break;
          }
        } catch (e) {
          // Viewport not in this engine, continue searching
        }
      }

      if (!renderingEngine || !viewport) {
        console.error('❌ [ModelStateService] Viewport not found:', viewportId);
        console.log('🔧 [ModelStateService] Available viewports:');
        renderingEngines.forEach(engine => {
          const viewports = engine.getViewports();
          viewports.forEach(vp => {
            console.log(`  - ${vp.id} (type: ${vp.type})`);
          });
        });
        return;
      }

      // Check viewport type
      console.log('🔧 [ModelStateService] Viewport type:', viewport.type);

      if (viewport.type !== 'volume3d' && viewport.type !== 'VOLUME_3D') {
        console.warn('⚠️ [ModelStateService] Viewport is not Volume3D!');
        console.warn('⚠️ [ModelStateService] Current type:', viewport.type);
        console.warn('⚠️ [ModelStateService] 3D mesh models require a Volume3D viewport');
        console.warn('⚠️ [ModelStateService] Model will NOT be added to this viewport');
        return;
      }

      // Get the vtk.js renderer from the viewport
      const vtkRenderer = viewport.getRenderer();

      if (!vtkRenderer) {
        console.error('❌ [ModelStateService] No VTK renderer found in viewport');
        return;
      }

      // Get DICOM origin, spacing, and dimensions to align model to center
      const dicomOrigin = this._getDICOMOrigin(viewport);
      const dicomOrientation = this._getDICOMOrientation(viewport);
      const dicomSpacing = this._getDICOMSpacing(viewport);
      const dicomDimensions = this._getDICOMDimensions(viewport);

      if (dicomOrigin && dicomSpacing && dicomDimensions) {
      //   console.log('═══════════════════════════════════════════════════════');
      //   console.log('🎯 [ModelStateService] DICOM SPATIAL ALIGNMENT');
      //   console.log('═══════════════════════════════════════════════════════');
      //   console.log('📋 DICOM Origin (ImagePositionPatient):', dicomOrigin);
      //   console.log('   Tag: (0020,0032) - Patient position in 3D space (mm)');
      //   console.log('   X (LR):', dicomOrigin[0].toFixed(2), 'mm');
      //   console.log('   Y (AP):', dicomOrigin[1].toFixed(2), 'mm');
      //   console.log('   Z (SI):', dicomOrigin[2].toFixed(2), 'mm');

      //   console.log('📋 DICOM Spacing (PixelSpacing + SliceThickness):', dicomSpacing);
      //   console.log('   X spacing:', dicomSpacing[0].toFixed(2), 'mm');
      //   console.log('   Y spacing:', dicomSpacing[1].toFixed(2), 'mm');
      //   console.log('   Z spacing:', dicomSpacing[2].toFixed(2), 'mm');

      //   console.log('📋 DICOM Dimensions:', dicomDimensions);
      //   console.log('   Width (X):', dicomDimensions[0], 'pixels');
      //   console.log('   Height (Y):', dicomDimensions[1], 'pixels');
      //   console.log('   Slices (Z):', dicomDimensions[2], 'slices');

      //   if (dicomOrientation) {
      //     console.log('📋 DICOM Orientation (ImageOrientationPatient):', dicomOrientation);
      //     console.log('   Tag: (0020,0037) - Image orientation cosines');
      //     console.log('   Row direction:', [dicomOrientation[0], dicomOrientation[1], dicomOrientation[2]]);
      //     console.log('   Column direction:', [dicomOrientation[3], dicomOrientation[4], dicomOrientation[5]]);
      //   }

        // Calculate DICOM volume center
        // Center = Origin + (Spacing * Dimensions / 2)
        const dicomCenter: [number, number, number] = [
          dicomOrigin[0] + (dicomSpacing[0] * dicomDimensions[0] / 2),
          dicomOrigin[1] + (dicomSpacing[1] * dicomDimensions[1] / 2),
          dicomOrigin[2] + (dicomSpacing[2] * dicomDimensions[2] / 2),
        ];

        // console.log('───────────────────────────────────────────────────────');
        // console.log('🎯 DICOM Volume Center (Calculated):', dicomCenter);
        // console.log('   X:', dicomCenter[0].toFixed(2), 'mm');
        // console.log('   Y:', dicomCenter[1].toFixed(2), 'mm');
        // console.log('   Z:', dicomCenter[2].toFixed(2), 'mm');
        // console.log('   Formula: Origin + (Spacing × Dimensions / 2)');

        // Get model's current position
        const modelPosArray = loadedModel.actor.getPosition();
        const modelPosition: [number, number, number] = [
          modelPosArray[0],
          modelPosArray[1],
          modelPosArray[2],
        ];
        // console.log('───────────────────────────────────────────────────────');
        // console.log('📍 Model Original Position:', modelPosition);
        // console.log('   X:', modelPosition[0].toFixed(2));
        // console.log('   Y:', modelPosition[1].toFixed(2));
        // console.log('   Z:', modelPosition[2].toFixed(2));

        // Show rotation and scale information
        // const modelOrientation = loadedModel.actor.getOrientation();
        // console.log('🔄 Model Orientation (Rotation):');
        // console.log('   X-axis:', modelOrientation[0].toFixed(2), '°');
        // console.log('   Y-axis:', modelOrientation[1].toFixed(2), '°');
        // console.log('   Z-axis:', modelOrientation[2].toFixed(2), '°');
        // console.log('   Note: 90° X-rotation applied for DICOM coordinate alignment');

        // const modelScale = loadedModel.actor.getScale();
        // console.log('📏 Model Scale:');
        // console.log('   X-scale:', modelScale[0].toFixed(2), 'x');
        // console.log('   Y-scale:', modelScale[1].toFixed(2), 'x');
        // console.log('   Z-scale:', modelScale[2].toFixed(2), 'x');
        // console.log('   Note: 10x default scale applied for better visibility');

        // Calculate new position by merging with DICOM center
        const newPosition: [number, number, number] = [
          modelPosition[0] + dicomCenter[0],
          modelPosition[1] + dicomCenter[1],
          modelPosition[2] + dicomCenter[2],
        ];

        // console.log('───────────────────────────────────────────────────────');
        // console.log('📍 Model New Position (Aligned to DICOM center):', newPosition);
        // console.log('   X:', newPosition[0].toFixed(2), 'mm');
        // console.log('   Y:', newPosition[1].toFixed(2), 'mm');
        // console.log('   Z:', newPosition[2].toFixed(2), 'mm');

        // console.log('───────────────────────────────────────────────────────');
        // console.log('📐 Position Delta (Offset to center):');
        // console.log('   ΔX:', (newPosition[0] - modelPosition[0]).toFixed(2), 'mm');
        // console.log('   ΔY:', (newPosition[1] - modelPosition[1]).toFixed(2), 'mm');
        // console.log('   ΔZ:', (newPosition[2] - modelPosition[2]).toFixed(2), 'mm');
        // console.log('   Magnitude:', Math.sqrt(
        //   Math.pow(newPosition[0] - modelPosition[0], 2) +
        //   Math.pow(newPosition[1] - modelPosition[1], 2) +
        //   Math.pow(newPosition[2] - modelPosition[2], 2)
        // ).toFixed(2), 'mm');
        // console.log('═══════════════════════════════════════════════════════');

        // Apply the position transformation
        loadedModel.actor.setPosition(newPosition[0], newPosition[1], newPosition[2]);

        // Store the DICOM alignment information in metadata
        loadedModel.metadata.dicomOrigin = dicomOrigin;
        loadedModel.metadata.dicomOrientation = dicomOrientation || undefined;
        loadedModel.metadata.originalPosition = modelPosition;
        loadedModel.metadata.alignedPosition = newPosition;

        // console.log('✅ [ModelStateService] Model position successfully aligned to DICOM volume center');
      } else {
        console.warn('⚠️ [ModelStateService] DICOM spatial information not available');
        if (!dicomOrigin) console.warn('⚠️ [ModelStateService] - Missing: DICOM origin');
        if (!dicomSpacing) console.warn('⚠️ [ModelStateService] - Missing: DICOM spacing');
        if (!dicomDimensions) console.warn('⚠️ [ModelStateService] - Missing: DICOM dimensions');
        console.warn('⚠️ [ModelStateService] Model will use its original position');
        console.warn('⚠️ [ModelStateService] Model may not align with DICOM images');
      }

      // console.log('🔧 [ModelStateService] Adding actor to renderer');
      vtkRenderer.addActor(loadedModel.actor);

      // console.log('🔧 [ModelStateService] Resetting camera');
      vtkRenderer.resetCamera();

      // console.log('🔧 [ModelStateService] Rendering viewport');
      viewport.render();

      // console.log('✅ [ModelStateService] Model added successfully to viewport:', viewportId);

      // Note: Model is only added to the specified 3D viewport
      // If you need the model in other viewports, load it separately for each viewport
      // console.log('═══════════════════════════════════════════════════════');
      // console.log('✅ [ModelStateService] Model added to specified 3D viewport only');
      // console.log('═══════════════════════════════════════════════════════');

    } catch (error) {
      console.error('❌ [ModelStateService] Error adding model to viewport:', error);
      console.error('❌ [ModelStateService] Error stack:', error.stack);
    }
  }

  /**
   * Remove model from viewport
   */
  public removeModelFromViewport(modelId: string, viewportId: string): boolean {
    const loadedModel = this.loadedModels.get(modelId);

    if (!loadedModel) {
      console.warn(`Model ${modelId} not found`);
      return false;
    }

    try {
      // Get all rendering engines and find the viewport
      const renderingEngines = getRenderingEngines();

      for (const engine of renderingEngines) {
        try {
          const viewport = engine.getViewport(viewportId);

          if (viewport) {
            const vtkRenderer = viewport.getRenderer();
            if (vtkRenderer) {
              vtkRenderer.removeActor(loadedModel.actor);
              viewport.render();
              console.log('🗑️ [ModelStateService] Model removed from viewport:', viewportId);
              return true;
            }
          }
        } catch (e) {
          // Viewport not in this engine, continue searching
        }
      }

      return false;
    } catch (error) {
      console.error('Error removing model from viewport:', error);
      return false;
    }
  }

  /**
   * Remove model completely (from all viewports and memory)
   */
  public removeModel(modelId: string): boolean {
    const loadedModel = this.loadedModels.get(modelId);

    if (!loadedModel) {
      console.warn(`Model ${modelId} not found`);
      return false;
    }

    console.log('🗑️ [ModelStateService] Removing model from all viewports:', modelId);

    // Remove from all viewports in all rendering engines
    const renderingEngines = getRenderingEngines();
    let removedCount = 0;

    renderingEngines.forEach(engine => {
      const viewports = engine.getViewports();

      viewports.forEach(viewport => {
        try {
          const vtkRenderer = viewport.getRenderer();
          if (vtkRenderer) {
            vtkRenderer.removeActor(loadedModel.actor);
            viewport.render();
            removedCount++;
            console.log('   🗑️ Removed from viewport:', viewport.id, '(type:', viewport.type, ')');
          }
        } catch (error) {
          console.error('   ⚠️ Error removing from viewport:', viewport.id, error.message);
        }
      });
    });

    console.log('✅ [ModelStateService] Model removed from', removedCount, 'viewports');

    // Clean up vtk objects
    loadedModel.actor.delete();
    loadedModel.mapper.delete();
    loadedModel.reader.delete();

    // Remove from map
    this.loadedModels.delete(modelId);

    this._broadcastEvent(this.EVENTS.MODEL_REMOVED, { modelId });

    return true;
  }



  /**
   * Get all loaded models
   */
  public getAllModels(): LoadedModel[] {
    return Array.from(this.loadedModels.values());
  }

  /**
   * Get model by ID
   */
  public getModel(modelId: string): LoadedModel | undefined {
    return this.loadedModels.get(modelId);
  }

  /**
   * Get models by viewport ID
   */
  public getModelsByViewport(viewportId: string): LoadedModel[] {
    return this.getAllModels().filter(
      model => model.metadata.viewportId === viewportId
    );
  }

  /**
   * Update model visibility
   */
  public setModelVisibility(modelId: string, visible: boolean): boolean {
    const loadedModel = this.loadedModels.get(modelId);

    if (!loadedModel) {
      return false;
    }

    loadedModel.metadata.visible = visible;
    loadedModel.actor.setVisibility(visible);

    // Re-render affected viewports
    if (loadedModel.metadata.viewportId) {
      const renderingEngine = getRenderingEngine('default');
      const viewport = renderingEngine?.getViewport(loadedModel.metadata.viewportId);
      viewport?.render();
    }

    this._broadcastEvent(this.EVENTS.MODEL_VISIBILITY_CHANGED, { modelId, visible });

    return true;
  }

  /**
   * Update model color
   */
  public setModelColor(modelId: string, color: [number, number, number]): boolean {
    const loadedModel = this.loadedModels.get(modelId);

    if (!loadedModel) {
      return false;
    }

    loadedModel.metadata.color = color;
    loadedModel.actor.getProperty().setColor(color[0], color[1], color[2]);

    if (loadedModel.metadata.viewportId) {
      const renderingEngine = getRenderingEngine('default');
      const viewport = renderingEngine?.getViewport(loadedModel.metadata.viewportId);
      viewport?.render();
    }

    this._broadcastEvent(this.EVENTS.MODEL_UPDATED, { modelId, property: 'color', value: color });

    return true;
  }

  /**
   * Update model opacity
   */
  public setModelOpacity(modelId: string, opacity: number): boolean {
    const loadedModel = this.loadedModels.get(modelId);

    if (!loadedModel) {
      return false;
    }

    loadedModel.metadata.opacity = opacity;
    loadedModel.actor.getProperty().setOpacity(opacity);

    if (loadedModel.metadata.viewportId) {
      const renderingEngine = getRenderingEngine('default');
      const viewport = renderingEngine?.getViewport(loadedModel.metadata.viewportId);
      viewport?.render();
    }

    this._broadcastEvent(this.EVENTS.MODEL_UPDATED, { modelId, property: 'opacity', value: opacity });

    return true;
  }

  /**
   * Clear all models
   */
  public clearAllModels(): void {
    const modelIds = Array.from(this.loadedModels.keys());

    modelIds.forEach(modelId => {
      this.removeModel(modelId);
    });

    this._broadcastEvent(this.EVENTS.MODELS_CLEARED, {});
  }

  /**
   * Helper: Check if string is a URL
   */
  private _isUrl(str: string): boolean {
    try {
      new URL(str);
      return true;
    } catch {
      return str.startsWith('http://') || str.startsWith('https://');
    }
  }

  /**
   * Helper: Extract file name from path
   */
  private _extractFileName(path: string): string {
    return path.split(/[\\/]/).pop() || path;
  }

  /**
   * Helper: Get model format from filename
   * Only OBJ format is supported
   */
  private _getModelFormat(fileName: string): ModelFormat | null {
    const ext = fileName.split('.').pop()?.toLowerCase();

    if (ext === 'obj') {
      return ModelFormat.OBJ;
    }

    return null;
  }

  /**
   * Helper: Generate unique model ID based on filename
   * Uses the filename (without extension) as the base ID
   * Adds a counter suffix if there are duplicate filenames
   */
  private _generateModelId(fileName: string): string {
    // Remove file extension and sanitize the filename
    const baseName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');

    // Check if this ID already exists
    let modelId = baseName;
    let counter = 1;

    while (this.loadedModels.has(modelId)) {
      modelId = `${baseName}_${counter}`;
      counter++;
    }

    return modelId;
  }

  /**
   * Helper: Get DICOM origin (ImagePositionPatient) from viewport
   * This reads the DICOM metadata to get the patient position in 3D space
   */
  private _getDICOMOrigin(viewport: any): [number, number, number] | null {
    try {
      // console.log('🔍 [ModelStateService] Extracting DICOM origin from viewport');

      // For Volume viewports
      if (viewport.type === 'VOLUME_3D' || viewport.type === 'volume3d') {
        // Get the volume actor
        const actors = viewport.getActors();
        if (actors && actors.length > 0) {
          const volumeActor = actors[0];
          const imageData = volumeActor?.actor?.getMapper?.()?.getInputData?.();

          if (imageData) {
            const origin = imageData.getOrigin();
            // console.log('✅ [ModelStateService] Volume origin from imageData:', origin);
            return [origin[0], origin[1], origin[2]];
          }
        }

        // Try to get from viewport properties
        const imageData = viewport.getImageData?.();
        if (imageData) {
          const origin = imageData.getOrigin();
          // console.log('✅ [ModelStateService] Volume origin from viewport.getImageData():', origin);
          return [origin[0], origin[1], origin[2]];
        }
      }

      // For Stack/Orthographic viewports - get from current image metadata
      const imageId = viewport.getCurrentImageId?.();
      if (imageId) {
        // console.log('🔍 [ModelStateService] Getting metadata for imageId:', imageId);

        // Import metaData from cornerstone
        // const { metaData } = require('@cornerstonejs/core');

        // Get imagePlaneModule which contains ImagePositionPatient
        const imagePlaneModule = metaData.get('imagePlaneModule', imageId);

        if (imagePlaneModule && imagePlaneModule.imagePositionPatient) {
          const ipp = imagePlaneModule.imagePositionPatient;
          // console.log('✅ [ModelStateService] ImagePositionPatient:', ipp);
          // console.log('📋 [ModelStateService] DICOM Tag (0020,0032) ImagePositionPatient');

          // Also get ImageOrientationPatient if available
          if (imagePlaneModule.imageOrientationPatient) {
            const iop = imagePlaneModule.imageOrientationPatient;
            // console.log('📋 [ModelStateService] ImageOrientationPatient:', iop);
            // console.log('📋 [ModelStateService] DICOM Tag (0020,0037) ImageOrientationPatient');
          }

          return [ipp[0], ipp[1], ipp[2]];
        }
      }

      // Try alternative method - get from viewport's default actor
      const defaultActor = viewport.getDefaultActor?.();
      if (defaultActor) {
        const actor = defaultActor.actor;
        if (actor) {
          const bounds = actor.getBounds();
          if (bounds) {
            // Calculate center from bounds as fallback
            const origin = [
              (bounds[0] + bounds[1]) / 2,
              (bounds[2] + bounds[3]) / 2,
              (bounds[4] + bounds[5]) / 2,
            ];
            // console.log('⚠️ [ModelStateService] Using actor bounds center as origin:', origin);
            return origin as [number, number, number];
          }
        }
      }

      console.warn('⚠️ [ModelStateService] Could not extract DICOM origin from viewport');
      console.warn('⚠️ [ModelStateService] Viewport type:', viewport.type);
      return null;
    } catch (error) {
      console.error('❌ [ModelStateService] Error getting DICOM origin:', error);
      return null;
    }
  }

  /**
   * Helper: Get DICOM orientation (ImageOrientationPatient) from viewport
   */
  private _getDICOMOrientation(viewport: any): number[] | null {
    try {
      const imageId = viewport.getCurrentImageId?.();
      if (imageId) {
        // const { metaData } = require('@cornerstonejs/core');
        const imagePlaneModule = metaData.get('imagePlaneModule', imageId);

        if (imagePlaneModule && imagePlaneModule.imageOrientationPatient) {
          return imagePlaneModule.imageOrientationPatient;
        }
      }
      return null;
    } catch (error) {
      console.error('❌ [ModelStateService] Error getting DICOM orientation:', error);
      return null;
    }
  }

  /**
   * Helper: Get DICOM spacing (pixel spacing + slice thickness) from viewport
   * Returns [xSpacing, ySpacing, zSpacing] in mm
   */
  private _getDICOMSpacing(viewport: any): [number, number, number] | null {
    try {
      // console.log('🔍 [ModelStateService] Extracting DICOM spacing from viewport');

      // For Volume viewports
      if (viewport.type === 'VOLUME_3D' || viewport.type === 'volume3d') {
        const actors = viewport.getActors();
        if (actors && actors.length > 0) {
          const volumeActor = actors[0];
          const imageData = volumeActor?.actor?.getMapper?.()?.getInputData?.();

          if (imageData) {
            const spacing = imageData.getSpacing();
            // console.log('✅ [ModelStateService] Volume spacing from imageData:', spacing);
            return [spacing[0], spacing[1], spacing[2]];
          }
        }

        // Try to get from viewport properties
        const imageData = viewport.getImageData?.();
        if (imageData) {
          const spacing = imageData.getSpacing();
          // console.log('✅ [ModelStateService] Volume spacing from viewport.getImageData():', spacing);
          return [spacing[0], spacing[1], spacing[2]];
        }
      }

      // For Stack/Orthographic viewports - get from metadata
      const imageId = viewport.getCurrentImageId?.();
      if (imageId) {
        const imagePlaneModule = metaData.get('imagePlaneModule', imageId);

        if (imagePlaneModule) {
          // rowPixelSpacing and columnPixelSpacing for X and Y
          const rowSpacing = imagePlaneModule.rowPixelSpacing || imagePlaneModule.pixelSpacing?.[0] || 1.0;
          const colSpacing = imagePlaneModule.columnPixelSpacing || imagePlaneModule.pixelSpacing?.[1] || 1.0;

          // sliceThickness for Z
          const sliceThickness = imagePlaneModule.sliceThickness || imagePlaneModule.spacingBetweenSlices || 1.0;

          // console.log('✅ [ModelStateService] Spacing from metadata:');
          // console.log('   Row spacing (X):', rowSpacing, 'mm');
          // console.log('   Column spacing (Y):', colSpacing, 'mm');
          // console.log('   Slice thickness (Z):', sliceThickness, 'mm');

          return [rowSpacing, colSpacing, sliceThickness];
        }
      }

      console.warn('⚠️ [ModelStateService] Could not extract DICOM spacing from viewport');
      return null;
    } catch (error) {
      console.error('❌ [ModelStateService] Error getting DICOM spacing:', error);
      return null;
    }
  }

  /**
   * Helper: Get DICOM dimensions (width, height, number of slices) from viewport
   * Returns [width, height, numSlices] in pixels/slices
   */
  private _getDICOMDimensions(viewport: any): [number, number, number] | null {
    try {
      // console.log('🔍 [ModelStateService] Extracting DICOM dimensions from viewport');

      // For Volume viewports
      if (viewport.type === 'VOLUME_3D' || viewport.type === 'volume3d') {
        const actors = viewport.getActors();
        if (actors && actors.length > 0) {
          const volumeActor = actors[0];
          const imageData = volumeActor?.actor?.getMapper?.()?.getInputData?.();

          if (imageData) {
            const dimensions = imageData.getDimensions();
            // console.log('✅ [ModelStateService] Volume dimensions from imageData:', dimensions);
            return [dimensions[0], dimensions[1], dimensions[2]];
          }
        }

        // Try to get from viewport properties
        const imageData = viewport.getImageData?.();
        if (imageData) {
          const dimensions = imageData.getDimensions();
          // console.log('✅ [ModelStateService] Volume dimensions from viewport.getImageData():', dimensions);
          return [dimensions[0], dimensions[1], dimensions[2]];
        }
      }

      // For Stack/Orthographic viewports - get from metadata
      const imageId = viewport.getCurrentImageId?.();
      if (imageId) {
        const imagePlaneModule = metaData.get('imagePlaneModule', imageId);

        if (imagePlaneModule) {
          const rows = imagePlaneModule.rows || 512;
          const columns = imagePlaneModule.columns || 512;

          // Try to get number of slices from viewport
          let numSlices = 1;

          // Try to get from viewport's image IDs
          const imageIds = viewport.getImageIds?.();
          if (imageIds && imageIds.length > 0) {
            numSlices = imageIds.length;
          }

          // console.log('✅ [ModelStateService] Dimensions from metadata:');
          // console.log('   Columns (width):', columns, 'pixels');
          // console.log('   Rows (height):', rows, 'pixels');
          // console.log('   Number of slices:', numSlices);

          return [columns, rows, numSlices];
        }
      }

      console.warn('⚠️ [ModelStateService] Could not extract DICOM dimensions from viewport');
      return null;
    } catch (error) {
      console.error('❌ [ModelStateService] Error getting DICOM dimensions:', error);
      return null;
    }
  }
/**
 * Set transformation matrix for a loaded model
 *
 * @param modelId - The unique identifier for the model
 * @param transform - 4x4 transformation matrix as a flat array of 16 elements (row-major order)
 *                     Can be number[] or Float32Array
 * @param length - Optional screw length in mm (used to offset model along its Y-axis)
 * @returns true if successful, false otherwise
 */
async setModelTransform(modelId: string, transform: number[] | Float32Array, length?: number): Promise<boolean> {
  try {
    const loadedModel = this.loadedModels.get(modelId);
    if (!loadedModel) {
      console.error(`❌ Model not found`);
      return false;
    }

    // Validate transform - accept both Array and Float32Array
    const isValidArray = Array.isArray(transform);
    const isValidTypedArray = transform instanceof Float32Array;

    if ((!isValidArray && !isValidTypedArray) || transform.length !== 16) {
      console.error(`❌ Invalid transform - must be Array or Float32Array with 16 elements`);
      console.error(`   Got type: ${transform?.constructor?.name}, length: ${transform?.length}`);
      return false;
    }

    console.log(`✅ Valid transform: ${transform.constructor.name}[${transform.length}]`);

    console.log('═══════════════════════════════════════════════════════');
    console.log('🔧 [ModelStateService] APPLYING TRANSFORM WITH LENGTH OFFSET');
    console.log('═══════════════════════════════════════════════════════');

    // Check if model is a generated cylinder (only apply offset for cylinders)
    const modelPath = loadedModel.metadata.fileUrl || loadedModel.metadata.filePath;
    const isCylinder = modelPath.includes('/cylinder/');

    console.log(`📦 Model type: ${isCylinder ? 'Generated Cylinder' : 'OBJ Model'}`);
    console.log(`📂 Model path: ${modelPath}`);

    // Extract the coronal (Y-axis) direction from the transform matrix (column 1 in row-major)
    const coronalX = transform[1];  // Row 0, Col 1
    const coronalY = transform[5];  // Row 1, Col 1
    const coronalZ = transform[9];  // Row 2, Col 1

    console.log(`📋 Original transform matrix (row-major):`);
    console.log(`   Row 0: [${transform[0]}, ${transform[1]}, ${transform[2]}, ${transform[3]}]`);
    console.log(`   Row 1: [${transform[4]}, ${transform[5]}, ${transform[6]}, ${transform[7]}]`);
    console.log(`   Row 2: [${transform[8]}, ${transform[9]}, ${transform[10]}, ${transform[11]}]`);
    console.log(`   Row 3: [${transform[12]}, ${transform[13]}, ${transform[14]}, ${transform[15]}]`);

    console.log(`📐 Coronal (Y-axis) direction: [${coronalX}, ${coronalY}, ${coronalZ}]`);

    // Apply length offset if provided AND model is a generated cylinder
    let adjustedTransform = [...transform];

    if (isCylinder && length && length > 0) {
      // Move BACKWARD along the coronal (Y) direction by -length/2
      // This positions the screw so its CAP (top) is at the crosshair center
      //
      // Screw geometry in local space:
      //   - Bottom (tip): y = -length/2
      //   - Center (model origin): y = 0
      //   - Top (cap): y = +length/2
      //
      // To align CAP to crosshair:
      //   - Crosshair position = transform[3,7,11]
      //   - Model origin must be at: crosshair - length/2 * coronal
      //   - Then screw top (y=+length/2) will be at crosshair
      const offset = -length / 2;  // NEGATIVE to move model origin backward

      console.log(`📏 Screw length: ${length}mm`);
      console.log(`📏 Applying offset: ${offset}mm along coronal direction (SCREW CAP aligned to crosshair)`);

      // Original translation (column 3 in row-major)
      const originalTransX = transform[3];
      const originalTransY = transform[7];
      const originalTransZ = transform[11];

      console.log(`📍 Original translation (crosshair position): [${originalTransX}, ${originalTransY}, ${originalTransZ}]`);

      // Adjust translation by moving BACKWARD along coronal direction
      // This moves model origin down, so the top (cap) aligns with crosshair
      adjustedTransform[3] = originalTransX + (coronalX * offset);
      adjustedTransform[7] = originalTransY + (coronalY * offset);
      adjustedTransform[11] = originalTransZ + (coronalZ * offset);

      console.log(`📍 Adjusted translation (model origin): [${adjustedTransform[3]}, ${adjustedTransform[7]}, ${adjustedTransform[11]}]`);
      console.log(`📐 Offset vector: [${coronalX * offset}, ${coronalY * offset}, ${coronalZ * offset}]`);
      console.log(`✅ Screw cap (top) is now at crosshair position`);
    } else {
      if (!isCylinder) {
        console.log(`ℹ️ No offset applied - OBJ model (not a generated cylinder)`);
      } else if (!length || length <= 0) {
        console.log(`ℹ️ No offset applied - length not provided (length=${length})`);
      }
    }

    // Convert row-major to column-major and create Float32Array
    const finalTransform = new Float32Array([
      adjustedTransform[0], adjustedTransform[4], adjustedTransform[8],  adjustedTransform[12],
      adjustedTransform[1], adjustedTransform[5], adjustedTransform[9],  adjustedTransform[13],
      adjustedTransform[2], adjustedTransform[6], adjustedTransform[10], adjustedTransform[14],
      adjustedTransform[3], adjustedTransform[7], adjustedTransform[11], adjustedTransform[15]
    ]);

    console.log('───────────────────────────────────────────────────────');
    console.log('✅ Final transform matrix prepared (column-major for VTK)');
    console.log('═══════════════════════════════════════════════════════');


    // // Convert row-major to column-major
    // const jsonTransform = [
    //   transform[0], transform[4], transform[8],  transform[12],
    //   transform[1], transform[5], transform[9],  transform[13],
    //   transform[2], transform[6], transform[10], transform[14],
    //   transform[3], transform[7], transform[11], transform[15]
    // ];


    // // Create 10x scale matrix
    // // const scale10x = [
    // //   10, 0, 0, 0,
    // //   0, 10, 0, 0,
    // //   0, 0, 10, 0,
    // //   0, 0, 0, 1
    // // ];


    // // Compose: Final = JSON × Scale(10x)
    // const finalTransform = new Float32Array(16);
    // for (let row = 0; row < 4; row++) {
    //   for (let col = 0; col < 4; col++) {
    //     let sum = 0;
    //     for (let k = 0; k < 4; k++) {
    //       sum += jsonTransform[row + k * 4] * scale10x[k + col * 4];
    //     }
    //     finalTransform[row + col * 4] = sum;
    //   }
    // }

    // ═════════════════════════════════════════════════════════
    // PART 1: Transform ACTOR (GPU-side, for 3D display)
    // ═════════════════════════════════════════════════════════
    loadedModel.actor.setUserMatrix(finalTransform);
    loadedModel.actor.setPosition(0, 0, 0);
    loadedModel.actor.setScale(1, 1, 1);
    loadedModel.actor.setOrientation(0, 0, 0);

    console.log('✅ Actor transformed (GPU rendering)');

    // ═════════════════════════════════════════════════════════
    // PART 2: Transform POLYDATA (CPU-side, for plane cutters)
    // ═════════════════════════════════════════════════════════

    console.log('🔪 Transforming polyData for plane cutters...');

    // Get ORIGINAL polyData from reader
    const originalPolyData = loadedModel.reader.getOutputData();

    // Create VTK transform object with same matrix
    const vtkTransformObj = vtkTransform.newInstance();
    vtkTransformObj.setMatrix(finalTransform);

    // Create new transformed polyData
    const transformedPolyData = vtkPolyData.newInstance();
    transformedPolyData.shallowCopy(originalPolyData);

    // Transform ALL points
    const points = originalPolyData.getPoints();
    const numPoints = points.getNumberOfPoints();
    const transformedPoints = new Float32Array(numPoints * 3);

    for (let i = 0; i < numPoints; i++) {
      const point = points.getPoint(i);
      const transformedPoint = new Float32Array([0, 0, 0]);
      vtkTransformObj.transformPoint(point as any, transformedPoint as any);

      const idx = i * 3;
      transformedPoints[idx] = transformedPoint[0];
      transformedPoints[idx + 1] = transformedPoint[1];
      transformedPoints[idx + 2] = transformedPoint[2];
    }

    // Update polyData with transformed coordinates
    transformedPolyData.getPoints().setData(transformedPoints, 3);

    // Store transformed polyData
    loadedModel.polyData = transformedPolyData;

    console.log(`✅ Transformed ${numPoints} points`);
    console.log('✅ PolyData transformed and stored');

    // ═════════════════════════════════════════════════════════
    // PART 3: Broadcast MODEL_UPDATED event
    // PlaneCutterService will listen and update all cutters
    // ═════════════════════════════════════════════════════════

    this._broadcastEvent(this.EVENTS.MODEL_UPDATED, { modelId, property: 'transform' });

    console.log('✅ Model transform complete!');
    console.log('✅ MODEL_UPDATED event broadcast - PlaneCutterService will update cutters');
    return true;


    // // Trigger re-render
    // const renderingEngines = getRenderingEngines();
    // for (const engine of renderingEngines) {
    //   engine.render();
    // }

    // return true;

  } catch (error) {
    console.error('❌ Error setting transform:', error);
    console.error('Stack:', error.stack);
    return false;
  }
}

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREW INTERACTION METHODS
  // Methods for picking and translating screws on MPR planes
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if a model is a screw (not a cap)
   *
   * A model is considered a "screw" if:
   * 1. It has a user transform matrix (was positioned via setModelTransform)
   * 2. Its name does NOT contain 'cap' (caps are separate models)
   *
   * OR if it's a generated cylinder:
   * - Path contains '/cylinder/'
   */
  private _isScrewModel(model: LoadedModel): boolean {
    const path = model.metadata.fileUrl || model.metadata.filePath || '';
    const name = model.metadata.name || '';
    const modelId = model.metadata.id || '';

    // Exclude cap models
    const isCap = name.toLowerCase().includes('cap') || modelId.toLowerCase().includes('cap');
    if (isCap) return false;

    // Method 1: Generated cylinder from API
    const isCylinder = path.includes('/cylinder/');
    if (isCylinder) return true;

    // Method 2: Any model with a user transform matrix (was positioned)
    const hasUserMatrix = model.actor?.getUserMatrix?.() !== null;
    if (hasUserMatrix) {
      // Additional check: model should have polyData (it's a real 3D model)
      const hasPolyData = !!model.polyData;
      return hasPolyData;
    }

    return false;
  }

  /**
   * Check if a model is a screw cap
   */
  private _isCapModel(model: LoadedModel): boolean {
    const name = model.metadata.name || '';
    return name.toLowerCase().includes('cap');
  }

  /**
   * Get screw center position from transform matrix
   *
   * IMPORTANT: The transform matrix position [12,13,14] is the MODEL ORIGIN position.
   * For screws with length offset applied (via setModelTransform), the model origin
   * was shifted by -length/2 along the Y-axis so that the CAP aligns with crosshair.
   *
   * To get the TRUE SCREW CENTER, we need to offset from model origin by +length/2
   * along the screw's Y-axis direction.
   */
  private _getScrewCenter(model: LoadedModel): [number, number, number] {
    const matrix = model.actor.getUserMatrix();
    if (matrix) {
      // Column-major format: translation at [12], [13], [14]
      // This is the MODEL ORIGIN (which is offset from screw center for cylinders)
      const modelOrigin: [number, number, number] = [matrix[12], matrix[13], matrix[14]];

      // Get the screw's Y-axis direction (screw length direction)
      // Column-major: Y-axis is column 1 -> [4], [5], [6]
      const yAxisX = matrix[4];
      const yAxisY = matrix[5];
      const yAxisZ = matrix[6];

      // Get screw dimensions to calculate offset
      const dimensions = this._getScrewDimensions(model);

      // Check if this is a cylinder (has length offset applied)
      const modelPath = model.metadata.fileUrl || model.metadata.filePath || '';
      const isCylinder = modelPath.includes('/cylinder/');

      if (isCylinder && dimensions.length > 0) {
        // For cylinders: screw center = model origin + (length/2) * Y-axis
        // Because model origin was shifted to align CAP with crosshair
        const offset = dimensions.length / 2;
        return [
          modelOrigin[0] + yAxisX * offset,
          modelOrigin[1] + yAxisY * offset,
          modelOrigin[2] + yAxisZ * offset
        ];
      }

      // For non-cylinder models, model origin IS the center
      return modelOrigin;
    }

    // Fallback: calculate from polyData bounds
    const bounds = model.polyData?.getBounds();
    if (bounds) {
      return [
        (bounds[0] + bounds[1]) / 2,
        (bounds[2] + bounds[3]) / 2,
        (bounds[4] + bounds[5]) / 2
      ];
    }

    return [0, 0, 0];
  }

  /**
   * Get screw axis direction from transform matrix
   * Returns the Y-axis (coronal direction) of the screw
   */
  private _getScrewAxisDirection(model: LoadedModel): [number, number, number] {
    const matrix = model.actor.getUserMatrix();
    if (matrix) {
      // Column-major: Y-axis (screw length direction) is column 1
      // [4], [5], [6] in column-major (which is row 1 in the 4x4)
      return [matrix[4], matrix[5], matrix[6]];
    }
    return [0, 1, 0]; // Default: Y-up
  }

  /**
   * Extract screw dimensions from model path, metadata, or geometry
   */
  private _getScrewDimensions(model: LoadedModel): { length: number; radius: number } {
    const path = model.metadata.fileUrl || model.metadata.filePath || '';

    // Method 1: Parse from URL like /api/planning/model/cylinder/3.5/40
    const match = path.match(/cylinder\/([0-9.]+)\/([0-9.]+)/);
    if (match) {
      return {
        radius: parseFloat(match[1]),
        length: parseFloat(match[2])
      };
    }

    // Method 2: Calculate from polyData bounds (for OBJ models)
    if (model.polyData) {
      const bounds = model.polyData.getBounds();
      if (bounds) {
        // bounds = [xMin, xMax, yMin, yMax, zMin, zMax]
        const xSize = bounds[1] - bounds[0];
        const ySize = bounds[3] - bounds[2];
        const zSize = bounds[5] - bounds[4];

        // Assume screw is oriented along Y-axis (longest dimension is length)
        // The two shorter dimensions give us the radius
        const sizes = [xSize, ySize, zSize].sort((a, b) => b - a);
        const length = sizes[0]; // Longest dimension
        const radius = Math.min(sizes[1], sizes[2]) / 2; // Half of shorter dimension

        console.log(`   📐 Calculated dimensions from polyData: radius=${radius.toFixed(2)}mm, length=${length.toFixed(2)}mm`);
        return { radius, length };
      }
    }

    // Default values (typical pedicle screw)
    console.log(`   ⚠️ Using default dimensions: radius=3.5mm, length=40mm`);
    return { radius: 3.5, length: 40 };
  }

  /**
   * Get all screw models (excluding caps)
   */
  public getAllScrewModels(): Map<string, LoadedModel> {
    const screwModels = new Map<string, LoadedModel>();

    for (const [id, model] of this.loadedModels) {
      if (this._isScrewModel(model)) {
        screwModels.set(id, model);
      }
    }

    return screwModels;
  }

  /**
   * Find the nearest screw to a world position
   * @param worldPoint - Click position in world coordinates [x, y, z]
   * @param maxDistance - Maximum detection distance in mm (default: 20mm)
   * @returns ScrewPickResult or null if no screw found
   */
  public findNearestScrew(
    worldPoint: [number, number, number],
    maxDistance: number = 20
  ): ScrewPickResult | null {

    let nearestResult: ScrewPickResult | null = null;
    let minDistance = Infinity;

    console.log(`🎯 [ModelStateService] Finding screw near point: [${worldPoint.map(v => v.toFixed(2)).join(', ')}]`);
    console.log(`   📦 Total loaded models: ${this.loadedModels.size}`);

    // Debug: List all models
    for (const [modelId, model] of this.loadedModels) {
      const path = model.metadata.fileUrl || model.metadata.filePath || '';
      const name = model.metadata.name || '';
      const isCylinder = path.includes('/cylinder/');
      const isCap = name.toLowerCase().includes('cap');
      const isScrew = isCylinder && !isCap;

      console.log(`   - Model: ${modelId}`);
      console.log(`     name: ${name}, path: ${path}`);
      console.log(`     isCylinder: ${isCylinder}, isCap: ${isCap}, isScrew: ${isScrew}`);

      const matrix = model.actor?.getUserMatrix?.();
      if (matrix) {
        console.log(`     position: [${matrix[12]?.toFixed(2)}, ${matrix[13]?.toFixed(2)}, ${matrix[14]?.toFixed(2)}]`);
      } else {
        console.log(`     ⚠️ No user matrix available`);
      }
    }

    for (const [modelId, model] of this.loadedModels) {
      // Skip non-screw models
      if (!this._isScrewModel(model)) continue;

      const screwCenter = this._getScrewCenter(model);
      const screwAxis = this._getScrewAxisDirection(model);
      const dimensions = this._getScrewDimensions(model);

      // Calculate distance from point to screw axis (cylinder distance)
      const distance = this._distanceToScrewAxis(
        worldPoint,
        screwCenter,
        screwAxis,
        dimensions.length
      );

      console.log(`   📍 Screw ${model.metadata.name}: distance = ${distance.toFixed(2)}mm`);

      if (distance < minDistance && distance < maxDistance) {
        minDistance = distance;

        // Determine which part of the screw was clicked
        const part = this._determineScrewPart(
          worldPoint,
          screwCenter,
          screwAxis,
          dimensions.length
        );

        nearestResult = {
          modelId,
          screwLabel: model.metadata.name || modelId,
          part,
          worldPosition: worldPoint,
          distance,
          screwLength: dimensions.length,
          screwRadius: dimensions.radius
        };
      }
    }

    if (nearestResult) {
      console.log(`✅ Found screw: ${nearestResult.screwLabel} (${nearestResult.part}), distance: ${nearestResult.distance.toFixed(2)}mm`);
    } else {
      console.log(`❌ No screw found within ${maxDistance}mm`);
    }

    return nearestResult;
  }

  /**
   * Calculate distance from a point to a screw axis (treating screw as cylinder)
   */
  private _distanceToScrewAxis(
    point: [number, number, number],
    screwCenter: [number, number, number],
    screwAxis: [number, number, number],
    screwLength: number
  ): number {
    // Vector from screw center to point
    const toPoint = [
      point[0] - screwCenter[0],
      point[1] - screwCenter[1],
      point[2] - screwCenter[2]
    ];

    // Project onto screw axis
    const projection =
      toPoint[0] * screwAxis[0] +
      toPoint[1] * screwAxis[1] +
      toPoint[2] * screwAxis[2];

    // Check if projection is within screw length bounds (with some margin)
    const halfLength = screwLength / 2;
    const margin = 10; // 10mm extra margin for cap

    if (projection < -halfLength - margin || projection > halfLength + margin) {
      return Infinity; // Point is outside screw bounds
    }

    // Calculate perpendicular distance to axis
    const closestOnAxis = [
      screwCenter[0] + projection * screwAxis[0],
      screwCenter[1] + projection * screwAxis[1],
      screwCenter[2] + projection * screwAxis[2]
    ];

    const perpDistance = Math.sqrt(
      Math.pow(point[0] - closestOnAxis[0], 2) +
      Math.pow(point[1] - closestOnAxis[1], 2) +
      Math.pow(point[2] - closestOnAxis[2], 2)
    );

    return perpDistance;
  }

  /**
   * Check if a point is INSIDE a screw cylinder (inside/outside test)
   * This is a strict geometric test that checks:
   * 1. The point's perpendicular distance to the screw axis is less than the radius
   * 2. The point's projection along the axis is within the screw length bounds
   *
   * @param point - World coordinate to test [x, y, z]
   * @param screwCenter - Center of the screw in world coordinates
   * @param screwAxis - Normalized direction vector of the screw axis
   * @param screwLength - Length of the screw in mm
   * @param screwRadius - Radius of the screw in mm
   * @returns Object with isInside flag and detailed information
   */
  public isPointInsideScrew(
    point: [number, number, number],
    screwCenter: [number, number, number],
    screwAxis: [number, number, number],
    screwLength: number,
    screwRadius: number
  ): { isInside: boolean; perpDistance: number; axialPosition: number; reason?: string } {
    // Vector from screw center to point
    const toPoint = [
      point[0] - screwCenter[0],
      point[1] - screwCenter[1],
      point[2] - screwCenter[2]
    ];

    // Project onto screw axis to get axial position
    // Positive = towards cap, Negative = towards tip
    const axialPosition =
      toPoint[0] * screwAxis[0] +
      toPoint[1] * screwAxis[1] +
      toPoint[2] * screwAxis[2];

    // Calculate closest point on axis
    const closestOnAxis = [
      screwCenter[0] + axialPosition * screwAxis[0],
      screwCenter[1] + axialPosition * screwAxis[1],
      screwCenter[2] + axialPosition * screwAxis[2]
    ];

    // Calculate perpendicular distance to axis
    const perpDistance = Math.sqrt(
      Math.pow(point[0] - closestOnAxis[0], 2) +
      Math.pow(point[1] - closestOnAxis[1], 2) +
      Math.pow(point[2] - closestOnAxis[2], 2)
    );

    // Check bounds
    const halfLength = screwLength / 2;

    // Test 1: Is point within screw length bounds (along axis)?
    if (axialPosition < -halfLength || axialPosition > halfLength) {
      return {
        isInside: false,
        perpDistance,
        axialPosition,
        reason: `Outside axial bounds: position=${axialPosition.toFixed(2)}, bounds=[-${halfLength.toFixed(2)}, ${halfLength.toFixed(2)}]`
      };
    }

    // Test 2: Is point within screw radius (perpendicular to axis)?
    if (perpDistance > screwRadius) {
      return {
        isInside: false,
        perpDistance,
        axialPosition,
        reason: `Outside radius: perpDistance=${perpDistance.toFixed(2)}, radius=${screwRadius.toFixed(2)}`
      };
    }

    // Point is inside the screw cylinder!
    return {
      isInside: true,
      perpDistance,
      axialPosition
    };
  }

  /**
   * Find if a point is inside ANY screw and return the screw info
   * This is the main entry point for inside/outside testing
   *
   * @param worldPoint - Click position in world coordinates [x, y, z]
   * @returns ScrewPickResult with isInside=true if inside a screw, null otherwise
   */
  public findScrewAtPoint(worldPoint: [number, number, number]): ScrewPickResult | null {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║          🎯 SCREW INSIDE/OUTSIDE TEST - MOUSE DOWN                ║');
    console.log('╠═══════════════════════════════════════════════════════════════════╣');
    console.log(`║  Click Point: [${worldPoint.map(v => v.toFixed(2).padStart(8)).join(', ')}]  ║`);
    console.log('╚═══════════════════════════════════════════════════════════════════╝');

    // Count screws for summary
    const screwModels = Array.from(this.loadedModels.entries()).filter(
      ([_, model]) => this._isScrewModel(model)
    );

    console.log(`📦 Found ${screwModels.length} screw model(s) to test against`);
    console.log(`📦 Total loaded models: ${this.loadedModels.size}`);

    // List ALL models for debugging
    if (this.loadedModels.size > 0) {
      console.log('📋 All loaded models:');
      for (const [modelId, model] of this.loadedModels) {
        const path = model.metadata.fileUrl || model.metadata.filePath || '';
        const name = model.metadata.name || '';
        const isCylinder = path.includes('/cylinder/');
        const isCap = name.toLowerCase().includes('cap');
        const isScrew = this._isScrewModel(model);

        const matrix = model.actor?.getUserMatrix?.();
        const pos = matrix ? `[${matrix[12]?.toFixed(1)}, ${matrix[13]?.toFixed(1)}, ${matrix[14]?.toFixed(1)}]` : 'no matrix';

        console.log(`   - ${modelId}: isScrew=${isScrew}, isCylinder=${isCylinder}, isCap=${isCap}, pos=${pos}`);
      }
    }
    console.log('');

    for (const [modelId, model] of this.loadedModels) {
      // Skip non-screw models
      if (!this._isScrewModel(model)) continue;

      const screwCenter = this._getScrewCenter(model);
      const screwAxis = this._getScrewAxisDirection(model);
      const dimensions = this._getScrewDimensions(model);

      // Get model origin for debugging
      const matrix = model.actor.getUserMatrix();
      const modelOrigin = matrix ? [matrix[12], matrix[13], matrix[14]] : [0, 0, 0];

      console.log(`┌─────────────────────────────────────────────────────────────────┐`);
      console.log(`│ 📍 Testing: ${(model.metadata.name || modelId).padEnd(50)} │`);
      console.log(`├─────────────────────────────────────────────────────────────────┤`);
      console.log(`│  Model Origin:  [${modelOrigin.map(v => v.toFixed(2).padStart(8)).join(', ')}]       │`);
      console.log(`│  Screw Center:  [${screwCenter.map(v => v.toFixed(2).padStart(8)).join(', ')}]       │`);
      console.log(`│  Click Point:   [${worldPoint.map(v => v.toFixed(2).padStart(8)).join(', ')}]       │`);
      console.log(`│  Screw Axis:    [${screwAxis.map(v => v.toFixed(3).padStart(7)).join(', ')}]          │`);
      console.log(`│  Radius: ${dimensions.radius.toFixed(1).padStart(5)}mm   Length: ${dimensions.length.toFixed(1).padStart(5)}mm                     │`);

      // Perform inside/outside test
      const result = this.isPointInsideScrew(
        worldPoint,
        screwCenter,
        screwAxis,
        dimensions.length,
        dimensions.radius
      );

      console.log(`├─────────────────────────────────────────────────────────────────┤`);
      console.log(`│  Perpendicular Distance: ${result.perpDistance.toFixed(2).padStart(8)}mm (must be < ${dimensions.radius.toFixed(1)}mm)  │`);
      console.log(`│  Axial Position:         ${result.axialPosition.toFixed(2).padStart(8)}mm (must be in [-${(dimensions.length/2).toFixed(1)}, ${(dimensions.length/2).toFixed(1)}]) │`);

      if (result.isInside) {
        // Determine which part of the screw (cap, body, or tip)
        const part = this._determineScrewPart(
          worldPoint,
          screwCenter,
          screwAxis,
          dimensions.length
        );

        console.log(`├─────────────────────────────────────────────────────────────────┤`);
        console.log(`│  ✅✅✅ RESULT: INSIDE THE SCREW! ✅✅✅                        │`);
        console.log(`│  Part clicked: ${part.toUpperCase().padEnd(48)} │`);
        console.log(`└─────────────────────────────────────────────────────────────────┘`);
        console.log('');
        console.log('╔═══════════════════════════════════════════════════════════════════╗');
        console.log('║  ✅ CHECK INSIDE A SCREW - CAN DRAG                               ║');
        console.log(`║  Screw: ${(model.metadata.name || modelId).padEnd(56)} ║`);
        console.log('╚═══════════════════════════════════════════════════════════════════╝');
        console.log('');

        return {
          modelId,
          screwLabel: model.metadata.name || modelId,
          part,
          worldPosition: worldPoint,
          distance: result.perpDistance,
          screwLength: dimensions.length,
          screwRadius: dimensions.radius
        };
      } else {
        console.log(`├─────────────────────────────────────────────────────────────────┤`);
        console.log(`│  ❌ RESULT: OUTSIDE - ${result.reason?.substring(0, 42).padEnd(42)} │`);
        console.log(`└─────────────────────────────────────────────────────────────────┘`);
        console.log('');
      }
    }

    console.log('╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║  ❌ CLICK IS OUTSIDE ALL SCREWS - CANNOT DRAG                     ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝');
    console.log('');

    return null;
  }

  /**
   * Determine which part of the screw was clicked (cap, body, or tip)
   */
  private _determineScrewPart(
    worldPoint: [number, number, number],
    screwCenter: [number, number, number],
    screwAxis: [number, number, number],
    screwLength: number
  ): 'cap' | 'body' | 'tip' {
    // Vector from screw center to click point
    const toPoint = [
      worldPoint[0] - screwCenter[0],
      worldPoint[1] - screwCenter[1],
      worldPoint[2] - screwCenter[2]
    ];

    // Project onto screw axis to get position along screw
    const projection =
      toPoint[0] * screwAxis[0] +
      toPoint[1] * screwAxis[1] +
      toPoint[2] * screwAxis[2];

    const halfLength = screwLength / 2;
    const normalizedPosition = (projection + halfLength) / screwLength; // 0 = tip, 1 = cap

    if (normalizedPosition > 0.75) {
      return 'cap';
    } else if (normalizedPosition < 0.25) {
      return 'tip';
    } else {
      return 'body';
    }
  }

  /**
   * Translate a screw by a delta vector (for drag operations)
   * This also moves the associated cap model
   * @param modelId - Screw model ID
   * @param delta - Translation delta in world coordinates [dx, dy, dz]
   * @returns true if successful
   */
  public translateScrew(modelId: string, delta: [number, number, number]): boolean {
    const model = this.loadedModels.get(modelId);
    if (!model) {
      console.error(`❌ Model not found: ${modelId}`);
      return false;
    }

    console.log(`🔄 [ModelStateService] Translating screw ${modelId} by [${delta.map(v => v.toFixed(2)).join(', ')}]`);

    // Get current transform
    const currentMatrix = model.actor.getUserMatrix();
    if (!currentMatrix) {
      console.error(`❌ No transform matrix for model: ${modelId}`);
      return false;
    }

    // Create new matrix with updated translation (column-major: [12], [13], [14])
    const newMatrix = new Float32Array(currentMatrix);
    newMatrix[12] += delta[0];
    newMatrix[13] += delta[1];
    newMatrix[14] += delta[2];

    // Apply to actor
    model.actor.setUserMatrix(newMatrix);

    // Update polyData for plane cutters
    this._updatePolyDataWithTransform(model, newMatrix);

    // Also translate the cap if it exists
    const capId = `${modelId}-Cap`;
    const capModel = this.loadedModels.get(capId);
    if (capModel) {
      const capMatrix = capModel.actor.getUserMatrix();
      if (capMatrix) {
        const newCapMatrix = new Float32Array(capMatrix);
        newCapMatrix[12] += delta[0];
        newCapMatrix[13] += delta[1];
        newCapMatrix[14] += delta[2];
        capModel.actor.setUserMatrix(newCapMatrix);
        this._updatePolyDataWithTransform(capModel, newCapMatrix);
      }
    }

    // Broadcast update event for PlaneCutterService
    this._broadcastEvent(this.EVENTS.MODEL_UPDATED, {
      modelId,
      property: 'position',
      delta
    });

    // Trigger re-render
    const renderingEngines = getRenderingEngines();
    for (const engine of renderingEngines) {
      engine.render();
    }

    return true;
  }

  /**
   * Update polyData transform for plane cutters (internal helper)
   */
  private _updatePolyDataWithTransform(model: LoadedModel, newMatrix: Float32Array): void {
    if (!model.reader || !model.polyData) return;

    // Get original polyData from reader
    const originalPolyData = model.reader.getOutputData();
    if (!originalPolyData) return;

    // Create VTK transform
    const vtkTransformObj = vtkTransform.newInstance();
    vtkTransformObj.setMatrix(newMatrix);

    // Transform all points
    const points = originalPolyData.getPoints();
    const numPoints = points.getNumberOfPoints();
    const transformedPoints = new Float32Array(numPoints * 3);

    for (let i = 0; i < numPoints; i++) {
      const point = points.getPoint(i);
      const transformedPoint: [number, number, number] = [0, 0, 0];
      vtkTransformObj.transformPoint(point, transformedPoint);

      const idx = i * 3;
      transformedPoints[idx] = transformedPoint[0];
      transformedPoints[idx + 1] = transformedPoint[1];
      transformedPoints[idx + 2] = transformedPoint[2];
    }

    // Update polyData
    model.polyData.getPoints().setData(transformedPoints, 3);
  }

  /**
   * Get screw transform matrix (row-major format for external use)
   */
  public getScrewTransform(modelId: string): number[] | null {
    const model = this.loadedModels.get(modelId);
    if (!model) return null;

    const matrix = model.actor.getUserMatrix();
    if (!matrix) return null;

    // Convert column-major to row-major
    return [
      matrix[0], matrix[4], matrix[8],  matrix[12],
      matrix[1], matrix[5], matrix[9],  matrix[13],
      matrix[2], matrix[6], matrix[10], matrix[14],
      matrix[3], matrix[7], matrix[11], matrix[15]
    ];
  }

  /**
   * Project a world delta vector onto a viewport plane
   * Removes the component along the plane normal
   * @param delta - World delta vector [dx, dy, dz]
   * @param planeNormal - Viewport plane normal [nx, ny, nz]
   * @returns Projected delta on the plane
   */
  public projectDeltaOntoPlane(
    delta: [number, number, number],
    planeNormal: [number, number, number]
  ): [number, number, number] {
    // Project: delta - (delta · normal) * normal
    const dot =
      delta[0] * planeNormal[0] +
      delta[1] * planeNormal[1] +
      delta[2] * planeNormal[2];

    return [
      delta[0] - dot * planeNormal[0],
      delta[1] - dot * planeNormal[1],
      delta[2] - dot * planeNormal[2]
    ];
  }
}

/**
 * Result of screw picking operation
 */
export interface ScrewPickResult {
  modelId: string;
  screwLabel: string;
  part: 'cap' | 'body' | 'tip';
  worldPosition: [number, number, number];
  distance: number;
  screwLength: number;
  screwRadius: number;
}

export default ModelStateService;
