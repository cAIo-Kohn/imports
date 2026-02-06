
## Rename "Marcas e Patentes" and Add Certification Checkboxes

### Overview
1. Rename "Marcas e Patentes" → "Certificações, Marcas e Patentes" in the approval config
2. Modify the `ResearchApprovalDrawer` to show two Yes/No checkbox options for the `trademark_patent` approval type
3. Both checkboxes must be answered before the Approve/Reject buttons appear

### Visual Flow

```text
┌─────────────────────────────────────────────────────┐
│ ✅ Certificações, Marcas e Patentes                 │
│    Quality                           [View Card]    │
├─────────────────────────────────────────────────────┤
│ [Product Image] Product Title                       │
│                 ⏳ Pending                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [Chat Timeline with comments & uploads]            │
│                                                     │
├─────────────────────────────────────────────────────┤
│ [📎] Add research notes...               [Send]     │
├─────────────────────────────────────────────────────┤
│ ─────────────────────────────────────────────────── │
│                                                     │
│ 📋 Compliance Checklist                             │
│                                                     │
│ Certificações                                       │
│ ○ Sim   ○ Não                                      │
│                                                     │
│ Marcas e Patentes                                   │
│ ○ Sim   ○ Não                                      │
│                                                     │
│ 📤 Upload Research                                  │
│ [Upload Files]                                      │
│                                                     │
│ ┌─────────────┐ ┌─────────────┐                    │
│ │   Reject    │ │   Approve   │  ← Only visible    │
│ └─────────────┘ └─────────────┘    when both       │
│                                    checkboxes are   │
│                                    answered         │
└─────────────────────────────────────────────────────┘
```

### Technical Changes

#### 1. Update `src/hooks/useNewProductFlow.ts`
- Change the `labelPt` for `trademark_patent` from "Marcas e Patentes" to "Certificações, Marcas e Patentes"

#### 2. Update `src/components/new-products/ResearchApprovalDrawer.tsx`

**Add state for checkboxes:**
```tsx
const [certifications, setCertifications] = useState<boolean | null>(null);
const [trademarksPatents, setTrademarksPatents] = useState<boolean | null>(null);
```

**Add conditional logic for trademark_patent type:**
- Show a "Compliance Checklist" section with two radio button groups
- "Certificações" - Sim / Não
- "Marcas e Patentes" - Sim / Não
- Both must be answered (not null) to enable the Approve/Reject buttons
- Include checkbox answers in the decision metadata for audit trail

**Update validation logic:**
```tsx
// For trademark_patent, require both checkboxes to be answered
const canSubmitDecision = approvalType === 'trademark_patent'
  ? certifications !== null && trademarksPatents !== null
  : hasResearchFiles;
```

#### 3. Store Checklist Data
- Include `certifications_ok` and `trademarks_patents_ok` in the approval notes/metadata when submitting the decision
- This provides an audit trail of what was checked

### Files to Modify

1. `src/hooks/useNewProductFlow.ts` - Update label for trademark_patent
2. `src/components/new-products/ResearchApprovalDrawer.tsx` - Add checklist UI and validation logic

### UI Components Used
- `RadioGroup` from Radix UI (already in project) for Yes/No selection
- Existing `TimelineUploadButton` for file uploads
- Existing `MentionInput` for chat
