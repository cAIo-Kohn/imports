
## Plano: Implementar Fluxo de Aprovação de Pedidos para Fornecedores Chineses

### Visão Geral do Fluxo

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Equipe Brasil  │────>│  Trader China   │────>│  Equipe Brasil  │────>│    CONFIRMADO   │
│  Cria Pedido    │     │  Revisa/Edita   │     │  Aprova Mudanças│     │                 │
│  status: draft  │     │  Aprova 3 itens │     │  (se necessário)│     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Fluxo Detalhado:**
1. Equipe Brasil cria pedido (status: `draft`)
2. Se fornecedor é chinês → status muda para `pending_trader_review`
3. Trader na China:
   - Pode editar qualquer campo (preço, descrição, cubagem, etc.)
   - Deve aprovar 3 itens: ETD, Preços Totais, Quantidades Totais
   - Alterações são registradas em histórico
4. Após 3 aprovações:
   - Se houve mudança em ETD/Preço/Quantidade → status: `pending_buyer_approval`
   - Se não houve mudança crítica → status: `confirmed`
5. Equipe Brasil revisa mudanças e aprova → status: `confirmed`

---

### Fase 1: Modificações no Banco de Dados

#### 1.1 Nova Role: `trader`

Adicionar nova role ao enum `app_role`:

```sql
ALTER TYPE public.app_role ADD VALUE 'trader';
```

#### 1.2 Novos Campos na Tabela `purchase_orders`

```sql
ALTER TABLE public.purchase_orders 
  ADD COLUMN trader_etd_approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN trader_etd_approved_at TIMESTAMPTZ,
  ADD COLUMN trader_etd_approved_by UUID REFERENCES auth.users(id),
  
  ADD COLUMN trader_prices_approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN trader_prices_approved_at TIMESTAMPTZ,
  ADD COLUMN trader_prices_approved_by UUID REFERENCES auth.users(id),
  
  ADD COLUMN trader_quantities_approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN trader_quantities_approved_at TIMESTAMPTZ,
  ADD COLUMN trader_quantities_approved_by UUID REFERENCES auth.users(id),
  
  ADD COLUMN requires_buyer_approval BOOLEAN DEFAULT FALSE,
  ADD COLUMN buyer_approval_notes TEXT;
```

#### 1.3 Nova Tabela: `purchase_order_change_history`

Registrar todas as alterações feitas no pedido:

```sql
CREATE TABLE public.purchase_order_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  purchase_order_item_id UUID REFERENCES public.purchase_order_items(id) ON DELETE CASCADE,
  
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  change_type TEXT NOT NULL, -- 'order_field', 'item_field', 'approval'
  field_name TEXT NOT NULL,  -- 'etd', 'price', 'quantity', 'description', etc.
  old_value TEXT,
  new_value TEXT,
  
  is_critical BOOLEAN DEFAULT FALSE, -- TRUE para ETD, preço, quantidade
  requires_approval BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ
);
```

#### 1.4 Novos Status do Pedido

Atualizar os status possíveis:

| Status | Descrição |
|--------|-----------|
| `draft` | Rascunho (editável pela equipe Brasil) |
| `pending_trader_review` | Aguardando revisão do trader na China |
| `pending_buyer_approval` | Trader aprovou, mas há mudanças que precisam de aprovação |
| `confirmed` | Pedido confirmado por todas as partes |
| `shipped` | Embarcado |
| `received` | Recebido |
| `cancelled` | Cancelado |

#### 1.5 RLS Policies para Trader

```sql
-- Traders podem gerenciar pedidos de fornecedores chineses
CREATE POLICY "Traders can manage chinese supplier orders"
  ON public.purchase_orders FOR ALL
  USING (
    has_role(auth.uid(), 'trader'::app_role) 
    AND EXISTS (
      SELECT 1 FROM suppliers s 
      WHERE s.id = purchase_orders.supplier_id 
      AND LOWER(s.country) = 'china'
    )
  );

-- Políticas similares para purchase_order_items e change_history
```

---

### Fase 2: Lógica de Negócio

