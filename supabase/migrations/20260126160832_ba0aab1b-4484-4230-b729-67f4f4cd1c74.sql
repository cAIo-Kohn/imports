-- Add trader approval columns to purchase_order_items
ALTER TABLE public.purchase_order_items 
ADD COLUMN IF NOT EXISTS trader_price_approved boolean DEFAULT false;

ALTER TABLE public.purchase_order_items 
ADD COLUMN IF NOT EXISTS trader_quantity_approved boolean DEFAULT false;