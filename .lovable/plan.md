

## Plano: Simplificar Header - Apenas ETD + Sugestão Automática

### Problema Identificado

1. **Header muito complexo**: Atualmente exibe 3 aprovações (ETD, Preços, Quantidades)
2. **ETD não está pré-populado**: O campo `etd` no pedido está `null`, mas a lógica de cálculo já existe e está registrada nas notas do pedido
3. **Regra de ETD não implementada corretamente**: O sistema calcula ETD subtraindo dias do primeiro dia do mês, mas deveria usar dia 15 ou 30

### Solução Proposta

#### 1. Simplificar o TraderHeaderApprovals

Remover os checkboxes de "Preços" e "Quantidades" do header, mantendo apenas:
- **ETD**: Com opção de editar ou aprovar o ETD sugerido
- **Botão "Confirmar Pedido"**: Habilitado quando o ETD foi aprovado

#### 2. Calcular ETD Sugerido Automaticamente

Quando o trader abrir o pedido e o `etd` estiver vazio:
- Calcular 60 dias antes do mês de chegada desejado
- Usar **dia 15** se a data resultante cair na primeira metade do mês
- Usar **dia 30** (ou último dia do mês) se cair na segunda metade
- Exemplo: Chegada em Julho 2026 → ETD sugerido: **15/05/2026** ou **30/05/2026**

#### 3. Atualizar Lógica de Submissão

A aprovação do trader agora requer apenas:
- ETD aprovado (obrigatório)
- Todas as aprovações de preço e quantidade por item (opcional, mas visível)

---

### Alterações Necessárias

| Arquivo | Alteração |
|---------|-----------|
| `TraderHeaderApprovals.tsx` | Remover checkboxes de Preços e Qtd, manter apenas ETD + calcular sugestão automática |
| `PurchaseOrderDetails.tsx` | Ajustar props passadas ao TraderHeaderApprovals |

---

### Detalhes de Implementação

#### TraderHeaderApprovals.tsx - Nova Estrutura

```
┌────────────────────────────────────────────────────────────────────────┐
│ ☐ ETD: 15/05/2026 (sugerido) ✏️          │ Preços: $75,033 (4/9 OK)  │
│                                           │ Qtd: 803,241 pcs (4/9 OK) │
│                                           │      [Confirmar Pedido]   │
└────────────────────────────────────────────────────────────────────────┘
```

**Visual:**
- ETD com checkbox de aprovação + botão de edição
- Preços e Quantidades como **informação apenas** (sem checkbox)
- Progresso de aprovação por item mostrado mas não bloqueante

#### Lógica de ETD Sugerido

```typescript
function calculateSuggestedEtd(expectedArrival: string): string {
  // expectedArrival é no formato YYYY-MM-DD (ex: 2026-07-01)
  const arrivalDate = new Date(expectedArrival);
  
  // Subtrair 60 dias
  const suggestedDate = subDays(arrivalDate, 60);
  
  // Normalizar para dia 15 ou 30 (último dia do mês)
  const day = suggestedDate.getDate();
  const year = suggestedDate.getFullYear();
  const month = suggestedDate.getMonth();
  
  if (day <= 15) {
    // Usar dia 15
    return format(new Date(year, month, 15), 'yyyy-MM-dd');
  } else {
    // Usar último dia do mês (30 ou 31 ou 28/29)
    const lastDay = new Date(year, month + 1, 0).getDate();
    return format(new Date(year, month, lastDay), 'yyyy-MM-dd');
  }
}
```

**Exemplo prático:**
- Chegada: **01/07/2026**
- 60 dias antes: **02/05/2026**
- Dia 2 ≤ 15 → ETD sugerido: **15/05/2026**

#### Modificações no TraderHeaderApprovals.tsx

1. **Adicionar prop para data de chegada mais antiga**:
```typescript
interface TraderHeaderApprovalsProps {
  order: PurchaseOrder;
  totalValue: number;
  totalQuantity: number;
  itemsCount: number;
  itemsWithPriceApproved: number;
  itemsWithQtyApproved: number;
  earliestArrival: string | null;  // NOVO: Data de chegada mais antiga dos itens
  onOrderUpdated: () => void;
}
```

2. **Calcular ETD sugerido ao montar componente**:
```typescript
const suggestedEtd = useMemo(() => {
  if (order.etd) return order.etd;
  if (!earliestArrival) return '';
  return calculateSuggestedEtd(earliestArrival);
}, [order.etd, earliestArrival]);
```

3. **Remover seções de Preços e Quantidades com checkbox**, mostrar apenas como texto informativo

4. **Atualizar condição de habilitação do botão**:
```typescript
// Antes: allApproved = etd && prices && quantities
// Depois: apenas ETD é obrigatório
const canSubmit = order.trader_etd_approved;
```

---

### Fluxo Atualizado

1. **Trader abre pedido** `pending_trader_review`
2. Vê **ETD sugerido** calculado automaticamente (baseado na chegada)
3. Pode **editar o ETD** se necessário (gera alteração crítica)
4. Marca checkbox **ETD aprovado**
5. Vê progresso de aprovações por item (preços: 4/9, qtd: 4/9) como informação
6. Clica **Confirmar Pedido**
   - Se houve alteração crítica (ETD modificado) → `pending_buyer_approval`
   - Se não → `confirmed`

---

### Layout Final

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ☐ 📅 ETD: 15/05/2026 ✏️ ✓      │  $ Preços: $75,033 (4/9)  │ [Confirmar   │
│   (sugerido: 60d antes chegada)│  📦 Qtd: 803k pcs (4/9)   │    Pedido]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Legenda visual:**
- ☐ = Checkbox de aprovação (apenas ETD)
- ✏️ = Botão de edição (apenas ETD)
- ✓ = Ícone verde quando aprovado
- Preços e Qtd = Apenas informação, sem interação

---

### Código Detalhado

#### PurchaseOrderDetails.tsx - Calcular earliestArrival

```typescript
// Calcular data de chegada mais antiga entre os itens
const earliestArrival = useMemo(() => {
  if (!items.length) return null;
  const arrivals = items
    .filter((item: any) => item.expected_arrival)
    .map((item: any) => item.expected_arrival);
  if (!arrivals.length) return null;
  return arrivals.sort()[0]; // Mais antiga (ordem crescente)
}, [items]);

// Passar para o componente
<TraderHeaderApprovals 
  order={order}
  totalValue={totalValue}
  totalQuantity={totalQuantity}
  itemsCount={items.length}
  itemsWithPriceApproved={itemsWithPriceApproved}
  itemsWithQtyApproved={itemsWithQtyApproved}
  earliestArrival={earliestArrival}
  onOrderUpdated={() => queryClient.invalidateQueries({ queryKey: ['purchase-order', id] })}
/>
```

#### TraderHeaderApprovals.tsx - Estrutura Simplificada

A seção de Preços e Quantidades será transformada em texto informativo (badges) sem checkbox de aprovação geral, focando a atenção do trader no ETD.

