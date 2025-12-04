import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

import {
  EditCaseDialog,
  CreateCaseDialog,
} from '@ohif/extension-lifesync/src/components/CaseManagement';

import { CLINICAL_PHASE_LABELS } from '@ohif/extension-default/src/services/CaseService';

import { Types } from '@ohif/ui';

import { preserveQueryParameters, preserveQueryStrings } from '../../utils/preserveQueryParameters';

// Simplified Case Selector for WorkList
const WorkListCaseSelector = ({
  servicesManager,
  viewMode,
  setViewMode,
  cases,
  loadingCases,
  onCaseCreated,
}) => {
  const [localCases, setLocalCases] = React.useState([]);
  const [activeCaseId, setActiveCaseId] = React.useState(null);
  // const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const caseService = servicesManager?.services?.caseService;

  const loadCases = async () => {
    if (!caseService) {
      return;
    }
    try {
      const fetchedCases = await caseService.getCases();
      setLocalCases(fetchedCases);
    } catch (err) {
      console.warn('Failed to load cases:', err);
    }
  };

  React.useEffect(() => {
    if (!caseService) {
      return;
    }

    loadCases();
    const initialCaseId = caseService.getActiveCaseId();
    setActiveCaseId(initialCaseId);

    const unsubscribe = caseService.subscribe(
      caseService.constructor.EVENTS.ACTIVE_CASE_CHANGED,
      ({ caseId }) => setActiveCaseId(caseId)
    );

    return () => unsubscribe?.unsubscribe();
  }, [caseService]);

  // const handleCreateCase = async patientInfo => {
  //   if (!caseService) {
  //     return null;
  //   }

  //   // Call caseService.createCase with just patientInfo
  //   // API will auto-generate case ID
  //   const newCase = await caseService.createCase(patientInfo);

  //   // Optimistically update local state
  //   setLocalCases(prev => {
  //     const exists = prev.some(c => c.caseId === newCase.caseId);
  //     return exists
  //       ? prev.map(c => (c.caseId === newCase.caseId ? newCase : c))
  //       : [...prev, newCase];
  //   });

  //   // Notify parent so it can keep its list in sync
  //   onCaseCreated?.(newCase);

  //   caseService.setActiveCaseId(newCase.caseId);
  //   await loadCases(); // Reload cases to ensure canonical ordering/counts

  //   return newCase; // Return the created case for success message
  // };

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
          <div className="border-primary-light flex rounded border">
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
              onChange={e => caseService.setActiveCaseId(e.target.value || null)}
              className="bg-primary-dark hover:bg-primary text-primary-active border-primary-light min-w-[200px] rounded border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No Case Selected (View All Studies)</option>
              {displayCases.map(caseItem => (
                <option
                  key={caseItem.caseId}
                  value={caseItem.caseId}
                >
                  {caseItem.caseName || caseItem.caseId} -{' '}
                  {caseItem.patientName ||
                    caseItem?.patientInfo?.name ||
                    caseItem.patientMRN ||
                    caseItem.mrn ||
                    'Unknown'}
                </option>
              ))}
            </select>
            {activeCase && (
              <span className="text-primary-light text-xs">
                ({activeCase?.studyCount || 0} studies)
              </span>
            )}
          </>
        )}

        {/* Create Case Button */}
        {/* <ButtonNext
          size="sm"
          onClick={() => setIsCreateDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Icons.Add className="mr-1 h-4 w-4" />
          Create Case
        </ButtonNext> */}

        {/* Loading indicator for cases */}
        {loadingCases && <span className="text-primary-light text-xs">Loading cases...</span>}
      </div>

      {/* <CreateCaseDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreateCase={handleCreateCase}
        servicesManager={servicesManager}
      /> */}
    </>
  );
};

// API Configuration Panel
const ApiConfigPanel = ({ servicesManager }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [apiUrl, setApiUrl] = React.useState('');
  const [tempUrl, setTempUrl] = React.useState('');
  const [connectionStatus, setConnectionStatus] = React.useState({
    case: false,
    registration: false,
  });

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
          <span className="text-primary-light text-sm font-medium">
            SyncForge API Configuration
          </span>
          <div className="ml-3 flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${connectionStatus.case ? 'bg-green-500' : 'bg-red-500'}`}
              title="Case Management API"
            />
            <span className="text-xs text-gray-400">{apiUrl}</span>
          </div>
        </div>
        <Icons.ChevronDown
          className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {isExpanded && (
        <div className="border-secondary-light space-y-3 border-t px-4 py-3">
          <div className="space-y-2">
            <label className="text-primary-light text-xs font-medium">
              API URL (for ngrok or remote access)
            </label>
            <input
              type="text"
              value={tempUrl}
              onChange={e => setTempUrl(e.target.value)}
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

          <div className="space-y-1 text-xs text-gray-400">
            <p>
              <strong>Local Development:</strong>
            </p>
            <p className="pl-4">• Default: http://localhost:3001 (direct API access)</p>
            <p className="pl-4">• With nginx: http://localhost:8080/api (proxied, more secure)</p>
            <p>
              <strong>Remote Access (Recommended - nginx):</strong>
            </p>
            <p className="pl-4">
              1. Run: <code className="rounded bg-gray-800 px-1">ngrok http 8080</code>
            </p>
            <p className="pl-4">2. Leave this field at default (API auto-routed via nginx)</p>
            <p className="pl-4">3. Access OHIF via ngrok URL - API included automatically</p>
            <p>
              <strong>Remote Access (Legacy - direct):</strong>
            </p>
            <p className="pl-4">
              1. Run: <code className="rounded bg-gray-800 px-1">ngrok http 3001</code>
            </p>
            <p className="pl-4">2. Copy the HTTPS URL and paste above</p>
          </div>
        </div>
      )}
    </div>
  );
};

const PatientInfoVisibility = Types.PatientInfoVisibility;

const { sortBySeriesDate } = utils;

const seriesInStudiesMap = new Map();

