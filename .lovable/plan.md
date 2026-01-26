

## Plano: Permitir Réplica do Comprador com Contra-Proposta

### Situação Atual

1. **Pedido em `pending_buyer_approval`**: Trader alterou ETD (15/05 → 30/05) e preço de um item
2. **Interface atual**: Comprador só pode aprovar ou aprovar todas as alterações
3. **Falta**: Opção de sugerir novo ETD ou preço e devolver ao trader

---

### Solução Proposta

Adicionar funcionalidade de **contra-proposta** no componente `OrderChangeSummary.tsx`:

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ⚠️ ETD (Data de Embarque)                                                       │
│   15/05/2026 → 30/05/2026   (26/01 às 16:33)                                   │
│                                                                                 │
│   [Aprovar]  [Sugerir Alteração]                                               │
│                                                                                 │
│   ┌─ Contra-proposta (ao clicar "Sugerir") ─────────────────────────────────┐  │
│   │  Sugerir ETD: [____22/05/2026____]                                      │  │
│   │  Justificativa: [____________________________________]                  │  │
│   │                                    [Cancelar] [Enviar ao Trader]        │  │
│   └──────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘

[Aprovar Todas e Confirmar]   [Devolver ao Trader com Contra-propostas]
```

---

### Fluxo de Trabalho

```text
┌──────────────┐    Aprova todas     ┌─────────────┐
│  Buyer vê    │──────────────────▶  │  confirmed  │
│  mudanças    │                     └─────────────┘
│              │
│ pending_     │    Faz contra-      ┌─────────────────────┐
│ buyer_       │──────proposta──────▶│ pending_trader_     │
│ approval     │                     │ review              │
└──────────────┘                     │ (com histórico      │
                                     │  das negociações)   │
                                     └─────────────────────┘
                                              │
                                              ▼
                                     Trader vê proposta do
                                     buyer + histórico
```

---

### Alterações Necessárias

| Arquivo | Alteração |
|---------|-----------|
| `OrderChangeSummary.tsx` | Adicionar botão "Sugerir Alteração" e formulário de contra-proposta |
| `useOrderChanges.ts` | Adicionar função `logCounterProposal` para registrar contra-propostas |
| RLS `purchase_order_change_history` | Permitir buyers inserir registros de contra-proposta |

---

### Detalhes de Implementação

#### 1. Novo tipo de mudança: `buyer_counter_proposal`

Registrar contra-propostas como um novo `change_type`:
```typescript
change_type: 'buyer_counter_proposal'
field_name: 'etd' | 'unit_price_usd'
old_value: valor proposto pelo trader
new_value: valor sugerido pelo buyer
is_critical: true
requires_approval: true  // Trader precisa aceitar ou negociar
```

#### 2. OrderChangeSummary.tsx - Nova Interface

Adicionar para cada alteração crítica pendente:
```typescript
interface CounterProposalState {
  changeId: string;
  field: string;
  suggestedValue: string;
  justification: string;
}

const [counterProposal, setCounterProposal] = useState<CounterProposalState | null>(null);

// Para cada alteração crítica, mostrar opção de contra-proposta
{showApproval && change.requires_approval && !change.approved_by && (
  <div className="flex gap-2">
    <Button size="sm" variant="outline" onClick={() => approveMutation.mutate(change.id)}>
      <CheckCircle className="h-4 w-4 mr-1" />
      Aprovar
    </Button>
    <Button size="sm" variant="ghost" onClick={() => openCounterProposal(change)}>
      <MessageSquare className="h-4 w-4 mr-1" />
      Sugerir Alteração
    </Button>
  </div>
)}

