

## Enhance Performance Tooltip with PV and History Breakdown

### What Changes
Update the tooltip in the Performance Indicator to show the actual PV (forecast) and History (actual sold) values for each month, not just the percentage and delta.

### Current Tooltip
```
PV vs Actual (Last 1M)
jan/26:    127% (+1.256)
Total:     127% (+1.256)
```

### New Tooltip
```
PV vs Actual (Last 1M)
           PV       Hist.    Delta
jan/26:    1.543    2.073    +530
Total:     1.543    2.073    +530  (127%)
```

Each row shows the forecast value (PV), the actual/history value (Hist.), and the difference (Delta), all formatted with Brazilian locale. The percentage moves to the Total row for a cleaner layout. Up to 3 months will be shown as data becomes available.

### Technical Details

**File: `src/components/planning/PerformanceIndicator.tsx`**

Update the `tooltipContent` JSX (lines 86-107):

1. Add a header row with column labels: PV, Hist., Delta
2. For each month row, show `d.forecast`, `d.actual`, and `formatDelta(d.delta)` as separate columns
3. In the Total row, show `totalForecast`, `totalActual`, `formatDelta(totalDelta)`, and the percentage
4. Use a simple grid/table layout with consistent column widths

No data changes needed -- the `PerformanceData` interface already includes `forecast` and `actual` fields. This is purely a tooltip display change.

