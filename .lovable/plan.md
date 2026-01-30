

## Fix Sample Request Not Creating Database Record

The banner's "Request Sample" button is not creating a sample record in the `development_item_samples` table. It only logs an activity entry but skips the actual database insert, which is why samples don't appear in the Sample Tracker.

---

### Root Cause

The `useRequestSample` hook in `HistoryTimeline.tsx` (used by banners) is missing the database insert that exists in `AddSampleForm.tsx`:

```text
AddSampleForm (works correctly):
1. INSERT into development_item_samples ✓
2. INSERT activity log ✓
3. UPDATE card owner ✓

useRequestSample hook (broken):
1. INSERT into development_item_samples ✗ MISSING!
2. INSERT activity log ✓
3. UPDATE card owner ✓
```

---

### Fix Required

Add the missing database insert to `useRequestSample` in `HistoryTimeline.tsx`:

```typescript
// HistoryTimeline.tsx - useRequestSample hook
const handleRequestSample = async () => {
  if (!user?.id) return;
  setIsRequesting(true);
  
  try {
    const targetOwner = 'arc';
    
    // ADD THIS: Create sample record in database
    const { error: sampleError } = await supabase
      .from('development_item_samples')
      .insert({
        item_id: cardId,
        quantity: 1,
        status: 'pending',
        notes: null,
      });
    
    if (sampleError) throw sampleError;
    
    // Existing: Log activity
    const { error: activityError } = await supabase
      .from('development_card_activity')
      .insert({...});
    
    // Existing: Move card
    const { error: moveError } = await supabase
      .from('development_items')
      .update({...});
    
    // ADD THIS: Invalidate samples query
    queryClient.invalidateQueries({ queryKey: ['development-item-samples', cardId] });
    queryClient.invalidateQueries({ queryKey: ['all-samples'] }); // For Sample Tracker
    ...
  }
};
```

---

### Summary

| File | Change |
|------|--------|
| `src/components/development/HistoryTimeline.tsx` | Add `development_item_samples` insert to `useRequestSample` hook |

### Result

- Banner "Request Sample" button will create a proper sample record
- Sample will appear in the "Requested" column of the Sample Tracker
- Consistent behavior with the AddSampleForm component

