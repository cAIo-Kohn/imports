

## Plan: New Items and Samples - Task Management System

### Overview

Create a new section called **"New Items and Samples"** positioned above Products in the sidebar. This will be a Trello/Notion-inspired task management system designed to handle:

- New item developments between Brazil and China
- Pending tasks and follow-ups
- Sample request and tracking
- Courier tracking for shipped samples

The interface will feature a **Kanban board** with draggable cards, combined with a **detailed task view** for managing all aspects of product development.

---

### Database Design

#### 1. `development_items` Table (Main task/card)

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| title | text | Item name/title (required) |
| description | text | Detailed description |
| status | enum | Current workflow stage |
| priority | enum | low, medium, high, urgent |
| item_type | enum | new_item, sample, development |
| product_code | text | Reference product code (if exists) |
| supplier_id | uuid | FK to suppliers |
| assigned_to | uuid | FK to profiles (who is responsible) |
| created_by | uuid | FK to profiles |
| due_date | date | Target completion date |
| created_at | timestamp | Creation date |
| updated_at | timestamp | Last update |

#### 2. `development_item_statuses` Enum

| Status Key | Display Label | Description |
|------------|---------------|-------------|
| backlog | Backlog | Idea/pending evaluation |
| in_progress | In Progress | Being worked on |
| waiting_supplier | Waiting Supplier | Waiting for supplier response |
| sample_requested | Sample Requested | Sample has been requested |
| sample_in_transit | Sample In Transit | Sample shipped, tracking active |
| sample_received | Sample Received | Sample arrived in Brazil |
| under_review | Under Review | Sample being evaluated |
| approved | Approved | Ready for production |
| rejected | Rejected | Not proceeding |

#### 3. `development_item_comments` Table (Activity/Notes)

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| item_id | uuid | FK to development_items |
| user_id | uuid | FK to profiles |
| content | text | Comment content |
| created_at | timestamp | When posted |

#### 4. `development_item_samples` Table (Sample tracking)

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| item_id | uuid | FK to development_items |
| courier_name | text | DHL, FedEx, TNT, etc. |
| tracking_number | text | Courier tracking code |
| shipped_date | date | When shipped |
| estimated_arrival | date | ETA |
| actual_arrival | date | When received |
| quantity | integer | Number of samples |
| notes | text | Additional info |
| status | enum | pending, in_transit, delivered, returned |
| created_at | timestamp | Creation date |

---

### User Interface

#### Sidebar Navigation

```text
+-- New Items & Samples  <-- NEW (with Lightbulb icon)
+-- Products
+-- Suppliers
+-- Units
...
```

#### Main Page: Kanban Board View (`/development`)

**Header:**
- Title: "New Items & Samples"
- Subtitle: "Manage product development and sample tracking"
- Action buttons: "New Item", Filter dropdown, View toggle (Board/List)

**Kanban Columns:**
```text
| Backlog | In Progress | Waiting Supplier | Sample Requested | Sample In Transit | Sample Received | Approved |
|---------|-------------|------------------|------------------|-------------------|-----------------|----------|
| [Card]  | [Card]      | [Card]           | [Card]           | [Card]            | [Card]          | [Card]   |
| [Card]  | [Card]      |                  | [Card]           |                   |                 |          |
|         |             |                  |                  |                   |                 |          |
```

**Card Preview:**
```text
+----------------------------+
| [Priority] Item Title      |
| Supplier Name              |
| [Sample icon] 2 samples    |
| Due: 15/02/2026            |
| [Avatar] Assigned          |
+----------------------------+
```

#### Item Detail Modal/Drawer

When clicking a card, open a side drawer with:

**Header Section:**
- Title (editable)
- Status dropdown
- Priority badge
- Close button

**Main Content Tabs:**

1. **Details Tab:**
   - Description (rich text)
   - Product Code reference
   - Supplier selector
   - Assigned to dropdown
   - Due date picker
   - Item type selector

2. **Samples Tab:**
   - List of sample shipments
   - Add sample tracking form:
     - Courier name
     - Tracking number (with link to tracking site)
     - Shipped date
     - ETA
     - Quantity
   - Sample status badges

3. **Activity Tab:**
   - Timeline of comments and changes
   - Add comment form
   - Shows: "John added a comment", "Status changed to Sample Requested", etc.

---

### Files to Create

| File | Purpose |
|------|---------|
| `src/pages/Development.tsx` | Main Kanban board page |
| `src/components/development/KanbanBoard.tsx` | Kanban layout with columns |
| `src/components/development/KanbanColumn.tsx` | Single column component |
| `src/components/development/DevelopmentCard.tsx` | Card preview component |
| `src/components/development/CreateItemModal.tsx` | Modal for creating new items |
| `src/components/development/ItemDetailDrawer.tsx` | Detailed view drawer |
| `src/components/development/SampleTrackingCard.tsx` | Sample shipment display |
| `src/components/development/AddSampleForm.tsx` | Form to add sample tracking |
| `src/components/development/ActivityTimeline.tsx` | Comments/activity display |

### Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Add route `/development` |
| `src/components/layout/AppSidebar.tsx` | Add "New Items & Samples" menu item above Products |

---

### Implementation Flow

#### Phase 1: Database Setup

```sql
-- Create enums
CREATE TYPE development_item_status AS ENUM (
  'backlog', 'in_progress', 'waiting_supplier', 
  'sample_requested', 'sample_in_transit', 'sample_received',
  'under_review', 'approved', 'rejected'
);

CREATE TYPE development_item_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TYPE development_item_type AS ENUM ('new_item', 'sample', 'development');

CREATE TYPE sample_shipment_status AS ENUM ('pending', 'in_transit', 'delivered', 'returned');

-- Create main table
CREATE TABLE public.development_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status development_item_status NOT NULL DEFAULT 'backlog',
  priority development_item_priority DEFAULT 'medium',
  item_type development_item_type DEFAULT 'new_item',
  product_code text,
  supplier_id uuid REFERENCES suppliers(id),
  assigned_to uuid,
  created_by uuid NOT NULL,
  due_date date,
  position integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create samples table
CREATE TABLE public.development_item_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES development_items(id) ON DELETE CASCADE NOT NULL,
  courier_name text,
  tracking_number text,
  shipped_date date,
  estimated_arrival date,
  actual_arrival date,
  quantity integer DEFAULT 1,
  notes text,
  status sample_shipment_status DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create comments table
CREATE TABLE public.development_item_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES development_items(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE development_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE development_item_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE development_item_comments ENABLE ROW LEVEL SECURITY;

-- Policies for development_items
CREATE POLICY "Authenticated users can view development_items"
ON development_items FOR SELECT USING (true);

CREATE POLICY "Admins and buyers can manage development_items"
ON development_items FOR ALL USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'buyer')
);

-- Similar policies for samples and comments tables
```

#### Phase 2: Sidebar Update

Add new menu item in `AppSidebar.tsx`:

```tsx
const menuItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'New Items & Samples', url: '/development', icon: Lightbulb }, // NEW
  { title: 'Products', url: '/products', icon: Package },
  // ...
];
```

#### Phase 3: Main Page Implementation

The Kanban board will use a horizontally scrollable layout with columns for each status. Cards can be dragged between columns to update status (using native drag-and-drop or a library like `@dnd-kit`).

**Key Features:**
- Horizontal scroll for columns
- Drag-and-drop cards between columns
- Click to open detail drawer
- Inline status update via dropdown
- Filter by supplier, priority, assigned user
- Search by title or product code

#### Phase 4: Card Detail Drawer

A slide-out drawer showing:
- Editable title and description
- Status and priority selectors
- Sample tracking list with courier links
- Activity timeline with comments
- Quick actions (assign, set due date)

---

### Access Control

Following existing patterns:
- **Admin & Buyer:** Full CRUD access
- **Viewer:** Read-only access
- **Trader:** No access (hidden from sidebar like other sections)

---

### Technical Considerations

1. **Drag and Drop:** Use native HTML5 drag-and-drop for simplicity, or consider `@dnd-kit` for smoother UX
2. **Optimistic Updates:** Update UI immediately when moving cards, sync with database
3. **Real-time (Optional):** Could enable Supabase realtime for multi-user collaboration
4. **Position Ordering:** Use `position` column for card ordering within columns
5. **Courier Tracking Links:** Generate tracking URLs based on courier name (DHL, FedEx, etc.)

---

### Courier Tracking URL Patterns

| Courier | URL Pattern |
|---------|-------------|
| DHL | `https://www.dhl.com/en/express/tracking.html?AWB={tracking}` |
| FedEx | `https://www.fedex.com/fedextrack/?trknbr={tracking}` |
| TNT | `https://www.tnt.com/express/en_us/site/tracking.html?searchType=con&cons={tracking}` |
| UPS | `https://www.ups.com/track?tracknum={tracking}` |
| SF Express | `https://www.sf-express.com/us/en/dynamic_function/waybill/#search/bill-number/{tracking}` |

---

### Summary

| Category | Count |
|----------|-------|
| New Database Tables | 3 |
| New Enums | 4 |
| New Pages | 1 |
| New Components | 9 |
| Modified Files | 2 |

This implementation provides a complete task management system tailored for managing new product development and sample tracking between Brazil and China suppliers, following the existing design patterns and security model of the application.

