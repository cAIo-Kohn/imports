

## Plan: 18-Month Projection with Dynamic PV Copying

### Overview

When the user selects 18 months in the stock projection dropdown, extend the projection window from 12 months (Jan/26-Dec/26) to 18 months (Jan/26-Jun/27). For the extended months (Jan-Jun/27), the system needs to:

1. **Copy PV (Forecast)** from the corresponding months of the previous year (Jan-Jun/26)
2. **Use History** from the most recent available year as it becomes available

### Current Data State (Example)

| Data Type | Period Available |
|-----------|-----------------|
| Forecasts (PV) | Jan/2026 - Dec/2026 |
| History (Actual) | Jan/2025 - Dec/2025 |

### Desired Behavior

When viewing **18 months** (Jan/26 - Jun/27):

| Month | PV Source | History Source |
|-------|-----------|----------------|
| Jan/26 | `sales_forecasts` (Jan/26) | `sales_history` (Jan/25) |
| ... | ... | ... |
| Dec/26 | `sales_forecasts` (Dec/26) | `sales_history` (Dec/25) |
| Jan/27 | Copy from `sales_forecasts` (Jan/26) | Use Jan/26 history if available, else Jan/25 |
| Feb/27 | Copy from `sales_forecasts` (Feb/26) | Use Feb/26 history if available, else Feb/25 |
| ... | ... | ... |
| Jun/27 | Copy from `sales_forecasts` (Jun/26) | Use Jun/26 history if available, else Jun/25 |

### After First Rollover (Feb/26)

When January 2026 actual sales are uploaded as history:

| Month | PV Source | History Source |
|-------|-----------|----------------|
| Feb/26 | `sales_forecasts` (Feb/26) | `sales_history` (Feb/25) |
| ... | ... | ... |
| Jan/27 | Copy from `sales_forecasts` (Jan/26) | **Jan/26 actual** (uploaded) |
| Feb/27 | Copy from `sales_forecasts` (Feb/26) | Feb/25 (no Feb/26 yet) |

---

## File to Modify

### `src/pages/SupplierPlanning.tsx`

Modify the projection calculation logic in the `productProjections` useMemo hook.

---

## Implementation Details

### Current Logic (Line 536)

```typescript
const monthKey = format(month, 'yyyy-MM-dd');
const forecast = productForecasts.get(monthKey) || 0;
```

This only works when forecasts exist for the target month. For months beyond the 12-month window (e.g., Jan/27), no forecast data exists.

### New Logic: Smart Forecast Lookup

```typescript
const monthKey = format(month, 'yyyy-MM-dd');
let forecast = productForecasts.get(monthKey) || 0;

// If no forecast for this month, try copying from same month 1 year prior
if (forecast === 0) {
  const sameMonthLastYear = subYears(month, 1);
  const fallbackKey = format(sameMonthLastYear, 'yyyy-MM-dd');
  forecast = productForecasts.get(fallbackKey) || 0;
}
```

### New Logic: Smart History Lookup

Currently (Line 554-556):
```typescript
const historyMonth = subYears(month, 1);
const historyKey = format(historyMonth, 'yyyy-MM-dd');
const historyLastYear = productHistory.get(historyKey) || 0;
```

This always looks 1 year back. For extended months like Jan/27, we want:
1. Check if Jan/26 history exists (most recent) → use it
2. Else fall back to Jan/25

**New Logic:**

```typescript
// For history: prefer most recent available year
// Try year-1, then year-2 (cascade fallback)
const historyMonth1YearBack = subYears(month, 1);
const historyKey1 = format(historyMonth1YearBack, 'yyyy-MM-dd');

const historyMonth2YearsBack = subYears(month, 2);
const historyKey2 = format(historyMonth2YearsBack, 'yyyy-MM-dd');

// Use most recent available: first try 1 year back, then 2 years back
const historyLastYear = productHistory.get(historyKey1) || productHistory.get(historyKey2) || 0;
```

---

## Visual Indicator (Optional Enhancement)

Add a visual cue to indicate when data is "copied" vs "actual":

- **Copied PV**: Show in italics or with a small indicator (e.g., `*`)
- **Actual PV**: Normal display

This helps users understand when they're looking at extended projections.

---

## Code Changes Summary

```
src/pages/SupplierPlanning.tsx
│
├── Line 536: Update forecast lookup with fallback
│   - If no forecast for monthKey, try subYears(month, 1)
│
├── Lines 554-556: Update history lookup with cascade fallback
│   - Try historyMonth-1yr first
│   - Fall back to historyMonth-2yr if not found
│
└── (Optional) Add isCopiedForecast flag to MonthProjection interface
    - Pass to ProductProjectionCard/Row for visual indicator
```

---

## Technical Section

### Forecast Fallback Algorithm

```typescript
function getForecast(month: Date, forecastsMap: Map<string, number>): { value: number; isCopied: boolean } {
  const monthKey = format(month, 'yyyy-MM-dd');
  
  // Direct lookup
  let forecast = forecastsMap.get(monthKey);
  if (forecast !== undefined && forecast > 0) {
    return { value: forecast, isCopied: false };
  }
  
  // Fallback: same month, 1 year prior
  const fallbackMonth = subYears(month, 1);
  const fallbackKey = format(fallbackMonth, 'yyyy-MM-dd');
  forecast = forecastsMap.get(fallbackKey);
  if (forecast !== undefined && forecast > 0) {
    return { value: forecast, isCopied: true };
  }
  
  return { value: 0, isCopied: false };
}
```

### History Fallback Algorithm

```typescript
function getHistoryLastYear(month: Date, historyMap: Map<string, number>): number {
  // Cascade through available years: -1, -2, -3...
  for (let yearsBack = 1; yearsBack <= 3; yearsBack++) {
    const histMonth = subYears(month, yearsBack);
    const histKey = format(histMonth, 'yyyy-MM-dd');
    const value = historyMap.get(histKey);
    if (value !== undefined && value > 0) {
      return value;
    }
  }
  return 0;
}
```

### Example Timeline

**Today: January 2026**

| Month | Forecast Source | History Source |
|-------|-----------------|----------------|
| Jan/26 | Actual (Jan/26) | Jan/25 |
| Jun/26 | Actual (Jun/26) | Jun/25 |
| Dec/26 | Actual (Dec/26) | Dec/25 |
| Jan/27 | **Copied (Jan/26)** | Jan/25 |
| Jun/27 | **Copied (Jun/26)** | Jun/25 |

**After Rollover to February 2026** (Jan/26 history uploaded):

| Month | Forecast Source | History Source |
|-------|-----------------|----------------|
| Feb/26 | Actual (Feb/26) | Feb/25 |
| Dec/26 | Actual (Dec/26) | Dec/25 |
| Jan/27 | Copied (Jan/26) | **Jan/26 actual** |
| Jun/27 | Copied (Jun/26) | Jun/25 |

---

## Edge Cases

1. **No forecast data at all**: Show 0 (no fallback possible)
2. **No history data at all**: Show 0
3. **Partial year data**: Use whatever is available
4. **Switching between 12/18 months**: Recalculates automatically

---

## Files Summary

| File | Changes |
|------|---------|
| `src/pages/SupplierPlanning.tsx` | Update forecast and history lookup logic with fallback chains |

