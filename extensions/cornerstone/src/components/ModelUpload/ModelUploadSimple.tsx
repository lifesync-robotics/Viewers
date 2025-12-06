/**
 * ModelUploadSimple - Simplified version without Dropzone dependencies
 *
 * Use this if you're having issues with Dropzone or react-dropzone
 */

import React, { useState, useRef } from 'react';
import classNames from 'classnames';
import { useModelStateService } from '../../hooks/useModelStateService';

interface ModelUploadSimpleProps {
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

function ModelUploadSimple({
  viewportId,
  onComplete,
  onStarted,
  defaultColor = [0.8, 0.2, 0.2],
  defaultOpacity = 1.0,
}: ModelUploadSimpleProps) {
  const modelStateService = useModelStateService();
  const [uploadedModels, setUploadedModels] = useState<UploadedModel[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: FileList | File[]) => {
    if (onStarted) {
      onStarted();
    }

    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      return ['obj', 'stl', 'ply'].includes(ext || '');
    });

    if (validFiles.length === 0) {
      alert('Please upload valid 3D model files (.obj, .stl, .ply)');
      return;
    }

    // Initialize upload status
    const modelsToUpload: UploadedModel[] = validFiles.map(file => ({
      file,
      status: 'pending',
      progress: 0,
    }));

    setUploadedModels(modelsToUpload);

    // Process each file
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];

      // Update to loading
      setUploadedModels(prev =>
        prev.map((m, idx) => (idx === i ? { ...m, status: 'loading', progress: 50 } : m))
      );

      try {
        const loadedModel = await modelStateService.loadModelFromFileInput(file, {
          viewportId,
          color: defaultColor,
          opacity: defaultOpacity,
        });

        if (loadedModel) {
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

    if (onComplete) {
      onComplete();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  const handleRemoveModel = (modelId: string) => {
    modelStateService.removeModel(modelId);
    setUploadedModels(prev => prev.filter(m => m.modelId !== modelId));
  };

  if (uploadedModels.length > 0) {
    // Show progress
    const allSuccess = uploadedModels.every(m => m.status === 'success');
    const hasErrors = uploadedModels.some(m => m.status === 'error');

    return (
      <div className="w-full max-w-4xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">
            Upload Progress ({uploadedModels.filter(m => m.status === 'success').length}/
            {uploadedModels.length})
          </h3>
          <button
            onClick={() => setUploadedModels([])}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
          >
            Close
          </button>
        </div>

        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {uploadedModels.map((model, index) => (
            <div
              key={index}
              className={classNames(
                'border rounded-lg p-4',
                model.status === 'success' && 'border-green-500 bg-green-900/20',
                model.status === 'error' && 'border-red-500 bg-red-900/20',
                model.status === 'loading' && 'border-blue-500 bg-blue-900/20',
                model.status === 'pending' && 'border-gray-500'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-white">{model.file.name}</div>
                  <div className="text-sm text-gray-400">
                    {(model.file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                  {model.error && <div className="text-sm text-red-500 mt-1">{model.error}</div>}
                </div>

                {model.status === 'success' && model.modelId && (
                  <button
                    onClick={() => handleRemoveModel(model.modelId!)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>

              {model.status === 'loading' && (
                <div className="mt-3 w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${model.progress || 0}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {allSuccess && (
          <div className="mt-6 p-4 rounded-lg bg-green-900/20 border border-green-500 text-green-500">
            ✅ All models loaded successfully!
          </div>
        )}
        {hasErrors && (
          <div className="mt-6 p-4 rounded-lg bg-yellow-900/20 border border-yellow-500 text-yellow-500">
            ⚠️ Some models failed to load. Check file formats.
          </div>
        )}
      </div>
    );
  }

  // Show upload UI
  return (
    <div className="w-full max-w-4xl p-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".obj,.stl"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={classNames(
          'border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all',
          isDragging
            ? 'border-blue-500 bg-blue-900/20 scale-105'
            : 'border-gray-600 hover:border-blue-400 hover:bg-gray-800/50'
        )}
      >
        <div className="flex flex-col items-center gap-6">
          <div className="text-6xl">📦</div>

          <div className="text-2xl font-semibold text-white">
            {isDragging ? 'Drop Models Here!' : 'Upload 3D Models'}
          </div>

          <div className="space-y-2 text-gray-400">
            <p>Click to select files or drag and drop</p>
            <p className="text-sm">Supported: <span className="text-blue-400 font-semibold">.OBJ, .STL</span></p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors"
            >
              Select Files
            </button>
          </div>

          <div className="text-xs text-gray-500 max-w-md">
            <p>💡 You can select multiple files at once</p>
            <p>🎨 Models will be rendered in red by default</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ModelUploadSimple;
