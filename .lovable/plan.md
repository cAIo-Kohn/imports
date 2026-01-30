
# Card System Redesign - Implementation Status

## ✅ COMPLETED

### Phase 1: Remove Legacy MOR/ARC Code ✅
- Removed `current_owner` from DevelopmentItem type
- Removed `is_new_for_other_team` logic  
- Updated pending thread filtering to use assignment instead of `pending_for_team`
- Removed OwnershipDirection component with country flags
- Updated useRequestSample to use assignment-based system

### Phase 2: Simplify Dashboard Layout ✅
- Dashboard now shows "My Pending" and "All Cards" sections
- "My Pending" includes cards assigned to user or their role
- Replaced team-based sections (MOR/ARC) with unified layout
- "Your Turn" badge on cards assigned to current user

### Phase 3: Elevate Original Thread ✅
- `card_created` thread serves as primary conversation
- Quick actions target original thread
- InlineReplyBox supports question-to-creator reassignment

### Phase 4: Fix Assignment Handoff Rules ✅
- Question asked → can reassign to card creator
- Answer given → reassigns back to asker
- Sample requested → assigns to trader role
- Thread reassignment UI in InlineReplyBox

---

## Key Changes Summary

| Before | After |
|--------|-------|
| MOR/ARC team sections | "My Pending" / "All Cards" |
| `pending_for_team` column | `assigned_to_users` / `assigned_to_role` |
| Country flags (🇧🇷/🇨🇳) | Role-based badges |
| "Your Turn" based on team | "Your Turn" based on personal assignment |

---

## Implementation Plan

### Phase 1: Clean Up Database & Remove Legacy Code

#### 1.1 Remove dual tracking - eliminate `pending_for_team`
The `pending_for_team` column in `development_card_activity` is legacy from MOR/ARC. Replace all logic with `assigned_to_users` and `assigned_to_role`.

**Database changes:**
- Deprecate `pending_for_team` column (keep for now, stop using)
- Ensure all thread roots have `assigned_to_users` OR `assigned_to_role` set
- Migrate existing data: convert `pending_for_team = 'arc'` → `assigned_to_role = 'trader'`

**Code changes:**
- Remove all `pending_for_team` references in Development.tsx, HistoryTimeline.tsx, ThreadCard.tsx
- Remove `userTeam = isTrader ? 'arc' : 'mor'` patterns
- Replace with direct `user.id` and `userRoles` checks

#### 1.2 Remove MOR/ARC terminology
Replace "MOR" / "ARC" / "China" / "Brazil" with role-based language:
- "Your Pending" instead of "MOR Side" / "ARC Side"
- Remove country flags (🇧🇷/🇨🇳) from UI
- Remove `current_owner` from Development.tsx filtering

---

### Phase 2: Simplify Dashboard Layout

#### 2.1 New dashboard structure

