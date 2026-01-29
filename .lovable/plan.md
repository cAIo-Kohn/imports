
## Plan: Display Initial Card Image + Include in Files Archive

### Problem Summary

When you create a new card and upload a picture during creation:
1. **Not visible in card header**: The image is saved to the database but not displayed in the card detail view
2. **Not visible in Files tab**: The Files tab only shows attachments from timeline activities, not the initial card image

### Root Cause

| Location | Issue |
|----------|-------|
| `CardInfoSection.tsx` | Does not render `item.image_url` at all |
| `CardFilesTab.tsx` | Only fetches from activity metadata, ignores `development_items.image_url` |
| `CreateCardModal.tsx` | Saves image to `image_url` column but doesn't log it as an activity with attachments |

### Solution

Two complementary fixes:

**1. Display the initial image in the card header** (CardInfoSection)
Add a clickable image thumbnail below the title/badges section that shows the card's main image.

**2. Include the initial image in the Files tab** (CardFilesTab)
Fetch the card's `image_url` from `development_items` and include it in the files list alongside activity attachments.

### Technical Implementation

#### 1. Update CardInfoSection.tsx

Add image display below the title section:

```tsx
{/* Card Image - if available */}
{item.image_url && (
  <a
    href={item.image_url}
    target="_blank"
    rel="noopener noreferrer"
    className="block relative w-full max-w-xs rounded-lg overflow-hidden border hover:ring-2 hover:ring-primary transition-all"
  >
    <img
      src={item.image_url}
      alt={item.title}
      className="w-full h-auto object-contain max-h-48"
    />
    <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
      <ExternalLink className="h-5 w-5 text-white opacity-0 hover:opacity-100" />
    </div>
  </a>
)}
```

This will show the initial image:
- In a clickable container that opens full-size in a new tab
- With a subtle hover effect indicating it's interactive
- Below the title/badges but above the desired outcome

#### 2. Update CardFilesTab.tsx

Modify the query to also fetch the card's main image:

```tsx
const { data: files = [], isLoading } = useQuery({
  queryKey: ['card-files', cardId],
  queryFn: async () => {
    // Fetch activities with attachments (existing logic)
    const { data: activities, error } = await supabase
      .from('development_card_activity')
      .select('*')
      .eq('card_id', cardId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    // ALSO fetch the card's main image
    const { data: card } = await supabase
      .from('development_items')
      .select('image_url, created_at, created_by')
      .eq('id', cardId)
      .single();

    // ... existing profile lookup logic ...

    const allFiles: FileItem[] = [];

    // Add the card's initial image if it exists
    if (card?.image_url) {
      const creatorProfile = profileMap[card.created_by];
      allFiles.push({
        id: `card-image-${cardId}`,
        name: 'Initial card image',
        url: card.image_url,
        type: 'image',
        uploadedAt: card.created_at,
        uploadedBy: {
          name: creatorProfile?.full_name || null,
          email: creatorProfile?.email || null,
        },
        activityType: 'created',
        activityContent: 'Card created with image',
      });
    }

    // ... existing activity attachments extraction logic ...

    return allFiles;
  },
});
```

### Files to Modify

| File | Change |
|------|--------|
| `src/components/development/CardInfoSection.tsx` | Add image display below title section |
| `src/components/development/CardFilesTab.tsx` | Include card's `image_url` in files list |

### Visual Result

**Card Detail Header (after fix):**
```text
┌─────────────────────────────────────────┐
│ Title                          [Status] │
│ [Item] [Final Product] [Medium]         │
│ 📅 Due date  🏭 Supplier                │
│                                         │
│ ┌─────────────────┐                     │
│ │   Card Image    │  ← NEW: Clickable   │
│ │   (thumbnail)   │     image display   │
│ └─────────────────┘                     │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Desired Outcome: ...                │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Files Tab (after fix):**
```text
┌─────────────────────────────────────────┐
│ 🖼️ IMAGES (3)                           │
│ ┌────┐ ┌────┐ ┌────┐                    │
│ │Init│ │Time│ │Time│  ← "Init" = initial│
│ │Img │ │line│ │line│    card image      │
│ └────┘ └────┘ └────┘                    │
│                                         │
│ 📄 DOCUMENTS (1)                        │
│ └ Report.pdf                            │
└─────────────────────────────────────────┘
```

### Summary

This fix ensures:
1. The initial card image is visible in the card header when viewing card details
2. ALL images (initial + timeline) appear in the Files archive tab
3. Everyone can always access all media shared within a card
