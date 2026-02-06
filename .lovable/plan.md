

## Add Customs Research Compliance Checklist

### Overview
Add a specific compliance checklist for the "Pesquisa Aduaneira" (customs_research) approval type with three questions:
1. **Possui LI/LPCO?** - Sim / Não (radio buttons)
2. **Qual a NCM?** - Text input limited to 8 digits
3. **Descrição Catálogo Produto** - Expandable textarea that grows as user types

### Visual Layout

```text
┌─────────────────────────────────────────────────────┐
│ 🛒 Pesquisa Aduaneira                               │
│    Buyer                            [View Card]     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [Chat Timeline with comments & uploads]            │
│                                                     │
├─────────────────────────────────────────────────────┤
│ [📎] Add research notes...               [Send]     │
├─────────────────────────────────────────────────────┤
│ ─────────────────────────────────────────────────── │
│                                                     │
│ 📋 Customs Compliance                               │
│                                                     │
│ Possui LI/LPCO?                                     │
│ ○ Sim   ○ Não                                       │
│                                                     │
│ Qual a NCM?                                         │
│ ┌──────────────────────┐                            │
│ │ 12345678             │  ← Max 8 digits only       │
│ └──────────────────────┘                            │
│                                                     │
│ Descrição Catálogo Produto                          │
│ ┌──────────────────────────────────────────────┐   │
│ │ Product description...                        │   │
│ │ (expands as you type)                         │   │
│ └──────────────────────────────────────────────┘   │
│                                                     │
│ 📤 Upload Research                                  │
│ [Upload Files]                                      │
│                                                     │
│ ┌─────────────┐ ┌─────────────┐                    │
│ │   Reject    │ │   Approve   │  ← Visible when    │
│ └─────────────┘ └─────────────┘    all fields      │
│                                    filled          │
└─────────────────────────────────────────────────────┘
```

### Technical Changes

**File: `src/components/new-products/ResearchApprovalDrawer.tsx`**

1. **Add state for customs checklist:**
   ```tsx
   // Customs research checklist state (for customs_research type only)
   const [hasLiLpco, setHasLiLpco] = useState<boolean | null>(null);
   const [ncmCode, setNcmCode] = useState('');
   const [productDescription, setProductDescription] = useState('');
   ```

2. **Add conditional rendering for customs_research type:**
   - Show customs-specific checklist when `approvalType === 'customs_research'`
   - NCM input: restrict to numeric characters only, max 8 characters
   - Product description: use textarea with auto-resize behavior

3. **Update validation logic:**
   ```tsx
   const isCustomsResearch = approvalType === 'customs_research';
   const customsChecklistComplete = isCustomsResearch
     ? hasLiLpco !== null && ncmCode.length === 8 && productDescription.trim().length > 0
     : true;
   ```

4. **Update canSubmitDecision:**
   ```tsx
   const canSubmitDecision = 
     isTrademarkPatent ? checklistComplete : 
     isCustomsResearch ? (customsChecklistComplete && hasResearchFiles) : 
     hasResearchFiles;
   ```

5. **Store customs checklist data in decision metadata:**
   - Include `has_li_lpco`, `ncm_code`, and `product_catalog_description` in notes and metadata

6. **Reset customs state on submit:**
   ```tsx
   setHasLiLpco(null);
   setNcmCode('');
   setProductDescription('');
   ```

### Validation Rules
- **NCM Code**: Exactly 8 numeric digits required
- **Product Description**: Non-empty required
- **LI/LPCO**: Must select Yes or No
- **Research Files**: Still required for customs research (like market research)

### Files to Modify

1. `src/components/new-products/ResearchApprovalDrawer.tsx` - Add customs checklist UI, state, and validation logic

