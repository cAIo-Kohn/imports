-- Add new_product_flow_status column to development_items
ALTER TABLE public.development_items
ADD COLUMN new_product_flow_status TEXT;

-- Create new_product_approvals table to track Step 1 parallel approvals
CREATE TABLE public.new_product_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.development_items(id) ON DELETE CASCADE,
  approval_type TEXT NOT NULL, -- 'market_research', 'trademark_patent', 'customs_research'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  assigned_role TEXT NOT NULL, -- 'marketing', 'quality', 'buyer'
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.new_product_approvals ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view new_product_approvals"
ON public.new_product_approvals
FOR SELECT
USING (true);

CREATE POLICY "Admins and buyers can manage new_product_approvals"
ON public.new_product_approvals
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'buyer'::app_role));

CREATE POLICY "Quality can manage their approvals"
ON public.new_product_approvals
FOR UPDATE
USING (has_role(auth.uid(), 'quality'::app_role) AND assigned_role = 'quality');

CREATE POLICY "Marketing can manage their approvals"
ON public.new_product_approvals
FOR UPDATE
USING (has_role(auth.uid(), 'marketing'::app_role) AND assigned_role = 'marketing');

CREATE POLICY "Authenticated users can insert approvals"
ON public.new_product_approvals
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Add index for faster queries
CREATE INDEX idx_new_product_approvals_card_id ON public.new_product_approvals(card_id);
CREATE INDEX idx_new_product_approvals_status ON public.new_product_approvals(status);