```text
┌──────────────────────────────────────────────────────────────┐
│  Development Cards                          [New Card]       │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 📌 MY PENDING (3 cards)                                 │ │
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐                     │ │
│  │ │ Card 1  │ │ Card 2  │ │ Card 3  │                     │ │
│  │ │ [!]     │ │ [!]     │ │ [?]     │                     │ │
│  │ └─────────┘ └─────────┘ └─────────┘                     │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 📋 ALL CARDS (15 cards)                                 │ │
│  │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ...           │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

#### 2.2 "My Pending" calculation - simplified

A card appears in "My Pending" if the user has ANY open thread assigned to them:

```typescript
const isMyPending = (card, userId, userRoles) => {
  // Check all open threads in this card
  return card.threads.some(thread => 
    thread.status !== 'resolved' && (
      thread.assigned_to_users?.includes(userId) ||
      (thread.assigned_to_role && userRoles.includes(thread.assigned_to_role))
    )
  );
};
```

---

### Phase 3: Original Thread as Primary Conversation

#### 3.1 Elevate the original thread

When opening a card, the "card_created" thread should be:
- **Always visible at top** - Not collapsed, not mixed with other threads
- **The default interaction point** - Quick actions (Comment, Question) target this thread
- **Visually distinct** - Card title, description, and image displayed prominently

**Visual layout for card detail:**

```text
┌──────────────────────────────────────────────────────────────┐
│ PE Strap - New Supplier Development          [Status ▼]     │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 📋 MAIN DISCUSSION (Original Thread)         Assigned: 📦 Trader │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ [Image]  Title: PE Strap                                 │ │
│ │          Need to develop new supplier in China...        │ │
│ │                                                          │ │
│ │ ○ Jin: I'll check with suppliers tomorrow — 30/01 14:00  │ │
│ │ ○ Vitória: Any update? — 31/01 09:00                     │ │
│ │                                                          │ │
│ │ [Type your reply...                              ] [Send]│ │
│ │                                                          │ │
│ │ [💬 Comment]  [❓ Ask Question]  [⏰ Snooze]              │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─ Other Threads ──────────────────────────────────────────┐ │
│ │ ▸ Sample Request (Assigned: Quality)           — Open    │ │
│ │ ▸ Color Discussion (Assigned: Marketing)       — Open    │ │
│ │ ▸ Volume clarification                         — Resolved│ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ [➕ New Thread]                                              │
└──────────────────────────────────────────────────────────────┘
```

#### 3.2 Quick actions on original thread

| Action | What it does |
|--------|--------------|
| **Comment** | Posts a reply to original thread. NO ownership change. |
| **Ask Question** | Posts a question, REASSIGNS original thread to card creator. |
| **Snooze** | Sets reminder date, keeps current assignment. |
| **Upload** | Adds attachment as comment on original thread. |
| **New Thread** | Creates a SEPARATE thread (for specific topics like "Sample Request") |

---

### Phase 4: Clear Assignment & Handoff Rules

#### 4.1 Who gets assigned when

| Event | New Owner |
|-------|-----------|
| Card created | The selected user/department in "Assign to" |
| Comment added | NO CHANGE - commenter just provides info |
| Question asked | Thread reassigned to card creator |
| Question answered | Thread reassigned to question asker |
| Sample requested | Thread assigned to Trader |
| Sample shipped | Thread assigned to original requester |
| Sample arrived | Thread assigned to original requester (for review) |
| Thread resolved | Thread owner (only they can resolve) |

#### 4.2 Visual indicators on cards

```text
┌───────────────────────────┐
│ PE Strap          [3] 🔔  │  ← [3] = 3 open threads assigned to me
│ Buyer · Medium            │  
│ 📦 2 samples              │
│                           │
│ ⚡ YOUR TURN              │  ← Clear call-to-action
│ Sample Request pending    │
└───────────────────────────┘
```

---

### Phase 5: Code Changes Summary

#### Files to modify:

| File | Changes |
|------|---------|
| `Development.tsx` | Remove MOR/ARC logic, simplify "My Pending" calculation, use thread assignment only |
| `HistoryTimeline.tsx` | Separate original thread from other threads, route quick actions to original thread |
| `ThreadCard.tsx` | Remove `pending_for_team`, use only `assigned_to_users/assigned_to_role` |
| `DevelopmentCard.tsx` | Simplify pending indicator, show "Your Turn" based on thread assignment |
| `InlineReplyBox.tsx` | Add "Ask Question" → reassign to creator logic |
| `BannerQuickActions.tsx` | Wire up actions to original thread instead of creating new threads |
| `TimelineBanners.tsx` | Remove separate banner components, integrate into original thread display |
| `ThreadedTimeline.tsx` | Keep original thread separate from other threads |
| `CreateCardModal.tsx` | Already good - has assignment |

#### Database changes:
- Migrate `pending_for_team` data to `assigned_to_role`
- Add index on `assigned_to_users` for faster lookups
- Consider adding computed column or view for "my pending count"

---

### Phase 6: User Experience Flow

#### Daily workflow for a user:

1. **Login** → See "My Pending" section with cards needing action
2. **Click card** → See original thread prominently with conversation
3. **Take action:**
   - Add comment (no handoff)
   - Ask question (handoff to creator)
   - Snooze (set reminder)
   - Start new thread for specific topic
4. **Card clears from "My Pending"** when all assigned threads are resolved or reassigned

#### Example scenario:

> **Vitória (Buyer)** creates card "PE Strap Development" assigned to **Trader**
> 
> 1. Card appears in Jin's (Trader) "My Pending"
> 2. Jin comments: "I'll check suppliers" → Still Jin's turn
> 3. Jin asks question: "What's the target price?" → Now Vitória's turn
> 4. Vitória answers: "$2.50 FOB" → Now Jin's turn again
> 5. Jin snoozes for 3 days → Card grayed out until then
> 6. Jin starts new thread "Sample Request" assigned to Trader → New thread for sample tracking
> 7. Jin resolves main thread when supplier is confirmed → Original thread closed

---

## Migration Plan

1. **Week 1**: Clean up code - remove MOR/ARC references, simplify pending logic
2. **Week 2**: Elevate original thread - make it the primary interaction point
3. **Week 3**: Polish - clear indicators, smooth handoffs, test all scenarios
4. **Week 4**: User testing and refinement

---

## Summary of Key Changes

| Before | After |
|--------|-------|
| MOR/ARC team sections | "My Pending" / "All Cards" |
| `pending_for_team` column | `assigned_to_users` / `assigned_to_role` |
| Multiple banners (NewCard, Sample, Commercial) | Single "Original Thread" with inline actions |
| Actions create new threads | Actions target original thread by default |
| Unclear ownership | Clear "Your Turn" indicator with specific next action |
| Country-based thinking | Role/person-based thinking |

This redesign transforms the system from "team handoffs" to "personal task management" - exactly what you described as users logging in, seeing their pending items, clearing them, and passing to the next person.
