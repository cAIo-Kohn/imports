
## Plano: Incluir Pedidos do App no Cálculo de Rupturas dos Cards de Saúde

### Problema Identificado

Na página `/demand-planning`, o cálculo de rupturas nos cards de fornecedores usa **apenas** as chegadas de `scheduled_arrivals` (uploads), ignorando os `purchase_order_items` (pedidos criados no app).

**Código atual (linha 240):**
```typescript
const arrivals = productArrivals.get(monthKey) || 0;  // Só scheduled_arrivals!
```

Isso faz com que o fornecedor JIANGSU JILONG mostre rupturas em períodos que já foram cobertos por pedidos confirmados no app.

---

### Solução

Modificar o cálculo em `src/pages/DemandPlanning.tsx` para incluir os `purchase_order_items` no cálculo de chegadas, similar ao que foi feito em `SupplierPlanning.tsx`.

---

### Arquivo: `src/pages/DemandPlanning.tsx`

#### 1. Modificar a Query de `purchaseItems` (linhas 121-140)

Adicionar `expected_arrival` agrupado por produto/mês para incluir no cálculo:

```typescript
const { data: purchaseItems = [], refetch: refetchPurchaseItems } = useQuery({
  queryKey: ['purchase-items-summary'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('purchase_order_items')
      .select(`
        product_id,
        quantity,
        unit_price_usd,
        expected_arrival,
        purchase_orders!inner (status, supplier_id, reference_number)
      `)
      .not('expected_arrival', 'is', null);
    if (error) throw error;
    return data?.filter(item => 
      (item.purchase_orders as any)?.status !== 'cancelled' && 
      (item.purchase_orders as any)?.status !== 'received'
    ) || [];
  },
});
```

#### 2. Criar agrupamento de pedidos do app por produto/mês (após linha 193)

Adicionar novo mapa para chegadas de pedidos do app:

```typescript
// Group app order arrivals by product and month
const appOrdersByProductMonth = new Map<string, Map<string, number>>();
purchaseItems.forEach(item => {
  if (!item.expected_arrival) return;
  const monthKey = item.expected_arrival.substring(0, 7);
  
  if (!appOrdersByProductMonth.has(item.product_id)) {
    appOrdersByProductMonth.set(item.product_id, new Map());
  }
  const productMonths = appOrdersByProductMonth.get(item.product_id)!;
  productMonths.set(monthKey, (productMonths.get(monthKey) || 0) + item.quantity);
});

// Get reference numbers for filtering duplicates from scheduled_arrivals
const appOrderReferenceNumbers = new Set<string>();
purchaseItems.forEach(item => {
  const refNum = (item.purchase_orders as any)?.reference_number;
  if (refNum) appOrderReferenceNumbers.add(refNum);
});
```

#### 3. Modificar o agrupamento de `scheduledArrivals` para excluir duplicados (linhas 183-193)

```typescript
// Group arrivals by product and month (excluding those already matched to app orders)
const arrivalsByProductMonth = new Map<string, Map<string, number>>();
scheduledArrivals.forEach(arr => {
  // Se o process_number corresponde a um reference_number de pedido do app, ignorar
  if (arr.process_number && appOrderReferenceNumbers.has(arr.process_number)) {
    return; // Evita duplicação
  }
  
  const monthKey = arr.arrival_date.substring(0, 7);
  if (!arrivalsByProductMonth.has(arr.product_id)) {
    arrivalsByProductMonth.set(arr.product_id, new Map());
  }
  const productMonths = arrivalsByProductMonth.get(arr.product_id)!;
  productMonths.set(monthKey, (productMonths.get(monthKey) || 0) + arr.quantity);
});
```

#### 4. Incluir chegadas do app no cálculo de rupturas (linha 240)

Modificar o cálculo para somar ambas as fontes:

```typescript
const productArrivals = arrivalsByProductMonth.get(product.id) || new Map();
const productAppOrders = appOrdersByProductMonth.get(product.id) || new Map();

// ...

for (let i = 0; i < 12; i++) {
  const monthKey = monthKeys[i];
  const forecast = productForecasts.get(monthKey) || 0;
  const uploadedArrivals = productArrivals.get(monthKey) || 0;
  const appOrderArrivals = productAppOrders.get(monthKey) || 0;
  const arrivals = uploadedArrivals + appOrderArrivals; // SOMA AMBAS AS FONTES
  
  balance = balance - forecast + arrivals;
  // ...
}
```

#### 5. Atualizar fetch da query de arrivals para incluir `process_number`

Modificar `fetchArrivalsParallel` ou a interface `ScheduledArrival` para incluir o campo `process_number`:

```typescript
interface ScheduledArrival {
  product_id: string;
  quantity: number;
  arrival_date: string;
  process_number?: string | null; // Adicionar
}
```

#### 6. Adicionar `refetchPurchaseItems` ao `handleRefreshData` (linha 348-354)

```typescript
const handleRefreshData = useCallback(() => {
  refetchSuppliers();
  refetchForecasts();
  refetchInventory();
  refetchArrivals();
  refetchPurchaseItems(); // Adicionar
  toast({ title: 'Dados atualizados', ... });
}, [refetchSuppliers, refetchForecasts, refetchInventory, refetchArrivals, refetchPurchaseItems, toast]);
```

---

### Resultado Esperado

| Situação | Antes | Depois |
|----------|-------|--------|
| JIANGSU JILONG (6m) | ⚠️ 6 rupt. | ✅ OK |
| JIANGSU JILONG (9m) | ⚠️ 5 rupt. | ✅ OK |
| JIANGSU JILONG (12m) | ⚠️ 3 rupt. | ✅ OK |
| JIANGSU JILONG (3m) | ❌ 1 rupt. | ❌ 1 rupt. (sem tempo hábil) |

Os cards de saúde passarão a refletir corretamente os pedidos confirmados ou em andamento no app, eliminando falsos positivos de ruptura.

---

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/DemandPlanning.tsx` | Incluir `purchase_order_items` no cálculo de chegadas |
| `src/lib/fetchAllPaged.ts` | Adicionar `process_number` ao retorno de arrivals (se necessário) |

