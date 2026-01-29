

## Plan: Fix Yellow Unseen Activity Dot Being Hidden by Pending Action Indicator

### Problem Identified

In `DevelopmentCard.tsx`, the yellow "unseen activity" dot and the pending action indicator use **mutually exclusive** conditional rendering:

```tsx
{item.pending_action_type ? (
  <PendingActionIndicator ... />
) : hasUnseenActivity && (
  <div>yellow dot</div>
)}
```

When a card has any `pending_action_type` (including snoozed cards), the yellow dot is never shown - even if there IS unseen activity.

### Expected Behavior

| Scenario | Yellow Dot (Unseen) | Pending Action Indicator |
|----------|---------------------|--------------------------|
| No pending action, no unseen activity | Hidden | Hidden |
| No pending action, HAS unseen activity | **Shown (pulsing amber)** | Hidden |
| Has pending action, no unseen activity | Hidden | Shown (red/amber) |
| Has pending action, HAS unseen activity | **Shown (pulsing amber)** | Shown (red/amber) |

The yellow dot should ALWAYS appear when `hasUnseenActivity` is true, regardless of pending action state. It clears when the card is opened.

### Solution

Show **both** indicators when appropriate by repositioning them:
- Pending action indicator: top-right corner (existing position)
- Unseen activity dot: position NEXT TO the pending action indicator (or in a secondary position)

### Technical Implementation

**File: `src/components/development/DevelopmentCard.tsx`**

Change the indicator rendering from mutually exclusive to independent:

```tsx
// BEFORE (lines 118-134):
{item.pending_action_type ? (
  <div className="absolute top-2 right-2">
    <PendingActionIndicator ... />
  </div>
) : hasUnseenActivity && (
  <div className="absolute top-2 right-2">
    <span className="relative flex h-3 w-3">
      <span className="animate-ping ..." />
      <span className="relative inline-flex ..." />
    </span>
  </div>
)}
```

```tsx
// AFTER - Both indicators can show independently:
<div className="absolute top-2 right-2 flex items-center gap-1">
  {/* Unseen activity indicator - always shown when there's unseen activity */}
  {hasUnseenActivity && (
    <span className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
    </span>
  )}
  {/* Pending action indicator - shown independently */}
  {item.pending_action_type && (
    <PendingActionIndicator
      pendingActionType={item.pending_action_type}
      pendingActionDueAt={item.pending_action_due_at || null}
      snoozedUntil={item.pending_action_snoozed_until || null}
    />
  )}
</div>
```

### Visual Result

When both indicators are present, they appear side by side:
- Amber pulsing dot (unseen activity) + Red blinking dot (urgent pending action)
- Amber pulsing dot (unseen activity) + Static amber dot (snoozed/waiting)

Once the user opens the card, the amber unseen dot disappears, but the pending action indicator remains based on its own state.

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/development/DevelopmentCard.tsx` | Change from mutually exclusive to independent indicator rendering |

### Summary

This fix separates the "unseen activity" indicator from the "pending action" indicator, allowing both to be shown when appropriate. The yellow dot will now:
1. Always appear when there's unseen activity (regardless of pending action state)
2. Always disappear when the card is opened
3. Not interfere with the pending action indicator (red blinking or static amber)

