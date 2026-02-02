
# Fix Task Action Button Click Handlers

## Problem

Clicking "Fill Data" (sample tracking) and "Confirm & Notify" (commercial data) buttons does nothing because the action handlers are not being passed to the TaskCard component in certain scenarios.

## Root Cause

In `PendingTasksBanner.tsx`, the `getTaskActions()` function (lines 54-86) has logic that's too restrictive:

```typescript
if (!isDataFilled && !isRequester) {
  return { onFillCommercial: () => onFillCommercial(task) };
}
```

This means:
- If user IS the requester, they can't fill data (even if they have the role)
- If user IS the requester but data is filled, no action is returned
- The function returns `{}` (empty object) in edge cases, causing no button to work

## Solution

### 1. Fix `PendingTasksBanner.tsx` - Simplify Action Logic

Update `getTaskActions()` to properly determine actions based on:
- Task state (is data filled? has tracking? is delivered?)
- User's ability to action (already checked by `canActionTask`)

The logic should be:
- **Commercial**: Show "Fill Data" if not filled, show "Confirm" if filled and user is requester
- **Sample**: Show "Add Tracking" if no tracking, show "Mark Arrived" if has tracking and user is requester

Remove the `!isRequester` checks - if someone can action the task AND has the role, they should be able to.

### 2. Changes to Make

**File: `src/components/development/PendingTasksBanner.tsx`**

Update `getTaskActions()` function:

```typescript
const getTaskActions = (task: CardTask) => {
  const metadata = task.metadata || {};
  const isRequester = task.created_by === user?.id;
  
  if (task.task_type === 'commercial_request') {
    const isDataFilled = !!metadata.fob_price_usd;
    
    // Anyone who can action can fill data if not filled yet
    if (!isDataFilled) {
      return { onFillCommercial: () => onFillCommercial(task) };
    }
    // Only requester can confirm filled data
    if (isDataFilled && isRequester) {
      return { onConfirmData: () => onConfirmData(task) };
    }
  }
  
  if (task.task_type === 'sample_request') {
    const hasTracking = !!metadata.tracking_number;
    const isDelivered = !!metadata.actual_arrival;
    
    // Anyone who can action can add tracking if not added yet
    if (!hasTracking) {
      return { onAddTracking: () => onAddTracking(task) };
    }
    // Only requester can mark arrived
    if (hasTracking && !isDelivered && isRequester) {
      return { onMarkArrived: () => onMarkArrived(task) };
    }
  }
  
  return {};
};
```

This removes the `&& !isRequester` condition that was blocking requesters who also have the assigned role from filling data/adding tracking.

## Summary

| Issue | Fix |
|-------|-----|
| Fill Data button does nothing | Remove `!isRequester` check - anyone who can action should be able to fill |
| Confirm & Notify does nothing | Ensure handler is passed when data is filled and user is requester |
| Add Tracking button does nothing | Remove `!isRequester` check |
| Mark Arrived does nothing | Ensure handler is passed when tracking exists and user is requester |
