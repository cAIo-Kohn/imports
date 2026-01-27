
## Plan: Restructure Development Flow with Card Types and Activity History

### Understanding the Requirements

You want to reorganize the flow to:

1. **One card = One pending subject/sample** with all history tracked inside
2. **Resolved cards go to a "Solved" bucket** - hidden by default, filterable
3. **Two creation flows:**
   - **New Items**: Individual product OR grouped products (e.g., a whole pet products line)
   - **New Task**: Non-product tasks (pending things to solve)
4. **Both sides (Brazil team + Traders) can create and act on cards**
5. **Every update tracked with date, user name, and content**

---

### Current State Analysis

| What Exists | What Needs to Change |
|-------------|---------------------|
| 9 Kanban columns (backlog to rejected) | Simplify to fewer columns + "Solved" bucket |
| `item_type`: new_item, sample, development | Change to: `item`, `item_group`, `task` |
| Comments track activity | Need structured activity log with event types |
| Single items only | Support grouped items with child products |
| All items visible | Filter to hide "solved" by default |

---

### Database Changes

#### 1. New Enum for Card Type
```sql
-- Replace development_item_type enum
CREATE TYPE development_card_type AS ENUM ('item', 'item_group', 'task');
```

#### 2. Simplified Status Enum
```sql
-- Simplify status workflow
CREATE TYPE development_card_status AS ENUM (
  'pending',        -- New / Open
  'in_progress',    -- Being worked on
  'waiting',        -- Waiting for response (from either side)
  'solved'          -- Resolved / Done
);
```

#### 3. New Table: `development_card_products` (for grouped items)
```sql
CREATE TABLE development_card_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES development_items(id) ON DELETE CASCADE NOT NULL,
  product_code TEXT NOT NULL,
  product_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID NOT NULL
);
```

#### 4. Enhanced Activity Log Table
Replace simple comments with structured activity log:
```sql
CREATE TABLE development_card_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES development_items(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL, -- 'comment', 'status_change', 'sample_added', 'product_added', etc.
  content TEXT,                -- Message or description
  metadata JSONB,              -- Store old/new values, sample info, etc.
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

#### 5. Update `development_items` Table
```sql
ALTER TABLE development_items 
  ADD COLUMN card_type development_card_type DEFAULT 'item',
  ADD COLUMN is_solved BOOLEAN DEFAULT false;
```

---

### Simplified Workflow

```text
+------------------+     +---------------+     +-----------+     +----------+
|     PENDING      | --> |  IN PROGRESS  | --> |  WAITING  | --> |  SOLVED  |
+------------------+     +---------------+     +-----------+     +----------+
       ^                        |                   |
       |                        v                   v
       +------------------------+-------------------+
                    (can move back if needed)
```

- **Pending**: New cards, not yet started
- **In Progress**: Actively being worked on
- **Waiting**: Waiting for supplier, sample, or response
- **Solved**: Resolved (hidden by default, filterable)

---

### UI Changes

#### 1. New "Create Card" Modal with Two Tabs

**Tab 1: New Item(s)**
- Radio: Individual / Group
- If Individual: product code, supplier, description
- If Group: group name (e.g., "Pet Products Line 2024"), then add items inside

**Tab 2: New Task**
- Title, description, priority, due date
- No product code or supplier required

#### 2. Card Detail Drawer - Activity Tab Redesign

Show a unified timeline with all events:
```
[Avatar] John Doe - Jan 27, 2026 at 14:30
Changed status from "Pending" to "In Progress"

[Avatar] Maria Silva - Jan 27, 2026 at 15:45
Added comment:
"Requested quote from supplier, waiting for response"

[Avatar] Trader Wang - Jan 28, 2026 at 09:00
Added sample tracking:
Courier: DHL | Tracking: 1234567890

[Avatar] John Doe - Jan 29, 2026 at 10:00
Received sample, moving to review
```

#### 3. Kanban Board Simplification

From 9 columns to 3 + filter:
- **Pending** | **In Progress** | **Waiting**
- Toggle/filter to show "Solved" cards

#### 4. Card Display for Groups

For grouped items, show:
- Group name
- Item count badge (e.g., "5 products")
- Expandable list when clicked

---

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| Database migration | Create | New tables and enum changes |
| `src/pages/Development.tsx` | Modify | Simplify columns, add solved filter |
| `src/components/development/CreateCardModal.tsx` | Create | New modal with tabs for Item/Task |
| `src/components/development/CardDetailDrawer.tsx` | Modify | Unified activity timeline |
| `src/components/development/UnifiedActivityTimeline.tsx` | Create | Combined activity log component |
| `src/components/development/GroupedItemsEditor.tsx` | Create | For adding/managing items in a group |
| `src/components/development/DevelopmentCard.tsx` | Modify | Show card type icon, group badge |

---

### Access Control

Both teams can create and update cards:
- **Admin/Buyer**: Full access
- **Trader**: Can create cards, add comments, add samples, update status

The current RLS already allows Admin and Buyer to manage. We need to add Trader insert/update permissions.

---

### Summary

| Change | Impact |
|--------|--------|
| Simplify status to 4 values | Less horizontal scroll, clearer workflow |
| Add card types (item, group, task) | Separate product development from tasks |
| Unified activity log | All history in one place with structured events |
| Support grouped items | Track a line of products together |
| "Solved" filter | Hide resolved items by default |
| Trader access | Both teams can collaborate |
