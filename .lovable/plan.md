
## Plano: Otimizar Exibição de Alterações Críticas e Informativas

### Problemas Identificados

| Problema | Atual | Esperado |
|----------|-------|----------|
| **Código UUID no Preço** | `fabd-4fe4-a04c-bbf35801a2ec-unit_price_usd` | `Preço Unitário - Produto 001488` |
| **Alterações Informativas** | Mostra flags internos (`trader_etd_approved`, etc.) | Mostrar apenas alterações cadastrais reais |

---

### Solução Proposta

#### 1. Buscar Código do Produto para Alterações de Itens

Modificar `useOrderChanges.ts` para:
- Criar query adicional que busca produtos associados aos itens do pedido
- Enriquecer `ConsolidatedChange` com informação do produto

```typescript
// Nova interface
export interface ConsolidatedChange {
  // ... campos existentes ...
  productCode: string | null;  // Novo campo
  productId: string | null;    // Novo campo
}

// Query adicional para buscar produtos dos itens
const { data: orderItems = [] } = useQuery({
  queryKey: ['order-items-products', orderId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('purchase_order_items')
      .select('id, product_id, products(code)')
      .eq('purchase_order_id', orderId);
    if (error) throw error;
    return data;
  },
  enabled: !!orderId,
});

// Usar no consolidatedCriticalChanges:
const productInfo = orderItems.find(i => i.id === itemId);
result.push({
  // ...
  productCode: productInfo?.products?.code || null,
  productId: productInfo?.product_id || null,
});
```

#### 2. Exibir Label Humanizado para Alterações de Itens

Modificar `OrderChangeSummary.tsx`:

```typescript
// Antes:
<span className="font-medium text-sm">{formatFieldLabel(consolidated.fieldName)}</span>

// Depois:
<span className="font-medium text-sm">
  {formatFieldLabel(consolidated.fieldName)}
  {consolidated.productCode && (
    <span className="text-muted-foreground font-normal ml-1">
      - Produto {consolidated.productCode}
    </span>
  )}
</span>

// Resultado: "Preço Unitário - Produto 001488"
```

#### 3. Filtrar Alterações Informativas

Manter apenas alterações cadastrais significativas. Criar lista de campos permitidos:

```typescript
// Campos cadastrais que devem aparecer nas informativas
const CADASTRAL_FIELDS = [
  'technical_description',
  'supplier_specs',
  'ncm',
  'master_box_volume',
  'master_box_length',
  'master_box_width',
  'master_box_height',
  'gross_weight',
  'origin_description',
  'image_url',
];

// Filtrar informationalChanges
const informationalChanges = changes.filter(c => 
  !c.is_critical && CADASTRAL_FIELDS.includes(c.field_name)
);
```

Isso **remove** as flags internas como:
- `trader_etd_approved`
- `trader_prices_approved`
- `trader_quantities_approved`

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `useOrderChanges.ts` | Buscar produtos dos itens; adicionar `productCode`/`productId` ao ConsolidatedChange; filtrar informationalChanges |
| `OrderChangeSummary.tsx` | Exibir código do produto no label das alterações de itens |

---

### Resultado Final

```text
ANTES:
┌────────────────────────────────────────────────────┐
│ fabd-4fe4-a04c-bbf35801a2ec-unit_price_usd        │
│ $0.00 → $0.10                                      │
└────────────────────────────────────────────────────┘

DEPOIS:
┌────────────────────────────────────────────────────┐
│ Preço Unitário - Produto 001488                    │
│ $0.00 → $0.10                                      │
└────────────────────────────────────────────────────┘
```

```text
ANTES (Informativas):
- trader_etd_approved: false → true
- trader_prices_approved: false → true
- trader_etd_approved: false → true

DEPOIS:
(Seção removida se não houver alterações cadastrais reais)
ou
- Descrição Técnica: "texto antigo" → "texto novo"
- NCM: "1234.56.78" → "8765.43.21"
```