// Map frontend filterValues to query parameters accepted by /api/cases/search
const buildCaseSearchParams = filters => {
  if (!filters) {
    console.warn('⚠️ buildCaseSearchParams: filters is null/undefined, using defaults');
    return { page: 1, limit: 100 };
  }

  // Convert date format to ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ)
  // Supports YYYYMMDD (8 digits) and YYYY-MM-DD (with hyphen) formats
  const convertDateToISO = dateStr => {
    if (!dateStr) {
      return undefined;
    }

    // Convert to string and trim whitespace
    const trimmed = String(dateStr).trim();

    // If empty string, return undefined
    if (trimmed.length === 0) {
      return undefined;
    }

    let year, month, day;

    // Handle YYYY-MM-DD format (with hyphen)
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-');
      if (parts.length !== 3) {
        console.warn('⚠️ Invalid date format with dashes, expected YYYY-MM-DD, got:', dateStr);
        return undefined;
      }
      year = parts[0].trim();
      month = parts[1].trim();
      day = parts[2].trim();

      // Check if each part is complete
      if (year.length !== 4 || month.length !== 2 || day.length !== 2) {
        console.warn('⚠️ Incomplete date parts:', { year, month, day, original: dateStr });
        return undefined;
      }
    }
    // Handle YYYYMMDD format (8 digits)
    else if (trimmed.length === 8 && /^\d{8}$/.test(trimmed)) {
      year = trimmed.substring(0, 4);
      month = trimmed.substring(4, 6);
      day = trimmed.substring(6, 8);
    }
    // Other formats are not supported
    else {
      console.warn('⚠️ Invalid date format, expected YYYYMMDD or YYYY-MM-DD, got:', dateStr);
      return undefined;
    }

    // Validate year (must be 4 digits, and year must be reasonable)
    if (!/^\d{4}$/.test(year)) {
      console.warn('⚠️ Invalid year format:', year);
      return undefined;
    }
    const yearNum = parseInt(year, 10);
    if (yearNum < 1900 || yearNum > 2100) {
      console.warn('⚠️ Year out of reasonable range:', yearNum);
      return undefined;
    }

    // Validate month and date ranges
    if (!/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) {
      console.warn('⚠️ Invalid month or day format:', { month, day });
      return undefined;
    }

    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
      console.warn('⚠️ Invalid date range:', { year, month, day });
      return undefined;
    }

    return `${year}-${month}-${day}T00:00:00Z`;
  };

  const params = {
    // Patient name: corresponds to ?patientName=, filter empty strings
    patientName:
      filters.patientName && filters.patientName.trim() ? filters.patientName.trim() : undefined,

    // Case number / MRN: you use 'mrn' in filtersMeta, filter empty strings
    patientMRN: filters.mrn && filters.mrn.trim() ? filters.mrn.trim() : undefined,

    // Status (if you add status field later)
    status: filters.status && filters.status.trim() ? filters.status.trim() : undefined,

    // Check date range: DateRange component returns { startDate, endDate } format (YYYYMMDD)
    // Need to convert to ISO 8601 format for backend API
    // Ensure date values are valid and not empty strings
    createdAfter:
      filters.studyDate?.startDate &&
      filters.studyDate.startDate !== null &&
      filters.studyDate.startDate !== '' &&
      String(filters.studyDate.startDate).trim().length > 0
        ? convertDateToISO(String(filters.studyDate.startDate))
        : undefined,
    createdBefore:
      filters.studyDate?.endDate &&
      filters.studyDate.endDate !== null &&
      filters.studyDate.endDate !== '' &&
      String(filters.studyDate.endDate).trim().length > 0
        ? convertDateToISO(String(filters.studyDate.endDate))
        : undefined,

    // Pagination: ensure valid pagination parameters are always passed, use defaults if not provided
    // This ensures correct pagination results even without query conditions
    page: filters.pageNumber && filters.pageNumber > 0 ? filters.pageNumber : 1,
    limit: filters.resultsPerPage && filters.resultsPerPage > 0 ? filters.resultsPerPage : 100, // Default to return more results if no query conditions

    // Whether to include studies (if UI adds a toggle later)
    includeStudies: filters.includeStudies || undefined,
  };

  // Remove all undefined, null and empty string values (but keep pagination parameters)
  Object.keys(params).forEach(key => {
    const value = params[key];
    if (value === undefined || value === null || value === '') {
      // Keep pagination parameters even if they might be default values
      if (key !== 'page' && key !== 'limit') {
        delete params[key];
      }
    }
  });

  console.log('🔧 buildCaseSearchParams:', {
    inputFilters: filters,
    outputParams: params,
    hasSearchFilters: Object.keys(params).some(k => k !== 'page' && k !== 'limit'),
  });

  return params;
};

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
  const [casePagination, setCasePagination] = useState(null); // Pagination info from API

  // ~ Create Case Dialog State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // ~ Edit Case Dialog State
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);

  // ~ Filters
  const searchParams = useSearchParams();
  const navigate = useNavigate();
  const STUDIES_LIMIT = 101;
  const queryFilterValues = _getQueryFilterValues(searchParams);

  // Check if there are valid query parameters (exclude empty values)
  const hasValidQueryParams = Object.keys(queryFilterValues).some(key => {
    const value = queryFilterValues[key];
    if (value === null || value === undefined || value === '') {
      return false;
    }
    // Check date objects: both startDate and endDate must be valid
    if (typeof value === 'object' && value.startDate === null && value.endDate === null) {
      return false;
    }
    // Check date objects: if startDate or endDate is empty string, it's not valid either
    if (typeof value === 'object' && value.startDate !== undefined && value.endDate !== undefined) {
      const hasValidStartDate =
        value.startDate !== null &&
        value.startDate !== '' &&
        String(value.startDate).trim().length >= 8;
      const hasValidEndDate =
        value.endDate !== null && value.endDate !== '' && String(value.endDate).trim().length >= 8;
      if (!hasValidStartDate && !hasValidEndDate) {
        return false;
      }
    }
    if (Array.isArray(value) && value.length === 0) {
      return false;
    }
    return true;
  });

  // Clean invalid query values (especially date fields)
  const cleanQueryFilterValues = values => {
    if (!values || typeof values !== 'object') {
      return defaultFilterValues;
    }

    const cleaned = { ...values };

    // Clean date fields: ensure startDate and endDate are either valid date strings or null
    if (cleaned.studyDate && typeof cleaned.studyDate === 'object') {
      const isValidDateString = dateStr => {
        if (!dateStr || dateStr === null || dateStr === '') {
          return false;
        }
        const str = String(dateStr).trim();
        if (str.length < 8) {
          return false;
        }
        // Check if it's YYYYMMDD format (8 digits)
        if (/^\d{8}$/.test(str)) {
          return true;
        }
        // Check if it's YYYY-MM-DD format (with hyphen)
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
          return true;
        }
        return false;
      };

      cleaned.studyDate = {
        startDate: isValidDateString(cleaned.studyDate.startDate)
          ? cleaned.studyDate.startDate
          : null,
        endDate: isValidDateString(cleaned.studyDate.endDate) ? cleaned.studyDate.endDate : null,
      };

      // If both dates are invalid, set to null
      if (!cleaned.studyDate.startDate && !cleaned.studyDate.endDate) {
        cleaned.studyDate = { startDate: null, endDate: null };
      }
    }

    // Clean other empty string fields
    Object.keys(cleaned).forEach(key => {
      if (key !== 'studyDate' && (cleaned[key] === '' || cleaned[key] === null)) {
        cleaned[key] = defaultFilterValues[key] || null;
      }
    });

    return cleaned;
  };

  const [sessionQueryFilterValues, updateSessionQueryFilterValues] = useSessionStorage({
    key: 'queryFilterValues',
    // Only use if there are valid query parameters in URL, otherwise use default values
    defaultValue: hasValidQueryParams
      ? cleanQueryFilterValues(queryFilterValues)
      : defaultFilterValues,
    // ToDo: useSessionStorage currently uses an unload listener to clear the filters from session storage
    // so on systems that do not support unload events a user will NOT be able to alter any existing filter
    // in the URL, load the page and have it apply.
    clearOnUnload: true,
  });

  // Merge default values and sessionStorage values, but prioritize URL parameters (if any)
  // Also clean invalid values in sessionStorage
  const cleanedSessionValues = cleanQueryFilterValues(sessionQueryFilterValues);

  // Check if cleaned sessionStorage values are the same as default values
  const isSessionValuesSameAsDefault = Object.keys(defaultFilterValues).every(key => {
    if (key === 'studyDate') {
      return (
        cleanedSessionValues.studyDate?.startDate === defaultFilterValues.studyDate.startDate &&
        cleanedSessionValues.studyDate?.endDate === defaultFilterValues.studyDate.endDate
      );
    }
    return cleanedSessionValues[key] === defaultFilterValues[key];
  });

  // If there are no valid query parameters, and sessionStorage values are the same as defaults (or invalid), use defaults
  // This ensures that when refreshing the page, if there are no query parameters, all fields are empty
  const initialFilterValues = hasValidQueryParams
    ? { ...defaultFilterValues, ...cleanQueryFilterValues(queryFilterValues) }
    : isSessionValuesSameAsDefault
      ? defaultFilterValues
      : { ...defaultFilterValues, ...cleanedSessionValues };

  // Final check: if initial values are the same as defaults, ensure defaults are used
  const isSameAsDefault = Object.keys(defaultFilterValues).every(key => {
    if (key === 'studyDate') {
      return (
        initialFilterValues.studyDate?.startDate === defaultFilterValues.studyDate.startDate &&
        initialFilterValues.studyDate?.endDate === defaultFilterValues.studyDate.endDate
      );
    }
    return initialFilterValues[key] === defaultFilterValues[key];
  });

  const finalInitialFilterValues = isSameAsDefault ? defaultFilterValues : initialFilterValues;

  console.log('🔍 Initial filter values setup:', {
    hasValidQueryParams,
    isSessionValuesSameAsDefault,
    isSameAsDefault,
    queryFilterValues,
    cleanedSessionValues,
    finalInitialFilterValues,
  });

  const [filterValues, _setFilterValues] = useState(finalInitialFilterValues);

  // If there are invalid values in sessionStorage, clean them (only check on first load)
  useEffect(() => {
    // Check if there are invalid date values that need cleaning
    const hasInvalidDates =
      filterValues.studyDate?.startDate &&
      String(filterValues.studyDate.startDate).trim().length > 0 &&
      String(filterValues.studyDate.startDate).trim().length < 8;

    const hasInvalidEndDate =
      filterValues.studyDate?.endDate &&
      String(filterValues.studyDate.endDate).trim().length > 0 &&
      String(filterValues.studyDate.endDate).trim().length < 8;

    if (!hasValidQueryParams && (hasInvalidDates || hasInvalidEndDate)) {
      console.log('🧹 Cleaning invalid date values from filterValues:', {
        startDate: filterValues.studyDate?.startDate,
        endDate: filterValues.studyDate?.endDate,
      });
      const cleaned = { ...defaultFilterValues };
      _setFilterValues(cleaned);
      updateSessionQueryFilterValues(cleaned);
    }
  }, []); // Only execute once when component mounts

  const debouncedFilterValues = useDebounce(filterValues, 200);

  // Load cases for hierarchical view
  const loadCases = useCallback(async () => {
    if (!caseService) {
      console.warn('⚠️ CaseService not available');
      return;
    }

    setLoadingCases(true);
    try {
      // use current filter condition to search cases
      const currentFilters = debouncedFilterValues || filterValues;
      const searchParams = buildCaseSearchParams(currentFilters);

      console.log('📋 Loading cases with params:', {
        currentFilters,
        searchParams,
        hasCaseService: !!caseService,
      });

      const { cases: caseData, pagination } = await caseService.searchCases(searchParams);

      setCases(caseData || []);
      setCasePagination(pagination || null); // Save pagination info
    } catch (error) {
      console.error('❌ Failed to load cases:', error);
      setCases([]);
      setCasePagination(null); // Clear pagination on error
    } finally {
      setLoadingCases(false);
    }
  }, [caseService, debouncedFilterValues, filterValues]);

  useEffect(() => {
    // Reload Case list after filter conditions change
    loadCases();
  }, [loadCases]);
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
        return _sortStringDates(s1, s2, sortModifier);create
      }

      return 0;
    });
  }, [canSort, studies, shouldUseDefaultSort, sortBy, sortModifier]);

  const handleCreateCase = async patientInfo => {
    if (!caseService) {
      return null;
    }

    const newCase = await caseService.createCase(patientInfo);

    setCases(prev => {
      const exists = prev.some(c => c.caseId === newCase.caseId);
      return exists
        ? prev.map(c => (c.caseId === newCase.caseId ? newCase : c))
        : [...prev, newCase];
    });

    caseService.setActiveCaseId(newCase.caseId);

    return newCase;
  };

  // 🔧 FIX: Show ALL studies, not just those in active case
  // The active case is just for context/highlighting, not for filtering
  const filteredStudies = useMemo(() => {
    console.log(`📋 [WorkList] Showing ALL studies (${sortedStudies.length} total)`);
    if (activeCaseId) {
      console.log(`   ℹ️ Active case: ${activeCaseId} (for context only, not filtering)`);
    }
    // Always return all studies - don't filter by active case
    return sortedStudies;
  }, [sortedStudies, activeCaseId]);

  // ~ Rows & Studies
  const [expandedRows, setExpandedRows] = useState([]);
  const [studiesWithSeriesData, setStudiesWithSeriesData] = useState([]);
  const [seriesDataForCases, setSeriesDataForCases] = useState(new Map()); // Map<studyUID, seriesData>
  const numOfStudies = studiesTotal;
  const caseCount = cases?.length || 0;
  // In cases view mode, use pagination.totalCount to display total count; if no pagination, fallback to current page count
  const totalCaseCount = casePagination?.totalCount ?? caseCount;
  const displayedCount =
    viewMode === 'cases' ? totalCaseCount : pageNumber * resultsPerPage > 100 ? 101 : numOfStudies;

  // ~ Add Study Modal
  const [showAddStudyModal, setShowAddStudyModal] = useState(false);
  const [addStudyToCaseId, setAddStudyToCaseId] = useState(null);
  const [orthancStudies, setOrthancStudies] = useState([]);
  const [loadingOrthancStudies, setLoadingOrthancStudies] = useState(false);
  // add study modal state
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' or 'select'
  // upload method state
  const [uploadMethod, setUploadMethod] = useState('standard'); // 'standard' or 'custom'
  // const [autoEnroll, setAutoEnroll] = useState(false);
  // const [clinicalPhase, setClinicalPhase] = useState('PreOperativePlanning');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  // TODO: Search functionality temporarily commented, to be implemented later
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState('studyUID'); // 'studyUID' | 'patientName' | 'mrn' | 'studyDate'
  
  // Filter studies based on search query (placeholder - will implement later)
  const filteredOrthancStudies = useMemo(() => {
    if (!searchQuery.trim()) {
      return orthancStudies;
    }
    
    const query = searchQuery.toLowerCase().trim();
    
    return orthancStudies.filter(study => {
      switch (searchFilter) {
        case 'studyUID':
          return study.studyInstanceUID?.toLowerCase().includes(query);
        case 'patientName':
          return study.patientName?.toLowerCase().includes(query);
        case 'mrn':
          return study.patientId?.toLowerCase().includes(query);
        case 'studyDate':
          return study.studyDate?.includes(query);
        default:
          return true;
      }
    });
  }, [orthancStudies, searchQuery, searchFilter]);

  // Select Study dialog state
  const [selectedStudy, setSelectedStudy] = useState(null);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  
  // Clinical phase state - two different purposes
  const [clinicalPhase, setClinicalPhase] = useState('PreOperativePlanning'); // For upload file clinical phase
  const [selectedClinicalPhase, setSelectedClinicalPhase] = useState('PreOperativePlanning'); // For clinical phase after selecting study for enrollment
  
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState(null);

  // Temporarily use orthancStudies directly, no filtering
  // const filteredOrthancStudies = orthancStudies;

  const querying = useMemo(() => {
    return isLoadingData || expandedRows.length > 0;
  }, [isLoadingData, expandedRows]);

  // Load studies for a specific case (moved earlier, for use in handleCustomUpload)
  const loadStudiesForCase = useCallback(
    async caseId => {
      if (!caseService) {
        return;
      }

      try {
        const caseStudiesData = await caseService.getStudiesForCase(caseId);
        // Safe access with fallback to empty array
        setCaseStudies(prev => new Map(prev.set(caseId, caseStudiesData?.studies || [])));
      } catch (error) {
        console.warn(`Failed to load studies for case ${caseId}:`, error);
        // Set empty array on error
        setCaseStudies(prev => new Map(prev.set(caseId, [])));
      }
    },
    [caseService]
  );

  // Custom upload function using /api/dicom/studies/upload
  const handleCustomUpload = useCallback(async () => {
    if (selectedFiles.length === 0) {
      alert('Please select at least one file');
      return;
    }

    if (!caseService) {
      alert('Case Service not initialized');
      return;
    }

    // If caseId is provided, confirm upload and enrollment
    if (addStudyToCaseId) {
      const confirmMessage =
        `Confirm upload and auto-enroll to Case?\n\n` +
        `Case ID: ${addStudyToCaseId}\n` +
        `Clinical Phase: ${clinicalPhase}\n` +
        `File Count: ${selectedFiles.length} file(s)\n\n` +
        `After upload completes, study and all series will be automatically enrolled to this Case.`;

      if (!window.confirm(confirmMessage)) {
        return; // User cancelled
      }
    }

    // Get API URL from localStorage or use default
    const hostname = window.location.hostname;
    const defaultApiUrl =
      hostname === 'localhost' || hostname === '127.0.0.1'
        ? 'http://localhost:3001'
        : `http://${hostname}:3001`;
    const apiUrl = localStorage.getItem('syncforge_api_url') || defaultApiUrl;
    setIsUploading(true);
    setUploadProgress({});

    try {
      const formData = new FormData();

      // Add files
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      // If caseId is provided, automatically add enrollment parameters (backend will auto-enroll)
      if (addStudyToCaseId) {
        formData.append('caseId', addStudyToCaseId.toString());
        formData.append('clinicalPhase', clinicalPhase);
        // No need for autoEnroll parameter, backend auto-enrolls by default
      }

      // Upload using fetch
      const response = await fetch(`${apiUrl}/api/dicom/studies/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        // Build success message
        let message = `✅ Upload successful! ${result.studiesUploaded} study(ies) uploaded to Orthanc`;
        
        // If there are enrollment results, show enrollment information
        if (result.enrollmentResults && result.enrollmentResults.length > 0) {
          const successCount = result.enrollmentResults.filter(r => r.success).length;
          const totalSeries = result.enrollmentResults.reduce(
            (sum, r) => sum + (r.enrolledSeriesCount || 0), 
            0
          );
          
          message = `✅ Upload and enrollment successful!\n\n` +
            `- ${result.studiesUploaded} study(ies) uploaded\n` +
            `- ${successCount} study(ies) successfully enrolled to Case ${addStudyToCaseId}\n` +
            `- Total ${totalSeries} series enrolled\n`;
          
          // Show detailed enrollment information
          if (result.enrollmentResults.length > 0) {
            const details = result.enrollmentResults.map(r => {
              if (r.success) {
                return `  ✓ ${r.studyUID}: ${r.enrolledSeriesCount || 0} series`;
              } else {
                return `  ✗ ${r.studyUID || r.orthancStudyId}: ${r.error}`;
              }
            }).join('\n');
            
            console.log('Enrollment details:\n' + details);
          }
        }
        
        alert(message);

        // Refresh studies list
        setLoadingOrthancStudies(true);
        try {
          const studies = await caseService.getAllOrthancStudies();
          setOrthancStudies(studies);
        } catch (err) {
          console.error('Failed to reload Orthanc studies:', err);
        } finally {
          setLoadingOrthancStudies(false);
        }

        // If enrolled to case, refresh case data
        if (addStudyToCaseId && result.enrollmentResults && result.enrollmentResults.length > 0) {
          try {
            // Reload case list and studies for this case
            await loadCases();
            if (caseStudies.has(addStudyToCaseId)) {
              await loadStudiesForCase(addStudyToCaseId);
            }
          } catch (err) {
            console.error('Failed to reload case data:', err);
          }
        }

        // Refresh page data
        onRefresh();

        // Clear selected files
        setSelectedFiles([]);
        setUploadProgress({});

        // If enrolled to case, close modal
        if (addStudyToCaseId && result.enrollmentResults && result.enrollmentResults.length > 0) {
          setShowAddStudyModal(false);
        } else {
          // Optional: switch to select tab to view uploaded studies
          // setActiveTab('select');
        }
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  }, [selectedFiles, clinicalPhase, addStudyToCaseId, caseService, onRefresh, loadCases, loadStudiesForCase, caseStudies]);

  // Handle study selection - open enroll dialog
  const handleStudyClick = useCallback(study => {
    setSelectedStudy(study);
    setSelectedClinicalPhase('PreOperativePlanning');
    setEnrollError(null);
    setShowEnrollDialog(true);
  }, []);

  // Handle enroll study confirmation
  const handleEnrollStudy = useCallback(async () => {
    if (!selectedStudy || !caseService || !addStudyToCaseId) {
      return;
    }

    setIsEnrolling(true);
    setEnrollError(null);

    try {
      await caseService.enrollStudy(
        addStudyToCaseId,
        selectedStudy.studyInstanceUID,
        selectedClinicalPhase,
        {
          enrollAllSeries: true, // Auto-enroll all series
        }
      );

      // Success - refresh both case list and study list
      setShowEnrollDialog(false);
      setShowAddStudyModal(false);
      setSelectedStudy(null);

      // Reload to ensure data synchronization (rely on real data from server, don't manually increment count)
      await loadCases();

      // Reload studies for this case if it's already expanded
      if (caseStudies.has(addStudyToCaseId)) {
        await loadStudiesForCase(addStudyToCaseId);
      }

      // Also refresh study list if needed
      onRefresh();
    } catch (err) {
      console.error('Failed to add study:', err);
      setEnrollError(err.message || 'Failed to add study to case');
    } finally {
      setIsEnrolling(false);
    }
  }, [
    selectedStudy,
    addStudyToCaseId,
    selectedClinicalPhase,
    caseService,
    loadCases,
    loadStudiesForCase,
    caseStudies,
    onRefresh,
  ]);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  }, []);

  // Handle file removal
  const handleFileRemove = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

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
    const isNextPage = newPageNumber > oldPageNumber;
    const isPrevPage = newPageNumber < oldPageNumber;

    // In cases view mode, use pagination info returned from backend to determine
    if (viewMode === 'cases') {
      if (casePagination) {
        // Use hasNext/hasPrev returned from backend to determine
        if (isNextPage && !casePagination.hasNext) {
          return; // No next page, return directly
        }
        if (isPrevPage && !casePagination.hasPrev) {
          return; // No previous page, return directly
        }
      } else {
        console.warn('⚠️ No pagination info available in cases view mode');
      }
    } else {
      // In studies view mode, use original logic
      const rollingPageNumberMod = Math.floor(101 / filterValues.resultsPerPage);
      const rollingPageNumber = oldPageNumber % rollingPageNumberMod;
      const hasNextPage = Math.max(rollingPageNumber, 1) * resultsPerPage < numOfStudies;

      if (isNextPage && !hasNextPage) {
        return;
      }
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

  // Update case handler for Edit dialog
  const handleUpdateCase = async updates => {
    if (!caseService || !selectedCase) {
      return;
    }

    try {
      const updatedCase = await caseService.updateCase(selectedCase.caseId, updates);
      await loadCases(); // Reload cases list
      
      // Update selectedCase with the latest data from server
      // This ensures the edit dialog shows updated data if reopened
      setSelectedCase({
        caseId: updatedCase.caseId,
        patientInfo: updatedCase.patientInfo || {
          mrn: updatedCase.patientInfo?.mrn || selectedCase.patientInfo?.mrn || '',
          name: updatedCase.patientInfo?.name || selectedCase.patientInfo?.name || '',
          dateOfBirth: updatedCase.patientInfo?.dateOfBirth || selectedCase.patientInfo?.dateOfBirth || '',
        },
        status: updatedCase.status || selectedCase.status || 'created',
      });
      
      console.log(`✅ Case ${selectedCase.caseId} updated successfully`);
    } catch (err) {
      console.error('Failed to update case:', err);
      throw err; // Let EditCaseDialog show the error
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

    // Load initial active case state
    const initialCaseId = caseService.getActiveCaseId();
    const initialCase = caseService.getActiveCase();
    setActiveCaseId(initialCaseId);
    setActiveCase(initialCase);

    // Initial fetch of cases for the hierarchical view
    loadCases();

    const subscriptions = [
      caseService.subscribe(
        caseService.constructor.EVENTS.ACTIVE_CASE_CHANGED,
        ({ caseId, case: caseData }) => {
          setActiveCaseId(caseId);
          setActiveCase(caseData);
          console.log('📁 WorkList: Active case changed:', caseId);
        }
      ),
      caseService.subscribe(caseService.constructor.EVENTS.CASE_CREATED, newCase => {
        setCases(prev => {
          const exists = prev.some(c => c.caseId === newCase.caseId);
          return exists ? prev : [...prev, newCase];
        });
        loadCases(); // sync with canonical order/counts
      }),
    ];

    return () => {
      subscriptions.forEach(sub => sub?.unsubscribe?.());
    };
  }, [caseService]);

  // Sync URL query parameters with filters
  useEffect(() => {
    if (!debouncedFilterValues) {
      return;
    }

    const queryString = {};
    Object.keys(defaultFilterValues).forEach(key => {
      // Temporarily exclude sortBy and sortDirection to avoid triggering 404 errors (server doesn't have corresponding API)
      if (key === 'sortBy' || key === 'sortDirection') {
        return;
      }

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
  const loadSeriesForStudy = async studyUID => {
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
  const removeStudyFromCase = async studyUID => {
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
        setStudiesWithSeriesData(prev => [...prev, studyInstanceUid]);
      } catch (ex) {
        // TODO: UI Notification Service
        console.warn(ex);
      }
    };

    // Create a mapping: studyRowKey -> studyInstanceUID
    const studyRowKeyToUID = new Map();
    
    if (viewMode === 'cases' && cases.length > 0) {
      // Case-centric view: iterate through all cases and studies to build mapping
      // Note: this logic must be exactly consistent with rowIndex assignment logic in createTableDataSource
      let rowIndex = 1;
      cases.forEach(caseItem => {
        rowIndex++; // case row
        // Only when case is expanded will study rows be created and rowIndex assigned
        if (expandedCases.includes(caseItem.caseId) && caseStudies.has(caseItem.caseId)) {
          const studies = caseStudies.get(caseItem.caseId) || [];
          studies.forEach(study => {
            studyRowKeyToUID.set(rowIndex++, study.studyInstanceUID);
          });
        }
      });
    } else {
      // Study-centric view: use index directly
      filteredStudies.forEach((study, index) => {
        studyRowKeyToUID.set(index + 1, study.studyInstanceUid);
      });
    }

    // Get corresponding studyInstanceUID based on expandedRows
    for (let z = 0; z < expandedRows.length; z++) {
      const studyRowKey = expandedRows[z];
      const studyInstanceUid = studyRowKeyToUID.get(studyRowKey);

      if (!studyInstanceUid) {
        continue;
      }

      if (studiesWithSeriesData.includes(studyInstanceUid)) {
        continue;
      }

      fetchSeries(studyInstanceUid);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedRows, studies, viewMode, cases, expandedCases, caseStudies, filteredStudies]);

  const isFiltering = (filterValues, defaultFilterValues) => {
    return !isEqual(filterValues, defaultFilterValues);
  };

  // Create hierarchical table data source
  const createTableDataSource = () => {
    const rows = [];
    let rowIndex = 1;

    if (viewMode === 'cases' && cases.length > 0) {
      // Case-centric view: Show cases first
      cases.forEach(caseItem => {
        const caseRowKey = rowIndex++;
        const isCaseExpanded = expandedCases.includes(caseItem.caseId);

        // Add case row with active case highlighting
        const isActiveCase = activeCaseId && caseItem.caseId === activeCaseId;
        
        rows.push({
          dataCY: `caseRow-${caseItem.caseId}`,
          clickableCY: caseItem.caseId,
          className: isActiveCase 
            ? 'bg-blue-900/20 border-l-4 border-blue-500 hover:bg-blue-900/30' 
            : 'hover:bg-primary-dark',
          row: [
            {
              key: 'caseId',
              content: (
                <div className={`flex items-center gap-2 rounded px-2 py-1 ${isActiveCase ? 'bg-blue-800/40' : 'bg-blue-900/20'}`}>
                  {isActiveCase && <span className="text-blue-400 text-lg">★</span>}
                  <Icons.Database className="h-5 w-5 text-blue-400" />
                  <span className="text-base font-bold text-blue-200">📁 {caseItem.caseId}</span>
                  {isActiveCase && <span className="ml-2 text-xs bg-blue-600/60 px-2 py-0.5 rounded text-blue-200">ACTIVE</span>}
                </div>
              ),
              // title: caseItem.caseId,
              gridCol: 6, // Restored to 6, no adjustment
            },
            {
              key: 'patientName',
              content: (
                <span className="font-semibold text-white whitespace-nowrap">
                  {caseItem.patientName || 'Unknown Patient'}
                </span>
              ),
              gridCol: 3, // Increased from 2 to 3, avoid truncating long names
            },
            {
              key: 'mrn',
              content: (
                <span className="text-gray-300">
                  {caseItem.patientMRN || caseItem.patientInfo?.mrn || caseItem.mrn || 'N/A'}
                </span>
              ),
              gridCol: 5, // Keep unchanged
            },
            {
              key: 'createdAt',
              content: moment(caseItem.createdAt).format('MMM-DD-YYYY'),
              gridCol: 3, // Keep unchanged, date format fixed
            },
            {
              key: 'studyCount',
              content: (
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <Icons.GroupLayers className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span>{caseItem.studyCount} studies</span>
                </div>
              ),
              gridCol: 3, // Keep unchanged, ensure "0 studies" displays in one line
            },
            {
              key: 'actions',
              content: (
                <div className="flex items-center gap-0.5"> {/* Changed from gap-1 to gap-0.5 */}
                  <button
                    onClick={async e => {
                      e.stopPropagation();
                      setAddStudyToCaseId(caseItem.caseId);
                      setShowAddStudyModal(true);
                      setActiveTab('upload'); // Reset to upload tab
                      // Reset upload-related state
                      setUploadMethod('standard');
                      // setAutoEnroll(false);
                      // setClinicalPhase('PreOperativePlanning');
                      setSelectedFiles([]);
                      setUploadProgress({});
                      setIsUploading(false);
                      // setSearchQuery(''); // Reset search - TODO: Search functionality temporarily commented
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
                    className="flex items-center gap-1 rounded border border-green-500/30 bg-green-900/20 px-1 py-1 transition-colors hover:bg-green-900/50 whitespace-nowrap" // Changed from px-1.5 to px-1
                    title="Add Study to Case"
                  >
                    <Icons.Add className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                    <span className="text-xs text-green-300">Add Study</span>
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      // 🔍 DEBUG: Check original caseItem data
                      console.log('🔍 WorkList: ========== DEBUG INFO ==========');
                      console.log('🔍 Original caseItem:', JSON.stringify(caseItem, null, 2));
                      console.log('🔍 caseItem.patientInfo:', caseItem.patientInfo);
                      console.log('🔍 caseItem.patientInfo?.dateOfBirth:', caseItem.patientInfo?.dateOfBirth);
                      console.log('🔍 caseItem.patientMRN:', caseItem.patientMRN);
                      console.log('🔍 caseItem.patientName:', caseItem.patientName);
                      console.log('🔍 ===========================================');
                      
                      // Transform case data to match EditCaseDialog's expected structure
                      // Use patientInfo as primary source, fallback to case-level fields for backward compatibility
                      const caseDataForDialog = {
                        caseId: caseItem.caseId,
                        patientInfo: {
                          mrn:
                            caseItem.patientInfo?.mrn || caseItem.patientMRN || caseItem.mrn || '',
                          name: caseItem.patientInfo?.name || caseItem.patientName || '',
                          dateOfBirth: caseItem.patientInfo?.dateOfBirth || '',
                        },
                        status: caseItem.status || 'created',
                      };
                      
                      // 🔍 DEBUG: Check transformed data
                      console.log('🔍 WorkList: caseDataForDialog:', JSON.stringify(caseDataForDialog, null, 2));
                      console.log('🔍 WorkList: caseDataForDialog.patientInfo?.dateOfBirth:', caseDataForDialog.patientInfo?.dateOfBirth);
                      
                      setSelectedCase(caseDataForDialog);
                      setIsEditDialogOpen(true);
                    }}
                    className="flex items-center gap-1 rounded border border-blue-500/30 bg-blue-900/20 px-1 py-1 transition-colors hover:bg-blue-900/50 whitespace-nowrap" // Changed from px-1.5 to px-1
                    title="Edit Case"
                  >
                    <Icons.Settings className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                    <span className="text-xs text-blue-300">Edit</span>
                  </button>
                  <button
                    onClick={async e => {
                      e.stopPropagation();

                      if (
                        !confirm(
                          `Delete case "${caseItem.caseId}"?\n\nThis will also delete ${caseItem.studyCount} enrolled study/studies.\n\nThis action cannot be undone.`
                        )
                      ) {
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
                    className="flex items-center gap-1 rounded border border-red-500/30 bg-red-900/20 px-1 py-1 transition-colors hover:bg-red-900/50 whitespace-nowrap" // Changed from px-1.5 to px-1
                    title="Delete Case"
                  >
                    <Icons.Cancel className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                    <span className="text-xs text-red-300">Del</span>
                  </button>
                </div>
              ),
              gridCol: 7, // Decreased from 8 to 7, because expandIcon column was removed, can reallocate space
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

          studies.forEach(study => {
            const studyRowKey = rowIndex++;
            const isStudyExpanded = expandedRows.some(k => k === studyRowKey);

            // Find the full study data from filteredStudies
            const fullStudy = filteredStudies.find(
              s => s.studyInstanceUid === study.studyInstanceUID
            );

            if (!fullStudy) {
              // Study not loaded yet - show placeholder with remove button
              const isActiveCaseStudy = activeCaseId && caseItem.caseId === activeCaseId;
              
              rows.push({
                dataCY: `studyPlaceholder-${study.studyInstanceUID}`,
                clickableCY: study.studyInstanceUID,
                className: isActiveCaseStudy 
                  ? 'bg-blue-900/30 border-l-4 border-blue-500 hover:bg-blue-900/40' 
                  : 'hover:bg-primary-dark',
                row: [
                  {
                    key: 'studyIndent',
                    content: (
                      <div className="ml-6 text-gray-500 flex items-center gap-1">
                        {isActiveCaseStudy && <span className="text-blue-400 text-xs">●</span>}
                        └─
                      </div>
                    ),
                    gridCol: 1,
                  },
                  {
                    key: 'studyInfo',
                    content: (
                      <div className="text-gray-400">
                        <span className="text-sm">
                        {study.description || 'Study not found in Orthanc (may have been deleted)'}
                        </span>
                        <br />
                        <span className="text-xs text-gray-500">
                          StudyUID: {study.studyInstanceUID.substring(0, 30)}...
                        </span>
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
                    content: <span className="text-xs text-yellow-500">Missing from Orthanc</span>,
                    gridCol: 2,
                  },
                  {
                    key: 'removeButton',
                    content: (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (
                            window.confirm(
                              'Remove this study from the case?\n\nThis study is not in Orthanc worklist.'
                            )
                          ) {
                            if (caseService) {
                              caseService
                                .removeStudy(caseItem.caseId, study.studyInstanceUID)
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
                        className="rounded p-1 transition-colors hover:bg-red-900/50"
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
                moment(date, ['YYYYMMDD', 'YYYY.MM.DD']).format(
                  t('Common:localDateFormat', 'MMM-DD-YYYY')
                );
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

              // 🎨 Highlight active case studies with different background color
              const isActiveCaseStudy = activeCaseId && caseItem.caseId === activeCaseId;
              
              rows.push({
                dataCY: `studyRow-${studyInstanceUid}`,
                clickableCY: studyInstanceUid,
                className: isActiveCaseStudy 
                  ? 'bg-blue-900/30 border-l-4 border-blue-500 hover:bg-blue-900/40' 
                  : 'hover:bg-primary-dark',
                row: [
                  {
                    key: 'studyIndent',
                    content: (
                      <div className="ml-6 text-gray-500 flex items-center gap-1">
                        {isActiveCaseStudy && <span className="text-blue-400 text-xs">●</span>}
                        └─
                      </div>
                    ),
                    gridCol: 1,
                  },
                  {
                    key: 'patientName',
                    content: patientName ? makeCopyTooltipCell(patientName) : null,
                    gridCol: 5,
                  },
                  {
                    key: 'mrn',
                    content: makeCopyTooltipCell(mrn),
                    gridCol: 3,
                  },
                  {
                    key: 'studyDate',
                    content: (
                      <div className="pr-4">
                        {studyDate && <span className="mr-4">{studyDate}</span>}
                        {studyTime && <span>{studyTime}</span>}
                      </div>
                    ),
                    title: `${studyDate || ''} ${studyTime || ''}`,
                    gridCol: 5,
                  },
                  {
                    key: 'description',
                    content: (
                      <div className="flex items-center gap-2">
                        {makeCopyTooltipCell(description)}
                        {study.clinicalPhase && (
                          <span className="whitespace-nowrap rounded border border-blue-500 bg-blue-900/40 px-2 py-0.5 text-xs text-blue-300">
                            {study.clinicalPhase.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                        )}
                      </div>
                    ),
                    gridCol: 5,
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
                        onClick={e => {
                          e.stopPropagation(); // Prevent row expansion
                          if (
                            window.confirm(
                              'Remove this study from the case?\n\nThe study will remain in Orthanc.'
                            )
                          ) {
                            if (caseService) {
                              caseService
                                .removeStudy(caseItem.caseId, studyInstanceUid)
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
                        className="rounded p-1 transition-colors hover:bg-red-900/50"
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
                      const caseStudy = studiesInCase.find(
                        s => s.studyInstanceUID === studyInstanceUid
                      );

                      return (
                        caseStudy &&
                        caseStudy.series &&
                        caseStudy.series.length > 0 && (
                          <div className="mb-3 rounded border border-gray-700 bg-gray-900/30 p-2">
                            <div className="mb-1 flex items-center justify-between">
                              <h5 className="text-xs font-semibold text-gray-300">
                                Series: {caseStudy.series.filter(s => s.isEnrolled).length}/
                                {caseStudy.series.length} enrolled
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
                                    onChange={async e => {
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
                                  <span className="flex-1 text-white">
                                    {series.description || '(no description)'}
                                  </span>
                                  <span className="text-gray-500">{series.instanceCount} img</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
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

                        const { valid: isValidMode, description: invalidModeDescription } =
                          mode.isValidMode({
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
                  setExpandedRows(s =>
                    isStudyExpanded ? s.filter(n => studyRowKey !== n) : [...s, studyRowKey]
                  ),
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
          moment(date, ['YYYYMMDD', 'YYYY.MM.DD']).format(
            t('Common:localDateFormat', 'MMM-DD-YYYY')
          );
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
        const studyInfo =
          activeCaseId && activeCase
            ? activeCase.studies.find(s => s.studyInstanceUID === studyInstanceUid)
            : null;
        const clinicalPhase = studyInfo?.clinicalPhase;

        rows.push({
          dataCY: `studyRow-${studyInstanceUid}`,
          clickableCY: studyInstanceUid,
          row: [
            {
              key: 'patientName',
              content: patientName ? makeCopyTooltipCell(patientName) : null,
              gridCol: 5,
            },
            {
              key: 'mrn',
              content: makeCopyTooltipCell(mrn),
              gridCol: 3,
            },
            {
              key: 'studyDate',
              content: (
                <div className="pr-4">
                  {studyDate && <span className="mr-4">{studyDate}</span>}
                  {studyTime && <span>{studyTime}</span>}
                </div>
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
                    <span className="whitespace-nowrap rounded border border-blue-500 bg-blue-900/40 px-2 py-0.5 text-xs text-blue-300">
                      {clinicalPhase.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  )}
                </div>
              ),
              gridCol: 5,
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
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <Icons.Checkmark className="h-4 w-4" />
                      In Case
                    </span>
                  ) : activeCaseId ? (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (caseService && activeCaseId) {
                          console.log(
                            `📝 Adding study ${studyInstanceUid} to case ${activeCaseId}`
                          );
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
                          console.log(`📋 Clinical phase: ${clinicalPhase}`);

                          caseService
                            .enrollStudy(activeCaseId, studyInstanceUid, clinicalPhase, {
                              enrollAllSeries: true, // Auto-enroll all series
                            })
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
                      className="flex items-center gap-1.5 rounded border border-blue-500/30 bg-blue-900/20 px-1.5 py-1 transition-colors hover:bg-blue-900/50"
                      title="Add to Case"
                    >
                      <Icons.Add className="h-3.5 w-3.5 text-blue-400" />
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

                  const { valid: isValidMode, description: invalidModeDescription } =
                    mode.isValidMode({
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
  const paginatedTableData =
    viewMode === 'cases' ? tableDataSource : tableDataSource.slice(offset, offsetAndTake);

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
          // title: AboutModal?.title ?? t('AboutModal:About LifeSync Robotics'),
          title: AboutModal?.title ?? 'About LifeSync Robotics',
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

  const uploadProps = undefined;
    // DicomUploadComponent && dataSource.getConfig()?.dicomUploadEnabled
    //   ? {
    //       title: 'Upload files',
    //       closeButton: true,
    //       shouldCloseOnEsc: false,
    //       shouldCloseOnOverlayClick: false,
    //       content: () => (
    //         <DicomUploadComponent
    //           dataSource={dataSource}
    //           onComplete={() => {
    //             hide();
    //             onRefresh();
    //           }}
    //           onStarted={() => {
    //             show({
    //               ...uploadProps,
    //               // when upload starts, hide the default close button as closing the dialogue must be handled by the upload dialogue itself
    //               closeButton: false,
    //             });
    //           }}
    //         />
    //       ),
    //     }
    //   : undefined;

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
        Secondary={
          <WorkListCaseSelector
            servicesManager={servicesManager}
            viewMode={viewMode}
            setViewMode={setViewMode}
            cases={cases}
            loadingCases={loadingCases}
            onCaseCreated={newCase => {
              setCases(prev => {
                const exists = prev.some(c => c.caseId === newCase.caseId);
                return exists ? prev : [...prev, newCase];
              });
            }}
          />
        }
      />
      <ApiConfigPanel servicesManager={servicesManager} />
      <Onboarding />
      <InvestigationalUseDialog dialogConfiguration={appConfig?.investigationalUseDialog} />
      {/* Centralized Create Case dialog for WorkList */}
      <CreateCaseDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreateCase={handleCreateCase}
        servicesManager={servicesManager}
      />
      <EditCaseDialog
        isOpen={isEditDialogOpen}
        caseData={selectedCase}
        onClose={() => setIsEditDialogOpen(false)}
        onUpdate={handleUpdateCase}
      />
      {/* Case actions bar: currently only + Create Case, independent of Upload */}
      <div className="border-b border-black bg-black">
        <div className="container mx-auto flex items-center justify-start gap-4 px-4 py-3">
          <ButtonNext
            onClick={() => setIsCreateDialogOpen(true)}
            className="!h-auto bg-blue-600 !px-1 !py-0.5 text-sm font-bold hover:bg-blue-700"
          >
            <Icons.Add className="mr-0.5 h-4 w-4" />
            Create Case
          </ButtonNext>
        </div>
      </div>
      <div className="flex h-full flex-col overflow-y-auto">
        <ScrollArea>
          <div className="flex grow flex-col">
            <StudyListFilter
              numOfStudies={displayedCount}
              countLabel={viewMode === 'cases' ? 'Cases' : undefined}
              filtersMeta={filtersMeta}
              filterValues={{ ...filterValues, ...defaultSortValues }}
              onChange={setFilterValues}
              clearFilters={() => {
                console.log('🧹 Clearing filters, resetting to:', defaultFilterValues);
                // Clear all query conditions
                const clearedFilters = { ...defaultFilterValues };
                setFilterValues(clearedFilters);
                updateSessionQueryFilterValues(clearedFilters);
                // Also clear URL parameters (temporarily excluding sortBy and sortDirection to avoid 404 errors)
                const newSearchParams = new URLSearchParams();
                // TODO: Temporarily comment out sorting parameter retention to avoid triggering 404 errors
                if (filterValues.sortBy) {
                  newSearchParams.set('sortBy', filterValues.sortBy);
                }
                if (filterValues.sortDirection && filterValues.sortDirection !== 'none') {
                  newSearchParams.set('sortDirection', filterValues.sortDirection);
                }
                navigate({ search: newSearchParams.toString() }, { replace: true });
              }}
              isFiltering={isFiltering(filterValues, defaultFilterValues)}
              // onUploadClick={uploadProps ? () => show(uploadProps) : undefined}
              getDataSourceConfigurationComponent={
                dataSourceConfigurationComponent
                  ? () => dataSourceConfigurationComponent()
                  : undefined
              }
            />
            {/* {activeCaseId && activeCase && (
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
            )} */}
            {displayedCount > 0 ? (
            <div className="flex grow flex-col">
              <StudyListTable
                tableDataSource={paginatedTableData}
                numOfStudies={displayedCount}
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
          </div>
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
            onClick={e => e.stopPropagation()}
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
            {/* Tab Navigation */}
            <div className="border-secondary-light bg-primary-dark flex border-b px-6">
              <button
                className={classnames(
                  'px-4 py-2 font-semibold transition-colors',
                  activeTab === 'upload'
                    ? 'bg-secondary-main border-b-2 border-blue-400 text-white'
                    : 'text-gray-400 hover:text-white'
                )}
                onClick={() => setActiveTab('upload')}
              >
                Upload
              </button>
              <button
                className={classnames(
                  'px-4 py-2 font-semibold transition-colors',
                  activeTab === 'select'
                    ? 'bg-secondary-main border-b-2 border-blue-400 text-white'
                    : 'text-gray-400 hover:text-white'
                )}
                onClick={() => setActiveTab('select')}
              >
                Select Study
              </button>
            </div>

            {/* Modal Body */}
            <div className="max-h-[60vh] overflow-y-auto">
              {activeTab === 'upload' && (
                <div className="p-6">
                  {/* Upload Method Selection */}
                  <div className="mb-6">
                    <label className="mb-3 block text-sm font-semibold text-white">
                      Upload Method:
                    </label>
                    <div className="space-y-2 rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="radio"
                          name="uploadMethod"
                          value="standard"
                          checked={uploadMethod === 'standard'}
                          onChange={e => setUploadMethod(e.target.value)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-white">DICOMweb STOW-RS</div>
                          <div className="text-xs text-gray-400">
                            DICOMweb STOW-RS, upload directly to Orthanc PACS
                          </div>
                        </div>
                      </label>
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="radio"
                          name="uploadMethod"
                          value="custom"
                          checked={uploadMethod === 'custom'}
                          onChange={e => setUploadMethod(e.target.value)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-white">Custom Upload</div>
                          <div className="text-xs text-gray-400">
                            Batch upload via custom API endpoint
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Standard Upload */}
                  {uploadMethod === 'standard' &&
                  DicomUploadComponent &&
                  dataSource.getConfig()?.dicomUploadEnabled ? (
                    <DicomUploadComponent
                      dataSource={dataSource}
                      onComplete={async () => {
                        // After upload completes, refresh Orthanc studies list
                        setLoadingOrthancStudies(true);
                        try {
                          if (caseService) {
                            // If adding to a case, enroll the study
                            if (addStudyToCaseId) {
                              await caseService.enrollStudy(
                                addStudyToCaseId,
                                study.studyInstanceUID,
                                clinicalPhase,
                                {
                                  studyDate: study.studyDate,
                                  modalities: study.modalities,
                                  description: study.studyDescription,
                                  enrollAllSeries: true, // Auto-enroll all series
                                }
                              );
                              console.log(`✅ Study added to case ${addStudyToCaseId}`);
                              setShowAddStudyModal(false);
                              window.location.reload();
                            } else {
                              // Refresh Orthanc studies list
                              const studies = await caseService.getAllOrthancStudies();
                              setOrthancStudies(studies);
                              // Optional: auto-switch to Select Study tab
                              // setActiveTab('select');
                            }
                          }
                          // Refresh page data
                          onRefresh();
                        } catch (err) {
                          console.error('Failed to reload Orthanc studies:', err);
                        } finally {
                          setLoadingOrthancStudies(false);
                        }
                      }}
                      onStarted={() => {
                        // When upload starts, can display loading state
                        console.log('Upload started');
                      }}
                    />
                  ) : uploadMethod === 'standard' ? (
                    <div className="flex h-[400px] items-center justify-center rounded-lg border-2 border-dashed border-gray-600">
                      <div className="text-center text-gray-400">
                        <p className="mb-2 text-lg">Upload DICOM Files</p>
                        <p className="text-sm">DICOM upload is not enabled</p>
                      </div>
                    </div>
                  ) : null}

                  {/* Custom Upload */}
                  {uploadMethod === 'custom' && (
                    <div className="space-y-4">
                      {/* File Selection */}
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-white">
                          Select Files:
                        </label>
                        <div className="rounded-lg border-2 border-dashed border-gray-600 bg-gray-900/30 p-8 text-center">
                          <input
                            type="file"
                            multiple
                            accept=".dcm,application/dicom"
                            onChange={handleFileSelect}
                            className="hidden"
                            id="file-upload-input"
                            disabled={isUploading}
                          />
                          <input
                            type="file"
                            // @ts-ignore - webkitdirectory is a valid HTML attribute but not in React types
                            webkitdirectory=""
                            multiple
                            onChange={handleFileSelect}
                            className="hidden"
                            id="folder-upload-input"
                            disabled={isUploading}
                          />
                          <div className="mb-4">
                            <div className="mb-2 text-4xl">📁</div>
                            <div className="mb-2 text-white">
                              Drag files here or click to select
                            </div>
                            <div className="mb-4 text-sm text-gray-400">
                              Supports multiple file upload, format: .dcm
                            </div>
                            <div className="flex justify-center gap-3">
                              <label
                                htmlFor="file-upload-input"
                                className="cursor-pointer rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Add Files
                              </label>
                              <label
                                htmlFor="folder-upload-input"
                                className="cursor-pointer rounded bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Add Folder
                              </label>
                            </div>
                          </div>
                        </div>

                        {/* Selected Files List */}
                        {selectedFiles.length > 0 && (
                          <div className="mt-4 rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                            <div className="mb-2 text-sm font-semibold text-white">
                              Selected Files ({selectedFiles.length}):
                            </div>
                            <div className="max-h-40 space-y-2 overflow-y-auto">
                              {selectedFiles.map((file, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between rounded bg-gray-800/50 px-3 py-2"
                                >
                                  <span className="text-sm text-gray-300">{file.name}</span>
                                  <button
                                    onClick={() => handleFileRemove(index)}
                                    className="text-red-400 hover:text-red-300"
                                    disabled={isUploading}
                                  >
                                    <Icons.Close className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Custom Upload Options */}
                      {addStudyToCaseId && (
                        <div className="rounded-lg border border-blue-500/30 bg-blue-900/20 p-4">
                          <div className="mb-3">
                            <label className="mb-2 block text-sm font-semibold text-white">
                              Clinical Phase:
                            </label>
                            <select
                              value={clinicalPhase}
                              onChange={e => setClinicalPhase(e.target.value)}
                              className="w-full rounded border border-gray-600 bg-black px-3 py-2 text-white"
                              disabled={isUploading}
                            >
                              <option value="Diagnostic">Diagnostic</option>
                              <option value="PreSurgicalOptimization">
                                PreSurgicalOptimization
                              </option>
                              <option value="PreOperativePlanning">PreOperativePlanning</option>
                              <option value="PreOperativeCheck">PreOperativeCheck</option>
                              <option value="IntraOperative">IntraOperative</option>
                              <option value="PostOperativeImmediate">
                                PostOperativeImmediate
                              </option>
                              <option value="PostOperativeShortTerm">
                                PostOperativeShortTerm
                              </option>
                              <option value="PostOperativeLongTerm">PostOperativeLongTerm</option>
                              <option value="Surveillance">Surveillance</option>
                              <option value="Revision">Revision</option>
                            </select>
                          </div>
                          <div className="rounded border border-blue-500/30 bg-blue-900/20 p-3">
                            <div className="text-sm text-blue-300">
                              <span className="font-semibold">Will auto-enroll to Case ID:</span>{' '}
                              <span className="font-mono text-blue-200">
                                {addStudyToCaseId}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-gray-400">
                              After upload completes, study and all series will be automatically enrolled to this Case
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Upload Button */}
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => {
                            setSelectedFiles([]);
                            setUploadProgress({});
                          }}
                          className="rounded border border-gray-600 bg-gray-800 px-4 py-2 text-white hover:bg-gray-700"
                          disabled={isUploading || selectedFiles.length === 0}
                        >
                          Clear
                        </button>
                        <button
                          onClick={handleCustomUpload}
                          disabled={isUploading || selectedFiles.length === 0}
                          className={classnames(
                            'rounded px-4 py-2 font-semibold text-white transition-colors',
                            isUploading || selectedFiles.length === 0
                              ? 'cursor-not-allowed bg-gray-600'
                              : 'bg-blue-600 hover:bg-blue-700'
                          )}
                        >
                          {isUploading ? 'Uploading...' : 'Start Upload'}
                        </button>
                      </div>

                      {/* Upload Progress */}
                      {isUploading && (
                        <div className="rounded-lg border border-blue-500/50 bg-blue-900/20 p-4">
                          <div className="mb-2 text-sm text-blue-300">Uploading, please wait...</div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-700">
                            <div
                              className="h-full animate-pulse bg-blue-500"
                              style={{ width: '50%' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'select' && (
                <div>
                  {/* Search Bar - TODO: Search functionality temporarily commented, to be implemented later */}
                  <div className="border-secondary-light bg-secondary-main flex items-center gap-3 border-b p-4">
                    <select
                      value={searchFilter}
                      onChange={e => setSearchFilter(e.target.value)}
                      className="w-40 rounded border border-gray-600 bg-black px-3 py-2 text-white"
                    >
                      <option value="studyUID">StudyUID</option>
                      <option value="patientName">Patient Name</option>
                      <option value="mrn">MRN</option>
                      <option value="studyDate">Study Date</option>
                    </select>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Enter search term..."
                      className="flex-1 rounded border border-gray-600 bg-black px-3 py-2 text-white placeholder-gray-500"
                    />
                    {/* <button
                      onClick={() => {
                        // TODO: Implement search functionality
                        console.log('Search clicked:', searchQuery, searchFilter);
                      }}
                      className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    >
                      Search
                    </button> */}
                  </div> 

                  {/* Study List */}
                  <div className="p-6">
                    {loadingOrthancStudies ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                          <div className="mb-4 text-white">Loading studies from Orthanc...</div>
                          <div className="text-gray-400">Please wait</div>
                        </div>
                      </div>
                    ) : filteredOrthancStudies.length === 0 ? (
                      <div className="py-12 text-center text-gray-400">
                        {searchQuery
                          ? `No studies found matching "${searchQuery}"`
                          : 'No studies found in Orthanc'}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredOrthancStudies.map(study => (
                          <div
                            key={study.studyInstanceUID}
                            className={classnames(
                              'hover:bg-secondary-dark flex items-center justify-between rounded border p-4 transition-colors',
                              {
                                'border-yellow-500/50 bg-yellow-900/20': study.hasCaseId,
                                'bg-secondary-main cursor-pointer border-gray-700':
                                  !study.hasCaseId,
                              }
                            )}
                            onClick={() => {
                              if (!isEnrolling) {
                                handleStudyClick(study);
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
                </div>
              )}
            </div>

            {/* Enroll Study Confirmation Dialog */}
            {showEnrollDialog && selectedStudy && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="bg-secondary-main border-secondary-light w-full max-w-md rounded-lg border p-6 shadow-lg">
                  <h3 className="mb-4 text-lg font-semibold text-white">Add Study to Case</h3>

                  {/* Study Info */}
                  <div className="bg-secondary-dark mb-4 rounded p-4">
                    <div className="mb-2">
                      <span className="text-sm text-gray-400">Patient:</span>
                      <span className="ml-2 font-semibold text-white">
                        {selectedStudy.patientName || 'Unknown'}
                      </span>
                    </div>
                    <div className="mb-2">
                      <span className="text-sm text-gray-400">MRN:</span>
                      <span className="ml-2 text-white">{selectedStudy.patientId || 'N/A'}</span>
                    </div>
                    <div className="mb-2">
                      <span className="text-sm text-gray-400">Date:</span>
                      <span className="ml-2 text-white">{selectedStudy.studyDate || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-400">Case ID:</span>
                      <span className="ml-2 text-white">{addStudyToCaseId}</span>
                    </div>
                    {selectedStudy.hasCaseId && (
                      <div className="mt-3 rounded border border-yellow-500/50 bg-yellow-900/20 p-2">
                        <span className="text-xs text-yellow-300">
                          ⚠️ This study is already assigned to case &quot;
                          {selectedStudy.existingCaseId || selectedStudy.caseId}&quot;
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Clinical Phase Selector */}
                  <div className="mb-4">
                    <label className="mb-2 block text-sm text-gray-300">Clinical Phase:</label>
                    <select
                      value={selectedClinicalPhase}
                      onChange={e => setSelectedClinicalPhase(e.target.value)}
                      disabled={isEnrolling}
                      className="w-full rounded border border-gray-600 bg-black px-3 py-2 text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
                    >
                      {Object.entries(CLINICAL_PHASE_LABELS).map(([key, label]) => (
                        <option
                          key={key}
                          value={key}
                        >
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Error Message */}
                  {enrollError && (
                    <div className="mb-4 rounded border border-red-500/50 bg-red-900/30 p-3">
                      <span className="text-sm text-red-300">{enrollError}</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3">
                    <Button
                      onClick={() => {
                        setShowEnrollDialog(false);
                        setSelectedStudy(null);
                        setEnrollError(null);
                      }}
                      disabled={isEnrolling}
                      className="bg-secondary-dark hover:bg-secondary-light"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleEnrollStudy}
                      disabled={isEnrolling}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isEnrolling ? 'Adding...' : 'Confirm Add'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="border-secondary-light border-t px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  {activeTab === 'select'
                    ? searchQuery
                      ? `${filteredOrthancStudies.length} of ${orthancStudies.length} studies`
                      : `${orthancStudies.length} studies available`
                    : `${orthancStudies.length} studies available`}
                  {orthancStudies.filter(s => s.hasCaseId).length > 0 && (
                    <span className="ml-2 text-yellow-400">
                      ({orthancStudies.filter(s => s.hasCaseId).length} already assigned)
                    </span>
                  )}
                </div>
                <Button
                  onClick={() => setShowAddStudyModal(false)}
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

  // Get date parameters and validate format
  const startDateParam = params.get('startdate');
  const endDateParam = params.get('enddate');

  // Validate date format: must be a valid date string (at least 8 characters, YYYYMMDD or YYYY-MM-DD)
  const isValidDateString = dateStr => {
    if (!dateStr || dateStr.trim().length < 8) {
      return false;
    }
    // Check if it's YYYYMMDD format (8 digits)
    if (/^\d{8}$/.test(dateStr.trim())) {
      return true;
    }
    // Check if it's YYYY-MM-DD format (with hyphen)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
      return true;
    }
    return false;
  };

  const queryFilterValues = {
    patientName: params.get('patientname'),
    mrn: params.get('mrn'),
    studyDate: {
      startDate: isValidDateString(startDateParam) ? startDateParam : null,
      endDate: isValidDateString(endDateParam) ? endDateParam : null,
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
