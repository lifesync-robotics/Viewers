/**
 * Type definitions for DICOM Server Upload Extension
 */

export type StageStatus = 'pending' | 'in-progress' | 'completed' | 'error';

export interface Stage {
  name: string;
  startPercent: number;
  endPercent: number;
  status: StageStatus;
}

export interface UploadDestination {
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
}

export interface UploadResponse {
  success: boolean;
  message?: string;
  data?: {
    sessionId?: string;
    processedFiles?: number;
    totalSize?: number;
    files?: UploadedFile[];
  };
  error?: {
    code?: string;
    message: string;
  };
}

export interface UploadedFile {
  filename: string;
  originalname: string;
  size: number;
  path?: string;
}

export interface ProcessingStatus {
  sessionId: string;
  status: 'processing' | 'completed' | 'error';
  progress: number; // 0-100
  filesProcessed?: number;
  error?: string;
}

export interface UploadSession {
  sessionId: string;
  files: UploadedFile[];
  uploadedAt: string;
  status: 'uploaded' | 'processing' | 'completed' | 'error';
}

export interface DicomServerUploadConfig {
  defaultServerUrl?: string;
  autoUpload?: boolean;
  multiple?: boolean;
  maxFileSize?: number;
  acceptedFileTypes?: string;
  stages?: Partial<Stage>[];
}

export interface MultiStageProgressBarProps {
  stages: Stage[];
  currentStageIndex: number;
  currentStageProgress: number;
  errorMessage?: string;
}

export interface DicomServerUploadProps {
  servicesManager?: any;
  commandsManager?: any;
  configuration?: DicomServerUploadConfig;
}

export interface UploadItem {
  id: string;
  file: File;
  completed: number;
  loaded: number;
  total: number;
  uploadResponse?: UploadResponse;
  uploadStatus?: number;
  state?: string;
}

