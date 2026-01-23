-- Add process_number column to scheduled_arrivals table
ALTER TABLE public.scheduled_arrivals 
ADD COLUMN process_number TEXT;

COMMENT ON COLUMN public.scheduled_arrivals.process_number IS 'Número do processo/ordem de compra de origem';