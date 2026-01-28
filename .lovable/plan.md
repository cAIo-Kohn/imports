

## Plan: Card Change Indicator (Blinking Dot)

### Overview

Add a visual indicator (blinking dot) on development cards to show when new activity has occurred that the user hasn't seen yet. This helps all users track changes across all cards, regardless of which team the card is directed to.

---

### Approach Options

There are two implementation approaches for tracking "unseen" changes:

| Approach | Pros | Cons |
|----------|------|------|
| **Database-based** (per-user last_seen tracking table) | Accurate, persistent across sessions, works on multiple devices | Requires new table and more queries |
| **Browser-based** (localStorage) | Simple, no database changes, instant | Clears on browser change, not persistent |

**Recommended: Database-based** - This is more robust and ensures all users can track changes accurately, even across different browsers/devices.

---

### Database Changes

**New Table: `card_user_views`**

This table tracks when each user last viewed a card:

```sql
CREATE TABLE public.card_user_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES development_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, user_id)
);

ALTER TABLE public.card_user_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own views"
  ON public.card_user_views FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own views"
  ON public.card_user_views FOR ALL
  USING (auth.uid() = user_id);
```

---

### Logic Flow

```text
┌─────────────────────────────────────────────────────────────────┐
│                      HOW IT WORKS                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. When user OPENS a card drawer:                              │
│     → UPSERT into card_user_views with current timestamp        │
│                                                                 │
│  2. When fetching cards for display:                            │
│     → Join with development_card_activity to get                │
│       latest_activity_at (MAX of created_at)                    │
│     → Join with card_user_views to get last_viewed_at           │
│                                                                 │
│  3. Show indicator when:                                        │
│     → latest_activity_at > last_viewed_at                       │
│     → OR last_viewed_at is NULL (never viewed)                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### UI Design

A small blinking orange/amber dot appears in the top-right corner of cards with unseen activity:

```text
┌──────────────────────────────────────┐
│ 🔶 ← blinking dot (unseen changes)  │
├──────────────────────────────────────┤
│  [Buyer] [Item] [Medium]             │
│                                      │
│  Sample request for chair XYZ        │
│                                      │
│  📦 2 samples  📅 15/02              │
└──────────────────────────────────────┘
```

The dot will:
- Be positioned in the top-right corner of the card
- Use an amber/orange color (`bg-amber-500`)
- Have a gentle pulsing animation
- Only show when the card has NEW activity since the user last viewed it

---

### Technical Implementation

#### 1. Modify Query in `Development.tsx`

Extend the fetch query to include:
- Latest activity timestamp per card
- User's last viewed timestamp per card

```typescript
// Fetch latest activity time per card
const { data: latestActivities } = await supabase
  .from('development_card_activity')
  .select('card_id, created_at')
  .in('card_id', itemIds)
  .order('created_at', { ascending: false });

// Group by card_id to get MAX
const latestActivityMap = latestActivities?.reduce((acc, a) => {
  if (!acc[a.card_id] || new Date(a.created_at) > new Date(acc[a.card_id])) {
    acc[a.card_id] = a.created_at;
  }
  return acc;
}, {} as Record<string, string>);

// Fetch user's last viewed times
const { data: userViews } = await supabase
  .from('card_user_views')
  .select('card_id, last_viewed_at')
  .eq('user_id', user?.id)
  .in('card_id', itemIds);

const userViewMap = (userViews || []).reduce((acc, v) => {
  acc[v.card_id] = v.last_viewed_at;
  return acc;
}, {} as Record<string, string>);

// Add to each item
return data.map(item => ({
  ...item,
  latest_activity_at: latestActivityMap?.[item.id] || item.created_at,
  last_viewed_at: userViewMap[item.id] || null,
  has_unseen_activity: // computed in DevelopmentCard
}));
```

#### 2. Update `DevelopmentItem` Interface

```typescript
export interface DevelopmentItem {
  // ...existing fields...
  latest_activity_at?: string;
  last_viewed_at?: string | null;
}
```

#### 3. Add Indicator in `DevelopmentCard.tsx`

```typescript
// Check if there's unseen activity
const hasUnseenActivity = useMemo(() => {
  const latestActivity = (item as any).latest_activity_at;
  const lastViewed = (item as any).last_viewed_at;
  
  if (!latestActivity) return false;
  if (!lastViewed) return true; // Never viewed = unseen
  
  return new Date(latestActivity) > new Date(lastViewed);
}, [item]);

// In the JSX, add the blinking dot:
{hasUnseenActivity && (
  <div className="absolute top-2 right-2">
    <span className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
    </span>
  </div>
)}
```

#### 4. Update View on Drawer Open

In `ItemDetailDrawer.tsx`:

```typescript
useEffect(() => {
  const updateLastViewed = async () => {
    if (!item?.id || !open || !user?.id) return;
    
    await supabase
      .from('card_user_views')
      .upsert({
        card_id: item.id,
        user_id: user.id,
        last_viewed_at: new Date().toISOString(),
      }, {
        onConflict: 'card_id,user_id',
      });
    
    queryClient.invalidateQueries({ queryKey: ['development-items'] });
  };

  updateLastViewed();
}, [item?.id, open, user?.id]);
```

---

### Files to Modify

| File | Changes |
|------|---------|
| **Database Migration** | Create `card_user_views` table with RLS |
| `src/pages/Development.tsx` | Add queries for latest activity and user views |
| `src/components/development/DevelopmentCard.tsx` | Add blinking dot indicator |
| `src/components/development/ItemDetailDrawer.tsx` | Upsert last_viewed_at on open |
| `src/integrations/supabase/types.ts` | Auto-updated after migration |

---

### Edge Cases

1. **New users**: Cards they've never viewed will show the dot (correct behavior)
2. **Card with no activity**: Uses `created_at` as the "latest activity"
3. **Real-time updates**: When using Supabase Realtime, the dot will appear on cards that receive new activity without refresh
4. **Performance**: Queries are batched to avoid N+1 problems

---

### Visual Priority with Existing Badges

The blinking dot coexists with existing indicators:
- **NEW badge** (pulsing purple/pink): Shows cards new for the OTHER team
- **Blinking dot** (amber): Shows cards with unseen activity for CURRENT user

Both can appear on the same card - they serve different purposes:
- NEW badge = "This was created by the other team and you haven't seen it"
- Blinking dot = "Something changed here since you last looked"

