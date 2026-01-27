
## Plan: Expand Drawer Layout and Add Attention-Drawing Features

### Problems Identified

1. **Drawer too narrow**: Current `sm:max-w-xl` (576px) is cramped for all the content
2. **History section too small**: Compressed between fixed header/footer sections
3. **No attention mechanism**: When a question or FOB price triggers a card move, the receiving team doesn't immediately see what requires their attention

---

### Solution Overview

| Change | Description |
|--------|-------------|
| **Wider drawer** | Increase to `sm:max-w-2xl` (672px) or `sm:max-w-3xl` (768px) |
| **Better space distribution** | Reduce card info height, give history more vertical space |
| **Attention banner** | Add a highlighted "What Needs Your Attention" section at the top of history when card was moved to your team |
| **Latest trigger highlight** | Find the most recent question, FOB update, or ownership_change and display it prominently |

---

### Layout Changes

#### Current Layout
```text
┌─────────────────────────────────────────┐  sm:max-w-xl (576px)
│ Header                                  │  ~60px
├─────────────────────────────────────────┤
│ Card Info (image, badges, description)  │  ~200px (fixed)
├─────────────────────────────────────────┤
│ History (scrollable)                    │  ~150px (squeezed)
├─────────────────────────────────────────┤
│ Actions Panel (accordion)               │  ~200px+ (fixed)
└─────────────────────────────────────────┘
```

#### New Layout
```text
┌─────────────────────────────────────────────────┐  sm:max-w-2xl (672px)
│ Header                                          │  ~50px
├─────────────────────────────────────────────────┤
│ Card Info (compact: image + title + status)     │  ~120px
├─────────────────────────────────────────────────┤
│ ⚡ ATTENTION REQUIRED (if card moved to you)    │  ~80px
│ ┌─────────────────────────────────────────────┐ │
│ │ Trader Wang asked: "What volume per year?" │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ History (scrollable, much larger)               │  ~300px+
├─────────────────────────────────────────────────┤
│ Actions Panel (collapsed by default)            │  ~60px collapsed
└─────────────────────────────────────────────────┘
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `ItemDetailDrawer.tsx` | Increase width to `sm:max-w-2xl`, add attention banner logic |
| `CardInfoSection.tsx` | Compact layout, reduce padding |
| `HistoryTimeline.tsx` | Add "attention required" highlighted item at top |
| `ActionsPanel.tsx` | Default to collapsed (not expanded) to give history more space |

---

### Attention Banner Implementation

The attention banner will appear when:
1. Card was moved to the current user's team (`is_new_for_other_team = true`)
2. The most recent activity is a question, commercial_update, or ownership_change

```typescript
// In HistoryTimeline.tsx or ItemDetailDrawer.tsx
interface HistoryTimelineProps {
  cardId: string;
  cardCreatedAt: string;
  creatorName?: string;
  showAttentionBanner?: boolean; // New prop
}

// Find the triggering action (most recent question/commercial update)
const triggerActivity = activities.find(a => 
  ['question', 'commercial_update'].includes(a.activity_type)
);

// Render attention banner if card is new for this team
{showAttentionBanner && triggerActivity && (
  <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 mb-4 animate-pulse-subtle">
    <div className="flex items-center gap-2 text-amber-800 font-medium mb-2">
      <AlertCircle className="h-5 w-5" />
      Attention Required
    </div>
    <div className="bg-white rounded p-3 border border-amber-200">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Avatar className="h-6 w-6">...</Avatar>
        {triggerActivity.profile?.full_name} 
        {triggerActivity.activity_type === 'question' ? 'asked:' : 'updated:'}
      </div>
      <p className="mt-1 font-medium">
        {triggerActivity.content}
      </p>
    </div>
  </div>
)}
```

---

### Visual Differentiation for Trigger Actions

| Activity Type | Banner Style | Icon |
|---------------|--------------|------|
| Question | Purple/violet border, "?" icon | HelpCircle |
| FOB Price update | Green/emerald border, "$" icon | DollarSign |
| Ownership change | Blue border, arrow icon | ArrowRight |

---

### Detailed Changes

#### 1. ItemDetailDrawer.tsx

```typescript
// Increase width
<SheetContent className="w-full sm:max-w-2xl flex flex-col h-full p-0">

// Pass attention flag to HistoryTimeline
<HistoryTimeline
  cardId={item.id}
  cardCreatedAt={item.created_at}
  creatorName={creatorProfile?.full_name || creatorProfile?.email}
  showAttentionBanner={itemWithNewFields.is_new_for_other_team && isNewForMe}
/>
```

#### 2. CardInfoSection.tsx

- Make image smaller (w-20 h-20 instead of w-24 h-24)
- Reduce padding in "Desired Outcome" box
- More compact badge layout

#### 3. HistoryTimeline.tsx

Add attention banner component at top:

```typescript
// New component for attention banner
function AttentionBanner({ activity }: { activity: Activity }) {
  const isQuestion = activity.activity_type === 'question';
  const isCommercial = activity.activity_type === 'commercial_update';
  
  return (
    <div className={cn(
      "rounded-lg p-4 mb-4 border-2",
      isQuestion && "bg-purple-50 border-purple-300",
      isCommercial && "bg-emerald-50 border-emerald-300",
    )}>
      <div className="flex items-center gap-2 font-medium mb-2">
        {isQuestion ? <HelpCircle className="h-5 w-5 text-purple-600" /> : null}
        {isCommercial ? <DollarSign className="h-5 w-5 text-emerald-600" /> : null}
        <span className={cn(
          isQuestion && "text-purple-800",
          isCommercial && "text-emerald-800",
        )}>
          {isQuestion ? "Question for you" : "Commercial data updated"}
        </span>
      </div>
      <div className="bg-white rounded-lg p-3 border">
        <p className="text-sm font-medium">{activity.content}</p>
        {isCommercial && activity.metadata && (
          <p className="text-xs text-muted-foreground mt-1">
            {activity.metadata.field}: ${activity.metadata.value}
          </p>
        )}
      </div>
    </div>
  );
}
```

#### 4. ActionsPanel.tsx

Change default accordion state to show collapsed:

```typescript
// Before: defaultValue={['messaging']}
<Accordion type="multiple" defaultValue={[]} className="w-full">
```

---

### Summary

| Improvement | Implementation |
|-------------|----------------|
| Wider drawer | `sm:max-w-2xl` (672px) |
| Compact card info | Smaller image, tighter spacing |
| Attention banner | Prominent highlighted section for trigger actions |
| More history space | Actions collapsed by default |
| Visual differentiation | Purple for questions, green for commercial updates |
