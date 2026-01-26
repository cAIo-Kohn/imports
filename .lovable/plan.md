

## Plano: Edição Completa pelo Trader + Visualização de Alterações para Comprador

### Problema Identificado

1. **Edição limitada**: O trader só pode editar preço e quantidade dos itens. Não consegue editar descrição técnica, NCM, cubagem, especificações do fornecedor, etc.

2. **Falta de destaque visual**: Quando o pedido volta para o comprador, ele vê uma lista de alterações no `OrderChangeSummary`, mas os campos alterados na tabela de itens não estão destacados visualmente.

3. **Sem tooltip**: Não há indicação inline de "antes/depois" nos campos que foram modificados.

---

### Solução Proposta

#### Parte 1: Expandir Edição Completa para Traders

Modificar `EditableOrderItemsTable.tsx` para permitir edição de **todos** os campos relevantes:

| Campo | Tabela | Crítico? |
|-------|--------|----------|
| `unit_price_usd` | purchase_order_items | Sim |
| `quantity` | purchase_order_items | Sim |
| `technical_description` | products | Não |
| `supplier_specs` | products | Não |
| `ncm` | products | Não |
| `master_box_volume` | products | Não |
| `master_box_length/width/height` | products | Não |
| `fob_price_usd` | products | Não |
| `packaging_type` | products | Não |

**Importante**: Alterações em produtos (`products`) afetam o cadastro do produto, não apenas o pedido. Devemos decidir:
- **Opção A**: Editar direto na tabela de produtos (afeta outros pedidos)
- **Opção B**: Criar campos de override no `purchase_order_items` para sobrescrever valores específicos do produto naquele pedido

Vou implementar a **Opção A** (editar produtos diretamente), já que parece ser o comportamento esperado de um trader que está atualizando informações dos produtos.

#### Parte 2: Criar Visualização com Destaque de Alterações

Criar novo componente `HighlightedOrderItemsTable.tsx` para o comprador ver:
- Campos alterados com **fundo amarelo/âmbar**
- **Tooltip** mostrando valor anterior ao passar o mouse
- Ícone de "alterado" nos campos modificados

#### Parte 3: Integrar no Fluxo de Aprovação

- Quando o status for `pending_buyer_approval`, mostrar a tabela com destaques
- Comprador vê exatamente o que foi alterado, campo por campo
- Alterações críticas precisam de aprovação explícita
- Alterações informativas são apenas visualizadas

---

### Arquivos a Modificar/Criar

| Arquivo | Alteração |
|---------|-----------|
| `EditableOrderItemsTable.tsx` | Adicionar edição de descrição, NCM, cubagem, specs |
| **NOVO** `HighlightedOrderItemsTable.tsx` | Tabela read-only com destaque visual de alterações |
| `PurchaseOrderDetails.tsx` | Usar `HighlightedOrderItemsTable` para status `pending_buyer_approval` |
| `useOrderChanges.ts` | Adicionar helper para buscar alterações por item/campo |

---

### Layout da Tabela Editável (Trader)

```
┌────┬─────┬────────┬────────────────┬──────┬────────┬─────┬────────┬─────┬────────┐
│ #  │ PIC │ CODE   │ DESCRIPTION ✏️ │ NCM ✏️│ Q'TY ✏️│ ☐Q │ FOB ✏️ │ ☐$ │ AÇÃO   │
├────┼─────┼────────┼────────────────┼──────┼────────┼─────┼────────┼─────┼────────┤
│ 1  │ 📷  │ 001480 │ [input texto]  │[inp] │ 1,000  │ ☑   │ $0.45  │ ☑   │ 💾 ❌  │
└────┴─────┴────────┴────────────────┴──────┴────────┴─────┴────────┴─────┴────────┘
```

### Layout da Tabela Destacada (Comprador)

```
┌────┬─────┬────────┬─────────────────────────┬───────────────┬────────┐
│ #  │ PIC │ CODE   │ DESCRIPTION             │ Q'TY          │ FOB    │
├────┼─────┼────────┼─────────────────────────┼───────────────┼────────┤
│ 1  │ 📷  │ 001480 │ ⚠️ "Nova descrição"     │ 🔶 1,500      │ $0.45  │
│    │     │        │ [tooltip: era "antiga"] │ [era: 1,000]  │        │
└────┴─────┴────────┴─────────────────────────┴───────────────┴────────┘

Legenda:
🔶 = Campo crítico alterado (fundo amarelo/âmbar, requer aprovação)
⚠️ = Campo informativo alterado (fundo azul claro, apenas visualização)
```

