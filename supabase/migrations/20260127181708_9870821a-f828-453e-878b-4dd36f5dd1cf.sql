-- =============================================
-- DEVELOPMENT CARD SYSTEM RESTRUCTURE
-- =============================================

-- 1. Create new enum for card type
CREATE TYPE public.development_card_type AS ENUM ('item', 'item_group', 'task');

-- 2. Create new enum for simplified status
CREATE TYPE public.development_card_status AS ENUM ('pending', 'in_progress', 'waiting', 'solved');

-- 3. Add new columns to development_items
ALTER TABLE public.development_items 
  ADD COLUMN card_type public.development_card_type DEFAULT 'item',
  ADD COLUMN is_solved BOOLEAN DEFAULT false;

-- 4. Create table for grouped items (child products within a group card)
CREATE TABLE public.development_card_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES public.development_items(id) ON DELETE CASCADE NOT NULL,
  product_code TEXT NOT NULL,
  product_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID NOT NULL
);

-- 5. Create unified activity log table
CREATE TABLE public.development_card_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES public.development_items(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_card_products_card_id ON public.development_card_products(card_id);
CREATE INDEX idx_card_activity_card_id ON public.development_card_activity(card_id);
CREATE INDEX idx_card_activity_created_at ON public.development_card_activity(created_at DESC);
CREATE INDEX idx_development_items_is_solved ON public.development_items(is_solved);
CREATE INDEX idx_development_items_card_type ON public.development_items(card_type);

-- =============================================
-- RLS POLICIES FOR NEW TABLES
-- =============================================

-- Enable RLS
ALTER TABLE public.development_card_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_card_activity ENABLE ROW LEVEL SECURITY;

-- development_card_products policies
CREATE POLICY "Admins and buyers can manage card products"
  ON public.development_card_products FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'buyer'));

CREATE POLICY "Traders can manage card products"
  ON public.development_card_products FOR ALL
  USING (has_role(auth.uid(), 'trader'));

CREATE POLICY "Authenticated users can view card products"
  ON public.development_card_products FOR SELECT
  USING (true);

-- development_card_activity policies
CREATE POLICY "Admins and buyers can manage card activity"
  ON public.development_card_activity FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'buyer'));

CREATE POLICY "Traders can manage card activity"
  ON public.development_card_activity FOR ALL
  USING (has_role(auth.uid(), 'trader'));

CREATE POLICY "Authenticated users can view card activity"
  ON public.development_card_activity FOR SELECT
  USING (true);

-- =============================================
-- UPDATE EXISTING POLICIES FOR TRADER ACCESS
-- =============================================

-- Allow traders to manage development_items
CREATE POLICY "Traders can manage development_items"
  ON public.development_items FOR ALL
  USING (has_role(auth.uid(), 'trader'));

-- Allow traders to manage development_item_samples
CREATE POLICY "Traders can manage development_item_samples"
  ON public.development_item_samples FOR ALL
  USING (has_role(auth.uid(), 'trader'));