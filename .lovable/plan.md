
# Fix "Mark Arrived" Button and Quality Team Assignment

## Problems Identified

1. **"Mark Arrived" button doesn't work** - The click handler exists but might be failing silently due to an error in the database operations
2. **Wrong team assigned for review** - When a sample arrives, the review task is assigned to the original requester, not the Quality Team
3. **Action badge shows wrong team** - Should show "Action: Quality Team" after sample arrives, not "Action: Buyer"

---

## Solution

### 1. Fix `handleMarkArrived` in `ItemDetailDrawer.tsx`

Update the function to:
- Assign the `sample_review` task to the **Quality Team** instead of the original requester
- Call `updateCardWorkflowStatus` to set workflow to `sample_arrived` with `quality` as the assignee role
- Add proper error handling and logging

**Current Code (lines 278-342):**
```typescript
const handleMarkArrived = async (task: CardTask) => {
  // ... 
  // Create a new sample_review task for the requester
  const { error: reviewTaskError } = await (supabase
    .from('development_card_tasks') as any)
    .insert({
      card_id: task.card_id,
      task_type: 'sample_review',
      status: 'pending',
      assigned_to_users: [task.created_by], // ← WRONG: Goes to requester
      assigned_to_role: null,
      // ...
    });
```

**Updated Code:**
```typescript
const handleMarkArrived = async (task: CardTask) => {
  if (!user?.id || !item) return;
  
  try {
    // Update sample status to delivered
    if (task.sample_id) {
      const { error: sampleError } = await supabase
        .from('development_item_samples')
        .update({ 
          status: 'delivered',
          actual_arrival: new Date().toISOString().split('T')[0],
        })
        .eq('id', task.sample_id);
      
      if (sampleError) throw sampleError;
    }

    // Create a new sample_review task assigned to QUALITY TEAM
    const { error: reviewTaskError } = await (supabase
      .from('development_card_tasks') as any)
      .insert({
        card_id: task.card_id,
        task_type: 'sample_review',
        status: 'pending',
        assigned_to_users: [],  // No specific users
        assigned_to_role: 'quality',  // Assign to Quality Team
        created_by: task.created_by, // Keep original requester as creator
        sample_id: task.sample_id,
        metadata: {
          ...task.metadata,
          actual_arrival: new Date().toISOString().split('T')[0],
          marked_arrived_by: user.id,
        },
      });

    if (reviewTaskError) throw reviewTaskError;

    // Mark original sample_request task as completed
    await updateTask({
      taskId: task.id,
      status: 'completed',
      completed_by: user.id,
      metadata: {
        ...task.metadata,
        actual_arrival: new Date().toISOString().split('T')[0],
        marked_arrived_by: user.id,
      },
    });

    // Update workflow status - ball goes to QUALITY TEAM
    await updateCardWorkflowStatus(
      task.card_id,
      'sample_arrived',
      user.id,
      'Sample arrived - awaiting quality team review',
      'buyer',    // from
      'quality',  // to (Quality Team takes over for review)
      task.id
    );

    // Log to timeline
    await supabase.from('development_card_activity').insert({
      card_id: task.card_id,
      user_id: user.id,
      activity_type: 'message',
      content: '📬 Sample arrived - assigned to Quality Team for review',
      metadata: { 
        task_id: task.id, 
        sample_id: task.sample_id, 
        task_type: 'sample_arrived',
        assigned_to_role: 'quality',
      },
    });

    // Send notification to Quality Team
    await sendTaskNotification({
      recipientRole: 'quality',
      triggeredBy: user.id,
      cardId: task.card_id,
      taskId: task.id,
      type: 'sample_review',
      title: '{name} marked a sample as arrived',
      content: `Sample for "${item.title}" is ready for quality review`,
    });

    queryClient.invalidateQueries({ queryKey: ['card-tasks', task.card_id] });
    queryClient.invalidateQueries({ queryKey: ['development-card-activity', task.card_id] });
    queryClient.invalidateQueries({ queryKey: ['development-item-samples', task.card_id] });
    queryClient.invalidateQueries({ queryKey: ['development-items'] });
    toast({ title: 'Sample marked as arrived - Quality Team notified' });
  } catch (error) {
    console.error('Failed to mark arrived:', error);
    toast({ title: 'Error', description: 'Failed to update sample', variant: 'destructive' });
  }
};
```

### 2. Import `updateCardWorkflowStatus` in ItemDetailDrawer

Add the import at the top of the file:
```typescript
import { updateCardWorkflowStatus } from '@/hooks/useCardWorkflow';
```

### 3. Update `SampleReviewSection.tsx` - Quality Team Context

Update the rejection workflow to properly track that Quality rejected it:
- On rejection, the workflow should go back to Trader (as already implemented)
- On approval, clear the workflow status (as already implemented)

### 4. Update `ResponsibilityBadge.tsx` to Handle Quality Role

Ensure the badge shows correct styling for Quality Team:
```typescript
const colorClasses = currentAssigneeRole === 'trader'
  ? 'bg-red-500 text-white border-red-600'
  : currentAssigneeRole === 'buyer'
    ? 'bg-amber-500 text-white border-amber-600'
    : currentAssigneeRole === 'quality'
      ? 'bg-teal-500 text-white border-teal-600'  // Add Quality color
      : 'bg-purple-500 text-white border-purple-600';
```

---

## Complete Workflow After Fix

```text
1. Buyer requests sample
   → RequestSampleModal calls updateWorkflow('sample_requested')
   → Badge shows: "Action: Trader" (Red)

2. Trader adds tracking  
   → AddTrackingModal calls updateWorkflow('sample_tracking_added')
   → Badge shows: "Action: Buyer" (Amber)

3. Buyer clicks "Mark Arrived"
   → handleMarkArrived creates sample_review task for Quality Team
   → updateWorkflow('sample_arrived', ..., 'quality')
   → Badge shows: "Action: Quality Team" (Teal)

4a. Quality approves
   → SampleReviewSection clears workflow
   → Badge disappears (no active workflow)

4b. Quality rejects
   → SampleReviewSection calls updateWorkflow('sample_requested', ..., 'trader')
   → Badge shows: "Action: Trader" (Red) - needs new sample
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/development/ItemDetailDrawer.tsx` | Import `updateCardWorkflowStatus`, update `handleMarkArrived` to assign Quality Team and update workflow |
| `src/components/development/ResponsibilityBadge.tsx` | Add teal color for Quality Team |

---

## Summary

The fix ensures:
1. "Mark Arrived" button works correctly and creates a `sample_review` task
2. Sample review tasks are assigned to the **Quality Team** (`assigned_to_role: 'quality'`)
3. The "Action" badge correctly shows "Action: Quality Team" with a teal color
4. Quality Team receives notifications when samples arrive
5. After Quality approves/rejects, the workflow continues or restarts appropriately
