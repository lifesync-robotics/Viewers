# OHIF Longitudinal Mode: Local vs Remote Comparison

**Date**: December 22, 2025  
**Remote Repository**: https://github.com/OHIF/Viewers/tree/master/modes/longitudinal  
**Local Path**: `Viewers/modes/longitudinal/`

---

## Executive Summary

Your local version of the longitudinal mode has been **heavily customized** with LifeSync-specific extensions and panels. The remote OHIF version is a **standard measurement tracking mode** without these customizations.

**Key Difference**: Your local version integrates surgical planning, tracking, and registration features that don't exist in the upstream OHIF repository.

---

## File Structure Comparison

### Files Present in Both Versions
- ✅ `package.json`
- ✅ `babel.config.js`
- ✅ `README.md`
- ✅ `LICENSE`
- ✅ `CHANGELOG.md`
- ✅ `src/id.js`
- ✅ `src/index.ts`

### Additional Folders
- Both have: `.webpack/`, `node_modules/`, `assets/`

**Result**: File structure is identical ✅

---

## 1. package.json Comparison

### Version Differences

| Property | Local Version | Remote Version | Difference |
|----------|--------------|----------------|------------|
| **version** | `3.12.0-beta.85` | `3.12.0-beta.113` | Remote is **28 versions ahead** |
| **@babel/runtime** | `7.28.2` | `7.28.2` | Same ✅ |
| **i18next** | `17.3.1` | `17.3.1` | Same ✅ |
| **webpack** | `5.95.0` | `5.95.0` | Same ✅ |
| **webpack-merge** | `5.10.0` | `5.10.0` | Same ✅ |

### Peer Dependencies

| Extension | Local Version | Remote Version | Status |
|-----------|--------------|----------------|--------|
| @ohif/core | `3.12.0-beta.85` | `3.12.0-beta.113` | Remote newer |
| @ohif/extension-cornerstone | `3.12.0-beta.85` | `3.12.0-beta.113` | Remote newer |
| @ohif/extension-cornerstone-dicom-rt | `3.12.0-beta.85` | `3.12.0-beta.113` | Remote newer |
| @ohif/extension-cornerstone-dicom-seg | `3.12.0-beta.85` | `3.12.0-beta.113` | Remote newer |
| @ohif/extension-cornerstone-dicom-sr | `3.12.0-beta.85` | `3.12.0-beta.113` | Remote newer |
| @ohif/extension-default | `3.12.0-beta.85` | `3.12.0-beta.113` | Remote newer |
| @ohif/extension-dicom-pdf | `3.12.0-beta.85` | `3.12.0-beta.113` | Remote newer |
| @ohif/extension-dicom-video | `3.12.0-beta.85` | `3.12.0-beta.113` | Remote newer |
| @ohif/extension-measurement-tracking | `3.12.0-beta.85` | `3.12.0-beta.113` | Remote newer |

**Recommendation**: The remote version has newer dependencies. Consider whether you need bug fixes or new features from versions 86-113.

---

## 2. src/index.ts Comparison

This is where the **MAJOR DIFFERENCES** exist.

### Remote Version (Standard OHIF)

```typescript
import i18n from 'i18next';
import { id } from './id';
import { 
  initToolGroups, 
  toolbarButtons, 
  cornerstone,
  ohif,
  dicomsr,
  dicomvideo,
  basicLayout,
  basicRoute,
  extensionDependencies as basicDependencies,
  mode as basicMode,
  modeInstance as basicModeInstance,
} from '@ohif/mode-basic';

export const tracked = {
  measurements: '@ohif/extension-measurement-tracking.panelModule.trackedMeasurements',
  thumbnailList: '@ohif/extension-measurement-tracking.panelModule.seriesList',
  viewport: '@ohif/extension-measurement-tracking.viewportModule.cornerstone-tracked',
};

export const extensionDependencies = {
  ...basicDependencies,
  '@ohif/extension-measurement-tracking': '^3.0.0',
};

export const longitudinalInstance = {
  ...basicLayout,
  id: ohif.layout,
  props: {
    ...basicLayout.props,
    leftPanels: [tracked.thumbnailList],
    rightPanels: [tracked.measurements],
    rightPanelClosed: false,
    viewports: [
      {
        namespace: tracked.viewport,
        displaySetsToDisplay: basicLayout.props.viewports[0].displaySetsToDisplay,
      },
      ...basicLayout.props.viewports,
    ],
  }
};
```

### Local Version (LifeSync Customized)

