

## Plano: Simplificar Colunas da Tabela no Painel do Trader

### Objetivo

Modificar a tabela de pedidos em `/trader` para exibir apenas as colunas solicitadas:
- Pedido
- Fornecedor  
- Data Criação
- ETD
- Containers (quantidade extraída das notas)
- Total Amount

Remover as colunas atuais: **Itens** e **Qtd Total**.

---

### Arquivo a Modificar

#### `src/pages/TraderDashboard.tsx`

#### 1. Adicionar import da função `extractContainerInfo` (linha 11)

```typescript
import { extractContainerInfo } from '@/lib/utils';
```

#### 2. Modificar o cabeçalho da tabela (linhas 173-183)

**De:**
```tsx
<TableRow>
  <TableHead>Pedido</TableHead>
  <TableHead>Fornecedor</TableHead>
  <TableHead>Data Criação</TableHead>
  <TableHead>ETD</TableHead>
  <TableHead className="text-right">Itens</TableHead>
  <TableHead className="text-right">Qtd Total</TableHead>
  <TableHead className="text-right">Valor Total</TableHead>
  <TableHead></TableHead>
</TableRow>
```

**Para:**
```tsx
<TableRow>
  <TableHead>Pedido</TableHead>
  <TableHead>Fornecedor</TableHead>
  <TableHead>Data Criação</TableHead>
  <TableHead>ETD</TableHead>
  <TableHead>Containers</TableHead>
  <TableHead className="text-right">Total Amount</TableHead>
  <TableHead></TableHead>
</TableRow>
```

#### 3. Modificar as células da tabela (linhas 222-238)

**De:**
```tsx
<TableCell className="text-right">
  {order.purchase_order_items?.length || 0}
</TableCell>
<TableCell className="text-right font-medium">
  {calculateTotalQty(order.purchase_order_items).toLocaleString('pt-BR')}
</TableCell>
<TableCell className="text-right font-medium">
  ${calculateOrderTotal(order.purchase_order_items).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}
</TableCell>
```

**Para:**
```tsx
<TableCell>
  <span className="text-sm">
    {extractContainerInfo(order.notes)}
  </span>
</TableCell>
<TableCell className="text-right font-medium">
  ${calculateOrderTotal(order.purchase_order_items).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}
</TableCell>
```

#### 4. Remover função não utilizada `calculateTotalQty` (linhas 59-61)

Pode ser removida, pois não será mais utilizada na tabela.

---

### Resultado Visual

| Antes | Depois |
|-------|--------|
| Pedido, Fornecedor, Data Criação, ETD, Itens, Qtd Total, Valor Total | Pedido, Fornecedor, Data Criação, ETD, Containers, Total Amount |

### Exemplo de Exibição

| Pedido | Fornecedor | Data Criação | ETD | Containers | Total Amount |
|--------|------------|--------------|-----|------------|--------------|
| AMOR-26001 | JIANGSU JILONG... | 26/01/2026 | Não definido | 2x 40HQ | $125,000.00 |

