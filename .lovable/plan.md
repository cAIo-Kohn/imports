
## Plano: Edição de Itens pelo Trader + Checkboxes de Aprovação no Header

### Problema Identificado

1. **Itens não editáveis**: O componente `PurchaseOrderInvoice.tsx` é apenas para visualização (read-only). Não existe funcionalidade de edição inline dos itens do pedido.

2. **Checkboxes de aprovação**: O painel `TraderApprovalPanel` está separado do header do pedido. O usuário quer os checkboxes integrados no header principal.

---

### Solução Proposta

#### Parte 1: Criar Tabela Editável para Traders

Criar um novo componente `EditableOrderItemsTable.tsx` que:
- Permite edição inline de preço, quantidade e outros campos
- Registra todas as alterações via `useOrderChanges.logChange()`
- Marca alterações críticas (preço, quantidade) automaticamente
- Salva as alterações no banco de dados

**Campos editáveis pelo trader:**
| Campo | Tipo | Crítico? |
|-------|------|----------|
| `unit_price_usd` | number | Sim |
| `quantity` | number | Sim |
| Descrição do produto | text | Não |
| Especificações técnicas | text | Não |

#### Parte 2: Integrar Aprovações no Header

Mover os 3 checkboxes de aprovação para o header do pedido:
- Checkbox ETD (com botão para editar ETD)
- Checkbox Preços
- Checkbox Quantidades

**Layout proposto:**
```
┌─────────────────────────────────────────────────────────────┐
│  PO-2026-0009                        [Aguard. Trader]       │
│  JILONG GROUP                                               │
├─────────────────────────────────────────────────────────────┤
│  ☐ ETD: 15/03/2026 [Editar]  ☐ Preços: $45,230  ☐ Qtd: 5000│
│  [Aprovar Selecionados]           [Confirmar Pedido]        │
└─────────────────────────────────────────────────────────────┘
```

---

### Arquivos a Modificar

#### 1. Criar `src/components/orders/EditableOrderItemsTable.tsx`
Tabela com edição inline para traders:
- Input para preço unitário
- Input para quantidade
- Botão salvar por linha
- Logging automático de alterações

#### 2. Criar `src/components/orders/TraderHeaderApprovals.tsx`
Componente compacto para o header:
- 3 checkboxes de aprovação inline
- Campo de edição de ETD (expandível)
- Botão "Confirmar Pedido"

#### 3. Modificar `src/pages/PurchaseOrderDetails.tsx`
- Substituir `TraderApprovalPanel` por `TraderHeaderApprovals` no header
- Adicionar `EditableOrderItemsTable` quando trader estiver revisando
- Manter `PurchaseOrderInvoice` para visualização de outros usuários

---

### Lógica de Salvamento

```typescript
// Ao editar um item
const handleItemUpdate = async (itemId: string, field: string, oldValue: any, newValue: any) => {
  // 1. Atualizar no banco
  await supabase
    .from('purchase_order_items')
    .update({ [field]: newValue })
    .eq('id', itemId);
  
  // 2. Registrar alteração
  await logChange({
    orderId: order.id,
    itemId: itemId,
    changeType: 'item_field',
    fieldName: field,
    oldValue: String(oldValue),
    newValue: String(newValue),
    isCritical: ['unit_price_usd', 'quantity'].includes(field)
  });
  
  // 3. Recalcular total do pedido
  await recalculateOrderTotal();
};
```

---

### RLS - Já Configurada

A política RLS para traders já permite atualizações:
```sql
-- purchase_order_items
Policy: "Traders can update items for chinese supplier orders"
Command: UPDATE
Using: has_role('trader') AND supplier.country = 'china'
```

---

### Fluxo Completo

1. Trader abre pedido `pending_trader_review`
2. Vê checkboxes de aprovação no header
3. Pode editar ETD diretamente (clicando no campo)
4. Pode editar preço/quantidade de cada item na tabela
5. Cada alteração é salva e logada automaticamente
6. Marca os 3 checkboxes de aprovação
7. Clica "Confirmar Pedido"
8. Se houve alteração crítica -> `pending_buyer_approval`
9. Se não houve -> `confirmed`

---

### Resumo das Entregas

| Componente | Função |
|------------|--------|
| `TraderHeaderApprovals` | Checkboxes + ETD editável no header |
| `EditableOrderItemsTable` | Tabela com edição inline |
| `PurchaseOrderDetails` | Integração dos novos componentes |

---

### Detalhes Técnicos

**Estrutura do EditableOrderItemsTable:**
```typescript
interface EditableItemRow {
  item: OrderItem;
  isEditing: boolean;
  editedValues: {
    unit_price_usd: number;
    quantity: number;
  };
  isSaving: boolean;
}

// Estados por linha para edição independente
const [editingItems, setEditingItems] = useState<Record<string, EditableItemRow>>({});
```

**Estrutura do TraderHeaderApprovals:**
```typescript
interface TraderHeaderApprovalsProps {
  order: PurchaseOrder;
  totalValue: number;
  totalQuantity: number;
  onOrderUpdated: () => void;
}

// Estado para edição inline do ETD
const [isEditingEtd, setIsEditingEtd] = useState(false);
const [editedEtd, setEditedEtd] = useState(order.etd || '');
```

**Atualização automática de total:**
```typescript
const updateOrderTotal = async () => {
  const { data: items } = await supabase
    .from('purchase_order_items')
    .select('quantity, unit_price_usd')
    .eq('purchase_order_id', orderId);
  
  const newTotal = items.reduce((sum, item) => 
    sum + (item.quantity * (item.unit_price_usd || 0)), 0);
  
  await supabase
    .from('purchase_orders')
    .update({ total_value_usd: newTotal })
    .eq('id', orderId);
};
```
