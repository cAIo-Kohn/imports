-- Add thread_title column for editable thread names
ALTER TABLE development_card_activity 
ADD COLUMN thread_title TEXT DEFAULT NULL;

-- Add comment explaining usage
COMMENT ON COLUMN development_card_activity.thread_title IS 'Custom title for the thread, only set on thread root activities';