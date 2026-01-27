-- Add product_category to development_items for distinguishing final product vs raw material
CREATE TYPE public.development_product_category AS ENUM ('final_product', 'raw_material');

ALTER TABLE public.development_items 
  ADD COLUMN product_category public.development_product_category;