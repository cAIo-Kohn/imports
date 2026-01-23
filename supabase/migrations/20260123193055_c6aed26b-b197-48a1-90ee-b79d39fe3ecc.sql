-- Add supplier_specs column to products table for technical specifications from supplier
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS supplier_specs TEXT;

COMMENT ON COLUMN public.products.supplier_specs IS 
  'Especificações técnicas detalhadas do fornecedor (dimensões, composição, embalagem)';