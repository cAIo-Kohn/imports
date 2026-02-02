
# Fix Thread Visibility and Assignment Issues

## Status: ✅ COMPLETED

## Issues Fixed

### ✅ Issue 1: Original Thread Assigned to Creator Instead of Target
- **Fix applied**: Calculator card's original thread was updated to assign to `trader` role
- **Database update**: `assigned_to_users = '{}', assigned_to_role = 'trader'`

### ✅ Issue 2: Replies Don't Update Thread Assignment  
- **Fix applied**: InlineReplyBox now has clear action buttons:
  - **Comment** = No assignment change (just adds info)
  - **Ask Question** = Reassigns to card creator (new button)
  - **Answer [Name]** = Reassigns back to thread creator
  - **Reassign...** = Manual override

### ✅ Issue 3: "Your Turn" Shows Own Reply
- **Fix applied**: Development.tsx pending threads query now correctly filters only thread roots (`thread_id = id`)

## Technical Changes Made

| File | Change |
|------|--------|
| `Development.tsx` | Fixed pending threads query to only count thread roots (where `thread_id = id`) |
| `InlineReplyBox.tsx` | Added `answerToCardCreatorMutation` for "Ask Question" button; renamed "Reply" to "Comment"; added "Ask Question" button |
| Database | Fixed Calculator card's original thread assignment to trader role |

## Reply Button Behavior

| Button | Action | Assignment Change |
|--------|--------|-------------------|
| **Comment** | Posts a comment | None |
| **Ask Question** | Asks question on card | Reassigns to card creator |
| **Answer [Name]** | Answers thread creator | Reassigns to thread creator |
| **Reassign...** | Manual reassignment | User selects new assignee |

## Testing Checklist
1. ✅ Calculator card now shows "Your Turn" for traders
2. Create new card assigned to Trader - verify thread shows "Your Turn" for traders
3. Trader uses "Ask Question" - verify thread reassigns to card creator
4. Creator sees "Your Turn" badge after trader's question
5. Creator uses "Answer" - verify thread reassigns back to trader
