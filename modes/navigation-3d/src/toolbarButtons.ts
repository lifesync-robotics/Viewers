/**
 * Navigation Mode Toolbar Buttons
 * Custom toolbar button for toggling orientation markers
 * Pattern copied from planner mode
 */

import { ViewportGridService } from '@ohif/core';

// Define Button type locally to match OHIF's toolbar button structure
type Button = {
  id: string;
  uiType: string;
  props: {
    label?: string;
    icon?: string;
    commands?: any;
    evaluate?: any;
    listeners?: any;
    [key: string]: any;
  };
};

// Callback to update button state when viewports change
const callbacks = (toolName: string) => [
  {
    commandName: 'setViewportForToolConfiguration',
    commandOptions: {
      toolName,
    },
  },
];

const navigationToolbarButtons: Button[] = [
  {
    id: 'NavigationOrientationMarker', // Unique ID to avoid conflict with basic mode
    uiType: 'ohif.toolButton',
    props: {
      icon: 'OrientationSwitch',
      label: 'Orientation Marker',
      tooltip: 'Toggle orientation markers (Axis style)',
      // Use existing OHIF command
      commands: {
        commandName: 'toggleEnabledDisabledToolbar',
        commandOptions: {
          toolName: 'OrientationMarker', // For evaluator (getToolNameForButton)
          itemId: 'OrientationMarker',   // For command (toggleEnabledDisabledToolbar)
        },
      },
      // Listeners to update button state when viewport changes
      listeners: {
        [ViewportGridService.EVENTS.ACTIVE_VIEWPORT_ID_CHANGED]: callbacks('OrientationMarker'),
        [ViewportGridService.EVENTS.VIEWPORTS_READY]: callbacks('OrientationMarker'),
      },
      // Evaluate as a toggle-able cornerstone tool
      evaluate: [
        'evaluate.cornerstoneTool.toggle',
        {
          name: 'evaluate.viewport.supported',
          unsupportedViewportTypes: ['video'],
        },
      ],
    },
  },
];

export default navigationToolbarButtons;

