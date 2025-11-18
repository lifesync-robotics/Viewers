# Camera Focal Point Logging for OHIF MPR Viewports

## 🎯 What is This?

A feature that allows you to **print the camera focal point in real-time** for OHIF's Multi-Planar Reconstruction (MPR) viewports: **mpr-axial**, **mpr-sagittal**, and **mpr-coronal**.

The focal point is the 3D coordinate `[x, y, z]` in patient space that the camera is looking at. It updates whenever you pan, zoom, scroll, or rotate the MPR planes.

## ⚡ Quick Start (30 Seconds)

1. **Load OHIF with MPR mode** (open a 3D study)
2. **Wait for images to load completely** (important!)
3. **Open browser console** (Press F12)
4. **Copy and paste this helper function first:**
   ```javascript
   // Universal helper that works even if window.ohif isn't ready
   window.cameraLogging = (function() {
     function getCommandsManager() {
       return window.ohif?.commandsManager ||
              window.OHIF?.commandsManager ||
              window.commandsManager;
     }
     return {
       enable: () => getCommandsManager()?.runCommand('enableCameraLogging'),
       disable: () => getCommandsManager()?.runCommand('disableCameraLogging'),
       toggle: () => getCommandsManager()?.runCommand('toggleCameraLogging'),
       get: () => getCommandsManager()?.runCommand('getCameraFocalPoints')
     };
   })();
   ```
5. **Enable logging:**
   ```javascript
   cameraLogging.enable();
   ```
6. **Interact with MPR viewports** (pan, zoom, scroll)
7. **Watch console output** - focal points are logged in real-time!
8. **Disable when done:**
   ```javascript
   cameraLogging.disable();
   ```

### ⚠️ Getting "Cannot read properties of undefined" Error?

This means OHIF hasn't fully loaded yet. **Solution:**

```javascript
// Wait 3 seconds, then enable
setTimeout(() => {
  window.ohif.commandsManager.runCommand('enableCameraLogging');
}, 3000);
```

**See full troubleshooting guide:** [CAMERA_FOCAL_POINT_TROUBLESHOOTING.md](CAMERA_FOCAL_POINT_TROUBLESHOOTING.md)

## 📚 Documentation Index

### Getting Started
- **[Quick Start Guide](CAMERA_FOCAL_POINT_QUICK_START.md)** ⚡
  - Fastest way to get started
  - Essential commands
  - Example output

### Troubleshooting
- **[Troubleshooting Guide](CAMERA_FOCAL_POINT_TROUBLESHOOTING.md)** 🔧
  - Fix "Cannot read properties of undefined" error
  - Diagnostic scripts
  - Universal helper functions
  - Step-by-step solutions

### Complete Documentation
- **[Full Documentation](CAMERA_FOCAL_POINT_LOGGING.md)** 📖
  - Comprehensive guide
  - API reference
  - Technical details
  - Troubleshooting

### Practical Examples
- **[Examples & Use Cases](CAMERA_FOCAL_POINT_EXAMPLES.md)** 💡
  - 13+ practical examples
  - Integration patterns
  - Debugging techniques
  - Data analysis

### Implementation Details
- **[Implementation Summary](CAMERA_FOCAL_POINT_IMPLEMENTATION_SUMMARY.md)** 🔧
  - What was implemented
  - Files modified
  - Technical architecture
  - Testing guide

### Testing
- **[Test Suite](test_camera_logging.js)** 🧪
  - Automated test script
  - Load in browser console
  - Validates all functionality

## 🚀 Common Commands

```javascript
// Get command manager
const cmd = window.ohif.commandsManager;

// Enable real-time logging
cmd.runCommand('enableCameraLogging');

// Disable logging
cmd.runCommand('disableCameraLogging');

// Toggle on/off
cmd.runCommand('toggleCameraLogging');

// Get current focal points (one-time, no continuous logging)
const points = cmd.runCommand('getCameraFocalPoints');
console.log(points);
// Output: { "mpr-axial": [x, y, z], "mpr-sagittal": [x, y, z], "mpr-coronal": [x, y, z] }
```

## 📊 Example Console Output

```
✅ Camera focal point logging enabled for 3 MPR viewport(s)
📌 Monitoring viewports: mpr-axial, mpr-sagittal, mpr-coronal

🎬 Starting camera logging for: mpr-axial
📸 [mpr-axial] Camera Focal Point: {
  x: "128.50",
  y: "128.50",
  z: "75.00",
  raw: [128.5, 128.5, 75],
  timestamp: "2025-11-03T12:34:56.789Z"
}

📸 [mpr-sagittal] Camera Focal Point: {
  x: "128.50",
  y: "128.50",
  z: "75.00",
  raw: [128.5, 128.5, 75],
  timestamp: "2025-11-03T12:34:56.890Z"
}

📸 [mpr-coronal] Camera Focal Point: {
  x: "128.50",
  y: "128.50",
  z: "75.00",
  raw: [128.5, 128.5, 75],
  timestamp: "2025-11-03T12:34:56.991Z"
}
```

## 🎯 Use Cases

1. **Debugging** - Verify camera synchronization across MPR viewports
2. **Development** - Monitor camera behavior during feature development
3. **User Research** - Track how users navigate through 3D volumes
4. **Integration** - Export focal points for external tools/analysis
5. **Education** - Understand camera mechanics in MPR visualization

## 🧪 Testing

### Quick Test

```javascript
// Load test suite (copy/paste from test_camera_logging.js)

// Run all tests
cameraLoggingTests.runAll();
```

Expected output:
```
📊 Test Summary
===============
✅ testEnable
✅ testGetFocalPoints
✅ testToggle
✅ testDisable
✅ testCommandManager

Total: 5/5 tests passed (100%)
🎉 All tests passed!
```

