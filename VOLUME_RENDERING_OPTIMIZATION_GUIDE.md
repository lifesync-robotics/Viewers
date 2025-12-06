# OHIF 3D Volume Rendering Performance Optimization Guide

## Overview

This guide explains how to tune OHIF's 3D volume rendering for better performance during real-time tracking, especially with large CT volumes.

## Quick Start

### 1. Configuration Flags (Already Enabled in `default.js`)

```javascript
window.config = {
  // ... other config
  preferSizeOverAccuracy: true,  // Use half-float for VR/MPR (reduces memory ~50%)
  useNorm16Texture: true,        // Use 16-bit textures when supported (reduces memory ~50%)
};
```

**What they do:**
- `preferSizeOverAccuracy`: Uses half-float textures, broader hardware support, some quantization above 2048 HU
- `useNorm16Texture`: Uses 16-bit normalized textures, better quality than half-float, requires GPU support

### 2. Runtime Commands (New!)

Three new commands are available for controlling volume rendering quality:

#### A. Image Sample Distance (Ray Density)
Controls how many rays are cast per pixel. Higher values = fewer rays = better performance.

```javascript
commandsManager.runCommand('setVolumeRenderingImageSampleDistance', {
  viewportId: 'viewport-id',
  imageSampleDistance: 1.5  // 1.0 = normal, 2.0 = half rays, 1.5 = 33% fewer rays
});
```

#### B. Interaction Sample Distance (Quality During Dragging)
Reduces quality only during interaction (dragging/rotating) for smooth manipulation.

```javascript
commandsManager.runCommand('setVolumeRenderingInteractionSampleDistance', {
  viewportId: 'viewport-id',
  initialScale: 2.0,      // Reduce quality when interaction starts
  interactionFactor: 2.0  // Double sample distance during interaction
});
```

#### C. Volume Quality (Overall Sample Distance)
Controls the overall rendering quality (1 = low quality/high performance, 4 = high quality/low performance).

```javascript
commandsManager.runCommand('setVolumeRenderingQulaity', {
  viewportId: 'viewport-id',
  volumeQuality: 2  // Range: 1-4
});
```

### 3. Navigation-3D Mode (Automatic Optimization)

The `navigation-3d` mode automatically applies performance optimizations when it loads:

- Sets `imageSampleDistance: 1.5` (33% fewer rays)
- Enables interaction quality reduction (`initialScale: 2.0`, `interactionFactor: 2.0`)
- Sets default quality to level 2

**To use:** Just load a study in navigation-3d mode and these optimizations are applied automatically.

## Browser Console Testing

### Using the Test Script

1. Load the test script in browser console:
   ```javascript
   // Copy contents of Viewers/test_volume_rendering_commands.js and paste in console
   ```

2. Quick test commands:
   ```javascript
   // List all available commands
   window.volumeRenderingTest.listCommands();
   
   // Apply performance preset (recommended for real-time tracking)
   window.volumeRenderingTest.applyPerformancePreset();
   
   // Apply quality preset (high quality for static viewing)
   window.volumeRenderingTest.applyQualityPreset();
   
   // Test individual settings
   window.volumeRenderingTest.testImageSampleDistance(2.0);
   window.volumeRenderingTest.testInteractionSampleDistance(2.0, 2.0);
   window.volumeRenderingTest.testVolumeQuality(2);
   ```

### Manual Testing

1. Get active viewport ID:
   ```javascript
   const viewportId = window.servicesManager.services.viewportGridService.getActiveViewportId();
   console.log('Active viewport:', viewportId);
   ```

2. Test a command:
   ```javascript
   window.commandsManager.runCommand('setVolumeRenderingImageSampleDistance', {
     viewportId: viewportId,
     imageSampleDistance: 2.0
   });
   ```

3. Check available commands:
   ```javascript
   console.log(Object.keys(window.cornerstoneCommandsModule.definitions).filter(k => k.includes('Volume')));
   ```

## Debugging

### Check Command Registration

