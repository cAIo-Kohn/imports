-- Add workflow_status and current_assignee_role to development_items
ALTER TABLE public.development_items
  ADD COLUMN IF NOT EXISTS workflow_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS current_assignee_role TEXT DEFAULT NULL;

-- Create card_unresolved_mentions table for tracking @mentions
CREATE TABLE public.card_unresolved_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES public.development_items(id) ON DELETE CASCADE NOT NULL,
  mentioned_user_id UUID NOT NULL,
  mentioned_by_user_id UUID NOT NULL,
  activity_id UUID REFERENCES public.development_card_activity(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  resolved_at TIMESTAMPTZ DEFAULT NULL,
  resolved_by_activity_id UUID REFERENCES public.development_card_activity(id) ON DELETE SET NULL DEFAULT NULL,
  UNIQUE(card_id, mentioned_user_id, activity_id)
);

-- Indexes for performance
CREATE INDEX idx_unresolved_mentions_card ON public.card_unresolved_mentions(card_id);
CREATE INDEX idx_unresolved_mentions_user ON public.card_unresolved_mentions(mentioned_user_id);
CREATE INDEX idx_unresolved_mentions_unresolved ON public.card_unresolved_mentions(card_id) WHERE resolved_at IS NULL;

-- Enable RLS
ALTER TABLE public.card_unresolved_mentions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view mentions"
  ON public.card_unresolved_mentions FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert mentions"
  ON public.card_unresolved_mentions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update mentions"
  ON public.card_unresolved_mentions FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete mentions"
  ON public.card_unresolved_mentions FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Enable realtime for card_unresolved_mentions
ALTER PUBLICATION supabase_realtime ADD TABLE public.card_unresolved_mentions;