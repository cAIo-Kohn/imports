
## Plano: Padronizar Header com ETD, Total Amount e Containers

### Problema Identificado

1. **Header atual mostra**: ETD + "Preços: $X (x/x)" + "Qtd: X pcs (x/x)"
2. **Usuário quer**: ETD + "Total Amount: $X" + "Containers: 3x40HQ"
3. **Informação de containers** já é calculada na criação do pedido e salva no campo `notes` (ex: `Container: 3x 40' HQ | Volume: 228.06m³ | ...`)

---

### Solução Proposta

#### 1. Modificar TraderHeaderApprovals.tsx

Trocar os badges informativos:
- **De**: "Preços: $75,033 (4/9)" → **Para**: "Total Amount: $75,033.60"
- **De**: "Qtd: 803.241 pcs (4/9)" → **Para**: "Containers: 3x 40' HQ"

#### 2. Adicionar prop `containerInfo` ao componente

Extrair informação de containers do campo `notes` do pedido ou calcular dinamicamente.

#### 3. Padronizar na lista de Pedidos de Compra (PurchaseOrders.tsx)

Atualizar a tabela para mostrar:
- ETD em vez de "Data"
- Total Amount (já existe como "Valor FOB")
- Total de containers em vez de "X itens (Y un)"

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `TraderHeaderApprovals.tsx` | Trocar "Preços" por "Total Amount" e "Qtd" por containers |
| `PurchaseOrderDetails.tsx` | Passar `containerInfo` e `totalCBM` para o header |
| `PurchaseOrders.tsx` | Atualizar colunas da tabela: ETD, Total Amount, Containers |

---

### Detalhes de Implementação

#### 1. Extrair Informação de Containers

Opção mais simples: extrair do campo `notes` usando regex:
```typescript
// notes: "Container: 3x 40' HQ | Volume: 228.06m³ | ..."
const extractContainerInfo = (notes: string | null): string => {
  if (!notes) return '-';
  const match = notes.match(/Container:\s*([^|]+)/);
  return match ? match[1].trim() : '-';
};
```

Opção mais robusta: calcular dinamicamente usando items + supplier container config (mais complexa, deixar para futuro se necessário).

#### 2. TraderHeaderApprovals - Nova Estrutura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ☐ 📅 ETD: 30/05/2026 ✏️ ✓    │  💵 Total: $75,033.60  │  📦 3x 40' HQ    │
│                               │                        │                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

Mudanças no código:
```typescript
// Props atualizadas
interface TraderHeaderApprovalsProps {
  order: PurchaseOrder;
  totalValue: number;
  containerInfo: string;  // Ex: "3x 40' HQ" ou "3x 40' HQ + 45%"
  earliestArrival: string | null;
  onOrderUpdated: () => void;
}

// Badge de Total Amount (sem progresso de aprovação)
<div className="flex items-center gap-2 p-2 rounded-lg bg-background border">
  <DollarSign className="h-4 w-4 text-muted-foreground" />
  <span className="text-sm">
    <span className="font-medium">Total Amount:</span>{' '}
    {formatCurrency(totalValue)}
  </span>
</div>

// Badge de Containers
<div className="flex items-center gap-2 p-2 rounded-lg bg-background border">
  <Container className="h-4 w-4 text-muted-foreground" />
  <span className="text-sm">
    <span className="font-medium">Containers:</span>{' '}
    {containerInfo}
  </span>
</div>
```

#### 3. PurchaseOrderDetails.tsx - Calcular e Passar Container Info

```typescript
// Extrair container info do notes
const containerInfo = useMemo(() => {
  if (!order?.notes) return '-';
  const match = order.notes.match(/Container:\s*([^|]+)/);
  return match ? match[1].trim() : '-';
}, [order?.notes]);

// Passar para o header
<TraderHeaderApprovals 
  order={order as any} 
  totalValue={totalValue}
  containerInfo={containerInfo}
  earliestArrival={earliestArrival}
  onOrderUpdated={() => queryClient.invalidateQueries({ queryKey: ['purchase-order', id] })}
/>
```

#### 4. PurchaseOrders.tsx - Atualizar Colunas da Tabela

| Antes | Depois |
|-------|--------|
| Data (order_date) | ETD (order.etd) |
| Itens (X itens / Y un) | Containers (extraído de notes) |
| Valor FOB | Total Amount (mesmo dado, label diferente) |

Query precisa incluir `etd` e `notes`:
```typescript
.select(`
  id, order_number, order_date, status, notes, total_value_usd, created_at,
  etd,  // ADICIONAR
  suppliers (company_name),
  purchase_order_items (id, quantity)
`)
```

Nova estrutura da tabela:
```
┌──────────┬────────────┬────────────┬───────────────┬───────────────┬──────────┐
│ Número   │ Fornecedor │ ETD        │ Containers    │ Total Amount  │ Status   │
├──────────┼────────────┼────────────┼───────────────┼───────────────┼──────────┤
│ PO-2026  │ JILONG     │ 30/05/2026 │ 3x 40' HQ     │ $75,033.60    │ Aguard.  │
└──────────┴────────────┴────────────┴───────────────┴───────────────┴──────────┘
```

---

### Função Helper para Extrair Containers

Criar uma função reutilizável:
```typescript
// src/lib/utils.ts ou inline
export function extractContainerInfo(notes: string | null): string {
  if (!notes) return '-';
  const match = notes.match(/Container:\s*([^|]+)/);
  return match ? match[1].trim() : '-';
}
```

---

### Resumo das Entregas

| Componente | Mudança Visual |
|------------|----------------|
| `TraderHeaderApprovals` | "Preços" → "Total Amount", "Qtd pcs" → "Containers: Xx40'HQ" |
| `PurchaseOrders` lista | Coluna "Data" → "ETD", "Itens" → "Containers" |
| `PurchaseOrderDetails` | Passar containerInfo extraído do notes |

### Compatibilidade

- Pedidos criados antes da mudança: Se não tiverem info de container no `notes`, mostrar "-" ou calcular dinamicamente
- Pedidos novos: Já salvam container info no `notes` automaticamente
