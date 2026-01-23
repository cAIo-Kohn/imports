-- Create simplified scheduled_arrivals table
CREATE TABLE public.scheduled_arrivals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  arrival_date DATE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  source_file TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Permite múltiplas chegadas por produto, mas não duplicatas exatas
  UNIQUE(product_id, unit_id, arrival_date)
);

-- Enable RLS
ALTER TABLE public.scheduled_arrivals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view scheduled_arrivals"
  ON public.scheduled_arrivals FOR SELECT USING (true);

CREATE POLICY "Admins and buyers can manage scheduled_arrivals"
  ON public.scheduled_arrivals FOR ALL 
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'buyer'::app_role));