---

### Detalhes de Implementação

#### 1. Expandir EditableOrderItemsTable.tsx

Adicionar estado para mais campos editáveis:

```typescript
interface EditingState {
  [itemId: string]: {
    unit_price_usd: number;
    quantity: number;
    // Novos campos
    technical_description: string;
    supplier_specs: string;
    ncm: string;
    master_box_volume: number;
    isSaving: boolean;
  };
}
```

Adicionar inputs para campos não-críticos com logging:

```typescript
// Ao salvar descrição (não crítico)
await logChange({
  orderId,
  itemId: item.id,
  changeType: 'item_field',
  fieldName: 'technical_description',
  oldValue: oldDescription,
  newValue: newDescription,
  isCritical: false, // Não requer aprovação
});
```

#### 2. Criar HighlightedOrderItemsTable.tsx

```typescript
interface HighlightedOrderItemsTableProps {
  orderId: string;
  items: OrderItem[];
  changes: OrderChange[]; // Alterações do pedido
  showImages?: boolean;
}

// Helper para verificar se campo foi alterado
const getFieldChange = (itemId: string, fieldName: string): OrderChange | null => {
  return changes.find(c => 
    c.purchase_order_item_id === itemId && 
    c.field_name === fieldName
  ) || null;
};

// Componente de célula com destaque
const HighlightedCell = ({ value, change }: { value: any; change: OrderChange | null }) => {
  if (!change) return <span>{value}</span>;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(
          "px-1 rounded",
          change.is_critical 
            ? "bg-yellow-100 text-yellow-900 border border-yellow-300" 
            : "bg-blue-50 text-blue-900 border border-blue-200"
        )}>
          {value}
          {change.is_critical ? <AlertTriangle className="inline h-3 w-3 ml-1" /> : <Info className="inline h-3 w-3 ml-1" />}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">
          <span className="font-medium">Valor anterior:</span>{' '}
          <span className="line-through">{change.old_value}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Alterado em {format(new Date(change.changed_at), "dd/MM 'às' HH:mm")}
        </p>
      </TooltipContent>
    </Tooltip>
  );
};
```

#### 3. Atualizar PurchaseOrderDetails.tsx

```typescript
// Para comprador vendo pedido pending_buyer_approval
{showBuyerApproval ? (
  <HighlightedOrderItemsTable
    orderId={order.id}
    items={items}
    changes={orderChanges} // Buscar alterações
    showImages={showImages}
  />
) : showTraderApproval ? (
  <EditableOrderItemsTable ... />
) : (
  <PurchaseOrderInvoice ... />
)}
```

#### 4. Atualizar useOrderChanges.ts

Adicionar helper para buscar alterações por item:

```typescript
// Agrupar alterações por item
const changesByItem = useMemo(() => {
  const grouped: Record<string, Record<string, OrderChange>> = {};
  changes.forEach(c => {
    if (c.purchase_order_item_id) {
      if (!grouped[c.purchase_order_item_id]) {
        grouped[c.purchase_order_item_id] = {};
      }
      // Manter apenas a alteração mais recente por campo
      grouped[c.purchase_order_item_id][c.field_name] = c;
    }
  });
  return grouped;
}, [changes]);

return {
  // ... existente
  changesByItem,
};
```

---

### Fluxo Completo

1. **Trader abre pedido** `pending_trader_review`
2. **Edita qualquer campo** (preço, qtd, descrição, NCM, etc.)
3. **Todas as alterações são logadas** com `is_critical` apropriado
4. **Marca aprovações** (ETD, Preços, Quantidades) no header
5. **Clica "Confirmar"** → Se houve mudança crítica → `pending_buyer_approval`
6. **Comprador abre pedido** e vê:
   - `HighlightedOrderItemsTable` com campos destacados
   - Alterações críticas em amarelo com tooltip
   - Alterações informativas em azul com tooltip
7. **Comprador aprova** alterações críticas
8. **Status muda para** `confirmed`

---

### Resumo das Entregas

| Componente | Função |
|------------|--------|
| `EditableOrderItemsTable` | Edição completa de todos os campos pelo trader |
| **NOVO** `HighlightedOrderItemsTable` | Visualização com destaque de alterações para comprador |
| `useOrderChanges` | Helper `changesByItem` para agrupar alterações |
| `PurchaseOrderDetails` | Integração condicional baseada em status/role |

