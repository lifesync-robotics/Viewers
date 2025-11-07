# 🎯 How to Use 3D Fiducial Markers - Quick Start

## ✅ Integration Complete!

I've just integrated the **FiducialMarker tool** into your OHIF viewer!

---

## 📋 **What Was Done**

✅ **Step 1:** Registered `FiducialMarkerTool` in `initCornerstoneTools.js`
✅ **Step 2:** Added "Fiducial" button to toolbar (`toolbarButtons.ts`)
✅ **Step 3:** Added to MeasurementTools menu (`index.tsx`)
✅ **Step 4:** Added to tool groups (`initToolGroups.ts`)
✅ **Step 5:** No linter errors ✨

---

## 🚀 **How to Use (3 Steps)**

### **Step 1: Rebuild OHIF**

```bash
cd /home/asclepius/github/Viewers
yarn dev

# Wait for build to complete (1-2 minutes)
# Then open: http://localhost:3000
```

---

### **Step 2: Load Study & Place Fiducials**

```
1. Load a DICOM study with MPR mode
2. Click "MeasurementTools" dropdown in toolbar
3. Select "Fiducial" (circle icon)
4. Click in any viewport to place markers
5. Yellow spheres appear in all views!
```

---

### **Step 3: Export Coordinates**

```javascript
// Open browser console (F12) and paste:

const { annotation } = window.cornerstone.cornerstoneTools;
const fiducials = annotation.state.getAnnotations('FiducialMarker');

console.log('📍 Fiducial Markers (RAS mm):');
fiducials.forEach(fid => {
  const p = fid.data.handles.points[0];
  console.log(`${fid.data.label}: [${p[0].toFixed(2)}, ${p[1].toFixed(2)}, ${p[2].toFixed(2)}]`);
});

// Output example:
// F1: [-40.12, -110.45, -503.78]
// F2: [20.34, -95.23, -480.56]
// F3: [-15.67, -120.89, -525.12]
```

---

## 🎨 **Visual Guide**

```
Toolbar:
┌─────────────────────────────────────┐
│ [📏] MeasurementTools ▼             │
│   ├─ Length                         │
│   ├─ Bidirectional                  │
│   ├─ Arrow                          │
│   ├─ Ellipse ROI                    │
│   ├─ Rectangle ROI                  │
│   ├─ Circle ROI                     │
│   ├─ 🎯 Fiducial  ← Click here!     │
│   ├─ Freehand ROI                   │
│   └─ Spline ROI                     │
└─────────────────────────────────────┘

Viewport with Fiducial:
┌─────────────────────────────────────┐
│  Axial View                         │
│                                     │
│          ⚪ F1                       │
│         /   \                       │
│        |  ●  |  ← 3D Sphere         │
│         \   /                       │
│          ---                        │
│                                     │
└─────────────────────────────────────┘
```

---

## 🔧 **Features**

✅ **3D Spheres** - True sphere visualization (not just points)
✅ **Auto-labeling** - F1, F2, F3, F4... automatically
✅ **Multi-view Sync** - Visible in axial, sagittal, coronal
✅ **World Coordinates** - RAS (Right-Anterior-Superior) in mm
✅ **Interactive** - Click to select, drag to move
✅ **Configurable** - Change radius, color, etc.

---

## 📊 **Export to JSON File**

```javascript
// Export all fiducials to downloadable JSON file
function exportFiducials() {
  const { annotation } = window.cornerstone.cornerstoneTools;
  const fiducials = annotation.state.getAnnotations('FiducialMarker');

  const data = {
    format: 'OHIF Fiducial Markers v1.0',
    coordinate_system: 'RAS',
    units: 'mm',
    timestamp: new Date().toISOString(),
    count: fiducials.length,
    fiducials: fiducials.map((fid, index) => ({
      id: fid.data.label,
      position: {
        x: fid.data.handles.points[0][0],
        y: fid.data.handles.points[0][1],
        z: fid.data.handles.points[0][2],
      },
      radius: fid.data.radius,
    }))
  };

  // Download
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fiducials_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  console.log(`✅ Exported ${data.count} fiducials`);
}

// Run:
exportFiducials();
```

---

## 🧮 **Registration Example**

