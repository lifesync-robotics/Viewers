import React from 'react';
import id from './id';
import DicomServerUpload from './DicomServerUpload';

/**
 * OHIF Extension for DICOM Server Upload
 * 
 * This extension provides a panel for uploading DICOM series to a server
 * with multi-stage progress tracking (upload, processing, download).
 * 
 * Uses react-uploady for file upload functionality.
 */

const extension = {
  /**
   * Extension ID
   */
  id,

  /**
   * Pre-registration hook
   * Called before the extension is registered
   */
  preRegistration: ({ servicesManager, commandsManager, configuration = {} }) => {
    console.log('🔧 [DicomServerUpload] Extension pre-registration');
  },

  /**
   * Get Panel Module
   * Registers the upload panel component
   */
  getPanelModule: ({ servicesManager, commandsManager, extensionManager }) => {
    return [
      {
        name: 'dicomServerUpload',
        iconName: 'tab-patient-info',
        iconLabel: 'Upload',
        label: 'DICOM Upload',
        component: (props) => (
          <DicomServerUpload
            servicesManager={servicesManager}
            commandsManager={commandsManager}
            {...props}
          />
        ),
      },
    ];
  },

  /**
   * Get Commands Module (optional)
   * Can be used to programmatically trigger uploads
   */
  getCommandsModule: ({ servicesManager, commandsManager }) => {
    return {
      actions: {
        /**
         * Open the DICOM upload panel
         */
        openDicomUploadPanel: () => {
          const { panelService } = servicesManager.services;
          
          if (panelService) {
            panelService.activate({
              id: 'dicomServerUpload',
              label: 'DICOM Upload',
            });
          }
        },
      },
      definitions: {
        openDicomUploadPanel: {
          commandFn: ({ servicesManager }) => {
            const { panelService } = servicesManager.services;
            
            if (panelService) {
              panelService.activate({
                id: 'dicomServerUpload',
                label: 'DICOM Upload',
              });
            }
          },
          storeContexts: [],
          options: {},
        },
      },
    };
  },
};

export default extension;

