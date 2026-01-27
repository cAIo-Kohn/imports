

## Plan: Restructure Item Detail Drawer for Objective, Single-View Layout

### Summary

Transform the current tab-based drawer into a unified, action-oriented single-view layout with three clear sections:

| Section | Content | Purpose |
|---------|---------|---------|
| **Top** | Picture, Title, Status, Desired Outcome, Badges | Card context at a glance |
| **Middle** | Activity Timeline (chronological history) | Full audit trail of all events |
| **Bottom** | Action Panel (sticky) | Pending actions: comment/question, commercial data, samples |

---

### Current vs. New Layout

```text
CURRENT (Tab-based)                    NEW (Single-view)
┌─────────────────────┐               ┌─────────────────────┐
│ Title + Badges      │               │ 🔝 CARD INFO        │
│ Status Dropdown     │               │ ├─ Picture (if any) │
├─────────────────────┤               │ ├─ Title + Badges   │
│ [Details][Samples]  │               │ ├─ Desired Outcome  │
│ [Activity][Items*]  │               │ └─ Status/Priority  │
├─────────────────────┤               ├─────────────────────┤
│                     │               │ 📜 HISTORY          │
│   Tab Content       │               │ ├─ Created: Jan 27  │
│   (varies)          │               │ ├─ Commented: ...   │
│                     │               │ ├─ FOB price added  │
│                     │               │ └─ Sample shipped   │
│                     │               ├─────────────────────┤
│                     │               │ ⚡ ACTIONS (sticky) │
│                     │               │ ├─ Comment/Question │
│                     │               │ ├─ Commercial Data  │
│                     │               │ └─ + Add Sample     │
└─────────────────────┘               └─────────────────────┘
```

---

### Detailed Section Breakdown

#### Section 1: Card Information (Top - Static)

```text
┌─────────────────────────────────────────────────────────────────────┐
│ [x] Close                                                     [🗑️]  │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐                                                     │
│ │             │  PE Strap                                           │
│ │   [Image]   │  Raw Material • Single Item • medium priority       │
│ │             │                                                     │
│ └─────────────┘  Status: [Pending ▼]  |  Due: 15/02/2026            │
├─────────────────────────────────────────────────────────────────────┤
│ 📋 DESIRED OUTCOME                                                  │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Price and MOQ for PE strap of our chairs.                       │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ 🏭 Supplier: Jiaxing Packaging Co. (or "Not assigned")              │
│                                                                     │
│ 👥 Products in Group: 3 items  [View/Edit →]  (only for groups)     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Section 2: History Timeline (Middle - Scrollable)

This section shows ALL events in reverse chronological order:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ 📜 HISTORY                                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ [Today]                                                             │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ 📦 Trader Wang added sample tracking      10:30 AM            │   │
│ │    DHL - 1234567890 • ETA: 05/02/2026                         │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ [Yesterday]                                                         │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ 💬 Trader Wang commented                   3:45 PM            │   │
│ │    "Found 3 factories. Will send quotes tomorrow."            │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ 💰 Trader Wang updated FOB Price          2:30 PM             │   │
│ │    Set to $0.15 USD                                           │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ ⬅️ Card moved to MOR (Brazil)             2:31 PM             │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
│ [Jan 27, 2026]                                                      │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ ✅ Caio Kohn created this card            4:44 PM             │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**History includes:**
- Card creation
- Comments and questions
- Status changes
- Commercial data updates (FOB, MOQ, etc.)
- Sample tracking added/updated
- Ownership changes (MOR ↔ ARC)
- Products added (for groups)

#### Section 3: Actions Panel (Bottom - Sticky)

This is a collapsible/accordion panel that stays at the bottom:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ ⚡ ACTIONS                                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ┌─ 💬 Add Comment / ❓ Ask Question ──────────────────────────────┐ │
│ │ [Comment] [Question]                                            │ │
│ │ ┌─────────────────────────────────────────────────────────────┐ │ │
│ │ │ Write your message here...                                  │ │ │
│ │ └─────────────────────────────────────────────────────────────┘ │ │
│ │                                               [Send]            │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─ 💰 Commercial Data ────────────────────────────────────────────┐ │
│ │ FOB Price (USD): $[____]    MOQ: [________]                     │ │
│ │ Qty/Container: [________]   Container: [20ft ▼]                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─ 📦 Add Sample ─────────────────────────────────────────────────┐ │
│ │ [+ Add Sample Tracking]  (click to expand form)                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/development/ItemDetailDrawer.tsx` | **Major Refactor** | Replace tabs with single-view layout |
| `src/components/development/CardInfoSection.tsx` | **Create** | Top section: picture, title, badges, desired outcome |
| `src/components/development/ActivityTimeline.tsx` | **Modify** | Show full history with all event types, including samples |
| `src/components/development/ActionsPanel.tsx` | **Create** | Bottom sticky panel: comments, commercial data, samples |
| `src/components/development/GroupedItemsDrawer.tsx` | **Create** | Separate drawer/modal for managing grouped products |

