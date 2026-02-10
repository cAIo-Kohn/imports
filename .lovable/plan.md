

## Fix: "Fill by Target Month" Should Only Update Existing Items

### Problem
When using "Equilibrar Mes", the logic adds new products that are not in the draft order. The expected behavior is to only increase quantities of items already present in the order to cover their deficits until the target month.

### Fix

**File: `src/components/planning/OrderSimulationFooter.tsx`**

Remove the second loop (lines 430-453) that iterates over `productProjections` looking for products NOT in the draft. The function should only process `draft.items` (the first loop, lines 405-428), which are the products already in the order.

This is a deletion of ~22 lines. No other changes needed.

### Result
When filling by target month, only products already in the draft will have their quantities increased to cover stock deficits. No new products will be added to the order.

