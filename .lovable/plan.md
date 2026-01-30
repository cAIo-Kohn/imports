
# Add Quick Actions to Sample Requested Banner

## Overview
The "Sample Requested" banner currently only shows an "Add Tracking" button. Users need additional quick actions to:
- Ask questions about the samples
- Snooze the action with an expected tracking date
- Add comments
- Start new threads about the sample

## Current State
The `SampleRequestedBanner` component in `HistoryTimeline.tsx` (lines 402-474) has:
- "Add Tracking" button only
- Displays the requester info and content
- Shows inline ship form when "Add Tracking" is clicked

Other banners (NewCardBanner, CommercialDataBanner, SampleInTransitBanner, SampleDeliveredBanner) already have:
- `BannerQuickActions` dropdown (New Thread, Add Comment, Ask Question, Upload)
- `SnoozeButton` for deferring action

## Solution
Enhance the `SampleRequestedBanner` to match other banner patterns by adding:
1. `BannerQuickActions` dropdown with communication options
2. `SnoozeButton` for setting expected tracking date

### Changes

**File: `src/components/development/HistoryTimeline.tsx`**

#### 1. Update SampleRequestedBannerProps interface (lines 403-408)
Add new props for the quick actions:
```typescript
interface SampleRequestedBannerProps {
  activity: Activity;
  cardId: string;
  currentOwner: 'mor' | 'arc';
  pendingActionType?: string | null;  // NEW
  onSuccess: () => void;
  onStartThread: () => void;          // NEW
  onAddComment: () => void;           // NEW  
  onAskQuestion: () => void;          // NEW
  onSnooze?: () => void;              // NEW
}
```

#### 2. Update SampleRequestedBanner component (lines 410-474)
Add the new props and render `BannerQuickActions` and `SnoozeButton`:

```typescript
function SampleRequestedBanner({ 
  activity, 
  cardId, 
  currentOwner,
  pendingActionType,
  onSuccess,
  onStartThread,
  onAddComment,
  onAskQuestion,
  onSnooze,
}: SampleRequestedBannerProps) {
  // ... existing code ...
  
  return (
    <div className="...">
      {/* Header with title and Add Tracking button */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 font-medium">
          <Package className="h-5 w-5 text-cyan-600" />
          <span className="...">Sample Requested</span>
        </div>
        {!showShipForm && (
          <Button onClick={() => setShowShipForm(true)} ...>
            <Truck /> Add Tracking
          </Button>
        )}
      </div>
      
      {/* Activity content card */}
      <div className="bg-white ...">
        {/* ... existing content ... */}
      </div>
      
      {/* NEW: Quick Actions row */}
      {!showShipForm && (
        <div className="flex flex-wrap gap-2 mt-3">
          <BannerQuickActions
            onStartThread={onStartThread}
            onAddComment={onAddComment}
            onAskQuestion={onAskQuestion}
            colorScheme="blue"  // Use cyan/blue to match banner theme
          />
          <SnoozeButton
            cardId={cardId}
            currentActionType={pendingActionType}
            variant="outline"
            size="sm"
            className="bg-white hover:bg-cyan-100 border-cyan-300 text-cyan-700 dark:bg-cyan-950 dark:hover:bg-cyan-900 dark:border-cyan-600 dark:text-cyan-200"
            onSnooze={onSnooze}
          />
        </div>
      )}
      
      {/* Inline ship form (when open) */}
      {showShipForm && (
        <InlineSampleShipForm ... />
      )}
    </div>
  );
}
```

#### 3. Update SampleRequestedBanner usage (lines 1454-1464)
Pass the new callback props when rendering the banner:

```typescript
{showSampleRequestedBanner && sampleRequestedActivity && (
  <SampleRequestedBanner
    activity={sampleRequestedActivity}
    cardId={cardId}
    currentOwner={currentOwner}
    pendingActionType={pendingActionType}
    onSuccess={() => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-item-samples-timeline', cardId] });
      onOwnerChange?.();
    }}
    onStartThread={() => setShowInlineThreadComposer(true)}
    onAddComment={() => setShowInlineThreadComposer(true)}
    onAskQuestion={() => setShowInlineThreadComposer(true)}
  />
)}
```

#### 4. Add BannerQuickActions import (if not already imported)
Ensure `BannerQuickActions` is imported at the top of the file.

## Visual Result
The Sample Requested banner will now show:

```
┌─────────────────────────────────────────────────────────┐
│ 📦 Sample Requested                    [Add Tracking]   │
├─────────────────────────────────────────────────────────┤
│ ○ Vitória · 15:10                                       │
│ Sample requested                                        │
├─────────────────────────────────────────────────────────┤
│ [⚡ Quick Actions ▼]  [🕐 Snooze ▼]                      │
└─────────────────────────────────────────────────────────┘
```

Quick Actions dropdown includes:
- New Thread
- Add Comment  
- Ask Question

Snooze allows users to set expected dates like:
- "1 day" / "3 days" / "1 week" / "2 weeks"
- Custom date with optional reason (e.g., "Waiting for factory confirmation")

## Files to Modify

| File | Changes |
|------|---------|
| `HistoryTimeline.tsx` | Add props to SampleRequestedBannerProps, add BannerQuickActions + SnoozeButton to render, pass callbacks when using the component |

## Testing Checklist
1. Open a card with "Sample Requested" pending status
2. Verify the Quick Actions dropdown appears next to Add Tracking
3. Click Quick Actions > Add Comment - verify composer opens
4. Click Quick Actions > Ask Question - verify composer opens
5. Click Snooze > 3 days - verify snooze is applied
6. Click Add Tracking - verify form appears and hides the quick actions row
