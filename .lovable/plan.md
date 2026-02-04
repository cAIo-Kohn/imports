
# Responsibility & Mention System

## Summary
Implement a two-part indicator system on development cards:
1. **Task Responsibility Tags** - High-visibility "Action: [Team]" badges showing who holds the ball based on task workflow status
2. **Chat Mention Tags** - Smaller tags showing unresolved @mentions that clear when the mentioned person responds

Plus an internal **Handoff Timeline** inside each card that records every responsibility change for auditing.

---

## Current State Analysis

### What Exists
- `development_card_tasks` table tracks sample/commercial requests with `assigned_to_users` and `assigned_to_role`
- `development_items` has `pending_action_type`, `assigned_to_users`, and `assigned_to_role` columns
- `notifications` table handles @mention notifications but doesn't track "unresolved mentions"
- `development_card_activity` logs events but no dedicated "handoff" event type
- `DevelopmentCard` shows "Your Turn" badge based on assignment, but no explicit team responsibility tag
- Task workflow exists but responsibility changes aren't visible at-a-glance on cards

### Gaps
- No `workflow_status` field to track the current state in the ping-pong lifecycle
- No `current_assignee` at task level distinct from card assignment
- Unresolved mentions aren't tracked (mentions clear notifications when read, not when replied to)
- No visible "Action: Trader" or "Action: Buyer" tag on cards
- No dedicated Handoff Timeline component showing responsibility transfers

---

## Database Schema Changes

### 1. Add `workflow_status` and `current_assignee_role` to `development_items`

```sql
ALTER TABLE public.development_items
  ADD COLUMN workflow_status TEXT DEFAULT NULL,
  ADD COLUMN current_assignee_role TEXT DEFAULT NULL;
```

`workflow_status` values:
- `sample_requested` - Buyer requested sample → Trader's turn
- `sample_tracking_added` - Trader added tracking → Buyer's turn (to mark arrived)
- `sample_arrived` - Sample arrived → Buyer's turn (to review)
- `sample_reviewed` - Sample approved/rejected → Complete (or back to Trader if rejected)
- `commercial_requested` - Buyer requested data → Trader's turn
- `commercial_filled` - Trader filled data → Buyer's turn (to approve)
- `commercial_reviewed` - Data approved/rejected → Complete (or back to Trader)
- `null` - No active workflow

`current_assignee_role`: 'buyer' | 'trader' | 'quality' | null

### 2. Create `card_unresolved_mentions` table

Track @mentions that haven't been "resolved" by a reply from the mentioned user:

```sql
CREATE TABLE public.card_unresolved_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES public.development_items(id) ON DELETE CASCADE NOT NULL,
  mentioned_user_id UUID NOT NULL,
  mentioned_by_user_id UUID NOT NULL,
  activity_id UUID REFERENCES public.development_card_activity(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  resolved_at TIMESTAMPTZ DEFAULT NULL,
  resolved_by_activity_id UUID DEFAULT NULL,
  UNIQUE(card_id, mentioned_user_id, activity_id)
);

-- Indexes for performance
CREATE INDEX idx_unresolved_mentions_card ON public.card_unresolved_mentions(card_id);
CREATE INDEX idx_unresolved_mentions_user ON public.card_unresolved_mentions(mentioned_user_id);

-- RLS
ALTER TABLE public.card_unresolved_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view mentions"
  ON public.card_unresolved_mentions FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage mentions"
  ON public.card_unresolved_mentions FOR ALL
  USING (auth.uid() IS NOT NULL);
```

### 3. Add `handoff` activity type tracking

No schema change needed - we'll use existing `development_card_activity` with:
- `activity_type: 'handoff'`
- `metadata: { from_role: 'buyer', to_role: 'trader', reason: 'sample_requested', task_id: '...' }`

---

## UI Changes

### 1. Card Responsibility Tag (High Visibility)

On `DevelopmentCard.tsx`, add a prominent badge showing current responsibility:

```
+------------------------------------------+
| [PRODUCT]  [🔴 Action: Trader]           | ← New prominent tag
| Card Title Here                          |
| Supplier Name                            |
+------------------------------------------+
```

**Design Specs:**
- **Buyer's Turn**: Amber/Yellow background: `bg-amber-500 text-white`
- **Trader's Turn**: Red/Orange background: `bg-red-500 text-white`
- **No Action**: No tag shown
- Icon: Lightning bolt or arrow icon
- Text: "Action: Buyer Team" or "Action: Trader"

### 2. Mention Tags (Lower Visibility)

Show unresolved mentions as smaller tags:

```
+------------------------------------------+
| [PRODUCT]  [🔴 Action: Trader]           |
|            [@Carl] [@Maria]              | ← Mention tags
| Card Title Here                          |
+------------------------------------------+
```

**Design Specs:**
- Blue/Gray background: `bg-blue-100 text-blue-700`
- Compact: Show first name only
- Multiple mentions stack horizontally
- Tag disappears when that person sends a message

### 3. Handoff Timeline Component (Inside Card)

New collapsible section in the card detail drawer showing responsibility history:

