import React, { useState, useEffect, useMemo } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { Link, useNavigate } from 'react-router-dom';
import moment from 'moment';
import qs from 'query-string';
import isEqual from 'lodash.isequal';
import { useTranslation } from 'react-i18next';
//
import filtersMeta from './filtersMeta.js';
import { useAppConfig } from '@state';
import { useDebounce, useSearchParams } from '../../hooks';
import { utils, Types as coreTypes } from '@ohif/core';

import {
  StudyListExpandedRow,
  EmptyStudies,
  StudyListTable,
  StudyListPagination,
  StudyListFilter,
  Button,
  ButtonEnums,
} from '@ohif/ui';

import {
  Header,
  Icons,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  Clipboard,
  useModal,
  useSessionStorage,
  Onboarding,
  ScrollArea,
  InvestigationalUseDialog,
  Button as ButtonNext,
} from '@ohif/ui-next';

import { EditCaseDialog, CreateCaseDialog } from '@ohif/extension-lifesync/src/components/CaseManagement';

// Simplified Case Selector for WorkList
const WorkListCaseSelector = ({ servicesManager, viewMode, setViewMode, cases, loadingCases }) => {
  const [localCases, setLocalCases] = React.useState([]);
  const [activeCaseId, setActiveCaseId] = React.useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const caseService = servicesManager?.services?.caseService;

  const loadCases = async () => {
    if (!caseService) return;
    try {
      const fetchedCases = await caseService.getCases();
      setLocalCases(fetchedCases);
    } catch (err) {
      console.warn('Failed to load cases:', err);
    }
  };

  React.useEffect(() => {
    if (!caseService) return;

    loadCases();
    const initialCaseId = caseService.getActiveCaseId();
    setActiveCaseId(initialCaseId);

    const unsubscribe = caseService.subscribe(
      caseService.constructor.EVENTS.ACTIVE_CASE_CHANGED,
      ({ caseId }) => setActiveCaseId(caseId)
    );

    return () => unsubscribe?.unsubscribe();
  }, [caseService]);

  const handleCreateCase = async (patientInfo) => {
    if (!caseService) return null;

    // Call caseService.createCase with just patientInfo
    // API will auto-generate case ID
    const newCase = await caseService.createCase(patientInfo);

    await loadCases(); // Reload cases
    caseService.setActiveCaseId(newCase.caseId); // Auto-select new case

    return newCase; // Return the created case for success message
  };

  if (!caseService) {
    return null;
  }

  const activeCase = localCases.find(c => c.caseId === activeCaseId);
  const displayCases = cases && cases.length > 0 ? cases : localCases;

  return (
    <>
      <div className="flex items-center gap-4 px-4">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-primary-light text-sm font-medium">View:</span>
          <div className="flex rounded border border-primary-light">
            <button
              onClick={() => setViewMode('cases')}
              className={classnames(
                'px-3 py-1.5 text-sm transition-colors',
                viewMode === 'cases'
                  ? 'bg-blue-600 text-white'
                  : 'bg-primary-dark text-primary-light hover:bg-primary-main'
              )}
            >
              Cases
            </button>
            <button
              onClick={() => setViewMode('studies')}
              className={classnames(
                'px-3 py-1.5 text-sm transition-colors',
                viewMode === 'studies'
                  ? 'bg-blue-600 text-white'
                  : 'bg-primary-dark text-primary-light hover:bg-primary-main'
              )}
            >
              Studies
            </button>
          </div>
        </div>

        {/* Case Selector - only show in study view */}
        {viewMode === 'studies' && (
          <>
            <span className="text-primary-light text-sm font-medium">Surgical Case:</span>
            <select
              value={activeCaseId || ''}
              onChange={(e) => caseService.setActiveCaseId(e.target.value || null)}
              className="bg-primary-dark hover:bg-primary text-primary-active border-primary-light min-w-[200px] rounded border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No Case Selected (View All Studies)</option>
              {displayCases.map(caseItem => (
                <option key={caseItem.caseId} value={caseItem.caseId}>
                  {caseItem.caseName || caseItem.caseId} - {caseItem.patientName || caseItem.mrn}
                </option>
              ))}
            </select>
            {activeCase && (
              <span className="text-primary-light text-xs">
                ({activeCase.studyCount || 0} studies)
              </span>
            )}
          </>
        )}

        {/* Create Case Button */}
        <ButtonNext
          size="sm"
          onClick={() => setIsCreateDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Icons.Add className="mr-1 h-4 w-4" />
          Create Case
        </ButtonNext>

        {/* Loading indicator for cases */}
        {loadingCases && (
          <span className="text-primary-light text-xs">Loading cases...</span>
        )}
      </div>

      <CreateCaseDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreateCase={handleCreateCase}
        servicesManager={servicesManager}
      />
    </>
  );
};

// API Configuration Panel
const ApiConfigPanel = ({ servicesManager }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [apiUrl, setApiUrl] = React.useState('');
  const [tempUrl, setTempUrl] = React.useState('');
  const [connectionStatus, setConnectionStatus] = React.useState({ case: false, registration: false });

  const caseService = servicesManager?.services?.caseService;
  const registrationService = servicesManager?.services?.registrationService;

  React.useEffect(() => {
    // Load saved URL from localStorage
    const savedUrl = localStorage.getItem('syncforge_api_url');
    const defaultUrl = 'http://localhost:3001';

    if (savedUrl) {
      setApiUrl(savedUrl);
      setTempUrl(savedUrl);
    } else {
      setApiUrl(defaultUrl);
      setTempUrl(defaultUrl);
    }

    // Subscribe to connection status changes
    if (caseService) {
      const unsubCase = caseService.subscribe(
        caseService.constructor.EVENTS.CONNECTION_STATUS,
        ({ connected }) => {
          setConnectionStatus(prev => ({ ...prev, case: connected }));
        }
      );

      return () => unsubCase?.unsubscribe();
    }
  }, [caseService]);

  const handleApply = () => {
    const cleanUrl = tempUrl.replace(/\/$/, '');
    setApiUrl(cleanUrl);
    localStorage.setItem('syncforge_api_url', cleanUrl);

    // Update both services
    if (caseService) {
      caseService.setApiUrl(cleanUrl);
    }
    if (registrationService) {
      registrationService.setApiUrl(cleanUrl);
    }
  };

  const handleReset = () => {
    const defaultUrl = 'http://localhost:3001';
    setTempUrl(defaultUrl);
    setApiUrl(defaultUrl);
    localStorage.removeItem('syncforge_api_url');

    if (caseService) {
      caseService.setApiUrl(defaultUrl);
    }
    if (registrationService) {
      registrationService.setApiUrl(defaultUrl);
    }
  };

  if (!caseService && !registrationService) {
    return null;
  }

  return (
    <div className="bg-secondary-dark border-secondary-light mx-4 mt-2 rounded border">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="hover:bg-secondary-main flex w-full items-center justify-between px-4 py-2 text-left transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icons.Settings className="h-4 w-4" />
          <span className="text-primary-light text-sm font-medium">SyncForge API Configuration</span>
          <div className="flex items-center gap-2 ml-3">
            <div className={`h-2 w-2 rounded-full ${connectionStatus.case ? 'bg-green-500' : 'bg-red-500'}`} title="Case Management API" />
            <span className="text-xs text-gray-400">{apiUrl}</span>
          </div>
        </div>
        <Icons.ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="border-t border-secondary-light px-4 py-3 space-y-3">
          <div className="space-y-2">
            <label className="text-primary-light text-xs font-medium">API URL (for ngrok or remote access)</label>
            <input
              type="text"
              value={tempUrl}
              onChange={(e) => setTempUrl(e.target.value)}
              placeholder="https://your-ngrok-url.ngrok-free.app"
              className="bg-primary-dark text-primary-light border-primary-light w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <ButtonNext
              size="sm"
              onClick={handleApply}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Apply
            </ButtonNext>
            <ButtonNext
              variant="ghost"
              size="sm"
              onClick={handleReset}
            >
              Reset to Default
            </ButtonNext>
          </div>

          <div className="text-xs text-gray-400 space-y-1">
            <p><strong>Local Development:</strong></p>
            <p className="pl-4">• Default: http://localhost:3001 (direct API access)</p>
            <p className="pl-4">• With nginx: http://localhost:8080/api (proxied, more secure)</p>
            <p><strong>Remote Access (Recommended - nginx):</strong></p>
            <p className="pl-4">1. Run: <code className="bg-gray-800 px-1 rounded">ngrok http 8080</code></p>
            <p className="pl-4">2. Leave this field at default (API auto-routed via nginx)</p>
            <p className="pl-4">3. Access OHIF via ngrok URL - API included automatically</p>
            <p><strong>Remote Access (Legacy - direct):</strong></p>
            <p className="pl-4">1. Run: <code className="bg-gray-800 px-1 rounded">ngrok http 3001</code></p>
            <p className="pl-4">2. Copy the HTTPS URL and paste above</p>
          </div>
        </div>
      )}
    </div>
  );
};

