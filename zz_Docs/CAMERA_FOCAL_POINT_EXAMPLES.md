# Camera Focal Point Logging - Practical Examples

## 📚 Table of Contents

1. [Basic Examples](#basic-examples)
2. [Advanced Use Cases](#advanced-use-cases)
3. [Integration Examples](#integration-examples)
4. [Debugging Scenarios](#debugging-scenarios)
5. [Data Analysis](#data-analysis)

---

## Basic Examples

### Example 1: Simple Enable and Observe

```javascript
// Enable logging
window.ohif.commandsManager.runCommand('enableCameraLogging');

// Now pan/zoom/scroll in any MPR viewport
// Check the console to see focal points being logged

// When done, disable
window.ohif.commandsManager.runCommand('disableCameraLogging');
```

### Example 2: Get Current State Without Continuous Logging

```javascript
// Get focal points once without enabling continuous logging
const focalPoints = window.ohif.commandsManager.runCommand('getCameraFocalPoints');

console.log('Current MPR Focal Points:', focalPoints);
// Output:
// {
//   "mpr-axial": [128.5, 128.5, 75],
//   "mpr-sagittal": [128.5, 128.5, 75],
//   "mpr-coronal": [128.5, 128.5, 75]
// }
```

### Example 3: Toggle Logging On/Off

```javascript
// Toggle once to enable
window.ohif.commandsManager.runCommand('toggleCameraLogging');

// Do some work...

// Toggle again to disable
window.ohif.commandsManager.runCommand('toggleCameraLogging');
```

---

## Advanced Use Cases

### Example 4: Track Focal Point Changes

```javascript
// Store focal points over time
const focalPointHistory = [];

// Enable logging
window.ohif.commandsManager.runCommand('enableCameraLogging');

// Periodically capture focal points
const interval = setInterval(() => {
  const points = window.ohif.commandsManager.runCommand('getCameraFocalPoints');
  focalPointHistory.push({
    timestamp: new Date().toISOString(),
    points: points
  });
  console.log(`Captured ${focalPointHistory.length} focal point snapshots`);
}, 1000); // Every second

// After 10 seconds, stop and analyze
setTimeout(() => {
  clearInterval(interval);
  window.ohif.commandsManager.runCommand('disableCameraLogging');

  console.log('Focal Point History:', focalPointHistory);
  console.log(`Total snapshots: ${focalPointHistory.length}`);
}, 10000);
```

### Example 5: Calculate Distance Traveled

```javascript
// Calculate how far the focal point has moved
function calculateDistance(point1, point2) {
  const [x1, y1, z1] = point1;
  const [x2, y2, z2] = point2;
  return Math.sqrt(
    Math.pow(x2 - x1, 2) +
    Math.pow(y2 - y1, 2) +
    Math.pow(z2 - z1, 2)
  );
}

// Get initial focal point
const service = window.ohif.servicesManager.services.viewportStateService;
const initial = service.getCurrentFocalPoints()['mpr-axial'];

console.log('Initial focal point:', initial);
console.log('Now pan/zoom/scroll the axial viewport...');
console.log('Then run: checkDistance()');

window.checkDistance = function() {
  const current = service.getCurrentFocalPoints()['mpr-axial'];
  const distance = calculateDistance(initial, current);
  console.log('Current focal point:', current);
  console.log(`Distance traveled: ${distance.toFixed(2)} mm`);
};
```

### Example 6: Monitor Synchronization

```javascript
// Verify all three MPR viewports have the same focal point
function checkSynchronization() {
  const points = window.ohif.commandsManager.runCommand('getCameraFocalPoints');

  const axial = points['mpr-axial'];
  const sagittal = points['mpr-sagittal'];
  const coronal = points['mpr-coronal'];

  if (!axial || !sagittal || !coronal) {
    console.error('❌ Not all MPR viewports found');
    return false;
  }

  // Check if all points are within 0.01mm tolerance
  const tolerance = 0.01;
  const synced =
    Math.abs(axial[0] - sagittal[0]) < tolerance &&
    Math.abs(axial[1] - sagittal[1]) < tolerance &&
    Math.abs(axial[2] - sagittal[2]) < tolerance &&
    Math.abs(axial[0] - coronal[0]) < tolerance &&
    Math.abs(axial[1] - coronal[1]) < tolerance &&
    Math.abs(axial[2] - coronal[2]) < tolerance;

  if (synced) {
    console.log('✅ All MPR viewports are synchronized');
  } else {
    console.log('⚠️ MPR viewports are NOT synchronized:');
    console.log('  Axial:', axial);
    console.log('  Sagittal:', sagittal);
    console.log('  Coronal:', coronal);
  }

  return synced;
}

// Run the check
checkSynchronization();
```

---

## Integration Examples

### Example 7: Export to JSON File

```javascript
// Capture focal points and export to JSON file
function exportFocalPointHistory(durationSeconds) {
  const history = [];

  console.log(`📊 Starting ${durationSeconds}s capture...`);
  window.ohif.commandsManager.runCommand('enableCameraLogging');

  const interval = setInterval(() => {
    const points = window.ohif.commandsManager.runCommand('getCameraFocalPoints');
    history.push({
      timestamp: new Date().toISOString(),
      focalPoints: points
    });
  }, 100); // Capture every 100ms

  setTimeout(() => {
    clearInterval(interval);
    window.ohif.commandsManager.runCommand('disableCameraLogging');

    // Create JSON blob
    const data = {
      metadata: {
        captureDate: new Date().toISOString(),
        duration: durationSeconds,
        sampleCount: history.length,
        sampleRate: '100ms'
      },
      data: history
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Download file
    const a = document.createElement('a');
    a.href = url;
    a.download = `focal-point-history-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`✅ Exported ${history.length} focal point snapshots`);
  }, durationSeconds * 1000);
}

// Export 10 seconds of focal point data
exportFocalPointHistory(10);
```

### Example 8: Send to External API

```javascript
// Send focal points to external API
async function sendFocalPointsToAPI() {
  const points = window.ohif.commandsManager.runCommand('getCameraFocalPoints');

  const data = {
    studyInstanceUID: 'YOUR_STUDY_UID', // Get from OHIF
    timestamp: new Date().toISOString(),
    focalPoints: points
  };

  try {
    const response = await fetch('https://your-api.com/focal-points', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      console.log('✅ Focal points sent successfully');
    } else {
      console.error('❌ Failed to send:', response.statusText);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Send current focal points
sendFocalPointsToAPI();
```

### Example 9: Real-time WebSocket Streaming

```javascript
// Stream focal points to WebSocket server
function streamFocalPointsToWebSocket(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let streaming = false;

  ws.onopen = () => {
    console.log('🔌 WebSocket connected');
    streaming = true;

    // Enable camera logging
    window.ohif.commandsManager.runCommand('enableCameraLogging');

    // Send focal points every 200ms
    const interval = setInterval(() => {
      if (!streaming) {
        clearInterval(interval);
        return;
      }

      const points = window.ohif.commandsManager.runCommand('getCameraFocalPoints');
      ws.send(JSON.stringify({
        type: 'focalPoints',
        timestamp: Date.now(),
        data: points
      }));
    }, 200);
  };

  ws.onerror = (error) => {
    console.error('❌ WebSocket error:', error);
    streaming = false;
  };

  ws.onclose = () => {
    console.log('🔌 WebSocket disconnected');
    streaming = false;
    window.ohif.commandsManager.runCommand('disableCameraLogging');
  };

  return ws;
}

// Start streaming
// const ws = streamFocalPointsToWebSocket('ws://localhost:8080');

// Stop streaming
// ws.close();
```

---

## Debugging Scenarios

### Example 10: Debug Crosshairs Alignment

```javascript
// Check if crosshairs are properly aligned with focal points
function debugCrosshairsAlignment() {
  console.log('🔍 Debugging Crosshairs Alignment');
  console.log('=================================\n');

  const focalPoints = window.ohif.commandsManager.runCommand('getCameraFocalPoints');

  // Get the rendering engine
  const engine = cornerstone3D.core.getRenderingEngine('OHIFCornerstoneRenderingEngine');

  Object.entries(focalPoints).forEach(([viewportId, focalPoint]) => {
    const viewport = engine.getViewport(viewportId);
    const camera = viewport.getCamera();

    console.log(`📍 ${viewportId}:`);
    console.log(`  Focal Point: [${focalPoint.map(v => v.toFixed(2)).join(', ')}]`);
    console.log(`  Camera Position: [${camera.position.map(v => v.toFixed(2)).join(', ')}]`);
    console.log(`  View Up: [${camera.viewUp.map(v => v.toFixed(2)).join(', ')}]`);
    console.log(`  Parallel Scale: ${camera.parallelScale.toFixed(2)}\n`);
  });
}

debugCrosshairsAlignment();
```

### Example 11: Detect Viewport Drift

```javascript
// Detect if viewports are drifting out of sync
function monitorViewportDrift(durationSeconds) {
  console.log(`🔍 Monitoring viewport drift for ${durationSeconds}s...`);

  const driftHistory = [];

  window.ohif.commandsManager.runCommand('enableCameraLogging');

  const interval = setInterval(() => {
    const points = window.ohif.commandsManager.runCommand('getCameraFocalPoints');

    const axial = points['mpr-axial'];
    const sagittal = points['mpr-sagittal'];
    const coronal = points['mpr-coronal'];

    if (axial && sagittal && coronal) {
      const maxDrift = Math.max(
        Math.abs(axial[0] - sagittal[0]),
        Math.abs(axial[1] - sagittal[1]),
        Math.abs(axial[2] - sagittal[2]),
        Math.abs(axial[0] - coronal[0]),
        Math.abs(axial[1] - coronal[1]),
        Math.abs(axial[2] - coronal[2])
      );

      driftHistory.push({
        timestamp: Date.now(),
        maxDrift: maxDrift
      });

      if (maxDrift > 0.5) { // More than 0.5mm drift
        console.warn(`⚠️ Drift detected: ${maxDrift.toFixed(2)}mm`);
      }
    }
  }, 100);

  setTimeout(() => {
    clearInterval(interval);
    window.ohif.commandsManager.runCommand('disableCameraLogging');

    const maxDriftOverall = Math.max(...driftHistory.map(d => d.maxDrift));
    console.log(`\n📊 Drift Analysis Complete:`);
    console.log(`  Samples: ${driftHistory.length}`);
    console.log(`  Max drift: ${maxDriftOverall.toFixed(2)}mm`);

    if (maxDriftOverall < 0.1) {
      console.log('  ✅ Excellent synchronization');
    } else if (maxDriftOverall < 0.5) {
      console.log('  ✅ Good synchronization');
    } else {
      console.log('  ⚠️ Poor synchronization - investigate!');
    }
  }, durationSeconds * 1000);
}

// Monitor for 5 seconds
monitorViewportDrift(5);
```

---

## Data Analysis

### Example 12: Calculate Bounding Box

```javascript
// Calculate bounding box of viewed region
function calculateViewedBoundingBox(durationSeconds) {
  console.log(`📦 Calculating bounding box for ${durationSeconds}s...`);

  const allPoints = [];

  window.ohif.commandsManager.runCommand('enableCameraLogging');

  const interval = setInterval(() => {
    const points = window.ohif.commandsManager.runCommand('getCameraFocalPoints');
    Object.values(points).forEach(point => {
      allPoints.push(point);
    });
  }, 100);

  setTimeout(() => {
    clearInterval(interval);
    window.ohif.commandsManager.runCommand('disableCameraLogging');

    if (allPoints.length === 0) {
      console.log('❌ No data captured');
      return;
    }

    // Calculate min/max for each axis
    const xs = allPoints.map(p => p[0]);
    const ys = allPoints.map(p => p[1]);
    const zs = allPoints.map(p => p[2]);

    const boundingBox = {
      min: [Math.min(...xs), Math.min(...ys), Math.min(...zs)],
      max: [Math.max(...xs), Math.max(...ys), Math.max(...zs)],
      center: [
        (Math.min(...xs) + Math.max(...xs)) / 2,
        (Math.min(...ys) + Math.max(...ys)) / 2,
        (Math.min(...zs) + Math.max(...zs)) / 2
      ],
      dimensions: [
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys),
        Math.max(...zs) - Math.min(...zs)
      ]
    };

    console.log('\n📦 Bounding Box Results:');
    console.log(`  Min: [${boundingBox.min.map(v => v.toFixed(2)).join(', ')}]`);
    console.log(`  Max: [${boundingBox.max.map(v => v.toFixed(2)).join(', ')}]`);
    console.log(`  Center: [${boundingBox.center.map(v => v.toFixed(2)).join(', ')}]`);
    console.log(`  Dimensions: [${boundingBox.dimensions.map(v => v.toFixed(2)).join(', ')}] mm`);
    console.log(`  Volume: ${(boundingBox.dimensions[0] * boundingBox.dimensions[1] * boundingBox.dimensions[2]).toFixed(2)} mm³`);
  }, durationSeconds * 1000);
}

// Calculate for 10 seconds
calculateViewedBoundingBox(10);
```

### Example 13: Generate Heatmap Data

```javascript
// Generate heatmap data of most viewed regions
function generateViewedRegionHeatmap(durationSeconds, gridSize = 10) {
  console.log(`🗺️ Generating heatmap (${gridSize}x${gridSize}x${gridSize}) for ${durationSeconds}s...`);

  const allPoints = [];

  window.ohif.commandsManager.runCommand('enableCameraLogging');

  const interval = setInterval(() => {
    const points = window.ohif.commandsManager.runCommand('getCameraFocalPoints');
    Object.values(points).forEach(point => {
      allPoints.push(point);
    });
  }, 100);

  setTimeout(() => {
    clearInterval(interval);
    window.ohif.commandsManager.runCommand('disableCameraLogging');

    if (allPoints.length === 0) {
      console.log('❌ No data captured');
      return;
    }

    // Find bounds
    const xs = allPoints.map(p => p[0]);
    const ys = allPoints.map(p => p[1]);
    const zs = allPoints.map(p => p[2]);

    const bounds = {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
      minZ: Math.min(...zs),
      maxZ: Math.max(...zs)
    };

    // Create 3D grid
    const heatmap = Array(gridSize).fill().map(() =>
      Array(gridSize).fill().map(() =>
        Array(gridSize).fill(0)
      )
    );

    // Populate grid
    allPoints.forEach(([x, y, z]) => {
      const i = Math.floor((x - bounds.minX) / (bounds.maxX - bounds.minX) * (gridSize - 1));
      const j = Math.floor((y - bounds.minY) / (bounds.maxY - bounds.minY) * (gridSize - 1));
      const k = Math.floor((z - bounds.minZ) / (bounds.maxZ - bounds.minZ) * (gridSize - 1));

      if (i >= 0 && i < gridSize && j >= 0 && j < gridSize && k >= 0 && k < gridSize) {
        heatmap[i][j][k]++;
      }
    });

    // Find hotspots
    let maxCount = 0;
    let hotspot = null;

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        for (let k = 0; k < gridSize; k++) {
          if (heatmap[i][j][k] > maxCount) {
            maxCount = heatmap[i][j][k];
            hotspot = [i, j, k];
          }
        }
      }
    }

    console.log('\n🗺️ Heatmap Results:');
    console.log(`  Total samples: ${allPoints.length}`);
    console.log(`  Grid size: ${gridSize}³ = ${gridSize * gridSize * gridSize} cells`);
    console.log(`  Hotspot cell: [${hotspot.join(', ')}]`);
    console.log(`  Hotspot count: ${maxCount} (${(maxCount / allPoints.length * 100).toFixed(1)}%)`);
    console.log('\n  Use window.heatmapData to access the full 3D array');

    window.heatmapData = {
      grid: heatmap,
      bounds: bounds,
      gridSize: gridSize,
      totalSamples: allPoints.length
    };
  }, durationSeconds * 1000);
}

// Generate heatmap
generateViewedRegionHeatmap(10, 10);
```

---

## Summary

These examples demonstrate:

1. **Basic Operations** - Simple enable/disable/toggle
2. **Advanced Tracking** - History, distance, synchronization
3. **Integration** - Export to files, APIs, WebSocket streaming
4. **Debugging** - Alignment checks, drift detection
5. **Analysis** - Bounding boxes, heatmaps, statistics

All examples are ready to copy/paste into the browser console when OHIF is running with MPR mode enabled.

For complete documentation, see [`CAMERA_FOCAL_POINT_LOGGING.md`](./CAMERA_FOCAL_POINT_LOGGING.md).
