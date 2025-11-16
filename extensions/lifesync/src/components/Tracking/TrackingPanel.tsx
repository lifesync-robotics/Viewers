import React, { useState, useEffect, useRef } from 'react';
import { useSystem } from '@ohif/core';
import ConnectionStatus from './ConnectionStatus';
import ControlButtons from './ControlButtons';
import PositionDisplay from './PositionDisplay';
import CaseSelector from './CaseSelector';
import './TrackingPanel.css';

interface TrackingStatus {
  connected: boolean;
  navigating: boolean;
  apiConnected: boolean;
  wsConnected: boolean;
  dataHz: number;
  uiHz: number;
  position: {
    register: number[];
    dicom: number[];
  } | null;
  quality: string | null;
  qualityScore: number | null;
  visible: boolean;
  transformation: {
    loaded: boolean;
    isIdentity: boolean;
  };
}

export default function TrackingPanel() {
  const { servicesManager, commandsManager } = useSystem();
  const { trackingService, displaySetService } = servicesManager.services;

  // Get current Study ID
  const [caseId, setCaseId] = useState<string>('');

  useEffect(() => {
    // Get active study from displaySetService
    const activeDisplaySets = displaySetService?.getActiveDisplaySets() || [];
    if (activeDisplaySets.length > 0) {
      const studyInstanceUID = activeDisplaySets[0]?.StudyInstanceUID;
      if (studyInstanceUID) {
        setCaseId(studyInstanceUID);
      }
    }
  }, [displaySetService]);

  const [status, setStatus] = useState<TrackingStatus>({
    connected: false,
    navigating: false,
    apiConnected: false,
    wsConnected: false,
    dataHz: 0,
    uiHz: 0,
    position: null,
    quality: null,
    qualityScore: null,
    visible: false,
    transformation: {
      loaded: false,
      isIdentity: false,
    },
  });

  const [frameCount, setFrameCount] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const [lastUIUpdate, setLastUIUpdate] = useState(Date.now());
  const UI_UPDATE_INTERVAL = 40; // 25 Hz = 1000ms / 25 = 40ms

  // Store latest data without triggering re-render
  const latestDataRef = React.useRef<any>(null);

  useEffect(() => {
    if (!trackingService) {
      console.warn('⚠️ TrackingService not available');
      return;
    }

    // Subscribe to tracking updates
    const trackingSubscription = trackingService.subscribe(
      'event::tracking_update',
      (data: any) => {
        const now = Date.now();
        const elapsed = (now - lastUpdateTime) / 1000;

        setFrameCount(prev => prev + 1);
        setLastUpdateTime(now);

        // Calculate actual data rate
        const dataRate = elapsed > 0 ? 1 / elapsed : 0;

        // Store latest data in ref (doesn't trigger re-render)
        latestDataRef.current = {
          position: {
            register: data.position || [0, 0, 0],
            dicom: data.position || [0, 0, 0],
          },
          quality: data.quality || null,
          qualityScore: data.quality_score || null,
          visible: data.visible !== false,
          dataHz: dataRate,
        };
      }
    );

    // Throttled UI update interval (25 Hz)
    const uiUpdateInterval = setInterval(() => {
      if (latestDataRef.current) {
        setStatus(prev => ({
          ...prev,
          ...latestDataRef.current,
        }));
        setLastUIUpdate(Date.now());
      }
    }, UI_UPDATE_INTERVAL);

    // Subscribe to connection status
    const connectionSubscription = trackingService.subscribe(
      'event::connection_status',
      (statusData: any) => {
        setStatus(prev => ({
          ...prev,
          connected: statusData.connected || false,
          wsConnected: statusData.connected || false,
        }));
      }
    );

    // Get initial status
    const initialStatus = trackingService.getStatus();
    setStatus(prev => ({
      ...prev,
      connected: initialStatus.connected || false,
      wsConnected: initialStatus.connected || false,
    }));

    return () => {
      trackingSubscription?.unsubscribe();
      connectionSubscription?.unsubscribe();
      clearInterval(uiUpdateInterval);
    };
  }, [trackingService, lastUpdateTime]);

  // Update navigation status from navigation controller
  useEffect(() => {
    const interval = setInterval(() => {
      if (window.__navigationController) {
        const navStatus = window.__navigationController.getStatus();
        setStatus(prev => ({
          ...prev,
          navigating: navStatus.navigating || false,
          uiHz: navStatus.actualFPS || 0,
          transformation: navStatus.transformation || {
            loaded: false,
            isIdentity: false,
          },
        }));
      }
    }, 500); // Update every 500ms

    return () => clearInterval(interval);
  }, []);

  const handleStartNavigation = () => {
    console.log('🚀 Starting navigation from UI...');
    commandsManager.run({
      commandName: 'startNavigation',
      commandOptions: { mode: 'linear' },
    });
  };

  const handleStopNavigation = () => {
    console.log('🛑 Stopping navigation from UI...');
    commandsManager.run({
      commandName: 'stopNavigation',
    });
  };

  return (
    <div className="tracking-panel">
      <div className="tracking-panel-header">
        <h2>🧭 Surgical Navigation</h2>
        <div className="tracking-panel-subtitle">Phase 4: UI Components</div>
      </div>

      <ConnectionStatus
        apiConnected={status.apiConnected}
        wsConnected={status.wsConnected}
        dataHz={status.dataHz}
        uiHz={status.uiHz}
        navigating={status.navigating}
      />

      <ControlButtons
        navigating={status.navigating}
        onStart={handleStartNavigation}
        onStop={handleStopNavigation}
      />

      <PositionDisplay
        position={status.position}
        quality={status.quality}
        qualityScore={status.qualityScore}
        visible={status.visible}
        transformation={status.transformation}
      />

      <CaseSelector caseId={caseId} disabled={true} />

      <div className="tracking-panel-footer">
        <div className="stat-row">
          <span className="stat-label">Frames:</span>
          <span className="stat-value">{frameCount}</span>
        </div>
      </div>
    </div>
  );
}
