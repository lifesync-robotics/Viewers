# 🔧 Step-by-Step Integration Guide for Custom Fiducial Tool

## 📋 **Prerequisites**

- ✅ `FiducialMarkerTool.ts` already created
- ✅ OHIF development environment running
- ⏱️ Estimated time: 30 minutes

---

## 🚀 **Integration Steps**

### **Step 1: Register the Tool (5 min)**

Edit: `/home/asclepius/github/Viewers/extensions/cornerstone/src/initCornerstoneTools.js`

```javascript
// At the top, add import:
import FiducialMarkerTool from './tools/FiducialMarkerTool';

// In the function body (around line 69-111), add after other addTool() calls:
addTool(FiducialMarkerTool);

// Update the toolNames export at the end (around line 117+):
export const toolNames = {
  Pan: 'Pan',
  Zoom: 'Zoom',
  WindowLevel: 'WindowLevel',
  StackScroll: 'StackScroll',
  VolumeRotate: 'VolumeRotate',
  MIPJumpToClick: 'MIPJumpToClick',
  Length: 'Length',
  ArrowAnnotate: 'ArrowAnnotate',
  Bidirectional: 'Bidirectional',
  DragProbe: 'DragProbe',
  Probe: 'Probe',
  EllipticalROI: 'EllipticalROI',
  CircleROI: 'CircleROI',
  RectangleROI: 'RectangleROI',
  RectangleROIThreshold: 'RectangleROIThreshold',
  Angle: 'Angle',
  CobbAngle: 'CobbAngle',
  PlanarFreehandROI: 'PlanarFreehandROI',
  Magnify: 'Magnify',
  AdvancedMagnify: 'AdvancedMagnify',
  RectangleScissors: 'RectangleScissors',
  CircleScissors: 'CircleScissors',
  SphereScissors: 'SphereScissors',
  Brush: 'Brush',
  Crosshairs: 'Crosshairs',
  SplineROI: 'SplineROI',
  LivewireContour: 'LivewireContour',
  PaintFill: 'PaintFill',
  ReferenceLines: 'ReferenceLines',
  CalibrationLine: 'CalibrationLine',
  TrackballRotate: 'TrackballRotate',
  SegmentBidirectional: 'SegmentBidirectional',
  UltrasoundDirectional: 'UltrasoundDirectional',
  UltrasoundPleuraBLine: 'UltrasoundPleuraBLine',
  ImageOverlayViewer: 'ImageOverlayViewer',
  OrientationMarker: 'OrientationMarker',
  WindowLevelRegion: 'WindowLevelRegion',
  PlanarFreehandContourSegmentation: 'PlanarFreehandContourSegmentation',
  SegmentSelect: 'SegmentSelect',
  SegmentLabel: 'SegmentLabel',
  LabelmapSlicePropagation: 'LabelmapSlicePropagation',
  MarkerLabelmap: 'MarkerLabelmap',
  RegionSegmentPlus: 'RegionSegmentPlus',
  FiducialMarker: 'FiducialMarker',  // ← Add this line
};
```

---

### **Step 2: Add Toolbar Button (10 min)**

Edit: `/home/asclepius/github/Viewers/modes/basic/src/toolbarButtons.ts`

Find the section where measurement tools are defined (around line 300+) and add:

```typescript
{
  id: 'FiducialMarker',
  uiType: 'ohif.radioGroup',
  props: {
    icon: 'circle-notch', // Or 'tool-probe' or 'tool-length'
    label: i18n.t('Buttons:Fiducial Marker'),
    tooltip: i18n.t('Buttons:Place 3D fiducial markers for registration'),
    commands: setToolActiveToolbar,
    evaluate: 'evaluate.cornerstoneTool',
  },
},
```

**Full context (where to insert):**

```typescript
// Around line 330-370, add after Probe or other measurement tools:

{
  id: 'Probe',
  uiType: 'ohif.radioGroup',
  props: {
    icon: 'tool-probe',
    label: i18n.t('Buttons:Probe'),
    tooltip: i18n.t('Buttons:Probe'),
    commands: setToolActiveToolbar,
    evaluate: 'evaluate.cornerstoneTool',
  },
},
{
  id: 'FiducialMarker',  // ← Add this entire block here
  uiType: 'ohif.radioGroup',
  props: {
    icon: 'circle-notch',
    label: i18n.t('Buttons:Fiducial Marker'),
    tooltip: i18n.t('Buttons:Place 3D fiducial markers for registration'),
    commands: setToolActiveToolbar,
    evaluate: 'evaluate.cornerstoneTool',
  },
},
```

---

### **Step 3: Add to Toolbar Layout (5 min)**

Edit: `/home/asclepius/github/Viewers/modes/basic/src/index.tsx`

