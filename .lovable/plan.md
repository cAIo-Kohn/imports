
## Plano: Otimizar Histórico de Alterações e Auto-Aprovar Quando Trader Aceita Sugestão

### Problemas Identificados

| Problema | Descrição |
|----------|-----------|
| **Cards Duplicados** | A imagem mostra 3 cards separados para "ETD (Data de Embarque)" quando deveria haver apenas 1 card consolidado |
| **Sem Auto-Aprovação** | Quando o trader define o valor para exatamente o que o buyer sugeriu (2026-05-20), o pedido deveria ser aprovado automaticamente |

### Análise do Histórico Atual

O banco mostra esta sequência para ETD:
```text
1. Trader: 15/05 → 29/05   (16:33) - order_field
2. Buyer: 29/05 → 19/05   (16:46) - buyer_counter_proposal  
3. Trader: 29/05 → 19/05  (16:47) - order_field (aceitou a sugestão!)
```

O trader aceitou a sugestão do buyer (ambos `new_value = 2026-05-20`), então o pedido deveria ir automaticamente para `confirmed`.

---

### Solução Proposta

#### 1. Consolidar Cards - Um Card por Campo/Item

Modificar `OrderChangeSummary.tsx` para:
- Agrupar todas as alterações por `(item_id, field_name)`
- Mostrar apenas **1 card** por campo
- O card mostra: valor original → valor final atual
- Timeline de negociação aparece dentro do mesmo card

```text
ANTES (3 cards):
┌─ ETD: 29/05 → 19/05 (Trader) ─┐
│ Timeline: ...                 │
└───────────────────────────────┘
┌─ ETD: 29/05 → 19/05 (Buyer) ──┐
│ Timeline: ...                 │
└───────────────────────────────┘
┌─ ETD: 15/05 → 29/05 (Trader) ─┐
│ Timeline: ...                 │
└───────────────────────────────┘

DEPOIS (1 card):
┌─ ETD: 15/05 → 19/05 ──────────────────────────────────┐
│                                                        │
│ Timeline:                                              │
│  • Trader 15/05 → 29/05  (26/01 16:33)                │
│  • Buyer sugeriu 19/05   (26/01 16:46)                │
│  • Trader aceitou 19/05  (26/01 16:47) ✅ Acordo!     │
│                                                        │
│ [✓ Aprovado automaticamente]                          │
└────────────────────────────────────────────────────────┘
```

#### 2. Detectar Acordo e Auto-Aprovar

Quando o trader salva um valor igual à sugestão do buyer:
1. **Na hora de salvar** (`TraderHeaderApprovals.updateEtdMutation`):
   - Verificar se `editedEtd === buyerEtdSuggestion`
   - Se sim, marcar automaticamente como aprovado no histórico
   - Se **todos os campos críticos estão em acordo**, aprovar o pedido automaticamente

2. **Lógica de detecção de acordo**:
```typescript
// Para cada campo crítico pendente, verificar se a última alteração do trader
// corresponde à sugestão do buyer
const isAgreed = (timeline: OrderChange[]) => {
  const counterProposal = timeline.find(c => c.change_type === 'buyer_counter_proposal');
  if (!counterProposal) return false;
  
  const lastTraderChange = timeline
    .filter(c => c.change_type !== 'buyer_counter_proposal')
    .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())[0];
  
  return lastTraderChange?.new_value === counterProposal.new_value;
};
```

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `useOrderChanges.ts` | Criar `consolidatedCriticalChanges` que agrupa por campo/item e detecta acordo |
| `OrderChangeSummary.tsx` | Usar alterações consolidadas em vez de `criticalChanges`, mostrar badge de acordo |
| `TraderHeaderApprovals.tsx` | Ao aceitar sugestão do buyer, auto-aprovar e confirmar pedido se aplicável |

---

### Detalhes de Implementação

#### 1. useOrderChanges.ts - Adicionar Consolidação

```typescript
interface ConsolidatedChange {
  key: string;                    // "order-etd" ou "item-uuid-unit_price_usd"
  fieldName: string;
  itemId: string | null;
  originalValue: string | null;   // Primeiro valor antes de qualquer alteração
  currentValue: string | null;    // Último valor
  timeline: OrderChange[];        // Todas as alterações deste campo
  hasCounterProposal: boolean;
  isAgreed: boolean;              // Trader aceitou sugestão do buyer?
  needsApproval: boolean;         // Ainda precisa de aprovação?
}

const consolidatedCriticalChanges = useMemo(() => {
  const result: ConsolidatedChange[] = [];
  
  Object.entries(changeTimeline).forEach(([key, timeline]) => {
    // Filtrar apenas alterações críticas
    const criticalInTimeline = timeline.filter(c => c.is_critical);
    if (criticalInTimeline.length === 0) return;
    
    const [scope, fieldName] = key.split('-');
    const itemId = scope === 'order' ? null : scope;
    
    // Valor original (primeiro old_value da timeline)
    const originalValue = criticalInTimeline[0].old_value;
    
    // Valor atual (último new_value)
    const currentValue = criticalInTimeline[criticalInTimeline.length - 1].new_value;
    
    // Verificar se há contra-proposta
    const counterProposal = criticalInTimeline.find(c => c.change_type === 'buyer_counter_proposal');
    
    // Verificar se o trader aceitou a sugestão
    const isAgreed = (() => {
      if (!counterProposal) return false;
      const lastChange = criticalInTimeline[criticalInTimeline.length - 1];
      return lastChange.change_type !== 'buyer_counter_proposal' && 
             lastChange.new_value === counterProposal.new_value;
    })();
    
    // Se há acordo, não precisa mais de aprovação
    const needsApproval = !isAgreed && criticalInTimeline.some(c => c.requires_approval && !c.approved_by);
    
    result.push({
      key,
      fieldName,
      itemId,
      originalValue,
      currentValue,
      timeline: criticalInTimeline,
      hasCounterProposal: !!counterProposal,
      isAgreed,
      needsApproval,
    });
  });
  
  return result;
}, [changeTimeline]);
```

