

## Allow Traders to See the Main Dashboard

### What Changes
Currently, users with only the "trader" role are automatically redirected from `/` to `/trader` (Trader Dashboard) and never see the main Dashboard with pending cards, new products workflow, and the purchase orders pipeline. This change will let traders access the same Dashboard as everyone else.

### Changes Required

**File: `src/App.tsx`**
- Remove the automatic redirect in `HomeRedirect` that sends `isOnlyTrader` users to `/trader`
- Traders will now land on the main Dashboard at `/` like all other roles

**File: `src/pages/Dashboard.tsx`**
- Remove the `!isOnlyTrader` guard on the "Purchase Orders Pipeline" section (line 671), so traders can also see orders in the pipeline
- The other Dashboard sections (pending cards, new products workflow) already render based on department logic and will naturally show trader-relevant content

**File: `src/components/layout/AppSidebar.tsx`**
- Add the Dashboard link to the Trader sidebar section so traders can navigate back to it
- Keep the Trader Dashboard link as well, giving traders access to both views

### Result
Traders will see the full Dashboard on login, including their pending development cards, purchase orders pipeline, and can still navigate to the dedicated Trader Dashboard for order approvals via the sidebar.
