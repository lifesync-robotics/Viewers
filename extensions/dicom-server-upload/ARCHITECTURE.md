# Architecture Documentation

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        OHIF Viewer Platform                     │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              Segmentation Mode                         │   │
│  │                                                        │   │
│  │  ┌──────────────┐  ┌────────────────────────────┐   │   │
│  │  │ Left Panel   │  │    Right Panels            │   │   │
│  │  │              │  │                            │   │   │
│  │  │ Series List  │  │  ┌──────────────────────┐ │   │   │
│  │  │              │  │  │ Segmentation Panel   │ │   │   │
│  │  └──────────────┘  │  └──────────────────────┘ │   │   │
│  │                    │  ┌──────────────────────┐ │   │   │
│  │                    │  │ DICOM Upload Panel   │◄──────────┐
│  │                    │  │ (THIS EXTENSION)     │ │   │   │
│  │                    │  └──────────────────────┘ │   │   │
│  │                    └────────────────────────────┘   │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ HTTP POST
                               ▼
                    ┌─────────────────────┐
                    │   Upload Server     │
                    │  (Your Backend)     │
                    └─────────────────────┘
```

## Component Hierarchy

```
Extension (@ohif/extension-dicom-server-upload)
│
├── Panel Module (dicomServerUpload)
│   └── DicomServerUpload (Main Component)
│       ├── Server URL Input
│       │   ├── Text Input
│       │   └── Help Text
│       │
│       └── Uploady Provider
│           ├── Configuration
│           │   ├── destination.url
│           │   ├── multiple: true
│           │   └── accept: "application/dicom,.dcm"
│           │
│           └── DicomServerUploadInternal
│               ├── Hooks
│               │   ├── useItemProgressListener
│               │   ├── useItemFinishListener
│               │   └── useItemErrorListener
│               │
│               ├── Upload Button
│               │   └── File Selector
│               │
│               ├── MultiStageProgressBar
│               │   ├── Overall Progress
│               │   │   ├── Progress Bar
│               │   │   └── Percentage Display
│               │   │
│               │   └── Stage Stepper
│               │       ├── Stage 1: Upload
│               │       ├── Stage 2: Processing
│               │       └── Stage 3: Download
│               │
│               ├── Error Display
│               ├── Reset Button
│               └── Info Panel
│
└── Commands Module
    └── openDicomUploadPanel()
```

## Data Flow Diagram

```
┌─────────────┐
│    User     │
└──────┬──────┘
       │ 1. Clicks Upload Button
       ▼
┌─────────────────────────┐
│   DicomServerUpload     │
│   - Shows File Picker   │
└──────────┬──────────────┘
           │ 2. Files Selected
           ▼
┌─────────────────────────┐
│  Uploady Provider       │
│  - Validates Files      │
│  - Initiates Upload     │
└──────────┬──────────────┘
           │ 3. Upload Starts
           ▼
┌─────────────────────────────────────────────┐
│  DicomServerUploadInternal                  │
│  ┌──────────────────────────────────────┐  │
│  │ Stage 1: Upload (0-30%)              │  │
│  │ useItemProgressListener              │  │
│  │ └─> Updates progress bar             │  │
│  └──────────────────────────────────────┘  │
│           │ 4. Upload Complete              │
│           ▼                                 │
│  ┌──────────────────────────────────────┐  │
│  │ Stage 2: Processing (30-80%)         │  │
│  │ useItemFinishListener                │  │
│  │ └─> Simulates/Polls server status    │  │
│  └──────────────────────────────────────┘  │
│           │ 5. Processing Complete          │
│           ▼                                 │
│  ┌──────────────────────────────────────┐  │
│  │ Stage 3: Download (80-100%)          │  │
│  │ Simulates result download            │  │
│  └──────────────────────────────────────┘  │
│           │ 6. Complete                     │
│           ▼                                 │
│  ┌──────────────────────────────────────┐  │
│  │ Show Success Notification            │  │
│  │ Enable Reset Button                  │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
           │ 7. Notify User
           ▼
