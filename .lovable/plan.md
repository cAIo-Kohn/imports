
## Plan: Enable Reply Threading & Acknowledgment Flow ✅ IMPLEMENTED

### Status: Complete

The reply threading and acknowledgment flow has been implemented.

### What Was Implemented

1. **InlineReplyBox updated** - Now supports replying to both questions AND answers with different actions:
   - Replying to a question: "Just Comment" or "Answer & Move to [Team]"
   - Replying to an answer: "Just Comment" or "Ask Follow-up & Move to [Team]"

2. **HistoryTimeline updated** - Added:
   - `AnswerPendingBanner` - Green banner showing when an answer is awaiting acknowledgment
   - Acknowledge mutation to mark answers as acknowledged
   - Action buttons on answer activities: "Got it", "Reply", "Snooze"
   - Acknowledged badge on answers that have been acknowledged
   - Follow-up question labels in the timeline

3. **Development.tsx updated** - Added:
   - Detection for unacknowledged answers
   - `answer_pending` as an effective pending action type

4. **PendingActionBadge updated** - Added `answer_pending` to action type labels

### Flow Summary

```text
QUESTION FLOW:
User A: Question → Card to B → User B: Answer → Card to A
                                                    ↓
                              ┌─────────────────────┴──────────────────────┐
                              ↓                     ↓                      ↓
                         [Got it]            [Reply to B]           [Follow-up Q]
                              ↓                     ↓                      ↓
                      Clears pending         Card stays          Card moves to B
                              ↓                                           ↓
                       Next action                                  Loop continues
```

