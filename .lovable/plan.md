

## Plan: Fix Pending Action Indicator + Add Snooze Shortcut

### Problem 1: Cards with pending actions not blinking

The issue is that when actions like questions are asked, the system logs the activity but does **not** update the `pending_action_type` field on the card. This means the card has unresolved questions but the indicator never appears.

**Solution**: Set `pending_action_type` when relevant actions occur:
- When a **question is asked** → Set `pending_action_type = 'question'`
- When a **question is resolved/answered** → Clear `pending_action_type`

### Problem 2: No quick snooze shortcut

Currently, the Snooze button is only visible after opening the inline reply box. Users want a quick "Snooze" shortcut similar to the "Reply" button directly on question activities.

**Solution**: Add a "Snooze" button next to "Reply" and "Mark as Resolved" on unresolved question activities.

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/development/HistoryTimeline.tsx` | Set `pending_action_type` when posting a question; Add Snooze button shortcut to question activities |
| `src/components/development/ActionsPanel.tsx` | Set `pending_action_type` when posting a question from the accordion |

---

### Part 1: Set pending_action_type when questions are asked

When a question is posted, update the card to set:
```typescript
pending_action_type: 'question',
pending_action_due_at: null,
pending_action_snoozed_until: null,
```

When a question is resolved or answered, clear the pending action (if no other pending actions exist):
```typescript
pending_action_type: null,
pending_action_due_at: null,
pending_action_snoozed_until: null,
```

This needs to be done in:
1. **`ActionsPanel.tsx`** - when posting a question via the messaging section
2. **`HistoryTimeline.tsx`** - when resolving a question

---

### Part 2: Add Snooze shortcut button on questions

Add a Snooze button directly on question activities, similar to the Reply button:

```
┌──────────────────────────────────────────────────────────────┐
│  👤 User asked a question                        10:30       │
│                                                               │
│  "What do you think about this?"                             │
│                                                               │
│  [Reply] [Mark as Resolved] [⏰ Snooze ▼]  ← NEW             │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

The Snooze button will use the existing `SnoozeButton` component with the popover.

---

### Implementation Details

**HistoryTimeline.tsx changes:**

1. **Add Snooze button to question activities** (around line 947-968):
```typescript
import { SnoozeButton } from './SnoozeButton';

// In the question action buttons section:
{isQuestion && !isResolved && (
  <div className="flex gap-2 mt-2 flex-wrap">
    <Button variant="ghost" ... onClick={() => setReplyingToId(activity.id)}>
      Reply
    </Button>
    <Button variant="ghost" ... onClick={() => resolveQuestionMutation.mutate(activity.id)}>
      Mark as Resolved
    </Button>
    {/* NEW: Snooze shortcut */}
    <SnoozeButton
      cardId={cardId}
      currentActionType="question"
      variant="ghost"
      size="sm"
      className="h-7 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-100"
    />
  </div>
)}
```

2. **Update resolveQuestionMutation** to clear pending_action_type:
```typescript
// After marking question as resolved, clear pending action
await (supabase.from('development_items') as any)
  .update({
    pending_action_type: null,
    pending_action_due_at: null,
    pending_action_snoozed_until: null,
    pending_action_snoozed_by: null,
  })
  .eq('id', cardId);
```

**ActionsPanel.tsx changes:**

When posting a question, set the pending_action_type:
```typescript
// After inserting question activity, update the card:
await (supabase.from('development_items') as any)
  .update({
    pending_action_type: 'question',
    pending_action_due_at: null,
    pending_action_snoozed_until: null,
    pending_action_snoozed_by: null,
  })
  .eq('id', cardId);
```

---

### Summary

This implementation:

1. **Fixes the blinking indicator** by setting `pending_action_type = 'question'` when questions are asked
2. **Adds quick Snooze shortcut** directly on question activities (same row as Reply/Resolve)
3. **Clears pending action** when questions are resolved
4. **Maintains timeline history** - all snooze/resume actions are already logged to the activity timeline

