
## What’s broken (root cause)
After Quality rejects a sample, the UI shows the “New Sample Needed” task, but **no “Add New Tracking”** / **“Give Up Item”** buttons appear.

This happens because the rejection code currently **converts the existing `sample_review` task back into a `sample_request` task** but keeps old metadata such as:
- `tracking_number` (so the UI thinks tracking already exists)
- `actual_arrival` (so the UI thinks it was delivered)

In `PendingTasksBanner.getTaskActions()` the sample-request action buttons are only shown when:
- no tracking exists (`!metadata.tracking_number`)
- and (for give up) `needs_resend === true`

Because the rejected task still has `tracking_number` / `actual_arrival`, the banner returns **no actions**, so `TaskCard` renders **no buttons**.

## Goal
When a sample is rejected:
1) The rejected sample loop should be “closed” (review task completed for history/audit)
2) A **fresh “sample_request” task** should be created for the Trader with `needs_resend: true`
3) That new task should have **no tracking/arrival fields**, so the UI correctly shows:
- Add New Tracking
- Give Up Item

## Proposed fix (recommended approach)
Instead of mutating the `sample_review` task into `sample_request`, we’ll:
- **Complete** the `sample_review` task (so it disappears from Pending Tasks)
- **Create a new sample record** (so Sample Tracker/history stay correct)
- **Create a new `sample_request` task** assigned to Trader (with clean metadata)

### 1) Update `src/components/development/SampleReviewModal.tsx` (rejection branch)
Replace the current rejection behavior with:

#### A) Keep updating the current sample record as rejected (already done)
- `development_item_samples.decision = 'rejected'`
- `report_url`, `decision_notes`, `decided_at`, `decided_by`

#### B) Mark the current `sample_review` task as completed
Update `development_card_tasks` for `task.id`:
- `status: 'completed'`
- `completed_at`, `completed_by`
- `metadata` merged to include:
  - `decision: 'rejected'`
  - `rejection_notes`, `rejection_report_url`, `rejected_at`, `rejected_by`

This preserves a clean audit trail and ensures the review task disappears from the Pending banner.

#### C) Create a NEW sample record for the resend loop
Insert into `development_item_samples`:
- `item_id: task.card_id`
- `status: 'pending'`
- `quantity`: reuse from prior metadata if present
- `notes`: optionally include something like `Resend requested: <reason>`

This ensures:
- Sample Tracker gets a new entry
- We don’t overwrite the rejected sample’s tracking fields

#### D) Create a NEW task: `sample_request` assigned to Trader
Insert into `development_card_tasks`:
- `card_id: task.card_id`
- `task_type: 'sample_request'`
- `status: 'pending'`
- `assigned_to_role: 'trader'`
- `assigned_to_users: []`
- `created_by`: keep the original requester (use `task.created_by`)
- `sample_id`: set to the NEW sample record id
- `metadata`: clean object containing only what we want for the new request, for example:
  - `needs_resend: true`
  - `previous_decision: 'rejected'`
  - `rejection_notes: <notes>`
  - `rejection_report_url: <url>`
  - `previous_sample_id: <old sample_id>` (optional but useful)
  - `quantity`, `notes`
  - (critically: do NOT include old `tracking_number`, `courier_name`, `actual_arrival`, etc.)

With this, `PendingTasksBanner` will see:
- `task_type === 'sample_request'`
- `needs_resend === true`
- `tracking_number` absent
…and will correctly pass `onAddTracking` and `onGiveUpItem` to `TaskCard`.

#### E) Update the card “ball-in-court” fields (already aligned with earlier fix)
Update `development_items`:
- `workflow_status: 'sample_requested'`
- `current_assignee_role: 'trader'`
- `pending_action_type: 'sample_tracking'`
- plus existing ownership flags (`current_owner`, `is_new_for_other_team`, etc.)

#### F) Activity log + notification
- Keep `development_card_activity` insert for `sample_rejected` (already)
- Send notification to Trader role (already), but update it to reference the NEW task id if desired.

### 2) (Optional safety net) UI fallback
If you want extra robustness, we can also adjust `PendingTasksBanner.getTaskActions()` so that:
- if `needs_resend === true`, it **always** offers “Add New Tracking” even if stale tracking fields exist

But the recommended fix is to correct the data model on rejection so UI logic stays simple and consistent.

## Why this approach is best
- Fixes the missing buttons by ensuring the “resend” task is truly a new tracking step.
- Prevents overwriting the rejected sample’s tracking data.
- Maintains a correct, auditable history: rejected sample remains rejected; new sample is a new object.
- Keeps Sample Tracker accurate (each physical sample shipment is a distinct record).

## Testing checklist (end-to-end)
1) Request sample (Buyer) → Trader sees “Add Tracking”
2) Trader adds tracking → Buyer sees “Mark Arrived”
3) Buyer marks arrived → Quality sees “Review Sample”
4) Quality rejects with mandatory report upload:
   - Old review task disappears (completed)
   - New “New Sample Needed” task appears for Trader
   - Buttons visible: “Add New Tracking” and “Give Up Item”
   - Sample Tracking section shows rejected sample + new pending sample record
5) Trader adds new tracking:
   - New sample moves to “In Transit”
   - Pending task flows forward correctly again

## Scope / files to change
- `src/components/development/SampleReviewModal.tsx` (main fix)

## No database migration required
All changes are in how we write existing rows, using existing tables/constraints.
