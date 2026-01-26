

## Plano: Editar Quantidade de Produtos no Simulador de Pedidos

### Objetivo
Permitir editar a quantidade de peças de cada produto diretamente dentro da tabela do simulador de pedidos. Ao alterar a quantidade, o sistema deve atualizar automaticamente o campo "Chegada" na tabela de projeção do produto correspondente.

### Arquitetura Atual

O fluxo de dados atual funciona assim:

```
SupplierPlanning.tsx
       │
       ├── pendingArrivals (estado principal)
       ├── pendingArrivalsInput (valores de input)
       │
       ├──▶ ProductProjectionCard
       │         │
       │         └──▶ ArrivalInput (edita pendingArrivals)
       │
       └──▶ OrderSimulationFooter
                 │
                 ├── Recebe: pendingArrivals (leitura)
                 ├── Recebe: onUpdateArrivals (escrita em lote)
                 └── Exibe: Quantidade (somente leitura atualmente)
```

### Solução

Adicionar um input editável na coluna "Qtd" da tabela do simulador que:
1. Permite editar a quantidade diretamente
2. Usa o mesmo `onUpdateArrivals` callback para atualizar o estado pai
3. Aplica arredondamento para caixa master ao sair do campo (blur)

---

### 1. Criar Componente QuantityInput

**Novo arquivo**: `src/components/planning/SimulatorQuantityInput.tsx`

Componente similar ao `ArrivalInput`, mas simplificado para o contexto do simulador:

```tsx
interface SimulatorQuantityInputProps {
  productId: string;
  monthKey: string;
  value: number;
  qtyMasterBox: number | null;
  onUpdate: (productId: string, monthKey: string, newValue: number) => void;
}
```

**Comportamento**:
- Clique para entrar em modo de edição
- Digite a quantidade desejada
- Ao sair (blur) ou pressionar Enter:
  - Arredonda para caixa master se `qtyMasterBox` estiver definido
  - Chama `onUpdate` com o novo valor
- Permite zerar/remover item digitando 0

---

### 2. Atualizar OrderSimulationFooter

**Arquivo**: `src/components/planning/OrderSimulationFooter.tsx`

**Mudança na tabela de itens** (linhas 686-719):

```tsx
// Antes: Exibição somente leitura
<TableCell className="text-right text-sm py-1.5 px-3">
  {item.quantity.toLocaleString('pt-BR')}
</TableCell>

// Depois: Input editável
<TableCell className="text-right py-1.5 px-3">
  <SimulatorQuantityInput
    productId={item.productId}
    monthKey={draft.monthKey}
    value={item.quantity}
    qtyMasterBox={products.find(p => p.id === item.productId)?.qty_master_box || null}
    onUpdate={handleQuantityUpdate}
  />
</TableCell>
```

**Nova função handleQuantityUpdate**:

```tsx
const handleQuantityUpdate = useCallback((productId: string, monthKey: string, newValue: number) => {
  if (!onUpdateArrivals) return;
  
  const key = `${productId}::${monthKey}`;
  
  if (newValue <= 0) {
    // Remover item: setar para 0 efetivamente remove do pendingArrivals
    onUpdateArrivals({ [key]: 0 });
  } else {
    onUpdateArrivals({ [key]: newValue });
  }
}, [onUpdateArrivals]);
```

---

### 3. Atualizar Callback onUpdateArrivals

**Arquivo**: `src/pages/SupplierPlanning.tsx`

**Função updateMultipleArrivals** (linhas 318-327):

Precisa suportar valores zero para remoção:

```tsx
const updateMultipleArrivals = useCallback((updates: Record<string, number>) => {
  setPendingArrivals(prev => {
    const updated = { ...prev };
    Object.entries(updates).forEach(([key, value]) => {
      if (value <= 0) {
        delete updated[key]; // Remove se valor for 0 ou negativo
      } else {
        updated[key] = value;
      }
    });
    return updated;
  });
  
  setPendingArrivalsInput(prev => {
    const updated = { ...prev };
    Object.entries(updates).forEach(([key, value]) => {
      if (value <= 0) {
        delete updated[key];
      } else {
        updated[key] = value.toString();
      }
    });
    return updated;
  });
}, []);
```

---

