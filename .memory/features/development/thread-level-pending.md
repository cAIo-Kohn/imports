# Memory: features/development/thread-level-pending
Updated: 2026-01-30

## Overview
Thread assignment system tracks who needs to act on each individual thread using user IDs and/or department roles, replacing the previous team-based (`pending_for_team`) approach. This allows multiple concurrent threads on a card with different assignees.

## Database Schema
Columns on `development_card_activity` table (thread roots only):
- `assigned_to_users` (UUID[]): Array of user IDs assigned to this thread
- `assigned_to_role` (TEXT): Department role assigned ('buyer', 'marketing', 'quality', 'trader', 'admin')
- `thread_creator_id` (UUID): Who created this thread (only they can close it)
- `thread_status` (TEXT): 'open' or 'resolved'
- `thread_resolved_at` (TIMESTAMPTZ): When the thread was closed

Legacy column (deprecated):
- `pending_for_team` - replaced by assignment system, migrated to assigned_to_role

## Key Behaviors

### Thread Creation
- Thread creator MUST assign to users (via picker) or a department role (or both)
- `thread_creator_id` is set to the creating user
- `thread_status` starts as 'open'
- Notifications sent to all assigned users

### Thread Display (ThreadCard)
- Threads assigned to current user OR their role show "Your turn" badge with amber highlight
- Resolved threads show grey/faded styling with "Resolved" badge and are collapsed by default
- "Close Thread" button visible only to thread creator

### Thread Replies (InlineReplyBox)
- "Reply" - Just adds comment, no assignment change
- "Reply to [Creator]" - Reassigns thread back to creator
- "Reassign..." - Opens picker to reassign to different users/role

### Thread Resolution
- Only the `thread_creator_id` can resolve/close a thread
- Sets `thread_status = 'resolved'` and `thread_resolved_at = now()`
- Thread remains visible (collapsed) for audit purposes

## Components

| Component | Purpose |
|-----------|---------|
| `ThreadAssignmentSelect.tsx` | Picker for selecting users and/or department roles |
| `NewThreadComposer.tsx` | Creates threads with mandatory assignment |
| `ThreadCard.tsx` | Displays thread with assignment badges, "Your turn" highlight, resolve button |
| `InlineReplyBox.tsx` | Reply with reassignment options |
| `ThreadMessage.tsx` | Individual message within thread |

## Removed Components
- `PendingThreadsBanner.tsx` - Replaced by per-thread highlighting in ThreadCard

## Migration Applied
```sql
ALTER TABLE public.development_card_activity
ADD COLUMN assigned_to_users UUID[] DEFAULT '{}'::UUID[],
ADD COLUMN assigned_to_role TEXT NULL,
ADD COLUMN thread_creator_id UUID NULL,
ADD COLUMN thread_status TEXT DEFAULT 'open';

-- Migrated existing pending_for_team data:
-- 'mor' -> assigned_to_role = 'buyer'
-- 'arc' -> assigned_to_role = 'trader'
```
