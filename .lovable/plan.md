
# Implement onQuickReply in PendingThreadsBanner

## Overview
When a user clicks a quick action button in the `PendingThreadsBanner`, the system should:
1. Scroll to the target thread
2. Automatically expand the thread (if collapsed)
3. Open the inline reply box with the text area auto-focused

Currently, clicking the quick action button only scrolls to the thread but does not expand it or focus the reply input.

## Implementation Strategy

The solution requires propagating a "focus reply" signal from `HistoryTimeline` through `ThreadedTimeline` to the target `ThreadCard`. The approach uses React state to track which thread should receive focus, and a `useEffect` in `ThreadCard` to respond when it becomes the target.

```text
User clicks Quick Action
        ↓
HistoryTimeline sets focusReplyThreadId state
        ↓
ThreadedTimeline receives focusReplyThreadId prop
        ↓
Matching ThreadCard receives initialReplyToId prop
        ↓
ThreadCard useEffect: opens thread + sets replyingToId + scrolls
```

---

## Technical Details

### File 1: `src/components/development/ThreadCard.tsx`

**Changes:**
1. Add new prop `initialReplyToId?: string | null` to the interface
2. Add a `useEffect` that:
   - Watches for `initialReplyToId` changes
   - When set, opens the thread (`setIsOpen(true)`)
   - Sets `replyingToId` to the root activity ID (to open reply box)
   - Scrolls the thread into view
   - Focuses the reply textarea after a short delay

**Code changes:**
- Lines 38-49: Add `initialReplyToId` to `ThreadCardProps` interface
- Lines 62-68: Add `useEffect` to handle auto-focus behavior

```typescript
// After line 67 (after editedTitle state)
// Add new effect to handle initial reply focus
useEffect(() => {
  if (initialReplyToId && rootActivity.id === initialReplyToId) {
    setIsOpen(true);
    setReplyingToId(rootActivity.id);
    // Scroll and focus after render
    setTimeout(() => {
      const element = document.getElementById(`thread-${rootActivity.id}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Focus the textarea in the reply box
      const textarea = element?.querySelector('textarea');
      textarea?.focus();
    }, 100);
  }
}, [initialReplyToId, rootActivity.id]);
```

### File 2: `src/components/development/ThreadedTimeline.tsx`

**Changes:**
1. Add new prop `focusReplyThreadId?: string | null` to the interface
2. Pass `initialReplyToId` to `ThreadCard` when the thread ID matches

**Code changes:**
- Lines 6-17: Add `focusReplyThreadId` to `ThreadedTimelineProps`
- Lines 131-143: Pass `initialReplyToId={focusReplyThreadId === thread.threadId ? focusReplyThreadId : undefined}` to `ThreadCard`

### File 3: `src/components/development/HistoryTimeline.tsx`

**Changes:**
1. Add state `focusReplyThreadId` to track which thread should auto-focus
2. Update `onQuickReply` callback to set this state instead of just scrolling
3. Pass `focusReplyThreadId` to `ThreadedTimeline`
4. Clear `focusReplyThreadId` when the targetThreadId prop changes (to allow re-triggering)

**Code changes:**
- Add state near other state declarations: `const [focusReplyThreadId, setFocusReplyThreadId] = useState<string | null>(null);`
- Lines 1465-1469: Update `onQuickReply` to set the state:
```typescript
onQuickReply={(threadId) => {
  setFocusReplyThreadId(threadId);
  // Clear after a delay to allow re-clicking
  setTimeout(() => setFocusReplyThreadId(null), 500);
}}
```
- Lines 1628-1638: Add `focusReplyThreadId={focusReplyThreadId}` prop to `ThreadedTimeline`

---

## User Experience Flow

1. User sees amber "Your Pending Actions" banner with list of threads
2. User hovers over a thread row - "Answer question" (or similar) button appears
3. User clicks the button
4. System scrolls smoothly to the thread in the timeline below
5. Thread automatically expands if it was collapsed
6. Reply box opens with textarea focused - user can start typing immediately

## Edge Cases Handled

- **Thread already expanded**: Will still focus the reply input
- **Multiple quick clicks**: The 500ms timeout clears the state, allowing re-triggering
- **Thread not in view**: `scrollIntoView` handles scrolling before focus
- **Sample request threads**: Same behavior - scrolls and focuses (though "Add tracking" may need different handling in future)
