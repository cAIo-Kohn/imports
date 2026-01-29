
## Redesign: Optimize Card Details Drawer for Timeline Focus

### Current Issues (From Screenshot Analysis)

| Problem | Impact |
|---------|--------|
| "Card Details" header takes vertical space | Wastes ~50px |
| Card info section (title, badges, description) is separated from actions | Creates visual disconnect |
| Tab bar (Timeline/Files) adds another navigation layer | Extra 48px of chrome |
| Actions panel at bottom has 3 separate accordions | Cluttered, takes focus away |
| Description box uses full paragraph styling | Could be more compact |

### Redesign Goals

1. **Maximize timeline visibility** - Timeline should dominate the view
2. **Reduce header to essential info only** - Title + status inline
3. **Collapse secondary info** - Image, description, metadata in expandable area
4. **Streamline actions** - Single quick-action bar instead of 3 accordions
5. **Remove redundant UI elements** - Merge tabs into timeline context

### Proposed Layout

```text
┌────────────────────────────────────────────────┐
│ ✕  Caneta             [Pending ▾]  [🗑️]        │  ← Minimal header: title + status + delete
│ [Item][Final Product][medium] 📅 29/01  🖼️     │  ← Badges + metadata inline (collapsible)
├────────────────────────────────────────────────┤
│ ▸ Show details                                 │  ← Collapsible: description + image
├────────────────────────────────────────────────┤
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │ 📎 Timeline / Files                   [+]│  │  ← Single header with add button
│  ├──────────────────────────────────────────┤  │
│  │                                          │  │
│  │  TODAY                                   │  │
│  │  ○ Vitória created this card • 14:53    │  │
│  │                                          │  │
│  │  (timeline takes 70%+ of drawer height) │  │
│  │                                          │  │
│  └──────────────────────────────────────────┘  │
│                                                │
├────────────────────────────────────────────────┤
│ [💬 Comment] [❓ Question] [$$ Commercial] [📦]│  ← Icon-only quick action bar
└────────────────────────────────────────────────┘
```

### Technical Changes

#### 1. Compact Header (ItemDetailDrawer.tsx)

Remove the separate "Card Details" title, merge title into header row:

```tsx
<SheetHeader className="flex-shrink-0 px-4 py-3 border-b">
  <div className="flex items-center justify-between gap-2">
    {/* Title + Status inline */}
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <h2 className="font-semibold text-sm truncate">{item.title}</h2>
      <StatusSelect value={status} onChange={...} />
    </div>
    {/* Actions */}
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-7 w-7">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  </div>
</SheetHeader>
```

**Savings: ~40px vertical space**

#### 2. Collapsible Details Section (CardInfoSection.tsx)

Make metadata + description collapsible (collapsed by default):

```tsx
<Collapsible defaultOpen={false}>
  {/* Always visible: Badges + quick metadata */}
  <div className="flex items-center justify-between py-2 px-4 bg-muted/30">
    <div className="flex items-center gap-1.5 flex-wrap">
      <Badge variant="outline" className="text-[9px] h-4">Item</Badge>
      <Badge variant="secondary" className="text-[9px] h-4">Final Product</Badge>
      <Badge className="text-[9px] h-4 bg-yellow-500">medium</Badge>
      {item.due_date && (
        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
          <Calendar className="h-2.5 w-2.5" />
          {format(new Date(item.due_date), 'dd/MM')}
        </span>
      )}
      {item.image_url && (
        <a href={item.image_url} target="_blank" className="w-5 h-5 rounded overflow-hidden">
          <img src={item.image_url} className="w-full h-full object-cover" />
        </a>
      )}
    </div>
    <CollapsibleTrigger asChild>
      <Button variant="ghost" size="sm" className="h-6 text-[10px]">
        Details <ChevronDown className="h-3 w-3 ml-1" />
      </Button>
    </CollapsibleTrigger>
  </div>
  
  <CollapsibleContent>
    {/* Description, supplier, larger image, etc */}
    <div className="px-4 py-2 space-y-2 border-t bg-muted/20">
      {item.description && (
        <p className="text-xs text-muted-foreground">{item.description}</p>
      )}
      {/* ... other details ... */}
    </div>
  </CollapsibleContent>
</Collapsible>
```

**Savings: ~60-100px when collapsed**

#### 3. Remove Tab Chrome, Integrate Files into Timeline

