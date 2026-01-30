# Memory: features/development/thread-level-pending
Updated: 2026-01-30

## Overview
Thread-level pending status tracks which team needs to act on each individual thread, rather than having a single card-level pending action. This allows multiple concurrent threads with different ownership requirements.

## Database Schema
Added to `development_card_activity` table:
- `pending_for_team` (TEXT, nullable): 'mor' or 'arc' - which team needs to act on this thread. Only set on thread root activities.
- `thread_resolved_at` (TIMESTAMPTZ, nullable): When the thread's pending action was completed/resolved.

## Key Behaviors

### Thread Creation
- **Comments**: Set `pending_for_team: null` (no action required)
- **Questions**: Set `pending_for_team: targetOwner` (receiving team must respond)
- **Sample Requests**: Set `pending_for_team: 'arc'` (China must add tracking)

### Sample Flow Thread Updates
- **Tracking Added**: Update sample_requested thread to `pending_for_team: 'mor'` (Brazil waits for arrival)
- **Sample Arrived**: Keep `pending_for_team: 'mor'` (Brazil needs to review)
- **Sample Reviewed**: Clear `pending_for_team` and set `thread_resolved_at` (thread complete)

### Thread Updates (Questions/Answers)
- When replying to a question with an **answer**: Update thread root's `pending_for_team` to the answer receiver
- When posting a **follow-up question**: Update thread root's `pending_for_team` to the question receiver
- When **resolving** a question: Clear `pending_for_team` and set `thread_resolved_at`
- When **acknowledging** an answer: Clear `pending_for_team` and set `thread_resolved_at`

### UI Display (ThreadCard)
- Threads with `pending_for_team` matching current user's team show:
  - Amber highlight with ring
  - "Your turn" badge with pulsing animation
  - AlertCircle icon
- Threads waiting on the other team show:
  - Muted "Waiting" badge with team flag
- Resolved threads show:
  - Green styling with "Resolved" badge

### UI Display (PendingThreadsBanner)
- Collapsible banner at the top of the timeline showing all pending threads for current team
- Each thread shows: icon, title, author, timestamp, content preview
- Quick action buttons appear on hover for each thread type:
  - Sample requests: "Add tracking" button
  - Questions: "Answer question" button
  - Answers: "Acknowledge" button
- Clicking a thread scrolls to it in the timeline

## Files Modified
- `src/components/development/ThreadCard.tsx` - Display per-thread pending status, added id for scroll targeting
- `src/components/development/NewThreadComposer.tsx` - Set pending_for_team on new threads
- `src/components/development/InlineReplyBox.tsx` - Update thread root pending status on replies
- `src/components/development/HistoryTimeline.tsx` - Update pending status on resolve/acknowledge, calculate pending threads, render PendingThreadsBanner
- `src/components/development/PendingThreadsBanner.tsx` - NEW: Banner component showing all pending threads for current team

## Migration
```sql
ALTER TABLE public.development_card_activity
ADD COLUMN pending_for_team TEXT NULL;

ALTER TABLE public.development_card_activity
ADD COLUMN thread_resolved_at TIMESTAMPTZ NULL;
```
