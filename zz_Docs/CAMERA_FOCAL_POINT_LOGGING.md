# Real-Time Camera Focal Point Logging for MPR Viewports in OHIF

## Overview

This feature provides real-time logging of camera focal points for OHIF's Multi-Planar Reconstruction (MPR) viewports: **mpr-axial**, **mpr-sagittal**, and **mpr-coronal**. The focal point is logged automatically whenever the camera changes (pan, zoom, rotate, or viewport restoration).

## Technical Implementation

### What is the Camera Focal Point?

In Cornerstone3D, each MPR viewport has a camera with several properties:
- **focalPoint**: `[x, y, z]` - The 3D point in space that the camera is looking at
- **position**: `[x, y, z]` - The camera's position in 3D space
- **viewUp**: `[x, y, z]` - The up direction for the camera
- **parallelScale**: Scale factor for orthographic views

The **focal point** represents the center of attention in the 3D scene and changes as you interact with the MPR planes.

### How It Works

The implementation:
1. Listens to the `cornerstonecameramodified` event on MPR viewport elements
2. Filters events to only track the three MPR viewports
3. Extracts the camera's focal point from `viewport.getCamera().focalPoint`
4. Logs the focal point coordinates in real-time to the console

### Files Modified

1. **`extensions/cornerstone/src/viewportStateService.ts`**
   - Added camera logging state management
   - Added event listeners for camera modifications
   - Created methods to enable/disable/toggle logging

2. **`extensions/cornerstone/src/commandsModule.ts`**
   - Added `viewportStateService` to services
   - Created command actions for camera logging
   - Registered commands in the definitions object

## Usage

### Method 1: Using OHIF Command Manager (Recommended)

Access the command manager through the browser console:

```javascript
// Get the command manager
const commandsManager = window.ohif?.commandsManager;

// Enable camera focal point logging
commandsManager.runCommand('enableCameraLogging');

// Disable camera focal point logging
commandsManager.runCommand('disableCameraLogging');

// Toggle camera focal point logging on/off
commandsManager.runCommand('toggleCameraLogging');

// Get current focal points for all MPR viewports (one-time snapshot)
commandsManager.runCommand('getCameraFocalPoints');
```

### Method 2: Using ViewportStateService Directly

```javascript
// Get the service
const services = window.ohif?.servicesManager?.services;
const viewportStateService = services?.viewportStateService;

// Enable logging
viewportStateService.enableCameraLogging();

// Disable logging
viewportStateService.disableCameraLogging();

// Toggle logging
viewportStateService.toggleCameraLogging();

// Check if logging is enabled
const isEnabled = viewportStateService.isCameraLoggingEnabled();

// Get current focal points (returns object with viewport IDs as keys)
const focalPoints = viewportStateService.getCurrentFocalPoints();
console.log(focalPoints);
// Example output:
// {
//   "mpr-axial": [100.5, 200.3, 150.7],
//   "mpr-sagittal": [100.5, 200.3, 150.7],
//   "mpr-coronal": [100.5, 200.3, 150.7]
// }
```

## Console Output Examples

### When Logging is Enabled

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
```

### During Interaction (Pan/Zoom/Rotate)

```
📸 [mpr-sagittal] Camera Focal Point: {
  x: "130.25",
  y: "128.50",
  z: "75.00",
  raw: [130.25, 128.5, 75],
  timestamp: "2025-11-03T12:34:57.123Z"
}
📸 [mpr-coronal] Camera Focal Point: {
  x: "128.50",
  y: "132.75",
  z: "75.00",
  raw: [128.5, 132.75, 75],
  timestamp: "2025-11-03T12:34:57.456Z"
}
```

### When Logging is Disabled

```
🛑 Stopped camera logging for: mpr-axial
🛑 Stopped camera logging for: mpr-sagittal
🛑 Stopped camera logging for: mpr-coronal
✅ Camera focal point logging disabled
```

## Use Cases

### 1. Debugging Camera Synchronization

Enable logging to verify that all three MPR planes are synchronized correctly:

```javascript
commandsManager.runCommand('enableCameraLogging');
// Interact with one viewport, observe that all three update their focal points
```

### 2. Tracking User Navigation

Monitor how users navigate through the 3D volume:

```javascript
commandsManager.runCommand('enableCameraLogging');
// As user pans/zooms/scrolls, the focal points are logged
```

### 3. Snapshot Current State

Get focal points at a specific moment without continuous logging:

```javascript
const focalPoints = commandsManager.runCommand('getCameraFocalPoints');
// Returns focal points for all MPR viewports immediately
```

### 4. Integration with External Tools

Export focal points for external analysis or visualization:

```javascript
// Enable logging
commandsManager.runCommand('enableCameraLogging');

// Later, collect the logged data from console
// Or programmatically access:
const currentPoints = viewportStateService.getCurrentFocalPoints();

