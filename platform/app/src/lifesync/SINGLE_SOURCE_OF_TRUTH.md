# Single Source of Truth Architecture

## Problem: Hardcoded Workflow Configuration (SOLVED ✅)

### Previous Issue
The workflow system had **dual sources of truth**:
1. **workflow-config.yaml** - Configuration file with stages, routes, labels
2. **workflow.types.ts** - Hardcoded TypeScript constants duplicating the YAML

This caused bugs when one was updated but not the other (e.g., 'reporting' vs 'navigation' mismatch).

## Solution: YAML as Single Source of Truth

### Architecture Overview

```
workflow-config.yaml (MASTER)
         ↓
WorkflowConfigLoader.ts (LOADER)
         ↓
workflow.types.ts (DYNAMIC EXPORTS)
         ↓
All Components (CONSUMERS)
```

### Key Principle
**NEVER hardcode workflow configuration in TypeScript!**
- All stage names come from YAML
- All routes come from YAML
- All labels come from YAML
- All validation rules come from YAML

## Implementation

### 1. Configuration File (workflow-config.yaml)

```yaml
workflow:
  stages:
    - id: "overview"
      name: "Start"
      route: "/overview"
      order: 1
      # ... more config

    - id: "segmentation"
      name: "Segmentation"
      route: "/segmentation"
      order: 2
      # ... more config

    # ... more stages
```

**✅ This is the ONLY place where workflow structure is defined!**

### 2. Configuration Loader (WorkflowConfigLoader.ts)

Provides typed access to configuration:

```typescript
import { getWorkflowConfig } from './config/WorkflowConfigLoader';

const config = getWorkflowConfig();

// Get all stages
const stages = config.getStages();

// Get stage order (array of IDs)
const order = config.getStageOrder(); // ['overview', 'segmentation', ...]

// Get stage labels (ID -> Name mapping)
const labels = config.getStageLabels(); // { overview: 'Start', ... }

// Get stage routes (ID -> Route mapping)
const routes = config.getStageRoutes(); // { overview: '/overview', ... }

// Get specific stage
const stage = config.getStage('segmentation');
```

### 3. Type Exports (workflow.types.ts)

**NEW: Dynamic exports that read from config**

```typescript
// ✅ CORRECT: Getter functions (always use these!)
import { getStageOrder, getStageLabels, getStageRoutes } from './types';

const order = getStageOrder();     // Dynamically from YAML
const labels = getStageLabels();   // Dynamically from YAML
const routes = getStageRoutes();   // Dynamically from YAML
```

**LEGACY: Constants (backward compatibility only)**

```typescript
// ⚠️ DEPRECATED but still works: Legacy constants
import { STAGE_ORDER, STAGE_LABELS, STAGE_ROUTES } from './types';

// These use Proxy to dynamically fetch from config
// But prefer getter functions above!
```

### 4. Component Usage

**✅ CORRECT Pattern:**

```typescript
import { getStageOrder, getStageLabels } from '../../types';

export function MyComponent() {
  const stageOrder = getStageOrder();     // From YAML
  const stageLabels = getStageLabels();   // From YAML
  
  return (
    <div>
      {stageOrder.map(stageId => (
        <div key={stageId}>{stageLabels[stageId]}</div>
      ))}
    </div>
  );
}
```

