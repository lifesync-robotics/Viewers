/** @type {AppTypes.Config} */

// =========================================================================
// 🔵 COMPREHENSIVE ORTHANC CONFIGURATION
// =========================================================================
// This configuration file is optimized for use with:
// - Local Orthanc PACS server
// - Docker + Nginx deployment
// - Performance monitoring extension
// - All OHIF viewer features
// =========================================================================

// console.log('🔵 [CONFIG] Loading docker-nginx-orthanc.js (Comprehensive Version)');

window.config = {
  // =========================================================================
  // BASIC SETTINGS
  // =========================================================================
  name: 'config/docker-nginx-orthanc.js',
  routerBasename: null,
  showStudyList: true,

  // =========================================================================
  // EXTENSIONS
  // =========================================================================
  // ✅ CRITICAL: Must include all required extensions
  extensions: [],

  modes: [],

  // =========================================================================
  // CUSTOMIZATION SERVICE
  // =========================================================================
  customizationService: [], // =========================================================================

  // =========================================================================
  // PERFORMANCE & DISPLAY SETTINGS
  // =========================================================================

  // Web Workers - Windows systems may have issues with >3 workers
  maxNumberOfWebWorkers: 3,

  // Warning and loading indicators
  showWarningMessageForCrossOrigin: true,
  showCPUFallbackMessage: true,
  showLoadingIndicator: true,

  // Study browser and viewport settings
  experimentalStudyBrowserSort: false,
  strictZSpacingForVolumeViewport: true,
  groupEnabledModesFirst: true,
  allowMultiSelectExport: false,

  // =========================================================================
  // REQUEST LIMITS
  // =========================================================================
  maxNumRequests: {
    interaction: 100,
    thumbnail: 75,
    prefetch: 25, // HTTP/2 can handle more
  },

  // =========================================================================
  // STUDY PREFETCHER (PERFORMANCE OPTIMIZATION)
  // =========================================================================
  studyPrefetcher: {
    enabled: true,
    displaySetsCount: 2,
    maxNumPrefetchRequests: 10,
    order: 'closest', // Prefetch closest studies first
  },

  // =========================================================================
  // MULTI-MONITOR LAYOUTS
  // =========================================================================
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

  // =========================================================================
  // DEFAULT DATA SOURCE
  // =========================================================================
  // ✅ Set to 'orthanc' for local Orthanc server
  defaultDataSourceName: 'orthanc',

  // =========================================================================
  // DATA SOURCES
  // =========================================================================
  dataSources: [
    // -------------------------------------------------------------------------
    // PRIMARY DATA SOURCE: Local Orthanc PACS Server
    // -------------------------------------------------------------------------
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'orthanc',
      configuration: {
        friendlyName: 'Local Orthanc DICOMWeb Server',
        name: 'Orthanc',

        // ✅ CRITICAL: Use RELATIVE URLs for webpack proxy to intercept
        // These paths match the proxy configuration in webpack
        wadoUriRoot: '/pacs/wado',
        qidoRoot: '/pacs/dicom-web',
        wadoRoot: '/pacs/dicom-web',

        // Orthanc-specific settings
        qidoSupportsIncludeField: false,  // Orthanc doesn't support includefield=all
        supportsReject: false,             // Orthanc doesn't support reject
        dicomUploadEnabled: true,          // Enable DICOM upload
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,

        // Query capabilities
        supportsFuzzyMatching: false,      // Orthanc doesn't fully support fuzzy matching
        supportsWildcard: false,
        supportsStow: true,                // Orthanc supports STOW for uploads

        // Content type handling
        singlepart: 'video,pdf',           // Required for Orthanc
        omitQuotationForMultipartRequest: true,

        // Bulk data URI settings
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',   // Resolve relative to study level
        },
      },
    },

    // -------------------------------------------------------------------------
    // FALLBACK DATA SOURCES (Optional but recommended)
    // -------------------------------------------------------------------------

    // AWS S3 Static WADO Server (Original default)
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'ohif',
      configuration: {
        friendlyName: 'AWS S3 Static WADO Server (Fallback)',
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
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
          transform: url => url.replace('/pixeldata.mp4', '/rendered'),
        },
        omitQuotationForMultipartRequest: true,
      },
    },

    // Local port 5000 server (DCM4CHEE)
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'local5000',
      configuration: {
        friendlyName: 'Static WADO Local Data (Port 5000)',
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

    // -------------------------------------------------------------------------
    // UTILITY DATA SOURCES
    // -------------------------------------------------------------------------

    // DICOMweb Proxy
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomwebproxy',
      sourceName: 'dicomwebproxy',
      configuration: {
        friendlyName: 'DICOMweb Delegating Proxy',
        name: 'dicomwebproxy',
      },
    },

    // DICOM JSON
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomjson',
      sourceName: 'dicomjson',
      configuration: {
        friendlyName: 'DICOM JSON',
        name: 'json',
      },
    },

    // DICOM Local (File system)
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomlocal',
      sourceName: 'dicomlocal',
      configuration: {
        friendlyName: 'DICOM Local',
      },
    },
  ],

  // =========================================================================
  // ERROR HANDLING
  // =========================================================================
  httpErrorHandler: error => {
    console.warn('🔴 [HTTP ERROR]', {
      status: error.status,
      statusText: error.statusText,
      url: error.config?.url,
      message: error.message,
    });

    // Handle specific error codes
    if (error.status === 429) {
      console.warn('⚠️  Rate limit exceeded. Please slow down requests.');
    } else if (error.status === 404) {
      console.warn('⚠️  Resource not found. Check if the study exists on the server.');
    } else if (error.status === 401 || error.status === 403) {
      console.warn('⚠️  Authentication required. Please log in.');
    } else if (error.status >= 500) {
      console.warn('⚠️  Server error. Please check if Orthanc is running.');
    }

    // Could use services manager here to bring up a dialog/modal if needed
  },

  // =========================================================================
  // OPTIONAL FEATURES (Uncomment to enable)
  // =========================================================================

  // Dynamic Configuration Loading
  // dangerouslyUseDynamicConfig: {
  //   enabled: true,
  //   regex: /.*/, // Be more restrictive in production
  // },

  // Segmentation Settings
  // segmentation: {
  //   segmentLabel: {
  //     enabledByDefault: true,
  //     labelColor: [255, 255, 0, 1],
  //     hoverTimeout: 1,
  //     background: 'rgba(100, 100, 100, 0.5)',
  //   },
  // },

  // White Labeling
  // whiteLabeling: {
  //   createLogoComponentFn: function (React) {
  //     return React.createElement(
  //       'a',
  //       {
  //         target: '_self',
  //         rel: 'noopener noreferrer',
  //         className: 'header-brand',
  //         href: '/',
  //       },
  //       React.createElement('img', {
  //         src: './custom-logo.svg',
  //         className: 'header-logo',
  //       })
  //     );
  //   },
  // },
};

console.log('🔵 [CONFIG] docker-nginx-orthanc.js loaded successfully');
console.log('🔵 [CONFIG] Default data source:', window.config.defaultDataSourceName);
console.log('🔵 [CONFIG] Extensions loaded:', window.config.extensions.length);
console.log('🔵 [CONFIG] Data sources configured:', window.config.dataSources.length);
