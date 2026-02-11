

## Rename Roles: Buyer → Comex, Trader → ARC

### What Changes
All display labels for "Buyer" become "Comex" and "Trader" become "ARC" across the entire UI. The internal database enum values (`buyer`, `trader`) remain unchanged -- only the user-facing text is updated.

### Database Update
Update the `role_card_colors` table labels:
- `buyer` row: label "Buyer" → "Comex"
- `trader` row: label "Trader" → "ARC"

### Files to Update (display labels only)

**Central label sources:**
1. `src/hooks/useRoleColors.ts` -- DEFAULT_COLORS: `buyer.label` → "Comex", `trader.label` → "ARC"
2. `src/hooks/useCardWorkflow.ts` -- `getRoleLabel()`: `buyer` → "Comex Team", `trader` → "ARC"
3. `src/hooks/useUserRole.ts` -- comments only (variable names like `isBuyer`/`isTrader` stay as-is since they reference the enum)

**User management:**
4. `src/pages/Users.tsx` -- `roleConfig`: buyer label → "Comex", trader label → "ARC"
5. `src/components/users/CreateUserModal.tsx` -- ROLES array: buyer label/description → "Comex", trader label/description → "ARC"
6. `src/components/users/EditUserRoleModal.tsx` -- ROLES array: same changes

**Development board:**
7. `src/components/development/DepartmentSection.tsx` -- ROLE_LABELS: buyer → "Comex", trader → "ARC"
8. `src/components/development/ThreadCard.tsx` -- ROLE_LABELS: same
9. `src/components/development/InlineReplyBox.tsx` -- ROLE_LABELS: same
10. `src/components/development/TaskCard.tsx` -- ROLE_LABELS: same
11. `src/components/development/ResponsibilityBadge.tsx` -- color class comments (cosmetic)
12. `src/components/development/ThreadAssignmentSelect.tsx` -- ROLES array: buyer → "Comex", trader → "ARC"
13. `src/components/development/RequestSampleModal.tsx` -- ROLES array: trader label → "ARC (Team)", buyer label → "Comex (Team)"
14. `src/components/development/RequestCommercialDataModal.tsx` -- any role labels

**Mentions:**
15. `src/components/notifications/MentionInput.tsx` -- TEAMS: "Buyer Team" → "Comex Team", "Trader Team" → "ARC Team", subtitles updated

**Dashboard:**
16. `src/pages/Dashboard.tsx` -- ROLE_LABELS: buyer name → "Comex", trader name → "ARC"

**Development page:**
17. `src/pages/Development.tsx` -- filter SelectItems and DepartmentSection title: "Buyer" → "Comex", "Trader" → "ARC"

**Purchase Orders:**
18. `src/pages/PurchaseOrders.tsx` -- STATUS_CONFIG: "Awaiting Trader" → "Awaiting ARC", card title same
19. `src/pages/PurchaseOrderDetails.tsx` -- STATUS_CONFIG: "Aguard. Trader" → "Aguard. ARC"
20. `src/pages/Dashboard.tsx` -- PO_PIPELINE_STAGES: "Awaiting Trader" → "Awaiting ARC"

**Order components:**
21. `src/components/orders/CounterProposalForm.tsx` -- "Valor atual do trader" → "Valor atual do ARC", "Enviar ao Trader" → "Enviar ao ARC"
22. `src/components/orders/TraderApprovalPanel.tsx` -- any visible "Trader" text in UI
23. `src/components/orders/TraderHeaderApprovals.tsx` -- any visible "Trader" text in UI

**Sidebar:**
24. `src/components/layout/AppSidebar.tsx` -- SidebarGroupLabel "Trader" → "ARC"

**New Products:**
25. `src/pages/NewProducts.tsx` -- `responsibleRole="Buyer"` → `responsibleRole="Comex"`

**Other:**
26. `src/components/development/AddTrackingModal.tsx` -- toast text "awaiting buyer" → "awaiting comex"
27. `src/components/development/FillCommercialDataModal.tsx` -- metadata comments
28. `src/hooks/usePendingActionNotifications.ts` -- comment/team label (functional: `arc` stays)

### What Stays the Same
- Database enum values: `buyer` and `trader` remain unchanged
- Variable names like `isBuyer`, `isTrader`, `isOnlyTrader`, `canApproveAsTrader`
- Database column values (`created_by_role`, `assigned_to_role`, `current_assignee_role`)
- RLS policies and database functions
- File names (e.g., `TraderApprovalPanel.tsx`, `TraderHeaderApprovals.tsx`)

