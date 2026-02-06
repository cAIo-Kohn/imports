

## Add "Solve Card" Action Button

### Overview
Add a dedicated "Solve" action button to cards so users can easily mark them as solved when they've served their purpose. The card will then disappear from "ongoing" views but remain accessible via the "Show Solved" filter.

### Current State
- `is_solved` column already exists in `development_items`
- `derived_status` is already computed from `is_solved`
- "Show Solved" toggle already filters cards correctly
- Status can be changed to "Solved" via dropdown, but it's not prominent

### Proposed Changes

#### 1. Add "Solve Card" Button in ItemDetailDrawer Header
Add a visible "Solve" button in the header area, next to the delete button:

```text
┌──────────────────────────────────────────────────────────────────┐
│  📦 Card Title Here                [Status ▼]  [✓ Solve] [🗑️]   │
└──────────────────────────────────────────────────────────────────┘
```

- **Button style**: Green accent with checkmark icon
- **Visibility**: Only show when card is NOT already solved and NOT deleted
- **Permission**: Same as `canManage` (Buyer, Trader, Admin)

#### 2. Add "Reopen" Button for Solved Cards
When viewing a solved card, show a "Reopen" button instead of "Solve":

```text
┌──────────────────────────────────────────────────────────────────┐
│  📦 Card Title Here          [Solved ✓]   [↩️ Reopen] [🗑️]      │
└──────────────────────────────────────────────────────────────────┘
```

#### 3. Create Mutation for Solving/Reopening
```typescript
const solveCardMutation = useMutation({
  mutationFn: async () => {
    const { error } = await supabase
      .from('development_items')
      .update({ 
        is_solved: true,
        // Clear any pending workflow state
        workflow_status: null,
        current_assignee_role: null,
        pending_action_type: null,
        pending_action_due_at: null,
        pending_action_snoozed_until: null,
      })
      .eq('id', item.id);
    
    // Log activity
    await supabase.from('development_card_activity').insert({
      card_id: item.id,
      user_id: user.id,
      activity_type: 'status_change',
      content: 'Card marked as solved',
      metadata: { action: 'solved' },
    });
  },
  onSuccess: () => {
    toast({ title: 'Card solved!', description: 'Card moved to solved items' });
    queryClient.invalidateQueries({ queryKey: ['development-items'] });
    onOpenChange(false); // Close drawer since card disappears from list
  },
});
```

#### 4. Visual Confirmation
- Show a brief toast: "Card solved! Use 'Show Solved' filter to view it again."
- Close the drawer automatically after solving (since the card disappears from the current view)

### UI Mockup

**Before solving (normal card):**
```text
[Title] [In Progress ▼]                    [✅ Solve] [🗑️ Delete]
```

**Solved card (when viewing via "Show Solved"):**
```text
[Title] [Solved ✓]                         [↩️ Reopen] [🗑️ Delete]
```

### Files to Modify

**1. `src/components/development/ItemDetailDrawer.tsx`**
- Import `CheckCircle2` and `RotateCw` icons
- Add `solveCardMutation` and `reopenCardMutation`
- Add Solve/Reopen button in header alongside Delete button
- When solving, clear all workflow state fields

### Edge Cases
- Cannot solve a deleted card (button hidden)
- Cannot delete a solved card (or can we? - keep delete available)
- Solving clears all pending tasks/workflows from the card
- Reopening sets `is_solved = false` but does NOT restore previous workflow state