// Modal/Inline form para contra-proposta
{counterProposal?.changeId === change.id && (
  <div className="mt-2 p-3 border rounded-lg bg-background space-y-2">
    <Label>Valor sugerido:</Label>
    {change.field_name === 'etd' ? (
      <Input type="date" value={counterProposal.suggestedValue} onChange={...} />
    ) : (
      <Input type="number" step="0.01" value={counterProposal.suggestedValue} onChange={...} />
    )}
    <Label>Justificativa (opcional):</Label>
    <Textarea value={counterProposal.justification} onChange={...} />
    <div className="flex gap-2 justify-end">
      <Button variant="ghost" onClick={() => setCounterProposal(null)}>Cancelar</Button>
      <Button onClick={submitCounterProposal}>Enviar ao Trader</Button>
    </div>
  </div>
)}
```

#### 3. Ação "Devolver ao Trader"

Quando há contra-propostas pendentes:
```typescript
const returnToTraderMutation = useMutation({
  mutationFn: async () => {
    // 1. Atualizar status do pedido
    const { error } = await supabase
      .from('purchase_orders')
      .update({ 
        status: 'pending_trader_review',
        requires_buyer_approval: false,
        // Resetar aprovações do trader para forçar revisão
        trader_etd_approved: false,
        trader_prices_approved: false,
        trader_quantities_approved: false,
      })
      .eq('id', orderId);
    
    if (error) throw error;
  },
  onSuccess: () => {
    toast({ title: 'Pedido devolvido ao trader com suas sugestões!' });
    queryClient.invalidateQueries({ queryKey: ['purchase-order', orderId] });
  },
});
```

#### 4. Visualização do Histórico Completo

Modificar a query para mostrar toda a cadeia de negociação:
```typescript
// Agrupar mudanças por campo para mostrar linha do tempo
const changeTimeline = useMemo(() => {
  const grouped: Record<string, OrderChange[]> = {};
  changes.forEach(c => {
    const key = `${c.purchase_order_item_id || 'order'}-${c.field_name}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  });
  return grouped;
}, [changes]);

// Renderizar como timeline
<div className="space-y-1 text-xs text-muted-foreground">
  {changeTimeline[key]?.map((c, i) => (
    <div key={c.id} className="flex items-center gap-2">
      {c.change_type === 'buyer_counter_proposal' ? (
        <Badge variant="secondary">Buyer sugeriu</Badge>
      ) : (
        <Badge variant="outline">Trader alterou</Badge>
      )}
      <span>{c.old_value} → {c.new_value}</span>
      <span>{format(new Date(c.changed_at), "dd/MM HH:mm")}</span>
    </div>
  ))}
</div>
```

#### 5. RLS para Buyers inserirem contra-propostas

Adicionar política de INSERT para admins e buyers:
```sql
CREATE POLICY "Admins and buyers can insert counter proposals"
ON public.purchase_order_change_history
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'buyer'::app_role)
);
```

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/orders/OrderChangeSummary.tsx` | Interface de contra-proposta + botão devolver ao trader |
| `src/hooks/useOrderChanges.ts` | Função `logCounterProposal` |
| `src/components/orders/TraderHeaderApprovals.tsx` | Mostrar contra-propostas do buyer quando pedido volta |
| Migration SQL | Política RLS para buyers inserirem no histórico |

---

### Visualização no Trader (quando pedido volta)

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 📋 Histórico de Negociação - ETD                                               │
│ ──────────────────────────────────────────────────────────────────────────────  │
│ • Trader: 15/05/2026 → 30/05/2026  (26/01 16:33)  "ETD original muito cedo"    │
│ • Buyer sugeriu: 22/05/2026        (26/01 18:45)  "Precisamos antes de junho"  │
│                                                                                 │
│ ☐ ETD: [____22/05/2026____] (sugerido pelo buyer)  ✏️                          │
│                                                                                 │
│ [Aceitar sugestão do Buyer]  ou  [Propor outro valor]                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### Resumo das Entregas

1. **Botão "Sugerir Alteração"** para cada campo crítico pendente
2. **Formulário inline** para inserir contra-proposta com justificativa
3. **Botão "Devolver ao Trader"** que muda status para `pending_trader_review`
4. **Histórico visual** mostrando toda a cadeia de negociação
5. **Visão do Trader atualizada** para ver sugestões do buyer e aceitar/negociar

