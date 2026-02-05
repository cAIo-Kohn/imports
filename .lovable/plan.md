
## Fix Date Input Calendar Icon Visibility

### Problem
The "Add Tracking & Ship" modal uses a 3-column grid for "Shipped Date", "ETA", and "Quantity" fields. This makes each column too narrow, causing the native browser calendar picker icon to be clipped or hidden within the tight input space.

### Solution
Change the layout to give date inputs more horizontal space so the calendar icons are fully visible and clickable:

1. **Split into 2 rows**: 
   - Row 1: "Shipped Date" and "ETA" in a 2-column grid (more space per input)
   - Row 2: "Quantity" as a narrower standalone field

2. **Add padding for the calendar icon**:
   - Add right padding (`pr-10`) to ensure the calendar icon has room
   - Ensure the icon remains positioned correctly within the input

### Changes to `src/components/development/AddTrackingModal.tsx`

**Current layout (lines 199-232):**
```tsx
<div className="grid grid-cols-3 gap-4">
  <div>Shipped Date...</div>
  <div>ETA...</div>
  <div>Quantity...</div>
</div>
```

**New layout:**
```tsx
{/* Date fields - 2 columns for more space */}
<div className="grid grid-cols-2 gap-4">
  <div className="space-y-2">
    <Label htmlFor="shipped-date">Shipped Date</Label>
    <Input
      id="shipped-date"
      type="date"
      value={shippedDate}
      onChange={(e) => setShippedDate(e.target.value)}
      className="pr-2 [&::-webkit-calendar-picker-indicator]:opacity-100 ..."
    />
  </div>
  <div className="space-y-2">
    <Label htmlFor="eta">ETA</Label>
    <Input
      id="eta"
      type="date"
      value={estimatedArrival}
      onChange={(e) => setEstimatedArrival(e.target.value)}
      className="pr-2 [&::-webkit-calendar-picker-indicator]:opacity-100 ..."
    />
  </div>
</div>

{/* Quantity - smaller standalone field */}
<div className="space-y-2 w-24">
  <Label htmlFor="qty">Quantity</Label>
  <Input ... />
</div>
```

### Result
- Date inputs will have more horizontal space
- Calendar icons will be fully visible and clickable
- Quantity field remains compact since it only needs to show small numbers
- Modal maintains a clean, organized appearance
