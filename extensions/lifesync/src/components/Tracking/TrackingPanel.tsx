/**
 * PanelTracking - Panel for tracking system control and monitoring (Phase 4: Enhanced, Simplified UI)
 *
 * This panel provides controls for:
 * - Selecting pre-configured tracking configurations (simplified workflow)
 * - Viewing tracking status and quality metrics
 * - Starting/stopping tracking sessions
 * - Patient reference status monitoring (Phase 4)
 * - Real-time tool coordinates display (Phase 4)
 * - Coordinate system toggle (tracker vs PR) (Phase 4)
 * - Navigation control (start/stop)
 * - Navigation mode switching (camera-follow vs instrument-projection)
 *
 * SIMPLIFIED UI:
 * - Tracking mode (simulation/hardware) is now controlled by the selected configuration
 * - Users can only select from pre-saved configurations (no manual mode switching)
 * - Configuration management is done through the TrackingConfigDialog
 */

import React from 'react';
import { useSystem } from '@ohif/core';
import TrackingConfigDialog from './TrackingConfigDialog';

// Extend Window interface for NavigationController
declare global {
  interface Window {
    __navigationController?: any;
  }
}

// create a new interface for our 3d instrument models
interface InstrumentModel3D {
  tool_id: string;              // Tool identifier (e.g., "DR-VR06-A33")
  model_id: string;             // Model ID in modelStateService
  loaded: boolean;              // Whether model is successfully loaded
  visible: boolean;             // Current visibility state
  lastUpdateTime: number;       // Timestamp of last transform update (for throttling)
  color?: [number, number, number]; // Color for visibility state changes
}

interface TrackingConfig {
  version: string;
  tracking_mode: {
    current: string;
    type: string;
    options: string[];
  };
  active_tools: {
    [toolKey: string]: {
      asset_id: string;
      enabled: boolean;
      required?: boolean;
      description?: string;
    };
  };
  quality_thresholds: {
    min_quality_score: number;
  };
  patient_reference?: {
    asset_id: string;
    name: string;
    tool_id: string;
    movement_threshold_mm: number;
  };
  coordinate_output?: {
    primary: string;
    include_tracker_space: boolean;
    include_pr_space: boolean;
  };
}

interface TrackingStatus {
  connected: boolean;
  mode: string;
  tools: {
    [toolId: string]: {
      visible: boolean;
      quality_score: number;
      position: [number, number, number];
    };
  };
}

// Phase 4: Patient Reference Status
interface PatientReferenceStatus {
  id: string;
  name: string | null;  // Phase 4: Human-readable name from proto
  visible: boolean;
  quality: number;
  moved: boolean;
  movement_mm: number;
}

// Phase 4: Tool Tracking Data
interface ToolTrackingData {
  tool_name?: string;
  visible: boolean;
  quality: string;
  quality_score: number;
  is_patient_reference: boolean;
  
  // Quaternion (w, x, y, z) - Better for tracking rotation
  quaternion?: [number, number, number, number];
  
  // Delta (frame-to-frame changes)
  delta_position_mm?: number;
  delta_rotation_deg?: number;
  
  // ROM file information
  rom_file?: string;
  
  coordinates: {
    tracker: {
      position_mm: [number, number, number];
      rotation_deg: [number, number, number];
    };
    patient_reference: {
      position_mm: [number, number, number];
      rotation_deg: [number, number, number];
    };
  };
}

// Phase 4: Real-time Tracking Frame
interface TrackingFrame {
  type: string;
  patient_reference: PatientReferenceStatus;
  tools: {
    [toolId: string]: ToolTrackingData;
  };
  timestamp: string;
  frame_number: number;
}