┌─────────────────────────┐
│ uiNotificationService   │
│ - Shows success message │
└─────────────────────────┘
```

## State Machine

```
                    ┌─────────┐
                    │  IDLE   │ (currentStageIndex: -1)
                    └────┬────┘
                         │
              User clicks upload button
                         │
                         ▼
                  ┌─────────────┐
                  │  UPLOADING  │ (Stage 0, 0-30%)
                  │  Status:    │
                  │  in-progress│
                  └──────┬──────┘
                         │
              Upload completes successfully
                         │
                         ▼
                 ┌──────────────┐
                 │ PROCESSING   │ (Stage 1, 30-80%)
                 │ Status:      │
                 │ in-progress  │
                 └──────┬───────┘
                        │
            Processing completes successfully
                        │
                        ▼
                ┌───────────────┐
                │ DOWNLOADING   │ (Stage 2, 80-100%)
                │ Status:       │
                │ in-progress   │
                └───────┬───────┘
                        │
            Download completes successfully
                        │
                        ▼
                 ┌─────────────┐
                 │  COMPLETE   │ (All stages completed)
                 │  Show reset │
                 └──────┬──────┘
                        │
                User clicks reset
                        │
                        ▼
                    ┌─────────┐
                    │  IDLE   │
                    └─────────┘

        Error at any stage ──────▶ ┌───────────┐
                                    │   ERROR   │
                                    │ Show msg  │
                                    │ Enable    │
                                    │ reset     │
                                    └───────────┘
```

## Progress Calculation

```
Overall Progress = Stage Start % + (Stage Progress × Stage Range)

Example:
  Stage 2 (Processing): startPercent=30, endPercent=80
  Range = 80 - 30 = 50
  Current stage progress = 60% (within stage)
  
  Overall = 30 + (0.60 × 50) = 30 + 30 = 60%
```

### Stage Mapping

```
│←─ Upload ─→│←────── Processing ──────→│←─ Download ─→│
0%          30%                        80%           100%
```

## Service Integration

```
┌──────────────────────────────────────────────────────────┐
│               OHIF Services Manager                      │
│                                                          │
│  ┌────────────────────────┐  ┌────────────────────────┐ │
│  │ uiNotificationService  │  │   panelService         │ │
│  │                        │  │                        │ │
│  │ .show()               │  │ .activate()           │ │
│  │ - title               │  │ - id                  │ │
│  │ - message             │  │ - label               │ │
│  │ - type                │  │                        │ │
│  │ - duration            │  │                        │ │
│  └───────────┬────────────┘  └──────────┬─────────────┘ │
│              │                          │               │
└──────────────┼──────────────────────────┼───────────────┘
               │                          │
               │                          │
         Used by extension          Used for panel
         for notifications          activation
               │                          │
               ▼                          ▼
    ┌─────────────────────┐    ┌─────────────────────┐
    │ Success/Error       │    │ Open upload panel   │
    │ Toast Messages      │    │ via command         │
    └─────────────────────┘    └─────────────────────┘
```

## Module Registration Flow

```
1. Extension Load
   │
   ▼
┌────────────────────────┐
│ Extension Registration │
│ (src/index.tsx)        │
└───────────┬────────────┘
            │
            ├─ preRegistration()
            │  └─> Logging
            │
            ├─ getPanelModule()
            │  └─> Register 'dicomServerUpload' panel
            │      ├─ name: 'dicomServerUpload'
            │      ├─ iconName: 'icon-upload'
            │      ├─ label: 'DICOM Upload'
            │      └─ component: DicomServerUpload
            │
            └─ getCommandsModule()
               └─> Register 'openDicomUploadPanel' command
                   └─> Activates panel via panelService
```

## Type System

```typescript
// Core Types
Stage {
  name: string
  startPercent: number (0-100)
  endPercent: number (0-100)
  status: 'pending' | 'in-progress' | 'completed' | 'error'
}

// Upload Data Flow
File → UploadItem → UploadResponse → ProcessingStatus
  │         │              │                  │
  │         │              │                  └─> progress tracking
  │         │              └─> server response
  │         └─> uploady internal representation
  └─> browser File object

// Component Props Flow
DicomServerUploadProps
  ├─> servicesManager
  ├─> commandsManager
  └─> configuration
      └─> DicomServerUploadConfig
          ├─> defaultServerUrl
          ├─> autoUpload
          ├─> multiple
          └─> stages[]
```

## Network Communication

```
┌──────────────────┐                    ┌──────────────────┐
│  OHIF Client     │                    │  Upload Server   │
│  (Browser)       │                    │  (Backend)       │
└────────┬─────────┘                    └────────┬─────────┘
         │                                       │
         │  POST /upload                         │
         │  Content-Type: multipart/form-data    │
         │─────────────────────────────────────▶ │
         │                                       │
         │  {files: [File1, File2, ...]}        │
         │                                       │
         │                                       │ Process files
         │                                       │ Generate session ID
         │                                       │
         │ ◀─────────────────────────────────────│
         │  HTTP 200 OK                          │
         │  {                                    │
         │    success: true,                     │
         │    data: {                            │
         │      sessionId: "...",                │
         │      processedFiles: N                │
         │    }                                  │
         │  }                                    │
         │                                       │
         │                                       │
    [Progress Updates via                        │
     Uploady Events]                             │
         │                                       │
         │  GET /status/:sessionId (optional)    │
         │─────────────────────────────────────▶ │
         │                                       │
         │ ◀─────────────────────────────────────│
         │  { progress: 50, status: "processing" }
         │                                       │
         │                                       │
         │  GET /results/:sessionId (optional)   │
         │─────────────────────────────────────▶ │
         │                                       │
         │ ◀─────────────────────────────────────│
         │  { results: {...} }                   │
         │                                       │
