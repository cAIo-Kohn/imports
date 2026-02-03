
# Grouped Items: Per-Item Management for Samples & Commercial Data

## Summary
Enhance grouped product cards (`item_group`) to support:
1. Per-item image uploads during card creation
2. Item-level sample requests and commercial data requests (with multi-select)
3. Flexible batching - items can be tracked/reviewed individually or together
4. Card description automatically lists all items in the group

## Current State Analysis

### What Exists
- `development_card_products` table stores items with `image_url` column
- `GroupedItemsEditor` allows adding/editing images AFTER card creation
- `CreateCardModal` adds products but without images during creation
- Samples link to the card via `item_id` (card-level), no product-level granularity
- Commercial data is stored on the card itself (card-level)
- Tasks don't track which specific products they relate to

### Gap
No way to:
- Upload images per product during creation
- Request samples/commercial data for specific products in a group
- Track sample/commercial workflows per product
- Batch products together for shipping or review

---

## Database Changes

### 1. Add `product_id` to `development_item_samples`
Link samples to specific products within a group:

```sql
ALTER TABLE development_item_samples
  ADD COLUMN product_id UUID REFERENCES development_card_products(id) ON DELETE SET NULL;
```

### 2. Add `product_id` to `development_card_tasks`
Allow tasks to target specific products:

```sql
ALTER TABLE development_card_tasks
  ADD COLUMN product_id UUID REFERENCES development_card_products(id) ON DELETE SET NULL;
```

### 3. Create `product_commercial_data` table
Store commercial data per product instead of per card:

```sql
CREATE TABLE public.product_commercial_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES public.development_items(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.development_card_products(id) ON DELETE CASCADE NOT NULL,
  fob_price_usd NUMERIC,
  moq INTEGER,
  qty_per_container INTEGER,
  container_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID NOT NULL,
  UNIQUE(card_id, product_id)
);

-- RLS policies
ALTER TABLE public.product_commercial_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view product_commercial_data"
  ON public.product_commercial_data FOR SELECT USING (true);

CREATE POLICY "Admins and buyers can manage product_commercial_data"
  ON public.product_commercial_data FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'buyer'));

CREATE POLICY "Traders can manage product_commercial_data"
  ON public.product_commercial_data FOR ALL
  USING (has_role(auth.uid(), 'trader'));
```

---

## UI/UX Changes

### 1. CreateCardModal - Per-Item Images

Update the group products section to include image upload per product:

```
+------------------------------------------+
| Products in this Group                    |
+------------------------------------------+
| [img] 12345 - Product A       [x remove] |
| [img] 67890 - Product B       [x remove] |
+------------------------------------------+
| [code input] [name input] [📷] [+ Add]   |
+------------------------------------------+
```

**Changes:**
- Add `imageUrl` to `GroupProduct` interface
- Add compact `ImageUpload` button next to the Add button
- Display thumbnail if image added

### 2. Card Description - Auto-List Items

When a grouped card is created, auto-generate a description section listing all items:

```
Desired Outcome: Develop new supplier for pet toys

Items in Group:
• 12345 - Rubber Ball
• 67890 - Chew Toy  
• 11111 - Pet Collar
```

### 3. RequestSampleModal - Item Selection

When called on a group card with multiple products, show item selector:

```
+------------------------------------------+
| Request Sample                           |
+------------------------------------------+
| Select Items:                            |
| [✓] Select All                           |
| ---------------------------------------- |
| [✓] 12345 - Rubber Ball      [img]       |
| [✓] 67890 - Chew Toy         [img]       |
| [ ] 11111 - Pet Collar       [img]       |
+------------------------------------------+
| Quantity: [1]                            |
| Assign to: [Trader Team ▼]               |
| Notes: [________________]                |
+------------------------------------------+
|              [Cancel] [Request & Assign] |
+------------------------------------------+
```

**Logic:**
- Fetch products from `development_card_products` for the card
- If only 1 product or it's a non-group card, skip item selection
- Create one sample record per selected product (or batched if together)

### 4. RequestCommercialDataModal - Item Selection

Same pattern as samples:

```
+------------------------------------------+
| Request Commercial Data                  |
+------------------------------------------+
| Select Items:                            |
| [✓] All Items                            |
| ---------------------------------------- |
| [✓] 12345 - Rubber Ball                  |
| [ ] 67890 - Chew Toy                     |
+------------------------------------------+
| Assign to: [Trader Team ▼]               |
| Notes: [________________]                |
+------------------------------------------+
```

