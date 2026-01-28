-- Create table to track when users last viewed each card
CREATE TABLE public.card_user_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES development_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, user_id)
);

-- Enable Row-Level Security
ALTER TABLE public.card_user_views ENABLE ROW LEVEL SECURITY;

-- Users can view their own view records
CREATE POLICY "Users can view their own views"
  ON public.card_user_views FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert/update their own view records
CREATE POLICY "Users can upsert their own views"
  ON public.card_user_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own views"
  ON public.card_user_views FOR UPDATE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_card_user_views_user_id ON public.card_user_views(user_id);
CREATE INDEX idx_card_user_views_card_id ON public.card_user_views(card_id);