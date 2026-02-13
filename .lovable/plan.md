

## Always Show "New Products Workflow" and "Purchase Orders" Dashboard Sections

### Problem
The "New Products Workflow" and "Purchase Orders" sections on the Dashboard are only rendered when they have data (`totalPendingNewProducts > 0` and `purchaseOrders.length > 0`). When there are no items, the sections disappear entirely, making users think they were removed.

### Solution
Always render both sections regardless of data count. When empty, show a friendly empty state with a link to navigate to the full page -- matching the pattern already used by "Your Team's Pending Cards".

### Changes (single file: `src/pages/Dashboard.tsx`)

**1. New Products Workflow (line 545)**
- Remove the `totalPendingNewProducts > 0 &&` condition so the section always renders
- Add an empty state inside when `totalPendingNewProducts === 0` showing "No pending workflow items" with a "See all" link to `/new-products`

**2. Purchase Orders Pipeline (line 671)**
- Remove the `purchaseOrders.length > 0 &&` condition so the section always renders
- The pipeline columns already show "No orders" per stage, so it will display properly even when empty

### Result
All three dashboard sections (Pending Cards, New Products Workflow, Purchase Orders) will always be visible to every role, providing a consistent layout.