// Send to external API or save to file
fetch('/api/save-focal-points', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(currentPoints)
});
```

## API Reference

### ViewportStateService Methods

#### `enableCameraLogging(): void`
Enables real-time camera focal point logging for all MPR viewports. Logs the initial focal point immediately and then logs whenever the camera changes.

**Returns:** `void`

**Console Output:**
- Initial status message
- List of monitored viewports
- Initial focal points for each viewport

#### `disableCameraLogging(): void`
Disables camera focal point logging and removes all event listeners.

**Returns:** `void`

**Console Output:**
- Stop message for each viewport
- Confirmation message

#### `toggleCameraLogging(): void`
Toggles camera focal point logging on/off based on current state.

**Returns:** `void`

#### `isCameraLoggingEnabled(): boolean`
Checks if camera logging is currently enabled.

**Returns:** `boolean` - `true` if enabled, `false` otherwise

#### `getCurrentFocalPoints(): Record<string, number[]>`
Gets the current focal points for all MPR viewports as a snapshot (does not enable continuous logging).

**Returns:** Object with viewport IDs as keys and `[x, y, z]` arrays as values

**Example:**
```javascript
{
  "mpr-axial": [128.5, 128.5, 75],
  "mpr-sagittal": [128.5, 128.5, 75],
  "mpr-coronal": [128.5, 128.5, 75]
}
```

### Command Manager Commands

All commands can be invoked via:
```javascript
commandsManager.runCommand('commandName');
```

| Command Name | Description |
|-------------|-------------|
| `enableCameraLogging` | Enable real-time camera focal point logging |
| `disableCameraLogging` | Disable camera focal point logging |
| `toggleCameraLogging` | Toggle logging on/off |
| `getCameraFocalPoints` | Get current focal points (one-time snapshot) |

## Technical Details

### Event Handling

The implementation uses two Cornerstone3D events for comprehensive tracking:

1. **`cornerstonecameramodified`** (Primary)
   - **Triggers:** Pan, zoom, rotate, viewport restoration
   - **Logging:** Immediate (no debounce)
   - **Use case:** Direct camera manipulations

2. **`cornerstoneimagerendered`** (Secondary)
   - **Triggers:** Slice scrolling, image updates, MPR plane adjustments
   - **Logging:** Debounced (100ms) to prevent excessive logging
   - **Use case:** Captures focal point changes when scrolling through MPR slices
   - **Why needed:** Slice scrolling may not always trigger camera modified events

- **Event Target:** Individual viewport DOM elements
- **Event Detail:** Contains `element` reference to the viewport

### Viewport Identification

MPR viewports are identified by checking if the viewport ID contains:
- `"mpr-axial"`
- `"mpr-sagittal"`
- `"mpr-coronal"`

This is done using the `isMPRViewport()` method:
```typescript
private isMPRViewport(viewportId: string): boolean {
  return this.MPR_VIEWPORT_IDS.some(id => viewportId.includes(id));
}
```

### Memory Management

Event listeners are properly cleaned up when logging is disabled:
1. Listeners are stored in a `Map<string, any>` during registration
2. When disabled, all listeners are removed using `removeEventListener()`
3. The listener map is cleared to prevent memory leaks

### Coordinate System

The focal point coordinates are in the **patient coordinate system**:
- **X**: Left (-) to Right (+)
- **Y**: Posterior (-) to Anterior (+)
- **Z**: Inferior (-) to Superior (+)

Units are typically in millimeters (mm), depending on the DICOM metadata.

## Troubleshooting

### No Output When Logging is Enabled

**Problem:** Camera logging is enabled but no focal points are logged

**Solutions:**
1. Verify MPR viewports are actually displayed:
   ```javascript
   const engine = cornerstone3D.core.getRenderingEngine('OHIFCornerstoneRenderingEngine');
   const viewports = engine.getViewports();
   console.log('Viewports:', viewports.map(v => v.id));
   ```

2. Check if viewports have the correct IDs containing "mpr-axial", "mpr-sagittal", or "mpr-coronal"

3. Ensure you're in MPR mode (not stack view)

### Logging Already Enabled Warning

**Problem:** Get warning "⚠️ Camera logging is already enabled"

**Solution:** Disable first, then re-enable:
```javascript
commandsManager.runCommand('disableCameraLogging');
commandsManager.runCommand('enableCameraLogging');
```

Or use toggle:
```javascript
commandsManager.runCommand('toggleCameraLogging');
```

### Focal Points Not Updating

**Problem:** Initial focal point is logged but no updates during interaction

**Solutions:**
1. Verify the camera is actually changing by checking manually:
   ```javascript
   const vp = engine.getViewport('mpr-axial');
   console.log(vp.getCamera().focalPoint);
   ```

2. Check browser console for JavaScript errors

3. Ensure event listeners are properly attached

## Performance Considerations

- **Event Frequency:** Camera events fire frequently during pan/zoom operations
- **Console Impact:** Excessive logging can slow down the browser console
- **Production Use:** Consider disabling in production or implementing a debounce mechanism if needed

## Future Enhancements

Potential improvements:
1. Add debouncing to reduce logging frequency during rapid interactions
2. Export focal point history to CSV/JSON file
3. Visualize focal point trajectory in 3D
4. Add UI toggle button in OHIF toolbar
5. Support for custom viewport IDs
6. Filter by specific interaction types (pan only, zoom only, etc.)

## Related Files

- `extensions/cornerstone/src/viewportStateService.ts` - Service implementation
- `extensions/cornerstone/src/commandsModule.ts` - Command definitions
- `extensions/cornerstone/src/init.tsx` - Event setup for crosshairs (reference)

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify OHIF version compatibility
3. Review Cornerstone3D documentation: https://www.cornerstonejs.org/
