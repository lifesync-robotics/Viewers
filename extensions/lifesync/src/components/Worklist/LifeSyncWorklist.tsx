import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useImageViewer } from '@ohif/ui-next';
import { useSystem, utils } from '@ohif/core';
import { useNavigate } from 'react-router-dom';
import { useViewportGrid, StudyBrowser, Separator } from '@ohif/ui-next';
import { PanelStudyBrowserHeader } from '@ohif/extension-default';
import MoreDropdownMenu from '@ohif/extension-default/src/Components/MoreDropdownMenu';
import { CaseService } from '@ohif/extension-default';

const { sortStudyInstances, formatDate, createStudyBrowserTabs } = utils;

const thumbnailNoImageModalities = ['SR', 'SEG', 'RTSTRUCT', 'RTPLAN', 'RTDOSE', 'DOC', 'PMAP'];

/**
 * LifeSync Worklist Component
 *
 * Enhanced worklist that extends OHIF's StudyBrowser with case management features:
 * - Case-based study grouping
 * - Clinical phase management
 * - Case enrollment workflow
 * - Integration with CaseService
 */
function LifeSyncWorklist({
  getImageSrc,
  getStudiesForPatientByMRN,
  requestDisplaySetCreationForStudy,
  dataSource,
  customMapDisplaySets,
  onClickUntrack,
  onDoubleClickThumbnailHandlerCallBack,
}) {
  const { servicesManager, commandsManager, extensionManager } = useSystem();
  const { displaySetService, customizationService, caseService } = servicesManager.services;
  const navigate = useNavigate();
  const studyMode = customizationService.getCustomization('studyBrowser.studyMode') || 'all';

  const internalImageViewer = useImageViewer();
  const StudyInstanceUIDs = internalImageViewer.StudyInstanceUIDs;
  const fetchedStudiesRef = useRef(new Set());

  const [{ activeViewportId, viewports, isHangingProtocolLayout }] = useViewportGrid();
  const [activeTabName, setActiveTabName] = useState(studyMode);
  const [expandedStudyInstanceUIDs, setExpandedStudyInstanceUIDs] = useState(
    studyMode === 'primary' && StudyInstanceUIDs.length > 0
      ? [StudyInstanceUIDs[0]]
      : [...StudyInstanceUIDs]
  );
  const [hasLoadedViewports, setHasLoadedViewports] = useState(false);
  const [studyDisplayList, setStudyDisplayList] = useState([]);
  const [displaySets, setDisplaySets] = useState([]);
  const [displaySetsLoadingState, setDisplaySetsLoadingState] = useState({});
  const [thumbnailImageSrcMap, setThumbnailImageSrcMap] = useState({});
  const [jumpToDisplaySet, setJumpToDisplaySet] = useState(null);

  // LifeSync-specific state
  const [caseList, setCaseList] = useState([]);
  const [activeCaseId, setActiveCaseId] = useState(null);
  const [caseStudies, setCaseStudies] = useState({});
  const [loadingCases, setLoadingCases] = useState(false);

  const [viewPresets, setViewPresets] = useState(
    customizationService.getCustomization('studyBrowser.viewPresets')
  );

  const [actionIcons, setActionIcons] = useState([]);

  // multiple can be true or false
  const updateActionIconValue = actionIcon => {
    actionIcon.value = !actionIcon.value;
    const newActionIcons = [...actionIcons];
    setActionIcons(newActionIcons);
  };

  // only one is true at a time
  const updateViewPresetValue = viewPreset => {
    if (!viewPreset) {
      return;
    }
    const newViewPresets = viewPresets.map(preset => {
      preset.selected = preset.id === viewPreset.id;
      return preset;
    });
    setViewPresets(newViewPresets);
  };

  const mapDisplaySetsWithState = customMapDisplaySets || _mapDisplaySets;

  // Load cases on component mount
  useEffect(() => {
    loadCases();
  }, []);

  // Subscribe to case service events
  useEffect(() => {
    if (!caseService) return;

    const subscriptions = [
      caseService.subscribe('event::case_created', () => loadCases()),
      caseService.subscribe('event::case_updated', () => loadCases()),
      caseService.subscribe('event::case_deleted', () => loadCases()),
      caseService.subscribe('event::study_enrolled', () => loadCases()),
      caseService.subscribe('event::study_removed', () => loadCases()),
      caseService.subscribe('event::active_case_changed', (data) => {
        setActiveCaseId(data.caseId);
        if (data.caseId) {
          loadCaseStudies(data.caseId);
        }
      }),
    ];

    return () => {
      subscriptions.forEach(sub => sub.unsubscribe());
    };
  }, [caseService]);

  const loadCases = async () => {
    if (!caseService) return;

    try {
      setLoadingCases(true);
      console.log('📋 [Worklist] Loading all cases...');
      
      // Clear fetched studies cache to force fresh data from Orthanc
      fetchedStudiesRef.current.clear();
      console.log('🔄 [Worklist] Cleared study cache for fresh data');
      
      const cases = await caseService.getCases();
      setCaseList(cases);
      
      console.log(`📋 [Worklist] Found ${cases.length} total cases`);

      // Get active case ID
      const activeCaseId = caseService.getActiveCaseId();
      setActiveCaseId(activeCaseId);

      // Log active vs inactive cases
      const activeCases = cases.filter(c => c.caseId === activeCaseId);
      const inactiveCases = cases.filter(c => c.caseId !== activeCaseId);
      
      console.log(`✅ [Worklist] ACTIVE CASES (${activeCases.length}):`);
      activeCases.forEach(c => {
        console.log(`   - ${c.caseId}: ${c.patientInfo?.name || 'N/A'} (MRN: ${c.patientInfo?.mrn || 'N/A'})`);
      });
      
      console.log(`⚪ [Worklist] INACTIVE CASES (${inactiveCases.length}):`);
      inactiveCases.forEach(c => {
        console.log(`   - ${c.caseId}: ${c.patientInfo?.name || 'N/A'} (MRN: ${c.patientInfo?.mrn || 'N/A'})`);
      });

      // 🔧 FIX: Load studies for ALL cases, not just active one
      console.log('🔄 [Worklist] Loading studies for ALL cases...');
      const studyLoadPromises = cases.map(async (caseItem) => {
        try {
          await loadCaseStudies(caseItem.caseId);
          console.log(`   ✓ Loaded studies for case: ${caseItem.caseId}`);
        } catch (error) {
          console.error(`   ✗ Failed to load studies for case ${caseItem.caseId}:`, error);
        }
      });

      // Wait for all study loads to complete
      await Promise.all(studyLoadPromises);
      console.log('✅ [Worklist] All case studies loaded successfully');
      
    } catch (error) {
      console.error('❌ [Worklist] Failed to load cases:', error);
    } finally {
      setLoadingCases(false);
    }
  };

  const loadCaseStudies = async (caseId) => {
    if (!caseService || !caseId) return;

    try {
      const caseData = await caseService.getStudiesForCase(caseId);
      // Safe access to studies array with fallback
      setCaseStudies(prev => ({
        ...prev,
        [caseId]: caseData?.studies || []
      }));
    } catch (error) {
      console.error('Failed to load case studies:', error);
      // Set empty array on error to prevent undefined access
      setCaseStudies(prev => ({
        ...prev,
        [caseId]: []
      }));
    }
  };

  const onDoubleClickThumbnailHandler = useCallback(
    async displaySetInstanceUID => {
      const customHandler = customizationService.getCustomization(
        'studyBrowser.thumbnailDoubleClickCallback'
      );

      const setupArgs = {
        activeViewportId,
        commandsManager,
        servicesManager,
        isHangingProtocolLayout,
        appConfig: extensionManager._appConfig,
      };

      const handlers = customHandler?.callbacks.map(callback => callback(setupArgs));

      for (const handler of handlers) {
        await handler(displaySetInstanceUID);
      }
      onDoubleClickThumbnailHandlerCallBack?.(displaySetInstanceUID);
    },
    [
      activeViewportId,
      commandsManager,
      servicesManager,
      isHangingProtocolLayout,
      customizationService,
    ]
  );

  // ~~ studyDisplayList
  useEffect(() => {
    // Fetch all studies for the patient in each primary study
    async function fetchStudiesForPatient(StudyInstanceUID) {
      // Skip fetching if we've already fetched this study
      if (fetchedStudiesRef.current.has(StudyInstanceUID)) {
        return;
      }

      fetchedStudiesRef.current.add(StudyInstanceUID);

      // current study qido
      const qidoForStudyUID = await dataSource.query.studies.search({
        studyInstanceUid: StudyInstanceUID,
      });

      if (!qidoForStudyUID?.length) {
        navigate('/notfoundstudy', '_self');
        throw new Error('Invalid study URL');
      }

      let qidoStudiesForPatient = qidoForStudyUID;

      // try to fetch the prior studies based on the patientID if the
      // server can respond.
      try {
        qidoStudiesForPatient = await getStudiesForPatientByMRN(qidoForStudyUID);
      } catch (error) {
        console.warn(error);
      }

      const mappedStudies = _mapDataSourceStudies(qidoStudiesForPatient);
      const actuallyMappedStudies = mappedStudies.map(qidoStudy => {
        // 🔧 FIX: Find the actual case this study belongs to, not just the active case
        const studyCaseId = findCaseForStudy(qidoStudy.StudyInstanceUID);
        
        return {
          studyInstanceUid: qidoStudy.StudyInstanceUID,
          date: formatDate(qidoStudy.StudyDate) || '',
          description: qidoStudy.StudyDescription,
          modalities: qidoStudy.ModalitiesInStudy,
          numInstances: Number(qidoStudy.NumInstances),
          // LifeSync additions
          caseId: studyCaseId,  // Use the study's actual case, not the active case
          clinicalPhase: getStudyClinicalPhase(qidoStudy.StudyInstanceUID),
        };
      });

      setStudyDisplayList(prevArray => {
        const ret = [...prevArray];
        for (const study of actuallyMappedStudies) {
          if (!prevArray.find(it => it.studyInstanceUid === study.studyInstanceUid)) {
            ret.push(study);
          }
        }
        return ret;
      });
    }

    StudyInstanceUIDs.forEach(sid => fetchStudiesForPatient(sid));
  }, [StudyInstanceUIDs, dataSource, getStudiesForPatientByMRN, navigate, activeCaseId]);

  // Helper function to find which case a study belongs to
  const findCaseForStudy = (studyInstanceUID) => {
    // Search through all cases to find which one contains this study
    for (const [caseId, studies] of Object.entries(caseStudies)) {
      if (Array.isArray(studies) && studies.some(s => s?.studyInstanceUID === studyInstanceUID)) {
        console.log(`🔍 [Worklist] Study ${studyInstanceUID} belongs to case: ${caseId}`);
        return caseId;
      }
    }
    
    // If not found in any case, return null (study not enrolled in any case)
    console.log(`⚠️ [Worklist] Study ${studyInstanceUID} not enrolled in any case`);
    return null;
  };

  const getStudyClinicalPhase = (studyInstanceUID) => {
    // 🔧 FIX: Search across ALL cases, not just active case
    for (const [caseId, studies] of Object.entries(caseStudies)) {
      if (Array.isArray(studies)) {
        const study = studies.find(s => s?.studyInstanceUID === studyInstanceUID);
        if (study) {
          return study.clinicalPhase || null;
        }
      }
    }
    return null;
  };

  // ~~ Initial Thumbnails
  useEffect(() => {
    if (!hasLoadedViewports) {
      if (activeViewportId) {
        // Once there is an active viewport id, it means the layout is ready
        // so wait a bit of time to allow the viewports preferential loading
        // which improves user experience of responsiveness significantly on slower
        // systems.
        const delayMs = 250 + displaySetService.getActiveDisplaySets().length * 10;
        window.setTimeout(() => setHasLoadedViewports(true), delayMs);
      }

      return;
    }

    let currentDisplaySets = displaySetService.activeDisplaySets;
    // filter non based on the list of modalities that are supported by cornerstone
    currentDisplaySets = currentDisplaySets.filter(
      ds => !thumbnailNoImageModalities.includes(ds.Modality) || ds.thumbnailSrc === null
    );

    if (!currentDisplaySets.length) {
      return;
    }

    currentDisplaySets.forEach(async dSet => {
      const newImageSrcEntry = {};
      const displaySet = displaySetService.getDisplaySetByUID(dSet.displaySetInstanceUID);
      const imageIds = dataSource.getImageIdsForDisplaySet(dSet);

      const imageId = getImageIdForThumbnail(displaySet, imageIds);

      // TODO: Is it okay that imageIds are not returned here for SR displaySets?
      if (displaySet?.unsupported) {
        return;
      }
      // When the image arrives, render it and store the result in the thumbnailImgSrcMap
      let { thumbnailSrc } = displaySet;
      if (!thumbnailSrc && displaySet.getThumbnailSrc) {
        thumbnailSrc = await displaySet.getThumbnailSrc({ getImageSrc });
      }
      if (!thumbnailSrc && imageId) {
        const thumbnailSrc = await getImageSrc(imageId);
        displaySet.thumbnailSrc = thumbnailSrc;
      }
      newImageSrcEntry[dSet.displaySetInstanceUID] = thumbnailSrc;

      setThumbnailImageSrcMap(prevState => {
        return { ...prevState, ...newImageSrcEntry };
      });
    });
  }, [displaySetService, dataSource, getImageSrc, activeViewportId, hasLoadedViewports]);

  // ~~ displaySets
  useEffect(() => {
    const currentDisplaySets = displaySetService.activeDisplaySets;

    if (!currentDisplaySets.length) {
      return;
    }

    const mappedDisplaySets = mapDisplaySetsWithState(
      currentDisplaySets,
      displaySetsLoadingState,
      thumbnailImageSrcMap,
      viewports
    );

    if (!customMapDisplaySets) {
      sortStudyInstances(mappedDisplaySets);
    }

    setDisplaySets(mappedDisplaySets);
  }, [
    displaySetService.activeDisplaySets,
    displaySetsLoadingState,
    viewports,
    thumbnailImageSrcMap,
    customMapDisplaySets,
  ]);

  // ~~ subscriptions --> displaySets
  useEffect(() => {
    // DISPLAY_SETS_ADDED returns an array of DisplaySets that were added
    const SubscriptionDisplaySetsAdded = displaySetService.subscribe(
      displaySetService.EVENTS.DISPLAY_SETS_ADDED,
      data => {
        if (!hasLoadedViewports) {
          return;
        }
        const { displaySetsAdded, options } = data;
        displaySetsAdded.forEach(async dSet => {
          const displaySetInstanceUID = dSet.displaySetInstanceUID;
          const newImageSrcEntry = {};
          const displaySet = displaySetService.getDisplaySetByUID(displaySetInstanceUID);
          if (displaySet?.unsupported) {
            return;
          }
          if (options?.madeInClient) {
            setJumpToDisplaySet(displaySetInstanceUID);
          }

          const imageIds = dataSource.getImageIdsForDisplaySet(displaySet);
          const imageId = getImageIdForThumbnail(displaySet, imageIds);

          // TODO: Is it okay that imageIds are not returned here for SR displaysets?
          if (!imageId) {
            return;
          }

          // When the image arrives, render it and store the result in the thumbnailImgSrcMap
          let { thumbnailSrc } = displaySet;
          if (!thumbnailSrc && displaySet.getThumbnailSrc) {
            thumbnailSrc = await displaySet.getThumbnailSrc({ getImageSrc });
          }
          if (!thumbnailSrc) {
            thumbnailSrc = await getImageSrc(imageId);
            displaySet.thumbnailSrc = thumbnailSrc;
          }
          newImageSrcEntry[displaySetInstanceUID] = thumbnailSrc;

          setThumbnailImageSrcMap(prevState => {
            return { ...prevState, ...newImageSrcEntry };
          });
        });
      }
    );

    return () => {
      SubscriptionDisplaySetsAdded.unsubscribe();
    };
  }, [displaySetService, dataSource, getImageSrc, hasLoadedViewports]);

  useEffect(() => {
    // TODO: Will this always hold _all_ the displaySets we care about?
    // DISPLAY_SETS_CHANGED returns `DisplaySerService.activeDisplaySets`
    const SubscriptionDisplaySetsChanged = displaySetService.subscribe(
      displaySetService.EVENTS.DISPLAY_SETS_CHANGED,
      changedDisplaySets => {
        const mappedDisplaySets = mapDisplaySetsWithState(
          changedDisplaySets,
          displaySetsLoadingState,
          thumbnailImageSrcMap,
          viewports
        );

        if (!customMapDisplaySets) {
          sortStudyInstances(mappedDisplaySets);
        }

        setDisplaySets(mappedDisplaySets);
      }
    );

    const SubscriptionDisplaySetMetaDataInvalidated = displaySetService.subscribe(
      displaySetService.EVENTS.DISPLAY_SET_SERIES_METADATA_INVALIDATED,
      () => {
        const mappedDisplaySets = mapDisplaySetsWithState(
          displaySetService.getActiveDisplaySets(),
          displaySetsLoadingState,
          thumbnailImageSrcMap,
          viewports
        );

        if (!customMapDisplaySets) {
          sortStudyInstances(mappedDisplaySets);
        }

        setDisplaySets(mappedDisplaySets);
      }
    );

    return () => {
      SubscriptionDisplaySetsChanged.unsubscribe();
      SubscriptionDisplaySetMetaDataInvalidated.unsubscribe();
    };
  }, [
    displaySetsLoadingState,
    thumbnailImageSrcMap,
    viewports,
    displaySetService,
    customMapDisplaySets,
  ]);

  const tabs = createStudyBrowserTabs(StudyInstanceUIDs, studyDisplayList, displaySets);

  // TODO: Should not fire this on "close"
  function _handleStudyClick(StudyInstanceUID) {
    const shouldCollapseStudy = expandedStudyInstanceUIDs.includes(StudyInstanceUID);
    const updatedExpandedStudyInstanceUIDs = shouldCollapseStudy
      ? [...expandedStudyInstanceUIDs.filter(stdyUid => stdyUid !== StudyInstanceUID)]
      : [...expandedStudyInstanceUIDs, StudyInstanceUID];

    setExpandedStudyInstanceUIDs(updatedExpandedStudyInstanceUIDs);

    if (!shouldCollapseStudy) {
      const madeInClient = true;
      requestDisplaySetCreationForStudy(displaySetService, StudyInstanceUID, madeInClient);
    }
  }

  useEffect(() => {
    if (jumpToDisplaySet) {
      // Get element by displaySetInstanceUID
      const displaySetInstanceUID = jumpToDisplaySet;
      const element = document.getElementById(`thumbnail-${displaySetInstanceUID}`);

      if (element && typeof element.scrollIntoView === 'function') {
        // TODO: Any way to support IE here?
        element.scrollIntoView({ behavior: 'smooth' });

        setJumpToDisplaySet(null);
      }
    }
  }, [jumpToDisplaySet, expandedStudyInstanceUIDs, activeTabName]);

  useEffect(() => {
    if (!jumpToDisplaySet) {
      return;
    }

    const displaySetInstanceUID = jumpToDisplaySet;
    // Set the activeTabName and expand the study
    const thumbnailLocation = _findTabAndStudyOfDisplaySet(displaySetInstanceUID, tabs);
    if (!thumbnailLocation) {
      return;
    }
    const { tabName, StudyInstanceUID } = thumbnailLocation;
    setActiveTabName(tabName);
    const studyExpanded = expandedStudyInstanceUIDs.includes(StudyInstanceUID);
    if (!studyExpanded) {
      const updatedExpandedStudyInstanceUIDs = [...expandedStudyInstanceUIDs, StudyInstanceUID];
      setExpandedStudyInstanceUIDs(updatedExpandedStudyInstanceUIDs);
    }
  }, [expandedStudyInstanceUIDs, jumpToDisplaySet, tabs]);

  const activeDisplaySetInstanceUIDs = viewports.get(activeViewportId)?.displaySetInstanceUIDs;

  return (
    <>
      <>
        <PanelStudyBrowserHeader
          viewPresets={viewPresets}
          updateViewPresetValue={updateViewPresetValue}
          actionIcons={actionIcons}
          updateActionIconValue={updateActionIconValue}
        />
        <Separator
          orientation="horizontal"
          className="bg-black"
          thickness="2px"
        />
      </>

      {/* Loading Banner - Prevent race conditions */}
      {loadingCases && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
          <div className="bg-secondary-dark border-primary-light rounded-lg border-2 p-6 shadow-2xl">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
              <div className="text-center">
                <div className="text-primary-light text-lg font-semibold">
                  Loading Cases & Studies
                </div>
                <div className="text-primary-light mt-2 text-sm opacity-75">
                  Please wait while we fetch all case data from the server...
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Only display StudyBrowser after loading completes */}
      {!loadingCases && (
        <StudyBrowser
          tabs={tabs}
          servicesManager={servicesManager}
          activeTabName={activeTabName}
          expandedStudyInstanceUIDs={expandedStudyInstanceUIDs}
          onClickStudy={_handleStudyClick}
          onClickTab={clickedTabName => {
            setActiveTabName(clickedTabName);
          }}
          onClickUntrack={onClickUntrack}
          onClickThumbnail={() => {}}
          onDoubleClickThumbnail={onDoubleClickThumbnailHandler}
          activeDisplaySetInstanceUIDs={activeDisplaySetInstanceUIDs}
          showSettings={actionIcons.find(icon => icon.id === 'settings')?.value}
          viewPresets={viewPresets}
          ThumbnailMenuItems={MoreDropdownMenu({
            commandsManager,
            servicesManager,
            menuItemsKey: 'studyBrowser.thumbnailMenuItems',
          })}
          StudyMenuItems={MoreDropdownMenu({
            commandsManager,
            servicesManager,
            menuItemsKey: 'studyBrowser.studyMenuItems',
          })}
        />
      )}
    </>
  );
}

