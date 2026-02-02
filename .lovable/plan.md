

# Task-Based Workflow for Commercial Data & Samples

## Overview

Transform Commercial Data and Sample Tracking into a task-based workflow where:
1. Users **request** information/samples and **assign** to a team or user
2. The assignee sees a **pending task banner** at the top of the timeline
3. Upon completion, the assignee can **reassign** responsibility back
4. All pending tasks are visible to everyone via colorful, collapsible banners

---

## Current State vs New State

| Feature | Current | New |
|---------|---------|-----|
| Commercial Data | Individual field edits, no validation | All 4 fields required together, confirm to save |
| Commercial Request | None | Request commercial data → assign to team → fills data → assigns back for confirmation |
| Sample Request | Simple request with quantity/notes | Request → assign to team/user → add tracking → assign back |
| Pending Tasks | Per-card pending_action_type | Per-request tasks with assignee visible to all |
| Notifications | Only @mentions | Team/role assignment triggers notifications |

---

## Database Changes

### New Table: `development_card_tasks`

```sql
CREATE TABLE development_card_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES development_items(id),
  
  -- Task type and status
  task_type TEXT NOT NULL, -- 'sample_request', 'commercial_request'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
  
  -- Assignment
  assigned_to_users UUID[] DEFAULT '{}',
  assigned_to_role TEXT, -- 'buyer', 'trader', 'quality', 'marketing'
  
  -- Who created the task (to reassign back to)
  created_by UUID NOT NULL,
  
  -- Task-specific data (JSON)
  metadata JSONB DEFAULT '{}',
  -- For sample: { quantity: 2, notes: "Need 2 colors" }
  -- For commercial: { requested_by: uuid }
  -- After completion: { fob_price: 2.50, moq: 1000, ... } or { courier: "DHL", tracking: "123" }
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  
  -- Links to related records
  sample_id UUID REFERENCES development_item_samples(id), -- For sample tasks
  
  CONSTRAINT valid_task_type CHECK (task_type IN ('sample_request', 'commercial_request'))
);

-- Index for efficient queries
CREATE INDEX idx_card_tasks_card_id ON development_card_tasks(card_id);
CREATE INDEX idx_card_tasks_assigned_role ON development_card_tasks(assigned_to_role) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE development_card_tasks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view all tasks" ON development_card_tasks
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create tasks" ON development_card_tasks
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Assigned users can update tasks" ON development_card_tasks
  FOR UPDATE USING (
    auth.uid() = ANY(assigned_to_users) OR
    has_role(auth.uid(), assigned_to_role::app_role) OR
    has_role(auth.uid(), 'admin'::app_role)
  );
```

---

## New Components

### 1. `PendingTasksBanner.tsx`
Collapsible banner showing all pending tasks on a card.

