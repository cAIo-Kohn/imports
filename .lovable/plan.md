

## Add "New Products" Tab with Eligible Products Section

### Overview
Create a new navigation tab called "New Products" that displays development cards/items with approved samples. This tab will sit between "New Items & Samples" and "Products" in the sidebar navigation.

### Requirements
1. Add "New Products" link to sidebar navigation (between "New Items & Samples" and "Products")
2. Create a new page component for the New Products view
3. Display an "Eligible Products" section showing cards with at least one approved sample
4. Add route configuration in App.tsx

### Technical Implementation

#### 1. Create New Page: `src/pages/NewProducts.tsx`
- Query development cards that have at least one sample with `decision = 'approved'`
- Display cards in a clean list/grid format with:
  - Card title
  - Sample approval date
  - Supplier info (if available)
  - Link to open the original development card
  - Card image (if available)

#### 2. Update Sidebar: `src/components/layout/AppSidebar.tsx`
- Add "New Products" menu item between "New Items & Samples" and "Products"
- Use a suitable icon (e.g., `Sparkles` or `CheckCircle2`)
- Route: `/new-products`

#### 3. Add Route: `src/App.tsx`
- Add route for `/new-products` with appropriate role protection
- Same access as "Products" page (admin, buyer, quality, marketing, viewer)

### Data Query
```sql
-- Cards with approved samples
SELECT DISTINCT 
  c.id, c.title, c.card_type, c.image_url, c.supplier_id,
  s.decided_at as sample_approved_at
FROM development_items c
JOIN development_item_samples s ON s.item_id = c.id
WHERE s.decision = 'approved'
  AND c.deleted_at IS NULL
ORDER BY s.decided_at DESC
```

### UI Structure
```text
┌─────────────────────────────────────────────────┐
│  New Products                                   │
│  Products ready for catalog integration         │
├─────────────────────────────────────────────────┤
│                                                 │
│  Eligible Products (2)                          │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ [img] Pets   │  │ [img] Sannet │            │
│  │ Approved     │  │ Approved     │            │
│  │ 05/02/26     │  │ 28/01/26     │            │
│  │ [Open Card]  │  │ [Open Card]  │            │
│  └──────────────┘  └──────────────┘            │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Files to Create/Modify
1. **Create**: `src/pages/NewProducts.tsx` - New page component
2. **Modify**: `src/components/layout/AppSidebar.tsx` - Add menu item
3. **Modify**: `src/App.tsx` - Add route

