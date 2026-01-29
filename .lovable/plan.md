

## New Feature: Sample Tracker Dashboard

### Overview

Create a dedicated "Samples" view within the Development page that aggregates all samples from all cards into a visual, filterable dashboard. This gives you a bird's-eye view of all sample activities across development cards.

### Sample Status Workflow

```text
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Requested  │ -> │  In Transit │ -> │  Delivered  │ -> │  Reviewed   │
│  (pending)  │    │             │    │             │    │ (approved/  │
│             │    │             │    │             │    │  rejected)  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
     ⚠️                 🚚                📦                ✅ / ❌
 Missing ETD?       Has tracking?     Arrived?          Has report?
```

### Proposed UI Layout

Add a view toggle to the Development header:

```text
┌────────────────────────────────────────────────────────────────────┐
│  Development Cards                                                  │
│  Track items, samples, and tasks                                   │
│                                                                    │
│  [🗂️ Cards]  [📦 Samples]              [Export] [+ New Card]      │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Search...  [Status ▾]  [Courier ▾]  [Has Report ▾]           │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                        SAMPLE TRACKER                              │
├─────────────────┬─────────────────┬─────────────────┬─────────────┤
│  ⚠️ REQUESTED   │  🚚 IN TRANSIT  │  📦 DELIVERED   │  ✅ REVIEWED │
│     (2)         │      (1)        │      (1)        │     (3)     │
├─────────────────┼─────────────────┼─────────────────┼─────────────┤
│                 │                 │                 │             │
│  ┌───────────┐  │  ┌───────────┐  │  ┌───────────┐  │  ┌────────┐ │
│  │ Caneta    │  │  │ PE Strap  │  │  │ Master    │  │  │ Item X │ │
│  │ 2 pcs     │  │  │ FedEx     │  │  │ Arrived   │  │  │ ✓ Appr │ │
│  │ No ETA ⚠️ │  │  │ ETA: 5/02 │  │  │ 28/01     │  │  │ Report │ │
│  │ [Open]    │  │  │ [Track]   │  │  │ [Review]  │  │  │ [View] │ │
│  └───────────┘  │  └───────────┘  │  └───────────┘  │  └────────┘ │
│                 │                 │                 │             │
│  ┌───────────┐  │                 │                 │  ┌────────┐ │
│  │ New Item  │  │                 │                 │  │ Item Y │ │
│  │ 1 pc      │  │                 │                 │  │ ✗ Rejc │ │
│  │ ETA: 10/02│  │                 │                 │  │        │ │
│  └───────────┘  │                 │                 │  └────────┘ │
│                 │                 │                 │             │
└─────────────────┴─────────────────┴─────────────────┴─────────────┘
```

### Sample Card Information

Each sample card in the tracker will show:

| Status | Key Info Displayed | Actions |
|--------|-------------------|---------|
| **Requested** (pending, no tracking) | Card title, qty, request date, ETA if provided | Open card, Add tracking |
| **In Transit** | Card title, courier, tracking#, ETA, shipped date | Track shipment, Open card |
| **Delivered** (awaiting review) | Card title, arrival date, days waiting for review | Review sample, Open card |
| **Reviewed** (approved/rejected) | Card title, decision, has report badge, decision date | View report, Open card |

### Visual Indicators

- **⚠️ Warning badge**: Requested samples with no shipping ETA
- **🔴 Overdue indicator**: Samples past their ETA but not delivered
- **📄 Report badge**: Shows if a lab/test report was uploaded
- **Days counter**: "Waiting 3 days" for delivered samples pending review

### Technical Implementation

#### 1. New Component: SampleTrackerView

Create `src/components/development/SampleTrackerView.tsx`:

```tsx
// Fetches all samples with card info
const { data: samples } = useQuery({
  queryKey: ['all-samples'],
  queryFn: async () => {
    const { data } = await supabase
      .from('development_item_samples')
      .select(`
        *,
        card:development_items!item_id (
          id, title, current_owner, is_solved, deleted_at, image_url
        )
      `)
      .is('card.deleted_at', null)
      .order('created_at', { ascending: false });
    return data;
  }
});

// Group by status category
const grouped = {
  requested: samples.filter(s => s.status === 'pending' && !s.tracking_number),
  inTransit: samples.filter(s => s.status === 'in_transit'),
  delivered: samples.filter(s => s.status === 'delivered' && !s.decision),
  reviewed: samples.filter(s => !!s.decision)
};
```

#### 2. New Component: SampleTrackerCard

A compact card component showing sample info with quick actions:

```tsx
interface SampleTrackerCardProps {
  sample: SampleWithCard;
  onOpenCard: (cardId: string) => void;
}

// Renders: card title, sample info, status-specific badges, action buttons
```

#### 3. Modify Development.tsx

Add a view toggle state and conditionally render either the team sections or the sample tracker:

```tsx
const [viewMode, setViewMode] = useState<'cards' | 'samples'>('cards');

// In header:
<div className="flex gap-1 p-1 bg-muted rounded-lg">
  <Button 
    variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
    size="sm" 
    onClick={() => setViewMode('cards')}
  >
    <LayoutGrid className="h-4 w-4 mr-1" />
    Cards
  </Button>
  <Button 
    variant={viewMode === 'samples' ? 'secondary' : 'ghost'}
    size="sm"
    onClick={() => setViewMode('samples')}
  >
    <Package className="h-4 w-4 mr-1" />
    Samples
  </Button>
</div>

// In main content:
{viewMode === 'cards' ? (
  <TeamSections ... />
) : (
  <SampleTrackerView onOpenCard={handleCardClick} />
)}
```

### Filter Options for Sample View

| Filter | Options |
|--------|---------|
| **Status** | All, Requested, In Transit, Delivered, Reviewed |
| **Courier** | All, DHL, FedEx, TNT, UPS, SF Express, Other |
| **Decision** | All, Approved, Rejected, Pending |
| **Has Report** | All, Yes, No |
| **Overdue** | All, Yes (past ETA) |

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/development/SampleTrackerView.tsx` | **Create** - Main tracker component with Kanban columns |
| `src/components/development/SampleTrackerCard.tsx` | **Create** - Individual sample card with quick actions |
| `src/pages/Development.tsx` | **Modify** - Add view toggle and render SampleTrackerView |

### Features Summary

1. **Kanban-style columns** grouping samples by lifecycle stage
2. **Visual warnings** for samples missing ETAs or overdue
3. **Quick actions** per card (Track, Review, Open Card, View Report)
4. **Click to open** the parent development card drawer
5. **Real-time updates** via existing Supabase subscriptions
6. **Filter by** status, courier, decision, report presence

