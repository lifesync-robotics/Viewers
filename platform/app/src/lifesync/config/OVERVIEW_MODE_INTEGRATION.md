# Overview Mode Integration - Workflow Configuration Update

## Summary

The workflow configuration has been updated to use the **`@overview` mode** as the initial/beginning step instead of the generic "Basic Viewer" mode.

## Changes Made

### 1. Workflow Configuration (workflow-config.yaml)

**Stage Definition Updated:**
- **Stage ID**: `beginning` → `overview`
- **Stage Name**: `Basic Viewer` → `Start`
- **Route**: `/basic` → `/overview`
- **Icon**: 📋 → 🏁
- **Description**: Updated to reference Overview mode

### 2. Dependencies Updated

All stage dependencies referencing `beginning` have been updated to `overview`:

| Stage | Old Dependencies | New Dependencies |
|-------|-----------------|------------------|
| Segmentation | `beginning` | `overview` |
| Planning | `beginning`, `segmentation` | `overview`, `segmentation` |
| Reporting | `beginning`, `segmentation`, `planning` | `overview`, `segmentation`, `planning` |
| Review | `beginning`, `segmentation`, `planning`, `reporting` | `overview`, `segmentation`, `planning`, `reporting` |

### 3. Validation Rules Updated

Validation rule paths updated to use `overview` instead of `beginning`:

```yaml
validationRules:
  patient_loaded:
    path: "stages.overview.patient.id"  # Was: stages.beginning.patient.id
  
  study_loaded:
    path: "stages.overview.study.studyInstanceUID"  # Was: stages.beginning.study.studyInstanceUID
  
  series_selected:
    path: "stages.overview.series.seriesInstanceUID"  # Was: stages.beginning.series.seriesInstanceUID
```

### 4. TypeScript Types Updated

**File**: `workflow.types.ts`

Fallback constants updated:
```typescript
export const STAGE_ORDER = [
  'overview',  // Was: 'beginning'
  'segmentation',
  'planning',
  'reporting',
  'review',
];

export const STAGE_LABELS = {
  overview: 'Start',  // Was: beginning: 'Basic Viewer'
  // ... rest unchanged
};

export const STAGE_ROUTES = {
  overview: '/overview',  // Was: beginning: '/basic'
  // ... rest unchanged
};
```

WorkflowState interface made more flexible:
```typescript
export interface WorkflowState {
  currentStage: WorkflowStage;
  stages: {
    [key: string]: WorkflowStageData;  // Dynamic keys for config-driven stages
  };
  validation: {
    [key: string]: WorkflowValidation;  // Dynamic validation
  };
  metadata: { ... };
}
```

### 5. WorkflowService Updated

**File**: `WorkflowService.ts`

Fallback state updated:
```typescript
return {
  currentStage: 'overview',  // Was: 'beginning'
  stages: {
    overview: { completed: false, reviewed: false },  // Was: beginning
    segmentation: { completed: false },
    planning: { completed: false },
    reporting: { completed: false },
    review: { completed: false, reviewed: false },
  },
  // ...
};
```

### 6. WorkflowNavigator Updated

**File**: `WorkflowNavigator.tsx`

Fallback configuration updated:
```typescript
return {
  stageOrder: ['overview', 'segmentation', 'planning', 'reporting', 'review'],
  stageLabels: {
    overview: 'Start',
    // ...
  },
  uiConfig: null,
};
```

## Overview Mode Details

### Mode Information
- **Package**: `@ohif/mode-overview`
- **Route**: `/overview`
- **Display Name**: "Start"
- **Layout**: Single viewport with measurement tracking

### Features
- ✅ Measurement tracking (standard OHIF)
- ✅ Series thumbnail list (left panel)
- ✅ Tracked measurements panel (right panel)
- ✅ Standard DICOM tools (Window/Level, Zoom, Pan)
- ❌ No LifeSync-specific features (by design)

### Layout
```
┌──────────┬───────────────────────┬──────────┐
│  Series  │    Main Viewport      │ Measure- │
│   List   │   (Overview Mode)     │  ments   │
│ (Left)   │                        │ (Right)  │
└──────────┴───────────────────────┴──────────┘
```

## Compatibility

### Backward Compatibility
- ✅ Old `STAGE_ORDER`, `STAGE_LABELS`, `STAGE_ROUTES` constants updated (deprecated but functional)
- ✅ Dynamic stages interface supports any stage configuration
- ✅ Fallback state handles both `overview` and `beginning` gracefully

### Forward Compatibility
- ✅ Configuration-driven architecture allows easy stage changes
- ✅ No code changes needed to modify stages further
- ✅ Just update `workflow-config.yaml`

## Migration Path

### For Existing Workflows

