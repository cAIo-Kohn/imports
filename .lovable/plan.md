
# Complete Commercial Data Review Flow

## Current State

The commercial data workflow currently works through these steps:
1. **Request Commercial Data** - Creates a `commercial_request` task assigned to a team/user
2. **Fill Data** - Assignee fills all 4 fields (FOB Price, MOQ, Qty/Container, Container Type), task reassigns to requester with status `in_progress`
3. **Confirm** - Requester clicks "Confirm" → task marked `completed`

**What's missing:**
- No ability for requester to **reject** data (e.g., ask for a better price)
- No review modal with approve/reject options
- No feedback loop for negotiations (discount requests, target price, etc.)
- No history tracking of negotiations until final approval

## Proposed Flow

```text
Request Commercial Data
        ↓
[Task: commercial_request, assigned: Trader, status: pending]
        ↓
Fill Data → Notify Requester
        ↓
[Task: commercial_review, assigned: Requester, status: pending]
        ↓
Review Commercial Data (in modal)
        ↓
┌──────────────────┬──────────────────┐
│     APPROVE      │      REJECT      │
│    (complete)    │  (needs revision)│
└──────────────────┴──────────────────┘
        ↓                    ↓
    Task Done         [Task: commercial_request,
                       assigned: Trader,
                       metadata: needs_revision + feedback]
                              ↓
                    Fill Revised Data...
                    (loop until approved)
```

## Implementation Plan

### 1. Add New Task Type: `commercial_review`

**File: `src/hooks/useCardTasks.ts`**
- Add `'commercial_review'` to the `task_type` union

### 2. Update FillCommercialDataModal

**File: `src/components/development/FillCommercialDataModal.tsx`**
- After filling data, create a NEW `commercial_review` task for the requester instead of updating the current task
- Mark the original `commercial_request` task as completed
- Support pre-filling with previous data when resubmitting (for revision flow)

### 3. Create CommercialReviewModal

**New File: `src/components/development/CommercialReviewModal.tsx`**
- Display submitted commercial data (FOB Price, MOQ, Qty/Container, Container Type)
- Show historical submissions if this is a revision
- Feedback textarea for rejection (target price, discount request, etc.)
- **Approve** button: marks task completed, logs to timeline
- **Request Revision** button: 
  - Creates new `commercial_request` task assigned to original filler (or Trader role)
  - Includes rejection reason and requested changes in metadata
  - Logs negotiation round to timeline

### 4. Update TaskCard for commercial_review

**File: `src/components/development/TaskCard.tsx`**
- Add handling for `commercial_review` task type
- Green/success color scheme for review tasks
- Show submitted data summary
- Display "Review Commercial Data" button for requester
- Handle `needs_revision` state display (show previous rejection reason)

### 5. Update PendingTasksBanner

**File: `src/components/development/PendingTasksBanner.tsx`**
- Add `onReviewCommercial` callback prop
- Handle `commercial_review` task type in `getTaskActions`

### 6. Update ItemDetailDrawer

**File: `src/components/development/ItemDetailDrawer.tsx`**
- Add state for `showCommercialReviewModal`
- Add `handleReviewCommercial` function
- Pass `onReviewCommercial` to PendingTasksBanner
- Include CommercialReviewModal in render

### 7. Update CommercialDataSection (Optional Enhancement)

**File: `src/components/development/CommercialDataSection.tsx`**
- Add negotiation history section showing:
  - Each revision round with dates
  - Previous prices offered vs. requested target
  - Final approved price

## Task Type States

| Task Type | Status | Assigned To | Meaning |
|-----------|--------|-------------|---------|
| `commercial_request` | `pending` | Trader/Role | Awaiting data entry |
| `commercial_request` | `pending` + `needs_revision` | Trader/Role | Data rejected, needs update |
| `commercial_review` | `pending` | Requester | Data submitted, awaiting review |
| `commercial_review` | `completed` | N/A | Data approved |

## Metadata Structure

For `commercial_request` with `needs_revision`:
```json
{
  "needs_revision": true,
  "revision_number": 2,
  "previous_submissions": [
    {
      "fob_price_usd": 2.50,
      "moq": 1000,
      "submitted_at": "2024-02-03T...",
      "submitted_by": "user-id",
      "rejection_reason": "Price too high, target $2.00"
    }
  ]
}
```

For `commercial_review`:
```json
{
  "fob_price_usd": 2.30,
  "moq": 1000,
  "qty_per_container": 50000,
  "container_type": "40hq",
  "filled_by": "trader-user-id",
  "filled_at": "2024-02-03T...",
  "revision_number": 2
}
```

## Files Changed Summary

| File | Change |
|------|--------|
| `useCardTasks.ts` | Add `'commercial_review'` to task_type union |
| `FillCommercialDataModal.tsx` | Create `commercial_review` task after filling, support revision flow |
| `CommercialReviewModal.tsx` (new) | Modal for approve/reject with feedback |
| `TaskCard.tsx` | Handle `commercial_review` rendering and actions |
| `PendingTasksBanner.tsx` | Add `onReviewCommercial` prop and handler |
| `ItemDetailDrawer.tsx` | Wire up review modal state and handler |

## Expected Outcome

- Requesters can negotiate commercial terms until satisfied
- Full audit trail of negotiation rounds in timeline
- Clear accountability at each step (who filled, who rejected, why)
- Final approved data is stored on the card for reference
