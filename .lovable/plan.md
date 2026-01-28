
## Plan: Complete Sample Workflow System

### Overview

This implements a multi-stage sample workflow that facilitates communication between Brazil (MOR) and China (ARC) teams through the card system.

---

### Sample Workflow Stages

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SAMPLE WORKFLOW LIFECYCLE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. REQUEST SAMPLE (Brazil)                                                 │
│     └─► Buyer clicks "Request Sample" → Card moves to ARC (China)          │
│         Activity: sample_requested                                         │
│                                                                             │
│  2. SHIP SAMPLE (China)                                                     │
│     └─► China adds tracking info → Card moves back to MOR (Brazil)         │
│         Activity: sample_shipped                                           │
│         Sample status: in_transit                                          │
│                                                                             │
│  3. RECEIVE SAMPLE (Brazil)                                                 │
│     └─► Brazil marks arrival → Sample status: delivered                    │
│         Activity: sample_arrived                                           │
│         Card stays with Brazil                                             │
│                                                                             │
│  4. APPROVE/REJECT (Brazil)                                                │
│     └─► Brazil reviews and decides → Can upload report (PDF/images)        │
│         Activity: sample_approved OR sample_rejected                       │
│         Card can be marked as solved if approved                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### UI Changes

#### 1. Update "Request Sample" Button Behavior

**File: `HistoryTimeline.tsx`**

When buyer clicks "Request Sample" in the NextStepPrompt:
- Log `sample_requested` activity
- Move card to ARC (China)
- Show success toast

```typescript
// In NextStepPrompt, onRequestSample now does:
const handleRequestSample = async () => {
  // 1. Log sample_requested activity
  await supabase.from('development_card_activity').insert({
    card_id: cardId,
    user_id: user.id,
    activity_type: 'sample_requested',
    content: 'Sample requested',
  });
  
  // 2. Move card to ARC
  await supabase.from('development_items')
    .update({ 
      current_owner: 'arc',
      is_new_for_other_team: true 
    })
    .eq('id', cardId);
  
  // 3. Log ownership change
  await supabase.from('development_card_activity').insert({
    card_id: cardId,
    user_id: user.id,
    activity_type: 'ownership_change',
    content: 'Card moved to ARC (China)',
    metadata: { new_owner: 'arc', trigger: 'sample_request' },
  });
};
```

#### 2. New Attention Banner Variants

**File: `HistoryTimeline.tsx` - AttentionBanner component**

Add support for sample-related activity types:

| Activity Type | Banner Color | Title | Actions |
|---------------|--------------|-------|---------|
| `sample_requested` | Cyan | "Sample Requested" | "Add Tracking" / "Comment" |
| `sample_shipped` | Blue | "Sample Shipped" | "Mark Arrived" / "Comment" |
| `sample_arrived` (delivered status) | Amber | "Awaiting Review" | "Approve" / "Reject" |

```typescript
// AttentionBanner additions:
const isSampleRequested = activity.activity_type === 'sample_requested';
const isSampleShipped = activity.activity_type === 'sample_shipped';

// Styling:
isSampleRequested && "bg-cyan-50 border-cyan-300"
isSampleShipped && "bg-blue-50 border-blue-300"
```

#### 3. Inline Sample Shipping Form

**New file: `InlineSampleShipForm.tsx`**

When China sees "Sample Requested" banner, they can:
1. Click "Add Tracking" to expand inline form
2. Fill in courier, tracking number, shipped date, ETA
3. Submit → Creates sample record + logs activity + moves card

```typescript
interface InlineSampleShipFormProps {
  cardId: string;
  currentOwner: 'mor' | 'arc';
  onClose: () => void;
  onSuccess: () => void;
}

export function InlineSampleShipForm({ cardId, currentOwner, onClose, onSuccess }) {
  // Form fields: courier, tracking, shipped date, ETA, quantity, notes
  
  const handleSubmit = async () => {
    // 1. Create sample record
    await supabase.from('development_item_samples').insert({
      item_id: cardId,
      courier_name: courier,
      tracking_number: tracking,
      shipped_date: shippedDate,
      estimated_arrival: eta,
      quantity: qty,
      notes: notes,
      status: 'in_transit',
    });
    
    // 2. Log sample_shipped activity
    await supabase.from('development_card_activity').insert({
      card_id: cardId,
      user_id: user.id,
      activity_type: 'sample_shipped',
      content: 'Sample shipped',
      metadata: { courier, tracking, eta },
    });
    
    // 3. Move card to MOR (Brazil)
    await supabase.from('development_items')
      .update({ current_owner: 'mor', is_new_for_other_team: true })
      .eq('id', cardId);
    
    // 4. Log ownership change
    await supabase.from('development_card_activity').insert({
      activity_type: 'ownership_change',
      content: 'Card moved to MOR (Brazil)',
      metadata: { new_owner: 'mor', trigger: 'sample_shipped' },
    });
  };
}
```

