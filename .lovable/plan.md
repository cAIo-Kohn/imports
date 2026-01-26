

## Correção: Permitir Admin Acessar Interface do Trader

### Problema Identificado

A condição atual no `PurchaseOrderDetails.tsx` linha 237 é:
```typescript
const showTraderApproval = isTrader && isChineseSupplier && order.status === 'pending_trader_review';
```

Como você está logado como **admin** (e não como **trader**), os componentes de aprovação e edição não são exibidos.

### Solução Proposta

Modificar a condição para incluir **admin** como usuário que pode acessar a interface do trader:

```typescript
const showTraderApproval = (isTrader || isAdmin) && isChineseSupplier && order.status === 'pending_trader_review';
```

Isso faz sentido porque:
1. **Admin** é o super usuário com acesso a todas as funcionalidades
2. Permite que admins testem o fluxo completo sem precisar de duas contas
3. Mantém a lógica original para traders

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/PurchaseOrderDetails.tsx` | Adicionar `isAdmin` à condição `showTraderApproval` |

### Código Detalhado

**Antes (linha 237):**
```typescript
const showTraderApproval = isTrader && isChineseSupplier && order.status === 'pending_trader_review';
```

**Depois:**
```typescript
const showTraderApproval = (isTrader || isAdmin) && isChineseSupplier && order.status === 'pending_trader_review';
```

### Resultado Esperado

Após a correção:
1. Admins verão os checkboxes de aprovação no header do pedido
2. Admins verão a tabela editável com checkboxes por item
3. Admins poderão editar preços, quantidades e ETD
4. Traders continuarão funcionando normalmente

### Considerações de Segurança

A mudança é segura porque:
- Admins já têm permissão total via RLS policies (`has_role(auth.uid(), 'admin')`)
- A lógica de negócio permanece intacta (logging de alterações, aprovações, etc.)
- Apenas a **interface** é liberada para admins verem

