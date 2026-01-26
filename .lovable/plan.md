
## Plan: PV vs Actual Performance Card + Month Rollover System

### Overview

This plan adds two key features to the Demand Planning system:
1. **Performance Indicator Card** - A small card next to "ESTOQUE" showing PV vs Actual sales for the last 3 months with completed history
2. **Month Rollover Button ("Virar")** - A workflow to advance the 12-month projection window, requiring mandatory uploads

---

### Feature 1: Performance Card (PV vs Actual)

#### Visual Design

The performance card will appear in the product header area, next to the stock (ESTOQUE) indicator:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 007727                       ESTOQUE     PERFORMANCE (Last 3M)         │
│ CHALEIRA ELETRICA INOX...       0        ▲ 105.2% (+520 units)         │
│                                           Jan: 98% | Feb: 112% | Mar: - │
└─────────────────────────────────────────────────────────────────────────┘
```

**Display Logic:**
- Shows only months where we have both PV (forecast) AND Actual (history) data
- Calculates: `Actual / PV * 100` for each month
- Color coding:
  - **Green (▲)**: Actual > PV (selling more than expected)
  - **Red (▼)**: Actual < PV (selling less than expected)  
  - **Yellow (-)**: Within 5% of target
- Shows overall average and per-month breakdown on hover

#### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/planning/PerformanceIndicator.tsx` | Create | New component for the mini performance card |
| `src/components/planning/ProductProjectionCard.tsx` | Modify | Add the performance indicator in the header |
| `src/components/planning/ProductProjectionRow.tsx` | Modify | Add performance data to the row layout |
| `src/pages/SupplierPlanning.tsx` | Modify | Fetch history data for PV months and calculate performance |

#### Data Requirements

The performance calculation needs:
1. **Sales Forecast (PV)** for past months (already loaded)
2. **Sales History (Actual)** for same months (need to extend query)

**Example Calculation (Jan 2026):**
- PV: 1,000 units
- Actual: 1,050 units
- Performance: 105% (+50 units)

---

### Feature 2: Month Rollover ("Virar")

#### Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Demand Planning                                    [🔄 Rollover Month]  │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼ Click "Rollover Month"
┌─────────────────────────────────────────────────────────────────────────┐
│                     ROLLOVER MONTH                                       │
│                                                                          │
│ Current Period: Jan/2026 - Dec/2026                                     │
│ New Period: Feb/2026 - Jan/2027                                         │
│                                                                          │
│ ⚠ Required Uploads to Rollover:                                        │
│                                                                          │
│ ☑ Inventory      [Upload] → uploaded 01/Feb ✓                          │
│ ☐ History (Jan)  [Upload] → not uploaded                               │
│ ☑ Arrivals       [Upload] → uploaded 01/Feb ✓                          │
│ ☑ Forecast       [Upload] → uploaded 01/Feb ✓                          │
│                                                                          │
│ 📅 Date Validation: Today is Feb 3, 2026 ✓                              │
│                                                                          │
│ [Cancel]                    [Rollover] (disabled until all uploads done)│
└─────────────────────────────────────────────────────────────────────────┘
```

#### Rollover Logic

1. **Date Validation**: Current date must be >= 1st day of the new month
   - If today is Jan 31, cannot rollover to Feb yet
   - If today is Feb 1+, can rollover

2. **Required Uploads**: All 4 file types must be uploaded with data for the new period:
   - **Inventory**: snapshot_date >= new month start
   - **History**: year_month for the month being "closed" (Jan 2026)
   - **Arrivals**: arrival_date >= new month start
   - **Forecast**: year_month covering the new 12-month window

3. **Rollover Action**: The system doesn't need to modify data - it just validates that data exists for the new period. The 12-month window calculation uses `startOfMonth(now)` which will naturally shift forward.

4. **System Date Setting** (Optional Enhancement): Store a "current_planning_month" setting to allow manual override for testing.

#### Files to Create

| File | Action | Description |
|------|--------|-------------|
| `src/components/planning/RolloverMonthModal.tsx` | Create | Modal with checklist and rollover workflow |
| `src/pages/DemandPlanning.tsx` | Modify | Add "Rollover Month" button |

---

### Technical Implementation Details

#### 1. PerformanceIndicator Component

```typescript
interface PerformanceData {
  monthKey: string;
  monthLabel: string;
  forecast: number;
  actual: number;
  percentage: number; // actual/forecast * 100
  delta: number; // actual - forecast
}

