

## Step 2: Pre-filled Product Registration

### Overview
When clicking a card in Step 2 of New Products, instead of opening the ItemDetailDrawer, open the CreateProductModal pre-filled with data accumulated throughout the card's lifecycle. After the product is successfully created, the card automatically advances to Step 3.

### Data Sources and Auto-fill Mapping

| Product Field | Source | Location |
|---|---|---|
| `supplier_id` | Card | `development_items.supplier_id` |
| `fob_price_usd` | Card | `development_items.fob_price_usd` |
| `moq` | Card | `development_items.moq` (mapped to product MOQ) |
| `qty_master_box` | Card | `development_items.qty_per_master_inner` (parsed) |
| `image_url` | Card | `development_items.image_url` |
| `technical_description` | Card + Customs | Card title/description, or customs `product_catalog_description` from activity metadata |
| `ncm` | Customs Approval | `development_card_activity.metadata->>'ncm_code'` for customs research activity |

**User must fill manually:** `code` (required), `unit_of_measure`, `brand`, `ean_13`, `warehouse_status`

### Implementation Steps

#### 1. Expand Step 2 query in `useNewProductFlow.ts`
Update the `useNewProductsData` step2 fetch to include the commercial fields:

```
select: 'id, title, description, card_type, image_url, supplier_id, product_code,
         new_product_flow_status, fob_price_usd, moq, qty_per_master_inner,
         container_type, qty_per_container'
```

Also fetch customs approval activity metadata for step2 card IDs to extract `ncm_code` and `product_catalog_description`.

#### 2. Enhance `CreateProductModal` to accept pre-fill data
Add an optional `prefillData` prop to the modal:

```typescript
interface PrefillData {
  technical_description?: string;
  ncm?: string;
  fob_price_usd?: number;
  supplier_id?: string;
  qty_master_box?: number;
  image_url?: string;
  moq?: number;
}

interface CreateProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (productId?: string) => void;  // now returns product ID
  defaultSupplierId?: string;
  prefillData?: PrefillData;
}
```

When `prefillData` is provided:
- Use `form.reset(...)` with the pre-filled values when the modal opens
- Pre-filled fields are shown populated but still editable
- Visual hint (e.g., muted label text) to show which fields were auto-filled

#### 3. Update `onSuccess` to return the created product ID
Modify `CreateProductModal.onSubmit` to return the new product's ID via a `.select('id')` on the insert, and pass it to the `onSuccess` callback.

#### 4. Handle Step 2 card clicks differently in `NewProducts.tsx`
Add state for the Step 2 modal:

```typescript
const [step2CardForRegistration, setStep2CardForRegistration] = useState(null);
```

For Step 2's `WorkflowStepSection`, use a different `onOpenCard` handler that:
1. Finds the card data (with commercial fields + NCM from customs activity)
2. Opens `CreateProductModal` with `prefillData` instead of `ItemDetailDrawer`

#### 5. Auto-advance to Step 3 after product creation
When the product is created from a Step 2 card:
1. Call `advanceStep({ targetCardId, nextStatus: 'step3_ready_for_order' })`
2. Log activity: "Product registered (code: XXX) - moved to Ready for Order"
3. Close the modal and show a success toast
4. Invalidate queries to refresh the page

### Files to Modify

| File | Changes |
|---|---|
| `src/hooks/useNewProductFlow.ts` | Expand step2 select to include commercial fields; fetch customs activity metadata for NCM |
| `src/components/products/CreateProductModal.tsx` | Add `prefillData` prop; use it to set default form values; return product ID on success |
| `src/pages/NewProducts.tsx` | Add state for step2 registration modal; pass different handler for step2 cards; wire up auto-advance on product creation |

### Flow Diagram

```text
User clicks Step 2 card
        |
        v
CreateProductModal opens
(pre-filled: supplier, FOB, MOQ, NCM, description, image, qty master box)
        |
        v
User fills: Code, Unit of Measure, Brand, EAN-13, Warehouse Status
        |
        v
User clicks "Cadastrar"
        |
        v
Product inserted in `products` table
        |
        v
Card auto-advances to Step 3 (step3_ready_for_order)
Activity logged, toast shown, modal closes
```

### Edge Cases
- If NCM or description not found in customs activity (e.g., approval was rejected/skipped), those fields remain empty for manual entry
- If card has no commercial data (fob, moq), fields are left blank
- Duplicate product code error is already handled by the existing modal (shows toast)
- The "View Card" option is still available via a small link in the modal header for context

