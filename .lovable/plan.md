

## Fix: Auto-Fill Missing Forecast Months from History

### Problem
The rollover validation requires forecasts covering Feb 2026 through Jan 2027 (12 months). You uploaded forecasts only until Dec 2026, so Jan 2027 is missing, blocking the rollover.

### Solution
Change the forecast validation logic in `RolloverMonthModal.tsx` so that when the forecast doesn't fully cover the new period, the system automatically fills the gap using sales history from the same month of the previous year (e.g., Jan 2026 history becomes Jan 2027 forecast).

This happens at rollover confirmation time -- when the user clicks "Confirm Rollover", any missing months are auto-filled before proceeding.

### How It Works

1. **Relaxed validation**: The forecast check will still show which months are covered, but instead of blocking when the last month is missing, it will indicate "Will use history for missing months" and allow proceeding.

2. **Auto-fill on confirm**: When the user confirms the rollover, for each month in the new 12-month window that has no forecast data:
   - Query `sales_history` for the same month one year prior (e.g., for Jan 2027, look up Jan 2026)
   - Insert those values as `sales_forecasts` rows with a version tag like `"auto-history"`
   - This fills the gap seamlessly

3. **Validation display update**: The forecast row will show a yellow "partial" state (e.g., "Until 2026-12, will auto-fill Jan/2027 from history") instead of a hard red block.

### Technical Details

**File: `src/components/planning/RolloverMonthModal.tsx`**

1. Update the forecast validation query (lines 138-176) to also detect which specific months are missing and whether history exists for those months as fallback.

2. Update `allValid` check: forecast is valid if either fully covered OR partial + history fallback available.

3. Update `handleRollover` (line 196): before calling `onSuccess()`, run an auto-fill step:
   ```
   For each missing forecast month:
     1. Query sales_history WHERE year_month = (missing_month - 12 months)
     2. Insert into sales_forecasts with version = 'auto-history'
   ```

4. Update the validation row display to show a warning badge ("Will auto-fill from history") instead of a hard failure.

**No other files need to change.** The projection system already handles reading forecasts normally -- once the auto-filled rows exist in `sales_forecasts`, everything works.

### UI Change
The Forecast validation row will show one of three states:
- **Green**: Forecasts cover the full period
- **Yellow/Warning**: Partial coverage, missing months will be auto-filled from previous year history
- **Red**: No forecasts at all for the new period
