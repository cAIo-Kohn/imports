

## Correção: Pedido para Fornecedor Chinês Não Vai para Painel do Trader

### Diagnóstico do Problema

O pedido criado pelo **SmartOrderBuilder** (via `OrderSimulationFooter`) está sendo salvo com `status: 'draft'` ao invés de `pending_trader_review` para fornecedores chineses.

**Causa raiz:** O `OrderSimulationFooter.tsx` não verifica se o fornecedor é chinês antes de definir o status inicial.

### Evidência

Nos logs de rede, vemos que o pedido foi criado com status fixo:

```json
{
  "order_number": "PO-2026-0008",
  "supplier_id": "9671926d-5c4b-4dd3-9218-8c127f99e2d6",
  "status": "draft"  // ❌ Deveria ser "pending_trader_review"
}
```

O fornecedor (JILONG) é da China, mas o código não verificou isso.

---

### Correção Necessária

#### 1. Adicionar prop `supplierCountry` ao OrderSimulationFooter

**Arquivo:** `src/components/planning/OrderSimulationFooter.tsx`

```typescript
interface OrderSimulationFooterProps {
  // ... props existentes
  supplierName: string;
  supplierCountry: string;  // ← ADICIONAR
  // ...
}
```

#### 2. Usar país para definir status na criação

**Arquivo:** `src/components/planning/OrderSimulationFooter.tsx` (linha ~346)

Alterar de:
```typescript
status: 'draft',
```

Para:
```typescript
const isChineseSupplier = supplierCountry?.toLowerCase() === 'china';
// ...
status: isChineseSupplier ? 'pending_trader_review' : 'draft',
```

#### 3. Passar país do fornecedor no SupplierPlanning

**Arquivo:** `src/pages/SupplierPlanning.tsx` (linha ~668)

Adicionar prop:
```typescript
<OrderSimulationFooter
  // ... outras props
  supplierName={supplier.company_name}
  supplierCountry={supplier.country}  // ← ADICIONAR
  // ...
/>
```

---

### Resumo das Mudanças

| Arquivo | Alteração |
|---------|-----------|
| `src/components/planning/OrderSimulationFooter.tsx` | Adicionar `supplierCountry` nas props e usar para definir status inicial |
| `src/pages/SupplierPlanning.tsx` | Passar `supplierCountry={supplier.country}` ao componente |

---

### Resultado Esperado

Após a correção:
1. Pedido criado para fornecedor chinês → `status: 'pending_trader_review'`
2. Pedido aparece automaticamente no Painel do Trader (`/trader`)
3. Pedido criado para outros fornecedores → `status: 'draft'` (comportamento normal)

