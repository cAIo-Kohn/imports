-- Create enums for development items
CREATE TYPE public.development_item_status AS ENUM (
  'backlog', 'in_progress', 'waiting_supplier', 
  'sample_requested', 'sample_in_transit', 'sample_received',
  'under_review', 'approved', 'rejected'
);

CREATE TYPE public.development_item_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TYPE public.development_item_type AS ENUM ('new_item', 'sample', 'development');

CREATE TYPE public.sample_shipment_status AS ENUM ('pending', 'in_transit', 'delivered', 'returned');

-- Create main development_items table
CREATE TABLE public.development_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status public.development_item_status NOT NULL DEFAULT 'backlog',
  priority public.development_item_priority DEFAULT 'medium',
  item_type public.development_item_type DEFAULT 'new_item',
  product_code text,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  assigned_to uuid,
  created_by uuid NOT NULL,
  due_date date,
  position integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create samples tracking table
CREATE TABLE public.development_item_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES public.development_items(id) ON DELETE CASCADE NOT NULL,
  courier_name text,
  tracking_number text,
  shipped_date date,
  estimated_arrival date,
  actual_arrival date,
  quantity integer DEFAULT 1,
  notes text,
  status public.sample_shipment_status DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create comments/activity table
CREATE TABLE public.development_item_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES public.development_items(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.development_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_item_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_item_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for development_items
CREATE POLICY "Authenticated users can view development_items"
ON public.development_items FOR SELECT
USING (true);

CREATE POLICY "Admins and buyers can manage development_items"
ON public.development_items FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'buyer'));

-- RLS Policies for development_item_samples
CREATE POLICY "Authenticated users can view development_item_samples"
ON public.development_item_samples FOR SELECT
USING (true);

CREATE POLICY "Admins and buyers can manage development_item_samples"
ON public.development_item_samples FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'buyer'));

-- RLS Policies for development_item_comments
CREATE POLICY "Authenticated users can view development_item_comments"
ON public.development_item_comments FOR SELECT
USING (true);

CREATE POLICY "Admins and buyers can manage development_item_comments"
ON public.development_item_comments FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'buyer'));

-- Create trigger for updated_at
CREATE TRIGGER update_development_items_updated_at
BEFORE UPDATE ON public.development_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_development_items_status ON public.development_items(status);
CREATE INDEX idx_development_items_supplier ON public.development_items(supplier_id);
CREATE INDEX idx_development_items_assigned ON public.development_items(assigned_to);
CREATE INDEX idx_development_item_samples_item ON public.development_item_samples(item_id);
CREATE INDEX idx_development_item_comments_item ON public.development_item_comments(item_id);