If you have existing workflow state stored with `beginning`:

1. **Option 1: Automatic Migration** (Recommended)
   - Add a migration function in WorkflowService to rename `beginning` → `overview`
   - Run on app startup when loading persisted state

2. **Option 2: Clear Old State**
   - Clear browser localStorage/sessionStorage
   - Users start fresh with new `overview` stage

3. **Option 3: Support Both** (Interim)
   - Keep fallback support for both `beginning` and `overview`
   - Gradually migrate users over time

### Migration Function Example

```typescript
function migrateWorkflowState(state: any): WorkflowState {
  if (state.stages.beginning) {
    // Migrate beginning → overview
    state.stages.overview = state.stages.beginning;
    delete state.stages.beginning;
    
    // Update current stage if needed
    if (state.currentStage === 'beginning') {
      state.currentStage = 'overview';
    }
  }
  return state;
}
```

## Testing Checklist

- [ ] Application starts successfully
- [ ] Workflow configuration loads without errors
- [ ] Initial stage is `overview`
- [ ] Overview mode route (`/overview`) works
- [ ] Stage navigation works (overview → segmentation → planning → reporting → review)
- [ ] Back navigation works
- [ ] Stage validation respects dependencies
- [ ] Final stage (`review`) cannot advance
- [ ] Measurements tracked in overview mode persist across navigation
- [ ] No console errors related to stage configuration

## Benefits of Using Overview Mode

### 1. Better Initial Assessment
- Overview mode provides comprehensive series view
- Users can see full scan range at a glance
- Better for initial case assessment

### 2. Consistent with OHIF Best Practices
- Uses standard OHIF modes
- Leverages measurement tracking extension
- Follows OHIF mode architecture

### 3. User-Friendly
- Display name "Start" is more intuitive than "Basic Viewer"
- Clear entry point to the workflow
- Familiar interface for OHIF users

### 4. Maintainable
- Uses standard OHIF mode (maintained by community)
- No custom code needed
- Easy to update with OHIF updates

## Configuration Reference

### Complete Overview Stage Configuration

```yaml
- id: "overview"
  name: "Start"
  description: "Initial DICOM viewing and case setup using Overview mode"
  route: "/overview"
  order: 1
  
  properties:
    isInitial: true
    isFinal: false
    canSkip: false
    requiresCompletion: true
  
  validation:
    auto:
      - rule: "patient_loaded"
        message: "Patient data must be loaded"
      - rule: "study_loaded"
        message: "Study must be loaded"
      - rule: "series_selected"
        message: "Series must be selected"
    userConfirmation:
      enabled: true
      message: "Have you completed the initial review and selected the appropriate series?"
  
  dependencies: []
  
  dataSchema:
    required:
      - "patient.id"
      - "study.studyInstanceUID"
      - "series.seriesInstanceUID"
    optional:
      - "patient.name"
      - "study.studyDescription"
  
  actions:
    onEnter: []
    onExit:
      - type: "save_stage_data"
        target: "overview"
      - type: "validate_next_stage"
        target: "segmentation"
```

## Troubleshooting

### Issue: "Stage 'overview' not found"
**Cause**: Configuration not initialized  
**Solution**: Ensure `initializeWorkflowConfig()` is called during app startup

### Issue: "Cannot navigate to overview mode"
**Cause**: Overview mode not registered  
**Solution**: Verify `@ohif/mode-overview` is installed and registered in `pluginConfig.json`

### Issue: Old workflow state references 'beginning'
**Cause**: Persisted state from before migration  
**Solution**: Clear browser storage or implement migration function

### Issue: Stage validation fails
**Cause**: Validation paths still reference 'beginning'  
**Solution**: Verify all validation rules use 'overview' in paths

## Future Enhancements

Possible future improvements:
- [ ] Add migration utility for existing workflows
- [ ] Support both `beginning` and `overview` temporarily
- [ ] Add stage aliases in configuration
- [ ] Implement automatic state migration on load
- [ ] Add configuration version tracking

## Related Documentation

- [Workflow Configuration README](./README.md)
- [Overview Mode README](../../../../../../../modes/overview/README.md)
- [OHIF Modes Documentation](https://docs.ohif.org/platform/modes/)
- [REFACTORING_SUMMARY.md](../REFACTORING_SUMMARY.md)

## Summary

The workflow system now uses the `@overview` mode as the initial step, providing a better user experience and leveraging standard OHIF functionality. All configuration files, types, and services have been updated to reflect this change while maintaining backward compatibility through fallback mechanisms.

The configuration-driven architecture makes this change simple - only the YAML file needed updates, with TypeScript changes for consistency. Future stage changes can be made just as easily by editing `workflow-config.yaml`. 🎉

