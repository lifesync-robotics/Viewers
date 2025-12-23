/**
 * Overview 4x4 Grid Hanging Protocol
 * 
 * This hanging protocol displays 16 evenly-spaced frames from a series
 * in a 4x4 grid layout to provide a comprehensive overview.
 */

const overviewHangingProtocol = {
  id: 'overview4x4',
  name: 'Overview 4x4 Grid',
  locked: true,
  createdDate: '2024-01-01T00:00:00.000Z',
  modifiedDate: '2024-01-01T00:00:00.000Z',
  availableTo: {},
  editableBy: {},
  protocolMatchingRules: [
    {
      id: 'hasImages',
      weight: 1,
      attribute: 'numberOfDisplaySetsWithImages',
      constraint: {
        greaterThan: {
          value: 0,
        },
      },
    },
  ],
  displaySetSelectors: {
    defaultDisplaySet: {
      seriesMatchingRules: [
        {
          attribute: 'numImageFrames',
          constraint: {
            greaterThan: {
              value: 0,
            },
          },
          required: true,
        },
      ],
      studyMatchingRules: [],
    },
  },
  stages: [
    {
      id: 'overview4x4Stage',
      name: 'Overview 4x4',
      viewportStructure: {
        layoutType: 'grid',
        properties: {
          rows: 4,
          columns: 4,
        },
      },
      // Use custom image load strategy for evenly-spaced frame distribution
      imageLoadStrategy: 'overviewEvenlySpaced',
      viewports: Array.from({ length: 16 }, (_, index) => {
        // Create viewport for each of 16 positions        
        // Note: Frame indices will be calculated dynamically based on series length
        // using the custom image load strategy
        
        const viewportConfig = {
          viewportOptions: {
            viewportId: `overview-viewport-${index + 1}`,
            viewportType: 'stack',
            toolGroupId: 'default',
            initialImageOptions: {
              // For now, use preset approach
              // This will be refined with custom load strategy if needed
              preset: index === 0 ? 'first' : index === 15 ? 'last' : 'middle',
            },
            // Store the grid position for custom frame calculation
            customViewportProps: {
              gridPosition: index,
              totalGridPositions: 16,
            },
          },
          displaySets: [
            {
              id: 'defaultDisplaySet',
              matchedDisplaySetsIndex: 0,
            },
          ],
        };
        
        return viewportConfig;
      }),
      createdDate: '2024-01-01T00:00:00.000Z',
    },
  ],
  numberOfPriorsReferenced: 0,
};

export default overviewHangingProtocol;