export default LifeSyncWorklist;

/**
 * Maps from the DataSource's format to a naturalized object
 *
 * @param {*} studies
 */
function _mapDataSourceStudies(studies) {
  return studies.map(study => {
    // TODO: Why does the data source return in this format?
    return {
      AccessionNumber: study.accession,
      StudyDate: study.date,
      StudyDescription: study.description,
      NumInstances: study.instances,
      ModalitiesInStudy: study.modalities,
      PatientID: study.mrn,
      PatientName: study.patientName,
      StudyInstanceUID: study.studyInstanceUid,
      StudyTime: study.time,
    };
  });
}

function _mapDisplaySets(displaySets, displaySetLoadingState, thumbnailImageSrcMap, viewports) {
  const thumbnailDisplaySets = [];
  const thumbnailNoImageDisplaySets = [];
  displaySets
    .filter(ds => !ds.excludeFromThumbnailBrowser)
    .forEach(ds => {
      const { thumbnailSrc, displaySetInstanceUID } = ds;
      const componentType = _getComponentType(ds);

      const array =
        componentType === 'thumbnail' ? thumbnailDisplaySets : thumbnailNoImageDisplaySets;

      const loadingProgress = displaySetLoadingState?.[displaySetInstanceUID];

      array.push({
        displaySetInstanceUID,
        description: ds.SeriesDescription || '',
        seriesNumber: ds.SeriesNumber,
        modality: ds.Modality,
        seriesDate: formatDate(ds.SeriesDate),
        numInstances: ds.numImageFrames,
        loadingProgress,
        countIcon: ds.countIcon,
        messages: ds.messages,
        StudyInstanceUID: ds.StudyInstanceUID,
        componentType,
        imageSrc: thumbnailSrc || thumbnailImageSrcMap[displaySetInstanceUID],
        dragData: {
          type: 'displayset',
          displaySetInstanceUID,
          // .. Any other data to pass
        },
        isHydratedForDerivedDisplaySet: ds.isHydrated,
      });
    });

  return [...thumbnailDisplaySets, ...thumbnailNoImageDisplaySets];
}

