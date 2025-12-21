/**
 * RegistrationPanelContainer
 *
 * Main container component with two tabs:
 * 1. Registration Workflow Control - Method selection, Load Template, Start Session
 * 2. Fiducial Template Editor - Create, edit, and manage fiducial templates
 */

import React, { useState, useEffect } from 'react';
import { useSystem } from '@ohif/core';
import RegistrationWorkflowPanel from './RegistrationWorkflowPanel';
import FiducialTemplateEditorPanel from './FiducialTemplateEditorPanel';
import { getApiUrl } from '../../utils/apiConfig';
import './RegistrationPanel.css';

interface RegistrationPanelContainerProps {
  servicesManager: any;
  commandsManager: any;
  extensionManager: any;
}

type TabType = 'workflow' | 'template';

export default function RegistrationPanelContainer({
  servicesManager,
  commandsManager,
  extensionManager,
}: RegistrationPanelContainerProps) {
  const { displaySetService } = servicesManager.services;

  const [activeTab, setActiveTab] = useState<TabType>('workflow');
  const [seriesInstanceUID, setSeriesInstanceUID] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [studyInstanceUID, setStudyInstanceUID] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Get DICOM UIDs from active viewport on mount
  useEffect(() => {
    const updateDicomInfo = async () => {
      try {
        const activeDisplaySets = displaySetService?.getActiveDisplaySets() || [];
        if (activeDisplaySets.length > 0) {
          const displaySet = activeDisplaySets[0];
          const newStudyUID = displaySet.StudyInstanceUID;
          const newSeriesUID = displaySet.SeriesInstanceUID;

          if (newStudyUID && newSeriesUID) {
            setStudyInstanceUID(newStudyUID);
            setSeriesInstanceUID(newSeriesUID);

            let resolvedCaseId: string | null = null;

            // Priority 1: Get case_id from URL parameters
            const urlParams = new URLSearchParams(window.location.search);
            const urlCaseId = urlParams.get('caseId');
            if (urlCaseId) {
              resolvedCaseId = urlCaseId;
              console.log('✅ [Registration] Got case_id from URL:', urlCaseId);
            } else {
              // Priority 2: Get from CaseService (if available)
              try {
                const caseService = servicesManager.services.caseService;
                if (caseService?.getActiveCaseId) {
                  const activeCaseId = caseService.getActiveCaseId();
                  if (activeCaseId) {
                    resolvedCaseId = String(activeCaseId);
                    console.log('✅ [Registration] Got case_id from CaseService:', activeCaseId);
                  }
                }
              } catch (error) {
                console.warn('⚠️ [Registration] Could not get case_id from CaseService:', error);
              }

              // Priority 3: Query case_id from API using Study UID
              if (!resolvedCaseId) {
                try {
                  const response = await fetch(
                    getApiUrl(`/api/dicom/studies/${encodeURIComponent(newStudyUID)}`)
                  );
                  if (response.ok) {
                    const data = await response.json();
                    const caseInfo = data.study?.caseInfo;
                    if (caseInfo?.caseId) {
                      resolvedCaseId = String(caseInfo.caseId);
                      console.log('✅ [Registration] Got case_id from API:', caseInfo.caseId);
                    }
                  }
                } catch (error) {
                  console.warn('⚠️ [Registration] Could not fetch case_id from API:', error);
                }
              }

              // Priority 4: Fallback - Extract from Study UID (for testing only, generates temporary ID)
              if (!resolvedCaseId) {
                const extractedCaseId = `CASE_${newStudyUID.slice(-8)}`;
                resolvedCaseId = extractedCaseId;
                console.warn(
                  '⚠️ [Registration] Using fallback case_id (temporary):',
                  extractedCaseId
                );
                console.warn(
                  '⚠️ [Registration] This is a temporary ID. Please ensure case_id is passed via URL or CaseService.'
                );
              }
            }

            setCaseId(resolvedCaseId);

            console.log('✅ [Registration] Got DICOM UIDs:');
            console.log(`   Study UID: ${newStudyUID}`);
            console.log(`   Series UID: ${newSeriesUID}`);
            console.log(`   Case ID: ${resolvedCaseId}`);
          }
        }
      } catch (error) {
        console.warn('⚠️ [Registration] Could not get DICOM UIDs:', error);
      }
    };

    updateDicomInfo();

    // Subscribe to display set changes
    const subscription = displaySetService?.subscribe(
      displaySetService.EVENTS.DISPLAY_SETS_CHANGED,
      updateDicomInfo
    );

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [displaySetService, servicesManager]);

  const handleSessionStarted = (newSessionId: string) => {
    setSessionId(newSessionId);
  };

  return (
    <div className="registration-panel-container">
      <div className="panel-header">
        <h2>📋 Registration</h2>
      </div>

      {/* Main Tabs */}
      <div className="method-tabs">
        <button
          className={`tab-button ${activeTab === 'workflow' ? 'active' : ''}`}
          onClick={() => setActiveTab('workflow')}
        >
          Workflow Control
        </button>
        <button
          className={`tab-button ${activeTab === 'template' ? 'active' : ''}`}
          onClick={() => setActiveTab('template')}
        >
          Template Editor
        </button>
      </div>

      {/* Panel Content */}
      <div className="panel-content">
        {activeTab === 'workflow' ? (
          <RegistrationWorkflowPanel
            servicesManager={servicesManager}
            commandsManager={commandsManager}
            extensionManager={extensionManager}
            seriesInstanceUID={seriesInstanceUID}
            caseId={caseId}
            studyInstanceUID={studyInstanceUID}
            onSessionStarted={handleSessionStarted}
          />
        ) : (
          <FiducialTemplateEditorPanel
            servicesManager={servicesManager}
            commandsManager={commandsManager}
            extensionManager={extensionManager}
            seriesInstanceUID={seriesInstanceUID}
            caseId={caseId}
            studyInstanceUID={studyInstanceUID}
          />
        )}
      </div>
    </div>
  );
}
