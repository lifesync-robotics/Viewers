# Initialization Order Fix

## Problem

**Error**: `Configuration not initialized. Call initialize() first.`

```
Error: Configuration not initialized. Call initialize() first.
    at WorkflowConfigLoader.getConfig
    at WorkflowService._createDefaultState
    at new WorkflowService (constructor)
    at ServicesManager.registerService
```

## Root Cause

**Initialization Order Issue**: The `WorkflowService` constructor was being called **before** the workflow configuration (YAML) was initialized.

### Sequence (Before Fix)

```
1. appInit() starts
   ↓
2. ServicesManager.registerServices() called
   ↓
3. WorkflowService constructor runs
   ├── Calls _createDefaultState()
   ├── Tries to access getWorkflowConfig()
   └── ❌ ERROR: Config not initialized!
   ↓
4. (initializeWorkflowConfig never called)
```

The `WorkflowConfigLoader` singleton requires explicit initialization by calling `initializeWorkflowConfig()` to load the YAML file. This was never happening before the service was created.

## Solution

Initialize the workflow configuration **before** registering the `WorkflowService`.

### Sequence (After Fix)

```
1. appInit() starts
   ↓
2. await initializeWorkflowConfig()
   ├── Loads workflow-config.yaml
   ├── Parses YAML
   ├── Creates WorkflowConfigLoader singleton
   └── ✅ Config ready!
   ↓
3. ServicesManager.registerServices() called
   ↓
4. WorkflowService constructor runs
   ├── Calls _createDefaultState()
   ├── Calls getWorkflowConfig()
   └── ✅ SUCCESS: Config is initialized!
```

## Changes Made

### 1. ✅ Import `initializeWorkflowConfig` in `appInit.js`

**File**: `Viewers/platform/app/src/appInit.js`

```javascript
// Before
import { WorkflowService, registerWorkflowCommands } from './lifesync';

// After
import { WorkflowService, registerWorkflowCommands, initializeWorkflowConfig } from './lifesync';
```

### 2. ✅ Call `initializeWorkflowConfig()` Before Service Registration

**File**: `Viewers/platform/app/src/appInit.js`

**Added before `servicesManager.registerServices()`**:

```javascript
servicesManager.setExtensionManager(extensionManager);

// Initialize workflow configuration BEFORE creating WorkflowService
// This ensures the YAML config is loaded before the service constructor runs
console.log('🔧 [appInit] Initializing workflow configuration...');
try {
  await initializeWorkflowConfig();
  console.log('✅ [appInit] Workflow configuration initialized');
} catch (error) {
  console.error('❌ [appInit] Failed to initialize workflow configuration:', error);
  throw error; // Fail loudly - config is required
}

servicesManager.registerServices([
  // ... services including WorkflowService
]);
```

**Key Points**:
- ✅ `await` - ensures config is fully loaded before continuing
- ✅ Try-catch with re-throw - fails loudly if config can't load
- ✅ Logged for debugging

### 3. ✅ Export Config Module from Main Index

**File**: `Viewers/platform/app/src/lifesync/index.ts`

```typescript
// Configuration (must be exported before services)
export * from './config';

// Types
export * from './types';

// Services
export * from './services';
// ... rest of exports
```

**Why First?**: Ensures config module is available when other modules need it.

## How It Works Now

### Full Initialization Flow

```
1. App starts (index.js)
   ↓
2. App.tsx renders
   ↓
3. useEffect runs appInit()
   ↓
4. appInit() sequence:
   
   a) Create managers (CommandsManager, ServicesManager, etc.)
   
   b) Initialize workflow config:
      🔧 [appInit] Initializing workflow configuration...
      📂 Loading workflow-config.yaml
      🔍 Parsing YAML
      ✅ Config singleton created
      ✅ [appInit] Workflow configuration initialized
   
   c) Register all services:
      - WorkflowService constructor runs
      - Can safely call getWorkflowConfig()
      - Creates default state from config
      ✅ [WorkflowService] Service initialized
   
   d) Connect service to managers
   
   e) Register workflow commands
   
   f) Load extensions
   
   g) Return initialized app
   ↓
5. App renders with initialized services
```

### Config Lifecycle

```
Singleton Pattern:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. First Call: initializeWorkflowConfig()
   ├── Creates WorkflowConfigLoader instance
   ├── Loads YAML file
   ├── Stores in singleton
   └── Returns void

2. Subsequent Calls: getWorkflowConfig()
   ├── Returns existing singleton
   ├── No re-initialization
   └── Fast access

3. Multiple Calls: initializeWorkflowConfig()
   ├── Detects already initialized
   ├── Logs warning (doesn't re-init)
   └── Safe to call multiple times
```

## Console Output

### Expected Logs (Success)

