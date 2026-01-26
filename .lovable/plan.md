

## Plano: Exibir Número de Referência no Painel do Trader

### Problema Identificado

Na página `/trader` (TraderDashboard.tsx), o número do pedido exibido na coluna "Pedido" mostra apenas o `order_number` (PO-2026-0002) e não exibe o `reference_number` (AMOR-26001), que é o número importante para o matching com uploads.

**Código atual (linha 194-196):**
```tsx
<Badge variant="outline" className="font-mono">
  {order.order_number}
</Badge>
```

Na página `/purchase-orders`, a exibição está correta (linhas 301-307):
```tsx
<div className="flex flex-col">
  <span>{order.reference_number || order.order_number}</span>
  {order.reference_number && (
    <span className="text-xs text-muted-foreground">{order.order_number}</span>
  )}
</div>
```

---

### Solução

Modificar a exibição na coluna "Pedido" do `TraderDashboard.tsx` para usar a mesma lógica de `PurchaseOrders.tsx`:
- Mostrar `reference_number` como principal (quando disponível)
- Mostrar `order_number` como subtexto secundário

---

### Arquivo a Modificar

#### `src/pages/TraderDashboard.tsx` (linhas 192-197)

**De:**
```tsx
<TableCell>
  <div className="flex items-center gap-2">
    <Badge variant="outline" className="font-mono">
      {order.order_number}
    </Badge>
  </div>
</TableCell>
```

**Para:**
```tsx
<TableCell>
  <div className="flex flex-col">
    <span className="font-medium">
      {order.reference_number || order.order_number}
    </span>
    {order.reference_number && (
      <span className="text-xs text-muted-foreground">{order.order_number}</span>
    )}
  </div>
</TableCell>
```

---

### Resultado Esperado

| Antes | Depois |
|-------|--------|
| `PO-2026-0002` | **AMOR-26001** |
|  | `PO-2026-0002` (texto pequeno) |

O trader verá o número de referência do comprador (AMOR-26001) como identificador principal do pedido, facilitando a correspondência com o arquivo de upload.

