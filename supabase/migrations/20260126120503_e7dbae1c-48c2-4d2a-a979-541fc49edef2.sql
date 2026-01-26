-- Add banking details to suppliers table
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS bank_swift TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS bank_account TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS bank_address TEXT;

-- Add shipping details to purchase_orders table
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS etd DATE;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS crd DATE;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS port_origin TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS port_destination TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- Add phone/fax to units table for invoice display
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS fax TEXT;