

# Fix Mention Tags Real-time Updates and Team Mentions

## Problems Identified

1. **No real-time subscription for mentions** - The `Development.tsx` page only listens for `development_items` changes, not `card_unresolved_mentions` changes
2. **Missing cache invalidation** - When mentions are created/resolved, the card list doesn't refresh automatically

---

## Solution

### 1. Add Real-time Subscription for Mentions in Development.tsx

Add a second channel subscription to listen for `card_unresolved_mentions` changes and invalidate the `development-items` query:

```typescript
// Real-time subscription for mentions (alongside existing development_items subscription)
useEffect(() => {
  const channel = supabase
    .channel('mentions-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'card_unresolved_mentions',
      },
      () => {
        // Debounce and refetch development items to update mention tags
        if (invalidateTimeoutRef.current) {
          clearTimeout(invalidateTimeoutRef.current);
        }
        invalidateTimeoutRef.current = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['development-items'] });
        }, 300);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [queryClient]);
```

### 2. Consolidate Subscriptions

Combine both subscriptions into a single channel for efficiency:

```typescript
const channel = supabase
  .channel('development-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'development_items' }, handleInvalidate)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'card_unresolved_mentions' }, handleInvalidate)
  .subscribe();
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Development.tsx` | Add realtime subscription for `card_unresolved_mentions` table |

---

## Expected Result

- When a user sends a message with `@Quality Team`, all Quality team members get individual mention tags
- The mention tags appear on the card UI immediately (realtime update)
- When any team member replies, their individual tag disappears (also realtime)
- No page refresh required