#### 2.1 Identificação de Fornecedor Chinês

Verificar se `suppliers.country` é "China" (case-insensitive):

```typescript
const isChineseSupplier = supplier?.country?.toLowerCase() === 'china';
```

#### 2.2 Fluxo de Criação de Pedido

Modificar `CreatePurchaseOrderModal.tsx`:

```typescript
// Após criar pedido
if (isChineseSupplier) {
  // Atualizar status para pending_trader_review
  await supabase
    .from('purchase_orders')
    .update({ status: 'pending_trader_review' })
    .eq('id', newOrderId);
}
```

#### 2.3 Registro de Alterações

Criar função para registrar mudanças:

```typescript
async function logOrderChange({
  orderId,
  itemId,
  changedBy,
  fieldName,
  oldValue,
  newValue,
  isCritical
}: ChangeLogParams) {
  await supabase.from('purchase_order_change_history').insert({
    purchase_order_id: orderId,
    purchase_order_item_id: itemId,
    changed_by: changedBy,
    field_name: fieldName,
    old_value: oldValue?.toString(),
    new_value: newValue?.toString(),
    is_critical: isCritical,
    requires_approval: isCritical
  });
}
```

#### 2.4 Campos Críticos vs. Informativos

| Tipo | Campos | Requer Aprovação |
|------|--------|------------------|
| **Crítico** | ETD, preço unitário, quantidade | SIM |
| **Informativo** | Descrição, cubagem, dimensões, NCM, etc. | NÃO (apenas registro) |

---

### Fase 3: Interface do Trader

#### 3.1 Painel de Aprovação do Trader

Criar componente `TraderApprovalPanel.tsx`:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ APROVAÇÃO DO PEDIDO                                                 │
├─────────────────────────────────────────────────────────────────────┤
│ □ ETD: 30/05/2025                              [✓ Aprovar ETD]     │
│ □ Preço Total: $45,230.00                      [✓ Aprovar Preços]  │
│ □ Quantidade Total: 15,000 pcs                 [✓ Aprovar Qtd]     │
├─────────────────────────────────────────────────────────────────────┤
│ [Solicitar Mudança de ETD]  [Enviar para Aprovação Final]          │
└─────────────────────────────────────────────────────────────────────┘
```

#### 3.2 Edição Inline com Registro

Permitir edição de todos os campos com registro automático:

```typescript
const handleFieldUpdate = async (field: string, newValue: any) => {
  const oldValue = order[field];
  
  // Atualizar valor
  await supabase.from('purchase_orders').update({ [field]: newValue }).eq('id', order.id);
  
  // Registrar alteração
  await logOrderChange({
    orderId: order.id,
    fieldName: field,
    oldValue,
    newValue,
    isCritical: ['etd', 'total_value_usd'].includes(field)
  });
};
```

#### 3.3 Solicitação de Mudança

Quando trader precisa mudar ETD (ex: de 30/05 para 30/06):

```typescript
const requestEtdChange = async (newEtd: string, reason: string) => {
  await supabase.from('purchase_orders').update({
    etd: newEtd,
    requires_buyer_approval: true,
    buyer_approval_notes: `ETD alterado para ${newEtd}. Motivo: ${reason}`
  }).eq('id', order.id);
  
  // Registrar no histórico
  await logOrderChange({
    orderId: order.id,
    fieldName: 'etd',
    oldValue: order.etd,
    newValue: newEtd,
    isCritical: true
  });
};
```

---

### Fase 4: Interface da Equipe Brasil

#### 4.1 Indicador de Mudanças no Pedido

Na lista de pedidos, mostrar badge de mudanças:

```typescript
{order.status === 'pending_buyer_approval' && (
  <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
    <AlertTriangle className="h-3 w-3 mr-1" />
    Mudanças para Aprovar
  </Badge>
)}
```

#### 4.2 Resumo de Alterações

Componente `OrderChangeSummary.tsx`:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ ALTERAÇÕES REALIZADAS PELO TRADER                                   │
├─────────────────────────────────────────────────────────────────────┤
│ ⚠️ CRÍTICAS (requerem aprovação):                                   │
│   • ETD: 30/05/2025 → 30/06/2025 (Motivo: Fábrica em manutenção)   │
│                                                     [✓] [✗]         │
├─────────────────────────────────────────────────────────────────────┤
│ ℹ️ INFORMATIVAS:                                                    │
│   • Descrição item #3: "Pool 3m" → "Swimming Pool 3000mm Blue"     │
│   • Cubagem item #5: 0.045 → 0.048 m³                              │
└─────────────────────────────────────────────────────────────────────┘
```