```
┌────────────────────────────────────────────────────────────────────────┐
│ 🔔 2 Pending Tasks                                        [▼ Collapse] │
├────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 📦 SAMPLE REQUEST                      Assigned to: Trader 🏷️   │  │
│  │ 2 pcs needed • "Need blue and red colors"                        │  │
│  │ Requested by Vitória • 2 hours ago                               │  │
│  │                                                                   │  │
│  │ [Add Tracking & Reassign ▶]                                      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 💰 COMMERCIAL DATA REQUEST             Assigned to: Trader 🏷️   │  │
│  │ Price, MOQ, Container info requested                             │  │
│  │ Requested by Pedro • 1 day ago                                   │  │
│  │                                                                   │  │
│  │ [Fill Commercial Data ▶]                                         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### 2. `TaskCard.tsx`
Individual task card within the banner.

### 3. `RequestCommercialDataModal.tsx`
Modal to request commercial data and assign to a team.

```
┌────────────────────────────────────────────────────────────────────────┐
│  Request Commercial Data                                     [X]      │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Assign to:                                                           │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ [👤 Select user or team...]                                    │   │
│  │ • Trader (Team)                                                │   │
│  │ • Jin Wei                                                      │   │
│  │ • Marketing (Team)                                             │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  Optional note:                                                        │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ Please provide FOB price for 40HQ container                    │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│                                      [Cancel]  [Request & Assign ▶]   │
└────────────────────────────────────────────────────────────────────────┘
```

### 4. `FillCommercialDataModal.tsx`
Modal for filling all 4 commercial data fields together.

```
┌────────────────────────────────────────────────────────────────────────┐
│  Fill Commercial Data                                        [X]      │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  FOB Price (USD) *           MOQ *                                    │
│  ┌──────────────────┐        ┌──────────────────┐                     │
│  │ $ 2.50           │        │ 1000             │                     │
│  └──────────────────┘        └──────────────────┘                     │
│                                                                        │
│  Qty per Container *         Container Type *                         │
│  ┌──────────────────┐        ┌──────────────────┐                     │
│  │ 50000            │        │ 40HQ          ▼  │                     │
│  └──────────────────┘        └──────────────────┘                     │
│                                                                        │
│  ⓘ All fields are required. The requester will be notified.          │
│                                                                        │
│                              [Cancel]  [Confirm & Notify Requester ▶] │
└────────────────────────────────────────────────────────────────────────┘
```

### 5. `RequestSampleModal.tsx`
Enhanced sample request with team assignment.

```
┌────────────────────────────────────────────────────────────────────────┐
│  Request Sample                                              [X]      │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Quantity:              Assign to: *                                  │
│  ┌──────────┐           ┌────────────────────────────────────────┐    │
│  │ 2        │           │ 🏷️ Trader                           ▼  │    │
│  └──────────┘           └────────────────────────────────────────┘    │
│                                                                        │
│  Notes (optional):                                                     │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ Need blue and red color samples for quality check              │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ⓘ The assigned team will be notified to send the sample.            │
│                                                                        │
│                                    [Cancel]  [Request & Assign ▶]     │
└────────────────────────────────────────────────────────────────────────┘
```

### 6. `AddTrackingAndReassignModal.tsx`
Modal for adding tracking and reassigning back to requester.

```
┌────────────────────────────────────────────────────────────────────────┐
│  Add Tracking & Complete Task                                [X]      │
├────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Task: Sample Request (2 pcs)                                    │  │
│  │ Requested by: Vitória                                           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  Courier *                   Tracking Number *                        │
│  ┌──────────────────┐        ┌──────────────────────────────────┐     │
│  │ DHL           ▼  │        │ 1234567890                       │     │
│  └──────────────────┘        └──────────────────────────────────┘     │
│                                                                        │
│  Shipped Date               ETA                   Quantity            │
│  ┌──────────────────┐       ┌──────────────────┐  ┌──────────┐        │
│  │ 2026-02-02       │       │ 2026-02-10       │  │ 2        │        │
│  └──────────────────┘       └──────────────────┘  └──────────┘        │
│                                                                        │
│  ⓘ Vitória will be notified that the sample is on its way.           │
│                                                                        │
│                                    [Cancel]  [Ship & Notify ▶]        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Modified Components

### `ItemDetailDrawer.tsx`
- Add `PendingTasksBanner` at the top (before chat timeline)
- Update accordion sections with "Request" buttons

### `CommercialDataSection.tsx`
- Remove individual field blur-save
- Add "Request Commercial Data" button for non-assignees
- Add "Fill All Data" button that opens modal with all 4 required fields
- Show read-only display if data is confirmed

### `SampleTrackingSection.tsx`
- Replace "Request" form with modal that includes assignment
- Show pending sample requests with action buttons

---

## Workflow Diagrams

### Sample Request Flow

