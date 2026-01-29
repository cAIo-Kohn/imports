

## Automate Card Status Based on Actions

### Current State Analysis

The system currently has:

| Component | Current Behavior |
|-----------|-----------------|
| **Status field** | Manual selection: Pending, In Progress, Waiting, Solved |
| **pending_action_type** | Automatically set by actions (question, sample_in_transit, sample_review, etc.) |
| **pending_action_snoozed_until** | Set when user snoozes an action |
| **is_solved** | Boolean flag for completed cards |

The key insight: **pending_action_type already tracks what the card is waiting for!** We can derive the status automatically from this field instead of requiring manual updates.

### Proposed Status Automation Rules

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

### Status Meaning After Automation

| Status | Meaning | Auto-Triggered By |
|--------|---------|-------------------|
| **Pending** | Action required from someone | Unresolved questions, pending reviews, tracking to add |
| **In Progress** | Actively being worked on | Card has activity but no blocking pending action |
| **Waiting** | Blocked on external factor | Sample in transit, snoozed action, waiting for sample to arrive |
| **Solved** | Completed | User marks as solved (or sample approved + commercial complete) |

### Implementation Approach

There are two approaches to implement this:

#### Option A: Compute Status on Read (Frontend)

Transform the status in the Development.tsx query to derive it from `pending_action_type`, `snoozed_until`, and `is_solved`.

**Pros**: No database migration, immediate effect, easy to adjust rules
**Cons**: Status in DB becomes disconnected from display

#### Option B: Database Trigger (Backend)

Create a Postgres trigger that auto-updates the `status` field whenever `pending_action_type`, `pending_action_snoozed_until`, or `is_solved` changes.

**Pros**: Status is always correct in DB, consistent across all queries
**Cons**: Requires migration, harder to adjust rules

**Recommended: Option A (Frontend Computation)** - This is safer and allows quick iteration on the rules.

### Technical Implementation

#### 1. Create Status Derivation Function

Add a helper function that computes the display status:

```typescript
const deriveCardStatus = (item: DevelopmentItem): DevelopmentCardStatus => {
  // Solved takes priority
  if (item.is_solved) return 'solved';
  
  // Check if snoozed (waiting)
  if (item.pending_action_snoozed_until) {
    const snoozeDate = new Date(item.pending_action_snoozed_until);
    if (snoozeDate > new Date()) return 'waiting';
  }
  
  // Check pending action type
  const actionType = item.pending_action_type;
  
  // These mean "waiting for something external"
  if (actionType === 'sample_in_transit' || actionType === 'sample_pending') {
    return 'waiting';
  }
  
  // These mean "action needed" (pending)
  if (actionType === 'question' || 
      actionType === 'answer_pending' || 
      actionType === 'sample_tracking' || 
      actionType === 'sample_review' || 
      actionType === 'commercial_review') {
    return 'pending';
  }
  
  // No blocking action - check if card has any activity (in progress)
  if (item.latest_activity_at && item.latest_activity_at !== item.created_at) {
    return 'in_progress';
  }
  
  // Fresh card with no activity
  return 'pending';
};
```

#### 2. Update Development.tsx Query

Modify the items mapping to include derived status:

```typescript
return data.map(item => {
  // ... existing mapping ...
  
  const derivedStatus = deriveCardStatus({
    ...item,
    pending_action_type: effectivePendingActionType,
    is_solved: item.is_solved,
    pending_action_snoozed_until: item.pending_action_snoozed_until,
  });
  
  return {
    ...item,
    derived_status: derivedStatus, // New field for display
    pending_action_type: effectivePendingActionType,
  };
});
```

#### 3. Update Status Display

In ItemDetailDrawer.tsx and DevelopmentCard.tsx, use the derived status for display instead of the raw DB status:

```typescript
// Before
const status = mapOldToNewStatus(item.status);

// After  
const status = item.derived_status || mapOldToNewStatus(item.status);
```

#### 4. Make Manual Status Override Optional

Keep the status dropdown but show "Auto" as the default option. Users can still override if needed:

```typescript
<Select value={manualOverride ? item.status : 'auto'}>
  <SelectItem value="auto">Auto ({derivedStatus})</SelectItem>
  <SelectItem value="pending">Pending</SelectItem>
  <SelectItem value="in_progress">In Progress</SelectItem>
  <SelectItem value="waiting">Waiting</SelectItem>
  <SelectItem value="solved">Solved</SelectItem>
</Select>
```

### Visual Feedback

Add visual cues to show why a card has its current status:

| Status | Visual Indicator |
|--------|-----------------|
| **Pending** (question) | Purple dot + "Question pending" tooltip |
| **Pending** (sample_review) | Blue dot + "Review sample" tooltip |
| **Waiting** (snoozed) | Clock icon + snooze date |
| **Waiting** (sample_in_transit) | Truck icon + ETA date |
| **In Progress** | Green activity indicator |
| **Solved** | Checkmark |

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Development.tsx` | Add `deriveCardStatus` function, compute derived_status in query |
| `src/components/development/DevelopmentCard.tsx` | Use derived_status for display |
| `src/components/development/ItemDetailDrawer.tsx` | Show derived status in header, optional manual override |
| `src/components/development/PendingActionBadge.tsx` | No changes (already provides visual context) |

### Summary

This approach:
1. **Removes manual status updates** - Status automatically reflects the card's true state
2. **Leverages existing pending_action_type** - No new database fields needed
3. **Provides clear meaning** - Each status has a concrete trigger condition
4. **Keeps manual override** - Users can still set status manually when needed
5. **No database migration** - Pure frontend logic change

The end result: Cards will automatically show "Waiting" when a sample is in transit or snoozed, "Pending" when there's an action needed, and "In Progress" when actively being worked on without blocking issues.