### 5. AddTrackingModal - Handle Multiple Products

When shipping samples for multiple products:

```
+------------------------------------------+
| Add Tracking & Ship                      |
+------------------------------------------+
| Shipping samples for:                    |
| • 12345 - Rubber Ball (2 pcs)            |
| • 67890 - Chew Toy (1 pc)                |
+------------------------------------------+
| Courier: [DHL ▼]  Tracking: [________]   |
| Shipped: [date]   ETA: [date]            |
+------------------------------------------+
```

**Batching Logic:**
- Multiple sample records can share the same tracking number
- When adding tracking, update all related sample records together

### 6. SampleReviewModal - Batch or Individual Review

Show all products being reviewed with per-item decision option:

```
+------------------------------------------+
| Review Samples                           |
+------------------------------------------+
| Tracking: DHL - 1234567890               |
+------------------------------------------+
| Items Received:                          |
| [✓] 12345 - Rubber Ball      [Approve ▼] |
| [✓] 67890 - Chew Toy         [Reject ▼]  |
+------------------------------------------+
| Rejection Notes (if any rejected):       |
| [________________________________]       |
| Upload Report: [📎 attach]               |
+------------------------------------------+
|                      [Cancel] [Confirm]  |
+------------------------------------------+
```

### 7. FillCommercialDataModal - Per-Item Entry

Fill commercial data for each selected product:

```
+------------------------------------------+
| Fill Commercial Data                     |
+------------------------------------------+
| 12345 - Rubber Ball                      |
| FOB: [$____]  MOQ: [____]                |
| Qty/Container: [____]  Type: [40HQ ▼]    |
+------------------------------------------+
| 67890 - Chew Toy                         |
| FOB: [$____]  MOQ: [____]                |
| Qty/Container: [____]  Type: [40HQ ▼]    |
+------------------------------------------+
|                      [Cancel] [Submit]   |
+------------------------------------------+
```

### 8. CommercialDataSection - Per-Item Display

Show commercial data grid per product:

```
+------------------------------------------+
| Commercial Data                          |
+------------------------------------------+
| 12345 - Rubber Ball                      |
| FOB: $2.50 | MOQ: 1,000 | 40HQ: 5,000    |
+------------------------------------------+
| 67890 - Chew Toy                         |
| FOB: $3.20 | MOQ: 500 | 40HQ: 3,000      |
+------------------------------------------+
| 11111 - Pet Collar [Missing Data]        |
+------------------------------------------+
```

---

## Technical Implementation

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/development/ProductItemSelector.tsx` | Reusable multi-select component for products |

### Files to Modify

| File | Changes |
|------|---------|
| `CreateCardModal.tsx` | Add per-item image upload, auto-generate description |
| `RequestSampleModal.tsx` | Add product selection for groups |
| `RequestCommercialDataModal.tsx` | Add product selection for groups |
| `AddTrackingModal.tsx` | Handle multiple products, batch tracking |
| `FillCommercialDataModal.tsx` | Per-product commercial data entry |
| `SampleReviewModal.tsx` | Per-product review decisions |
| `CommercialDataSection.tsx` | Display per-product commercial data |
| `SampleTrackingSection.tsx` | Display samples grouped by product |
| `useCardTasks.ts` | Add `product_id` to task interface and queries |

### Data Flow

```text
[Request Sample for Group]
        │
        ▼
[ProductItemSelector] ──► Selected product IDs
        │
        ▼
[Create Tasks] ──► One task per product OR one task with product_ids array
        │
        ▼
[Create Sample Records] ──► Each linked to specific product_id
        │
        ▼
[Add Tracking] ──► Updates all samples with same tracking (batched)
        │
        ▼
[Review] ──► Per-product approve/reject decisions
```

---

## Edge Cases

1. **Single-product groups**: Skip item selection, behave like individual cards
2. **Non-group cards**: Existing behavior unchanged (no product selection shown)
3. **Mixed decisions**: Some products approved, some rejected - create separate review tasks for rejected items
4. **Partial commercial data**: Allow saving per-product, show completion status
5. **Adding products later**: New products can be added and requested separately

---

## Migration Strategy

1. Deploy database changes first (new columns and table)
2. Update TypeScript types from Supabase
3. Implement ProductItemSelector component
4. Update modals one by one with product selection
5. Update display sections to show per-product data

This approach is backward compatible - existing single-item cards continue working unchanged.
