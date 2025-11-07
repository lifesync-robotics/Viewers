# 🚀 Quick 3D Fiducial Markers - Immediate Solution

## ✅ **Use Built-In Probe Tool for Fiducials RIGHT NOW**

You don't need to wait for custom integration! OHIF already has the **Probe tool** that works perfectly for fiducial markers.

---

## 🎯 **Immediate Usage (No Code Changes Needed)**

### **Step 1: Enable Probe Tool**

In OHIF viewer:
1. Click the **Probe** button in the toolbar (looks like a dot or target icon)
2. Click in any MPR view to place a marker
3. Marker appears in all views simultaneously ✅

### **Step 2: Get Fiducial Coordinates**

```javascript
// In browser console (F12):

// Get all probe annotations (your fiducial markers)
const { annotation } = window.cornerstone.cornerstoneTools;
const fiducials = annotation.state.getAnnotations('Probe');

console.log('📍 Fiducial Markers:');
fiducials.forEach((fid, index) => {
  const point = fid.data.handles.points[0];
  console.log(`  F${index + 1}: [${point[0].toFixed(2)}, ${point[1].toFixed(2)}, ${point[2].toFixed(2)}] mm`);
  console.log(`     HU value: ${fid.data.cachedStats?.mean?.toFixed(0) || 'N/A'}`);
});

// Export to JSON
const exportData = fiducials.map((fid, index) => ({
  id: `F${index + 1}`,
  position: {
    x: fid.data.handles.points[0][0],
    y: fid.data.handles.points[0][1],
    z: fid.data.handles.points[0][2],
  },
  value: fid.data.cachedStats?.mean,
  unit: 'mm',
}));

console.log(JSON.stringify(exportData, null, 2));
```

**Output Example:**
```json
[
  {
    "id": "F1",
    "position": {
      "x": -40.12,
      "y": -110.45,
      "z": -503.78
    },
    "value": 1024,
    "unit": "mm"
  },
  {
    "id": "F2",
    "position": {
      "x": 20.34,
      "y": -95.23,
      "z": -480.56
    },
    "value": 1056,
    "unit": "mm"
  }
]
```

---

## 🎨 **Visual Enhancement: Make Probes Look Like Spheres**

```javascript
// Customize probe appearance to look more like fiducial spheres
const { annotation } = window.cornerstone.cornerstoneTools;

// Set style for all probe annotations
annotation.config.style.setToolGroupToolStyles('default', {
  Probe: {
    color: 'rgb(255, 255, 0)',     // Yellow color
    lineWidth: 3,                   // Thicker lines
    handleRadius: 6,                // Larger handle (sphere-like)
  }
});

// Re-render to apply changes
cornerstoneViewportService.getRenderingEngine().render();
```

---

## 📊 **Registration Workflow with Probe Tool**

### **Scenario: Register CT to MRI**

```javascript
// 1. Load CT scan
// Place probes at anatomical landmarks:
//   - Probe at skull landmark 1
//   - Probe at skull landmark 2
//   - Probe at skull landmark 3

// Get CT fiducials
const ctFiducials = annotation.state.getAnnotations('Probe');
const ctPoints = ctFiducials.map(fid => fid.data.handles.points[0]);

console.log('CT Fiducials:', ctPoints);

// Save for later
localStorage.setItem('ct_fiducials', JSON.stringify(ctPoints));

// 2. Load MRI scan (same patient)
// Place probes at SAME anatomical landmarks

// Get MRI fiducials
const mriFiducials = annotation.state.getAnnotations('Probe');
const mriPoints = mriFiducials.map(fid => fid.data.handles.points[0]);

console.log('MRI Fiducials:', mriPoints);

// 3. Calculate registration
const ctPoints = JSON.parse(localStorage.getItem('ct_fiducials'));

// Calculate centroid-based transformation
const ctCentroid = ctPoints.reduce((sum, p) =>
  [sum[0] + p[0], sum[1] + p[1], sum[2] + p[2]],
  [0, 0, 0]
).map(v => v / ctPoints.length);

const mriCentroid = mriPoints.reduce((sum, p) =>
  [sum[0] + p[0], sum[1] + p[1], sum[2] + p[2]],
  [0, 0, 0]
).map(v => v / mriPoints.length);

const translation = [
  mriCentroid[0] - ctCentroid[0],
  mriCentroid[1] - ctCentroid[1],
  mriCentroid[2] - ctCentroid[2]
];

console.log('Registration Translation:', translation);
console.log('  X offset:', translation[0].toFixed(2), 'mm');
console.log('  Y offset:', translation[1].toFixed(2), 'mm');
console.log('  Z offset:', translation[2].toFixed(2), 'mm');
```

---

## 🔧 **Advanced: Clear All Fiducials**

```javascript
// Remove all probe annotations (start fresh)
const { annotation } = window.cornerstone.cornerstoneTools;
const fiducials = annotation.state.getAnnotations('Probe');

fiducials.forEach(fid => {
  annotation.state.removeAnnotation(fid.annotationUID);
});

// Re-render
cornerstoneViewportService.getRenderingEngine().render();

console.log('✅ All fiducials cleared');
```

---

## 🎯 **Integration with Navigation System**

