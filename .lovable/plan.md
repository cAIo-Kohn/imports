

## Unified Quick Actions Button for Banners

Your idea is excellent! Currently, each banner has 3-4 separate buttons (Comment, Question, Snooze, Upload, etc.) which takes up significant space. A **single "Quick Actions" dropdown** would:

- Save horizontal space in banners
- Provide a consistent action interface across all banner types
- Include a "Start Thread" option to make threading more visible
- Scale better as we add more actions in the future

---

### Current State vs. Proposed Design

```text
CURRENT (4 separate buttons):
┌─────────────────────────────────────────────────────┐
│  ✨ New Request                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ [image] Title                                 │   │
│  │         Description...                        │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  [Comment] [Ask Question] [Snooze ▼] [Upload]       │  <- Takes full row
└─────────────────────────────────────────────────────┘

PROPOSED (single dropdown + primary action):
┌─────────────────────────────────────────────────────┐
│  ✨ New Request                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ [image] Title                                 │   │
│  │         Description...                        │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  [⚡ Quick Actions ▼]                                │  <- Compact single button
└─────────────────────────────────────────────────────┘

Dropdown opens to show:
┌─────────────────────────────┐
│ 💬 Start New Thread         │
│ ❓ Ask a Question           │
│ ─────────────────────────── │
│ ⏰ Snooze...                │
│ 📎 Upload File              │
└─────────────────────────────┘
```

---

### Implementation Approach

#### Create a Reusable `BannerQuickActions` Component

This component will render a dropdown menu with all available actions for any banner type:

```typescript
interface BannerQuickActionsProps {
  cardId: string;
  pendingActionType?: string | null;
  // Available actions (each banner can customize)
  onStartThread?: () => void;      // New! "Start New Thread"
  onAskQuestion?: () => void;
  onAddComment?: () => void;
  onSnooze?: () => void;
  onUpload?: () => void;
  onRequestSample?: () => void;    // Commercial banner specific
  onMarkArrived?: () => void;      // Sample transit specific
  onReviewSample?: () => void;     // Sample delivered specific
  // Styling
  colorScheme: 'violet' | 'emerald' | 'blue' | 'amber';
}
```

#### Update All Banner Components

Each banner will replace its multiple buttons with the single `BannerQuickActions` component:

| Banner | Primary CTA (Optional) | Quick Actions |
|--------|------------------------|---------------|
| NewCardBanner | None | Thread, Question, Snooze, Upload |
| CommercialDataBanner | Request Sample | Thread, Question, Comment, Upload |
| SampleInTransitBanner | Mark Arrived | Thread, Question, Comment |
| SampleDeliveredBanner | Review Sample | Thread, Question |

For banners with a critical primary action (like "Review Sample" or "Mark Arrived"), we can keep that as a visible button alongside the dropdown.

---

### Detailed Changes

#### 1. Create `BannerQuickActions.tsx` (New File)

```typescript
// src/components/development/BannerQuickActions.tsx
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Zap, MessageCircle, HelpCircle, Clock, Upload, Plus } from 'lucide-react';
import { SnoozeButton } from './SnoozeButton';

// Renders a compact dropdown with all available actions
export function BannerQuickActions({ 
  cardId, 
  pendingActionType,
  onStartThread,
  onAskQuestion,
  onAddComment,
  onSnooze,
  onUpload,
  onRequestSample,
  colorScheme = 'violet',
}: BannerQuickActionsProps) {
  // Color mappings for each banner type
  const colorClasses = {
    violet: 'border-violet-300 text-violet-700 hover:bg-violet-100',
    emerald: 'border-emerald-300 text-emerald-700 hover:bg-emerald-100',
    blue: 'border-blue-300 text-blue-700 hover:bg-blue-100',
    amber: 'border-amber-400 text-amber-700 hover:bg-amber-100',
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("bg-white", colorClasses[colorScheme])}>
          <Zap className="h-3 w-3 mr-1" />
          Quick Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {onStartThread && (
          <DropdownMenuItem onClick={onStartThread}>
            <Plus className="h-4 w-4 mr-2" />
            Start New Thread
          </DropdownMenuItem>
        )}
        {onAskQuestion && (
          <DropdownMenuItem onClick={onAskQuestion}>
            <HelpCircle className="h-4 w-4 mr-2" />
            Ask a Question
          </DropdownMenuItem>
        )}
        {onAddComment && (
          <DropdownMenuItem onClick={onAddComment}>
            <MessageCircle className="h-4 w-4 mr-2" />
            Add Comment
          </DropdownMenuItem>
        )}
        {(onStartThread || onAskQuestion || onAddComment) && (onSnooze || onUpload) && (
          <DropdownMenuSeparator />
        )}
        {/* Snooze as a sub-item or separate popover trigger */}
        {onUpload && (
          <DropdownMenuItem onClick={onUpload}>
            <Upload className="h-4 w-4 mr-2" />
            Upload File
          </DropdownMenuItem>
        )}
        {/* Snooze might need special handling since it has its own popover */}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

#### 2. Update `TimelineBanners.tsx`

Replace the multiple `<Button>` elements in each banner with:

```tsx
// Example for NewCardBanner:
<div className="flex flex-wrap gap-2">
  <BannerQuickActions
    cardId={cardId}
    pendingActionType={pendingActionType}
    onStartThread={onAddComment}  // "Start Thread" maps to comment handler
    onAskQuestion={onAskQuestion}
    onSnooze={onSnooze}
    onUpload={onUpload}
    colorScheme="violet"
  />
</div>
```

#### 3. Handle Snooze Integration

The `SnoozeButton` component has its own popover logic. Options:
- **Option A**: Move snooze to a sub-menu with preset options
- **Option B**: Keep Snooze as a visible button next to Quick Actions (recommended for now, since snoozing is time-sensitive)

```tsx
// Hybrid approach - keep Snooze visible when relevant
<div className="flex flex-wrap gap-2">
  <BannerQuickActions ... />
  <SnoozeButton cardId={cardId} ... />
</div>
```

---

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/development/BannerQuickActions.tsx` | **Create** | Reusable dropdown for all banner actions |
| `src/components/development/TimelineBanners.tsx` | **Modify** | Replace multiple buttons with BannerQuickActions |
| `src/components/development/HistoryTimeline.tsx` | **Modify** | Pass `onStartThread` callback to banners |

---

### User Experience Benefits

1. **Space Savings**: Single button instead of 3-4 buttons per banner
2. **Thread Discoverability**: "Start New Thread" is now prominently featured
3. **Consistency**: All banners use the same action interface
4. **Scalability**: Easy to add new actions without cluttering UI
5. **Mobile-Friendly**: Dropdown works better on small screens than multiple buttons

---

### Visual Hierarchy

Keep primary CTAs visible when they're urgent:

| Banner | Visible Button | In Dropdown |
|--------|----------------|-------------|
| New Card | None (all in dropdown) | Thread, Question, Snooze, Upload |
| Commercial Data | Request Sample | Thread, Question, Comment, Upload |
| Sample In Transit | Mark Arrived | Thread, Question, Comment |
| Sample Delivered | Review Sample | Thread, Question |

This ensures the most important action per context is always one click away, while secondary actions are organized in the dropdown.

