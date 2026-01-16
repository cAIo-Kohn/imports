-- Add new columns to products table for Partner base data
ALTER TABLE products ADD COLUMN IF NOT EXISTS ean_13 text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS dun_14 text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS item_type text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS origin_description text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS master_box_volume numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS gross_weight numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS individual_length numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS individual_width numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS individual_height numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS individual_weight numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS packaging_type text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_length numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_width numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_height numeric;