```
🔧 [appInit] Initializing workflow configuration...
📂 [WorkflowConfigLoader] Loading workflow configuration...
🔍 [WorkflowConfigLoader] Parsing YAML configuration...
✅ [WorkflowConfigLoader] Configuration loaded successfully
✅ [appInit] Workflow configuration initialized

🚀 [WorkflowService] Initializing Surgical Workflow Service...
🏗️ [WorkflowService] Creating default workflow state from configuration
📋 [WorkflowService] Config loaded: 5 stages, initial stage: overview
  ✓ Stage: overview, canAdvance: true, isFinal: false
  ✓ Stage: segmentation, canAdvance: false, isFinal: false
  ✓ Stage: planning, canAdvance: false, isFinal: false
  ✓ Stage: reporting, canAdvance: false, isFinal: false
  ✓ Stage: review, canAdvance: false, isFinal: true
✅ [WorkflowService] Service initialized: { currentStage: 'overview', hasPersistedState: false }

✅ [appInit] WorkflowService registered
✅ [appInit] WorkflowService connected to ServicesManager and CommandsManager
✅ [appInit] Workflow commands registered
```

### Error Logs (If Config Fails)

```
🔧 [appInit] Initializing workflow configuration...
❌ [WorkflowConfigLoader] Failed to load configuration: ...
❌ [appInit] Failed to initialize workflow configuration: Error: ...
(App fails to start - as intended)
```

## Benefits

### 1. **Correct Initialization Order**
- Config loaded before services need it
- No race conditions
- Deterministic startup

### 2. **Clear Error Messages**
- If config fails, app won't start
- Error points to config loading (not service creation)
- Easier to debug

### 3. **Fail-Fast**
- Invalid config detected immediately
- Doesn't hide errors in service initialization
- Forces config to be correct

### 4. **Single Source of Truth Enforced**
- Config MUST be loaded from YAML
- No fallback state creation
- Config is always the source

### 5. **Async-Safe**
- `await` ensures config fully loaded
- No timing issues
- Works with file I/O

## Testing

### Test 1: Valid Config

1. **Ensure** `workflow-config.yaml` exists and is valid
2. **Start** app
3. **Check console** - should see successful initialization logs
4. **Verify** workflow features work

### Test 2: Missing Config File

1. **Rename** `workflow-config.yaml` temporarily
2. **Start** app
3. **Expected**: App fails to start with clear error message
4. **Restore** config file

### Test 3: Invalid YAML Syntax

1. **Break** YAML syntax in config (e.g., wrong indentation)
2. **Start** app
3. **Expected**: App fails with YAML parse error
4. **Fix** syntax

### Test 4: Config Loads Before Service

1. **Add breakpoint** in `WorkflowService` constructor
2. **Start** app with debugger
3. **Verify** config is initialized when breakpoint hits
4. **Check** `getWorkflowConfig()` returns valid config

## Files Modified

1. **`Viewers/platform/app/src/appInit.js`**
   - Added `initializeWorkflowConfig` import
   - Added config initialization before service registration
   - Added error handling and logging

2. **`Viewers/platform/app/src/lifesync/index.ts`**
   - Added config module export at top (before services)
   - Ensures config is available for import

## Related Issues Fixed

- ✅ **"Configuration not initialized"** error
- ✅ **Initialization order** dependency
- ✅ **YAML as single source of truth** enforced
- ✅ **No fallback mechanisms** needed (config always available)

## Why This Approach

### Alternative 1: Lazy Initialization (NOT CHOSEN)
```typescript
// In WorkflowService constructor
if (!isConfigInitialized()) {
  await initializeWorkflowConfig();
}
```

**Problems**:
- Constructor can't be async
- Delayed error detection
- Complex state management

### Alternative 2: Fallback State (NOT CHOSEN)
```typescript
// In WorkflowService constructor
try {
  config = getWorkflowConfig();
} catch {
  config = hardcodedFallback;
}
```

**Problems**:
- Defeats "single source of truth"
- Hides config errors
- Creates maintenance burden

### Chosen: Explicit Initialization (✅ BEST)
```typescript
// In appInit, before services
await initializeWorkflowConfig();
// Then register WorkflowService
```

**Benefits**:
- ✅ Clear initialization order
- ✅ Fails fast if config wrong
- ✅ Simple and explicit
- ✅ No hidden fallbacks
- ✅ Easy to test and debug

## Summary

The initialization order fix ensures the workflow configuration is **fully loaded** before any services try to use it.

**Key Changes**:
1. Import `initializeWorkflowConfig` in `appInit.js`
2. Call `await initializeWorkflowConfig()` before registering services
3. Export config module from main index

**Result**: Config is guaranteed to be ready when `WorkflowService` constructor runs, eliminating the "Configuration not initialized" error.

**Philosophy**: Fail fast with clear errors rather than hide problems with fallbacks. YAML config is the single source of truth and must be valid for app to start. 🎉