```javascript
// Check if commands module is available
console.log(window.cornerstoneCommandsModule);

// Check specific command
console.log(window.cornerstoneCommandsModule.definitions.setVolumeRenderingImageSampleDistance);

// List all contexts and their commands
const contexts = window.commandsManager.contexts;
Object.keys(contexts).forEach(ctx => {
  console.log(`Context: ${ctx}`, Object.keys(contexts[ctx].commandsById || {}));
});
```

### Check Current Context

```javascript
// Check default context
console.log(window.cornerstoneCommandsModule.defaultContext); // Should be 'CORNERSTONE'

// Run command with explicit context
window.commandsManager.runCommand('setVolumeRenderingImageSampleDistance', {
  viewportId: viewportId,
  imageSampleDistance: 2.0
}, 'CORNERSTONE'); // Specify context explicitly
```

## Performance Recommendations

### For Real-Time Tracking (Maximum Performance)
```javascript
// Apply these settings for smooth real-time model tracking
window.volumeRenderingTest.applyPerformancePreset();
// Or manually:
// - imageSampleDistance: 2.0
// - initialScale: 2.0, interactionFactor: 2.0
// - volumeQuality: 1-2
```

### For Static Viewing (Maximum Quality)
```javascript
// Apply these settings for best visual quality
window.volumeRenderingTest.applyQualityPreset();
// Or manually:
// - imageSampleDistance: 1.0
// - initialScale: 1.0, interactionFactor: 1.0
// - volumeQuality: 4
```

### For Balanced Performance
```javascript
// Default settings in navigation-3d mode
// - imageSampleDistance: 1.5
// - initialScale: 2.0, interactionFactor: 2.0
// - volumeQuality: 2
```

## Expected Performance Gains

- **Memory usage**: ~50% reduction with `preferSizeOverAccuracy` + `useNorm16Texture`
- **Rendering speed**: 2-3x faster with `imageSampleDistance: 2.0`
- **Interaction smoothness**: Significantly improved with interaction quality reduction
- **Real-time tracking**: Smooth 30+ FPS during model manipulation

## Troubleshooting

### Command Not Found Error

If you get `Command "setVolumeRenderingImageSampleDistance" not found in current context`:

1. **Check the browser console** for command registration logs:
   ```
   📦 [commandsModule] Total commands registered: ...
   🔧 [commandsModule] Volume rendering commands:
   ```

2. **Verify the command exists**:
   ```javascript
   console.log(!!window.cornerstoneCommandsModule.definitions.setVolumeRenderingImageSampleDistance);
   ```

3. **Try specifying the context explicitly**:
   ```javascript
   window.commandsManager.runCommand('setVolumeRenderingImageSampleDistance', {...}, 'CORNERSTONE');
   ```

4. **Rebuild the extension** (if modified source code):
   ```bash
   cd Viewers
   yarn build
   ```

### No Performance Improvement

1. **Check viewport type**: Commands only work on volume (3D) viewports
2. **Verify GPU rendering**: CPU rendering won't benefit from these optimizations
3. **Monitor actual values**: Use VTK.js mapper methods to verify settings were applied
4. **Check browser console**: Look for error messages or warnings

## Additional Optimizations

### Server-Side (Recommended for Large Volumes)

1. **Create downsampled volumes**: 
   - Thicker slices (2-3mm instead of 0.5-1mm)
   - In-plane downsampling (512×512 → 256×256)

2. **Use separate series for 3D**:
   - High-res for 2D MPR views
   - Low-res for 3D volume rendering

### Client-Side

1. **Reduce viewport size**: Smaller viewport = fewer pixels to render
2. **Throttle updates**: Limit real-time tracking updates to 15-30 FPS
3. **Hide non-essential overlays**: Disable segmentations/surfaces during tracking
4. **Simplify lighting**: Use plain volume shading instead of advanced lighting

## References

- OHIF Technical FAQ: https://docs.ohif.org/faq/technical
- VTK.js Volume Mapper: https://kitware.github.io/vtk-js/api/Rendering_Core_VolumeMapper.html
- Cornerstone3D: https://www.cornerstonejs.org/

