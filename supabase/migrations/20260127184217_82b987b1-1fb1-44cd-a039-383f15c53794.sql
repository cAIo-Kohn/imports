-- Create storage bucket for development images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('development-images', 'development-images', true);

-- RLS policies for the bucket
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'development-images');

CREATE POLICY "Anyone can view images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'development-images');

CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'development-images');

-- Add new columns to development_items
ALTER TABLE development_items
  ADD COLUMN image_url TEXT,
  ADD COLUMN created_by_role TEXT,
  ADD COLUMN is_new_for_other_team BOOLEAN DEFAULT true,
  ADD COLUMN fob_price_usd NUMERIC,
  ADD COLUMN moq INTEGER,
  ADD COLUMN qty_per_container INTEGER,
  ADD COLUMN container_type TEXT;

-- Add image column to development_card_products
ALTER TABLE development_card_products
  ADD COLUMN image_url TEXT;