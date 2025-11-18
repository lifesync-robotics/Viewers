# Camera Focal Point Logging - Troubleshooting Guide

## ⚠️ Common Error: "Cannot read properties of undefined (reading 'commandsManager')"

### What This Means

The error occurs when `window.ohif` is `undefined`, meaning:
- OHIF hasn't fully initialized yet
- You're not on an OHIF viewer page
- OHIF is exposed under a different global variable

### Solutions

#### Solution 1: Wait for OHIF to Load (Most Common)

Wait a few seconds after the page loads, then try again:

```javascript
// Wait 3 seconds, then enable logging
setTimeout(() => {
  window.ohif.commandsManager.runCommand('enableCameraLogging');
}, 3000);
```

Or check if OHIF is ready first:

```javascript
// Check and wait for OHIF
function waitForOHIF(callback) {
  if (window.ohif && window.ohif.commandsManager) {
    callback();
  } else {
    console.log('⏳ Waiting for OHIF to load...');
    setTimeout(() => waitForOHIF(callback), 500);
  }
}

// Use it
waitForOHIF(() => {
  console.log('✅ OHIF loaded!');
  window.ohif.commandsManager.runCommand('enableCameraLogging');
});
```

#### Solution 2: Check What's Available

Check what global variables are available:

```javascript
// List all OHIF-related globals
Object.keys(window).filter(key =>
  key.toLowerCase().includes('ohif') ||
  key.toLowerCase().includes('cornerstone')
);
```

Common alternatives:
- `window.OHIF`
- `window.commandsManager`
- `window.servicesManager`

#### Solution 3: Find CommandsManager Manually

```javascript
// Search for commandsManager in window
function findCommandsManager() {
  // Try common locations
  const locations = [
    'window.ohif.commandsManager',
    'window.OHIF.commandsManager',
    'window.commandsManager',
    'window.app.commandsManager',
    'window.viewer.commandsManager'
  ];

  for (const path of locations) {
    try {
      const obj = eval(path);
      if (obj && obj.runCommand) {
        console.log(`✅ Found commandsManager at: ${path}`);
        return obj;
      }
    } catch (e) {
      // Continue searching
    }
  }

  console.log('❌ Could not find commandsManager');
  return null;
}

const commandsManager = findCommandsManager();
if (commandsManager) {
  commandsManager.runCommand('enableCameraLogging');
}
```

#### Solution 4: Access via React DevTools

If you have React DevTools installed:

1. Open React DevTools (alongside regular DevTools)
2. Find a component in the tree
3. Right-click → "Store as global variable" (creates `$r`)
4. Access services through props:

```javascript
// After storing a component as $r
const commandsManager = $r.props?.commandsManager;
const servicesManager = $r.props?.servicesManager;

if (commandsManager) {
  commandsManager.runCommand('enableCameraLogging');
}
```

#### Solution 5: Wait for DOM Ready

Make sure the page is fully loaded:

```javascript
// Wait for DOM and OHIF to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      window.ohif.commandsManager.runCommand('enableCameraLogging');
    }, 2000);
  });
} else {
  // Already loaded
  setTimeout(() => {
    window.ohif.commandsManager.runCommand('enableCameraLogging');
  }, 2000);
}
```

## 🔍 Diagnostic Script

Copy and paste this to diagnose the issue:

```javascript
console.log('🔍 OHIF Diagnostic Check');
console.log('========================\n');

// Check if window.ohif exists
console.log('1. window.ohif exists?', typeof window.ohif !== 'undefined' ? '✅' : '❌');

if (typeof window.ohif !== 'undefined') {
  console.log('   - window.ohif:', window.ohif);
  console.log('   - window.ohif.commandsManager:', window.ohif.commandsManager);
  console.log('   - window.ohif.servicesManager:', window.ohif.servicesManager);
}

// Check alternative locations
console.log('\n2. Alternative locations:');
console.log('   - window.OHIF:', typeof window.OHIF !== 'undefined' ? '✅' : '❌');
console.log('   - window.commandsManager:', typeof window.commandsManager !== 'undefined' ? '✅' : '❌');
console.log('   - window.servicesManager:', typeof window.servicesManager !== 'undefined' ? '✅' : '❌');

// Check for Cornerstone
console.log('\n3. Cornerstone3D loaded?');
console.log('   - window.cornerstone3D:', typeof window.cornerstone3D !== 'undefined' ? '✅' : '❌');
console.log('   - window.cornerstoneTools:', typeof window.cornerstoneTools !== 'undefined' ? '✅' : '❌');

// Check page state
console.log('\n4. Page state:');
console.log('   - document.readyState:', document.readyState);
console.log('   - Page URL:', window.location.href);

// List OHIF-related globals
console.log('\n5. OHIF-related global variables:');
const ohifGlobals = Object.keys(window).filter(key =>
  key.toLowerCase().includes('ohif') ||
  key.toLowerCase().includes('cornerstone') ||
  key === 'commandsManager' ||
  key === 'servicesManager'
);
console.log('   Found:', ohifGlobals.length > 0 ? ohifGlobals : 'None');
ohifGlobals.forEach(key => console.log(`   - window.${key}`));

console.log('\n6. Recommended action:');
if (typeof window.ohif !== 'undefined' && window.ohif.commandsManager) {
  console.log('   ✅ OHIF is ready! You can use:');
  console.log('      window.ohif.commandsManager.runCommand("enableCameraLogging");');
} else if (document.readyState === 'loading') {
  console.log('   ⏳ Page still loading. Wait a moment and try again.');
} else {
  console.log('   ⚠️ OHIF not detected. Possible reasons:');
  console.log('      - Not on an OHIF viewer page');
  console.log('      - OHIF still initializing (wait 3-5 seconds)');
  console.log('      - Different OHIF version with different globals');
  console.log('\n   Try running this script again in 3 seconds.');
}
```

