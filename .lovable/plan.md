

## Add Commercial Data History to Commercial Data Section

### Problem
The "Commercial Data" accordion section only displays the current FOB Price, MOQ, Qty/Container, and Container Type values. Unlike the Sample Tracking section which shows a complete history (requested, shipped, arrived, approved/rejected), the commercial data section doesn't show the negotiation history including:
- When data was requested
- When data was submitted (with values or file uploads)
- When data was rejected (with feedback)
- When data was approved
- Access to uploaded files

### Solution
Enhance `CommercialDataSection.tsx` to fetch and display commercial data workflow history from `development_card_tasks` and `development_card_activity` tables, similar to how `SampleHistoryTimeline` works.

### Technical Changes

**1. Update `src/components/development/CommercialDataSection.tsx`**

- Add a query to fetch commercial-related tasks (`commercial_request`, `commercial_review`) for this card
- Add a query to fetch commercial-related activities from `development_card_activity`
- Display a timeline showing:
  - **Requested**: Who requested and when
  - **Submitted**: Who filled data, what values, any attached files
  - **Rejected** (if applicable): Who rejected, feedback, revision number
  - **Approved**: Who approved and when
- Render uploaded files as downloadable links (from task metadata `attachments` array)

**2. New Component: `CommercialHistoryTimeline`**

Create a sub-component to display:
```tsx
interface CommercialHistoryStep {
  action: 'requested' | 'submitted' | 'rejected' | 'approved';
  userId: string;
  userName: string | null;
  timestamp: string;
  data?: { fob_price?: number; moq?: number; ... };
  attachments?: UploadedAttachment[];
  feedback?: string;
  revisionNumber?: number;
}
```

**3. Data Sources**
- Tasks table: `development_card_tasks` where `task_type IN ('commercial_request', 'commercial_review')`
- Activity table: `development_card_activity` where metadata contains `task_type` like `commercial_*`

**4. UI Layout**
```
┌─────────────────────────────────────┐
│ Current Data (existing grid)        │
│ FOB: $X.XX  |  MOQ: XXXX           │
│ Qty/Cont: XXXX  |  Container: 40ft │
├─────────────────────────────────────┤
│ Negotiation History                 │
│ ─────────────────────────────────── │
│ ✅ Feb 5, 16:14 - Approved          │
│    by Caio Kohn                     │
│ ─────────────────────────────────── │
│ 📎 Feb 5, 16:13 - Submitted (file)  │
│    by Caio Kohn                     │
│    📄 Galaxy Cat litter quotation   │
│ ─────────────────────────────────── │
│ 📋 Feb 5, 15:51 - Requested         │
│    by Caio Kohn                     │
└─────────────────────────────────────┘
```

### Files to Modify
- `src/components/development/CommercialDataSection.tsx` (major changes - add history query and display)

### Files to Create
- None (inline in CommercialDataSection or extract to CommercialHistoryTimeline component)