```typescript
import i18n from 'i18next';
import { id } from './id';
import { 
  initToolGroups, 
  toolbarButtons, 
  cornerstone,
  ohif,
  dicomsr,
  dicomvideo,
  basicLayout,
  basicRoute,
  extensionDependencies as basicDependencies,
  mode as basicMode,
  modeInstance as basicModeInstance,
} from '@ohif/mode-basic';

export const tracked = {
  measurements: '@ohif/extension-measurement-tracking.panelModule.trackedMeasurements',
  thumbnailList: '@ohif/extension-measurement-tracking.panelModule.seriesList',
  viewport: '@ohif/extension-measurement-tracking.viewportModule.cornerstone-tracked',
  viewportState: '@ohif/extension-cornerstone.panelModule.viewport-state',
  screwManagement: '@ohif/extension-lifesync.panelModule.screw-management',
  trackingPanel: '@ohif/extension-lifesync.panelModule.trackingPanel',
  registrationPanel: '@ohif/extension-lifesync.panelModule.registration-panel',
};

export const extensionDependencies = {
  ...basicDependencies,
  '@ohif/extension-measurement-tracking': '^3.0.0',
};

export const longitudinalInstance = {
  ...basicLayout,
  id: ohif.layout,
  props: {
    ...basicLayout.props,
    leftPanels: [tracked.thumbnailList],
    rightPanels: [
      tracked.trackingPanel, 
      tracked.registrationPanel, 
      cornerstone.segmentation, 
      tracked.measurements, 
      tracked.screwManagement
    ],
    rightPanelClosed: false,
    viewports: [
      {
        namespace: tracked.viewport,
        displaySetsToDisplay: basicLayout.props.viewports[0].displaySetsToDisplay,
      },
      ...basicLayout.props.viewports,
    ],
  }
};
```

---

## 3. Detailed Differences in src/index.ts

### A. `tracked` Object Extensions

| Feature | Remote | Local | Notes |
|---------|--------|-------|-------|
| `measurements` | ✅ | ✅ | Same |
| `thumbnailList` | ✅ | ✅ | Same |
| `viewport` | ✅ | ✅ | Same |
| `viewportState` | ❌ | ✅ | **LOCAL ONLY** - Cornerstone viewport state panel |
| `screwManagement` | ❌ | ✅ | **LOCAL ONLY** - LifeSync screw management panel |
| `trackingPanel` | ❌ | ✅ | **LOCAL ONLY** - LifeSync tracking panel |
| `registrationPanel` | ❌ | ✅ | **LOCAL ONLY** - LifeSync registration panel |

### B. Right Panel Configuration

**Remote Version** (Standard OHIF):
```typescript
rightPanels: [tracked.measurements]
```

**Local Version** (LifeSync):
```typescript
rightPanels: [
  tracked.trackingPanel,           // LifeSync tracking
  tracked.registrationPanel,       // LifeSync registration
  cornerstone.segmentation,        // Segmentation panel
  tracked.measurements,            // Standard measurements
  tracked.screwManagement          // LifeSync screw management
]
```

**Impact**: Your local version has **5 right panels** vs remote's **1 panel**.

### C. Extension Dependencies

Both versions have the same extension dependencies:
- `@ohif/mode-basic` dependencies
- `@ohif/extension-measurement-tracking`

**Note**: Your local version **references** `@ohif/extension-lifesync` panels but does NOT declare it as a dependency in `extensionDependencies`. This suggests the LifeSync extension is loaded globally or through another mechanism.

---

## 4. src/id.js Comparison

**Status**: ✅ **IDENTICAL**

Both versions:
```javascript
import packageJson from '../package.json';

const id = packageJson.name;

export { id };
```

---

## 5. babel.config.js Comparison

**Status**: ✅ **IDENTICAL**

Both versions:
```javascript
module.exports = require('../../babel.config.js');
```

---

## 6. README.md Comparison

**Local Version**: Describes "Measurement Tracking Mode" workflow with:
- Tracked vs untracked measurements
- DICOM SR import/export
- Measurement panel features

