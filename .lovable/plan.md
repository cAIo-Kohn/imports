
# Auto-Thread Sample Requests

## Overview
Instead of showing sample requests in a separate banner, treat them as auto-created threads that people can reply to directly. This allows users to comment on sample requests (e.g., "I'll talk to the supplier and inform an ETD soon") without creating separate threads, while still supporting snoozing and tracking actions.

## Problem
Currently, `sample_requested` activities:
- Are shown in a separate `SampleRequestedBanner` component
- Are NOT recognized as threadable (filtered out by `THREADABLE_TYPES`)
- Cannot receive replies/comments directly
- Require users to "Start New Thread" to discuss sample-related topics

## Solution
Make sample requests automatically create and display as threads:
1. When a sample is requested, it auto-creates a thread (already happens)
2. The thread appears in the timeline like any other thread
3. Users can reply/comment directly on it
4. "Add Tracking" action moves inside the thread card
5. Snooze works on the thread assignment level

## Implementation

### 1. Add sample_requested to THREADABLE_TYPES

**File: `src/components/development/ThreadedTimeline.tsx`**

Update the constant:
```typescript
// Before:
const THREADABLE_TYPES = ['comment', 'question', 'answer'];

// After:
const THREADABLE_TYPES = ['comment', 'question', 'answer', 'sample_requested'];
```

### 2. Update Sample Request Creation with Assignment

**File: `src/components/development/HistoryTimeline.tsx`** (lines ~738-762)

Add the assignment columns when creating sample_requested activity:
```typescript
const { data: activityData, error: activityError } = await supabase
  .from('development_card_activity')
  .insert({
    card_id: cardId,
    user_id: user.id,
    activity_type: 'sample_requested',
    content: 'Sample requested',
    thread_title: 'Sample Request',
    metadata: {
      moved_from: currentOwner,
      moved_to: targetOwner,
    },
    // NEW: Add assignment columns
    assigned_to_role: 'trader',    // Assigned to traders (China team)
    thread_creator_id: user.id,    // Track who created this
    thread_status: 'open',         // Thread is open
  })
```

**File: `src/components/development/AddSampleForm.tsx`** (lines ~80-94)

Same update for the other sample request flow.

### 3. Update ThreadCard to Show Add Tracking

**File: `src/components/development/ThreadCard.tsx`**

Add an "Add Tracking" action button when:
- Thread root is `sample_requested`
- Sample hasn't been shipped yet (check metadata or related activities)
- Current user has trader role

Add state and inline form:
```typescript
// Inside ThreadCard component:
const [showShipForm, setShowShipForm] = useState(false);

// In the header actions area, for sample_requested threads:
{isSampleRelated && !isResolved && sampleStage === 'requested' && (
  <Button 
    size="sm" 
    variant="outline"
    onClick={() => setShowShipForm(true)}
    className="bg-cyan-50 border-cyan-300 text-cyan-700"
  >
    <Truck className="h-3 w-3 mr-1" />
    Add Tracking
  </Button>
)}
```

### 4. Remove SampleRequestedBanner from Priority Flow

**File: `src/components/development/HistoryTimeline.tsx`**

Remove the banner rendering and associated logic:
- Remove `showSampleRequestedBanner` calculation
- Remove the `<SampleRequestedBanner>` JSX
- Keep the `SampleRequestedBanner` component for now (can clean up later) or repurpose as inline content

The sample_requested thread will now appear highlighted in the timeline with:
- "Your turn" badge when assigned to current user/role
- Reply capability
- Snooze via thread assignment
- Add Tracking button in thread header

### 5. Update InlineReplyBox for Sample Threads

**File: `src/components/development/InlineReplyBox.tsx`**

Update the `replyToType` prop to accept 'sample_requested':
```typescript
replyToType: 'question' | 'answer' | 'comment' | 'sample_requested';
```

When replying to a sample_requested thread, show appropriate options:
- "Reply" - Just add a comment
- "Reply & Reassign" - Reassign to another user/role

## Visual Flow

**Before:**
```
┌──────────────────────────────────┐
│ BANNER: Sample Requested         │
│ [Add Tracking]  [Quick Actions]  │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ Thread: Color discussion         │
└──────────────────────────────────┘
```

**After:**
```
┌──────────────────────────────────┐
│ Thread: Sample Request       📦  │
│ ├ Requested → Shipped → ...      │
│ │                                │
│ │ Vitória: Sample requested      │
│ │                                │
│ │ Jin: I'll talk to supplier...  │
│ │                                │
│ │ [Reply] [Add Tracking] [Snooze]│
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ Thread: Color discussion         │
└──────────────────────────────────┘
```

## Files to Modify

| File | Changes |
|------|---------|
| `ThreadedTimeline.tsx` | Add `sample_requested` to `THREADABLE_TYPES` |
| `HistoryTimeline.tsx` | Add assignment columns to sample request creation, remove SampleRequestedBanner from render |
| `AddSampleForm.tsx` | Add assignment columns to sample request creation |
| `ThreadCard.tsx` | Add "Add Tracking" button and inline form for sample threads |
| `InlineReplyBox.tsx` | Accept `sample_requested` as valid replyToType |

## Benefits
1. **Unified experience** - Sample discussions work like all other threads
2. **Direct replies** - No need to create separate threads for sample discussions
3. **Assignment-based tracking** - "Your turn" badge shows who needs to act
4. **Audit trail** - All sample-related comments stay in one thread
5. **Snooze works naturally** - Via thread assignment, not card-level

## Migration
No database migration needed - sample_requested activities already have `thread_id`, `thread_root_id`, and `thread_title` set. The new assignment columns will be populated going forward; existing sample requests will display without assignment badges (acceptable for legacy data).
