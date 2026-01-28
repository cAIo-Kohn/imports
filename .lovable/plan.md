
## Plan: De-duplicate Timeline by Filtering Actionable Items

### Problem

Currently, actionable items (unresolved questions, sample requests, etc.) appear TWICE:
1. In the **Attention Banner** at the top (highlighted area for action)
2. In the **Timeline history** below (as a regular activity entry)

This is redundant and confusing, as shown in the screenshot.

---

### Solution

**Keep actionable items ONLY in the highlight area at the top until they're resolved.** Once resolved/acted upon, they appear in the timeline history.

The principle:
- **Pending actions** → Show in banner at top, HIDE from timeline
- **Resolved/completed actions** → Show in timeline history only

---

### Implementation

#### Filter Logic

When rendering the timeline, **exclude activities that are currently shown in banners:**

```typescript
// Activities to exclude from timeline (shown in banners)
const activitiesInBanners = new Set<string>();

// If unresolved question is shown in AttentionBanner, exclude it
if (firstUnresolvedQuestion) {
  activitiesInBanners.add(firstUnresolvedQuestion.id);
}

// If sample_requested is shown in SampleRequestedBanner, exclude it
if (showSampleRequestedBanner && sampleRequestedActivity) {
  activitiesInBanners.add(sampleRequestedActivity.id);
}

// Filter activities for timeline
const timelineActivities = allActivities.filter(a => 
  !activitiesInBanners.has(a.id)
);
```

#### Changes to HistoryTimeline.tsx

1. **Add filtering before groupByDate():**
   - Identify which activities are currently displayed in banners
   - Exclude them from the timeline list

2. **Move action buttons INTO the banners:**
   - AttentionBanner already has a Reply button
   - Need to add "Mark as Resolved" and "Snooze" to the AttentionBanner too (since timeline won't show them)

3. **Add inline reply box support to AttentionBanner:**
   - When user clicks Reply in the banner, show the InlineReplyBox there

---

### Visual Result

**BEFORE (current - redundant):**
```
┌────────────────────────────────────────────────┐
│  ❓ Question for you               [Reply]     │  ← Banner
│  ┌────────────────────────────────────────┐   │
│  │ Caio Kohn • 15:59                     │   │
│  │ "he"                                   │   │
│  └────────────────────────────────────────┘   │
└────────────────────────────────────────────────┘

TODAY
→ Caio moved card — MOR (Brazil) • 15:59

┌────────────────────────────────────────────────┐  
│  Caio Kohn  ❓ asked a question  15:59         │  ← DUPLICATE!
│  "he"                                          │
│  [Reply] [Mark as Resolved] [Snooze]          │
└────────────────────────────────────────────────┘
```

**AFTER (optimized - no duplication):**
```
┌────────────────────────────────────────────────┐
│  ❓ Question for you                           │  ← Banner with ALL actions
│  ┌────────────────────────────────────────┐   │
│  │ Caio Kohn • 15:59                      │   │
│  │ "he"                                    │   │
│  └────────────────────────────────────────┘   │
│  [Reply] [Mark as Resolved] [⏰ Snooze]       │  ← Actions moved here
└────────────────────────────────────────────────┘

TODAY
→ Caio moved card — MOR (Brazil) • 15:59        ← Compact row only
◎ Caio created this card — Created task • 14:54 ← Compact row only
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/development/HistoryTimeline.tsx` | 1. Filter out activities shown in banners from timeline. 2. Add "Mark as Resolved" and "Snooze" buttons to AttentionBanner. 3. Support inline reply box in AttentionBanner. |

---

### Detailed Changes

#### 1. Update AttentionBanner Component

Add all action buttons (Reply, Mark as Resolved, Snooze) plus inline reply box support:

```typescript
function AttentionBanner({ 
  activity, 
  cardId,
  pendingActionType,
  currentOwner,
  onReply,
  onResolve,
  onOwnerChange,
  isResolving,
}: { 
  activity: Activity;
  cardId: string;
  pendingActionType?: string | null;
  currentOwner?: 'mor' | 'arc';
  onReply?: () => void;
  onResolve?: () => void;
  onOwnerChange?: () => void;
  isResolving?: boolean;
}) {
  const [showReplyBox, setShowReplyBox] = useState(false);
  
  // ... existing banner content ...
  
  {/* Action buttons row */}
  {isQuestion && (
    <div className="flex gap-2 mt-3 flex-wrap">
      <Button onClick={() => setShowReplyBox(true)}>
        <Reply /> Reply
      </Button>
      <Button onClick={onResolve} disabled={isResolving}>
        <Check /> Mark as Resolved
      </Button>
      <SnoozeButton cardId={cardId} currentActionType="question" />
    </div>
  )}
  
  {/* Inline reply box inside banner */}
  {showReplyBox && (
    <InlineReplyBox
      questionId={activity.id}
      cardId={cardId}
      currentOwner={currentOwner}
      pendingActionType={pendingActionType}
      onClose={() => setShowReplyBox(false)}
      onCardMove={onOwnerChange}
    />
  )}
}
```

#### 2. Filter Timeline Activities

Before grouping activities by date, filter out ones shown in banners:

```typescript
// Collect IDs of activities shown in banners
const bannerActivityIds = new Set<string>();

if (showAttentionBanner && firstUnresolvedQuestion) {
  bannerActivityIds.add(firstUnresolvedQuestion.id);
}

if (showSampleRequestedBanner && sampleRequestedActivity) {
  bannerActivityIds.add(sampleRequestedActivity.id);
}

// Filter activities for timeline (exclude banner items)
const timelineActivities = allActivities.filter(a => 
  !bannerActivityIds.has(a.id)
);

// Group filtered activities
const groupedActivities = groupByDate(timelineActivities);
```

---

### Edge Cases

1. **Question gets resolved** → Banner disappears, question appears in timeline as "Resolved"
2. **Question gets snoozed** → Banner could stay but with snooze indicator, or move to timeline
3. **Multiple unresolved questions** → First one shows in banner, others show in timeline
4. **Sample requested then shipped** → SampleRequestedBanner disappears, both activities appear in timeline

---

### Summary

This change:
1. **Eliminates duplication** by filtering banner activities from the timeline
2. **Consolidates actions** by moving all buttons (Reply, Resolve, Snooze) into the banner
3. **Keeps history clean** by only showing completed/resolved items in the timeline
4. **Supports inline replies** directly in the banner
