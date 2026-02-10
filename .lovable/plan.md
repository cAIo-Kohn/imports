

## Add "Fill by Target Month" Option to Container Fill

### What Changes
Add a second container-fill strategy alongside the existing "Fill by CBM" (proportional volume distribution). The new option, "Fill by Target Month" (Equilibrar Mês), uses the same logic as "Montar Pedido Inteligente": it looks at each product's projected balance (Saldo) and adds enough quantity so the balance stays positive until a chosen target month.

### How It Works
When the container has a partial fill (e.g., 80%), the user currently sees a button like "+15.2m³". This will become a dropdown with two options:

1. **Preencher CBM** (current behavior) -- distributes remaining volume equally across all products by CBM
2. **Equilibrar Mês** (new) -- shows a month picker; adds quantity only to products whose balance goes negative before the target month, filling just enough to cover the deficit (rounded to master box), until the container is full or all deficits are covered

### User Flow
1. User has a draft order for arrival in Jul/26, container at 72%
2. Clicks the fill button, selects "Equilibrar Mês"
3. Picks target month: "Dez/26"
4. System checks each product's projection: if balance goes negative before Dec/26, it adds enough units (rounded to master box) to cover the deficit
5. Stops adding once the container reaches 100% or all products are covered
6. If container still has space after covering all deficits, shows a toast informing the user

### Technical Details

**File: `src/components/planning/OrderSimulationFooter.tsx`**

1. **New props needed**: Pass `productProjections` data into the footer (it's already passed but typed as `unknown` and unused). Update the interface to properly type it with the projection data containing `finalBalance` per month per product.

2. **New state**: Add `fillMode` state to track which fill strategy is active, and `fillTargetMonth` for the selected target month.

3. **New function `handleFillByTargetMonth(draft, targetMonth)`**:
   - For each product in the draft, find its projection data
   - Look at months from the draft's arrival month through targetMonth
   - If finalBalance goes negative in any of those months, calculate the deficit (most negative balance in that range)
   - Add enough quantity (rounded to master box) to cover the deficit
   - Track cumulative added volume; stop when container reaches 100%
   - Sort products by deficit severity (most negative first) to prioritize critical items
   - Call `onUpdateArrivals` with the updated quantities

4. **UI change**: Replace the simple "+Xm³" Button with a Popover containing:
   - Two radio/button options: "Preencher CBM" and "Equilibrar Mês"
   - When "Equilibrar Mês" is selected, show a month selector (same as SmartOrderBuilder)
   - A "Preencher" action button to execute
   - Preview showing how many products will be affected and estimated fill %

**File: `src/pages/SupplierPlanning.tsx`**

5. **Update prop**: Change the `productProjections` prop from `unknown` to the actual typed array so the footer can access balance data per product per month.

### Key Logic (Fill by Target Month)

```text
For each product in draft.items:
  1. Find product's projection array
  2. Find the minimum finalBalance from arrivalMonth through targetMonth
  3. If minBalance < 0:
     deficit = |minBalance|
     roundedQty = ceil(deficit / masterBox) * masterBox
     additionalVolume = ceil(roundedQty / masterBox) * masterBoxVolume
  4. Add to priority queue sorted by deficit (largest first)

Iterate priority queue:
  While remainingContainerVolume > 0 AND queue not empty:
    Take next product
    Add roundedQty (or cap to remaining volume)
    Update arrivals
```

