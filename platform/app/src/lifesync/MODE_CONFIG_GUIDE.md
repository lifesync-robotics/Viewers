# Mode Configuration Guide: Eliminating Hardcoded Stage Names

## 🎯 Problem Statement

**Modes were hardcoding stage names**, directly calling `setCurrentStage('segmentation')` or similar, which:
1. **Violated single source of truth** - workflow-config.yaml was being overridden
2. **Created maintenance burden** - changing stage IDs required updating multiple files
3. **Caused bugs** - stale references (like 'beginning') persisted in code
4. **Broke config-driven architecture** - modes controlled workflow instead of workflow controlling modes

## ✅ Solution: Modes Are Passive, Workflow Is Active

### Core Principle

**Modes should NEVER set the workflow stage!**

- ✅ **DO**: Read current stage from `WorkflowService`
- ❌ **DON'T**: Call `setCurrentStage()` in modes
- ✅ **DO**: Let workflow navigation commands handle stage transitions
- ❌ **DON'T**: Hardcode stage IDs anywhere in mode code

### Why This Works

```
USER ACTION
   ↓
Workflow Navigation Command (sets stage based on route)
   ↓
Mode onModeEnter (reads current stage)
   ↓
Mode operates with current stage
   ↓
Mode onModeExit (saves data to current stage)
```

The **workflow navigation system** (`workflowCommands.ts`) already:
1. Maps routes to stages using config
2. Sets the correct stage before navigation
3. Validates transitions
4. Handles state management

Modes just need to **read and use** what the workflow has set!

## 📝 Implementation Pattern

### ✅ CORRECT: onModeEnter

```typescript
export function onModeEnter({ servicesManager }) {
  const { surgicalWorkflowService } = servicesManager.services;
  
  console.log('🚀 [MyMode] onModeEnter');
  
  if (surgicalWorkflowService) {
    try {
      // ✅ READ the current stage (already set by navigation)
      const currentStage = surgicalWorkflowService.getCurrentStage();
      console.log(`✅ [MyMode] Current workflow stage: ${currentStage}`);
      
      // ✅ Load data for current stage
      const workflowData = surgicalWorkflowService.getStageData(currentStage);
      if (workflowData && Object.keys(workflowData).length > 2) {
        console.log('📂 [MyMode] Loaded workflow data:', workflowData);
        // Use the data...
      }
    } catch (error) {
      console.error('❌ [MyMode] Error reading workflow stage:', error);
    }
  }
}
```

### ❌ WRONG: onModeEnter

```typescript
export function onModeEnter({ servicesManager }) {
  const { surgicalWorkflowService } = servicesManager.services;
  
  if (surgicalWorkflowService) {
    // ❌ DON'T hardcode stage names!
    surgicalWorkflowService.setCurrentStage('segmentation');
    
    // ❌ DON'T use hardcoded stage IDs!
    const workflowData = surgicalWorkflowService.getStageData('segmentation');
  }
}
```

### ✅ CORRECT: onModeExit

```typescript
export function onModeExit({ servicesManager }) {
  const { surgicalWorkflowService } = servicesManager.services;
  
  console.log('🧹 [MyMode] onModeExit');
  
  if (surgicalWorkflowService) {
    try {
      // ✅ READ current stage
      const currentStage = surgicalWorkflowService.getCurrentStage();
      const currentStageData = surgicalWorkflowService.getStageData(currentStage);
      
      // ✅ Save data to current stage
      surgicalWorkflowService.updateStageData(currentStage, {
        completed: currentStageData.completed, // Preserve workflow status
        myData: someData,
        timestamp: Date.now(),
      });
      
      console.log(`✅ [MyMode] Data saved for ${currentStage}`);
    } catch (error) {
      console.error('❌ [MyMode] Error saving data:', error);
    }
  }
}
```

### ❌ WRONG: onModeExit

