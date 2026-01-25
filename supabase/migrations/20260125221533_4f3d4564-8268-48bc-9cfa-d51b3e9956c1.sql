-- Add container CBM configuration columns to suppliers table
ALTER TABLE public.suppliers 
ADD COLUMN container_20_cbm numeric DEFAULT NULL,
ADD COLUMN container_40_cbm numeric DEFAULT NULL,
ADD COLUMN container_40hq_cbm numeric DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.suppliers.container_20_cbm IS 'Custom CBM for 20ft container (default: 33m³)';
COMMENT ON COLUMN public.suppliers.container_40_cbm IS 'Custom CBM for 40ft container (default: 67m³)';
COMMENT ON COLUMN public.suppliers.container_40hq_cbm IS 'Custom CBM for 40ft HQ container (default: 76m³)';