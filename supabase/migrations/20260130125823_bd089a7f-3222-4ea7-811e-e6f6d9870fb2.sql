-- Add thread columns to development_card_activity
ALTER TABLE public.development_card_activity 
ADD COLUMN thread_id UUID,
ADD COLUMN thread_root_id UUID;

-- Create index for efficient thread grouping
CREATE INDEX idx_card_activity_thread ON public.development_card_activity(card_id, thread_id);

-- Backfill: Set existing activities as their own thread roots
-- (Questions/comments without a reply_to become thread roots)
UPDATE public.development_card_activity
SET thread_id = id, thread_root_id = id
WHERE activity_type IN ('comment', 'question')
  AND thread_id IS NULL
  AND (metadata IS NULL OR metadata->>'reply_to_question' IS NULL);

-- Backfill: Link existing replies to their parent thread
UPDATE public.development_card_activity AS reply
SET 
  thread_id = parent.thread_id,
  thread_root_id = parent.thread_root_id
FROM public.development_card_activity AS parent
WHERE reply.metadata->>'reply_to_question' IS NOT NULL
  AND parent.id = (reply.metadata->>'reply_to_question')::uuid
  AND reply.thread_id IS NULL;

-- Also handle reply_to_comment references
UPDATE public.development_card_activity AS reply
SET 
  thread_id = parent.thread_id,
  thread_root_id = parent.thread_root_id
FROM public.development_card_activity AS parent
WHERE reply.metadata->>'reply_to_comment' IS NOT NULL
  AND parent.id = (reply.metadata->>'reply_to_comment')::uuid
  AND reply.thread_id IS NULL;