# Camera Focal Point Logging - Quick Start Guide

## 🚀 Quick Start (30 seconds)

### Step 1: Load Helper Function

Open browser console (F12) and paste this helper first:

```javascript
// Universal helper - works even if OHIF isn't fully loaded
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
console.log('✅ Helper loaded! Use: cameraLogging.enable()');
```

### Step 2: Enable Logging

```javascript
cameraLogging.enable();
```

Now interact with any MPR viewport (pan, zoom, scroll) and watch the console!

### Step 3: Disable Logging

```javascript
cameraLogging.disable();
```

---

## ⚠️ Troubleshooting: "Cannot read properties of undefined"

If you get this error, OHIF hasn't finished loading. **Solutions:**

### Option 1: Wait and Retry (Most Common)

```javascript
// Wait 3 seconds, then enable
setTimeout(() => {
  window.ohif.commandsManager.runCommand('enableCameraLogging');
}, 3000);
```

### Option 2: Use Direct Commands (If window.ohif exists)

```javascript
// Check if OHIF is loaded
if (window.ohif && window.ohif.commandsManager) {
  window.ohif.commandsManager.runCommand('enableCameraLogging');
} else {
  console.log('⏳ OHIF not ready yet. Wait a moment and try again.');
}
```

**Full troubleshooting guide:** [CAMERA_FOCAL_POINT_TROUBLESHOOTING.md](./CAMERA_FOCAL_POINT_TROUBLESHOOTING.md)

---

## 📋 All Commands

```javascript
// Start real-time logging
window.ohif.commandsManager.runCommand('enableCameraLogging');

// Stop real-time logging
window.ohif.commandsManager.runCommand('disableCameraLogging');

// Toggle on/off
window.ohif.commandsManager.runCommand('toggleCameraLogging');

// Get focal points once (no continuous logging)
window.ohif.commandsManager.runCommand('getCameraFocalPoints');
```

---

## 📊 Example Output

```
✅ Camera focal point logging enabled for 3 MPR viewport(s)
📌 Monitoring viewports: mpr-axial, mpr-sagittal, mpr-coronal

📸 [mpr-axial] Camera Focal Point: {
  x: "128.50",
  y: "128.50",
  z: "75.00",
  raw: [128.5, 128.5, 75],
  timestamp: "2025-11-03T12:34:56.789Z"
}
```

---

## 🎯 Tracked Viewports

Only these three MPR viewports are monitored:
- ✅ **mpr-axial** (Axial/Transverse view)
- ✅ **mpr-sagittal** (Sagittal view)
- ✅ **mpr-coronal** (Coronal view)

Stack viewports and other viewport types are **not** tracked.

---

## 🔧 Alternative: Direct Service Access

```javascript
// Get the service
const service = window.ohif.servicesManager.services.viewportStateService;

// Use the service
service.enableCameraLogging();
service.disableCameraLogging();
service.toggleCameraLogging();

// Check status
console.log('Logging enabled?', service.isCameraLoggingEnabled());

// Get current focal points
const points = service.getCurrentFocalPoints();
console.log(points);
```

---

## 📖 Full Documentation

For detailed documentation, see: [`CAMERA_FOCAL_POINT_LOGGING.md`](./CAMERA_FOCAL_POINT_LOGGING.md)
