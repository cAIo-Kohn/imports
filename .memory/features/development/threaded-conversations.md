# Memory: features/development/threaded-conversations
Updated: 2026-01-30

The development card timeline now supports threaded conversations. Activities are grouped by `thread_id` (UUID column on `development_card_activity`). New comments/questions start their own thread (`thread_id` = `activity.id`). Replies inherit the parent's `thread_id`. Components: `ThreadCard.tsx` (collapsible thread container), `ThreadMessage.tsx` (individual message), `ThreadedTimeline.tsx` (groups activities by thread), `CompactActivityRow.tsx` (system activities). Threads are sorted by most recent activity. System activities (status changes, sample updates, commercial updates) appear in a separate compact "Activity Log" section below threads.
