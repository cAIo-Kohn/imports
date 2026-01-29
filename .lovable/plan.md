

## Fix: New Card Banner Disappears Immediately

### Root Cause

When the drawer opens, two things happen almost simultaneously:

1. The `NewCardBanner` renders because `isNewForOtherTeam` is `true`
2. A `useEffect` clears the `is_new_for_other_team` flag in the database and then **refetches** the development items query

The refetch returns the updated data with `is_new_for_other_team: false`, causing the banner to disappear within milliseconds.

```text
┌─────────────────────────────────────────────────────────────────────┐
│ CURRENT FLOW (broken)                                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Drawer Opens                                                       │
│       ↓                                                             │
│  item.is_new_for_other_team = true  →  Banner shows                 │
│       ↓                                                             │
│  useEffect runs → UPDATE is_new_for_other_team = false              │
│       ↓                                                             │
│  refetchQueries() → fetches fresh data                              │
│       ↓                                                             │
│  item.is_new_for_other_team = false  →  Banner HIDES                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Solution

Track a **local state** that captures the initial `isNewForOtherTeam` value when the drawer opens. This state persists for the duration of the drawer session, regardless of database updates.

```text
┌─────────────────────────────────────────────────────────────────────┐
│ FIXED FLOW                                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Drawer Opens                                                       │
│       ↓                                                             │
│  initiallyNewForOtherTeam = true (captured once)                    │
│       ↓                                                             │
│  Banner shows based on local state (not live prop)                  │
│       ↓                                                             │
│  useEffect runs → DB update + refetch (background)                  │
│       ↓                                                             │
│  Banner STAYS VISIBLE (using captured state)                        │
│       ↓                                                             │
│  Drawer closes → state resets                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Implementation Details

**File: `src/components/development/ItemDetailDrawer.tsx`**

1. Add a new state to capture the initial "new for other team" value:

```typescript
// Track if this was initially a new card (persists for drawer session)
const [wasNewForOtherTeam, setWasNewForOtherTeam] = useState(false);
```

2. Capture the value when the drawer opens with a new item:

```typescript
// Capture initial "new for other team" state when drawer opens with a new item
useEffect(() => {
  if (open && item?.id) {
    const itemWithNewFields = item as any;
    const isNewForMe = itemWithNewFields.is_new_for_other_team && (
      (isBuyer && itemWithNewFields.created_by_role === 'trader') ||
      (isTrader && itemWithNewFields.created_by_role === 'buyer')
    );
    setWasNewForOtherTeam(isNewForMe);
  }
  
  // Reset when drawer closes
  if (!open) {
    setWasNewForOtherTeam(false);
  }
}, [open, item?.id]); // Note: intentionally not including item itself to avoid updates
```

3. Pass the captured state to `HistoryTimeline`:

```typescript
<HistoryTimeline
  // ... other props
  isNewForOtherTeam={wasNewForOtherTeam}  // Changed from live prop
/>
```

### Key Points

| Aspect | Before | After |
|--------|--------|-------|
| Banner visibility source | Live `item.is_new_for_other_team` prop | Local `wasNewForOtherTeam` state |
| When value is captured | Every render | Once when drawer opens |
| Affected by refetch | Yes (disappears) | No (persists) |
| Resets when | Item data changes | Drawer closes |

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/development/ItemDetailDrawer.tsx` | Add `wasNewForOtherTeam` state, capture initial value on drawer open, pass to HistoryTimeline |

### Outcome

The New Card Banner will now:
- Appear when opening a card that's new for the receiving team
- Stay visible for the entire drawer session
- Allow users to interact with the Comment, Question, Snooze, and Upload buttons
- Disappear only when the drawer is closed (and won't reappear next time since the flag was cleared)

