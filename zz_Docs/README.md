# OHIF Viewer Documentation

**Purpose**: Central repository for all OHIF Viewer customization and LifeSync integration documentation.

---

## 📁 Organization

### This Directory (`zz_Docs/`)
Contains all **project-level** documentation including:
- LifeSync extension implementation
- Custom feature guides
- Integration summaries
- Troubleshooting guides
- Development guides
- Phase completion reports

### Extension-Specific Documentation
Extension-specific docs remain in their directories:
- `extensions/lifesync/` - LifeSync extension docs
- `extensions/default/` - Default extension docs
- `platform/` - Platform documentation

---

## 📋 Documentation Policy

**From November 18, 2025 onwards:**

### ✅ Keep in Root
- `README.md` - Main project README only
- `CHANGELOG.md` - May keep in root if needed
- `CODE_OF_CONDUCT.md` - May keep in root if needed
- `CONTRIBUTING.md` - May keep in root if needed
- `DATACITATION.md` - May keep in root if needed

### ✅ Add to `zz_Docs/`
- Feature implementation guides
- Integration documentation
- Troubleshooting guides
- Session summaries
- Phase completion reports
- Quick start guides
- Any viewer-level documentation

### ✅ Keep in Extension Directories
- Extension-specific README files
- Extension component documentation
- Extension setup guides

---

## 📚 Key Documents by Category

### LifeSync Extension
- `LIFESYNC_EXTENSION_FIX.md` - Extension fixes and updates
- `SYNCFORGE_RENAME_SUMMARY.md` - SyncForge renaming
- `IMPLEMENTATION_COMPLETE.md` - Implementation status

### 3D Visualization & Models
- `3D_FOUR_MESH_IMPLEMENTATION.md` - Four mesh implementation
- `3D_FOUR_MESH_QUICK_START.md` - Quick start guide
- `MODEL_LOADER_ARCHITECTURE.md` - Model loading architecture
- `MODEL_SERVER_QUICK_START.md` - Model server setup
- `MODEL_SERVER_IMPLEMENTATION_SUMMARY.md` - Server implementation
- `MODEL_DICTIONARY_USAGE.md` - Model dictionary guide
- `README_3D_MODEL_LOADER.md` - 3D model loader details

### Screw Management & Planning
- `SCREW_MANAGEMENT_EXTENSION.md` - Screw management overview
- `SCREW_MANAGEMENT_QUICK_START.md` - Quick start
- `SCREW_MANAGEMENT_CHANGES_SUMMARY.md` - Recent changes
- `SCREW_TRANSFORM_CONSTRUCTION.md` - Transform construction
- `SCREW_CAP_USAGE.md` - Screw cap features
- `RADIUS_LENGTH_IMPLEMENTATION_SUMMARY.md` - Radius/length features

### Crosshairs & Navigation
- `CROSSHAIRS_GUIDE_README.md` - Main crosshairs guide
- `CROSSHAIRS_TECHNICAL_GUIDE.md` - Technical details
- `CROSSHAIRS_COMPLETE_SOLUTION_SUMMARY.md` - Solution summary
- `CROSSHAIR_DATA_FORMAT_FIX.md` - Data format fixes
- `CROSSHAIR_RELIABILITY_IMPROVEMENTS.md` - Reliability updates
- `NAVIGATION_SYSTEM_COMPLETE_SUMMARY.md` - Navigation overview
- `REALTIME_NAVIGATION_README.md` - Real-time navigation

### Coordinate Systems & Transforms
- `COORDINATE_SYSTEMS_AND_VIEWPORT_STATES_GUIDE.md` - Main guide
- `COORDINATE_SYSTEMS_NAVIGATION.md` - Navigation coordinates
- `README_COORDINATE_SYSTEMS.md` - Coordinate systems overview
- `QUICK_REFERENCE_COORDINATE_SYSTEMS.md` - Quick reference
- `TRANSFORM_FEATURE_SUMMARY.md` - Transform features

### Fiducial Markers & Registration
- `FIDUCIAL_MARKERS_README.md` - Main fiducial guide
- `FIDUCIAL_MARKERS_COMPLETE.md` - Complete implementation
- `3D_FIDUCIAL_REGISTRATION_SUMMARY.md` - 3D registration
- `FIDUCIAL_CROSSHAIR_JUMP_IMPLEMENTATION.md` - Jump feature
- `REGISTRATION_PANEL_IMPLEMENTATION.md` - Registration panel
- `HOW_TO_USE_3D_FIDUCIALS.md` - Usage guide

