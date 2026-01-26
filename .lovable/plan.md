

## Plano: Correção do Bug Visual do Simulador + Lógica Automática de Unidade

### Problema 1: Bug Visual - Números Aparecendo Atrás das Abas

No screenshot, o número "14" aparece parcialmente visível atrás/sobreposto à aba "jul/26". O problema está no `Badge` dentro do `TabsTrigger`:

```tsx
<TabsTrigger>
  <Calendar className="h-3 w-3 mr-1.5" />
  {draft.monthLabel}
  <Badge variant="outline" className="ml-1.5 px-1.5 py-0 text-xs">
    {draft.items.length}
  </Badge>
</TabsTrigger>
```

A causa provável é que o `TabsList` com `bg-transparent` está permitindo que elementos de abas adjacentes fiquem visíveis por trás da aba ativa, especialmente quando há navegação horizontal (setas de scroll).

**Solução**: Adicionar `relative z-10` ao TabsTrigger ativo e garantir que os badges tenham fundo opaco.

---

### Problema 2: Unidade Definida pelo Cadastro do Produto

Atualmente, a unidade é selecionada manualmente pelo usuário no filtro de SupplierPlanning. A nova lógica deve ser:

1. Buscar quais unidades estão vinculadas aos produtos do fornecedor via `product_units`
2. Se TODOS os produtos têm apenas 1 unidade comum -> usar automaticamente
3. Se há produtos com múltiplas unidades -> mostrar seletor para escolher

---

## Arquivos a Modificar

### 1. `src/components/planning/OrderSimulationFooter.tsx`

#### 1.1 Corrigir TabsTrigger (linhas 661-681)

**De:**
```tsx
<TabsTrigger
  key={draft.monthKey}
  value={draft.monthKey}
  className={cn(
    "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
    "px-3 py-1.5 text-sm rounded-t-md border-b-2 border-transparent",
    "data-[state=active]:border-primary",
    draft.hasCriticalETD && "text-destructive data-[state=active]:bg-destructive"
  )}
>
  <Calendar className="h-3 w-3 mr-1.5" />
  {draft.monthLabel}
  <Badge variant="outline" className="ml-1.5 px-1.5 py-0 text-xs">
    {draft.items.length}
  </Badge>
  {draft.hasCriticalETD && (
    <AlertTriangle className="h-3 w-3 ml-1 text-destructive" />
  )}
</TabsTrigger>
```

**Para:**
```tsx
<TabsTrigger
  key={draft.monthKey}
  value={draft.monthKey}
  className={cn(
    "relative bg-background data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
    "px-3 py-1.5 text-sm rounded-t-md border-b-2 border-transparent",
    "data-[state=active]:border-primary data-[state=active]:z-10",
    draft.hasCriticalETD && "text-destructive data-[state=active]:bg-destructive"
  )}
>
  {draft.monthLabel}
  {draft.hasCriticalETD && (
    <AlertTriangle className="h-3 w-3 ml-1.5 text-destructive" />
  )}
</TabsTrigger>
```

**Mudanças:**
- Adicionado `relative bg-background` para garantir fundo opaco
- Adicionado `z-10` ao estado ativo para sobreposição correta
- Removido o ícone Calendar e o Badge de dentro das abas para simplificar
- A contagem de produtos já aparece no summary bar superior

---

### 2. `src/pages/SupplierPlanning.tsx`

#### 2.1 Adicionar query para buscar unidades vinculadas aos produtos (após linha 138)

```typescript
// Fetch product_units to determine which units are linked to products
const { data: productUnitsData = [] } = useQuery({
  queryKey: ['product-units-for-supplier', productIds],
  queryFn: async () => {
    if (productIds.length === 0) return [];
    const { data, error } = await supabase
      .from('product_units')
      .select('product_id, unit_id, units:unit_id(id, name)')
      .in('product_id', productIds);
    if (error) throw error;
    return data;
  },
  enabled: productIds.length > 0,
});
```

#### 2.2 Calcular unidades disponíveis e auto-seleção (após o query acima)

```typescript
// Determine available units for this supplier's products
const { availableUnits, autoSelectedUnit } = useMemo(() => {
  if (!productUnitsData.length) return { availableUnits: [], autoSelectedUnit: null };
  
  // Get unique unit IDs from product_units
  const unitIds = new Set<string>();
  productUnitsData.forEach(pu => {
    if (pu.unit_id) unitIds.add(pu.unit_id);
  });
  
  // Map to unit objects
  const unitsForProducts = units.filter(u => unitIds.has(u.id));
  
  // If all products share the same single unit, auto-select it
  if (unitsForProducts.length === 1) {
    return { availableUnits: unitsForProducts, autoSelectedUnit: unitsForProducts[0].id };
  }
  
  return { availableUnits: unitsForProducts, autoSelectedUnit: null };
}, [productUnitsData, units]);

// Auto-set unit when supplier has products all in one unit
useEffect(() => {
  if (autoSelectedUnit && selectedUnit === 'all') {
    setSelectedUnit(autoSelectedUnit);
  }
}, [autoSelectedUnit, selectedUnit]);
```

#### 2.3 Modificar o seletor de unidade para mostrar apenas unidades relevantes (linhas ~677-695)

Substituir o seletor atual de unidades para:

```tsx
{/* Unit Filter - only show relevant units */}
<Select value={selectedUnit} onValueChange={setSelectedUnit}>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Unidade" />
  </SelectTrigger>
  <SelectContent>
    {availableUnits.length > 1 && (
      <SelectItem value="all">Todas as Unidades</SelectItem>
    )}
    {availableUnits.map((unit) => (
      <SelectItem key={unit.id} value={unit.id}>
        {unit.name}
      </SelectItem>
    ))}
    {availableUnits.length === 0 && units.map((unit) => (
      <SelectItem key={unit.id} value={unit.id}>
        {unit.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

---

### 3. `src/components/planning/OrderSimulationFooter.tsx` - Validação de Unidade

#### 3.1 Adicionar prop para unidades disponíveis

Modificar a interface para receber as unidades disponíveis:

```typescript
interface OrderSimulationFooterProps {
  // ... props existentes
  availableUnits?: { id: string; name: string }[];
  requiresUnitSelection?: boolean;
}
```

#### 3.2 Mostrar aviso quando há múltiplas unidades e nenhuma foi selecionada

Na área de validação/ações, adicionar:

```tsx
{selectedUnit === 'all' && props.requiresUnitSelection && (
  <Badge variant="destructive" className="text-xs">
    Selecione a unidade de destino
  </Badge>
)}
```

---

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Bug visual tabs | Números "14" aparecendo atrás | Abas limpas sem sobreposição |
| Fornecedor só Matriz | Seleção manual | Auto-seleciona Matriz |
| Fornecedor Matriz + RJ | Seleção manual | Mostra seletor com opções relevantes |
| Criação de pedido | Permite "Todas unidades" | Bloqueia se não selecionou unidade |

---

## Seção Técnica

### Arquivos Modificados
1. `src/components/planning/OrderSimulationFooter.tsx` - Correção visual das abas
2. `src/pages/SupplierPlanning.tsx` - Query de product_units e lógica de auto-seleção

### Novas Queries
- `product-units-for-supplier`: Busca vínculos produto-unidade para determinar unidades disponíveis

### Dependências
- Usa tabela `product_units` existente
- Mantém compatibilidade com fluxo atual