```

## Error Handling Strategy

```
┌─────────────────────────────────────────────────────────┐
│              Error Detection Points                     │
└─────────────────────────────────────────────────────────┘

1. File Selection
   ├─ Invalid file type → Show error message
   ├─ File too large → Show error message
   └─ No files selected → Disable upload button

2. Network Request
   ├─ Connection failed → useItemErrorListener
   ├─ Server error (5xx) → useItemErrorListener
   ├─ Client error (4xx) → useItemErrorListener
   └─ Timeout → useItemErrorListener

3. Upload Processing
   ├─ Malformed response → Parse error handling
   ├─ Missing data → Validation error
   └─ Unexpected status → Error state

Error Flow:
  Error Detected
       │
       ▼
  Update Stage Status to 'error'
       │
       ▼
  Display Error Message
       │
       ▼
  Show Reset Button
       │
       ▼
  Log to Console
       │
       ▼
  (Optional) Send to Error Tracking Service
```

## Performance Considerations

### Optimization Strategies

```
1. Component Rendering
   ├─ React.memo for MultiStageProgressBar
   ├─ useCallback for event handlers
   ├─ Minimal re-renders with proper dependencies
   └─ Conditional rendering for progress display

2. Progress Updates
   ├─ Throttle progress updates (every 100ms)
   ├─ Batch state updates where possible
   └─ Debounce rapid state changes

3. Network Optimization
   ├─ Chunked uploads for large files (future)
   ├─ Compression (gzip) for request/response
   ├─ Connection pooling
   └─ Request cancellation on unmount

4. Memory Management
   ├─ Release file references after upload
   ├─ Clear upload sessions periodically
   ├─ Limit concurrent uploads
   └─ Stream large files (future enhancement)
```

## Security Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Security Layers                       │
└──────────────────────────────────────────────────────────┘

Client-Side (Extension)
  ├─ Input Validation
  │  ├─ URL format validation
  │  ├─ File type checking
  │  └─ File size limits
  │
  ├─ Data Sanitization
  │  ├─ Escape user inputs
  │  └─ Validate server responses
  │
  └─ Secure Communication
     ├─ HTTPS enforcement (production)
     ├─ CORS compliance
     └─ No credentials in logs

Server-Side (Your Implementation)
  ├─ Authentication
  │  ├─ JWT tokens
  │  ├─ API keys
  │  └─ Session management
  │
  ├─ Authorization
  │  ├─ Role-based access
  │  ├─ Resource ownership
  │  └─ Rate limiting
  │
  ├─ File Validation
  │  ├─ DICOM format verification
  │  ├─ Virus scanning
  │  ├─ Size limits
  │  └─ Content inspection
  │
  └─ Secure Storage
     ├─ Encrypted at rest
     ├─ Access controls
     └─ Audit logging
```

## Deployment Architecture

```
Development Environment:
┌─────────────────┐    ┌──────────────────┐    ┌────────────┐
│ OHIF Dev Server │───▶│ Extension (Local)│───▶│ Dev Server │
│ localhost:3000  │    │ Hot Reload       │    │ :8080      │
└─────────────────┘    └──────────────────┘    └────────────┘

Production Environment:
┌─────────────────┐    ┌──────────────────┐    ┌────────────────┐
│ OHIF Viewer     │───▶│ Extension (Built)│───▶│ Production API │
│ (Deployed)      │    │ Bundled          │    │ (Cloud)        │
└─────────────────┘    └──────────────────┘    └────────────────┘
        │                                               │
        └───────────────── HTTPS ─────────────────────┘
```

---

## Quick Reference

| Component | Responsibility |
|-----------|---------------|
| **DicomServerUpload** | Main container, Uploady provider setup |
| **DicomServerUploadInternal** | Upload logic, hooks, state management |
| **MultiStageProgressBar** | Visual progress display |
| **Extension Index** | Module registration, OHIF integration |
| **Types** | TypeScript definitions |

| State | currentStageIndex | Description |
|-------|-------------------|-------------|
| Idle | -1 | Waiting for user action |
| Uploading | 0 | Files being uploaded (0-30%) |
| Processing | 1 | Server processing (30-80%) |
| Downloading | 2 | Retrieving results (80-100%) |
| Complete | 2 (all completed) | All stages done |
| Error | varies | Error occurred |

---

**Last Updated**: December 23, 2025

