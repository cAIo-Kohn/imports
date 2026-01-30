
# Fix Replies Being Treated as New Pending Threads

## Problem
When you reply to a thread (e.g., Peter asks a question, you answer), the system incorrectly shows the **reply itself** as a new pending thread in the "Your Pending Actions" banner. This creates confusion because:
- Multiple pending items appear for the same conversation
- The pending action should be on the original thread root, not each reply
- It makes it look like replying creates a new thread

## Root Cause
Two issues are causing this:

1. **InlineReplyBox.tsx** sets `pending_for_team` on the **reply activity itself** (lines 136 and 228), not just updating the thread root
2. **HistoryTimeline.tsx** filters pending threads by checking `pending_for_team` on **all activities**, not just thread roots

For example:
- Peter (ARC) asks a question → Thread root created with `pending_for_team: 'mor'`
- You (MOR) answer → Answer activity created with `pending_for_team: 'arc'`, AND thread root updated to `pending_for_team: 'arc'`
- Result: Both the thread root AND your answer show as pending items

## Solution

### 1. Filter pendingThreads to Only Include Thread Roots

**File: `src/components/development/HistoryTimeline.tsx`**

Update the `pendingThreads` calculation (lines 1307-1325) to only include activities that are thread roots:

```typescript
// Before (lines 1307-1314):
const pendingThreads = allActivities
  .filter(a => 
    a.pending_for_team && 
    !a.thread_resolved_at &&
    a.pending_for_team === currentOwner
  )

// After:
const pendingThreads = allActivities
  .filter(a => 
    // Only actual thread roots (thread_id equals its own id)
    a.thread_id === a.id &&
    // Has pending action for a team
    a.pending_for_team && 
    // Not resolved yet
    !a.thread_resolved_at &&
    // Pending for current team
    a.pending_for_team === currentOwner
  )
```

### 2. Stop Setting pending_for_team on Reply Activities

**File: `src/components/development/InlineReplyBox.tsx`**

Remove `pending_for_team` from the INSERT statements for replies since only the thread root should track pending status:

**Answer mutation (lines 123-137):**
```typescript
// Before:
const { error: insertError } = await supabase.from('development_card_activity').insert({
  ...
  pending_for_team: targetOwner,  // <-- REMOVE this line
});

// After:
const { error: insertError } = await supabase.from('development_card_activity').insert({
  ...
  // pending_for_team is NOT set on replies - only thread root tracks this
});
```

**Follow-up question mutation (lines 214-230):**
```typescript
// Before:
const { error: insertError } = await supabase.from('development_card_activity').insert({
  ...
  pending_for_team: targetOwner,  // <-- REMOVE this line
});

// After:
const { error: insertError } = await supabase.from('development_card_activity').insert({
  ...
  // pending_for_team is NOT set on replies - only thread root tracks this
});
```

The existing code that updates the thread root's `pending_for_team` (lines 165-171 and 232-237) is correct and remains unchanged.

## Summary of Changes

| File | Change |
|------|--------|
| `HistoryTimeline.tsx` | Add filter condition `a.thread_id === a.id` to only include thread roots in pendingThreads |
| `InlineReplyBox.tsx` | Remove `pending_for_team: targetOwner` from answer and follow-up question INSERT statements |

## Expected Behavior After Fix

1. Peter (ARC) asks you a question → Shows as "Your Pending Actions" for MOR
2. You answer Peter's question → Pending action moves to Peter (ARC), only **one** pending thread shows
3. Peter sees the same thread in his "Your Pending Actions" banner (to acknowledge your answer)
4. No duplicate pending items - each thread shows only once

## Testing Checklist
1. Open a card with an existing question thread
2. Reply to the question with "Answer & Move"
3. Check the PendingThreadsBanner - should show only ONE entry for that thread
4. Switch to the other team's view - should see the thread pending for acknowledgment
5. Verify no duplicate threads appear in the banner
