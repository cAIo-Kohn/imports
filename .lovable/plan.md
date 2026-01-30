

## Threaded Conversations for Development Cards

Your idea is excellent! Currently, all activities appear in a flat chronological list, which makes it hard to follow parallel conversations. A threaded system would allow:
- **Marketing discussing packaging with China** in one thread
- **Buyers negotiating pricing** in another thread
- **Quality team reviewing samples** in yet another

---

### Proposed Architecture

#### Data Model Changes

We'll add a `thread_id` concept to the activity table:

```text
development_card_activity
├── id (existing)
├── card_id (existing)
├── user_id (existing)
├── activity_type (existing)
├── content (existing)
├── metadata (existing)
├── created_at (existing)
├── thread_id (NEW) ← UUID, nullable
└── thread_root_id (NEW) ← UUID, nullable (points to first message in thread)
```

**How it works:**
- When someone posts a **new question or comment** (not a reply), it creates a new thread (thread_id = activity.id)
- When someone **replies** to that message, their activity gets the same thread_id
- `thread_root_id` always points to the original message that started the thread

---

#### Visual Design

```text
┌─────────────────────────────────────────────────────────────┐
│  TIMELINE VIEW                                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ▼ Thread: Packaging Requirements (3 replies)                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 🏷️ Marketing · João asked                            │   │
│  │ "What packaging options are available?"               │   │
│  │                                                        │   │
│  │   └─ 🏷️ Trader · Li Wei answered                      │   │
│  │      "We have 3 options: retail box, bulk, blister"   │   │
│  │                                                        │   │
│  │   └─ 🏷️ Marketing · João commented                    │   │
│  │      "We prefer retail box, can we get samples?"      │   │
│  │                                                        │   │
│  │   └─ 🏷️ Trader · Li Wei commented                     │   │
│  │      "Sample sent today via DHL"                      │   │
│  │                                                        │   │
│  │   [Reply to this thread]                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ▼ Thread: Pricing Discussion (5 replies)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 🏷️ Buyer · Maria asked                               │   │
│  │ "Can we get better FOB for 10K units?"                │   │
│  │   ...                                                  │   │
│  │   [Reply to this thread]                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ─── System Activities (compact) ───                         │
│  ○ Sample shipped · DHL · 2h ago                             │
│  ○ Commercial data updated · FOB $2.50 · Yesterday           │
│                                                              │
│  [+ Start New Thread]                                        │
└─────────────────────────────────────────────────────────────┘
```

---

### Key Features

| Feature | Description |
|---------|-------------|
| **Collapsible Threads** | Each thread can be expanded/collapsed to reduce visual noise |
| **Thread Titles** | Auto-generated from first message, or user can set custom title |
| **Visual Indentation** | Replies are indented under parent, making conversation flow clear |
| **Thread Badges** | Show reply count, participants, and last activity time |
| **Parallel Conversations** | Multiple teams can discuss different topics simultaneously |
| **Thread Isolation** | Questions/answers within a thread don't affect card ownership unless explicitly chosen |
| **System Activities Separate** | Non-conversational activities (status changes, sample updates) shown in a compact separate section |

---

### Implementation Steps

**Step 1: Database Migration**
- Add `thread_id` (UUID, nullable) to `development_card_activity`
- Add `thread_root_id` (UUID, nullable) to `development_card_activity`
- Create index on `thread_id` for fast thread grouping

```sql
ALTER TABLE development_card_activity 
ADD COLUMN thread_id UUID REFERENCES development_card_activity(id),
ADD COLUMN thread_root_id UUID REFERENCES development_card_activity(id);

CREATE INDEX idx_card_activity_thread ON development_card_activity(card_id, thread_id);
```

**Step 2: Update Activity Query Logic**
- Modify `HistoryTimeline.tsx` to group activities by `thread_id`
- Sort threads by most recent activity
- Show thread previews with expand/collapse

**Step 3: Create Thread Components**
- `ThreadCard.tsx` - Collapsible thread container
- `ThreadMessage.tsx` - Individual message within a thread
- `NewThreadButton.tsx` - Start a new thread
- `ThreadReplyBox.tsx` - Reply within a thread (simplified, no card move by default)

**Step 4: Update InlineReplyBox**
- When replying, inherit `thread_id` from parent
- Remove card move options for intra-thread replies (optional - only at thread root)

**Step 5: Maintain Backward Compatibility**
- Existing activities without `thread_id` are treated as individual threads (one message each)
- Migration script to group existing replies with their parent questions

---

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| Migration | Create | Add thread_id and thread_root_id columns |
| `ThreadCard.tsx` | Create | Collapsible thread container with header |
| `ThreadMessage.tsx` | Create | Single message within a thread |
| `HistoryTimeline.tsx` | Modify | Group activities by thread, render ThreadCards |
| `InlineReplyBox.tsx` | Modify | Pass thread_id when replying |
| `ActionsPanel.tsx` | Modify | "Start New Thread" creates new thread_id |
| `.memory/features/development/threaded-conversations.md` | Create | Document the threading system |

---

### User Experience Flow

1. **Start a new thread**: User clicks "Start New Thread" → types question/comment → posts
2. **Reply in thread**: User clicks "Reply" on any message in thread → reply appears indented below
3. **View threads**: Threads are collapsed by default showing: title, participant avatars, reply count, last activity
4. **Expand thread**: Click thread header to see all messages
5. **Card ownership**: Only "Answer & Move" from the thread root question triggers card movement

---

### Benefits

- **Clarity**: Parallel conversations don't get mixed up
- **Organization**: Related messages stay together
- **Scalability**: Cards with 50+ activities become manageable
- **Team Collaboration**: Multiple teams can work on different aspects simultaneously
- **History**: Easy to review what was discussed on a specific topic

