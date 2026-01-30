
# Fix New Card Banner to Persist Until Action Completed

## Problem
Currently, when a user clicks a quick action on the "New Request" banner (Comment, Question, Upload, Snooze), the banner is dismissed immediately when the action UI opens. If the user then cancels or closes the composer without actually submitting, the banner is already gone and won't return.

**Expected behavior:** The banner should only be dismissed after the user successfully completes an action (posts a comment, posts a question, uploads a file, snoozes, etc.).

## Root Cause
In `HistoryTimeline.tsx` (lines 1554-1570), the `dismissNewCardBanner()` function is called **before** opening the inline composer:

```typescript
onAddComment={() => {
  dismissNewCardBanner();  // <-- Called immediately
  setShowInlineThreadComposer(true);
}}
```

## Solution
Move the banner dismissal from the banner click handlers to the **success callbacks** of the actual action mutations. The banner should only be dismissed when:

1. A comment/question is successfully posted via `NewThreadComposer`
2. A file is successfully uploaded
3. A snooze action is successfully completed

### Implementation

#### 1. HistoryTimeline.tsx - Remove premature dismissal

**Lines 1554-1571:** Remove `dismissNewCardBanner()` calls from the banner action handlers:

```typescript
// Before:
onStartThread={() => {
  dismissNewCardBanner();
  setShowInlineThreadComposer(true);
}}
onAddComment={() => {
  dismissNewCardBanner();
  setShowInlineThreadComposer(true);
}}
onAskQuestion={() => {
  dismissNewCardBanner();
  setShowInlineThreadComposer(true);
}}
onUpload={() => {
  dismissNewCardBanner();
  onOpenUploadSection?.();
}}
onSnooze={dismissNewCardBanner}

// After:
onStartThread={() => setShowInlineThreadComposer(true)}
onAddComment={() => setShowInlineThreadComposer(true)}
onAskQuestion={() => setShowInlineThreadComposer(true)}
onUpload={() => onOpenUploadSection?.()}
onSnooze={undefined}  // Will handle in SnoozeButton's onSnooze
```

#### 2. NewThreadComposer.tsx - Add callback prop for banner dismissal

Add an optional `onActionComplete` prop that gets called on success:

```typescript
interface NewThreadComposerProps {
  // ... existing props
  onActionComplete?: () => void;  // Called when action successfully completes
}
```

Call it in both mutation success handlers (lines 97-101 and 166-174):
```typescript
onSuccess: () => {
  // ... existing code
  onActionComplete?.();  // Dismiss banner
  onClose();
}
```

#### 3. HistoryTimeline.tsx - Pass dismissNewCardBanner to NewThreadComposer

When showing the inline thread composer, pass the dismiss function:

```typescript
{showInlineThreadComposer && (
  <div className="mb-4">
    <NewThreadComposer
      cardId={cardId}
      currentOwner={currentOwner}
      onClose={() => setShowInlineThreadComposer(false)}
      onCardMove={onOwnerChange}
      onActionComplete={dismissNewCardBanner}  // <-- NEW
      autoFocus
    />
  </div>
)}
```

#### 4. SnoozeButton.tsx - Trigger banner dismissal on snooze success

The `SnoozeButton` already has an `onSnooze` prop. We need to ensure the snooze mutation calls the banner dismissal on success.

In `TimelineBanners.tsx`, the `SnoozeButton` is already wired with `onSnooze={onSnooze}`. The issue is we're currently passing `onSnooze={dismissNewCardBanner}` which gets called immediately.

Looking at `SnoozeButton.tsx`, the `onSnooze` callback is already called in the mutation's `onSuccess`. So we just need to keep passing `dismissNewCardBanner` as `onSnooze`, but remove the premature call from the banner handlers.

**Wait - re-checking the code:** The `SnoozeButton` already handles this correctly. When user clicks snooze and selects a date, the `onSnooze` callback is called in the mutation's `onSuccess`. So we can keep `onSnooze={dismissNewCardBanner}` as-is.

#### 5. File Upload handling

When user opens the upload section via the banner, we need to track that they came from the banner and dismiss it when they successfully upload.

Looking at the code flow:
- `onOpenUploadSection?.()` is called which sets `forcedOpenSection` in `ItemDetailDrawer`
- This opens the `ActionsPanel` with files section

We need to add a callback mechanism here too. For simplicity, we can:
- Pass `dismissNewCardBanner` down to the upload section
- Or: Clear `is_new_for_other_team` when any activity is logged for this card

**Simpler approach:** Since any meaningful action (comment, question, file upload, snooze) will either:
- Log an activity to `development_card_activity`, or
- Update the card in some way

We can have the backend clear `is_new_for_other_team = false` when the first activity is logged for the card by a user from the receiving team. But this adds complexity.

**Recommended approach:** For now, handle the main flows (thread composer + snooze) and leave upload as a separate enhancement.

## Summary of Changes

| File | Change |
|------|--------|
| `NewThreadComposer.tsx` | Add `onActionComplete?: () => void` prop; call in success handlers |
| `HistoryTimeline.tsx` | Remove `dismissNewCardBanner()` from banner click handlers; pass `onActionComplete={dismissNewCardBanner}` to `NewThreadComposer` |

## Edge Cases
- **User opens composer, cancels:** Banner persists (correct)
- **User posts comment:** Banner dismissed (correct)
- **User asks question:** Banner dismissed (correct)
- **User snoozes:** Banner dismissed via `onSnooze` callback (correct)
- **User uploads file:** Currently won't dismiss banner - can be enhanced in future

## Testing Checklist
1. Open a card that shows "New Request" banner
2. Click "Comment" - verify composer opens and banner is still visible
3. Close composer without posting - verify banner is still visible
4. Click "Comment" again, post a message - verify banner disappears
5. Test same flow for "Ask Question"
6. Test "Snooze" - verify banner disappears only after snooze is set
