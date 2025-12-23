import React, { useState, useCallback } from 'react';
import Uploady, { 
  useItemProgressListener, 
  useItemFinishListener, 
  useItemErrorListener,
  useBatchAbortListener,
  useAbortBatch
} from '@rpldy/uploady';
import UploadButton from '@rpldy/upload-button';
import MultiStageProgressBar from './MultiStageProgressBar';
import type { Stage, DicomServerUploadProps } from './types';

interface DicomServerUploadInternalProps {
  servicesManager?: any;
}

// Internal component that uses Uploady hooks
const DicomServerUploadInternal: React.FC<DicomServerUploadInternalProps> = ({ servicesManager }) => {
  const [stages, setStages] = useState<Stage[]>([
    { name: 'Upload', startPercent: 0, endPercent: 30, status: 'pending' },
    { name: 'Processing', startPercent: 30, endPercent: 80, status: 'pending' },
    { name: 'Download', startPercent: 80, endPercent: 100, status: 'pending' },
  ]);
  const [currentStageIndex, setCurrentStageIndex] = useState(-1);
  const [currentStageProgress, setCurrentStageProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);

  // Get abort functionality from react-uploady
  const abortBatch = useAbortBatch();

  // Listen to upload progress
  useItemProgressListener((item) => {
    if (currentStageIndex === 0) {
      // Upload stage
      setCurrentStageProgress(item.completed);
      console.log(`Upload progress: ${item.completed}%`);
    }
    
    // Store batch ID for cancellation
    if (item.batchId && !currentBatchId) {
      setCurrentBatchId(item.batchId);
    }
  });

  // Listen to upload finish
  useItemFinishListener((item) => {
    console.log('Upload finished:', item);
    
    // Mark upload stage as completed
    setStages((prev) =>
      prev.map((stage, idx) =>
        idx === 0 ? { ...stage, status: 'completed' } : stage
      )
    );
    
    // Move to processing stage
    setCurrentStageIndex(1);
    setCurrentStageProgress(0);
    setStages((prev) =>
      prev.map((stage, idx) =>
        idx === 1 ? { ...stage, status: 'in-progress' } : stage
      )
    );

    // Simulate server processing
    simulateServerProcessing(item);
  });

  // Listen to upload errors
  useItemErrorListener((item) => {
    console.error('Upload error:', item);
    setErrorMessage(`Upload failed: ${item.uploadResponse?.data?.message || 'Unknown error'}`);
    
    setStages((prev) =>
      prev.map((stage, idx) =>
        idx === currentStageIndex ? { ...stage, status: 'error' } : stage
      )
    );
    
    setIsUploading(false);
  });

  // Listen to batch abort
  useBatchAbortListener(() => {
    console.log('Upload cancelled by user');
    setErrorMessage('Upload cancelled');
    
    setStages((prev) =>
      prev.map((stage, idx) =>
        idx === currentStageIndex ? { ...stage, status: 'error' } : stage
      )
    );
    
    setIsUploading(false);
    setCurrentBatchId(null);
  });

  // Simulate server processing and download
  const simulateServerProcessing = useCallback((uploadedItem: any) => {
    let processingProgress = 0;
    
    const processingInterval = setInterval(() => {
      processingProgress += 5;
      setCurrentStageProgress(processingProgress);
      
      if (processingProgress >= 100) {
        clearInterval(processingInterval);
        
        // Mark processing as completed
        setStages((prev) =>
          prev.map((stage, idx) =>
            idx === 1 ? { ...stage, status: 'completed' } : stage
          )
        );
        
        // Move to download stage
        setCurrentStageIndex(2);
        setCurrentStageProgress(0);
        setStages((prev) =>
          prev.map((stage, idx) =>
            idx === 2 ? { ...stage, status: 'in-progress' } : stage
          )
        );
        
        // Simulate download
        simulateDownload();
      }
    }, 200);
  }, []);

  const simulateDownload = useCallback(() => {
    let downloadProgress = 0;
    
    const downloadInterval = setInterval(() => {
      downloadProgress += 10;
      setCurrentStageProgress(downloadProgress);
      
      if (downloadProgress >= 100) {
        clearInterval(downloadInterval);
        
        // Mark download as completed
        setStages((prev) =>
          prev.map((stage, idx) =>
            idx === 2 ? { ...stage, status: 'completed' } : stage
          )
        );
        
        setIsUploading(false);
        console.log('✅ All stages completed!');
        
        // Show success notification
        if (servicesManager) {
          const { uiNotificationService } = servicesManager.services;
          if (uiNotificationService) {
            uiNotificationService.show({
              title: 'Upload Complete',
              message: 'DICOM series uploaded and processed successfully',
              type: 'success',
              duration: 5000,
            });
          }
        }
      }
    }, 150);
  }, [servicesManager]);

  const handleUploadStart = useCallback(() => {
    console.log('Upload started');
    setIsUploading(true);
    setErrorMessage('');
    setCurrentStageIndex(0);
    setCurrentStageProgress(0);
    
    // Reset all stages
    setStages([
      { name: 'Upload', startPercent: 0, endPercent: 30, status: 'in-progress' },
      { name: 'Processing', startPercent: 30, endPercent: 80, status: 'pending' },
      { name: 'Download', startPercent: 80, endPercent: 100, status: 'pending' },
    ]);
  }, []);

  const handleCancelUpload = useCallback(() => {
    if (currentBatchId) {
      console.log('Cancelling upload, batch ID:', currentBatchId);
      abortBatch(currentBatchId);
    }
  }, [currentBatchId, abortBatch]);

  const resetUpload = useCallback(() => {
    setIsUploading(false);
    setCurrentStageIndex(-1);
    setCurrentStageProgress(0);
    setErrorMessage('');
    setCurrentBatchId(null);
    setStages([
      { name: 'Upload', startPercent: 0, endPercent: 30, status: 'pending' },
      { name: 'Processing', startPercent: 30, endPercent: 80, status: 'pending' },
      { name: 'Download', startPercent: 80, endPercent: 100, status: 'pending' },
    ]);
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h3
        style={{
          color: '#e5e7eb',
          fontSize: '18px',
          fontWeight: '600',
          marginBottom: '20px',
          borderBottom: '1px solid #4a5568',
          paddingBottom: '10px',
        }}
      >
        DICOM Server Upload
      </h3>

      {/* Upload Controls */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        {!isUploading ? (
          <div style={{ flex: 1 }}>
            <UploadButton
              onClick={handleUploadStart}
              extraProps={{
                style: {
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#3182ce',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                },
                onMouseEnter: (e) => {
                  e.currentTarget.style.backgroundColor = '#2c5282';
                },
                onMouseLeave: (e) => {
                  e.currentTarget.style.backgroundColor = '#3182ce';
                },
              }}
            >
              <span style={{ color: '#ffffff' }}>📤 Select DICOM Files</span>
            </UploadButton>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: '#4a5568',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'not-allowed',
              textAlign: 'center',
            }}
          >
            <span style={{ color: '#ffffff' }}>⏳ Uploading...</span>
          </div>
        )}

        {/* Cancel Button - only show during upload stage */}
        {isUploading && currentStageIndex === 0 && (
          <button
            onClick={handleCancelUpload}
            style={{
              padding: '12px 20px',
              backgroundColor: '#e53e3e',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#c53030';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#e53e3e';
            }}
          >
            ✕ Cancel
          </button>
        )}
      </div>

      {/* Progress Display */}
      {currentStageIndex >= 0 && (
        <div
          style={{
            backgroundColor: '#1a202c',
            borderRadius: '8px',
            padding: '10px',
            border: '1px solid #2d3748',
          }}
        >
          <MultiStageProgressBar
            stages={stages}
            currentStageIndex={currentStageIndex}
            currentStageProgress={currentStageProgress}
            errorMessage={errorMessage}
          />
        </div>
      )}

      {/* Reset Button */}
      {(stages.some(s => s.status === 'completed') || errorMessage) && !isUploading && (
        <button
          onClick={resetUpload}
          style={{
            marginTop: '15px',
            width: '100%',
            padding: '10px',
            backgroundColor: '#2d3748',
            color: '#e5e7eb',
            border: '1px solid #4a5568',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#374151';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#2d3748';
          }}
        >
          Reset Upload
        </button>
      )}

      {/* Info Text */}
      <div
        style={{
          marginTop: '20px',
          padding: '12px',
          backgroundColor: 'rgba(49, 130, 206, 0.1)',
          border: '1px solid rgba(49, 130, 206, 0.3)',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#90cdf4',
        }}
      >
        <strong>ℹ️ Upload Process:</strong>
        <ul style={{ marginTop: '8px', paddingLeft: '20px', marginBottom: 0 }}>
          <li>Upload (0-30%): Sending DICOM files to server</li>
          <li>Processing (30-80%): Server analyzes and processes data</li>
          <li>Download (80-100%): Retrieving processed results</li>
        </ul>
      </div>
    </div>
  );
};

// Main component with Uploady wrapper
const DicomServerUpload: React.FC<DicomServerUploadProps> = ({
  servicesManager,
  commandsManager,
}) => {
  const [serverUrl, setServerUrl] = useState('http://localhost:8080/upload');

  return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: '#0f172a' }}>
      {/* Server URL Configuration */}
      <div style={{ padding: '20px', borderBottom: '1px solid #2d3748' }}>
        <label
          style={{
            display: 'block',
            color: '#e5e7eb',
            fontSize: '13px',
            fontWeight: '500',
            marginBottom: '8px',
          }}
        >
          🌐 Server URL
        </label>
        <input
          type="text"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder="http://your-server:port/upload"
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#1a202c',
            color: '#e5e7eb',
            border: '1px solid #4a5568',
            borderRadius: '6px',
            fontSize: '13px',
            outline: 'none',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#3182ce';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#4a5568';
          }}
        />
        <div
          style={{
            marginTop: '6px',
            fontSize: '11px',
            color: '#a0aec0',
          }}
        >
          Enter the endpoint URL where DICOM files will be uploaded
        </div>
      </div>

      {/* Uploady Provider */}
      <Uploady
        destination={{
          url: serverUrl,
          method: 'POST',
        }}
        multiple={true}
        accept="application/dicom,.dcm"
        autoUpload={false}
      >
        <DicomServerUploadInternal servicesManager={servicesManager} />
      </Uploady>
    </div>
  );
};

export default DicomServerUpload;

