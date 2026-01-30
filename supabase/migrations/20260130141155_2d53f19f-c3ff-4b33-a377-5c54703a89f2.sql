-- Add pending_for_team column to track which team needs to act on each thread
ALTER TABLE public.development_card_activity
ADD COLUMN pending_for_team TEXT NULL;

-- Add resolved_at to track when a thread's pending action was completed
ALTER TABLE public.development_card_activity
ADD COLUMN thread_resolved_at TIMESTAMPTZ NULL;

-- Add index for efficient queries on pending threads
CREATE INDEX idx_activity_pending_for_team ON public.development_card_activity(card_id, pending_for_team) WHERE pending_for_team IS NOT NULL AND thread_resolved_at IS NULL;

COMMENT ON COLUMN public.development_card_activity.pending_for_team IS 'Which team needs to act on this thread: mor (Brazil) or arc (China). Only set on thread root activities.';
COMMENT ON COLUMN public.development_card_activity.thread_resolved_at IS 'When this thread''s pending action was completed/resolved.';