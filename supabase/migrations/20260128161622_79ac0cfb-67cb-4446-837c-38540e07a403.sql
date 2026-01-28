-- Create table for role card colors
CREATE TABLE public.role_card_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL UNIQUE,
  color_hex TEXT NOT NULL DEFAULT '#6B7280',
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default colors for all roles
INSERT INTO public.role_card_colors (role, color_hex, label) VALUES
  ('admin', '#8B5CF6', 'Admin'),
  ('buyer', '#3B82F6', 'Buyer'),
  ('quality', '#14B8A6', 'Quality'),
  ('marketing', '#EC4899', 'Marketing'),
  ('trader', '#10B981', 'Trader'),
  ('viewer', '#6B7280', 'Viewer');

-- Enable RLS
ALTER TABLE public.role_card_colors ENABLE ROW LEVEL SECURITY;

-- Admins can manage all role colors
CREATE POLICY "Admins can manage role_card_colors"
  ON public.role_card_colors FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Everyone can read role colors
CREATE POLICY "Authenticated users can view role_card_colors"
  ON public.role_card_colors FOR SELECT
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_role_card_colors_updated_at
  BEFORE UPDATE ON public.role_card_colors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();