/**
 * Volume Rendering Performance Commands - Browser Console Test Script
 * 
 * Copy and paste this into the browser console to test volume rendering optimizations.
 */

// Wait for OHIF to be fully loaded
console.log('🔍 Checking OHIF availability...');

if (typeof window.commandsManager === 'undefined') {
  console.error('❌ window.commandsManager not available. Make sure OHIF is fully loaded.');
} else {
  console.log('✅ window.commandsManager available');
}

if (typeof window.cornerstoneCommandsModule !== 'undefined') {
  console.log('✅ window.cornerstoneCommandsModule available');
  console.log('📋 Available volume rendering commands:', Object.keys(window.cornerstoneCommandsModule.definitions).filter(k => k.includes('Volume')));
}

// Helper function to get active viewport ID
function getActiveViewportId() {
  if (window.servicesManager?.services?.viewportGridService) {
    const activeViewportId = window.servicesManager.services.viewportGridService.getActiveViewportId();
    console.log('🎯 Active viewport ID:', activeViewportId);
    return activeViewportId;
  }
  console.error('❌ Could not get active viewport ID');
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
  const viewportId = getActiveViewportId();
  if (!viewportId) return;

  console.log(`🔧 Testing setVolumeRenderingImageSampleDistance with value: ${imageSampleDistance}`);
  
  try {
    window.commandsManager.runCommand('setVolumeRenderingImageSampleDistance', {
      viewportId,
      imageSampleDistance,
    });
    console.log('✅ Command executed successfully');
  } catch (error) {
    console.error('❌ Command failed:', error);
  }
}

// Helper function to test volume rendering interaction sample distance
function testInteractionSampleDistance(initialScale = 2.0, interactionFactor = 2.0) {
  const viewportId = getActiveViewportId();
  if (!viewportId) return;

  console.log(`🔧 Testing setVolumeRenderingInteractionSampleDistance with initialScale: ${initialScale}, interactionFactor: ${interactionFactor}`);
  
  try {
    window.commandsManager.runCommand('setVolumeRenderingInteractionSampleDistance', {
      viewportId,
      initialScale,
      interactionFactor,
    });
    console.log('✅ Command executed successfully');
  } catch (error) {
    console.error('❌ Command failed:', error);
  }
}

// Helper function to test volume rendering quality
function testVolumeQuality(quality = 2) {
  const viewportId = getActiveViewportId();
  if (!viewportId) return;

  console.log(`🔧 Testing setVolumeRenderingQulaity with quality: ${quality}`);
  
  try {
    window.commandsManager.runCommand('setVolumeRenderingQulaity', {
      viewportId,
      volumeQuality: quality,
    });
    console.log('✅ Command executed successfully');
  } catch (error) {
    console.error('❌ Command failed:', error);
  }
}

// Helper function to apply full performance optimization preset
function applyPerformancePreset() {
  const viewportId = getActiveViewportId();
  if (!viewportId) return;

  console.log('🚀 Applying full performance optimization preset...');
  
  // Set image sample distance (fewer rays per pixel)
  testImageSampleDistance(1.5);
  
  // Set interaction quality reduction
  testInteractionSampleDistance(2.0, 2.0);
  
  // Set lower volume quality
  testVolumeQuality(2);
  
  console.log('✅ Performance preset applied!');
}

// Helper function to apply quality preset (reset to high quality)
function applyQualityPreset() {
  const viewportId = getActiveViewportId();
  if (!viewportId) return;

  console.log('🎨 Applying quality preset...');
  
  // Reset image sample distance (normal ray density)
  testImageSampleDistance(1.0);
  
  // Minimal interaction quality reduction
  testInteractionSampleDistance(1.0, 1.0);
  
  // Set higher volume quality
  testVolumeQuality(4);
  
  console.log('✅ Quality preset applied!');
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

