-- Add new commercial data fields to development_items
ALTER TABLE development_items
ADD COLUMN IF NOT EXISTS packing_type TEXT,
ADD COLUMN IF NOT EXISTS packing_type_file_url TEXT,
ADD COLUMN IF NOT EXISTS qty_per_master_inner TEXT;