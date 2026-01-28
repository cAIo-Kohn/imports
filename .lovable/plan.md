
## Plan: Sample Approved Banner with Card Closing

### Overview

After a sample is approved, the timeline will display a prominent banner highlighting this milestone and suggesting the card be closed. The banner provides options to close the card (if allowed) or continue with comments/questions.

---

### Permissions Logic

| User Type | Can Close Card? |
|-----------|-----------------|
| Admin | Always |
| Card Creator (the user who opened it) | Yes |
| Other users | No (can only comment/ask) |

The system checks:
- `development_items.created_by` to identify who opened the card
- `useUserRole().isAdmin` to check admin status

---

### UI Flow

```text
┌─────────────────────────────────────────────────────────────────┐
│  SAMPLE APPROVED BANNER (Green, pulsing)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✓ Sample Approved                                              │
│  ─────────────────────                                          │
│  This item's sample has been approved. What's next?             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  [Close Card]  [Ask Question]  [Add Comment]                ││
│  │       ↑                                                     ││
│  │  Only visible to Admins or Card Creator                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  "This card was opened by [Creator Name]"                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Technical Implementation

#### 1. New Banner Component: `SampleApprovedBanner`

**File: `src/components/development/HistoryTimeline.tsx`**

Add a new banner component that:
- Shows after a `sample_approved` activity is detected
- Displays "Sample Approved - Ready to Close" message
- Shows action buttons based on permissions:
  - **Close Card**: Visible only to Admin or Card Creator
  - **Ask Question**: Opens messaging section
  - **Add Comment**: Opens messaging section
- Shows who created the card (helpful context)

```typescript
interface SampleApprovedBannerProps {
  activity: Activity;
  cardId: string;
  cardCreatedBy: string; // User ID who created the card
  onCloseCard: () => void;
  onAskQuestion: () => void;
  onAddComment: () => void;
}

function SampleApprovedBanner({
  activity,
  cardId,
  cardCreatedBy,
  onCloseCard,
  onAskQuestion,
  onAddComment,
}: SampleApprovedBannerProps) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  
  // User can close if they're admin OR they created the card
  const canClose = isAdmin || user?.id === cardCreatedBy;
  
  return (
    <div className="rounded-lg p-4 mb-4 border-2 animate-pulse bg-green-50 border-green-400">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle className="h-5 w-5 text-green-600" />
        <span className="font-medium text-green-800">
          Sample Approved - Ready to Close
        </span>
      </div>
      <p className="text-sm text-green-700 mb-3">
        The sample has been tested and approved. You can now close this card 
        or continue the discussion.
      </p>
      <div className="flex flex-wrap gap-2">
        {canClose && (
          <Button 
            variant="default" 
            size="sm"
            onClick={onCloseCard}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Close Card
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onAskQuestion}>
          <HelpCircle className="h-3 w-3 mr-1" />
          Ask Question
        </Button>
        <Button variant="outline" size="sm" onClick={onAddComment}>
          <MessageCircle className="h-3 w-3 mr-1" />
          Add Comment
        </Button>
      </div>
      {!canClose && (
        <p className="text-xs text-muted-foreground mt-3 italic">
          Only the card creator or an Admin can close this card.
        </p>
      )}
    </div>
  );
}
```

#### 2. Update `HistoryTimelineProps` Interface

Add `cardCreatedBy` prop to pass the card creator's ID:

```typescript
interface HistoryTimelineProps {
  cardId: string;
  cardType?: 'item' | 'item_group' | 'task';
  cardCreatedBy?: string; // NEW: Who created the card
  showAttentionBanner?: boolean;
  currentOwner?: 'mor' | 'arc';
  onOwnerChange?: () => void;
  onOpenSampleSection?: () => void;
  onOpenMessageSection?: (type: 'comment' | 'question') => void;
  onCloseCard?: () => void; // NEW: Callback to close the card
}
```

#### 3. Add Close Card Logic

**File: `src/components/development/HistoryTimeline.tsx`**

Add mutation for closing the card:

```typescript
const closeCardMutation = useMutation({
  mutationFn: async () => {
    if (!user?.id) throw new Error('Not authenticated');
    
    // 1. Update card status to solved
    await (supabase.from('development_items') as any)
      .update({ 
        status: 'approved',
        is_solved: true,
      })
      .eq('id', cardId);
    
    // 2. Log the activity
    await supabase.from('development_card_activity').insert({
      card_id: cardId,
      user_id: user.id,
      activity_type: 'status_change',
      content: 'Card closed - development complete',
      metadata: { new_status: 'solved', action: 'closed' },
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['development-items'] });
    queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
    toast({ title: 'Card closed', description: 'Development complete!' });
    onCloseCard?.();
  },
  onError: () => {
    toast({ title: 'Error', description: 'Failed to close card', variant: 'destructive' });
  },
});
```

#### 4. Update Banner Display Logic

In the timeline render logic, detect `sample_approved` and show the banner:

```typescript
// Find sample_approved activity (most recent)
const sampleApprovedActivity = activities.find(a => 
  a.activity_type === 'sample_approved'
);

// Check if card is already closed
const isCardClosed = /* passed from parent or check is_solved */;

// Show sample approved banner if sample was approved AND card not yet closed
const showSampleApprovedBanner = 
  sampleApprovedActivity && 
  !isCardClosed &&
  showAttentionBanner;
```

#### 5. Update `ItemDetailDrawer.tsx`

Pass the required props to `HistoryTimeline`:

```typescript
<HistoryTimeline
  cardId={item.id}
  cardType={cardType}
  cardCreatedBy={item.created_by} // NEW
  showAttentionBanner={shouldShowAttentionBanner}
  currentOwner={itemWithNewFields.current_owner || 'arc'}
  onOwnerChange={() => queryClient.invalidateQueries({ queryKey: ['development-items'] })}
  onOpenSampleSection={() => setForcedOpenSection('samples')}
  onOpenMessageSection={(type) => {
    setForcedMessageType(type);
    setForcedOpenSection('messaging');
  }}
  onCloseCard={() => onOpenChange(false)} // NEW: Close drawer when card is closed
/>
```

---

### Activity Type for Card Closed

The close action uses `status_change` activity type with metadata:
```json
{
  "new_status": "solved",
  "action": "closed"
}
```

This displays as a compact row in the timeline: "Fabio closed this card"

---

### Banner Priority

The timeline banners follow this priority order:
1. **Unresolved Question** (purple) - highest priority
2. **Sample Requested** (cyan) - for China to add tracking
3. **Sample Approved** (green) - ready to close
4. **Next Step Prompt** (sky) - after commercial data set

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/development/HistoryTimeline.tsx` | Add `SampleApprovedBanner`, close card mutation, banner logic |
| `src/components/development/ItemDetailDrawer.tsx` | Pass `cardCreatedBy` and `onCloseCard` props |

---

### Edge Cases Handled

1. **Card already closed**: Banner doesn't appear if `is_solved = true`
2. **Multiple samples**: Only triggers banner if at least one sample is approved
3. **Rejected samples**: If sample was rejected after approval, banner still shows (last state wins based on activity order)
4. **Permission denied**: Non-creator, non-admin users see message explaining they can't close

---

### Visual Design

| Element | Style |
|---------|-------|
| Banner background | `bg-green-50 dark:bg-green-950/30` |
| Border | `border-2 border-green-400 dark:border-green-600` |
| Icon | CheckCircle (green) |
| Close button | Solid green `bg-green-600 hover:bg-green-700` |
| Other buttons | Outline with green border |
