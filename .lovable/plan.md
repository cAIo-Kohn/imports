

## Plan: Fix Orange/Yellow Unseen Activity Indicator Not Disappearing

### Problem Identified

When the user opens a card drawer to view it:
1. The `last_viewed_at` timestamp is correctly updated in the database
2. The `queryClient.invalidateQueries()` is called
3. **BUT** the card list doesn't immediately refetch, so the orange dot persists

The database shows correct data (`should_hide_dot: true`), confirming the issue is purely a **UI refresh timing problem**.

---

### Root Cause

The current invalidation uses:
```typescript
queryClient.invalidateQueries({ queryKey: ['development-items'] });
```

This marks the query as stale but doesn't guarantee an immediate refetch. The UI may show stale data until React Query decides to refetch (which might not happen until the drawer closes or on the next interaction).

---

### Solution

Add `refetchType: 'active'` to force immediate refetch of mounted queries AND ensure the invalidation happens after the database update completes:

```typescript
await supabase
  .from('card_user_views')
  .upsert({...});

// Force immediate refetch of active queries
queryClient.invalidateQueries({ 
  queryKey: ['development-items'],
  refetchType: 'active'
});
```

Additionally, we should also consider calling `refetchQueries` directly to ensure the data is updated before the drawer fully mounts.

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/development/ItemDetailDrawer.tsx` | Update `invalidateQueries` to use `refetchType: 'active'` to force immediate refetch |

---

### Code Changes

**ItemDetailDrawer.tsx** - Update the `useEffect` that marks cards as viewed (lines 76-109):

```typescript
// Mark as seen when opened by the other team AND update last viewed timestamp
useEffect(() => {
  const markAsSeenAndUpdateView = async () => {
    if (!item?.id || !open || !user?.id) return;
    
    const itemWithNewFields = item as any;
    const isNewForMe = itemWithNewFields.is_new_for_other_team && (
      (isBuyer && itemWithNewFields.created_by_role === 'trader') ||
      (isTrader && itemWithNewFields.created_by_role === 'buyer')
    );

    // Update is_new_for_other_team if applicable
    if (isNewForMe) {
      await (supabase.from('development_items') as any)
        .update({ is_new_for_other_team: false })
        .eq('id', item.id);
    }

    // Always update last viewed timestamp for current user
    const { error } = await supabase
      .from('card_user_views')
      .upsert({
        card_id: item.id,
        user_id: user.id,
        last_viewed_at: new Date().toISOString(),
      }, {
        onConflict: 'card_id,user_id',
      });

    if (!error) {
      // Force immediate refetch of active queries to update the card list
      queryClient.invalidateQueries({ 
        queryKey: ['development-items'],
        refetchType: 'active'
      });
    }
  };

  markAsSeenAndUpdateView();
}, [item?.id, open, user?.id, isBuyer, isTrader, queryClient]);
```

---

### Why This Works

1. **`refetchType: 'active'`** ensures only currently mounted queries refetch (more efficient)
2. **Awaiting the database update** ensures the `last_viewed_at` is committed before refetch
3. **Error check** prevents unnecessary refetches if the upsert fails

---

### Summary

This fix ensures the orange/yellow "unseen activity" dot disappears immediately when a user opens a card drawer, by forcing an immediate refetch of the development items query after the `last_viewed_at` timestamp is updated in the database.

