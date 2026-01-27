

## Plan: Inline PV (Forecast) Editing for Buyers and Admins

### Overview

Add inline editing capability to the PV (Sales Forecast) row in the stock projection, following the same pattern as the "Chegada" (Arrival) input. Changes will be saved immediately to the `sales_forecasts` table and persist until the next forecast upload overwrites them.

---

### Design Decision: Save Immediately vs. Save on Blur

Since the user's changes should persist across sessions (unlike arrivals which are transient until an order is created), we need to save forecast changes to the database.

**Approach:** Save immediately on blur (when user finishes editing a cell). This ensures:
1. Changes persist if user navigates away
2. Uploads will overwrite user changes (desired behavior)
3. Similar UX to "Chegada" input

---

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/planning/ForecastInput.tsx` | New component for inline PV editing (similar to ArrivalInput) |

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/SupplierPlanning.tsx` | Add forecast change handlers, mutation for saving, pass to ProductProjectionCard |
| `src/components/planning/ProductProjectionCard.tsx` | Replace static PV display with ForecastInput component |
| `src/components/planning/ProductProjectionRow.tsx` | Replace static PV display with ForecastInput component |

---

### Implementation Details

#### 1. ForecastInput Component

Similar to `ArrivalInput.tsx` but simpler (no uploaded/app order breakdown):

```typescript
interface ForecastInputProps {
  productId: string;
  monthKey: string;
  currentForecast: number;      // Current forecast value from database
  historyLastYear: number;      // For trend indicator comparison
  onValueChange: (productId: string, monthKey: string, value: number) => void;
}
```

**Features:**
- Click-to-edit pattern (display mode → input mode)
- Shows trend indicator (↑/↓) comparing to history
- Number formatting (pt-BR locale)
- Keyboard support (Enter/Escape to confirm)

#### 2. State Management in SupplierPlanning

Add new state for tracking pending forecast changes:

```typescript
// Track pending forecast edits (before saving)
const [pendingForecasts, setPendingForecasts] = useState<Record<string, number>>({});
```

Add handler for forecast changes:

```typescript
const handleForecastChange = useCallback(async (productId: string, monthKey: string, value: number) => {
  if (selectedUnit === 'all') {
    toast.error('Select a unit to edit forecasts');
    return;
  }
  
  const { error } = await supabase
    .from('sales_forecasts')
    .upsert({
      product_id: productId,
      unit_id: selectedUnit,
      year_month: monthKey,
      quantity: value,
      version: 'manual', // or use current version
      created_by: user?.id,
    }, {
      onConflict: 'product_id,unit_id,year_month,version'
    });
  
  if (error) {
    toast.error('Failed to save forecast');
  } else {
    // Refetch forecasts to update UI
    refetchForecasts();
  }
}, [selectedUnit, user?.id, refetchForecasts]);
```

#### 3. Version Strategy

When a user edits a forecast, we have two options:

**Option A: Use "manual" version**
- User edits get version="manual"
- Uploads get version="2026-01" etc.
- Problem: Won't be overwritten by uploads with different version

**Option B: Match existing version (Recommended)**
- Query existing forecast's version first
- Upsert with same version
- When upload happens, it overwrites
- If no existing forecast, create with "manual" version

The best approach is to check if a forecast already exists for this product/unit/month and use its version, otherwise create with "manual".

#### 4. UI Changes in ProductProjectionCard

Replace the static PV display (lines 118-142):

```tsx
{/* Row 1: PV (Sales Forecast) - Now Editable */}
<TableRow className="hover:bg-muted/20">
  <TableCell className="text-center py-1 bg-muted/20 font-medium text-muted-foreground">
    PV
  </TableCell>
  {productProj.projections.map((proj, i) => (
    <TableCell 
      key={i} 
      className="text-center py-1 px-1"
      onClick={(e) => e.stopPropagation()}
    >
      <ForecastInput
        productId={productProj.product.id}
        monthKey={proj.monthKey}
        currentForecast={proj.forecast}
        historyLastYear={proj.historyLastYear}
        onValueChange={onForecastChange}
      />
    </TableCell>
  ))}
  <TableCell className="text-center py-1 px-1 bg-muted/20 font-semibold">
    {productProj.totalForecast.toLocaleString('pt-BR')}
  </TableCell>
</TableRow>
```

