
## Plano: Limitar Descrição na Commercial Invoice

### Problema Identificado

Na página de detalhes do pedido (Commercial Invoice - `PurchaseOrderInvoice.tsx`), a coluna **DESCRIPTION** exibe o texto completo de `supplier_specs` ou `technical_description`, que pode ser muito extenso (como especificações técnicas detalhadas), ocupando muito espaço vertical na tabela.

### Solução

Aplicar a mesma técnica de truncamento + tooltip que foi usada em outros componentes:

---

### Arquivo: `src/components/orders/PurchaseOrderInvoice.tsx`

**1. Adicionar imports do Tooltip (linha 3):**

```typescript
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
```

**2. Modificar a célula Description (linhas 265-267):**

De:
```tsx
<TableCell className="max-w-[150px] text-xs">
  {product?.supplier_specs || product?.technical_description || '-'}
</TableCell>
```

Para:
```tsx
<TableCell className="max-w-[180px]">
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-xs line-clamp-2 cursor-help block">
          {product?.supplier_specs || product?.technical_description || '-'}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-md">
        <p className="text-xs whitespace-pre-wrap max-h-[300px] overflow-y-auto">
          {product?.supplier_specs || product?.technical_description || '-'}
        </p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</TableCell>
```

---

### Resultado Visual

| Antes | Depois |
|-------|--------|
| Texto completo com 30+ linhas | 2 linhas com "..." e tooltip para ver completo |

### Detalhes Técnicos

- `line-clamp-2`: Limita a 2 linhas de texto
- `cursor-help`: Indica visualmente que há mais conteúdo
- `max-h-[300px] overflow-y-auto` no tooltip: Permite scroll para descrições muito longas
- `max-w-md` no tooltip: Largura adequada para leitura confortável

