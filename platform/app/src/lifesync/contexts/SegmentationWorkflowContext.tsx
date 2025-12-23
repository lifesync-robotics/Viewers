/**
 * Segmentation Workflow Context
 * SIMPLIFIED: Use existing OHIF segmentation functionality
 * This is just a pass-through wrapper - no need to duplicate OHIF segmentation context
 */

import React from 'react';
import PropTypes from 'prop-types';

export interface SegmentationWorkflowProviderProps {
  children: React.ReactNode;
}

/**
 * Simplified SegmentationWorkflowProvider - just passes children through
 * Use OHIF's existing segmentationService directly from servicesManager
 */
export function SegmentationWorkflowProvider({ children }: SegmentationWorkflowProviderProps) {
  console.log('ℹ️ [SegmentationWorkflowProvider] Pass-through provider - use OHIF segmentationService');
  
  // Just pass children through - no context needed
  // Components should use servicesManager.services.segmentationService directly
  return <>{children}</>;
}

SegmentationWorkflowProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Note: Use servicesManager.services.segmentationService directly instead
 * Example: const { segmentationService } = servicesManager.services;
 */

