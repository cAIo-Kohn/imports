
## Plan: Enable Reply Threading & Acknowledgment Flow

### Current Behavior
1. User A asks a question, card moves to the other team
2. User B answers, card moves back, question is marked as "resolved"
3. Conversation ends - User A cannot continue the thread

### Proposed Behavior
1. User A asks a question, card moves to the other team
2. User B answers, card moves back to User A
3. **User A can now:**
   - **Acknowledge** (checkmark): Confirms the answer was sufficient, clears the pending action, and the system highlights the next required action
   - **Reply/Ask Follow-up**: Opens a reply box to continue the conversation or ask more questions
   - **Comment**: Add a simple comment without moving the card
   - **Snooze**: Delay the action to a specific date

4. If User A acknowledges:
   - The answer is marked as "accepted"
   - The system checks for outstanding requirements (commercial data, samples, etc.)
   - A "What's next?" prompt appears if there's a pending action

### Visual Flow

```text
QUESTION FLOW (Current):
User A: Question → Card to B → User B: Answer → Card to A → [END]

QUESTION FLOW (Proposed):
User A: Question → Card to B → User B: Answer → Card to A
                                                    ↓
                              ┌─────────────────────┴──────────────────────┐
                              ↓                     ↓                      ↓
                         [Acknowledge]        [Reply to B]           [Follow-up Q]
                              ↓                     ↓                      ↓
                     Check Next Action        Card stays          Card moves to B
                              ↓                                           ↓
                      Show "What's next?"                           Loop continues
```

### Technical Implementation

#### 1. Add "Acknowledge Answer" Action to Timeline

In `HistoryTimeline.tsx`, add action buttons to **answer** activities (not just questions):

```tsx
// For answer activities that are awaiting acknowledgment
{isAnswer && !activity.metadata?.acknowledged && !activity.metadata?.reply_to_answer && (
  <div className="flex gap-2 mt-2 flex-wrap">
    <Button variant="ghost" size="sm" onClick={() => acknowledgeAnswer(activity.id)}>
      <Check className="h-3 w-3 mr-1" />
      Acknowledge
    </Button>
    <Button variant="ghost" size="sm" onClick={() => setReplyingToId(activity.id)}>
      <Reply className="h-3 w-3 mr-1" />
      Reply
    </Button>
    <SnoozeButton cardId={cardId} currentActionType="answer_pending" />
  </div>
)}
```

#### 2. Update `InlineReplyBox` to Support Reply-to-Answer

Modify the component to handle replies to answers, not just questions:

| Prop | Description |
|------|-------------|
| `replyToId` | ID of the activity being replied to (question OR answer) |
| `replyToType` | Type: 'question' or 'answer' |

When replying to an answer:
- **"Just Comment"**: Adds comment, keeps card with current team
- **"Ask Follow-up & Move"**: Posts a follow-up question, moves card to other team

#### 3. Add "Acknowledge Answer" Mutation

Create a new mutation to handle acknowledgment:

```tsx
const acknowledgeAnswerMutation = useMutation({
  mutationFn: async (answerId: string) => {
    // 1. Mark answer as acknowledged
    await supabase.from('development_card_activity').update({
      metadata: { acknowledged: true, acknowledged_at: new Date().toISOString(), acknowledged_by: user.id }
    }).eq('id', answerId);
    
    // 2. Clear pending action on card
    await supabase.from('development_items').update({
      pending_action_type: null,
      pending_action_due_at: null,
    }).eq('id', cardId);
    
    // 3. Compute next required action and set it
    // (commercial data missing → 'commercial_pending')
    // (sample needed → show "What's next?" prompt)
  }
});
```

#### 4. Add Answer Pending Detection

Update `Development.tsx` to detect unacknowledged answers:

```tsx
// Compute pending action: if there's an unacknowledged answer to the current user's question
if (!effectivePendingActionType) {
  const hasUnacknowledgedAnswer = cardsWithUnacknowledgedAnswers.has(item.id);
  if (hasUnacknowledgedAnswer) {
    effectivePendingActionType = 'answer_pending';
  }
}
```

#### 5. Add "Answer Pending" Banner

Create a new banner type for when an answer is awaiting acknowledgment:

```tsx
function AnswerPendingBanner({ activity, onAcknowledge, onReply }) {
  return (
    <div className="rounded-lg p-4 mb-4 border-2 bg-green-50 border-green-300">
      <div className="flex items-center gap-2 mb-2">
        <Reply className="h-5 w-5 text-green-600" />
        <span className="font-medium text-sm text-green-800">Answer received</span>
      </div>
      {/* Answer content */}
      <div className="flex gap-2 mt-3">
        <Button size="sm" onClick={onAcknowledge}>
          <Check className="h-3 w-3 mr-1" /> Got it
        </Button>
        <Button size="sm" variant="outline" onClick={onReply}>
          <Reply className="h-3 w-3 mr-1" /> Reply
        </Button>
        <SnoozeButton />
      </div>
    </div>
  );
}
```

#### 6. Next Action Highlighting After Acknowledgment

When an answer is acknowledged, check for outstanding requirements:

```tsx
const getNextRequiredAction = (card) => {
  // Priority order:
  if (!card.fob_price_usd || !card.moq || !card.qty_per_container) {
    return { type: 'commercial', message: 'Commercial data is incomplete' };
  }
  if (hasPendingSampleRequest) {
    return { type: 'sample', message: 'Sample needs to be requested or tracked' };
  }
  return null; // No urgent action, show "What's next?" prompt
};
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/development/HistoryTimeline.tsx` | Add answer action buttons, answer banner, acknowledge mutation |
| `src/components/development/InlineReplyBox.tsx` | Support reply-to-answer with follow-up question option |
| `src/pages/Development.tsx` | Add unacknowledged answer detection for pending action indicator |
| `src/components/development/DevelopmentCard.tsx` | Handle 'answer_pending' action type for indicator |

### Activity Metadata Schema Updates

| Field | Type | Description |
|-------|------|-------------|
| `acknowledged` | boolean | Whether the answer was acknowledged |
| `acknowledged_at` | timestamp | When it was acknowledged |
| `acknowledged_by` | uuid | Who acknowledged it |
| `reply_to_answer` | uuid | Link to the answer being replied to (for follow-ups) |

### User Experience Summary

**For the person who asked the question (User A):**
- Receives the answer with a green banner
- Can click "Got it" to acknowledge and move on
- Can click "Reply" to ask follow-up questions
- System automatically highlights next action after acknowledgment

**For the person who answered (User B):**
- Can see when their answer was acknowledged
- Gets notified if a follow-up question comes in
- Flow continues naturally until both sides are satisfied

### Edge Cases Handled

1. **Multiple replies**: Each reply can be acknowledged or replied to independently
2. **Commercial data incomplete**: After acknowledging, system prompts to complete commercial data
3. **Sample not sent**: After acknowledging, system prompts to request/track sample
4. **Card idle prevention**: If user acknowledges but required data is missing, system sets new pending action
