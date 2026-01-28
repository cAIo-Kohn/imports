

## Plan: Inline Timeline Replies with Conditional Card Movement

### Summary

This plan restructures the reply workflow to be more intuitive and context-specific. Instead of opening the "Add Comment / Ask Question" accordion when clicking "Reply" on a question, users will see an inline reply box directly within the timeline, attached to the specific question being answered.

---

### Key Workflow Changes

| Action | Location | Card Moves? |
|--------|----------|-------------|
| **Comment** (general) | Opens accordion tab | No |
| **Ask Question** (new) | Opens accordion tab | Prompts to move |
| **Reply to Question** | Inline in Timeline | Two options: "Comment" (no move) or "Answer" (moves card) |

---

### User Experience Flow

#### Replying to a Question (new inline flow):
1. User clicks "Reply" on a question in the timeline
2. An inline reply box appears directly below the question
3. User types their response
4. User chooses:
   - **Just Comment** - "Give me 5 days and I'll let you know" - card stays
   - **Answer & Move** - "The price is $2.50" - card moves to other team + question marked as resolved

---

### Visual Design

```text
┌─────────────────────────────────────────────────────────────────┐
│ ? Caio Kohn asked a question • 17:39                            │
│   "What is the expected annual volume for this product?"        │
│                                                                 │
│   [Mark as Resolved]                                            │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ Type your reply...                                      │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   [Just Comment]  [Answer & Move Card →]                        │
└─────────────────────────────────────────────────────────────────┘
```

---

### Component Changes

#### 1. Rename "History" to "Timeline"

**File:** `ItemDetailDrawer.tsx`
- Change heading text from "History" to "Timeline"

---

#### 2. Add Inline Reply Component

**File:** `HistoryTimeline.tsx`

Create a new `InlineReplyBox` component:

```typescript
interface InlineReplyBoxProps {
  questionId: string;
  cardId: string;
  currentOwner: 'mor' | 'arc';
  onClose: () => void;
  onCardMove?: () => void;
}

function InlineReplyBox({ questionId, cardId, currentOwner, onClose, onCardMove }: InlineReplyBoxProps) {
  const [replyContent, setReplyContent] = useState('');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Reply as comment (no move)
  const handleCommentReply = async () => {
    // Insert activity with type 'comment' and metadata linking to question
    await supabase.from('development_card_activity').insert({
      card_id: cardId,
      user_id: user.id,
      activity_type: 'comment',
      content: replyContent,
      metadata: { reply_to_question: questionId },
    });
    // Close reply box, do NOT move card
  };
  
  // Reply as answer (moves card + resolves question)
  const handleAnswerReply = async () => {
    // Insert activity with type 'answer' and metadata
    await supabase.from('development_card_activity').insert({
      card_id: cardId,
      user_id: user.id,
      activity_type: 'answer',
      content: replyContent,
      metadata: { reply_to_question: questionId },
    });
    
    // Mark question as resolved
    await supabase.from('development_card_activity')
      .update({ metadata: { resolved: true, resolved_at: new Date().toISOString(), resolved_by: user.id } })
      .eq('id', questionId);
    
    // Move card to other team
    const targetOwner = currentOwner === 'arc' ? 'mor' : 'arc';
    await supabase.from('development_items')
      .update({ current_owner: targetOwner, is_new_for_other_team: true })
      .eq('id', cardId);
    
    // Log ownership change
    await supabase.from('development_card_activity').insert({
      card_id: cardId,
      user_id: user.id,
      activity_type: 'ownership_change',
      content: `Card moved to ${targetOwner === 'mor' ? 'MOR (Brazil)' : 'ARC (China)'}`,
    });
    
    onCardMove?.();
  };
  
  return (
    <div className="mt-3 p-3 bg-slate-50 rounded-lg border">
      <Textarea
        value={replyContent}
        onChange={(e) => setReplyContent(e.target.value)}
        placeholder="Type your reply..."
        rows={2}
        autoFocus
      />
      <div className="flex gap-2 mt-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="outline" size="sm" onClick={handleCommentReply}>
          Just Comment
        </Button>
        <Button size="sm" onClick={handleAnswerReply}>
          Answer & Move Card
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}
```

---

