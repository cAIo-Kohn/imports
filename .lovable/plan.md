

## Plano: Integração de Pedidos na Projeção de Estoque com Identificação por Cores

### Problema Atual

1. **Pedidos criados no app não aparecem na projeção de estoque** - A tabela `SupplierPlanning.tsx` usa apenas `scheduled_arrivals` (vindas de uploads REI), ignorando os `purchase_order_items` criados pelo sistema
2. **Não há campo para número de pedido do comprador** - O sistema gera automaticamente `PO-2026-XXXX` mas não permite que o comprador defina seu próprio código de referência (ex: `AMOR-26001`)
3. **Não há vínculo entre uploads e pedidos do app** - Quando um arquivo REI chega com um número de processo que corresponde a um pedido existente, o sistema não sabe substituir

---

### Solução Proposta

#### 1. Adicionar Campo `reference_number` aos Pedidos

**Schema (Migration):**
```sql
ALTER TABLE public.purchase_orders 
ADD COLUMN reference_number TEXT;

COMMENT ON COLUMN public.purchase_orders.reference_number IS 
  'Número de referência definido pelo comprador para vincular com uploads externos (ex: AMOR-26001)';
```

- `order_number` (PO-2026-0001): Número interno do sistema (mantido)
- `reference_number` (AMOR-26001): Número que o comprador define e que será usado para matching com uploads

#### 2. Modificar Interface de Criação de Pedidos

**Arquivos afetados:**
- `src/components/planning/CreatePurchaseOrderModal.tsx`
- `src/components/planning/OrderSimulationFooter.tsx`

**Mudanças:**
- Adicionar campo `reference_number` (opcional) nos formulários de criação
- Exibir `reference_number` na lista de pedidos quando disponível
- Usar `reference_number` (ou `order_number` como fallback) para exibição

#### 3. Incluir Pedidos do App na Projeção de Estoque

**Arquivo afetado:** `src/pages/SupplierPlanning.tsx`

**Lógica:**
- Além de buscar `scheduled_arrivals`, buscar também `purchase_order_items` com seus respectivos pedidos
- Para cada produto/mês, calcular:
  - **Chegadas Pretas** (uploads): `scheduled_arrivals` que NÃO têm `process_number` correspondente a um `reference_number` de pedido do app
  - **Chegadas Azuis** (app): `purchase_order_items` de pedidos em status ≠ cancelled, ≠ received

**Nova Query:**
```sql
SELECT 
  poi.product_id, 
  poi.unit_id, 
  poi.quantity, 
  poi.expected_arrival,
  po.order_number,
  po.reference_number,
  po.status
FROM purchase_order_items poi
INNER JOIN purchase_orders po ON po.id = poi.purchase_order_id
WHERE po.supplier_id = :supplierId
  AND po.status NOT IN ('cancelled', 'received')
  AND poi.expected_arrival IS NOT NULL
```

#### 4. Modificar Componente ArrivalInput para Suportar Duas Fontes

**Arquivo afetado:** `src/components/planning/ArrivalInput.tsx`

**Nova estrutura de dados:**
```typescript
interface ArrivalInputProps {
  productId: string;
  monthKey: string;
  initialValue: string; // pendingArrivals (digitação em tempo real)
  uploadedArrivals: number; // scheduled_arrivals (preto)
  appOrderArrivals: { 
    quantity: number; 
    orderNumbers: string[]; // para tooltip
  }; // purchase_order_items (azul)
  processNumber: string | null;
  onValueChange: ...
}
```

**Visualização:**
- **Preto negrito**: Chegadas de uploads (`scheduled_arrivals` sem vínculo com pedido do app)
- **Azul negrito**: Chegadas de pedidos do app (`purchase_order_items`)
- **Azul claro** (já existente): Digitação manual (`pendingArrivals`)

Exemplo: `500 + 1000` onde 500 está em preto (upload) e 1000 está em azul (pedido app)

#### 5. Lógica de Substituição no Upload

**Arquivo afetado:** Lógica de import de `scheduled_arrivals` (provavelmente em `ImportArrivalsModal.tsx`)

**Regra:**
Quando um registro do arquivo REI tiver um `process_number` que corresponda ao `reference_number` de um pedido existente:
1. A chegada do upload (preta) substitui a chegada do pedido do app (azul)
2. O pedido permanece no sistema (para histórico), mas sua contribuição na projeção é removida
3. Opcionalmente: atualizar o status do pedido para `received` ou adicionar flag indicando que foi sincronizado

---

### Fluxo de Dados Atualizado

```text
┌─────────────────────────────────────────────────────────────────┐
│                    PROJEÇÃO DE ESTOQUE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐     ┌─────────────────────┐           │
│  │  scheduled_arrivals │     │ purchase_order_items│           │
│  │    (Upload REI)     │     │      (App)          │           │
│  │                     │     │                     │           │
│  │  process_number ────┼─────┼─→ reference_number  │           │
│  └─────────────────────┘     └─────────────────────┘           │
│           │                           │                         │
│           ▼                           ▼                         │
│    ┌──────────────┐           ┌──────────────┐                 │
│    │  PRETO       │           │    AZUL      │                 │
│    │  (upload)    │           │    (app)     │                 │
│    └──────────────┘           └──────────────┘                 │
│           │                           │                         │
│           └───────────┬───────────────┘                         │
│                       ▼                                         │
│              ┌────────────────┐                                 │
│              │ Se process_num │                                 │
│              │ = reference_num│──→ Elimina AZUL, mantém PRETO  │
│              └────────────────┘                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Arquivos a Serem Modificados

| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `supabase/migrations/` | Nova migration para `reference_number` |
| `src/pages/SupplierPlanning.tsx` | Buscar e incluir `purchase_order_items` na projeção |
| `src/components/planning/ArrivalInput.tsx` | Suportar duas cores (preto/azul) |
| `src/components/planning/ProductProjectionRow.tsx` | Passar dados de chegadas separados por fonte |
| `src/components/planning/CreatePurchaseOrderModal.tsx` | Campo `reference_number` |
| `src/components/planning/OrderSimulationFooter.tsx` | Campo `reference_number` na criação |
| `src/pages/PurchaseOrders.tsx` | Exibir `reference_number` na lista |
| `src/pages/PurchaseOrderDetails.tsx` | Campo `reference_number` editável |
| `src/components/planning/ImportArrivalsModal.tsx` | Lógica de substituição por `reference_number` |

---

### Considerações Técnicas

1. **Performance**: A query de `purchase_order_items` será filtrada por `supplier_id` (via join) e `status`, garantindo um dataset pequeno
2. **Evitar duplicação**: A lógica de substituição garante que se um `scheduled_arrival.process_number` = `purchase_order.reference_number`, apenas a versão do upload conta
3. **Retrocompatibilidade**: Pedidos sem `reference_number` continuam funcionando normalmente
4. **Tooltip informativo**: Ao passar o mouse sobre chegadas azuis, mostrar o número do pedido (ex: "Pedido AMOR-26001")

