

## Plan: Fix Pending Action Indicator Not Showing

### Problem Identified

The `pending_action_type` field is **NULL** for all cards, even those with unresolved questions:

| Card | Has Unresolved Question? | `pending_action_type` |
|------|--------------------------|----------------------|
| PE Strap | Yes ("What is the best price?") | NULL |
| Yuanda Quotation | Yes ("what do you think?") | NULL |  
| Test | Yes ("he") | NULL |

The indicator only shows when `pending_action_type` is set, but existing questions were posted before the code was added to set this field.

---

### Solution: Compute Pending Action Dynamically

Rather than relying solely on the database field (which requires perfect synchronization), we should **compute the pending action state** when fetching cards. This is more robust and handles edge cases automatically.

---

### Implementation

#### Step 1: Query unresolved questions per card

In `Development.tsx`, fetch unresolved questions along with other card data:

```typescript
// Fetch unresolved questions per card
const unresolvedQuestionsRes = await supabase
  .from('development_card_activity')
  .select('card_id')
  .eq('activity_type', 'question')
  .or('metadata->resolved.is.null,metadata->>resolved.eq.false')
  .in('card_id', itemIds);

const cardsWithUnresolvedQuestions = new Set(
  (unresolvedQuestionsRes.data || []).map(q => q.card_id)
);
```

#### Step 2: Compute effective pending action type

When mapping items, compute the effective pending action:

```typescript
return data.map(item => {
  // Compute effective pending action type
  let effectivePendingActionType = item.pending_action_type;
  
  // If no pending_action_type set but has unresolved question, set it
  if (!effectivePendingActionType && cardsWithUnresolvedQuestions.has(item.id)) {
    effectivePendingActionType = 'question';
  }
  
  return {
    ...item,
    pending_action_type: effectivePendingActionType,
    // ... other fields
  };
});
```

#### Step 3: Also sync the database (backfill)

Add a one-time database update to fix existing cards:

```sql
-- Update cards with unresolved questions to have pending_action_type = 'question'
UPDATE development_items di
SET pending_action_type = 'question'
WHERE di.pending_action_type IS NULL
  AND EXISTS (
    SELECT 1 FROM development_card_activity dca
    WHERE dca.card_id = di.id
      AND dca.activity_type = 'question'
      AND (dca.metadata->>'resolved' IS NULL OR dca.metadata->>'resolved' = 'false')
  );
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Development.tsx` | Add query for unresolved questions; compute effective `pending_action_type` |
| **Database Migration** | Backfill `pending_action_type` for existing cards with unresolved questions |

---

### Why This Approach

1. **Immediate fix**: Cards will show indicators right away based on computed state
2. **Robust**: Even if database field gets out of sync, the computed value catches it
3. **Backfill**: Migration ensures database stays accurate for future queries
4. **Performance**: Single additional query batched with existing queries

---

### Code Changes

**Development.tsx** - Add to the parallel queries section:

```typescript
// Add this to the Promise.all() around line 144
const unresolvedQuestionsRes = await supabase
  .from('development_card_activity')
  .select('card_id, metadata')
  .eq('activity_type', 'question')
  .in('card_id', itemIds);

// Process to find cards with unresolved questions
const cardsWithUnresolvedQuestions = new Set<string>();
for (const q of unresolvedQuestionsRes.data || []) {
  const metadata = q.metadata as { resolved?: boolean } | null;
  if (!metadata?.resolved) {
    cardsWithUnresolvedQuestions.add(q.card_id);
  }
}
```

**Then in the map function:**

```typescript
return data.map(item => {
  // Compute effective pending action type
  let effectivePendingActionType = item.pending_action_type;
  
  // If no pending_action_type but has unresolved question, compute it
  if (!effectivePendingActionType && cardsWithUnresolvedQuestions.has(item.id)) {
    effectivePendingActionType = 'question';
  }
  
  return {
    ...item,
    pending_action_type: effectivePendingActionType,
    // ... rest of fields
  };
});
```

---

### Database Migration SQL

```sql
-- Backfill pending_action_type for cards with unresolved questions
UPDATE development_items 
SET pending_action_type = 'question'
WHERE pending_action_type IS NULL
  AND id IN (
    SELECT DISTINCT card_id 
    FROM development_card_activity 
    WHERE activity_type = 'question'
      AND (metadata->>'resolved' IS NULL OR metadata->>'resolved' = 'false')
  );
```

---

### Summary

This fix:
1. **Computes pending action dynamically** when fetching cards (catches all cases)
2. **Backfills database** to fix existing cards
3. **Works immediately** without requiring users to re-post questions
4. **Shows blinking indicator** for urgent actions and static indicator for snoozed ones