**❌ WRONG Pattern (Don't do this!):**

```typescript
// ❌ NEVER hardcode stage names!
const stages = ['overview', 'segmentation', 'planning']; // NO!

// ❌ NEVER hardcode labels!
const labels = { overview: 'Start', segmentation: 'Segmentation' }; // NO!
```

## Benefits of This Architecture

### 1. **Single Source of Truth**
- Only workflow-config.yaml defines workflow structure
- No duplication = No inconsistencies
- Easy to maintain and update

### 2. **Type Safety**
- TypeScript types generated from config
- Compile-time validation of stage references
- Auto-complete in IDEs

### 3. **Dynamic Configuration**
- Change workflow without code changes
- Easy to add/remove stages
- Configurable per deployment

### 4. **Testability**
- Easy to test with different configs
- Config loader has reset() method for tests
- Mock configurations for unit tests

### 5. **Backward Compatibility**
- Legacy constants still work (via Proxy)
- Gradual migration path
- No breaking changes for existing code

## Migration Guide

### Step 1: Replace Hardcoded Arrays

**Before:**
```typescript
const stages = ['overview', 'segmentation', 'planning'];
```

**After:**
```typescript
import { getStageOrder } from '../../types';
const stages = getStageOrder();
```

### Step 2: Replace Hardcoded Objects

**Before:**
```typescript
const labels = {
  overview: 'Start',
  segmentation: 'Segmentation',
};
```

**After:**
```typescript
import { getStageLabels } from '../../types';
const labels = getStageLabels();
```

### Step 3: Replace Route Mapping

**Before:**
```typescript
const routes = {
  overview: '/overview',
  segmentation: '/segmentation',
};
```

**After:**
```typescript
import { getStageRoutes } from '../../types';
const routes = getStageRoutes();
```

### Step 4: Get Stage from Route

**Before:**
```typescript
// Hardcoded route-to-stage mapping
function getStageFromRoute(route: string): string {
  switch (route) {
    case '/overview': return 'overview';
    case '/segmentation': return 'segmentation';
    // ...
  }
}
```

**After:**
```typescript
import { getStageFromRoute } from '../../utils/getStageFromRoute';
const stageId = getStageFromRoute('/segmentation'); // From YAML
```

## Files in the Architecture

### Core Files (DO NOT hardcode workflow config here)
- ✅ `workflow-config.yaml` - Master configuration (ONLY place to define workflow)
- ✅ `WorkflowConfigLoader.ts` - Loader with typed access methods
- ✅ `workflow.types.ts` - Dynamic exports (Proxy-based backward compatibility)
- ✅ `getStageFromRoute.ts` - Route-to-stage mapping utility

### Consumer Files (Use config, don't hardcode)
- ✅ `WorkflowWidget.tsx` - Uses `STAGE_ORDER` (legacy) or `getStageOrder()`
- ✅ `WorkflowNavigator.tsx` - Uses config loader for fallback
- ✅ `WorkflowService.ts` - Creates state from config
- ✅ All mode files (`planner/index.ts`, `segmentation/index.tsx`, etc.)

## Testing with Custom Configuration

```typescript
import { getWorkflowConfig } from './config/WorkflowConfigLoader';
import yaml from 'js-yaml';

// Create custom config for testing
const customConfig = yaml.dump({
  workflow: {
    name: 'Test Workflow',
    stages: [
      { id: 'test1', name: 'Test 1', route: '/test1', order: 1, ... },
      { id: 'test2', name: 'Test 2', route: '/test2', order: 2, ... },
    ],
    // ... rest of config
  },
  ui: { ... }
});

// Reset and initialize with custom config
const loader = getWorkflowConfig();
loader.reset();
await loader.initialize(customConfig);

// Now all getters return custom config
const stages = getStageOrder(); // ['test1', 'test2']
```

## FAQ

### Q: Can I still use STAGE_ORDER constant?
**A:** Yes, for backward compatibility. But prefer `getStageOrder()` function for new code.

### Q: How do I add a new workflow stage?
**A:** Edit `workflow-config.yaml` only. Code will automatically pick it up.

### Q: What if config isn't loaded yet?
**A:** Getter functions return empty arrays/objects. Components should handle gracefully.

### Q: Can I have multiple workflow configurations?
**A:** Yes, create different YAML files and load the appropriate one at initialization.

### Q: How do I validate my YAML changes?
**A:** The `WorkflowConfigLoader` validates on load. Check console for errors.

## Best Practices

### DO ✅
- Always use getter functions (`getStageOrder()`, `getStageLabels()`, `getStageRoutes()`)
- Use `getWorkflowConfig()` for direct config access
- Use `getStageFromRoute()` utility for route-to-stage mapping
- Update only `workflow-config.yaml` for workflow changes
- Test with custom configs in unit tests

### DON'T ❌
- Never hardcode stage names in TypeScript/JavaScript
- Never hardcode stage labels or routes
- Never create manual route-to-stage mappings
- Never duplicate workflow structure in code
- Never skip config validation errors

## Summary

The workflow configuration is now truly a **single source of truth**:
- **One master file**: `workflow-config.yaml`
- **One loader**: `WorkflowConfigLoader.ts`
- **Dynamic exports**: `workflow.types.ts` (via Proxy)
- **All consumers**: Read from config, never hardcode

This prevents bugs like the 'reporting' vs 'navigation' mismatch and makes the system maintainable, testable, and flexible.

---

**Last Updated:** December 2024
**Status:** ✅ Implemented and Working