function PanelTracking() {
  const { servicesManager, commandsManager } = useSystem();
  const [config, setConfig] = React.useState<TrackingConfig | null>(null);
  const [status, setStatus] = React.useState<TrackingStatus | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Phase 4: Real-time tracking state
  const [trackingFrame, setTrackingFrame] = React.useState<TrackingFrame | null>(null);
  
  // Dictionary: tool_id → InstrumentModel3D (for 3D model tracking)
  const instrumentModelsRef = React.useRef<Map<string, InstrumentModel3D>>(new Map());
  const coordinateSystem: 'tracker' | 'patient_reference' = 'patient_reference';
  const [alerts, setAlerts] = React.useState<Array<{id: string; message: string; severity: string; timestamp: string}>>([]);

  // Navigation state
  const [isNavigating, setIsNavigating] = React.useState(false);

  // Selected tracking mode for navigation (simulation or hardware)
  const [selectedMode, setSelectedMode] = React.useState<'simulation' | 'hardware'>('simulation');

  // Navigation mode is fixed to instrument projection for instrument tracking
  const navigationMode: 'instrument-projection' = 'instrument-projection';
  const enableOrientation: boolean = true;

  // Selected tool for visualization
  const [selectedToolId, setSelectedToolId] = React.useState<string | null>(null);

  // Registration matrices state
  const identityMatrix = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ];

  // we have already registered it for development , let fix it for current development mode
  // const [prToDicomMatrix, setPrToDicomMatrix] = React.useState<number[][]>([
  //   [-0.9967, -0.0487, 0.0647, -17.2],
  //   [0.00471, 0.7623, 0.6403, 187.5],
  //   [-0.0811, 0.6454, -0.7593, 62.0],
  //   [0.0000, 0.0000, 0.0000, 1.0000]



  // ]);
  const [prToDicomMatrix, setPrToDicomMatrix] = React.useState<number[][]>([
    [-0.9814, -0.0938, 0.1673, -20.46],
    [0.0522, 0.7083, 0.7039, 159.9],
    [-0.1846, 0.6996, -0.69, 219.2],
    [0.0000, 0.0000, 0.0000, 1.0000]



  ]);
  const [markerToTooltipMatrix, setMarkerToTooltipMatrix] = React.useState<number[][]>([
    [-1, 0, 0, -17.08],
    [0, 1, 0, 0.10],
    [0, 0, -1, -157.82],
    [0, 0, 0, 1]
  ]); // DR-VR06-A32 calibration matrix
  // String representation for input fields to allow intermediate typing states
  const [prToDicomMatrixInput, setPrToDicomMatrixInput] = React.useState<string[][]>(
    prToDicomMatrix.map(row => row.map(val => val.toString()))
  );
  const [markerToTooltipMatrixInput, setMarkerToTooltipMatrixInput] = React.useState<string[][]>([
    ["-1", "0", "0", "-17.08"],
    ["0", "1", "0", "0.10"],
    ["0", "0", "-1", "-157.82"],
    ["0", "0", "0", "1"]
  ]); // DR-VR06-A32 calibration matrix
  const [matricesExpanded, setMatricesExpanded] = React.useState(false);
  const [matricesApplied, setMatricesApplied] = React.useState(true); // Mark as applied since it's hardcoded in service
  
  // Initialize NavigationController early so mode switching works even when navigation is not started
  React.useEffect(() => {
    const initNavigationController = async () => {
      if (!servicesManager) return;
      try {
        if (!window.__navigationController) {
          const { default: NavigationController } = await import('../../utils/navigationController');
          window.__navigationController = new NavigationController(servicesManager);
        }
        window.__navigationController.setNavigationMode('instrument-projection');
      } catch (error) {
        console.error('❌ [TrackingPanel] Failed to initialize NavigationController:', error);
      }
    };

    initNavigationController();
  }, [servicesManager]);

  // Phase 7: Configuration dialog state
  const [configDialogOpen, setConfigDialogOpen] = React.useState(false);
  const [currentTrackingConfig, setCurrentTrackingConfig] = React.useState<any>(null);

  // Configuration selection state
  const [availableConfigs, setAvailableConfigs] = React.useState<any[]>([]);
  const [selectedConfigId, setSelectedConfigId] = React.useState<string | null>(null);

  // 📍 [PR-DEBUG] Time-based PR logging
  const lastPrDebugLogRef = React.useRef<number>(0);
  const prDebugInterval = 5000; // 5 seconds

  // Get TrackingService
  const trackingService = (servicesManager?.services as any)?.trackingService;

  // Initialize matrices from TrackingService on mount
  React.useEffect(() => {
    if (trackingService) {
      const prToDicom = trackingService.getPrToDicomMatrix();
      const markerToTooltip = trackingService.getMarkerToTooltipMatrix();
      
      if (prToDicom) {
        setPrToDicomMatrix(prToDicom);
        setPrToDicomMatrixInput(prToDicom.map(row => row.map(val => val.toString())));
        console.log('✅ [TrackingPanel] Initialized prToDicomMatrix from service:', prToDicom);
      }
      
      if (markerToTooltip) {
        setMarkerToTooltipMatrix(markerToTooltip);
        setMarkerToTooltipMatrixInput(markerToTooltip.map(row => row.map(val => val.toString())));
        console.log('✅ [TrackingPanel] Initialized markerToTooltipMatrix from service:', markerToTooltip);
      }
    }
  }, [trackingService]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Matrix Utility Functions (for 3D model transformations)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Convert 4x4 matrix to flat array (16 elements, COLUMN-MAJOR for VTK.js)
   * 
   * Same approach as screw models (which render correctly)
   * Simple transpose from row-major to column-major, no coordinate corrections
   * 
   * This keeps the transformation pipeline unchanged (2D projections work correctly)
   * and treats tracking models the same as screw models for VTK rendering.
   */
  const matrix4x4ToFlat = React.useCallback((matrix: number[][]): number[] => {
    // Simple transpose: row-major → column-major for VTK
    // Same as modelStateService.ts setModelTransform() for screw models
    return [
      // Column 0 (X-axis)
      matrix[0][0], matrix[1][0], matrix[2][0], matrix[3][0],
      // Column 1 (Y-axis)
      matrix[0][1], matrix[1][1], matrix[2][1], matrix[3][1],
      // Column 2 (Z-axis)
      matrix[0][2], matrix[1][2], matrix[2][2], matrix[3][2],
      // Column 3 (Translation)
      matrix[0][3], matrix[1][3], matrix[2][3], matrix[3][3]
    ];
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3D Model Transformation Update Function
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Update transformation matrices for all loaded instrument 3D models
   * Throttled to 20Hz per model to prevent performance issues
   * Uses DICOM matrices pre-calculated by TrackingService
   * DICOM matrices place the tool in DICOM image space (same as CT/MRI volumes)
   * @param tools - Tools data from tracking update (passed directly to avoid stale state)
   */
  const setTransformationMatrices = React.useCallback((tools: any) => {
    if (!tools) {
      console.warn('⚠️ [setTransformationMatrices] No tools data provided');
      return;
    }

    const modelStateService = (servicesManager?.services as any)?.modelStateService;
    if (!modelStateService) {
      console.warn('⚠️ [setTransformationMatrices] modelStateService not available');
      return;
    }

    const now = performance.now();
    const throttleMs = 50; // 20Hz update rate (1000ms / 20 = 50ms)

    let updatedCount = 0;
    let skippedCount = 0;
    let throttledCount = 0;

    Object.entries(tools).forEach(([toolId, toolData]: [string, any]) => {
      // Skip if tool is patient reference or not visible
      if (toolData.is_patient_reference || !toolData.visible) {
        skippedCount++;
        return;
      }

      // Check if model exists for this tool
      const modelData = instrumentModelsRef.current.get(toolId);
      if (!modelData || !modelData.loaded) {
      //   console.warn(`⚠️ [setTransformationMatrices] No 3D model loaded for tool ${toolId}`);
        skippedCount++;
        return;
      }

      // Throttle updates to 20Hz per model
      if (now - modelData.lastUpdateTime < throttleMs) {
        throttledCount++;
        return;
      }

      // Get pre-calculated DICOM matrix from TrackingService
      // TrackingService stores it as dM{toolId} in dicom coordinates
      // This is the correct matrix for 3D model rendering (in DICOM image space)
      const dicomMatrixKey = `dM${toolId}`;
      const dicomMatrix = (toolData.coordinates?.dicom as any)?.[dicomMatrixKey];

      if (!dicomMatrix) {
        console.warn(`⚠️ [setTransformationMatrices] No DICOM matrix for tool ${toolId} (key: ${dicomMatrixKey})`);
        console.warn(`   Available dicom keys:`, Object.keys(toolData.coordinates?.dicom || {}));
        console.warn(`   Available PR keys:`, Object.keys(toolData.coordinates?.patient_reference || {}));
        skippedCount++;
        return;
      }

      // Convert to flat array (column-major for VTK.js) for modelStateService
      const transformFlat = matrix4x4ToFlat(dicomMatrix);

      // Update model transformation
      modelStateService.setInstrumentModelTransform(modelData.model_id, transformFlat);

      // Update last update time
      modelData.lastUpdateTime = now;
      instrumentModelsRef.current.set(toolId, modelData);
      updatedCount++;

      // Log successful updates (throttled to every 100th update)
      // if (updatedCount === 1 || updatedCount % 100 === 0) {
        // console.log(`✅ [setTransformationMatrices] Updated ${toolId} transform (count: ${updatedCount})`);
        // console.log(`   Position (DICOM space):`, [
          // dicomMatrix[0][3].toFixed(1),
          // dicomMatrix[1][3].toFixed(1),
          // dicomMatrix[2][3].toFixed(1)
        // ]);
      // }
    });

    // Log summary for first few calls
    if (updatedCount + skippedCount + throttledCount <= 10) {
      console.log(`📊 [setTransformationMatrices] Summary:`, {
        updated: updatedCount,
        skipped: skippedCount,
        throttled: throttledCount,
        totalModels: instrumentModelsRef.current.size
      });
    }
  }, [servicesManager, matrix4x4ToFlat]);

  // Sync coordinate system with TrackingService
  React.useEffect(() => {
    if (trackingService) {
      trackingService.setCoordinateSystem(coordinateSystem);
      console.log(`🧭 TrackingPanel: Coordinate system set to ${coordinateSystem}`);
    }
  }, [trackingService]);

  // Load tracking configuration
  const loadConfig = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Phase 4: Always use relative API paths (webpack proxy handles routing)
      const response = await fetch('/api/tracking/config');

      // Check if response is OK before parsing JSON
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', response.status, errorText);
        throw new Error(`Server returned ${response.status}: ${errorText.substring(0, 100)}`);
      }

      // Parse JSON response
      const result = await response.json();

      if (result.success) {
        setConfig(result.config);

        // Initialize selectedMode from config
        if (result.config.tracking_mode?.current) {
          setSelectedMode(result.config.tracking_mode.current as 'simulation' | 'hardware');
        }

        // Log the source of configuration (database or file)
        if (result.source) {
          console.log(`✅ Configuration loaded from: ${result.source}`);
          if (result.message) {
            console.log(`   ${result.message}`);
          }
        }
      } else {
        setError(result.error || 'Failed to load tracking configuration');
        console.error('Configuration load failed:', result.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load tracking configuration: ${errorMessage}`);
      console.error('Error loading tracking config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch all available configurations
  const fetchAvailableConfigs = React.useCallback(async () => {
    try {
      const response = await fetch('/api/tracking/configurations');

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', response.status, errorText);
        throw new Error(`Server returned ${response.status}: ${errorText.substring(0, 100)}`);
      }

      const result = await response.json();

      if (result.success && result.configurations) {
        setAvailableConfigs(result.configurations);
        console.log(`✅ Loaded ${result.configurations.length} available configurations`);

        // Auto-select the first configuration if none is selected and we have configs
        if (result.configurations.length > 0 && !selectedConfigId && !currentTrackingConfig) {
          setSelectedConfigId(result.configurations[0].config_id || result.configurations[0].name);
          console.log(`🎯 Auto-selected first configuration: ${result.configurations[0].name}`);
        }
      } else {
        console.warn('No configurations found or API returned unexpected format');
        setAvailableConfigs([]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error fetching available configurations:', errorMessage);
      setAvailableConfigs([]);
    }
  }, [selectedConfigId, currentTrackingConfig]);

  // Load a specific configuration by ID
  const loadSpecificConfig = React.useCallback(async (configId: string) => {
    try {
      setLoading(true);
      setError(null);

      const selectedConfig = availableConfigs.find(config => (config.config_id || config.name) === configId);
      if (!selectedConfig) {
        setError('Selected configuration not found');
        return;
      }

      // Apply the configuration directly (similar to how the dialog applies configs)
      setCurrentTrackingConfig(selectedConfig);
      setSelectedMode(selectedConfig.settings?.tracking_mode || 'simulation');

      // Sync to backend
      try {
        const syncResponse = await fetch('/api/tracking/config/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ configuration: selectedConfig })
        });

        const syncResult = await syncResponse.json();
        if (syncResult.success) {
          console.log('✅ Configuration synced to backend');
        } else {
          console.warn('⚠️ Failed to sync configuration to backend:', syncResult.error);
        }
      } catch (syncError) {
        console.warn('⚠️ Error syncing configuration:', syncError);
      }

      console.log(`✅ Configuration "${selectedConfig.name}" loaded and applied`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load configuration: ${errorMessage}`);
      console.error('Error loading specific configuration:', err);
    } finally {
      setLoading(false);
    }
  }, [availableConfigs]);

  // Switch tracking mode
  const switchMode = React.useCallback(async (mode: string) => {
    try {
      setLoading(true);

      // Disconnect first if tracking is active
      if (trackingService?.isConnected || trackingService?.isTracking) {
        console.log('🔌 Disconnecting before mode switch...');
        await trackingService.disconnect();
        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const response = await fetch('/api/tracking/mode', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });

      const result = await response.json();
      if (result.success) {
        // Update local config
        if (config) {
          setConfig({
            ...config,
            tracking_mode: { ...config.tracking_mode, current: mode }
          });
        }
        setError(null);
      } else {
        setError(result.error || 'Failed to switch mode');
      }
    } catch (err) {
      setError('Failed to switch tracking mode');
      console.error('Error switching mode:', err);
    } finally {
      setLoading(false);
    }
  }, [config]);

  // Navigation handlers
  const handleStartNavigation = React.useCallback(async () => {
    try {
      console.log('🚀 Starting navigation from TrackingPanel...');
      console.log('  - TrackingService available:', !!trackingService);
      console.log('  - CommandsManager available:', !!commandsManager);
      console.log('  - Current Configuration:', currentTrackingConfig);

      if (!trackingService) {
        setError('TrackingService not available');
        return;
      }

      if (!commandsManager) {
        setError('CommandsManager not available');
        return;
      }

      if (!currentTrackingConfig) {
        setError('No configuration loaded. Please select a configuration first.');
        return;
      }

      // Get tracking mode from current configuration
      const trackingMode = currentTrackingConfig.tracking_mode || selectedMode;
      console.log('  - Tracking Mode (from config):', trackingMode);

      // Clear UI data buffers before starting navigation
      console.log('  - Clearing UI data buffers');
      setTrackingFrame(null);

      // TrackingService.connect() will now automatically:
      // 1. Check if tracking is already active
      // 2. Disconnect if needed (especially if mode is different)
      // 3. Wait for cleanup
      // 4. Connect with the new mode

      console.log(`🚀 Starting navigation in ${trackingMode} mode...`);
      console.log(`   Configuration: ${currentTrackingConfig.name}`);
      console.log(`   Navigation mode: ${navigationMode}`);
      console.log(`   Orientation tracking: ${enableOrientation ? '6-DOF ✅' : '3-DOF ❌'}`);

      await commandsManager.runCommand('startNavigation', {
        mode: 'circular',
        trackingMode: trackingMode,
        enableOrientation: enableOrientation,
        navigationMode: navigationMode
      });

      setIsNavigating(true);

      // Verify the mode was set correctly
      setTimeout(() => {
        if (window.__navigationController) {
          const actualMode = window.__navigationController.getNavigationMode();
          console.log('✅ Navigation started successfully');
          console.log(`   Requested mode: ${navigationMode}`);
          console.log(`   Actual mode: ${actualMode}`);
          if (actualMode !== navigationMode) {
            console.error(`   ⚠️ WARNING: Mode mismatch! Requested ${navigationMode} but got ${actualMode}`);
          }
        }
      }, 500);

    } catch (error) {
      console.error('❌ Failed to start navigation:', error);
      setError(`Failed to start navigation: ${error.message}`);
    }
  }, [commandsManager, trackingService, currentTrackingConfig, selectedMode, navigationMode, enableOrientation]);

  const handleStopNavigation = React.useCallback(() => {
    try {
      if (commandsManager) {
        commandsManager.runCommand('stopNavigation');
        setIsNavigating(false);

        // Clear UI data buffers when stopping navigation
        console.log('  - Clearing UI data buffers on stop');
        setTrackingFrame(null);

        // Remove all instrument 3D models
        const modelStateService = (servicesManager?.services as any)?.modelStateService;
        if (modelStateService) {
          console.log('  - Removing instrument 3D models');
          let removedCount = 0;
          instrumentModelsRef.current.forEach((modelData) => {
            if (modelData.loaded && modelData.model_id) {
              try {
                modelStateService.removeModel(modelData.model_id);
                removedCount++;
                console.log(`    ✅ Removed model for tool ${modelData.tool_id}`);
              } catch (error) {
                console.error(`    ❌ Failed to remove model for tool ${modelData.tool_id}:`, error);
              }
            }
          });
          instrumentModelsRef.current.clear();
          console.log(`  - Removed ${removedCount} instrument models`);
        }
      }
    } catch (error) {
      console.error('Failed to stop navigation:', error);
      setError('Failed to stop navigation');
    }
  }, [commandsManager, servicesManager]);

  const handleSetCenter = React.useCallback(() => {
    try {
      if (commandsManager) {
        commandsManager.runCommand('setTrackingCenter');
      }
    } catch (error) {
      console.error('Failed to set center:', error);
      setError('Failed to set center');
    }
  }, [commandsManager]);

  // Phase 7: Configuration Dialog Handlers
  const handleOpenConfigDialog = React.useCallback(() => {
    setConfigDialogOpen(true);
  }, []);

  const handleCloseConfigDialog = React.useCallback(() => {
    setConfigDialogOpen(false);
  }, []);

  const handleConfigSaved = React.useCallback(async (savedConfig: any) => {
    console.log('✅ Configuration saved:', savedConfig);
    setCurrentTrackingConfig(savedConfig);
    setConfigDialogOpen(false);

    // Sync tracking mode from saved configuration
    if (savedConfig.settings?.tracking_mode) {
      setSelectedMode(savedConfig.settings.tracking_mode as 'simulation' | 'hardware');
      console.log(`  - Tracking mode set to: ${savedConfig.settings.tracking_mode}`);
    }

    // Update selected config ID
    setSelectedConfigId(savedConfig.config_id || savedConfig.name);

    // Refresh available configurations list
    await fetchAvailableConfigs();

    // Reload the tracking configuration to apply changes
    await loadConfig();

    // Show success message
    setError(null);
  }, [loadConfig, fetchAvailableConfigs]);

  const handleConfigApplied = React.useCallback(async (appliedConfig: any) => {
    console.log('✅ Configuration applied:', appliedConfig);
    setCurrentTrackingConfig(appliedConfig);

    // Sync tracking mode from applied configuration
    if (appliedConfig.settings?.tracking_mode) {
      setSelectedMode(appliedConfig.settings.tracking_mode as 'simulation' | 'hardware');
      console.log(`  - Tracking mode set to: ${appliedConfig.settings.tracking_mode}`);
    }

    // Update selected config ID
    setSelectedConfigId(appliedConfig.config_id || appliedConfig.name);

    // Refresh available configurations list
    await fetchAvailableConfigs();

    // Reload the tracking configuration
    await loadConfig();
  }, [loadConfig, fetchAvailableConfigs]);

  // Subscribe to TrackingService events
  React.useEffect(() => {
    if (!trackingService) {
      console.warn('⚠️ TrackingService not available in TrackingPanel');
      return;
    }

    console.log('📡 TrackingPanel: Subscribing to TrackingService events');

    // Subscribe to tracking updates
    const trackingSub = trackingService.subscribe(
      'event::tracking_update',
      async (data) => {
        // this is an advanced feature, we will add it later, NOT USED FOR NOW
        // // Auto-load 3D models for newly visible tools (non-blocking)
        // if (data.tools) {
        //   const modelStateService = (servicesManager?.services as any)?.modelStateService;
        //   if (modelStateService) {
        //     for (const [toolId, toolData] of Object.entries(data.tools)) {
        //       const tool = toolData as any;
              
        //       // Skip if tool is patient reference or not visible
        //       if (tool.is_patient_reference || !tool.visible) continue;

        //       // Check if we already have a model for this tool
        //       const existingModel = instrumentModelsRef.current.get(toolId);
        //       if (existingModel) continue; // Already loaded or attempted

        //       // Try to load model from server
        //       try {
        //         const romFile = tool.rom_file;
        //         const modelName = romFile ? romFile.replace('.rom', '.obj') : `${toolId}.obj`;
        //         const modelUrl = `/models/instruments/${modelName}`;
                
        //         console.log(`🔍 Attempting to load 3D model for tool ${toolId}: ${modelUrl}`);

        //         // Check if model exists on server
        //         const models = await modelStateService.fetchAvailableModels();
        //         const modelExists = models.some((m: any) => 
        //           m.url === modelUrl || 
        //           m.name === modelName ||
        //           m.url?.includes(modelName) ||
        //           m.name?.includes(toolId)
        //         );
                
        //         if (!modelExists) {
        //           console.log(`ℹ️ No 3D model found for tool ${toolId}, skipping visualization`);
        //           // Mark as attempted so we don't keep trying
        //           instrumentModelsRef.current.set(toolId, {
        //             tool_id: toolId,
        //             model_id: '',
        //             loaded: false,
        //             visible: false,
        //             lastUpdateTime: 0
        //           });
        //           continue;
        //         }

        //         // Load model from server
        //         const loadedModel = await modelStateService.loadModelFromServer(modelUrl, {
        //           modelId: `instrument_${toolId}`,
        //           modelName: toolId,
        //           viewportId: 'viewport-3d',
        //           visible: true,
        //           opacity: 0.8,
        //           color: [0.2, 0.8, 0.2] // Default green color
        //         });

        //         if (loadedModel) {
        //           console.log(`✅ Loaded 3D model for tool ${toolId}`);
        //           instrumentModelsRef.current.set(toolId, {
        //             tool_id: toolId,
        //             model_id: loadedModel.metadata.id,
        //             loaded: true,
        //             visible: true,
        //             lastUpdateTime: 0,
        //             color: [0.2, 0.8, 0.2]
        //           });
        //         }
        //       } catch (error) {
        //         console.error(`❌ Failed to load model for tool ${toolId}:`, error);
        //         // Mark as attempted to avoid repeated failures
        //         instrumentModelsRef.current.set(toolId, {
        //           tool_id: toolId,
        //           model_id: '',
        //           loaded: false,
        //           visible: false,
        //           lastUpdateTime: 0
        //         });
        //       }
        //     }
        //   }
        // }

        // Update tracking frame
        setTrackingFrame({
          type: 'tracking_data',
          patient_reference: {
            id: data.patient_reference_id || '',
            name: data.patient_reference_name || null,  // Phase 4: Add patient reference name
            visible: data.patient_reference_visible || false,
            quality: data.patient_reference_quality || 0,
            moved: data.patient_reference_moved || false,
            movement_mm: data.patient_reference_movement || 0
          },
          tools: data.tools || {},
          timestamp: data.timestamp || new Date().toISOString(),
          frame_number: data.frame_number || 0
        });

        
        // Update 3D model transformations (throttled to 20Hz per model)
        // Pass tools data directly to avoid React state closure issue
        setTransformationMatrices(data.tools);
        




        
        // 📍 [PR-DEBUG] Log PR data every 5 seconds
        const nowPrDebug = Date.now();
        if (nowPrDebug - lastPrDebugLogRef.current >= prDebugInterval) {
          const pr = data.patient_reference || {};
          const prIcon = pr.visible ? '✅' : '❌';
          console.log(`\n📍 [PR-DEBUG-PANEL] Frame ${data.frame_number} @ ${(nowPrDebug/1000).toFixed(2)}s`);
          console.log(`   ${prIcon} PR ID: ${data.patient_reference_id}`);
          console.log(`   ${prIcon} PR Name: ${data.patient_reference_name}`);
          console.log(`   ${prIcon} PR Visible: ${data.patient_reference_visible}`);
          console.log(`   ${prIcon} PR Quality: ${data.patient_reference_quality?.toFixed(2)}`);
          console.log(`   📦 UI State - trackingFrame.patient_reference:`, pr);
          console.log(`   📦 Tools in frame: ${Object.keys(data.tools || {}).length}`);
          lastPrDebugLogRef.current = nowPrDebug;
        }

        // Auto-select first tool if no selection and tools are available
        if (!selectedToolId && data.tools) {
          const availableTools = Object.entries(data.tools)
            .filter(([toolId, toolData]: [string, any]) => !toolData.is_patient_reference && toolData.visible)
            .map(([toolId]) => toolId);

          if (availableTools.length > 0) {
            const firstTool = availableTools[0];
            setSelectedToolId(firstTool);
            trackingService.setSelectedTool(firstTool);
          }
        }

        // Log periodically (every 100th frame)
        if (data.frame_number % 100 === 0) {
          console.log('📊 TrackingPanel: Tracking data received:', {
            frame: data.frame_number,
            tools: Object.keys(data.tools || {}),
            hz: 'pr-relative'
          });
        }
      }
    );

    return () => {
      trackingSub?.unsubscribe();
    };
  }, [trackingService]);

  // Auto-register loaded 3D models that match tracking tool IDs
  React.useEffect(() => {
    if (!trackingFrame || !trackingFrame.tools) return;
    
    const modelStateService = (servicesManager?.services as any)?.modelStateService;
    if (!modelStateService) return;

    // Get all loaded models from modelStateService
    const allModels = modelStateService.getAllModels();
    
    // For each tool in the tracking frame
    Object.entries(trackingFrame.tools).forEach(([toolId, toolData]: [string, any]) => {
      // Skip patient reference
      if (toolData.is_patient_reference) return;

      // Check if we already have this tool registered
      if (instrumentModelsRef.current.has(toolId)) return;

      // Look for a model with matching ID
      const matchingModel = allModels.find((model: any) => model.metadata.id === toolId);
      
      if (matchingModel) {
        // Register the model
        instrumentModelsRef.current.set(toolId, {
          tool_id: toolId,
          model_id: matchingModel.metadata.id,
          loaded: true,
          visible: matchingModel.metadata.visible,
          lastUpdateTime: 0,
          color: matchingModel.metadata.color || [0.2, 0.8, 0.2]
        });
        
        console.log(`✅ [TrackingPanel] Auto-registered 3D model for tool ${toolId}`);
        console.log(`   Model ID: ${matchingModel.metadata.id}`);
        console.log(`   Model Name: ${matchingModel.metadata.modelName || 'N/A'}`);
      }
    });
  }, [trackingFrame, servicesManager]);

  // Load available configurations on mount
  React.useEffect(() => {
    fetchAvailableConfigs();
  }, [fetchAvailableConfigs]);

  const primaryButtonLabel = !selectedConfigId
    ? 'Select Configuration'
    : !currentTrackingConfig
      ? 'Load Configuration'
      : isNavigating
        ? 'Stop Navigation'
        : 'Start Navigation';

  const primaryButtonAction = () => {
    if (!selectedConfigId) {
      handleOpenConfigDialog();
      return;
    }
    if (!currentTrackingConfig) {
      if (selectedConfigId) {
        loadSpecificConfig(selectedConfigId);
      }
      return;
    }
    if (isNavigating) {
      handleStopNavigation();
      return;
    }
    handleStartNavigation();
  };

  const primaryButtonDisabled =
    (!selectedConfigId) ||
    (!!currentTrackingConfig && !isNavigating && (!trackingService || !commandsManager)) ||
    (selectedConfigId && !currentTrackingConfig && loading);

  const primaryButtonClass = !currentTrackingConfig
    ? 'bg-blue-600 hover:bg-blue-700'
    : isNavigating
      ? 'bg-red-600 hover:bg-red-700'
      : 'bg-green-600 hover:bg-green-700';

  return (
    <div className="h-full overflow-hidden bg-black p-4">
      <div className="h-full overflow-auto">
        <h2 className="text-2xl font-bold text-white mb-4">Navigation Control</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded text-red-200">
            ⚠️ {error}
          </div>
        )}

        {loading && (
          <div className="mb-4 text-center text-secondary-light">
            Loading...
          </div>
        )}

        {/* Simplified Workflow Info */}
        {availableConfigs.length === 0 && !loading && (
          <div className="mb-4 p-3 bg-blue-900 border border-blue-700 rounded">
            <div className="flex items-start gap-2">
              <span className="text-lg">💡</span>
              <div className="flex-1">
                <div className="text-blue-200 text-sm font-medium mb-1">Simplified Workflow</div>
                <div className="text-xs text-blue-300">
                  No configurations available. Click "Select Configuration" to create and save your first tracking setup.
                  Each configuration includes tracking mode (simulation/hardware) and all tool settings.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phase 4: Alerts */}
        {alerts.length > 0 && (
          <div className="mb-4 space-y-2">
            {alerts.map(alert => (
              <div
                key={alert.id}
                className={`p-3 rounded border ${
                  alert.severity === 'high'
                    ? 'bg-red-900 border-red-700 text-red-200'
                    : alert.severity === 'warning'
                    ? 'bg-yellow-900 border-yellow-700 text-yellow-200'
                    : 'bg-blue-900 border-blue-700 text-blue-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium">
                      {alert.severity === 'high' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️'} {alert.message}
                    </div>
                    <div className="text-xs mt-1 opacity-75">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <button
                    onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}
                    className="ml-2 text-white opacity-50 hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Phase 4: Patient Reference Status */}
        {trackingFrame && trackingFrame.patient_reference && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">Patient Reference</h3>
            <div className={`p-3 rounded border ${
              !trackingFrame.patient_reference.visible
                ? 'bg-red-900 border-red-700'
                : trackingFrame.patient_reference.moved
                ? 'bg-yellow-900 border-yellow-700'
                : 'bg-green-900 border-green-700'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-white font-mono text-lg font-bold">
                    <span>{trackingFrame.patient_reference.visible ? '🟢' : '🔴'}</span>
                    <span>{trackingFrame.patient_reference.id?.toUpperCase() || 'PR'}</span>
                  </div>
                  {trackingFrame.patient_reference.name && (
                    <div className="text-xs text-gray-400 mt-1">
                      {trackingFrame.patient_reference.name}
                    </div>
                  )}
                </div>
                <div className="text-right text-xs text-gray-200 space-y-1 font-mono">
                  <div>Quality: {(trackingFrame.patient_reference.quality * 100).toFixed(0)}%</div>
                  <div className={trackingFrame.patient_reference.moved ? 'text-yellow-200 font-semibold' : ''}>
                    Move: {trackingFrame.patient_reference.movement_mm.toFixed(2)} mm {trackingFrame.patient_reference.moved ? '⚠️' : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Registration Matrices */}
        <div className="mb-6">
          <div
            className="flex items-center justify-between mb-3 cursor-pointer p-2 rounded hover:bg-gray-800 transition-colors"
            onClick={() => setMatricesExpanded(!matricesExpanded)}
          >
            <h3 className="text-lg font-semibold text-white">🔧 Registration Matrices</h3>
            <div className="flex items-center gap-2">
              {matricesApplied && (
                <span className="text-xs text-green-400 font-medium">✅ Applied</span>
              )}
              <span className="text-gray-400 text-sm">{matricesExpanded ? '▼' : '▶'}</span>
            </div>
          </div>

          {matricesExpanded && (
            <div className="p-4 bg-gray-900 border border-gray-700 rounded space-y-4">
              <div className="text-xs text-gray-400 mb-3">
                Configure the transformation pipeline: Marker Array → Tooltip → DICOM Space
              </div>

              {/* PR to DICOM Matrix */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-300 font-medium">PR to DICOM Matrix (Registration)</label>
                  <button
                    onClick={() => {
                      const identity = identityMatrix.map(row => [...row]);
                      setPrToDicomMatrix(identity);
                      setPrToDicomMatrixInput(identity.map(row => row.map(val => val.toString())));
                      setMatricesApplied(false);
                    }}
                    className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                  >
                    Reset to Identity
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {prToDicomMatrixInput.map((row, i) =>
                    row.map((val, j) => (
                      <input
                        key={`prdicom-${i}-${j}`}
                        type="text"
                        value={val}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          // Update input state immediately to allow intermediate states
                          const newInputMatrix = prToDicomMatrixInput.map(r => [...r]);
                          newInputMatrix[i][j] = inputValue;
                          setPrToDicomMatrixInput(newInputMatrix);
                          
                          // Try to parse as number for the actual matrix
                          const parsed = parseFloat(inputValue);
                          if (!isNaN(parsed) || inputValue === '' || inputValue === '-' || inputValue === '.' || inputValue === '-.') {
                            const newMatrix = prToDicomMatrix.map(r => [...r]);
                            newMatrix[i][j] = isNaN(parsed) ? 0 : parsed;
                            setPrToDicomMatrix(newMatrix);
                          }
                          setMatricesApplied(false);
                        }}
                        onBlur={(e) => {
                          // On blur, clean up the input to show valid number
                          const parsed = parseFloat(e.target.value);
                          const finalValue = isNaN(parsed) ? 0 : parsed;
                          const newInputMatrix = prToDicomMatrixInput.map(r => [...r]);
                          newInputMatrix[i][j] = finalValue.toString();
                          setPrToDicomMatrixInput(newInputMatrix);
                          
                          const newMatrix = prToDicomMatrix.map(r => [...r]);
                          newMatrix[i][j] = finalValue;
                          setPrToDicomMatrix(newMatrix);
                        }}
                        className="w-full px-1 py-1 text-xs font-mono text-white bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Marker to Tooltip Matrix (Calibration) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-300 font-medium">Marker to Tooltip Matrix (Calibration)</label>
                  <button
                    onClick={() => {
                      const dr06cal = [
                        [-1, 0, 0, -17.08],
                        [0, 1, 0, 0.10],
                        [0, 0, -1, -157.82],
                        [0, 0, 0, 1]
                      ];
                      setMarkerToTooltipMatrix(dr06cal);
                      setMarkerToTooltipMatrixInput(dr06cal.map(row => row.map(val => val.toString())));
                      setMatricesApplied(false);
                    }}
                    className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                  >
                    Reset to DR-VR06-A32
                  </button>
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  📏 DR-VR06-A32: Tooltip is ~157.8mm from marker array
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {markerToTooltipMatrixInput.map((row, i) =>
                    row.map((val, j) => (
                      <input
                        key={`marker-${i}-${j}`}
                        type="text"
                        value={val}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          // Update input state immediately to allow intermediate states
                          const newInputMatrix = markerToTooltipMatrixInput.map(r => [...r]);
                          newInputMatrix[i][j] = inputValue;
                          setMarkerToTooltipMatrixInput(newInputMatrix);
                          
                          // Try to parse as number for the actual matrix
                          const parsed = parseFloat(inputValue);
                          if (!isNaN(parsed) || inputValue === '' || inputValue === '-' || inputValue === '.' || inputValue === '-.') {
                            const newMatrix = markerToTooltipMatrix.map(r => [...r]);
                            newMatrix[i][j] = isNaN(parsed) ? 0 : parsed;
                            setMarkerToTooltipMatrix(newMatrix);
                          }
                          setMatricesApplied(false);
                        }}
                        onBlur={(e) => {
                          // On blur, clean up the input to show valid number
                          const parsed = parseFloat(e.target.value);
                          const finalValue = isNaN(parsed) ? 0 : parsed;
                          const newInputMatrix = markerToTooltipMatrixInput.map(r => [...r]);
                          newInputMatrix[i][j] = finalValue.toString();
                          setMarkerToTooltipMatrixInput(newInputMatrix);
                          
                          const newMatrix = markerToTooltipMatrix.map(r => [...r]);
                          newMatrix[i][j] = finalValue;
                          setMarkerToTooltipMatrix(newMatrix);
                        }}
                        className="w-full px-1 py-1 text-xs font-mono text-white bg-gray-800 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Apply Button */}
              <button
                onClick={() => {
                  if (trackingService) {
                    trackingService.setPrToDicomMatrix(prToDicomMatrix);
                    trackingService.setMarkerToTooltipMatrix(markerToTooltipMatrix);
                    setMatricesApplied(true);
                    console.log('✅ Transformation matrices applied to TrackingService:', {
                      prToDicom: prToDicomMatrix,
                      markerToTooltip: markerToTooltipMatrix
                    });
                  }
                }}
                disabled={!trackingService}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:opacity-50 text-white rounded font-medium transition-colors text-sm"
              >
                Apply Matrices
              </button>

              {!matricesApplied && (
                <div className="text-xs text-yellow-400 text-center">
                  ⚠️ Changes not applied yet - click "Apply Matrices"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Phase 4: Real-time Tool Tracking */}
        {trackingFrame && trackingFrame.tools && Object.keys(trackingFrame.tools).length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">Tool Coordinates</h3>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {Object.entries(trackingFrame.tools)
                .filter(([toolId, toolData]) => !toolData.is_patient_reference)  // 🆕 过滤掉 Patient Reference
                .map(([toolId, toolData]) => {
                const coords = toolData.coordinates[coordinateSystem];
                const isSelected = selectedToolId === toolId;
                return (
                  <div
                    key={toolId}
                    onClick={() => {
                      if (toolData.visible) {
                        setSelectedToolId(toolId);
                        trackingService.setSelectedTool(toolId);
                        console.log(`🎯 Selected tool for visualization: ${toolId}`);
                      }
                    }}
                    className={`p-3 rounded border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-900 border-blue-500 ring-2 ring-blue-400'
                        : toolData.visible
                          ? 'bg-gray-800 border-gray-600 hover:bg-gray-700'
                          : 'bg-gray-900 border-gray-700 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="text-white font-medium font-mono">
                          {toolData.visible ? (toolData.is_patient_reference ? '✅' : '🎯') : '❌'} {toolId.toUpperCase()}
                        </div>
                        {isSelected && (
                          <div className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">
                            VISUALIZED
                          </div>
                        )}
                      </div>
                      <div className={`text-xs font-mono ${
                        toolData.visible ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {toolData.visible ? '● Visible' : '● Hidden'}
                      </div>
                    </div>

                    {toolData.visible && coords && (
                      <div className="space-y-1 text-xs font-mono">
                        {/* Position */}
                        <div className="flex justify-between text-gray-300">
                          <span>Pos (mm):</span>
                          <span className="text-blue-300">
                            [{coords.position_mm[0].toFixed(1).padStart(7)}, {coords.position_mm[1].toFixed(1).padStart(7)}, {coords.position_mm[2].toFixed(1).padStart(7)}]
                          </span>
                        </div>
                        
                        {/* Quaternion (w, x, y, z) */}
                        {toolData.quaternion && (
                          <div className="flex justify-between text-gray-300">
                            <span>Quat:</span>
                            <span className="text-purple-300">
                              [{toolData.quaternion[0] >= 0 ? '+' : ''}{toolData.quaternion[0].toFixed(3)}, 
                              {toolData.quaternion[1] >= 0 ? '+' : ''}{toolData.quaternion[1].toFixed(3)}, 
                              {toolData.quaternion[2] >= 0 ? '+' : ''}{toolData.quaternion[2].toFixed(3)}, 
                              {toolData.quaternion[3] >= 0 ? '+' : ''}{toolData.quaternion[3].toFixed(3)}]
                            </span>
                          </div>
                        )}
                        
                        {/* Quality */}
                        <div className="flex justify-between text-gray-300">
                          <span>Q:</span>
                          <span className={
                            toolData.quality_score > 0.8 ? 'text-green-400' :
                            toolData.quality_score > 0.5 ? 'text-yellow-400' : 'text-red-400'
                          }>
                            {toolData.quality_score.toFixed(3)}
                          </span>
                        </div>
                        
                        {/* Delta (frame-to-frame changes) */}
                        {(toolData.delta_position_mm !== undefined || toolData.delta_rotation_deg !== undefined) && (
                          <div className="flex justify-between text-gray-300">
                            <span>Δ:</span>
                            <span className="text-orange-300">
                              {(toolData.delta_position_mm || 0).toFixed(2)}mm, {(toolData.delta_rotation_deg || 0).toFixed(2)}°
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Not Found - Show ROM file */}
                    {!toolData.visible && toolData.rom_file && (
                      <div className="text-xs text-red-400 font-mono mt-2">
                        ❌ NOT FOUND (ROM: {toolData.rom_file})
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* Mode Selection - REMOVED: Now controlled by configuration only */}

        {/* Actions */}
        <div className="space-y-3">
          {/* Configuration Selection */}
          {availableConfigs.length > 0 ? (
            <div>
              <label className="block text-sm font-medium text-white mb-2">Select Configuration</label>
              <select
                value={selectedConfigId || ''}
                onChange={(e) => {
                  const configId = e.target.value;
                  setSelectedConfigId(configId);
                  if (configId) {
                    loadSpecificConfig(configId);
                  }
                }}
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500"
                disabled={loading}
              >
                <option value="">Select a configuration...</option>
                {availableConfigs.map((config) => (
                  <option key={config.config_id || config.name} value={config.config_id || config.name}>
                    {config.name} {config.settings?.tracking_mode === 'simulation' ? '(SIM)' : '(HW)'}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="p-3 bg-yellow-900 border border-yellow-700 rounded">
              <div className="text-yellow-200 text-sm">
                ⚠️ No configurations available
              </div>
              <div className="text-xs text-yellow-300 mt-1">
                Please create and save configurations using the "Select Configuration" button below
              </div>
            </div>
          )}

          {/* Current Configuration Display */}
          {currentTrackingConfig ? (
            <button
              type="button"
              onClick={handleOpenConfigDialog}
              className="w-full text-left p-3 bg-gray-800 border border-gray-600 rounded hover:border-blue-500 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-xs text-gray-400">Active Configuration (click to manage)</div>
                  <div className="text-white font-medium">{currentTrackingConfig.name}</div>
                  {currentTrackingConfig.description && (
                    <div className="text-xs text-gray-500 mt-1">{currentTrackingConfig.description}</div>
                  )}
                </div>
                <div className={`text-xs px-2 py-1 rounded ${
                  currentTrackingConfig.settings?.tracking_mode === 'simulation'
                    ? 'bg-blue-900 text-blue-300'
                    : 'bg-green-900 text-green-300'
                }`}>
                  {currentTrackingConfig.settings?.tracking_mode === 'simulation' ? '🖥️ SIM' : '🔧 HW'}
                </div>
              </div>
            </button>
          ) : selectedConfigId ? (
            <div className="p-3 bg-orange-900 border border-orange-700 rounded">
              <div className="text-orange-200 text-sm">
                ⚠️ Configuration selected but not loaded
              </div>
              <div className="text-xs text-orange-300 mt-1">
                Click "Load Configuration" to apply the selected configuration
              </div>
            </div>
          ) : null}

          <button
            onClick={primaryButtonAction}
            disabled={primaryButtonDisabled}
            className={`w-full p-3 ${primaryButtonClass} disabled:bg-gray-700 disabled:opacity-50 text-white rounded font-medium transition-colors flex items-center justify-center gap-2`}
          >
            <span className="text-lg">
              {!selectedConfigId ? '⚙️' : !currentTrackingConfig ? '📥' : isNavigating ? '⏹️' : '▶️'}
            </span>
            <span>{primaryButtonLabel}</span>
            {currentTrackingConfig && !isNavigating && (
              <span className="text-xs opacity-75">
                ({currentTrackingConfig.settings?.tracking_mode === 'simulation' ? 'SIM' : 'HW'})
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Phase 7: Tracking Configuration Dialog */}
      <TrackingConfigDialog
        open={configDialogOpen}
        onClose={handleCloseConfigDialog}
        onConfigurationSaved={handleConfigSaved}
        onConfigurationApplied={handleConfigApplied}
      />
    </div>
  );
}

export default PanelTracking;