### Interface Visual Resultada

```
┌─────────────────────────────────────────────────────────────────────┐
│ Produto      │ ETD       │ Qtd         │ Caixas │ CBM    │ Valor   │
├──────────────┼───────────┼─────────────┼────────┼────────┼─────────┤
│ 001480       │ 02/05/26  │ [9.656]     │ 120    │ 35.88  │ $890.00 │
│ Desc texto   │           │ ← clicável  │        │        │         │
│ 001488       │ 02/05/26  │ [41.472]    │ 864    │ 0.07   │ $1.2k   │
│ ...          │           │ ← edita     │        │        │         │
└─────────────────────────────────────────────────────────────────────┘

Ao editar Qtd no simulador:
  1. Valor atualiza no simulador ✓
  2. Campo "Chegada" na tabela de projeção atualiza ✓
  3. Cálculos de CBM/Valor/Containers recalculam ✓
  4. Saldo projetado recalcula ✓
```

---

### Fluxo de Dados Após Implementação

```
Usuário edita "Qtd" no simulador
         │
         ▼
SimulatorQuantityInput.onUpdate()
         │
         ▼
OrderSimulationFooter.handleQuantityUpdate()
         │
         ▼
onUpdateArrivals({ "productId::monthKey": newValue })
         │
         ▼
SupplierPlanning.updateMultipleArrivals()
         │
         ├──▶ setPendingArrivals() ──▶ Recalcula ordersByMonth no Footer
         │                                     │
         │                                     ▼
         │                              UI do Simulador atualiza
         │
         └──▶ setPendingArrivalsInput() ──▶ ArrivalInput sincroniza
                                                   │
                                                   ▼
                                            Tabela de Projeção atualiza
```

---

### Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| `src/components/planning/SimulatorQuantityInput.tsx` | **Criar** - Novo componente de input |
| `src/components/planning/OrderSimulationFooter.tsx` | **Modificar** - Usar SimulatorQuantityInput na tabela |
| `src/pages/SupplierPlanning.tsx` | **Modificar** - Ajustar updateMultipleArrivals para suportar remoção |

---

### Detalhes Técnicos

**SimulatorQuantityInput.tsx**:

```tsx
import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';

interface SimulatorQuantityInputProps {
  productId: string;
  monthKey: string;
  value: number;
  qtyMasterBox: number | null;
  onUpdate: (productId: string, monthKey: string, newValue: number) => void;
}

export const SimulatorQuantityInput = memo(function SimulatorQuantityInput({
  productId,
  monthKey,
  value,
  qtyMasterBox,
  onUpdate,
}: SimulatorQuantityInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync when external value changes
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value.toString());
    }
  }, [value, isEditing]);

  // Focus on edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  }, []);

  const commitValue = useCallback(() => {
    setIsEditing(false);
    let numValue = parseInt(localValue) || 0;
    
    // Round up to master box if applicable
    if (numValue > 0 && qtyMasterBox && qtyMasterBox > 0) {
      const boxes = Math.ceil(numValue / qtyMasterBox);
      numValue = boxes * qtyMasterBox;
    }
    
    setLocalValue(numValue.toString());
    onUpdate(productId, monthKey, numValue);
  }, [localValue, qtyMasterBox, productId, monthKey, onUpdate]);

  const handleBlur = useCallback(() => {
    commitValue();
  }, [commitValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter' || e.key === 'Escape') {
      commitValue();
    }
  }, [commitValue]);

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        min="0"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="w-20 h-7 text-sm text-right p-1"
      />
    );
  }

  return (
    <div 
      className="cursor-pointer hover:bg-muted/50 rounded px-2 py-1 text-right text-sm transition-colors"
      onClick={handleClick}
    >
      {value.toLocaleString('pt-BR')}
    </div>
  );
});
```

---

### Benefícios

1. **Edição bidirecional**: Pode editar tanto na tabela de projeção quanto no simulador
2. **Sincronização automática**: Um único estado (`pendingArrivals`) alimenta ambas as views
3. **Arredondamento consistente**: Mesma lógica de master box em ambos os lugares
4. **Remoção de itens**: Digitar 0 remove o produto do pedido simulado
5. **UX fluida**: Clique para editar, Enter/blur para confirmar

