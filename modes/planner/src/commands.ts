/**
 * Planner Mode Commands
 * Commands for managing orientation markers with defensive programming
 */

import { 
  initializeOrientationMarkers,
  cleanupOrientationMarkers 
} from './utils/OrientationMarkerRenderer';

/**
 * Toggle orientation markers on/off
 * This command safely adds or removes orientation markers from all viewports
 */
async function toggleOrientationMarkers({ servicesManager, extensionManager, modeInstance }) {
  const { cornerstoneViewportService, toolGroupService } = servicesManager.services;

  try {
    // Get current state
    const isCurrentlyEnabled = modeInstance._orientationMarkersEnabled || false;

    console.log(`🔄 [Planner Mode] Toggling orientation markers: ${isCurrentlyEnabled ? 'OFF' : 'ON'}`);

    if (isCurrentlyEnabled) {
      // DISABLE: Clean up existing orientation markers
      await disableOrientationMarkers(modeInstance, toolGroupService);
    } else {
      // ENABLE: Add and activate orientation markers
      await enableOrientationMarkers(
        modeInstance,
        servicesManager,
        extensionManager,
        toolGroupService
      );
    }

    // Refresh viewports to show changes
    try {
      const renderingEngine = cornerstoneViewportService.getRenderingEngine();
      if (renderingEngine) {
        renderingEngine.render();
      }
    } catch (error) {
      console.warn('⚠️ [Planner Mode] Error refreshing viewports:', error);
    }

  } catch (error) {
    console.error('❌ [Planner Mode] Error toggling orientation markers:', error);
  }
}

/**
 * Enable orientation markers on all viewports
 */
async function enableOrientationMarkers(
  modeInstance,
  servicesManager,
  extensionManager,
  toolGroupService
) {
  const { cornerstoneViewportService } = servicesManager.services;

  try {
    // Get tool names
    const utilityModule = extensionManager.getModuleEntry(
      '@ohif/extension-cornerstone.utilityModule.tools'
    );

    if (!utilityModule?.exports?.toolNames) {
      console.error('❌ [Planner Mode] Tool names not available');
      return;
    }

    const { toolNames } = utilityModule.exports;

    if (!toolNames.OrientationMarker) {
      console.error('❌ [Planner Mode] OrientationMarker tool not found');
      return;
    }

    // Configuration for orientation markers
    const orientationMarkerConfig = {
      orientationWidget: {
        enabled: true,
        viewportCorner: 'bottom-left',
        viewportSize: 0.2,
        minPixelSize: 100,
        maxPixelSize: 150,
      },
      overlayMarkerType: 2, // AXIS style
    };

    // Get rendering engine and viewports
    const renderingEngine = cornerstoneViewportService.getRenderingEngine();
    if (!renderingEngine) {
      console.warn('⚠️ [Planner Mode] Rendering engine not available');
      return;
    }

    const viewports = renderingEngine.getViewports();
    if (!viewports || viewports.length === 0) {
      console.warn('⚠️ [Planner Mode] No viewports available');
      return;
    }

    console.log(`📡 [Planner Mode] Enabling orientation markers for ${viewports.length} viewports...`);

    // Add OrientationMarker tool to tool groups
    const toolGroupIds = ['default', 'mpr', 'SRToolGroup'];
    const addedToToolGroups = [];

    for (const toolGroupId of toolGroupIds) {
      try {
        const toolGroup = toolGroupService.getToolGroup(toolGroupId);
        if (!toolGroup) {
          console.debug(`[Planner Mode] Tool group ${toolGroupId} not found`);
          continue;
        }

        // Check if tool already added
        const existingTool = toolGroup.getToolInstance(toolNames.OrientationMarker);
        if (existingTool) {
          console.debug(`[Planner Mode] OrientationMarker already in ${toolGroupId}`);
          addedToToolGroups.push(toolGroupId);
          continue;
        }

        // Add tool to tool group
        toolGroupService.addToolsToToolGroup(toolGroupId, {
          passive: [{
            toolName: toolNames.OrientationMarker,
            configuration: orientationMarkerConfig,
          }],
        });

        addedToToolGroups.push(toolGroupId);
        console.log(`✅ [Planner Mode] OrientationMarker added to ${toolGroupId}`);
      } catch (error) {
        console.warn(`⚠️ [Planner Mode] Failed to add OrientationMarker to ${toolGroupId}:`, error.message);
      }
    }

    if (addedToToolGroups.length === 0) {
      console.error('❌ [Planner Mode] Failed to add OrientationMarker to any tool group');
      return;
    }

    // Use defensive renderer to initialize
    const viewportIds = viewports.map(v => v.id);
    const renderers = await initializeOrientationMarkers(
      renderingEngine.id,
      viewportIds,
      toolNames.OrientationMarker,
      orientationMarkerConfig
    );

    // Store renderers for cleanup
    modeInstance._orientationMarkerRenderers = renderers;

    // Activate orientation markers on successfully initialized viewports
    const readyViewports = Array.from(renderers.entries())
      .filter(([_, renderer]) => renderer.isReady())
      .map(([viewportId, _]) => viewportId);

    console.log(`✅ [Planner Mode] ${readyViewports.length}/${viewportIds.length} viewports ready`);

    // Activate the tool on tool groups
    for (const toolGroupId of addedToToolGroups) {
      try {
        const toolGroup = toolGroupService.getToolGroup(toolGroupId);
        if (toolGroup) {
          toolGroup.setToolEnabled(toolNames.OrientationMarker);
          console.log(`✅ [Planner Mode] OrientationMarker enabled for ${toolGroupId}`);
        }
      } catch (error) {
        console.warn(`⚠️ [Planner Mode] Error enabling OrientationMarker for ${toolGroupId}:`, error.message);
      }
    }

    // Update state
    modeInstance._orientationMarkersEnabled = true;
    console.log('🎉 [Planner Mode] Orientation markers enabled successfully');

  } catch (error) {
    console.error('❌ [Planner Mode] Error enabling orientation markers:', error);
    throw error;
  }
}

