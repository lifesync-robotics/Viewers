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

// 把前端 filterValues 映射成 /api/cases/search 接受的 query 参数
const buildCaseSearchParams = filters => {
  if (!filters) {
    console.warn('⚠️ buildCaseSearchParams: filters is null/undefined, using defaults');
    return { page: 1, limit: 100 };
  }

  // 将日期格式转换为 ISO 8601 格式 (YYYY-MM-DDTHH:mm:ssZ)
  // 支持 YYYYMMDD (8位数字) 和 YYYY-MM-DD (带连字符) 格式
  const convertDateToISO = dateStr => {
    if (!dateStr) {
      return undefined;
    }

    // 转换为字符串并去除空格
    const trimmed = String(dateStr).trim();

    // 如果为空字符串，返回 undefined
    if (trimmed.length === 0) {
      return undefined;
    }

    let year, month, day;

    // 处理 YYYY-MM-DD 格式（带连字符）
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-');
      if (parts.length !== 3) {
        console.warn('⚠️ Invalid date format with dashes, expected YYYY-MM-DD, got:', dateStr);
        return undefined;
      }
      year = parts[0].trim();
      month = parts[1].trim();
      day = parts[2].trim();

      // 检查每个部分是否完整
      if (year.length !== 4 || month.length !== 2 || day.length !== 2) {
        console.warn('⚠️ Incomplete date parts:', { year, month, day, original: dateStr });
        return undefined;
      }
    }
    // 处理 YYYYMMDD 格式（8位数字）
    else if (trimmed.length === 8 && /^\d{8}$/.test(trimmed)) {
      year = trimmed.substring(0, 4);
      month = trimmed.substring(4, 6);
      day = trimmed.substring(6, 8);
    }
    // 其他格式都不支持
    else {
      console.warn('⚠️ Invalid date format, expected YYYYMMDD or YYYY-MM-DD, got:', dateStr);
      return undefined;
    }

    // 验证年份（必须是4位数字，且年份合理）
    if (!/^\d{4}$/.test(year)) {
      console.warn('⚠️ Invalid year format:', year);
      return undefined;
    }
    const yearNum = parseInt(year, 10);
    if (yearNum < 1900 || yearNum > 2100) {
      console.warn('⚠️ Year out of reasonable range:', yearNum);
      return undefined;
    }

    // 验证月份和日期范围
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
    // 患者姓名：对应 ?patientName=，过滤空字符串
    patientName:
      filters.patientName && filters.patientName.trim() ? filters.patientName.trim() : undefined,

    // 病例号 / MRN：你在 filtersMeta 里用的是 'mrn'，过滤空字符串
    patientMRN: filters.mrn && filters.mrn.trim() ? filters.mrn.trim() : undefined,

    // 状态（如果你后面加 status 字段）
    status: filters.status && filters.status.trim() ? filters.status.trim() : undefined,

    // 检查日期范围：DateRange 组件返回的是 { startDate, endDate } 格式 (YYYYMMDD)
    // 需要转换为 ISO 8601 格式给后端 API
    // 确保日期值有效且不为空字符串
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

    // 分页：确保始终传递有效的分页参数，如果没有则使用默认值
    // 这样即使没有查询条件，也能正确返回分页结果
    page: filters.pageNumber && filters.pageNumber > 0 ? filters.pageNumber : 1,
    limit: filters.resultsPerPage && filters.resultsPerPage > 0 ? filters.resultsPerPage : 100, // 默认返回更多结果，如果没有查询条件

    // 是否包含 studies（如果 UI 将来加一个开关）
    includeStudies: filters.includeStudies || undefined,
  };

  // 移除所有 undefined、null 和空字符串值（但保留分页参数）
  Object.keys(params).forEach(key => {
    const value = params[key];
    if (value === undefined || value === null || value === '') {
      // 保留分页参数，即使它们可能是默认值
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

  // 检查是否有有效的查询参数（排除空值）
  const hasValidQueryParams = Object.keys(queryFilterValues).some(key => {
    const value = queryFilterValues[key];
    if (value === null || value === undefined || value === '') {
      return false;
    }
    // 检查日期对象：startDate 和 endDate 都必须有效
    if (typeof value === 'object' && value.startDate === null && value.endDate === null) {
      return false;
    }
    // 检查日期对象：如果 startDate 或 endDate 是空字符串，也不算有效
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

  // 清理无效的查询值（特别是日期字段）
  const cleanQueryFilterValues = values => {
    if (!values || typeof values !== 'object') {
      return defaultFilterValues;
    }

    const cleaned = { ...values };

    // 清理日期字段：确保 startDate 和 endDate 要么是有效的日期字符串，要么是 null
    if (cleaned.studyDate && typeof cleaned.studyDate === 'object') {
      const isValidDateString = dateStr => {
        if (!dateStr || dateStr === null || dateStr === '') {
          return false;
        }
        const str = String(dateStr).trim();
        if (str.length < 8) {
          return false;
        }
        // 检查是否是 YYYYMMDD 格式（8位数字）
        if (/^\d{8}$/.test(str)) {
          return true;
        }
        // 检查是否是 YYYY-MM-DD 格式（带连字符）
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

      // 如果两个日期都无效，设置为 null
      if (!cleaned.studyDate.startDate && !cleaned.studyDate.endDate) {
        cleaned.studyDate = { startDate: null, endDate: null };
      }
    }

    // 清理其他空字符串字段
    Object.keys(cleaned).forEach(key => {
      if (key !== 'studyDate' && (cleaned[key] === '' || cleaned[key] === null)) {
        cleaned[key] = defaultFilterValues[key] || null;
      }
    });

    return cleaned;
  };

  const [sessionQueryFilterValues, updateSessionQueryFilterValues] = useSessionStorage({
    key: 'queryFilterValues',
    // 只有在 URL 中有有效查询参数时才使用，否则使用默认值
    defaultValue: hasValidQueryParams
      ? cleanQueryFilterValues(queryFilterValues)
      : defaultFilterValues,
    // ToDo: useSessionStorage currently uses an unload listener to clear the filters from session storage
    // so on systems that do not support unload events a user will NOT be able to alter any existing filter
    // in the URL, load the page and have it apply.
    clearOnUnload: true,
  });

  // 合并默认值和 sessionStorage 的值，但优先使用 URL 参数（如果有）
  // 同时清理 sessionStorage 中的无效值
  const cleanedSessionValues = cleanQueryFilterValues(sessionQueryFilterValues);

  // 检查清理后的 sessionStorage 值是否与默认值相同
  const isSessionValuesSameAsDefault = Object.keys(defaultFilterValues).every(key => {
    if (key === 'studyDate') {
      return (
        cleanedSessionValues.studyDate?.startDate === defaultFilterValues.studyDate.startDate &&
        cleanedSessionValues.studyDate?.endDate === defaultFilterValues.studyDate.endDate
      );
    }
    return cleanedSessionValues[key] === defaultFilterValues[key];
  });

  // 如果没有有效的查询参数，且 sessionStorage 的值与默认值相同（或无效），使用默认值
  // 这样可以确保刷新页面时，如果没有查询参数，所有字段都是空的
  const initialFilterValues = hasValidQueryParams
    ? { ...defaultFilterValues, ...cleanQueryFilterValues(queryFilterValues) }
    : isSessionValuesSameAsDefault
      ? defaultFilterValues
      : { ...defaultFilterValues, ...cleanedSessionValues };

  // 最终检查：如果初始值与默认值相同，确保使用默认值
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

  // 如果 sessionStorage 中有无效值，清理它们（只在首次加载时检查）
  useEffect(() => {
    // 检查是否有无效的日期值需要清理
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
  }, []); // 只在组件挂载时执行一次

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
      setCasePagination(pagination || null); // 保存 pagination 信息
    } catch (error) {
      console.error('❌ Failed to load cases:', error);
      setCases([]);
      setCasePagination(null); // 出错时清空 pagination
    } finally {
      setLoadingCases(false);
    }
  }, [caseService, debouncedFilterValues, filterValues]);

  useEffect(() => {
    // 过滤条件变化后重新加载 Case 列表
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
        return _sortStringDates(s1, s2, sortModifier);
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

  // Filter studies by active case
  const filteredStudies = useMemo(() => {
    if (!activeCaseId || !activeCase) {
      return sortedStudies;
    }

    const caseStudyUIDs = (activeCase.studies || []).map(s => s.studyInstanceUID);
    return sortedStudies.filter(study => caseStudyUIDs.includes(study.studyInstanceUid));
  }, [sortedStudies, activeCaseId, activeCase]);

  // ~ Rows & Studies
  const [expandedRows, setExpandedRows] = useState([]);
  const [studiesWithSeriesData, setStudiesWithSeriesData] = useState([]);
  const [seriesDataForCases, setSeriesDataForCases] = useState(new Map()); // Map<studyUID, seriesData>
  const numOfStudies = studiesTotal;
  const caseCount = cases?.length || 0;
  // 在 cases 视图模式下，使用 pagination.totalCount 显示总数；如果没有 pagination，fallback 到当前页数量
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
  // TODO: 搜索功能暂时注释，后续实现
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
  const [selectedClinicalPhase, setSelectedClinicalPhase] = useState('PreOperativePlanning');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState(null);

  // 暂时直接使用 orthancStudies，不进行过滤
  // const filteredOrthancStudies = orthancStudies;

  const querying = useMemo(() => {
    return isLoadingData || expandedRows.length > 0;
  }, [isLoadingData, expandedRows]);

  // Custom upload function using /api/dicom/studies/upload
  const handleCustomUpload = useCallback(async () => {
    if (selectedFiles.length === 0) {
      alert('请选择至少一个文件');
      return;
    }

    if (!caseService) {
      alert('Case Service 未初始化');
      return;
    }

    // Confirm before upload if auto-enroll is enabled
    // if (autoEnroll && addStudyToCaseId) {
    //   const confirmMessage =
    //     `确认上传并注册到 Case？\n\n` +
    //     `Case ID: ${addStudyToCaseId}\n` +
    //     `临床阶段: ${clinicalPhase}\n` +
    //     `文件数量: ${selectedFiles.length} 个\n\n` +
    //     `上传完成后，study 将自动注册到该 Case。`;

    //   if (!window.confirm(confirmMessage)) {
    //     return; // User cancelled
    //   }
    // }

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

      // Add optional parameters if auto-enroll is enabled
      // if (autoEnroll && addStudyToCaseId) {
      //   formData.append('caseId', addStudyToCaseId.toString());
      //   formData.append('clinicalPhase', clinicalPhase);
      //   formData.append('autoEnroll', 'true');
      // }

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
        // Show success message
        const message = `✅ 上传成功！${result.studiesUploaded} 个 study 已上传到 Orthanc`;
        // const message =
        //   autoEnroll && result.enrollmentResults
        //     ? `✅ 上传并注册成功！${result.studiesUploaded} 个 study 已上传并注册到 Case`
        //     : `✅ 上传成功！${result.studiesUploaded} 个 study 已上传到 Orthanc`;

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

        // Refresh page data
        onRefresh();

        // Clear selected files
        setSelectedFiles([]);
        setUploadProgress({});

        // If auto-enrolled, close modal; otherwise, optionally switch to select tab
        // if (autoEnroll && result.enrollmentResults) {
        //   setShowAddStudyModal(false);
        // } else {
        //   // Optional: switch to select tab to see uploaded studies
        //   // setActiveTab('select');
        // }
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(`上传失败: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  }, [selectedFiles, addStudyToCaseId, caseService, onRefresh]);
  // }, [selectedFiles, autoEnroll, clinicalPhase, addStudyToCaseId, caseService, onRefresh]);

  // Load studies for a specific case (defined early for use in handleEnrollStudy)
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

    // 保存 caseId（统一转换为字符串用于比较）和当前的 studyCount
    const targetCaseId = String(addStudyToCaseId);
    
    // 保存添加前的 studyCount，用于后续验证（确保第二个及后续的 study 也能正确显示）
    const previousStudyCount = cases.find(c => String(c.caseId) === targetCaseId)?.studyCount || 0;
    const expectedCount = previousStudyCount + 1;

    try {
      await caseService.enrollStudy(
        addStudyToCaseId,
        selectedStudy.studyInstanceUID,
        selectedClinicalPhase
      );

      // Success - refresh both case list and study list
      setShowEnrollDialog(false);
      setShowAddStudyModal(false);
      setSelectedStudy(null);

      // 立即更新本地状态中的 studyCount，让 UI 立即反映变化
      setCases(prevCases => 
        prevCases.map(caseItem => {
          const caseIdStr = String(caseItem.caseId);
          if (caseIdStr === targetCaseId) {
            return { ...caseItem, studyCount: expectedCount };
          }
          return caseItem;
        })
      );

      // 然后重新加载以确保数据同步
      await loadCases();

      // 加载完成后，确保 studyCount 已正确更新
      // 如果服务器返回的 count 小于期望值，说明可能还没更新，使用我们手动增加的值
      setCases(prevCases => 
        prevCases.map(caseItem => {
          const caseIdStr = String(caseItem.caseId);
          if (caseIdStr === targetCaseId) {
            const serverCount = caseItem.studyCount || 0;
            // 如果服务器返回的 count 小于期望值，使用期望值
            // 否则使用服务器返回的值（可能已经正确更新了，甚至更多）
            return { 
              ...caseItem, 
              studyCount: serverCount >= expectedCount ? serverCount : expectedCount
            };
          }
          return caseItem;
        })
      );

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
    cases, // 添加 cases 到依赖项，以便获取 previousStudyCount
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

    // 在 cases 视图模式下，使用后端返回的 pagination 信息来判断
    if (viewMode === 'cases') {
      if (casePagination) {
        // 使用后端返回的 hasNext/hasPrev 来判断
        if (isNextPage && !casePagination.hasNext) {
          return; // 没有下一页，直接返回
        }
        if (isPrevPage && !casePagination.hasPrev) {
          return; // 没有上一页，直接返回
        }
      } else {
        console.warn('⚠️ No pagination info available in cases view mode');
      }
    } else {
      // 在 studies 视图模式下，使用原来的逻辑
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
      await caseService.updateCase(selectedCase.caseId, updates);
      await loadCases(); // Reload cases list
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
      // 暂时排除 sortBy 和 sortDirection，避免触发 404 错误（服务器没有对应的 API）
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
      cases.forEach(caseItem => {
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
                <div className="flex items-center gap-2 rounded bg-blue-900/20 px-2 py-1">
                  <Icons.Database className="h-5 w-5 text-blue-400" />
                  <span className="text-base font-bold text-blue-200">📁 {caseItem.caseId}</span>
                </div>
              ),
              // title: caseItem.caseId,
              gridCol: 6, // 恢复为 6，不调整
            },
            {
              key: 'patientName',
              content: (
                <span className="font-semibold text-white whitespace-nowrap">
                  {caseItem.patientName || 'Unknown Patient'}
                </span>
              ),
              gridCol: 3, // 从 2 增大到 3，避免长名字被截断
            },
            {
              key: 'mrn',
              content: (
                <span className="text-gray-300">
                  {caseItem.patientMRN || caseItem.patientInfo?.mrn || caseItem.mrn || 'N/A'}
                </span>
              ),
              gridCol: 5, // 保持不变
            },
            {
              key: 'createdAt',
              content: moment(caseItem.createdAt).format('MMM-DD-YYYY'),
              gridCol: 3, // 保持不变，日期格式固定
            },
            {
              key: 'studyCount',
              content: (
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <Icons.GroupLayers className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span>{caseItem.studyCount} studies</span>
                </div>
              ),
              gridCol: 3, // 保持不变，确保 "0 studies" 在一行显示
            },
            {
              key: 'actions',
              content: (
                <div className="flex items-center gap-0.5"> {/* 从 gap-1 改为 gap-0.5 */}
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
                      // setSearchQuery(''); // Reset search - TODO: 搜索功能暂时注释
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
                    className="flex items-center gap-1 rounded border border-green-500/30 bg-green-900/20 px-1 py-1 transition-colors hover:bg-green-900/50 whitespace-nowrap" // px-1.5 改为 px-1
                    title="Add Study to Case"
                  >
                    <Icons.Add className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                    <span className="text-xs text-green-300">Add Study</span>
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      // Transform case data to match EditCaseDialog's expected structure
                      const caseDataForDialog = {
                        caseId: caseItem.caseId,
                        patientInfo: {
                          mrn:
                            caseItem.patientMRN || caseItem.patientInfo?.mrn || caseItem.mrn || '',
                          name: caseItem.patientName || '',
                          dateOfBirth: caseItem.dateOfBirth || '',
                        },
                        status: caseItem.status || 'created',
                      };
                      setSelectedCase(caseDataForDialog);
                      setIsEditDialogOpen(true);
                    }}
                    className="flex items-center gap-1 rounded border border-blue-500/30 bg-blue-900/20 px-1 py-1 transition-colors hover:bg-blue-900/50 whitespace-nowrap" // px-1.5 改为 px-1
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
                    className="flex items-center gap-1 rounded border border-red-500/30 bg-red-900/20 px-1 py-1 transition-colors hover:bg-red-900/50 whitespace-nowrap" // px-1.5 改为 px-1
                    title="Delete Case"
                  >
                    <Icons.Cancel className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                    <span className="text-xs text-red-300">Del</span>
                  </button>
                </div>
              ),
              gridCol: 7, // 从 8 减小到 7，因为移除了 expandIcon 列，可以重新分配空间
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
                        <span className="text-sm">
                          {study.description || 'Study not in Orthanc'}
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
                    content: <span className="text-xs text-yellow-500">Not in worklist</span>,
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
                            .enrollStudy(activeCaseId, studyInstanceUid, clinicalPhase)
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
                // 清空所有查询条件
                const clearedFilters = { ...defaultFilterValues };
                setFilterValues(clearedFilters);
                updateSessionQueryFilterValues(clearedFilters);
                // 同时清空 URL 参数（暂时不包含 sortBy 和 sortDirection，避免 404 错误）
                const newSearchParams = new URLSearchParams();
                // TODO: 暂时注释掉排序参数的保留，避免触发 404 错误
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
                      上传方式：
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
                        // 上传完成后，刷新 Orthanc studies 列表
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
                                  description: study.studyDescription
                                }
                              );
                              console.log(`✅ Study added to case ${addStudyToCaseId}`);
                              setShowAddStudyModal(false);
                              window.location.reload();
                            } else {
                              // Refresh Orthanc studies list
                              const studies = await caseService.getAllOrthancStudies();
                              setOrthancStudies(studies);
                              // 可选：自动切换到 Select Study 标签页
                              // setActiveTab('select');
                            }
                          }
                          // 刷新页面数据
                          onRefresh();
                        } catch (err) {
                          console.error('Failed to reload Orthanc studies:', err);
                        } finally {
                          setLoadingOrthancStudies(false);
                        }
                      }}
                      onStarted={() => {
                        // 上传开始时，可以显示加载状态
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
                      {/* 自动注册功能已注释
                      <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
                        <label className="mb-3 flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={autoEnroll}
                            onChange={e => setAutoEnroll(e.target.checked)}
                            className="rounded"
                            disabled={isUploading}
                          />
                          <span className="font-semibold text-white">自动注册到当前 Case</span>
                        </label>
                        {autoEnroll && (
                          <div className="mt-3 space-y-3">
                            <div>
                              <label className="mb-2 block text-sm text-gray-300">临床阶段：</label>
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
                            {addStudyToCaseId && (
                              <div className="rounded border border-blue-500/30 bg-blue-900/20 p-3">
                                <div className="text-sm text-blue-300">
                                  <span className="font-semibold">将注册到 Case ID:</span>{' '}
                                  <span className="font-mono text-blue-200">
                                    {addStudyToCaseId}
                                  </span>
                                </div>
                              </div>
                            )}
                            <p className="text-xs text-gray-400">
                              勾选后，上传完成后会自动将 study 注册到当前 case
                            </p>
                          </div>
                        )}
                      </div>
                      */}

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
                          <div className="mb-2 text-sm text-blue-300">上传中，请稍候...</div>
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
                  {/* Search Bar - TODO: 搜索功能暂时注释，后续实现 */}
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
                        // TODO: 实现搜索功能
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

  // 获取日期参数，并验证格式
  const startDateParam = params.get('startdate');
  const endDateParam = params.get('enddate');

  // 验证日期格式：必须是有效的日期字符串（至少8个字符，YYYYMMDD 或 YYYY-MM-DD）
  const isValidDateString = dateStr => {
    if (!dateStr || dateStr.trim().length < 8) {
      return false;
    }
    // 检查是否是 YYYYMMDD 格式（8位数字）
    if (/^\d{8}$/.test(dateStr.trim())) {
      return true;
    }
    // 检查是否是 YYYY-MM-DD 格式（带连字符）
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
