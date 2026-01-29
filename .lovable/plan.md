

## Plan: Make Card Header Image Compact

### Current Issue

The initial card image in the header uses `max-w-xs` (320px width) and `max-h-48` (192px height), taking up too much vertical space and reducing the timeline/history area.

### Solution

Make the image a small inline thumbnail (48x48px) that sits alongside the due date and supplier info, keeping it clickable to open full-size in a new tab.

### Visual Layout

**Current:**
```text
┌────────────────────────────────────────┐
│ Title                        [Status]  │
│ [Item] [Final Product] [Medium]        │
│ 📅 Due date  🏭 Supplier               │
│ ┌────────────────────────────┐         │
│ │                            │         │
│ │      LARGE IMAGE           │ ← Takes │
│ │      (up to 320x192)       │   too   │
│ │                            │   much  │
│ └────────────────────────────┘   space │
│ Desired Outcome: ...                   │
└────────────────────────────────────────┘
```

**After fix:**
```text
┌────────────────────────────────────────┐
│ Title                        [Status]  │
│ [Item] [Final Product] [Medium]        │
│ 📅 Due  🏭 Supplier  🖼️ [thumb]        │
│ Desired Outcome: ...                   │
└────────────────────────────────────────┘
                               ↑
                        Small 48x48 thumbnail
                        inline with metadata
```

### Technical Changes

**File: `src/components/development/CardInfoSection.tsx`**

Move the image from its own section into the metadata row (with due date and supplier), making it a small clickable thumbnail:

```tsx
{/* Due date + Supplier + Image thumbnail inline */}
{(item.due_date || item.supplier || item.image_url) && (
  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
    {item.due_date && (
      <span className="flex items-center gap-1">
        <Calendar className="h-3 w-3" />
        {format(new Date(item.due_date), 'dd/MM/yyyy')}
      </span>
    )}
    {item.supplier && (
      <span className="flex items-center gap-1">
        <Factory className="h-3 w-3" />
        {item.supplier.company_name}
      </span>
    )}
    {item.image_url && (
      <a
        href={item.image_url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex-shrink-0"
        title="View full image"
      >
        <div className="relative w-10 h-10 rounded border overflow-hidden hover:ring-2 hover:ring-primary transition-all">
          <img
            src={item.image_url}
            alt={item.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <ExternalLink className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </a>
    )}
  </div>
)}
```

### Key Changes

| Property | Before | After |
|----------|--------|-------|
| Container size | `max-w-xs` (320px) | `w-10 h-10` (40x40px) |
| Image height | `max-h-48` (192px) | `h-10` (40px) |
| Object fit | `object-contain` | `object-cover` (crop to fit) |
| Position | Own section below metadata | Inline with date/supplier row |

### Result

- Header height reduced by ~150-200px
- Image still visible as a recognizable thumbnail
- Clicking opens full image in new tab
- Timeline/history section gets more vertical space

