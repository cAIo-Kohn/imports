
# Redesign Thread Assignment System

## Overview
Replace the current team-based (`pending_for_team: 'mor' | 'arc'`) pending action system with a user/role-based assignment system. Each thread can be assigned to specific users (via @mentions) or department roles (buyer, marketing, quality, trader, admin). This enables multiple concurrent threads on a card with different assignees, each trackable individually.

## Current System Analysis
The existing system has:
- `pending_for_team` column on `development_card_activity` (values: 'mor' or 'arc')
- `PendingThreadsBanner` component that shows all threads awaiting current team's action
- Team-based ownership model (card moves between MOR/Brazil and ARC/China)
- `@mentions` system for user notifications (stores `@[Name](uuid)` format)

## New System Design

### Core Concept
When creating a thread, the user must **assign** it to:
1. **Specific users** - via @mention syntax (existing functionality)
2. **A department/role** - buyer, marketing, quality, trader, admin, viewer
3. **Both** - users AND a role

The thread creator "owns" the thread and is the only one who can close/resolve it.

### Database Changes

**New columns on `development_card_activity`:**
```sql
-- Replace pending_for_team with:
assigned_to_users UUID[] DEFAULT '{}'::UUID[]  -- Array of user IDs
assigned_to_role TEXT NULL                      -- 'buyer' | 'marketing' | 'quality' | 'trader' | 'admin' | NULL
thread_creator_id UUID NULL                     -- Who created this thread (for ownership)
thread_status TEXT DEFAULT 'open'               -- 'open' | 'resolved'
-- Keep thread_resolved_at for when it was closed
```

**Columns to remove:**
- `pending_for_team` - replaced by the new assignment system

### Component Changes

#### 1. Remove PendingThreadsBanner
- Delete `src/components/development/PendingThreadsBanner.tsx`
- Remove its usage from `HistoryTimeline.tsx`

#### 2. Update NewThreadComposer
Add thread assignment UI:
- **"Assign to" section** with:
  - User picker (enhanced @mention): Select one or more users
  - Role dropdown: Select department (optional)
- Make this **required** - cannot post thread without assignment
- Store assignments in thread root activity

New props:
```typescript
interface NewThreadComposerProps {
  // ... existing props
  // Remove currentOwner dependency for movement logic
}
```

New state:
```typescript
const [assignedUsers, setAssignedUsers] = useState<{id: string, name: string}[]>([]);
const [assignedRole, setAssignedRole] = useState<AppRole | null>(null);
```

#### 3. Update ThreadCard
Modify thread display to show:
- **Assignment badges** instead of team pending status
- "Your turn" highlight when current user is assigned OR has the assigned role
- **Thread status** (Open/Resolved) with visual distinction
- **Close Thread** button only visible to thread creator

Current styling logic changes:
```typescript
// Before: pendingForTeam === currentOwner
// After: 
const isAssignedToMe = 
  thread.assigned_to_users?.includes(currentUserId) ||
  (thread.assigned_to_role && userRoles.includes(thread.assigned_to_role));
```

Resolved threads styling:
- Grey/faded background
- "Resolved" badge
- Collapsed by default but expandable
- Strikethrough on title

#### 4. Update InlineReplyBox
When replying to a thread:
- **Option 1: "Reply"** - Just adds a reply, no assignment change
- **Option 2: "Reply & Reassign"** - Adds reply and shows reassignment picker
  - Can reassign to thread creator (common: "answered, back to you")
  - Can reassign to another user/role
- **Option 3: "Resolve Thread"** - Only visible to thread creator, marks thread as resolved

Remove:
- "Answer & Move to ARC/MOR" buttons (no more team movement)
- Card ownership change logic tied to replies

#### 5. Create MyPendingThreadsPanel
New component to replace PendingThreadsBanner with card-spanning view:
- Shows ALL threads assigned to current user (across all cards)
- Grouped by card
- Quick access to respond
- Located in sidebar or notification area

Alternatively, keep a per-card banner but redesigned:
```typescript
// In HistoryTimeline.tsx
const myPendingThreads = threadRoots.filter(t =>
  t.thread_status === 'open' &&
  (t.assigned_to_users?.includes(userId) || 
   (t.assigned_to_role && userRoles.includes(t.assigned_to_role)))
);
```

