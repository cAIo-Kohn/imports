

## Plan: Add "Next Step" Action Hints in Timeline

### Problem

When commercial data is submitted and the card moves to Brazil (or vice versa), the receiving user sees the update but has no clear call-to-action for what to do next. The timeline should actively prompt them with suggested next steps.

---

### Solution

Add a **"Next Step Prompt"** component that appears at the top of the timeline when:
1. Commercial data was recently updated (triggering activity exists)
2. The card is now with the current user's team
3. There are no unresolved questions pending

The prompt will display clickable action buttons like:
- "Ask for sample?"
- "Ask a question?"
- "Add a comment"

Clicking these buttons will open the corresponding action in the Actions Panel or trigger inline actions.

---

### Visual Design

```text
┌────────────────────────────────────────────────────────────────┐
│ 💡 What's next?                                                │
│                                                                │
│ Commercial data has been set. What would you like to do?       │
│                                                                │
│  [ 📦 Request Sample ]   [ ❓ Ask a Question ]   [ 💬 Comment ]│
└────────────────────────────────────────────────────────────────┘
```

The prompt uses a light blue/teal background to distinguish it from the purple (question) and emerald (commercial) attention banners.

---

### Technical Implementation

#### 1. Create NextStepPrompt Component

A new component within `HistoryTimeline.tsx` that renders action hints:

```typescript
interface NextStepPromptProps {
  onRequestSample: () => void;
  onAskQuestion: () => void;
  onAddComment: () => void;
  triggerType?: 'commercial' | 'ownership';
}

function NextStepPrompt({ 
  onRequestSample, 
  onAskQuestion, 
  onAddComment,
  triggerType 
}: NextStepPromptProps) {
  return (
    <div className="rounded-lg p-4 mb-4 border-2 bg-sky-50 border-sky-300 dark:bg-sky-950/30 dark:border-sky-700">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="h-5 w-5 text-sky-600" />
        <span className="font-medium text-sm text-sky-800">What's next?</span>
      </div>
      <p className="text-sm text-sky-700 mb-3">
        {triggerType === 'commercial' 
          ? "Commercial data has been set. What would you like to do?"
          : "The card is now with you. What's your next step?"}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onRequestSample}>
          <Package className="h-3 w-3 mr-1" />
          Request Sample
        </Button>
        <Button variant="outline" size="sm" onClick={onAskQuestion}>
          <HelpCircle className="h-3 w-3 mr-1" />
          Ask a Question
        </Button>
        <Button variant="outline" size="sm" onClick={onAddComment}>
          <MessageCircle className="h-3 w-3 mr-1" />
          Add Comment
        </Button>
      </div>
    </div>
  );
}
```

#### 2. Add Props to HistoryTimeline for Action Callbacks

The `HistoryTimeline` component needs callbacks to trigger actions in the parent drawer:

```typescript
interface HistoryTimelineProps {
  cardId: string;
  showAttentionBanner?: boolean;
  currentOwner?: 'mor' | 'arc';
  onOwnerChange?: () => void;
  // New props for action hints
  onOpenSampleSection?: () => void;
  onOpenMessageSection?: (type: 'comment' | 'question') => void;
}
```

#### 3. Determine When to Show the Prompt

Logic to display the prompt:

```typescript
// Show next step prompt when:
// 1. Card is new for user (showAttentionBanner is true)
// 2. There are no unresolved questions (user doesn't need to reply)
// 3. The trigger was commercial update or ownership change
const showNextStepPrompt = 
  showAttentionBanner && 
  !firstUnresolvedQuestion &&
  triggerActivity?.activity_type === 'commercial_update';
```

#### 4. Update ItemDetailDrawer to Pass Callbacks

The drawer needs to control which accordion section opens in ActionsPanel:

```typescript
// In ItemDetailDrawer
const [forcedOpenSection, setForcedOpenSection] = useState<string | null>(null);

const handleOpenSampleSection = () => {
  setForcedOpenSection('samples');
};

const handleOpenMessageSection = (type: 'comment' | 'question') => {
  setForcedOpenSection('messaging');
  // Also set the message type if needed
};
```

#### 5. Update ActionsPanel to Accept Forced Open Section

```typescript
interface ActionsPanelProps {
  // ... existing props
  forcedOpenSection?: string | null;
  onForcedSectionHandled?: () => void;
}

// In the component:
useEffect(() => {
  if (forcedOpenSection) {
    setOpenSections([forcedOpenSection]);
    onForcedSectionHandled?.();
  }
}, [forcedOpenSection]);
```

---

### Display Logic Flow

```text
┌──────────────────────────────────────────┐
│ User receives card with commercial data  │
└───────────────────┬──────────────────────┘
                    ▼
    ┌───────────────────────────────────┐
    │ Is there an unresolved question?  │
    └───────────────┬───────────────────┘
           No │            │ Yes
              ▼            ▼
    ┌──────────────────┐  ┌──────────────────────┐
    │ Show NextStep    │  │ Show AttentionBanner │
    │ Prompt with      │  │ with Reply button    │
    │ action buttons   │  └──────────────────────┘
    └──────────────────┘
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `HistoryTimeline.tsx` | Add `NextStepPrompt` component, add callback props, logic to show prompt |
| `ItemDetailDrawer.tsx` | Pass action callbacks to HistoryTimeline, manage forced accordion state |
| `ActionsPanel.tsx` | Accept `forcedOpenSection` prop to programmatically open sections |

---

### Edge Cases

- **Unresolved question exists**: Don't show NextStepPrompt, show AttentionBanner instead
- **Already clicked an action**: Prompt can remain visible or be dismissed
- **Task cards**: Don't show "Request Sample" option since tasks don't have samples
- **Multiple activities**: Only show prompt once, based on most recent trigger

