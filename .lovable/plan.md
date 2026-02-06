

## Create New Product Workflow in "New Products" Tab

### Overview
Add a "Create New Product" button to eligible products that initiates a multi-step workflow. The workflow has:
- **Step 1 (Parallel)**: Three departments work simultaneously
  - Pesquisa de Mercado (Marketing)
  - Marcas e Patentes (Quality) 
  - Pesquisa Aduaneira (Buyer)
- **Step 2 (Sequential)**: Cadastrar Codigo (Quality) - only after all Step 1s complete
- **Step 3 (Sequential)**: Ready for Order (Buyer) - after Step 2 completes

### Visual Flow Design

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  NEW PRODUCTS                                                                │
│  Products ready for catalog integration                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─ ELIGIBLE PRODUCTS (2) ──────────────────────────────────────────────┐   │
│  │  [Card] [Create New Product →]  [Card] [Create New Product →]         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                               │
│  ┌─ STEP 1: RESEARCH & COMPLIANCE ──────────────────────────────────────┐   │
│  │                                                                       │   │
│  │   📢 Pesquisa de Mercado     ✅ Marcas e Patentes    🛒 Pesquisa     │   │
│  │      (Marketing)                 (Quality)              Aduaneira    │   │
│  │                                                          (Buyer)     │   │
│  │   ┌──────────┐              ┌──────────┐            ┌──────────┐    │   │
│  │   │ Product A│              │ Product A│            │ Product A│    │   │
│  │   │ ⏳ Pending│              │ ✓ Done   │            │ ⏳ Pending│    │   │
│  │   └──────────┘              └──────────┘            └──────────┘    │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                              ↓ (All 3 approved)                              │
│  ┌─ STEP 2: CADASTRAR CODIGO (Quality) ─────────────────────────────────┐   │
│  │   Products awaiting code registration                                 │   │
│  │   [Card] [Card]                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                               │
│  ┌─ STEP 3: READY FOR ORDER (Buyer) ────────────────────────────────────┐   │
│  │   Products ready to be added to purchase orders                       │   │
│  │   [Card] [Card]                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Model Changes

Add a new field to track which step in the new product flow an item is in:

**New column on `development_items`**:
- `new_product_flow_status`: enum with values:
  - `null` - Not in new product flow yet (eligible but not started)
  - `step1_research` - In Step 1 parallel phase
  - `step2_code_registration` - In Step 2
  - `step3_ready_for_order` - In Step 3
  - `completed` - Flow complete

**New table `new_product_approvals`** to track the 3 parallel approvals in Step 1:
```sql
CREATE TABLE new_product_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES development_items(id),
  approval_type TEXT NOT NULL, -- 'market_research', 'trademark_patent', 'customs_research'
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  assigned_role TEXT NOT NULL, -- 'marketing', 'quality', 'buyer'
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Technical Implementation

#### 1. Database Migration
Create `new_product_approvals` table and add `new_product_flow_status` column to `development_items`.

#### 2. Update `src/pages/NewProducts.tsx`
Restructure the page to show:
1. **Eligible Products section** - cards with approved samples but `new_product_flow_status IS NULL`
2. **Step 1: Research & Compliance** - cards with `new_product_flow_status = 'step1_research'`
   - Show 3 sub-columns for each department
   - Display approval status badges per department
3. **Step 2: Cadastrar Codigo** - cards with `new_product_flow_status = 'step2_code_registration'`
4. **Step 3: Ready for Order** - cards with `new_product_flow_status = 'step3_ready_for_order'`

#### 3. Add "Create New Product" button
- Appears on each eligible product card
- On click:
  - Sets `new_product_flow_status = 'step1_research'`
  - Creates 3 approval records in `new_product_approvals` (one per department)
  - Logs activity to timeline

#### 4. Create new hook `useNewProductFlow.ts`
- Functions to start flow, approve steps, check completion
- Auto-advance logic: when all 3 Step 1 approvals complete, move to Step 2

### Files to Create/Modify

1. **Create**: Database migration for `new_product_approvals` table + `new_product_flow_status` column
2. **Modify**: `src/pages/NewProducts.tsx` - Add sections and workflow UI
3. **Create**: `src/hooks/useNewProductFlow.ts` - Flow management logic
4. **Create**: `src/components/new-products/EligibleProductCard.tsx` - Card with "Create New Product" button
5. **Create**: `src/components/new-products/Step1ResearchSection.tsx` - 3-column parallel approval view
6. **Create**: `src/components/new-products/WorkflowStepSection.tsx` - Reusable section component

### UI Components Structure

```text
NewProducts.tsx
├── EligibleProductsSection
│   └── EligibleProductCard (with "Create New Product" button)
├── Step1ResearchSection
│   ├── MarketResearchColumn (Marketing)
│   ├── TrademarkPatentColumn (Quality)  
│   └── CustomsResearchColumn (Buyer)
├── Step2CodeRegistrationSection
│   └── ProductFlowCard
└── Step3ReadyForOrderSection
    └── ProductFlowCard
```

