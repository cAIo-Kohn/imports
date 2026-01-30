
# Fix InlineReplyBox Thread Context

## Problem
When replying to a message within an existing thread, the `InlineReplyBox` component is not receiving the thread ID. This causes replies to potentially be assigned to incorrect threads, breaking the conversation grouping.

**Current behavior:** When you reply to a reply (nested message), the system uses that message's ID as the thread root, creating a broken chain.

**Expected behavior:** All replies within a thread should reference the same thread root ID, keeping conversations properly grouped.

## Solution
Pass the thread context from the activity to the `InlineReplyBox` component in `ThreadMessage.tsx`.

## Technical Details

### File: `src/components/development/ThreadMessage.tsx`

**Change:** Add the `threadId` prop to the `InlineReplyBox` component.

The prop should use this fallback chain:
1. `activity.thread_root_id` - The definitive thread root (if activity is part of an existing thread)
2. `activity.thread_id` - Fallback if thread_root_id is null
3. `activity.id` - Fallback for root-level activities (when replying to a standalone message)

```text
Lines 232-240: Add threadId prop

Before:
<InlineReplyBox
  replyToId={activity.id}
  replyToType={getReplyToType()}
  cardId={cardId}
  currentOwner={currentOwner}
  pendingActionType={pendingActionType}
  onClose={onCloseReply}
  onCardMove={onOwnerChange}
/>

After:
<InlineReplyBox
  replyToId={activity.id}
  replyToType={getReplyToType()}
  cardId={cardId}
  currentOwner={currentOwner}
  pendingActionType={pendingActionType}
  threadId={activity.thread_root_id || activity.thread_id || activity.id}
  onClose={onCloseReply}
  onCardMove={onOwnerChange}
/>
```

## Why This Works
The `InlineReplyBox` already has logic to handle the `threadId` prop (line 76 in `InlineReplyBox.tsx`):
```typescript
const effectiveThreadId = threadId || replyToId;
```

By explicitly passing the correct thread ID, replies will always be associated with the proper thread root, maintaining correct conversation grouping regardless of whether the user is replying to the root message or a nested reply.

## Impact
- Ensures all replies within a thread share the same `thread_id` and `thread_root_id`
- Fixes thread grouping in the timeline view
- Correctly updates `pending_for_team` on the thread root when answering questions
