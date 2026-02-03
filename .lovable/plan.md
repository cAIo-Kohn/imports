
# Update Card Type Badges and Priority Indicator

## Summary
Simplify the card type badges to show only product category information (Product/Raw/Group) and move the priority indicator from a badge to the left border color with animation effects.

## Changes to DevelopmentCard.tsx

### 1. Remove "Item" Badge Logic
- Replace the generic card type badge with a simplified product category badge:
  - **Individual Item (`item`)**: Show "Product" badge (blue)
  - **Raw Material (`raw_material`)**: Show "Raw" badge (green/emerald)  
  - **Item Group (`item_group`)**: Show "Group" badge (purple)
  - **Task**: Keep showing "Task" badge (for task cards)

### 2. Priority as Left Border Color
Replace the priority badge with colored left border based on priority level:

| Priority | Border Color | Effect |
|----------|--------------|--------|
| Low | Light blue (`#60A5FA` / `blue-400`) | Solid |
| Medium | Yellow (`#FACC15` / `yellow-400`) | Solid |
| High | Light red (`#F87171` / `red-400`) | Pulsing animation |
| Urgent | Purple (`#A855F7` / `purple-500`) | Pulsing animation |

### 3. CSS Animation for Pulsing Border
Add CSS animation classes for high and urgent priorities that create a subtle pulsing glow effect on the left border.

## Visual Result
- Cards will have cleaner badges (just one badge for product type)
- Priority is immediately visible via the left border color
- High/Urgent priorities draw attention with subtle pulsing animation

## Technical Details

### Badge Display Logic
```text
if card_type === 'task' → show "Task" badge
if card_type === 'item_group' → show "Group" badge  
if card_type === 'item':
  - if product_category === 'raw_material' → show "Raw" badge
  - else → show "Product" badge
```

### Priority Border Styles
```typescript
const PRIORITY_BORDER_STYLES = {
  low: { color: '#60A5FA', animation: '' },
  medium: { color: '#FACC15', animation: '' },
  high: { color: '#F87171', animation: 'animate-pulse-border-red' },
  urgent: { color: '#A855F7', animation: 'animate-pulse-border-purple' },
};
```

### CSS Animations (in index.css)
```css
@keyframes pulse-border-red {
  0%, 100% { border-left-color: #F87171; box-shadow: -2px 0 8px rgba(248, 113, 113, 0.4); }
  50% { border-left-color: #FCA5A5; box-shadow: -2px 0 12px rgba(248, 113, 113, 0.6); }
}

@keyframes pulse-border-purple {
  0%, 100% { border-left-color: #A855F7; box-shadow: -2px 0 8px rgba(168, 85, 247, 0.4); }
  50% { border-left-color: #C084FC; box-shadow: -2px 0 12px rgba(168, 85, 247, 0.6); }
}
```

## Files to Modify
| File | Change |
|------|--------|
| `src/components/development/DevelopmentCard.tsx` | Update badge logic and apply priority to left border |
| `src/index.css` | Add pulsing border animation keyframes |
