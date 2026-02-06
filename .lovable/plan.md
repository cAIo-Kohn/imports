

## Add New Products Pending Tasks to Dashboard

### Overview
Add a new section to the Dashboard showing pending New Products workflow tasks for the user's team. This section will only appear if the team has assigned tasks in the workflow.

### Team Assignment Mapping
Based on the New Products workflow:

| Step | Task | Responsible Role |
|------|------|-----------------|
| Step 1 | Pesquisa de Mercado (Market Research) | Marketing |
| Step 1 | Certificações, Marcas e Patentes (Trademarks/Patents) | Quality |
| Step 1 | Pesquisa Aduaneira (Customs Research) | Buyer |
| Step 2 | Cadastrar Código (Code Registration) | Quality |
| Step 3 | Ready for Order | Buyer |

**Note:** Trader team has NO pending tasks in this workflow, so they will see nothing in this section.

### Visual Layout

```text
┌──────────────────────────────────────────────────────────────────┐
│  Hello Caio!                                                     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🛒 Your Team's Pending Cards (Buyer)              [12]   │  │
│  │  ... existing cards section ...                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  📦 New Products Workflow                           [5]   │  │
│  │                                                            │  │
│  │  ┌─ Step 1: Pesquisa Aduaneira ──────────────────────────┐│  │
│  │  │  [Mini Card 1] [Mini Card 2]                          ││  │
│  │  └───────────────────────────────────────────────────────┘│  │
│  │                                                            │  │
│  │  ┌─ Step 3: Ready for Order ─────────────────────────────┐│  │
│  │  │  [Mini Card 3] [Mini Card 4] [Mini Card 5]            ││  │
│  │  └───────────────────────────────────────────────────────┘│  │
│  │                                                            │  │
│  │  (Empty: No pending tasks for Trader)                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  💡 View all in New Products tab                                │
└──────────────────────────────────────────────────────────────────┘
```

### Technical Approach

#### 1. Fetch New Products Data
Reuse the existing `useNewProductsData()` hook which already returns:
- `eligible` - Products ready to start workflow
- `step1` - Products in research phase
- `step2` - Products in code registration
- `step3` - Products ready for order
- `approvals` - All Step 1 approval records

#### 2. Filter Pending Tasks for User's Department

**For Step 1 (Parallel Research):**
```typescript
// Map department to approval type
const departmentApprovalType: Record<string, ApprovalType> = {
  marketing: 'market_research',
  quality: 'trademark_patent',
  buyer: 'customs_research',
};

// Get pending approvals for user's department
const myApprovalType = departmentApprovalType[userDepartment];
const pendingStep1 = step1.filter(item => {
  const approval = approvals.find(a => a.card_id === item.id && a.approval_type === myApprovalType);
  return approval?.status === 'pending';
});
```

**For Step 2 (Quality only):**
```typescript
const pendingStep2 = userDepartment === 'quality' ? step2 : [];
```

**For Step 3 (Buyer only):**
```typescript
const pendingStep3 = userDepartment === 'buyer' ? step3 : [];
```

**For Trader:**
All three arrays will be empty - section won't display.

#### 3. UI Component Structure
- Add new section below "Pending Cards" section
- Section only renders if `totalPendingNewProducts > 0`
- Group items by step with labeled subsections
- Use mini-card style similar to `Step1ResearchSection`
- Click opens `ResearchApprovalDrawer` for Step 1 items
- Click opens `ItemDetailDrawer` for Step 2/3 items

#### 4. Drawer Integration
- For Step 1 items: Open `ResearchApprovalDrawer` with the correct approval type
- For Step 2/3 items: Open `ItemDetailDrawer` as currently done

### Data Flow
1. Add `useNewProductsData()` hook call in Dashboard
2. Compute pending items per step based on `userDepartment`
3. Calculate total count for section header
4. Render subsections only if they have items
5. Handle click to open appropriate drawer

### Conditional Visibility
- **Buyer**: Step 1 (Pesquisa Aduaneira) + Step 3 (Ready for Order)
- **Quality**: Step 1 (Certificações) + Step 2 (Cadastrar Código)
- **Marketing**: Step 1 (Pesquisa de Mercado) only
- **Trader**: Section hidden (no tasks)
- **Admin (defaults to Buyer)**: Same as Buyer

### Files to Modify

**1. `src/pages/Dashboard.tsx`**
- Import `useNewProductsData`, `APPROVAL_CONFIG`, `ApprovalType`, `NewProductApproval`
- Import `ResearchApprovalDrawer` component
- Add state for research drawer (`researchDrawerState`)
- Call `useNewProductsData()` hook
- Compute filtered pending items for each step based on userDepartment
- Add new section UI with subsections for Step 1/2/3
- Add `ResearchApprovalDrawer` component at bottom
- Add click handler to open research drawer for Step 1 items

### Empty State
When a team has no pending New Products tasks:
- For Trader: Don't show section at all
- For other teams with 0 items: Don't show section

