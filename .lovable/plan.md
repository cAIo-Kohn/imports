
# Complete Sample Review Flow in Pending Tasks

## Current State

The sample workflow currently works through these steps:
1. **Request sample** - Creates a `sample_request` task assigned to Trader role
2. **Send tracking** - Trader adds tracking, task reassigns to requester
3. **Mark as received** - Requester marks sample as delivered

However, after "Mark as Received," the task workflow stops - the review step exists in the Sample Tracking accordion (`SampleReviewSection`) but doesn't appear as a pending task.

## Missing Flow

After a sample is marked as received:
1. **Awaiting Review** should appear as a pending task for the requester
2. **If rejected** - require report upload, then reassign task to Trader for new sample
3. **If approved** - complete the task and keep sample visible in history with full timeline

## Implementation Plan

### 1. Add New Task Type for Sample Review

**File: `src/hooks/useCardTasks.ts`**
- Extend `task_type` to include `'sample_review'`

**File: `src/components/development/ItemDetailDrawer.tsx`**
- In `handleMarkArrived`, after updating the task metadata, change task_type to `'sample_review'` or create a follow-up review task

### 2. Update TaskCard to Handle Sample Review

**File: `src/components/development/TaskCard.tsx`**
- Add rendering for `sample_review` task type
- Show "Review Sample" button that opens the review flow
- Display status: "Awaiting your review"

### 3. Update PendingTasksBanner

**File: `src/components/development/PendingTasksBanner.tsx`**
- Add `onReviewSample` callback prop
- In `getTaskActions`, handle `sample_review` task type:
  - Show "Review Sample" button for the requester (delivered but not reviewed)

### 4. Handle Review Outcomes

**File: `src/components/development/SampleReviewSection.tsx`**
- On **Reject**:
  - Require report/notes (already implemented)
  - Update task to reassign to Trader role with metadata indicating "needs new sample"
  - Task type stays `sample_request` but with `needs_resend: true` in metadata
- On **Approve**:
  - Mark task as `completed`
  - Sample stays visible in Sample Tracking section with full history

### 5. Create Sample Review Modal

**New File: `src/components/development/SampleReviewModal.tsx`**
- Similar to `FillCommercialDataModal` but for sample review
- Contains the review form (notes, file upload, approve/reject buttons)
- On submit, updates sample and task appropriately

### 6. Wire Up in ItemDetailDrawer

**File: `src/components/development/ItemDetailDrawer.tsx`**
- Add state for `showSampleReviewModal`
- Add `handleReviewSample` function that opens the modal
- Pass `onReviewSample` to PendingTasksBanner

## Flow Summary

```text
Request Sample
     ↓
[Task: sample_request, assigned: Trader]
     ↓
Add Tracking → Ship & Notify
     ↓
[Task: sample_request, assigned: Requester, status: in_progress]
     ↓
Mark as Arrived
     ↓
[Task: sample_review, assigned: Requester] ← NEW PENDING TASK
     ↓
Review Sample (in modal)
     ↓
┌─────────────┬─────────────┐
│   APPROVE   │   REJECT    │
│  (complete) │ (needs new) │
└─────────────┴─────────────┘
      ↓              ↓
   Task Done    [Task: sample_request, 
                 assigned: Trader,
                 metadata: needs_resend]
                      ↓
                Add New Tracking...
```

## Technical Changes Summary

| File | Change |
|------|--------|
| `useCardTasks.ts` | Update `task_type` union to include `'sample_review'` |
| `TaskCard.tsx` | Add rendering for review task with "Review Sample" button |
| `PendingTasksBanner.tsx` | Add `onReviewSample` prop and handler |
| `ItemDetailDrawer.tsx` | Wire up review modal state and handler |
| `SampleReviewModal.tsx` (new) | Modal for reviewing samples with approve/reject |
| `SampleReviewSection.tsx` | Update to handle task reassignment on reject |

This ensures the complete sample lifecycle flows through the pending task system with clear accountability at each step.
