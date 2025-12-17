export default {
  cornerstoneViewportClickCommands: {
    doubleClick: ['handlePrimaryAxialWith3DDoubleClick'],
    button1: ['closeContextMenu'],
    button3: [
      {
        commandName: 'showCornerstoneContextMenu',
        commandOptions: {
          requireNearbyToolData: true,
          menuId: 'measurementsContextMenu',
        },
      },
    ],
  },
};
