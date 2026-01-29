
## Plan: Fix Snoozed Indicator to Show Clock Icon Instead of Yellow Dot

### Problem Summary

Currently when a card has a pending action that is **snoozed**, the `PendingActionIndicator` shows a **static yellow dot** (line 146 in `PendingActionBadge.tsx`). This is visually identical to the "unseen activity" pulsing amber dot, causing confusion.

Additionally, the unseen activity logic works correctly - opening the card updates `last_viewed_at`, which should clear the yellow dot. But since both indicators look the same (amber/yellow circles), users can't tell them apart.

### Solution

Per user preference, change the snoozed indicator from a solid yellow dot to a **Clock icon** with muted styling. This provides clear visual distinction:

- **Unseen activity**: Pulsing amber dot (clears when opened)
- **Urgent pending action**: Blinking red dot  
- **Snoozed pending action**: Static gray Clock icon (not a dot at all)

### Technical Implementation

**File: `src/components/development/PendingActionBadge.tsx`**

Update the `PendingActionIndicator` component to:
1. Add a new `isSnoozed` check  
2. Return a Clock icon when snoozed instead of a yellow dot
3. Keep the red blinking dot for urgent (overdue) actions
4. Show nothing in between (or the Clock for waiting states)

```text
Current logic (lines 105-150):
  - If pending action exists AND is urgent → red blinking dot
  - If pending action exists AND not urgent → static yellow dot

New logic:
  - If pending action exists AND is snoozed → Clock icon (muted gray)
  - If pending action exists AND is urgent → red blinking dot  
  - If pending action exists AND not urgent (waiting but not snoozed) → static amber dot
```

### Code Changes

```tsx
// In PendingActionIndicator component
export function PendingActionIndicator({
  pendingActionType,
  pendingActionDueAt,
  snoozedUntil,
  className,
}: PendingActionIndicatorProps) {
  const { isUrgent, isSnoozed } = useMemo(() => {
    if (!pendingActionType) return { isUrgent: false, isSnoozed: false };
    
    const now = new Date();
    
    // Check if snoozed (snooze date is in the future)
    if (snoozedUntil) {
      const snoozeDate = parseISO(snoozedUntil);
      if (isAfter(snoozeDate, now)) {
        return { isUrgent: false, isSnoozed: true };
      }
    }
    
    // Check if has due date that hasn't passed
    if (pendingActionDueAt) {
      const dueDate = parseISO(pendingActionDueAt);
      if (isAfter(dueDate, now)) {
        return { isUrgent: false, isSnoozed: false };
      }
    }
    
    // Urgent if no snooze/due or they've passed
    return { isUrgent: true, isSnoozed: false };
  }, [pendingActionType, pendingActionDueAt, snoozedUntil]);

  if (!pendingActionType) return null;

  // Snoozed: show Clock icon
  if (isSnoozed) {
    return (
      <span className={cn("flex items-center justify-center h-4 w-4 text-muted-foreground", className)}>
        <Clock className="h-3 w-3" />
      </span>
    );
  }

  // Urgent: red blinking dot
  if (isUrgent) {
    return (
      <span className={cn("relative flex h-3 w-3", className)}>
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
      </span>
    );
  }

  // Waiting (not snoozed, not urgent): static amber dot
  return (
    <span className={cn("relative flex h-3 w-3", className)}>
      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400" />
    </span>
  );
}
```

### Visual States Summary

| State | Indicator |
|-------|-----------|
| Unseen activity (new comments/changes) | Pulsing amber dot (clears on open) |
| Pending action - Snoozed | Clock icon (muted gray) |
| Pending action - Urgent/Overdue | Blinking red dot |
| Pending action - Waiting (not snoozed) | Static amber dot |

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/development/PendingActionBadge.tsx` | Update `PendingActionIndicator` to show Clock icon when snoozed |

### Summary

This change ensures clear visual distinction between:
1. **Unseen activity** (pulsing amber dot) - independent indicator that clears when you open the card
2. **Snoozed action** (Clock icon) - shows the action is paused until a date
3. **Urgent action** (blinking red dot) - needs immediate attention
