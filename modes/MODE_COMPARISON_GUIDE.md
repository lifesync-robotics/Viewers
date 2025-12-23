# OHIF Modes Comparison Guide

Quick reference for choosing the right mode for your use case.

---

## Three Modes at a Glance

### 1. 📊 **Longitudinal Mode** (Standard OHIF)
**Remote Repository Version**

- **Purpose**: Standard measurement tracking
- **Layout**: Single viewport
- **Panels**: Thumbnails + Measurements
- **Use For**: General radiology review

### 2. 🏥 **Longitudinal Mode** (LifeSync Custom)
**Your Local Version**

- **Purpose**: Surgical planning and navigation
- **Layout**: Single viewport
- **Panels**: Thumbnails + 5 surgical panels
- **Use For**: Surgical case planning

### 3. 🔲 **Overview Mode** (NEW)
**Just Created**

- **Purpose**: Quick series overview
- **Layout**: 4×4 grid (16 viewports)
- **Panels**: Thumbnails + Measurements
- **Use For**: Initial case review

---

## Feature Comparison

| Feature | Standard Longitudinal | LifeSync Longitudinal | Overview 4×4 |
|---------|----------------------|---------------------|-------------|
| **Viewports** | 1 | 1 | 16 |
| **Layout** | Single | Single | Grid |
| **Measurement Tracking** | ✅ | ✅ | ✅ |
| **DICOM SR** | ✅ | ✅ | ✅ |
| **Thumbnails** | ✅ | ✅ | ✅ |
| **Screw Management** | ❌ | ✅ | ❌ |
| **Tracking Panel** | ❌ | ✅ | ❌ |
| **Registration** | ❌ | ✅ | ❌ |
| **Segmentation** | ❌ | ✅ | ❌ |
| **Frame Distribution** | Sequential | Sequential | Evenly spaced |
| **Best For** | General review | Surgery | Quick scan |

---

## Use Case Decision Tree

```
Do you need surgical planning features?
│
├─ YES → Use LifeSync Longitudinal Mode
│         (Your customized version)
│
└─ NO  → What's your primary goal?
          │
          ├─ Quick overview of entire series
          │   → Use Overview 4×4 Mode
          │
          └─ Detailed frame-by-frame review
              → Use Standard Longitudinal Mode
```

---

## When to Use Each Mode

### Use Standard Longitudinal When:
- ✅ Standard radiology workflow
- ✅ Detailed single-frame analysis
- ✅ Drawing precise measurements
- ✅ Creating DICOM SR reports
- ✅ No surgical features needed

### Use LifeSync Longitudinal When:
- ✅ Planning surgical procedures
- ✅ Managing screw placements
- ✅ Tracking surgical tools
- ✅ Registration of imaging data
- ✅ Segmentation required
- ✅ Full surgical workflow

### Use Overview Mode When:
- ✅ Initial case triage
- ✅ Quick series review
- ✅ Identifying key frames
- ✅ Teaching/presentations
- ✅ Quality assurance checks
- ✅ Series comparison

---

## Visual Layout Comparison

### Standard Longitudinal
```
┌──────────┬─────────────────┬──────────┐
│ Thumb-   │                 │ Measure- │
│ nails    │   Single        │ ments    │
│          │   Viewport      │          │
└──────────┴─────────────────┴──────────┘
```

### LifeSync Longitudinal
```
┌──────────┬─────────────────┬──────────┐
│ Thumb-   │                 │ Tracking │
│ nails    │   Single        │ Registr. │
│          │   Viewport      │ Segment. │
│          │                 │ Measure. │
│          │                 │ Screws   │
└──────────┴─────────────────┴──────────┘
```

### Overview Mode
```
┌──────────┬─────────────────┬──────────┐
│ Thumb-   │  1  2  3  4     │ Measure- │
│ nails    │  5  6  7  8     │ ments    │
│          │  9 10 11 12     │          │
│          │ 13 14 15 16     │          │
└──────────┴─────────────────┴──────────┘
```

---

## Right Panel Comparison

### Standard Longitudinal
1. Tracked Measurements

### LifeSync Longitudinal
1. Tracking Panel
2. Registration Panel
3. Segmentation Panel
4. Tracked Measurements
5. Screw Management

### Overview Mode
1. Tracked Measurements

---

## Performance Comparison

| Metric | Standard | LifeSync | Overview |
|--------|----------|----------|----------|
| **Memory Usage** | Low | Medium | High |
| **Rendering Speed** | Fast | Fast | Moderate |
| **GPU Load** | Low | Medium | High |
| **Recommended RAM** | 4GB | 8GB | 8GB+ |

