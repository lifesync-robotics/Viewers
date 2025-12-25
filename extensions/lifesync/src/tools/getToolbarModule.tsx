import { ScrewEditorActionMenuWrapper } from '../components/ScrewEditorMenu';

// LifeSync toolbar buttons and tools
const getToolbarModule = ({ servicesManager, extensionManager }) => {
  const { viewportGridService, cornerstoneViewportService } = servicesManager?.services || {};

  return [
    // ScrewEditor Menu - shows screw list with edit/delete controls
    {
      name: 'ohif.screwEditorMenu',
      defaultComponent: ScrewEditorActionMenuWrapper,
    },
    {
      name: 'ohif.screwEditorMenuEmbedded',
      defaultComponent: ScrewEditorActionMenuWrapper,
    },
    {
      name: 'evaluate.screwEditorMenuEmbedded',
      evaluate: () => ({ isEmbedded: true }),
    },
    {
      name: 'evaluate.screwEditorMenu',
      evaluate: ({ viewportId }) => {
        // SIMPLIFIED LOGIC:
        // - If viewport is axial AND has screws (count >= 1): enable and show
        // - If viewport is NOT axial: disable and hide
        
        const viewportIdLower = (viewportId || '').toLowerCase();
        const isAxialViewport = viewportIdLower.includes('axial');

        // If not axial viewport, always hide
        if (!isAxialViewport) {
          return {
            disabled: true,
          };
        }

        // Axial viewport - check if there are any screws
        let screwCount = 0;
        try {
          const { modelStateService } = servicesManager?.services || {};
          if (modelStateService) {
            const allModels = modelStateService.getAllModels();
            screwCount = allModels.filter((model: any) => {
              const metadata = model.metadata || {};
              const modelName = (metadata.name || '').toLowerCase();
              // Check if model name contains screw-related keywords
              return (
                modelName.includes('l') || // L1, L2, etc.
                modelName.includes('t') || // T12, etc.
                modelName.includes('s') || // S1, etc.
                modelName.includes('screw') ||
                modelName.includes('pedicle')
              );
            }).length;
          }
        } catch (error) {
          console.warn('[ScrewEditorMenu] Error counting screws:', error);
        }

        // Only log when state changes (not on every evaluation)
        // Uncomment for debugging: console.log(`[ScrewEditorMenu] Viewport: ${viewportId}, Screw count: ${screwCount}`);

        // Axial viewport: enable if screwCount >= 1, disable if no screws
        return {
          disabled: screwCount < 1,
        };
      },
    },
    // LifeSync toolbar buttons will be added here as tools are moved
    // Example structure:
    /*
    {
      name: 'Crosshairs',
      default: {
        id: 'Crosshairs',
        type: 'setToolActive',
        props: {
          commandName: 'setToolActive',
          commandOptions: { toolName: 'Crosshairs' },
        },
      },
    },
    {
      name: 'ScrewPlacement',
      default: {
        id: 'ScrewPlacement',
        type: 'setToolActive',
        props: {
          commandName: 'setToolActive',
          commandOptions: { toolName: 'ScrewPlacement' },
        },
      },
    },
    */
  ];
};

export default getToolbarModule;
