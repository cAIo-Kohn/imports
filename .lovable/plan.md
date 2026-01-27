

## Plan: Responsive Kanban Layout for Development Page

### Problem

The current Kanban board forces all 9 columns to display with fixed 300px widths, creating ~2844px of horizontal scroll regardless of screen size. The user has to scroll extensively to see all cards and the "New Item" button.

### Solution

Make the Kanban board responsive by:
1. **Reducing column widths** on smaller screens
2. **Making columns fluid** to use available space
3. **Ensuring the header stays fixed** so "New Item" is always visible
4. **Adding responsive column sizing** based on viewport

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/development/KanbanBoard.tsx` | Use responsive column widths, remove fixed minWidth |
| `src/components/development/KanbanColumn.tsx` | Support dynamic width, compact mode on smaller screens |
| `src/components/development/DevelopmentCard.tsx` | Adjust card spacing for compact view |

---

### Implementation Details

#### 1. KanbanBoard.tsx Changes

**Current (forces fixed width):**
```tsx
<div
  style={{ minWidth: `${statusOrder.length * 316}px` }}
  className="flex gap-4 p-6 min-h-full"
>
```

**New (responsive behavior):**
```tsx
// Remove hardcoded minWidth
// Use responsive gap and padding
<div
  ref={boardRef}
  className="flex gap-2 md:gap-3 lg:gap-4 p-4 md:p-6 min-h-full"
>
```

#### 2. KanbanColumn.tsx Changes

**Current:**
```tsx
className="flex-shrink-0 w-[300px] rounded-lg..."
```

**New (responsive widths):**
```tsx
// Smaller columns on smaller screens, expandable on larger
className="flex-shrink-0 w-[220px] md:w-[260px] lg:w-[280px] xl:w-[300px] rounded-lg..."
```

**Width Breakdown:**
| Screen Size | Column Width | Total for 9 cols |
|-------------|--------------|------------------|
| Base (<768px) | 220px | ~2020px |
| md (768px+) | 260px | ~2380px |
| lg (1024px+) | 280px | ~2560px |
| xl (1280px+) | 300px | ~2740px |

#### 3. Compact Card Spacing

Reduce padding on smaller screens:

```tsx
// DevelopmentCard.tsx
className="p-2 md:p-3"

// Smaller text on mobile
<h4 className="font-medium text-xs md:text-sm mb-1 md:mb-2 line-clamp-2">
```

#### 4. Compact Header on Smaller Screens

Reduce vertical space in the header:

```tsx
// Development.tsx header
<div className="flex-shrink-0 p-4 md:p-6 border-b bg-background">
```

---

### Visual Comparison

**Before:**
- 9 columns x 300px = 2700px minimum width
- Large gaps (16px) between columns
- Header uses full padding

**After:**
- Columns scale from 220px to 300px based on screen
- Gaps reduce from 8px to 16px progressively
- Tighter layout fits more content on screen
- Maintains horizontal scroll but with less distance

---

### Summary of Changes

| File | Lines Changed | Description |
|------|---------------|-------------|
| `KanbanBoard.tsx` | ~3 lines | Remove minWidth, responsive gaps/padding |
| `KanbanColumn.tsx` | ~2 lines | Responsive column widths |
| `DevelopmentCard.tsx` | ~4 lines | Compact padding and text on mobile |
| `Development.tsx` | ~2 lines | Reduce header padding on mobile |

This approach maintains the horizontal Kanban layout (which is expected for this type of board) while making it more efficient for different screen sizes by reducing wasted space.

