

## Plano: Otimizar Layout da Página de Planejamento por Fornecedor

### Objetivo
Reduzir o espaço vertical ocupado pelo cabeçalho, cards de estatísticas e filtros para maximizar a área disponível para a "Projeção de Estoque".

---

### Mudanças Propostas

#### 1. Remover Botões de Upload

Os botões "Importar Estoque", "Importar Histórico" e "Importar Previsão" serão removidos do header, mantendo apenas:
- Botão de voltar
- Botão de refresh
- Botão "Montar Pedido Inteligente"

**Código a remover** (linhas 563-574):
```tsx
// Remover estes botões:
<Button variant="outline" onClick={() => setImportInventoryOpen(true)}>...</Button>
<Button variant="outline" onClick={() => setImportHistoryOpen(true)}>...</Button>
<Button variant="outline" onClick={() => setImportForecastOpen(true)}>...</Button>
```

**Estados e modais a remover** (linhas 95-97 e 737-751):
```tsx
// Estados desnecessários:
const [importForecastOpen, setImportForecastOpen] = useState(false);
const [importInventoryOpen, setImportInventoryOpen] = useState(false);
const [importHistoryOpen, setImportHistoryOpen] = useState(false);

// Modais desnecessários:
<ImportForecastModal ... />
<ImportInventoryModal ... />
<ImportSalesHistoryModal ... />
```

---

#### 2. Compactar Cards de Estatísticas em Linha Única

**Layout Atual:**
```
┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ Total Produtos │ │ Com Ruptura    │ │ Atenção        │ │ OK             │
│ 31             │ │ 15             │ │ 1              │ │ 15             │
│ produtos anal. │ │ urgente        │ │ baixo prev.    │ │ confortável    │
└────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘
```