```typescript
export function onModeExit({ servicesManager }) {
  const { surgicalWorkflowService } = servicesManager.services;
  
  if (surgicalWorkflowService) {
    // ❌ DON'T hardcode stage names!
    surgicalWorkflowService.updateStageData('segmentation', {
      myData: someData,
    });
  }
}
```

## 🔍 Accessing Data from Other Stages

Sometimes you need data from a **different** stage (e.g., planner needs segmentation data):

### ✅ CORRECT: Iterate Through All Stages

```typescript
// In planner mode, looking for segmentation data
const allStages = surgicalWorkflowService.getState().stages;

for (const [stageId, stageData] of Object.entries(allStages)) {
  const data = stageData as any;
  
  // Look for data by its characteristics, not by stage name
  if (data.seriesInstanceUID && data.sessionId) {
    console.log(`📊 Found segmentation data in stage ${stageId}`);
    // Use the data...
    break;
  }
}
```

### ✅ ALSO CORRECT: Check All Stages for Completion

```typescript
// Check which stages are completed
const allStages = surgicalWorkflowService.getState().stages;

for (const [stageId, stageData] of Object.entries(allStages)) {
  const data = stageData as any;
  const currentStage = surgicalWorkflowService.getCurrentStage();
  
  if (stageId !== currentStage && data.completed) {
    console.log(`✅ Prerequisite completed: ${stageId}`);
  } else if (stageId !== currentStage && !data.completed) {
    console.warn(`⚠️ Prerequisite not completed: ${stageId}`);
  }
}
```

### ❌ WRONG: Hardcode Stage IDs

```typescript
// ❌ DON'T do this!
const segData = surgicalWorkflowService.getStageData('segmentation');
if (!segData.completed) {
  console.warn('Segmentation not completed');
}
```

## 📊 Files Updated

### 1. ✅ Basic Mode (`Viewers/modes/basic/src/index.tsx`)

**Before:**
```typescript
surgicalWorkflowService.setCurrentStage('overview');
const workflowData = surgicalWorkflowService.getStageData('overview');
```

**After:**
```typescript
const currentStage = surgicalWorkflowService.getCurrentStage();
const workflowData = surgicalWorkflowService.getStageData(currentStage);
```

### 2. ✅ Segmentation Mode (`Viewers/modes/segmentation/src/index.tsx`)

**Before:**
```typescript
surgicalWorkflowService.setCurrentStage('segmentation');
const workflowData = surgicalWorkflowService.getStageData('segmentation');
```

**After:**
```typescript
const currentStage = surgicalWorkflowService.getCurrentStage();
const workflowData = surgicalWorkflowService.getStageData(currentStage);
```

### 3. ✅ Planner Mode (`Viewers/modes/planner/src/index.ts`)

**Before:**
```typescript
surgicalWorkflowService.setCurrentStage('planning');
const segmentationData = surgicalWorkflowService.getStageData('segmentation');
```

**After:**
```typescript
const currentStage = surgicalWorkflowService.getCurrentStage();

// Find segmentation data by iterating (no hardcoded stage name)
const allStages = surgicalWorkflowService.getState().stages;
for (const [stageId, stageData] of Object.entries(allStages)) {
  const data = stageData as any;
  if (data.seriesInstanceUID) {
    // Found segmentation data
  }
}
```

## 🔧 How Workflow Navigation Works

When a user navigates (e.g., clicks "Advance" or a stage button):

```typescript
// 1. User action triggers command
commandsManager.runCommand('advanceWorkflowStage');

// 2. Command validates and advances in WorkflowService
workflowService.advanceStage();  // Updates state.currentStage

// 3. Command calls navigateToStageCommand
navigateToStageCommand({ stage: nextStage, ... });

// 4. Navigation command SETS the stage
workflowService.setCurrentStage(stage);  // ✅ ONLY place stage is set!

// 5. Navigation command navigates to route
history.navigate(`/segmentation?StudyInstanceUIDs=...`);

// 6. Mode's onModeEnter runs
// Mode READS current stage (already set by step 4)
const currentStage = workflowService.getCurrentStage();
```

