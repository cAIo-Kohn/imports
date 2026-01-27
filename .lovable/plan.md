

## Plan: Disable Product Chart on Click

### Overview

Temporarily disable the chart that appears when clicking on a product in the stock projection view. The chart functionality will be reimplemented later with historical analysis features.

---

### Changes Required

#### 1. Remove Chart Rendering

**File:** `src/pages/SupplierPlanning.tsx`

Remove the conditional rendering block that shows the chart when a product is selected (lines 859-875):

```tsx
// REMOVE THIS BLOCK:
{selectedProductData && (
  <Card>
    <CardHeader>
      <CardTitle>...</CardTitle>
      ...
    </CardHeader>
    <CardContent>
      <ProjectionChart projections={selectedProductData.projections} />
    </CardContent>
  </Card>
)}
```

#### 2. Update Description Text

**File:** `src/pages/SupplierPlanning.tsx`

Update the card description (line 882) to remove the chart reference:

**Before:**
```
Click a product to view the chart. Enter values in the "Arrival" row to simulate purchases.
```

**After:**
```
Enter values in the "Arrival" row to simulate purchases.
```

#### 3. Remove Unused Imports

**File:** `src/pages/SupplierPlanning.tsx`

Remove the `ProjectionChart` import since it's no longer used.

---

### What Will Be Preserved

- **Product selection state**: The `selectedProduct` and `setSelectedProduct` state can remain for future use
- **Click handlers**: The `onSelectProduct` callback in `ProductProjectionCard` and `ProductProjectionRow` will still work (for visual feedback like the ring highlight)
- **`ProjectionChart` component file**: Keep `src/components/planning/ProjectionChart.tsx` for future historical analysis implementation

---

### Files Summary

| File | Action | Changes |
|------|--------|---------|
| `src/pages/SupplierPlanning.tsx` | Modify | Remove chart Card block, update description text, remove unused import |

---

### Technical Notes

- The product selection visual feedback (ring around selected card) will still work
- No database changes required
- The `ProjectionChart.tsx` component will remain in the codebase for future reimplementation