#### 3. Track Reply State in Timeline

**File:** `HistoryTimeline.tsx`

Add state for which question has the reply box open:

```typescript
const [replyingToId, setReplyingToId] = useState<string | null>(null);

// In the question activity render:
{isQuestion && !isResolved && (
  <div className="flex gap-2 mt-2">
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setReplyingToId(activity.id)}
    >
      <Reply className="h-3 w-3 mr-1" />
      Reply
    </Button>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => resolveQuestionMutation.mutate(activity.id)}
    >
      <Check className="h-3 w-3 mr-1" />
      Mark as Resolved
    </Button>
  </div>
)}

{replyingToId === activity.id && (
  <InlineReplyBox
    questionId={activity.id}
    cardId={cardId}
    currentOwner={currentOwner}
    onClose={() => setReplyingToId(null)}
    onCardMove={onOwnerChange}
  />
)}
```

---

#### 4. Update HistoryTimeline Props

**File:** `HistoryTimeline.tsx`

Add new props needed for inline replies:

```typescript
interface HistoryTimelineProps {
  cardId: string;
  cardCreatedAt: string;
  creatorName?: string;
  showAttentionBanner?: boolean;
  currentOwner?: 'mor' | 'arc';  // NEW - needed for move logic
  onOwnerChange?: () => void;    // NEW - callback after card moves
}
```

---

#### 5. Update ItemDetailDrawer

**File:** `ItemDetailDrawer.tsx`

- Rename "History" heading to "Timeline"
- Pass `currentOwner` and `onOwnerChange` to `HistoryTimeline`
- Remove `onReplyToQuestion` prop (no longer opens accordion)

```typescript
<h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide pt-4 pb-2 sticky top-0 bg-background">
  Timeline
</h4>
<HistoryTimeline
  cardId={item.id}
  cardCreatedAt={item.created_at}
  creatorName={creatorProfile?.full_name || creatorProfile?.email || undefined}
  showAttentionBanner={...}
  currentOwner={itemWithNewFields.current_owner || 'arc'}
  onOwnerChange={() => queryClient.invalidateQueries({ queryKey: ['development-items'] })}
/>
```

---

#### 6. Update Attention Banner

**File:** `HistoryTimeline.tsx`

Change the "Reply" button in the attention banner to open the inline reply box instead of calling `onReplyToQuestion`:

```typescript
{isQuestion && (
  <Button 
    size="sm" 
    variant="outline"
    onClick={() => setReplyingToId(activity.id)}
    className="..."
  >
    <Reply className="h-3 w-3 mr-1" />
    Reply
  </Button>
)}
```

---

#### 7. Add New Activity Type: "answer"

**File:** `HistoryTimeline.tsx`

Add styling for the new "answer" activity type:

```typescript
const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  // ... existing
  answer: <Reply className="h-3.5 w-3.5" />,
};

const ACTIVITY_STYLES: Record<string, string> = {
  // ... existing
  answer: 'bg-green-100 text-green-700 border-green-200',
};

const ACTIVITY_LABELS: Record<string, string> = {
  // ... existing
  answer: 'answered',
};
```

---

#### 8. Clean Up ActionsPanel

**File:** `ActionsPanel.tsx`

- Remove the `focusReply` exposed method (no longer needed)
- Keep the comment/question tabs for NEW comments and questions (not replies)

---

### Files to Modify

| File | Changes |
|------|---------|
| `HistoryTimeline.tsx` | Add `InlineReplyBox` component, reply state, new props, "answer" activity type |
| `ItemDetailDrawer.tsx` | Rename to "Timeline", pass `currentOwner` and `onOwnerChange`, remove `onReplyToQuestion` |
| `ActionsPanel.tsx` | Remove `focusReply` method and ref logic (can be simplified) |

---

### Activity Types Summary

| Type | Created By | Card Moves? |
|------|------------|-------------|
| `comment` | General comment or reply-comment | No |
| `question` | New question asking for info | Prompts to move |
| `answer` | Direct answer to a question | Yes (auto) + resolves question |

---

### Keyboard Shortcut Update

The "R" keyboard shortcut will now:
1. Find the first unresolved question in the timeline
2. Open the inline reply box for that question
3. Auto-focus the textarea