**Remote Version**: Likely similar (couldn't fully capture, but based on standard OHIF docs)

**Status**: Likely ✅ **SIMILAR** (both describe measurement tracking workflow)

---

## 7. Feature Comparison Matrix

| Feature | Remote (OHIF) | Local (LifeSync) | Cherry-Pick Decision |
|---------|---------------|------------------|---------------------|
| **Measurement Tracking** | ✅ | ✅ | KEEP (core feature) |
| **Thumbnail List** | ✅ | ✅ | KEEP (core feature) |
| **Tracked Viewport** | ✅ | ✅ | KEEP (core feature) |
| **Viewport State Panel** | ❌ | ✅ | KEEP if needed for debugging |
| **Screw Management Panel** | ❌ | ✅ | KEEP (LifeSync-specific) |
| **Tracking Panel** | ❌ | ✅ | KEEP (LifeSync-specific) |
| **Registration Panel** | ❌ | ✅ | KEEP (LifeSync-specific) |
| **Segmentation Panel** | ❌ | ✅ | KEEP (LifeSync-specific) |
| **Version (beta.113)** | ✅ | ❌ | UPDATE if needed |

---

## 8. Recommendations

### Option 1: Keep Local Version (Recommended)
**Rationale**: Your local version is a **surgical planning platform**, not just a viewer. The customizations are essential.

**Action Items**:
- ✅ Keep all LifeSync panels
- ⚠️ Consider updating to `3.12.0-beta.113` if there are critical bug fixes
- ✅ Document that this is a custom fork

### Option 2: Merge Remote Updates
**Rationale**: Get bug fixes and improvements from versions 86-113.

**Action Items**:
1. Review CHANGELOG.md for versions 86-113
2. Update package.json version to `3.12.0-beta.113`
3. Update all peer dependencies to `3.12.0-beta.113`
4. Test thoroughly to ensure LifeSync panels still work
5. Keep all local customizations in `src/index.ts`

### Option 3: Create Separate Mode
**Rationale**: Maintain both standard longitudinal and LifeSync surgical mode.

**Action Items**:
1. Rename local mode to `@ohif/mode-lifesync-surgical`
2. Keep remote longitudinal mode as-is
3. Have two separate modes available

---

## 9. Breaking Changes Risk Assessment

### Low Risk
- Updating version numbers
- Updating dependencies (if tested)

### Medium Risk
- Changes to `@ohif/mode-basic` API between versions 85-113
- Changes to measurement tracking extension API

### High Risk
- Removing LifeSync panels (would break your surgical workflow)
- Changing panel module paths

---

## 10. Cherry-Pick Recommendations

### ✅ KEEP (Do Not Discard)
1. **All LifeSync panels** (`trackingPanel`, `registrationPanel`, `screwManagement`)
2. **Segmentation panel** integration
3. **Viewport state panel** (useful for debugging)
4. **Current panel layout** (5 right panels)

### ⚠️ CONSIDER UPDATING
1. **Version number** to `3.12.0-beta.113` (after testing)
2. **Peer dependencies** to match remote versions
3. **Review CHANGELOG** for bug fixes

### ❌ DO NOT FETCH FROM REMOTE
1. **Simplified right panel** (only measurements) - would break LifeSync
2. **Removal of LifeSync references** - would break surgical workflow

---

## 11. Action Plan

### Phase 1: Assessment (Current)
- ✅ Compare local vs remote
- ✅ Document differences
- ✅ Identify custom features

### Phase 2: Decision (Next)
1. Review OHIF CHANGELOG for versions 86-113
2. Decide if version update is necessary
3. Identify critical bug fixes or features

### Phase 3: Implementation (If Updating)
1. Create backup branch
2. Update package.json versions
3. Run `yarn install`
4. Test all LifeSync features
5. Fix any breaking changes

### Phase 4: Validation
1. Test measurement tracking
2. Test LifeSync panels
3. Test surgical workflow
4. Verify no regressions

---

## 12. Conclusion

**Your local version is a CUSTOM SURGICAL PLANNING PLATFORM, not just a measurement viewer.**

The differences are **intentional and necessary** for your LifeSync surgical navigation system. The remote OHIF version is a standard medical image viewer for tracking measurements.

**Recommendation**: **KEEP YOUR LOCAL VERSION** as-is. Only update if there are critical security fixes or features you need from versions 86-113.

---

## Appendix A: Line-by-Line Code Differences

### src/index.ts - Lines 14-22 (tracked object)

**Remote**:
```typescript
export const tracked = {
  measurements: '@ohif/extension-measurement-tracking.panelModule.trackedMeasurements',
  thumbnailList: '@ohif/extension-measurement-tracking.panelModule.seriesList',
  viewport: '@ohif/extension-measurement-tracking.viewportModule.cornerstone-tracked',
};
```

**Local**:
```typescript
export const tracked = {
  measurements: '@ohif/extension-measurement-tracking.panelModule.trackedMeasurements',
  thumbnailList: '@ohif/extension-measurement-tracking.panelModule.seriesList',
  viewport: '@ohif/extension-measurement-tracking.viewportModule.cornerstone-tracked',
  viewportState: '@ohif/extension-cornerstone.panelModule.viewport-state',
  screwManagement: '@ohif/extension-lifesync.panelModule.screw-management',
  trackingPanel: '@ohif/extension-lifesync.panelModule.trackingPanel',
  registrationPanel: '@ohif/extension-lifesync.panelModule.registration-panel',
};
```

**Difference**: +4 lines (viewportState, screwManagement, trackingPanel, registrationPanel)

### src/index.ts - Lines 30-46 (longitudinalInstance)

**Remote**:
```typescript
rightPanels: [tracked.measurements],
```

**Local**:
```typescript
rightPanels: [
  tracked.trackingPanel, 
  tracked.registrationPanel, 
  cornerstone.segmentation, 
  tracked.measurements, 
  tracked.screwManagement
],
```

**Difference**: 1 panel → 5 panels

---

## Appendix B: Dependency Version Timeline

| Version | Release Date | Notes |
|---------|--------------|-------|
| 3.12.0-beta.85 | ~2 months ago | Your current version |
| 3.12.0-beta.86-112 | Between | Unknown changes |
| 3.12.0-beta.113 | ~3 days ago | Latest remote version |

**Gap**: 28 versions (approximately 2 months of development)

---

## Appendix C: File Checksums (Conceptual)

| File | Local | Remote | Match |
|------|-------|--------|-------|
| src/id.js | ✅ | ✅ | Identical |
| babel.config.js | ✅ | ✅ | Identical |
| package.json | ⚠️ | ⚠️ | Different versions |
| src/index.ts | ❌ | ❌ | Heavily modified |

---

**End of Comparison Report**

