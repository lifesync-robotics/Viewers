/**
 * TypeScript type definitions for tracking data
 * SINGLE SOURCE OF TRUTH: These types must match tracking_data.proto
 * 
 * Proto file: AsclepiusPrototype/04_Tracking/tracking_data.proto
 * Generated from: proto3
 * 
 * Phase 4: Unified type system
 */

/**
 * Tool transformation data with 4x4 matrices
 * Corresponds to ToolTransform message in tracking_data.proto
 */
export interface ToolTransform {
  tool_id: string;                    // Tool identifier (e.g., "DR-VR06-A33")
  tool_name: string;                  // Human-readable name
  visible: boolean;                   // Tool visibility status
  quality: string;                    // Quality: excellent, good, fair, poor
  quality_score: number;              // Numeric quality score (0.0 - 1.0)
  is_patient_reference: boolean;      // True if this tool IS the patient reference
  
  // Quaternion (w, x, y, z) - Better for tracking rotation
  quaternion?: [number, number, number, number];  // [w, x, y, z]
  
  // Delta (frame-to-frame changes)
  delta_position_mm?: number;         // Position change in mm
  delta_rotation_deg?: number;        // Rotation change in degrees
  
  // ROM file information
  rom_file?: string;                  // ROM filename being used
  
  // Coordinate data (structured by protobuf_bridge.js)
  coordinates: {
    // TRACKER-SPACE COORDINATES (absolute, from NDI tracker)
    tracker: {
      position_mm: [number, number, number];      // [x, y, z] in mm
      rotation_deg: [number, number, number];     // [rx, ry, rz] in degrees
      [matrixKey: string]: number[][] | [number, number, number];  // tM{toolId}: 4x4 matrix
    };
    
    // PATIENT-REFERENCE-SPACE COORDINATES (relative to patient reference)
    patient_reference: {
      position_mm: [number, number, number];      // [x, y, z] in mm
      rotation_deg: [number, number, number];     // [rx, ry, rz] in degrees
      [matrixKey: string]: number[][] | [number, number, number];  // prM{toolId}: 4x4 matrix
    };
    
    // LEGACY: For backward compatibility
    register: {
      position_mm: [number, number, number];      // [x, y, z] in mm
      rotation_deg: [number, number, number];     // [rx, ry, rz] in degrees
      [matrixKey: string]: number[][] | [number, number, number];  // rM{toolId}: 4x4 matrix
    };
  };
  
  // Special field for crosshair tool
  crosshair_center?: [number, number, number];
  
  timestamp?: number;                 // Unix timestamp with milliseconds
}

/**
 * Patient Reference Status
 * Corresponds to patient_reference_* fields in TrackingFrame message
 */
export interface PatientReferenceStatus {
  id: string | null;                  // Tool ID (e.g., "DR-VR04-A32")
  name: string | null;                // Human-readable name (Phase 4)
  visible: boolean;                   // Is the patient reference currently visible?
  quality: number;                    // Quality score (0.0 - 1.0)
  moved: boolean;                     // Has PR moved beyond threshold?
  movement_mm: number;                // Distance moved from initial position (mm)
}

/**
 * Complete tracking frame with multiple tools
 * Corresponds to TrackingFrame message in tracking_data.proto
 */
export interface TrackingFrame {
  type: 'tracking_update' | 'tracking_data';
  timestamp: number;                  // Unix timestamp with milliseconds
  frame_number: number;               // Sequential frame number
  
  // Tool data
  tools: {
    [toolId: string]: ToolTransform;  // Dictionary of tools by tool_id
  };
  
  // System status
  status?: string;                    // running, stopped, error
  tools_visible?: number;             // Number of visible tools
  tools_total?: number;               // Total number of tools
  
  // Patient Reference Status (Phase 3 & 4)
  patient_reference: PatientReferenceStatus;
  
  // Metadata
  simulation?: boolean;               // True if simulated data
}

/**
 * Tracking update event data
 * Used by TrackingService to broadcast updates to UI components
 */
export interface TrackingUpdateEvent {
  // Primary tool data
  position: [number, number, number] | undefined;
  orientation: [number, number, number];
  matrix: number[][] | undefined;
  timestamp: number;
  frame_id: number;
  quality: string;
  quality_score: number;
  visible: boolean;
  tool_id: string;
  tool_name: string;
  
  // Patient reference status
  patient_reference_id: string | null;
  patient_reference_name: string | null;
  patient_reference_visible: boolean;
  patient_reference_quality: number;
  patient_reference_moved: boolean;
  patient_reference_movement: number;
  
  // All tools data
  tools: {
    [toolId: string]: ToolTransform;
  };
}

/**
 * Tracking configuration
 * Corresponds to TrackingConfig message in tracking_data.proto
 */
export interface TrackingConfig {
  device_type: string;                // NDI_VEGA, NDI_POLARIS, SIMULATION
  frequency_hz: number;               // Tracking frequency
  tools: string[];                    // List of tool IDs to track
  simulation_mode: boolean;           // True for simulated data
}

/**
 * Tracking command types
 * Corresponds to CommandType enum in tracking_data.proto
 */
export enum TrackingCommandType {
  START = 'START',
  STOP = 'STOP',
  PAUSE = 'PAUSE',
  RESUME = 'RESUME',
  CONFIGURE = 'CONFIGURE',
}

/**
 * Tracking command
 * Corresponds to TrackingCommand message in tracking_data.proto
 */
export interface TrackingCommand {
  command: TrackingCommandType;
  config?: TrackingConfig;            // Optional config for CONFIGURE command
}

/**
 * Tracking response
 * Corresponds to TrackingResponse message in tracking_data.proto
 */
export interface TrackingResponse {
  success: boolean;
  message: string;
  current_config?: TrackingConfig;
}

