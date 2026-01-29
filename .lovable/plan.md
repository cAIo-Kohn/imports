

## Performance & Smoothness Improvements for the Development Card System

After analyzing the codebase, I've identified several optimization opportunities that will make the card system faster and smoother without losing any functionality.

---

### Summary of Improvements

| Area | Current Issue | Improvement | Impact |
|------|---------------|-------------|--------|
| Query Caching | No staleTime configured | Add staleTime to avoid refetching on every focus | High |
| Data Fetching | 7 parallel queries per page load | Consolidate queries and add selective fetching | High |
| Component Memoization | Cards re-render on parent state changes | Memoize DevelopmentCard and TeamSection | Medium |
| Event Handlers | Inline handlers cause re-renders | useCallback for stable references | Medium |
| Realtime Subscriptions | No debounce on updates | Debounce rapid updates | Medium |
| Drawer Loading | Full activity load on every open | Lazy load timeline data | Low |

---

### 1. Add Query Caching Configuration

**Problem:** Every time you switch browser tabs or click somewhere, React Query refetches all data because there's no `staleTime` configured.

**Solution:** Add `staleTime` to queries so data is considered fresh for a period of time.

**File: `src/pages/Development.tsx`**

```typescript
const { data: items = [], isLoading } = useQuery({
  queryKey: ['development-items', user?.id],
  queryFn: async () => { ... },
  staleTime: 30 * 1000, // Data is fresh for 30 seconds
  gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  refetchOnWindowFocus: false, // Don't refetch on tab switch
});
```

---

### 2. Memoize DevelopmentCard Component

**Problem:** When any filter changes or a card is selected, ALL cards re-render even if their props haven't changed.

**Solution:** Wrap `DevelopmentCard` with `React.memo` to skip re-renders when props are identical.

**File: `src/components/development/DevelopmentCard.tsx`**

```typescript
import { memo, useMemo } from 'react';

function DevelopmentCardComponent({ item, onClick, onDragStart, canDrag }: DevelopmentCardProps) {
  // ... existing implementation
}

export const DevelopmentCard = memo(DevelopmentCardComponent, (prev, next) => {
  // Custom comparison for deep equality on item
  return (
    prev.item.id === next.item.id &&
    prev.item.updated_at === next.item.updated_at &&
    prev.item.latest_activity_at === next.item.latest_activity_at &&
    prev.item.last_viewed_at === next.item.last_viewed_at &&
    prev.item.pending_action_type === next.item.pending_action_type &&
    prev.item.pending_action_snoozed_until === next.item.pending_action_snoozed_until &&
    prev.canDrag === next.canDrag
  );
});
```

---

### 3. Stabilize Event Handlers with useCallback

**Problem:** `handleCardClick`, `handleDragStart`, `handleDragOver`, and `handleDropToOwner` are recreated on every render, causing child components to re-render.

**Solution:** Wrap these functions in `useCallback`.

**File: `src/pages/Development.tsx`**

```typescript
const handleCardClick = useCallback((itemId: string) => {
  setSelectedItemId(itemId);
}, []);

const handleDragStart = useCallback((e: React.DragEvent, itemId: string) => {
  e.dataTransfer.setData('itemId', itemId);
  e.dataTransfer.effectAllowed = 'move';
}, []);

const handleDragOver = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}, []);

const handleDropToOwner = useCallback(async (e: React.DragEvent, targetOwner: DevelopmentCardOwner) => {
  // ... existing implementation
}, [items, canManage, user?.id, queryClient]);
```

---

### 4. Memoize Filtered and Grouped Items

**Problem:** `filteredItems`, `morItems`, and `arcItems` are recalculated on every render, even when inputs haven't changed.

**Solution:** Use `useMemo` for these computations.

**File: `src/pages/Development.tsx`**

```typescript
const filteredItems = useMemo(() => {
  return items.filter(item => {
    // ... existing filter logic
  });
}, [items, searchTerm, priorityFilter, cardTypeFilter, creatorRoleFilter, showSolved, showDeleted]);

const { morItems, arcItems } = useMemo(() => ({
  morItems: filteredItems.filter(item => item.current_owner === 'mor'),
  arcItems: filteredItems.filter(item => item.current_owner === 'arc'),
}), [filteredItems]);
```