import { Types } from '@ohif/ui';

import { preserveQueryParameters, preserveQueryStrings } from '../../utils/preserveQueryParameters';

const PatientInfoVisibility = Types.PatientInfoVisibility;

const { sortBySeriesDate } = utils;

const seriesInStudiesMap = new Map();

/**
 * TODO:
 * - debounce `setFilterValues` (150ms?)
 */
function WorkList({
  data: studies,
  dataTotal: studiesTotal,
  isLoadingData,
  dataSource,
  hotkeysManager,
  dataPath,
  onRefresh,
  servicesManager,
}: withAppTypes) {
  const { show, hide } = useModal();
  const { t } = useTranslation();
  // ~ Modes
  const [appConfig] = useAppConfig();
  // ~ Case Filtering
  const [activeCase, setActiveCase] = useState(null);
  const [activeCaseId, setActiveCaseId] = useState(null);
  const caseService = servicesManager?.services?.caseService;

  // ~ Hierarchical Worklist State
  const [viewMode, setViewMode] = useState<'cases' | 'studies'>('cases'); // Toggle between case-centric and study-centric views (default to cases)
  const [cases, setCases] = useState([]);
  const [expandedCases, setExpandedCases] = useState([]);
  const [caseStudies, setCaseStudies] = useState(new Map()); // caseId -> studies
  const [loadingCases, setLoadingCases] = useState(false);

  // ~ Edit Case Dialog State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);

  // ~ Filters
  const searchParams = useSearchParams();
  const navigate = useNavigate();
  const STUDIES_LIMIT = 101;
  const queryFilterValues = _getQueryFilterValues(searchParams);
  const [sessionQueryFilterValues, updateSessionQueryFilterValues] = useSessionStorage({
    key: 'queryFilterValues',
    defaultValue: queryFilterValues,
    // ToDo: useSessionStorage currently uses an unload listener to clear the filters from session storage
    // so on systems that do not support unload events a user will NOT be able to alter any existing filter
    // in the URL, load the page and have it apply.
    clearOnUnload: true,
  });
  const [filterValues, _setFilterValues] = useState({
    ...defaultFilterValues,
    ...sessionQueryFilterValues,
  });

  const debouncedFilterValues = useDebounce(filterValues, 200);
  const { resultsPerPage, pageNumber, sortBy, sortDirection } = filterValues;

  /*
   * The default sort value keep the filters synchronized with runtime conditional sorting
   * Only applied if no other sorting is specified and there are less than 101 studies
   */

  const canSort = studiesTotal < STUDIES_LIMIT;
  const shouldUseDefaultSort = sortBy === '' || !sortBy;
  const sortModifier = sortDirection === 'descending' ? 1 : -1;
  const defaultSortValues =
    shouldUseDefaultSort && canSort ? { sortBy: 'studyDate', sortDirection: 'ascending' } : {};
  const { customizationService } = servicesManager.services;

  const sortedStudies = useMemo(() => {
    if (!canSort) {
      return studies;
    }

    return [...studies].sort((s1, s2) => {
      if (shouldUseDefaultSort) {
        const ascendingSortModifier = -1;
        return _sortStringDates(s1, s2, ascendingSortModifier);
      }

      const s1Prop = s1[sortBy];
      const s2Prop = s2[sortBy];

      if (typeof s1Prop === 'string' && typeof s2Prop === 'string') {
        return s1Prop.localeCompare(s2Prop) * sortModifier;
      } else if (typeof s1Prop === 'number' && typeof s2Prop === 'number') {
        return (s1Prop > s2Prop ? 1 : -1) * sortModifier;
      } else if (!s1Prop && s2Prop) {
        return -1 * sortModifier;
      } else if (!s2Prop && s1Prop) {
        return 1 * sortModifier;
      } else if (sortBy === 'studyDate') {
        return _sortStringDates(s1, s2, sortModifier);
      }

      return 0;
    });
  }, [canSort, studies, shouldUseDefaultSort, sortBy, sortModifier]);

  // Filter studies by active case
  const filteredStudies = useMemo(() => {
    if (!activeCaseId || !activeCase) {
      return sortedStudies;
    }

    const caseStudyUIDs = activeCase.studies.map(s => s.studyInstanceUID);
    return sortedStudies.filter(study => caseStudyUIDs.includes(study.studyInstanceUid));
  }, [sortedStudies, activeCaseId, activeCase]);

  // ~ Rows & Studies
  const [expandedRows, setExpandedRows] = useState([]);
  const [studiesWithSeriesData, setStudiesWithSeriesData] = useState([]);
  const [seriesDataForCases, setSeriesDataForCases] = useState(new Map()); // Map<studyUID, seriesData>
  const numOfStudies = studiesTotal;

  // ~ Add Study Modal
  const [showAddStudyModal, setShowAddStudyModal] = useState(false);
  const [addStudyToCaseId, setAddStudyToCaseId] = useState(null);
  const [orthancStudies, setOrthancStudies] = useState([]);
  const [loadingOrthancStudies, setLoadingOrthancStudies] = useState(false);
  const querying = useMemo(() => {
    return isLoadingData || expandedRows.length > 0;
  }, [isLoadingData, expandedRows]);

  const setFilterValues = val => {
    if (filterValues.pageNumber === val.pageNumber) {
      val.pageNumber = 1;
    }
    _setFilterValues(val);
    updateSessionQueryFilterValues(val);
    setExpandedRows([]);
  };

  const onPageNumberChange = newPageNumber => {
    const oldPageNumber = filterValues.pageNumber;
    const rollingPageNumberMod = Math.floor(101 / filterValues.resultsPerPage);
    const rollingPageNumber = oldPageNumber % rollingPageNumberMod;
    const isNextPage = newPageNumber > oldPageNumber;
    const hasNextPage = Math.max(rollingPageNumber, 1) * resultsPerPage < numOfStudies;

    if (isNextPage && !hasNextPage) {
      return;
    }

    setFilterValues({ ...filterValues, pageNumber: newPageNumber });
  };

  const onResultsPerPageChange = newResultsPerPage => {
    setFilterValues({
      ...filterValues,
      pageNumber: 1,
      resultsPerPage: Number(newResultsPerPage),
    });
  };

  // Set body style
  useEffect(() => {
    document.body.classList.add('bg-black');
    return () => {
      document.body.classList.remove('bg-black');
    };
  }, []);

  // Load cases for hierarchical view
  const loadCases = async () => {
    if (!caseService) return;

    setLoadingCases(true);
    try {
      const caseData = await caseService.getUniqueCaseIds();
      setCases(caseData);
    } catch (error) {
      console.warn('Failed to load cases:', error);
      setCases([]);
    } finally {
      setLoadingCases(false);
    }
  };

  // Update case handler for Edit dialog
  const handleUpdateCase = async (updates) => {
    if (!caseService || !selectedCase) return;

    try {
      await caseService.updateCase(selectedCase.caseId, updates);
      await loadCases(); // Reload cases list
      console.log(`✅ Case ${selectedCase.caseId} updated successfully`);
    } catch (err) {
      console.error('Failed to update case:', err);
      throw err; // Let EditCaseDialog show the error
    }
  };

  // Load studies for a specific case
  const loadStudiesForCase = async (caseId) => {
    if (!caseService) return;

    try {
      const caseStudiesData = await caseService.getStudiesForCase(caseId);
      // Safe access with fallback to empty array
      setCaseStudies(prev => new Map(prev.set(caseId, caseStudiesData?.studies || [])));
    } catch (error) {
      console.warn(`Failed to load studies for case ${caseId}:`, error);
      // Set empty array on error
      setCaseStudies(prev => new Map(prev.set(caseId, [])));
    }
  };

  // Handle case expansion
  const handleCaseExpansion = async (caseId, shouldExpand) => {
    if (shouldExpand) {
      setExpandedCases(prev => [...prev, caseId]);
      // Load studies if not already loaded
      if (!caseStudies.has(caseId)) {
        await loadStudiesForCase(caseId);
      }
    } else {
      setExpandedCases(prev => prev.filter(id => id !== caseId));
    }
  };

  // Subscribe to case service changes
  useEffect(() => {
    if (!caseService) {
      return;
    }

    // Load initial active case
    const initialCaseId = caseService.getActiveCaseId();
    const initialCase = caseService.getActiveCase();
    setActiveCaseId(initialCaseId);
    setActiveCase(initialCase);

    // Load cases for hierarchical view
    loadCases();

    // Subscribe to case changes
    const unsubscribe = caseService.subscribe(
      caseService.constructor.EVENTS.ACTIVE_CASE_CHANGED,
      ({ caseId, case: caseData }) => {
        setActiveCaseId(caseId);
        setActiveCase(caseData);
        console.log('📁 WorkList: Active case changed:', caseId);
      }
    );

    return () => {
      if (unsubscribe) {
        unsubscribe.unsubscribe();
      }
    };
  }, [caseService]);

  // Sync URL query parameters with filters
  useEffect(() => {
    if (!debouncedFilterValues) {
      return;
    }

    const queryString = {};
    Object.keys(defaultFilterValues).forEach(key => {
      const defaultValue = defaultFilterValues[key];
      const currValue = debouncedFilterValues[key];

      // TODO: nesting/recursion?
      if (key === 'studyDate') {
        if (currValue.startDate && defaultValue.startDate !== currValue.startDate) {
          queryString.startDate = currValue.startDate;
        }
        if (currValue.endDate && defaultValue.endDate !== currValue.endDate) {
          queryString.endDate = currValue.endDate;
        }
      } else if (key === 'modalities' && currValue.length) {
        queryString.modalities = currValue.join(',');
      } else if (currValue !== defaultValue) {
        queryString[key] = currValue;
      }
    });

    preserveQueryStrings(queryString);

    const search = qs.stringify(queryString, {
      skipNull: true,
      skipEmptyString: true,
    });
    navigate({
      pathname: '/',
      search: search ? `?${search}` : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFilterValues]);

  // Helper function to load series data for a study
  const loadSeriesForStudy = async (studyUID) => {
    if (!activeCaseId || !caseService) {
      return;
    }

    try {
      const data = await caseService.getSeriesForStudy(activeCaseId, studyUID);
      setSeriesDataForCases(prev => {
        const newMap = new Map(prev);
        newMap.set(studyUID, data);
        return newMap;
      });
    } catch (error) {
      console.error('Failed to load series for study:', error);
    }
  };

  // Helper function to toggle series enrollment
  const toggleSeriesEnrollment = async (studyUID, seriesUID, isEnrolled) => {
    if (!activeCaseId || !caseService) {
      return;
    }

    try {
      await caseService.toggleSeriesEnrollment(activeCaseId, studyUID, seriesUID, isEnrolled);
      // Reload series data
      await loadSeriesForStudy(studyUID);
    } catch (error) {
      console.error('Failed to toggle series enrollment:', error);
    }
  };

  // Helper function to remove study from case
  const removeStudyFromCase = async (studyUID) => {
    if (!activeCaseId || !caseService) {
      return;
    }

    // Confirm with user
    const confirmed = window.confirm(
      'Are you sure you want to remove this study from the case?\n\n' +
      'The study will remain in Orthanc but will no longer be associated with this case.'
    );

    if (!confirmed) {
      return;
    }

    try {
      await caseService.removeStudy(activeCaseId, studyUID);
      console.log(`✅ Study ${studyUID} removed from case`);

      // Reload the active case to refresh the UI
      if (caseService.loadActiveCase) {
        await caseService.loadActiveCase();
      }
    } catch (error) {
      console.error('Failed to remove study from case:', error);
      alert('Failed to remove study from case. Please try again.');
    }
  };

  // Query for series information
  useEffect(() => {
    const fetchSeries = async studyInstanceUid => {
      try {
        const series = await dataSource.query.series.search(studyInstanceUid);
        seriesInStudiesMap.set(studyInstanceUid, sortBySeriesDate(series));
        setStudiesWithSeriesData([...studiesWithSeriesData, studyInstanceUid]);
      } catch (ex) {
        // TODO: UI Notification Service
        console.warn(ex);
      }
    };

    // TODO: WHY WOULD YOU USE AN INDEX OF 1?!
    // Note: expanded rows index begins at 1
    for (let z = 0; z < expandedRows.length; z++) {
      const expandedRowIndex = expandedRows[z] - 1;
      const study = filteredStudies[expandedRowIndex];

      // Safety check: study might not exist in hierarchical view
      if (!study || !study.studyInstanceUid) {
        continue;
      }

      const studyInstanceUid = study.studyInstanceUid;

      if (studiesWithSeriesData.includes(studyInstanceUid)) {
        continue;
      }

      fetchSeries(studyInstanceUid);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedRows, studies]);

  const isFiltering = (filterValues, defaultFilterValues) => {
    return !isEqual(filterValues, defaultFilterValues);
  };

  // Create hierarchical table data source
  const createTableDataSource = () => {
    const rows = [];
    let rowIndex = 1;

    if (viewMode === 'cases' && cases.length > 0) {
      // Case-centric view: Show cases first
      cases.forEach((caseItem) => {
        const caseRowKey = rowIndex++;
        const isCaseExpanded = expandedCases.includes(caseItem.caseId);

        // Add case row
        rows.push({
          dataCY: `caseRow-${caseItem.caseId}`,
          clickableCY: caseItem.caseId,
          row: [
            {
              key: 'caseId',
              content: (
                <div className="flex items-center gap-2 bg-blue-900/20 px-2 py-1 rounded">
                  <Icons.Database className="h-5 w-5 text-blue-400" />
                  <span className="font-bold text-blue-200 text-base">📁 {caseItem.caseId}</span>
                </div>
              ),
              gridCol: 4,
            },
            {
              key: 'patientName',
              content: (
                <span className="font-semibold text-white">
                  {caseItem.patientName || 'Unknown Patient'}
                </span>
              ),
              gridCol: 4,
            },
            {
              key: 'mrn',
              content: caseItem.mrn,
              gridCol: 3,
            },
            {
              key: 'createdAt',
              content: moment(caseItem.createdAt).format('MMM-DD-YYYY'),
              gridCol: 3,
            },
            {
              key: 'studyCount',
              content: (
                <div className="flex items-center gap-2">
                  <Icons.GroupLayers className="h-4 w-4 text-gray-400" />
                  <span>{caseItem.studyCount} studies</span>
                </div>
              ),
              gridCol: 3,
            },
            {
              key: 'actions',
              content: (
                <div className="flex items-center gap-2">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      setAddStudyToCaseId(caseItem.caseId);
                      setShowAddStudyModal(true);
                      setLoadingOrthancStudies(true);

                      try {
                        if (caseService) {
                          const studies = await caseService.getAllOrthancStudies();
                          setOrthancStudies(studies);
                        }
                      } catch (err) {
                        console.error('Failed to load Orthanc studies:', err);
                        alert('Failed to load studies from Orthanc');
                      } finally {
                        setLoadingOrthancStudies(false);
                      }
                    }}
                    className="hover:bg-green-900/50 flex items-center gap-1 rounded border border-green-500/30 bg-green-900/20 px-2 py-1 transition-colors"
                    title="Add Study to Case"
                  >
                    <Icons.Add className="h-4 w-4 text-green-400" />
                    <span className="text-xs text-green-300">Add Study</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Transform case data to match EditCaseDialog's expected structure
                      const caseDataForDialog = {
                        caseId: caseItem.caseId,
                        patientInfo: {
                          mrn: caseItem.mrn || '',
                          name: caseItem.patientName || '',
                          dateOfBirth: caseItem.dateOfBirth || ''
                        },
                        status: caseItem.status || 'created'
                      };
                      setSelectedCase(caseDataForDialog);
                      setIsEditDialogOpen(true);
                    }}
                    className="hover:bg-blue-900/50 flex items-center gap-1 rounded border border-blue-500/30 bg-blue-900/20 px-2 py-1 transition-colors"
                    title="Edit Case"
                  >
                    <Icons.Settings className="h-4 w-4 text-blue-400" />
                    <span className="text-xs text-blue-300">Edit</span>
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();

                      if (!confirm(`Delete case "${caseItem.caseId}"?\n\nThis will also delete ${caseItem.studyCount} enrolled study/studies.\n\nThis action cannot be undone.`)) {
                        return;
                      }

                      try {
                        if (caseService) {
                          await caseService.deleteCase(caseItem.caseId);
                          await loadCases(); // Reload cases list
                          console.log(`✅ Case ${caseItem.caseId} deleted`);
                        }
                      } catch (err) {
                        console.error('Failed to delete case:', err);
                        alert(`Failed to delete case: ${err.message}`);
                      }
                    }}
                    className="hover:bg-red-900/50 flex items-center gap-1 rounded border border-red-500/30 bg-red-900/20 px-2 py-1 transition-colors"
                    title="Delete Case"
                  >
                    <Icons.Cancel className="h-4 w-4 text-red-400" />
                    <span className="text-xs text-red-300">Delete</span>
                  </button>
                </div>
              ),
              gridCol: 4,
            },
            {
              key: 'expandIcon',
              content: (
                <Icons.GroupLayers
                  className={classnames('w-4', {
                    'text-primary': isCaseExpanded,
                    'text-secondary-light': !isCaseExpanded,
                  })}
                />
              ),
              gridCol: 1,
            },
          ],
          expandedContent: null, // Case rows don't have expanded content
          onClickRow: () => handleCaseExpansion(caseItem.caseId, !isCaseExpanded),
          isExpanded: isCaseExpanded,
          isCaseRow: true,
        });

        // Add study rows if case is expanded
        if (isCaseExpanded && caseStudies.has(caseItem.caseId)) {
          const studies = caseStudies.get(caseItem.caseId) || [];

          studies.forEach((study) => {
            const studyRowKey = rowIndex++;
            const isStudyExpanded = expandedRows.some(k => k === studyRowKey);

            // Find the full study data from filteredStudies
            const fullStudy = filteredStudies.find(s => s.studyInstanceUid === study.studyInstanceUID);

            if (!fullStudy) {
              // Study not loaded yet - show placeholder with remove button
              rows.push({
                dataCY: `studyPlaceholder-${study.studyInstanceUID}`,
                clickableCY: study.studyInstanceUID,
                row: [
                  {
                    key: 'studyIndent',
                    content: <div className="ml-6 text-gray-500">└─</div>,
                    gridCol: 1,
                  },
                  {
                    key: 'studyInfo',
                    content: (
                      <div className="text-gray-400">
                        <span className="text-sm">{study.description || 'Study not in Orthanc'}</span>
                        <br />
                        <span className="text-xs text-gray-500">StudyUID: {study.studyInstanceUID.substring(0, 30)}...</span>
                      </div>
                    ),
                    gridCol: 10,
                  },
                  {
                    key: 'phase',
                    content: <span className="text-xs text-blue-400">{study.clinicalPhase}</span>,
                    gridCol: 3,
                  },
                  {
                    key: 'status',
                    content: <span className="text-xs text-yellow-500">Not in worklist</span>,
                    gridCol: 2,
                  },
                  {
                    key: 'removeButton',
                    content: (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Remove this study from the case?\n\nThis study is not in Orthanc worklist.')) {
                            if (caseService) {
                              caseService.removeStudy(caseItem.caseId, study.studyInstanceUID)
                                .then(() => {
                                  console.log(`✅ Study removed from case`);
                                  window.location.reload();
                                })
                                .catch(err => {
                                  console.error('Failed to remove study:', err);
                                  alert('Failed to remove study');
                                });
                            }
                          }
                        }}
                        className="hover:bg-red-900/50 rounded p-1 transition-colors"
                        title="Remove from Case"
                      >
                        <Icons.Close className="h-4 w-4 text-red-400 hover:text-red-300" />
                      </button>
                    ),
                    gridCol: 1,
                  },
                ],
                expandedContent: null, // Placeholder rows don't expand
                onClickRow: () => {},
                isExpanded: false,
                isStudyRow: true,
              });
              return; // Skip to next study
            }

            // Study found - show full details
            if (fullStudy) {
              const {
                studyInstanceUid,
                accession,
                modalities,
                instances,
                description,
                mrn,
                patientName,
                date,
                time,
              } = fullStudy;

              const studyDate =
                date &&
                moment(date, ['YYYYMMDD', 'YYYY.MM.DD'], true).isValid() &&
                moment(date, ['YYYYMMDD', 'YYYY.MM.DD']).format(t('Common:localDateFormat', 'MMM-DD-YYYY'));
              const studyTime =
                time &&
                moment(time, ['HH', 'HHmm', 'HHmmss', 'HHmmss.SSS']).isValid() &&
                moment(time, ['HH', 'HHmm', 'HHmmss', 'HHmmss.SSS']).format(
                  t('Common:localTimeFormat', 'hh:mm A')
                );

              const makeCopyTooltipCell = textValue => {
                if (!textValue) {
                  return '';
                }
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-pointer truncate">{textValue}</span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <div className="flex items-center justify-between gap-2">
                        {textValue}
                        <Clipboard>{textValue}</Clipboard>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              };

              rows.push({
                dataCY: `studyRow-${studyInstanceUid}`,
                clickableCY: studyInstanceUid,
                row: [
                  {
                    key: 'studyIndent',
                    content: <div className="ml-6 text-gray-500">└─</div>,
                    gridCol: 1,
                  },
                  {
                    key: 'patientName',
                    content: patientName ? makeCopyTooltipCell(patientName) : null,
                    gridCol: 3,
                  },
                  {
                    key: 'mrn',
                    content: makeCopyTooltipCell(mrn),
                    gridCol: 3,
                  },
                  {
                    key: 'studyDate',
                    content: (
                      <>
                        {studyDate && <span className="mr-4">{studyDate}</span>}
                        {studyTime && <span>{studyTime}</span>}
                      </>
                    ),
                    title: `${studyDate || ''} ${studyTime || ''}`,
                    gridCol: 4,
                  },
                  {
                    key: 'description',
                    content: (
                      <div className="flex items-center gap-2">
                        {makeCopyTooltipCell(description)}
                        {study.clinicalPhase && (
                          <span className="bg-blue-900/40 text-blue-300 border-blue-500 rounded border px-2 py-0.5 text-xs whitespace-nowrap">
                            {study.clinicalPhase.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                        )}
                      </div>
                    ),
                    gridCol: 4,
                  },
                  {
                    key: 'modality',
                    content: modalities,
                    title: modalities,
                    gridCol: 3,
                  },
                  {
                    key: 'instances',
                    content: (
                      <>
                        <Icons.GroupLayers
                          className={classnames('mr-2 inline-flex w-4', {
                            'text-primary': isStudyExpanded,
                            'text-secondary-light': !isStudyExpanded,
                          })}
                        />
                        {instances}
                      </>
                    ),
                    title: (instances || 0).toString(),
                    gridCol: 2,
                  },
                  {
                    key: 'removeButton',
                    content: (
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row expansion
                          if (window.confirm('Remove this study from the case?\n\nThe study will remain in Orthanc.')) {
                            if (caseService) {
                              caseService.removeStudy(caseItem.caseId, studyInstanceUid)
                                .then(() => {
                                  console.log(`✅ Study removed from case`);
                                  window.location.reload();
                                })
                                .catch(err => {
                                  console.error('Failed to remove study:', err);
                                  alert('Failed to remove study');
                                });
                            }
                          }
                        }}
                        className="hover:bg-red-900/50 rounded p-1 transition-colors"
                        title="Remove from Case"
                      >
                        <Icons.Close className="h-4 w-4 text-red-400 hover:text-red-300" />
                      </button>
                    ),
                    gridCol: 1,
                  },
                ],
                expandedContent: (
                  <StudyListExpandedRow
                    seriesTableColumns={{
                      description: t('StudyList:Description'),
                      seriesNumber: t('StudyList:Series'),
                      modality: t('StudyList:Modality'),
                      instances: t('StudyList:Instances'),
                    }}
                    seriesTableDataSource={
                      seriesInStudiesMap.has(studyInstanceUid)
                        ? seriesInStudiesMap.get(studyInstanceUid).map(s => {
                            return {
                              description: s.description || '(empty)',
                              seriesNumber: s.seriesNumber ?? '',
                              modality: s.modality || '',
                              instances: s.numSeriesInstances || '',
                            };
                          })
                        : []
                    }
                  >
                    {/* Series Management - Compact Version */}
                    {(() => {
                      // Get caseStudy from caseStudies map (fetched from API)
                      const studiesInCase = caseStudies.get(caseItem.caseId) || [];
                      const caseStudy = studiesInCase.find(s => s.studyInstanceUID === studyInstanceUid);

                      return caseStudy && caseStudy.series && caseStudy.series.length > 0 && (
                        <div className="mb-3 rounded border border-gray-700 bg-gray-900/30 p-2">
                          <div className="mb-1 flex items-center justify-between">
                            <h5 className="text-xs font-semibold text-gray-300">
                              Series: {caseStudy.series.filter(s => s.isEnrolled).length}/{caseStudy.series.length} enrolled
                            </h5>
                          </div>
                          <div className="space-y-1">
                            {caseStudy.series.map(series => (
                              <div
                                key={series.seriesInstanceUID}
                                className="flex items-center gap-2 rounded bg-gray-800/40 px-2 py-1 text-xs"
                              >
                                <input
                                  type="checkbox"
                                  checked={series.isEnrolled}
                                  onChange={async (e) => {
                                    if (caseService) {
                                      try {
                                        await caseService.toggleSeriesEnrollment(
                                          caseItem.caseId,
                                          studyInstanceUid,
                                          series.seriesInstanceUID,
                                          e.target.checked
                                        );
                                        window.location.reload();
                                      } catch (err) {
                                        console.error('Failed to toggle series:', err);
                                      }
                                    }
                                  }}
                                  className="h-3 w-3"
                                />
                                <span className="text-blue-400">#{series.seriesNumber}</span>
                                <span className="text-gray-400">{series.modality}</span>
                                <span className="flex-1 text-white">{series.description || '(no description)'}</span>
                                <span className="text-gray-500">{series.instanceCount} img</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    <div className="flex flex-row gap-2">
                      {(appConfig.groupEnabledModesFirst
                        ? appConfig.loadedModes.sort((a, b) => {
                            const isValidA = a.isValidMode({
                              modalities: modalities.replaceAll('/', '\\'),
                              study: fullStudy,
                            }).valid;
                            const isValidB = b.isValidMode({
                              modalities: modalities.replaceAll('/', '\\'),
                              study: fullStudy,
                            }).valid;

                            return isValidB - isValidA;
                          })
                        : appConfig.loadedModes
                      ).map((mode, i) => {
                        if (mode.hide) {
                          return null;
                        }
                        const modalitiesToCheck = modalities.replaceAll('/', '\\');

                        const { valid: isValidMode, description: invalidModeDescription } = mode.isValidMode({
                          modalities: modalitiesToCheck,
                          study: fullStudy,
                        });
                        if (isValidMode === null) {
                          return null;
                        }

                        const query = new URLSearchParams();
                        if (filterValues.configUrl) {
                          query.append('configUrl', filterValues.configUrl);
                        }
                        query.append('StudyInstanceUIDs', studyInstanceUid);

                        // Add caseId if available (case-centric view)
                        if (caseItem && caseItem.caseId) {
                          query.append('caseId', caseItem.caseId);
                        }

                        preserveQueryParameters(query);

                        return (
                          mode.displayName && (
                            <Link
                              className={isValidMode ? '' : 'cursor-not-allowed'}
                              key={i}
                              to={`${mode.routeName}${dataPath || ''}?${query.toString()}`}
                              onClick={event => {
                                if (!isValidMode) {
                                  event.preventDefault();
                                }
                              }}
                            >
                              <Button
                                type={ButtonEnums.type.primary}
                                size={ButtonEnums.size.smallTall}
                                disabled={!isValidMode}
                                startIconTooltip={
                                  !isValidMode ? (
                                    <div className="font-inter flex w-[206px] whitespace-normal text-left text-xs font-normal text-white">
                                      {invalidModeDescription}
                                    </div>
                                  ) : null
                                }
                                startIcon={
                                  isValidMode ? (
                                    <Icons.LaunchArrow className="!h-[20px] !w-[20px] text-black" />
                                  ) : (
                                    <Icons.LaunchInfo className="!h-[20px] !w-[20px] text-black" />
                                  )
                                }
                                onClick={() => {}}
                                dataCY={`mode-${mode.routeName}-${studyInstanceUid}`}
                                className={!isValidMode ? 'bg-[#222d44]' : ''}
                              >
                                {mode.displayName}
                              </Button>
                            </Link>
                          )
                        );
                      })}
                    </div>
                  </StudyListExpandedRow>
                ),
                onClickRow: () =>
                  setExpandedRows(s => (isStudyExpanded ? s.filter(n => studyRowKey !== n) : [...s, studyRowKey])),
                isExpanded: isStudyExpanded,
                isStudyRow: true,
              });
            }
          });
        }
      });
    } else {
      // Study-centric view (original behavior) or fallback when no cases
      const rollingPageNumberMod = Math.floor(101 / resultsPerPage);
      const rollingPageNumber = (pageNumber - 1) % rollingPageNumberMod;
      const offset = resultsPerPage * rollingPageNumber;
      const offsetAndTake = offset + resultsPerPage;

      filteredStudies.slice(offset, offsetAndTake).forEach((study, key) => {
        const rowKey = key + 1;
        const isExpanded = expandedRows.some(k => k === rowKey);
        const {
          studyInstanceUid,
          accession,
          modalities,
          instances,
          description,
          mrn,
          patientName,
          date,
          time,
        } = study;
        const studyDate =
          date &&
          moment(date, ['YYYYMMDD', 'YYYY.MM.DD'], true).isValid() &&
          moment(date, ['YYYYMMDD', 'YYYY.MM.DD']).format(t('Common:localDateFormat', 'MMM-DD-YYYY'));
        const studyTime =
          time &&
          moment(time, ['HH', 'HHmm', 'HHmmss', 'HHmmss.SSS']).isValid() &&
          moment(time, ['HH', 'HHmm', 'HHmmss', 'HHmmss.SSS']).format(
            t('Common:localTimeFormat', 'hh:mm A')
          );

        const makeCopyTooltipCell = textValue => {
          if (!textValue) {
            return '';
          }
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-pointer truncate">{textValue}</span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="flex items-center justify-between gap-2">
                  {textValue}
                  <Clipboard>{textValue}</Clipboard>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        };

        // Get clinical phase if study is in active case
        const studyInfo = activeCaseId && activeCase ?
          activeCase.studies.find(s => s.studyInstanceUID === studyInstanceUid) : null;
        const clinicalPhase = studyInfo?.clinicalPhase;

        rows.push({
          dataCY: `studyRow-${studyInstanceUid}`,
          clickableCY: studyInstanceUid,
          row: [
            {
              key: 'patientName',
              content: patientName ? makeCopyTooltipCell(patientName) : null,
              gridCol: 4,
            },
            {
              key: 'mrn',
              content: makeCopyTooltipCell(mrn),
              gridCol: 3,
            },
            {
              key: 'studyDate',
              content: (
                <>
                  {studyDate && <span className="mr-4">{studyDate}</span>}
                  {studyTime && <span>{studyTime}</span>}
                </>
              ),
              title: `${studyDate || ''} ${studyTime || ''}`,
              gridCol: 5,
            },
            {
              key: 'description',
              content: (
                <div className="flex items-center gap-2">
                  {makeCopyTooltipCell(description)}
                  {clinicalPhase && (
                    <span className="bg-blue-900/40 text-blue-300 border-blue-500 rounded border px-2 py-0.5 text-xs whitespace-nowrap">
                      {clinicalPhase.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  )}
                </div>
              ),
              gridCol: 4,
            },
            {
              key: 'modality',
              content: modalities,
              title: modalities,
              gridCol: 3,
            },
            {
              key: 'accession',
              content: makeCopyTooltipCell(accession),
              gridCol: 3,
            },
            {
              key: 'instances',
              content: (
                <>
                  <Icons.GroupLayers
                    className={classnames('mr-2 inline-flex w-4', {
                      'text-primary': isExpanded,
                      'text-secondary-light': !isExpanded,
                    })}
                  />
                  {instances}
                </>
              ),
              title: (instances || 0).toString(),
              gridCol: 2,
            },
            {
              key: 'addToCase',
              content: (
                <div className="flex items-center justify-end gap-2">
                  {/* Show if study is already in the active case */}
                  {studyInfo ? (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <Icons.Checkmark className="h-4 w-4" />
                      In Case
                    </span>
                  ) : activeCaseId ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (caseService && activeCaseId) {
                          console.log(`📝 Adding study ${studyInstanceUid} to case ${activeCaseId}`);
                          // Prompt for clinical phase
                          const phase = window.prompt(
                            'Enter clinical phase:\n\n1. PreOperativePlanning\n2. IntraOperative\n3. PostOperative\n4. FollowUp\n\nEnter number (1-4):',
                            '1'
                          );

                          const phaseMap = {
                            '1': 'PreOperativePlanning',
                            '2': 'IntraOperative',
                            '3': 'PostOperative',
                            '4': 'FollowUp'
                          };

                          const clinicalPhase = phaseMap[phase] || 'PreOperativePlanning';
                          console.log(`📋 Clinical phase: ${clinicalPhase}`);

                          caseService.enrollStudy(activeCaseId, studyInstanceUid, clinicalPhase)
                            .then(() => {
                              console.log(`✅ Study added to case ${activeCaseId}`);
                              window.location.reload();
                            })
                            .catch(err => {
                              console.error('❌ Failed to add study to case:', err);
                              alert('Failed to add study to case: ' + err.message);
                            });
                        }
                      }}
                      className="hover:bg-blue-900/50 flex items-center gap-1 rounded border border-blue-500/30 bg-blue-900/20 px-2 py-1 transition-colors"
                      title="Add to Case"
                    >
                      <Icons.Add className="h-4 w-4 text-blue-400" />
                      <span className="text-xs text-blue-300">Add</span>
                    </button>
                  ) : (
                    <span className="text-xs text-gray-500">Select case first</span>
                  )}
                </div>
              ),
              gridCol: 2,
            },
          ],
          expandedContent: (
            <StudyListExpandedRow
              seriesTableColumns={{
                description: t('StudyList:Description'),
                seriesNumber: t('StudyList:Series'),
                modality: t('StudyList:Modality'),
                instances: t('StudyList:Instances'),
              }}
              seriesTableDataSource={
                seriesInStudiesMap.has(studyInstanceUid)
                  ? seriesInStudiesMap.get(studyInstanceUid).map(s => {
                      return {
                        description: s.description || '(empty)',
                        seriesNumber: s.seriesNumber ?? '',
                        modality: s.modality || '',
                        instances: s.numSeriesInstances || '',
                      };
                    })
                  : []
              }
            >
              <div className="flex flex-row gap-2">
                {(appConfig.groupEnabledModesFirst
                  ? appConfig.loadedModes.sort((a, b) => {
                      const isValidA = a.isValidMode({
                        modalities: modalities.replaceAll('/', '\\'),
                        study,
                      }).valid;
                      const isValidB = b.isValidMode({
                        modalities: modalities.replaceAll('/', '\\'),
                        study,
                      }).valid;

                      return isValidB - isValidA;
                    })
                  : appConfig.loadedModes
                ).map((mode, i) => {
                  if (mode.hide) {
                    return null;
                  }
                  const modalitiesToCheck = modalities.replaceAll('/', '\\');

                  const { valid: isValidMode, description: invalidModeDescription } = mode.isValidMode({
                    modalities: modalitiesToCheck,
                    study,
                  });
                  if (isValidMode === null) {
                    return null;
                  }

                  const query = new URLSearchParams();
                  if (filterValues.configUrl) {
                    query.append('configUrl', filterValues.configUrl);
                  }
                  query.append('StudyInstanceUIDs', studyInstanceUid);

                  // Add caseId if there's an active case selected (study-centric view)
                  if (activeCaseId) {
                    query.append('caseId', activeCaseId);
                  }

                  preserveQueryParameters(query);

                  return (
                    mode.displayName && (
                      <Link
                        className={isValidMode ? '' : 'cursor-not-allowed'}
                        key={i}
                        to={`${mode.routeName}${dataPath || ''}?${query.toString()}`}
                        onClick={event => {
                          if (!isValidMode) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <Button
                          type={ButtonEnums.type.primary}
                          size={ButtonEnums.size.smallTall}
                          disabled={!isValidMode}
                          startIconTooltip={
                            !isValidMode ? (
                              <div className="font-inter flex w-[206px] whitespace-normal text-left text-xs font-normal text-white">
                                {invalidModeDescription}
                              </div>
                            ) : null
                          }
                          startIcon={
                            isValidMode ? (
                              <Icons.LaunchArrow className="!h-[20px] !w-[20px] text-black" />
                            ) : (
                              <Icons.LaunchInfo className="!h-[20px] !w-[20px] text-black" />
                            )
                          }
                          onClick={() => {}}
                          dataCY={`mode-${mode.routeName}-${studyInstanceUid}`}
                          className={!isValidMode && 'bg-[#222d44]'}
                        >
                          {mode.displayName}
                        </Button>
                      </Link>
                    )
                  );
                })}
              </div>
            </StudyListExpandedRow>
          ),
          onClickRow: () =>
            setExpandedRows(s => (isExpanded ? s.filter(n => rowKey !== n) : [...s, rowKey])),
          isExpanded,
        });
      });
    }

    return rows;
  };

  const tableDataSource = createTableDataSource();

  // Calculate pagination offset
  const rollingPageNumberMod = Math.floor(101 / resultsPerPage);
  const rollingPageNumber = (pageNumber - 1) % rollingPageNumberMod;
  const offset = resultsPerPage * rollingPageNumber;
  const offsetAndTake = offset + resultsPerPage;

  // In cases view, we don't slice because we're showing hierarchical data
  // In studies view, we slice for pagination
  const paginatedTableData = viewMode === 'cases'
    ? tableDataSource
    : tableDataSource.slice(offset, offsetAndTake);

  const hasStudies = numOfStudies > 0;

  const AboutModal = customizationService.getCustomization(
    'ohif.aboutModal'
  ) as coreTypes.MenuComponentCustomization;
  const UserPreferencesModal = customizationService.getCustomization(
    'ohif.userPreferencesModal'
  ) as coreTypes.MenuComponentCustomization;

  const menuOptions = [
    {
      title: AboutModal?.menuTitle ?? t('Header:About'),
      icon: 'info',
      onClick: () =>
        show({
          content: AboutModal,
          title: AboutModal?.title ?? t('AboutModal:About OHIF Viewer'),
          containerClassName: AboutModal?.containerClassName ?? 'max-w-md',
        }),
    },
    {
      title: UserPreferencesModal.menuTitle ?? t('Header:Preferences'),
      icon: 'settings',
      onClick: () =>
        show({
          content: UserPreferencesModal as React.ComponentType,
          title: UserPreferencesModal.title ?? t('UserPreferencesModal:User preferences'),
          containerClassName:
            UserPreferencesModal?.containerClassName ?? 'flex max-w-4xl p-6 flex-col',
        }),
    },
  ];

  if (appConfig.oidc) {
    menuOptions.push({
      icon: 'power-off',
      title: t('Header:Logout'),
      onClick: () => {
        navigate(`/logout?redirect_uri=${encodeURIComponent(window.location.href)}`);
      },
    });
  }

  const LoadingIndicatorProgress = customizationService.getCustomization(
    'ui.loadingIndicatorProgress'
  );
  const DicomUploadComponent = customizationService.getCustomization('dicomUploadComponent');

  const uploadProps =
    DicomUploadComponent && dataSource.getConfig()?.dicomUploadEnabled
      ? {
          title: 'Upload files',
          closeButton: true,
          shouldCloseOnEsc: false,
          shouldCloseOnOverlayClick: false,
          content: () => (
            <DicomUploadComponent
              dataSource={dataSource}
              onComplete={() => {
                hide();
                onRefresh();
              }}
              onStarted={() => {
                show({
                  ...uploadProps,
                  // when upload starts, hide the default close button as closing the dialogue must be handled by the upload dialogue itself
                  closeButton: false,
                });
              }}
            />
          ),
        }
      : undefined;

  const dataSourceConfigurationComponent = customizationService.getCustomization(
    'ohif.dataSourceConfigurationComponent'
  );

  return (
    <div className="flex h-screen flex-col bg-black">
      <Header
        isSticky
        menuOptions={menuOptions}
        isReturnEnabled={false}
        WhiteLabeling={appConfig.whiteLabeling}
        showPatientInfo={PatientInfoVisibility.DISABLED}
        Secondary={<WorkListCaseSelector servicesManager={servicesManager} viewMode={viewMode} setViewMode={setViewMode} cases={cases} loadingCases={loadingCases} />}
      />
      <ApiConfigPanel servicesManager={servicesManager} />
      <Onboarding />
      <InvestigationalUseDialog dialogConfiguration={appConfig?.investigationalUseDialog} />
      <EditCaseDialog
        isOpen={isEditDialogOpen}
        caseData={selectedCase}
        onClose={() => setIsEditDialogOpen(false)}
        onUpdate={handleUpdateCase}
      />
      <div className="flex h-full flex-col overflow-y-auto">
        <ScrollArea>
          <div className="flex grow flex-col">
            <StudyListFilter
              numOfStudies={pageNumber * resultsPerPage > 100 ? 101 : numOfStudies}
              filtersMeta={filtersMeta}
              filterValues={{ ...filterValues, ...defaultSortValues }}
              onChange={setFilterValues}
              clearFilters={() => setFilterValues(defaultFilterValues)}
              isFiltering={isFiltering(filterValues, defaultFilterValues)}
              onUploadClick={uploadProps ? () => show(uploadProps) : undefined}
              getDataSourceConfigurationComponent={
                dataSourceConfigurationComponent
                  ? () => dataSourceConfigurationComponent()
                  : undefined
              }
            />
          </div>
          {activeCaseId && activeCase && (
            <div className="bg-blue-900/20 border-blue-500 text-blue-300 mx-4 mb-2 flex items-center justify-between rounded border p-3">
              <div className="flex items-center gap-3">
                <Icons.Info className="h-5 w-5" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    Filtering studies for case: {activeCase.caseId}
                  </span>
                  <span className="text-xs opacity-80">
                    Patient: {activeCase?.patientInfo?.name || activeCase?.patientInfo?.mrn || 'Unknown'} • {activeCase?.studies?.length || 0} enrolled {(activeCase?.studies?.length || 0) === 1 ? 'study' : 'studies'}
                  </span>
                </div>
              </div>
              <ButtonNext
                variant="ghost"
                size="sm"
                onClick={() => caseService.setActiveCaseId(null)}
                className="hover:bg-blue-800"
              >
                <Icons.Close className="mr-1 h-4 w-4" />
                Clear Filter
              </ButtonNext>
            </div>
          )}
          {hasStudies ? (
            <div className="flex grow flex-col">
              <StudyListTable
                tableDataSource={paginatedTableData}
                numOfStudies={numOfStudies}
                querying={querying}
                filtersMeta={filtersMeta}
              />
              <div className="grow">
                <StudyListPagination
                  onChangePage={onPageNumberChange}
                  onChangePerPage={onResultsPerPageChange}
                  currentPage={pageNumber}
                  perPage={resultsPerPage}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center pt-48">
              {appConfig.showLoadingIndicator && isLoadingData ? (
                <LoadingIndicatorProgress className={'h-full w-full bg-black'} />
              ) : (
                <EmptyStudies />
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Add Study Modal */}
      {showAddStudyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setShowAddStudyModal(false)}
        >
          <div
            className="bg-primary-dark relative max-h-[80vh] w-[90vw] max-w-4xl overflow-hidden rounded-lg border border-gray-700 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="border-secondary-light flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-xl font-bold text-white">
                Add Study to Case: {addStudyToCaseId}
              </h2>
              <button
                onClick={() => setShowAddStudyModal(false)}
                className="hover:bg-secondary-dark rounded p-2 transition-colors"
              >
                <Icons.Close className="h-5 w-5 text-white" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="max-h-[60vh] overflow-y-auto p-6">
              {loadingOrthancStudies ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="mb-4 text-white">Loading studies from Orthanc...</div>
                    <div className="text-gray-400">Please wait</div>
                  </div>
                </div>
              ) : orthancStudies.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  No studies found in Orthanc
                </div>
              ) : (
                <div className="space-y-2">
                  {orthancStudies.map((study) => (
                    <div
                      key={study.studyInstanceUID}
                      className={classnames(
                        'hover:bg-secondary-dark flex items-center justify-between rounded border p-4 transition-colors',
                        {
                          'border-yellow-500/50 bg-yellow-900/20': study.hasCaseId,
                          'border-gray-700 bg-secondary-main cursor-pointer': !study.hasCaseId,
                        }
                      )}
                      onClick={async () => {
                        if (study.hasCaseId) {
                          const confirmAdd = window.confirm(
                            `⚠️ WARNING: This study is already assigned to case "${study.existingCaseId}".\n\nDo you want to add it to "${addStudyToCaseId}" anyway?`
                          );
                          if (!confirmAdd) return;
                        }

                        // Prompt for clinical phase
                        const phase = window.prompt(
                          'Enter clinical phase:\n\n1. PreOperativePlanning\n2. IntraOperative\n3. PostOperative\n4. FollowUp\n\nEnter number (1-4):',
                          '1'
                        );

                        const phaseMap = {
                          '1': 'PreOperativePlanning',
                          '2': 'IntraOperative',
                          '3': 'PostOperative',
                          '4': 'FollowUp',
                        };

                        const clinicalPhase = phaseMap[phase] || 'PreOperativePlanning';

                        try {
                          if (caseService && addStudyToCaseId) {
                            await caseService.enrollStudy(
                              addStudyToCaseId,
                              study.studyInstanceUID,
                              clinicalPhase,
                              {
                                studyDate: study.studyDate,
                                modalities: study.modalities,
                                description: study.studyDescription
                              }
                            );
                            console.log(`✅ Study added to case ${addStudyToCaseId}`);
                            setShowAddStudyModal(false);
                            window.location.reload();
                          }
                        } catch (err) {
                          console.error('Failed to add study:', err);
                          alert('Failed to add study to case: ' + err.message);
                        }
                      }}
                    >
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="font-semibold text-white">
                            {study.patientName || 'Unknown'}
                          </span>
                          {study.hasCaseId && (
                            <span className="rounded border border-yellow-500 bg-yellow-900/40 px-2 py-0.5 text-xs text-yellow-300">
                              ⚠️ Case: {study.existingCaseId}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400">
                          <span className="mr-4">MRN: {study.patientId || 'N/A'}</span>
                          <span className="mr-4">Date: {study.studyDate || 'N/A'}</span>
                          <span className="mr-4">Modality: {study.modalities || 'N/A'}</span>
                          <span>Series: {study.seriesCount}</span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {study.studyDescription || 'No description'}
                        </div>
                      </div>
                      <div>
                        {study.hasCaseId ? (
                          <span className="text-xs text-yellow-400">Click to override</span>
                        ) : (
                          <Icons.Add className="h-6 w-6 text-green-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-secondary-light border-t px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  {orthancStudies.length} studies available
                  {orthancStudies.filter((s) => s.hasCaseId).length > 0 && (
                    <span className="ml-2 text-yellow-400">
                      ({orthancStudies.filter((s) => s.hasCaseId).length} already assigned)
                    </span>
                  )}
                </div>
                <Button
                  onClick={() => setShowAddStudyModal(false)}
                  size="small"
                  className="bg-secondary-dark hover:bg-secondary-light"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

WorkList.propTypes = {
  data: PropTypes.array.isRequired,
  dataSource: PropTypes.shape({
    query: PropTypes.object.isRequired,
    getConfig: PropTypes.func,
  }).isRequired,
  isLoadingData: PropTypes.bool.isRequired,
  servicesManager: PropTypes.object.isRequired,
};

const defaultFilterValues = {
  patientName: '',
  mrn: '',
  studyDate: {
    startDate: null,
    endDate: null,
  },
  description: '',
  modalities: [],
  accession: '',
  sortBy: '',
  sortDirection: 'none',
  pageNumber: 1,
  resultsPerPage: 25,
  datasources: '',
};

function _tryParseInt(str, defaultValue) {
  let retValue = defaultValue;
  if (str && str.length > 0) {
    if (!isNaN(str)) {
      retValue = parseInt(str);
    }
  }
  return retValue;
}

function _getQueryFilterValues(params) {
  const newParams = new URLSearchParams();
  for (const [key, value] of params) {
    newParams.set(key.toLowerCase(), value);
  }
  params = newParams;

  const queryFilterValues = {
    patientName: params.get('patientname'),
    mrn: params.get('mrn'),
    studyDate: {
      startDate: params.get('startdate') || null,
      endDate: params.get('enddate') || null,
    },
    description: params.get('description'),
    modalities: params.get('modalities') ? params.get('modalities').split(',') : [],
    accession: params.get('accession'),
    sortBy: params.get('sortby'),
    sortDirection: params.get('sortdirection'),
    pageNumber: _tryParseInt(params.get('pagenumber'), undefined),
    resultsPerPage: _tryParseInt(params.get('resultsperpage'), undefined),
    datasources: params.get('datasources'),
    configUrl: params.get('configurl'),
  };

  // Delete null/undefined keys
  Object.keys(queryFilterValues).forEach(
    key => queryFilterValues[key] == null && delete queryFilterValues[key]
  );

  return queryFilterValues;
}

function _sortStringDates(s1, s2, sortModifier) {
  // TODO: Delimiters are non-standard. Should we support them?
  const s1Date = moment(s1.date, ['YYYYMMDD', 'YYYY.MM.DD'], true);
  const s2Date = moment(s2.date, ['YYYYMMDD', 'YYYY.MM.DD'], true);

  if (s1Date.isValid() && s2Date.isValid()) {
    return (s1Date.toISOString() > s2Date.toISOString() ? 1 : -1) * sortModifier;
  } else if (s1Date.isValid()) {
    return sortModifier;
  } else if (s2Date.isValid()) {
    return -1 * sortModifier;
  }
}

export default WorkList;
