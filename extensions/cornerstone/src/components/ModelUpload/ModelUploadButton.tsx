import React, { useEffect } from 'react';
import { Button, Icons } from '@ohif/ui-next';
import { useSystem } from '@ohif/core';

/**
 * ModelUploadButton - A toolbar button that opens the 3D model upload modal
 *
 * This component is registered in the toolbar module and can be added to any
 * toolbar section in the mode configuration.
 */
function ModelUploadButton() {
  console.log('🔘 [ModelUploadButton] Component rendered');

  const { commandsManager } = useSystem();

  useEffect(() => {
    // console.log('🔘 [ModelUploadButton] Component mounted');
    // console.log('🔘 [ModelUploadButton] CommandsManager available:', !!commandsManager);
    // console.log('🔘 [ModelUploadButton] CommandsManager type:', typeof commandsManager);
  }, [commandsManager]);

  const handleClick = () => {
    // console.log('🔘 [ModelUploadButton] Button clicked!');
    console.log('🔘 [ModelUploadButton] Attempting to run command: showModelUploadModal');

    try {
      commandsManager.runCommand('showModelUploadModal');
      // console.log('✅ [ModelUploadButton] Command executed successfully');
    } catch (error) {
      console.error('❌ [ModelUploadButton] Error running command:', error);
    }
  };

  return (
    <Button
      variant="ghost"
      size="default"
      onClick={handleClick}
      className="flex items-center gap-2"
      title="Upload 3D Models (OBJ)"
    >
      <Icons.Upload className="w-5 h-5" />
      <span className="hidden lg:inline">Upload Models</span>
    </Button>
  );
}

export default ModelUploadButton;
