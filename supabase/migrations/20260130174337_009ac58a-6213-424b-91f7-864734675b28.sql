-- Add new columns for thread assignment system
ALTER TABLE public.development_card_activity
ADD COLUMN IF NOT EXISTS assigned_to_users UUID[] DEFAULT '{}'::UUID[],
ADD COLUMN IF NOT EXISTS assigned_to_role TEXT NULL,
ADD COLUMN IF NOT EXISTS thread_creator_id UUID NULL,
ADD COLUMN IF NOT EXISTS thread_status TEXT DEFAULT 'open';

-- Migrate existing data from pending_for_team to new system
UPDATE public.development_card_activity
SET 
  assigned_to_role = CASE 
    WHEN pending_for_team = 'mor' THEN 'buyer'
    WHEN pending_for_team = 'arc' THEN 'trader'
    ELSE NULL
  END,
  thread_status = CASE 
    WHEN thread_resolved_at IS NOT NULL THEN 'resolved'
    ELSE 'open'
  END,
  thread_creator_id = user_id
WHERE thread_id = id;