/**
 * Disable orientation markers on all viewports
 */
async function disableOrientationMarkers(modeInstance, toolGroupService) {
  try {
    console.log('🔒 [Planner Mode] Disabling orientation markers...');

    // Clean up renderers
    if (modeInstance._orientationMarkerRenderers) {
      cleanupOrientationMarkers(modeInstance._orientationMarkerRenderers);
      modeInstance._orientationMarkerRenderers = null;
      console.log('✅ [Planner Mode] Orientation marker renderers cleaned up');
    }

    // Disable tool on tool groups
    const toolGroupIds = ['default', 'mpr', 'SRToolGroup'];
    
    for (const toolGroupId of toolGroupIds) {
      try {
        const toolGroup = toolGroupService.getToolGroup(toolGroupId);
        if (toolGroup) {
          // Get tool instance to check if it exists
          const tools = toolGroup.getTools();
          const hasOrientationMarker = Object.values(tools).some(
            (tool: any) => tool?.toolName === 'OrientationMarker'
          );

          if (hasOrientationMarker) {
            toolGroup.setToolDisabled('OrientationMarker');
            console.log(`✅ [Planner Mode] OrientationMarker disabled for ${toolGroupId}`);
          }
        }
      } catch (error) {
        console.warn(`⚠️ [Planner Mode] Error disabling OrientationMarker for ${toolGroupId}:`, error.message);
      }
    }

    // Update state
    modeInstance._orientationMarkersEnabled = false;
    console.log('🎉 [Planner Mode] Orientation markers disabled successfully');

  } catch (error) {
    console.error('❌ [Planner Mode] Error disabling orientation markers:', error);
    throw error;
  }
}

/**
 * Get current state of orientation markers
 */
function getOrientationMarkersState({ modeInstance }) {
  try {
    return modeInstance?._orientationMarkersEnabled || false;
  } catch (error) {
    console.warn('⚠️ [Planner Mode] Error getting orientation markers state:', error);
    return false;
  }
}

// Export individual command functions for registration
export const commands = {
  toggleOrientationMarkers,
  getOrientationMarkersState,
};

export default commands;

