
## Plan: Reorganize Card Header and Add Upload Functionality Throughout Timeline

### Overview

This plan addresses two main areas:
1. **Header Cleanup**: Reorganize the card details header to emphasize the title and description, removing the image upload from that location
2. **Ubiquitous Upload**: Add upload buttons throughout the timeline - in reply boxes, action hints, and messaging sections

---

### Current Issues (from screenshot)

The current layout has the image upload button awkwardly placed next to the card title, making the header cluttered and confusing.

---

### Part 1: Header Reorganization

**Goal**: Make title and description the focal point, remove image upload from header.

#### New Header Layout

```text
┌────────────────────────────────────────────────────────────────┐
│  Card Details                                       [🗑 Delete] │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PE Strap                                 ← Large title         │
│  [Single Item] [Raw Material] [medium]    ← Badges below        │
│                                                                 │
│  Status: [Pending ▼]                                           │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ Price and MOQ for PE strap of our chairs.                  ││
│  │                                          ← Desired outcome ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

**Changes to `CardInfoSection.tsx`**:
- Remove the image upload/display from the header entirely
- Make title larger and more prominent (`text-xl` instead of `text-lg`)
- Keep badges and status below title
- Keep the "Desired Outcome" description box

---

### Part 2: Add Upload Buttons in Timeline

#### 2A. Add Upload to "What's next?" Prompt

When the "What's next?" hint appears in the timeline, add an "Upload" button alongside existing actions:

```text
┌─────────────────────────────────────────────────────────────────┐
│  💡 What's next?                                                │
├─────────────────────────────────────────────────────────────────┤
│  Commercial data has been set. What would you like to do?       │
│                                                                 │
│  [Request Sample] [Ask a Question] [Add Comment] [📎 Upload]   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Changes to `HistoryTimeline.tsx` - `NextStepPrompt` component**:
- Add `onUpload` callback prop
- Add "Upload" button that triggers the upload flow

#### 2B. Add Upload to Sample Approved Banner

```text
┌─────────────────────────────────────────────────────────────────┐
│  ✓ Sample Approved - Ready to Close                            │
├─────────────────────────────────────────────────────────────────┤
│  [Close Card] [Ask Question] [Add Comment] [📎 Upload]         │
└─────────────────────────────────────────────────────────────────┘
```

**Changes to `HistoryTimeline.tsx` - `SampleApprovedBanner` component**:
- Add `onUpload` callback prop
- Add "Upload" button

#### 2C. Add Upload to Inline Reply Box

When replying to a question, allow attaching files:

```text
┌─────────────────────────────────────────────────────────────────┐
│  [Textarea: Type your reply...]                                 │
│                                                                 │
│  [Cancel] [📎 Upload] [Just Comment] [Answer & Move to ARC →]  │
└─────────────────────────────────────────────────────────────────┘
```

**Changes to `InlineReplyBox.tsx`**:
- Add upload button with file picker
- Display attached files as previews before sending
- Include file URLs in the activity metadata when submitting

#### 2D. Add Upload to ActionsPanel Messaging Section

In the Comment/Question accordion, add upload alongside the message:

```text
┌─────────────────────────────────────────────────────────────────┐
│  📝 Add Comment / Ask Question                                  │
├─────────────────────────────────────────────────────────────────┤
│  [Comment] [Question]                                           │
│                                                                 │
│  [Textarea...]                                                  │
│                                                                 │
│  [📎 Attachments: None]                    [Send]              │
│           ↑                                                     │
│    Shows file previews when attached                            │
└─────────────────────────────────────────────────────────────────┘
```

**Changes to `ActionsPanel.tsx`**:
- Add upload state to track attached files
- Add upload button in messaging section
- Display file previews below textarea
- Include file URLs in activity metadata on send

---

### Part 3: Upload Implementation

#### Shared Upload Component

Create a lightweight inline upload button that can be reused:

**New file: `src/components/development/TimelineUploadButton.tsx`**

```typescript
interface TimelineUploadButtonProps {
  onFilesSelected: (files: File[]) => void;
  attachments: UploadedFile[];
  variant?: 'button' | 'icon';
  className?: string;
}

interface UploadedFile {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'file';
}
```

Features:
- Uses existing Supabase storage bucket (`development-images`)
- Shows file picker on click
- Supports multiple files
- Shows inline preview of attached files
- Allows removing attachments before submitting

---

### Part 4: Display Attachments in Timeline

When activities have attachments in metadata, display them:

**Changes to `HistoryTimeline.tsx`**:
- Check activity metadata for `attachments` array
- Render thumbnails for images, file icons for documents
- Clicking opens in new tab

```text
┌─────────────────────────────────────────────────────────────────┐
│  👤 Caio Kohn  [commented]  10:30                               │
│                                                                 │
│  "Here's the sample photo for reference"                        │
│                                                                 │
│  [📷 thumbnail] [📷 thumbnail]   ← Attached images              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/development/CardInfoSection.tsx` | Remove image upload from header, clean up layout |
| `src/components/development/HistoryTimeline.tsx` | Add upload to NextStepPrompt & SampleApprovedBanner, display attachments on activities |
| `src/components/development/InlineReplyBox.tsx` | Add upload button and attachment handling |
| `src/components/development/ActionsPanel.tsx` | Add upload to messaging section |
| **NEW** `src/components/development/TimelineUploadButton.tsx` | Reusable upload component for timeline |

---

### Activity Metadata Schema for Attachments

```json
{
  "attachments": [
    {
      "id": "uuid",
      "name": "sample-photo.jpg",
      "url": "https://storage.supabase.co/...",
      "type": "image"
    }
  ],
  "reply_to_question": "question-id" // if applicable
}
```

---

### User Experience Flow

1. User opens a card and sees clean header with title/description prominent
2. User scrolls to timeline and sees "What's next?" prompt with Upload option
3. User clicks "Upload" → file picker opens → selects files
4. Files upload to storage, URLs are stored in activity metadata
5. Activity appears in timeline with thumbnails/file icons
6. Other users can view/download attachments from the timeline

---

### Technical Notes

- Reuses existing `development-images` Supabase storage bucket
- File uploads happen immediately on selection (before submitting message)
- Cancelled uploads are cleaned up (files deleted from storage)
- Maximum file size: 10MB per file
- Supported types: Images (jpg, png, gif, webp), PDFs, Documents (docx, xlsx)
