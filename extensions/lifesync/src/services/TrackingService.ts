/**
 * TrackingService
 * Connects to SyncForge tracking API via REST + WebSocket
 * Updates crosshair position at 100Hz for real-time navigation
 *
 * Phase 2: Updated for integrated SyncForge API
 * Phase 4: Added TypeScript types matching tracking_data.proto
 *           Uses relative API paths with webpack proxy
 */

import { PubSubService, servicesManager } from '@ohif/core';
import type { TrackingFrame, TrackingUpdateEvent } from '../types/tracking.types';
import { getApiBaseUrl } from '../utils/apiConfig';

const EVENTS = {
  TRACKING_STARTED: 'event::tracking_started',
  TRACKING_STOPPED: 'event::tracking_stopped',
  TRACKING_UPDATE: 'event::tracking_update',
  CONNECTION_STATUS: 'event::connection_status',
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
   * Updated for Protocol Buffer format from integrated API
   */
  private _handleMessage(message: any): void {
    const { type } = message;

    switch (type) {
      case 'connection':
        console.log('✅ Server connection confirmed');
        break;

      case 'tracking_data': // Server sends 'tracking_data', not 'tracking_update'
      case 'tracking_update': // Keep for backward compatibility
        // DEBUG: Log data structure for first few messages
        if (this.statsData.framesReceived < 3) {
          console.log('🔍 [TrackingService] Processing tracking data:', {
            hasData: !!message.data,
            hasTools: !!message.data?.tools,
            toolKeys: message.data?.tools ? Object.keys(message.data.tools) : [],
          });
        }

        // Phase 3: Dynamic tool discovery - find the primary tracked tool (not patient reference)
        const tools = message.data?.tools || message.tools;

        if (!tools) {
          if (this.statsData.framesReceived < 3) {
            console.warn('⚠️ No tools in tracking data');
          }
          break;
        }

        // Find the primary tracked tool (not patient reference)
        let primaryTool: any = null;
        let primaryToolId: string | null = null;

        // Strategy: Find first non-PR tool
        for (const [toolId, toolData] of Object.entries(tools)) {
          const tool = toolData as any;

          // Skip if this is the patient reference
          if (tool.is_patient_reference) {
            continue;
          }

          primaryTool = tool;
          primaryToolId = toolId;
          break;
        }

        // DEBUG: Log matrix data for first few frames to check if real NDI data
        if (this.statsData.framesReceived < 5) {
          console.log('🎯 RAW NDI DATA - Frame', this.statsData.framesReceived + 1);
          Object.entries(tools).forEach(([toolId, toolData]: [string, any]) => {
            const coords = toolData.coordinates?.register;
            if (coords) {
              console.log(`  ${toolId}: pos=[${coords.position_mm?.join(', ')}], visible=${toolData.visible}`);
              if (coords.matrix && coords.matrix.length >= 16) {
                // Show transformation matrix
                const matrix = coords.matrix;
                console.log(`    Matrix: [${matrix[12]?.toFixed(1)}, ${matrix[13]?.toFixed(1)}, ${matrix[14]?.toFixed(1)}]`);
              }
            }
          });
        }

        // Fallback: Look for specific tool names for backward compatibility
        if (!primaryTool) {
          primaryTool = tools.EE || tools.crosshair;
          primaryToolId = tools.EE ? 'EE' : 'crosshair';
        }

        if (primaryTool) {
          // Extract position, orientation, and matrix
          const position = primaryTool.coordinates?.register?.position_mm;
          const rotation = primaryTool.coordinates?.register?.rotation_deg || [0, 0, 0];

          // Construct matrix key dynamically (rM + toolId, e.g., rMEE, rMDR-VR06-A33)
          const matrixKey = `rM${primaryToolId}`;
          const matrix = primaryTool.coordinates?.register?.[matrixKey] ||
                        primaryTool.coordinates?.register?.rMEE ||
                        primaryTool.coordinates?.register?.rMcrosshair;

          // Use data wrapper if present (new format) or direct message (old format)
          const messageData = message.data || message;

          if (this.statsData.framesReceived < 3) {
            console.log('🎯 [TrackingService] Using primary tool:', {
              toolId: primaryToolId,
              toolName: primaryTool.tool_name,
              hasPosition: !!position,
              matrixKey: matrixKey,
              hasMatrix: !!matrix
            });
          }

          // Pass to tracking update handler
          this._handleTrackingUpdate({
            position: position,
            orientation: rotation,
            matrix: matrix,
            timestamp: messageData.timestamp,
            frame_id: messageData.frame_number,
            quality: primaryTool.quality,
            quality_score: primaryTool.quality_score,
            visible: primaryTool.visible,
            tool_id: primaryToolId,
            tool_name: primaryTool.tool_name,
            // Include full message data for TrackingPanel
            patient_reference_id: messageData.patient_reference?.id,
            patient_reference_name: messageData.patient_reference?.name,  // Phase 4: Add PR name
            patient_reference_visible: messageData.patient_reference?.visible,
            patient_reference_quality: messageData.patient_reference?.quality,
            patient_reference_moved: messageData.patient_reference?.moved,
            patient_reference_movement: messageData.patient_reference?.movement_mm,
            tools: tools,
          });
        } else {
          if (this.statsData.framesReceived < 3) {
            console.warn('⚠️ No primary tool found in tracking data');
          }
        }
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
   * Handle tracking update (called at 100Hz with new API)
   */
  private _handleTrackingUpdate(data: any): void {
    const { position, orientation, timestamp, frame_id } = data;

    // Update stats
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

    // Broadcast to listeners (NavigationController will handle this)
    this._broadcastEvent(EVENTS.TRACKING_UPDATE, {
      position,
      orientation,
      timestamp,
      frame_id,
      matrix: data.matrix,
      quality: data.quality,
      quality_score: data.quality_score,
      visible: data.visible,
      tools: data.tools,
    });
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
}

export default TrackingService;
export { EVENTS as TRACKING_EVENTS };
