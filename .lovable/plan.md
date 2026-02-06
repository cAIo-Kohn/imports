

## Selective Commercial Data Revision

### Problem
When requesting a revision for commercial data, the buyer must type feedback but cannot specify **which fields** need revision. This causes **all data to be erased** when it returns to the trader, forcing them to re-enter everything from scratch.

### Solution
1. Add **checkboxes** next to each commercial data field in the review modal
2. Require at least **one field to be marked** for revision (in addition to feedback text)
3. **Only clear the flagged fields** when the task returns to the trader - preserve the rest
4. Pre-populate the FillCommercialDataModal with preserved values

### Visual Layout Change

```text
┌───────────────────────────────────────────────────────┐
│ Review Commercial Data                                │
├───────────────────────────────────────────────────────┤
│                                                       │
│  ☐ FOB Price (USD)          ☐ MOQ                    │
│     $1.00                       1.000                 │
│                                                       │
│  ☐ Qty / Container          ☐ Container Type         │
│     10.000                      40ft High Cube        │
│                                                       │
│  ☐ Qty per Master/Inner     ☐ Packing Type           │
│     12                          Color Box  [View]     │
│                                                       │
├───────────────────────────────────────────────────────┤
│ Feedback (required for revision request)              │
│ ┌───────────────────────────────────────────────────┐ │
│ │ Price too high. Target is $2.00...                │ │
│ └───────────────────────────────────────────────────┘ │
│                                                       │
│ ⚠️ Select at least one field to request revision     │
│                                                       │
│ [Cancel]  [Request Revision]  [Approve]               │
└───────────────────────────────────────────────────────┘
```

### Technical Changes

#### 1. `CommercialReviewModal.tsx`
- Add state for field selection checkboxes:
  ```tsx
  const [fieldsToRevise, setFieldsToRevise] = useState<Set<string>>(new Set());
  ```
- Add checkboxes next to each field label (FOB Price, MOQ, Qty/Container, Container Type, Packing Type, Qty per Master/Inner)
- Update validation: `handleReject` now requires both `feedback.trim()` AND `fieldsToRevise.size > 0`
- Include `fields_to_revise` array in the new task metadata when creating the revision request
- Include which fields were flagged in the rejection history
- Update the timeline message to list which fields need revision
- Reset checkboxes on modal close

#### 2. `FillCommercialDataModal.tsx`
- Read preserved values from task metadata when opening the modal
- Pre-populate form state with values that were NOT flagged for revision
- Initialize state using `useEffect` or on-mount logic based on task metadata:
  ```tsx
  const taskMetadata = task.metadata || {};
  const preservedData = taskMetadata.preserved_data as Record<string, any>;
  const fieldsToRevise = (taskMetadata.fields_to_revise || []) as string[];
  
  // On mount: pre-fill preserved values
  useEffect(() => {
    if (preservedData) {
      if (!fieldsToRevise.includes('fob_price_usd') && preservedData.fob_price_usd) {
        setFobPrice(formatBrazilianNumber(preservedData.fob_price_usd, 2));
      }
      // ... same for other fields
    }
  }, [open]);
  ```

#### 3. Metadata Structure Update
When creating the revision request task, include:
```tsx
metadata: {
  needs_revision: true,
  revision_number: revisionNumber + 1,
  previous_submissions: updatedSubmissions,
  rejection_reason: feedback,
  rejected_by: user.id,
  rejected_at: new Date().toISOString(),
  fields_to_revise: Array.from(fieldsToRevise), // NEW: which fields need revision
  preserved_data: { // NEW: data to preserve
    fob_price_usd: !fieldsToRevise.has('fob_price_usd') ? fobPrice : null,
    moq: !fieldsToRevise.has('moq') ? moq : null,
    qty_per_container: !fieldsToRevise.has('qty_per_container') ? qtyPerContainer : null,
    container_type: !fieldsToRevise.has('container_type') ? containerType : null,
    packing_type: !fieldsToRevise.has('packing_type') ? packingType : null,
    packing_type_file: !fieldsToRevise.has('packing_type') ? packingTypeFile : null,
    qty_per_master_inner: !fieldsToRevise.has('qty_per_master_inner') ? qtyPerMasterInner : null,
  },
}
```

### Validation Rules
- **Request Revision** button is disabled unless:
  1. Feedback text is not empty
  2. At least one field checkbox is checked
- Visual hint shown when no fields are selected

### Files to Modify
1. `src/components/development/CommercialReviewModal.tsx` - Add checkboxes, validation, and metadata
2. `src/components/development/FillCommercialDataModal.tsx` - Pre-populate preserved values on mount

