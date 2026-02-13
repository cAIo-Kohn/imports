

## Fix Card Disappearing During Interactions

### Root Cause Analysis

The card disappearing is caused by a combination of three issues:

1. **No data preservation during refetch**: The main development items query does NOT use `placeholderData: keepPreviousData`. This means when a refetch is triggered (after any action), React Query briefly returns an empty/loading state, causing all cards to flash or disappear momentarily.

2. **Double query invalidation**: When a user performs an action (e.g., updating workflow, adding a sample), the mutation's `onSuccess` calls `invalidateQueries`. Then the Supabase realtime subscription ALSO fires for the same change, triggering another invalidation 300ms later. This creates two back-to-back refetches.

3. **Heavy query with 10+ parallel sub-queries**: The main query fetches items plus sample counts, product counts, activity timestamps, user views, profiles, questions, answers, threads, all activities, and mentions. Each refetch is slow, amplifying the "empty state" window.

### Solution (single file: `src/pages/Development.tsx`)

**Change 1: Add `placeholderData: keepPreviousData` to the main query**
- Import `keepPreviousData` from `@tanstack/react-query`
- Add `placeholderData: keepPreviousData` to the `useQuery` options
- This ensures the UI keeps showing the previous data while a refetch is in progress, preventing the "disappearing cards" flash

**Change 2: Skip realtime invalidation for own mutations**
- Track when a local mutation is in progress using a ref (`isMutatingRef`)
- Set the ref to `true` before mutation, reset after `onSuccess`/`onSettled`
- In the realtime handler, skip invalidation if `isMutatingRef.current` is true (since the mutation's own `onSuccess` already handles it)
- This eliminates redundant double-refetches

**Change 3: Increase staleTime slightly**
- Change `staleTime` from 30s to 60s to reduce background refetches during active use

### Technical Details

```text
Before:
  User action -> Mutation -> onSuccess invalidates -> Refetch starts (UI clears)
                          -> Realtime fires -> Another invalidate -> Another refetch
  Total: 2 refetches, UI empty during both

After:
  User action -> Mutation -> onSuccess invalidates -> Refetch starts (UI keeps previous data)
                          -> Realtime fires -> Skipped (mutation in progress)
  Total: 1 refetch, UI always shows data
```

### Files Modified
- `src/pages/Development.tsx` (the only file that needs changes)

