# Automate Card Status Based on Actions

**Status: ✅ IMPLEMENTED**

## Implementation Summary

Card status is now automatically derived from `pending_action_type`, `pending_action_snoozed_until`, and `is_solved` fields. The status is computed on read (frontend) to allow quick iteration on the rules.

### Derivation Logic

```text
┌──────────────────────────────────────────────────────────────────────┐
│                     AUTO-STATUS DERIVATION LOGIC                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  is_solved = true                    →  SOLVED                       │
│                                                                      │
│  pending_action_snoozed_until > now  →  WAITING (snoozed)            │
│                                                                      │
│  pending_action_type = "sample_in_transit"                           │
│  pending_action_type = "sample_pending"   →  WAITING (for sample)    │
│                                                                      │
│  pending_action_type = "question"                                    │
│  pending_action_type = "answer_pending"   →  PENDING (action needed) │
│  pending_action_type = "sample_tracking"                             │
│  pending_action_type = "sample_review"                               │
│  pending_action_type = "commercial_review"                           │
│                                                                      │
│  No pending action + has activity   →  IN PROGRESS                   │
│                                                                      │
│  No pending action + no activity    →  PENDING (new card)            │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Status Meaning

| Status | Meaning | Auto-Triggered By |
|--------|---------|-------------------|
| **Pending** | Action required from someone | Unresolved questions, pending reviews, tracking to add |
| **In Progress** | Actively being worked on | Card has activity but no blocking pending action |
| **Waiting** | Blocked on external factor | Sample in transit, snoozed action, waiting for sample to arrive |
| **Solved** | Completed | User marks as solved (or sample approved + commercial complete) |

### Files Modified

| File | Changes |
|------|---------|
| `src/pages/Development.tsx` | Added `deriveCardStatus` function, compute `derived_status` in query |
| `src/components/development/ItemDetailDrawer.tsx` | Uses `derived_status` for display |

### Key Features

1. **No database migration** - Pure frontend logic
2. **Automatic status** - Reflects the card's true state based on actions
3. **Manual override preserved** - Users can still change status manually in drawer
4. **Backwards compatible** - Works with existing data

