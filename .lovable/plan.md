
## Fix: Forecast and History Aggregation Bug in Stock Projection

### Problem
The dashboard card shows 58 products with rupture in the 6-12m period, but the Stock Projection "Ruptures Only" filter shows only 28. The counts should match.

### Root Cause
When `selectedUnit = 'all'`, the detail view (SupplierPlanning.tsx) fetches forecast and history data for ALL units but **overwrites** values instead of **summing** them per product per month. The dashboard (DemandPlanning.tsx) correctly sums them.

Example: Product X has forecast 500 (unit A) + 800 (unit B) for March.
- Dashboard uses: 1,300 (correct sum) -- balance drops faster, rupture detected
- Detail view uses: 800 (last value wins) -- balance stays higher, rupture missed

### Fix (2-line change)

**File: `src/pages/SupplierPlanning.tsx`**

1. **Line 496 -- Forecast aggregation**: Change from overwrite to sum
   ```
   // Before (OVERWRITES):
   forecastsByProduct.get(key)!.set(monthKey, f.quantity);

   // After (SUMS):
   const existing = forecastsByProduct.get(key)!.get(monthKey) || 0;
   forecastsByProduct.get(key)!.set(monthKey, existing + f.quantity);
   ```

2. **Line 505 -- History aggregation**: Same fix
   ```
   // Before (OVERWRITES):
   historyByProduct.get(key)!.set(h.year_month, h.quantity);

   // After (SUMS):
   const existing = historyByProduct.get(key)!.get(h.year_month) || 0;
   historyByProduct.get(key)!.set(h.year_month, existing + h.quantity);
   ```

No other files need to change. The inventory and arrivals aggregation already sum correctly.