```
┌───────────────┐     ┌──────────────────┐     ┌────────────────────┐
│   BUYER       │     │    TRADER        │     │     BUYER          │
│  (Requester)  │     │   (Assigned)     │     │  (Confirm Arrival) │
└───────┬───────┘     └────────┬─────────┘     └─────────┬──────────┘
        │                      │                         │
        │  Request Sample      │                         │
        │  [Assign to Trader]  │                         │
        │─────────────────────>│                         │
        │                      │                         │
        │                      │ 🔔 Notification         │
        │                      │ "Sample requested"      │
        │                      │                         │
        │                      │ Add Tracking            │
        │                      │ [Reassign to Buyer]     │
        │                      │────────────────────────>│
        │                      │                         │
        │                      │              🔔 Notification
        │                      │              "Sample shipped"
        │                      │                         │
        │                      │              Mark Arrived
        │                      │              [Review Sample]
        │<─────────────────────────────────────────────────
        │                      │                         │
```

### Commercial Data Request Flow

```
┌───────────────┐     ┌──────────────────┐     ┌────────────────────┐
│   BUYER       │     │    TRADER        │     │     BUYER          │
│  (Requester)  │     │   (Assigned)     │     │   (Confirmer)      │
└───────┬───────┘     └────────┬─────────┘     └─────────┬──────────┘
        │                      │                         │
        │  Request Commercial  │                         │
        │  [Assign to Trader]  │                         │
        │─────────────────────>│                         │
        │                      │                         │
        │                      │ 🔔 Notification         │
        │                      │ "Commercial data needed"│
        │                      │                         │
        │                      │ Fill All 4 Fields       │
        │                      │ [Confirm & Notify]      │
        │                      │────────────────────────>│
        │                      │                         │
        │                      │              🔔 Notification
        │                      │              "Data provided, 
        │                      │               please confirm"
        │                      │                         │
        │                      │              [Confirm] or
        │                      │              [Request Changes]
        │<─────────────────────────────────────────────────
```

---

## Notification System Integration

### Trigger Notifications

| Event | Recipients | Notification Title |
|-------|------------|-------------------|
| Sample requested | All users with assigned role | "{Name} requested a sample" |
| Sample shipped | Task creator | "{Name} shipped the sample via {Courier}" |
| Sample arrived | Task creator | "Sample has arrived, please review" |
| Commercial data requested | All users with assigned role | "{Name} requested commercial data" |
| Commercial data filled | Task creator | "{Name} provided commercial data" |
| Commercial data confirmed | Task completer | "{Name} confirmed the commercial data" |

### Implementation

Use existing `notifications` table with new types:
- `sample_request`
- `sample_shipped`
- `sample_arrived`
- `commercial_request`
- `commercial_filled`
- `commercial_confirmed`

---

## Files to Create

| File | Purpose |
|------|---------|
| `PendingTasksBanner.tsx` | Collapsible banner showing all pending tasks |
| `TaskCard.tsx` | Individual task display with actions |
| `RequestCommercialDataModal.tsx` | Modal for requesting commercial data |
| `FillCommercialDataModal.tsx` | Modal for filling all 4 fields together |
| `RequestSampleModal.tsx` | Modal for requesting sample with assignment |
| `AddTrackingModal.tsx` | Modal for adding tracking and reassigning |
| `useCardTasks.ts` | Hook for fetching/managing card tasks |

## Files to Modify

| File | Changes |
|------|---------|
| `ItemDetailDrawer.tsx` | Add PendingTasksBanner before chat |
| `CommercialDataSection.tsx` | Replace field-by-field with request/fill workflow |
| `SampleTrackingSection.tsx` | Add assignment to sample requests |
| `useNotifications.ts` | Add new notification types |

## Database Migration

1. Create `development_card_tasks` table
2. Add RLS policies
3. Add indexes for performance

---

## Summary

This implementation creates a clear task-based workflow where:

1. **Visibility**: All pending tasks are shown prominently at the top of the card
2. **Accountability**: Every task has a clear owner (user or team)
3. **Notifications**: Team members are notified when assigned tasks
4. **Completion**: Tasks naturally flow back to the requester for confirmation
5. **Simplicity**: Commercial data requires all 4 fields together - no partial saves

The colorful, collapsible banners make it immediately obvious what needs attention, and the assignment/reassignment flow ensures clear handoffs between team members.

