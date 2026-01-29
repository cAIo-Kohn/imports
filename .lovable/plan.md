

## Enhanced Timeline Activity Display with Inline Ownership Indicators

### Overview

Improve the timeline history to:
1. **Remove redundant "moved card" entries** - Instead of separate entries for card movement, embed ownership changes inline using country flags
2. **Show actual triggering action** - Display "Requested sample" instead of separate "moved card"
3. **Show date AND time** - Change timestamp format from just "HH:mm" to "dd/MM HH:mm"
4. **Use country flags** - Compact visual indication of ownership change direction

### Current vs Proposed Display

**Current (Redundant entries):**
```text
→ Caio moved card — ARC (China) • 17:19
→ Caio requested sample — Requested 2 sample(s) • 17:19
```

**Proposed (Inline flags + full date/time):**
```text
📦 Caio requested sample — 2 pcs 🇧🇷 → 🇨🇳 • 29/01 17:19
```

**More Examples:**
```text
$ Caio updated commercial data — FOB $100, MOQ 1000, 15000/40hq 🇨🇳 → 🇧🇷 • 29/01 17:04
🚚 Caio shipped sample — FedEX 🇨🇳 → 🇧🇷 • 28/01 16:20
💬 Caio answered — "The price includes..." 🇨🇳 → 🇧🇷 • 27/01 14:30
```

### Key Changes

| Current | Proposed |
|---------|----------|
| Separate "moved card" activity entry | No separate entry - inline flag indicator |
| Time only: `17:19` | Date + time: `29/01 17:19` |
| "moved card — ARC (China)" | 🇧🇷 → 🇨🇳 (or 🇨🇳 → 🇧🇷) inline |
| Action + Move as two entries | Single entry with embedded movement |

### Technical Implementation

#### 1. Add Flag Icons/Emoji Component

Create a helper function to render ownership direction:

```tsx
function OwnershipDirection({ from, to }: { from: 'mor' | 'arc'; to: 'mor' | 'arc' }) {
  if (from === to) return null;
  
  const fromFlag = from === 'mor' ? '🇧🇷' : '🇨🇳';
  const toFlag = to === 'mor' ? '🇧🇷' : '🇨🇳';
  
  return (
    <span className="inline-flex items-center gap-0.5 text-xs opacity-80">
      <span>{fromFlag}</span>
      <span className="text-[10px]">→</span>
      <span>{toFlag}</span>
    </span>
  );
}
```

#### 2. Modify Activity Logging to Embed Move in Triggering Action

Instead of logging a separate `ownership_change` activity after the triggering action, we'll include the ownership change info in the triggering action's metadata:

**Before:**
```typescript
// Log sample_requested
await supabase.from('development_card_activity').insert({
  activity_type: 'sample_requested',
  content: 'Sample requested',
});

// Log separate ownership_change
await supabase.from('development_card_activity').insert({
  activity_type: 'ownership_change',
  content: 'Card moved to ARC (China)',
  metadata: { new_owner: 'arc', trigger: 'sample_request' },
});
```

**After:**
```typescript
// Log sample_requested with embedded move info
await supabase.from('development_card_activity').insert({
  activity_type: 'sample_requested',
  content: 'Sample requested',
  metadata: { 
    quantity: 2,
    moved_from: 'mor',  // NEW: track where card was
    moved_to: 'arc',    // NEW: track where card went
  },
});

// NO SEPARATE ownership_change entry
```

#### 3. Filter Out Redundant ownership_change Entries

For backward compatibility with existing data, filter out `ownership_change` activities that have a `trigger` metadata field (indicating they were triggered by another action):

```typescript
// In HistoryTimeline.tsx when rendering
const displayActivities = activities.filter(a => {
  // Hide ownership_change if it has a trigger (was caused by another action)
  if (a.activity_type === 'ownership_change' && a.metadata?.trigger) {
    return false;
  }
  return true;
});
```

#### 4. Update CompactActivityRow for Date/Time and Flags

