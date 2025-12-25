import i18n from 'i18next';
import { id } from './id';
import overviewHangingProtocol from './hangingProtocol';
import {
  initToolGroups,
  toolbarButtons,
  cornerstone,
  ohif,
  dicomsr,
  dicomvideo,
  basicLayout,
  basicRoute,
  extensionDependencies as basicDependencies,
  mode as basicMode,
  modeInstance as basicModeInstance,
  onModeEnter as basicOnModeEnter,
  onModeExit as basicOnModeExit,
} from '@ohif/mode-basic';

// Standard OHIF measurement tracking (no LifeSync features)
export const tracked = {
  measurements: '@ohif/extension-measurement-tracking.panelModule.trackedMeasurements',
  thumbnailList: '@ohif/extension-measurement-tracking.panelModule.seriesList',
  viewport: '@ohif/extension-measurement-tracking.viewportModule.cornerstone-tracked',
};

export const extensionDependencies = {
  ...basicDependencies,
  '@ohif/extension-measurement-tracking': '^3.0.0',
};

/**
 * Custom image load strategy for evenly-spaced frame distribution
 * Calculates which frame index to display based on viewport grid position
 */
function customImageLoadStrategy(data, options) {
  const { displaySet, viewportOptions } = data;
  const { customViewportProps } = viewportOptions || {};
  const { gridPosition, totalGridPositions } = customViewportProps || {};

  // If this is a grid viewport with position info, calculate evenly-spaced frame
  if (gridPosition !== undefined && totalGridPositions !== undefined && displaySet?.images) {
    const totalFrames = displaySet.images.length;
    
    if (totalFrames > 1) {
      // Calculate evenly-spaced frame index
      // For 16 viewports: position 0 = frame 0, position 15 = last frame
      const frameIndex = Math.round((gridPosition / (totalGridPositions - 1)) * (totalFrames - 1));
      
      console.log(`📍 [Overview] Viewport ${gridPosition + 1}: Frame ${frameIndex + 1}/${totalFrames}`);
      
      return {
        imageIndex: frameIndex,
        initialImageIndex: frameIndex,
      };
    }
  }

  // Default behavior for single-frame or non-grid viewports
  return null;
}

/**
 * Overview Mode Entry Hook
 * Extends the basic mode's onModeEnter
 */
function overviewOnModeEnter(args) {
  console.log('🚀 [Overview Mode] onModeEnter - Using default single viewport');

  // Call the base mode's onModeEnter to initialize everything (toolbar, tools, etc.)
  if (basicOnModeEnter) {
    try {
      basicOnModeEnter.call(basicModeInstance, args);
      console.log('✅ [Overview Mode] Base mode initialization complete');
    } catch (error) {
      console.error('❌ [Overview Mode] Error in base mode initialization:', error);
    }
  }

  console.log('✅ [Overview Mode] Mode initialization complete');
}

/**
 * Overview Mode Exit Hook
 * Clean up when leaving the mode
 */
function overviewOnModeExit(args) {
  console.log('👋 [Overview Mode] onModeExit - Cleaning up');

  // Call base mode exit to handle all cleanup
  if (basicOnModeExit) {
    basicOnModeExit.call(basicModeInstance, args);
  }

  console.log('✅ [Overview Mode] Cleanup complete');
}

// Overview layout with measurement tracking
// Similar to basicLayout but with measurement tracking panels
export const overviewInstance = {
  ...basicLayout,
  id: ohif.layout,
  props: {
    ...basicLayout.props,
    leftPanels: [tracked.thumbnailList],
    leftPanelResizable: true,
    leftPanelClosed: false, // Explicitly ensure left panel is open
    rightPanels: [tracked.measurements],
    rightPanelResizable: true,
    rightPanelClosed: true,
    viewports: [
      {
        namespace: tracked.viewport,
        displaySetsToDisplay: [ohif.sopClassHandler],
      },
    ],
  },
};

// Use the same pattern as navigation and planning modes
// This automatically uses structuredCloneWithFunctions from basicRoute
export const overviewRoute = {
  ...basicRoute,
  path: 'overview',
  layoutInstance: overviewInstance,
};

export const modeInstance = {
  ...basicModeInstance,
  id,
  routeName: 'overview',
  displayName: 'Start',
  routes: [overviewRoute],
  extensions: extensionDependencies,
  hangingProtocol: ['@ohif/frameView'], // Frame view for active series
  sopClassHandlers: [ohif.sopClassHandler],
  onModeEnter: overviewOnModeEnter,
  onModeExit: overviewOnModeExit,
};

const mode = {
  ...basicMode,
  id,
  modeInstance,
  extensionDependencies,
};

export default mode;
export { initToolGroups, toolbarButtons };