#### 5. Props Update

Update `ProductProjectionCard` and `ProductProjectionRow` props:

```typescript
interface ProductProjectionCardProps {
  productProj: ProductProjectionData;
  isSelected: boolean;
  pendingArrivalsInput: Record<string, string>;
  onSelectProduct: (productId: string | null) => void;
  onArrivalChange: (productId: string, monthKey: string, value: string) => void;
  onArrivalBlur?: (productId: string, monthKey: string) => void;
  onForecastChange?: (productId: string, monthKey: string, value: number) => void; // NEW
}
```

---

### Database Considerations

The current `sales_forecasts` table has a unique constraint on `(product_id, unit_id, year_month, version)`. This means:

1. **User Edit**: Upserts with matching version → Updates existing record
2. **File Import**: Upserts with file version → Overwrites existing for that version
3. **Cross-version**: If user edited "manual" version but upload uses "2026-02", both exist

**Recommendation**: When user edits, first check if a record exists for the current month. If yes, use its version. If no, use "manual". This way:
- If data came from an upload (version="2026-01"), user edit updates the same record
- Next upload with same version will overwrite user changes ✓

---

### Role-Based Access

Only `admin` and `buyer` roles should be able to edit forecasts. The RLS policy already enforces this:

```sql
Policy: "Admins and buyers can manage sales_forecasts"
Command: ALL
Using Expression: has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'buyer')
```

In the UI, we can also conditionally render the editable input:

```tsx
const { userRole } = useUserRole();
const canEditForecast = userRole === 'admin' || userRole === 'buyer';

{canEditForecast ? (
  <ForecastInput ... />
) : (
  <span>{proj.forecast.toLocaleString('pt-BR')}</span>
)}
```

---

### Technical Section

#### ForecastInput Component Structure

```tsx
export const ForecastInput = memo(function ForecastInput({
  productId,
  monthKey,
  currentForecast,
  historyLastYear,
  onValueChange,
}: ForecastInputProps) {
  const [localValue, setLocalValue] = useState(currentForecast.toString());
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with external value
  useEffect(() => {
    setLocalValue(currentForecast.toString());
  }, [currentForecast]);

  // Focus on edit
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    const numValue = parseInt(localValue) || 0;
    if (numValue !== currentForecast) {
      onValueChange(productId, monthKey, numValue);
    }
  }, [localValue, currentForecast, onValueChange, productId, monthKey]);

  // ... render logic similar to ArrivalInput
});
```

#### Database Save Logic

```typescript
const saveForecast = async (productId: string, monthKey: string, quantity: number) => {
  // First, try to get existing forecast to match its version
  const { data: existing } = await supabase
    .from('sales_forecasts')
    .select('version')
    .eq('product_id', productId)
    .eq('unit_id', selectedUnit)
    .eq('year_month', monthKey)
    .single();

  const version = existing?.version || 'manual';

  const { error } = await supabase
    .from('sales_forecasts')
    .upsert({
      product_id: productId,
      unit_id: selectedUnit,
      year_month: monthKey,
      quantity,
      version,
      created_by: user?.id,
    }, {
      onConflict: 'product_id,unit_id,year_month,version'
    });

  return { error };
};
```

---

### User Experience

1. **Click on PV cell** → Input appears with current value selected
2. **Type new value** → Local state updates
3. **Press Enter or click away** → Value saved to database
4. **Press Escape** → Cancel edit, revert to original value
5. **Next forecast upload** → Overwrites all forecasts including manual edits

---

### Edge Cases

1. **No existing forecast**: Create new record with version="manual"
2. **Unit not selected**: Show error, require unit selection
3. **Zero value**: Allow (means no sales expected)
4. **Network error**: Show toast, keep local value, allow retry
5. **Viewer role**: Show read-only display (no click-to-edit)

---

### Files Summary

| File | Action | Description |
|------|--------|-------------|
| `src/components/planning/ForecastInput.tsx` | Create | Click-to-edit component for PV values |
| `src/pages/SupplierPlanning.tsx` | Modify | Add forecast change handler and database save logic |
| `src/components/planning/ProductProjectionCard.tsx` | Modify | Replace static PV with ForecastInput |
| `src/components/planning/ProductProjectionRow.tsx` | Modify | Replace static PV with ForecastInput |

