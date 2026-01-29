

## Plan: Real-time Card Updates Without Refresh

### Problem

Currently, when someone else updates a card (adds a comment, changes status, moves it between teams), you don't see the changes until you manually refresh the page.

### Solution

Add real-time synchronization so the card list automatically updates when changes occur. This uses the same technology already powering the timeline inside card drawers.

### How It Works

```text
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  User A     │       │   Server    │       │   User B    │
│  (Brazil)   │       │  (Database) │       │  (China)    │
└──────┬──────┘       └──────┬──────┘       └──────┬──────┘
       │                     │                     │
       │  Updates card       │                     │
       │ ──────────────────> │                     │
       │                     │                     │
       │                     │  Realtime push      │
       │                     │ ──────────────────> │
       │                     │                     │
       │                     │                     │ Card list
       │                     │                     │ auto-updates!
       │                     │                     │
```

### What Changes

1. **Database**: Enable real-time broadcasting for the development cards table
2. **Code**: Add a lightweight listener that triggers a background refresh when changes are detected

### Performance Guarantees

- **Zero cost**: Uses existing infrastructure (no additional API calls)
- **No delay**: Changes pushed instantly from server to all connected users  
- **Smooth**: Uses debounced updates (waits 300ms to batch rapid changes)
- **Battery-friendly**: Uses WebSocket connections, not polling

### Technical Implementation

**Step 1: Database Migration**

Enable realtime on the `development_items` table:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.development_items;
```

**Step 2: Add Realtime Subscription**

In `src/pages/Development.tsx`, add a subscription similar to the existing pattern in `HistoryTimeline.tsx`:

```tsx
// After the useQuery for items
const invalidateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

useEffect(() => {
  const channel = supabase
    .channel('development-items-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'development_items',
      },
      () => {
        // Debounce: wait 300ms before refetching
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
    if (invalidateTimeoutRef.current) {
      clearTimeout(invalidateTimeoutRef.current);
    }
    supabase.removeChannel(channel);
  };
}, [queryClient]);
```

### Files to Modify

| File | Change |
|------|--------|
| Database (migration) | Enable realtime for `development_items` table |
| `src/pages/Development.tsx` | Add realtime subscription with debounced refresh |

### What You'll Notice

After this change:
- When someone moves a card to your team, it appears immediately
- When someone changes a card's status, the badge updates automatically
- When new comments are added, the "new activity" indicator appears in real-time
- All without any manual refresh

### Summary

This adds seamless real-time synchronization to the development cards list using the same proven pattern already working inside card drawers. The implementation is lightweight, efficient, and completely transparent to users.

