
## Plan: Fix "What's next?" Prompt Visibility for Admins and Owner Team

### Root Cause

The `showAttentionBanner` logic in `ItemDetailDrawer.tsx` is too restrictive. It only evaluates correctly for pure Buyer or Trader roles, but fails for:
1. **Admin users** who should see prompts for both teams
2. **The actual owner team** - the logic should check if the current user can act on behalf of the team that owns the card

Current logic (broken for Admin):
```typescript
showAttentionBanner={
  itemWithNewFields.is_new_for_other_team && (
    (isBuyer && itemWithNewFields.created_by_role === 'trader') ||
    (isTrader && itemWithNewFields.created_by_role === 'buyer') ||
    itemWithNewFields.current_owner === (isBuyer ? 'mor' : 'arc')
  )
}
```

### Solution

Since you confirmed the prompt should only show for the **owner team**, we need to:
1. Determine which team the current user belongs to (Admin can be either, Buyer = MOR, Trader = ARC)
2. Show the prompt when `current_owner` matches the user's team AND there's recent commercial activity

**New logic:**
- Admin: Show prompt if card is new for other team (regardless of which side)
- Buyer: Show prompt if `current_owner === 'mor'`
- Trader: Show prompt if `current_owner === 'arc'`

---

### Code Changes

**File: `src/components/development/ItemDetailDrawer.tsx`**

Update the `showAttentionBanner` prop calculation:

```typescript
// Determine if current user can see prompt for this card's owner
const userTeam = isTrader ? 'arc' : 'mor'; // Admins and Buyers act on Brazil side
const isCardWithUserTeam = itemWithNewFields.current_owner === userTeam || isAdmin;

// Show attention banner when:
// 1. Card has been marked as new for the receiving team
// 2. AND either:
//    a. The card is now with the current user's team
//    b. OR user is Admin (can act on both sides)
const shouldShowAttentionBanner = 
  itemWithNewFields.is_new_for_other_team && 
  (isAdmin || itemWithNewFields.current_owner === userTeam);
```

Then pass this to the `HistoryTimeline`:
```typescript
<HistoryTimeline
  cardId={item.id}
  cardType={cardType}
  showAttentionBanner={shouldShowAttentionBanner}
  // ... other props
/>
```

---

### Why This Works

| Scenario | Current Owner | User Role | Shows Prompt? |
|----------|---------------|-----------|---------------|
| Card moved to Brazil | `mor` | Admin | ✅ Yes (admin sees all) |
| Card moved to Brazil | `mor` | Buyer | ✅ Yes (buyer owns mor) |
| Card moved to Brazil | `mor` | Trader | ❌ No (trader owns arc) |
| Card moved to China | `arc` | Admin | ✅ Yes (admin sees all) |
| Card moved to China | `arc` | Trader | ✅ Yes (trader owns arc) |
| Card moved to China | `arc` | Buyer | ❌ No (buyer owns mor) |

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/development/ItemDetailDrawer.tsx` | Simplify `showAttentionBanner` logic to check card owner vs user's team |

---

### Technical Details

The key change extracts the banner visibility logic into clearer variables before the JSX:

```typescript
// In ItemDetailDrawer, before the return statement:

// Determine user's team affiliation
const userTeam: 'mor' | 'arc' = isTrader ? 'arc' : 'mor';

// Show prompt when card is new AND belongs to user's team (or user is admin)
const shouldShowAttentionBanner = 
  itemWithNewFields.is_new_for_other_team && 
  (isAdmin || itemWithNewFields.current_owner === userTeam);
```

This ensures:
- Traders only see prompts for ARC (China) cards
- Buyers only see prompts for MOR (Brazil) cards
- Admins see prompts for any card that's marked as new for the other team
