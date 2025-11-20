/**
 * TrackingService
 * Connects to SyncForge tracking API via REST + WebSocket
 * Updates crosshair position at 100Hz for real-time navigation
 *
 * Phase 2: Updated for integrated SyncForge API
 */

import { PubSubService } from '@ohif/core';

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

  constructor(servicesManager, config: any = {}) {
    super(EVENTS);
    this.servicesManager = servicesManager;

    // Get global config for API URL determination
    const globalConfig = (window as any).config || {};

    // Check for syncforge config (automatically determined based on current location)
    const syncforgeApiUrl = globalConfig.syncforge?.apiUrl;

    // Fallback: automatically determine API URL based on current hostname
    // This allows remote access from other machines on the LAN
    const hostname = window.location.hostname;
    const defaultApiUrl = `http://${hostname}:3001`;

    // Priority: config.apiUrl > syncforge config > hostname-based default
    this.apiUrl = config.apiUrl || syncforgeApiUrl || defaultApiUrl;
    this.caseId = config.caseId || null;
    console.log('🎯 TrackingService initialized', {
      apiUrl: this.apiUrl,
      hostname: hostname,
      remoteAccess: hostname !== 'localhost' && hostname !== '127.0.0.1'
    });
  }

  /**
   * Connect to SyncForge tracking API
   * Step 1: Call REST API to get WebSocket URL
   * Step 2: Connect to WebSocket for streaming data
   */
  public async connect(apiUrl: string = this.apiUrl): Promise<void> {
    if (this.ws) {
      console.warn('⚠️ Already connected to tracking server');
      return;
    }

    console.log(`🔗 Requesting WebSocket URL from SyncForge API: ${apiUrl}`);

    try {
      // Step 1: Call REST API to get WebSocket URL
      let response = await fetch(`${apiUrl}/api/tracking/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for OAuth2 authentication
        body: JSON.stringify({
          mode: 'simulation' // Default to simulation mode
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

          // Retry connection
          response = await fetch(`${apiUrl}/api/tracking/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              mode: 'simulation'
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

      // Step 2: Connect to WebSocket
      this._connectWebSocket(data.websocket_url);

    } catch (error) {
      console.error('❌ Failed to connect to tracking API:', error);
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
        console.log('🔌 Disconnected from tracking server');
        this.isConnected = false;
        this.isTracking = false;
        this.ws = null;

        this._broadcastEvent(EVENTS.CONNECTION_STATUS, {
          connected: false,
          message: 'Disconnected from tracking server',
        });

        // Attempt to reconnect using stored URL
        if (this.reconnectAttempts < this.maxReconnectAttempts && this.wsUrl) {
          this.reconnectAttempts++;
          console.log(
            `🔄 Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
          );
          setTimeout(() => this._connectWebSocket(this.wsUrl), this.reconnectDelay);
        }
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
   * Disconnect from tracking server
   */
  public disconnect(): void {
    if (this.ws) {
      console.log('🔌 Disconnecting from tracking server');
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      this.isTracking = false;
    }
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
      case 'tracking_data':  // New message type from backend
      case 'tracking_update': // Keep for backward compatibility
        // DEBUG: Log data structure for first few messages
        if (this.statsData.framesReceived < 3) {
          console.log('🔍 [TrackingService] Processing tracking data:', {
            hasData: !!message.data,
            hasTools: !!message.data?.tools,
            toolKeys: message.data?.tools ? Object.keys(message.data.tools) : [],
            hasCrosshair: !!(message.data?.tools?.crosshair)
          });
        }
        
        // NEW FORMAT: Extract data from tools object
        if (message.data && message.data.tools && message.data.tools.crosshair) {
          const crosshair = message.data.tools.crosshair;

          // Extract position, orientation, and matrix
          const position = crosshair.coordinates.register.position_mm;
          const rotation = crosshair.coordinates.register.rotation_deg || [0, 0, 0];
          const matrix = crosshair.coordinates.register.rMcrosshair;

          // Pass to tracking update handler
          this._handleTrackingUpdate({
            position: position,
            orientation: rotation,
            matrix: matrix,
            timestamp: message.data.timestamp,
            frame_id: message.data.frame_number,
            quality: crosshair.quality,
            quality_score: crosshair.quality_score,
            visible: crosshair.visible,
            // Include full message data for TrackingPanel
            patient_reference_id: message.data.patient_reference?.id,
            patient_reference_visible: message.data.patient_reference?.visible,
            patient_reference_quality: message.data.patient_reference?.quality,
            patient_reference_moved: message.data.patient_reference?.moved,
            patient_reference_movement: message.data.patient_reference?.movement_mm,
            tools: message.data.tools,
          });
        } else if (message.tools && message.tools.crosshair) {
          // OLD FORMAT: Direct tools object (backward compatibility)
          const crosshair = message.tools.crosshair;

          const position = crosshair.coordinates.register.position_mm;
          const rotation = crosshair.coordinates.register.rotation_deg || [0, 0, 0];
          const matrix = crosshair.coordinates.register.rMcrosshair;

          this._handleTrackingUpdate({
            position: position,
            orientation: rotation,
            matrix: matrix,
            timestamp: message.timestamp,
            frame_id: message.frame_number,
            quality: crosshair.quality,
            quality_score: crosshair.quality_score,
            visible: crosshair.visible,
            tools: message.tools,
          });
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
}

export default TrackingService;
export { EVENTS as TRACKING_EVENTS };