Instead of separate tabs, add a filter/toggle in the timeline header:

```tsx
{/* Timeline header with integrated files toggle */}
<div className="flex items-center justify-between py-2 px-4 border-b">
  <div className="flex items-center gap-2">
    <span className="text-xs font-medium text-muted-foreground">Activity</span>
    <Button 
      variant={showFilesOnly ? "secondary" : "ghost"} 
      size="sm" 
      className="h-5 text-[10px]"
      onClick={() => setShowFilesOnly(!showFilesOnly)}
    >
      <FolderOpen className="h-3 w-3 mr-1" />
      Files ({fileCount})
    </Button>
  </div>
</div>
```

**Savings: ~48px (no more TabsList)**

#### 4. Quick Action Bar (ActionsPanel.tsx)

Replace 3 accordions with a horizontal icon bar that expands inline:

```tsx
<div className="flex items-center gap-1 p-2 border-t bg-background">
  <Button 
    variant={activeAction === 'comment' ? 'secondary' : 'ghost'} 
    size="sm" 
    className="h-8 flex-1"
    onClick={() => setActiveAction('comment')}
  >
    <MessageCircle className="h-4 w-4" />
    <span className="sr-only sm:not-sr-only sm:ml-1 text-xs">Comment</span>
  </Button>
  <Button 
    variant={activeAction === 'question' ? 'secondary' : 'ghost'} 
    size="sm" 
    className="h-8 flex-1"
    onClick={() => setActiveAction('question')}
  >
    <HelpCircle className="h-4 w-4" />
  </Button>
  <Button 
    variant={activeAction === 'commercial' ? 'secondary' : 'ghost'} 
    size="sm" 
    className="h-8 flex-1 relative"
    onClick={() => setActiveAction('commercial')}
  >
    <DollarSign className="h-4 w-4" />
    {isCommercialPending && (
      <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full" />
    )}
  </Button>
  <Button 
    variant={activeAction === 'sample' ? 'secondary' : 'ghost'} 
    size="sm" 
    className="h-8 flex-1"
    onClick={() => setActiveAction('sample')}
  >
    <Package className="h-4 w-4" />
  </Button>
</div>

{/* Expanded action panel - only shows when one is selected */}
{activeAction && (
  <div className="p-3 border-t bg-muted/20">
    {activeAction === 'comment' && <CommentForm ... />}
    {activeAction === 'question' && <QuestionForm ... />}
    {activeAction === 'commercial' && <CommercialForm ... />}
    {activeAction === 'sample' && <SampleForm ... />}
  </div>
)}
```

**Result: Cleaner bottom bar, actions expand only when needed**

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/development/ItemDetailDrawer.tsx` | Remove "Card Details" title, merge header with CardInfoSection, remove Tabs wrapper |
| `src/components/development/CardInfoSection.tsx` | Add Collapsible wrapper, make badges smaller, move description inside collapsible |
| `src/components/development/ActionsPanel.tsx` | Replace Accordion with horizontal button bar + expandable panels |
| `src/components/development/HistoryTimeline.tsx` | Add optional "files only" filter mode |

### Visual Comparison

**Before (Current)**:
```text
Height breakdown:
- Sheet header "Card Details"      = 56px
- CardInfoSection (with desc)     = 120px  
- Tab bar                         = 48px
- Timeline content                = remaining
- Actions panel (3 accordions)    = 120-180px collapsed
─────────────────────────────────────────────
Total chrome/navigation           = ~350px
```

**After (Redesigned)**:
```text
Height breakdown:
- Compact header (title+status)   = 44px
- Badges row (collapsed details)  = 32px
- Timeline header                 = 28px
- Timeline content                = remaining
- Quick action bar                = 40px
- Expanded action (when open)     = 80-120px
─────────────────────────────────────────────
Total chrome/navigation           = ~144px (collapsed)
```

**Net gain: ~200px more space for timeline content!**

### Summary

This redesign transforms the card detail drawer from a form-heavy view to a conversation-centric timeline view by:

1. **Removing redundant headers** - Title goes in the sheet header
2. **Collapsing secondary info** - Details available on demand
3. **Eliminating tab navigation** - Files integrated into timeline
4. **Streamlining actions** - Icon bar replaces accordions

The result gives the timeline 70%+ of the drawer height instead of the current ~50%.