---

### Technical Implementation

#### 1. New Drawer Structure

```typescript
// ItemDetailDrawer.tsx - New structure
<Sheet>
  <SheetContent className="flex flex-col h-full">
    {/* Top Section - Fixed */}
    <div className="flex-shrink-0 border-b pb-4">
      <CardInfoSection item={item} canEdit={canManage} />
    </div>
    
    {/* Middle Section - Scrollable */}
    <ScrollArea className="flex-1">
      <ActivityTimeline cardId={item.id} showAllEvents={true} />
    </ScrollArea>
    
    {/* Bottom Section - Sticky */}
    <div className="flex-shrink-0 border-t pt-4 bg-background">
      <ActionsPanel 
        cardId={item.id}
        cardType={item.card_type}
        canEdit={canManage}
        commercialData={{...}}
        currentOwner={item.current_owner}
      />
    </div>
  </SheetContent>
</Sheet>
```

#### 2. Enhanced Activity Timeline

Update the timeline to show ALL events with rich formatting:

```typescript
// Activity types to display in history
type ActivityEventType = 
  | 'created'           // Card creation
  | 'comment'           // User comment
  | 'question'          // User question
  | 'status_change'     // Status update
  | 'ownership_change'  // MOR ↔ ARC movement
  | 'sample_added'      // Sample tracking added
  | 'sample_updated'    // Sample status changed
  | 'commercial_update' // FOB/MOQ/Container updated
  | 'product_added'     // Product added to group
  | 'image_updated';    // Picture changed
```

#### 3. Actions Panel with Accordions

```typescript
// ActionsPanel.tsx
<Accordion type="multiple" defaultValue={['messaging']}>
  <AccordionItem value="messaging">
    <AccordionTrigger>
      💬 Add Comment / Ask Question
    </AccordionTrigger>
    <AccordionContent>
      {/* Comment/Question form */}
    </AccordionContent>
  </AccordionItem>
  
  <AccordionItem value="commercial">
    <AccordionTrigger>
      💰 Commercial Data
    </AccordionTrigger>
    <AccordionContent>
      {/* FOB, MOQ, Container fields */}
    </AccordionContent>
  </AccordionItem>
  
  <AccordionItem value="samples">
    <AccordionTrigger>
      📦 Sample Tracking ({samplesCount})
    </AccordionTrigger>
    <AccordionContent>
      {/* Add sample form + list of existing samples */}
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

#### 4. Grouped Items - Separate Modal

For item groups, show a "View/Edit Items" button that opens a separate modal:

```typescript
// GroupedItemsDrawer.tsx
<Dialog>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Products in Group</DialogTitle>
    </DialogHeader>
    <GroupedItemsEditor cardId={cardId} canEdit={canEdit} />
  </DialogContent>
</Dialog>
```

---

### Activity Logging Improvements

To make the history comprehensive, we need to log more events:

| Event | When to Log | Content Example |
|-------|-------------|-----------------|
| `commercial_update` | FOB/MOQ/Container changes | "FOB Price set to $0.15 USD" |
| `sample_updated` | Sample status changes | "Sample marked as Delivered" |
| `image_updated` | Picture uploaded/changed | "Product image updated" |

**Implementation**: Add activity logging to CommercialDataSection and sample mutations.

---

### User Flow Example

**China trader opens PE Strap card:**

1. **Sees immediately**:
   - Picture (if uploaded)
   - "PE Strap" title with Raw Material / Single Item badges
   - Desired Outcome: "Price and MOQ for PE strap of our chairs"
   - Status: Pending

2. **Scrolls down to see history**:
   - "Created by Caio Kohn - Jan 27, 2026"

3. **At bottom, takes actions**:
   - Types comment: "Ok, we'll start looking for factories"
   - Later fills in FOB: $0.15
   - Adds sample tracking when ready

4. **Each action appears in history automatically**

---

### Summary

| Change | Impact |
|--------|--------|
| Remove tabs | Single unified view |
| Card info at top | Immediate context |
| History in middle | Full audit trail, scrollable |
| Actions at bottom | Clear, objective actions |
| Sticky action panel | Always accessible |
| Grouped items modal | Cleaner separation |

