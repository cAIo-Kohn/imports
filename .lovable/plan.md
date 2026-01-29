
## Enhanced Timeline Banners for Commercial Data and Sample Tracking

### Overview

Replace the generic "What's next?" prompts with **enriched content banners** that prominently display the actual data (commercial info or sample tracking) with contextual action buttons below. This provides immediate visibility of key information without needing to navigate away.

### Current vs Proposed Layout

**Current: "What's next?" prompt after commercial data set**
```text
┌─────────────────────────────────────────────────────────────────┐
│ 💡 What's next?                                                  │
│ Commercial data has been set. What would you like to do?        │
│                                                                 │
│ [Request Sample] [Ask a Question] [Add Comment] [Upload]        │
└─────────────────────────────────────────────────────────────────┘
```

**Proposed: Commercial Data Card with actions**
```text
┌─────────────────────────────────────────────────────────────────┐
│ 💰 Commercial Data                                   Updated 2h │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  FOB $12.50    MOQ 1,000    15,000/40HQ                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [Request Sample] [Ask a Question] [Add Comment] [Upload]        │
└─────────────────────────────────────────────────────────────────┘
```

**Proposed: Sample In-Transit Card with tracking and actions**
```text
┌─────────────────────────────────────────────────────────────────┐
│ 🚚 Sample In Transit                                             │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  DHL • 1234567890              ETA: Feb 5, 2026             │ │
│ │  2 pcs • Shipped Jan 28                      [Track 🔗]     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [Mark Arrived] [Ask a Question] [Add Comment]                   │
└─────────────────────────────────────────────────────────────────┘
```

**Proposed: Sample Delivered - Awaiting Review**
```text
┌─────────────────────────────────────────────────────────────────┐
│ 📦 Sample Delivered                              Waiting 3 days │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  DHL • 1234567890              Arrived: Jan 26, 2026        │ │
│ │  2 pcs                                                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [Review Sample] [Add Report] [Ask a Question]                   │
└─────────────────────────────────────────────────────────────────┘
```

### New Banner Components

#### 1. CommercialDataBanner
Displays the commercial data prominently in a highlighted card format with action buttons below.

| Element | Description |
|---------|-------------|
| **Header** | "Commercial Data" with timestamp |
| **Data Display** | Grid showing FOB, MOQ, Qty/Container in a clean format |
| **Actions** | Request Sample, Ask Question, Add Comment, Upload |
| **Style** | Emerald/green theme (matching commercial_update activity) |

#### 2. SampleInTransitBanner  
Displays tracking information for a sample that has been shipped but not yet arrived.

| Element | Description |
|---------|-------------|
| **Header** | "Sample In Transit" with courier icon |
| **Data Display** | Courier, tracking number (with Track link), ETA, shipped date, quantity |
| **Actions** | Mark Arrived, Ask Question, Add Comment |
| **Style** | Blue theme with tracking link |
| **Props** | Takes specific sample object to sync with that sample |

#### 3. SampleDeliveredBanner
Displays delivered sample info with review prompts.

| Element | Description |
|---------|-------------|
| **Header** | "Sample Delivered" with days-waiting counter |
| **Data Display** | Courier, tracking, arrival date, quantity |
| **Actions** | Review Sample (opens Samples panel to that specific sample), Add Report, Ask Question |
| **Style** | Amber/orange theme indicating action needed |
| **Props** | Takes specific sample object |

### Banner Display Priority

Update the timeline rendering logic to show banners in this priority order:

1. **Unresolved Question** (existing AttentionBanner)
2. **Unacknowledged Answer** (existing AnswerPendingBanner)
3. **Sample Delivered - Awaiting Review** (new SampleDeliveredBanner)
4. **Sample In Transit** (new SampleInTransitBanner)
5. **Sample Requested - Awaiting Tracking** (existing SampleRequestedBanner)
6. **Commercial Data Set** (new CommercialDataBanner - replaces NextStepPrompt)
7. **Sample Approved - Ready to Close** (existing SampleApprovedBanner)

### Sample Panel Synchronization

When clicking "Review Sample" or "Manage Sample" from a banner:
1. Open the Samples action panel
2. Auto-scroll to or highlight the specific sample
3. This is achieved by passing a `targetSampleId` prop through the existing `onOpenSampleSection` callback

The Samples section in ActionsPanel will receive a new optional prop:
```typescript
interface ActionsPanelProps {
  // ... existing props
  targetSampleId?: string | null;  // NEW: scroll to / highlight this sample
}
```

### Technical Implementation

#### 1. Create CommercialDataBanner Component

Located in `HistoryTimeline.tsx` or extracted to a separate file:

