-- Phase 2: Add trader approval fields to purchase_orders
ALTER TABLE public.purchase_orders 
  ADD COLUMN IF NOT EXISTS trader_etd_approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trader_etd_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trader_etd_approved_by UUID,
  
  ADD COLUMN IF NOT EXISTS trader_prices_approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trader_prices_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trader_prices_approved_by UUID,
  
  ADD COLUMN IF NOT EXISTS trader_quantities_approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trader_quantities_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trader_quantities_approved_by UUID,
  
  ADD COLUMN IF NOT EXISTS requires_buyer_approval BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS buyer_approval_notes TEXT;

-- Phase 3: Create purchase_order_change_history table
CREATE TABLE IF NOT EXISTS public.purchase_order_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  purchase_order_item_id UUID REFERENCES public.purchase_order_items(id) ON DELETE CASCADE,
  
  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  change_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  
  is_critical BOOLEAN DEFAULT FALSE,
  requires_approval BOOLEAN DEFAULT FALSE,
  approved_by UUID,
  approved_at TIMESTAMPTZ
);

-- Enable RLS on the new table
ALTER TABLE public.purchase_order_change_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for purchase_order_change_history
CREATE POLICY "Authenticated users can view change history"
  ON public.purchase_order_change_history
  FOR SELECT
  USING (true);

CREATE POLICY "Admins and buyers can manage change history"
  ON public.purchase_order_change_history
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'buyer'::app_role));

CREATE POLICY "Traders can insert change history for chinese orders"
  ON public.purchase_order_change_history
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'trader'::app_role) 
    AND EXISTS (
      SELECT 1 FROM public.purchase_orders po
      JOIN public.suppliers s ON s.id = po.supplier_id
      WHERE po.id = purchase_order_change_history.purchase_order_id
      AND LOWER(s.country) = 'china'
    )
  );

-- Additional RLS policy for traders on purchase_orders (UPDATE only for chinese suppliers)
CREATE POLICY "Traders can update chinese supplier orders"
  ON public.purchase_orders
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'trader'::app_role) 
    AND EXISTS (
      SELECT 1 FROM public.suppliers s 
      WHERE s.id = purchase_orders.supplier_id 
      AND LOWER(s.country) = 'china'
    )
  );

-- RLS policy for traders on purchase_order_items (UPDATE only for chinese supplier orders)
CREATE POLICY "Traders can update items for chinese supplier orders"
  ON public.purchase_order_items
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'trader'::app_role) 
    AND EXISTS (
      SELECT 1 FROM public.purchase_orders po
      JOIN public.suppliers s ON s.id = po.supplier_id
      WHERE po.id = purchase_order_items.purchase_order_id
      AND LOWER(s.country) = 'china'
    )
  );