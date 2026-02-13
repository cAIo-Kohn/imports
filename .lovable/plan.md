
## Make ARC (Trader) Dashboard & Navigation Identical to Other Roles

### Problem
Currently, ARC users see a stripped-down sidebar (only Dashboard and New Items & Samples under an "ARC" group), cannot access Purchase Orders list, and the Dashboard hides the "New Products Workflow" section from them.

### Changes

**1. Sidebar (`src/components/layout/AppSidebar.tsx`)**
- Remove the `!isOnlyTrader` condition that hides the Main Menu and Planning groups from traders
- Remove the separate "ARC" sidebar group entirely (it duplicates Dashboard and Development links)
- Remove the `!isOnlyTrader` condition from the Settings group
- Result: All users see the exact same sidebar menu

**2. Routes (`src/App.tsx`)**
- Add `'trader'` to the `allowedRoles` for `/purchase-orders` (line 164) so ARC can access the PO list
- Add `'trader'` to the `allowedRoles` for all other routes that currently exclude it: `/new-products`, `/products`, `/products/:id`, `/units`, `/suppliers`, `/suppliers/:id`, `/categories`, `/settings`, `/demand-planning`, `/demand-planning/:id`
- This makes all routes accessible to all authenticated roles

**3. Dashboard (`src/pages/Dashboard.tsx`)**
- Remove the `userDepartment !== 'trader'` condition (line 545) that hides the "New Products Workflow" section
- The section will still correctly show nothing for traders since they have no Step 1/2/3 tasks assigned, but it won't be forcefully hidden

### Technical Details

**Sidebar simplification:**
- Delete lines 100-125 (the entire "ARC" `SidebarGroup`)
- Change `{!isOnlyTrader && (` to always render (remove the condition) for Main Menu, Planning, and Settings groups

**Route changes (App.tsx):**
All `allowedRoles` arrays that currently have `['admin', 'buyer', 'quality', 'marketing', 'viewer']` will become `['admin', 'buyer', 'quality', 'marketing', 'viewer', 'trader']`

**Dashboard change:**
Line 545: `{userDepartment !== 'trader' && totalPendingNewProducts > 0 && (` becomes `{totalPendingNewProducts > 0 && (`

### What stays the same
- Users page remains admin-only
- RLS policies unchanged (traders can still only edit Chinese supplier orders)
- Internal role logic (`isBuyer`, `isTrader`, etc.) unchanged
