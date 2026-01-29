

## Plan: Add File Upload to Comment/Question Section

### Problem

When creating a new card or adding comments/questions from the Actions Panel, there's no way to upload files (images, PDFs, Excel reports, etc.). The upload functionality exists in the reply box but is missing from the main messaging form.

### Solution

Add the existing `TimelineUploadButton` component to the "Add Comment / Ask Question" section in the Actions Panel. This will allow users to attach files when posting comments or questions.

### What Will Change

The messaging section will now include:
1. A paperclip/attach button next to the text area
2. Preview of attached files before sending
3. Attachments saved to the activity metadata when the message is sent

### Visual Layout

```text
+-------------------------------------------+
| Add Comment / Ask Question            [v] |
+-------------------------------------------+
| [Comment] [Question]  (tabs)              |
|                                           |
| +---------------------------------------+ |
| | Type your message...                  | |
| |                                       | |
| +---------------------------------------+ |
|                                           |
| [📎 Attach] [img1.png] [report.xlsx]     | <- NEW: Upload button + previews
|                                           |
|                               [Send]      |
+-------------------------------------------+
```

### Technical Implementation

**File: `src/components/development/ActionsPanel.tsx`**

1. Import the `TimelineUploadButton` and `UploadedAttachment` type
2. Add state for attachments: `const [attachments, setAttachments] = useState<UploadedAttachment[]>([])`
3. Add the upload button below the textarea
4. Update the mutation to include attachments in metadata
5. Clear attachments after successful send

**Code Changes:**

```tsx
// Add import
import { TimelineUploadButton, UploadedAttachment } from './TimelineUploadButton';

// Add state (after messageContent state)
const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);

// Update the mutation to include attachments
const addMessageMutation = useMutation({
  mutationFn: async () => {
    if (!user?.id || (!messageContent.trim() && attachments.length === 0)) return;
    
    const metadata: Record<string, any> = {};
    if (attachments.length > 0) {
      metadata.attachments = attachments;
    }
    
    const { error } = await supabase.from('development_card_activity').insert({
      card_id: cardId,
      user_id: user.id,
      activity_type: messageType,
      content: messageContent.trim() || null,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    });
    if (error) throw error;
    // ... rest of mutation
  },
  onSuccess: () => {
    // ... existing code
    setAttachments([]); // Clear attachments after send
  },
});

// Update canSubmit logic
const canSubmit = messageContent.trim() || attachments.length > 0;

// Add upload button in the form (after Textarea)
<div className="flex items-center gap-2">
  <TimelineUploadButton
    attachments={attachments}
    onAttachmentsChange={setAttachments}
    variant="icon"
    disabled={addMessageMutation.isPending}
  />
</div>
```

**Form Layout Update:**

```tsx
<form onSubmit={handleSendMessage} className="space-y-3">
  <Tabs ...>...</Tabs>
  
  <Textarea ... />
  
  {/* NEW: Attachments section */}
  <div className="flex items-center justify-between">
    <TimelineUploadButton
      attachments={attachments}
      onAttachmentsChange={setAttachments}
      variant="icon"
      disabled={addMessageMutation.isPending}
    />
    
    <Button type="submit" ...>
      Send
    </Button>
  </div>
</form>
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/development/ActionsPanel.tsx` | Add upload button to messaging section, include attachments in mutation |

### Supported File Types

The existing `TimelineUploadButton` already supports:
- Images: JPEG, PNG, GIF, WebP
- Documents: PDF, Word (DOC, DOCX)
- Spreadsheets: Excel (XLS, XLSX)
- Max file size: 10MB per file
- Multiple files can be uploaded at once

### Summary

This simple integration reuses the existing upload component to add file attachment capability to the main comment/question form. Users will be able to attach images, PDFs, Excel reports, and other documents when posting messages on development cards.

