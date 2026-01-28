-- Add sample review fields to development_item_samples
ALTER TABLE public.development_item_samples
  ADD COLUMN IF NOT EXISTS report_url TEXT,
  ADD COLUMN IF NOT EXISTS decision TEXT,
  ADD COLUMN IF NOT EXISTS decision_notes TEXT,
  ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decided_by UUID;

-- Add check constraint for decision values
ALTER TABLE public.development_item_samples
  DROP CONSTRAINT IF EXISTS development_item_samples_decision_check;

ALTER TABLE public.development_item_samples
  ADD CONSTRAINT development_item_samples_decision_check 
  CHECK (decision IS NULL OR decision IN ('approved', 'rejected'));