```tsx
interface CommercialDataBannerProps {
  fobPriceUsd: number;
  moq: number;
  qtyPerContainer: number;
  containerType: string;
  updatedAt?: string;
  updatedBy?: string;
  onRequestSample: () => void;
  onAskQuestion: () => void;
  onAddComment: () => void;
  onUpload: () => void;
}

function CommercialDataBanner({ ... }: CommercialDataBannerProps) {
  return (
    <div className="rounded-lg p-4 mb-4 border-2 bg-emerald-50 border-emerald-300">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-emerald-600" />
          <span className="font-medium text-sm text-emerald-800">Commercial Data</span>
        </div>
        {updatedAt && (
          <span className="text-xs text-emerald-600">{updatedAt}</span>
        )}
      </div>
      
      {/* Data Display Card */}
      <div className="bg-white rounded-lg p-3 border mb-3">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground text-xs block">FOB</span>
            <span className="font-semibold">${fobPriceUsd}</span>
          </div>
          <div>
            <span className="text-muted-foreground text-xs block">MOQ</span>
            <span className="font-semibold">{moq.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-muted-foreground text-xs block">Qty/Container</span>
            <span className="font-semibold">{qtyPerContainer.toLocaleString()}/{containerType}</span>
          </div>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onRequestSample}>
          <Package className="h-3 w-3 mr-1" />
          Request Sample
        </Button>
        {/* ... other buttons */}
      </div>
    </div>
  );
}
```

#### 2. Create SampleInTransitBanner Component

```tsx
interface SampleInTransitBannerProps {
  sample: Sample;
  onMarkArrived: () => void;
  onAskQuestion: () => void;
  onAddComment: () => void;
}

function SampleInTransitBanner({ sample, ... }: SampleInTransitBannerProps) {
  const trackingUrl = getTrackingUrl(sample.courier_name, sample.tracking_number);
  
  return (
    <div className="rounded-lg p-4 mb-4 border-2 bg-blue-50 border-blue-300">
      <div className="flex items-center gap-2 mb-3">
        <Truck className="h-5 w-5 text-blue-600" />
        <span className="font-medium text-sm text-blue-800">Sample In Transit</span>
      </div>
      
      <div className="bg-white rounded-lg p-3 border mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">{sample.courier_name}</span>
            <code className="text-xs bg-muted px-2 py-1 rounded">
              {sample.tracking_number}
            </code>
          </div>
          {trackingUrl && (
            <Button variant="ghost" size="sm" asChild>
              <a href={trackingUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                Track
              </a>
            </Button>
          )}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          <span>Shipped: {format(...)}</span>
          {sample.estimated_arrival && <span>ETA: {format(...)}</span>}
          <span>{sample.quantity} pcs</span>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onMarkArrived}>
          <PackageCheck className="h-3 w-3 mr-1" />
          Mark Arrived
        </Button>
        {/* ... */}
      </div>
    </div>
  );
}
```

#### 3. Create SampleDeliveredBanner Component

Similar structure with amber styling and days-waiting counter:

```tsx
// Calculate days waiting
const daysWaiting = differenceInDays(new Date(), new Date(sample.actual_arrival));
```

#### 4. Update HistoryTimeline.tsx

Add queries to fetch the most relevant sample for banner display:

```tsx
// Add sample query or receive samples as prop
const { data: samples = [] } = useQuery({
  queryKey: ['development-item-samples', cardId],
  queryFn: async () => {
    const { data } = await supabase
      .from('development_item_samples')
      .select('*')
      .eq('item_id', cardId)
      .order('created_at', { ascending: false });
    return data || [];
  },
});

// Find most relevant sample for banner
const inTransitSample = samples.find(s => s.status === 'in_transit');
const deliveredSample = samples.find(s => s.status === 'delivered' && !s.decision);
```

Update banner priority logic and replace `NextStepPrompt` with `CommercialDataBanner` when appropriate.

#### 5. Update ActionsPanel for Sample Targeting

Add `targetSampleId` prop handling to scroll to and highlight specific sample:

```tsx
// In ActionsPanel
useEffect(() => {
  if (targetSampleId && activeAction === 'samples') {
    const element = document.getElementById(`sample-${targetSampleId}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element?.classList.add('ring-2', 'ring-primary');
    setTimeout(() => element?.classList.remove('ring-2', 'ring-primary'), 2000);
  }
}, [targetSampleId, activeAction]);
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/development/HistoryTimeline.tsx` | Add 3 new banner components (CommercialDataBanner, SampleInTransitBanner, SampleDeliveredBanner), update banner display priority logic, add samples query |
| `src/components/development/ItemDetailDrawer.tsx` | Pass sample data to HistoryTimeline, add `targetSampleId` state and pass to ActionsPanel |
| `src/components/development/ActionsPanel.tsx` | Add `targetSampleId` prop, implement scroll-to and highlight for specific sample |
| `src/components/development/SampleTrackingCard.tsx` | Add `id` attribute for targeting: `id={\`sample-${sample.id}\`}` |

### Visual Style Summary

| Banner Type | Background | Border | Icon Color |
|-------------|------------|--------|------------|
| Commercial Data | emerald-50 | emerald-300 | emerald-600 |
| Sample In Transit | blue-50 | blue-300 | blue-600 |
| Sample Delivered | amber-50 | amber-400 | amber-600 |
| Sample Requested | cyan-50 | cyan-300 | cyan-600 |
| Question Pending | purple-50 | purple-300 | purple-600 |
| Answer Received | green-50 | green-400 | green-600 |

### Benefits

1. **Immediate visibility** - Key data shown prominently without extra clicks
2. **Contextual actions** - Buttons are relevant to the displayed data
3. **Sample sync** - Clicking "Review Sample" opens the correct sample in the panel
4. **Visual hierarchy** - Different colors help distinguish banner types at a glance
5. **Reduced cognitive load** - No need to remember what "What's next?" refers to
