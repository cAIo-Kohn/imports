

## Plan: Fix Duplicate Activities & Batch Commercial Data Updates

### Problem Summary

Two issues identified from the screenshots:

1. **Duplicate "created" activities** - Card creation shows twice because:
   - `CreateCardModal.tsx` inserts a real "created" activity to the database
   - `HistoryTimeline.tsx` also adds a synthetic "created" activity based on `cardCreatedAt`

2. **Multiple commercial data activities** - Each field update (FOB price, MOQ, qty per container, container type) creates a separate activity entry because they save on blur individually

Additionally, the user wants:
- Commercial Data section to show a yellow/orange blinking indicator when pending
- All 4 commercial fields must be filled together and submitted with a single "Save & Move Card" action

---

### Solution Overview

| Issue | Fix |
|-------|-----|
| Duplicate "created" | Remove the synthetic activity from `HistoryTimeline.tsx` since the DB already has the real one |
| Multiple commercial updates | Replace individual onBlur saves with a batch "Save Commercial Data" button that logs one activity |
| Pending indicator | Add visual styling (blinking amber/orange border) when commercial data is incomplete |

---

### Technical Changes

#### 1. Remove Synthetic "created" Activity

**File:** `HistoryTimeline.tsx`

Remove the code that adds a synthetic "created" activity:

```typescript
// BEFORE: Adding synthetic activity
const allActivities: Activity[] = [
  ...activities,
  {
    id: 'card-creation',
    card_id: cardId,
    activity_type: 'created',
    created_at: cardCreatedAt,
    ...
  },
];

// AFTER: Just use activities from database
const allActivities: Activity[] = activities;
```

Also remove the `cardCreatedAt` and `creatorName` props since they're no longer needed for the synthetic activity.

---

#### 2. Redesign Commercial Data Section

**File:** `ActionsPanel.tsx`

Replace individual onBlur saves with a batch submission:

**Current Flow:**
```text
User types in FOB price → onBlur → saves → logs activity
User types in MOQ → onBlur → saves → logs activity  
User types in Qty/Container → onBlur → saves → logs activity
User changes Container Type → onChange → saves → logs activity
```

**New Flow:**
```text
User fills all 4 fields → clicks "Save & Move Card" → batch save → logs 1 activity → moves card
```

**Key Changes:**

1. **Remove onBlur handlers** from individual inputs
2. **Add validation** to ensure all 4 fields are filled before saving
3. **Single save mutation** that:
   - Updates all 4 fields at once
   - Logs one `commercial_update` activity with all values in metadata
   - Automatically moves card to other team
4. **Visual indicator** - blinking amber border when commercial data is incomplete

```typescript
// New save function
const handleSaveCommercialData = async () => {
  // Validate all fields are filled
  if (!localFobPrice || !localMoq || !localQtyPerContainer || !localContainerType) {
    toast({ title: 'All commercial data fields are required', variant: 'destructive' });
    return;
  }

  // Batch update all fields
  await supabase.from('development_items')
    .update({
      fob_price_usd: parseFloat(localFobPrice),
      moq: parseInt(localMoq),
      qty_per_container: parseInt(localQtyPerContainer),
      container_type: localContainerType,
    })
    .eq('id', cardId);

  // Log single activity with all values
  await supabase.from('development_card_activity').insert({
    card_id: cardId,
    user_id: user.id,
    activity_type: 'commercial_update',
    content: 'Updated commercial data',
    metadata: {
      fob_price_usd: parseFloat(localFobPrice),
      moq: parseInt(localMoq),
      qty_per_container: parseInt(localQtyPerContainer),
      container_type: localContainerType,
    },
  });

  // Move card to other team
  const targetOwner = currentOwner === 'arc' ? 'mor' : 'arc';
  await supabase.from('development_items')
    .update({ current_owner: targetOwner, is_new_for_other_team: true })
    .eq('id', cardId);

  // Log ownership change
  await supabase.from('development_card_activity').insert({
    card_id: cardId,
    user_id: user.id,
    activity_type: 'ownership_change',
    content: `Card moved to ${targetOwner === 'mor' ? 'MOR (Brazil)' : 'ARC (China)'}`,
  });
};
```

---

#### 3. Pending Indicator Styling

Add visual indicator when commercial data is incomplete:

```typescript
const isCommercialComplete = fobPriceUsd && moq && qtyPerContainer && containerType;
const isCommercialPending = !isCommercialComplete && cardType !== 'task';

// In the AccordionItem:
<AccordionItem 
  value="commercial" 
  className={cn(
    "border rounded-lg px-3 mt-2",
    isCommercialPending && "border-amber-400 animate-pulse bg-amber-50/50 dark:bg-amber-950/20"
  )}
>
```

---

#### 4. Update CompactActivityRow for Batch Commercial Update

**File:** `HistoryTimeline.tsx`

Update the inline content display to show all fields when metadata contains multiple values:

```typescript
if (activity.activity_type === 'commercial_update' && activity.metadata) {
  // Check if batch update (has multiple fields)
  if (activity.metadata.fob_price_usd) {
    inlineContent = `FOB $${activity.metadata.fob_price_usd}, MOQ ${activity.metadata.moq}, ${activity.metadata.qty_per_container}/${activity.metadata.container_type}`;
  } else {
    // Legacy single field update
    const field = activity.metadata.field?.replace(/_/g, ' ');
    inlineContent = `${field}: ${activity.metadata.value}`;
  }
}
```

---

### UI Layout for Commercial Data Section

```text
┌─────────────────────────────────────────────────────────────────┐
│ 💲 Commercial Data           [Pending indicator if incomplete] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  FOB Price (USD)  [$______]     MOQ            [________]      │
│                                                                 │
│  Qty / Container  [________]     Container Type [▼ Select ]    │
│                                                                 │
│                    [ Save & Move Card to Brazil → ]            │
│                                                                 │
│  ⚠️ All fields required to submit                              │
└─────────────────────────────────────────────────────────────────┘
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `HistoryTimeline.tsx` | Remove synthetic "created" activity, update compact row for batch commercial updates |
| `ActionsPanel.tsx` | Replace individual field saves with batch save + move, add pending indicator |
| `ItemDetailDrawer.tsx` | Remove `cardCreatedAt` and `creatorName` props if no longer needed |

---

### Edge Cases

- **Existing cards with incomplete data**: They can still be edited, just can't submit until all 4 fields are filled
- **Legacy individual activities**: The timeline will still display old single-field updates correctly
- **Card already on Brazil side**: Button text changes to "Save & Move Card to China"

