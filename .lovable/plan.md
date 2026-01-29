

## Plan: Fix Orange/Yellow Unseen Activity Indicator Persistence

### Root Cause

The current implementation has a cache key mismatch and timing issue:

1. **Query key uses `user?.id`** (nullable) in Development.tsx but the drawer uses `user.id` (non-null)
2. **`setQueryData` requires exact key match** - if keys don't match exactly, the cache isn't updated
3. **The refetch happens asynchronously**, but the UI might not re-render because React doesn't detect the change

### Solution

Two-pronged approach to ensure immediate UI update:

**1. Use `queryClient.setQueriesData` with partial key matching**

Instead of `setQueryData` with an exact key, use `setQueriesData` which matches queries by predicate. This ensures we find the correct cache entry regardless of how the key was constructed.

**2. Add `await queryClient.refetchQueries` for guaranteed fresh data**

After optimistic update, force an immediate refetch to ensure the data is fresh from the server.

---

### Technical Implementation

**File: `src/components/development/ItemDetailDrawer.tsx`**

Update the `useEffect` that marks cards as viewed:

```text
Current (lines 105-123):
----------------------------------------
if (!error) {
  // Optimistically mark as viewed in the cache so the dot clears immediately,
  // then force an immediate refetch for the *exact* query key.
  const optimisticSeenAt = new Date().toISOString();

  queryClient.setQueryData<DevelopmentItem[]>(
    ['development-items', user.id],
    (prev) => {
      if (!prev) return prev;
      return prev.map((it) =>
        it.id === item.id ? { ...it, last_viewed_at: optimisticSeenAt } : it
      );
    }
  );

  await queryClient.invalidateQueries({
    queryKey: ['development-items', user.id],
    refetchType: 'active',
  });
}
```

```text
Proposed:
----------------------------------------
if (!error) {
  // Optimistically mark as viewed in all matching caches
  const optimisticSeenAt = new Date().toISOString();

  // Use setQueriesData with a predicate to match any query starting with 'development-items'
  queryClient.setQueriesData<DevelopmentItem[]>(
    { queryKey: ['development-items'] },
    (prev) => {
      if (!prev) return prev;
      return prev.map((it) =>
        it.id === item.id ? { ...it, last_viewed_at: optimisticSeenAt } : it
      );
    }
  );

  // Force immediate refetch to get server-confirmed data
  await queryClient.refetchQueries({
    queryKey: ['development-items'],
    type: 'active',
  });
}
```

---

### Why This Works

| Problem | Solution |
|---------|----------|
| `setQueryData` requires exact key match | `setQueriesData` with partial key matches all `['development-items', ...]` queries |
| Async invalidation doesn't guarantee UI update | `refetchQueries` returns a promise that resolves when data is fresh |
| Stale closure might reference old data | Refetch ensures React Query updates all subscribers |

---

### Additional Safeguard (Optional)

If the issue persists, we can also add a small delay before closing the drawer, or ensure the parent component re-renders by updating a local state that triggers re-computation of `selectedItem`.

---

### Summary

This fix ensures the yellow "unseen activity" dot disappears immediately by:
1. **Using partial key matching** (`setQueriesData`) to update all matching caches
2. **Forcing immediate refetch** (`refetchQueries`) to guarantee fresh data
3. **Both operations complete before the useEffect exits**, ensuring the UI is updated

