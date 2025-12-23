# Workflow Navigator - Dynamic Button Positioning

## Problem

The Back and Forward buttons were in a fixed position (left and right of screen), separate from the stage indicators. This made it unclear which stage you were going back to or advancing to.

**Before:**
```
[← Back]        Current Stage: Planning        [Forward →]

Stage1 → Stage2 → [Stage3] → Stage4 → Stage5
```

## Solution

Made the buttons **dynamically positioned** within the stage indicator flow:
- **Back button** appears immediately **to the left** of the current stage
- **Forward button** appears immediately **to the right** of the current stage

**After:**
```
Current Stage: Planning

Stage1 → Stage2 → [← Back] → [Stage3] → [Forward →] → Stage4 → Stage5
                              ^^^^^^^^
                              Current
```

---

## Implementation

### Key Changes

1. **Removed fixed button layout** - No more separate button row
2. **Moved buttons into stage loop** - Buttons render as part of the stage indicators
3. **Dynamic positioning** - Buttons only appear adjacent to current stage

### Code Structure

```tsx
{STAGE_ORDER.map((stage, index) => {
  const isActive = stage === currentStage;
  
  return (
    <React.Fragment key={stage}>
      {/* Show Back button BEFORE current stage */}
      {isActive && showNavButtons && previousStage && (
        <>
          <button onClick={handleGoBack}>
            ← Back
          </button>
          <span>→</span>
        </>
      )}

      {/* Arrow between stages (skip if back button shown) */}
      {index > 0 && !(isActive && showNavButtons && previousStage) && (
        <span>→</span>
      )}

      {/* Stage Indicator */}
      <StageIndicator stage={stage} isActive={isActive} ... />

      {/* Show Forward button AFTER current stage */}
      {isActive && showNavButtons && nextStage && (
        <>
          <span>→</span>
          <button onClick={handleAdvance}>
            Forward →
          </button>
        </>
      )}
    </React.Fragment>
  );
})}
```

---

## Visual Examples

### At First Stage (Viewer)
```
Current Stage: Viewer

[Viewer] → [Forward →] → Segmentation → Planning → Registration → Tracking
^^^^^^^^
Current
```
- No Back button (already at first stage)
- Forward button appears after current stage

### At Middle Stage (Planning)
```
Current Stage: Planning

Viewer → Segmentation → [← Back] → [Planning] → [Forward →] → Registration → Tracking
                                    ^^^^^^^^^
                                    Current
```
- Back button appears before current stage
- Forward button appears after current stage

### At Last Stage (Tracking)
```
Current Stage: Tracking

Viewer → Segmentation → Planning → Registration → [← Back] → [Tracking]
                                                              ^^^^^^^^^
                                                              Current
```
- Back button appears before current stage
- No Forward button (already at last stage)

---

## Benefits

1. **Visual Clarity** - Immediately clear which stages you're navigating between
2. **Spatial Relationship** - Buttons are positioned exactly where they navigate to
3. **Intuitive UX** - Left button goes left, right button goes right
4. **Dynamic** - Buttons appear/disappear based on workflow position
5. **Compact** - No wasted space with disabled buttons

---

## Button Behavior

### Back Button
- **Appears:** When `previousStage` exists (not at first stage)
- **Position:** Immediately to the left of current stage indicator
- **Action:** `handleGoBack()` → navigates to previous stage
- **Label:** "← Back"

### Forward Button
- **Appears:** When `nextStage` exists (not at last stage)
- **Position:** Immediately to the right of current stage indicator
- **Action:** `handleAdvance()` → prompts user, then navigates to next stage
- **Label:** "Forward →"

---

## Edge Cases Handled

### First Stage
```tsx
{isActive && showNavButtons && previousStage && (
  // Back button - only shows if previousStage exists
)}
```
✅ No back button at first stage

### Last Stage
```tsx
{isActive && showNavButtons && nextStage && (
  // Forward button - only shows if nextStage exists
)}
```
✅ No forward button at last stage

### Arrow Suppression
```tsx
{index > 0 && !(isActive && showNavButtons && previousStage) && (
  <span>→</span>
)}
```
✅ Don't show arrow before current stage if back button is present (avoids double arrows)

---

## Compact Mode

In compact mode, the stage indicators become a simple progress bar without buttons:

```tsx
{showStageList && compact && (
  <div className="flex items-center gap-1 mt-2">
    {STAGE_ORDER.map((stage, index) => (
      <div className={`flex-1 h-2 rounded-full ${
        isCompleted ? 'bg-green-600' :
        isActive ? 'bg-blue-600' :
        'bg-gray-700'
      }`} />
    ))}
  </div>
)}
```

---

## Testing Checklist

- [x] Back button appears to left of current stage (when not at first stage)
- [x] Forward button appears to right of current stage (when not at last stage)
- [x] No back button at first stage
- [x] No forward button at last stage
- [x] Arrows don't duplicate when buttons are present
- [x] Clicking back button navigates to previous stage
- [x] Clicking forward button prompts user and navigates to next stage
- [x] Buttons move dynamically as you navigate through stages

---

**Date:** December 22, 2025
**Status:** ✅ Implemented
**File:** `Viewers/platform/app/src/lifesync/components/WorkflowNavigator/WorkflowNavigator.tsx`

