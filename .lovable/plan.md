

## Product Selection for Grouped Items - Sample & Commercial Data Requests

### Overview
When a development card contains multiple products (item_group), users need to select which specific items they want samples or commercial data for. The workflow remains the same, but now includes product context throughout the entire flow.

### Current State
- `development_card_tasks` already has a `product_id` column (uuid, nullable)
- `development_card_products` table stores products within grouped cards
- Request modals don't show product selection
- Task displays don't show which product the task is for

### New Behavior
1. When opening Request Sample or Request Commercial Data modal on a grouped card:
   - Fetch products from `development_card_products`
   - Show product selector: "All Items" or individual products (multi-select)
   - If only 1 product or single-item card: skip selection, behave as today

2. Task creation stores selected products:
   - Single product: set `product_id` on the task
   - Multiple/All: store `product_ids` array in metadata

3. All displays show product context:
   - PendingTasksBanner → TaskCard shows product name(s)
   - SampleTrackingSection history shows product name(s)
   - CommercialHistoryTimeline shows product name(s)
   - Activity log messages include product names

---

### Technical Changes

#### 1. Update `RequestSampleModal.tsx`

**Add product fetching and selection:**
```tsx
// Fetch products for this card (for item_groups)
const { data: cardProducts = [] } = useQuery({
  queryKey: ['card-products', cardId],
  queryFn: async () => {
    const { data } = await supabase
      .from('development_card_products')
      .select('id, product_code, product_name, image_url')
      .eq('card_id', cardId)
      .order('created_at');
    return data || [];
  },
});

const isGroupedCard = cardProducts.length > 1;
const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
const [selectAll, setSelectAll] = useState(true);
```

**Add product selector UI (only shown for grouped cards):**
- Checkbox list with product names/codes
- "Select All" option at top
- Show product image thumbnails if available

**Update task creation:**
```tsx
metadata: {
  ...existingMetadata,
  product_ids: selectAll ? cardProducts.map(p => p.id) : selectedProductIds,
  product_names: selectAll 
    ? cardProducts.map(p => p.product_name || p.product_code) 
    : selectedProductIds.map(id => cardProducts.find(p => p.id === id)?.product_name),
  is_all_products: selectAll,
}
```

#### 2. Update `RequestCommercialDataModal.tsx`

Same pattern as sample modal:
- Fetch card products
- Show selector if grouped card
- Store selected products in metadata

#### 3. Update `TaskCard.tsx`

**Display product context in task cards:**
```tsx
// Extract product info from metadata
const productNames = metadata.product_names as string[] | undefined;
const isAllProducts = metadata.is_all_products as boolean | undefined;

// Show in task card
{productNames && productNames.length > 0 && (
  <div className="text-xs text-muted-foreground">
    📦 {isAllProducts ? 'All items' : productNames.join(', ')}
  </div>
)}
```

#### 4. Update `FillCommercialDataModal.tsx`

**Display which products this request is for:**
```tsx
// In DialogDescription or header area
const productNames = (task.metadata?.product_names as string[]) || [];
const isAllProducts = task.metadata?.is_all_products as boolean;

<DialogDescription>
  {isAllProducts 
    ? 'Commercial data for all items in this group'
    : `Commercial data for: ${productNames.join(', ')}`}
</DialogDescription>
```

#### 5. Update `AddTrackingModal.tsx`

**Display product context:**
- Show which products this sample shipment is for
- Include in the shipped notification

#### 6. Update `SampleTrackingSection.tsx` (Sample History)

**Show product names in sample cards:**
```tsx
// In SampleHistoryCard
const productNames = sample.metadata?.product_names as string[] | undefined;
{productNames && (
  <div className="text-[10px] text-muted-foreground">
    {productNames.join(', ')}
  </div>
)}
```

#### 7. Update `CommercialHistoryTimeline.tsx`

**Show product names in commercial data cards:**
- Extract product_names from task metadata
- Display alongside data summary

#### 8. Update Timeline Activity Messages

When logging activities, include product context:
```tsx
const productLabel = isAllProducts 
  ? '(all items)' 
  : productNames?.length 
    ? `(${productNames.join(', ')})` 
    : '';

content: `📦 Requested ${quantity} sample(s) ${productLabel}${notes ? `: "${notes}"` : ''}`,
```

---

### UI Layout for Product Selector

```text
┌─────────────────────────────────────────┐
│ Request Sample                          │
│ ─────────────────────────────────────── │
│ Select Products:                        │
│ ┌─────────────────────────────────────┐ │
│ │ [✓] All Items (3)                   │ │
│ │ ─────────────────────────────────── │ │
│ │ [✓] 🖼️ Product A - SKU001         │ │
│ │ [✓] 🖼️ Product B - SKU002         │ │
│ │ [✓] 🖼️ Product C - SKU003         │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Quantity: [1] per selected item         │
│                                         │
│ Assign to: [Trader ▼]                   │
│                                         │
│ Notes: [________________________]       │
│                                         │
│             [Cancel] [Request & Assign] │
└─────────────────────────────────────────┘
```

---

### Files to Modify

1. `src/components/development/RequestSampleModal.tsx` - Add product selection
2. `src/components/development/RequestCommercialDataModal.tsx` - Add product selection
3. `src/components/development/TaskCard.tsx` - Display product names
4. `src/components/development/FillCommercialDataModal.tsx` - Show product context
5. `src/components/development/AddTrackingModal.tsx` - Show product context
6. `src/components/development/SampleTrackingSection.tsx` - Show products in history
7. `src/components/development/CommercialHistoryTimeline.tsx` - Show products in history

### Files to Create

1. `src/components/development/ProductSelector.tsx` - Reusable product selection component

---

### Data Flow

1. **Request Phase**: User selects products → stored in task metadata as `product_ids` and `product_names`
2. **Action Phase**: Assignee sees product context in TaskCard and action modals
3. **History Phase**: Sample/Commercial history shows which products were involved
4. **Multiple Flows**: Can have multiple sample flows running for different products simultaneously

