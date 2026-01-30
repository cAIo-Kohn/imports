# Memory: features/development/auto-thread-samples
Updated: 2026-01-30

## Overview
Sample requests are now treated as auto-created threads. When a sample is requested, it automatically creates a thread that appears in the timeline, allowing users to reply, comment, snooze, and add tracking directly without creating separate threads.

## Implementation
- `sample_requested` added to `THREADABLE_TYPES` in ThreadedTimeline.tsx
- Sample request creation includes thread assignment columns:
  - `assigned_to_role: 'trader'` (China team responsibility)
  - `thread_creator_id`: tracks who requested the sample
  - `thread_status: 'open'`
- ThreadCard.tsx displays "Add Tracking" button for sample threads at 'requested' stage
- Snooze button available for assigned users
- SampleRequestedBanner is disabled (replaced by threaded approach)

## User Flow
1. Brazil requests sample → Creates sample_requested thread assigned to traders
2. Thread appears highlighted with "Your turn" for China team
3. China can:
   - Reply with comments ("I'll talk to supplier and inform ETD soon")
   - Snooze with expected date
   - Click "Add Tracking" to ship the sample
4. All discussions stay in one thread with full audit trail

## Benefits
- Unified experience with other threads
- Direct replies without creating separate threads
- Assignment-based "Your turn" indicators
- Snooze works naturally via thread assignment
- Complete audit trail in one place
