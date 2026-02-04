-- Allow new task types used by the app (sample/commercial review)
ALTER TABLE public.development_card_tasks
  DROP CONSTRAINT IF EXISTS valid_task_type;

ALTER TABLE public.development_card_tasks
  ADD CONSTRAINT valid_task_type
  CHECK (
    task_type = ANY (
      ARRAY[
        'sample_request'::text,
        'commercial_request'::text,
        'sample_review'::text,
        'commercial_review'::text
      ]
    )
  );
