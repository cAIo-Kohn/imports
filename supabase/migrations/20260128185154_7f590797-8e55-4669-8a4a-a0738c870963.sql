-- Add pending action tracking columns to development_items
ALTER TABLE public.development_items
ADD COLUMN pending_action_type text DEFAULT NULL,
ADD COLUMN pending_action_due_at timestamptz DEFAULT NULL,
ADD COLUMN pending_action_snoozed_until timestamptz DEFAULT NULL,
ADD COLUMN pending_action_snoozed_by uuid DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.development_items.pending_action_type IS 'Type of pending action: question, commercial_review, sample_tracking, sample_in_transit, sample_review';
COMMENT ON COLUMN public.development_items.pending_action_due_at IS 'When action becomes urgent (e.g., sample ETA)';
COMMENT ON COLUMN public.development_items.pending_action_snoozed_until IS 'Delay timer - action is not urgent until this timestamp';
COMMENT ON COLUMN public.development_items.pending_action_snoozed_by IS 'User who set the snooze';