```tsx
function CompactActivityRow({ activity }: { activity: Activity }) {
  const firstName = activity.profile?.full_name?.split(' ')[0] || 'Someone';
  const label = ACTIVITY_LABELS[activity.activity_type] || ...;
  
  // ... existing inline content logic ...
  
  // Check if this activity caused an ownership change
  const movedFrom = activity.metadata?.moved_from as 'mor' | 'arc' | undefined;
  const movedTo = activity.metadata?.moved_to as 'mor' | 'arc' | undefined;
  const showOwnershipChange = movedFrom && movedTo && movedFrom !== movedTo;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1 px-1">
      <span className="flex-shrink-0 opacity-70">
        {ACTIVITY_ICONS[activity.activity_type]}
      </span>
      <span className="font-medium">{firstName}</span>
      <span>{label}</span>
      {inlineContent && (
        <>
          <span className="opacity-50">—</span>
          <span className="truncate max-w-[200px]">{inlineContent}</span>
        </>
      )}
      {/* NEW: Inline ownership change flags */}
      {showOwnershipChange && (
        <OwnershipDirection from={movedFrom} to={movedTo} />
      )}
      {/* UPDATED: Date + Time instead of just time */}
      <span className="opacity-50 flex-shrink-0">
        • {format(parseISO(activity.created_at), 'dd/MM HH:mm')}
      </span>
    </div>
  );
}
```

#### 5. Update All Activity Logging Locations

Files that need to log ownership change inline instead of separately:

| File | Action | Current → Proposed |
|------|--------|-------------------|
| `HistoryTimeline.tsx` | `useRequestSample` | Include `moved_from`/`moved_to` in sample_requested metadata |
| `InlineSampleShipForm.tsx` | Ship sample | Include flags in sample_shipped metadata |
| `InlineReplyBox.tsx` | Answer/follow-up | Include flags in answer metadata |
| `CommercialDataSection.tsx` | Commercial update | Include flags in commercial_update metadata |
| `ActionsPanel.tsx` | Commercial save | Include flags in metadata |
| `AddSampleForm.tsx` | Sample request | Include flags in metadata |

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/development/HistoryTimeline.tsx` | Add `OwnershipDirection` component, update `CompactActivityRow` for date/time + flags, filter redundant `ownership_change` entries, update `useRequestSample` to embed move info |
| `src/components/development/InlineSampleShipForm.tsx` | Remove separate ownership_change insert, add moved_from/moved_to to sample_shipped metadata |
| `src/components/development/InlineReplyBox.tsx` | Remove separate ownership_change insert, embed flags in answer metadata |
| `src/components/development/CommercialDataSection.tsx` | Embed flags in commercial_update metadata instead of separate entry |
| `src/components/development/ActionsPanel.tsx` | Embed flags in activity metadata |
| `src/components/development/AddSampleForm.tsx` | Embed flags in sample_requested metadata |

### Visual Examples After Changes

```text
YESTERDAY

📦 Caio requested sample — 2 pcs 🇧🇷 → 🇨🇳 • 28/01 15:54
$ Caio updated commercial data — FOB $100, MOQ 1000, 15000/40hq 🇨🇳 → 🇧🇷 • 28/01 17:04
🚚 Caio shipped sample — FedEX 🇨🇳 → 🇧🇷 • 28/01 16:20
📦 Caio sample arrived • 28/01 16:21
✗ Caio rejected sample — Sample rejected • 28/01 16:22

TODAY

✓ Caio created this card • 29/01 09:00
```

### Benefits

1. **Space saving** - No redundant "moved card" entries cluttering the timeline
2. **Clear context** - Flags show direction immediately without reading text
3. **Full timestamp** - Date + time helps when reviewing longer histories
4. **Visual scanning** - Flag emojis are easy to spot at a glance
5. **Backward compatible** - Existing data still renders (old ownership_change entries filtered by trigger)

### Migration Consideration

Existing `ownership_change` entries without a `trigger` in metadata (manual moves) will still be shown. Only those created automatically by actions (with `trigger` field) will be hidden.