## 🎓 Benefits of This Approach

### 1. **Single Source of Truth**
- `workflow-config.yaml` defines ALL stage IDs and routes
- Modes never need to know stage names
- Change stage IDs in ONE place

### 2. **Type Safety**
- No string literals scattered throughout code
- Config loader provides type-safe access
- Compile-time validation

### 3. **Maintainability**
- Add new stages without updating mode code
- Rename stages without touching modes
- Clear separation of concerns

### 4. **Testability**
- Modes can be tested independently
- Mock WorkflowService provides any stage
- No dependencies on specific stage names

### 5. **Flexibility**
- Modes work with ANY workflow configuration
- Same mode can be used in different workflows
- Reusable across projects

## 🚫 Anti-Patterns to Avoid

### ❌ Anti-Pattern 1: Mode Sets Stage

```typescript
// BAD: Mode controls workflow
export function onModeEnter({ servicesManager }) {
  surgicalWorkflowService.setCurrentStage('myStage');
}
```

**Why bad**: Workflow should control modes, not vice versa.

### ❌ Anti-Pattern 2: Hardcoded Stage IDs

```typescript
// BAD: Hardcoded stage name
const data = surgicalWorkflowService.getStageData('segmentation');
```

**Why bad**: Breaks when stage IDs change in config.

### ❌ Anti-Pattern 3: Route-Based Stage Detection in Modes

```typescript
// BAD: Mode tries to figure out its own stage
const route = window.location.pathname;
const stageId = route.includes('/segmentation') ? 'segmentation' : 'unknown';
```

**Why bad**: Duplicates logic already in workflow system.

### ❌ Anti-Pattern 4: Stage Name Mappings in Modes

```typescript
// BAD: Local mapping of routes to stages
const ROUTE_TO_STAGE = {
  '/segmentation': 'segmentation',
  '/planner': 'planning',
};
const stageId = ROUTE_TO_STAGE[currentRoute];
```

**Why bad**: Another place to maintain stage mappings.

## 📋 Checklist for New Modes

When creating a new mode:

- [ ] **DON'T** call `setCurrentStage()` in `onModeEnter`
- [ ] **DO** call `getCurrentStage()` to read current stage
- [ ] **DON'T** hardcode any stage IDs as strings
- [ ] **DO** use `getStageData(currentStage)` to access data
- [ ] **DON'T** try to figure out stage from route
- [ ] **DO** trust that workflow has already set the correct stage
- [ ] **DON'T** create local stage name constants
- [ ] **DO** iterate through stages if you need cross-stage data
- [ ] **VERIFY** no string literals like `'segmentation'`, `'planning'`, etc.

## 🔍 How to Find Hardcoded Stage Names

Run these searches in your codebase:

```bash
# Find setCurrentStage calls (should only be in workflowCommands.ts)
grep -r "setCurrentStage" Viewers/modes/

# Find hardcoded stage names
grep -r "'segmentation'" Viewers/modes/
grep -r "'planning'" Viewers/modes/
grep -r "'overview'" Viewers/modes/
grep -r "'beginning'" Viewers/modes/
grep -r "'review'" Viewers/modes/
grep -r "'reporting'" Viewers/modes/
```

**Expected result**: No matches in mode files!

## 📚 Related Documentation

- `workflow-config.yaml` - Single source of truth for workflow configuration
- `HARDCODED_STAGE_FIX.md` - Details on fixing the 'beginning' stage bug
- `IN_MEMORY_STATE_REFACTORING.md` - Removal of persistence layer
- `YAML_SINGLE_SOURCE_OF_TRUTH.md` - Making YAML the only config source

## 🎉 Summary

**The Golden Rule: Modes are passive observers of the workflow state.**

- Workflow system sets the stage → Mode reads the stage
- Workflow system manages transitions → Mode operates within current stage
- Workflow config defines structure → Mode adapts to structure

This approach ensures `workflow-config.yaml` is truly the **single source of truth** for all workflow structure and behavior!

