

## Add New Commercial Data Fields: Packing Type & Quantity per Master/Inner

### Overview
Add two new fields to the Commercial Invoice data section:
1. **Packing Type**: Text input + mandatory file upload (image/PDF) - both must be provided to fulfill
2. **Quantity per Master/Inner**: Text input field

### Database Changes

**Migration: Add columns to `development_items` table**
```sql
ALTER TABLE development_items
ADD COLUMN packing_type TEXT,
ADD COLUMN packing_type_file_url TEXT,
ADD COLUMN qty_per_master_inner TEXT;
```

### Frontend Changes

#### 1. `FillCommercialDataModal.tsx`
- Add state for `packingType`, `packingTypeFile`, and `qtyPerMasterInner`
- Add dedicated file upload for packing type (separate from general attachments)
- Update `hasManualData` validation: now requires 6 fields (4 existing + packing type with file + qty per master/inner)
- Include new fields in `commercialData` object sent to database and task metadata

#### 2. `CommercialDataSection.tsx`
- Add props for `packingType`, `packingTypeFileUrl`, and `qtyPerMasterInner`
- Expand grid to display new fields
- Show clickable link/thumbnail for packing type file
- Update `isComplete` logic to include new fields

#### 3. `CommercialReviewModal.tsx`
- Display new fields in the submitted data summary
- Show packing type file as downloadable link

#### 4. `CommercialHistoryTimeline.tsx`
- Update `finalData` interface to include new fields
- Display new fields in negotiation history cards

#### 5. `ItemDetailDrawer.tsx`
- Pass new fields to `CommercialDataSection` component

#### 6. `ActionsPanel.tsx`
- Add inputs for packing type (text + file upload) and qty per master/inner
- Update `canSubmitCommercial` validation

### Files to Modify
1. **Database migration** (new file)
2. `src/components/development/FillCommercialDataModal.tsx`
3. `src/components/development/CommercialDataSection.tsx`
4. `src/components/development/CommercialReviewModal.tsx`
5. `src/components/development/CommercialHistoryTimeline.tsx`
6. `src/components/development/ItemDetailDrawer.tsx`
7. `src/components/development/ActionsPanel.tsx`

### Validation Logic
For manual submission, ALL 6 fields are required:
- FOB Price, MOQ, Qty/Container, Container Type (existing)
- Packing Type (text) + Packing Type File (new)
- Qty per Master/Inner (new)

Alternative: Upload document only (existing behavior preserved)

