
# Fix Thread Visibility and Assignment Issues

## Issues Identified

### Issue 1: Original Thread Assigned to Creator Instead of Target
**Database evidence:**
- Card created by Vitória with `assigned_to_role: 'trader'`
- BUT the `card_created` activity has `assigned_to_users: [Vitória]` instead of `assigned_to_role: 'trader'`
- This means the original thread is assigned to the creator, not the intended recipient

**Root cause:** In `CreateCardModal.tsx` (lines 161-162), the thread is correctly using the assignment, but looking at the database query result, the thread has `assigned_to_users: [Vitória's ID]` which suggests the card assignment was set to her (possibly as a default or bug).

### Issue 2: Replies Don't Update Thread Assignment
**Database evidence:**
- Peter's answer has `assigned_to_users: []` and `assigned_to_role: null`
- Vitória's comment also has empty assignment
- The thread root's assignment is never updated when replies are posted

**Root cause:** When Peter replied with "Reply" button, it used `commentReplyMutation` which does NOT update the thread root's assignment. Only "Reply to Creator" or "Reassign" buttons update the thread assignment.

### Issue 3: "Your Turn" Shows Own Reply
When Peter replied, he saw a headline about his own reply because:
- The thread root still had Vitória in `assigned_to_users`
- But since the root had `assigned_to_role: null` (not 'trader'), Peter's role wasn't matched
- The pending threads query filters by user/role assignment, and the calculation was inconsistent

## Solution

### Fix 1: Ensure Original Thread Uses Card Assignment (Not Creator)
**File: `CreateCardModal.tsx`** (already correct, but verify assignment is passed through)

The issue is that when Vitória created the card assigned to "Trader", the database shows the thread was assigned to HER user ID instead. This needs investigation - the assignment selector may be defaulting incorrectly.

### Fix 2: Answer Replies Should Auto-Reassign to Thread Creator
When someone replies with an "answer" (responding to a question or thread), the system should automatically reassign the thread back to the thread creator. Currently, only "Reply to Creator" button does this.

**File: `InlineReplyBox.tsx`**
- Update `commentReplyMutation` to optionally auto-reassign based on context
- When replying to the original `card_created` thread, answers should go back to thread creator

### Fix 3: Simplify Reply Actions
The current UI has too many buttons (Reply, Reply to Creator, Reassign). Simplify:
- **Reply** (comment) = No assignment change
- **Answer** = Auto-reassign to thread creator (the person who needs to see it)
- **Reassign** = Manual override

### Fix 4: Fix Pending Threads Query
**File: `Development.tsx`** (lines 246-253)
The query filters threads by assignment, but the logic needs to match what ThreadCard uses:
```typescript
// Current: .not('thread_id', 'is', null)
// Should also check: thread_id = id (only root activities)
```

### Fix 5: Validate Thread Creation with Correct Assignment
**File: `CreateCardModal.tsx`**
Add validation to ensure assignment is actually set before creating:
```typescript
if (assignedUsers.length === 0 && !assignedRole) {
  toast({ title: 'Error', description: 'Please assign the card to someone', variant: 'destructive' });
  return;
}
```

## Technical Changes

| File | Change |
|------|--------|
| `CreateCardModal.tsx` | Add validation that assignment is set; verify assignment flows to thread correctly |
| `InlineReplyBox.tsx` | When replying as "answer" type, auto-update thread assignment to thread creator |
| `Development.tsx` | Fix pending threads query to only get actual thread roots (where `thread_id = id`) |
| `ThreadCard.tsx` | Ensure "Your turn" badge uses consistent logic with Development.tsx |

## Database Fix for Existing Data
Run a migration to fix the Calculator card's original thread assignment:
```sql
-- Fix Calculator card's original thread to be assigned to trader role
UPDATE development_card_activity 
SET 
  assigned_to_users = '{}',
  assigned_to_role = 'trader'
WHERE card_id = 'a945f383-c871-4f67-b459-647a366517ad'
  AND activity_type = 'card_created';
```

## Testing Checklist
1. Create new card assigned to Trader - verify thread shows "Your Turn" for traders
2. Trader replies with answer - verify thread reassigns to card creator
3. Creator sees "Your Turn" badge after trader's reply
4. All users can see full conversation in thread
5. Pending threads count matches actual assignments
