

## Plano: Corrigir Exibição Duplicada no Total de Chegadas

### Problema Identificado

Na coluna TOTAL da linha "Chegada", quando **não há** chegadas de uploads (`totalPurchases = 0`) e só há chegadas de pedidos do app (`totalAppOrderArrivals > 0`), a exibição mostra:

```
9.984 (+9.984)
```

Isso parece duplicado porque:
- `9.984` = totalPurchases(0) + totalAppOrderArrivals(9984) + totalPendingArrivals(0)
- `(+9.984)` = totalAppOrderArrivals(9984) + totalPendingArrivals(0)

### Solução

Ajustar a lógica de exibição para mostrar o indicador azul `(+X)` **apenas quando há valores de upload também**. Quando só existem chegadas do app, mostrar apenas o total em azul sem duplicação.

---

### Arquivos a Modificar

#### 1. `src/components/planning/ProductProjectionRow.tsx` (linhas 165-174)

**De:**
```tsx
<TableCell className="text-center py-0.5 px-1 bg-muted/20">
  <span className="font-semibold text-xs">
    {(productProj.totalPurchases + productProj.totalAppOrderArrivals + productProj.totalPendingArrivals).toLocaleString('pt-BR')}
  </span>
  {(productProj.totalAppOrderArrivals + productProj.totalPendingArrivals) > 0 && (
    <span className="text-[10px] text-primary ml-1">
      (+{(productProj.totalAppOrderArrivals + productProj.totalPendingArrivals).toLocaleString('pt-BR')})
    </span>
  )}
</TableCell>
```

**Para:**
```tsx
<TableCell className="text-center py-0.5 px-1 bg-muted/20">
  {/* Se há uploads, mostrar em preto + azul separadamente */}
  {productProj.totalPurchases > 0 ? (
    <>
      <span className="font-semibold text-xs">
        {productProj.totalPurchases.toLocaleString('pt-BR')}
      </span>
      {(productProj.totalAppOrderArrivals + productProj.totalPendingArrivals) > 0 && (
        <span className="text-[10px] text-blue-700 dark:text-blue-400 font-bold ml-1">
          +{(productProj.totalAppOrderArrivals + productProj.totalPendingArrivals).toLocaleString('pt-BR')}
        </span>
      )}
    </>
  ) : (
    /* Se só há app orders ou pending, mostrar direto em azul */
    <span className={`font-semibold text-xs ${
      (productProj.totalAppOrderArrivals + productProj.totalPendingArrivals) > 0 
        ? 'text-blue-700 dark:text-blue-400' 
        : ''
    }`}>
      {(productProj.totalAppOrderArrivals + productProj.totalPendingArrivals).toLocaleString('pt-BR')}
    </span>
  )}
</TableCell>
```

#### 2. `src/components/planning/ProductProjectionCard.tsx` (linhas 177-186)

Aplicar a mesma lógica para manter consistência entre os dois componentes de exibição.

---

### Resultado Visual

| Situação | Antes | Depois |
|----------|-------|--------|
| Só uploads (preto) | `5.000` | `5.000` (preto) |
| Só app orders (azul) | `9.984 (+9.984)` | `9.984` (azul) |
| Uploads + App | `15.000 (+10.000)` | `5.000 +10.000` (preto + azul) |
| Nenhuma chegada | `0` | `0` |

### Cores Aplicadas

- **Preto** (`font-semibold`): Chegadas de uploads (`scheduled_arrivals`)
- **Azul** (`text-blue-700`): Chegadas de pedidos do app (`purchase_order_items` + `pendingArrivals`)

