-- Remover constraint antiga
ALTER TABLE public.purchase_orders 
DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

-- Criar nova constraint com todos os status do fluxo de aprovação
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