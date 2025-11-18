# Debug Guide: Toolbar Button Not Showing

## Console Logs to Check

When you start the viewer, look for these console messages in order:

### 1. Toolbar Module Registration
```
🔧 [getToolbarModule] Initializing toolbar module
🔧 [getToolbarModule] Services available: { ... }
🔧 [getToolbarModule] Registered ModelUploadButton: { name: 'ohif.modelUploadButton', ... }
```

**What this tells you:**
- ✅ If you see these: Toolbar module is loading correctly
- ❌ If missing: Extension might not be loading

---

### 2. Command Registration
```
📦 [commandsModule] Total commands registered: XXX
📦 [commandsModule] showModelUploadModal registered: true
✅ [commandsModule] showModelUploadModal command definition: { ... }
```

**What this tells you:**
- ✅ If you see these: Command is registered properly
- ❌ If missing or shows `false`: Command registration failed

---

### 3. Button Component Render (When toolbar loads)
```
🔘 [ModelUploadButton] Component rendered
🔘 [ModelUploadButton] Component mounted
🔘 [ModelUploadButton] CommandsManager available: true
🔘 [ModelUploadButton] Command "showModelUploadModal" registered: true
```

**What this tells you:**
- ✅ If you see "Component rendered": Button is being included in toolbar
- ❌ If NOT showing: Button is not added to toolbar section in your mode
- ❌ If "CommandsManager available: false": System not initialized properly
- ❌ If "Command registered: false": Command not found

---

### 4. Button Click (When you click the button)
```
🔘 [ModelUploadButton] Button clicked!
🔘 [ModelUploadButton] Attempting to run command: showModelUploadModal
✅ [ModelUploadButton] Command executed successfully
```

**What this tells you:**
- ✅ If you see these: Button click is working
- ❌ If missing: Button might not be rendered or click handler failed

---

### 5. Command Execution (After button click)
```
📦 [showModelUploadModal] Command executed
📦 [showModelUploadModal] ServicesManager: true
📦 [showModelUploadModal] uiModalService available: true
📦 [showModelUploadModal] ModelUpload component: true
📦 [showModelUploadModal] Opening modal...
✅ [showModelUploadModal] Modal shown successfully
```

**What this tells you:**
- ✅ If you see all these: Everything working!
- ❌ If "uiModalService available: false": Modal service not initialized
- ❌ If "ModelUpload component: false": Import failed

---

## Troubleshooting Based on Logs

### Scenario 1: No logs at all
**Problem:** Extension not loading

**Solution:**
1. Check `extensions/cornerstone/src/index.tsx` - is `getToolbarModule` exported?
2. Check if cornerstone extension is loaded in your app config
3. Restart the dev server

---

### Scenario 2: Toolbar logs show, but no button render logs
**Problem:** Button not added to toolbar section in mode

**Solution:**
Add button to your mode configuration:

```typescript
// In your mode's index.tsx
onModeEnter: ({ servicesManager }) => {
  const { toolbarService } = servicesManager.services;

  // Add button definition
  toolbarService.addButtons([
    {
      id: 'ModelUpload',
      uiType: 'ohif.button',
      props: {
        icon: 'icon-3d-model',
        label: 'Upload Models',
        commands: 'showModelUploadModal',
      },
    },
  ]);

  // Add to section
  toolbarService.createButtonSection('primary', [
    'Zoom',
    'WindowLevel',
    'ModelUpload',  // ← Add this
  ]);
}
```

---

### Scenario 3: Button renders but command not found
**Problem:** Command registration failed or wrong command name

**Check the logs:**
```
❌ [ModelUploadButton] Command "showModelUploadModal" NOT FOUND!
Available commands: [...]
```

**Solution:**
1. Check if `showModelUploadModal` is in the available commands list
2. If not, check `commandsModule.ts` - is the command exported?
3. Restart the dev server to reload commands

---

### Scenario 4: Command runs but modal doesn't open
**Problem:** uiModalService not available or ModelUpload import failed

**Check the logs:**
```
❌ [showModelUploadModal] uiModalService is not available!
Available services: [...]
```

**Solution:**
1. Check if `uiModalService` is in the available services list
2. Check `commandsModule.ts` - is `ModelUpload` imported correctly?
3. Check the import path: `import { ModelUpload } from './components/ModelUpload';`

---

### Scenario 5: Everything logs success but modal still doesn't appear
**Problem:** Modal service issue or React rendering problem

**Solution:**
1. Check browser console for React errors
2. Check if other modals work in the viewer
3. Try the modal directly from console:
   ```javascript
   window.servicesManager.services.uiModalService.show({
     content: () => <div>Test Modal</div>,
     title: 'Test',
   });
   ```

---

## Manual Testing Commands

### Test if command is registered
```javascript
// In browser console
const cmd = window.commandsManager.getDefinition('showModelUploadModal');
console.log('Command found:', !!cmd);
console.log('Command details:', cmd);
```

### Test command directly
```javascript
// In browser console
window.commandsManager.runCommand('showModelUploadModal');
// Should open the modal
```

### Check available commands
```javascript
// In browser console
const commands = window.commandsManager.getContext('CORNERSTONE');
console.log('All CORNERSTONE commands:', commands);
```

### Check if button is in toolbar
```javascript
// In browser console
const toolbarService = window.servicesManager.services.toolbarService;
console.log('Toolbar buttons:', toolbarService.getButtons());
```

---

## Complete Log Flow (Expected)

When everything is working, you should see this sequence:

```
1. 🔧 [getToolbarModule] Initializing toolbar module
2. 🔧 [getToolbarModule] Services available: { ... }
3. 🔧 [getToolbarModule] Registered ModelUploadButton: { ... }
4. 📦 [commandsModule] Total commands registered: XXX
5. 📦 [commandsModule] showModelUploadModal registered: true
6. ✅ [commandsModule] showModelUploadModal command definition: { ... }

[When toolbar loads:]
7. 🔘 [ModelUploadButton] Component rendered
8. 🔘 [ModelUploadButton] Component mounted
9. 🔘 [ModelUploadButton] CommandsManager available: true
10. 🔘 [ModelUploadButton] Command "showModelUploadModal" registered: true

[When button is clicked:]
11. 🔘 [ModelUploadButton] Button clicked!
12. 🔘 [ModelUploadButton] Attempting to run command: showModelUploadModal
13. ✅ [ModelUploadButton] Command executed successfully
14. 📦 [showModelUploadModal] Command executed
15. 📦 [showModelUploadModal] ServicesManager: true
16. 📦 [showModelUploadModal] uiModalService available: true
17. 📦 [showModelUploadModal] ModelUpload component: true
18. 📦 [showModelUploadModal] Opening modal...
19. ✅ [showModelUploadModal] Modal shown successfully
```

---

## Quick Checklist

Before reporting an issue, verify:

- [ ] Extension is enabled in app config
- [ ] Dev server was restarted after adding code
- [ ] Button is added to mode's toolbar buttons array
- [ ] Button ID is added to toolbar section
- [ ] Command is imported in commandsModule
- [ ] ModelUpload component is imported in commandsModule
- [ ] No TypeScript/linter errors
- [ ] Browser console is open to see logs

---

## Need More Help?

If you're still having issues, provide:

1. **All console logs** from startup to button click
2. **Your mode configuration** (toolbar buttons + sections)
3. **Any error messages** (red text in console)
4. **Screenshot** of browser console

Then I can pinpoint exactly where the issue is! 🔍
