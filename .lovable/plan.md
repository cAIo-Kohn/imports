

## Plan: Pending Action Indicator with Snooze/Delay Timers

### Overview

This plan implements a smarter "pending action" system that differentiates between:
1. **Unseen activity** (amber dot - already exists): "Something new happened"
2. **Pending action** (blinking indicator - NEW): "You need to do something"

The pending action indicator will:
- Blink when there's an actionable item requiring attention
- Pause blinking when a delay/snooze timer is active OR when waiting for a sample ETA
- Resume blinking once the timer expires
- Track all delays in the timeline history

---

### Part 1: What Triggers a "Pending Action"?

A card has a pending action when one of these conditions is met:

| Trigger | Who sees it? | Resolves when... |
|---------|--------------|------------------|
| **Unresolved question** | Card owner (MOR/ARC team) | Question is marked resolved or answered |
| **Commercial data sent** | MOR team (waiting for sample request) | Sample is requested or comment added |
| **Sample requested** | ARC team | Tracking is added |
| **Sample in transit** | MOR team | ETA reached OR marked as arrived |
| **Sample delivered** | MOR team | Sample approved/rejected |

**Comments do NOT create pending actions** - they only trigger the existing "unseen activity" amber dot.

---

### Part 2: Database Changes

**Add columns to `development_items` table:**

```sql
ALTER TABLE public.development_items
ADD COLUMN pending_action_type text DEFAULT NULL,
ADD COLUMN pending_action_due_at timestamptz DEFAULT NULL,
ADD COLUMN pending_action_snoozed_until timestamptz DEFAULT NULL,
ADD COLUMN pending_action_snoozed_by uuid DEFAULT NULL,
ADD COLUMN pending_action_snoozed_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN development_items.pending_action_type IS 'Type: question, commercial_review, sample_tracking, sample_review, etc.';
COMMENT ON COLUMN development_items.pending_action_due_at IS 'When action becomes urgent (sample ETA, etc.)';
COMMENT ON COLUMN development_items.pending_action_snoozed_until IS 'Delay timer - dont blink until this time';
```

---

### Part 3: Logic Flow

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    PENDING ACTION INDICATOR LOGIC                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. COMPUTE hasPendingAction:                                           │
│     - Check for unresolved questions directed at current owner          │
│     - Check for sample_requested (needs tracking from ARC)              │
│     - Check for sample_in_transit (needs arrival from MOR)              │
│     - Check for sample_delivered (needs review from MOR)                │
│     - Check for commercial_update trigger                               │
│                                                                         │
│  2. COMPUTE isActionUrgent:                                             │
│     - If snoozed_until is set AND now() < snoozed_until → NOT urgent    │
│     - If pending_action_due_at is set AND now() < due_at → NOT urgent   │
│     - Otherwise → IS urgent (blink!)                                    │
│                                                                         │
│  3. DISPLAY:                                                            │
│     - hasPendingAction + isActionUrgent = Show BLINKING indicator       │
│     - hasPendingAction + NOT urgent = Show STATIC indicator + due date  │
│     - No pending action = Show nothing (or just unseen dot if new)      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Part 4: Visual Design

#### On Card (in list)

```text
┌────────────────────────────────────────────────────┐
│  Caio                                    🔴← blink │
├────────────────────────────────────────────────────┤
│  [Item] [Raw Material] [medium]                    │
│  PE Strap                                          │
│                                                    │
│  📦 1 sample  📅 15/02  ⏰ Due Feb 20             │
│                      └── shows when action is     │
│                          snoozed or waiting       │
└────────────────────────────────────────────────────┘
```

**Indicator States:**
- **🔴 Blinking red/coral**: Urgent pending action NOW
- **🟡 Static yellow**: Pending action, but waiting (snoozed/ETA not reached)
- **🟠 Amber dot (existing)**: Just unseen activity, no action needed

#### Inside Card Details

Show a banner or badge with the pending action info:
```text
┌─────────────────────────────────────────────────────────────────┐
│  ⏰ Action Due: Feb 20, 2026                                    │
│  You snoozed this until then. Sample ETA is Feb 18.            │
│  [Resume Now] [Extend Snooze]                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Part 5: Snooze/Delay Feature

#### Where users can snooze:

1. **When replying to a question** - "Reply & Snooze for X days"
2. **When adding a comment** - "Comment & Snooze"  
3. **On any pending action banner** - "Snooze until..."

#### Snooze options:

```text
┌─────────────────────────────────────────┐
│  ⏰ Snooze this action:                 │
│  [1 day] [3 days] [1 week] [Custom]    │
└─────────────────────────────────────────┘
```

#### Log to timeline:

```text
  ⏰ Caio snoozed until Feb 25 — "Waiting for factory response"
