/**
 * TrackingService
 * Connects to SyncForge tracking API via REST + WebSocket
 * Updates crosshair position at 100Hz for real-time navigation
 *
 * Phase 2: Updated for integrated SyncForge API
 * Phase 4: Added TypeScript types matching tracking_data.proto
 *           Uses relative API paths with webpack proxy
 */

import { PubSubService } from '@ohif/core';
import type { TrackingFrame, TrackingUpdateEvent } from '../types/tracking.types';
import { getApiBaseUrl } from '../utils/apiConfig';

const EVENTS = {
  TRACKING_STARTED: 'event::tracking_started',
  TRACKING_STOPPED: 'event::tracking_stopped',
  TRACKING_UPDATE: 'event::tracking_update',
  CONNECTION_STATUS: 'event::connection_status',
  SELECTED_SCREW_UPDATED: 'event::selected_screw_updated',
};

class TrackingService extends PubSubService {
  public static REGISTRATION = {
    name: 'trackingService',
    create: ({ servicesManager }) => {
      return new TrackingService(servicesManager);
    },
  };

  private ws: WebSocket | null = null;
  private servicesManager: any;
  private isTracking: boolean = false;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000;
  private apiUrl: string = 'http://localhost:3001';
  private caseId: string | null = null;
  private connectionId: string | null = null;
  private wsUrl: string | null = null;
  private lastMessageTime: number = 0;
  private messageThrottleMs: number = 10; // 10ms = 100Hz max
  private statsData = {
    framesReceived: 0,
    lastUpdate: 0,
    averageFPS: 0,
    fpsHistory: [] as number[],
  };
  private lastConnectionMode: string | null = null;
  private selectedToolId: string | null = null; // Selected tool for visualization
  private coordinateSystem: 'tracker' | 'patient_reference' = 'patient_reference'; // Coordinate system for navigation
  
  

  // Registration transformation matrix (4x4 row-major)
  // Direct transformation: PR space → DICOM space
  // 
  // Transformation pipeline (applied right-to-left):
  //   tooltip_DICOM = prToDicomMatrix × markerToPrMatrix × markerToTooltipMatrix
  // Where:
  //   markerToPrMatrix = marker position in PR space (from NDI tracker)
  //   markerToTooltipMatrix = calibration offset (marker → tooltip)
  //   prToDicomMatrix = registration (PR → DICOM)
  // 
  // Hardcoded for development - obtained from registration procedure
  // private prToDicomMatrix: number[][] = [
  //   [-0.9967, -0.0487, 0.0647, -17.2],
  //   [0.00471, 0.7623, 0.6403, 187.5],
  //   [-0.0811, 0.6454, -0.7593, 62.0],
  //   [0.0000, 0.0000, 0.0000, 1.0000]
  // ]; // PR space to DICOM image space (from registration)
  private prToDicomMatrix: number[][] = [
  [-0.987, -0.0495, 0.1475, -23.63],
    [0.053, 0.7803, 0.6229, 168.7],
    [-0.146, 0.6233, -0.768, 146.4],
    [0.0000, 0.0000, 0.0000, 1.0000]
  ]; // PR space to DICOM image space (from registration)
  

  
  // Instrument calibration matrix (marker array → stylus tooltip)
  // Hardcoded from DR-VR06-A32.cal file
  // This represents the transformation from the NDI marker array to the stylus tooltip
  // Translation: [-17.08mm, +0.10mm, -157.82mm] (tooltip is ~157.8mm away from markers)
  private markerToTooltipMatrix: number[][] = [
    [-1, 0, 0, -17.08],
    [0, 1, 0, 0.10],
    [0, 0, -1, -157.82],
    [0, 0, 0, 1]
  ]; // From DR-VR06-A32.cal
  
  private applyPr2DicomTransform: boolean = true; // Enable/disable transformation
  
  // Debug info for transformation pipeline
  private lastDebugInfo: {
    markerToPrMatrix?: number[][];
    tooltipMatrix?: number[][];
    dicomMatrix?: number[][];
    markerToTooltipMatrix?: number[][];
    prToDicomMatrix?: number[][];
  } = {};
  private lastSelectedScrew: {
    key: string | null;
    position: number[] | null;
    transform: number[] | null;
    length: number | null;
  } = { key: null, position: null, transform: null, length: null };

  // Diagnostic state: Track which matrices have been logged as identity (prevent spam)
  private loggedIdentityMatrices: Set<string> = new Set();

  constructor(servicesManager, config: any = {}) {
    super(EVENTS);
    this.servicesManager = servicesManager;

    // Phase 4: Use centralized API URL helper
    // In development: '' → webpack proxy → localhost:3001
    // In production: can set window.config.syncforge.apiUrl
    this.apiUrl = config.apiUrl || getApiBaseUrl();
    this.caseId = config.caseId || null;
    console.log('🎯 TrackingService initialized', {
      apiUrl: this.apiUrl || '(relative - using webpack proxy)',
      mode: this.apiUrl ? 'absolute URL' : 'relative (proxied)',
    });
  }

  /**
   * Broadcast currently selected screw info so other modules (e.g., navigation, measurement)
   * can react (draw distance lines, jump view, etc).
   */
  public publishSelectedScrew(payload: {
    key: string | null;
    position: number[] | null;
    transform?: number[] | null;
    length?: number | null;
  }) {
    this.lastSelectedScrew = {
      key: payload.key,
      position: payload.position,
      transform: payload.transform || null,
      length: payload.length ?? null,
    };

    this._broadcastEvent(EVENTS.SELECTED_SCREW_UPDATED, {
      key: payload.key,
      position: payload.position,
      transform: payload.transform || null,
      length: payload.length ?? null,
    });
  }

