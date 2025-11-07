/**
 * TrackingService
 * Connects to Python tracking server via WebSocket
 * Updates crosshair position at 20Hz for real-time navigation
 */

import { PubSubService } from '../_shared/pubSubServiceInterface';

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
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000;
  private serverUrl: string = 'ws://localhost:8765';
  private reconnectTimeout: any = null;
  private statsData = {
    framesReceived: 0,
    lastUpdate: 0,
    averageFPS: 0,
    fpsHistory: [] as number[],
  };

  constructor(servicesManager) {
    super(EVENTS);
    this.servicesManager = servicesManager;
    console.log('🎯 TrackingService initialized');
  }

  /**
   * Connect to tracking server
   */
  public connect(url: string = 'ws://localhost:8765'): void {
    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting) {
      console.warn('⚠️ Connection attempt already in progress');
      return;
    }

    if (this.ws && this.isConnected) {
      console.warn('⚠️ Already connected to tracking server');
      return;
    }

    // Store URL for reconnection
    this.serverUrl = url;
    this.isConnecting = true;

    console.log(`🔗 Connecting to tracking server: ${url}`);

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('✅ Connected to tracking server');
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Clear any pending reconnect timeout
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
        
        this._broadcastEvent(EVENTS.CONNECTION_STATUS, {
          connected: true,
          message: 'Connected to tracking server',
        });
      };

      this.ws.onmessage = event => {
        try {
          const message = JSON.parse(event.data);
          this._handleMessage(message);
        } catch (error) {
          console.error('❌ Error parsing tracking message:', error);
        }
      };

      this.ws.onerror = error => {
        console.error('❌ WebSocket error:', error);
        this.isConnecting = false;
        this._broadcastEvent(EVENTS.CONNECTION_STATUS, {
          connected: false,
          error: 'Connection error',
        });
      };

      this.ws.onclose = () => {
        console.log('🔌 Disconnected from tracking server');
        this.isConnected = false;
        this.isConnecting = false;
        this.ws = null;

        this._broadcastEvent(EVENTS.CONNECTION_STATUS, {
          connected: false,
          message: 'Disconnected from tracking server',
        });

        // Only attempt to reconnect if we were tracking
        // (don't auto-reconnect on intentional disconnect)
        if (this.isTracking && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
          console.log(
            `🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
          );
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect(this.serverUrl);
          }, delay);
        } else {
          this.isTracking = false;
        }
      };
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      this.isConnecting = false;
      this.isConnected = false;
      this.ws = null;
    }
  }

  /**
   * Disconnect from tracking server
   */
  public disconnect(): void {
    // Clear any pending reconnect attempts
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Reset tracking state to prevent auto-reconnect
    this.isTracking = false;
    this.reconnectAttempts = 0;
    
    if (this.ws) {
      console.log('🔌 Disconnecting from tracking server');
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      this.isConnecting = false;
    }
  }

  /**
   * Start tracking
   */
  public startTracking(mode: string = 'circular'): void {
    if (!this.isConnected) {
      console.error('❌ Not connected to tracking server');
      return;
    }

    console.log(`▶️ Starting tracking (mode: ${mode})`);

    this._sendCommand({
      command: 'start_tracking',
      mode: mode,
    });

    this.isTracking = true;
    this._broadcastEvent(EVENTS.TRACKING_STARTED, { mode });
  }

  /**
   * Stop tracking
   */
  public stopTracking(): void {
    if (!this.isConnected) {
      return;
    }

    console.log('⏸️ Stopping tracking');

    this._sendCommand({
      command: 'stop_tracking',
    });

    this.isTracking = false;
    this._broadcastEvent(EVENTS.TRACKING_STOPPED, {});
  }

  /**
   * Set tracking mode
   */
  public setMode(mode: string): void {
    if (!this.isConnected) {
      return;
    }

    this._sendCommand({
      command: 'set_mode',
      mode: mode,
    });
  }

  /**
   * Set center point for tracking simulation
   */
  public setCenter(position: number[]): void {
    if (!this.isConnected) {
      console.warn('⚠️ Not connected to tracking server. Connecting now...');
      
      // Auto-connect and send center after connection
      const subscription = this.subscribe(
        EVENTS.CONNECTION_STATUS,
        (status: any) => {
          if (status.connected) {
            console.log('✅ Connected! Sending center position...');
            this._sendCommand({
              command: 'set_center',
              position: position,
            });
            subscription.unsubscribe();
          }
        }
      );
      
      this.connect();
      return;
    }

    this._sendCommand({
      command: 'set_center',
      position: position,
    });
    
    console.log(`📍 Center command sent: [${position.map(v => v.toFixed(1)).join(', ')}]`);
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
   */
  private _handleMessage(message: any): void {
    const { type, data } = message;

    switch (type) {
      case 'connection':
        console.log('✅ Server connection confirmed:', message.server);
        break;

      case 'tracking_update':
        this._handleTrackingUpdate(data);
        break;

      case 'response':
        console.log(`📨 Server response:`, message);
        break;

      case 'pong':
        // Handle ping response
        break;

      default:
        console.log('📨 Unknown message type:', type);
    }
  }

  /**
   * Handle tracking update (called at 20Hz)
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
      if (this.statsData.fpsHistory.length > 20) {
        this.statsData.fpsHistory.shift();
      }
      this.statsData.averageFPS =
        this.statsData.fpsHistory.reduce((a, b) => a + b, 0) / this.statsData.fpsHistory.length;
    }
    this.statsData.lastUpdate = now;

    // Broadcast to listeners (CornerstoneViewportService will handle this)
    this._broadcastEvent(EVENTS.TRACKING_UPDATE, {
      position,
      orientation,
      timestamp,
      frame_id,
    });
  }

  /**
   * Send command to tracking server
   */
  private _sendCommand(command: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(command));
    } else {
      console.error('❌ Cannot send command: not connected');
    }
  }
}

export default TrackingService;
export { EVENTS as TRACKING_EVENTS };