#### 2. OrderChangeSummary.tsx - Renderizar Cards Consolidados

```typescript
// Em vez de: criticalChanges.map(change => renderChange(change, true))
// Usar: consolidatedCriticalChanges.map(consolidated => renderConsolidatedChange(consolidated))

const renderConsolidatedChange = (consolidated: ConsolidatedChange) => {
  return (
    <div key={consolidated.key} className="py-3 px-4 rounded-lg bg-muted/50 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <span className="font-medium text-sm">
            {formatFieldLabel(consolidated.fieldName)}
          </span>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="line-through">{formatValue(consolidated.fieldName, consolidated.originalValue)}</span>
            <ArrowRight className="h-3 w-3" />
            <span className="text-foreground font-medium">{formatValue(consolidated.fieldName, consolidated.currentValue)}</span>
          </div>
        </div>
        
        {consolidated.isAgreed ? (
          <Badge variant="outline" className="text-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Acordo
          </Badge>
        ) : consolidated.needsApproval ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => approveField(consolidated)}>
              <CheckCircle className="h-4 w-4 mr-1" />
              Aprovar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCounterProposalFor(consolidated.key)}>
              <MessageSquare className="h-4 w-4 mr-1" />
              Sugerir
            </Button>
          </div>
        ) : (
          <Badge variant="outline" className="text-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Aprovado
          </Badge>
        )}
      </div>

      {/* Timeline sempre visível dentro do card */}
      <NegotiationTimeline changes={consolidated.timeline} fieldName={consolidated.fieldName} />
    </div>
  );
};
```

#### 3. TraderHeaderApprovals.tsx - Auto-Aprovar Quando Aceita Sugestão

```typescript
const updateEtdMutation = useMutation({
  mutationFn: async () => {
    const oldEtd = order.etd || suggestedEtd;
    
    // 1. Atualizar ETD
    const { error } = await supabase
      .from('purchase_orders')
      .update({ etd: editedEtd || null })
      .eq('id', order.id);
    if (error) throw error;

    // 2. Registrar alteração
    if (oldEtd !== editedEtd) {
      await logChange({
        orderId: order.id,
        changeType: 'order_field',
        fieldName: 'etd',
        oldValue: oldEtd,
        newValue: editedEtd || null,
        isCritical: true,
      });
    }

    // 3. NOVO: Verificar se aceitou a sugestão do buyer
    if (buyerEtdSuggestion && editedEtd === buyerEtdSuggestion) {
      // Marcar todas as alterações de ETD como aprovadas
      const etdChanges = changeTimeline['order-etd'] || [];
      for (const change of etdChanges) {
        if (change.requires_approval && !change.approved_by) {
          await supabase
            .from('purchase_order_change_history')
            .update({
              approved_by: user?.id,
              approved_at: new Date().toISOString(),
              requires_approval: false,
            })
            .eq('id', change.id);
        }
      }

      // Verificar se todos os campos críticos estão resolvidos
      const remainingPending = pendingApprovalChanges.filter(
        c => c.field_name !== 'etd'
      );
      
      if (remainingPending.length === 0) {
        // Todos resolvidos! Auto-confirmar pedido
        await supabase
          .from('purchase_orders')
          .update({
            status: 'confirmed',
            requires_buyer_approval: false,
          })
          .eq('id', order.id);
      }
    }
  },
  onSuccess: () => {
    const accepted = buyerEtdSuggestion && editedEtd === buyerEtdSuggestion;
    toast({ 
      title: accepted 
        ? 'Sugestão do Buyer aceita! Pedido confirmado.'
        : 'ETD atualizado!' 
    });
    setIsEditingEtd(false);
    onOrderUpdated();
  },
});
```

---

### NegotiationTimeline.tsx - Indicar Acordo

Adicionar indicador visual quando houver acordo:

```typescript
{isAgreed && (
  <div className="flex items-center gap-1 text-green-600 text-xs mt-1">
    <CheckCircle className="h-3 w-3" />
    Trader aceitou a sugestão do Buyer
  </div>
)}
```

---

### Resultado Final

| Situação | Antes | Depois |
|----------|-------|--------|
| Múltiplas alterações no mesmo campo | 3 cards separados | 1 card consolidado |
| Contador de pendentes | Conta cada registro individualmente | Conta por campo/item |
| Trader aceita sugestão do buyer | Pedido fica em pending_buyer_approval | Auto-confirma e mostra badge "Acordo" |
| Timeline de negociação | Repetida em cada card | Uma única timeline dentro do card consolidado |

---

### Fluxo Atualizado

```text
┌──────────────────┐
│ Trader sugere    │
│ ETD: 30/05       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Buyer contra-    │
│ propõe: 20/05    │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│ Trader aceita 20/05?                      │
│                                           │
│   SIM → Auto-aprova + confirma pedido     │
│   NÃO → Propõe novo valor → volta buyer   │
└───────────────────────────────────────────┘
```