```

---

### Part 6: Integration with Sample ETA

When a sample is shipped with an ETA:
1. Set `pending_action_due_at` = sample.estimated_arrival
2. Card shows "Due: Feb 20" on the card exterior
3. Indicator stays static (yellow) until ETA
4. After ETA passes, indicator starts blinking

---

### Part 7: Implementation Steps

#### Database Migration

```sql
-- Add pending action tracking columns
ALTER TABLE public.development_items
ADD COLUMN pending_action_type text DEFAULT NULL,
ADD COLUMN pending_action_due_at timestamptz DEFAULT NULL,
ADD COLUMN pending_action_snoozed_until timestamptz DEFAULT NULL,
ADD COLUMN pending_action_snoozed_by uuid DEFAULT NULL;
```

#### Files to Modify

| File | Changes |
|------|---------|
| **Database Migration** | Add pending action columns |
| `src/pages/Development.tsx` | Fetch pending action data, compute urgency |
| `src/components/development/DevelopmentCard.tsx` | Add blinking/static indicator, show due date |
| `src/components/development/HistoryTimeline.tsx` | Show snooze banner, add snooze option to replies |
| `src/components/development/InlineReplyBox.tsx` | Add "Reply & Snooze" option |
| `src/components/development/ActionsPanel.tsx` | Add snooze option to messaging |
| `src/components/development/InlineSampleShipForm.tsx` | Set `pending_action_due_at` from ETA |
| `src/components/development/SampleTrackingCard.tsx` | Update pending action on arrival/review |
| **NEW** `src/components/development/SnoozeButton.tsx` | Reusable snooze button/modal |
| **NEW** `src/components/development/PendingActionBadge.tsx` | Show action due info |

#### Update DevelopmentItem Interface

```typescript
export interface DevelopmentItem {
  // ... existing fields
  pending_action_type?: string | null;
  pending_action_due_at?: string | null;
  pending_action_snoozed_until?: string | null;
  pending_action_snoozed_by?: string | null;
}
```

#### Logic in DevelopmentCard

```typescript
// Check if there's a pending action for this card
const hasPendingAction = useMemo(() => {
  // Check unresolved questions, sample states, etc.
  return item.pending_action_type !== null;
}, [item.pending_action_type]);

// Check if action is urgent (not snoozed, past due date)
const isActionUrgent = useMemo(() => {
  if (!hasPendingAction) return false;
  
  const now = new Date();
  const snoozedUntil = item.pending_action_snoozed_until 
    ? new Date(item.pending_action_snoozed_until) 
    : null;
  const dueAt = item.pending_action_due_at 
    ? new Date(item.pending_action_due_at) 
    : null;
  
  // If snoozed and snooze hasn't expired, not urgent
  if (snoozedUntil && now < snoozedUntil) return false;
  
  // If has due date and due date hasn't passed, not urgent
  if (dueAt && now < dueAt) return false;
  
  // Otherwise, urgent!
  return true;
}, [hasPendingAction, item.pending_action_snoozed_until, item.pending_action_due_at]);
```

---

### Part 8: Automatic Pending Action Updates

When certain activities happen, automatically set/clear pending actions:

| Event | Action on pending_action fields |
|-------|--------------------------------|
| Question asked | Set `pending_action_type = 'question'` |
| Question resolved/answered | Clear pending_action fields |
| Commercial data sent | Set `pending_action_type = 'commercial_review'` |
| Sample requested | Set `pending_action_type = 'sample_tracking'` |
| Sample shipped (with ETA) | Set `pending_action_type = 'sample_in_transit'`, `due_at = ETA` |
| Sample arrived | Set `pending_action_type = 'sample_review'` |
| Sample approved/rejected | Clear pending_action fields |
| User snoozes | Set `snoozed_until`, `snoozed_by` |

---

### Part 9: Timeline Log for Snooze Actions

Activity type: `'action_snoozed'`

```typescript
await supabase.from('development_card_activity').insert({
  card_id: cardId,
  user_id: user.id,
  activity_type: 'action_snoozed',
  content: 'Waiting for factory response',
  metadata: { 
    snooze_until: '2026-02-25',
    original_action_type: 'question',
  },
});
```

---

### Summary

This implementation creates a smart notification system that:

1. **Distinguishes** between "something happened" (amber dot) and "you need to act" (blinking indicator)
2. **Respects timing** - won't blink while waiting for sample ETAs or user-set snooze timers
3. **Shows context** - displays due dates on cards so everyone knows when action is expected
4. **Tracks everything** - all snoozes and status changes logged to timeline
5. **Enables collaboration** - allows users to communicate "I'll handle this in 3 days"