function _getComponentType(ds) {
  if (
    thumbnailNoImageModalities.includes(ds.Modality) ||
    ds?.unsupported ||
    ds.thumbnailSrc === null
  ) {
    return 'thumbnailNoImage';
  }

  return 'thumbnail';
}

function getImageIdForThumbnail(displaySet, imageIds) {
  let imageId;
  if (displaySet.isDynamicVolume) {
    const timePoints = displaySet.dynamicVolumeInfo.timePoints;
    const middleIndex = Math.floor(timePoints.length / 2);
    const middleTimePointImageIds = timePoints[middleIndex];
    imageId = middleTimePointImageIds[Math.floor(middleTimePointImageIds.length / 2)];
  } else {
    imageId = imageIds[Math.floor(imageIds.length / 2)];
  }
  return imageId;
}

function _findTabAndStudyOfDisplaySet(displaySetInstanceUID, tabs) {
  for (let t = 0; t < tabs.length; t++) {
    const { studies } = tabs[t];

    for (let s = 0; s < studies.length; s++) {
      const { displaySets } = studies[s];

      for (let d = 0; d < displaySets.length; d++) {
        const displaySet = displaySets[d];

        if (displaySet.displaySetInstanceUID === displaySetInstanceUID) {
          return {
            tabName: tabs[t].name,
            StudyInstanceUID: studies[s].studyInstanceUid,
          };
        }
      }
    }
  }
}
