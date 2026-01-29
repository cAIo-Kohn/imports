
## Fix: Preserve Attachments When Resolving Questions or Acknowledging Answers

### Problem

When you reply to a question with an image or file attached, then click "Got it" to acknowledge the answer, the attachments disappear from the timeline and Files tab. This happens because the code **overwrites** the metadata field instead of **merging** with existing data.

### Root Cause

Two mutations are incorrectly overwriting metadata instead of preserving existing data:

| Location | Mutation | Issue |
|----------|----------|-------|
| `InlineReplyBox.tsx` lines 95-106 | `answerReplyMutation` | Overwrites question metadata when marking as resolved |
| `HistoryTimeline.tsx` lines 800-837 | `resolveQuestionMutation` | Overwrites question metadata when marking as resolved |

**Current (buggy) code:**
```typescript
// This DESTROYS any existing metadata like attachments
await supabase
  .from('development_card_activity')
  .update({
    metadata: {
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    },
  })
  .eq('id', activityId);
```

**Correct pattern (already used in acknowledgeAnswerMutation):**
```typescript
// 1. Fetch existing metadata first
const { data: currentActivity } = await supabase
  .from('development_card_activity')
  .select('metadata')
  .eq('id', activityId)
  .single();

const existingMetadata = (currentActivity?.metadata as Record<string, any>) || {};

// 2. Merge existing metadata with new fields
await supabase
  .from('development_card_activity')
  .update({
    metadata: {
      ...existingMetadata,  // <-- PRESERVE attachments and other data
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    },
  })
  .eq('id', activityId);
```

### Solution

Apply the same "fetch-then-merge" pattern to both mutations that update activity metadata:

### Files to Modify

| File | Change |
|------|--------|
| `src/components/development/HistoryTimeline.tsx` | Update `resolveQuestionMutation` to fetch and merge existing metadata |
| `src/components/development/InlineReplyBox.tsx` | Update `answerReplyMutation` to fetch and merge existing metadata before marking question as resolved |

### Technical Implementation

**1. Fix `resolveQuestionMutation` in HistoryTimeline.tsx (lines 800-837):**

```typescript
const resolveQuestionMutation = useMutation({
  mutationFn: async (activityId: string) => {
    if (!user?.id) throw new Error('Not authenticated');
    
    // 1. Fetch existing metadata to preserve attachments
    const { data: currentActivity, error: fetchError } = await supabase
      .from('development_card_activity')
      .select('metadata')
      .eq('id', activityId)
      .single();
    
    if (fetchError) throw fetchError;
    
    const existingMetadata = (currentActivity?.metadata as Record<string, any>) || {};
    
    // 2. Merge existing metadata with resolved fields
    const { error } = await supabase
      .from('development_card_activity')
      .update({
        metadata: {
          ...existingMetadata,
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        },
      })
      .eq('id', activityId);
    
    if (error) throw error;

    // 3. Clear pending action on the card
    await (supabase.from('development_items') as any)
      .update({
        pending_action_type: null,
        pending_action_due_at: null,
        pending_action_snoozed_until: null,
        pending_action_snoozed_by: null,
      })
      .eq('id', cardId);
  },
  // ... rest unchanged
});
```

**2. Fix `answerReplyMutation` in InlineReplyBox.tsx (lines 95-106):**

```typescript
// After inserting the answer activity...

// 2. Fetch existing metadata from the question to preserve attachments
const { data: questionActivity, error: fetchError } = await supabase
  .from('development_card_activity')
  .select('metadata')
  .eq('id', replyToId)
  .single();

if (fetchError) throw fetchError;

const existingMetadata = (questionActivity?.metadata as Record<string, any>) || {};

// 3. Mark question as resolved while preserving existing metadata
const { error: resolveError } = await supabase
  .from('development_card_activity')
  .update({
    metadata: {
      ...existingMetadata,
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    },
  })
  .eq('id', replyToId);
if (resolveError) throw resolveError;
```

### What This Fixes

| Before | After |
|--------|-------|
| Attachments on questions disappear when resolved | Attachments preserved in timeline and Files tab |
| Clicking "Got it" loses media from the original question | All media remains visible and accessible |
| Files tab shows incomplete history | Files tab shows complete archive of all shared files |

### Why the acknowledgeAnswerMutation Already Works

The `acknowledgeAnswerMutation` (lines 839-888 in HistoryTimeline.tsx) was implemented correctly from the start - it already fetches existing metadata and spreads it before adding acknowledged fields. This same pattern just needs to be applied consistently to the other two mutations.

### Summary

This is a targeted fix that applies the existing "fetch-then-merge" pattern to two mutations that were incorrectly overwriting metadata. After this fix, all attachments and files will be preserved throughout the conversation flow, ensuring the Files tab always shows the complete archive of shared media.
