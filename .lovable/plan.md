

## Plan: Compact Timeline for System Actions

### Problem

System-generated activities (card moves, status changes, image updates, etc.) take the same visual space as user-generated content (comments, questions, answers). This dilutes the focus on actual conversations and makes the timeline harder to scan.

### Solution

Create a **two-tier visual hierarchy** in the timeline:

| Tier | Activity Types | Visual Treatment |
|------|----------------|------------------|
| **Primary** (full) | comment, question, answer | Full card with avatar, name, content, actions |
| **Secondary** (compact) | ownership_change, status_change, sample_added, sample_updated, commercial_update, product_added, image_updated, created | Single-line inline entry, no avatar, muted styling |

---

### Visual Design

**Before (current):**
```text
┌─────────────────────────────────────────────────────┐
│ [CK] Caio Kohn  → moved card  17:39                 │
│      Card moved to ARC (China)                      │
└─────────────────────────────────────────────────────┘
```

**After (compact):**
```text
→ Caio Kohn moved card to ARC (China) • 17:39
```

---

### Technical Changes

#### 1. Define Activity Categories

Add a constant to categorize which activities are "primary" (need full treatment) vs "secondary" (compact):

```typescript
const PRIMARY_ACTIVITY_TYPES = ['comment', 'question', 'answer'];

const isCompactActivity = (type: string) => !PRIMARY_ACTIVITY_TYPES.includes(type);
```

#### 2. Create Compact Activity Row Component

A new inline component for secondary activities:

```typescript
function CompactActivityRow({ activity }: { activity: Activity }) {
  const userName = activity.profile?.full_name?.split(' ')[0] || 'Someone';
  
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1.5 px-2">
      {ACTIVITY_ICONS[activity.activity_type]}
      <span className="font-medium">{userName}</span>
      <span>{ACTIVITY_LABELS[activity.activity_type]}</span>
      {activity.content && (
        <span className="truncate max-w-[200px]">{activity.content}</span>
      )}
      <span className="opacity-60">• {format(parseISO(activity.created_at), 'HH:mm')}</span>
    </div>
  );
}
```

#### 3. Update Timeline Render Logic

In the main render, check the activity type and render either the full card or compact row:

```typescript
{groupedActivities[dateKey].map((activity) => {
  const isCompact = isCompactActivity(activity.activity_type);
  
  if (isCompact) {
    return <CompactActivityRow key={activity.id} activity={activity} />;
  }
  
  // Existing full card rendering for comments, questions, answers
  return (
    <div key={activity.id}>
      {/* ... existing full card code ... */}
    </div>
  );
})}
```

#### 4. Group Consecutive Compact Activities (Optional Enhancement)

For even cleaner timelines, consecutive compact activities could be grouped:

```text
→ Caio Kohn moved card to ARC (China) • 17:39
→ Caio Kohn updated FOB price to $2.50 • 17:40
→ Caio Kohn added sample tracking • 17:41
```

This keeps them visually connected without taking up multiple full cards.

---

### Styling Details

| Element | Full Card | Compact Row |
|---------|-----------|-------------|
| Background | Colored (blue, purple, etc.) | None (transparent) |
| Border | Yes | None (or subtle dashed line) |
| Avatar | Yes (28px) | No |
| Padding | p-3 | py-1.5 px-2 |
| Font size | text-sm | text-xs |
| Name format | Full name | First name only |

---

### Files to Modify

| File | Changes |
|------|---------|
| `HistoryTimeline.tsx` | Add `CompactActivityRow` component, categorize activities, conditional rendering |

---

### Edge Cases

- **"created" activity**: Show as compact since it's just a log entry
- **commercial_update with important data**: Still compact, but shows the field/value inline
- **Hover behavior**: Could expand compact rows on hover to show full details (future enhancement)

