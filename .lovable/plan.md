

## Plano: Limitar Texto da Coluna Containers na Lista de Pedidos

### Contexto

A página `PurchaseOrders.tsx` exibe uma lista resumida de pedidos. Não há coluna de descrição de produtos (os itens são agrupados por pedido). O único campo que pode conter texto longo é a coluna **Containers**, que extrai informações do campo `notes`.

### Alteração Proposta

Aplicar a mesma técnica de truncamento + tooltip à coluna Containers para manter consistência visual:

#### Arquivo: `src/pages/PurchaseOrders.tsx`

1. **Adicionar imports do Tooltip**:
```typescript
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
```

2. **Modificar a célula Containers** (linhas 305-307):

**De:**
```tsx
<TableCell>
  {extractContainerInfo(order.notes)}
</TableCell>
```

**Para:**
```tsx
<TableCell className="max-w-[150px]">
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-sm line-clamp-1 cursor-help block">
          {extractContainerInfo(order.notes)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm">
        <p className="text-sm whitespace-pre-wrap">
          {extractContainerInfo(order.notes)}
        </p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</TableCell>
```

### Resultado Visual

| Antes | Depois |
|-------|--------|
| `2x 40HC SHCU1234567, SHCU7654321` (texto longo) | `2x 40HC SHCU123...` com tooltip completo |

### Consideração

Se você quiser adicionar uma coluna de resumo/descrição dos produtos do pedido na listagem, posso expandir este plano para incluir essa funcionalidade.