## 🚀 Universal Helper Function

This function will automatically find and use the commandsManager:

```javascript
/**
 * Universal camera logging helper
 * Works regardless of how OHIF exposes its APIs
 */
window.cameraLogging = (function() {
  let commandsManager = null;
  let servicesManager = null;

  function init() {
    // Try to find commandsManager
    const locations = [
      () => window.ohif?.commandsManager,
      () => window.OHIF?.commandsManager,
      () => window.commandsManager,
      () => window.app?.commandsManager,
    ];

    for (const getter of locations) {
      try {
        const cm = getter();
        if (cm && cm.runCommand) {
          commandsManager = cm;
          break;
        }
      } catch (e) {}
    }

    // Try to find servicesManager
    const serviceLocations = [
      () => window.ohif?.servicesManager,
      () => window.OHIF?.servicesManager,
      () => window.servicesManager,
      () => window.app?.servicesManager,
    ];

    for (const getter of serviceLocations) {
      try {
        const sm = getter();
        if (sm && sm.services) {
          servicesManager = sm;
          break;
        }
      } catch (e) {}
    }

    return commandsManager !== null;
  }

  return {
    enable: function() {
      if (!init()) {
        console.error('❌ Could not find OHIF commandsManager. Is OHIF loaded?');
        return false;
      }
      commandsManager.runCommand('enableCameraLogging');
      return true;
    },

    disable: function() {
      if (!init()) {
        console.error('❌ Could not find OHIF commandsManager');
        return false;
      }
      commandsManager.runCommand('disableCameraLogging');
      return true;
    },

    toggle: function() {
      if (!init()) {
        console.error('❌ Could not find OHIF commandsManager');
        return false;
      }
      commandsManager.runCommand('toggleCameraLogging');
      return true;
    },

    getFocalPoints: function() {
      if (!init()) {
        console.error('❌ Could not find OHIF commandsManager');
        return null;
      }
      return commandsManager.runCommand('getCameraFocalPoints');
    },

    status: function() {
      if (!init()) {
        console.log('❌ OHIF not loaded');
        return false;
      }

      const service = servicesManager?.services?.viewportStateService;
      if (service) {
        const enabled = service.isCameraLoggingEnabled();
        console.log(enabled ? '✅ Camera logging is ENABLED' : '⏸️ Camera logging is DISABLED');
        return enabled;
      }

      console.log('⚠️ Could not determine status');
      return null;
    }
  };
})();

// Usage:
console.log('✅ Universal camera logging helper loaded!');
console.log('\nAvailable commands:');
console.log('  cameraLogging.enable()       - Enable logging');
console.log('  cameraLogging.disable()      - Disable logging');
console.log('  cameraLogging.toggle()       - Toggle on/off');
console.log('  cameraLogging.getFocalPoints() - Get current focal points');
console.log('  cameraLogging.status()       - Check if enabled');
console.log('\nTry: cameraLogging.enable()');
```

## 📋 Step-by-Step Troubleshooting

### Step 1: Verify You're on OHIF Viewer

Make sure you're on an OHIF viewer page, not just the landing page.
- URL should contain `/viewer/` or similar
- You should see medical images displayed

### Step 2: Verify MPR Mode is Active

Camera focal point logging only works in MPR mode:
- You should see 3 viewports showing axial, sagittal, and coronal views
- Not just a single stack view

### Step 3: Wait for Full Load

OHIF takes time to initialize:
1. Wait for images to fully load
2. Wait for MPR viewports to render
3. Then try the commands

### Step 4: Use the Diagnostic Script

Run the diagnostic script above to see what's available.

### Step 5: Use the Universal Helper

If nothing else works, use the universal helper function that automatically finds the APIs.

## 💡 Quick Fix for Most Cases

**Just add a delay:**

```javascript
// Wait 3 seconds after opening console, then enable
setTimeout(() => {
  try {
    window.ohif.commandsManager.runCommand('enableCameraLogging');
    console.log('✅ Camera logging enabled!');
  } catch (e) {
    console.error('❌ Still not loaded. Try again in a few seconds.');
  }
}, 3000);
```

## 🔧 Alternative: Direct Service Access

If you can't find the commandsManager but know the service is registered:

```javascript
// Try to access the service directly via viewport elements
const viewportElements = document.querySelectorAll('[data-viewport-uid]');
console.log(`Found ${viewportElements.length} viewport elements`);

// This means the service was registered, we just need to find it
// The universal helper above should work in this case
```

## ✅ Verification

Once you get it working, verify with:

```javascript
// Check status
const service = window.ohif.servicesManager.services.viewportStateService;
console.log('Logging enabled?', service.isCameraLoggingEnabled());

// Get current focal points
const points = service.getCurrentFocalPoints();
console.log('Current focal points:', points);
```

---

## 📞 Still Having Issues?

If none of these solutions work:

1. Check the OHIF version you're using
2. Check browser console for other errors
3. Verify you're in MPR mode (not stack view)
4. Make sure the extensions/cornerstone code was properly built
5. Try refreshing the page and waiting longer

The most common solution is simply **waiting 2-3 seconds** after the page loads before running the commands.
