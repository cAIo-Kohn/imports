

## Correção: Atualizar Constraint de Status do Pedido

### Problema Identificado

A constraint `purchase_orders_status_check` está desatualizada e não inclui os novos status do fluxo de aprovação:

**Status permitidos atualmente:**
- `draft`, `confirmed`, `shipped`, `received`, `cancelled`

**Status necessários (novos):**
- `pending_trader_review` - Aguardando revisão do trader
- `pending_buyer_approval` - Aguardando aprovação do comprador

### Solução

Atualizar a constraint via migração SQL para incluir todos os status:

```sql
-- Remover constraint antiga
ALTER TABLE public.purchase_orders 
DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

-- Criar nova constraint com todos os status
ALTER TABLE public.purchase_orders 
ADD CONSTRAINT purchase_orders_status_check 
CHECK (status = ANY (ARRAY[
  'draft'::text, 
  'pending_trader_review'::text,
  'pending_buyer_approval'::text,
  'confirmed'::text, 
  'shipped'::text, 
  'received'::text, 
  'cancelled'::text
]));
```

### Resultado Esperado

Após a migração, pedidos poderão ser criados com qualquer um dos 7 status válidos, permitindo o funcionamento correto do fluxo de aprovação para fornecedores chineses.

