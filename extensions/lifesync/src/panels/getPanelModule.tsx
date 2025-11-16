import React from 'react';

// Import LifeSync components
import ScrewManagementPanel from '../components/ScrewManagement/ScrewManagementPanel';
import NavigationPanel from '../components/Navigation/NavigationPanel';
import RegistrationPanel from '../components/Registration/RegistrationPanel';
import LifeSyncWorklist from '../components/Worklist/LifeSyncWorklist';
import TrackingPanel from '../components/Tracking/TrackingPanel';

const getPanelModule = ({ commandsManager, servicesManager, extensionManager }: withAppTypes) => {
  return [
    // LifeSync panels
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
        <RegistrationPanel
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
      iconLabel: 'Nav',
      label: 'Nav',
      component: TrackingPanel,
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
