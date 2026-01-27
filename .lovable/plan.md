
## Plan: Development Cards Enhancement - COMPLETED

### Summary of Implemented Changes

| Feature | Status | Description |
|---------|--------|-------------|
| **Picture Upload** | ✅ Done | Upload or camera capture for cards and grouped products |
| **Rename "Description"** | ✅ Done | Changed to "Desired Outcome" (required field) |
| **Cross-Team Flag** | ✅ Done | New cards show distinct status for the other team |
| **Commercial Fields** | ✅ Done | FOB price, MOQ, quantity per container with container type |
| **Per-Product Images** | ✅ Done | Each product in a group can have its own picture |

---

### Database Changes Applied

1. **Storage bucket** `development-images` created with proper RLS
2. **New columns on `development_items`:**
   - `image_url` - Picture for the card
   - `created_by_role` - 'buyer' or 'trader'
   - `is_new_for_other_team` - Cross-team notification flag
   - `fob_price_usd`, `moq`, `qty_per_container`, `container_type` - Commercial data
3. **New column on `development_card_products`:**
   - `image_url` - Picture for individual products in groups

---

### Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `ImageUpload.tsx` | Created | Reusable image upload with camera support |
| `CommercialDataSection.tsx` | Created | FOB, MOQ, Qty/Container fields |
| `CreateCardModal.tsx` | Modified | Added picture field, Desired Outcome (required) |
| `ItemDetailDrawer.tsx` | Modified | Added commercial section, picture, marks seen |
| `GroupedItemsEditor.tsx` | Modified | Added picture per product |
| `DevelopmentCard.tsx` | Modified | Shows "NEW" badge for cross-team cards |

---

### Cross-Team Notification Logic

When a card is opened by the other team:
- Buyer sees cards from Trader with blue highlight + "NEW" badge
- Trader sees cards from Buyer with emerald highlight + "NEW" badge
- Opening the card automatically marks it as "seen"
