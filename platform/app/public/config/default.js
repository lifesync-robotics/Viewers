/** @type {AppTypes.Config} */

window.config = {
  name: 'config/default.js',
  routerBasename: '/',
  // whiteLabeling: {},
  extensions: [],
  modes: [],
  // =========================================================================
  // CRITICAL CORRECTION APPLIED HERE
  customizationService: {
    // // Define the 3D Volume Rendering Customization
    // 'cornerstone.3dVolumeRendering': {
    //   volumeRenderingPresets: [
    //     // ... keep existing presets if you want
    //     {
    //       name: 'CT-Low-HU-Visible', // Name displayed in the UI
    //       gradientOpacity: [
    //         { value: 0, opacity: 0 },
    //         { value: 100, opacity: 1 }
    //       ],
    //       scalarOpacity: [
    //         // MAPPING: { value: HU, opacity: 0.0 to 1.0 }
    //         // Start visible range at -1000 HU (Air/Lung)
    //         { value: -1000, opacity: 0 },     // Completely transparent at -1000
    //         { value: -500, opacity: 0.2 },    // 20% opaque at -500 (Lung/Low density)
    //         { value: -100, opacity: 0.3 },    // 30% opaque at -100 (Fat)
    //         { value: 40, opacity: 0.6 },      // 60% opaque at 40 (Soft tissue)
    //         { value: 400, opacity: 1 }        // Fully opaque at 400 (Bone)
    //       ],
    //       colorTransfer: [
    //         // MAPPING: { value: HU, red: 0-1, green: 0-1, blue: 0-1 }
    //         { value: -1000, red: 0, green: 0, blue: 0 },      // Black/Air
    //         { value: -500, red: 0.8, green: 0.5, blue: 0.2 }, // Brownish/Lung
    //         { value: 40, red: 0.8, green: 0.2, blue: 0.2 },   // Red/Organ
    //         { value: 400, red: 1, green: 1, blue: 1 }         // White/Bone
    //       ]
    //     }
    //   ]
    // }
    
  },   // =========================================================================
  // Mode Configuration - Control which modes are visible
  modesConfiguration: {
    '@ohif/mode-overview': {
      hide: { $set: false },  // Show the Start/Overview mode
    },
    '@ohif/mode-longitudinal': {
      hide: { $set: true },  // Hide Basic Viewer
    },
    '@ohif/mode-segmentation': {
      hide: { $set: true },  // Hide Segmentation mode (displays as "Segmentation")
    },
    '@ohif/mode-planner': {
      hide: { $set: true },  // Hide 3D Surgical Planner mode
    },
    '@ohif/mode-planner2d': {
      hide: { $set: true },  // Hide 2D Surgical Planner mode
    },
    '@ohif/mode-navigation': {
      hide: { $set: true },  // Hide Navigation mode
    },
    '@ohif/mode-navigation-3d': {
      hide: { $set: true },  // Hide 3D Navigation mode
    },
    '@ohif/mode-tmtv': {
      hide: { $set: true },  // Hide Total Metabolic Tumor Volume mode
    },
    '@ohif/mode-microscopy': {
      hide: { $set: true },  // Hide Microscopy mode
    },
    '@ohif/mode-preclinical-4d': {
      hide: { $set: true },  // Hide Preclinical 4D / Dynamic Volume mode (route: "dynamic-volume")
    },
    '@ohif/mode-ultrasound-pleura-bline': {
      hide: { $set: true },  // Hide US Pleura B-line Annotations mode
    },
  },
  // =========================================================================
  // LifeSync Surgical Workflow Configuration
  // NOTE: This config is deprecated - workflow is now defined in lifesync/config/workflow-config.yaml
  // workflow: {
  //   enabled: true,
  //   stages: ['overview', 'segmentation', 'planning', 'reporting', 'review'],
  //   stageRoutes: {
  //     overview: '/overview',
  //     segmentation: '/segmentation',
  //     planning: '/planner',
  //     reporting: '/reporting',
  //     review: '/review'
  //   },
  //   validation: {
  //     segmentation: {
  //       minSegmentations: 1
  //     },
  //     planning: {
  //       minScrews: 2
  //     }
  //   },
  //   persistence: {
  //     enabled: true,
  //     storageKey: 'ohif_surgical_workflow_state',
  //     maxAge: 86400000 // 24 hours in milliseconds
  //   }
  // }, // =========================================================================
  showStudyList: true,
  // Disable investigational use dialog banner
  investigationalUseDialog: {
    option: 'never',
  },
  // some windows systems have issues with more than 3 web workers
  maxNumberOfWebWorkers: 3,
  // below flag is for performance reasons, but it might not work for all servers
  showWarningMessageForCrossOrigin: true,
  showCPUFallbackMessage: true,
  showLoadingIndicator: true,
  experimentalStudyBrowserSort: false,
  strictZSpacingForVolumeViewport: false,
  // Volume rendering performance optimizations
  preferSizeOverAccuracy: true,  // Use half-float for VR/MPR to reduce memory usage
  useNorm16Texture: true,        // Use 16-bit normalized textures when supported
  groupEnabledModesFirst: false,  // Set to false to use the order defined in pluginConfig.json
  allowMultiSelectExport: false,
  maxNumRequests: {
    interaction: 100,
    thumbnail: 75,
    // Prefetch number is dependent on the http protocol. For http 2 or
    // above, the number of requests can be go a lot higher.
    prefetch: 25,
  },
  showErrorDetails: 'always', // 'always', 'dev', 'production'
  // filterQueryParam: false,
  // Defines multi-monitor layouts
  multimonitor: [
    {
      id: 'split',
      test: ({ multimonitor }) => multimonitor === 'split',
      screens: [
        {
          id: 'ohif0',
          screen: null,
          location: {
            screen: 0,
            width: 0.5,
            height: 1,
            left: 0,
            top: 0,
          },
          options: 'location=no,menubar=no,scrollbars=no,status=no,titlebar=no',
        },
        {
          id: 'ohif1',
          screen: null,
          location: {
            width: 0.5,
            height: 1,
            left: 0.5,
            top: 0,
          },
          options: 'location=no,menubar=no,scrollbars=no,status=no,titlebar=no',
        },
      ],
    },

    {
      id: '2',
      test: ({ multimonitor }) => multimonitor === '2',
      screens: [
        {
          id: 'ohif0',
          screen: 0,
          location: {
            width: 1,
            height: 1,
            left: 0,
            top: 0,
          },
          options: 'fullscreen=yes,location=no,menubar=no,scrollbars=no,status=no,titlebar=no',
        },
        {
          id: 'ohif1',
          screen: 1,
          location: {
            width: 1,
            height: 1,
            left: 0,
            top: 0,
          },
          options: 'fullscreen=yes,location=no,menubar=no,scrollbars=no,status=no,titlebar=no',
        },
      ],
    },
  ],
  defaultDataSourceName: 'orthanc',
  /* Dynamic config allows user to pass "configUrl" query string this allows to load config without recompiling application. The regex will ensure valid configuration source */
  // dangerouslyUseDynamicConfig: {
  //   enabled: true,
  //   // regex will ensure valid configuration source and default is /.*/ which matches any character. To use this, setup your own regex to choose a specific source of configuration only.
  //   // Example 1, to allow numbers and letters in an absolute or sub-path only.
  //   // regex: /(0-9A-Za-z.]+)(\/[0-9A-Za-z.]+)*/
  //   // Example 2, to restricts to either hosptial.com or othersite.com.
  //   // regex: /(https:\/\/hospital.com(\/[0-9A-Za-z.]+)*)|(https:\/\/othersite.com(\/[0-9A-Za-z.]+)*)/
  //   regex: /.*/,
  // },
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'ohif',
      configuration: {
        friendlyName: 'AWS S3 Static wado server',
        name: 'aws',
        wadoUriRoot: 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
        qidoRoot: 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
        wadoRoot: 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
        qidoSupportsIncludeField: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: true,
        supportsWildcard: false,
        staticWado: true,
        singlepart: 'bulkdata,video',
        // whether the data source should use retrieveBulkData to grab metadata,
        // and in case of relative path, what would it be relative to, options
        // are in the series level or study level (some servers like series some study)
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
          transform: url => url.replace('/pixeldata.mp4', '/rendered'),
        },
        omitQuotationForMultipartRequest: true,
      },
    },

    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'ohif2',
      configuration: {
        friendlyName: 'AWS S3 Static wado secondary server',
        name: 'aws',
        wadoUriRoot: 'https://dd14fa38qiwhyfd.cloudfront.net/dicomweb',
        qidoRoot: 'https://dd14fa38qiwhyfd.cloudfront.net/dicomweb',
        wadoRoot: 'https://dd14fa38qiwhyfd.cloudfront.net/dicomweb',
        qidoSupportsIncludeField: false,
        supportsReject: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        staticWado: true,
        singlepart: 'bulkdata,video',
        // whether the data source should use retrieveBulkData to grab metadata,
        // and in case of relative path, what would it be relative to, options
        // are in the series level or study level (some servers like series some study)
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
        },
        omitQuotationForMultipartRequest: true,
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'ohif3',
      configuration: {
        friendlyName: 'AWS S3 Static wado secondary server',
        name: 'aws',
        wadoUriRoot: 'https://d3t6nz73ql33tx.cloudfront.net/dicomweb',
        qidoRoot: 'https://d3t6nz73ql33tx.cloudfront.net/dicomweb',
        wadoRoot: 'https://d3t6nz73ql33tx.cloudfront.net/dicomweb',
        qidoSupportsIncludeField: false,
        supportsReject: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        staticWado: true,
        singlepart: 'bulkdata,video',
        // whether the data source should use retrieveBulkData to grab metadata,
        // and in case of relative path, what would it be relative to, options
        // are in the series level or study level (some servers like series some study)
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
        },
        omitQuotationForMultipartRequest: true,
      },
    },

    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'local5000',
      configuration: {
        friendlyName: 'Static WADO Local Data',
        name: 'DCM4CHEE',
        qidoRoot: 'http://localhost:5000/dicomweb',
        wadoRoot: 'http://localhost:5000/dicomweb',
        qidoSupportsIncludeField: false,
        supportsReject: true,
        supportsStow: true,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        staticWado: true,
        singlepart: 'video',
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
        },
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'orthanc',
      configuration: {
        friendlyName: 'Local Orthanc DICOMWeb Server',
        name: 'Orthanc',

        // Use RELATIVE URLs for webpack proxy to intercept
        wadoUriRoot: '/dicom-web',
        qidoRoot: '/dicom-web',
        wadoRoot: '/dicom-web',

        // Orthanc authentication
        headers: {
          Authorization: 'Basic ' + btoa('lsr:lsr#!$$!59'),
        },

        // Orthanc does NOT support includefield=all
        qidoSupportsIncludeField: false,

        // Orthanc doesn't support reject
        supportsReject: false,

        dicomUploadEnabled: true,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,

        // Orthanc doesn't fully support fuzzy matching
        supportsFuzzyMatching: false,

        supportsWildcard: false,

        // Required for Orthanc
        singlepart: 'video,pdf',

        omitQuotationForMultipartRequest: true,

        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
        },
      },
    },

    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomwebproxy',
      sourceName: 'dicomwebproxy',
      configuration: {
        friendlyName: 'dicomweb delegating proxy',
        name: 'dicomwebproxy',
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomjson',
      sourceName: 'dicomjson',
      configuration: {
        friendlyName: 'dicom json',
        name: 'json',
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomlocal',
      sourceName: 'dicomlocal',
      configuration: {
        friendlyName: 'dicom local',
      },
    },
  ],
  httpErrorHandler: error => {
    // This is 429 when rejected from the public idc sandbox too often.
    console.warn(error.status);

    // Could use services manager here to bring up a dialog/modal if needed.
    console.warn('test, navigate to https://ohif.org/');
  },
  // segmentation: {
  //   segmentLabel: {
  //     enabledByDefault: true,
  //     labelColor: [255, 255, 0, 1], // must be an array
  //     hoverTimeout: 1,
  //     background: 'rgba(100, 100, 100, 0.5)', // can be any valid css color
  //   },
  // },
  // whiteLabeling: {
  //   createLogoComponentFn: function (React) {
  //     return React.createElement(
  //       'a',
  //       {
  //         target: '_self',
  //         rel: 'noopener noreferrer',
  //         className: 'text-purple-600 line-through',
  //         href: '_X___IDC__LOGO__LINK___Y_',
  //       },
  //       React.createElement('img', {
  //         src: './Logo.svg',
  //         className: 'w-14 h-14',
  //       })
  //     );
  //   },
  // },
  whiteLabeling: {
    createLogoComponentFn: function (React) {
      // Original Node-style require kept for reference (not available in browser):
      // const LifeSyncRobotics =
      //   require('../../../extensions/lifesync/src/components/Icons/LifeSyncRobotics').default;
      const lifeSyncLogoComponent =
        typeof window !== 'undefined' ? window['LifeSyncRobotics'] : undefined;

      if (!lifeSyncLogoComponent) {
        console.warn('LifeSyncRobotics logo component is not available on window.');
        return React.createElement('img', {
          src: './Logo.svg',
          alt: 'LifeSync Robotics',
        });
      }

      return React.createElement(lifeSyncLogoComponent);
    },
  },
};