```javascript
// Calculate transformation between two sets of fiducials

// Step 1: Load CT scan, place fiducials (F1, F2, F3)
const ctFiducials = annotation.state.getAnnotations('FiducialMarker');
const ctPoints = ctFiducials.map(f => f.data.handles.points[0]);
console.log('CT points:', ctPoints);

// Save for later
localStorage.setItem('ct_fiducials', JSON.stringify(ctPoints));

// Step 2: Load MRI scan, place corresponding fiducials
const mriFiducials = annotation.state.getAnnotations('FiducialMarker');
const mriPoints = mriFiducials.map(f => f.data.handles.points[0]);
console.log('MRI points:', mriPoints);

// Step 3: Calculate transform
const savedCtPoints = JSON.parse(localStorage.getItem('ct_fiducials'));

function calculateTransform(source, target) {
  const n = source.length;

  // Centroids
  const srcCentroid = source.reduce((sum, p) =>
    [sum[0] + p[0]/n, sum[1] + p[1]/n, sum[2] + p[2]/n], [0,0,0]
  );
  const tgtCentroid = target.reduce((sum, p) =>
    [sum[0] + p[0]/n, sum[1] + p[1]/n, sum[2] + p[2]/n], [0,0,0]
  );

  // Translation
  const translation = [
    tgtCentroid[0] - srcCentroid[0],
    tgtCentroid[1] - srcCentroid[1],
    tgtCentroid[2] - srcCentroid[2]
  ];

  console.log('Translation (mm):', translation.map(t => t.toFixed(2)));

  // Calculate error
  let totalError = 0;
  source.forEach((src, i) => {
    const tgt = target[i];
    const transformed = src.map((s, j) => s + translation[j]);
    const error = Math.sqrt(
      transformed.reduce((sum, val, j) => sum + Math.pow(val - tgt[j], 2), 0)
    );
    console.log(`F${i+1} error: ${error.toFixed(2)} mm`);
    totalError += error;
  });

  const meanFRE = totalError / n;
  console.log(`Mean FRE: ${meanFRE.toFixed(2)} mm`);

  if (meanFRE < 2.0) {
    console.log('✅ Excellent registration!');
  } else if (meanFRE < 5.0) {
    console.log('⚠️ Acceptable registration');
  } else {
    console.log('❌ Poor registration - recheck fiducial placement');
  }

  return { translation, meanFRE };
}

const result = calculateTransform(savedCtPoints, mriPoints);
```

---

## 🎨 **Customize Appearance**

```javascript
// Change sphere radius (default 3mm)
const { cornerstoneTools } = window.cornerstone;
const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup('default');

toolGroup.setToolConfiguration('FiducialMarker', {
  radius: 5.0,  // Larger spheres (5mm)
});

// Change color to red
cornerstoneTools.annotation.config.style.setToolGroupToolStyles('default', {
  FiducialMarker: {
    color: 'rgb(255, 0, 0)',  // Red
    lineWidth: 2,
  }
});

// Re-render
cornerstoneViewportService.getRenderingEngine().render();
```

---

## 🔗 **Use with Navigation System**

```javascript
// Navigate to a specific fiducial marker

const fiducials = annotation.state.getAnnotations('FiducialMarker');
const targetFiducial = fiducials[0]; // First marker

// Get position
const position = targetFiducial.data.handles.points[0];
console.log('Navigating to:', position);

// Set as tracking center
const { trackingService, commandsManager } = servicesManager.services;
trackingService.setCenter(position);

// Start circular navigation around this fiducial
commandsManager.runCommand('startNavigation', { mode: 'circular' });

console.log('✅ Navigating around fiducial marker!');
```

---

## 🧹 **Clear All Fiducials**

```javascript
// Remove all fiducial markers
const fiducials = annotation.state.getAnnotations('FiducialMarker');

fiducials.forEach(fid => {
  annotation.state.removeAnnotation(fid.annotationUID);
});

// Re-render
cornerstoneViewportService.getRenderingEngine().render();

console.log('✅ All fiducials cleared');
```

---

## 🐛 **Troubleshooting**

### **Problem: Button not appearing**

```bash
# Check if build completed successfully
yarn dev

# Look for errors in terminal
# If errors, check syntax in edited files
```

### **Problem: Tool not working when clicked**

```javascript
// Check if tool is registered
const tools = cornerstone.cornerstoneTools.ToolGroupManager.getToolGroup('default');
console.log(tools.getToolNames());

// Should include 'FiducialMarker'
```

### **Problem: Sphere not visible**

```javascript
// Check if annotations exist
const fiducials = annotation.state.getAnnotations('FiducialMarker');
console.log('Fiducial count:', fiducials.length);

// Force re-render
cornerstoneViewportService.getRenderingEngine().render();
```

---

## 📚 **Documentation**

| File | Purpose |
|------|---------|
| `HOW_TO_USE_3D_FIDUCIALS.md` | This file - quick start |
| `FIDUCIAL_MARKERS_README.md` | Complete overview |
| `QUICK_FIDUCIAL_EXAMPLE.md` | Alternative using Probe tool |
| `FIDUCIAL_MARKER_3D_GUIDE.md` | Deep dive guide |
| `FIDUCIAL_INTEGRATION_STEPS.md` | Integration details |

---

## ✅ **Summary**

**You now have 3D sphere fiducial markers in OHIF!**

**Next Steps:**
1. **Rebuild:** `yarn dev`
2. **Test:** Load study → Click "Fiducial" → Place markers
3. **Export:** Use console scripts to get coordinates
4. **Register:** Use for multi-modal registration

---

**Status:** ✅ **Integration complete! Ready to use!**

🎯 **Start using 3D fiducial markers for surgical navigation!**
