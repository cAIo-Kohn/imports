

## Plan: Two-Section Dashboard (MOR/ARC) with Smart Card Ownership

### Core Concept

Instead of organizing cards by status columns (Pending, In Progress, Waiting), we'll organize by **team ownership**:

| Section | Team | Description |
|---------|------|-------------|
| **MOR (Brazil)** | Buyers/Admins | Cards waiting for Brazil's input |
| **ARC (China)** | Traders | Cards waiting for China's action |

The **ball** determines which section holds the card. When you need a response from the other side, you "pass the ball" to them.

---

### Database Changes

#### 1. Add Card Owner Field
```sql
ALTER TABLE development_items
  ADD COLUMN current_owner TEXT DEFAULT 'arc' CHECK (current_owner IN ('mor', 'arc'));
```

#### 2. New Activity Type: Question
```sql
-- We'll use activity_type = 'question' to distinguish from comments
-- Questions always trigger card movement consideration
```

---

### Movement Logic

| Action | Current Owner | Effect |
|--------|---------------|--------|
| **Brazil creates card** | → ARC | Brazil created it, now it's on China to act |
| **ARC adds comment** | Stays ARC | Just an update, no action needed from Brazil |
| **ARC adds question** | → MOR (with prompt) | Question requires Brazil's input |
| **ARC fills FOB price** | Prompt: "Move to MOR?" | If yes → MOR; if no → stays ARC |
| **ARC links supplier** | Prompt: "Move to MOR?" | If yes → MOR; if no → stays ARC |
| **ARC sends sample** | Prompt: "Move to MOR?" | Brazil needs to receive and review |
| **MOR answers question** | → ARC | Ball back to China |
| **MOR approves/rejects** | → Solved | Card is done |

---

### UI Redesign

#### Dashboard Layout (Two Sections Side by Side)

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Development Cards                                     [+ New Card]  │
│ Track items, samples, and tasks                                     │
│ [Search...] [Priority ▼] [Type ▼] [Show Solved] [Show Deleted*]    │
├──────────────────────────────┬──────────────────────────────────────┤
│                              │                                      │
│  🇧🇷 MOR (Brazil)            │  🇨🇳 ARC (China)                     │
│  ─────────────────           │  ─────────────────                   │
│                              │                                      │
│  Cards waiting for           │  Cards waiting for                   │
│  Brazil's input              │  China's action                      │
│                              │                                      │
│  ┌───────────────────┐       │  ┌───────────────────┐               │
│  │ [NEW] PE Strap    │       │  │ Pet Bowl Line     │               │
│  │ Raw Material      │       │  │ Final Product     │               │
│  │ ARC quoted $0.15  │       │  │ Pending           │               │
│  └───────────────────┘       │  └───────────────────┘               │
│                              │                                      │
│  ┌───────────────────┐       │  ┌───────────────────┐               │
│  │ Packaging Tape    │       │  │ Label Supplier    │               │
│  │ Question pending  │       │  │ In Progress       │               │
│  └───────────────────┘       │  └───────────────────┘               │
│                              │                                      │
└──────────────────────────────┴──────────────────────────────────────┘
```

#### Activity Tab: Comments vs Questions

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Activity                                                            │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 💬 Add Comment                    ❓ Ask Question               │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ [Write your message here...]                                    │ │
│ │                                            [Send Comment]       │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ Timeline:                                                           │
│ ─────────                                                           │
│                                                                     │
│ [Avatar] Trader Wang - Jan 28, 2026 at 10:00                        │
│ 💬 commented:                                                       │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ "Ok, we'll start looking for factories. Will update soon."      │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ [Avatar] Trader Wang - Jan 29, 2026 at 15:30                        │
│ ❓ asked a question:                               [Card → MOR]     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ "Found 3 factories. What volume do you buy per year?"           │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ [Avatar] John Doe - Jan 30, 2026 at 09:00                           │
│ 💬 replied:                                        [Card → ARC]     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ "Around 500,000 units/year"                                     │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Movement Prompt Modal

When ARC fills FOB price/supplier OR posts a question:

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     Move Card to MOR?                               │
│                                                                     │
│  You've added commercial data / asked a question.                   │
│  Does this require input from the Brazil team?                      │
│                                                                     │
│  ┌────────────────────┐     ┌────────────────────┐                  │
│  │   Yes, move to MOR │     │   No, keep with ARC│                  │
│  └────────────────────┘     └────────────────────┘                  │
│                                                                     │
│  Card will appear in MOR's section if you select "Yes".             │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| Database migration | Create | Add `current_owner` column |
| `src/pages/Development.tsx` | Modify | Replace Kanban with two-section layout |
| `src/components/development/TeamSection.tsx` | Create | Reusable section component (MOR/ARC) |
| `src/components/development/UnifiedActivityTimeline.tsx` | Modify | Add Comment/Question toggle |
| `src/components/development/MoveCardModal.tsx` | Create | Confirmation modal for moving cards |
| `src/components/development/CommercialDataSection.tsx` | Modify | Trigger move prompt on save |
| `src/components/development/CreateCardModal.tsx` | Modify | Auto-set `current_owner` based on creator role |
| `src/components/development/DevelopmentCard.tsx` | Modify | Show "NEW" badge, owner indicator |

---

### Technical Details

#### Creation Logic
```typescript
// In CreateCardModal.tsx
const creatorRole = isBuyer ? 'buyer' : 'trader';
const initialOwner = creatorRole === 'buyer' ? 'arc' : 'mor';

