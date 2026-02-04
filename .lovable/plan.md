

# Fix Workflow Status Updates for "Action" Badge

## Problem Summary
The "Action: [Team]" badge updates correctly when a sample is first requested (showing "Action: Trader"), but doesn't update when:
1. Trader adds tracking → Should show "Action: Buyer"
2. Buyer marks sample as arrived → Should show "Action: Buyer" (for review)
3. Buyer approves/rejects sample → Should clear badge or restart workflow

## Root Cause

The `useCardWorkflow` hook with `updateCardWorkflowStatus` function was added but is only called in `RequestSampleModal.tsx` and `RequestCommercialDataModal.tsx`. The subsequent workflow steps in the sample lifecycle don't call this function:

| Action | File | Missing Call |
|--------|------|--------------|
| Trader adds tracking | `AddTrackingModal.tsx` | `updateCardWorkflowStatus(sample_tracking_added)` |
| Buyer marks arrived | `SampleTrackingSection.tsx` | `updateCardWorkflowStatus(sample_arrived)` |
| Buyer approves sample | `SampleReviewSection.tsx` | Clear workflow status |
| Buyer rejects sample | `SampleReviewSection.tsx` | `updateCardWorkflowStatus(sample_requested)` |

---

## Solution

### 1. Update `AddTrackingModal.tsx`

Import and call `updateCardWorkflowStatus` when tracking is added:

```typescript
import { updateCardWorkflowStatus } from '@/hooks/useCardWorkflow';

// Inside submitMutation, after updating task:
await updateCardWorkflowStatus(
  task.card_id,
  'sample_tracking_added',
  user.id,
  'Tracking added - awaiting buyer to confirm arrival',
  'trader',  // from
  'buyer',   // to
  task.id
);
```

### 2. Update `SampleTrackingSection.tsx`

Add workflow update to `markArrivedMutation`:

```typescript
import { updateCardWorkflowStatus } from '@/hooks/useCardWorkflow';

// Inside markArrivedMutation:
await updateCardWorkflowStatus(
  cardId,
  'sample_arrived',
  user.id,
  'Sample arrived - awaiting review',
  'buyer',  // from (they marked it arrived)
  'buyer',  // to (they need to review)
);
```

### 3. Update `SampleReviewSection.tsx`

Clear or restart workflow on sample decision:

```typescript
import { updateCardWorkflowStatus } from '@/hooks/useCardWorkflow';

// If approved - clear workflow
await supabase
  .from('development_items')
  .update({
    workflow_status: null,
    current_assignee_role: null,
  })
  .eq('id', cardId);

// Log completion
await supabase.from('development_card_activity').insert({
  card_id: cardId,
  user_id: user.id,
  activity_type: 'handoff',
  content: 'Sample approved - workflow complete',
  metadata: { workflow_status: null, action: 'workflow_complete' },
});

// If rejected - restart workflow
await updateCardWorkflowStatus(
  cardId,
  'sample_requested',
  user.id,
  'Sample rejected - new sample needed',
  'buyer',
  'trader'
);
```

---

## Complete Workflow Flow After Fix

```text
1. Buyer requests sample
   → RequestSampleModal calls updateWorkflow('sample_requested')
   → Badge shows: "Action: Trader" (Red)

2. Trader adds tracking  
   → AddTrackingModal calls updateWorkflow('sample_tracking_added')
   → Badge shows: "Action: Buyer" (Amber)

3. Buyer marks arrived
   → SampleTrackingSection calls updateWorkflow('sample_arrived')
   → Badge shows: "Action: Buyer" (Amber) - still their turn to review

4a. Buyer approves
   → SampleReviewSection clears workflow
   → Badge disappears (no active workflow)

4b. Buyer rejects
   → SampleReviewSection calls updateWorkflow('sample_requested')
   → Badge shows: "Action: Trader" (Red) - needs new sample
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/development/AddTrackingModal.tsx` | Add `updateCardWorkflowStatus` call after task update |
| `src/components/development/SampleTrackingSection.tsx` | Add workflow update to `markArrivedMutation` |
| `src/components/development/SampleReviewSection.tsx` | Clear/restart workflow on decision |

---

## Technical Details

All three files need to:
1. Import `updateCardWorkflowStatus` from `@/hooks/useCardWorkflow`
2. Call it with the appropriate workflow status and role transition
3. Pass `fromRole` and `toRole` to log the handoff in the Responsibility History

The `updateCardWorkflowStatus` helper function already handles:
- Updating `development_items.workflow_status` and `current_assignee_role`
- Creating a `handoff` activity entry with metadata
- Invalidating relevant queries

