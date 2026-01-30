# Auto-Thread Sample Requests - IMPLEMENTED ✅

## Summary
Sample requests now appear as auto-created threads in the timeline instead of a separate banner. Users can reply, comment, snooze, and add tracking directly from the thread card.

## Changes Made

### 1. ThreadedTimeline.tsx
- Added `'sample_requested'` to `THREADABLE_TYPES` constant

### 2. HistoryTimeline.tsx  
- Added assignment columns when creating `sample_requested` activity:
  - `assigned_to_role: 'trader'` (China team)
  - `thread_creator_id: user.id`
  - `thread_status: 'open'`
- Disabled `showSampleRequestedBanner` (now always false)

### 3. AddSampleForm.tsx
- Same assignment column updates for sample request creation

### 4. ThreadCard.tsx
- Added imports for `InlineSampleShipForm` and `SnoozeButton`
- Added `showShipForm` state
- Added "Add Tracking" button in thread header for sample threads at 'requested' stage
- Added snooze button for assigned users
- Added inline `InlineSampleShipForm` in thread content
- Updated sample lifecycle detection to check thread replies

### 5. InlineReplyBox.tsx
- Updated `replyToType` to accept `'sample_requested'`

## Visual Result
Sample requests now appear as highlighted threads with:
- "Your turn" badge when assigned to current user/role
- Reply capability for discussions
- "Add Tracking" button (visible at 'requested' stage)
- Snooze button for timing expectations
- Sample lifecycle progress indicator (Requested → Shipped → Arrived → Reviewed)
