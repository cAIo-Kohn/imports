
## Fix Thread Titles and Timeline Organization

After investigating the codebase, I found **two critical issues** that explain why threads aren't visible:

---

### Root Causes

#### 1. ThreadedTimeline is imported but never rendered
The `HistoryTimeline.tsx` component imports `ThreadedTimeline` (line 40) but the actual render logic still uses the old flat approach with `sortedDates.map()` (starting at line 1491). The `ThreadedTimeline` component is completely unused.

#### 2. Activity interface missing thread fields
The `Activity` interface (lines 43-56) doesn't include `thread_id`, `thread_root_id`, or `thread_title` fields - even though the database has them and the query fetches them with `select('*')`.

```typescript
// Current interface (missing thread fields)
interface Activity {
  id: string;
  card_id: string;
  user_id: string;
  activity_type: string;
  content: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  profile?: {...} | null;
  roles?: AppRole[];
}
```

---

### Solution

#### Step 1: Update Activity interface
Add the missing thread fields to the `Activity` interface:
```typescript
interface Activity {
  // ... existing fields ...
  thread_id: string | null;
  thread_root_id: string | null;
  thread_title: string | null;
}
```

#### Step 2: Replace flat rendering with ThreadedTimeline
Replace the old flat `sortedDates.map()` logic (lines 1491-1752) with:
```tsx
<ThreadedTimeline
  activities={allActivities}
  cardId={cardId}
  currentOwner={currentOwner}
  pendingActionType={pendingActionType}
  onResolveQuestion={(id) => resolveQuestionMutation.mutate(id)}
  onAcknowledgeAnswer={(id) => acknowledgeAnswerMutation.mutate(id)}
  onOwnerChange={onOwnerChange}
  isResolving={resolveQuestionMutation.isPending}
  isAcknowledging={acknowledgeAnswerMutation.isPending}
  excludeIds={bannerActivityIds}
/>
```

#### Step 3: Pass exclude IDs for banner activities
Create a set of activity IDs that are already shown in banners (e.g., first unresolved question, first unacknowledged answer) so they don't duplicate in the timeline.

---

### Summary of Changes

| File | Change |
|------|--------|
| `src/components/development/HistoryTimeline.tsx` | 1. Add thread fields to Activity interface |
| | 2. Replace flat rendering with ThreadedTimeline component |
| | 3. Pass banner activity IDs to excludeIds prop |

---

### Result After Fix

- Threads will be grouped and displayed as collapsible cards
- Thread titles (auto-generated or custom) will appear in the header
- System activities (status changes, sample updates) will appear in separate "Activity Log" section
- Parallel conversations will be clearly organized by topic
