-- Add product_id to development_item_samples to link samples to specific products within a group
ALTER TABLE public.development_item_samples
  ADD COLUMN product_id UUID REFERENCES public.development_card_products(id) ON DELETE SET NULL;

-- Add product_id to development_card_tasks to allow tasks to target specific products
ALTER TABLE public.development_card_tasks
  ADD COLUMN product_id UUID REFERENCES public.development_card_products(id) ON DELETE SET NULL;

-- Create product_commercial_data table to store commercial data per product instead of per card
CREATE TABLE public.product_commercial_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES public.development_items(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.development_card_products(id) ON DELETE CASCADE NOT NULL,
  fob_price_usd NUMERIC,
  moq INTEGER,
  qty_per_container INTEGER,
  container_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID NOT NULL,
  UNIQUE(card_id, product_id)
);

-- Enable RLS
ALTER TABLE public.product_commercial_data ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_commercial_data
CREATE POLICY "Authenticated users can view product_commercial_data"
  ON public.product_commercial_data FOR SELECT USING (true);

CREATE POLICY "Admins and buyers can manage product_commercial_data"
  ON public.product_commercial_data FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'buyer'::app_role));

CREATE POLICY "Traders can manage product_commercial_data"
  ON public.product_commercial_data FOR ALL
  USING (has_role(auth.uid(), 'trader'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_product_commercial_data_card_id ON public.product_commercial_data(card_id);
CREATE INDEX idx_product_commercial_data_product_id ON public.product_commercial_data(product_id);
CREATE INDEX idx_development_item_samples_product_id ON public.development_item_samples(product_id);
CREATE INDEX idx_development_card_tasks_product_id ON public.development_card_tasks(product_id);