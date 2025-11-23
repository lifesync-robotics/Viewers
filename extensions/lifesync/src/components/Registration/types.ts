/**
 * Type definitions for Registration components
 */

export interface Fiducial {
  point_id: string;
  label: string;
  anatomical_landmark?: string;
  dicom_position_mm: [number, number, number];
  dicom_voxel_coords?: [number, number, number];
  tracker_position_mm?: [number, number, number];
  quality_score?: number;
  stability_mm?: number;
  status: 'pending' | 'captured' | 'validated';
  source: 'template' | 'intraop';
  placed_by?: string;
  placed_at?: number;
  confidence?: 'high' | 'medium' | 'low';
  notes?: string;
}

export interface FiducialTemplate {
  template_id: string;
  series_instance_uid: string;
  case_id?: string;
  status: 'draft' | 'approved' | 'archived';
  created_at: number;
  created_by: string;
  approved_at?: number;
  approved_by?: string;
  planned_points: Fiducial[];
}

export interface RegistrationSession {
  session_id: string;
  series_instance_uid: string;
  case_id?: string;
  method: 'MANUAL_POINT_BASED' | 'PHANTOM_AUTO' | 'ICP_SURFACE';
  status: 'idle' | 'loading_template' | 'collecting_points' | 'computing' | 'completed' | 'failed' | 'validating';
  points_collected: number;
  points_with_tracker: number;
  created_at: number;
  operator: string;
  using_template: boolean;
  template_id?: string;
}

export interface RegistrationResult {
  session_id: string;
  transformation_matrix: number[]; // 4x4 matrix (16 elements)
  quality_metrics: {
    fre_mm: number;
    fre_std_mm: number;
    tre_estimated_mm: number;
    max_residual_mm: number;
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    points_used: number;
  };
  point_residuals?: Array<{
    point_id: string;
    label: string;
    error_mm: number;
  }>;
}

export interface PhantomConfig {
  phantom_id: string; // "Medtronic_StealthStation", "BrainLab_ExacTrac"
  phantom_type: string; // "3D_O_Arm", "CT_Phantom"
  num_markers: number;
  marker_positions?: number[]; // [x1,y1,z1, x2,y2,z2, ...]
  marker_spacing_mm?: number;
  geometry_description?: string;
}

export type RegistrationMethod = 'auto' | 'manual';

export interface RegistrationPanelProps {
  servicesManager: any;
  commandsManager: any;
  extensionManager: any;
}
