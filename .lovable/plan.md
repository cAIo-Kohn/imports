
## Plan: Enhance Development Cards with Pictures, Cross-Team Notifications & Commercial Fields

### Summary of Changes

Based on your requirements, here's what we'll implement:

| Feature | Description |
|---------|-------------|
| **Picture Upload** | Upload or camera capture for cards and grouped products |
| **Rename "Description"** | Change to "Desired Outcome" (required field) |
| **Cross-Team Flag** | New cards show distinct status for the other team |
| **Commercial Fields** | FOB price, MOQ, quantity per container with container type |
| **Enhanced Activity** | Comments and tracking in the existing activity timeline |

---

### Database Changes

#### 1. Create Storage Bucket for Development Images
```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('development-images', 'development-images', true);

-- RLS policies for the bucket
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'development-images');

CREATE POLICY "Anyone can view images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'development-images');

CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'development-images');
```

#### 2. Add New Columns to `development_items`
```sql
ALTER TABLE development_items
  ADD COLUMN image_url TEXT,                    -- Picture for individual items
  ADD COLUMN created_by_role TEXT,              -- 'buyer' or 'trader' to know origin
  ADD COLUMN is_new_for_other_team BOOLEAN DEFAULT true,  -- Flag for cross-team notification
  ADD COLUMN fob_price_usd NUMERIC,             -- FOB price (set by trader)
  ADD COLUMN moq INTEGER,                       -- Minimum order quantity
  ADD COLUMN qty_per_container INTEGER,         -- Quantity per container
  ADD COLUMN container_type TEXT;               -- '20ft', '40ft', '40hq'
```

#### 3. Add Image Column to `development_card_products` (for grouped items)
```sql
ALTER TABLE development_card_products
  ADD COLUMN image_url TEXT;  -- Picture for individual products within a group
```

---

### UI Changes

#### 1. CreateCardModal.tsx - Enhanced Form

**For Individual Items:**
- Add "Desired Outcome" (required) - renamed from Description
- Add Picture upload/camera button
- Keep Priority and Due Date

**For Grouped Items:**
- Group-level picture (optional)
- Each product in the group can have its own picture (in the "Items" tab after creation)

**Field Order:**
```text
Product Category: [Final Product / Raw Material] *
Item Type: [Individual / Group]
Title: _______________
Product Code: _______________ (individual only)
Picture: [Upload] [Camera]
Desired Outcome: _______________ * (required)
Supplier: [dropdown]
Priority: [dropdown]
Due Date: [date picker]
```

#### 2. Cross-Team Notification System

**How it works:**
1. When Brazil (buyer) creates a card → `created_by_role = 'buyer'` and `is_new_for_other_team = true`
2. When China (trader) views Kanban → cards with `is_new_for_other_team = true` AND `created_by_role = 'buyer'` show with a distinct "NEW" badge
3. When trader opens the card → mark `is_new_for_other_team = false`
4. Vice versa for trader-created cards viewed by buyers

**Visual Indicator:**
- Cards created by the other team show with:
  - A pulsing "NEW" badge
  - Highlighted border (e.g., blue glow for buyer-created, green for trader-created)

#### 3. ItemDetailDrawer.tsx - Enhanced Details Tab

**Add new "Commercial" section (visible after card is created):**
```text
┌─────────────────────────────────────────┐
│ Details | Items | Samples | Activity    │
├─────────────────────────────────────────┤
│ DESIRED OUTCOME                         │
│ [Develop a new supplier in China...]    │
│                                         │
│ PICTURE                                 │
│ [thumbnail] [Change] [Remove]           │
│                                         │
│ ─────────── COMMERCIAL DATA ──────────  │
│ FOB Price (USD):  $_______              │
│ MOQ:              _______               │
│ Qty/Container:    _______ [20ft ▼]      │
│                                         │
│ Priority: [Medium ▼]   Due: [date]      │
│ Supplier: [name]                        │
└─────────────────────────────────────────┘
```

#### 4. GroupedItemsEditor.tsx - Add Picture per Product

Each product in a group can have its own picture:
```text
┌─────────────────────────────────────────┐
│ [+ Add Product]                         │
├─────────────────────────────────────────┤
│ [🖼️] ABC123 - Pet Bowl          [X]     │
│ [🖼️] ABC124 - Pet Feeder        [X]     │
│ [📷] DEF456 - Pet Water Bottle  [X]     │
└─────────────────────────────────────────┘
```
- 🖼️ = has image (click to view/change)
- 📷 = no image (click to add)

---

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| Database migration | Create | Storage bucket + new columns |
| `src/components/development/ImageUpload.tsx` | Create | Reusable image upload component with camera support |
| `src/components/development/CreateCardModal.tsx` | Modify | Add picture field, rename Description → Desired Outcome, mark as required |
| `src/components/development/ItemDetailDrawer.tsx` | Modify | Add commercial fields section, show/edit picture |
| `src/components/development/GroupedItemsEditor.tsx` | Modify | Add picture per product |
| `src/components/development/DevelopmentCard.tsx` | Modify | Show "NEW" badge for cross-team cards |
| `src/components/development/CommercialDataSection.tsx` | Create | Component for FOB, MOQ, Qty/Container fields |
| `src/pages/Development.tsx` | Modify | Mark cards as "seen" when opened, pass origin info |

---

### Technical Details

#### Image Upload Component
```typescript
// ImageUpload.tsx - handles both file upload and camera
interface ImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  folder: string; // 'cards' or 'products'
}

// Uses Supabase Storage API:
// - Upload: supabase.storage.from('development-images').upload(path, file)
// - URL: supabase.storage.from('development-images').getPublicUrl(path)
```

#### Cross-Team Detection Logic
```typescript
// In DevelopmentCard.tsx
const isNewForMe = item.is_new_for_other_team && (
  (isBuyer && item.created_by_role === 'trader') ||
  (isTrader && item.created_by_role === 'buyer')
);

if (isNewForMe) {
  // Show "NEW" badge and highlight
}
```

#### Container Type Options
```typescript
const CONTAINER_TYPES = [
  { value: '20ft', label: '20ft Container' },
  { value: '40ft', label: '40ft Container' },
  { value: '40hq', label: '40ft High Cube' },
];
```

---

### Workflow Example

**Scenario: Brazil creates a PE Strap card**

1. **Brazil Buyer creates card:**
   - Category: Raw Material
   - Type: Individual
   - Title: "PE Strap"
   - Picture: [uploads photo]
   - Desired Outcome: "Develop a new supplier in China for this item"
   - Priority: Medium
   - Due Date: Feb 15, 2026

2. **Card saved with:**
   - `created_by_role = 'buyer'`
   - `is_new_for_other_team = true`

3. **China Trader sees the card:**
   - Card has "NEW" badge + highlighted border
   - Clicks to open → badge disappears (marked as seen)
   - Adds comment: "ok, I'll start looking for factories. What volume do you buy per year?"
   - Later fills in: FOB $0.15, MOQ 100,000 pcs, 50,000/container (40ft)
   - Adds sample tracking when ready

4. **Brazil sees updates in Activity tab**

---

### Summary

| Change | Impact |
|--------|--------|
| Storage bucket for images | Pictures can be uploaded/viewed |
| "Desired Outcome" field | Clearer purpose, required for items |
| Cross-team flag | Each side knows when new demands arrive |
| Commercial fields | Traders can provide pricing/MOQ/container info |
| Per-product images in groups | Flexible image attachment for groups |
