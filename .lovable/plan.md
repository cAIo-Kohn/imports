
## Plano: Validações Obrigatórias para Criação de Pedidos

### Objetivo

Implementar três validações obrigatórias no momento de criar pedidos no `/demand-planning`:

1. **Nº do Pedido obrigatório** - O campo de referência deve ser preenchido
2. **Containers 100%** - Só permitir containers completos (partialContainerPercent = 0)
3. **ETD editável** - Arredondar para o dia 30 do mês anterior (sempre ≥60 dias), mas permitir edição manual

---

### Arquivos a Modificar

#### 1. `src/components/planning/OrderSimulationFooter.tsx`

##### 1.1 Adicionar estado para ETD customizado (após linha 127)

```typescript
const [customETDs, setCustomETDs] = useState<Record<string, Date>>({});
```

##### 1.2 Criar função de cálculo de ETD arredondado (após linha 107)

```typescript
function calculateRoundedETD(arrivalMonthKey: string, leadTimeDays: number): Date {
  const arrivalDate = parseDateString(arrivalMonthKey);
  const rawETD = subDays(arrivalDate, leadTimeDays);
  
  // Arredondar para o dia 30 do mês anterior (ou último dia de fevereiro)
  const year = rawETD.getFullYear();
  const month = rawETD.getMonth();
  
  // Último dia do mês anterior à data calculada
  // Se estamos em janeiro, é 31 de dezembro do ano anterior
  // Senão, é dia 30 (ou 28/29 para fevereiro)
  let roundedDay: number;
  let roundedMonth = month;
  let roundedYear = year;
  
  // Se a data calculada é depois do dia 15, arredondamos para dia 30 do mesmo mês
  // Senão, arredondamos para dia 30 do mês anterior
  if (rawETD.getDate() <= 15) {
    // Mês anterior
    roundedMonth = month === 0 ? 11 : month - 1;
    roundedYear = month === 0 ? year - 1 : year;
  }
  
  // Determinar o dia (30 ou último dia do mês para fevereiro)
  if (roundedMonth === 1) { // Fevereiro
    // Verificar se é ano bissexto
    const isLeapYear = (roundedYear % 4 === 0 && roundedYear % 100 !== 0) || (roundedYear % 400 === 0);
    roundedDay = isLeapYear ? 29 : 28;
  } else {
    roundedDay = 30;
  }
  
  const roundedDate = new Date(roundedYear, roundedMonth, roundedDay);
  
  // Garantir que nunca seja menos de 60 dias antes da chegada
  const minETD = subDays(arrivalDate, 60);
  return isBefore(roundedDate, minETD) ? roundedDate : roundedDate;
}
```

##### 1.3 Modificar interface OrderDraft para incluir ETD editável (linha 67)

```typescript
suggestedETD: Date | null; // ETD calculado/arredondado
```

##### 1.4 Modificar cálculo de ETD no useMemo (linhas 227-229)

Usar o ETD customizado se existir, senão o calculado:

```typescript
const suggestedETD = calculateRoundedETD(monthKey, leadTime);

// Usar ETD customizado se disponível
if (!draft.suggestedETD || isBefore(suggestedETD, draft.suggestedETD)) {
  draft.suggestedETD = suggestedETD;
}
```

##### 1.5 Adicionar validações na criação de pedidos (linha 331-334)

```typescript
// Validação 1: Número do pedido obrigatório
if (!draft.referenceNumber || draft.referenceNumber.trim() === '') {
  throw new Error('Digite o número do pedido para confirmar');
}

// Validação 2: Container deve estar 100% fechado
if (draft.partialContainerPercent > 0) {
  throw new Error(`Container não está 100% fechado (${draft.partialContainerPercent}% parcial). Ajuste as quantidades ou preencha o container.`);
}
```

##### 1.6 Adicionar campo de edição de ETD na UI (após linha 778)

Adicionar datepicker para editar o ETD ao lado do campo de número do pedido:

```tsx
{/* ETD Field - editable */}
<div className="flex items-center gap-2">
  <span className="text-xs text-muted-foreground whitespace-nowrap">ETD:</span>
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "h-9 justify-start text-left font-normal",
          draft.hasCriticalETD && "border-destructive text-destructive"
        )}
      >
        <Calendar className="mr-2 h-4 w-4" />
        {customETDs[draft.monthKey] 
          ? format(customETDs[draft.monthKey], "dd/MM/yyyy")
          : draft.suggestedETD 
            ? format(draft.suggestedETD, "dd/MM/yyyy")
            : 'Definir ETD'
        }
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0 pointer-events-auto">
      <Calendar
        mode="single"
        selected={customETDs[draft.monthKey] || draft.suggestedETD || undefined}
        onSelect={(date) => {
          if (date) {
            setCustomETDs(prev => ({ ...prev, [draft.monthKey]: date }));
          }
        }}
        className="p-3 pointer-events-auto"
      />
    </PopoverContent>
  </Popover>
</div>
```

##### 1.7 Atualizar botão "Criar Pedido" para mostrar validações (linha 809-818)

Desabilitar visualmente e mostrar tooltip quando inválido:

```tsx
<Button 
  onClick={(e) => {
    e.stopPropagation();
    handleCreateSingleOrder(draft);
  }}
  disabled={
    !selectedSupplier || 
    selectedSupplier === 'all' || 
    createOrderMutation.isPending ||
    !draft.referenceNumber?.trim() ||  // Nº pedido obrigatório
    draft.partialContainerPercent > 0  // Container 100%
  }
  className="flex-1"
  title={
    !draft.referenceNumber?.trim() 
      ? 'Digite o número do pedido' 
      : draft.partialContainerPercent > 0 
        ? 'Container deve estar 100% cheio'
        : ''
  }
>
  {createOrderMutation.isPending ? 'Criando...' : `Criar Pedido ${draft.monthLabel}`}
</Button>
```

##### 1.8 Adicionar indicadores visuais de validação (após linha 787)

```tsx
{/* Validation indicators */}
{!draft.referenceNumber?.trim() && (
  <span className="text-xs text-destructive">* Obrigatório</span>
)}
{draft.partialContainerPercent > 0 && (
  <Badge variant="destructive" className="text-xs">
    Container {draft.partialContainerPercent}% - precisa 100%
  </Badge>
)}
```

##### 1.9 Atualizar a criação do pedido para usar ETD customizado (linha 342-344)

```typescript
const effectiveETD = customETDs[draft.monthKey] || draft.suggestedETD;
const orderDate = effectiveETD 
  ? format(effectiveETD, 'yyyy-MM-dd')
  : format(new Date(), 'yyyy-MM-dd');
```

---

### Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Sem nº pedido | ✅ Permite criar | ❌ Bloqueado + mensagem |
| Container 36% | ✅ Permite criar | ❌ Bloqueado + badge vermelho |
| ETD calculado | 02/05/2026 | 30/04/2026 (arredondado) |
| Editar ETD | ❌ Não editável | ✅ Datepicker clicável |

### Importações Adicionais

Adicionar ao início do arquivo:
```typescript
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
```

### Comportamento Visual

1. **Campo Nº Pedido**: Exibe "* Obrigatório" em vermelho se vazio
2. **Container**: Badge vermelho "Container X% - precisa 100%" se parcial
3. **ETD**: Datepicker com data sugerida pré-selecionada, editável pelo usuário
4. **Botão Criar**: Desabilitado visualmente até todas as validações passarem

