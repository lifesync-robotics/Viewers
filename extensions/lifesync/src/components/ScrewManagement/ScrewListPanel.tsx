import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getRenderingEngine } from '@cornerstonejs/core';
import { vec3 } from 'gl-matrix';

import PlanSelectionDialog from './PlanSelectionDialog';
import { planningBackendService } from '../../services';
import { jumpToPosition } from '../Registration/utils/fiducialUtils';
import { getScrewColor } from '../../utils/screwColorScheme';

type ScrewListPanelProps = {
  servicesManager: any;
};

const CACHED_SESSION_KEY = 'ohif_planning_session_id';

const ScrewListPanel: React.FC<ScrewListPanelProps> = ({ servicesManager }) => {
  const {
    viewportStateService,
    modelStateService,
    displaySetService,
    viewportGridService,
    trackingService,
  } =
    servicesManager.services;

  const [searchParams] = useSearchParams();
  const [screws, setScrews] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(searchParams.get('caseId'));
  const [studyInstanceUID, setStudyInstanceUID] = useState<string | null>(null);
  const [seriesInstanceUID, setSeriesInstanceUID] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [selectedScrewKey, setSelectedScrewKey] = useState<string | null>(null);

  useEffect(() => {
    const { activeViewportId, viewports } = viewportGridService.getState?.() || {};
    const viewport =
      viewports?.get?.(activeViewportId) ?? (viewports && (viewports as any)[activeViewportId]);

    let nextStudyUID: string | null = null;
    let nextSeriesUID: string | null = null;

    if (viewport?.displaySetInstanceUIDs?.length) {
      const dsUid = viewport.displaySetInstanceUIDs[0];
      const ds = displaySetService.getDisplaySetByUID(dsUid);
      nextStudyUID = ds?.StudyInstanceUID || null;
      nextSeriesUID = ds?.SeriesInstanceUID || null;
    }

    setStudyInstanceUID(nextStudyUID);
    setSeriesInstanceUID(nextSeriesUID);

    const cachedId = localStorage.getItem(CACHED_SESSION_KEY);
    if (cachedId) {
      setSessionId(cachedId);
      loadScrews(cachedId);
    } else {
      setIsLoading(false);
    }
  }, [displaySetService, viewportGridService]);

  const loadScrews = async (id: string) => {
    if (!id) return;
    setIsLoading(true);
    try {
      const response = await planningBackendService.listScrews(id);
      if (response.success) {
        setScrews(response.screws || []);
      } else {
        console.warn('Failed to load screws:', response.error);
        setScrews([]);
      }
    } catch (error) {
      console.error('Error loading screws', error);
      setScrews([]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearAll = () => {
    try {
      viewportStateService?.clearAll?.();
      modelStateService?.clearAllModels?.();
    } catch (error) {
      console.warn('Failed to clear state before loading plan', error);
    }
    setScrews([]);
  };

  const handleLoadPlan = async (planId: string) => {
    if (!planId) return;

    if (screws.length > 0) {
      clearAll();
    }

    setIsLoading(true);
    try {
      const response = await planningBackendService.restoreSessionFromPlan(planId);

      if (!response.success) {
        throw new Error(response.error || 'Failed to restore plan');
      }

      const plan = response.plan || {};
      setSessionId(response.session_id);
      localStorage.setItem(CACHED_SESSION_KEY, response.session_id);
      setStudyInstanceUID(plan.study_instance_uid || studyInstanceUID);
      setSeriesInstanceUID(plan.series_instance_uid || seriesInstanceUID);

      await loadScrews(response.session_id);
      setShowPlanDialog(false);
    } catch (error) {
      console.error('Error loading plan', error);
      alert(error.message || 'Failed to load plan. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const getScrewDisplayInfo = (screw: any) => {
    if (!screw?.radius || !screw?.length) {
      const screwId = screw?.screw_id || screw?.name || 'unknown';
      throw new Error(`Missing screw dimensions for ${screwId}`);
    }

    const radius = parseFloat(screw.radius);
    const length = parseFloat(screw.length);
    if (!isFinite(radius) || !isFinite(length) || radius <= 0 || length <= 0) {
      const screwId = screw?.screw_id || screw?.name || 'unknown';
      throw new Error(`Invalid screw dimensions for ${screwId}`);
    }

    return {
      label: screw.screw_label || screw.name || screw.screw_id || 'Unknown Screw',
      radius,
      length,
    };
  };

  const parseTransform = (screwData: any): Float32Array | null => {
    if (!screwData?.transform_matrix) return null;
    const arr = screwData.transform_matrix;
    if (Array.isArray(arr) && arr.length === 16) {
      return new Float32Array(arr);
    }
    return null;
  };

  const getCurrentViewportId = () => {
    try {
      const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
      if (!renderingEngine) return 'volume3d-viewport';
      const viewports = renderingEngine.getViewports();
      for (const vp of viewports) {
        if (vp.type === 'volume3d' || (vp.type as string) === 'VOLUME_3D') {
          return vp.id;
        }
      }
    } catch (error) {
      console.warn('Unable to resolve viewport id', error);
    }
    return 'volume3d-viewport';
  };

  const loadCapModel = async (
    transform: number[],
    length: number,
    screwLabel: string | null = null,
    screwId: string | null = null
  ) => {
    try {
      // Store original transform values to detect any modifications
      const originalTransformValues = {
        x: transform[3],
        y: transform[7],
        z: transform[11],
      };

      console.log('═══════════════════════════════════════════════════════');
      console.log(`🎩 [loadCapModel] Loading cap for: "${screwLabel}" (length: ${length}mm)`);
      console.log(`   Transform input (MODEL ORIGIN position):`);
      console.log(`   Translation: [${transform[3].toFixed(2)}, ${transform[7].toFixed(2)}, ${transform[11].toFixed(2)}]`);
      console.log(`   Coronal direction (Y-axis): [${transform[1]}, ${transform[5]}, ${transform[9]}]`);
      console.log(`   🔒 Original transform stored: [${originalTransformValues.x}, ${originalTransformValues.y}, ${originalTransformValues.z}]`);
      console.log('═══════════════════════════════════════════════════════');

      // Use the same color as the screw body
      const capColor = screwLabel ? getScrewColor(screwLabel) : [1.0, 0.84, 0.0];
      console.log(`🎨 Using color [${capColor}] for cap "${screwLabel || 'default'}"`);

      // Query cap model (returns fixed information)
      const queryResponse = await planningBackendService.queryCapModel();

      if (!queryResponse.success || !queryResponse.model) {
        throw new Error('Cap model query failed');
      }

      const modelInfo = queryResponse.model;
      console.log(`📦 Cap model: ${modelInfo.filename}`);

      // Get cap model OBJ file URL
      const modelUrl = planningBackendService.getCapModelUrl();

      // Load model
      await modelStateService.loadModelFromServer(modelUrl, {
        viewportId: getCurrentViewportId(),
        color: capColor,
        opacity: 0.9,
        modelId: screwId ? `${screwId}-cap` : null,
        modelName: screwLabel ? `${screwLabel}-Cap` : 'Screw Cap',
      });

      // Apply transform matrix (cap needs to be placed at the top of the screw)
      if (transform && transform.length === 16 && length && length > 0) {
        console.log('🔧 [loadCapModel] Calculating cap position...');
        console.log(
          `   Input transform (MODEL ORIGIN): [${transform[3].toFixed(2)}, ${transform[7].toFixed(2)}, ${transform[11].toFixed(2)}]`
        );

        // Extract coronal direction (Y-axis, column 1 in row-major)
        const coronalX = transform[1]; // Row 0, Col 1
        const coronalY = transform[5]; // Row 1, Col 1
        const coronalZ = transform[9]; // Row 2, Col 1

        // Cap dimensions
        const capHeight = 15.0; // Cap height in mm
        const capCenterOffset = 2.5; // Additional offset to position cap properly

        // Calculate cap offset from model origin
        const capOffset = length / 2 + capHeight / 2 + capCenterOffset;

        console.log(`📏 Screw length: ${length}mm`);
        console.log(`📏 Cap height: ${capHeight}mm`);
        console.log(`📏 Cap offset from MODEL ORIGIN: +${capOffset}mm along coronal direction`);
        console.log(
          `📐 Coronal direction: [${coronalX.toFixed(3)}, ${coronalY.toFixed(3)}, ${coronalZ.toFixed(3)}]`
        );

        // Create cap transform by offsetting from MODEL ORIGIN
        const capTransform = [...transform];

        // Apply offset to cap transform
        capTransform[3] = transform[3] + coronalX * capOffset;
        capTransform[7] = transform[7] + coronalY * capOffset;
        capTransform[11] = transform[11] + coronalZ * capOffset;

        console.log(
          `   Cap transform (offset from model origin): [${capTransform[3].toFixed(2)}, ${capTransform[7].toFixed(2)}, ${capTransform[11].toFixed(2)}]`
        );
        console.log(
          `   Offset vector: [${(coronalX * capOffset).toFixed(2)}, ${(coronalY * capOffset).toFixed(2)}, ${(coronalZ * capOffset).toFixed(2)}]`
        );

        const loadedModels = modelStateService.getAllModels();
        const latestModel = loadedModels[loadedModels.length - 1];

        if (latestModel) {
          // Apply offset transform
          await modelStateService.setModelTransform(latestModel.metadata.id, capTransform);
          console.log(
            `✅ Applied transform to cap model: ${latestModel.metadata.id} with offset: ${capOffset}mm`
          );
        } else {
          console.error('❌ No cap model found to apply transform to!');
        }
      } else {
        console.warn(
          `⚠️ No valid transform or length to apply to cap (transform length: ${transform?.length || 0}, length: ${length})`
        );
      }
    } catch (error) {
      console.error('❌ Failed to load cap model:', error);
      console.warn('⚠️ Continuing without cap model visualization');
      throw error; // Re-throw to let caller handle
    }
  };

  const ensureModelLoaded = async (
    screwData: any,
    displayInfo: { label: string; radius: number; length: number },
    transform: Float32Array | null
  ) => {
    const existing = modelStateService
      ?.getAllModels?.()
      ?.find((m: any) => m.metadata?.name === displayInfo.label);
    if (existing) return existing.metadata?.id;

    const modelResult = await planningBackendService.queryModel(displayInfo.radius, displayInfo.length);
    if (!modelResult.success || !modelResult.model) return null;

    const modelUrl = planningBackendService.getModelUrl(modelResult.model.model_id);
    const color = getScrewColor(displayInfo.label);
    const loaded = await modelStateService.loadModelFromServer(modelUrl, {
      viewportId: getCurrentViewportId(),
      color,
      modelId: screwData?.screw_id || screwData?.id || undefined,
      modelName: displayInfo.label,
    });

    if (loaded && transform?.length === 16) {
      await modelStateService.setModelTransform(loaded.metadata.id, transform, displayInfo.length);

      // Load the cap model after the screw model
      try {
        const capTransformCopy =
          transform instanceof Float32Array ? Array.from(transform) : [...transform];
        await loadCapModel(
          capTransformCopy,
          displayInfo.length,
          displayInfo.label,
          screwData?.screw_id || screwData?.id || undefined
        );
        console.log(`✅ Cap model loaded successfully for screw "${displayInfo.label}"`);
      } catch (capError) {
        console.warn('⚠️ Could not load cap model:', capError.message);
        // Don't throw - cap is optional, continue execution
      }
    }

    return loaded?.metadata?.id;
  };

  const setViewportOrientationsFromScrew = (transform: number[], screwPosition: [number, number, number]) => {
    try {
      if (!transform || transform.length !== 16) return;

      const axialNormal: [number, number, number] = [transform[0], transform[4], transform[8]];
      const coronalNormal: [number, number, number] = [-transform[1], -transform[5], -transform[9]];
      const sagittalNormal: [number, number, number] = [transform[2], transform[6], transform[10]];

      vec3.normalize(axialNormal, axialNormal);
      vec3.normalize(coronalNormal, coronalNormal);
      vec3.normalize(sagittalNormal, sagittalNormal);

      const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
      if (!renderingEngine) return;

      const viewports = renderingEngine.getViewports();
      for (const viewport of viewports) {
        const viewportId = viewport.id.toLowerCase();
        const camera = viewport.getCamera();
        const viewDirection = vec3.sub(
          vec3.create(),
          camera.position as [number, number, number],
          camera.focalPoint as [number, number, number]
        );
        const distance = vec3.length(viewDirection);
        const originalViewUp = camera.viewUp as [number, number, number];

        let newViewPlaneNormal: [number, number, number] | null = null;
        if (viewportId.includes('axial')) newViewPlaneNormal = axialNormal;
        else if (viewportId.includes('sagittal')) newViewPlaneNormal = sagittalNormal;
        else if (viewportId.includes('coronal')) newViewPlaneNormal = coronalNormal;

        if (newViewPlaneNormal) {
          const newPosition = vec3.add(
            vec3.create(),
            screwPosition,
            vec3.scale(vec3.create(), newViewPlaneNormal, distance)
          ) as [number, number, number];

          viewport.setCamera({
            focalPoint: screwPosition,
            position: newPosition,
            viewPlaneNormal: newViewPlaneNormal,
            viewUp: originalViewUp,
          });
          viewport.render();
        }
      }
    } catch (error) {
      console.warn('Unable to set viewport orientation from screw', error);
    }
  };

  const getScrewKey = (screw: any, index?: number) =>
    (screw?.screw_id || screw?.id || screw?.name || (index !== undefined ? `idx-${index}` : null)) as
      | string
      | null;

  const handleViewScrew = async (screwData: any) => {
    try {
      setIsRestoring(true);
      setSelectedScrewKey(getScrewKey(screwData) ?? null);
      const displayInfo = getScrewDisplayInfo(screwData);
      const transformArray = parseTransform(screwData);
      const screwPosition =
        transformArray && transformArray.length === 16
          ? ([transformArray[3], transformArray[7], transformArray[11]] as [number, number, number])
          : screwData?.entry_point
            ? ([screwData.entry_point.x, screwData.entry_point.y, screwData.entry_point.z] as [
                number,
                number,
                number
              ])
            : null;

      if (screwData.viewport_states_json || screwData.viewportStates) {
        let viewportStates = screwData.viewport_states_json || screwData.viewportStates;
        if (typeof viewportStates === 'string') {
          viewportStates = JSON.parse(viewportStates);
        }
        try {
          viewportStateService.restoreViewportStates(viewportStates);
        } catch (error) {
          console.warn('Failed to restore viewport states', error);
        }
      }

      if (transformArray) {
        await ensureModelLoaded(screwData, displayInfo, transformArray);
      }

      if (screwPosition) {
        jumpToPosition(screwPosition, servicesManager);
        if (transformArray) {
          setViewportOrientationsFromScrew(Array.from(transformArray), screwPosition);
        }
      }

      if (trackingService && screwPosition) {
        trackingService.publishSelectedScrew({
          key: getScrewKey(screwData) ?? null,
          position: screwPosition,
          transform: transformArray ? Array.from(transformArray) : null,
          length: displayInfo.length,
        });
      }
    } catch (error) {
      console.error('Failed to view screw', error);
      alert(error.message || 'Unable to view screw. Check console for details.');
    } finally {
      setIsRestoring(false);
    }
  };

  const tableRows = useMemo(() => {
    return screws.map((screw, index) => {
      try {
        const displayInfo = getScrewDisplayInfo(screw);
        const key = getScrewKey(screw, index) ?? `${index}`;
        const isSelected = key === selectedScrewKey;
        const baseRowClasses =
          'border-b border-gray-700 hover:bg-gray-800 cursor-pointer transition';
        const selectedClasses = isSelected
          ? 'bg-blue-900/50 text-white font-semibold'
          : 'bg-transparent text-gray-200';

        return (
          <tr
            key={key}
            onClick={() => handleViewScrew(screw)}
            className={`${baseRowClasses} ${selectedClasses}`}
          >
            <td className="px-3 py-2 text-sm">{index + 1}</td>
            <td className="px-3 py-2 text-sm">{displayInfo.label}</td>
            <td className="px-3 py-2 text-sm text-blue-200 text-center">
              {(displayInfo.radius * 2).toFixed(1)}
            </td>
            <td className="px-3 py-2 text-sm text-green-200 text-center">
              {displayInfo.length.toFixed(1)}
            </td>
          </tr>
        );
      } catch (error) {
        return (
          <tr key={screw.screw_id || screw.id || index} className="border-b border-gray-700 bg-red-900/30">
            <td className="px-3 py-2 text-sm text-gray-300">{index + 1}</td>
            <td className="px-3 py-2 text-sm text-red-300" colSpan={3}>
              Invalid screw data: {error.message}
            </td>
          </tr>
        );
      }
    });
  }, [screws, selectedScrewKey]);

  if (isLoading) {
    return <div className="p-3 text-sm text-gray-300">Loading screws...</div>;
  }

  return (
    <div className="flex flex-col gap-3 p-3 text-white h-full">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Screw List</p>
          {sessionId && (
            <p className="text-xs text-gray-400">Session: {sessionId.slice(0, 8)}...</p>
          )}
        </div>
        <button
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded disabled:bg-gray-600"
          onClick={() => setShowPlanDialog(true)}
          disabled={isRestoring}
        >
          📥 Load Plan
        </button>
      </div>

      <PlanSelectionDialog
        isOpen={showPlanDialog}
        onClose={() => setShowPlanDialog(false)}
        onSelectPlan={handleLoadPlan}
        caseId={caseId}
        seriesInstanceUID={seriesInstanceUID}
      />

      <div className="flex-1 border border-gray-700 rounded-lg overflow-hidden bg-black bg-opacity-40">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-900 text-gray-300 border-b border-gray-700">
            <tr>
              <th className="px-3 py-2 font-semibold w-12">#</th>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold text-center">Diameter (mm)</th>
              <th className="px-3 py-2 font-semibold text-center">Length (mm)</th>
            </tr>
          </thead>
          <tbody>
            {screws.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-sm text-gray-400 text-center" colSpan={4}>
                  No screws loaded. Load a plan to view screws.
                </td>
              </tr>
            ) : (
              tableRows
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        Click a row to jump to that screw. Loading a new plan will clear the current screws and models.
      </p>
    </div>
  );
};

export default ScrewListPanel;

