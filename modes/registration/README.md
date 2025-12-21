# Registration Mode

## Introduction

Registration mode provides a dedicated workflow for patient-to-image registration operations. This mode is designed for surgical navigation workflows where fiducial points need to be marked and registered between DICOM images and patient anatomy tracked by surgical navigation systems.

## Features

This mode extends the basic mode with:
- **Fiducial Template Management**: Create, edit, and manage fiducial templates for DICOM series
- **Registration Session Control**: Start and manage registration sessions with different methods (Manual Point-based, Phantom Auto)
- **Point Collection Workflow**: Guided workflow for collecting fiducial points with DICOM and tracker coordinates
- **Quality Assessment**: Preview and validate registration quality before computation
- **Registration Computation**: Compute transformation matrices using least-squares or RANSAC algorithms
- **Series-Centric Architecture**: All operations are based on DICOM Series Instance UID

## Architecture

The registration mode integrates with:
- **Frontend**: OHIF viewer with RegistrationPanel component
- **API Layer**: Node.js REST API (SyncForge API)
- **Service Layer**: Python gRPC service for registration algorithms

## Route

The registration mode is accessible at the `/registration` route.

## Registration Workflow

1. **Load DICOM Study**: Load a DICOM study in OHIF viewer
2. **Create Template** (Optional): Mark fiducial points on anatomical landmarks in the DICOM images
3. **Start Session**: Start a registration session for the current DICOM series
4. **Collect Points**: Collect tracker positions for each fiducial point
5. **Preview Quality**: Check registration quality metrics before computation
6. **Compute Registration**: Calculate the transformation matrix
7. **Save Registration**: Persist the registration result to the case directory

## Panel Components

- **Registration Panel**: Main panel for registration workflow control and template editing
- **Tracking Panel**: Real-time tracking status and control
- **Measurements Panel**: View and manage fiducial measurements

## Dependencies

- `@ohif/extension-lifesync`: Provides RegistrationPanel and RegistrationService
- `@ohif/extension-cornerstone`: Viewport and measurement tools
- `@ohif/extension-default`: Basic layout and panels

