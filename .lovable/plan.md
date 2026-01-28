
## Plan: Fix "What's Next?" Prompt Not Appearing After Commercial Data Submission

### Root Cause Analysis

I identified **two issues** preventing the "What's next?" prompt from appearing:

#### Issue 1: Activity Detection Order
In `HistoryTimeline.tsx`, the code looks for the trigger activity like this:

```typescript
const otherTriggerActivity = activities.find(a => 
  ['commercial_update', 'ownership_change'].includes(a.activity_type)
);
```

Activities are sorted by `created_at DESC` (most recent first). When commercial data is submitted, **two activities** are created:
1. First: `commercial_update` 
2. Then: `ownership_change` (card moves to other team)

Since `ownership_change` is the **most recent**, `activities.find()` returns it first. The condition then checks:

```typescript
triggerActivity?.activity_type === 'commercial_update'  // FALSE - it's 'ownership_change'
```

**Fix:** Change the logic to also show the prompt when the trigger is `ownership_change` caused by commercial data, OR check specifically for a recent commercial update.

#### Issue 2: Prompt Should Show for Both Teams' Perspective
The current logic requires `showAttentionBanner` to be true, which depends on `is_new_for_other_team` being set and specific role conditions. But when YOU submit commercial data and the card moves to the other side, the prompt should appear for THEM (the receiving team), not for you.

For the **receiving team** to see the prompt:
- The card must be in their section (`current_owner` matches their team)
- There should be a recent commercial update activity

---

### Solution

#### 1. Update `showNextStepPrompt` Logic in `HistoryTimeline.tsx`

Change the condition to also trigger when:
- The most recent trigger is `ownership_change` that was caused by commercial data (has `trigger: 'commercial'` in metadata)
- OR there's a `commercial_update` in the recent activities

```typescript
// Find the most recent commercial update (not necessarily the first trigger)
const mostRecentCommercialUpdate = activities.find(a => 
  a.activity_type === 'commercial_update'
);

// Show next step prompt when:
// 1. showAttentionBanner is true (card is new for this user/team)
// 2. No unresolved questions pending
// 3. There's a recent commercial update OR the ownership change was triggered by commercial data
const showNextStepPrompt = 
  showAttentionBanner && 
  !firstUnresolvedQuestion &&
  (mostRecentCommercialUpdate || 
   (triggerActivity?.activity_type === 'ownership_change' && 
    triggerActivity?.metadata?.trigger === 'commercial'));
```

#### 2. Determine Trigger Type for NextStepPrompt

Pass the correct trigger type to show the appropriate message:

```typescript
// Determine the type of trigger for the prompt message
const promptTriggerType = mostRecentCommercialUpdate ? 'commercial' : 'ownership';
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `HistoryTimeline.tsx` | Fix the activity detection logic to find commercial updates regardless of position |

---

### Visual Flow After Fix

```text
User A (Trader in China) submits commercial data
    ↓
Card moves to MOR (Brazil)
    ↓
User B (Buyer in Brazil) opens the card
    ↓
showAttentionBanner = true (is_new_for_other_team && current_owner === 'mor')
    ↓
mostRecentCommercialUpdate = found ✓
firstUnresolvedQuestion = null ✓
    ↓
showNextStepPrompt = true ✓
    ↓
"What's next?" prompt appears with:
   [Request Sample] [Ask a Question] [Add Comment]
```

---

### Code Changes

**Before (broken):**
```typescript
const otherTriggerActivity = activities.find(a => 
  ['commercial_update', 'ownership_change'].includes(a.activity_type)
);
const triggerActivity = firstUnresolvedQuestion || otherTriggerActivity;

const showNextStepPrompt = 
  showAttentionBanner && 
  !firstUnresolvedQuestion &&
  triggerActivity?.activity_type === 'commercial_update';
```

**After (fixed):**
```typescript
// Find the most recent commercial update activity
const mostRecentCommercialUpdate = activities.find(a => 
  a.activity_type === 'commercial_update'
);

// Find ownership changes triggered by commercial data
const commercialTriggeredMove = activities.find(a => 
  a.activity_type === 'ownership_change' && 
  a.metadata?.trigger === 'commercial'
);

// Show next step prompt when commercial data was recently set
const showNextStepPrompt = 
  showAttentionBanner && 
  !firstUnresolvedQuestion &&
  (mostRecentCommercialUpdate || commercialTriggeredMove);

// Determine trigger type for prompt messaging
const promptTriggerType = mostRecentCommercialUpdate ? 'commercial' : 'ownership';
```
