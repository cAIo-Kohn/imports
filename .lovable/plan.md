

## Plano: Checkboxes de Aprovação por Item + Aprovação Global no Header

### Problema Identificado

Atualmente:
1. O `TraderHeaderApprovals` tem checkboxes para aprovar ETD, Preços e Quantidades **do pedido todo**
2. O `EditableOrderItemsTable` permite editar preço e quantidade, mas **não tem checkboxes de aprovação por item**

O usuário quer poder conferir item por item, marcando checkbox de preço e quantidade enquanto vai revisando, facilitando o processo de conferência.

---

### Solução Proposta

#### Parte 1: Adicionar Checkboxes de Aprovação por Item

No `EditableOrderItemsTable.tsx`, adicionar duas novas colunas com checkboxes:
- **Preço OK**: Checkbox para aprovar o preço do item
- **Qtd OK**: Checkbox para aprovar a quantidade do item

Esses checkboxes funcionarão como **auxiliares visuais** para o trader conforme vai conferindo cada produto.

#### Parte 2: Lógica de Aprovação Automática no Header

O header mostrará:
- Contagem de itens aprovados: "Preços: 5/10 OK" e "Qtd: 5/10 OK"
- Quando **todos os itens** tiverem preço e quantidade marcados, os checkboxes do header serão automaticamente habilitados para aprovação final

#### Parte 3: Armazenamento das Aprovações por Item

Adicionar duas colunas na tabela `purchase_order_items`:
- `trader_price_approved: boolean`
- `trader_quantity_approved: boolean`

---

### Alterações Necessárias

#### 1. Migração SQL para novos campos

```sql
ALTER TABLE public.purchase_order_items 
ADD COLUMN IF NOT EXISTS trader_price_approved boolean DEFAULT false;

ALTER TABLE public.purchase_order_items 
ADD COLUMN IF NOT EXISTS trader_quantity_approved boolean DEFAULT false;
```

#### 2. Modificar `EditableOrderItemsTable.tsx`

**Adicionar colunas de checkbox:**

| Coluna Nova | Posição | Descrição |
|-------------|---------|-----------|
| `☐ $` | Após FOB USD | Checkbox para aprovar preço |
| `☐ Qty` | Após Q'TY | Checkbox para aprovar quantidade |

**Lógica por item:**
```typescript
// Estado local para aprovações
const [itemApprovals, setItemApprovals] = useState<Record<string, {priceOk: boolean, qtyOk: boolean}>>({});

// Ao marcar checkbox
const handleItemApproval = async (itemId: string, field: 'price' | 'quantity', checked: boolean) => {
  await supabase
    .from('purchase_order_items')
    .update({ [`trader_${field}_approved`]: checked })
    .eq('id', itemId);
};
```

**Layout da nova linha:**
```
| # | PIC | CODE | ... | Q'TY | ☐ | FOB | ☐ | AMOUNT | AÇÃO |
                           qty    $
```

#### 3. Modificar `TraderHeaderApprovals.tsx`

**Adicionar props para contagem:**
```typescript
interface TraderHeaderApprovalsProps {
  order: PurchaseOrder;
  totalValue: number;
  totalQuantity: number;
  itemsCount: number;
  itemsWithPriceApproved: number;  // novo
  itemsWithQtyApproved: number;    // novo
  onOrderUpdated: () => void;
}
```

**Exibir progresso:**
```
☐ ETD: 15/03/2026 [✓]    ☐ Preços: $45,230 (8/10 OK)    ☐ Qtd: 5000 pcs (8/10 OK)
```

#### 4. Modificar `PurchaseOrderDetails.tsx`

Calcular contagens de aprovações por item e passar para os componentes.

---

### Fluxo do Usuário

1. Trader abre pedido em `pending_trader_review`
2. Vê a tabela de itens com checkboxes de preço e quantidade
3. Confere cada item:
   - Edita preço/quantidade se necessário
   - Marca ☐ preço OK e ☐ quantidade OK
4. No header, vê progresso: "Preços: 8/10 OK"
5. Quando todos os itens estão OK, pode marcar aprovação final no header
6. Clica "Confirmar Pedido"

---

### Visualização do Layout

**Tabela com checkboxes:**
```
┌────┬─────┬────────┬───────┬─────┬────────┬─────┬──────────┬───────┐
│ #  │ PIC │ CODE   │ Q'TY  │ ☐   │ FOB    │ ☐   │ AMOUNT   │ AÇÃO  │
├────┼─────┼────────┼───────┼─────┼────────┼─────┼──────────┼───────┤
│ 1  │ 📷  │ 001480 │ 1,000 │ ☑   │ $0.45  │ ☑   │ $450.00  │ ✏️    │
│ 2  │ 📷  │ 001488 │ 500   │ ☐   │ $0.32  │ ☑   │ $160.00  │ ✏️    │
└────┴─────┴────────┴───────┴─────┴────────┴─────┴──────────┴───────┘
```

**Header com progresso:**
```
┌──────────────────────────────────────────────────────────────────────┐
│ ☐ ETD: 15/03/2026 ✓   ☐ Preços: $610 (1/2)   ☐ Qtd: 1500 (2/2)     │
│                                               [Confirmar Pedido]     │
└──────────────────────────────────────────────────────────────────────┘
```

---

### Resumo das Mudanças

| Arquivo | Alteração |
|---------|-----------|
| **SQL Migration** | Adicionar `trader_price_approved` e `trader_quantity_approved` em `purchase_order_items` |
| `EditableOrderItemsTable.tsx` | Adicionar 2 colunas de checkbox (preço OK, qtd OK) |
| `TraderHeaderApprovals.tsx` | Mostrar progresso de aprovações por item |
| `PurchaseOrderDetails.tsx` | Calcular contagens e passar para componentes |

---

### Detalhes Técnicos

**Estrutura do EditableOrderItemsTable atualizada:**
```typescript
// Carregar aprovações dos itens
const { data: itemsWithApprovals } = useQuery({
  queryKey: ['order-items-approvals', orderId],
  queryFn: async () => {
    const { data } = await supabase
      .from('purchase_order_items')
      .select('id, trader_price_approved, trader_quantity_approved')
      .eq('purchase_order_id', orderId);
    return data;
  }
});

// Callback para aprovar item
const approveItemMutation = useMutation({
  mutationFn: async ({ itemId, field, value }) => {
    await supabase
      .from('purchase_order_items')
      .update({ [`trader_${field}_approved`]: value })
      .eq('id', itemId);
  }
});
```

**Interface de props atualizada:**
```typescript
interface EditableOrderItemsTableProps {
  orderId: string;
  items: OrderItem[];
  showImages?: boolean;
  onTotalsChanged: () => void;
  onApprovalsChanged?: (priceCount: number, qtyCount: number) => void;  // novo
}
```

