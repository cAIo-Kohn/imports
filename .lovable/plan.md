
# Unified Thread-Based Card System

## Overview
Transform the card system to use a unified thread-based approach where every card starts with an "original thread" (using the card's title). This eliminates the need for MOR/ARC team-based sections and replaces it with a user/role-based assignment model. Users will only see what's pending for them based on explicit assignments.

## Key Changes Summary

1. **Every card starts with an "original thread"** - When a card is created, an auto-generated thread root activity is created with the card title as thread title
2. **"Assign to" required in Create Card modal** - Cards must be assigned to specific users or roles at creation time
3. **Remove MOR/ARC team sections** - Replace with a unified card list (organize later)
4. **Restructure Quick Actions behavior:**
   - New Thread = Creates a NEW separate thread (same as current)
   - Add Comment = Adds comment to original thread (no action power)
   - Ask Question = Asks question in original thread, moves ball to card creator
   - Upload = Treated as comment with attachment in original thread

## Database Changes

### 1. Add assignment columns to `development_items` table
```sql
ALTER TABLE public.development_items
ADD COLUMN assigned_to_users UUID[] DEFAULT '{}'::UUID[],
ADD COLUMN assigned_to_role TEXT NULL;
```

These will store the initial card-level assignment (which dictates who owns the "original thread").

### 2. Create "original thread" on card creation
When a card is created, automatically insert a corresponding `development_card_activity` entry that serves as the original thread root:

```sql
-- In card creation flow
INSERT INTO development_card_activity (
  card_id, user_id, activity_type, content, 
  thread_title, thread_id, thread_root_id,
  assigned_to_users, assigned_to_role, 
  thread_creator_id, thread_status
) VALUES (
  $card_id, $user_id, 'card_created',
  'Card created: ' || $title,
  $title,  -- Thread title = Card title
  $new_activity_id, $new_activity_id,  -- Self-referencing for thread root
  $assigned_users, $assigned_role,
  $user_id, 'open'
);
```

## Component Changes

### 1. CreateCardModal.tsx
**Add "Assign to" section (required)**

```typescript
// New state
const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
const [assignedRole, setAssignedRole] = useState<AppRole | null>(null);

// Add after form fields
<div className="space-y-2">
  <Label className="flex items-center gap-1">
    Assign to <span className="text-destructive">*</span>
  </Label>
  <ThreadAssignmentSelect
    assignedUsers={assignedUsers}
    assignedRole={assignedRole}
    onAssignedUsersChange={setAssignedUsers}
    onAssignedRoleChange={setAssignedRole}
    required
  />
</div>
```

**Update mutation to:**
1. Save `assigned_to_users` and `assigned_to_role` to the card
2. Create original thread activity with same assignment
3. Remove logic that auto-assigns to opposite team (`is_new_for_other_team`, `initialOwner`)

### 2. Development.tsx
**Remove MOR/ARC team sections**

Replace the two `TeamSection` components with a single unified card list. For now, show all cards in one section. The filtering will be based on:
- Cards assigned to current user (via `assigned_to_users`)
- Cards assigned to current user's role (via `assigned_to_role`)
- All cards visible but "pending for me" highlighted

```typescript
// Remove:
const { morItems, arcItems } = useMemo(() => ({
  morItems: filteredItems.filter(item => item.current_owner === 'mor'),
  arcItems: filteredItems.filter(item => item.current_owner === 'arc'),
}), [filteredItems]);

// Replace with:
const { myPendingItems, otherItems } = useMemo(() => {
  const myPending = filteredItems.filter(item => 
    item.assigned_to_users?.includes(userId) ||
    (item.assigned_to_role && userRoles.includes(item.assigned_to_role))
  );
  const others = filteredItems.filter(item => 
    !item.assigned_to_users?.includes(userId) &&
    !(item.assigned_to_role && userRoles.includes(item.assigned_to_role))
  );
  return { myPendingItems: myPending, otherItems: others };
}, [filteredItems, userId, userRoles]);
```

Create a new layout:
- Option A: Single unified list with "My Pending" cards at top, visually highlighted
- Option B: Two sections "My Pending" / "Other Cards" (simpler for now)

### 3. BannerQuickActions.tsx
**Update action behavior**

Change the component to pass additional context about which action was selected:

```typescript
interface BannerQuickActionsProps {
  onStartThread?: () => void;   // Creates NEW thread
  onAddComment?: () => void;    // Comment on original thread
  onAskQuestion?: () => void;   // Question on original thread (moves ball)
  onUpload?: () => void;        // Upload as comment on original thread
  // ...
}
```

The handlers in `HistoryTimeline.tsx` will need to differentiate:
- `onStartThread`: Opens NewThreadComposer (as current)
- `onAddComment`: Opens InlineReplyBox configured for comment on original thread
- `onAskQuestion`: Opens InlineReplyBox configured for question on original thread

### 4. HistoryTimeline.tsx
**Major updates needed:**

1. **Identify "original thread"** - the first thread root with `activity_type === 'card_created'` or earliest thread
2. **Update NewCardBanner** - now represents the "original thread" that users can reply to directly
3. **Quick Actions handlers:**

```typescript
// Track original thread ID
const originalThread = useMemo(() => {
  return activities.find(a => 
    a.activity_type === 'card_created' && 
    a.thread_id === a.id
  ) || activities.find(a => a.thread_root_id === a.id);
}, [activities]);

// Handler for "Add Comment" - comment on original thread
const handleAddCommentToOriginal = () => {
  if (originalThread) {
    setReplyToActivityId(originalThread.id);
    setReplyType('comment');
    setShowInlineReply(true);
  }
};

// Handler for "Ask Question" - question on original thread, moves to creator
const handleAskQuestionOnOriginal = () => {
  if (originalThread) {
    setReplyToActivityId(originalThread.id);
    setReplyType('question');
    setReassignToCreator(true);
    setShowInlineReply(true);
  }
};
```

4. **Banner visibility logic** - Show banner when:
   - Card is assigned to current user/role
   - Original thread has pending actions for current user

### 5. InlineReplyBox.tsx
**Add support for "question" that reassigns to creator**

When `replyType === 'question'` and posting:
1. Insert the question activity
2. Update original thread's `assigned_to_users` to include only the card creator
3. Clear `assigned_to_role` (since we're targeting a specific user)

```typescript
// When posting a question in original thread
if (replyType === 'question' && reassignToCreator) {
  // Update the thread root to assign back to card creator
  await supabase
    .from('development_card_activity')
    .update({
      assigned_to_users: [cardCreatorId],
      assigned_to_role: null,
    })
    .eq('id', threadRootId);
}
```

### 6. TimelineBanners.tsx (NewCardBanner)
**Transform into "Original Thread" display**

The NewCardBanner should now represent the original thread that people can interact with:

```typescript
export function NewCardBanner({ 
  cardTitle,
  cardDescription,
  cardImageUrl,
  cardId,
  originalThreadId,      // NEW: ID of original thread
  pendingActionType,
  onAddComment,          // Reply with comment
  onAskQuestion,         // Reply with question (moves to creator)
  onStartNewThread,      // Create separate thread
  onSnooze,
  onUpload,
}: NewCardBannerProps) {
  // ...
}
```

### 7. ThreadedTimeline.tsx
**Include original thread type**

Update `THREADABLE_TYPES` to include the new card_created type:

```typescript
const THREADABLE_TYPES = ['comment', 'question', 'answer', 'sample_requested', 'card_created'];
```

### 8. DevelopmentItem type
**Add new fields**

```typescript
export interface DevelopmentItem {
  // ... existing fields
  assigned_to_users?: string[] | null;
  assigned_to_role?: string | null;
  original_thread_id?: string | null;  // For quick access
}
```

## Visual Flow

### Card Creation
```
┌─────────────────────────────────────────────────────────┐
│ Create New Card                                         │
├─────────────────────────────────────────────────────────┤
│ Title: PE Strap                                         │
│ Category: ○ Final Product  ○ Raw Material               │
│ Desired Outcome: Need to develop new supplier           │
│ Picture: [Upload]                                       │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Assign to *                                         │ │
│ │ [Select users or department...        ▼]            │ │
│ │   ○ Trader (all traders see it)                     │ │
│ │   ○ @Jin Wei (specific person)                      │ │
│ │   ○ Marketing                                       │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Priority: [Medium ▼]    Due: [____]                     │
│                                                         │
│                              [Cancel]  [Create Card]    │
└─────────────────────────────────────────────────────────┘
```

### Card Timeline (when assignee opens it)
```
┌─────────────────────────────────────────────────────────┐
│ ✨ PE Strap                                [Your Turn]   │
├─────────────────────────────────────────────────────────┤
│ ┌─ Original Thread ──────────────────────────────────┐  │
│ │ [Image] PE Strap                                   │  │
│ │         Need to develop new supplier in China      │  │
│ │                                                    │  │
│ │ [💬 Add Comment]  [❓ Ask Question]  [📎 Upload]   │  │
│ │ [➕ New Thread]   [⏰ Snooze ▼]                     │  │
│ └────────────────────────────────────────────────────┘  │
│                                                         │
│ ACTIVITY LOG                                            │
│ ○ Vitória created this card — 30/01 15:24               │
└─────────────────────────────────────────────────────────┘
```

### After adding a comment
```
┌─────────────────────────────────────────────────────────┐
│ Thread: PE Strap                              (open)    │
├─────────────────────────────────────────────────────────┤
│ Vitória: Need to develop new supplier in China          │
│                                                         │
│ Jin: I'll check with suppliers and get back to you      │
│      with options by Friday.                  — 30/01   │
│                                                         │
│ [Reply to this thread]                                  │
└─────────────────────────────────────────────────────────┘
```

## Files to Modify

| File | Changes |
|------|---------|
| `CreateCardModal.tsx` | Add ThreadAssignmentSelect, create original thread on card creation |
| `Development.tsx` | Remove MOR/ARC sections, add unified list with "My Pending" logic |
| `HistoryTimeline.tsx` | Track original thread, update Quick Actions handlers |
| `BannerQuickActions.tsx` | Keep same interface, update usage in parent |
| `TimelineBanners.tsx` | Update NewCardBanner to work with original thread |
| `ThreadedTimeline.tsx` | Add 'card_created' to THREADABLE_TYPES |
| `InlineReplyBox.tsx` | Add question-to-creator reassignment logic |
| `TeamSection.tsx` | May be repurposed or removed |

## Database Migration

```sql
-- Add assignment columns to development_items
ALTER TABLE public.development_items
ADD COLUMN IF NOT EXISTS assigned_to_users UUID[] DEFAULT '{}'::UUID[],
ADD COLUMN IF NOT EXISTS assigned_to_role TEXT NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_development_items_assigned_role 
ON public.development_items(assigned_to_role);

-- Create GIN index for array lookups
CREATE INDEX IF NOT EXISTS idx_development_items_assigned_users 
ON public.development_items USING GIN(assigned_to_users);
```

## Migration Strategy

1. **Phase 1: Add assignment to Create Card**
   - Add `assigned_to_users` and `assigned_to_role` columns
   - Update CreateCardModal with assignment UI
   - Create original thread on card creation
   - Existing cards without original thread will get one created on first view

2. **Phase 2: Update Timeline and Banners**
   - Modify Quick Actions behavior
   - Update NewCardBanner to work as original thread
   - Update InlineReplyBox for question reassignment

3. **Phase 3: Remove MOR/ARC sections**
   - Replace with unified view
   - Add "My Pending" filtering
   - Consider future organization options (tabs, filters)

## Summary

| Aspect | Current | New |
|--------|---------|-----|
| Card ownership | Team-based (MOR/ARC) | User/Role-based assignment |
| Initial thread | None (must create) | Auto-created with card title |
| Add Comment | Creates new thread | Replies to original thread |
| Ask Question | Creates new thread | Replies to original thread + reassigns |
| Board layout | Two team columns | Unified list (My Pending first) |
| Visibility | Based on team | Based on personal assignment |

This redesign simplifies the mental model: every card is a conversation with an original thread, and additional threads can be created for specific topics. Users see what's pending for them based on explicit assignments, not team membership.