---

## Keyboard Shortcuts

### All Modes (Common)
- `W` - Window/Level tool
- `Z` - Zoom tool
- `P` - Pan tool
- `L` - Length measurement
- `R` - Reset viewport
- `I` - Invert colors

### Overview Mode (Additional)
- `1-16` - Jump to viewport N
- `Tab` - Cycle through viewports
- `Shift+Tab` - Cycle backwards

---

## Mode URLs

Assuming your OHIF viewer is at `http://localhost:3000`:

```
Standard Longitudinal:
http://localhost:3000/viewer?StudyInstanceUIDs=...

LifeSync Longitudinal (Your Custom):
http://localhost:3000/longitudinal?StudyInstanceUIDs=...

Overview Mode:
http://localhost:3000/overview?StudyInstanceUIDs=...
```

---

## Configuration Examples

### Set Overview as Default Mode

```javascript
// In config/default.js
window.config = {
  defaultMode: '@ohif/mode-overview',
};
```

### Hide Standard Longitudinal

```javascript
modesConfiguration: {
  '@ohif/mode-longitudinal': {
    hide: { $set: true },
  },
}
```

### Rename LifeSync Mode

```javascript
modesConfiguration: {
  '@ohif/mode-longitudinal': {
    displayName: { $set: 'Surgical Planning' },
  },
}
```

---

## Workflow Examples

### Radiology Workflow
1. Open study in **Overview Mode** → Quick scan
2. Switch to **Standard Longitudinal** → Detailed review
3. Create measurements → Export DICOM SR

### Surgical Workflow
1. Open study in **Overview Mode** → Identify anatomy
2. Switch to **LifeSync Longitudinal** → Plan surgery
3. Use screw management → Place screws
4. Use registration → Align imaging
5. Use tracking → Track instruments

---

## File Locations

```
Viewers/modes/
├── longitudinal/          # LifeSync customized version
│   └── src/index.ts       # Has LifeSync panels
├── overview/              # NEW: Grid overview mode
│   └── src/index.ts       # 4×4 grid layout
└── basic/                 # Base mode (not directly used)
```

---

## Quick Commands

### Build All Modes
```bash
cd Viewers
yarn build:modes
```

### Build Specific Mode
```bash
cd Viewers/modes/overview
yarn build
```

### List Registered Modes
```bash
cd Viewers/platform/app
yarn run cli list-modes
```

### Add Mode
```bash
yarn run cli add-mode @ohif/mode-overview
```

### Remove Mode
```bash
yarn run cli remove-mode @ohif/mode-overview
```

---

## Mode Selection in UI

When you load a study, the mode selector shows:

```
┌─────────────────────────┐
│  Select Viewing Mode    │
├─────────────────────────┤
│ ○ Basic Viewer          │
│ ● Overview 4×4 Grid     │  ← NEW
│ ○ Surgical Planning     │  ← LifeSync
├─────────────────────────┤
│     [  Continue  ]      │
└─────────────────────────┘
```

---

## Migration Guide

### From Standard to LifeSync
**Not Recommended**: Features are incompatible

### From Standard to Overview
**Easy**: Just switch modes, measurements transfer

### From LifeSync to Overview
**Caution**: Surgical features won't be available

---

## Summary

### You Now Have 3 Modes:

1. **LifeSync Longitudinal** (Custom)
   - Keeps all your surgical features
   - Path: `/longitudinal`
   - For: Surgical planning

2. **Overview 4×4** (NEW)
   - Quick series overview
   - Path: `/overview`
   - For: Initial review

3. **Standard Longitudinal** (OHIF)
   - Available from remote repo
   - Path: `/viewer`
   - For: General radiology

---

## Recommended Setup

For a complete surgical platform:

1. **Default Mode**: Overview 4×4
   - Users see grid first
2. **Primary Mode**: LifeSync Longitudinal
   - For detailed surgical planning
3. **Optional**: Standard Longitudinal
   - For non-surgical cases

---

## Next Steps

1. ✅ Review this comparison
2. ✅ Install overview mode (see INSTALLATION.md)
3. ✅ Test all three modes
4. ✅ Configure default mode
5. ✅ Train users on when to use each

---

**Questions?** See individual mode READMEs:
- `Viewers/modes/longitudinal/README.md` (LifeSync)
- `Viewers/modes/overview/README.md` (Overview)
- OHIF docs for standard longitudinal

---

**End of Comparison Guide**

