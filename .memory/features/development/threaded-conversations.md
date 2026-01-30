# Memory: features/development/threaded-conversations
Updated: 2026-01-30

## Overview
Development card activity now supports threaded conversations. Activities are grouped by `thread_id` and displayed in collapsible `ThreadCard` components. This allows parallel discussions (e.g., Marketing discussing packaging while Buyers discuss pricing) without message overlap.

## Database Schema
- `thread_id` (UUID, nullable): References the root activity of the thread
- `thread_root_id` (UUID, nullable): Also references the root activity (for querying)
- `thread_title` (TEXT, nullable): Custom editable title for the thread, only set on root activities

## UI Components
- **ThreadCard**: Collapsible container showing thread title, participants, reply count
- **ThreadMessage**: Individual message within a thread with visual indentation
- **ThreadedTimeline**: Groups activities by thread_id and sorts by most recent activity
- **CompactActivityRow**: System activities (status changes, commercial updates) shown separately

## Key Behaviors
- New comments/questions start their own thread (`thread_id` = activity's own ID)
- Replies inherit `thread_id` from parent activity
- Thread titles auto-generate from first words but can be edited via pencil icon
- "Start New Thread" button (formerly "Comment") makes thread creation explicit
- Questions can still trigger card movement after posting
Updated: 2026-01-30

The development card timeline now supports threaded conversations. Activities are grouped by `thread_id` (UUID column on `development_card_activity`). New comments/questions start their own thread (`thread_id` = `activity.id`). Replies inherit the parent's `thread_id`. Components: `ThreadCard.tsx` (collapsible thread container), `ThreadMessage.tsx` (individual message), `ThreadedTimeline.tsx` (groups activities by thread), `CompactActivityRow.tsx` (system activities). Threads are sorted by most recent activity. System activities (status changes, sample updates, commercial updates) appear in a separate compact "Activity Log" section below threads.