#### 4.3 Aprovação de Mudanças

```typescript
const approveCriticalChange = async (changeId: string) => {
  await supabase.from('purchase_order_change_history').update({
    approved_by: user.id,
    approved_at: new Date().toISOString()
  }).eq('id', changeId);
  
  // Verificar se todas as mudanças críticas foram aprovadas
  const pendingChanges = await checkPendingCriticalChanges(order.id);
  if (pendingChanges === 0) {
    await supabase.from('purchase_orders').update({
      status: 'confirmed',
      requires_buyer_approval: false
    }).eq('id', order.id);
  }
};
```

---

### Fase 5: Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| **Migração SQL** | Criar | Novos campos, tabela de histórico, role trader |
| `src/components/orders/TraderApprovalPanel.tsx` | **Criar** | Painel de aprovação do trader |
| `src/components/orders/OrderChangeSummary.tsx` | **Criar** | Resumo de alterações |
| `src/components/orders/ChangeApprovalDialog.tsx` | **Criar** | Dialog para aprovar/rejeitar mudanças |
| `src/hooks/useOrderChanges.ts` | **Criar** | Hook para gerenciar histórico de alterações |
| `src/hooks/useUserRole.ts` | **Criar** | Hook para verificar role do usuário |
| `src/pages/PurchaseOrderDetails.tsx` | Modificar | Integrar painéis de aprovação |
| `src/pages/PurchaseOrders.tsx` | Modificar | Mostrar badges de status e filtros |
| `src/components/planning/CreatePurchaseOrderModal.tsx` | Modificar | Lógica de status inicial |

---

### Fase 6: Visualização de Status

#### Novos Status na UI

```typescript
const STATUS_CONFIG = {
  draft: { label: 'Rascunho', variant: 'secondary', icon: FileEdit },
  pending_trader_review: { label: 'Aguard. Trader', variant: 'outline', icon: Clock },
  pending_buyer_approval: { label: 'Mudanças Pendentes', variant: 'warning', icon: AlertTriangle },
  confirmed: { label: 'Confirmado', variant: 'default', icon: CheckCircle },
  shipped: { label: 'Embarcado', variant: 'outline', icon: Truck },
  received: { label: 'Recebido', variant: 'default', icon: Package },
  cancelled: { label: 'Cancelado', variant: 'destructive', icon: XCircle },
};
```

---

### Considerações de Segurança

1. **Role-based Access**: Traders só podem editar pedidos de fornecedores chineses
2. **Audit Trail**: Todas as alterações são registradas com timestamp e user_id
3. **RLS Policies**: Garantir que traders não acessem pedidos de outros países
4. **Validação Server-side**: Usar database functions para validar aprovações

---

### Priorização de Implementação

**Fase 1 - Fundação (Essencial):**
1. Migração SQL (nova role, campos, tabela histórico)
2. Hook `useUserRole` para verificar role do usuário
3. Atualizar lógica de criação de pedido

**Fase 2 - Interface do Trader:**
4. `TraderApprovalPanel` com os 3 checkboxes de aprovação
5. Edição inline com registro de alterações
6. Solicitação de mudança de ETD

**Fase 3 - Interface da Equipe Brasil:**
7. `OrderChangeSummary` com resumo de alterações
8. Aprovação de mudanças críticas
9. Filtros e badges na lista de pedidos

**Fase 4 - Refinamentos:**
10. Notificações (opcional)
11. Histórico completo de alterações
12. Relatórios