### Camera & Viewport
- `CAMERA_FOCAL_POINT_IMPLEMENTATION_SUMMARY.md` - Focal point features
- `CAMERA_FOCAL_POINT_TROUBLESHOOTING.md` - Troubleshooting
- `CAMERA_FOCAL_POINT_QUICK_START.md` - Quick start
- `README_CAMERA_FOCAL_POINT.md` - Focal point overview
- `VIEWPORT_3D_REQUIREMENT.md` - 3D viewport requirements

### 2D Plane Cutting
- `MODEL_2D_PLANE_CUTTING.md` - Plane cutting overview
- `CROSSHAIR_BASED_PLANE_CUTTING.md` - Crosshair-based cutting
- `DYNAMIC_PLANE_UPDATES.md` - Dynamic updates
- `2D_PLANE_CUTTING_DEPTH_FIX.md` - Depth fixes

### Case Management
- `CASE_CREATION_UX_IMPROVEMENTS.md` - UX improvements
- `COMPLETE_FILE_UPLOAD_SOLUTION.md` - File upload

### Tracking & Motion
- `HOW_TO_USE_TRACKING.md` - Tracking guide
- `TRACKING_SERVER_COMMANDS.md` - Server commands
- `TRACKING_PANEL_UPDATE.md` - Panel updates
- `TRACKING_PANELS_READY.md` - Panels status
- `NAVIGATION_MOTION_MODES.md` - Motion modes

### Phase Completion Reports
- `PHASE2_IMPLEMENTATION_COMPLETE.md` - Phase 2 complete
- `PHASE3_TESTING_GUIDE.md` - Phase 3 testing
- `PHASE3_QUICK_TEST.md` - Phase 3 quick test
- `PHASE4_COMPLETE.md` - Phase 4 complete
- `PHASE4_COMPLETE_SUMMARY.md` - Phase 4 summary
- `PHASE4_UI_COMPONENTS.md` - Phase 4 UI
- `SESSION_COMPLETE_SUMMARY.md` - Session summary

### Troubleshooting & Debugging
- `DEBUGGING_CONSOLE_LOGS_SUMMARY.md` - Console logs
- `DEBUG_TOOLBAR_BUTTON.md` - Toolbar debugging
- `DIAGNOSE_MPR_ISSUE.md` - MPR issues
- `MODEL_QUERY_TROUBLESHOOTING.md` - Model queries
- `MODEL_UPLOAD_TROUBLESHOOTING.md` - Model upload
- `ORTHANC_PROXY_FIX.md` - Orthanc proxy
- `BROWSER_SECURITY_ISSUE.md` - Security issues

### Setup & Configuration
- `SETUP_INSTRUCTIONS.md` - General setup
- `MODEL_SERVER_SETUP.md` - Model server setup
- `MODEL_SERVER_VTK_UPGRADE.md` - VTK upgrade
- `FORCE_RELOAD_INSTRUCTIONS.md` - Force reload

### Quick References
- `QUICK_REFERENCE.md` - General quick reference
- `QUICK_FIX.md` - Quick fixes
- `QUICK_FIDUCIAL_EXAMPLE.md` - Fiducial examples
- `SERVICE_ACCESS_SUMMARY.md` - Service access

---

## 🔍 Finding Documentation

### By Feature

**3D Visualization**:
- Model loading and rendering
- Four mesh implementation
- Model server integration
- 2D plane cutting

**Planning & Tools**:
- Screw management
- Transform construction
- Radius and length tools
- Measurement tools

**Navigation**:
- Real-time tracking
- Crosshairs system
- Motion modes
- Coordinate systems

**Registration**:
- Fiducial markers
- 3D registration
- Alignment tools
- DICOM alignment

---

## 📝 Creating New Documentation

When creating new documentation:

1. **Determine scope**:
   - Viewer-level → `zz_Docs/`
   - Extension-specific → Extension directory

2. **Use clear naming**:
   - `FEATURE_NAME_DESCRIPTION.md` (uppercase for visibility)
   - Be specific and descriptive

3. **Include implementation summaries**:
   - What was built
   - How it works
   - How to use it

4. **Add quick start guides when applicable**:
   - `FEATURE_QUICK_START.md`

---

## 🗂️ Archive Policy

Outdated documentation is **not deleted** but clearly marked:
- Prefix with `[ARCHIVED]` in title
- Add archive date
- Reference replacement doc if applicable

---

## 📊 Statistics

- **Viewer-level docs**: 140+ files
- **Extension-specific docs**: Varies by extension
- **Last major reorganization**: November 18, 2025

---

**Based on**: OHIF Viewer v3.x  
**Customization**: LifeSync Robotics Surgical Planning Platform  
**Last Updated**: November 18, 2025

