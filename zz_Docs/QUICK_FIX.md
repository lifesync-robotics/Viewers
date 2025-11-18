# 🚨 Quick Fix for "Cannot read properties of undefined" Error

## Copy-Paste Solution (Works Immediately)

If you're getting the error `Cannot read properties of undefined (reading 'commandsManager')`, just copy and paste this entire block into your browser console:

```javascript
// ============================================
// UNIVERSAL CAMERA LOGGING HELPER
// Copy and paste this entire block
// ============================================

(function() {
  console.log('🔧 Loading Universal Camera Logging Helper...\n');

  // Try to find the commandsManager
  function findCommandsManager() {
    const locations = [
      { path: 'window.ohif.commandsManager', obj: () => window.ohif?.commandsManager },
      { path: 'window.OHIF.commandsManager', obj: () => window.OHIF?.commandsManager },
      { path: 'window.commandsManager', obj: () => window.commandsManager },
    ];

    for (const loc of locations) {
      try {
        const cm = loc.obj();
        if (cm && typeof cm.runCommand === 'function') {
          console.log(`✅ Found commandsManager at: ${loc.path}`);
          return cm;
        }
      } catch (e) {}
    }

    return null;
  }

  // Create universal helper
  window.cameraLogging = {
    enable: function() {
      const cm = findCommandsManager();
      if (!cm) {
        console.error('❌ OHIF not loaded yet. Wait 2-3 seconds and try: cameraLogging.enable()');
        return false;
      }
      try {
        cm.runCommand('enableCameraLogging');
        console.log('✅ Camera logging ENABLED');
        return true;
      } catch (e) {
        console.error('❌ Error:', e.message);
        return false;
      }
    },

    disable: function() {
      const cm = findCommandsManager();
      if (!cm) {
        console.error('❌ OHIF not loaded yet');
        return false;
      }
      try {
        cm.runCommand('disableCameraLogging');
        console.log('✅ Camera logging DISABLED');
        return true;
      } catch (e) {
        console.error('❌ Error:', e.message);
        return false;
      }
    },

    toggle: function() {
      const cm = findCommandsManager();
      if (!cm) {
        console.error('❌ OHIF not loaded yet');
        return false;
      }
      try {
        cm.runCommand('toggleCameraLogging');
        console.log('✅ Camera logging TOGGLED');
        return true;
      } catch (e) {
        console.error('❌ Error:', e.message);
        return false;
      }
    },

    get: function() {
      const cm = findCommandsManager();
      if (!cm) {
        console.error('❌ OHIF not loaded yet');
        return null;
      }
      try {
        const points = cm.runCommand('getCameraFocalPoints');
        console.log('📸 Current Focal Points:', points);
        return points;
      } catch (e) {
        console.error('❌ Error:', e.message);
        return null;
      }
    },

    status: function() {
      const cm = findCommandsManager();
      if (!cm) {
        console.log('❌ OHIF not loaded');
        return;
      }

      try {
        const services = window.ohif?.servicesManager?.services ||
                        window.OHIF?.servicesManager?.services ||
                        window.servicesManager?.services;

        const service = services?.viewportStateService;
        if (service && typeof service.isCameraLoggingEnabled === 'function') {
          const enabled = service.isCameraLoggingEnabled();
          console.log(enabled ? '✅ Camera logging is ENABLED' : '⏸️  Camera logging is DISABLED');
          return enabled;
        }
      } catch (e) {}

      console.log('⚠️  Status unknown');
    },

    help: function() {
      console.log('\n📖 Camera Logging Commands:');
      console.log('  cameraLogging.enable()  - Start logging focal points');
      console.log('  cameraLogging.disable() - Stop logging');
      console.log('  cameraLogging.toggle()  - Toggle on/off');
      console.log('  cameraLogging.get()     - Get current focal points');
      console.log('  cameraLogging.status()  - Check if enabled');
      console.log('  cameraLogging.help()    - Show this help\n');
    }
  };

  // Test if OHIF is loaded
  const cm = findCommandsManager();
  if (cm) {
    console.log('✅ Helper loaded successfully!\n');
    console.log('🎯 Quick start:');
    console.log('   cameraLogging.enable()   - Start logging');
    console.log('   cameraLogging.help()     - Show all commands\n');
  } else {
    console.log('⚠️  Helper loaded, but OHIF not detected yet.');
    console.log('   Wait 2-3 seconds for OHIF to load, then try:');
    console.log('   cameraLogging.enable()\n');
  }
})();
```

## Now Try This:

```javascript
cameraLogging.enable();
```

Then **pan/zoom/scroll** in the MPR viewports and watch the console!

## Available Commands:

```javascript
cameraLogging.enable();    // Start logging
cameraLogging.disable();   // Stop logging
cameraLogging.toggle();    // Toggle on/off
cameraLogging.get();       // Get current focal points
cameraLogging.status();    // Check if enabled
cameraLogging.help();      // Show help
```

---

## Still Not Working?

### Option 1: Wait and Retry
OHIF might still be loading. Wait 3 seconds:

```javascript
setTimeout(() => cameraLogging.enable(), 3000);
```

### Option 2: Check If You're in MPR Mode
- Make sure you're viewing a 3D study
- You should see 3 viewports (axial, sagittal, coronal)
- Not just a single image stack

### Option 3: Verify Page is Loaded
- All images should be loaded
- MPR viewports should be visible
- You should be able to interact with the viewports

### Option 4: Run Diagnostic
```javascript
// Check what's available
console.log('window.ohif:', typeof window.ohif);
console.log('window.OHIF:', typeof window.OHIF);
console.log('Page loaded:', document.readyState);
```

---

## What This Does

The universal helper:
1. ✅ Automatically finds the commandsManager (multiple locations)
2. ✅ Works even if OHIF isn't fully loaded yet
3. ✅ Gives clear error messages
4. ✅ No need to know internal OHIF structure
5. ✅ Simple commands to use

---

For more information, see:
- [Full Troubleshooting Guide](CAMERA_FOCAL_POINT_TROUBLESHOOTING.md)
- [Complete Documentation](README_CAMERA_FOCAL_POINT.md)