  /**
   * Connect to SyncForge tracking API
   * Step 1: Check if tracking is already active
   * Step 2: Get tracking configuration to determine mode
   * Step 3: Call REST API to get WebSocket URL
   * Step 4: Connect to WebSocket for streaming data
   */
  public async connect(mode?: 'simulation' | 'hardware', apiUrl: string = this.apiUrl): Promise<void> {
    if (this.ws) {
      console.warn('⚠️ Already connected to tracking server');
      return;
    }

    console.log(`🔗 Requesting WebSocket URL from SyncForge API: ${apiUrl}`);
    if (mode) {
      console.log(`🎯 Using specified tracking mode: ${mode}`);
    }

    // Clear all buffers before connecting to ensure clean state
    this._clearBuffers();

    try {
      // Step 1: Check if tracking is already active and disconnect if needed
      try {
        const statusResponse = await fetch(`${apiUrl}/api/tracking/status`);
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();

          // Debug: log full status response
          console.log('📊 Current tracking status:', {
            active: statusData.status?.active,
            mode: statusData.status?.mode,
            python_connected: statusData.status?.python_connected
          });

          if (statusData.success && statusData.status?.active) {
            const currentMode = statusData.status?.mode;
            const requestedMode = mode || currentMode; // Use requested mode or keep current

            // If mode is different or we want to force reconnect, disconnect first
            if (mode && mode !== currentMode) {
              console.log(`🔄 Mode change requested: ${currentMode} → ${mode}, disconnecting first...`);
            } else {
              console.log(`🔄 Tracking already active in ${currentMode} mode, disconnecting for clean reconnect...`);
            }

            // Disconnect the existing connection
            try {
              const disconnectResponse = await fetch(`${apiUrl}/api/tracking/disconnect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
              });

              if (disconnectResponse.ok) {
                console.log('✅ Successfully disconnected previous session');
              }
            } catch (disconnectError) {
              console.warn('⚠️ Error disconnecting:', disconnectError);
            }

            // Wait for cleanup
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            console.log('✅ No active tracking session, proceeding with new connection');
          }
        }
      } catch (statusError) {
        console.warn('⚠️ Could not check tracking status, proceeding with normal connection');
      }

      // Step 2: Determine tracking mode
      let trackingMode = mode; // Use parameter if provided

      if (!trackingMode) {
        // If not provided, get from configuration
        trackingMode = 'simulation'; // Default
        try {
          const configResponse = await fetch(`${apiUrl}/api/tracking/config`);
          if (configResponse.ok) {
            const configData = await configResponse.json();
            trackingMode = configData.tracking_mode?.current || 'simulation';
            console.log(`📋 Using tracking mode from config: ${trackingMode}`);
          }
        } catch (configError) {
          console.warn('⚠️ Could not fetch tracking config, using simulation mode as default');
          trackingMode = 'simulation';
        }
      }

      // Step 3: Call REST API to get WebSocket URL
      console.log(`🔌 Connecting with mode: ${trackingMode}`);
      let response = await fetch(`${apiUrl}/api/tracking/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for OAuth2 authentication
        body: JSON.stringify({
          mode: trackingMode
        })
      });

      // If already connected, disconnect first and retry
      if (!response.ok && response.status === 400) {
        const errorData = await response.json();
        if (errorData.error && errorData.error.includes('already active')) {
          console.warn('⚠️ Tracking already active, disconnecting first...');

          // Disconnect
          await fetch(`${apiUrl}/api/tracking/disconnect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          });

          // Wait a bit for cleanup
          await new Promise(resolve => setTimeout(resolve, 500));

          // Retry connection with same mode
          response = await fetch(`${apiUrl}/api/tracking/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              mode: trackingMode
            })
          });
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API request failed: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();

      if (!data.success || !data.websocket_url) {
        throw new Error('API did not return WebSocket URL');
      }

      console.log(`✅ Got WebSocket URL: ${data.websocket_url}`);
      this.connectionId = data.connection_id;
      this.wsUrl = data.websocket_url;
      this.apiUrl = apiUrl;

      // Store the connection mode for notifications
      this.lastConnectionMode = data.data?.mode || trackingMode;

      // Step 4: Connect to WebSocket
      this._connectWebSocket(data.websocket_url);

    } catch (error) {
      console.error('❌ Failed to connect to tracking API:', error);

      // Show error notification
      const uiNotificationService = this.servicesManager?.services?.uiNotificationService;
      if (uiNotificationService) {
        uiNotificationService.show({
          title: '❌ Tracking Connection Failed',
          message: 'Unable to connect to tracking system. System will use simulation mode if available.',
          type: 'error',
          duration: 6000,
        });
      }

      this._broadcastEvent(EVENTS.CONNECTION_STATUS, {
        connected: false,
        error: error.message || 'Connection failed',
      });
      throw error;
    }
  }

  /**
   * Internal method to establish WebSocket connection
   */
  private _connectWebSocket(wsUrl: string): void {
    console.log(`🔗 Connecting to WebSocket: ${wsUrl}`);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected - tracking data streaming at 100Hz');
        this.isConnected = true;
        this.isTracking = true; // Auto-start tracking with new API
        this.reconnectAttempts = 0;
        this._broadcastEvent(EVENTS.CONNECTION_STATUS, {
          connected: true,
          message: 'Connected to tracking server',
        });
        this._broadcastEvent(EVENTS.TRACKING_STARTED, { mode: 'streaming' });

        // Show connection success notification
        const uiNotificationService = this.servicesManager?.services?.uiNotificationService;
        if (uiNotificationService) {
          // Check if we have mode information from the connection
          const connectionMode = this.lastConnectionMode || 'unknown';
          const modeMessage = connectionMode === 'hardware'
            ? 'Successfully connected to NDI hardware tracker. Receiving real tracking data.'
            : 'Successfully connected to tracking system in simulation mode.';

          uiNotificationService.show({
            title: '🎯 Tracking Connected',
            message: modeMessage,
            type: 'success',
            duration: 4000,
          });
        }
      };

      this.ws.onmessage = event => {
        try {
          // Throttle message processing to max 100Hz
          const now = performance.now();
          if (now - this.lastMessageTime < this.messageThrottleMs) {
            return; // Skip this message to maintain 100Hz max
          }
          this.lastMessageTime = now;

          const message = JSON.parse(event.data);

          // DEBUG: Log first few messages to see what we're receiving
          if (this.statsData.framesReceived < 3) {
            console.log('🔍 [TrackingService] Received message:', {
              type: message.type,
              hasData: !!message.data,
              hasTools: !!message.tools,
              dataHasTools: !!(message.data && message.data.tools),
              keys: Object.keys(message)
            });
          }

          this._handleMessage(message);
        } catch (error) {
          console.error('❌ Error parsing tracking message:', error);
        }
      };

      this.ws.onerror = error => {
        console.error('❌ WebSocket error:', error);
        this._broadcastEvent(EVENTS.CONNECTION_STATUS, {
          connected: false,
          error: 'WebSocket connection error',
        });
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket closed');
        this.isConnected = false;
        this.isTracking = false;
        this.ws = null;

        // Show disconnection notification
        const uiNotificationService = this.servicesManager?.services?.uiNotificationService;
        if (uiNotificationService) {
          uiNotificationService.show({
            title: '🔌 Tracking Disconnected',
            message: 'Connection to tracking server closed. Click "Start Navigation" to reconnect.',
            type: 'info',
            duration: 5000,
          });
        }

        this._broadcastEvent(EVENTS.CONNECTION_STATUS, {
          connected: false,
          message: 'Disconnected from tracking server',
        });

        console.log('✅ WebSocket closed (manual reconnect required)');
      };
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      this._broadcastEvent(EVENTS.CONNECTION_STATUS, {
        connected: false,
        error: 'Failed to create WebSocket',
      });
    }
  }

  /**
   * Clear all tracking data buffers and statistics
   * Called when connecting or disconnecting to ensure clean state
   */
  private _clearBuffers(): void {
    console.log('  ├─ Clearing data buffers');

    // Reset statistics
    this.statsData = {
      framesReceived: 0,
      lastUpdate: 0,
      averageFPS: 0,
      fpsHistory: [],
    };

    // Reset message throttling
    this.lastMessageTime = 0;

    // Reset diagnostic logging state
    this.loggedIdentityMatrices.clear();

    // Reset connection metadata
    this.connectionId = null;
    this.lastConnectionMode = null;
  }

  /**
   * Disconnect from tracking server
   * Closes WebSocket connection (Python tracking server keeps running)
   */
  public disconnect(): void {
    console.log('🔌 Disconnecting from tracking server...');

    if (this.ws) {
      console.log('  ├─ Closing WebSocket connection');
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      this.isTracking = false;
    }

    // Clear all data buffers
    this._clearBuffers();

    // Reset diagnostic logging state
    this.loggedIdentityMatrices.clear();

    // Clear wsUrl to prevent any reconnection attempts
    this.wsUrl = null;
    this.reconnectAttempts = 0;

    // Broadcast disconnection event
    this._broadcastEvent(EVENTS.CONNECTION_STATUS, {
      connected: false,
      message: 'Disconnected from tracking server',
    });

    console.log('✅ Disconnect complete (Python server still running)');
  }

  /**
   * Set the case ID for tracking session
   */
  public setCaseId(caseId: string): void {
    this.caseId = caseId;
    console.log(`📋 Case ID set: ${caseId}`);
  }

  /**
   * @deprecated No longer needed with new API - tracking starts automatically on connection
   */
  public startTracking(mode: string = 'circular'): void {
    console.warn('⚠️ startTracking() is deprecated - tracking starts automatically on connection');
  }

  /**
   * @deprecated No longer needed with new API - use disconnect() instead
   */
  public stopTracking(): void {
    console.warn('⚠️ stopTracking() is deprecated - use disconnect() instead');
    this.disconnect();
  }

  /**
   * @deprecated No longer supported with new API
   */
  public setMode(mode: string): void {
    console.warn('⚠️ setMode() is no longer supported with new API');
  }

  /**
   * @deprecated No longer supported with new API - simulator runs independently
   */
  public setCenter(position: number[]): void {
    console.warn('⚠️ setCenter() is no longer supported with new API');
  }

  /**
   * Get tracking statistics
   */
  public getStats() {
    return { ...this.statsData };
  }

  /**
   * Get connection status
   */
  public getStatus() {
    return {
      connected: this.isConnected,
      tracking: this.isTracking,
    };
  }

  /**
   * Handle incoming messages from tracking server
   *
   * This method acts as a simple router for different message types:
   * - 'connection': Server connection confirmations
   * - 'tracking_data'/'tracking_update': Raw tracking data (passed to _handleTrackingUpdate)
   * - 'configuration'/'subscription'/'frequency': Server configuration responses
   * - 'alert': System alerts and warnings
   *
   * For tracking data, it simply passes the raw message to _handleTrackingUpdate
   * for complete processing and broadcasting.
   */
  private _handleMessage(message: any): void {
    const { type } = message;

    switch (type) {
      case 'connection':
        console.log('✅ Server connection confirmed');
        break;

      case 'tracking_data': // Server sends 'tracking_data', not 'tracking_update'
      case 'tracking_update': // Keep for backward compatibility
        // Pass raw message data to tracking update handler for processing
        this._handleTrackingUpdate(message);
        break;

      case 'configuration':
      case 'subscription':
      case 'frequency':
        console.log(`📨 Server response:`, message);
        break;

      case 'alert':
        // Handle system alerts (warnings, errors, info)
        const severity = message.severity || 'info';
        const alertMessage = message.message || 'Unknown alert';
        const category = message.category || 'system';

        if (severity === 'error') {
          console.error(`🚨 [${category}] ${alertMessage}`);
        } else if (severity === 'warning') {
          console.warn(`⚠️ [${category}] ${alertMessage}`);
        } else {
          console.info(`ℹ️ [${category}] ${alertMessage}`);
        }

        // Broadcast alert to UI
        this._broadcastEvent('TRACKING_ALERT', {
          severity,
          category,
          message: alertMessage,
          timestamp: message.timestamp
        });
        break;

      default:
        console.log('📨 Unknown message type:', type, message);
    }
  }

  /**
   * Process tracking data and broadcast updates (called at 100Hz)
   *
   * This method handles the complete tracking data processing pipeline:
   * 1. Tool Selection: Find the primary tracked tool for navigation
   * 2. Data Extraction: Extract position/orientation/matrix from coordinate system
   * 3. Coordinate Transformation: Apply PR→DICOM transforms if enabled
   * 4. Matrix Calculations: Compute tooltip and DICOM matrices for all tools
   * 5. Event Broadcasting: Send processed data to navigation and UI components
   */
  private _handleTrackingUpdate(message: any): void {
    // Update frame statistics
    this.statsData.framesReceived++;
    const now = performance.now();
    if (this.statsData.lastUpdate > 0) {
      const deltaTime = now - this.statsData.lastUpdate;
      const fps = 1000 / deltaTime;
      this.statsData.fpsHistory.push(fps);
      if (this.statsData.fpsHistory.length > 100) {
        this.statsData.fpsHistory.shift();
      }
      this.statsData.averageFPS =
        this.statsData.fpsHistory.reduce((a, b) => a + b, 0) / this.statsData.fpsHistory.length;
    }
    this.statsData.lastUpdate = now;

    // Extract data from message (support both wrapped and direct formats)
    const messageData = message.data || message;
    const tools = messageData.tools;

    if (!tools) {
      if (this.statsData.framesReceived < 3) {
        console.warn('⚠️ No tools in tracking data');
      }
      return;
    }

    // DEBUG: Log data structure for first few messages
    if (this.statsData.framesReceived < 3) {
      console.log('🔍 [TrackingService] Processing tracking data:', {
        hasData: !!message.data,
        hasTools: !!tools,
        toolKeys: Object.keys(tools),
      });
    }

    // Phase 1: Find primary tracked tool for navigation (skip patient reference)
    // The primary tool is used for camera following and crosshair positioning.
    // We prefer the user-selected tool, but fall back to the first available tracked tool.
    let primaryTool: any = null;
    let primaryToolId: string | null = null;

    // Strategy: Use selected tool if available, otherwise find first non-PR tool
    if (this.selectedToolId && tools[this.selectedToolId]) {
      const selectedTool = tools[this.selectedToolId] as any;
      if (!selectedTool.is_patient_reference) {
        primaryTool = selectedTool;
        primaryToolId = this.selectedToolId;
      }
    }

    // Fallback: Find first non-PR tool if no selection or selected tool not available
    if (!primaryTool) {
      for (const [toolId, toolData] of Object.entries(tools)) {
        const tool = toolData as any;
        if (tool.is_patient_reference) continue;

        primaryTool = tool;
        primaryToolId = toolId;

        // Auto-select first tool if no selection
        if (!this.selectedToolId) {
          this.selectedToolId = toolId;
        }
        break;
      }
    }

    if (!primaryTool) {
      if (this.statsData.framesReceived < 5) {
        console.error('❌ No primary tool found after scanning all tools');
        console.error('   Available tools:', Object.keys(tools));
        console.error('   Selected tool ID:', this.selectedToolId);
      }
      return;
    }

    // Phase 2: Extract position, orientation, and matrix from selected coordinate system
    // coordinateSystem can be 'tracker' (raw tracker space) or 'patient_reference' (PR-relative).
    // For 'tracker': use direct matrix from coords.matrix
    // For 'patient_reference': use rM{toolId} matrix (marker array in PR space)
    const coordSysKey = this.coordinateSystem === 'tracker' ? 'tracker' : 'register';
    const coords = primaryTool.coordinates?.[coordSysKey];

    const position = coords?.position_mm;
    const rotation = coords?.rotation_deg || [0, 0, 0];

    // Construct matrix key dynamically (rM + toolId for register, matrix for tracker)
    let matrix;
    let matrixKey = '';

    if (this.coordinateSystem === 'tracker') {
      matrixKey = 'matrix';
      matrix = coords?.matrix;
    } else {
      matrixKey = `rM${primaryToolId}`;
      matrix = coords?.[matrixKey];

      // If matrix not found, try to find ANY matrix key in coords
      if (!matrix && coords) {
        const availableMatrixKeys = Object.keys(coords).filter(k => k.startsWith('rM'));
        if (availableMatrixKeys.length > 0) {
          matrixKey = availableMatrixKeys[0];
          matrix = coords[matrixKey];
          if (this.statsData.framesReceived < 3) {
            console.warn(`⚠️ Expected matrix key '${`rM${primaryToolId}`}' not found, using '${matrixKey}' instead`);
          }
        }
      }
    }

    // Debug logging for first few frames
    if (this.statsData.framesReceived < 3) {
      console.log('🎯 [TrackingService] Using primary tool:', {
        toolId: primaryToolId,
        toolName: primaryTool.tool_name,
        coordinateSystem: this.coordinateSystem,
        coordSysKey: coordSysKey,
        matrixKey: matrixKey,
        hasPosition: !!position,
        position: position,
        hasMatrix: !!matrix,
        matrixType: matrix ? (Array.isArray(matrix) ? `Array[${matrix.length}]` : typeof matrix) : 'null'
      });
    }

    // Phase 3: Apply PR to DICOM transformation with instrument calibration if enabled
    // This transforms coordinates from Patient Reference space to DICOM image space.
    // Only applied when using 'patient_reference' coordinate system.
    // Pipeline: marker position → instrument tooltip → DICOM space
    // Formula: tooltip_DICOM = prToDicomMatrix × markerToPrMatrix × markerToTooltipMatrix
    let finalMatrix = matrix;
    let finalPosition = position;

    const isUsingPrRelativeCoords = this.coordinateSystem === 'patient_reference';

    if (this.applyPr2DicomTransform && matrix && isUsingPrRelativeCoords) {
      // Transform matrix from marker array to DICOM space
      // Pipeline: marker position → instrument tooltip → DICOM space
      finalMatrix = this._applyPr2DicomTransform(matrix);
      finalPosition = this._extractPositionFromMatrix(finalMatrix);

      if (this.statsData.framesReceived < 3) {
        console.log('🔄 [TrackingService] Applied PR to DICOM transform:', {
          originalPosition: position,
          transformedPosition: finalPosition,
        });
      }
    } else if (this.applyPr2DicomTransform && matrix && !isUsingPrRelativeCoords) {
      if (this.statsData.framesReceived < 3) {
        console.warn('⚠️ [TrackingService] pr2dicom enabled but using tracker coordinates - skipping transform');
      }
    }

    // Phase 4: Calculate tooltip matrices and DICOM matrices for each tool
    // For 3D model rendering, we need matrices in different coordinate spaces:
    // - Tooltip matrix (tM{toolId}): Instrument tip position in PR space
    // - DICOM matrix (dM{toolId}): Instrument tip position in DICOM image space
    // These are used by the 3D rendering engine for accurate tool visualization.
    const toolsWithTooltipMatrices = { ...tools };

    Object.entries(tools).forEach(([toolId, toolData]: [string, any]) => {
      if (toolData.is_patient_reference) return; // Skip patient reference

      // Get marker position matrix in PR space
      const toolMatrixKey = `rM${toolId}`;
      const markerToPrMatrix = toolData.coordinates?.register?.[toolMatrixKey] ||
                               toolData.coordinates?.patient_reference?.[toolMatrixKey];

      if (markerToPrMatrix) {
        // Step 1: Calculate tooltip matrix in PR space
        // tooltipMatrix = markerToPrMatrix × markerToTooltipMatrix
        const tooltipMatrix = this._multiplyMatrix4x4(markerToPrMatrix, this.markerToTooltipMatrix);

        // Step 2: Calculate DICOM matrix for 3D model rendering
        // dicomMatrix = prToDicomMatrix × tooltipMatrix
        const dicomMatrix = this._multiplyMatrix4x4(this.prToDicomMatrix, tooltipMatrix);

        // Store matrices in tool data
        if (!toolsWithTooltipMatrices[toolId].coordinates) {
          toolsWithTooltipMatrices[toolId].coordinates = {};
        }
        if (!toolsWithTooltipMatrices[toolId].coordinates.patient_reference) {
          toolsWithTooltipMatrices[toolId].coordinates.patient_reference = {};
        }
        if (!toolsWithTooltipMatrices[toolId].coordinates.dicom) {
          toolsWithTooltipMatrices[toolId].coordinates.dicom = {};
        }

        // Store tooltip matrix (PR-relative space) as tM{toolId}
        toolsWithTooltipMatrices[toolId].coordinates.patient_reference[`tM${toolId}`] = tooltipMatrix;

        // Store DICOM matrix (DICOM image space) as dM{toolId}
        toolsWithTooltipMatrices[toolId].coordinates.dicom[`dM${toolId}`] = dicomMatrix;
      }
    });

    // Phase 5: Broadcast processed tracking data to listeners
    // Sends the complete processed tracking update to:
    // - NavigationController: For camera following and crosshair positioning
    // - TrackingPanel: For UI updates and statistics display
    // - Other components that need real-time tracking data
    this._broadcastEvent(EVENTS.TRACKING_UPDATE, {
      position: finalPosition,
      orientation: rotation,
      timestamp: messageData.timestamp,
      frame_id: messageData.frame_number,
      frame_number: messageData.frame_number, // Alias for TrackingPanel compatibility
      matrix: finalMatrix,
      quality: primaryTool.quality,
      quality_score: primaryTool.quality_score,
      visible: primaryTool.visible,
      tool_id: primaryToolId,
      tool_name: primaryTool.tool_name,
      tools: toolsWithTooltipMatrices,
      // Patient reference data (needed by TrackingPanel)
      patient_reference_id: messageData.patient_reference?.id,
      patient_reference_name: messageData.patient_reference?.name,
      patient_reference_visible: messageData.patient_reference?.visible,
      patient_reference_quality: messageData.patient_reference?.quality,
      patient_reference_moved: messageData.patient_reference?.moved,
      patient_reference_movement: messageData.patient_reference?.movement_mm,
    });
  }

  /**
   * Set the selected tool ID for visualization
   * Only the selected tool will be used for navigation/projection
   */
  public setSelectedTool(toolId: string | null): void {
    this.selectedToolId = toolId;
    // console.log(`🎯 Selected tool for visualization: ${toolId || 'none'}`);
  }

  /**
   * Set the coordinate system for navigation (tracker or patient_reference)
   * This determines which coordinate space is used for position extraction
   */
  public setCoordinateSystem(system: 'tracker' | 'patient_reference'): void {
    this.coordinateSystem = system;
    console.log(`🧭 Coordinate system for navigation: ${system}`);
  }

  /**
   * Get the currently selected coordinate system
   */
  public getCoordinateSystem(): 'tracker' | 'patient_reference' {
    return this.coordinateSystem;
  }

  /**
   * Get the currently selected tool ID
   */
  public getSelectedTool(): string | null {
    return this.selectedToolId;
  }

  /**
   * Show a notification about the current tracking mode
   * Useful for testing or manual mode indication
   */
  public showModeNotification(): void {
    const uiNotificationService = this.servicesManager?.services?.uiNotificationService;
    if (!uiNotificationService) return;

    // Check current status
    fetch(`${this.apiUrl}/api/tracking/status`)
      .then(response => response.json())
      .then(data => {
        if (data.success && data.status) {
          const mode = data.status.mode;
          const isActive = data.status.active;

          const modeMessage = mode === 'hardware'
            ? 'Connected to NDI hardware tracker - receiving real data'
            : 'Using simulation mode - hardware tracker not available';

          const modeType = (mode === 'hardware' && isActive) ? 'success' :
                          (!isActive) ? 'warning' : 'info';

          uiNotificationService.show({
            title: `🔌 Tracking Status: ${mode.toUpperCase()}`,
            message: modeMessage,
            type: modeType,
            duration: 4000,
          });
        }
      })
      .catch(error => {
        console.warn('Could not get tracking status for notification:', error);
      });
  }

  /**
   * Debug method: Log current tracking data to console
   * Call this from browser console: window.services.trackingService.logCurrentData()
   */
  public logCurrentData(): void {
    console.log('🎯 CURRENT TRACKING DATA DEBUG');
    console.log('Connected:', this.isConnected);
    console.log('Tracking:', this.isTracking);
    console.log('WebSocket URL:', this.wsUrl);
    console.log('Frames received:', this.statsData.framesReceived);
    console.log('API URL:', this.apiUrl);

    // Try to get status from server
    fetch(`${this.apiUrl}/api/tracking/status`)
      .then(response => response.json())
      .then(data => {
        console.log('Server status:', data);
      })
      .catch(error => {
        console.error('Could not get server status:', error);
      });
  }

  /**
   * DIAGNOSTIC: Check if a 4x4 matrix is identity or has zero translation
   * Issues warning but continues with calculations
   *
   * @param matrix - 4x4 matrix to check
   * @param matrixName - Descriptive name for logging
   * @returns Object with identity checks
   */
  private _checkMatrixIdentity(matrix: number[] | number[][], matrixName: string): {
    isIdentityRotation: boolean;
    isZeroTranslation: boolean;
    translation: number[];
    rotation: number[][];
  } {
    // Convert to 2D format for analysis
    let mat2D: number[][];
    let is3x3Matrix = false;

    if (Array.isArray(matrix) && matrix.length === 4 && Array.isArray(matrix[0])) {
      // 4x4 matrix
      mat2D = matrix as number[][];
    } else if (Array.isArray(matrix) && matrix.length === 3 && Array.isArray(matrix[0]) && matrix[0].length === 3) {
      // 3x3 matrix (rotation only)
      mat2D = matrix as number[][];
      is3x3Matrix = true;
    } else if (Array.isArray(matrix) && matrix.length >= 16 && typeof matrix[0] === 'number') {
      // Flat 4x4 array
      const flat = matrix as number[];
      mat2D = [
        [flat[0], flat[1], flat[2], flat[3]],
        [flat[4], flat[5], flat[6], flat[7]],
        [flat[8], flat[9], flat[10], flat[11]],
        [flat[12], flat[13], flat[14], flat[15]]
      ];
    } else {
      console.warn(`⚠️ [${matrixName}] Invalid matrix format for identity check`);
      return {
        isIdentityRotation: false,
        isZeroTranslation: false,
        translation: [0, 0, 0],
        rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
      };
    }

    // Extract components based on matrix type
    let translation: number[];
    let rotation: number[][];

    if (is3x3Matrix) {
      // 3x3 matrix: pure rotation, no translation
      translation = [0, 0, 0]; // No translation component
      rotation = mat2D as number[][]; // The matrix itself is the rotation
    } else {
      // 4x4 matrix: extract rotation and translation
      translation = [mat2D[0][3], mat2D[1][3], mat2D[2][3]];
      rotation = [
        [mat2D[0][0], mat2D[0][1], mat2D[0][2]],
        [mat2D[1][0], mat2D[1][1], mat2D[1][2]],
        [mat2D[2][0], mat2D[2][1], mat2D[2][2]]
      ];
    }

    // Check for identity rotation (within tolerance)
    const tol = 0.001;
    const isIdentityRotation =
      Math.abs(rotation[0][0] - 1) < tol && Math.abs(rotation[0][1]) < tol && Math.abs(rotation[0][2]) < tol &&
      Math.abs(rotation[1][0]) < tol && Math.abs(rotation[1][1] - 1) < tol && Math.abs(rotation[1][2]) < tol &&
      Math.abs(rotation[2][0]) < tol && Math.abs(rotation[2][1]) < tol && Math.abs(rotation[2][2] - 1) < tol;

    // Check for zero translation (within tolerance)
    const isZeroTranslation =
      Math.abs(translation[0]) < tol && Math.abs(translation[1]) < tol && Math.abs(translation[2]) < tol;

    // Create unique key for this matrix type
    const matrixKey = matrixName;

    // Only log warnings once per matrix type
    if (is3x3Matrix) {
      // For 3x3 matrices, only check rotation (no translation component)
      if (isIdentityRotation) {
        if (!this.loggedIdentityMatrices.has(`${matrixKey}_identity_rotation`)) {
          console.warn(`⚠️ [${matrixName}] IDENTITY ROTATION MATRIX`);
          console.warn(`   3x3 rotation matrix is identity (no orientation transform)`);
          console.warn(`   Rotation: [${rotation[0].map(v => v.toFixed(4)).join(', ')}]`);
          console.warn(`   ℹ️ Continuing with calculations... (this warning shown once)`);
          this.loggedIdentityMatrices.add(`${matrixKey}_identity_rotation`);
        }
      } else {
        // Non-identity 3x3 matrix
        if (!this.loggedIdentityMatrices.has(`${matrixKey}_valid`)) {
          console.log(`✅ [${matrixName}] Non-identity 3x3 rotation matrix detected`);
          console.log(`   Rotation: [${rotation[0].map(v => v.toFixed(4)).join(', ')}]`);
          this.loggedIdentityMatrices.add(`${matrixKey}_valid`);
        }
      }
    } else {
      // For 4x4 matrices, check both rotation and translation
      if (isIdentityRotation && isZeroTranslation) {
        if (!this.loggedIdentityMatrices.has(`${matrixKey}_full_identity`)) {
          console.warn(`⚠️⚠️⚠️ [${matrixName}] FULL IDENTITY MATRIX ⚠️⚠️⚠️`);
          console.warn(`   Matrix is complete identity (rotation + translation)`);
          console.warn(`   Translation: [${translation.map(v => v.toFixed(4)).join(', ')}]`);
          console.warn(`   Rotation: [${rotation[0].map(v => v.toFixed(4)).join(', ')}]`);
          console.warn(`   ℹ️ Continuing with calculations... (this warning shown once)`);
          this.loggedIdentityMatrices.add(`${matrixKey}_full_identity`);
        }
      } else if (isIdentityRotation) {
        if (!this.loggedIdentityMatrices.has(`${matrixKey}_identity_rotation`)) {
          console.warn(`⚠️ [${matrixName}] IDENTITY ROTATION`);
          console.warn(`   Rotation matrix is identity (no orientation transform)`);
          console.warn(`   Translation: [${translation.map(v => v.toFixed(2)).join(', ')}]`);
          console.warn(`   ℹ️ Continuing with calculations... (this warning shown once)`);
          this.loggedIdentityMatrices.add(`${matrixKey}_identity_rotation`);
        }
      } else if (isZeroTranslation) {
        if (!this.loggedIdentityMatrices.has(`${matrixKey}_zero_translation`)) {
          console.warn(`⚠️ [${matrixName}] ZERO TRANSLATION`);
          console.warn(`   Translation vector is zero (no position transform)`);
          console.warn(`   Rotation: [${rotation[0].map(v => v.toFixed(4)).join(', ')}]`);
          console.warn(`   ℹ️ Continuing with calculations... (this warning shown once)`);
          this.loggedIdentityMatrices.add(`${matrixKey}_zero_translation`);
        }
      } else {
        // Non-identity matrices: only log once when first detected as valid
        if (!this.loggedIdentityMatrices.has(`${matrixKey}_valid`)) {
          console.log(`✅ [${matrixName}] Non-identity matrix detected`);
          console.log(`   Translation: [${translation.map(v => v.toFixed(2)).join(', ')}]`);
          this.loggedIdentityMatrices.add(`${matrixKey}_valid`);
        }
        // After first valid detection, don't log anymore for this matrix type
      }
    }

    return {
      isIdentityRotation,
      isZeroTranslation,
      translation,
      rotation
    };
  }

  /**
   * Multiply two 4x4 matrices (row-major order)
   * Result = A * B
   */
  private _multiplyMatrix4x4(A: number[][], B: number[][]): number[][] {
    const result: number[][] = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ];

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        for (let k = 0; k < 4; k++) {
          result[i][j] += A[i][k] * B[k][j];
        }
      }
    }

    return result;
  }

  /**
   * Invert a 4x4 matrix using Gaussian elimination
   * Returns identity matrix if the matrix is singular or near-singular
   * @param matrix - 4x4 matrix to invert
   * @returns Inverted 4x4 matrix
   */
  private _invertMatrix4x4(matrix: number[][]): number[][] {
    // Create augmented matrix [A | I]
    const augmented: number[][] = [];
    for (let i = 0; i < 4; i++) {
      augmented[i] = [...matrix[i], 0, 0, 0, 0];
      augmented[i][4 + i] = 1; // Identity matrix on the right
    }

    // Forward elimination with partial pivoting
    for (let col = 0; col < 4; col++) {
      // Find pivot
      let maxRow = col;
      for (let row = col + 1; row < 4; row++) {
        if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
          maxRow = row;
        }
      }

      // Check for singular matrix
      if (Math.abs(augmented[maxRow][col]) < 1e-10) {
        console.warn('⚠️ Matrix is singular or near-singular, returning identity matrix');
        return [
          [1, 0, 0, 0],
          [0, 1, 0, 0],
          [0, 0, 1, 0],
          [0, 0, 0, 1]
        ];
      }

      // Swap rows if needed
      if (maxRow !== col) {
        [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];
      }

      // Scale pivot row
      const pivot = augmented[col][col];
      for (let j = 0; j < 8; j++) {
        augmented[col][j] /= pivot;
      }

      // Eliminate column
      for (let row = 0; row < 4; row++) {
        if (row !== col) {
          const factor = augmented[row][col];
          for (let j = 0; j < 8; j++) {
            augmented[row][j] -= factor * augmented[col][j];
          }
        }
      }
    }

    // Extract inverse matrix from right side of augmented matrix
    const inverse: number[][] = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        inverse[i][j] = augmented[i][4 + j];
      }
    }

    return inverse;
  }

  /**
   * Convert flat array (16 elements) to 4x4 matrix (row-major)
   */
  private _flatToMatrix4x4(flat: number[]): number[][] {
    if (!flat || flat.length < 16) {
      return [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
      ];
    }
    return [
      [flat[0], flat[1], flat[2], flat[3]],
      [flat[4], flat[5], flat[6], flat[7]],
      [flat[8], flat[9], flat[10], flat[11]],
      [flat[12], flat[13], flat[14], flat[15]]
    ];
  }

  /**
   * Convert 4x4 matrix to flat array (16 elements, row-major)
   */
  private _matrix4x4ToFlat(matrix: number[][]): number[] {
    return [
      matrix[0][0], matrix[0][1], matrix[0][2], matrix[0][3],
      matrix[1][0], matrix[1][1], matrix[1][2], matrix[1][3],
      matrix[2][0], matrix[2][1], matrix[2][2], matrix[2][3],
      matrix[3][0], matrix[3][1], matrix[3][2], matrix[3][3]
    ];
  }

  /**
   * Apply PR to DICOM transformation with instrument calibration
   * Transforms coordinates from Patient Reference space to DICOM image space
   * Pipeline: marker position → instrument tooltip → DICOM space
   * Formula: tooltip_DICOM = prToDicomMatrix × markerToPrMatrix × markerToTooltipMatrix
   *
   * @param markerToPrMatrix - 4x4 matrix for marker array in PR space (can be 2D array or flat array)
   * @returns Transformed 4x4 matrix in DICOM space (same format as input)
   */
  private _applyPr2DicomTransform(markerToPrMatrix: number[][] | number[]): number[][] | number[] {
    if (!markerToPrMatrix) return markerToPrMatrix;

    // Detect if input is flat array or 2D array
    const isFlat = !Array.isArray(markerToPrMatrix[0]);

    // Convert to 4x4 if needed
    let markerMatrix4x4: number[][];
    if (isFlat) {
      markerMatrix4x4 = this._flatToMatrix4x4(markerToPrMatrix as number[]);
    } else {
      markerMatrix4x4 = markerToPrMatrix as number[][];
    }

    // DIAGNOSTIC: Check input matrices for identity
    this._checkMatrixIdentity(markerMatrix4x4, "Input Matrix (markerToPrMatrix)");
    this._checkMatrixIdentity(this.markerToTooltipMatrix, "Calibration Matrix (markerToTooltipMatrix)");
    this._checkMatrixIdentity(this.prToDicomMatrix, "Registration Matrix (prToDicomMatrix)");

    // Step 1: Transform from marker array to stylus tooltip
    // tooltipMatrix = markerToPrMatrix × markerToTooltipMatrix
    // This applies the calibration transform to the marker position
    const tooltipMatrix = this._multiplyMatrix4x4(markerMatrix4x4, this.markerToTooltipMatrix);

    // DIAGNOSTIC: Check intermediate result
    this._checkMatrixIdentity(tooltipMatrix, "Intermediate Matrix (tooltipMatrix)");

    // Step 2: Transform from PR-relative tooltip to DICOM space
    // dicomMatrix = prToDicomMatrix × tooltipMatrix
    const dicomMatrix = this._multiplyMatrix4x4(this.prToDicomMatrix, tooltipMatrix);

    // DIAGNOSTIC: Check final result
    this._checkMatrixIdentity(dicomMatrix, "Final DICOM Matrix (output result)");

    // Store debug info (deep copy to avoid reference issues)
    this.lastDebugInfo = {
      markerToPrMatrix: markerMatrix4x4.map(row => [...row]),
      tooltipMatrix: tooltipMatrix.map(row => [...row]),
      dicomMatrix: dicomMatrix.map(row => [...row]),
      markerToTooltipMatrix: this.markerToTooltipMatrix.map(row => [...row]),
      prToDicomMatrix: this.prToDicomMatrix.map(row => [...row])
    };

    // Return in same format as input
    if (isFlat) {
      return this._matrix4x4ToFlat(dicomMatrix);
    }
    return dicomMatrix;
  }

  /**
   * Extract position from 4x4 transformation matrix
   * @param matrix - 4x4 matrix (2D array or flat array)
   * @returns [x, y, z] position in mm
   */
  private _extractPositionFromMatrix(matrix: number[][] | number[]): number[] {
    if (!matrix) return [0, 0, 0];

    // Handle flat array
    if (!Array.isArray(matrix[0])) {
      const flat = matrix as number[];
      return [flat[3], flat[7], flat[11]]; // Translation is in column 4 (indices 3, 7, 11)
    }

    // Handle 2D array
    const m = matrix as number[][];
    return [m[0][3], m[1][3], m[2][3]];
  }

  /**
   * Set the PR to DICOM registration matrix
   * This matrix transforms coordinates from Patient Reference space to DICOM image space
   * @param matrix - 4x4 transformation matrix (row-major)
   */
  public setPrToDicomMatrix(matrix: number[][]): void {
    this.prToDicomMatrix = matrix;

    // DIAGNOSTIC: Check the matrix being set
    this._checkMatrixIdentity(matrix, "PR to DICOM Matrix (being set)");

    console.log('🔄 PR to DICOM matrix updated');
  }

  /**
   * Get the PR to DICOM registration matrix
   * @returns 4x4 transformation matrix (row-major)
   */
  public getPrToDicomMatrix(): number[][] {
    return this.prToDicomMatrix;
  }

  /**
   * Set the instrument calibration matrix (marker array to stylus tooltip)
   * This matrix is loaded from the .cal file for the tracked instrument
   * @param matrix - 4x4 transformation matrix (row-major)
   */
  public setMarkerToTooltipMatrix(matrix: number[][]): void {
    this.markerToTooltipMatrix = matrix;

    // DIAGNOSTIC: Check the matrix being set
    this._checkMatrixIdentity(matrix, "Marker-to-Tooltip Matrix (being set)");

    console.log('🔄 Marker-to-Tooltip calibration matrix updated');
  }

  /**
   * Get the instrument calibration matrix (marker array to stylus tooltip)
   * @returns 4x4 transformation matrix (row-major)
   */
  public getMarkerToTooltipMatrix(): number[][] {
    return this.markerToTooltipMatrix;
  }

  /**
   * Load instrument calibration from .cal file content
   * .cal file format: 4 lines of 4 values each (4x4 transformation matrix)
   * @param calFileContent - String content of the .cal file
   */
  public loadCalibrationFromFile(calFileContent: string): void {
    try {
      const lines = calFileContent.trim().split('\n');
      if (lines.length !== 4) {
        throw new Error(`Expected 4 lines in .cal file, got ${lines.length}`);
      }

      const matrix: number[][] = [];
      for (const line of lines) {
        const values = line.trim().split(/\s+/).map(v => parseFloat(v));
        if (values.length !== 4) {
          throw new Error(`Expected 4 values per line, got ${values.length}`);
        }
        matrix.push(values);
      }

      this.setMarkerToTooltipMatrix(matrix);
      console.log('✅ Calibration matrix loaded from .cal file:', matrix);

      // DIAGNOSTIC: Check loaded matrix (this will be done by setMarkerToTooltipMatrix, but let's be explicit)
      this._checkMatrixIdentity(matrix, "Calibration Matrix (loaded from .cal file)");
    } catch (error) {
      console.error('❌ Failed to load calibration from .cal file:', error);
      throw error;
    }
  }

  /**
   * @deprecated Use setPrToDicomMatrix instead
   * Set the PR to DICOM transformation matrix
   * @param matrix - 4x4 transformation matrix (row-major)
   */
  public setPr2DicomMatrix(matrix: number[][]): void {
    console.warn('⚠️ setPr2DicomMatrix is deprecated. Use setPrToDicomMatrix instead.');
    this.setPrToDicomMatrix(matrix);
  }

  /**
   * @deprecated Use setPrToDicomMatrix instead
   */
  public setDicomToRMatrix(matrix: number[][]): void {
    console.warn('⚠️ setDicomToRMatrix is deprecated. Use setPrToDicomMatrix instead.');
    this.setPrToDicomMatrix(matrix);
  }

  /**
   * @deprecated Use setPrToDicomMatrix instead
   */
  public setPrToRMatrix(matrix: number[][]): void {
    console.warn('⚠️ setPrToRMatrix is deprecated. Use setPrToDicomMatrix instead.');
    this.setPrToDicomMatrix(matrix);
  }

  /**
   * Enable or disable the PR to DICOM transformation
   */
  public setApplyPr2DicomTransform(enabled: boolean): void {
    this.applyPr2DicomTransform = enabled;
    console.log(`🔄 PR to DICOM transform: ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get debug information about the last transformation
   * Returns intermediate matrices from the transformation pipeline
   */
  public getTransformDebugInfo(): {
    markerToPrMatrix?: number[][];
    tooltipMatrix?: number[][];
    dicomMatrix?: number[][];
    markerToTooltipMatrix?: number[][];
    prToDicomMatrix?: number[][];
    // Current configuration matrices
    currentPrToDicom: number[][];
    currentMarkerToTooltip: number[][];
  } {
    return {
      ...this.lastDebugInfo,
      currentPrToDicom: this.prToDicomMatrix,
      currentMarkerToTooltip: this.markerToTooltipMatrix
    };
  }
}

export default TrackingService;
export { EVENTS as TRACKING_EVENTS };
