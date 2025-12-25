import React, { ReactNode, useState, useCallback, useEffect } from 'react';
import { useSystem } from '@ohif/core';
import {
  Button,
  Icons,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useViewportGrid,
  useIconPresentation,
} from '@ohif/ui-next';
import { ScrewEditorActionMenu } from './ScrewEditorActionMenu';
import { planningBackendService } from '../../services';

export interface ScrewEditorActionMenuWrapperProps {
  viewportId: string;
  location?: number;
  isOpen?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  disabled?: boolean;
  isEmbedded?: boolean;
  onInteraction?: () => void;
}

export function ScrewEditorActionMenuWrapper(
  props: ScrewEditorActionMenuWrapperProps
): ReactNode {
  const {
    viewportId,
    location,
    isOpen = false,
    onOpen,
    onClose,
    disabled,
    isEmbedded = false,
    ...rest
  } = props;

  const [gridState] = useViewportGrid();
  const viewportIdToUse = viewportId || gridState.activeViewportId;
  const { servicesManager } = useSystem();
  const { toolbarService } = servicesManager.services;
  const { IconContainer, className: iconClassName, containerProps } = useIconPresentation();

  // Track screw count for conditional rendering
  const [screwCount, setScrewCount] = useState(0);

  /**
   * Get screw count - first from backend, fallback to ModelStateService
   * This matches how ScrewManagementPanel loads screws
   */
  const refreshScrewCount = useCallback(async () => {
    try {
      // Try to get screw count from planning backend (authoritative source)
      const sessionId = sessionStorage.getItem('ohif_session_id') || 
                       localStorage.getItem('ohif_planning_session_id');
      
      if (sessionId && planningBackendService) {
        const response = await planningBackendService.listScrews(sessionId);
        if (response?.success && response.screws) {
          setScrewCount(response.screws.length);
          return;
        }
      }

      // Fallback: check ModelStateService for 3D models
      const modelStateService = (servicesManager.services as any).modelStateService;
      if (!modelStateService) {
        return;
      }

      const allModels = modelStateService.getAllModels();
      
      // Filter for screw models (exclude caps)
      const screwModels = allModels.filter((model: any) => {
        const metadata = model.metadata || {};
        const modelName = (metadata.name || '').toLowerCase();
        
        // Exclude cap models
        if (modelName.includes('-cap') || modelName.endsWith('cap')) {
          return false;
        }
        
        const modelType = metadata.type?.toLowerCase() || '';
        return (
          modelType === 'screw' ||
          modelType.includes('pedicle') ||
          modelName.includes('screw') ||
          modelName.includes('pedicle') ||
          /^[ltsc]\d+[-_]?[lr]\d*$/i.test(metadata.label || '') ||
          /^[ltsc]\d+[-_]?[lr]/i.test(modelName)
        );
      });

      setScrewCount(screwModels.length);
    } catch (error) {
      console.warn('[ScrewEditorWrapper] Error getting screw count:', error);
    }
  }, [servicesManager]);

  useEffect(() => {
    refreshScrewCount();

    const modelStateService = (servicesManager.services as any).modelStateService;
    if (!modelStateService?.subscribe) {
      // Fallback: poll for changes
      const intervalId = setInterval(refreshScrewCount, 2000);
      return () => clearInterval(intervalId);
    }

    const subscriptions: Array<{ unsubscribe: () => void }> = [];

    const addedSub = modelStateService.subscribe(
      modelStateService.EVENTS?.MODEL_ADDED || 'MODEL_ADDED',
      refreshScrewCount
    );
    if (addedSub) subscriptions.push(addedSub);

    const removedSub = modelStateService.subscribe(
      modelStateService.EVENTS?.MODEL_REMOVED || 'MODEL_REMOVED',
      refreshScrewCount
    );
    if (removedSub) subscriptions.push(removedSub);

    const updatedSub = modelStateService.subscribe(
      modelStateService.EVENTS?.MODEL_UPDATED || 'MODEL_UPDATED',
      refreshScrewCount
    );
    if (updatedSub) subscriptions.push(updatedSub);

    return () => {
      subscriptions.forEach(sub => sub?.unsubscribe?.());
    };
  }, [servicesManager, refreshScrewCount]);

  const handleOpenChange = (openState: boolean) => {
    if (openState) {
      onOpen?.();
    } else {
      onClose?.();
    }
  };

  const { align, side } = toolbarService?.getAlignAndSide?.(location) || { align: 'end', side: 'top' };

  // SECONDARY CONDITIONAL DISPLAY - Don't render icon if no screws are implanted
  if (screwCount === 0) {
    return null;
  }

  const Icon = isOpen ? (
    <Icons.Close className={iconClassName} />
  ) : (
    <Icons.ScrewEditor className={iconClassName} />
  );

  return (
    <Popover
      open={isOpen}
      onOpenChange={handleOpenChange}
    >
      <PopoverTrigger
        asChild
        className="flex items-center justify-center"
      >
        <div>
          {IconContainer ? (
            <IconContainer
              disabled={disabled}
              {...rest}
              {...containerProps}
            >
              {Icon}
            </IconContainer>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              disabled={disabled}
              title={`Screw Editor (${screwCount} screws)`}
            >
              {Icon}
            </Button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="border-none bg-transparent p-0 shadow-none"
        side={side}
        align={align}
        alignOffset={0}
        sideOffset={5}
      >
        <ScrewEditorActionMenu
          viewportId={viewportIdToUse}
          align={align}
          side={side}
          onClose={() => onClose?.()}
        />
      </PopoverContent>
    </Popover>
  );
}

export default ScrewEditorActionMenuWrapper;