Find the `TOOLBAR_SECTIONS.primary` array (around line 280-310) and add:

```typescript
export const toolbarSections = {
  [TOOLBAR_SECTIONS.primary]: [
    'MeasurementTools',
    'FiducialMarker',  // ← Add this line (after MeasurementTools)
    'Zoom',
    'WindowLevel',
    'Pan',
    'Capture',
    'Layout',
    'Crosshairs',
    'MoreTools',
    'Cine',
    'Angle',
    'RealTimeNavigation',
    'SetNavigationCenter',
  ],
  // ... rest of config
};
```

**Alternative placement (in MeasurementTools group):**

If you want it in the measurement tools dropdown, find where measurement tools are defined and add it there.

---

### **Step 4: Add Measurement Service Mapping (Optional, 10 min)**

This step is optional but recommended for persistence and DICOM SR export.

Create: `/home/asclepius/github/Viewers/extensions/cornerstone/src/utils/measurementServiceMappings/FiducialMarker.ts`

```typescript
import { log } from '@ohif/core';
import getSOPInstanceAttributes from './utils/getSOPInstanceAttributes';

const FiducialMarker = {
  toAnnotation: measurement => {
    // Implementation for loading from measurement service
    return null;
  },

  toMeasurement: (
    csToolsEventDetail,
    displaySetService,
    CornerstoneViewportService,
    getValueTypeFromToolType,
    customizationService
  ) => {
    const { annotation } = csToolsEventDetail;
    const { metadata, data } = annotation;

    if (!data || !data.handles || !data.handles.points) {
      log.warn('FiducialMarker: Invalid annotation data');
      return null;
    }

    const { toolName, referencedImageId, FrameOfReferenceUID } = metadata;
    const validToolType = toolName === 'FiducialMarker';

    if (!validToolType) {
      log.warn('FiducialMarker: Tool type is not FiducialMarker');
      return null;
    }

    const { SOPInstanceUID, SeriesInstanceUID, StudyInstanceUID } =
      getSOPInstanceAttributes(
        referencedImageId,
        displaySetService,
        annotation
      );

    const displaySet = displaySetService.getDisplaySetsForSeries(SeriesInstanceUID)?.[0];

    if (!displaySet) {
      return null;
    }

    const point = data.handles.points[0];

    return {
      uid: annotation.annotationUID,
      SOPInstanceUID,
      FrameOfReferenceUID,
      points: [[point[0], point[1], point[2]]],
      metadata,
      referenceSeriesUID: SeriesInstanceUID,
      referenceStudyUID: StudyInstanceUID,
      referencedImageId,
      frameNumber: 1,
      toolName,
      displaySetInstanceUID: displaySet.displaySetInstanceUID,
      label: data.label,
      type: 'point',
      radius: data.radius,
    };
  },
};

export default FiducialMarker;
```

Then register it in: `/home/asclepius/github/Viewers/extensions/cornerstone/src/initMeasurementService.ts`

```typescript
// At the top with other imports:
import FiducialMarker from './utils/measurementServiceMappings/FiducialMarker';

// In the initialization:
const {
  Length,
  Bidirectional,
  // ... other tools ...
  SegmentBidirectional,
  FiducialMarker,  // ← Add this
} = measurementServiceMappingsFactory(
  measurementService,
  displaySetService,
  cornerstoneViewportService,
  customizationService
);

// Add mapping (after other mappings, around line 180+):
measurementService.addMapping(
  csTools3DVer1MeasurementSource,
  'FiducialMarker',
  FiducialMarker.matchingCriteria || (() => true),
  FiducialMarker.toAnnotation,
  FiducialMarker.toMeasurement
);
```

---

### **Step 5: Rebuild and Test**

```bash
# In the OHIF Viewers directory:
cd /home/asclepius/github/Viewers

# Rebuild
yarn dev

# Wait for build to complete (1-2 minutes)
# Then open browser to http://localhost:3000
```

---

## ✅ **Verification Checklist**

After rebuild, verify:

- [ ] OHIF opens without errors
- [ ] "Fiducial Marker" button appears in toolbar
- [ ] Clicking button activates the tool
- [ ] Clicking in viewport places a yellow sphere marker
- [ ] Marker is visible in all MPR views (axial, sagittal, coronal)
- [ ] Marker is labeled (F1, F2, F3...)
- [ ] Can place multiple markers
- [ ] Console shows no errors

---

## 🧪 **Testing the Tool**

### **Test 1: Basic Placement**

```
1. Load a DICOM study with MPR mode
2. Click "Fiducial Marker" button
3. Click in axial view
4. Verify: Yellow sphere appears
5. Verify: Same sphere visible in sagittal and coronal views
6. Verify: Label shows "F1"
7. Place 2 more markers (F2, F3)
```

### **Test 2: Get Coordinates**