```
+------------------------------------------+
| 🔄 Responsibility History        [v]     |
+------------------------------------------+
| Feb 3, 10:30 - Carl → Trader Team        |
|   "Requested sample for Product X"       |
| Feb 3, 14:15 - Trader → Carl             |
|   "Added tracking: DHL 1234567890"       |
| Feb 4, 09:00 - Carl → Trader Team        |
|   "Rejected sample - needs new one"      |
+------------------------------------------+
```

---

## Technical Implementation

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/development/ResponsibilityBadge.tsx` | Card-level "Action: [Team]" tag |
| `src/components/development/MentionTags.tsx` | Unresolved @mention tags |
| `src/components/development/HandoffTimeline.tsx` | Responsibility history inside card |
| `src/hooks/useCardMentions.ts` | Fetch/manage unresolved mentions |
| `src/hooks/useCardWorkflow.ts` | Track workflow status and auto-updates |

### Files to Modify

| File | Changes |
|------|---------|
| `DevelopmentCard.tsx` | Add ResponsibilityBadge and MentionTags |
| `Development.tsx` | Fetch workflow_status and mentions in query |
| `useCardTasks.ts` | Update workflow_status on task state changes |
| `ChatMessageInput.tsx` | Create unresolved mentions on @mention, resolve on reply |
| `ItemDetailDrawer.tsx` | Add HandoffTimeline section |
| `PendingTasksBanner.tsx` | Show current assignee in task cards |
| `TaskCard.tsx` | Show "Assigned to: [Team]" more prominently |

---

## Workflow Logic (Ping-Pong)

### Sample Request Flow

```text
1. Buyer requests sample
   → workflow_status = 'sample_requested'
   → current_assignee_role = 'trader'
   → Log handoff: "Buyer → Trader: Sample requested"

2. Trader adds tracking
   → workflow_status = 'sample_tracking_added'
   → current_assignee_role = 'buyer'
   → Log handoff: "Trader → Buyer: Tracking added"

3. Buyer marks arrived
   → workflow_status = 'sample_arrived'
   → current_assignee_role = 'buyer' (still, for review)

4a. Buyer approves
   → workflow_status = null (complete)
   → current_assignee_role = null
   → Log handoff: "Sample approved - workflow complete"

4b. Buyer rejects (needs resend)
   → workflow_status = 'sample_requested' (restart)
   → current_assignee_role = 'trader'
   → Log handoff: "Buyer → Trader: Sample rejected, needs resend"
```

### Commercial Data Flow

```text
1. Buyer requests commercial data
   → workflow_status = 'commercial_requested'
   → current_assignee_role = 'trader'

2. Trader fills data
   → workflow_status = 'commercial_filled'
   → current_assignee_role = 'buyer'

3a. Buyer approves
   → workflow_status = null
   → current_assignee_role = null

3b. Buyer rejects (needs revision)
   → workflow_status = 'commercial_requested'
   → current_assignee_role = 'trader'
```

---

## Mention Resolution Logic

### When a message is sent with @mentions:
1. Parse mentions from text
2. For each mentioned user (excluding self):
   - Insert into `card_unresolved_mentions` table
   - Create notification (existing behavior)

### When the mentioned user sends any message in the card:
1. Query `card_unresolved_mentions` for this card where `mentioned_user_id = current_user`
2. Set `resolved_at = now()` and `resolved_by_activity_id = new_message_id`
3. Mention tag disappears from card

---

## Real-Time Updates

Subscribe to:
- `development_items` changes for `workflow_status` / `current_assignee_role`
- `card_unresolved_mentions` for mention resolution
- `development_card_activity` for new handoff events

Already in place for tasks - extend to new fields.

---

## Card List Query Updates

Extend the `Development.tsx` query to fetch:

```typescript
// Add to the main query
workflow_status,
current_assignee_role,

// Fetch unresolved mention counts
const mentionsRes = await supabase
  .from('card_unresolved_mentions')
  .select('card_id, mentioned_user_id')
  .in('card_id', itemIds)
  .is('resolved_at', null);

// Map to get mention user names for display
const mentionCountMap = mentionsRes.data.reduce((acc, m) => {
  if (!acc[m.card_id]) acc[m.card_id] = [];
  acc[m.card_id].push(m.mentioned_user_id);
  return acc;
}, {});
```

---

## Edge Cases

1. **Multiple active tasks**: Show the most urgent responsibility (sample > commercial)
2. **Card with no tasks**: No responsibility tag shown
3. **Self-mentions**: Don't track as unresolved
4. **User leaves organization**: Mentions remain but show "Unknown" if profile deleted
5. **Task cancelled**: Clear workflow_status when task is cancelled
6. **Multiple mentions of same user**: Only one unresolved entry per user per activity

---

## Migration Strategy

1. Deploy database changes (new columns and table)
2. Backfill `workflow_status` based on existing pending tasks
3. Deploy UI changes (tags will appear based on new data)
4. Existing cards without workflow_status show no tag (correct behavior)
5. New actions auto-populate workflow_status going forward

---

## Summary of Visible Changes

| Location | What Changes |
|----------|--------------|
| Card in list | New "Action: [Team]" badge + mention tags |
| Card detail | New "Responsibility History" accordion section |
| Task cards | More prominent assignee display |
| Chat | Mentions create unresolved entries; replies resolve them |
