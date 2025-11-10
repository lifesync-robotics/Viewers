/**
 * ModelUpload Component
 *
 * A complete GUI for uploading 3D model files (.obj, .stl, .ply)
 * with drag-and-drop support.
 *
 * Based on DicomUpload component pattern.
 */

import React, { useCallback, useState, useEffect } from 'react';
import Dropzone from 'react-dropzone';
import classNames from 'classnames';
import { Button, ButtonEnums, Icon } from '@ohif/ui';
import { useModelStateService } from '../../hooks/useModelStateService';

interface ModelUploadProps {
  viewportId: string;
  onComplete?: () => void;
  onStarted?: () => void;
  defaultColor?: [number, number, number];
  defaultOpacity?: number;
}

interface UploadedModel {
  file: File;
  status: 'pending' | 'loading' | 'success' | 'error';
  modelId?: string;
  error?: string;
  progress?: number;
}

interface ServerModel {
  id: string;
  name: string;
  filename: string;
  type: 'server' | 'user';
  url: string;
  size: number;
  createdAt: Date;
  format: string;
}

const baseClassNames = 'flex flex-row h-full gap-4 p-4';

function ModelUpload({
  viewportId,
  onComplete,
  onStarted,
  defaultColor = [0.8, 0.2, 0.2],
  defaultOpacity = 1.0,
}: ModelUploadProps) {
  console.log('🎨 [ModelUpload] Component rendering with props:', {
    viewportId,
    hasOnComplete: !!onComplete,
    hasOnStarted: !!onStarted,
    defaultColor,
    defaultOpacity,
  });

  const modelStateService = useModelStateService();
  const [uploadedModels, setUploadedModels] = useState<UploadedModel[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Server models state
  const [serverModels, setServerModels] = useState<ServerModel[]>([]);
  const [selectedModelUrl, setSelectedModelUrl] = useState<string>('');
  const [isLoadingServerModels, setIsLoadingServerModels] = useState(false);
  const [isLoadingSelectedModel, setIsLoadingSelectedModel] = useState(false);

  console.log('🎨 [ModelUpload] ModelStateService available:', !!modelStateService);
  console.log('🎨 [ModelUpload] Current viewport ID:', viewportId);

  useEffect(() => {
    console.log('🎨 [ModelUpload] Component mounted in DOM');
    loadServerModels();
    return () => {
      console.log('🎨 [ModelUpload] Component unmounted from DOM');
    };
  }, []);

  useEffect(() => {
    console.log('🎨 [ModelUpload] ViewportId changed to:', viewportId);
  }, [viewportId]);

  // Load server models on mount
  const loadServerModels = async () => {
    setIsLoadingServerModels(true);
    try {
      const models = await modelStateService.fetchAvailableModels();
      console.log('📋 [ModelUpload] Fetched server models:', models.length);
      setServerModels(models);
    } catch (error) {
      console.error('❌ [ModelUpload] Error loading server models:', error);
    } finally {
      setIsLoadingServerModels(false);
    }
  };

  const processFiles = async (files: File[]) => {
    if (onStarted) {
      onStarted();
    }

    setIsUploading(true);

    // Initialize upload status for all files
    const modelsToUpload: UploadedModel[] = files.map(file => ({
      file,
      status: 'pending',
      progress: 0,
    }));

    setUploadedModels(modelsToUpload);

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Update status to loading
      setUploadedModels(prev =>
        prev.map((m, idx) => (idx === i ? { ...m, status: 'loading', progress: 50 } : m))
      );

      try {
        const loadedModel = await modelStateService.loadModelFromFileInput(file, {
          viewportId,
          color: defaultColor,
          opacity: defaultOpacity,
          visible: true,
        });

        if (loadedModel) {
          // Success
          setUploadedModels(prev =>
            prev.map((m, idx) =>
              idx === i
                ? {
                    ...m,
                    status: 'success',
                    progress: 100,
                    modelId: loadedModel.metadata.id,
                  }
                : m
            )
          );
        } else {
          // Failed
          setUploadedModels(prev =>
            prev.map((m, idx) =>
              idx === i
                ? {
                    ...m,
                    status: 'error',
                    error: 'Failed to load model',
                  }
                : m
            )
          );
        }
      } catch (error) {
        console.error('Error loading model:', error);
        setUploadedModels(prev =>
          prev.map((m, idx) =>
            idx === i
              ? {
                  ...m,
                  status: 'error',
                  error: error.message || 'Unknown error',
                }
              : m
          )
        );
      }
    }

    setIsUploading(false);

    if (onComplete) {
      onComplete();
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const validFiles = acceptedFiles.filter(file => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        return ['obj', 'stl', 'ply'].includes(ext || '');
      });

      if (validFiles.length === 0) {
        alert('Please upload valid 3D model files (.obj, .stl, .ply)');
        return;
      }

      await processFiles(validFiles);
    },
    [viewportId, defaultColor, defaultOpacity]
  );

  const handleReset = () => {
    setUploadedModels([]);
    setIsUploading(false);
  };

  const handleRemoveModel = (modelId: string) => {
    modelStateService.removeModel(modelId);
    setUploadedModels(prev => prev.filter(m => m.modelId !== modelId));
  };

  // Handle server model selection
  const handleSelectServerModel = (modelUrl: string) => {
    setSelectedModelUrl(modelUrl);
    console.log('🎯 [ModelUpload] Selected model:', modelUrl);
  };

  // Handle loading selected server model
  const handleLoadServerModel = async () => {
    if (!selectedModelUrl) {
      alert('Please select a model first');
      return;
    }

    setIsLoadingSelectedModel(true);
    try {
      console.log('📥 [ModelUpload] Loading server model:', selectedModelUrl);

      const loadedModel = await modelStateService.loadModelFromServer(selectedModelUrl, {
        viewportId,
        color: defaultColor,
        opacity: defaultOpacity,
        visible: true,
      });

      if (loadedModel) {
        console.log('✅ [ModelUpload] Server model loaded successfully');
        if (onComplete) {
          onComplete();
        }
      } else {
        alert('Failed to load model from server');
      }
    } catch (error) {
      console.error('❌ [ModelUpload] Error loading server model:', error);
      alert('Error loading model: ' + error.message);
    } finally {
      setIsLoadingSelectedModel(false);
    }
  };

  const getUploadPanel = () => {
    return (
      <div className="flex-1 flex flex-col">
        <h3 className="text-xl font-semibold text-white mb-4">Upload Models</h3>

        {uploadedModels.length > 0 ? (
          getProgressComponent()
        ) : (
          <Dropzone
            onDrop={acceptedFiles => {
              onDrop(acceptedFiles);
            }}
          >
            {({ getRootProps, isDragActive }) => (
              <div
                {...getRootProps()}
                className={classNames(
                  'border-2 border-dashed rounded-lg cursor-pointer transition-colors',
                  isDragActive
                    ? 'border-primary-light bg-primary-dark/20'
                    : 'border-secondary-light hover:border-primary-light',
                  'p-8 text-center flex-1 flex items-center justify-center'
                )}
              >
                <div className="flex flex-col items-center gap-4">
                  {/* Icon */}
                  <div className="text-primary-light">
                    <Icon
                      name="launch-arrow"
                      className="w-12 h-12"
                    />
                  </div>

                  {/* Title */}
                  <div className="text-lg font-semibold text-white">
                    {isDragActive ? 'Drop 3D Models Here' : 'Upload 3D Models'}
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3">
                    <Dropzone
                      onDrop={onDrop}
                      noDrag
                    >
                      {({ getRootProps, getInputProps }) => (
                        <div {...getRootProps()}>
                          <input {...getInputProps()} />
                          <Button
                            type={ButtonEnums.type.primary}
                            onClick={() => {}}
                          >
                            Select Files
                          </Button>
                        </div>
                      )}
                    </Dropzone>

                    <Dropzone
                      onDrop={onDrop}
                      noDrag
                    >
                      {({ getRootProps, getInputProps }) => (
                        <div {...getRootProps()}>
                          <input
                            {...getInputProps()}
                            {...({
                              webkitdirectory: '',
                              mozdirectory: '',
                              directory: '',
                            } as any)}
                          />
                          <Button
                            type={ButtonEnums.type.secondary}
                            onClick={() => {}}
                          >
                            Select Folder
                          </Button>
                        </div>
                      )}
                    </Dropzone>
                  </div>

                  {/* Instructions */}
                  <div className="text-sm text-secondary-light">
                    or drag and drop files here
                  </div>

                  {/* Supported formats */}
                  <div className="text-xs text-aqua-pale">
                    Supported: <span className="font-semibold">.OBJ</span>
                  </div>
                </div>
              </div>
            )}
          </Dropzone>
        )}
      </div>
    );
  };

  const getServerModelsPanel = () => {
    return (
      <div className="flex-1 flex flex-col border-l border-secondary-light pl-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">Server Models</h3>
          <Button
            type={ButtonEnums.type.secondary}
            size={ButtonEnums.size.small}
            onClick={loadServerModels}
            disabled={isLoadingServerModels}
          >
            {isLoadingServerModels ? 'Loading...' : 'Refresh'}
          </Button>
        </div>

        {isLoadingServerModels ? (
          <div className="flex items-center justify-center flex-1">
            <div className="text-secondary-light">Loading models from server...</div>
          </div>
        ) : serverModels.length === 0 ? (
          <div className="flex items-center justify-center flex-1">
            <div className="text-center text-secondary-light">
              <div className="mb-2">📦 No models available on server</div>
              <div className="text-sm">Upload models or add them to the models/server/ directory</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1">
            {/* Model list */}
            <div className="flex-1 overflow-y-auto space-y-2 mb-4 max-h-[500px]">
              {serverModels.map((model) => (
                <div
                  key={model.id}
                  className={classNames(
                    'border rounded-lg p-3 cursor-pointer transition-colors',
                    selectedModelUrl === model.url
                      ? 'border-primary-light bg-primary-dark/30'
                      : 'border-secondary-light hover:border-primary-light hover:bg-secondary-dark'
                  )}
                  onClick={() => handleSelectServerModel(model.url)}
                >
                  <div className="flex items-start gap-3">
                    {/* Radio button */}
                    <input
                      type="radio"
                      name="serverModel"
                      checked={selectedModelUrl === model.url}
                      onChange={() => handleSelectServerModel(model.url)}
                      className="mt-1 w-4 h-4 text-primary-light"
                      onClick={(e) => e.stopPropagation()}
                    />

                    {/* Model info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white truncate">
                        {model.filename}
                      </div>
                      <div className="text-xs text-secondary-light mt-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={classNames(
                            'px-2 py-0.5 rounded text-xs',
                            model.type === 'server'
                              ? 'bg-blue-900/30 text-blue-300'
                              : 'bg-green-900/30 text-green-300'
                          )}>
                            {model.type === 'server' ? '🖥️ Server' : '👤 User'}
                          </span>
                          <span>{(model.size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                        <div className="text-xs">
                          Format: {model.format.toUpperCase()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Load button */}
            <div className="pt-4 border-t border-secondary-light">
              {isLoadingSelectedModel ? (
                <button
                  disabled
                  className="w-full px-4 py-2 bg-primary-light/50 text-white rounded flex items-center justify-center gap-2"
                >
                  <Icon name="icon-status-loader" className="animate-spin w-4 h-4" />
                  <span>Loading Model...</span>
                </button>
              ) : (
                <Button
                  type={ButtonEnums.type.primary}
                  onClick={handleLoadServerModel}
                  disabled={!selectedModelUrl}
                  className="w-full"
                >
                  Load Selected Model
                </Button>
              )}

              {selectedModelUrl && (
                <div className="mt-2 text-xs text-secondary-light text-center">
                  Selected: {serverModels.find(m => m.url === selectedModelUrl)?.filename}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const getProgressComponent = () => {
    const allSuccess = uploadedModels.every(m => m.status === 'success');
    const hasErrors = uploadedModels.some(m => m.status === 'error');

    return (
      <div className="w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-base font-semibold text-white">
            Upload Progress ({uploadedModels.filter(m => m.status === 'success').length}/
            {uploadedModels.length})
          </div>
          <div className="flex gap-2">
            {allSuccess && (
              <Button
                type={ButtonEnums.type.secondary}
                size={ButtonEnums.size.small}
                onClick={handleReset}
              >
                Upload More
              </Button>
            )}
            <Button
              type={ButtonEnums.type.secondary}
              size={ButtonEnums.size.small}
              onClick={() => setUploadedModels([])}
            >
              Close
            </Button>
          </div>
        </div>

        {/* Progress list */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {uploadedModels.map((model, index) => (
            <div
              key={index}
              className={classNames(
                'border rounded-lg p-3',
                model.status === 'success' && 'border-green-500 bg-green-900/20',
                model.status === 'error' && 'border-red-500 bg-red-900/20',
                model.status === 'loading' && 'border-primary-light bg-primary-dark/20',
                model.status === 'pending' && 'border-secondary-light'
              )}
            >
              <div className="flex items-center justify-between">
                {/* File info */}
                <div className="flex items-center gap-3 flex-1">
                  {/* Status icon */}
                  <div>
                    {model.status === 'success' && (
                      <Icon
                        name="status-tracked"
                        className="text-green-500 w-6 h-6"
                      />
                    )}
                    {model.status === 'error' && (
                      <Icon
                        name="status-alert"
                        className="text-red-500 w-6 h-6"
                      />
                    )}
                    {model.status === 'loading' && (
                      <Icon
                        name="icon-status-loader"
                        className="text-primary-light w-6 h-6 animate-spin"
                      />
                    )}
                    {model.status === 'pending' && (
                      <Icon
                        name="icon-status-alert"
                        className="text-secondary-light w-6 h-6"
                      />
                    )}
                  </div>

                  {/* File name */}
                  <div className="flex-1">
                    <div className="font-semibold text-white">{model.file.name}</div>
                    <div className="text-sm text-secondary-light">
                      {(model.file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                    {model.error && <div className="text-sm text-red-500 mt-1">{model.error}</div>}
                  </div>
                </div>

                {/* Actions */}
                {model.status === 'success' && model.modelId && (
                  <Button
                    type={ButtonEnums.type.secondary}
                    size={ButtonEnums.size.small}
                    onClick={() => handleRemoveModel(model.modelId!)}
                  >
                    Remove
                  </Button>
                )}
              </div>

              {/* Progress bar */}
              {model.status === 'loading' && (
                <div className="mt-3 w-full bg-secondary-dark rounded-full h-2">
                  <div
                    className="bg-primary-light h-2 rounded-full transition-all duration-300"
                    style={{ width: `${model.progress || 0}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Summary */}
        {(allSuccess || hasErrors) && (
          <div className="mt-3 p-3 rounded-lg bg-secondary-dark border border-secondary-light text-sm">
            {allSuccess && (
              <div className="text-green-500">
                ✅ All models loaded successfully!
              </div>
            )}
            {hasErrors && (
              <div className="text-yellow-500">
                ⚠️ Some models failed to load.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={baseClassNames}>
      {/* Left Panel: Upload */}
      {getUploadPanel()}

      {/* Right Panel: Server Models */}
      {getServerModelsPanel()}
    </div>
  );
}

export default ModelUpload;