---

### 5. Debounce Search Input

**Problem:** Every keystroke in the search field triggers an immediate filter, causing many rapid re-renders.

**Solution:** Add a debounced search term.

**File: `src/pages/Development.tsx`**

```typescript
import { useState, useMemo, useCallback, useDeferredValue } from 'react';

// In component:
const [searchTerm, setSearchTerm] = useState('');
const deferredSearchTerm = useDeferredValue(searchTerm);

// Use deferredSearchTerm in filter:
const filteredItems = useMemo(() => {
  return items.filter(item => {
    const matchesSearch = deferredSearchTerm === '' || 
      item.title.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
      item.product_code?.toLowerCase().includes(deferredSearchTerm.toLowerCase());
    // ...
  });
}, [items, deferredSearchTerm, priorityFilter, ...]);
```

---

### 6. Add Realtime Subscription Debouncing

**Problem:** Rapid activity updates (e.g., when importing data) can cause many consecutive query invalidations.

**Solution:** Debounce the realtime subscription callbacks.

**File: `src/components/development/HistoryTimeline.tsx`**

```typescript
import { useRef, useEffect, useCallback } from 'react';

// Debounced invalidation
const invalidateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

useEffect(() => {
  const channel = supabase
    .channel(`activity-${cardId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'development_card_activity', filter: `card_id=eq.${cardId}` },
      () => {
        // Debounce: wait 300ms before invalidating
        if (invalidateTimeoutRef.current) clearTimeout(invalidateTimeoutRef.current);
        invalidateTimeoutRef.current = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
        }, 300);
      }
    )
    .subscribe();

  return () => {
    if (invalidateTimeoutRef.current) clearTimeout(invalidateTimeoutRef.current);
    supabase.removeChannel(channel);
  };
}, [cardId, queryClient]);
```

---

### 7. Lazy Load Drawer Content

**Problem:** The `ItemDetailDrawer` loads all activity data immediately when opened, even though the user might just want to see card info.

**Solution:** Use `enabled` option to only fetch activity when drawer is open.

**File: `src/components/development/HistoryTimeline.tsx`**

This is already happening (query runs when component mounts), but we can add `enabled` prop to defer loading:

```typescript
// In HistoryTimeline component (receives isOpen prop from parent)
const { data: activities = [], isLoading } = useQuery({
  queryKey: ['development-card-activity', cardId],
  queryFn: async () => { ... },
  enabled: Boolean(cardId), // Already enabled, but could add isOpen check
  staleTime: 30 * 1000,
});
```

---

### 8. Optimize Main Query Structure

**Problem:** The main development items query runs 6 parallel sub-queries. Some of these (like creator profiles) rarely change and could be cached longer.

**Solution:** Separate stable data into its own query with longer cache time.

**File: `src/pages/Development.tsx`**

```typescript
// Separate query for user profiles (rarely changes)
const { data: userProfiles = {} } = useQuery({
  queryKey: ['user-profiles-map'],
  queryFn: async () => {
    const { data } = await supabase.from('profiles').select('user_id, full_name');
    return data?.reduce((acc, p) => { acc[p.user_id] = p.full_name; return acc; }, {}) || {};
  },
  staleTime: 5 * 60 * 1000, // 5 minutes - profiles don't change often
});
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Development.tsx` | Add staleTime, useCallback, useMemo, useDeferredValue |
| `src/components/development/DevelopmentCard.tsx` | Wrap with React.memo |
| `src/components/development/TeamSection.tsx` | Wrap with React.memo |
| `src/components/development/HistoryTimeline.tsx` | Add debounced realtime, staleTime |
| `src/components/development/ActionsPanel.tsx` | Add debounced realtime, staleTime |

---

### Expected Impact

- **Tab switching**: No more unnecessary refetches when switching browser tabs
- **Search typing**: Smoother typing experience with deferred updates
- **Card interactions**: Fewer re-renders when clicking/selecting cards
- **Realtime updates**: Smoother updates without flickering on rapid changes
- **Overall responsiveness**: Faster perceived performance due to cached data

