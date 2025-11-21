import aboutModalCustomization from './components/customizations/aboutModalCustomization';

export default function getCustomizationModule() {
  return [
    {
      name: 'lifesyncCustomizations',
      value: {
        // register LifeSync specific overrides (About modal, etc.)
        ...aboutModalCustomization,
      },
    },
  ];
}
