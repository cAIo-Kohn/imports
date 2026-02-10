

## Add "Purchase Orders" Section to Dashboard

### What It Does
Adds a new section to the Dashboard showing all purchase orders organized by status in a visual pipeline flow. Each status is a column/group showing the count and listing the orders in that stage.

### Visual Layout
A horizontal flow of status groups, each showing:
- Status name with icon and count badge
- List of orders in that status (reference number, supplier, value, date)
- Click navigates to the order detail page

The flow follows the natural order:
**Draft** -> **Awaiting Trader** -> **Pending Changes** -> **Confirmed** -> **Shipped** -> **Received**

(Cancelled orders shown separately if any exist)

### Technical Details

**File: `src/pages/Dashboard.tsx`**

1. **New query**: Fetch purchase orders with supplier info, grouped by status
   ```typescript
   const { data: purchaseOrders } = useQuery({
     queryKey: ['dashboard-purchase-orders'],
     queryFn: async () => {
       const { data } = await supabase
         .from('purchase_orders')
         .select('id, order_number, reference_number, status, etd, total_value_usd, created_at, suppliers(company_name)')
         .order('created_at', { ascending: false });
       return data || [];
     },
   });
   ```

2. **Group orders by status** using a `useMemo` that creates a map of status -> orders[]

3. **Define pipeline stages** as an ordered array matching the STATUS_CONFIG from PurchaseOrders.tsx:
   - `draft` (Draft)
   - `pending_trader_review` (Awaiting Trader)
   - `pending_buyer_approval` (Pending Changes)
   - `confirmed` (Confirmed)
   - `shipped` (Shipped)
   - `received` (Received)

4. **Render section** after the "New Products Workflow" section (visible to all non-trader roles):
   - Section header: "Purchase Orders" with ShoppingCart icon and link to /purchase-orders
   - Horizontal scrollable row of status columns
   - Each column: icon + label + count badge, then compact order cards
   - Each order card shows: reference number (or order number), supplier name, total value
   - Clicking a card navigates to `/purchase-orders/{id}`

5. **Add realtime subscription** for `purchase_orders` table changes to auto-refresh

6. **Imports**: Add `ShoppingCart`, `useNavigate`, and reuse status config icons (Clock, AlertTriangle, CheckCircle, Truck, Container)

### Visibility
- Show for all roles except pure traders (consistent with other dashboard sections)
- Traders already have their own Trader Dashboard with pending orders