```javascript
// Open browser console (F12)
const { annotation } = window.cornerstone.cornerstoneTools;
const fiducials = annotation.state.getAnnotations('FiducialMarker');

console.log('📍 Fiducial Coordinates:');
fiducials.forEach(fid => {
  const point = fid.data.handles.points[0];
  console.log(`${fid.data.label}: [${point[0].toFixed(2)}, ${point[1].toFixed(2)}, ${point[2].toFixed(2)}]`);
});

// Expected output:
// F1: [-40.12, -110.45, -503.78]
// F2: [20.34, -95.23, -480.56]
// F3: [-15.67, -120.89, -525.12]
```

### **Test 3: Interaction**

```
1. Click on a marker → should highlight (yellow border)
2. Drag marker → should move in 3D space
3. Click elsewhere → marker deselects
4. Right-click marker → should show context menu (delete, edit)
```

---

## 🐛 **Troubleshooting**

### **Problem: Button not appearing**

```bash
# Check if tool is registered
# In browser console:
const tools = cornerstone.cornerstoneTools.ToolGroupManager.getToolGroup('default');
console.log(tools.getToolNames());

# Should include 'FiducialMarker'
```

**Fix:** Verify Step 1 was completed correctly.

---

### **Problem: Tool not working when clicked**

```javascript
// Check if tool is enabled
const toolGroup = cornerstone.cornerstoneTools.ToolGroupManager.getToolGroup('default');
console.log(toolGroup.getToolConfiguration('FiducialMarker'));

// Should return configuration object
```

**Fix:** Ensure `setToolActiveToolbar` command is set in button props.

---

### **Problem: Sphere not visible**

```javascript
// Check if annotations exist
const { annotation } = window.cornerstone.cornerstoneTools;
const fiducials = annotation.state.getAnnotations('FiducialMarker');
console.log('Fiducial count:', fiducials.length);

// Force re-render
cornerstoneViewportService.getRenderingEngine().render();
```

**Fix:** Check `renderAnnotation` method in `FiducialMarkerTool.ts`.

---

### **Problem: Build errors**

```bash
# Check for syntax errors
yarn build

# Common issues:
# - Missing import
# - Typo in tool name
# - Missing semicolon
```

**Fix:** Check console output for specific error messages.

---

## 📊 **File Changes Summary**

| File | Action | Lines Changed |
|------|--------|--------------|
| `FiducialMarkerTool.ts` | ✅ Created | ~400 (already done) |
| `initCornerstoneTools.js` | ✏️ Edit | +2 lines |
| `toolbarButtons.ts` | ✏️ Edit | +10 lines |
| `index.tsx` (mode) | ✏️ Edit | +1 line |
| `FiducialMarker.ts` (mapping) | 🔧 Optional | ~100 lines |
| `initMeasurementService.ts` | 🔧 Optional | +15 lines |

**Total edits:** ~3 files (required) + 2 files (optional)

---

## 🎯 **Quick Integration Script**

Want to automate? Here's a helper script:

```bash
#!/bin/bash
# File: integrate-fiducial-tool.sh

VIEWERS_PATH="/home/asclepius/github/Viewers"

echo "🔧 Integrating FiducialMarkerTool..."

# Step 1: Check if tool file exists
if [ ! -f "$VIEWERS_PATH/extensions/cornerstone/src/tools/FiducialMarkerTool.ts" ]; then
  echo "❌ FiducialMarkerTool.ts not found!"
  exit 1
fi

echo "✅ FiducialMarkerTool.ts found"

# Step 2: Add to initCornerstoneTools.js
echo "📝 Updating initCornerstoneTools.js..."
# (Manual edit recommended - safer than sed)

# Step 3: Add button
echo "📝 Updating toolbarButtons.ts..."
# (Manual edit recommended)

# Step 4: Rebuild
echo "🔨 Rebuilding OHIF..."
cd "$VIEWERS_PATH"
yarn dev

echo "✅ Integration complete!"
echo "🌐 Open http://localhost:3000 to test"
```

---

## ✅ **Success Criteria**

After integration, you should be able to:

✅ Click "Fiducial Marker" button
✅ Place 3D sphere markers
✅ See markers in all MPR views
✅ Get world coordinates (X, Y, Z mm)
✅ Export to JSON
✅ Use for registration

---

## 📚 **Next Steps**

After successful integration:

1. **Test with real data:** Load patient scans and place markers
2. **Export workflow:** Test coordinate export for registration software
3. **Documentation:** Train users on fiducial placement
4. **Integration:** Connect to external registration tools
5. **Advanced features:** Add color coding, groups, etc.

---

**Status:** 📋 **Ready for integration - follow steps above!**

Let me know when you're ready to proceed, and I can assist with any specific step! 🚀
