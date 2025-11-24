import React from 'react';

// Import LifeSync components
import ScrewManagementPanel from '../components/ScrewManagement/ScrewManagementPanel';
import NavigationPanel from '../components/Navigation/NavigationPanel';
import RegistrationPanelContainer from '../components/Registration/RegistrationPanelContainer';
import LifeSyncWorklist from '../components/Worklist/LifeSyncWorklist';
import TrackingPanel from '../components/Tracking/TrackingPanel';
import SimpleTrackingPanel from '../components/Tracking/SimpleTrackingPanel';

const getPanelModule = ({ commandsManager, servicesManager, extensionManager }: withAppTypes) => {
  return [
    // LifeSync panels (Updated: Added SimpleTrackingPanel)
    {
      name: 'screw-management',
      label: 'Screw Management',
      iconName: 'tool-more-menu',
      component: (props) => (
        <ScrewManagementPanel
          servicesManager={servicesManager}
          commandsManager={commandsManager}
          extensionManager={extensionManager}
          {...props}
        />
      ),
    },
    {
      name: 'navigation-panel',
      label: 'Navigation',
      iconName: 'tab-linear',
      component: (props) => (
        <NavigationPanel
          servicesManager={servicesManager}
          commandsManager={commandsManager}
          extensionManager={extensionManager}
          {...props}
        />
      ),
    },
    {
      name: 'registration-panel',
      label: 'Registration',
      iconName: 'tab-linear',
      component: (props) => (
        <RegistrationPanelContainer
          servicesManager={servicesManager}
          commandsManager={commandsManager}
          extensionManager={extensionManager}
          {...props}
        />
      ),
    },
    {
      name: 'lifesync-worklist',
      iconName: 'tab-patient-list',
      iconLabel: 'LifeSync Worklist',
      label: 'LifeSync Worklist',
      component: (props) => (
        <LifeSyncWorklist
          servicesManager={servicesManager}
          commandsManager={commandsManager}
          extensionManager={extensionManager}
          {...props}
        />
      ),
    },
    {
      name: 'trackingPanel',
      iconName: 'tool-more-menu',
      iconLabel: 'Tracking',
      label: 'Tracking Control',
      component: (props) => (
        <TrackingPanel
          servicesManager={servicesManager}
          commandsManager={commandsManager}
          extensionManager={extensionManager}
          {...props}
        />
      ),
    },
    {
      name: 'simpleTrackingPanel',
      iconName: 'tool-crosshair',
      iconLabel: 'Navigate',
      label: 'Surgical Navigation',
      component: (props) => (
        <SimpleTrackingPanel
          servicesManager={servicesManager}
          commandsManager={commandsManager}
          extensionManager={extensionManager}
          {...props}
        />
      ),
    },
    // Additional LifeSync panels will be added here as components are moved
    // Example structure for future panels:
    /*
    {
      name: 'lifesync-worklist',
      iconName: 'tab-patient-list',
      iconLabel: 'LifeSync Worklist',
      label: 'LifeSync Worklist',
      component: (props) => (
        <LifeSyncWorklist
          servicesManager={servicesManager}
          commandsManager={commandsManager}
          extensionManager={extensionManager}
          {...props}
        />
      ),
    },
    {
      name: 'navigation-panel',
      label: 'Navigation',
      iconName: 'tab-linear',
      component: (props) => (
        <NavigationPanel
          servicesManager={servicesManager}
          commandsManager={commandsManager}
          extensionManager={extensionManager}
          {...props}
        />
      ),
    },
    {
      name: 'registration-panel',
      label: 'Registration',
      iconName: 'tab-linear',
      component: (props) => (
        <RegistrationPanel
          servicesManager={servicesManager}
          commandsManager={commandsManager}
          extensionManager={extensionManager}
          {...props}
        />
      ),
    },
    */
  ];
};

export default getPanelModule;
