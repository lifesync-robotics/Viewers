import { HYDRATE_SEG_SYNC_GROUP, VOI_SYNC_GROUP } from './mpr';
import i18n from 'i18next';

/**
 * Primary Axial with 3D Layout
 *
 * Layout:
 * ┌────────────────────┬─────────┐
 * │                    │   3D    │
 * │                    ├─────────┤
 * │      AXIAL         │ Sagittal│
 * │     (Primary)      ├─────────┤
 * │                    │ Coronal │
 * └────────────────────┴─────────┘
 *
 * - Axial is the large primary view (2/3 width)
 * - 3D, Sagittal, Coronal are small views (1/3 width each)
 * - Double-click on small view to swap with primary
 */
export const primaryAxialWith3D = {
  id: 'primaryAxialWith3D',
  locked: true,
  name: i18n.t('Hps:Axial Primary with 3D'),
  icon: 'layout-advanced-axial-primary',
  isPreset: true,
  createdDate: '2024-12-15T10:00:00.000Z',
  modifiedDate: '2024-12-15T10:00:00.000Z',
  availableTo: {},
  editableBy: {},
  protocolMatchingRules: [],
  imageLoadStrategy: 'interleaveCenter',
  // Initialize plane cutters for 3D model display in 2D viewports
  callbacks: {
    onProtocolEnter: [
      {
        commandName: 'initializePlaneCutters',
        context: 'CORNERSTONE',
      },
    ],
    onProtocolExit: [
      {
        commandName: 'disablePlaneCutters',
        context: 'CORNERSTONE',
      },
    ],
  },
  displaySetSelectors: {
    activeDisplaySet: {
      seriesMatchingRules: [
        {
          weight: 1,
          attribute: 'isReconstructable',
          constraint: {
            equals: {
              value: true,
            },
          },
          required: true,
        },
      ],
    },
  },
  stages: [
    {
      id: 'primaryAxialWith3DStage',
      name: 'primaryAxialWith3D',
      viewportStructure: {
        layoutType: 'grid',
        properties: {
          rows: 3,
          columns: 3,
          layoutOptions: [
            // Large Axial view (left 2/3, full height)
            {
              x: 0,
              y: 0,
              width: 2 / 3,
              height: 1,
            },
            // 3D view (top right)
            {
              x: 2 / 3,
              y: 0,
              width: 1 / 3,
              height: 1 / 3,
            },
            // Sagittal view (middle right)
            {
              x: 2 / 3,
              y: 1 / 3,
              width: 1 / 3,
              height: 1 / 3,
            },
            // Coronal view (bottom right)
            {
              x: 2 / 3,
              y: 2 / 3,
              width: 1 / 3,
              height: 1 / 3,
            },
          ],
        },
      },
      viewports: [
        // Viewport 0: Axial (Primary - Large)
        {
          viewportOptions: {
            viewportId: 'mpr-axial',
            toolGroupId: 'mpr',
            viewportType: 'volume',
            orientation: 'axial',
            initialImageOptions: {
              preset: 'middle',
            },
            syncGroups: [VOI_SYNC_GROUP, HYDRATE_SEG_SYNC_GROUP],
          },
          displaySets: [
            {
              id: 'activeDisplaySet',
            },
          ],
        },
        // Viewport 1: 3D (Small - Top Right)
        {
          viewportOptions: {
            toolGroupId: 'volume3d',
            viewportType: 'volume3d',
            orientation: 'coronal',
            customViewportProps: {
              hideOverlays: true,
            },
            syncGroups: [HYDRATE_SEG_SYNC_GROUP],
          },
          displaySets: [
            {
              id: 'activeDisplaySet',
              options: {
                displayPreset: {
                  CT: 'CT-Bone',
                  MR: 'MR-Default',
                  default: 'CT-Bone',
                },
              },
            },
          ],
        },
        // Viewport 2: Sagittal (Small - Middle Right)
        {
          viewportOptions: {
            viewportId: 'mpr-sagittal',
            toolGroupId: 'mpr',
            viewportType: 'volume',
            orientation: 'sagittal',
            initialImageOptions: {
              preset: 'middle',
            },
            syncGroups: [VOI_SYNC_GROUP, HYDRATE_SEG_SYNC_GROUP],
          },
          displaySets: [
            {
              id: 'activeDisplaySet',
            },
          ],
        },
        // Viewport 3: Coronal (Small - Bottom Right)
        {
          viewportOptions: {
            viewportId: 'mpr-coronal',
            toolGroupId: 'mpr',
            viewportType: 'volume',
            orientation: 'coronal',
            initialImageOptions: {
              preset: 'middle',
            },
            syncGroups: [VOI_SYNC_GROUP, HYDRATE_SEG_SYNC_GROUP],
          },
          displaySets: [
            {
              id: 'activeDisplaySet',
            },
          ],
        },
      ],
    },
  ],
};
