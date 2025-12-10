/**
 * Volume Rendering Performance Commands - Browser Console Test Script
 * 
 * Copy and paste this into the browser console to test volume rendering optimizations.
 * 
 * NOTE: Commands require the 'CORNERSTONE' context to be specified as the third parameter.
 * This is because the commands are registered in the cornerstone extension.
 */

// Wait for OHIF to be fully loaded
console.log('🔍 Checking OHIF availability...');

// Function to find commandsManager in various locations
function findCommandsManager() {
  const locations = [
    { path: 'window.commandsManager', obj: window.commandsManager },
    { path: 'window.ohif.commandsManager', obj: window.ohif?.commandsManager },
    { path: 'window.OHIF.commandsManager', obj: window.OHIF?.commandsManager },
  ];
  
  for (const loc of locations) {
    if (loc.obj && typeof loc.obj.runCommand === 'function') {
      console.log(`✅ Found commandsManager at: ${loc.path}`);
      return loc.obj;
    }
  }
  
  console.error('❌ commandsManager not available. Wait a few seconds and try again.');
  return null;
}

const commandsManager = findCommandsManager();

if (typeof window.cornerstoneCommandsModule !== 'undefined') {
  console.log('✅ window.cornerstoneCommandsModule available');
  console.log('📋 Available volume rendering commands:', Object.keys(window.cornerstoneCommandsModule.definitions).filter(k => k.includes('Volume')));
} else {
  console.warn('⚠️ window.cornerstoneCommandsModule not yet exposed');
}

// Helper function to get active viewport ID
function getActiveViewportId() {
  if (window.servicesManager?.services?.viewportGridService) {
    const activeViewportId = window.servicesManager.services.viewportGridService.getActiveViewportId();
    console.log('🎯 Active viewport ID:', activeViewportId);
    return activeViewportId;
  }
  console.error('❌ Could not get active viewport ID. Make sure a viewport is active.');
  return null;
}

// Helper to get commandsManager (finds it dynamically)
function getCommandsManager() {
  if (window.commandsManager) return window.commandsManager;
  if (window.ohif?.commandsManager) return window.ohif.commandsManager;
  if (window.OHIF?.commandsManager) return window.OHIF.commandsManager;
  console.error('❌ commandsManager not found');
  return null;
}

// Helper function to list all available commands
function listCommands() {
  if (window.commandsManager) {
    const contexts = window.commandsManager.contexts;
    console.log('📋 Available contexts:', Object.keys(contexts));
    
    Object.keys(contexts).forEach(contextName => {
      const context = contexts[contextName];
      console.log(`\n📦 Context: ${contextName}`);
      console.log('  Commands:', Object.keys(context.commandsById || {}).join(', '));
    });
  }
}

// Helper function to test volume rendering image sample distance
function testImageSampleDistance(imageSampleDistance = 2.0) {
  const cm = getCommandsManager();
  if (!cm) return false;
  
  const viewportId = getActiveViewportId();
  if (!viewportId) return false;

  console.log(`🔧 Testing setVolumeRenderingImageSampleDistance with value: ${imageSampleDistance}`);
  
  try {
    cm.runCommand('setVolumeRenderingImageSampleDistance', {
      viewportId,
      imageSampleDistance,
    }, 'CORNERSTONE');
    console.log(`✅ Command executed successfully! Image sample distance set to ${imageSampleDistance}`);
    return true;
  } catch (error) {
    console.error('❌ Command failed:', error);
    return false;
  }
}

// Helper function to test volume rendering interaction sample distance
function testInteractionSampleDistance(initialScale = 2.0, interactionFactor = 2.0) {
  const cm = getCommandsManager();
  if (!cm) return false;
  
  const viewportId = getActiveViewportId();
  if (!viewportId) return false;

  console.log(`🔧 Testing setVolumeRenderingInteractionSampleDistance with initialScale: ${initialScale}, interactionFactor: ${interactionFactor}`);
  
  try {
    cm.runCommand('setVolumeRenderingInteractionSampleDistance', {
      viewportId,
      initialScale,
      interactionFactor,
    }, 'CORNERSTONE');
    console.log(`✅ Command executed successfully! Interaction quality set to ${initialScale}x`);
    return true;
  } catch (error) {
    console.error('❌ Command failed:', error);
    return false;
  }
}

// Helper function to test volume rendering quality
function testVolumeQuality(quality = 2) {
  const cm = getCommandsManager();
  if (!cm) return false;
  
  const viewportId = getActiveViewportId();
  if (!viewportId) return false;

  console.log(`🔧 Testing setVolumeRenderingQulaity with quality: ${quality}`);
  
  try {
    cm.runCommand('setVolumeRenderingQulaity', {
      viewportId,
      volumeQuality: quality,
    }, 'CORNERSTONE');
    console.log(`✅ Command executed successfully! Volume quality set to ${quality}`);
    return true;
  } catch (error) {
    console.error('❌ Command failed:', error);
    return false;
  }
}

// Helper function to apply full performance optimization preset
function applyPerformancePreset() {
  console.log('🚀 Applying full performance optimization preset...');
  
  let success = true;
  
  // Set image sample distance (fewer rays per pixel)
  success = testImageSampleDistance(1.5) && success;
  
  // Set interaction quality reduction
  success = testInteractionSampleDistance(2.0, 2.0) && success;
  
  // Set lower volume quality
  success = testVolumeQuality(2) && success;
  
  if (success) {
    console.log('✅ Performance preset applied successfully!');
    return true;
  } else {
    console.error('❌ Some commands failed. Check errors above.');
    return false;
  }
}

// Helper function to apply quality preset (reset to high quality)
function applyQualityPreset() {
  console.log('🎨 Applying quality preset...');
  
  let success = true;
  
  // Reset image sample distance (normal ray density)
  success = testImageSampleDistance(1.0) && success;
  
  // Minimal interaction quality reduction
  success = testInteractionSampleDistance(1.0, 1.0) && success;
  
  // Set higher volume quality
  success = testVolumeQuality(4) && success;
  
  if (success) {
    console.log('✅ Quality preset applied successfully!');
    return true;
  } else {
    console.error('❌ Some commands failed. Check errors above.');
    return false;
  }
}

// Expose helper functions to window
window.volumeRenderingTest = {
  listCommands,
  getActiveViewportId,
  testImageSampleDistance,
  testInteractionSampleDistance,
  testVolumeQuality,
  applyPerformancePreset,
  applyQualityPreset,
};

console.log('\n🎯 Volume Rendering Test Utilities Available:');
console.log('  window.volumeRenderingTest.listCommands() - List all available commands');
console.log('  window.volumeRenderingTest.getActiveViewportId() - Get active viewport ID');
console.log('  window.volumeRenderingTest.testImageSampleDistance(2.0) - Test image sample distance');
console.log('  window.volumeRenderingTest.testInteractionSampleDistance(2.0, 2.0) - Test interaction quality');
console.log('  window.volumeRenderingTest.testVolumeQuality(2) - Test volume quality');
console.log('  window.volumeRenderingTest.applyPerformancePreset() - Apply performance optimization');
console.log('  window.volumeRenderingTest.applyQualityPreset() - Apply quality preset');
console.log('\n💡 Quick start: window.volumeRenderingTest.applyPerformancePreset()');