#### 6. Update HistoryTimeline
- Remove `pendingThreads` calculation based on `pending_for_team`
- Add new calculation based on `assigned_to_users` and `assigned_to_role`
- Show a simplified banner for "You have X pending threads" with collapsible list
- Pass assignment data to ThreadedTimeline and ThreadCard

### UI Flow: Creating a Thread

1. User clicks "New Thread"
2. Composer opens with:
   - Thread title (optional)
   - Message content (with @mention support)
   - **Assignment section (required)**:
     - "Assign to users" - Multi-select user picker
     - "Assign to department" - Dropdown: Buyer, Marketing, Quality, Trader, Admin
   - Attachments
3. Buttons: "Cancel" | "Post Thread"
4. On submit:
   - Creates thread root with `assigned_to_users`, `assigned_to_role`, `thread_creator_id`, `thread_status: 'open'`
   - Sends notifications to assigned users/role members

### UI Flow: Responding to a Thread

1. Assigned user sees thread highlighted with "Your turn" badge
2. User clicks "Reply" button
3. Reply box opens with options:
   - "Just Reply" - Adds comment, keeps current assignment
   - "Reply & Back to Creator" - Adds comment, reassigns to thread creator
   - "Reply & Reassign to..." - Opens reassignment picker
4. Only thread creator sees "Resolve Thread" button

### UI Flow: Resolved Threads

1. Thread creator clicks "Resolve Thread"
2. Confirmation dialog (optional)
3. Thread marked as resolved:
   - `thread_status = 'resolved'`
   - `thread_resolved_at = now()`
4. Thread displays:
   - Grey/faded styling
   - "Resolved" badge
   - Collapsed by default
   - Full history preserved and viewable

### Migration Strategy

1. **Create new columns** with migration
2. **Migrate existing data**:
   - Threads with `pending_for_team = 'mor'` → `assigned_to_role = 'buyer'`
   - Threads with `pending_for_team = 'arc'` → `assigned_to_role = 'trader'`
   - Set `thread_creator_id` from first activity in each thread
   - Set `thread_status` based on `thread_resolved_at`
3. **Deploy new UI components**
4. **Remove old columns** after verification

## Files to Modify

| File | Changes |
|------|---------|
| `NewThreadComposer.tsx` | Add assignment UI, remove team-based movement |
| `ThreadCard.tsx` | Show assignment badges, highlight for assignees, add resolve button |
| `InlineReplyBox.tsx` | Add reassignment options, remove team movement |
| `HistoryTimeline.tsx` | Remove PendingThreadsBanner, add new assignment-based pending list |
| `ThreadMessage.tsx` | Show assignment changes in thread |

## Files to Delete

| File | Reason |
|------|--------|
| `PendingThreadsBanner.tsx` | Replaced by new assignment-based system |

## Database Migration

```sql
-- Add new columns
ALTER TABLE public.development_card_activity
ADD COLUMN assigned_to_users UUID[] DEFAULT '{}'::UUID[],
ADD COLUMN assigned_to_role TEXT NULL,
ADD COLUMN thread_creator_id UUID NULL,
ADD COLUMN thread_status TEXT DEFAULT 'open';

-- Migrate existing data
UPDATE public.development_card_activity
SET 
  assigned_to_role = CASE 
    WHEN pending_for_team = 'mor' THEN 'buyer'
    WHEN pending_for_team = 'arc' THEN 'trader'
    ELSE NULL
  END,
  thread_status = CASE 
    WHEN thread_resolved_at IS NOT NULL THEN 'resolved'
    ELSE 'open'
  END,
  thread_creator_id = user_id
WHERE thread_id = id; -- Only update thread roots

-- Remove old column (after verification)
-- ALTER TABLE public.development_card_activity DROP COLUMN pending_for_team;
```

## Summary

This redesign fundamentally changes how thread ownership works:

| Aspect | Current | New |
|--------|---------|-----|
| Assignment target | Team (MOR/ARC) | Users + Roles |
| Who can resolve | Anyone on receiving team | Only thread creator |
| Multiple threads | Yes, but all per-team | Yes, each with different assignees |
| Pending visibility | Team-based banner | User/role-based highlighting |
| Card movement | Automatic on actions | Separate from thread assignment |

The new system provides granular control over who is responsible for each conversation while preserving the ability to audit thread history.
