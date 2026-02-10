

## Fix: Supplier Rupture Count Mismatch Between Dashboard and Detail View

### Problem
The demand planning dashboard card shows "9m: 39 rupt." for a supplier, but when you click into that supplier and filter "Ruptures Only", fewer products appear.

### Root Causes Found

**1. Supabase 1000-Row Limit (Primary Issue)**
In `SupplierPlanning.tsx`, all data queries (forecasts, sales history, inventory, scheduled arrivals) use simple `.in('product_id', productIds)` calls WITHOUT pagination. If a supplier has 65 products with multiple units/versions, the forecast table alone could have 65 products x 12 months x N versions/units = easily over 1000 rows. The query silently truncates at 1000, causing some products to have no forecast data, which changes their rupture calculation.

Meanwhile, `DemandPlanning.tsx` uses `fetchForecastsParallel()` with proper pagination (1000-row batches), so it sees ALL data.

**2. Unit Auto-Selection Filter**
`SupplierPlanning.tsx` has logic (lines 173-198) that auto-selects a unit if all products share one. When a unit is selected, all queries add `.eq('unit_id', selectedUnit)`, filtering results. But the dashboard card (`DemandPlanning.tsx`) does NOT filter by unit -- it calculates ruptures across all units. This can produce different rupture counts.

### Solution

**File: `src/pages/SupplierPlanning.tsx`**

1. **Add pagination to all data queries** -- Replace the simple single-call queries for forecasts, sales history, inventory, and scheduled arrivals with paginated fetching (similar to `fetchAllPaged.ts` pattern). For each query:
   - Use `.range(from, to)` in a loop with batch size of 1000
   - Continue fetching until fewer than 1000 rows are returned
   - Concatenate all pages into the final result

2. **Remove unit auto-selection** -- Stop auto-setting `selectedUnit` when all products share one unit. Keep the default as `'all'` so the initial view matches the dashboard card. The user can still manually filter by unit.

   Alternatively, if auto-selection is desired for UX reasons, show a warning banner when the rupture count differs from the dashboard, explaining the unit filter is active.

### Technical Details

**Paginated query helper (reusable):**
```typescript
async function fetchAllInBatches<T>(
  queryBuilder: () => PostgrestFilterBuilder,
  batchSize = 1000
): Promise<T[]> {
  const allData: T[] = [];
  let page = 0;
  let hasMore = true;
  while (hasMore && page < 50) {
    const from = page * batchSize;
    const { data, error } = await queryBuilder().range(from, from + batchSize - 1);
    if (error) throw error;
    if (data && data.length > 0) allData.push(...data);
    hasMore = data !== null && data.length === batchSize;
    page++;
  }
  return allData;
}
```

**Apply to these queries in SupplierPlanning.tsx:**

| Query | Current Line | Risk Level |
|---|---|---|
| `sales_forecasts` | 200-220 | HIGH -- 65 products x 12+ months x versions |
| `sales_history` | 223-243 | HIGH -- same multiplication |
| `inventory_snapshots` | 246-266 | MEDIUM -- 65 products x snapshots |
| `scheduled_arrivals` | 269-288 | LOW -- usually fewer rows |
| `purchase_order_items` | 291-330 | LOW -- usually fewer rows |

**Remove auto-unit-selection (lines 194-198):**
Delete the `useEffect` that auto-sets `selectedUnit`. Keep the dropdown so users can filter manually, but default to `'all'` to match the dashboard calculation.

### Expected Result
After this fix, when you click into a supplier showing "39 rupt." on the 9m indicator, filtering "Ruptures Only" will show exactly 39 products (plus any from the 3m and 6m buckets that also have ruptures, totaling 41 in your case: 1 + 1 + 39).

Note: The 9m indicator on the dashboard shows products whose FIRST rupture falls in months 6-8. The 3m and 6m indicators show products rupturing earlier. So the total "Ruptures Only" count inside the supplier should equal 3m + 6m + 9m + 12m = 1 + 1 + 39 + 19 = 60 products with ruptures.

