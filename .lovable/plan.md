

## Plan: Fix Development Page Layout - Keep Header Fixed

### Problem

The entire Development page content (including the header with "New Item" button) is scrolling horizontally because:

1. The `DashboardLayout` wrapper has `p-6 overflow-auto` 
2. The Kanban board's wide content (9 columns) triggers horizontal scroll on the parent container
3. This causes the header to scroll off-screen to the left

### Solution

Override the parent layout's behavior for the Development page specifically by:

1. **Remove padding from the page wrapper** - The Development page will manage its own padding
2. **Ensure the header stays fixed** - Apply `overflow-hidden` at the page level and only allow scroll inside the Kanban area
3. **Make the page take full available space** - Use negative margin or full-bleed approach

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Development.tsx` | Add negative margin to counteract layout padding, ensure header is fixed |

---

### Implementation Details

**Current Issue:**
```
DashboardLayout (p-6 overflow-auto)
  └── Development.tsx (flex flex-col h-full)
        ├── Header (scrolls away!)
        └── KanbanBoard (ScrollArea - causes parent to expand)
```

**Fix Approach:**

Use negative margin to break out of the parent padding and make the page full-width:

```tsx
// Development.tsx - outer wrapper
<div className="flex flex-col h-full -m-6 overflow-hidden">
  {/* Header - stays fixed, has its own padding */}
  <div className="flex-shrink-0 p-4 md:p-6 border-b bg-background">
    ...
  </div>
  
  {/* Kanban - scrolls independently */}
  <div className="flex-1 overflow-hidden">
    <KanbanBoard ... />
  </div>
</div>
```

**Key Changes:**
1. Add `-m-6` to counteract parent's `p-6` padding (full-bleed layout)
2. Add `overflow-hidden` to prevent page-level scroll
3. Header keeps its own `p-4 md:p-6` padding
4. Kanban area stays in `overflow-hidden` container - scroll is handled by ScrollArea inside

---

### Visual Result

```text
+------------------------------------------+
| [Sidebar] | Header (New Item button)     | <- Always visible
|           |------------------------------|
|           | [Backlog] [In Progress] ...  | <- Horizontal scroll only here
|           |                              |
+------------------------------------------+
```

---

### Summary

A single file change:
- Add `-m-6` to break out of parent padding
- Add `overflow-hidden` to isolate scroll behavior
- Header stays fixed at top, only Kanban board scrolls horizontally