## 🔍 Technical Overview

### What Gets Tracked?
- **Viewports:** `mpr-axial`, `mpr-sagittal`, `mpr-coronal`
- **Data:** Camera focal point `[x, y, z]` in patient coordinates (mm)
- **Triggers:** Pan, zoom, rotate, scroll, viewport restore

### Implementation
- **Event:** Listens to `cornerstonecameramodified` on viewport elements
- **Service:** `viewportStateService` handles state and event management
- **Commands:** Exposed via OHIF's `commandsManager` API
- **Cleanup:** Automatic event listener cleanup when disabled

### Files Modified
- `extensions/cornerstone/src/viewportStateService.ts` - Service implementation
- `extensions/cornerstone/src/commandsModule.ts` - Command integration

## 💡 Advanced Examples

### Export to JSON File

```javascript
// Capture 10 seconds of focal point data and download as JSON
function exportFocalPoints(durationSeconds) {
  const history = [];
  window.ohif.commandsManager.runCommand('enableCameraLogging');

  const interval = setInterval(() => {
    const points = window.ohif.commandsManager.runCommand('getCameraFocalPoints');
    history.push({ timestamp: new Date().toISOString(), points });
  }, 100);

  setTimeout(() => {
    clearInterval(interval);
    window.ohif.commandsManager.runCommand('disableCameraLogging');

    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `focal-points-${Date.now()}.json`;
    a.click();
  }, durationSeconds * 1000);
}

exportFocalPoints(10);
```

### Check Synchronization

```javascript
// Verify all three MPR viewports have the same focal point
function checkSync() {
  const points = window.ohif.commandsManager.runCommand('getCameraFocalPoints');
  const axial = points['mpr-axial'];
  const sagittal = points['mpr-sagittal'];
  const coronal = points['mpr-coronal'];

  const tolerance = 0.01;
  const synced =
    Math.abs(axial[0] - sagittal[0]) < tolerance &&
    Math.abs(axial[1] - sagittal[1]) < tolerance &&
    Math.abs(axial[2] - sagittal[2]) < tolerance;

  console.log(synced ? '✅ Synchronized' : '⚠️ Not synchronized');
  console.log('Axial:', axial);
  console.log('Sagittal:', sagittal);
  console.log('Coronal:', coronal);
}

checkSync();
```

**See [CAMERA_FOCAL_POINT_EXAMPLES.md](CAMERA_FOCAL_POINT_EXAMPLES.md) for 13+ more examples!**

## 🐛 Troubleshooting

### No output when logging is enabled?

1. Verify you're in MPR mode (not stack view)
2. Check viewport IDs contain "mpr-axial", "mpr-sagittal", or "mpr-coronal"
3. Look for errors in console

### "Already enabled" warning?

```javascript
// Disable first, then re-enable
window.ohif.commandsManager.runCommand('disableCameraLogging');
window.ohif.commandsManager.runCommand('enableCameraLogging');
```

### Focal points not updating?

1. Verify camera is actually changing by manually checking:
   ```javascript
   const engine = cornerstone3D.core.getRenderingEngine('OHIFCornerstoneRenderingEngine');
   const vp = engine.getViewport('mpr-axial');
   console.log(vp.getCamera().focalPoint);
   ```

**See [Full Documentation](CAMERA_FOCAL_POINT_LOGGING.md#troubleshooting) for more troubleshooting tips.**

## 📋 API Reference

### Commands

| Command | Description |
|---------|-------------|
| `enableCameraLogging` | Enable real-time logging |
| `disableCameraLogging` | Disable logging |
| `toggleCameraLogging` | Toggle on/off |
| `getCameraFocalPoints` | Get current focal points |

### Service Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `enableCameraLogging()` | `void` | Enable logging |
| `disableCameraLogging()` | `void` | Disable logging |
| `toggleCameraLogging()` | `void` | Toggle logging |
| `isCameraLoggingEnabled()` | `boolean` | Check if enabled |
| `getCurrentFocalPoints()` | `Record<string, number[]>` | Get focal points |

### Direct Service Access

```javascript
const service = window.ohif.servicesManager.services.viewportStateService;
service.enableCameraLogging();
service.disableCameraLogging();
service.toggleCameraLogging();
const enabled = service.isCameraLoggingEnabled();
const points = service.getCurrentFocalPoints();
```

## 🌟 Features

- ✅ Real-time logging for 3 MPR viewports
- ✅ Enable/disable/toggle commands
- ✅ Snapshot of current focal points
- ✅ Automatic event cleanup
- ✅ Formatted console output
- ✅ Integration with OHIF command system
- ✅ Comprehensive documentation
- ✅ Test suite included

## 🔮 Future Enhancements

Potential improvements (not yet implemented):
- Debouncing for high-frequency events
- Export to CSV/JSON file
- UI visualization of trajectory
- Toolbar toggle button
- Custom viewport ID support
- Event filtering (pan only, zoom only, etc.)

## 📖 Further Reading

- [Cornerstone3D Documentation](https://www.cornerstonejs.org/)
- [OHIF Viewer Documentation](https://docs.ohif.org/)

## 📞 Support

For questions or issues:
1. Check the [Full Documentation](CAMERA_FOCAL_POINT_LOGGING.md)
2. Review [Examples](CAMERA_FOCAL_POINT_EXAMPLES.md)
3. Run the [Test Suite](test_camera_logging.js)
4. Check browser console for errors

## 📄 License

Part of OHIF Viewer - see main project license.

---

**Implementation Date:** November 3, 2025
**Status:** ✅ Complete and Ready to Use
**Version:** 1.0.0

---

## 🎉 Get Started Now!

```javascript
// Copy and paste into browser console
window.ohif.commandsManager.runCommand('enableCameraLogging');
```

**Happy focal point logging! 📸**