#### 4. Sample Arrival Action

**Update: `SampleTrackingCard.tsx`**

Add "Mark as Arrived" button when sample is in_transit:

```typescript
{sample.status === 'in_transit' && canEdit && (
  <Button 
    size="sm" 
    variant="outline"
    onClick={handleMarkArrived}
  >
    <CheckCircle className="h-3 w-3 mr-1" />
    Mark as Arrived
  </Button>
)}

const handleMarkArrived = async () => {
  // 1. Update sample status
  await supabase.from('development_item_samples')
    .update({ 
      status: 'delivered', 
      actual_arrival: new Date().toISOString() 
    })
    .eq('id', sample.id);
  
  // 2. Log activity
  await supabase.from('development_card_activity').insert({
    activity_type: 'sample_arrived',
    content: 'Sample arrived',
    metadata: { sample_id: sample.id },
  });
};
```

#### 5. Sample Approval/Rejection Section

**New file: `SampleReviewSection.tsx`**

Shows when sample is delivered, before approval:

```typescript
export function SampleReviewSection({ cardId, sample, onReviewed }) {
  const [showReportUpload, setShowReportUpload] = useState(false);
  
  return (
    <div className="border-2 border-amber-300 bg-amber-50 rounded-lg p-4">
      <h4 className="font-medium flex items-center gap-2">
        <FileCheck className="h-4 w-4" />
        Sample Review Required
      </h4>
      <p className="text-sm text-muted-foreground mb-4">
        The sample has arrived. Please test and provide your decision.
      </p>
      
      {/* Optional Report Upload */}
      <div className="mb-4">
        <Button variant="outline" size="sm" onClick={() => setShowReportUpload(true)}>
          <Upload className="h-3 w-3 mr-1" />
          Upload Report (PDF/Images)
        </Button>
        {/* File upload component here */}
      </div>
      
      {/* Decision Buttons */}
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          className="border-red-300 text-red-700 hover:bg-red-50"
          onClick={() => handleDecision('rejected')}
        >
          <XCircle className="h-4 w-4 mr-1" />
          Reject Sample
        </Button>
        <Button 
          className="bg-green-600 hover:bg-green-700"
          onClick={() => handleDecision('approved')}
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          Approve Sample
        </Button>
      </div>
    </div>
  );
}
```

---

### Activity Types to Add

| Activity Type | Icon | Color | Description |
|---------------|------|-------|-------------|
| `sample_requested` | Package | Cyan | Buyer requests a sample |
| `sample_shipped` | Truck | Blue | China ships the sample |
| `sample_arrived` | PackageCheck | Green | Sample arrived at Brazil |
| `sample_approved` | CheckCircle | Green | Sample approved with optional report |
| `sample_rejected` | XCircle | Red | Sample rejected with feedback |

---

### Database Changes

#### Add `report_url` to development_item_samples

```sql
ALTER TABLE public.development_item_samples
  ADD COLUMN IF NOT EXISTS report_url TEXT,
  ADD COLUMN IF NOT EXISTS decision TEXT CHECK (decision IN ('approved', 'rejected', NULL)),
  ADD COLUMN IF NOT EXISTS decision_notes TEXT,
  ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decided_by UUID REFERENCES auth.users(id);
```

---

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| Database migration | Create | Add report fields to samples table |
| `src/components/development/InlineSampleShipForm.tsx` | Create | Form for China to add tracking |
| `src/components/development/SampleReviewSection.tsx` | Create | Approval/rejection UI for Brazil |
| `src/components/development/HistoryTimeline.tsx` | Modify | Add sample workflow banners and actions |
| `src/components/development/SampleTrackingCard.tsx` | Modify | Add "Mark as Arrived" and show decision |
| `src/components/development/ActionsPanel.tsx` | Modify | Integrate new sample flow |

---

### User Experience Flow

**Brazil Team (Buyer):**
1. Reviews commercial data, clicks "Request Sample"
2. Card moves to China
3. Waits for sample to be shipped
4. Receives notification when shipped
5. Marks sample as arrived when it comes
6. Tests sample, uploads report if needed
7. Approves or rejects

**China Team (Trader):**
1. Sees "Sample Requested" attention banner
2. Clicks "Add Tracking" to expand form
3. Enters courier, tracking number, dates
4. Submits → Card moves to Brazil
5. Can track status in timeline

---

### Timeline Visual Hierarchy

Sample activities will be displayed as **compact rows** (like other system activities) to keep focus on conversations, but the **Attention Banner** will prominently highlight the current sample stage requiring action.
