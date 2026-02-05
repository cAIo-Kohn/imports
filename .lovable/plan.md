

# Plan: Fix Sample Rejection Workflow - Sync Action Notification with Pending Task

## Problem Identified

When a sample is **rejected** by the Quality Team in `SampleReviewModal.tsx`, the pending task correctly goes back to the Trader with `needs_resend: true`, but the **Action notification badge** disappears because the code fails to update `workflow_status` and `current_assignee_role` on the card.

The rejection code currently only updates:
```typescript
await supabase.from('development_items').update({ 
  current_owner: 'arc',
  is_new_for_other_team: true,
  pending_action_type: 'sample_tracking',
  // MISSING: workflow_status and current_assignee_role
})
```

## Solution

Update the sample rejection flow in `SampleReviewModal.tsx` to properly set `workflow_status` and `current_assignee_role`, ensuring the "Action: Trader" badge appears when a sample is rejected.

---

## Technical Changes

### File: `src/components/development/SampleReviewModal.tsx`

**Location:** Lines 182-192 (the card update after rejection)

**Current Code:**
```typescript
await (supabase.from('development_items') as any)
  .update({ 
    current_owner: 'arc',
    is_new_for_other_team: true,
    pending_action_type: 'sample_tracking',
    pending_action_due_at: null,
    pending_action_snoozed_until: null,
    pending_action_snoozed_by: null,
  })
  .eq('id', task.card_id);
```

**Fixed Code:**
```typescript
await (supabase.from('development_items') as any)
  .update({ 
    current_owner: 'arc',
    is_new_for_other_team: true,
    pending_action_type: 'sample_tracking',
    pending_action_due_at: null,
    pending_action_snoozed_until: null,
    pending_action_snoozed_by: null,
    workflow_status: 'sample_requested',      // ADD THIS
    current_assignee_role: 'trader',          // ADD THIS
  })
  .eq('id', task.card_id);
```

---

## Workflow Flow After Fix

### Sample Rejection Cycle (Fixed)

```text
Quality Team rejects sample
        |
        v
+---------------------------+
| Task: sample_request      |
| Status: pending           |
| Assigned to: Trader       |
| Metadata: needs_resend    |
+---------------------------+
        |
        v
+---------------------------+
| Card: development_items   |
| workflow_status:          |
|   'sample_requested'      |
| current_assignee_role:    |
|   'trader'                |
+---------------------------+
        |
        v
+---------------------------+
| UI Badge: Action: Trader  |
+---------------------------+
```

---

## Verification Checklist

After implementing the fix, the following scenarios should work correctly:

| Scenario | Expected Behavior |
|----------|-------------------|
| Sample requested | Action: Trader badge appears |
| Trader adds tracking | Action: Buyer Team badge appears |
| Buyer marks arrived | Action: Quality Team badge appears |
| Quality approves | Badge disappears, no pending tasks |
| Quality rejects | Action: Trader badge appears, pending task shows "New Sample Needed" |
| Trader adds new tracking | Action: Buyer Team badge appears |
| Trader gives up item | Badge disappears, card marked as solved |

---

## Files to Modify

1. `src/components/development/SampleReviewModal.tsx` - Add missing workflow fields to rejection update