// When Brazil (buyer) creates → goes to ARC
// When China (trader) creates → goes to MOR
```

#### Question Activity Type
```typescript
// New activity type for questions
await supabase.from('development_card_activity').insert({
  card_id: cardId,
  user_id: user.id,
  activity_type: 'question', // Distinguished from 'comment'
  content: questionText,
});

// Questions always trigger the move prompt
```

#### Move Card Function
```typescript
const moveCardToTeam = async (cardId: string, targetOwner: 'mor' | 'arc') => {
  await supabase.from('development_items')
    .update({ 
      current_owner: targetOwner,
      is_new_for_other_team: true, // Reset notification flag
    })
    .eq('id', cardId);

  // Log the movement
  await supabase.from('development_card_activity').insert({
    card_id: cardId,
    user_id: user.id,
    activity_type: 'ownership_change',
    content: `Card moved to ${targetOwner === 'mor' ? 'MOR (Brazil)' : 'ARC (China)'}`,
    metadata: { new_owner: targetOwner },
  });
};
```

#### Commercial Data Save with Prompt
```typescript
// In CommercialDataSection.tsx - after saving FOB price or supplier
const handleSaveWithPrompt = (fieldName: string) => {
  // Check if this is a significant field that might require MOR input
  const significantFields = ['fob_price_usd', 'supplier_id'];
  
  if (significantFields.includes(fieldName) && isTrader && currentOwner === 'arc') {
    setShowMovePrompt(true);
  }
};
```

---

### Status Within Sections

Cards still have status (Pending, In Progress, Waiting, Solved), but they're grouped by owner first:

```text
MOR (Brazil)                     ARC (China)
├── Pending (2)                  ├── Pending (5)
│   └── Card A                   │   ├── Card X
│   └── Card B                   │   ├── Card Y
├── In Progress (1)              │   └── ...
│   └── Card C                   ├── In Progress (3)
└── Waiting (0)                  │   └── Card Z
                                 └── Waiting (2)
```

Or simplified: just show all cards in each section with status badges.

---

### Summary

| Feature | Implementation |
|---------|----------------|
| Two sections | MOR (Brazil) and ARC (China) columns |
| Card ownership | `current_owner` field: 'mor' or 'arc' |
| Auto-assignment | Buyer creates → ARC; Trader creates → MOR |
| Comments | Don't move cards (just informational) |
| Questions | New activity type, triggers move prompt |
| Commercial data | FOB/Supplier save triggers move prompt |
| Movement | Explicit action with confirmation modal |
| Notifications | "NEW" badge when card moves to your section |

