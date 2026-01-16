-- Add warehouse_status field to products table
ALTER TABLE public.products ADD COLUMN warehouse_status text;

-- Create product_units table for many-to-many relationship
CREATE TABLE public.product_units (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(product_id, unit_id)
);

-- Enable RLS on product_units
ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_units
CREATE POLICY "Authenticated users can view product_units"
ON public.product_units
FOR SELECT
USING (true);

CREATE POLICY "Admins and buyers can manage product_units"
ON public.product_units
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'buyer'::app_role));

-- Insert the 3 units
INSERT INTO public.units (name, city, state) VALUES
('Matriz', NULL, NULL),
('Filial Pernambuco', 'Recife', 'PE'),
('Filial Rio de Janeiro', 'Rio de Janeiro', 'RJ');