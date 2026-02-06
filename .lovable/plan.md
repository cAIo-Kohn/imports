

## Fix: Display Packing File in Negotiation History

### Problem
The packing type file (`packing_type_file`) uploaded during commercial data submission is:
1. **Stored correctly** in the cycle data (`cycle.packingTypeFile`)
2. **Never rendered** in the `CommercialCycleCard` component

The screenshot shows `📦 Color Box` text but no clickable link to access the uploaded packing file.

### Root Cause
In `CommercialHistoryTimeline.tsx`, line 261-262 renders:
```tsx
{cycle.finalData.packing_type && (
  <span className="text-muted-foreground">📦 {cycle.finalData.packing_type}</span>
)}
```
This only shows the packing type **text** (e.g., "Color Box"), but does NOT include a link to the `packingTypeFile`.

Additionally, the `packingTypeFile` is stored separately from the `attachments` array, so it's never shown in the attachments section either.

### Solution
Update the packing type display to include a clickable link to the packing file, and also render the packing file in the attachments section if it exists.

### Implementation

**File: `src/components/development/CommercialHistoryTimeline.tsx`**

#### 1. Import Image icon for image files
Add `Image as ImageIcon` to the lucide-react imports (to distinguish image vs document files).

#### 2. Update packing type display (lines 261-263)
Make the packing type text a clickable link when `packingTypeFile` exists:

```tsx
{cycle.finalData.packing_type && (
  cycle.packingTypeFile ? (
    <a
      href={cycle.packingTypeFile.url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-muted-foreground hover:text-primary flex items-center gap-1"
    >
      📦 {cycle.finalData.packing_type}
      {cycle.packingTypeFile.type?.startsWith('image/') ? (
        <ImageIcon className="h-3 w-3" />
      ) : (
        <FileText className="h-3 w-3" />
      )}
    </a>
  ) : (
    <span className="text-muted-foreground">📦 {cycle.finalData.packing_type}</span>
  )
)}
```

#### 3. Include packing file in attachments section (lines 281-297)
Also display the packing file as a separate attachment chip so users have multiple ways to access it:

```tsx
{/* All Files (attachments + packing file) */}
{(cycle.attachments?.length > 0 || cycle.packingTypeFile) && (
  <div className="flex flex-wrap gap-1.5 mb-2">
    {/* Packing file - shown first with special label */}
    {cycle.packingTypeFile && (
      <a
        href={cycle.packingTypeFile.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 bg-primary/10 rounded px-1.5 py-0.5 hover:bg-primary/20 transition-colors text-[10px]"
      >
        {cycle.packingTypeFile.type?.startsWith('image/') ? (
          <ImageIcon className="h-3 w-3 text-primary" />
        ) : (
          <FileText className="h-3 w-3 text-primary" />
        )}
        <span className="truncate max-w-[100px]">Packing: {cycle.packingTypeFile.name}</span>
      </a>
    )}
    {/* Other attachments */}
    {cycle.attachments?.map((file) => (
      <a
        key={file.id}
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 bg-muted rounded px-1.5 py-0.5 hover:bg-muted/80 transition-colors text-[10px]"
      >
        <FileText className="h-3 w-3 text-muted-foreground" />
        <span className="truncate max-w-[100px]">{file.name}</span>
      </a>
    ))}
  </div>
)}
```

### Visual Result

**Before:**
```
$1.00 FOB  MOQ 1.000  20.000/40HQ  📦 Color Box  M/I: 12
```

**After:**
```
$1.00 FOB  MOQ 1.000  20.000/40HQ  📦 Color Box [📎]  M/I: 12

[🖼️ Packing: photo.jpg]  [📄 other-doc.pdf]
```

The packing type now has a clickable icon, and the packing file appears as a highlighted attachment chip at the start of the attachments section.

### Files to Modify
- `src/components/development/CommercialHistoryTimeline.tsx`

