ALTER TABLE public.products
ADD COLUMN container_type text DEFAULT NULL,
ADD COLUMN qty_per_container integer DEFAULT NULL;