```javascript
// Use fiducial as navigation target

// Get first fiducial
const fiducials = annotation.state.getAnnotations('Probe');
const targetPoint = fiducials[0].data.handles.points[0];

console.log('Navigating to fiducial:', targetPoint);

// Set as tracking center
const { trackingService } = servicesManager.services;
trackingService.setCenter(targetPoint);

// Start circular navigation around fiducial
commandsManager.runCommand('startNavigation', { mode: 'circular' });

console.log('✅ Navigation started around fiducial marker');
```

---

## 📋 **Comparison: Probe vs Custom Fiducial Tool**

| Feature | Probe Tool (Built-in) | Custom Fiducial Tool |
|---------|----------------------|---------------------|
| **Available Now** | ✅ Yes | ⚠️ Needs integration |
| **3D Position** | ✅ World coordinates | ✅ World coordinates |
| **Multi-view Sync** | ✅ Automatic | ✅ Automatic |
| **Visualization** | Point marker | 🎯 Sphere (better depth) |
| **Labeling** | Manual | ✅ Auto (F1, F2, F3...) |
| **HU/Intensity Value** | ✅ Shows value | ❌ No |
| **Registration Export** | ✅ Easy | ✅ Easy |
| **Customization** | Limited | ✅ Full control |

---

## 🚀 **Recommended Approach**

### **For Immediate Use:**
✅ **Use Probe Tool** - Available right now, works perfectly

```javascript
// Quick workflow:
1. Click Probe tool
2. Place markers in all views
3. Run export script (see above)
4. Use coordinates for registration
```

### **For Production System:**
✅ **Integrate Custom Fiducial Tool** - Better UX, purpose-built

```javascript
// Better long-term solution:
1. Integrate FiducialMarkerTool (see FIDUCIAL_MARKER_3D_GUIDE.md)
2. Add dedicated "Fiducial" button
3. Custom sphere visualization
4. Export to registration software
```

---

## 💡 **Pro Tips**

### **Tip 1: Name Your Fiducials**

```javascript
// Add labels to probe annotations
const fiducials = annotation.state.getAnnotations('Probe');
const labels = ['Anterior Commissure', 'Posterior Commissure', 'Mid-Sagittal Point'];

fiducials.forEach((fid, index) => {
  fid.data.label = labels[index];
});

// Re-render
cornerstoneViewportService.getRenderingEngine().render();
```

### **Tip 2: Calculate Registration Error**

```javascript
// After applying transformation, check accuracy
function calculateError(sourcePoints, targetPoints, transform) {
  let totalError = 0;

  sourcePoints.forEach((src, i) => {
    const tgt = targetPoints[i];
    // Apply transform to source
    const transformed = [
      src[0] + transform[0],
      src[1] + transform[1],
      src[2] + transform[2]
    ];

    // Calculate distance
    const error = Math.sqrt(
      Math.pow(transformed[0] - tgt[0], 2) +
      Math.pow(transformed[1] - tgt[1], 2) +
      Math.pow(transformed[2] - tgt[2], 2)
    );

    console.log(`  F${i + 1} error: ${error.toFixed(2)} mm`);
    totalError += error;
  });

  const meanError = totalError / sourcePoints.length;
  console.log(`Mean Registration Error: ${meanError.toFixed(2)} mm`);

  return meanError;
}
```

### **Tip 3: Save Fiducials to File**

```javascript
// Export fiducials to downloadable JSON file
function exportFiducials(filename = 'fiducials.json') {
  const fiducials = annotation.state.getAnnotations('Probe');

  const data = {
    timestamp: new Date().toISOString(),
    patient_id: 'PATIENT_001', // Get from DICOM
    modality: 'CT', // Get from viewport
    count: fiducials.length,
    fiducials: fiducials.map((fid, index) => ({
      id: `F${index + 1}`,
      label: fid.data.label || '',
      position: {
        x: fid.data.handles.points[0][0],
        y: fid.data.handles.points[0][1],
        z: fid.data.handles.points[0][2],
      },
      value: fid.data.cachedStats?.mean,
      frame_of_reference: fid.metadata.FrameOfReferenceUID,
    }))
  };

  // Download
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  console.log(`✅ Exported ${data.count} fiducials to ${filename}`);
}

// Usage:
exportFiducials('patient001_ct_fiducials.json');
```

---

## ✅ **Summary**

**You can start using 3D fiducial markers RIGHT NOW!**

**Quick Solution (Immediate):**
```javascript
// 1. Enable Probe tool in OHIF
// 2. Click to place markers
// 3. Run this to get coordinates:

const fiducials = cornerstone.cornerstoneTools.annotation.state.getAnnotations('Probe');
fiducials.forEach((f, i) => {
  const p = f.data.handles.points[0];
  console.log(`F${i+1}: [${p[0].toFixed(2)}, ${p[1].toFixed(2)}, ${p[2].toFixed(2)}]`);
});
```

**Better Solution (Production):**
- Integrate custom FiducialMarkerTool (see FIDUCIAL_MARKER_3D_GUIDE.md)
- Better visualization with spheres
- Purpose-built for registration
- Auto-labeling and export features

---

**Status:** ✅ **You can use Probe tool for fiducials immediately!**

No code changes needed - it's already in OHIF! 🎯
