

## Step 3: Auto-Complete on First Order Placement

### Overview
Step 3 ("Ready for Order") cards remain visible until the product created in Step 2 appears in at least one purchase order. When that happens, the card automatically moves to a new "Completed" section -- a visible archive of products that have gone through the full workflow and been ordered.

### Key Requirement
We need to **link** the development card to the catalog `products.id` so we can detect when a `purchase_order_items` row references that product.

### Implementation

#### 1. Add `registered_product_id` column to `development_items`
A new nullable UUID column that stores the `products.id` created during Step 2. This is the bridge between the card and the catalog.

```text
development_items.registered_product_id  -->  products.id
```

#### 2. Save the product ID when Step 2 completes
In `NewProducts.tsx`, the `handleProductCreated` callback already receives `productId`. We add a Supabase update to store it on the card:

```
UPDATE development_items
SET registered_product_id = <productId>
WHERE id = <cardId>
```

This happens alongside the existing `advanceStep` call.

#### 3. Detect first order in `useNewProductsData`
For all Step 3 cards, check if their `registered_product_id` exists in `purchase_order_items`:

```text
Step 3 cards  -->  get registered_product_id list
                   -->  query purchase_order_items where product_id IN (...)
                   -->  cards with a match = "completed"
```

Cards with at least one order match get auto-advanced to `completed` status. This check runs every time the New Products page loads.

#### 4. Add "Completed" section to the page
A new section below Step 3, styled similarly to the "Solved" cards pattern:
- Uses a muted/success color scheme (e.g., green checkmark)
- Shows the product title, image, and product code
- Collapsible by default (toggle "Show completed") so it doesn't clutter the active workflow
- Clicking a completed card opens the ItemDetailDrawer for reference

#### 5. Fetch completed items in the hook
Add a query for `new_product_flow_status = 'completed'` items in `useNewProductsData`, returning them as a `completed` array.

### Files to Modify

| File | Changes |
|---|---|
| Database migration | Add `registered_product_id` (uuid, nullable) to `development_items` |
| `src/hooks/useNewProductFlow.ts` | Save `registered_product_id` on step2 completion; fetch completed items; auto-detect first order for step3 cards |
| `src/pages/NewProducts.tsx` | Store product ID on card after creation; add Completed section with collapsible toggle |
| `src/components/new-products/WorkflowStepSection.tsx` | Minor: support a "completed" color scheme variant |

### Page Layout After Changes

```text
Eligible Products
      |
Step 1: Research & Compliance
      |
Step 2: Cadastrar Codigo
      |
Step 3: Ready for Order        <-- stays here until ordered
      |
[v] Show Completed (4)         <-- collapsible archive
    - Product A  (ordered 2026-01-15)
    - Product B  (ordered 2026-02-01)
    ...
```

### Auto-Detection Logic
Each page load, for Step 3 cards with a `registered_product_id`:
1. Query `purchase_order_items` for matching `product_id` values
2. For any matches found, call `advanceStep` to move the card to `completed`
3. Log activity: "First order placed -- product workflow complete"

This is a lightweight check (single query) that keeps the workflow progressing without manual intervention.