interface PerformanceIndicatorProps {
  performanceData: PerformanceData[];
  className?: string;
}
```

**Visual States:**
- No data: "No completed months"
- 1-3 months: Show individual month percentages
- Trend icon based on last month vs previous

#### 2. Performance Calculation in SupplierPlanning

Extend the existing projection calculation to include:

```typescript
// Calculate performance for months where we have both PV and History
const performanceByProduct = useMemo(() => {
  // Get current month
  const currentMonth = startOfMonth(new Date());
  
  // Look at past 3 months (if they exist in our data)
  const performanceMonths: PerformanceData[] = [];
  
  for (let i = 1; i <= 3; i++) {
    const pastMonth = subMonths(currentMonth, i);
    const monthKey = format(pastMonth, 'yyyy-MM-dd');
    
    const forecast = forecastsByProduct.get(productId)?.get(monthKey) || 0;
    const actual = historyByProduct.get(productId)?.get(monthKey) || 0;
    
    // Only include if we have both values
    if (forecast > 0 && actual > 0) {
      performanceMonths.push({
        monthKey,
        monthLabel: format(pastMonth, 'MMM/yy'),
        forecast,
        actual,
        percentage: Math.round((actual / forecast) * 100),
        delta: actual - forecast,
      });
    }
  }
  
  return performanceMonths;
}, [forecastsByProduct, historyByProduct]);
```

#### 3. RolloverMonthModal Component

```typescript
interface RolloverValidation {
  inventoryReady: boolean;
  inventoryDate: string | null;
  historyReady: boolean;
  historyMonth: string | null;
  arrivalsReady: boolean;
  arrivalsDate: string | null;
  forecastReady: boolean;
  forecastRange: string | null;
  dateValid: boolean;
  currentDate: Date;
  newMonthStart: Date;
}
```

**Validation Queries:**
- Inventory: `SELECT MAX(snapshot_date) FROM inventory_snapshots WHERE snapshot_date >= '2026-02-01'`
- History: `SELECT COUNT(*) FROM sales_history WHERE year_month = '2026-01-01'`
- Arrivals: `SELECT MAX(arrival_date) FROM scheduled_arrivals WHERE arrival_date >= '2026-02-01'`
- Forecast: `SELECT MIN(year_month), MAX(year_month) FROM sales_forecasts WHERE year_month >= '2026-02-01'`

---

### UI/UX Considerations

1. **Performance Card Placement**: 
   - Desktop: Next to ESTOQUE, same row
   - Mobile: Below ESTOQUE, stacked

2. **Color Scheme**:
   - Green (#22c55e): > 100% (over-performing)
   - Red (#ef4444): < 95% (under-performing)
   - Yellow (#eab308): 95-105% (on target)

3. **Rollover Button**:
   - Only visible to Admin/Buyer roles
   - Disabled state with tooltip explaining what's missing
   - Confirmation dialog before final rollover

---

### Migration Path

Since the user mentioned:
- Forecasts: Jan 2026 - Dec 2026
- History: Will be uploaded monthly starting with Jan 2026 actual

The system should handle:
1. **Empty History State**: "No completed months yet" 
2. **First Month Completed**: Show Jan 2026 performance after History import
3. **Rolling 3-Month Window**: Always show most recent 3 months with data

---

### Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/components/planning/PerformanceIndicator.tsx` | Create | Mini card showing PV vs Actual |
| `src/components/planning/RolloverMonthModal.tsx` | Create | Modal for month rollover workflow |
| `src/components/planning/ProductProjectionCard.tsx` | Modify | Add PerformanceIndicator to header |
| `src/components/planning/ProductProjectionRow.tsx` | Modify | Add performance data display |
| `src/pages/SupplierPlanning.tsx` | Modify | Calculate performance metrics |
| `src/pages/DemandPlanning.tsx` | Modify | Add Rollover button and modal |

---

### Technical Section

#### Performance Calculation Formula
```
Performance % = (Actual Sales / Forecast) × 100
Delta = Actual - Forecast
Trend = Current Month Performance - Previous Month Performance
```

#### Edge Cases
1. **No forecast for month**: Skip that month in calculation
2. **No history for month**: Skip that month (not yet uploaded)
3. **Zero forecast**: Show as "N/A" to avoid division by zero
4. **First month of system**: Show "No data yet"

#### Data Flow
```
SupplierPlanning.tsx
    │
    ├─► Fetch sales_history (extends to include past months)
    ├─► Fetch sales_forecasts (already includes past months)
    │
    ▼
Calculate performanceByProduct Map<productId, PerformanceData[]>
    │
    ▼
Pass to ProductProjectionCard / ProductProjectionRow
    │
    ▼
PerformanceIndicator renders the mini card
```

#### Rollover State Machine
```
Initial State: "Check Requirements"
    │
    ├─► All 4 uploads present + date valid → "Ready"
    │
    └─► Missing uploads → "Not Ready" (show missing items)
```
