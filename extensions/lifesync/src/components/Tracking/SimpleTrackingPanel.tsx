/**
 * SimpleTrackingPanel - Simple UI for starting/stopping tracking navigation
 * 
 * This is the simplified version that matches the old workflow:
 * 1. Click "Start Navigation" button
 * 2. Tracking connects and crosshair starts moving
 * 3. Click "Stop Navigation" to stop
 */

import React, { useState, useEffect } from 'react';
import { useSystem } from '@ohif/core';

export default function SimpleTrackingPanel() {
  const { servicesManager, commandsManager } = useSystem();
  const { trackingService } = servicesManager.services;

  const [isNavigating, setIsNavigating] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [position, setPosition] = useState<number[] | null>(null);
  const [quality, setQuality] = useState<string | null>(null);
  const [frameCount, setFrameCount] = useState(0);

  useEffect(() => {
    if (!trackingService) {
      return;
    }

    // Subscribe to connection status
    const connectionSub = trackingService.subscribe(
      'event::connection_status',
      (status: any) => {
        setIsConnected(status.connected);
      }
    );

    // Subscribe to tracking updates
    const trackingSub = trackingService.subscribe(
      'event::tracking_update',
      (data: any) => {
        setPosition(data.position || null);
        setQuality(data.quality || null);
        setFrameCount(prev => prev + 1);
      }
    );

    return () => {
      connectionSub?.unsubscribe();
      trackingSub?.unsubscribe();
    };
  }, [trackingService]);

  const handleStartNavigation = async () => {
    try {
      await commandsManager.runCommand('startNavigation', { mode: 'circular' });
      setIsNavigating(true);
    } catch (error) {
      console.error('Failed to start navigation:', error);
    }
  };

  const handleStopNavigation = () => {
    try {
      commandsManager.runCommand('stopNavigation');
      setIsNavigating(false);
      setFrameCount(0);
    } catch (error) {
      console.error('Failed to stop navigation:', error);
    }
  };

  const handleSetCenter = () => {
    try {
      commandsManager.runCommand('setTrackingCenter');
    } catch (error) {
      console.error('Failed to set center:', error);
    }
  };

  return (
    <div className="h-full overflow-hidden bg-black p-4">
      <div className="h-full overflow-auto">
        <h2 className="text-2xl font-bold text-white mb-4">🧭 Surgical Navigation</h2>

        {/* Connection Status */}
        <div className="mb-6 p-4 rounded border border-gray-600 bg-gray-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-300">Connection Status</span>
            <span className={`text-sm font-medium ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              {isConnected ? '● Connected' : '● Disconnected'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Navigation Status</span>
            <span className={`text-sm font-medium ${isNavigating ? 'text-green-400' : 'text-gray-500'}`}>
              {isNavigating ? '● Active' : '● Inactive'}
            </span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="mb-6 space-y-3">
          {!isNavigating ? (
            <button
              onClick={handleStartNavigation}
              className="w-full p-4 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
            >
              ▶️ Start Navigation
            </button>
          ) : (
            <button
              onClick={handleStopNavigation}
              className="w-full p-4 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
            >
              ⏹️ Stop Navigation
            </button>
          )}

          <button
            onClick={handleSetCenter}
            disabled={!isConnected}
            className="w-full p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white rounded transition-colors"
          >
            📍 Set Center
          </button>
        </div>

        {/* Position Display */}
        {isNavigating && position && (
          <div className="mb-6 p-4 rounded border border-green-600 bg-green-900 bg-opacity-20">
            <h3 className="text-lg font-semibold text-white mb-3">Crosshair Position</h3>
            <div className="space-y-2 font-mono text-sm">
              <div className="flex justify-between text-gray-300">
                <span>X:</span>
                <span className="text-green-400">{position[0]?.toFixed(2)} mm</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Y:</span>
                <span className="text-green-400">{position[1]?.toFixed(2)} mm</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Z:</span>
                <span className="text-green-400">{position[2]?.toFixed(2)} mm</span>
              </div>
              {quality && (
                <div className="flex justify-between text-gray-300 pt-2 border-t border-gray-700">
                  <span>Quality:</span>
                  <span className="text-blue-400">{quality}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-300 pt-2 border-t border-gray-700">
                <span>Frames:</span>
                <span className="text-purple-400">{frameCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!isNavigating && (
          <div className="p-4 rounded border border-gray-600 bg-gray-800 text-gray-300 text-sm">
            <h3 className="font-semibold text-white mb-2">Instructions:</h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>Load a study with volume data</li>
              <li>Click "Start Navigation" to begin tracking</li>
              <li>The crosshair will move based on tracking data</li>
              <li>Click "Set Center" to recenter the tracking</li>
              <li>Click "Stop Navigation" when done</li>
            </ol>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-700">
          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>Tracking Service:</span>
              <span>{trackingService ? '🟢 Loaded' : '🔴 Not Available'}</span>
            </div>
            <div className="flex justify-between">
              <span>Mode:</span>
              <span>Simulation</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

