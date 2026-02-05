

## Standardize Development Card Sizes

### Problem
Cards in the Development board have varying heights based on their content:
- Some have Action badges, some don't
- Some have supplier info, some don't
- Some have sample/item counts, some don't
- Some have mention tags, some don't

This creates a visually inconsistent board layout.

### Solution
Apply a fixed minimum height to all cards and use consistent spacing so cards appear uniform regardless of content.

### Technical Changes

**File: `src/components/development/DevelopmentCard.tsx`**

1. **Add fixed minimum height**:
   ```tsx
   className={cn(
     'relative rounded-md border shadow-sm p-2 md:p-3 cursor-pointer transition-all',
     'hover:shadow-md',
     'min-h-[120px]', // Standard minimum height
     'flex flex-col', // Enable flex layout for content distribution
     // ... rest
   )}
   ```

2. **Reorganize content with flex layout**:
   - Top section: Responsibility badge, creator name, type badge (fixed)
   - Middle section: Title (flex-grow to fill space)
   - Bottom section: Footer info and mentions (pushed to bottom)

3. **Reserve space for optional elements**:
   - Keep the responsibility badge area consistent (show placeholder space when no badge)
   - Truncate supplier to single line
   - Limit footer to single row with overflow hidden

### Layout Structure

```text
┌────────────────────────────────┐
│ [Action Badge] (or space)      │  ← Fixed row
│ Creator Name                   │  ← Fixed row
│ [Type Badge]                   │  ← Fixed row
├────────────────────────────────┤
│ Title (line-clamp-2)           │  ← Flex-grow
│ Supplier (truncate)            │
├────────────────────────────────┤
│ 📦 1 sample  📅 12/01          │  ← Fixed footer
│ @mentions (if any)             │
└────────────────────────────────┘
```

### CSS Changes

```tsx
// Main card container
<div className={cn(
  'relative rounded-md border shadow-sm p-2 md:p-3 cursor-pointer transition-all',
  'hover:shadow-md',
  'min-h-[130px] flex flex-col', // Fixed height + flex column
  // ... other classes
)}>

// Content wrapper for flex distribution
<div className="flex-1 flex flex-col">
  {/* Top section - badges and creator */}
  <div>
    {/* Responsibility badge with min-height to reserve space */}
    <div className="min-h-[22px]">
      {item.current_assignee_role && <ResponsibilityBadge ... />}
    </div>
    {/* Creator name */}
    {/* Type badge */}
  </div>
  
  {/* Middle section - title & supplier (grows) */}
  <div className="flex-1">
    <h4 className="line-clamp-2">...</h4>
    {item.supplier && <p className="truncate">...</p>}
  </div>
  
  {/* Bottom section - footer info (fixed at bottom) */}
  <div className="mt-auto">
    {/* Footer info */}
    {/* Mentions */}
  </div>
</div>
```

### Files to Modify

1. `src/components/development/DevelopmentCard.tsx` - Add fixed height and flex layout