**Novo Layout (badges inline):**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ [31 produtos] [🔴 15 rupturas] [⚠️ 1 atenção] [🟢 15 OK]                │
└─────────────────────────────────────────────────────────────────────────┘
```

Os 4 cards serão substituídos por badges compactos em uma única linha horizontal.

---

#### 3. Unificar Filtros com Header

Mover os filtros para a mesma linha do header, eliminando o card separado.

**Layout Atual:**
```
LEDARO                              [↻] [Importar Estoque] [Importar...] [Montar Pedido]
Projeção de estoque • 31 produtos
─────────────────────────────────────────────────────────────────────────────────────────
│ Total │ Ruptura │ Atenção │ OK │    (4 cards grandes)
─────────────────────────────────────────────────────────────────────────────────────────
│ 🔍 Buscar...  │ Unidade ▼ │ 12 meses ▼ │ Apenas Rupturas │   (card de filtros)
─────────────────────────────────────────────────────────────────────────────────────────
Projeção de Estoque                                           (conteúdo principal)
```

**Novo Layout Compacto:**
```
← LEDARO • 31 produtos   [31] [🔴15] [⚠️1] [🟢15]     [↻] [Montar Pedido Inteligente]
─────────────────────────────────────────────────────────────────────────────────────────
🔍 Buscar...   │ Unidades ▼ │ 12 meses ▼ │ Apenas Rupturas │
─────────────────────────────────────────────────────────────────────────────────────────
Projeção de Estoque                                           (conteúdo principal)
Clique em um produto para ver o gráfico...
```

---

### Implementação Detalhada

#### Arquivo: `src/pages/SupplierPlanning.tsx`

**1. Remover imports desnecessários:**
```tsx
// Remover:
import { ImportForecastModal } from '@/components/planning/ImportForecastModal';
import { ImportInventoryModal } from '@/components/planning/ImportInventoryModal';
import { ImportSalesHistoryModal } from '@/components/planning/ImportSalesHistoryModal';
import { Upload, FileSpreadsheet } from 'lucide-react';
```

**2. Remover estados de modais:**
```tsx
// Remover linhas 95-97:
const [importForecastOpen, setImportForecastOpen] = useState(false);
const [importInventoryOpen, setImportInventoryOpen] = useState(false);
const [importHistoryOpen, setImportHistoryOpen] = useState(false);
```

**3. Novo Header Compacto (substituir linhas 531-634):**

```tsx
<div className="space-y-4 pb-24">
  {/* Compact Header with Stats */}
  <div className="flex flex-wrap items-center justify-between gap-4">
    {/* Left: Back + Title */}
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={() => navigate('/demand-planning')}>
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{supplier.company_name}</h1>
        <p className="text-sm text-muted-foreground">{products.length} produtos</p>
      </div>
    </div>
    
    {/* Center: Inline Stats */}
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="text-sm py-1 px-3">
        <Package className="h-3.5 w-3.5 mr-1.5" />
        {stats.total}
      </Badge>
      <Badge variant="destructive" className="text-sm py-1 px-3">
        <TrendingDown className="h-3.5 w-3.5 mr-1.5" />
        {stats.withRupture}
      </Badge>
      <Badge className="bg-yellow-500 text-sm py-1 px-3">
        <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
        {stats.withWarning}
      </Badge>
      <Badge className="bg-green-500 text-sm py-1 px-3">
        <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
        {stats.ok}
      </Badge>
    </div>
    
    {/* Right: Actions */}
    <div className="flex gap-2">
      <Button variant="outline" size="icon" onClick={handleRefreshData} title="Atualizar dados">
        <RefreshCw className="h-4 w-4" />
      </Button>
      <SmartOrderBuilder ... />
    </div>
  </div>

  {/* Compact Filters Row (no Card wrapper) */}
  <div className="flex flex-wrap gap-3 items-center">
    <div className="relative flex-1 min-w-[200px] max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Buscar por código ou descrição..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="pl-9 h-9"
      />
    </div>
    <Select value={selectedUnit} onValueChange={setSelectedUnit}>
      <SelectTrigger className="w-[160px] h-9">
        <SelectValue placeholder="Unidade" />
      </SelectTrigger>
      ...
    </Select>
    <Select value={monthsAhead.toString()} onValueChange={(v) => setMonthsAhead(Number(v))}>
      <SelectTrigger className="w-[120px] h-9">
        <SelectValue />
      </SelectTrigger>
      ...
    </Select>
    <Button
      variant={showOnlyRuptures ? "default" : "outline"}
      onClick={() => setShowOnlyRuptures(!showOnlyRuptures)}
      size="sm"
    >
      <Filter className="mr-2 h-4 w-4" />
      Apenas Rupturas
    </Button>
  </div>

  {/* Chart (when product selected) */}
  {selectedProductData && (...)}

  {/* Projection Table - More vertical space */}
  <Card>
    <CardHeader className="pb-2">
      <CardTitle>Projeção de Estoque</CardTitle>
      <CardDescription className="text-xs">
        Clique em um produto para ver o gráfico. Digite valores na linha "Chegada" para simular compras.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-2">
        ...
      </div>
    </CardContent>
  </Card>
</div>
```

**4. Remover modais de import (linhas 737-751)**

---

### Comparação Visual

| Elemento | Antes | Depois |
|----------|-------|--------|
| Header | 2 linhas (título + botões) | 1 linha compacta |
| Stats Cards | 4 cards (~100px altura) | Badges inline (~36px) |
| Filtros | Card separado (~80px) | Linha simples (~44px) |
| Botões import | 3 botões visíveis | Removidos |
| **Economia total** | — | **~200px de altura** |

---

### Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/SupplierPlanning.tsx` | Refatorar layout, remover imports e botões de upload |

---

### Benefícios

1. **Mais espaço para conteúdo**: A tabela de projeção ganha ~200px de altura
2. **Interface mais limpa**: Menos elementos visuais competindo por atenção
3. **Navegação consistente**: Uploads centralizados na tela `/demand-planning`
4. **Informação acessível**: Stats ainda visíveis em badges compactos

