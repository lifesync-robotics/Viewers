import { eventTarget, EVENTS, getEnabledElement } from '@cornerstonejs/core';
import { Enums, ToolGroupManager, annotation } from '@cornerstonejs/tools';
import { CommandsManager, CustomizationService } from '@ohif/core';
import { findNearbyToolData } from './utils/findNearbyToolData';

const cs3DToolsEvents = Enums.Events;

/**
 * Check if the double-click occurred near a Crosshairs tool handle (rotation mark)
 * Crosshairs handles are not detected by standard annotation detection,
 * so we need a special check to prevent toggleOneUp from triggering
 * when double-clicking on crosshairs rotation handles.
 */
function isNearCrosshairsHandle(evt: CustomEvent): boolean {
  try {
    const { element, currentPoints } = evt.detail;
    if (!element || !currentPoints?.canvas) {
      return false;
    }

    const enabledElement = getEnabledElement(element);
    if (!enabledElement) {
      return false;
    }

    const { renderingEngineId, viewportId } = enabledElement;
    const toolGroup = ToolGroupManager.getToolGroupForViewport(viewportId, renderingEngineId);

    if (!toolGroup) {
      return false;
    }

    // Get Crosshairs tool instance
    const crosshairsTool = toolGroup.getToolInstance('Crosshairs');
    if (!crosshairsTool || crosshairsTool.mode !== 'Active') {
      return false;
    }

    // Get crosshairs annotations for this element
    const annotations = annotation.state.getAnnotations('Crosshairs', element);
    if (!annotations || annotations.length === 0) {
      return false;
    }

    const crosshairAnnotation = annotations[0];

    // Check if near rotation points
    const rotationPoints = crosshairAnnotation?.data?.handles?.rotationPoints;
    if (rotationPoints && Array.isArray(rotationPoints)) {
      const canvas = currentPoints.canvas;
      const threshold = 20; // pixels

      // rotationPoints can be nested arrays
      for (const pointGroup of rotationPoints) {
        if (Array.isArray(pointGroup)) {
          for (const point of pointGroup) {
            if (point && typeof point === 'object' && 'x' in point && 'y' in point) {
              const distance = Math.sqrt(
                Math.pow(canvas[0] - point.x, 2) + Math.pow(canvas[1] - point.y, 2)
              );
              if (distance < threshold) {
                console.log('🎯 [initDoubleClick] Double-click near Crosshairs rotation handle - blocking toggleOneUp');
                return true;
              }
            }
          }
        }
      }
    }

    // Also check toolCenter
    const toolCenter = crosshairAnnotation?.data?.handles?.toolCenter;
    if (toolCenter) {
      const canvas = currentPoints.canvas;
      const threshold = 15;

      if (typeof toolCenter === 'object' && 'x' in toolCenter && 'y' in toolCenter) {
        const distance = Math.sqrt(
          Math.pow(canvas[0] - toolCenter.x, 2) + Math.pow(canvas[1] - toolCenter.y, 2)
        );
        if (distance < threshold) {
          console.log('🎯 [initDoubleClick] Double-click near Crosshairs center - blocking toggleOneUp');
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.warn('⚠️ [initDoubleClick] Error checking crosshairs handle proximity:', error);
    return false;
  }
}

/**
 * Generates a double click event name, consisting of:
 *    * alt when the alt key is down
 *    * ctrl when the cctrl key is down
 *    * shift when the shift key is down
 *    * 'doubleClick'
 */
function getDoubleClickEventName(evt: CustomEvent) {
  const nameArr = [];
  if (evt.detail.event.altKey) {
    nameArr.push('alt');
  }
  if (evt.detail.event.ctrlKey) {
    nameArr.push('ctrl');
  }
  if (evt.detail.event.shiftKey) {
    nameArr.push('shift');
  }
  nameArr.push('doubleClick');
  return nameArr.join('');
}

export type initDoubleClickArgs = {
  customizationService: CustomizationService;
  commandsManager: CommandsManager;
};

function initDoubleClick({ customizationService, commandsManager }: initDoubleClickArgs): void {
  const cornerstoneViewportHandleDoubleClick = (evt: CustomEvent) => {
    // Do not allow double click on a tool.
    const nearbyToolData = findNearbyToolData(commandsManager, evt);
    if (nearbyToolData) {
      return;
    }

    // Additional check: Do not allow double click on Crosshairs handles
    // Crosshairs rotation handles are not detected by standard annotation detection,
    // but double-clicking them can cause infinite recursion in resetCrosshairs
    if (isNearCrosshairsHandle(evt)) {
      return;
    }

    const eventName = getDoubleClickEventName(evt);

    // Allows for the customization of the double click on a viewport.
    const customizations = customizationService.getCustomization(
      'cornerstoneViewportClickCommands'
    );

    const toRun = customizations[eventName];

    if (!toRun) {
      return;
    }

    // Pass the event to commands so they can access viewportId
    const options = {
      event: evt,
    };
    commandsManager.run(toRun, options);
  };

  function elementEnabledHandler(evt: CustomEvent) {
    const { element } = evt.detail;

    element.addEventListener(
      cs3DToolsEvents.MOUSE_DOUBLE_CLICK,
      cornerstoneViewportHandleDoubleClick
    );
  }

  function elementDisabledHandler(evt: CustomEvent) {
    const { element } = evt.detail;

    element.removeEventListener(
      cs3DToolsEvents.MOUSE_DOUBLE_CLICK,
      cornerstoneViewportHandleDoubleClick
    );
  }

  eventTarget.addEventListener(EVENTS.ELEMENT_ENABLED, elementEnabledHandler.bind(null));

  eventTarget.addEventListener(EVENTS.ELEMENT_DISABLED, elementDisabledHandler.bind(null));
}

export default initDoubleClick;
