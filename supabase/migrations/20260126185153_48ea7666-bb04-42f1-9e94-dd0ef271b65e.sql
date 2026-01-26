-- Add reference_number column to purchase_orders
ALTER TABLE public.purchase_orders 
ADD COLUMN reference_number TEXT;

-- Add comment explaining the purpose
COMMENT ON COLUMN public.purchase_orders.reference_number IS 
  'Número de referência definido pelo comprador para vincular com uploads externos (ex: AMOR-26001)';