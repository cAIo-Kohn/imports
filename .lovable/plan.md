

## Restore Comment and Question Options to Quick Actions

The Quick Actions dropdown is missing the "Add Comment" and "Ask Question" options that were removed during the previous refactoring. I'll add them back while keeping the "New Thread" option.

---

### Current State

```text
Quick Actions Dropdown:
┌─────────────────────────┐
│ + New Thread            │
│ ─────────────────────── │
│ 📎 Upload File          │
└─────────────────────────┘
```

### Restored State

```text
Quick Actions Dropdown:
┌─────────────────────────┐
│ + New Thread            │
│ 💬 Add Comment          │
│ ❓ Ask Question         │
│ ─────────────────────── │
│ 📎 Upload File          │
│ 📦 Request Sample       │  (when applicable)
└─────────────────────────┘
```

---

### Changes Required

#### 1. Update `BannerQuickActions.tsx`

Add back the missing props and menu items:

```typescript
export interface BannerQuickActionsProps {
  onStartThread?: () => void;
  onAddComment?: () => void;    // ← Add back
  onAskQuestion?: () => void;   // ← Add back
  onUpload?: () => void;
  onRequestSample?: () => void;
  colorScheme?: BannerColorScheme;
}
```

And add the menu items for Comment and Question with appropriate icons.

#### 2. Update `TimelineBanners.tsx`

Pass the `onAddComment` and `onAskQuestion` callbacks to `BannerQuickActions` in each banner component. These will trigger the appropriate actions (opening the comment section or starting a question flow).

---

### Summary

| File | Change |
|------|--------|
| `src/components/development/BannerQuickActions.tsx` | Add `onAddComment` and `onAskQuestion` props and menu items |
| `src/components/development/TimelineBanners.tsx` | Pass comment/question callbacks to BannerQuickActions |

