# Quick Start - In-Memory Workflow System

## ✅ Latest Update: In-Memory State Only

The workflow system now uses **in-memory state only** - no persistence to sessionStorage or localStorage.

## 🎯 What This Means

### For Users
- **Workflow resets on page refresh** - This is INTENTIONAL
- Fresh start every session
- No stale data
- Config changes take effect immediately

### For Developers
- Edit `workflow-config.yaml` → reload → changes applied
- No storage clearing needed
- No migration logic
- State always matches config

## 🚀 Getting Started

### 1. Just Reload

That's it! No storage to clear. State is created fresh from YAML config every time.

### 2. Check Console

You should see:
```
🔧 [appInit] Initializing workflow configuration...
✅ [appInit] Workflow configuration initialized
🚀 [WorkflowService] Initializing Surgical Workflow Service...
🏗️ [WorkflowService] Creating default workflow state from configuration
📋 [WorkflowService] Config loaded: 5 stages, initial stage: overview
✅ [WorkflowService] Fresh workflow state created from config (in-memory only)
```

**Key**: "in-memory only" - no loading from storage!

### 3. Use the Workflow

1. Load a study
2. Click "Forward" to advance
3. Confirm advancement
4. Workflow progresses normally ✅

## 📝 Configuration

**Single Source**: `config/workflow-config.yaml`

All workflow structure is defined here:
- Stage IDs and names
- Stage order
- Validation rules
- Dependencies
- Routes
- Everything!

## 🔧 Making Changes

### Add/Remove/Rename Stages

1. Edit `workflow-config.yaml`
2. Reload page
3. Changes applied immediately ✅

No code changes needed!

### Example: Change Initial Stage Name

```yaml
stages:
  - id: "start"  # Changed from "overview"
    name: "Start"
    properties:
      isInitial: true
```

Reload → New stage name in use!

## ❌ What NOT to Do

### DON'T Use Deprecated Files

```typescript
// ❌ DON'T DO THIS
import { saveWorkflowState } from './utils/workflowPersistence';  // DEPRECATED
import { validateBeginningStage } from './utils/workflowValidation';  // DEPRECATED
```

### DO Use Config-Driven Validation

```typescript
// ✅ DO THIS
import { validateStageFromConfig } from './utils/configValidation';

const validation = validateStageFromConfig('overview', state);
```

## 🧪 Testing

### Test Fresh State

1. Advance through a few stages
2. Reload page (F5)
3. **Expected**: Back to initial stage
4. **Result**: ✅ Fresh state!

### Test Config Changes

1. Edit YAML (e.g., change stage name)
2. Reload page
3. **Expected**: New name appears
4. **Result**: ✅ Config applied!

## 📊 Architecture Summary

```
Page Load
    ↓
Initialize YAML Config
    ↓
Create Fresh State from Config
    ↓
Use In-Memory
    ↓
Page Refresh → Start Over (Fresh State)
```

**Benefits**:
- ✅ Simple
- ✅ Predictable
- ✅ Config-driven
- ✅ No bugs from stale data

## 📚 Documentation

- **`IN_MEMORY_STATE_REFACTORING.md`** - Complete architecture explanation
- **`workflow-config.yaml`** - Configuration file (single source of truth)
- **`configValidation.ts`** - Config-driven validation (use this!)

## ❓ FAQ

### Q: Why does workflow reset on refresh?

**A**: This is intentional! Each page load is a fresh session. Surgical workflows are case-specific - you load a new study for each case, so state should start fresh.

### Q: Can I keep state across reloads?

**A**: No, and you shouldn't want to. State is derived from config. If config changes, old persisted state would be invalid anyway.

### Q: What happened to sessionStorage?

**A**: Removed! Persistence layer is deprecated. State is in-memory only.

### Q: How do I clear old state?

**A**: You don't need to! There's no persisted state anymore. Just reload.

### Q: What if I need to save workflow data?

**A**: The workflow STATE (current stage, completion status) is ephemeral. Actual medical DATA (segmentations, plans, reports) is saved to the backend server. This distinction is important!

## 🎉 Summary

**Workflow System**:
- ✅ Config-driven (YAML)
- ✅ In-memory only
- ✅ Fresh start on reload
- ✅ Simple and predictable

**To Use**:
1. Edit `workflow-config.yaml` for changes
2. Reload to see changes
3. No storage management needed

**Result**: Clean, maintainable workflow system! 🚀

