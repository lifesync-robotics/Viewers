/**
 * ScrewManagementPanel Component
 *
 * Manages screw placements with viewport states and 3D models
 * - Save screw placements with radius, length, and transform data
 * - Restore screw placements (loads both viewport state and 3D model)
 * - Delete screws (removes both snapshot and 3D model)
 * - Save/Load surgical plans to/from database
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getRenderingEngine } from '@cornerstonejs/core';
import { crosshairsHandler } from '../../utils/crosshairsHandler';
import { getScrewColor } from '../../utils/screwColorScheme';
import { planningBackendService, anatomyService } from '../../services';
import { useScrewOperations } from '../../hooks';
import PlanSelectionDialog from './PlanSelectionDialog';
import ScrewSelectionDialog from './ScrewSelectionDialog';
import {
  Header,
  SessionStatus,
  LoadingScreen,
  CompactToolbar,
  ScrewListHeader,
  EmptyScrewList,
  ScrewTable,
  ScrewCard,
  InvalidScrewCard,
  ScrewManagementContainer,
  ScrewListContainer,
  ScrewListScrollArea,
  SessionStateDialog,
  CrosshairBookmarks,
} from './ScrewManagementUI';
import type { CrosshairBookmark, ScrewPlacementRequest } from './ScrewManagementUI';
import { jumpToPosition } from '../Registration/utils/fiducialUtils';
import { ToolGroupManager, addTool, state as cornerstoneToolsState } from '@cornerstonejs/tools';
import ScrewInteractionTool from '../../tools/ScrewInteractionTool';
import { vec3 } from 'gl-matrix';
import { findAdjacentScrew, createTransformWithAdjacentOrientation } from './adjacentScrewFinder';
import { parseVertebralLevel } from '../../utils/vertebralLevelUtils';

// Register ScrewInteractionTool globally (only once)
let screwToolRegistered = false;
function registerScrewInteractionTool() {
  console.log('🔧 [ScrewManagement] registerScrewInteractionTool() called');
  console.log('   screwToolRegistered:', screwToolRegistered);

  if (screwToolRegistered) {
    console.log('   Already registered, skipping');
    return true;
  }

  try {
    // Check if tool is already registered in cornerstoneTools state
    const existingTools = cornerstoneToolsState.tools;
    console.log('   cornerstoneToolsState.tools:', existingTools ? Object.keys(existingTools) : 'undefined');

    if (existingTools && existingTools[ScrewInteractionTool.toolName]) {
      console.log('✅ [ScrewManagement] ScrewInteractionTool already registered globally');
      screwToolRegistered = true;
      return true;
    }

    console.log('   Calling addTool(ScrewInteractionTool)...');
    console.log('   ScrewInteractionTool:', ScrewInteractionTool);
    console.log('   ScrewInteractionTool.toolName:', ScrewInteractionTool.toolName);

    addTool(ScrewInteractionTool);
    screwToolRegistered = true;
    console.log('✅ [ScrewManagement] ScrewInteractionTool registered globally SUCCESS!');
    return true;
  } catch (error) {
    console.error('❌ [ScrewManagement] addTool error:', error);
    if (error.message?.includes('already registered')) {
      console.log('✅ [ScrewManagement] ScrewInteractionTool already registered (caught)');
      screwToolRegistered = true;
      return true;
    } else {
      console.error('❌ [ScrewManagement] Failed to register ScrewInteractionTool:', error);
      return false;
    }
  }
}

// Try to register tool immediately when module loads
console.log('🚀 [ScrewManagement] Module loading - attempting early tool registration');
try {
  registerScrewInteractionTool();
} catch (e) {
  console.log('⚠️ [ScrewManagement] Early registration failed (will retry later):', e.message);
}

export default function ScrewManagementPanel({ servicesManager, commandsManager, extensionManager }) {
  const { viewportStateService, modelStateService, planeCutterService } = servicesManager.services;

  // Get caseId from URL parameters
  const [searchParams] = useSearchParams();
  const urlCaseId = searchParams.get('caseId');

  const [screws, setScrews] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [caseId, setCaseId] = useState(urlCaseId);

  // Use shared screw operations hook for consistent functionality
  const screwOps = useScrewOperations({
    servicesManager,
    sessionId,
    onScrewsUpdate: setScrews
  });
  const [studyInstanceUID, setStudyInstanceUID] = useState(null);
  const [seriesInstanceUID, setSeriesInstanceUID] = useState(null);
  const [surgeon, setSurgeon] = useState('OHIF User');
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'initializing' | 'ready' | 'error'>('initializing');
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showScrewDialog, setShowScrewDialog] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [showSessionStateDialog, setShowSessionStateDialog] = useState(false);
  const [backendSummary, setBackendSummary] = useState<any | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Screw Interaction Tool state
  const [isMoveToolActive, setIsMoveToolActive] = useState(false);
  const [selectedScrew, setSelectedScrew] = useState<{ label: string } | null>(null);
  const [modelCount, setModelCount] = useState(0);

  // Crosshair Bookmark state
  const [crosshairBookmarks, setCrosshairBookmarks] = useState<CrosshairBookmark[]>([]);
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<string | null>(null);

  // Screw dimension update state
  const [updatingScrewId, setUpdatingScrewId] = useState<string | null>(null);
  const [availableDiameters, setAvailableDiameters] = useState<number[]>([]);
  const [availableLengths, setAvailableLengths] = useState<number[]>([]);

  // Auto Screw Placement state
  const [selectedVertebraForAuto, setSelectedVertebraForAuto] = useState<string>('');
  const [isLoadingAutoPlacement, setIsLoadingAutoPlacement] = useState(false);

  // Vertebral levels state
  const [vertebralLevels, setVertebralLevels] = useState<string[]>([]);
  const [vertebralLevelsLoading, setVertebralLevelsLoading] = useState(false);
  const [vertebralLevelsError, setVertebralLevelsError] = useState<string | null>(null);
  
  // Segmentation availability state
  const [hasSegmentation, setHasSegmentation] = useState<boolean>(false);
  const [checkingSegmentation, setCheckingSegmentation] = useState<boolean>(true);

  // Debug: Log screws whenever they change
  useEffect(() => {
    console.log(`🔍 [ScrewManagement] Screws state changed. Count: ${screws.length}`);
    if (screws.length > 0) {
      console.log('🔍 [ScrewManagement] Screws data:', screws);
    }
  }, [screws]);

  // Keep ScrewInteractionTool's sessionId in sync
  useEffect(() => {
    if (!sessionId) return;

    console.log(`🔄 [ScrewManagement] SessionId changed, updating ScrewInteractionTool: ${sessionId}`);

    try {
      const allToolGroups = ToolGroupManager.getAllToolGroups();
      for (const toolGroup of allToolGroups) {
        const toolInstance = toolGroup.getToolInstance('ScrewInteraction');
        if (toolInstance && toolInstance.setSessionId) {
          toolInstance.setSessionId(sessionId);
          console.log(`✅ [ScrewManagement] ScrewInteractionTool sessionId updated to: ${sessionId}`);
        }
      }
    } catch (error) {
      console.warn('⚠️ [ScrewManagement] Could not update ScrewInteractionTool sessionId:', error);
    }
  }, [sessionId]);

  // useEffect(() => {
  //   initializeSession();
  // }, []);
  useEffect(() => {
    const clearFlagOnUnload = () => {
      sessionStorage.removeItem('ohif_new_plan_load');  // Clear flag on refresh/close
    };

    window.addEventListener('beforeunload', clearFlagOnUnload);

    return () => {
      window.removeEventListener('beforeunload', clearFlagOnUnload);
    };
  }, []);

  /**
   * Initialize planning session and load existing screws
   */
  const initializeSession = async () => {
    const CACHED_SESSION_KEY = 'ohif_planning_session_id';
    const NEW_LOAD_FLAG = 'ohif_new_plan_load';
    const FROM_CASE_FLAG = 'ohif_from_case';  // Flag set in WorkList

    // Check if coming from case
    const fromCase = localStorage.getItem(FROM_CASE_FLAG);

    if (fromCase === 'true') {
      // From case to plan: force new session
      sessionStorage.removeItem(NEW_LOAD_FLAG);  // Clear to trigger generation
      localStorage.removeItem(FROM_CASE_FLAG);  // Clear after use

      // Keep core rendering cleanup (remove unnecessary logic, such as extra logs)
      modelStateService.clearAllModels();
      viewportStateService.clearAll();
    }

    // Existing flag check for refresh
    const isNewLoad = !sessionStorage.getItem(NEW_LOAD_FLAG);
    if (isNewLoad) {
      sessionStorage.setItem(NEW_LOAD_FLAG, 'true');

      // Generate new session_id
      localStorage.removeItem(CACHED_SESSION_KEY);

      // Get DICOM UIDs (existing logic)
      const { displaySetService, viewportGridService } = servicesManager.services;
      const { activeViewportId, viewports } = viewportGridService.getState();
      const viewport = viewports.get(activeViewportId);

      let newStudyUID = null;
      let newSeriesUID = null;

      if (viewport && viewport.displaySetInstanceUIDs && viewport.displaySetInstanceUIDs.length > 0) {
        const displaySetInstanceUID = viewport.displaySetInstanceUIDs[0];
        const displaySet = displaySetService.getDisplaySetByUID(displaySetInstanceUID);
        if (displaySet) {
          newStudyUID = displaySet.StudyInstanceUID;
          newSeriesUID = displaySet.SeriesInstanceUID;
        }
      }

      if (!newStudyUID || !newSeriesUID) {
        newStudyUID = 'NO_STUDY_LOADED';
        newSeriesUID = 'NO_SERIES_LOADED';
      }

      const newCaseId = urlCaseId;
      const newSurgeon = 'OHIF User';

      const response = await planningBackendService.startSession({
        studyInstanceUID: newStudyUID,
        seriesInstanceUID: newSeriesUID,
        surgeon: newSurgeon,
        ...(newCaseId && { caseId: newCaseId })
      });

      if (response.success && response.session_id) {
        const newSessionId = response.session_id;
        localStorage.setItem(CACHED_SESSION_KEY, newSessionId);
        console.log('✅ New session generated on new load:', newSessionId);
      } else {
        console.error('❌ Failed to generate new session');
      }
    }

    // Load from cache
    setIsLoading(true);
    setSessionStatus('initializing');

    // Get real DICOM UIDs from active viewport (keep this part as is)
    const { displaySetService: dsService, viewportGridService: vgService } = servicesManager.services;  // Rename to avoid conflict if needed
    const { activeViewportId: avId, viewports: vps } = vgService.getState();
    const vp = vps.get(avId);

    let newStudyUID = null;
    let newSeriesUID = null;

    if (vp && vp.displaySetInstanceUIDs && vp.displaySetInstanceUIDs.length > 0) {
      const dsUid = vp.displaySetInstanceUIDs[0];
      const ds = dsService.getDisplaySetByUID(dsUid);

      if (ds) {
        newStudyUID = ds.StudyInstanceUID;
        newSeriesUID = ds.SeriesInstanceUID;
        console.log('✅ Got real DICOM UIDs from active viewport:');
        console.log(`   Study UID: ${newStudyUID}`);
        console.log(`   Series UID: ${newSeriesUID}`);
      }
    }

    // Fallback if no viewport data available
    if (!newStudyUID || !newSeriesUID) {
      console.warn('⚠️ Could not get DICOM UIDs from viewport, using placeholders');
      console.warn('   Make sure a study is loaded before using planning features');
      newStudyUID = 'NO_STUDY_LOADED';
      newSeriesUID = 'NO_SERIES_LOADED';
    }

    // Get case information from URL params
    const newCaseId = urlCaseId;
    const newSurgeon = 'OHIF User';

    // Store in state
    if (newCaseId && newCaseId !== caseId) {
      setCaseId(newCaseId);
    }
    setStudyInstanceUID(newStudyUID);
    setSeriesInstanceUID(newSeriesUID);
    setSurgeon(newSurgeon);

    console.log('🔄 Loading planning session from cache...');
    console.log(`   Case ID: ${newCaseId || 'none (session without case)'}`);

    const cachedSessionId = localStorage.getItem(CACHED_SESSION_KEY);

    if (cachedSessionId) {
      setSessionId(cachedSessionId);
      setSessionStatus('ready');
      console.log('✅ Loaded session from cache:', cachedSessionId);
      await loadScrews(cachedSessionId);
    } else {
      console.warn('❌ No cached session_id found. Please initialize from plan interface.');
      setSessionStatus('error');
      loadScrewsLocal();
    }

    setIsLoading(false);
  };

  useEffect(() => {
    initializeSession();
  }, []);

  // Add this new useEffect to reload screws on mount or sessionId change
  useEffect(() => {
    if (sessionId) {
      console.log('🔄 Reloading screws on mount or sessionId change');
      loadScrews(sessionId);
    }
  }, [sessionId]);

  // Subscribe to model state changes for auto-refresh (Bug 4 fix)
  useEffect(() => {
    if (!modelStateService) return;

    console.log('[ScrewManagement] Setting up model change subscriptions');

    // Subscribe to model changes
    const addSubscription = modelStateService.subscribe(
      modelStateService.EVENTS.MODEL_ADDED,
      () => {
        console.log('[ScrewManagement] Model added - refreshing screws');
        if (sessionId) loadScrews(sessionId);
      }
    );

    const removeSubscription = modelStateService.subscribe(
      modelStateService.EVENTS.MODEL_REMOVED,
      () => {
        console.log('[ScrewManagement] Model removed - refreshing screws');
        if (sessionId) loadScrews(sessionId);
      }
    );

    const updateSubscription = modelStateService.subscribe(
      modelStateService.EVENTS.MODEL_UPDATED,
      (eventData: any) => {
        console.log('[ScrewManagement] Model updated - refreshing screws');
        console.log('[SCREW_UPDATE_DEBUG] Event data:', eventData);
        
        // ═══════════════════════════════════════════════════════════════════════════
        // BUG FIX: Don't reload screws during screw position/rotation updates
        // ═══════════════════════════════════════════════════════════════════════════
        // When ScrewInteractionTool drags a screw, it updates the model transform
        // This triggers MODEL_UPDATED, which would reload ALL screws and jump camera
        // to each one (with the last screw winning the camera position)
        //
        // Solution: Only reload for non-transform updates (color, opacity, etc.)
        if (eventData?.property === 'position' || 
            eventData?.property === 'rotation' || 
            eventData?.property === 'transform') {
          console.log('[SCREW_UPDATE_DEBUG] Skipping screw reload for transform update');
          console.log('[SCREW_UPDATE_DEBUG] User is actively dragging/moving screw - camera should stay put!');
          return;
        }
        
        // For other updates (color, opacity, etc.), reload normally
        if (sessionId) loadScrews(sessionId);
      }
    );

    // Cleanup subscriptions on unmount
    return () => {
      if (addSubscription?.unsubscribe) addSubscription.unsubscribe();
      if (removeSubscription?.unsubscribe) removeSubscription.unsubscribe();
      if (updateSubscription?.unsubscribe) updateSubscription.unsubscribe();
    };
  }, [sessionId, modelStateService]);

  // Monitor for valid series ID detection after initial mount
  // This helps when DICOM loads after component mount
  useEffect(() => {
    if (seriesInstanceUID === 'NO_SERIES_LOADED') {
      console.log('⏳ [ScrewManagement] Waiting for DICOM series to load, setting up retry...');
      
      // Try to detect CT series ID periodically (not segmentation series)
      const retryInterval = setInterval(() => {
        try {
          const { displaySetService, viewportGridService } = servicesManager.services;
          const { activeViewportId, viewports } = viewportGridService.getState();
          const viewport = viewports.get(activeViewportId);

          if (viewport && viewport.displaySetInstanceUIDs && viewport.displaySetInstanceUIDs.length > 0) {
            // Check each display set in the viewport
            for (const displaySetInstanceUID of viewport.displaySetInstanceUIDs) {
              const displaySet = displaySetService.getDisplaySetByUID(displaySetInstanceUID);
              
              // Look for CT series (not segmentation)
              // AnatomyGuru needs the CT series ID, not the segmentation series ID
              if (displaySet && 
                  displaySet.SeriesInstanceUID && 
                  displaySet.Modality === 'CT') {
                
                const detectedSeriesUID = displaySet.SeriesInstanceUID;
                const detectedStudyUID = displaySet.StudyInstanceUID;
                
                console.log('✅ [ScrewManagement] CT series detected!');
                console.log(`   Study UID: ${detectedStudyUID}`);
                console.log(`   Series UID: ${detectedSeriesUID}`);
                console.log(`   Modality: ${displaySet.Modality}`);
                console.log(`   Description: ${displaySet.SeriesDescription || 'N/A'}`);
                
                // Update state with real UIDs
                setSeriesInstanceUID(detectedSeriesUID);
                setStudyInstanceUID(detectedStudyUID);
                
                // Clear the retry interval
                clearInterval(retryInterval);
                return; // Exit early
              }
            }
          }
        } catch (error) {
          console.warn('⚠️ [ScrewManagement] Error during series detection retry:', error);
        }
      }, 2000); // Check every 2 seconds

      // Clean up after 30 seconds (max 15 retries)
      const timeout = setTimeout(() => {
        clearInterval(retryInterval);
        console.warn('⏱️ [ScrewManagement] Series detection timeout - no CT series loaded after 30 seconds');
      }, 30000);

      // Cleanup function
      return () => {
        clearInterval(retryInterval);
        clearTimeout(timeout);
      };
    }
  }, [seriesInstanceUID, servicesManager]);

  /**
   * Load available screw dimensions from catalog
   */
  const loadAvailableDimensions = async () => {
    try {
      console.log('📦 Loading available screw dimensions from catalog...');
      const response = await fetch('http://localhost:3001/api/planning/catalog/screws');
      const data = await response.json();

      if (data.success && data.manufacturers) {
        const diameters = new Set<number>();
        const lengths = new Set<number>();

        data.manufacturers.forEach((mfr) => {
          mfr.screw_types?.forEach((st) => {
            st.variants?.forEach((variant) => {
              if (variant.diameter) diameters.add(variant.diameter);
              if (variant.length) lengths.add(variant.length);
            });
          });
        });

        // Also add dimensions from existing screws
        screws.forEach((screw) => {
          try {
            const displayInfo = getScrewDisplayInfo(screw);
            diameters.add(displayInfo.radius * 2);
            lengths.add(displayInfo.length);
          } catch (error) {
            // Skip invalid screws
          }
        });

        // Add common standard sizes if catalog is empty
        if (diameters.size === 0) {
          [3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0].forEach(d => diameters.add(d));
        }
        if (lengths.size === 0) {
          [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80].forEach(l => lengths.add(l));
        }

        setAvailableDiameters(Array.from(diameters).sort((a, b) => a - b));
        setAvailableLengths(Array.from(lengths).sort((a, b) => a - b));

        console.log(`✅ Loaded ${diameters.size} diameters and ${lengths.size} lengths`);
      } else {
        // Fallback: use common standard sizes
        setAvailableDiameters([3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0]);
        setAvailableLengths([20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80]);
        console.log('⚠️ Using fallback standard dimensions');
      }
    } catch (error) {
      console.error('❌ Failed to load available dimensions:', error);
      // Fallback: use common standard sizes
      setAvailableDiameters([3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0]);
      setAvailableLengths([20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80]);
    }
  };

  /**
   * Check if segmentation data is available for the current series
   * Uses getAvailableVertebrae to determine availability
   */
  const checkSegmentationAvailability = async () => {
    if (!seriesInstanceUID) {
      console.warn('⚠️ [ScrewManagement] No series ID available for segmentation check');
      setHasSegmentation(false);
      setCheckingSegmentation(false);
      setVertebralLevels([]);
      return;
    }

    setCheckingSegmentation(true);
    setVertebralLevelsLoading(true);
    
    try {
      console.log('🔍 [ScrewManagement] Checking segmentation availability for series:', seriesInstanceUID);

      // Use existing getAvailableVertebrae endpoint to check availability
      const response = await anatomyService.getAvailableVertebrae(seriesInstanceUID);

      if (response.success && response.vertebrae && response.vertebrae.length > 0) {
        setHasSegmentation(true);
        setVertebralLevels(response.vertebrae);
        console.log(`✅ [ScrewManagement] Segmentation available for series ${seriesInstanceUID}`);
        console.log(`   Vertebral levels found: ${response.count}`);
        console.log(`   Levels: ${response.vertebrae.join(', ')}`);
      } else {
        setHasSegmentation(false);
        setVertebralLevels([]);
        console.log(`ℹ️ [ScrewManagement] No segmentation data available for series ${seriesInstanceUID}`);
        console.log(`   Auto screw placement will be hidden`);
      }
    } catch (error) {
      console.error('❌ [ScrewManagement] Error checking segmentation availability:', error);
      setHasSegmentation(false);
      setVertebralLevels([]);
    } finally {
      setCheckingSegmentation(false);
      setVertebralLevelsLoading(false);
    }
  };


  /**
   * Group vertebral levels by anatomical region
   */
  const getVertebralLevelsByRegion = () => {
    const cervical = vertebralLevels.filter(level => level.startsWith('C'));
    const thoracic = vertebralLevels.filter(level => level.startsWith('T'));
    const lumbar = vertebralLevels.filter(level => level.startsWith('L'));
    const sacral = vertebralLevels.filter(level => level.startsWith('S'));

    return { cervical, thoracic, lumbar, sacral };
  };

  // Load available dimensions on mount
  useEffect(() => {
    loadAvailableDimensions();
  }, []);

  // Check segmentation availability when series changes
  // This also loads vertebral levels automatically
  useEffect(() => {
    // Only check if we have a valid series ID (not a placeholder)
    if (seriesInstanceUID && 
        seriesInstanceUID !== 'NO_SERIES_LOADED' && 
        !seriesInstanceUID.startsWith('NO_')) {
      console.log('🔍 [ScrewManagement] Valid series ID detected, checking segmentation...');
      checkSegmentationAvailability();
    } else if (seriesInstanceUID === 'NO_SERIES_LOADED') {
      console.log('⚠️ [ScrewManagement] Waiting for DICOM series to load...');
      setHasSegmentation(false);
      setCheckingSegmentation(false);
      setVertebralLevels([]);
    }
  }, [seriesInstanceUID]);

  // Update available dimensions when screws change
  useEffect(() => {
    if (screws.length > 0) {
      // Get getScrewDisplayInfo function reference (it's defined later in the component)
      // We'll use a safe approach by checking if it exists
      const updateDimensions = () => {
        const diameters = new Set(availableDiameters);
        const lengths = new Set(availableLengths);

        screws.forEach((screw) => {
          try {
            // Try to get dimensions from screw data directly
            const radius = parseFloat(screw.radius);
            const length = parseFloat(screw.length);
            if (!isNaN(radius) && radius > 0) {
              diameters.add(radius * 2);
            }
            if (!isNaN(length) && length > 0) {
              lengths.add(length);
            }
          } catch (error) {
            // Skip invalid screws
          }
        });

        const newDiameters = Array.from(diameters).sort((a, b) => a - b);
        const newLengths = Array.from(lengths).sort((a, b) => a - b);

        // Only update if there are changes to avoid infinite loops
        if (JSON.stringify(newDiameters) !== JSON.stringify(availableDiameters)) {
          setAvailableDiameters(newDiameters);
        }
        if (JSON.stringify(newLengths) !== JSON.stringify(availableLengths)) {
          setAvailableLengths(newLengths);
        }
      };

      updateDimensions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screws]);

  /**
   * Load screws from planning API
   */
  const loadScrews = async (sessionId) => {
    if (!sessionId) {
      console.warn('⚠️ No session ID available, cannot load screws');
      return;
    }

    try {
      console.log('📥 Loading screws from API...');

      const response = await planningBackendService.listScrews(sessionId);

      if (response.success) {
        setScrews(response.screws || []);
        console.log(`✅ Loaded ${response.screws?.length || 0} screws from API`);

        // Load screws into the viewport
        if (response.screws && response.screws.length > 0) {
          console.log('🔄 Auto-loading 3D models for all screws...');
          for (const screw of response.screws) {
            try {
              await restoreScrew(screw);
            } catch (error) {
              console.error(`❌ Failed to restore screw ${screw.screw_id || screw.id}:`, error);
            }
          }
          console.log('✅ All 3D models loaded');
        }
      } else {
        console.error('❌ Failed to load screws:', response.error);
        // Fallback to localStorage
        loadScrewsLocal();
      }
    } catch (error) {
      console.error('❌ Error loading screws:', error);
      // Fallback to localStorage
      loadScrewsLocal();
    }
  };

  /**
   * Load screws from localStorage (fallback)
   * Only loads if cached session_id matches current session_id
   */
  const loadScrewsLocal = () => {
    console.log('📁 Checking localStorage for cached screws...');

    // Get cached session_id from localStorage
    const CACHED_SESSION_KEY = 'ohif_planning_session_id';
    const cachedSessionId = localStorage.getItem(CACHED_SESSION_KEY);

    // Check if cached session_id matches current session_id
    if (cachedSessionId && sessionId && cachedSessionId === sessionId) {
      console.log('✅ Cached session_id matches current session_id');
      console.log(`   Cached: ${cachedSessionId.substring(0, 8)}...`);
      console.log(`   Current: ${sessionId.substring(0, 8)}...`);

      const allScrews = viewportStateService.getAllSnapshots();
      setScrews(allScrews);
      console.log(`✅ Loaded ${allScrews.length} screws from localStorage`);
    } else {
      console.log('⚠️ Session ID mismatch or missing - clearing cached screws and 3D models');
      console.log(`   Cached session_id: ${cachedSessionId || 'none'}`);
      console.log(`   Current session_id: ${sessionId || 'none'}`);

      // Clear cached screws if session_id doesn't match
      viewportStateService.clearAll();
      setScrews([]);

      // Clear all rendered 3D models (this is critical!)
      modelStateService.clearAllModels();
      console.log('🧹 Cleared cached screws and 3D models due to session mismatch');
    }
  };

  /**
   * Load and display a 3D screw model using the planning API
   * Now uses shared hook for consistency
   */
  const loadScrewModel = async (radius, length, transform, screwLabel = null, screwId = null) => {
    return screwOps.loadScrewModel(radius, length, transform, screwLabel, screwId);
  };

  /**
   * Load and display cap model using the planning API
   * Now uses shared hook for consistency
   */
  const loadCapModel = async (transform, length, screwLabel = null, screwId = null) => {
    return screwOps.loadCapModel(transform, length, screwLabel, screwId);
  };

  /**
   * Get the current 3D viewport ID
   * Now uses shared hook for consistency
   */
  const getCurrentViewportId = () => {
    return screwOps.getCurrentViewportId();
  };

  /**
   * Set viewport camera orientations based on screw axis directions
   * Called when user clicks "View" button to align viewports with screw orientation
   *
   * Screw transform matrix structure (4x4 in row-major order):
   * - X-axis (indices 0, 4, 8): Axial plane normal
   * - Y-axis (indices 1, 5, 9): Coronal plane normal (stored negated)
   * - Z-axis (indices 2, 6, 10): Sagittal plane normal
   *
   * @param transform - Screw transform matrix (16 elements, row-major)
   * @param screwPosition - Screw position [x, y, z] for camera focal point
   */
  const setViewportOrientationsFromScrew = (transform: number[], screwPosition: [number, number, number]) => {
    try {
      console.log('═══════════════════════════════════════════════════════');
      console.log('🎯 [setViewportOrientationsFromScrew] Setting viewport orientations from screw axes');
      console.log('═══════════════════════════════════════════════════════');

      if (!transform || transform.length !== 16) {
        console.warn('⚠️ Invalid transform matrix provided');
        return;
      }

      // Extract axis directions from transform matrix (row-major format)
      // X-axis: Column 0 (indices 0, 4, 8) → Axial plane normal
      // Y-axis: Column 1 (indices 1, 5, 9) → Coronal plane normal (stored negated, so we need to negate it back)
      // Z-axis: Column 2 (indices 2, 6, 10) → Sagittal plane normal
      const axialNormal: [number, number, number] = [
        transform[0],
        transform[4],
        transform[8]
      ];
      // IMPORTANT: Coronal normal is stored negated in the transform matrix
      // (see constructScrewTransform where it's negated before storage)
      // So we need to negate it back to get the original viewport direction
      const coronalNormal: [number, number, number] = [
        -transform[1],
        -transform[5],
        -transform[9]
      ];
      const sagittalNormal: [number, number, number] = [
        transform[2],
        transform[6],
        transform[10]
      ];

      // Normalize the vectors
      vec3.normalize(axialNormal, axialNormal);
      vec3.normalize(coronalNormal, coronalNormal);
      vec3.normalize(sagittalNormal, sagittalNormal);

      console.log(`📐 Axial normal (X-axis): [${axialNormal.map(v => v.toFixed(3)).join(', ')}]`);
      console.log(`📐 Coronal normal (Y-axis): [${coronalNormal.map(v => v.toFixed(3)).join(', ')}]`);
      console.log(`📐 Sagittal normal (Z-axis): [${sagittalNormal.map(v => v.toFixed(3)).join(', ')}]`);

      const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
      if (!renderingEngine) {
        console.warn('⚠️ No rendering engine found');
        return;
      }

      const viewports = renderingEngine.getViewports();
      if (viewports.length === 0) {
        console.warn('⚠️ No viewports found');
        return;
      }

      // Find and update each MPR viewport
      for (const viewport of viewports) {
        try {
          const viewportId = viewport.id.toLowerCase();
          const camera = viewport.getCamera();
          const { position: cameraPosition } = camera;

          // Calculate new camera position maintaining distance from focal point
          const viewDirection = vec3.sub(
            vec3.create(),
            cameraPosition as [number, number, number],
            camera.focalPoint as [number, number, number]
          );
          const distance = vec3.length(viewDirection);

          // Keep the original viewUp from DICOM series loading to avoid confusion and flipping
          const originalViewUp = camera.viewUp as [number, number, number];

          let newViewPlaneNormal: [number, number, number] | null = null;

          // Set viewPlaneNormal based on viewport type
          // viewUp is kept as the original value from DICOM series loading
          if (viewportId.includes('axial')) {
            newViewPlaneNormal = axialNormal;
            console.log(`✅ Setting axial viewport (${viewport.id}) orientation`);
            console.log(`   viewUp: Keeping original [${originalViewUp.map(v => v.toFixed(3)).join(', ')}]`);
          } else if (viewportId.includes('sagittal')) {
            newViewPlaneNormal = sagittalNormal;
            console.log(`✅ Setting sagittal viewport (${viewport.id}) orientation`);
            console.log(`   viewUp: Keeping original [${originalViewUp.map(v => v.toFixed(3)).join(', ')}]`);
          } else if (viewportId.includes('coronal')) {
            newViewPlaneNormal = coronalNormal;
            console.log(`✅ Setting coronal viewport (${viewport.id}) orientation`);
            console.log(`   viewUp: Keeping original [${originalViewUp.map(v => v.toFixed(3)).join(', ')}]`);
          }

          if (newViewPlaneNormal) {
            // Calculate new camera position
            const newPosition = vec3.add(
              vec3.create(),
              screwPosition,
              vec3.scale(vec3.create(), newViewPlaneNormal, distance)
            ) as [number, number, number];

            // Update camera - keep original viewUp to maintain DICOM series orientation
            viewport.setCamera({
              focalPoint: screwPosition,
              position: newPosition,
              viewPlaneNormal: newViewPlaneNormal,
              viewUp: originalViewUp,  // Keep original viewUp from DICOM loading
            });

            viewport.render();
            console.log(`   ✓ Updated camera for ${viewport.id}`);
          }
        } catch (error) {
          console.warn(`⚠️ Error updating viewport ${viewport.id}:`, error);
        }
      }

      console.log('✅ [setViewportOrientationsFromScrew] Completed');
    } catch (error) {
      console.error('❌ Error setting viewport orientations from screw:', error);
    }
  };

  /**
   * Construct screw transform matrix from viewport cameras and crosshair center
   *
   * Transform matrix structure (4x4 in row-major order):
   * - Column 0 [0:3, 0]: Axial plane normal (X-axis of screw coordinate system)
   * - Column 1 [0:3, 1]: Axial view up (Y-axis of screw coordinate system)
   * - Column 2 [0:3, 2]: Sagittal view normal (Z-axis of screw coordinate system)
   * - Column 3 [0:3, 3]: Crosshair center (translation/position)
   * - Row 3: [0, 0, 0, 1] (homogeneous coordinates)
   *
   * @returns Float32Array(16) - 4x4 transform matrix in row-major order, or null if data unavailable
   */
  const constructScrewTransform = () => {
    try {
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔧 [ScrewManagement] CONSTRUCTING SCREW TRANSFORM');
      console.log('═══════════════════════════════════════════════════════');

      // Step 1: Clear cache and get fresh crosshair data
      console.log('🔄 Clearing crosshair cache to get fresh data...');
      crosshairsHandler.clearCache();

      // Get crosshair center (translation)
      const crosshairCenter = crosshairsHandler.getCrosshairCenter();

      console.log('📋 Crosshair center received:', crosshairCenter);

      if (!crosshairCenter) {
        console.warn('⚠️ Crosshair center is not available');
        console.warn('💡 Hint: Activate the crosshairs tool from the toolbar and position it');
        return null;
      }

      const translation = crosshairCenter;
      console.log('✅ Crosshair center (translation):', translation);

      // Step 2: Get rendering engine and viewports
      const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
      if (!renderingEngine) {
        console.error('❌ Rendering engine not found');
        return null;
      }

      // Step 3: Find axial and sagittal viewports
      let axialViewport = null;
      let sagittalViewport = null;
      let coronalViewport = null;

      const viewports = renderingEngine.getViewports();
      for (const vp of viewports) {
        const vpId = vp.id.toLowerCase();
        if (vpId.includes('axial')) {
          axialViewport = vp;
          console.log(`✅ Found axial viewport: ${vp.id}`);
        } else if (vpId.includes('sagittal')) {
          sagittalViewport = vp;
          console.log(`✅ Found sagittal viewport: ${vp.id}`);
        } else if (vpId.includes('coronal')) {
          coronalViewport = vp;
          console.log(`✅ Found coronal viewport: ${vp.id}`);
        }
      }

      if (!axialViewport || !sagittalViewport || !coronalViewport) {
        console.error('❌ Could not find required viewports (axial, sagittal, and coronal)');
        console.log('Available viewports:', viewports.map(vp => vp.id));
        return null;
      }

      // Step 4: Get camera data from viewports
      const axialCamera = axialViewport.getCamera();
      const sagittalCamera = sagittalViewport.getCamera();
      const coronalCamera = coronalViewport.getCamera();

      const axialNormal = axialCamera.viewPlaneNormal;
      const coronalNormal = [-coronalCamera.viewPlaneNormal[0], -coronalCamera.viewPlaneNormal[1], -coronalCamera.viewPlaneNormal[2]];
      const sagittalNormal = sagittalCamera.viewPlaneNormal;



      console.log('───────────────────────────────────────────────────────');
      console.log('📐 Camera vectors:');
      console.log('  Axial Normal (col 0):', axialNormal);
      console.log('  Coronal Normal (col 1, negated):', coronalNormal);
      console.log('  Sagittal Normal (col 2):', sagittalNormal);

      // Step 5: Construct 4x4 transform matrix in row-major order
      // Row-major layout for a 4x4 matrix:
      // [
      //   m00, m01, m02, m03,  <- Row 0
      //   m10, m11, m12, m13,  <- Row 1
      //   m20, m21, m22, m23,  <- Row 2
      //   m30, m31, m32, m33   <- Row 3
      // ]
      //
      // Where columns are:
      // Column 0 (m00, m10, m20, m30): Axial normal + 0
      // Column 1 (m01, m11, m21, m31): Axial up + 0
      // Column 2 (m02, m12, m22, m32): Sagittal normal + 0
      // Column 3 (m03, m13, m23, m33): Translation + 1

      const transform = new Float32Array([
        // Row 0: X-components of basis vectors + translation X
        axialNormal[0], coronalNormal[0], sagittalNormal[0], translation[0],

        // Row 1: Y-components of basis vectors + translation Y
        axialNormal[1], coronalNormal[1], sagittalNormal[1], translation[1],

        // Row 2: Z-components of basis vectors + translation Z
        axialNormal[2], coronalNormal[2], sagittalNormal[2], translation[2],

        // Row 3: Homogeneous coordinates
        0, 0, 0, 1
      ]);

      console.log('───────────────────────────────────────────────────────');
      console.log('✅ Transform matrix constructed (4x4 row-major):');
      console.log('  Row 0:', [transform[0], transform[1], transform[2], transform[3]]);
      console.log('  Row 1:', [transform[4], transform[5], transform[6], transform[7]]);
      console.log('  Row 2:', [transform[8], transform[9], transform[10], transform[11]]);
      console.log('  Row 3:', [transform[12], transform[13], transform[14], transform[15]]);
      console.log('═══════════════════════════════════════════════════════');

      return transform;

    } catch (error) {
      console.error('❌ Error constructing screw transform:', error);
      console.error('Stack:', error.stack);
      return null;
    }
  };

  /**
   * Reset crosshairs and viewports to anatomical default
   * 
   * Simplified version - just skip this step if it fails.
   * When no adjacent screw is found, the standard transform construction
   * from crosshairs/viewport will be used anyway.
   * 
   * @returns True if reset successful, false otherwise
   */
  const resetCrosshairsToAnatomical = (): boolean => {
    try {
      console.log('ℹ️ [ScrewManagement] Resetting view to anatomical (optional)');

      // Check if commandsManager is available
      if (!commandsManager) {
        console.warn('⚠️ CommandsManager not available - skipping reset');
        console.warn('   This is OK - will use current crosshair orientation');
        return false;
      }

      // Find the MPR tool group and temporarily enable Crosshairs for reset
      const allToolGroups = ToolGroupManager.getAllToolGroups();
      let mprToolGroup = null;
      let crosshairsWasDisabled = false;
      
      // Find MPR tool group with Crosshairs
      for (const tg of allToolGroups) {
        try {
          const crosshairsTool = tg.getToolInstance('Crosshairs');
          if (crosshairsTool && tg.id === 'mpr') {
            mprToolGroup = tg;
            const toolOptions = tg.getToolOptions('Crosshairs');
            crosshairsWasDisabled = toolOptions?.mode === 'Disabled';
            break;
          }
        } catch (e) {
          // Not in this group
        }
      }

      // Temporarily enable Crosshairs in MPR group for reset to work
      if (mprToolGroup && crosshairsWasDisabled) {
        try {
          mprToolGroup.setToolActive('Crosshairs');
        } catch (error) {
          console.warn('⚠️ Could not activate Crosshairs:', error.message);
        }
      }

      // Temporarily disable ScrewInteractionTool if it exists
      const toolGroupsWithScrewTool = [];
      
      for (const toolGroup of allToolGroups) {
        try {
          const screwTool = toolGroup.getToolInstance('ScrewInteraction');
          if (screwTool) {
            const toolOptions = toolGroup.getToolOptions('ScrewInteraction');
            const wasActive = toolOptions?.mode === 'Active';
            
            if (wasActive) {
              toolGroup.setToolDisabled('ScrewInteraction');
              toolGroupsWithScrewTool.push(toolGroup);
            }
          }
        } catch (error) {
          // Tool not in this group - that's fine
        }
      }

      // Try to reset viewport (should now work with Crosshairs active)
      try {
        commandsManager.runCommand('resetViewport');
      } catch (resetError) {
        console.warn('⚠️ Reset command failed:', resetError.message);
      }

      // Restore Crosshairs to Disabled if it was disabled before
      if (mprToolGroup && crosshairsWasDisabled) {
        try {
          mprToolGroup.setToolDisabled('Crosshairs');
        } catch (error) {
          console.warn('⚠️ Could not restore Crosshairs state:', error.message);
        }
      }

      // Re-enable ScrewInteractionTool if it was active
      for (const toolGroup of toolGroupsWithScrewTool) {
        try {
          toolGroup.setToolActive('ScrewInteraction', {
            bindings: [{ mouseButton: 1 }]
          });
        } catch (error) {
          // Ignore re-enable errors
        }
      }

      return true;
    } catch (error) {
      console.warn('⚠️ Error resetting view:', error.message);
      console.warn('   Continuing with current crosshair orientation');
      return false;
    }
  };

  /**
   * Construct screw transform with optional orientation from adjacent screw
   * 
   * If adjacent screw is provided, copies its orientation (rotation matrix)
   * while using the current crosshair position as the entry point.
   * 
   * If no adjacent screw, uses standard constructScrewTransform().
   * 
   * @param adjacentTransform - Optional transform matrix from adjacent screw
   * @returns Float32Array(16) - 4x4 transform matrix in row-major order, or null if data unavailable
   */
  const constructScrewTransformWithAdjacentOrientation = (
    adjacentTransform?: number[]
  ): Float32Array | null => {
    try {
      // Get current crosshair center (entry point for new screw)
      crosshairsHandler.clearCache();
      const crosshairCenter = crosshairsHandler.getCrosshairCenter();

      if (!crosshairCenter) {
        console.warn('⚠️ Crosshair center is not available');
        return null;
      }

      // If adjacent transform provided, use its orientation with new entry point
      if (adjacentTransform && adjacentTransform.length === 16) {
        console.log('═══════════════════════════════════════════════════════');
        console.log('🔧 [ScrewManagement] CONSTRUCTING TRANSFORM WITH ADJACENT ORIENTATION');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`📍 Entry point (crosshair): [${crosshairCenter.map(v => v.toFixed(2)).join(', ')}]`);
        console.log('📐 Copying orientation from adjacent screw');

        const newTransform = createTransformWithAdjacentOrientation(
          adjacentTransform,
          crosshairCenter as [number, number, number]
        );

        console.log('✅ Transform constructed with adjacent orientation:');
        console.log('  Row 0:', [newTransform[0], newTransform[1], newTransform[2], newTransform[3]]);
        console.log('  Row 1:', [newTransform[4], newTransform[5], newTransform[6], newTransform[7]]);
        console.log('  Row 2:', [newTransform[8], newTransform[9], newTransform[10], newTransform[11]]);
        console.log('  Row 3:', [newTransform[12], newTransform[13], newTransform[14], newTransform[15]]);
        console.log('═══════════════════════════════════════════════════════');

        return newTransform;
      }

      // No adjacent transform - use standard construction from viewport cameras
      console.log('ℹ️ No adjacent screw - using standard transform construction');
      return constructScrewTransform();
    } catch (error) {
      console.error('❌ Error constructing screw transform with adjacent orientation:', error);
      return null;
    }
  };

  /**
   * Get only screw body models, excluding cap models
   * Cap models are identified by modelName ending with "-Cap" or being "Screw Cap"
   */
  const getScrewBodyModels = () => {
    const allModels = modelStateService.getAllModels();
    return allModels.filter(model => {
      const modelName = model.metadata.name || '';
      return !modelName.endsWith('-Cap') && modelName !== 'Screw Cap';
    });
  };

  /**
   * Parse vertebral level and side from screw label
   * Format: "L3L" -> { level: "L3", side: "left" }
   *         "L3R" -> { level: "L3", side: "right" }
   *         "L3-L" -> { level: "L3", side: "left" }
   *         "L3-R" -> { level: "L3", side: "right" }
   *         "T5L" -> { level: "T5", side: "left" }
   *         "C7R" -> { level: "C7", side: "right" }
   */
  const parseLevelAndSideFromLabel = (label: string): { level: string; side: string } => {
    const trimmedLabel = label.trim();
    
    // Pattern 1: With separator (L3-L, L3-R, T5-L, etc.)
    // Matches: {level}-{side_abbr}, where level = L/T/C/S + number, side_abbr = L or R
    const patternWithSeparator = /^([LTCS]\d+)[-\s]([LR])$/i;
    const matchWithSeparator = trimmedLabel.match(patternWithSeparator);
    
    if (matchWithSeparator) {
      const level = matchWithSeparator[1].toUpperCase(); // L3, T5, C7, S1, etc.
      const sideAbbr = matchWithSeparator[2].toUpperCase(); // L or R
      const side = sideAbbr === 'L' ? 'left' : 'right';
      return { level, side };
    }
    
    // Pattern 2: Without separator (L3L, L3R, T5L, etc.)
    // Matches: {level}{side_abbr}, where level = L/T/C/S + number, side_abbr = L or R
    const patternWithoutSeparator = /^([LTCS]\d+)([LR])$/i;
    const matchWithoutSeparator = trimmedLabel.match(patternWithoutSeparator);
    
    if (matchWithoutSeparator) {
      const level = matchWithoutSeparator[1].toUpperCase(); // L3, T5, C7, S1, etc.
      const sideAbbr = matchWithoutSeparator[2].toUpperCase(); // L or R
      const side = sideAbbr === 'L' ? 'left' : 'right';
      return { level, side };
    }

    // If parsing fails, return default values
    console.warn(`⚠️ Cannot parse vertebral level and side from label "${label}", using default values`);
    return { level: 'Unknown', side: 'unknown' };
  };

  const saveScrew = async (screwData: {
    name: string;
    radius: number;
    length: number;
    source: 'custom' | 'catalog';
    variantId?: string;
    manufacturer?: string;
    screwType?: string;
    position?: [number, number, number];  // Optional: use specific position instead of crosshair
  }) => {
    try {
      const { name: screwLabel, radius: radiusValue, length: lengthValue, source, variantId, manufacturer, screwType, position } = screwData;

      console.log('💾 Saving screw:', screwData);
      console.log('📝 Screw label:', screwLabel);
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔍 [saveScrew] ANALYZING POSITION');
      console.log(`   Position parameter: ${position ? `[${position.map(v => v.toFixed(2)).join(', ')}]` : 'undefined (using crosshair or existing model)'}`);
      console.log('═══════════════════════════════════════════════════════');

      // Check if this screw already exists (has been dragged or loaded before)
      // If it exists, use its current transform instead of crosshair position
      let transformMatrix = null;
      const allScrewModels = modelStateService.getAllScrewModels();
      const existingScrewModel = allScrewModels.get(screwLabel) ||
                                  Array.from(allScrewModels.values())
                                    .find((m: any) => m.metadata.name === screwLabel);

      if (existingScrewModel) {
        console.log(`🔍 [saveScrew] Found existing screw model: ${existingScrewModel.metadata.id} (${existingScrewModel.metadata.name})`);
        console.log(`   Using current transform from existing model (preserves drag position)`);

        // Get current transform from the existing model
        const currentTransform = modelStateService.getScrewTransform(existingScrewModel.metadata.id);
        if (currentTransform && currentTransform.length === 16) {
          transformMatrix = new Float32Array(currentTransform);
          console.log(`   ✅ Using existing model transform: [${transformMatrix[3].toFixed(2)}, ${transformMatrix[7].toFixed(2)}, ${transformMatrix[11].toFixed(2)}]`);
        } else {
          console.warn(`   ⚠️ Could not get transform from existing model, falling back to crosshair`);
        }
      }

      // ═════════════════════════════════════════════════════════
      // STEP: ADJACENT SCREW ORIENTATION COPYING
      // ═════════════════════════════════════════════════════════
      // If no existing model, try to find adjacent screw for orientation copying
      let adjacentScrew = null;
      let adjacentScrewTransform = null;
      
      if (!transformMatrix) {
        console.log('═══════════════════════════════════════════════════════');
        console.log('🔍 [saveScrew] ADJACENT SCREW SEARCH - START');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`📝 New screw label: "${screwLabel}"`);
        
        // Parse vertebral level and side from screw label
        const { level, side } = parseLevelAndSideFromLabel(screwLabel);
        console.log(`📊 Parsed: level="${level}", side="${side}"`);
        
        // Debug: Show all existing screws
        console.log(`📋 Total existing screws in state: ${screws.length}`);
        if (screws.length > 0) {
          console.log('   Existing screws:');
          screws.forEach((s, idx) => {
            const sLevel = s.vertebral_level || s.vertebralLevel || 'N/A';
            const sSide = s.side || 'N/A';
            const sLabel = s.screw_label || s.name || s.screw_id || 'N/A';
            const hasTransform = (s.transform_matrix && s.transform_matrix.length === 16) ? '✅' : '❌';
            console.log(`   ${idx + 1}. ${sLabel} - ${sLevel} (${sSide}) - transform:${hasTransform}`);
          });
        } else {
          console.log('   ⚠️ No existing screws in state!');
        }
        
        // Only attempt adjacent screw search if we have valid level and side
        if (level && level !== 'Unknown' && side && side !== 'unknown') {
          console.log('───────────────────────────────────────────────────────');
          console.log('🔍 Searching for adjacent screw...');
          console.log(`   Target: ${level} (${side})`);
          console.log(`   Looking for: ${level}±1 on same side`);
          
          // Find adjacent screw (level ±1, same side)
          adjacentScrew = findAdjacentScrew(level, side, screws);
          
          if (adjacentScrew) {
            console.log('═══════════════════════════════════════════════════════');
            console.log('✅✅✅ ADJACENT SCREW FOUND! ✅✅✅');
            console.log('═══════════════════════════════════════════════════════');
            console.log(`   Adjacent screw ID: ${adjacentScrew.screw_id}`);
            console.log(`   Adjacent screw label: ${adjacentScrew.screw_label}`);
            console.log(`   Adjacent screw level: ${adjacentScrew.vertebralLevel} (${adjacentScrew.side})`);
            
            // 🎯 CRITICAL: Get transform from 3D model, NOT from backend!
            // Backend may have wrong/identity transform, but 3D model has the correct one
            console.log('   🔍 Looking for 3D model to get actual transform...');
            const allModels = modelStateService.getAllModels();
            const adjacentModel = allModels.find(
              (m: any) => m.metadata.name === adjacentScrew.screw_label || 
                         m.metadata.id === adjacentScrew.screw_id
            );
            
            if (adjacentModel) {
              console.log(`   ✅ Found 3D model: ${adjacentModel.metadata.id}`);
              const modelTransform = modelStateService.getScrewTransform(adjacentModel.metadata.id);
              if (modelTransform && modelTransform.length === 16) {
                adjacentScrewTransform = modelTransform;
                console.log('   ✅ Using transform from 3D model (REAL orientation)');
              } else {
                console.warn('   ⚠️ Could not get transform from 3D model, falling back to backend');
                adjacentScrewTransform = adjacentScrew.transform_matrix;
              }
            } else {
              console.warn('   ⚠️ 3D model not found in scene, using backend transform');
              console.warn('      This may be identity/placeholder if screw was just loaded');
              adjacentScrewTransform = adjacentScrew.transform_matrix;
            }
            
            if (adjacentScrewTransform && adjacentScrewTransform.length === 16) {
              console.log('   ');
              console.log('   📐 ADJACENT SCREW ROTATION MATRIX (3x3):');
              console.log(`      [${adjacentScrewTransform[0].toFixed(4)}, ${adjacentScrewTransform[1].toFixed(4)}, ${adjacentScrewTransform[2].toFixed(4)}]`);
              console.log(`      [${adjacentScrewTransform[4].toFixed(4)}, ${adjacentScrewTransform[5].toFixed(4)}, ${adjacentScrewTransform[6].toFixed(4)}]`);
              console.log(`      [${adjacentScrewTransform[8].toFixed(4)}, ${adjacentScrewTransform[9].toFixed(4)}, ${adjacentScrewTransform[10].toFixed(4)}]`);
              console.log('   ');
              console.log('   📍 Adjacent entry point: ' + 
                `[${adjacentScrewTransform[3].toFixed(2)}, ${adjacentScrewTransform[7].toFixed(2)}, ${adjacentScrewTransform[11].toFixed(2)}]`);
              console.log('   ');
              console.log('   🎯 WILL COPY THIS ROTATION TO NEW SCREW');
            } else {
              console.warn('   ⚠️ Adjacent screw has invalid transform matrix!');
              console.warn('   Transform:', adjacentScrewTransform);
              adjacentScrewTransform = null;
            }
            console.log('═══════════════════════════════════════════════════════');
          } else {
            console.log('═══════════════════════════════════════════════════════');
            console.log('❌ NO ADJACENT SCREW FOUND');
            console.log('═══════════════════════════════════════════════════════');
            console.log('ℹ️ Will reset to anatomical default and use crosshairs');
            // Reset crosshairs to anatomical default for consistent placement
            resetCrosshairsToAnatomical();
          }
        } else {
          console.log('═══════════════════════════════════════════════════════');
          console.log('⚠️ CANNOT PARSE VERTEBRAL LEVEL/SIDE FROM LABEL');
          console.log(`   Label: "${screwLabel}"`);
          console.log(`   Parsed level: "${level}"`);
          console.log(`   Parsed side: "${side}"`);
          console.log('   Using standard workflow (crosshairs only)');
          console.log('═══════════════════════════════════════════════════════');
        }
      } else {
        console.log('ℹ️ Using existing model transform - skipping adjacent screw search');
      }

      // If no existing model or couldn't get transform, construct new transform
      if (!transformMatrix) {
        console.log('═══════════════════════════════════════════════════════');
        console.log('🔧 [saveScrew] TRANSFORM CONSTRUCTION');
        console.log('═══════════════════════════════════════════════════════');
        
        // PRIORITY 1: If adjacent screw exists, use its orientation (regardless of position parameter)
        if (adjacentScrewTransform) {
          console.log('═══════════════════════════════════════════════════════');
          console.log('🎯🎯🎯 COPYING ORIENTATION FROM ADJACENT SCREW 🎯🎯🎯');
          console.log('═══════════════════════════════════════════════════════');
          
          // Determine entry point: use provided position OR get from crosshair
          let entryPoint: [number, number, number];
          if (position) {
            entryPoint = position as [number, number, number];
            console.log(`   Entry point: PROVIDED [${entryPoint[0].toFixed(2)}, ${entryPoint[1].toFixed(2)}, ${entryPoint[2].toFixed(2)}]`);
          } else {
            const crosshairPos = crosshairsHandler.getCrosshairCenter();
            if (!crosshairPos) {
              console.error('   ❌ No position provided and no crosshair - cannot construct transform');
              transformMatrix = null;
            } else {
              entryPoint = crosshairPos as [number, number, number];
              console.log(`   Entry point: CROSSHAIR [${entryPoint[0].toFixed(2)}, ${entryPoint[1].toFixed(2)}, ${entryPoint[2].toFixed(2)}]`);
            }
          }
          
          if (entryPoint) {
            console.log('   Method: createTransformWithAdjacentOrientation()');
            console.log('   Input: Adjacent rotation matrix + new entry point');
            
            transformMatrix = createTransformWithAdjacentOrientation(adjacentScrewTransform, entryPoint);
            
            if (transformMatrix) {
              console.log('✅ Transform constructed with adjacent orientation!');
              console.log('   ');
              console.log('   🔍 VERIFICATION - ROTATION MATRIX COMPARISON:');
              console.log('   ');
              console.log('   📐 SOURCE (Adjacent):');
              console.log(`      [${adjacentScrewTransform[0].toFixed(4)}, ${adjacentScrewTransform[1].toFixed(4)}, ${adjacentScrewTransform[2].toFixed(4)}]`);
              console.log(`      [${adjacentScrewTransform[4].toFixed(4)}, ${adjacentScrewTransform[5].toFixed(4)}, ${adjacentScrewTransform[6].toFixed(4)}]`);
              console.log(`      [${adjacentScrewTransform[8].toFixed(4)}, ${adjacentScrewTransform[9].toFixed(4)}, ${adjacentScrewTransform[10].toFixed(4)}]`);
              console.log('   ');
              console.log('   📐 TARGET (New Screw):');
              console.log(`      [${transformMatrix[0].toFixed(4)}, ${transformMatrix[1].toFixed(4)}, ${transformMatrix[2].toFixed(4)}]`);
              console.log(`      [${transformMatrix[4].toFixed(4)}, ${transformMatrix[5].toFixed(4)}, ${transformMatrix[6].toFixed(4)}]`);
              console.log(`      [${transformMatrix[8].toFixed(4)}, ${transformMatrix[9].toFixed(4)}, ${transformMatrix[10].toFixed(4)}]`);
              console.log('   ');
              
              // Check if matrices match
              const tolerance = 0.0001;
              let matricesMatch = true;
              const indices = [0,1,2,4,5,6,8,9,10]; // Rotation matrix indices
              for (const idx of indices) {
                if (Math.abs(adjacentScrewTransform[idx] - transformMatrix[idx]) > tolerance) {
                  matricesMatch = false;
                  break;
                }
              }
              
              if (matricesMatch) {
                console.log('   ✅✅✅ ROTATION MATRICES MATCH! ✅✅✅');
              } else {
                console.error('   ❌❌❌ ROTATION MATRICES DO NOT MATCH! ❌❌❌');
                console.error('   This means orientation copying FAILED!');
              }
              console.log('   ');
              console.log('   📍 New entry point: ' + 
                `[${transformMatrix[3].toFixed(2)}, ${transformMatrix[7].toFixed(2)}, ${transformMatrix[11].toFixed(2)}]`);
            } else {
              console.error('❌ Failed to construct transform with adjacent orientation!');
            }
          }
          console.log('═══════════════════════════════════════════════════════');
        }
        // PRIORITY 2: No adjacent screw - use position if provided
        else if (position) {
          console.log('📍 No adjacent screw - using specified position with crosshair orientation');
          transformMatrix = constructScrewTransformAtPosition(position);
        }
        // PRIORITY 3: No adjacent screw, no position - use standard crosshair
        else {
          console.log('📐 No adjacent screw, no position - using standard crosshair construction');
          transformMatrix = constructScrewTransform();
        }
        console.log('═══════════════════════════════════════════════════════');
      }

      if (transformMatrix) {
        console.log('═══════════════════════════════════════════════════════');
        console.log('✅ FINAL TRANSFORM MATRIX READY');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`   Entry point: [${transformMatrix[3].toFixed(2)}, ${transformMatrix[7].toFixed(2)}, ${transformMatrix[11].toFixed(2)}]`);
        console.log('   Rotation matrix validated above ↑');
        console.log('═══════════════════════════════════════════════════════');
      }

      if (!transformMatrix) {
        console.warn('⚠️ Could not construct transform matrix - crosshairs may not be active');
        console.warn('This usually means:');
        console.warn('- Crosshairs tool is not active');
        console.warn('- Required viewports (axial/sagittal) not found');
        console.warn('Proceeding to save without transform data');
      }

      // Convert Float32Array to regular array for JSON serialization
      const transform: number[] = transformMatrix ? Array.from(transformMatrix) : [];

      // CRITICAL: Store the original transform values IMMEDIATELY after creation
      const originalTransformForCap = transform && transform.length === 16
        ? {
            x: transform[3] as number,
            y: transform[7] as number,
            z: transform[11] as number,
            fullArray: transform instanceof Float32Array ? Array.from(transform) : [...transform] as number[]
          }
        : null;

      console.log('═══════════════════════════════════════════════════════');
      console.log('🔍 [saveScrew] TRANSFORM VALUES TRACKING');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`   Transform created: [${transform[3]?.toFixed(2) || 'N/A'}, ${transform[7]?.toFixed(2) || 'N/A'}, ${transform[11]?.toFixed(2) || 'N/A'}]`);
      if (originalTransformForCap) {
        console.log(`   Original transform stored for cap: [${originalTransformForCap.x.toFixed(2)}, ${originalTransformForCap.y.toFixed(2)}, ${originalTransformForCap.z.toFixed(2)}]`);
      }
      console.log('═══════════════════════════════════════════════════════');

      if (transform.length > 0) {
        console.log('✅ Screw transform captured from viewport cameras and crosshair center');
      } else {
        console.log('⚠️ Saving screw without transform data');
      }

      // ═════════════════════════════════════════════════════════
      // STEP 1: Save screw to planning API
      // ═════════════════════════════════════════════════════════
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔧 [ScrewManagement] SAVING SCREW TO PLANNING API');
      console.log('═══════════════════════════════════════════════════════');

      if (!sessionId) {
        console.error('❌ No active session. Cannot save screw.');
        console.error('   Session status:', sessionStatus);
        console.error('   Attempting to create session now...');

        // Try to create session now
        await initializeSession();

        // Check if session was created
        if (!sessionId) {
          alert('⚠️ Planning API not available.\n\nScrew will be saved locally only.\nCheck console for details.');
          // Continue with localStorage save as fallback
          console.warn('⚠️ Saving to localStorage only (no backend session)');
        } else {
          console.log('✅ Session created successfully, continuing with save...');
        }
      }

      // Get current viewport states for UI restoration
      const viewportStates = viewportStateService.getCurrentViewportStates();

      // Extract position and direction from transform matrix
      const entryPoint = transform ? {
        x: transform[3],  // Translation X (index 3)
        y: transform[7],  // Translation Y (index 7)
        z: transform[11]  // Translation Z (index 11)
      } : { x: 0, y: 0, z: 0 };

      // Extract direction from Y-axis of transform (column 1, indices 4, 5, 6)
      // This represents the screw's long axis
      const direction = transform ? [
        transform[4],  // Y-axis X component
        transform[5],  // Y-axis Y component
        transform[6]   // Y-axis Z component
      ] : [0, 1, 0];

      console.log('═══════════════════════════════════════════════════════');
      console.log('🔍 [saveScrew] DATA BEING SAVED TO BACKEND');
      console.log('═══════════════════════════════════════════════════════');
      console.log('📍 Extracted screw position (entryPoint):', entryPoint);
      console.log('🎯 Extracted screw direction:', direction);
      console.log('📊 transform_matrix (will be saved):', transform ? `[${transform[3].toFixed(2)}, ${transform[7].toFixed(2)}, ${transform[11].toFixed(2)}, ...]` : 'null');
      console.log('✅ entryPoint === transform_matrix translation:',
        transform ? (entryPoint.x === transform[3] && entryPoint.y === transform[7] && entryPoint.z === transform[11]) : 'N/A');
      console.log('═══════════════════════════════════════════════════════');

      // Construct screw variant ID based on source
      let screwVariantId;
      let notes;

      if (source === 'catalog' && variantId) {
        screwVariantId = variantId;
        notes = `Catalog screw from ${manufacturer} - ${screwType}: ${screwLabel}`;
        console.log(`📦 Using catalog screw variant: ${screwVariantId}`);
      } else {
        screwVariantId = `generated-${radiusValue}-${lengthValue}`;
        notes = `Custom screw: ${screwLabel}`;
        console.log(`⚙️ Using custom screw variant: ${screwVariantId}`);
      }

      const { level, side } = parseLevelAndSideFromLabel(screwLabel);
      console.log(`🏷️ Parsed from label "${screwLabel}": level=${level}, side=${side}`);

      // ═════════════════════════════════════════════════════════
      // TRAJECTORY ANGLES: Copy from adjacent screw if available
      // ═════════════════════════════════════════════════════════
      let convergenceAngle = 0;
      let cephaladAngle = 0;
      
      if (adjacentScrew && adjacentScrew.trajectory) {
        convergenceAngle = adjacentScrew.trajectory.convergenceAngle ?? 0;
        cephaladAngle = adjacentScrew.trajectory.cephaladAngle ?? 0;
        console.log(`📐 Copying trajectory angles: convergence=${convergenceAngle}°, cephalad=${cephaladAngle}°`);
      } else {
        console.log(`📐 Using default trajectory angles: convergence=0°, cephalad=0°`);
      }

      let savedScrewId = null;
      try {
        const response = await planningBackendService.addScrew({
          sessionId: sessionId,
          screw: {
            caseId: 'OHIF-CASE-' + Date.now(), // TODO: Get from actual case service
            radius: radiusValue,
            length: lengthValue,
            screwLabel: screwLabel,  // Send user's label
            screwVariantId: screwVariantId,
            // vertebralLevel: 'unknown',  // Could be auto-detected later
            // side: 'unknown',           // Could be auto-detected later
            vertebralLevel: level,
            side: side,
            entryPoint: entryPoint,    // Now extracted from crosshair position
            trajectory: {
              direction: direction,    // Now extracted from transform matrix
              insertionDepth: lengthValue,
              convergenceAngle: convergenceAngle,  // From adjacent screw or 0
              cephaladAngle: cephaladAngle         // From adjacent screw or 0
            },
            notes: notes,
            transformMatrix: transform,
            viewportStatesJson: JSON.stringify(viewportStates),
            placedAt: new Date().toISOString(),
            autoLabel: false
          }
        });

        if (!response.success) {
          throw new Error(response.error || 'Failed to save screw');
        }

        savedScrewId = response.screw_id;

        console.log(`✅ Screw saved to planning API: ${response.screw_id}`);

      } catch (apiError) {
        console.error('❌ Failed to save screw to API:', apiError);

        // Check if error is about maximum limit reached
        const errorMessage = apiError?.message || apiError?.error || String(apiError);
        console.log('🔍 Error message for limit check:', errorMessage);

        const isLimitError = errorMessage.toLowerCase().includes('maximum limit') ||
                            errorMessage.toLowerCase().includes('capacity') ||
                            errorMessage.toLowerCase().includes('maximum of') ||
                            errorMessage.toLowerCase().includes('screws reached') ||
                            errorMessage.toLowerCase().includes('cannot add screw');

        console.log('🔍 Is limit error?', isLimitError);

        if (isLimitError) {
          // Show the proper limit error message
          alert(`Maximum of 10 screws reached. Please delete some screws before adding more.`);
        } else {
          // Show generic error for other issues
          alert('Failed to save screw. Please check the console for details.');
        }
        return;
      }

      // ═════════════════════════════════════════════════════════
      // STEP 2: Load and display the 3D model
      // ═════════════════════════════════════════════════════════
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔧 [ScrewManagement] LOADING 3D MODEL');
      console.log('═══════════════════════════════════════════════════════');

       // Check model limit - only count screw body models, exclude cap models
       const screwBodyModels = getScrewBodyModels();
       const maxModels = 10; // Match Python backend MAX_SCREWS limit

       if (screwBodyModels.length >= maxModels) {
         console.warn(`⚠️ Maximum number of screws (${maxModels}) reached.`);
         alert(`Maximum of ${maxModels} screws reached. Please delete some screws before adding more.`);
         return;
       }

       const allModels = modelStateService.getAllModels();
       console.log(`📊 Current screw bodies: ${screwBodyModels.length}/${maxModels} (total models: ${allModels.length})`);

      // Load the 3D model using the new API
      // IMPORTANT: Pass savedScrewId so the model can be updated in backend session
      // CRITICAL: Create a deep copy of transform to prevent it from being modified
      const transformCopy = transform && transform.length === 16
        ? (transform instanceof Float32Array ? Array.from(transform) : [...transform])
        : transform;

      try {
        await loadScrewModel(radiusValue, lengthValue, transformCopy, screwLabel, savedScrewId);
        console.log(`✅ Model loaded successfully - Total: ${modelStateService.getAllModels().length}/${maxModels}`);

        // ═════════════════════════════════════════════════════════
        // Load cap model after loading screw body (cap doesn't count toward model limit)
        // CRITICAL: Use original transform (not the copy) for cap positioning
        // ═════════════════════════════════════════════════════════
        if (transform && transform.length === 16) {
          console.log('═══════════════════════════════════════════════════════');
          console.log('🔍 [saveScrew] BEFORE LOADING CAP MODEL');
          console.log('═══════════════════════════════════════════════════════');
          console.log(`   Current transform[7]: ${(transform[7] as number)?.toFixed(2) || 'N/A'}`);
          if (originalTransformForCap) {
            console.log(`   Original transform[7] (stored): ${originalTransformForCap.y.toFixed(2)}`);
            const currentY = transform[7] as number;
            if (Math.abs(currentY - originalTransformForCap.y) > 0.001) {
              console.error(`   ❌ ERROR: Transform[7] was modified before loading cap!`);
              console.error(`      Original: ${originalTransformForCap.y.toFixed(2)}`);
              console.error(`      Current: ${currentY.toFixed(2)}`);
              console.error(`      Difference: ${(currentY - originalTransformForCap.y).toFixed(2)}`);
            } else {
              console.log(`   ✅ Transform[7] preserved correctly`);
            }
          }
          console.log('═══════════════════════════════════════════════════════');

          // CRITICAL: Use the stored original transform, not the current transform variable
          const capTransformCopy: number[] = originalTransformForCap
            ? originalTransformForCap.fullArray
            : (transform instanceof Float32Array ? Array.from(transform) : [...transform] as number[]);

          console.log(`   Using cap transform: [${capTransformCopy[3].toFixed(2)}, ${capTransformCopy[7].toFixed(2)}, ${capTransformCopy[11].toFixed(2)}]`);

          try {
            await loadCapModel(capTransformCopy, lengthValue, screwLabel, savedScrewId);
            console.log(`✅ Cap model loaded successfully for screw "${screwLabel}"`);
          } catch (capError) {
            console.warn('⚠️ Could not load cap model:', capError.message);
            console.warn('⚠️ Cap model failed but screw model loaded successfully');
            // Don't throw - cap is optional, continue execution
          }
        } else {
          console.warn('⚠️ Skipping cap model load - no valid transform available');
        }
      } catch (modelError) {
        console.warn('⚠️ Could not load model:', modelError.message);
        console.warn('⚠️ Screw saved but model may not be visible');
      }

      // ═════════════════════════════════════════════════════════
      // STEP 3: Update UI
      // ═════════════════════════════════════════════════════════

      // Reload screws from API
      if (sessionId) {
        await loadScrews(sessionId);
      }

      console.log(`✅ Saved screw: "${screwLabel}" (R: ${radiusValue}mm, L: ${lengthValue}mm)`);

    } catch (error) {
      console.error('Failed to save screw:', error);
      alert('Failed to save screw. Please check the console for details.');
    }
  };

  const restoreScrew = async (screwData) => {
    try {
      setIsRestoring(true);

      const allModels = modelStateService.getAllModels();


      let displayInfo;
      try {
        displayInfo = getScrewDisplayInfo(screwData);
      } catch (error) {
        console.error('❌ Cannot restore screw - invalid dimensions:', error);
        alert(`Cannot restore screw: ${error.message}\n\nThis screw has invalid or missing dimensions and cannot be loaded.`);
        setIsRestoring(false);
        return;
      }

      console.log(`🔄 Restoring screw: "${displayInfo.label}"`);
      console.log(`   Source: ${displayInfo.source}`);
      console.log(`   Dimensions: R=${displayInfo.radius}mm, L=${displayInfo.length}mm`);

      // ═══════════════════════════════════════════════════════════
      // DEBUG: Compare entry_point with transform_matrix
      // ═══════════════════════════════════════════════════════════
      console.log('═══════════════════════════════════════════════════════');
      console.log('📊 [restoreScrew] BACKEND DATA COMPARISON');
      console.log('═══════════════════════════════════════════════════════');
      if (screwData.entry_point) {
        console.log(`   entry_point from backend: [${screwData.entry_point.x?.toFixed(2)}, ${screwData.entry_point.y?.toFixed(2)}, ${screwData.entry_point.z?.toFixed(2)}]`);
      }
      if (screwData.transform_matrix && Array.isArray(screwData.transform_matrix)) {
        const tm = screwData.transform_matrix;
        console.log(`   transform_matrix translation (row-major): [${tm[3]?.toFixed(2)}, ${tm[7]?.toFixed(2)}, ${tm[11]?.toFixed(2)}]`);
        // Check if they match
        if (screwData.entry_point) {
          const ep = screwData.entry_point;
          const match = Math.abs(ep.x - tm[3]) < 0.01 && Math.abs(ep.y - tm[7]) < 0.01 && Math.abs(ep.z - tm[11]) < 0.01;
          console.log(`   ✓ entry_point matches transform_matrix translation: ${match}`);
        }
      }
      console.log('═══════════════════════════════════════════════════════');

      // ═══════════════════════════════════════════════════════════
      // Get transform - API now returns it already parsed as array
      // ═══════════════════════════════════════════════════════════
      let transformArray = screwData.transform_matrix;

      console.log(`🔍 transform_matrix type: ${typeof transformArray}`);
      console.log(`🔍 transform_matrix is array: ${Array.isArray(transformArray)}`);
      console.log(`🔍 transform_matrix length: ${transformArray?.length}`);

      // Validate it's a proper array with 16 elements
      if (!transformArray || !Array.isArray(transformArray) || transformArray.length !== 16) {
        console.error(`❌ Invalid transform_matrix! Type: ${typeof transformArray}, Length: ${transformArray?.length}`);
        console.warn(`⚠️ Loading screw without transform - will appear at origin`);
        transformArray = null;
      } else {
        // Convert to Float32Array for VTK
        transformArray = new Float32Array(transformArray);
        console.log(`✅ Valid transform array converted to Float32Array`);
        console.log(`📐 Translation: (${transformArray[3].toFixed(2)}, ${transformArray[7].toFixed(2)}, ${transformArray[11].toFixed(2)})`);
      }

      // Check if model already exists for this screw
      const loadedModels = modelStateService.getAllModels();
      let modelExists = false;

      for (const model of loadedModels) {
        // PRIORITY 1: Check by name (which stores screwLabel) - most reliable exact match
        if (model.metadata.name && model.metadata.name === displayInfo.label) {
          modelExists = true;
          console.log(`ℹ️ Model already exists for screw "${displayInfo.label}"`);
          console.log(`   Existing model: ${model.metadata.id} (${model.metadata.name})`);
          console.log(`   Matched by name (exact match)`);
          console.log(`   Skipping model load to avoid duplicates`);
          break;
        }

        // FALLBACK: Check if model matches by dimensions/filename (for legacy models without custom names)
        const modelName = model.metadata.name.toLowerCase();
        if (modelName.includes(displayInfo.label.toLowerCase()) ||
            (displayInfo.radius && modelName.includes(displayInfo.radius.toString())) ||
            (displayInfo.length && modelName.includes(displayInfo.length.toString()))) {
          modelExists = true;
          console.log(`ℹ️ Model already exists for screw "${displayInfo.label}"`);
          console.log(`   Existing model: ${model.metadata.id} (${model.metadata.name})`);
          console.log(`   Matched by dimensions/filename (legacy)`);
          console.log(`   Skipping model load to avoid duplicates`);
          break;
        }
      }

      // Define maxModels outside the if block so it's available for the final log statement
      const maxModels = 10; // Match Python backend MAX_SCREWS limit

      // Only check limit if we need to load a new model
      // If model already exists, we can just restore viewport state (view/locate operation)
      if (!modelExists) {
        // Check if we've reached the maximum number of models - only count screw body models
        const screwBodyModels = getScrewBodyModels();

        if (screwBodyModels.length >= maxModels) {
          console.warn(`⚠️ Maximum number of screws (${maxModels}) reached. Cannot restore more screws.`);
          alert(`Maximum of ${maxModels} screws reached. Please delete some screws before restoring more.`);
          setIsRestoring(false);
          return;
        }

        // Load and display the 3D model
        const screwId = screwData.screw_id || screwData.id || null;
        console.log(`🔍 [loadScrews] Extracted screwId: ${screwId} from screwData:`, {
          'screw_id': screwData.screw_id,
          'id': screwData.id,
          'label': displayInfo.label
        });

        // ⚠️ SIMPLIFIED LOGIC: Only use transform_matrix (ignore entry_point)
        // Backend stores model origin position in transform_matrix
        // entry_point may be inconsistent due to backend logic
        console.log('═══════════════════════════════════════════════════════');
        console.log('🔄 [restoreScrew] LOADING SCREW (SIMPLIFIED)');
        console.log(`   Screw: ${displayInfo.label}`);
        console.log(`   Radius: ${displayInfo.radius}mm, Length: ${displayInfo.length}mm`);
        console.log('═══════════════════════════════════════════════════════');
        console.log('📊 BACKEND DATA:');
        console.log(`   entry_point: [${screwData.entry_point?.x?.toFixed(2)}, ${screwData.entry_point?.y?.toFixed(2)}, ${screwData.entry_point?.z?.toFixed(2)}]`);
        console.log(`   transform_matrix translation: [${transformArray[3].toFixed(2)}, ${transformArray[7].toFixed(2)}, ${transformArray[11].toFixed(2)}]`);

        const ep = screwData.entry_point;
        const match = ep && Math.abs(ep.x - transformArray[3]) < 0.01 && Math.abs(ep.y - transformArray[7]) < 0.01 && Math.abs(ep.z - transformArray[11]) < 0.01;
        console.log(`   Match: ${match}`);

        if (!match && ep) {
          const diffX = ep.x - transformArray[3];
          const diffY = ep.y - transformArray[7];
          const diffZ = ep.z - transformArray[11];
          const magnitude = Math.sqrt(diffX*diffX + diffY*diffY + diffZ*diffZ);
          console.warn(`   ⚠️ BACKEND INCONSISTENCY DETECTED!`);
          console.warn(`      entry_point != transform_matrix`);
          console.warn(`      Difference: [${diffX.toFixed(2)}, ${diffY.toFixed(2)}, ${diffZ.toFixed(2)}]`);
          console.warn(`      Magnitude: ${magnitude.toFixed(2)}mm`);
          console.warn(`      → IGNORING entry_point, using transform_matrix only`);
        }

        console.log('───────────────────────────────────────────────────────');
        console.log(`   ✅ Using transform_matrix only (ignoring entry_point)`);
        console.log(`   Will call loadScrewModel with transform_matrix`);
        console.log('═══════════════════════════════════════════════════════');

        console.log(`🔧 [restoreScrew] Calling loadScrewModel...`);
        // Create a copy of transform to prevent modification
        const transformCopy = transformArray instanceof Float32Array ? Array.from(transformArray) : [...transformArray];
        await loadScrewModel(displayInfo.radius, displayInfo.length, transformCopy, displayInfo.label, screwId);
        console.log(`✅ [restoreScrew] loadScrewModel completed for ${displayInfo.label}`);

        // ═════════════════════════════════════════════════════════
        // Load cap model after loading screw body (cap doesn't count toward model limit)
        // CRITICAL: Use original transform (not the copy) for cap positioning
        // ═════════════════════════════════════════════════════════
        if (transformArray && transformArray.length === 16) {
          // Create a fresh copy for cap model to ensure it uses the original transform
          const capTransformCopy = transformArray instanceof Float32Array ? Array.from(transformArray) : [...transformArray];
          try {
            await loadCapModel(capTransformCopy, displayInfo.length, displayInfo.label, screwId);
            console.log(`✅ Cap model loaded successfully for screw "${displayInfo.label}"`);
          } catch (capError) {
            console.warn('⚠️ Could not load cap model:', capError.message);
            // Don't throw - cap is optional, continue execution
          }
        } else {
          console.warn(`⚠️ Skipping cap model load for "${displayInfo.label}" - no valid transform available`);
        }
      } else {
        console.log(`✅ Skipped loading duplicate model for "${displayInfo.label}"`);
      }

      // Restore viewport states if available
      if (screwData.viewport_states_json || screwData.viewportStates) {
        try {
          // API now returns viewport_states_json already parsed as object
          // Check if it's already an object or still a string
          let viewportStates = screwData.viewport_states_json || screwData.viewportStates;

          if (typeof viewportStates === 'string') {
            console.log('🔄 Parsing viewport_states_json from string');
            viewportStates = JSON.parse(viewportStates);
          }

          console.log('📊 Viewport states type:', typeof viewportStates);
          console.log('📊 Viewport IDs:', Object.keys(viewportStates || {}));

          viewportStateService.restoreViewportStates(viewportStates);
          console.log('✅ Viewport states restored');
        } catch (stateError) {
          console.warn('⚠️ Could not restore viewport states:', stateError);
          console.error('   Error details:', stateError);
        }
      }

      // ═══════════════════════════════════════════════════════════
      // Jump crosshairs to screw center position and update viewport cameras
      // ═══════════════════════════════════════════════════════════

      let screwPosition: [number, number, number] | null = null;
      let screwTransform: number[] | null = null;

      // ✅ PRIORITY 1: If model exists, use its current position and transform
      const existingModel = modelStateService.getAllModels().find(
        (m: any) => m.metadata.name === displayInfo.label
      );

      if (existingModel) {
        const currentTransform = modelStateService.getScrewTransform(existingModel.metadata.id);
        if (currentTransform && currentTransform.length === 16) {
          screwTransform = currentTransform;
          screwPosition = [
            currentTransform[3],
            currentTransform[7],
            currentTransform[11]
          ];
          console.log(`🎯 Using current model position: [${screwPosition.map(v => v.toFixed(2)).join(', ')}]`);
        }
      }

      // ✅ PRIORITY 2: Fallback to backend data if model doesn't exist
      if (!screwPosition || !screwTransform) {
        if (transformArray && transformArray.length === 16) {
          screwTransform = Array.from(transformArray);
          screwPosition = [
            transformArray[3],
            transformArray[7],
            transformArray[11]
          ];
          console.log(`🎯 Using backend transform_matrix: [${screwPosition.map(v => v.toFixed(2)).join(', ')}]`);
        } else if (screwData.entry_point) {
          screwPosition = [
            screwData.entry_point.x,
            screwData.entry_point.y,
            screwData.entry_point.z
          ];
          console.log(`🎯 Using backend entry_point: [${screwPosition.map(v => v.toFixed(2)).join(', ')}]`);
        }
      }

      if (screwPosition) {
        console.log(`🎯 Jumping crosshairs to screw position: [${screwPosition.map(v => v.toFixed(2)).join(', ')}]`);
        try {
          const success = jumpToPosition(screwPosition, servicesManager);
          if (success) {
            console.log(`✅ Crosshairs positioned at screw position`);
          } else {
            console.warn(`⚠️ Crosshairs positioning may not have completed fully`);
          }
        } catch (jumpError) {
          console.warn('⚠️ Could not jump crosshairs to screw position:', jumpError);
        }

        // Update viewport camera orientations based on screw axes
        if (screwTransform && screwTransform.length === 16) {
          console.log(`🎯 Setting viewport orientations from screw axes`);
          try {
            setViewportOrientationsFromScrew(screwTransform, screwPosition);
            console.log(`✅ Viewport camera orientations set from screw axes`);
          } catch (orientationError) {
            console.warn('⚠️ Could not set viewport orientations from screw:', orientationError);
          }
        } else {
          console.warn('⚠️ Cannot set viewport orientations - no transform data available');
        }
      } else {
        console.warn('⚠️ Cannot jump crosshairs - no position data available');
      }

      console.log(`✅ Restored screw - Total models: ${modelStateService.getAllModels().length}/${maxModels}`);

    } catch (error) {
      console.error('Failed to restore screw:', error);
      alert('Failed to restore screw. Please check the console for details.');
    } finally {
      setIsRestoring(false);
    }
  };

  const deleteScrew = async (screwData) => {
    try {
      const screwId = screwData.screw_id || screwData.id || screwData.name;

      // Try to get display info, but allow deletion even if dimensions are invalid
      let displayInfo;
      try {
        displayInfo = getScrewDisplayInfo(screwData);
      } catch (error) {
        console.warn('⚠️ Deleting screw with invalid dimensions:', error);
        displayInfo = {
          label: screwId,
          source: 'unknown',
          radius: 0,
          length: 0,
          description: 'Invalid Data'
        };
      }

      console.log(`🗑️ Deleting screw: "${displayInfo.label}" (${screwId})`);
      console.log(`   Source: ${displayInfo.source}`);

      // Try to delete from API first
      if (sessionId && screwId) {
        try {
          console.log('🔍 [DeleteScrew] sessionId:', sessionId);
          console.log('   screwId:', screwId);

          const response = await planningBackendService.deleteScrew(screwId, sessionId);

          if (!response.success) {
            console.warn('⚠️ API delete failed, continuing with local cleanup:', response.error);
          } else {
            console.log('✅ Deleted screw from API');
          }
        } catch (apiError) {
          console.warn('⚠️ API delete failed, continuing with local cleanup:', apiError);
        }
      }

      // Remove associated 3D models
      const loadedModels = modelStateService.getAllModels();
      let modelsRemoved = 0;

      // Use displayInfo for better matching
      console.log(`   Looking for models with label="${displayInfo.label}", R=${displayInfo.radius}mm, L=${displayInfo.length}mm`);

      for (const model of loadedModels) {
        // PRIORITY 1: Check by name (which stores screwLabel) - most reliable exact match
        if (model.metadata.name && model.metadata.name === displayInfo.label) {
          console.log(`🗑️ Removing model: ${model.metadata.id} (${model.metadata.name}) - matched by name (exact match)`);
          modelStateService.removeModel(model.metadata.id);
          modelsRemoved++;
          break; // Found exact match, stop searching
        }
      }

      // FALLBACK: If no exact name match, try matching by dimensions/filename (for legacy models)
      if (modelsRemoved === 0) {
        for (const model of loadedModels) {
          const modelName = model.metadata.name.toLowerCase();

          // Check if model matches screw dimensions or partial label
          if ((displayInfo.radius && modelName.includes(displayInfo.radius.toString())) ||
              (displayInfo.length && modelName.includes(displayInfo.length.toString())) ||
              modelName.includes(displayInfo.label.toLowerCase())) {
            console.log(`🗑️ Removing model: ${model.metadata.id} (${model.metadata.name}) - matched by dimensions/filename`);
            modelStateService.removeModel(model.metadata.id);
            modelsRemoved++;
            break; // Remove only one model
          }
        }
      }

      // Step 2: Remove associated cap model (screw and cap are a pair)
      const updatedModels = modelStateService.getAllModels(); // Get updated list after removing screw body
      let capRemoved = false;

      // Try matching cap by modelId (format: `${screwId}-cap`)
      if (screwId) {
        const capModelId = `${screwId}-cap`;
        for (const model of updatedModels) {
          if (model.metadata.id === capModelId) {
            console.log(`🗑️ Removing cap model: ${model.metadata.id} (${model.metadata.name}) - matched by modelId`);
            modelStateService.removeModel(model.metadata.id);
            modelsRemoved++;
            capRemoved = true;
            break;
          }
        }
      }

      // Try matching cap by modelName (format: `${screwLabel}-Cap`)
      if (!capRemoved && displayInfo.label) {
        const capModelName = `${displayInfo.label}-Cap`;
        for (const model of updatedModels) {
          if (model.metadata.name === capModelName) {
            console.log(`🗑️ Removing cap model: ${model.metadata.id} (${model.metadata.name}) - matched by modelName`);
            modelStateService.removeModel(model.metadata.id);
            modelsRemoved++;
            capRemoved = true;
            break;
          }
        }
      }

      // FALLBACK: Try matching cap by name pattern (contains "-Cap" suffix)
      if (!capRemoved && displayInfo.label) {
        for (const model of updatedModels) {
          const modelName = model.metadata.name || '';
          if (modelName.includes('-Cap') && modelName.includes(displayInfo.label)) {
            console.log(`🗑️ Removing cap model: ${model.metadata.id} (${model.metadata.name}) - matched by name pattern`);
            modelStateService.removeModel(model.metadata.id);
            modelsRemoved++;
            break;
          }
        }
      }



      console.log(`✅ Removed ${modelsRemoved} model(s)`);

      // Reload screws from API
      if (sessionId) {
        await loadScrews(sessionId);
      } else {
        loadScrewsLocal();
      }

      console.log(`✅ Deleted screw: "${displayInfo.label}"`);

    } catch (error) {
      console.error('Error deleting screw:', error);
      alert('Failed to delete screw. Please check the console for details.');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREW INTERACTION TOOL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Debug function to check screw interaction state and plane cutters
   */
  const debugScrewInteraction = async () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔍 [DEBUG] SCREW & PLANE CUTTER STATE');
    console.log('═══════════════════════════════════════════════════════');

    // Check models
    const allModels = modelStateService.getAllModels();
    console.log(`📦 Loaded models: ${allModels.length}`);
    allModels.forEach((model, i) => {
      console.log(`   ${i + 1}. ${model.metadata?.name || model.metadata?.id}`);
      console.log(`      - fileUrl: ${model.metadata?.fileUrl || 'unknown'}`);
      console.log(`      - hasPolyData: ${!!model.polyData}`);
      console.log(`      - hasActor: ${!!model.actor}`);
    });

    // Check screws from API
    console.log(`\n🔩 Screws from API: ${screws.length}`);
    screws.forEach((screw, i) => {
      console.log(`   ${i + 1}. ${screw.screw_label || screw.name || 'unnamed'}`);
    });

    // Check PlaneCutterService
    console.log(`\n🔪 PlaneCutterService:`);
    if (planeCutterService) {
      console.log(`   - isEnabled: ${planeCutterService.getIsEnabled()}`);
      const planeCutters = planeCutterService.getPlaneCutters?.() || [];
      console.log(`   - planeCutters count: ${planeCutters.length}`);
      planeCutters.forEach((pc, i) => {
        console.log(`   ${i + 1}. viewportId: ${pc.viewportId}, orientation: ${pc.orientation}`);
        console.log(`      - modelCutters: ${pc.modelCutters?.size || 0}`);
      });

      // Try to reinitialize if no plane cutters
      if (planeCutters.length === 0) {
        console.log('\n⚠️ No plane cutters found! Attempting to initialize...');
        try {
          await planeCutterService.initialize();
          planeCutterService.enable();
          console.log('✅ Plane cutters initialized and enabled');
        } catch (error) {
          console.error('❌ Failed to initialize plane cutters:', error);
        }
      }
    } else {
      console.log(`   ❌ PlaneCutterService not available!`);
    }

    // Check viewports
    console.log(`\n🖼️ Available Viewports:`);
    const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
    if (renderingEngine) {
      const viewports = renderingEngine.getViewports();
      viewports.forEach((vp, i) => {
        console.log(`   ${i + 1}. ${vp.id} (type: ${vp.type})`);
      });
    }

    // Check tool groups
    const allToolGroups = ToolGroupManager.getAllToolGroups();
    console.log(`\n🛠️ Tool groups: ${allToolGroups.length}`);
    allToolGroups.forEach((tg, i) => {
      console.log(`   ${i + 1}. ${tg.id}`);
      const viewportIds = tg.getViewportIds?.() || [];
      console.log(`      viewports: ${viewportIds.join(', ')}`);
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST INSIDE/OUTSIDE DETECTION using crosshair position
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n🎯 TESTING INSIDE/OUTSIDE DETECTION:');
    console.log('───────────────────────────────────────────────────────');

    // Get crosshair center position
    const crosshairCenter = crosshairsHandler.getCrosshairCenter();
    if (crosshairCenter) {
      console.log(`📍 Crosshair position: [${crosshairCenter.map(v => v.toFixed(2)).join(', ')}]`);

      // Test if crosshair position is inside any screw
      if (modelStateService.findScrewAtPoint) {
        const result = modelStateService.findScrewAtPoint(crosshairCenter as [number, number, number]);
        if (result) {
          console.log(`✅ Crosshair is INSIDE screw: ${result.screwLabel} (${result.part})`);
        } else {
          console.log(`❌ Crosshair is NOT inside any screw`);
        }
      } else {
        console.log(`⚠️ findScrewAtPoint method not available on modelStateService`);
      }
    } else {
      console.log(`⚠️ Could not get crosshair position`);
    }

    console.log('═══════════════════════════════════════════════════════');

    // Show alert with summary
    const planeCutters = planeCutterService?.getPlaneCutters?.() || [];
    alert(`Debug Info:\n\nModels: ${allModels.length}\nScrews (API): ${screws.length}\nPlaneCutters: ${planeCutters.length}\nPlaneCutter Enabled: ${planeCutterService?.getIsEnabled()}\n\nCheck console for details.`);
  };

  /**
   * Toggle the Screw Interaction Tool (Move Screw)
   * When active, users can click and drag screws on MPR planes
   */
  const toggleMoveTool = () => {
    try {
      // First, ensure the tool is registered globally with cornerstoneTools
      registerScrewInteractionTool();

      const toolName = 'ScrewInteraction';

      // Get all tool groups and find one that has viewports
      const allToolGroups = ToolGroupManager.getAllToolGroups();
      console.log('📋 [ScrewManagement] All tool groups:', allToolGroups.map(g => `${g.id} (${g.getViewportIds?.()?.length || 0} viewports)`));

      // Find the tool group that contains MPR viewports (fourUpMesh viewports)
      let foundToolGroup = null;

      for (const tg of allToolGroups) {
        const viewportIds = tg.getViewportIds?.() || [];
        console.log(`   Checking "${tg.id}": ${viewportIds.length} viewport(s)`);

        // Check if this tool group has MPR viewports
        const hasMPRViewports = viewportIds.some(vpId =>
          vpId.includes('mpr') || vpId.includes('axial') || vpId.includes('coronal') || vpId.includes('sagittal')
        );

        if (hasMPRViewports && viewportIds.length > 0) {
          foundToolGroup = tg;
          console.log(`✅ [ScrewManagement] Found tool group with MPR viewports: ${tg.id}`);
          break;
        }

        // Also accept any tool group with viewports
        if (!foundToolGroup && viewportIds.length > 0) {
          foundToolGroup = tg;
        }
      }

      if (!foundToolGroup) {
        console.error('❌ [ScrewManagement] No tool group with viewports found!');
        console.error('   This usually means the viewports are not properly set up.');
        return;
      }

      const toolGroup = foundToolGroup;
      console.log(`✅ [ScrewManagement] Using tool group: ${toolGroup.id}`);

      // Check if tool is already in the tool group, if not add it
      let toolInstance = toolGroup.getToolInstance(toolName);
      if (!toolInstance) {
        console.log(`📦 [ScrewManagement] Adding ${toolName} to tool group`);
        try {
          toolGroup.addTool(toolName);
          toolInstance = toolGroup.getToolInstance(toolName);
        } catch (addError) {
          console.error(`❌ [ScrewManagement] Failed to add tool: ${addError.message}`);
        }
      }

      if (isMoveToolActive) {
        // Deactivate: Set to Passive (or Disabled)
        console.log('🔴 [ScrewManagement] Deactivating ScrewInteraction tool');
        try {
          toolGroup.setToolPassive(toolName);
        } catch (e) {
          toolGroup.setToolDisabled(toolName);
        }
        setIsMoveToolActive(false);
        setSelectedScrew(null);
      } else {
        // Activate: Set tool active with primary mouse button
        console.log('🟢 [ScrewManagement] Activating ScrewInteraction tool');
        // ═══════════════════════════════════════════════════════════════════════════
        // Explicitly deactivate Crosshairs tool (before activating ScrewInteraction)
        // ═══════════════════════════════════════════════════════════════════════════
        const activeToolName = toolGroup.getActivePrimaryMouseButtonTool();
        if (activeToolName === 'Crosshairs') {
          console.log('🔴 [ScrewManagement] Explicitly deactivating Crosshairs before activating ScrewInteraction');
          try {
            // Check Crosshairs configuration and decide whether to disable or set to passive based on config
            const crosshairsConfig = toolGroup.getToolConfiguration('Crosshairs');
            if (crosshairsConfig?.disableOnPassive) {
              toolGroup.setToolDisabled('Crosshairs');
              console.log('✅ [ScrewManagement] Crosshairs disabled (disableOnPassive=true)');
            } else {
              toolGroup.setToolPassive('Crosshairs');
              console.log('✅ [ScrewManagement] Crosshairs set to passive');
            }
          } catch (crosshairsError) {
            console.warn('⚠️ [ScrewManagement] Could not deactivate Crosshairs:', crosshairsError);
            // Continue even if failed, as setToolActive will automatically handle tool switching
          }
        }
        console.log(`   ToolGroup ID: ${toolGroup.id}`);
        console.log(`   ToolGroup viewportsInfo:`, toolGroup.viewportsInfo);

        // Log all viewports in this tool group
        const viewportIds = toolGroup.getViewportIds?.() || [];
        console.log(`   Viewports in toolGroup: ${viewportIds.length}`);
        viewportIds.forEach((vpId, i) => {
          console.log(`      ${i + 1}. ${vpId}`);
        });

        // Set the servicesManager on the tool instance
        if (toolInstance && toolInstance.setServicesManager) {
          toolInstance.setServicesManager(servicesManager);
          console.log('✅ [ScrewManagement] ServicesManager set on tool instance');
        } else {
          console.warn('⚠️ [ScrewManagement] Could not set servicesManager on tool');
          console.warn('   toolInstance:', toolInstance);
        }

        // Set the session ID on the tool instance for backend sync
        if (toolInstance && toolInstance.setSessionId && sessionId) {
          toolInstance.setSessionId(sessionId);
          console.log('✅ [ScrewManagement] SessionId set on tool instance:', sessionId);
        } else if (!sessionId) {
          console.warn('⚠️ [ScrewManagement] No sessionId available to set on tool');
        }

        // Log current tool states before activation
        console.log('📋 Current tool options in toolGroup:');
        const toolOptions = toolGroup.toolOptions;
        if (toolOptions) {
          Object.keys(toolOptions).forEach(tn => {
            console.log(`   - ${tn}: mode=${toolOptions[tn]?.mode}, bindings=${JSON.stringify(toolOptions[tn]?.bindings)}`);
          });
        }

        toolGroup.setToolActive(toolName, {
          bindings: [{ mouseButton: 1 }] // Left mouse button (Primary)
        });

        console.log('✅ [ScrewManagement] Tool activated with primary mouse button binding');

        // Verify activation
        const toolOptionsAfter = toolGroup.toolOptions;
        if (toolOptionsAfter && toolOptionsAfter[toolName]) {
          console.log(`   Tool mode after activation: ${toolOptionsAfter[toolName]?.mode}`);
          console.log(`   Tool bindings after activation: ${JSON.stringify(toolOptionsAfter[toolName]?.bindings)}`);
        }

        // Debug: Check which viewports are in this tool group
        console.log('');
        console.log('🔍 [DEBUG] Tool Group Viewport Check:');
        const toolGroupViewportIds = toolGroup.getViewportIds?.() || [];
        console.log(`   Tool group "${toolGroup.id}" has ${toolGroupViewportIds.length} viewport(s):`);
        toolGroupViewportIds.forEach((vpId, i) => {
          console.log(`      ${i + 1}. ${vpId}`);
        });

        // Check all viewports in rendering engine
        const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
        if (renderingEngine) {
          const allViewports = renderingEngine.getViewports();
          console.log(`   Rendering engine has ${allViewports.length} viewport(s):`);
          allViewports.forEach((vp, i) => {
            const isInToolGroup = toolGroupViewportIds.includes(vp.id);
            console.log(`      ${i + 1}. ${vp.id} (type: ${vp.type}) - ${isInToolGroup ? '✅ IN tool group' : '❌ NOT in tool group'}`);
          });
        }
        console.log('');
        console.log('⚠️ NOTE: ScrewInteraction tool will ONLY respond to clicks in viewports that are IN the tool group!');
        console.log('');

        setIsMoveToolActive(true);
      }
    } catch (error) {
      console.error('❌ [ScrewManagement] Error toggling move tool:', error);
    }
  };

  const testCrosshairDetection = () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🧪 [DEBUG] TESTING CROSSHAIR DETECTION');
    console.log('═══════════════════════════════════════════════════════');

    try {
      // Clear cache first
      crosshairsHandler.clearCache();
      console.log('✅ Cache cleared');

      // Get crosshair center (single shared center)
      const crosshairCenter = crosshairsHandler.getCrosshairCenter();

      console.log('📊 Crosshair Detection Results (Shared Center):');
      console.log('  - hasCenter:', !!crosshairCenter);
      console.log('  - center:', crosshairCenter);

      // Test with all MPR viewports (more reliable check)
      const mprData = crosshairsHandler.getAllMPRCrosshairCenters();
      console.log('📊 MPR Crosshair Centers (All Viewports):');

      let validViewportCount = 0;
      for (const [vpId, center] of Object.entries(mprData)) {
        console.log(`  ${vpId}:`, {
          center: center
        });
        if (center) {
          validViewportCount++;
        }
      }

      console.log(`📊 Valid viewports with crosshairs: ${validViewportCount}/${Object.keys(mprData).length}`);

      // Check rendering engines and viewports
      const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
      if (renderingEngine) {
        const viewports = renderingEngine.getViewports();
        console.log('📊 Available Viewports:', viewports.map(vp => ({
          id: vp.id,
          type: vp.type,
          element: !!vp.element
        })));
      } else {
        console.error('❌ Rendering engine not found');
      }

      // Log result to console
      if (crosshairCenter) {
        console.log('✅ Crosshairs Detected!');
        console.log(`Position: [${crosshairCenter[0].toFixed(2)}, ${crosshairCenter[1].toFixed(2)}, ${crosshairCenter[2].toFixed(2)}]`);
        console.log('Check browser console (F12) for detailed information.');
      } else {
        console.warn('❌ Crosshairs Not Detected');
        console.warn('The crosshairs tool may not be active or position data is unavailable.');
        console.warn('How to activate:');
        console.warn('1. Click the crosshairs icon in the toolbar');
        console.warn('2. Click and drag in any viewport');
        console.warn('3. Try this test again');
      }

      console.log('═══════════════════════════════════════════════════════');

    } catch (error) {
      console.error('❌ Error testing crosshair detection:', error);
      console.error('Stack:', error.stack);
    }
  };

  /**
   * Show session state dialog with comparison of UI state and backend state
   */
  const showSessionState = async () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 [SessionState] Opening session state dialog');
    console.log('═══════════════════════════════════════════════════════');

    // Open dialog immediately
    setShowSessionStateDialog(true);
    setSummaryLoading(true);
    setSummaryError(null);
    setBackendSummary(null);

    // Fetch backend summary if session exists
    if (sessionId) {
      try {
        console.log('📊 [SessionState] Fetching backend summary...');
        const response = await planningBackendService.getSessionSummary(sessionId);

        if (response.success && response.summary) {
          setBackendSummary(response.summary);
          console.log('✅ [SessionState] Backend summary loaded');
        } else {
          throw new Error(response.error || 'Failed to fetch session summary');
        }
      } catch (error) {
        console.error('❌ [SessionState] Error fetching backend summary:', error);
        setSummaryError(error.message || 'Failed to fetch backend summary');
      }
    } else {
      console.warn('⚠️ [SessionState] No active session ID');
      setSummaryError('No active session');
    }

    setSummaryLoading(false);
  };

  const editScrew = async (screwData) => {
    try {
      const screwId = screwData.screw_id || screwData.id || screwData.name;
      const displayInfo = getScrewDisplayInfo(screwData);

      console.log('✏️ Edit screw requested:', displayInfo.label);
      alert(`Edit functionality coming soon!\n\nScrew: ${displayInfo.label}\nRadius: ${displayInfo.radius}mm\nLength: ${displayInfo.length}mm\n\nFor now, please delete and recreate the screw with new values.`);

      // TODO: Implement edit functionality
      // - Open edit dialog with current values
      // - Update screw in backend
      // - Reload 3D model with new dimensions

    } catch (error) {
      console.error('Failed to edit screw:', error);
      alert('Failed to edit screw. Please check the console for details.');
    }
  };

  /**
   * Delete screw models (body and cap) by screw ID
   * Now uses shared hook for consistency
   */
  const deleteScrewModels = async (screwId: string, screwLabel: string, deleteCap: boolean = true) => {
    return screwOps.deleteScrewModels(screwId, screwLabel, deleteCap);
  };

  /**
   * Calculate screw transform from cap position
   * Now uses shared hook for consistency
   */
  const calculateScrewTransformFromCap = (capTransform: number[], newLength: number): number[] => {
    return screwOps.calculateScrewTransformFromCap(capTransform, newLength);
  };

  /**
   * Update screw diameter
   */
  const handleUpdateDiameter = async (screwData: any, newDiameter: number) => {
    const newRadius = newDiameter / 2;
    await updateScrewDimensions(screwData, newRadius, undefined);
  };

  /**
   * Update screw length
   */
  const handleUpdateLength = async (screwData: any, newLength: number) => {
    await updateScrewDimensions(screwData, undefined, newLength);
  };

  /**
   * Update screw dimensions (radius and/or length)
   * Now uses shared hook for consistency
   */
  const updateScrewDimensions = async (
    screwData: any,
    newRadius?: number,
    newLength?: number
  ) => {
    const screwId = screwData.screw_id || screwData.id;
    if (!screwId) {
      console.error('❌ Cannot update screw: no screw ID');
      alert('Cannot update screw: missing screw ID');
      return;
    }

    setUpdatingScrewId(screwId);

    try {
      await screwOps.updateScrewDimensions(screwData, newRadius, newLength);
      
      // Reload screws to refresh UI immediately (Bug 3 fix)
      if (sessionId) {
        await loadScrews(sessionId);
      }
      
      console.log(`✅ Successfully updated screw ${screwId}`);
    } catch (error) {
      console.error('❌ Failed to update screw dimensions:', error);
      alert(`Failed to update screw dimensions: ${error.message}\n\nPlease check the console for details.`);
    } finally {
      setUpdatingScrewId(null);
    }
  };

  const clearAllScrews = async () => {
    try {
      console.log('═══════════════════════════════════════════════════════');
      console.log('🧹 [ClearAll] Clearing all screws from frontend and backend');
      console.log('═══════════════════════════════════════════════════════');

      // Confirm action
      const confirmed = confirm(
        `⚠️ Clear All Screws?\n\n` +
        `This will permanently delete all ${screws.length} screw(s) from:\n` +
        `• Frontend UI\n` +
        `• 3D Models\n` +
        `• Backend Session\n\n` +
        `This action cannot be undone.\n\n` +
        `Continue?`
      );

      if (!confirmed) {
        console.log('❌ [ClearAll] User cancelled');
        return;
      }

      // Step 1: Delete all screws from backend
      if (sessionId) {
        console.log('🗑️ [ClearAll] Step 1: Deleting screws from backend...');
        const deleteResponse = await planningBackendService.deleteAllScrews(sessionId);

        if (deleteResponse.success) {
          console.log(`✅ [ClearAll] Deleted ${deleteResponse.deleted_count || 0} screws from backend`);
          if (deleteResponse.failed_screw_ids && deleteResponse.failed_screw_ids.length > 0) {
            console.warn(`⚠️ [ClearAll] Failed to delete ${deleteResponse.failed_screw_ids.length} screws from backend`);
          }
        } else {
          console.error('❌ [ClearAll] Failed to delete screws from backend:', deleteResponse.error);
          const continueAnyway = confirm(
            `⚠️ Backend Delete Failed\n\n` +
            `Failed to delete screws from backend:\n${deleteResponse.error}\n\n` +
            `Do you want to clear the frontend anyway?`
          );

          if (!continueAnyway) {
            console.log('❌ [ClearAll] User cancelled after backend error');
            return;
          }
        }
      } else {
        console.warn('⚠️ [ClearAll] No active session - skipping backend delete');
      }

      // Step 2: Clear all 3D models from frontend
      console.log('🗑️ [ClearAll] Step 2: Clearing all 3D models from frontend...');
      modelStateService.clearAllModels();
      console.log('✅ [ClearAll] 3D models cleared');

      // Step 3: Clear local viewport state
      console.log('🗑️ [ClearAll] Step 3: Clearing local viewport state...');
      viewportStateService.clearAll();
      console.log('✅ [ClearAll] Viewport state cleared');

      // Step 4: Reload screws from backend (should now be empty)
      console.log('🔄 [ClearAll] Step 4: Reloading screws from backend...');
      if (sessionId) {
        await loadScrews(sessionId);
      } else {
        loadScrewsLocal();
      }

      console.log('═══════════════════════════════════════════════════════');
      console.log('✅ [ClearAll] All screws cleared successfully!');
      console.log(`   Frontend screws: ${screws.length}`);
      console.log('═══════════════════════════════════════════════════════');

    } catch (error) {
      console.error('❌ [ClearAll] Error clearing all screws:', error);
      alert(`Failed to clear all screws: ${error.message}\n\nCheck console for details.`);
    }
  };

  /**
   * Save current planning session as a plan
   */
  const savePlan = async () => {
    if (!sessionId || !studyInstanceUID || !seriesInstanceUID) {
      alert('Cannot save plan: Missing session or DICOM information');
      return;
    }

    if (screws.length === 0) {
      alert('Cannot save plan: No screws placed yet');
      return;
    }

    try {
      setIsSavingPlan(true);

      // Prompt for plan name
      const planName = prompt('Enter a name for this plan:', `Plan ${new Date().toLocaleString()}`);
      if (!planName) {
        setIsSavingPlan(false);
        return; // User cancelled
      }

      console.log('💾 Saving plan...');
      console.log(`   Session ID: ${sessionId}`);
      console.log(`   Case ID: ${caseId || 'none (standalone plan)'}`);
      console.log(`   Screws: ${screws.length}`);

      // Use caseId from URL params if available
      // Plans can be saved without a case (standalone plans)
      const effectiveCaseId = caseId || null;

      if (!effectiveCaseId) {
        const userConfirmed = confirm(
          '⚠️ No case is currently selected.\n\n' +
          'This plan will be saved as a standalone plan (not associated with any case).\n\n' +
          'To associate plans with cases, please open planning from a case in the WorkList.\n\n' +
          'Continue saving as standalone plan?'
        );

        if (!userConfirmed) {
          setIsSavingPlan(false);
          return; // User cancelled
        }

        console.log('ℹ️ Saving as standalone plan (no case association)');
      }

      const response = await planningBackendService.savePlan({
        sessionId,
        caseId: effectiveCaseId,
        studyInstanceUID,
        seriesInstanceUID,
        planData: {
          name: planName,
          description: `Plan with ${screws.length} screws`,
          surgeon
        }
      });

      if (response.success) {
        console.log('✅ Plan saved successfully:', response.plan_id);
        alert(`Plan saved successfully!\nPlan ID: ${response.plan_id}`);
      } else {
        throw new Error(response.error || 'Failed to save plan');
      }
    } catch (error) {
      console.error('❌ Error saving plan:', error);
      alert(`Failed to save plan: ${error.message}`);
    } finally {
      setIsSavingPlan(false);
    }
  };

  /**
   * Get display name and metadata for a screw
   * Throws error if radius/length are missing (no defaults)
   */
  const getScrewDisplayInfo = (screw) => {
    // Validate required fields
    if (!screw.radius || !screw.length) {
      const screwId = screw.screw_id || screw.name || 'unknown';
      throw new Error(
        `❌ Missing required screw dimensions for screw: ${screwId}\n` +
        `   radius: ${screw.radius}, length: ${screw.length}\n` +
        `   This indicates a data integrity issue - screws must have valid dimensions.`
      );
    }

    const radius = parseFloat(screw.radius);
    const length = parseFloat(screw.length);

    // Validate parsed values
    if (isNaN(radius) || isNaN(length) || radius <= 0 || length <= 0) {
      const screwId = screw.screw_id || screw.name || 'unknown';
      throw new Error(
        `❌ Invalid screw dimensions for screw: ${screwId}\n` +
        `   radius: ${radius}, length: ${length}\n` +
        `   Dimensions must be positive numbers.`
      );
    }

    // Use screw_label if available (e.g., "L3-R1", "L4-L2")
    const label = screw.screw_label || screw.name || screw.screw_id || 'Unknown Screw';

    // Determine source and parse manufacturer info from screw_variant_id
    let source: 'catalog' | 'generated' | 'unknown' = 'unknown';
    let manufacturerInfo = null;
    let description = 'Unknown Source';

    if (screw.screw_variant_id) {
      const variantId = screw.screw_variant_id;

      // Check if it's a generated/custom screw
      if (variantId.startsWith('generated-') || variantId.startsWith('screw-')) {
        source = 'generated';
        description = 'Custom Screw';
      } else {
        // It's a catalog screw - parse manufacturer info
        source = 'catalog';
        const parts = variantId.split('-');
        if (parts.length >= 4) {
          manufacturerInfo = {
            vendor: parts[0].toUpperCase(),
            model: parts.slice(1, -2).join('-').toUpperCase()
          };
          description = `${manufacturerInfo.vendor} ${manufacturerInfo.model}`;
        } else {
          description = 'Catalog Screw';
        }
      }
    }

    return {
      label,
      description,
      source,
      radius,
      length,
      manufacturerInfo
    };
  };

  // ═══════════════════════════════════════════════════════════════════
  // Crosshair Bookmark Handlers
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Add a new crosshair bookmark at the current crosshair position
   * Returns the newly created bookmark for potential follow-up actions (like screw placement)
   */
  const addCrosshairBookmark = (label: string): CrosshairBookmark | null => {
    try {
      console.log(`🏷️ [VertebralLabel] Attempting to save label: ${label}`);

      // Get current crosshair position using fresh read (bypasses cache)
      // This reads directly from crosshairs annotation toolCenter
      const position = crosshairsHandler.getFreshCrosshairCenter();

      console.log(`🏷️ [VertebralLabel] Position from getFreshCrosshairCenter:`, position);

      if (!position) {
        alert('⚠️ Could not detect crosshair position.\n\nPlease ensure:\n1. A CT scan is loaded\n2. Crosshairs tool is active\n3. Navigate to the desired vertebral body');
        return null;
      }

      // Validate position values
      if (position.some(v => isNaN(v) || !isFinite(v))) {
        console.error('❌ [VertebralLabel] Invalid position values:', position);
        alert('⚠️ Invalid crosshair position detected. Please try again.');
        return null;
      }

      // Create new bookmark
      const newBookmark: CrosshairBookmark = {
        id: `bookmark-${Date.now()}`,
        label,
        position: [...position] as [number, number, number],
        createdAt: Date.now(),
      };

      setCrosshairBookmarks(prev => [...prev, newBookmark]);
      setSelectedBookmarkId(newBookmark.id);

      console.log(`✅ [VertebralLabel] Saved: ${label} at [${position.map(v => v.toFixed(2)).join(', ')}]`);
      return newBookmark;
    } catch (error) {
      console.error('❌ Error adding vertebral label:', error);
      alert('Failed to add vertebral label. Check console for details.');
      return null;
    }
  };

  /**
   * Construct a transform matrix at a given position using current viewport cameras
   * This creates an initial vertical orientation (pointing up along Y-axis)
   */
  const constructScrewTransformAtPosition = (position: [number, number, number]): Float32Array | null => {
    try {
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔧 [ScrewManagement] CONSTRUCTING TRANSFORM AT POSITION');
      console.log(`   Position: [${position.map(v => v.toFixed(2)).join(', ')}]`);
      console.log('═══════════════════════════════════════════════════════');

      // Get rendering engine and viewports
      const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
      if (!renderingEngine) {
        console.error('❌ Rendering engine not found');
        return null;
      }

      // Find axial, sagittal, and coronal viewports
      let axialViewport = null;
      let sagittalViewport = null;
      let coronalViewport = null;

      const viewports = renderingEngine.getViewports();
      for (const vp of viewports) {
        const vpId = vp.id.toLowerCase();
        if (vpId.includes('axial')) {
          axialViewport = vp;
        } else if (vpId.includes('sagittal')) {
          sagittalViewport = vp;
        } else if (vpId.includes('coronal')) {
          coronalViewport = vp;
        }
      }

      if (!axialViewport || !sagittalViewport || !coronalViewport) {
        console.error('❌ Could not find required viewports (axial, sagittal, and coronal)');
        return null;
      }

      // Get camera data from viewports
      const axialCamera = axialViewport.getCamera();
      const sagittalCamera = sagittalViewport.getCamera();
      const coronalCamera = coronalViewport.getCamera();

      const axialNormal = axialCamera.viewPlaneNormal;
      const coronalNormal = [-coronalCamera.viewPlaneNormal[0], -coronalCamera.viewPlaneNormal[1], -coronalCamera.viewPlaneNormal[2]];
      const sagittalNormal = sagittalCamera.viewPlaneNormal;

      // Construct 4x4 transform matrix in row-major order
      const transform = new Float32Array([
        // Row 0: X-components of basis vectors + translation X
        axialNormal[0], coronalNormal[0], sagittalNormal[0], position[0],
        // Row 1: Y-components of basis vectors + translation Y
        axialNormal[1], coronalNormal[1], sagittalNormal[1], position[1],
        // Row 2: Z-components of basis vectors + translation Z
        axialNormal[2], coronalNormal[2], sagittalNormal[2], position[2],
        // Row 3: Homogeneous coordinates
        0, 0, 0, 1
      ]);

      console.log('✅ Transform matrix constructed at position');
      return transform;
    } catch (error) {
      console.error('❌ Error constructing transform at position:', error);
      return null;
    }
  };

  /**
   * Place screws at specified positions (called from Vertebral Label component)
   * Uses RGS01-Generic catalog screw for consistency with manual placement
   */
  const placeScrewsAtPositions = async (requests: ScrewPlacementRequest[]) => {
    try {
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔩 [ScrewManagement] PLACING SCREWS AT POSITIONS');
      console.log(`   Number of requests: ${requests.length}`);
      console.log(`   ✅ Using RGS01-Generic catalog screw`);
      console.log('═══════════════════════════════════════════════════════');

      if (!sessionId) {
        console.error('❌ No active session. Cannot place screws.');
        alert('⚠️ No active planning session. Please wait for session to initialize.');
        return;
      }

      // RGS01-Generic catalog screw specifications
      const catalogScrew = {
        radius: 3.0,         // 6mm diameter
        length: 40.0,        // 40mm length
        variantId: 'RGS01-Generic',
        manufacturer: 'Generic',
        screwType: 'Pedicle Screw'
      };

      for (const request of requests) {
        console.log('═══════════════════════════════════════════════════════');
        console.log(`🔩 [placeScrewsAtPositions] Placing screw:`);
        console.log(`   Label: "${request.label}"`);
        console.log(`   Side: ${request.side}`);
        console.log(`   Position: [${request.position.map(v => v.toFixed(1)).join(', ')}]`);
        console.log('═══════════════════════════════════════════════════════');

        try {
          // Use saveScrew with position parameter - this will use RGS01-Generic logic
          await saveScrew({
            name: request.label,  // ← This should be the correct label
            radius: catalogScrew.radius,
            length: catalogScrew.length,
            source: 'catalog',
            variantId: catalogScrew.variantId,
            manufacturer: catalogScrew.manufacturer,
            screwType: catalogScrew.screwType,
            position: request.position  // Pass the specific position
          });

          console.log(`✅ Screw ${request.label} placed using RGS01-Generic`);
        } catch (error) {
          console.error(`❌ Error placing screw ${request.label}:`, error);
        }
      }

      console.log('✅ Finished placing screws using RGS01-Generic');
    } catch (error) {
      console.error('❌ Error in placeScrewsAtPositions:', error);
      alert('Failed to place screws. Check console for details.');
    }
  };

  /**
   * Navigate to a saved crosshair bookmark position
   */
  const selectCrosshairBookmark = (bookmark: CrosshairBookmark) => {
    try {
      console.log(`📍 Navigating to bookmark: ${bookmark.label}`);
      console.log(`   Position: [${bookmark.position.map(v => v.toFixed(1)).join(', ')}]`);

      // Jump to the bookmarked position
      const success = jumpToPosition(bookmark.position, servicesManager);

      if (success) {
        setSelectedBookmarkId(bookmark.id);
        console.log(`✅ Successfully navigated to ${bookmark.label}`);
      } else {
        console.warn(`⚠️ Navigation to ${bookmark.label} may not have completed fully`);
        setSelectedBookmarkId(bookmark.id);
      }
    } catch (error) {
      console.error('❌ Error navigating to bookmark:', error);
      alert('Failed to navigate to bookmark. Check console for details.');
    }
  };

  /**
   * Update an existing crosshair bookmark with current crosshair position
   */
  const updateCrosshairBookmark = (bookmarkId: string) => {
    try {
      const bookmark = crosshairBookmarks.find(b => b.id === bookmarkId);
      if (!bookmark) {
        console.warn(`⚠️ Bookmark not found: ${bookmarkId}`);
        return;
      }

      console.log(`🔄 [Bookmark] Updating bookmark: ${bookmark.label}`);

      // Get current crosshair position using fresh read
      const position = crosshairsHandler.getFreshCrosshairCenter();

      console.log(`🔄 [Bookmark] New position:`, position);

      if (!position) {
        alert('⚠️ Could not detect crosshair position.\n\nPlease ensure:\n1. A CT scan is loaded\n2. Crosshairs tool is active');
        return;
      }

      // Validate position values
      if (position.some(v => isNaN(v) || !isFinite(v))) {
        console.error('❌ [Bookmark] Invalid position values:', position);
        alert('⚠️ Invalid crosshair position detected. Please try again.');
        return;
      }

      // Update the bookmark
      setCrosshairBookmarks(prev => prev.map(b =>
        b.id === bookmarkId
          ? { ...b, position: [...position] as [number, number, number], createdAt: Date.now() }
          : b
      ));

      console.log(`✅ [Bookmark] Updated: ${bookmark.label} to [${position.map(v => v.toFixed(2)).join(', ')}]`);
    } catch (error) {
      console.error('❌ Error updating crosshair bookmark:', error);
      alert('Failed to update crosshair bookmark. Check console for details.');
    }
  };

  /**
   * Delete a crosshair bookmark
   */
  const deleteCrosshairBookmark = (bookmarkId: string) => {
    const bookmark = crosshairBookmarks.find(b => b.id === bookmarkId);
    if (bookmark) {
      console.log(`🗑️ Deleting bookmark: ${bookmark.label}`);
    }

    setCrosshairBookmarks(prev => prev.filter(b => b.id !== bookmarkId));

    // Clear selection if the deleted bookmark was selected
    if (selectedBookmarkId === bookmarkId) {
      setSelectedBookmarkId(null);
    }
  };

  /**
   * Load a saved plan
   */
  const loadPlan = async (planId: string) => {
    try {
      // Check if there are existing screws in the current session
      if (screws.length > 0) {
        const confirmed = confirm(
          '⚠️ Warning: Current Session Has Unsaved Work\n\n' +
          `You currently have ${screws.length} screw(s) in this session.\n\n` +
          'Loading another plan will DISCARD your current work.\n\n' +
          'Do you want to:\n' +
          '  ✓ YES - Discard current session and load the selected plan\n' +
          '  ✗ NO - Cancel and keep working on current session\n\n' +
          '💡 Tip: Save your current plan first if you want to keep it!'
        );

        if (!confirmed) {
          console.log('❌ Load plan cancelled by user - keeping current session');
          return; // User chose to keep current session
        }

        console.log('✅ User confirmed: discarding current session and loading plan');

        // Clear current screws and models before loading new plan
        console.log('🗑️ Clearing current session data...');
        modelStateService.clearAllModels();
        setScrews([]);
      }

      setIsLoading(true);
      console.log('📥 Loading and restoring plan:', planId);

      // Restore session from plan using backend service
      const response = await planningBackendService.restoreSessionFromPlan(planId);

      if (!response.success) {
        throw new Error(response.error || 'Failed to restore session from plan');
      }

      const plan = response.plan;
      console.log('✅ Session restored from plan:', plan.name);
      console.log(`   Session ID: ${response.session_id}`);
      console.log(`   Screws: ${response.screws_count}, Rods: ${response.rods_count}`);

      // Update UI state with restored session
      setSessionId(response.session_id);
      setStudyInstanceUID(plan.study_instance_uid);
      setSeriesInstanceUID(plan.series_instance_uid);
      setSurgeon(plan.surgeon || surgeon);
      if (plan.case_id) {
        setCaseId(plan.case_id);
      }
      setSessionStatus('ready');

      // ⚠️ CRITICAL: loadScrews() already calls restoreScrew() for each screw,
      // which loads both the screw body and cap models.
      // DO NOT load models again here, as it will cause duplicate loading
      // and potentially overwrite the correct transform with an incorrect one.
      console.log('═══════════════════════════════════════════════════════');
      console.log('📥 [loadPlan] Loading screws from restored session...');
      console.log('   Note: loadScrews() will automatically load 3D models via restoreScrew()');
      console.log('   No need to load models separately here');
      console.log('═══════════════════════════════════════════════════════');

      // Persist new session_id to localStorage
      localStorage.setItem('ohif_planning_session_id', response.session_id);
      console.log('✅ Persisted new session_id to localStorage:', response.session_id);

      // Load screws from restored session (this will also load 3D models via restoreScrew)
      await loadScrews(response.session_id);

      console.log('✅ Plan restored successfully!');
      console.log(`   Screws loaded: ${plan.screws.length}`);
      console.log(`   Models loaded via restoreScrew() in loadScrews()`);

      alert(`Plan restored!\n${plan.name}\nSession: ${response.session_id.substring(0, 8)}...\nScrews: ${response.screws_count}`);

      // Close the dialog
      setShowPlanDialog(false);

    } catch (error) {
      console.error('❌ Error restoring plan:', error);
      alert(`Failed to restore plan: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToJSON = () => {
    try {
      if (screws.length === 0) {
        console.warn('⚠️ No screws to export');
        alert('No screws to export. Please add some screws first.');
        return;
      }

      console.log(`📤 Exporting ${screws.length} screws...`);

      // Export the screws from React state (not from viewportStateService)
      // This includes all screw data from the API/localStorage
      const exportData = {
        exportDate: new Date().toISOString(),
        sessionId: sessionId,
        screwCount: screws.length,
        screws: screws
      };

      const jsonString = JSON.stringify(exportData, null, 2);

      // Create blob and download
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `screw-placements-${timestamp}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`✅ Exported ${screws.length} screws to: ${filename}`);
      console.log('Export data:', exportData);

    } catch (error) {
      console.error('Failed to export:', error);
      alert('Failed to export screws. Check console for details.');
    }
  };

  const importFromJSON = () => {
    try {
      // Create file input element
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';

      input.onchange = async (e) => {
        try {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;

          // Use the file loading method
          viewportStateService.loadSnapshotsFromFile(file)
            .then((count) => {
              // Reload screws in UI
              if (sessionId) {
                loadScrews(sessionId);
              } else {
                loadScrewsLocal();
              }
              console.log(`✅ Successfully imported ${count} screws from: ${file.name}`);
            })
            .catch((error) => {
              console.error('Failed to import:', error);
            });

        } catch (error) {
          console.error('Failed to process file:', error);
        }
      };

      // Trigger file selection
      input.click();

    } catch (error) {
      console.error('Failed to import:', error);
    }
  };

  /**
   * Get auto screw placement from AnatomyGuru
   */
  const handleGetAutoScrewPlacement = async (vertebraLabel: string) => {
    setIsLoadingAutoPlacement(true);
    try {
      console.log(`🤖 [AutoScrew] Getting auto screw placement for: ${vertebraLabel}`);
      
      // Use the CT series ID from state (already detected during initialization)
      if (!seriesInstanceUID || seriesInstanceUID === 'NO_SERIES_LOADED') {
        alert('⚠️ Could not detect CT series ID.\n\nPlease ensure a DICOM CT series is loaded in the viewport.');
        console.error('❌ [AutoScrew] No CT series ID available');
        return;
      }
      
      console.log(`📋 [AutoScrew] Using CT series ID: ${seriesInstanceUID}`);
      
      // Call anatomy service with CT series ID
      const response = await anatomyService.getScrewPlacement(seriesInstanceUID, vertebraLabel);
      
      if (!response.success) {
        console.error(`❌ [AutoScrew] Failed: ${response.message}`);
        alert(`Failed to get screw placement:\n${response.message}`);
        return;
      }
      
      // Log left screw info
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🦴 AUTO SCREW PLACEMENT - ${vertebraLabel}`);
      console.log(`${'='.repeat(80)}`);
      console.log(`Series ID: ${response.seriesId}`);
      console.log(`Vertebra: ${response.vertebraLabel}`);
      console.log('');
      
      if (response.hasLeftScrew && response.leftScrew) {
        console.log(`🔩 LEFT SCREW:`);
        console.log(`   Entry Point:  [${response.leftScrew.entryPoint.x.toFixed(2)}, ${response.leftScrew.entryPoint.y.toFixed(2)}, ${response.leftScrew.entryPoint.z.toFixed(2)}] mm`);
        console.log(`   Target Point: [${response.leftScrew.targetPoint.x.toFixed(2)}, ${response.leftScrew.targetPoint.y.toFixed(2)}, ${response.leftScrew.targetPoint.z.toFixed(2)}] mm`);
        console.log(`   Trajectory:   [${response.leftScrew.trajectoryVector.x.toFixed(3)}, ${response.leftScrew.trajectoryVector.y.toFixed(3)}, ${response.leftScrew.trajectoryVector.z.toFixed(3)}] (normalized)`);
        console.log(`   Length:       ${response.leftScrew.lengthMm.toFixed(1)} mm`);
        if (response.leftScrew.diameterMm != null && response.leftScrew.radiusMm != null) {
          console.log(`   Diameter:     ${response.leftScrew.diameterMm.toFixed(2)} mm (from PopulationGuru)`);
          console.log(`   Radius:       ${response.leftScrew.radiusMm.toFixed(2)} mm (from PopulationGuru)`);
        }
        console.log(`   Sagittal:     ${response.leftScrew.sagittalAngleDeg.toFixed(1)}°`);
        console.log(`   Transverse:   ${response.leftScrew.transverseAngleDeg.toFixed(1)}°`);
        console.log('');
      } else {
        console.log(`❌ LEFT SCREW: Not available`);
        console.log('');
      }
      
      if (response.hasRightScrew && response.rightScrew) {
        console.log(`🔩 RIGHT SCREW:`);
        console.log(`   Entry Point:  [${response.rightScrew.entryPoint.x.toFixed(2)}, ${response.rightScrew.entryPoint.y.toFixed(2)}, ${response.rightScrew.entryPoint.z.toFixed(2)}] mm`);
        console.log(`   Target Point: [${response.rightScrew.targetPoint.x.toFixed(2)}, ${response.rightScrew.targetPoint.y.toFixed(2)}, ${response.rightScrew.targetPoint.z.toFixed(2)}] mm`);
        console.log(`   Trajectory:   [${response.rightScrew.trajectoryVector.x.toFixed(3)}, ${response.rightScrew.trajectoryVector.y.toFixed(3)}, ${response.rightScrew.trajectoryVector.z.toFixed(3)}] (normalized)`);
        console.log(`   Length:       ${response.rightScrew.lengthMm.toFixed(1)} mm`);
        if (response.rightScrew.diameterMm != null && response.rightScrew.radiusMm != null) {
          console.log(`   Diameter:     ${response.rightScrew.diameterMm.toFixed(2)} mm (from PopulationGuru)`);
          console.log(`   Radius:       ${response.rightScrew.radiusMm.toFixed(2)} mm (from PopulationGuru)`);
        }
        console.log(`   Sagittal:     ${response.rightScrew.sagittalAngleDeg.toFixed(1)}°`);
        console.log(`   Transverse:   ${response.rightScrew.transverseAngleDeg.toFixed(1)}°`);
        console.log('');
      } else {
        console.log(`❌ RIGHT SCREW: Not available`);
        console.log('');
      }
      
      // Log intersection analysis
      if (response.intersectionAnalysis) {
        console.log(`🔬 INTERSECTION ANALYSIS:`);
        console.log(`   Has Intersection: ${response.intersectionAnalysis.hasIntersection ? '⚠️ YES' : '✅ NO'}`);
        
        if (response.intersectionAnalysis.hasIntersection) {
          console.log(`   IoU:              ${response.intersectionAnalysis.iou.toFixed(4)}`);
          console.log(`   Risk Level:       ${response.intersectionAnalysis.iou >= 0.3 ? '🔴 HIGH' : response.intersectionAnalysis.iou >= 0.1 ? '🟡 MODERATE' : '🟢 LOW'}`);
          console.log(`   Center:           [${response.intersectionAnalysis.intersectionCenter.x.toFixed(2)}, ${response.intersectionAnalysis.intersectionCenter.y.toFixed(2)}, ${response.intersectionAnalysis.intersectionCenter.z.toFixed(2)}] mm`);
          console.log(`   Volume:           ${response.intersectionAnalysis.intersectionVolume.toFixed(2)} mm³`);
          console.log(`   Vertebra Volume:  ${response.intersectionAnalysis.vertebraVolume.toFixed(2)} mm³`);
          console.warn(`\n   ⚠️ WARNING: Spinal cord intersection detected!`);
          console.warn(`   This trajectory may pose a risk to the spinal cord.`);
        } else {
          console.log(`   ✅ No spinal cord intersection detected - trajectory appears safe.`);
        }
      }
      
      console.log(`${'='.repeat(80)}\n`);
      
      // ═════════════════════════════════════════════════════════
      // Automatically place screws using retrieved entry points
      // ═════════════════════════════════════════════════════════
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🤖 [AutoScrew] AUTOMATICALLY PLACING SCREWS`);
      console.log(`${'='.repeat(80)}`);
      
      const DEFAULT_RADIUS = 3.5; // mm - fallback radius if not provided by PopulationGuru
      let placedScrews = [];
      
      // Place left screw if available
      if (response.hasLeftScrew && response.leftScrew) {
        try {
          const leftLabel = `${vertebraLabel}-L`;
          const leftPosition: [number, number, number] = [
            response.leftScrew.entryPoint.x,
            response.leftScrew.entryPoint.y,
            response.leftScrew.entryPoint.z
          ];
          
          // Use radius from PopulationGuru if available, otherwise use default
          const leftRadius = response.leftScrew.radiusMm != null ? response.leftScrew.radiusMm : DEFAULT_RADIUS;
          const radiusSource = response.leftScrew.radiusMm != null ? 'PopulationGuru' : 'default';
          
          console.log(`\n🔩 Placing LEFT screw: ${leftLabel}`);
          console.log(`   Position: [${leftPosition[0].toFixed(2)}, ${leftPosition[1].toFixed(2)}, ${leftPosition[2].toFixed(2)}] mm`);
          console.log(`   Length: ${response.leftScrew.lengthMm.toFixed(1)} mm`);
          console.log(`   Radius: ${leftRadius.toFixed(2)} mm (${radiusSource})`);
          if (response.leftScrew.diameterMm != null) {
            console.log(`   Diameter: ${response.leftScrew.diameterMm.toFixed(2)} mm (${radiusSource})`);
          }
          
          await saveScrew({
            name: leftLabel,
            radius: leftRadius,
            length: response.leftScrew.lengthMm,
            source: 'custom',
            position: leftPosition
          });
          
          placedScrews.push('Left');
          console.log(`✅ Left screw placed successfully`);
        } catch (error) {
          console.error(`❌ Failed to place left screw:`, error);
        }
      }
      
      // Place right screw if available
      if (response.hasRightScrew && response.rightScrew) {
        try {
          const rightLabel = `${vertebraLabel}-R`;
          const rightPosition: [number, number, number] = [
            response.rightScrew.entryPoint.x,
            response.rightScrew.entryPoint.y,
            response.rightScrew.entryPoint.z
          ];
          
          // Use radius from PopulationGuru if available, otherwise use default
          const rightRadius = response.rightScrew.radiusMm != null ? response.rightScrew.radiusMm : DEFAULT_RADIUS;
          const radiusSource = response.rightScrew.radiusMm != null ? 'PopulationGuru' : 'default';
          
          console.log(`\n🔩 Placing RIGHT screw: ${rightLabel}`);
          console.log(`   Position: [${rightPosition[0].toFixed(2)}, ${rightPosition[1].toFixed(2)}, ${rightPosition[2].toFixed(2)}] mm`);
          console.log(`   Length: ${response.rightScrew.lengthMm.toFixed(1)} mm`);
          console.log(`   Radius: ${rightRadius.toFixed(2)} mm (${radiusSource})`);
          if (response.rightScrew.diameterMm != null) {
            console.log(`   Diameter: ${response.rightScrew.diameterMm.toFixed(2)} mm (${radiusSource})`);
          }
          
          await saveScrew({
            name: rightLabel,
            radius: rightRadius,
            length: response.rightScrew.lengthMm,
            source: 'custom',
            position: rightPosition
          });
          
          placedScrews.push('Right');
          console.log(`✅ Right screw placed successfully`);
        } catch (error) {
          console.error(`❌ Failed to place right screw:`, error);
        }
      }
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`✅ Auto placement complete: ${placedScrews.length} screw(s) placed`);
      console.log(`${'='.repeat(80)}\n`);
      
      // Show success message
      const hasIntersection = response.intersectionAnalysis?.hasIntersection;
      const warningText = hasIntersection 
        ? `\n\n⚠️ WARNING: Spinal cord intersection detected!\nIoU: ${response.intersectionAnalysis.iou.toFixed(4)}`
        : '';
      
      // alert(
      //   `✅ Auto Screw Placement Complete!\n\n` +
      //   `Vertebra: ${response.vertebraLabel}\n` +
      //   `Screws Placed: ${placedScrews.join(', ')}\n` +
      //   `Default Radius: ${DEFAULT_RADIUS} mm` +
      //   warningText +
      //   `\n\n📋 Check console for detailed information.`
      // );
      
    } catch (error) {
      console.error('❌ [AutoScrew] Error:', error);
      alert(`Error getting auto screw placement:\n${error.message}`);
    } finally {
      setIsLoadingAutoPlacement(false);
    }
  };

  // Use screws.length for actual screw count, not viewport snapshots
  const maxScrews = 10; // Maximum screws allowed
  const remainingSlots = Math.max(0, maxScrews - screws.length);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <ScrewManagementContainer>
      {/* Header */}
      <Header sessionId={sessionId} />

      {/* Plan Selection Dialog */}
      <PlanSelectionDialog
        isOpen={showPlanDialog}
        onClose={() => setShowPlanDialog(false)}
        onSelectPlan={loadPlan}
        caseId={caseId}
        seriesInstanceUID={seriesInstanceUID}
      />

      {/* Screw Selection Dialog */}
      <ScrewSelectionDialog
        isOpen={showScrewDialog}
        onClose={() => setShowScrewDialog(false)}
        onSelectScrew={saveScrew}
      />

      {/* Session State Dialog */}
      <SessionStateDialog
        isOpen={showSessionStateDialog}
        onClose={() => setShowSessionStateDialog(false)}
        uiState={{
          screws,
          sessionId,
          caseId,
          studyInstanceUID,
          seriesInstanceUID,
          surgeon,
        }}
        backendSummary={backendSummary}
        isLoading={summaryLoading}
        error={summaryError}
      />

      {/* Session Status Indicator */}
      <SessionStatus
        status={sessionStatus}
        sessionId={sessionId}
        onRetry={initializeSession}
      />

      {/* Vertebral Labels - Navigation and Screw Placement */}
      {/* <CrosshairBookmarks
        bookmarks={crosshairBookmarks}
        selectedBookmarkId={selectedBookmarkId}
        onAddBookmark={addCrosshairBookmark}
        onSelectBookmark={selectCrosshairBookmark}
        onUpdateBookmark={updateCrosshairBookmark}
        onDeleteBookmark={deleteCrosshairBookmark}
        onPlaceScrews={placeScrewsAtPositions}
      /> */}

      {/* Auto Screw Placement - Only show if segmentation is available */}
      {checkingSegmentation ? (
        <div className="space-y-2 border border-gray-600 rounded p-3 bg-gray-800 bg-opacity-20">
          <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
            <span className="animate-spin">⏳</span>
            <span>Checking segmentation availability...</span>
          </div>
        </div>
      ) : hasSegmentation ? (
        <div className="space-y-2 border border-purple-600 rounded p-3 bg-purple-900 bg-opacity-20">
          {/* Header */}
          {/* <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-sm">🤖 Auto Screw Placement</h3>
            <span className="text-xs text-purple-300">AnatomyGuru AI</span>
          </div> */}

          {/* Vertebra Selection */}
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <select
                value={selectedVertebraForAuto}
                onChange={(e) => setSelectedVertebraForAuto(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:outline-none text-sm"
                disabled={isLoadingAutoPlacement || vertebralLevelsLoading}
              >
                <option value="">
                  {vertebralLevelsLoading ? '-- Loading Vertebrae --' : vertebralLevels.length === 0 ? '-- No Vertebrae Found --' : '-- Select Vertebra --'}
                </option>
                {(() => {
                  const { cervical, thoracic, lumbar, sacral } = getVertebralLevelsByRegion();
                  return (
                    <>
                      {/* Cervical */}
                      {cervical.length > 0 && (
                        <optgroup label="Cervical">
                          {cervical.map(label => (
                            <option key={label} value={label}>{label}</option>
                          ))}
                        </optgroup>
                      )}
                      {/* Thoracic */}
                      {thoracic.length > 0 && (
                        <optgroup label="Thoracic">
                          {thoracic.map(label => (
                            <option key={label} value={label}>{label}</option>
                          ))}
                        </optgroup>
                      )}
                      {/* Lumbar */}
                      {lumbar.length > 0 && (
                        <optgroup label="Lumbar">
                          {lumbar.map(label => (
                            <option key={label} value={label}>{label}</option>
                          ))}
                        </optgroup>
                      )}
                      {/* Sacral */}
                      {sacral.length > 0 && (
                        <optgroup label="Sacral">
                          {sacral.map(label => (
                            <option key={label} value={label}>{label}</option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  );
                })()}
              </select>
            </div>

            {/* Get Placement Button */}
            <button
              onClick={() => selectedVertebraForAuto && handleGetAutoScrewPlacement(selectedVertebraForAuto)}
              disabled={!selectedVertebraForAuto || isLoadingAutoPlacement}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
              title="Get AI-generated screw placement from AnatomyGuru"
            >
              {isLoadingAutoPlacement ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <span>🔍</span>
                  <span>Get Placement</span>
                </>
              )}
            </button>
          </div>

          {/* Help Text */}
          {/* <p className="text-xs text-gray-400">
            💡 {vertebralLevels.length > 0 
              ? `${vertebralLevels.length} vertebra(e) found in segmentation. Select one to get AI-generated screw placement.`
              : 'Loading vertebral levels from segmentation...'}
          </p> */}
        </div>
      ) : (
        <div className="space-y-2 border border-gray-600 rounded p-3 bg-gray-800 bg-opacity-20">
          <div className="flex items-start gap-2">
            <span className="text-gray-400 text-sm">ℹ️</span>
            <div className="flex-1">
              <p className="text-gray-400 text-sm">
                <strong>Auto Screw Placement unavailable</strong>
              </p>
              <p className="text-gray-500 text-xs mt-1">
                No segmentation data found for this series. Auto placement requires vertebral segmentation from AnatomyGuru.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Compact Toolbar - All Tools Combined */}
      <CompactToolbar
        isMoveToolActive={isMoveToolActive}
        onToggleMoveTool={toggleMoveTool}
        selectedScrew={selectedScrew}
        modelCount={modelStateService.getAllModels().length}
        screwCount={screws.length}
        remainingSlots={remainingSlots}
        maxScrews={maxScrews}
        onOpenDialog={() => setShowScrewDialog(true)}
        onTestCrosshair={testCrosshairDetection}
        onShowSessionState={showSessionState}
        onLoadPlan={() => setShowPlanDialog(true)}
        onSavePlan={savePlan}
        onClearAll={clearAllScrews}
        isSavingPlan={isSavingPlan}
        hasScrews={screws.length > 0}
        onDebug={debugScrewInteraction}
      />

      {/* Screws List - Table Layout */}
      <ScrewListContainer>
        <ScrewListHeader screwCount={screws.length} maxScrews={maxScrews} />

        <ScrewListScrollArea>
          {screws.length === 0 ? (
            <EmptyScrewList />
          ) : (
            <ScrewTable
              screws={screws}
              displayInfoGetter={getScrewDisplayInfo}
              isRestoring={isRestoring}
              onView={restoreScrew}
              onEdit={editScrew}
              onDelete={deleteScrew}
              showEditButton={false}
              onUpdateDiameter={handleUpdateDiameter}
              onUpdateLength={handleUpdateLength}
              availableDiameters={availableDiameters}
              availableLengths={availableLengths}
              updatingScrewId={updatingScrewId}
            />
          )}
        </ScrewListScrollArea>
      </ScrewListContainer>
    </ScrewManagementContainer>
  );
}

