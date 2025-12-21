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
 *
 * ARCHITECTURE:
 * - Business logic and state management in this file
 * - UI rendering in TrackingPanelLayout.tsx
 */

import React from 'react';
import { useSystem } from '@ohif/core';
import { useSearchParams } from 'react-router-dom';
import TrackingPanelLayout from './TrackingPanelLayout';
import { updateDistanceAnnotationsForMprViewports, extractTooltipPosition } from './utils';

// Extend Window interface for NavigationController
declare global {
  interface Window {
    __navigationController?: any;
  }
}

// create a new interface for our 3d instrument models
interface InstrumentModel3D {
  tool_id: string; // Tool identifier (e.g., "DR-VR06-A33")
  model_id: string; // Model ID in modelStateService
  loaded: boolean; // Whether model is successfully loaded
  visible: boolean; // Current visibility state
  lastUpdateTime: number; // Timestamp of last transform update (for throttling)
  color?: [number, number, number]; // Color for visibility state changes
}

interface TrackingConfig {
  config_id?: string;
  name?: string;
  description?: string;
  version?: string;
  tracking_mode?: {
    current: string;
    type: string;
    options: string[];
  };
  active_tools?: {
    [toolKey: string]: {
      asset_id: string;
      enabled: boolean;
      required?: boolean;
      description?: string;
    };
  };
  quality_thresholds?: {
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
  settings?: {
    tracking_mode?: 'simulation' | 'hardware';
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
  name: string | null; // Phase 4: Human-readable name from proto
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
  const [searchParams] = useSearchParams();
  const [config, setConfig] = React.useState<TrackingConfig | null>(null);
  const [status, setStatus] = React.useState<TrackingStatus | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Phase 4: Real-time tracking state
  const [trackingFrame, setTrackingFrame] = React.useState<TrackingFrame | null>(null);

  // Dictionary: tool_id → InstrumentModel3D (for 3D model tracking)
  const instrumentModelsRef = React.useRef<Map<string, InstrumentModel3D>>(new Map());
  const coordinateSystem: 'tracker' | 'patient_reference' = 'patient_reference';
  const [alerts, setAlerts] = React.useState<
    Array<{ id: string; message: string; severity: string; timestamp: string }>
  >([]);

  // Navigation state
  const [isNavigating, setIsNavigating] = React.useState(false);

  // Selected tracking mode for navigation (simulation or hardware)
  const [selectedMode, setSelectedMode] = React.useState<'simulation' | 'hardware'>('simulation');

  // Navigation mode selection (camera-follow or instrument-projection)
  const [navigationMode, setNavigationMode] = React.useState<
    'camera-follow' | 'instrument-projection'
  >('instrument-projection');

  // Enable orientation tracking: always true for camera-follow, false for instrument-projection
  const enableOrientation: boolean = navigationMode === 'camera-follow';

  // Selected tool for visualization
  const [selectedToolId, setSelectedToolId] = React.useState<string | null>(null);
  const [isRealTimeDistanceEnabled, setIsRealTimeDistanceEnabled] = React.useState<boolean>(false);
  const selectedScrewRef = React.useRef<{
    key: string | null;
    position: number[] | null;
    transform: number[] | null;
    length: number | null;
  }>({ key: null, position: null, transform: null, length: null });
  const isRealTimeDistanceEnabledRef = React.useRef<boolean>(false);
  React.useEffect(() => {
    isRealTimeDistanceEnabledRef.current = isRealTimeDistanceEnabled;
  }, [isRealTimeDistanceEnabled]);
  const lastDistanceUpdateRef = React.useRef<number>(0);
  const distanceUpdateThrottleMs = 50; // ~20 Hz distance updates

  // Registration matrices state
  const identityMatrix = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];

  // Initialize NavigationController early so mode switching works even when navigation is not started
  React.useEffect(() => {
    const initNavigationController = async () => {
      if (!servicesManager) {
        return;
      }
      try {
        if (!window.__navigationController) {
          const { default: NavigationController } = await import(
            '../../utils/navigationController'
          );
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
      matrix[0][0],
      matrix[1][0],
      matrix[2][0],
      matrix[3][0],
      // Column 1 (Y-axis)
      matrix[0][1],
      matrix[1][1],
      matrix[2][1],
      matrix[3][1],
      // Column 2 (Z-axis)
      matrix[0][2],
      matrix[1][2],
      matrix[2][2],
      matrix[3][2],
      // Column 3 (Translation)
      matrix[0][3],
      matrix[1][3],
      matrix[2][3],
      matrix[3][3],
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
  const setTransformationMatrices = React.useCallback(
    (tools: any) => {
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
          console.warn(
            `⚠️ [setTransformationMatrices] No DICOM matrix for tool ${toolId} (key: ${dicomMatrixKey})`
          );
          console.warn(`   Available dicom keys:`, Object.keys(toolData.coordinates?.dicom || {}));
          console.warn(
            `   Available PR keys:`,
            Object.keys(toolData.coordinates?.patient_reference || {})
          );
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
      // if (updatedCount + skippedCount + throttledCount <= 10) {
      //   console.log(`📊 [setTransformationMatrices] Summary:`, {
      //     updated: updatedCount,
      //     skipped: skippedCount,
      //     throttled: throttledCount,
      //     totalModels: instrumentModelsRef.current.size
      //   });
      // }
    },
    [servicesManager, matrix4x4ToFlat]
  );

  // Sync coordinate system with TrackingService
  React.useEffect(() => {
    if (trackingService) {
      trackingService.setCoordinateSystem(coordinateSystem);
      console.log(`🧭 TrackingPanel: Coordinate system set to ${coordinateSystem}`);
    }
  }, [trackingService]);

  // Auto-load registration matrix when available
  // This ensures the navigation panel displays the correct matrix instead of identity matrix
  React.useEffect(() => {
    const loadRegistrationMatrixIfAvailable = async () => {
      if (!trackingService || !servicesManager) {
        return;
      }

      try {
        const services = servicesManager.services as any;
        const { displaySetService, viewportGridService } = services;
        if (!displaySetService || !viewportGridService) {
          return;
        }

        // Get active viewport using viewportGridService (same approach as ScrewManagementPanel)
        const { activeViewportId, viewports } = viewportGridService.getState();
        if (!activeViewportId) {
          return;
        }

        const viewport = viewports.get(activeViewportId);
        if (
          !viewport ||
          !viewport.displaySetInstanceUIDs ||
          viewport.displaySetInstanceUIDs.length === 0
        ) {
          return;
        }

        // Get the first display set (usually the background image)
        const displaySetInstanceUID = viewport.displaySetInstanceUIDs[0];
        const displaySet = displaySetService.getDisplaySetByUID(displaySetInstanceUID);
        if (!displaySet || !displaySet.SeriesInstanceUID) {
          return;
        }

        const seriesInstanceUID = displaySet.SeriesInstanceUID;

        // Try to get caseId from various sources
        // Priority: 1. URL parameter, 2. displaySet metadata
        // ❌ Do NOT use StudyInstanceUID as fallback (it's a DICOM UID, not a case ID)
        const urlCaseId = searchParams.get('caseId');
        const displaySetCaseId = (displaySet as any).caseId;
        const caseId = urlCaseId || displaySetCaseId || null;

        // If we have seriesInstanceUID and caseId, try to load the registration matrix
        if (seriesInstanceUID && caseId) {
          // Validate that caseId is not a DICOM UID (caseId should be a number or short string)
          // If caseId looks like a DICOM UID (contains multiple dots and is long), skip loading
          if (caseId.includes('.') && caseId.length > 20) {
            console.warn(
              '⚠️ [TrackingPanel] caseId looks like a DICOM UID, skipping registration matrix load:',
              caseId
            );
            return;
          }

          console.log('🔄 [TrackingPanel] Attempting to load registration matrix...', {
            seriesInstanceUID,
            caseId,
          });

          const loaded = await trackingService.loadRegistrationMatrix(seriesInstanceUID, caseId);

          if (loaded) {
            console.log('✅ [TrackingPanel] Registration matrix loaded successfully');
          } else {
            console.log('ℹ️ [TrackingPanel] No registration matrix found (using identity)');
          }
        } else {
          if (!caseId) {
            console.log(
              'ℹ️ [TrackingPanel] No caseId available, skipping registration matrix load'
            );
          }
        }
      } catch (error: any) {
        // Silently fail - this is not critical, matrix will be loaded when registration is computed
        console.log('ℹ️ [TrackingPanel] Could not auto-load registration matrix:', error.message);
      }
    };

    loadRegistrationMatrixIfAvailable();
  }, [trackingService, servicesManager, config, searchParams]); // Re-run when config changes (e.g., new study loaded) or URL params change

  // Listen to registration computed events to update matrix display
  React.useEffect(() => {
    if (!servicesManager) {
      return;
    }

    const services = servicesManager.services as any;
    const registrationService = services.registrationService;
    if (!registrationService) {
      return;
    }

    const subscription = registrationService.subscribe('event::registration_computed', () => {
      console.log(
        '🔄 [TrackingPanel] Registration computed event received, matrix should be updated'
      );
      // Matrix is already updated by computeRegistration -> applyRegistrationToNavigation
      // This is just for logging and potential UI updates
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [servicesManager]);

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
  const loadSpecificConfig = React.useCallback(
    async (configId: string) => {
      try {
        setLoading(true);
        setError(null);

        const selectedConfig = availableConfigs.find(
          config => (config.config_id || config.name) === configId
        );
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
            body: JSON.stringify({ configuration: selectedConfig }),
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
    },
    [availableConfigs]
  );

  // Switch tracking mode
  const switchMode = React.useCallback(
    async (mode: string) => {
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
          body: JSON.stringify({ mode }),
        });

        const result = await response.json();
        if (result.success) {
          // Update local config
          if (config) {
            setConfig({
              ...config,
              tracking_mode: { ...config.tracking_mode, current: mode },
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
    },
    [config]
  );

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
        navigationMode: navigationMode,
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
            console.error(
              `   ⚠️ WARNING: Mode mismatch! Requested ${navigationMode} but got ${actualMode}`
            );
          }
        }
      }, 500);
    } catch (error) {
      console.error('❌ Failed to start navigation:', error);
      setError(`Failed to start navigation: ${error.message}`);
    }
  }, [commandsManager, trackingService, currentTrackingConfig, selectedMode, navigationMode]);

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
          instrumentModelsRef.current.forEach(modelData => {
            if (modelData.loaded && modelData.model_id) {
              try {
                modelStateService.removeModel(modelData.model_id);
                removedCount++;
                console.log(`    ✅ Removed model for tool ${modelData.tool_id}`);
              } catch (error) {
                console.error(
                  `    ❌ Failed to remove model for tool ${modelData.tool_id}:`,
                  error
                );
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

  const handleConfigSaved = React.useCallback(
    async (savedConfig: any) => {
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
    },
    [loadConfig, fetchAvailableConfigs]
  );

  const handleConfigApplied = React.useCallback(
    async (appliedConfig: any) => {
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
    },
    [loadConfig, fetchAvailableConfigs]
  );

  // Subscribe to TrackingService events
  React.useEffect(() => {
    if (!trackingService) {
      console.warn('⚠️ TrackingService not available in TrackingPanel');
      return;
    }

    // console.log('📡 TrackingPanel: Subscribing to TrackingService events');

    // Subscribe to tracking updates
    const trackingSub = trackingService.subscribe('event::tracking_update', async data => {
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
          name: data.patient_reference_name || null, // Phase 4: Add patient reference name
          visible: data.patient_reference_visible || false,
          quality: data.patient_reference_quality || 0,
          moved: data.patient_reference_moved || false,
          movement_mm: data.patient_reference_movement || 0,
        },
        tools: data.tools || {},
        timestamp: data.timestamp || new Date().toISOString(),
        frame_number: data.frame_number || 0,
      });

      // Update 3D model transformations (throttled to 20Hz per model)
      // Pass tools data directly to avoid React state closure issue
      setTransformationMatrices(data.tools);

      // Real-time distance annotation updates (throttled)
      if (isRealTimeDistanceEnabledRef.current && selectedToolId && data.tools?.[selectedToolId]) {
        const toolData = data.tools[selectedToolId];
        const screwInfo = selectedScrewRef.current;

        if (toolData?.visible && screwInfo?.key) {
          const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
          if (now - lastDistanceUpdateRef.current >= distanceUpdateThrottleMs) {
            const tooltipPosition = extractTooltipPosition(toolData, selectedToolId);
            const screwPosition = computeScrewCenterPosition({
              position: screwInfo.position,
              transform: screwInfo.transform,
            });

            if (tooltipPosition && screwPosition) {
              drawDistanceMeasurement(screwPosition, tooltipPosition);
              lastDistanceUpdateRef.current = now;
            }
          }
        }
      }

      // 📍 [PR-DEBUG] Log PR data every 5 seconds
      const nowPrDebug = Date.now();
      if (nowPrDebug - lastPrDebugLogRef.current >= prDebugInterval) {
        const pr = data.patient_reference || {};
        const prIcon = pr.visible ? '✅' : '❌';
        console.log(
          `\n📍 [PR-DEBUG-PANEL] Frame ${data.frame_number} @ ${(nowPrDebug / 1000).toFixed(2)}s`
        );
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
          .filter(
            ([toolId, toolData]: [string, any]) =>
              !toolData.is_patient_reference && toolData.visible
          )
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
          hz: 'pr-relative',
        });
      }
    });

    const screwSelectionSub = trackingService.subscribe(
      trackingService.EVENTS.SELECTED_SCREW_UPDATED,
      data => {
        try {
          selectedScrewRef.current = {
            key: (data as any)?.key ?? null,
            position: (data as any)?.position ?? null,
            transform: (data as any)?.transform ?? null,
            length: (data as any)?.length ?? null,
          };

          if (!selectedToolId || !trackingFrame?.tools?.[selectedToolId]) {
            return;
          }
          const toolData = trackingFrame.tools[selectedToolId];
          if (!toolData.visible) {
            return;
          }

          const tooltipPosition = extractTooltipPosition(toolData, selectedToolId);
          // const screwTipPosition = computeScrewTipPosition({
          //   position: data?.position as number[] | null,
          //   transform: data?.transform as number[] | null,
          //   length: data?.length as number | null
          // });
          const screwTipPosition = computeScrewCenterPosition({
            position: data?.position as number[] | null,
            transform: data?.transform as number[] | null,
          });

          if (!tooltipPosition || !screwTipPosition) {
            return;
          }

          drawDistanceMeasurement(screwTipPosition, tooltipPosition);
        } catch (error) {
          console.warn('⚠️ Failed to draw distance measurement:', error);
        }
      }
    );

    return () => {
      trackingSub?.unsubscribe();
      screwSelectionSub?.unsubscribe();
    };
  }, [trackingService, selectedToolId, trackingFrame]);

  // extractTooltipPosition moved to utils.ts

  const computeScrewTipPosition = (payload: {
    position?: number[] | null;
    transform?: number[] | null;
    length?: number | null;
  }): number[] | null => {
    const transform = payload?.transform;
    const length = payload?.length;
    const transformIsValid = Array.isArray(transform) && transform.length === 16;

    const axisY = transformIsValid
      ? ([transform[1], transform[5], transform[9]] as number[])
      : null;
    const translation = transformIsValid
      ? ([transform[3], transform[7], transform[11]] as number[])
      : null;
    const basePosition = (payload?.position as number[] | undefined) || translation || null;

    if (!axisY || !basePosition || !length || length <= 0) {
      return basePosition;
    }

    const axisMag = Math.hypot(axisY[0], axisY[1], axisY[2]);
    if (axisMag === 0) {
      return basePosition;
    }

    const halfLength = length / 2;
    const unitY = [axisY[0] / axisMag, axisY[1] / axisMag, axisY[2] / axisMag];

    return [
      basePosition[0] + unitY[0] * halfLength,
      basePosition[1] + unitY[1] * halfLength,
      basePosition[2] + unitY[2] * halfLength,
    ];
  };

  const computeScrewCenterPosition = (payload: {
    position?: number[] | null;
    transform?: number[] | null;
  }): number[] | null => {
    const transform = payload?.transform;
    const transformIsValid = Array.isArray(transform) && transform.length === 16;

    const translation = transformIsValid
      ? ([transform[3], transform[7], transform[11]] as number[])
      : null;
    const basePosition = (payload?.position as number[] | undefined) || translation || null;

    return basePosition;
  };

  const drawDistanceMeasurement = (screwPos: number[], tooltipPos: number[]) => {
    updateDistanceAnnotationsForMprViewports(screwPos, tooltipPos);
  };

  // Auto-register loaded 3D models that match tracking tool IDs
  React.useEffect(() => {
    if (!trackingFrame || !trackingFrame.tools) {
      return;
    }

    const modelStateService = (servicesManager?.services as any)?.modelStateService;
    if (!modelStateService) {
      return;
    }

    // Get all loaded models from modelStateService
    const allModels = modelStateService.getAllModels();

    // For each tool in the tracking frame
    Object.entries(trackingFrame.tools).forEach(([toolId, toolData]: [string, any]) => {
      // Skip patient reference
      if (toolData.is_patient_reference) {
        return;
      }

      // Check if we already have this tool registered
      if (instrumentModelsRef.current.has(toolId)) {
        return;
      }

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
          color: matchingModel.metadata.color || [0.2, 0.8, 0.2],
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
    !selectedConfigId ||
    (!!currentTrackingConfig && !isNavigating && (!trackingService || !commandsManager)) ||
    (selectedConfigId && !currentTrackingConfig && loading);

  const primaryButtonClass = !currentTrackingConfig
    ? 'bg-blue-600 hover:bg-blue-700'
    : isNavigating
      ? 'bg-red-600 hover:bg-red-700'
      : 'bg-green-600 hover:bg-green-700';

  return (
    <TrackingPanelLayout
      // State
      config={config}
      status={status}
      trackingFrame={trackingFrame}
      loading={loading}
      error={error}
      isNavigating={isNavigating}
      selectedToolId={selectedToolId}
      availableConfigs={availableConfigs}
      selectedConfigId={selectedConfigId}
      currentTrackingConfig={currentTrackingConfig}
      configDialogOpen={configDialogOpen}
      coordinateSystem={coordinateSystem}
      isRealTimeDistanceEnabled={isRealTimeDistanceEnabled}
      alerts={alerts}
      navigationMode={navigationMode}
      // Handlers
      handleStartNavigation={handleStartNavigation}
      handleStopNavigation={handleStopNavigation}
      handleSetCenter={handleSetCenter}
      handleOpenConfigDialog={handleOpenConfigDialog}
      handleCloseConfigDialog={handleCloseConfigDialog}
      handleConfigSaved={handleConfigSaved}
      handleConfigApplied={handleConfigApplied}
      loadSpecificConfig={loadSpecificConfig}
      setSelectedToolId={setSelectedToolId}
      setSelectedConfigId={setSelectedConfigId}
      setAlerts={setAlerts}
      setNavigationMode={setNavigationMode}
      trackingService={trackingService}
      onToggleRealTimeDistance={setIsRealTimeDistanceEnabled}
    />
  );
}

export default PanelTracking;
