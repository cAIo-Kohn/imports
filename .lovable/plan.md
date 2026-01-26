

## Plano: Corrigir Erro "null value in column 'unit_id'" ao Criar Pedido

### Diagnóstico do Problema

O erro ocorre porque:

1. **Banco de dados**: A coluna `unit_id` na tabela `purchase_order_items` tem constraint `NOT NULL`
2. **Código**: No `OrderSimulationFooter.tsx` (linha 358), quando `selectedUnit === 'all'`, o código define `unit_id: null`
3. **Estado inicial**: O estado `selectedUnit` em `SupplierPlanning.tsx` é inicializado como `'all'` (linha 89)

```tsx
// Problema no OrderSimulationFooter.tsx:358
unit_id: selectedUnit !== 'all' ? selectedUnit : null,  // ← null viola NOT NULL
```

### Solução

Há duas abordagens possíveis:

**Opção A (Recomendada)**: Exigir seleção de unidade antes de criar pedido
- Adicionar validação no momento de criar o pedido
- Mostrar mensagem clara para o usuário

**Opção B**: Definir unidade padrão
- Usar "Matriz" como unidade default quando não selecionada
- Pode não ser o comportamento desejado em todos os casos

Vou implementar a **Opção A** pois é mais segura e explícita.

---

### Mudanças Necessárias

#### 1. Adicionar Validação no createOrderMutation

**Arquivo**: `src/components/planning/OrderSimulationFooter.tsx`

**Linhas 319-324** - Adicionar validação para `unit_id`:

```tsx
const createOrderMutation = useMutation({
  mutationFn: async (draft: OrderDraft) => {
    if (!user) throw new Error('Usuário não autenticado');
    if (draft.items.length === 0) throw new Error('Nenhum item para criar pedido');
    if (!selectedSupplier || selectedSupplier === 'all') throw new Error('Selecione um fornecedor');
    if (!selectedUnit || selectedUnit === 'all') throw new Error('Selecione uma unidade de destino para criar o pedido');
    // ... resto do código
```

#### 2. Atualizar a lógica de unit_id

**Linha 358** - Remover condição ternária já que a validação garante que `selectedUnit !== 'all'`:

```tsx
// Antes:
unit_id: selectedUnit !== 'all' ? selectedUnit : null,

// Depois:
unit_id: selectedUnit,  // Já validado acima que não é 'all'
```

---

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/planning/OrderSimulationFooter.tsx` | Adicionar validação e simplificar atribuição de `unit_id` |

---

### Comportamento Esperado Após Correção

1. Se o usuário tentar criar um pedido com "Todas as unidades" selecionado:
   - Exibe mensagem de erro: "Selecione uma unidade de destino para criar o pedido"
   - Pedido não é criado

2. Se o usuário selecionar uma unidade específica (Matriz, Filial PE, Filial RJ):
   - Pedido é criado com sucesso
   - `unit_id` é preenchido corretamente

