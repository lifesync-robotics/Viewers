import { ViewportGridService } from '@ohif/core';
import i18n from 'i18next';

// Import toolbar buttons from basic mode to inherit
import basicToolbarButtons from '@ohif/mode-basic/src/toolbarButtons';

import { MIN_SEGMENTATION_DRAWING_RADIUS, MAX_SEGMENTATION_DRAWING_RADIUS } from './constants';

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

const setToolActiveToolbar = {
  commandName: 'setToolActiveToolbar',
  commandOptions: {
    toolGroupIds: ['default', 'mpr', 'SRToolGroup', 'volume3d'],
  },
};

const callbacks = (toolName: string) => [
  {
    commandName: 'setViewportForToolConfiguration',
    commandOptions: {
      toolName,
    },
  },
];

// Segmentation-specific toolbar buttons (sections and tools)
const segmentationSpecificButtons: Button[] = [
  // Section containers for segmentation toolboxes
  {
    id: 'BrushTools',
    uiType: 'ohif.toolBoxButtonGroup',
    props: {
      buttonSection: true,
    },
  },
  {
    id: 'LabelMapUtilities',
    uiType: 'ohif.Toolbar',
    props: {
      buttonSection: true,
    },
  },
  {
    id: 'ContourUtilities',
    uiType: 'ohif.Toolbar',
    props: {
      buttonSection: true,
    },
  },
  {
    id: 'LabelMapTools',
    uiType: 'ohif.toolBoxButtonGroup',
    props: {
      buttonSection: true,
    },
  },
  {
    id: 'ContourTools',
    uiType: 'ohif.toolBoxButtonGroup',
    props: {
      buttonSection: true,
    },
  },
  // Segmentation-specific tool buttons
  {
    id: 'PlanarFreehandContourSegmentationTool',
    uiType: 'ohif.toolBoxButton',
    props: {
      icon: 'icon-tool-freehand-roi',
      label: 'Freehand Segmentation',
      tooltip: 'Freehand Segmentation',
      evaluate: [
        {
          name: 'evaluate.cornerstone.segmentation',
          toolNames: ['PlanarFreehandContourSegmentationTool'],
          disabledText: 'Create new segmentation to enable this tool.',
        },
        {
          name: 'evaluate.cornerstone.hasSegmentationOfType',
          segmentationRepresentationType: 'Contour',
        },
      ],
      commands: [
        {
          commandName: 'setToolActiveToolbar',
          commandOptions: {
            bindings: [
              {
                mouseButton: 1, // Left Click
              },
              {
                mouseButton: 1, // Left Click+Shift to create a hole
                modifierKey: 16, // Shift
              },
            ],
          },
        },
        {
          commandName: 'activateSelectedSegmentationOfType',
          commandOptions: {
            segmentationRepresentationType: 'Contour',
          },
        },
      ],
      options: [
        {
          name: 'Interpolate Contours',
          type: 'switch',
          id: 'planarFreehandInterpolateContours',
          value: false,
          commands: {
            commandName: 'setInterpolationToolConfiguration',
          },
        },
      ],
    },
  },
  {
    id: 'LivewireContourSegmentationTool',
    uiType: 'ohif.toolBoxButton',
    props: {
      icon: 'icon-tool-livewire',
      label: 'Livewire Contour',
      tooltip: 'Livewire Contour',
      evaluate: [
        {
          name: 'evaluate.cornerstone.segmentation',
          toolNames: ['LivewireContourSegmentationTool'],
          disabledText: 'Create new segmentation to enable this tool.',
        },
        {
          name: 'evaluate.cornerstone.hasSegmentationOfType',
          segmentationRepresentationType: 'Contour',
        },
      ],
      commands: [
        {
          commandName: 'setToolActiveToolbar',
          commandOptions: {
            bindings: [
              {
                mouseButton: 1, // Left Click
              },
              {
                mouseButton: 1, // Left Click+Shift to create a hole
                modifierKey: 16, // Shift
              },
            ],
          },
        },
        {
          commandName: 'activateSelectedSegmentationOfType',
          commandOptions: {
            segmentationRepresentationType: 'Contour',
          },
        },
      ],
      options: [
        {
          name: 'Interpolate Contours',
          type: 'switch',
          id: 'livewireInterpolateContours',
          value: false,
          commands: {
            commandName: 'setInterpolationToolConfiguration',
          },
        },
      ],
    },
  },
  {
    id: 'SplineContourSegmentationTool',
    uiType: 'ohif.toolBoxButton',
    props: {
      icon: 'icon-tool-spline-roi',
      label: 'Spline Contour Segmentation Tool',
      tooltip: 'Spline Contour Segmentation Tool',
      evaluate: [
        {
          name: 'evaluate.cornerstone.segmentation',
          toolNames: ['CatmullRomSplineROI', 'LinearSplineROI', 'BSplineROI'],
          disabledText: 'Create new segmentation to enable this tool.',
        },
        {
          name: 'evaluate.cornerstone.hasSegmentationOfType',
          segmentationRepresentationType: 'Contour',
        },
      ],
      commands: [
        {
          commandName: 'activateSelectedSegmentationOfType',
          commandOptions: {
            segmentationRepresentationType: 'Contour',
          },
        },
      ],
      options: [
        {
          name: 'Spline Type',
          type: 'select',
          id: 'splineTypeSelect',
          value: 'CatmullRomSplineROI',
          values: [
            {
              id: 'CatmullRomSplineROI',
              value: 'CatmullRomSplineROI',
              label: 'Catmull Rom Spline',
            },
            { id: 'LinearSplineROI', value: 'LinearSplineROI', label: 'Linear Spline' },
            { id: 'BSplineROI', value: 'BSplineROI', label: 'B-Spline' },
          ],
          commands: {
            commandName: 'setToolActiveToolbar',
            commandOptions: {
              bindings: [
                {
                  mouseButton: 1, // Left Click
                },
                {
                  mouseButton: 1, // Left Click+Shift to create a hole
                  modifierKey: 16, // Shift
                },
              ],
            },
          },
        },
        {
          name: 'Simplified Spline',
          type: 'switch',
          id: 'simplifiedSpline',
          value: true,
          commands: {
            commandName: 'setSimplifiedSplineForSplineContourSegmentationTool',
          },
        },
        {
          name: 'Interpolate Contours',
          type: 'switch',
          id: 'splineInterpolateContours',
          value: false,
          commands: {
            commandName: 'setInterpolationToolConfiguration',
            commandOptions: {
              toolNames: ['CatmullRomSplineROI', 'LinearSplineROI', 'BSplineROI'],
            },
          },
        },
      ],
    },
  },
  {
    id: 'SculptorTool',
    uiType: 'ohif.toolBoxButton',
    props: {
      icon: 'icon-tool-sculptor',
      label: 'Sculptor Tool',
      tooltip: 'Sculptor Tool',
      evaluate: [
        {
          name: 'evaluate.cornerstone.segmentation',
          toolNames: ['SculptorTool'],
          disabledText: 'Create new segmentation to enable this tool.',
        },
        {
          name: 'evaluate.cornerstone.hasSegmentationOfType',
          segmentationRepresentationType: 'Contour',
        },
      ],
      commands: [
        'setToolActiveToolbar',
        {
          commandName: 'activateSelectedSegmentationOfType',
          commandOptions: {
            segmentationRepresentationType: 'Contour',
          },
        },
      ],
      options: [
        {
          name: 'Dynamic Cursor Size',
          type: 'switch',
          id: 'dynamicCursorSize',
          value: true,
          commands: {
            commandName: 'setDynamicCursorSizeForSculptorTool',
          },
        },
      ],
    },
  },
  {
    id: 'Brush',
    uiType: 'ohif.toolBoxButton',
    props: {
      icon: 'icon-tool-brush',
      label: i18n.t('Buttons:Brush'),
      evaluate: [
        {
          name: 'evaluate.cornerstone.segmentation',
          toolNames: ['CircularBrush', 'SphereBrush'],
          disabledText: i18n.t('Buttons:Create new segmentation to enable this tool.'),
        },
        {
          name: 'evaluate.cornerstone.segmentation.synchronizeDrawingRadius',
          radiusOptionId: 'brush-radius',
        },
        {
          name: 'evaluate.cornerstone.hasSegmentationOfType',
          segmentationRepresentationType: 'Labelmap',
        },
      ],
      commands: {
        commandName: 'activateSelectedSegmentationOfType',
        commandOptions: {
          segmentationRepresentationType: 'Labelmap',
        },
      },
      options: [
        {
          name: 'Radius (mm)',
          id: 'brush-radius',
          type: 'range',
          explicitRunOnly: true,
          min: MIN_SEGMENTATION_DRAWING_RADIUS,
          max: MAX_SEGMENTATION_DRAWING_RADIUS,
          step: 0.5,
          value: 25,
          commands: [
            {
              commandName: 'setBrushSize',
              commandOptions: { toolNames: ['CircularBrush', 'SphereBrush'] },
            },
          ],
        },
        {
          name: 'Shape',
          type: 'radio',
          id: 'brush-mode',
          value: 'CircularBrush',
          values: [
            { value: 'CircularBrush', label: 'Circle' },
            { value: 'SphereBrush', label: 'Sphere' },
          ],
          commands: ['setToolActiveToolbar'],
        },
      ],
    },
  },
  {
    id: 'InterpolateLabelmap',
    uiType: 'ohif.toolButton',
    props: {
      icon: 'actions-interpolate',
      label: i18n.t('Buttons:Interpolate Labelmap'),
      tooltip: i18n.t(
        'Buttons:Automatically fill in missing slices between drawn segments. Use brush or threshold tools on at least two slices, then click to interpolate across slices. Works in any direction. Volume must be reconstructable.'
      ),
      evaluate: [
        {
          name: 'evaluate.cornerstone.segmentation',
        },
        {
          name: 'evaluate.cornerstone.hasSegmentationOfType',
          segmentationRepresentationType: 'Labelmap',
        },
        {
          name: 'evaluate.displaySetIsReconstructable',
          disabledText: i18n.t('Buttons:The current viewport cannot handle interpolation.'),
        },
      ],
      commands: [
        {
          commandName: 'activateSelectedSegmentationOfType',
          commandOptions: {
            segmentationRepresentationType: 'Labelmap',
          },
        },
        'interpolateLabelmap',
      ],
    },
  },
  {
    id: 'SegmentBidirectional',
    uiType: 'ohif.toolButton',
    props: {
      icon: 'actions-bidirectional',
      label: i18n.t('Buttons:Segment Bidirectional'),
      tooltip: i18n.t(
        'Buttons:Automatically detects the largest length and width across slices for the selected segment and displays a bidirectional measurement.'
      ),
      evaluate: [
        {
          name: 'evaluate.cornerstone.segmentation',
          disabledText: i18n.t('Buttons:Create new segmentation to enable this tool.'),
        },
        {
          name: 'evaluate.cornerstone.hasSegmentationOfType',
          segmentationRepresentationType: 'Labelmap',
        },
      ],
      commands: [
        {
          commandName: 'activateSelectedSegmentationOfType',
          commandOptions: {
            segmentationRepresentationType: 'Labelmap',
          },
        },
        'runSegmentBidirectional',
      ],
    },
  },
  {
    id: 'RegionSegmentPlus',
    uiType: 'ohif.toolBoxButton',
    props: {
      icon: 'icon-tool-click-segment',
      label: i18n.t('Buttons:One Click Segment'),
      tooltip: i18n.t(
        'Buttons:Detects segmentable regions with one click. Hover for visual feedback—click when a plus sign appears to auto-segment the lesion.'
      ),
      evaluate: [
        {
          name: 'evaluate.cornerstone.segmentation',
          toolNames: ['RegionSegmentPlus'],
          disabledText: i18n.t('Buttons:Create new segmentation to enable this tool.'),
        },
        {
          name: 'evaluate.cornerstone.hasSegmentationOfType',
          segmentationRepresentationType: 'Labelmap',
        },
      ],
      commands: [
        'setToolActiveToolbar',
        {
          commandName: 'activateSelectedSegmentationOfType',
          commandOptions: {
            segmentationRepresentationType: 'Labelmap',
          },
        },
      ],
    },
  },
  {
    id: 'LabelmapSlicePropagation',
    uiType: 'ohif.toolBoxButton',
    props: {
      icon: 'icon-labelmap-slice-propagation',
      label: i18n.t('Buttons:Labelmap Assist'),
      tooltip: i18n.t(
        'Buttons:Toggle AI assistance for segmenting nearby slices. After drawing on a slice, scroll to preview predictions. Press Enter to accept or Esc to skip.'
      ),
      evaluate: [
        'evaluate.cornerstoneTool.toggle',
        {
          name: 'evaluate.cornerstone.hasSegmentationOfType',
          segmentationRepresentationType: 'Labelmap',
        },
      ],
      listeners: {
        [ViewportGridService.EVENTS.ACTIVE_VIEWPORT_ID_CHANGED]: callbacks(
          'LabelmapSlicePropagation'
        ),
        [ViewportGridService.EVENTS.VIEWPORTS_READY]: callbacks('LabelmapSlicePropagation'),
      },
      commands: [
        {
          commandName: 'activateSelectedSegmentationOfType',
          commandOptions: {
            segmentationRepresentationType: 'Labelmap',
          },
        },
        'toggleEnabledDisabledToolbar',
      ],
    },
  },
  {
    id: 'MarkerLabelmap',
    uiType: 'ohif.toolBoxButton',
    props: {
      icon: 'icon-marker-labelmap',
      label: i18n.t('Buttons:Marker Guided Labelmap'),
      tooltip: i18n.t(
        'Buttons:Use include/exclude markers to guide AI (SAM) segmentation. Click to place markers, Enter to accept results, Esc to reject, and N to go to the next slice while keeping markers.'
      ),
      evaluate: [
        {
          name: 'evaluate.cornerstone.segmentation',
          toolNames: ['MarkerLabelmap', 'MarkerInclude', 'MarkerExclude'],
        },
        {
          name: 'evaluate.cornerstone.hasSegmentationOfType',
          segmentationRepresentationType: 'Labelmap',
        },
      ],
      commands: [
        'setToolActiveToolbar',
        {
          commandName: 'activateSelectedSegmentationOfType',
          commandOptions: {
            segmentationRepresentationType: 'Labelmap',
          },
        },
      ],
      listeners: {
        [ViewportGridService.EVENTS.ACTIVE_VIEWPORT_ID_CHANGED]: callbacks('MarkerLabelmap'),
        [ViewportGridService.EVENTS.VIEWPORTS_READY]: callbacks('MarkerLabelmap'),
      },
      options: [
        {
          name: 'Marker Mode',
          type: 'radio',
          id: 'marker-mode',
          value: 'markerInclude',
          values: [
            { value: 'markerInclude', label: 'Include' },
            { value: 'markerExclude', label: 'Exclude' },
          ],
          commands: ({ commandsManager, options }) => {
            const markerModeOption = options.find(option => option.id === 'marker-mode');
            if (markerModeOption.value === 'markerInclude') {
              commandsManager.run('setToolActive', {
                toolName: 'MarkerInclude',
              });
            } else {
              commandsManager.run('setToolActive', {
                toolName: 'MarkerExclude',
              });
            }
          },
        },
        {
          name: 'Clear Markers',
          type: 'button',
          id: 'clear-markers',
          commands: 'clearMarkersForMarkerLabelmap',
        },
      ],
    },
  },
  {
    id: 'Eraser',
    uiType: 'ohif.toolBoxButton',
    props: {
      icon: 'icon-tool-eraser',
      label: i18n.t('Buttons:Eraser'),
      evaluate: [
        {
          name: 'evaluate.cornerstone.segmentation',
          toolNames: ['CircularEraser', 'SphereEraser'],
        },
        {
          name: 'evaluate.cornerstone.segmentation.synchronizeDrawingRadius',
          radiusOptionId: 'eraser-radius',
        },
        {
          name: 'evaluate.cornerstone.hasSegmentationOfType',
          segmentationRepresentationType: 'Labelmap',
        },
      ],
      options: [
        {
          name: 'Radius (mm)',
          id: 'eraser-radius',
          type: 'range',
          explicitRunOnly: true,
          min: MIN_SEGMENTATION_DRAWING_RADIUS,
          max: MAX_SEGMENTATION_DRAWING_RADIUS,
          step: 0.5,
          value: 25,
          commands: {
            commandName: 'setBrushSize',
            commandOptions: { toolNames: ['CircularEraser', 'SphereEraser'] },
          },
        },
        {
          name: 'Shape',
          type: 'radio',
          id: 'eraser-mode',
          value: 'CircularEraser',
          values: [
            { value: 'CircularEraser', label: 'Circle' },
            { value: 'SphereEraser', label: 'Sphere' },
          ],
          commands: 'setToolActiveToolbar',
        },
      ],
      commands: {
        commandName: 'activateSelectedSegmentationOfType',
        commandOptions: {
          segmentationRepresentationType: 'Labelmap',
        },
      },
    },
  },
  {
    id: 'Threshold',
    uiType: 'ohif.toolBoxButton',
    props: {
      icon: 'icon-tool-threshold',
      label: 'Threshold Tool',
      evaluate: [
        {
          name: 'evaluate.cornerstone.segmentation',
          toolNames: [
            'ThresholdCircularBrush',
            'ThresholdSphereBrush',
            'ThresholdCircularBrushDynamic',
            'ThresholdSphereBrushDynamic',
          ],
        },
        {
          name: 'evaluate.cornerstone.segmentation.synchronizeDrawingRadius',
          radiusOptionId: 'threshold-radius',
        },
        {
          name: 'evaluate.cornerstone.hasSegmentationOfType',
          segmentationRepresentationType: 'Labelmap',
        },
      ],
      commands: {
        commandName: 'activateSelectedSegmentationOfType',
        commandOptions: {
          segmentationRepresentationType: 'Labelmap',
        },
      },
      options: [
        {
          name: 'Radius (mm)',
          id: 'threshold-radius',
          type: 'range',
          explicitRunOnly: true,
          min: MIN_SEGMENTATION_DRAWING_RADIUS,
          max: MAX_SEGMENTATION_DRAWING_RADIUS,
          step: 0.5,
          value: 25,
          commands: {
            commandName: 'setBrushSize',
            commandOptions: {
              toolNames: [
                'ThresholdCircularBrush',
                'ThresholdSphereBrush',
                'ThresholdCircularBrushDynamic',
                'ThresholdSphereBrushDynamic',
              ],
            },
          },
        },
        {
          name: 'Shape',
          type: 'radio',
          id: 'threshold-shape',
          value: 'ThresholdCircularBrush',
          values: [
            { value: 'ThresholdCircularBrush', label: 'Circle' },
            { value: 'ThresholdSphereBrush', label: 'Sphere' },
          ],
          commands: ({ value, commandsManager, options }) => {
            const optionsDynamic = options.find(option => option.id === 'dynamic-mode');

            if (optionsDynamic.value === 'ThresholdDynamic') {
              commandsManager.run('setToolActive', {
                toolName:
                  value === 'ThresholdCircularBrush'
                    ? 'ThresholdCircularBrushDynamic'
                    : 'ThresholdSphereBrushDynamic',
              });
            } else {
              commandsManager.run('setToolActive', {
                toolName: value,
              });
            }
          },
        },
        {
          name: 'Threshold',
          type: 'radio',
          id: 'dynamic-mode',
          value: 'ThresholdDynamic',
          values: [
            { value: 'ThresholdDynamic', label: 'Dynamic' },
            { value: 'ThresholdRange', label: 'Range' },
          ],
          commands: ({ value, commandsManager, options }) => {
            const thresholdRangeOption = options.find(option => option.id === 'threshold-shape');

            if (value === 'ThresholdDynamic') {
              commandsManager.run('setToolActiveToolbar', {
                toolName:
                  thresholdRangeOption.value === 'ThresholdCircularBrush'
                    ? 'ThresholdCircularBrushDynamic'
                    : 'ThresholdSphereBrushDynamic',
              });
            } else {
              commandsManager.run('setToolActiveToolbar', {
                toolName: thresholdRangeOption.value,
              });

              const thresholdRangeValue = options.find(
                option => option.id === 'threshold-range'
              ).value;

              commandsManager.run('setThresholdRange', {
                toolNames: ['ThresholdCircularBrush', 'ThresholdSphereBrush'],
                value: thresholdRangeValue,
              });
            }
          },
        },
        {
          name: 'ThresholdRange',
          type: 'double-range',
          id: 'threshold-range',
          min: -1000,
          max: 1000,
          step: 1,
          value: [50, 600],
          condition: ({ options }) =>
            options.find(option => option.id === 'dynamic-mode').value === 'ThresholdRange',
          commands: {
            commandName: 'setThresholdRange',
            commandOptions: {
              toolNames: ['ThresholdCircularBrush', 'ThresholdSphereBrush'],
            },
          },
        },
      ],
    },
  },
  {
    id: 'Shapes',
    uiType: 'ohif.toolBoxButton',
    props: {
      icon: 'icon-tool-shape',
      label: i18n.t('Buttons:Shapes'),
      evaluate: [
        {
          name: 'evaluate.cornerstone.segmentation',
          toolNames: ['CircleScissor', 'SphereScissor', 'RectangleScissor'],
          disabledText: i18n.t('Buttons:Create new segmentation to enable shapes tool.'),
        },
        {
          name: 'evaluate.cornerstone.hasSegmentationOfType',
          segmentationRepresentationType: 'Labelmap',
        },
      ],
      commands: {
        commandName: 'activateSelectedSegmentationOfType',
        commandOptions: {
          segmentationRepresentationType: 'Labelmap',
        },
      },
      options: [
        {
          name: 'Shape',
          type: 'radio',
          value: 'CircleScissor',
          id: 'shape-mode',
          values: [
            { value: 'CircleScissor', label: 'Circle' },
            { value: 'SphereScissor', label: 'Sphere' },
            { value: 'RectangleScissor', label: 'Rectangle' },
          ],
          commands: 'setToolActiveToolbar',
        },
      ],
    },
  },
  {
    id: 'SimplifyContours',
    uiType: 'ohif.toolButton',
    props: {
      icon: 'actions-simplify',
      label: 'Simplify Contours',
      tooltip: 'Simplify Contours',
      commands: ['toggleActiveSegmentationUtility'],
      evaluate: [
        {
          name: 'cornerstone.isActiveSegmentationUtility',
        },
      ],
      options: 'cornerstone.SimplifyContourOptions',
    },
  },
  {
    id: 'SmoothContours',
    uiType: 'ohif.toolButton',
    props: {
      icon: 'actions-smooth',
      label: 'Smooth Contours',
      tooltip: 'Smooth Contours',
      commands: ['toggleActiveSegmentationUtility'],
      evaluate: [
        {
          name: 'cornerstone.isActiveSegmentationUtility',
        },
      ],
      options: 'cornerstone.SmoothContoursOptions',
    },
  },
  {
    id: 'LogicalContourOperations',
    uiType: 'ohif.toolButton',
    props: {
      icon: 'actions-combine',
      label: 'Combine Contours',
      tooltip: 'Combine Contours',
      commands: ['toggleActiveSegmentationUtility'],
      evaluate: [
        {
          name: 'cornerstone.isActiveSegmentationUtility',
        },
      ],
      options: 'cornerstone.LogicalContourOperationsOptions',
    },
  },
  {
    id: 'LabelMapEditWithContour',
    uiType: 'ohif.toolBoxButton',
    props: {
      icon: 'tool-labelmap-edit-with-contour',
      label: 'Labelmap Edit with Contour Tool',
      tooltip: 'Labelmap Edit with Contour Tool',
      commands: [
        'setToolActiveToolbar',
        {
          commandName: 'activateSelectedSegmentationOfType',
          commandOptions: { segmentationRepresentationType: 'Labelmap' },
        },
      ],
      evaluate: [
        {
          name: 'evaluate.cornerstone.segmentation',
          toolNames: ['LabelMapEditWithContour'],
          disabledText: 'Create new segmentation to enable this tool.',
        },
        {
          name: 'evaluate.cornerstone.hasSegmentationOfType',
          segmentationRepresentationType: 'Labelmap',
        },
      ],
    },
  },
];

// Combine basic mode toolbar buttons with segmentation-specific buttons
// Basic mode buttons provide the foundation (navigation, measurement tools, etc.)
// Segmentation buttons add specialized segmentation tools on top
const toolbarButtons: Button[] = [
  ...basicToolbarButtons,
  ...segmentationSpecificButtons,
];

export default toolbarButtons;
