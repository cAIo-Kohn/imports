

## Add File Upload Option to Commercial Data Form

### Overview
Allow users to submit commercial data by uploading an Excel or PDF file instead of manually filling all 4 fields. If a file is uploaded, the "Submit" button becomes enabled regardless of whether the manual fields are filled.

### Current Behavior
- User must fill ALL 4 fields (FOB Price, MOQ, Qty/Container, Container Type)
- Only then can they submit
- No file upload option exists

### New Behavior
- User can either:
  1. Fill all 4 manual fields (existing behavior), OR
  2. Upload one or more files (Excel/PDF)
- If a file is uploaded, submission is allowed even with empty manual fields
- The uploaded file(s) will be stored and visible in the review modal for the requester to download

### Changes to `src/components/development/FillCommercialDataModal.tsx`

**1. Add state for attachments**
```tsx
import { TimelineUploadButton, UploadedAttachment } from './TimelineUploadButton';

const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
```

**2. Update validation logic**
Change from:
```tsx
const isValid = fobPrice && moq && qtyPerContainer && containerType;
```
To:
```tsx
const hasManualData = fobPrice && moq && qtyPerContainer && containerType;
const hasFileUpload = attachments.length > 0;
const isValid = hasManualData || hasFileUpload;
```

**3. Add file upload section in the form**
After the manual fields grid, add:
```tsx
{/* File Upload Alternative */}
<div className="border-t pt-4 space-y-3">
  <div className="flex items-center gap-2">
    <div className="h-px flex-1 bg-border" />
    <span className="text-xs text-muted-foreground">or upload a document</span>
    <div className="h-px flex-1 bg-border" />
  </div>
  
  <TimelineUploadButton
    attachments={attachments}
    onAttachmentsChange={setAttachments}
    variant="button"
  />
  
  {attachments.length > 0 && !hasManualData && (
    <p className="text-xs text-muted-foreground">
      File uploaded - you can submit without filling the fields above.
    </p>
  )}
</div>
```

**4. Include attachments in submission**
Update the mutation to include the attachments in metadata:
```tsx
metadata: {
  ...commercialData,  // may be partial or empty if file-only
  filled_by: user.id,
  filled_at: new Date().toISOString(),
  attachments: attachments,  // Array of uploaded files
  submission_type: hasManualData ? 'manual' : 'file_only',
}
```

**5. Update timeline message**
Adjust the message based on submission type:
```tsx
const timelineContent = hasManualData
  ? `💰 Commercial data submitted: $${fobPrice} FOB, MOQ ${moq}...`
  : `📎 Commercial data submitted via file upload (${attachments.length} file(s))`;
```

**6. Reset attachments on close**
Add to the reset logic in `onSuccess`:
```tsx
setAttachments([]);
```

### Changes to `src/components/development/CommercialReviewModal.tsx`

**1. Display attached files if present**
Extract attachments from metadata and display them:
```tsx
const attachments = (metadata.attachments || []) as UploadedAttachment[];
const submissionType = metadata.submission_type as string | undefined;

// In the rendered UI, after the data grid:
{attachments.length > 0 && (
  <div className="pt-4 border-t space-y-2">
    <Label className="text-xs text-muted-foreground">Attached Documents</Label>
    <div className="flex flex-wrap gap-2">
      {attachments.map((file) => (
        <a
          key={file.id}
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 bg-muted rounded px-2 py-1 text-xs hover:bg-muted/80"
        >
          <FileText className="h-4 w-4" />
          <span>{file.name}</span>
        </a>
      ))}
    </div>
  </div>
)}
```

**2. Adjust display for file-only submissions**
If data was submitted via file only, show a note:
```tsx
{submissionType === 'file_only' && (
  <p className="text-sm text-muted-foreground italic">
    Data provided via file attachment - review the uploaded document(s).
  </p>
)}
```

### Files to Modify
- `src/components/development/FillCommercialDataModal.tsx` (main changes)
- `src/components/development/CommercialReviewModal.tsx` (display attachments)

### User Experience
1. Trader opens "Fill Commercial Data" modal
2. They can either:
   - Fill all 4 fields manually, OR
   - Click "Upload" and select an Excel/PDF
3. Once either condition is met, the "Submit" button enables
4. Requester receives notification and opens Review modal
5. Review modal shows both the numeric data (if entered) AND any uploaded files
6. Requester can download the file to review details before approving/rejecting

