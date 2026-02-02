-- Create development_card_tasks table for task-based workflow
CREATE TABLE public.development_card_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.development_items(id) ON DELETE CASCADE,
  
  -- Task type and status
  task_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Assignment
  assigned_to_users UUID[] DEFAULT '{}',
  assigned_to_role TEXT,
  
  -- Who created the task (to reassign back to)
  created_by UUID NOT NULL,
  
  -- Task-specific data (JSON)
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  
  -- Links to related records
  sample_id UUID REFERENCES public.development_item_samples(id) ON DELETE SET NULL,
  
  CONSTRAINT valid_task_type CHECK (task_type IN ('sample_request', 'commercial_request')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);

-- Index for efficient queries
CREATE INDEX idx_card_tasks_card_id ON public.development_card_tasks(card_id);
CREATE INDEX idx_card_tasks_assigned_role ON public.development_card_tasks(assigned_to_role) WHERE status = 'pending';
CREATE INDEX idx_card_tasks_status ON public.development_card_tasks(status);

-- Enable RLS
ALTER TABLE public.development_card_tasks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view all tasks" 
ON public.development_card_tasks
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create tasks" 
ON public.development_card_tasks
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Assigned users and admins can update tasks" 
ON public.development_card_tasks
FOR UPDATE 
USING (
  auth.uid() = ANY(assigned_to_users) OR
  public.has_role(auth.uid(), assigned_to_role::app_role) OR
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'buyer'::app_role)
);

CREATE POLICY "Admins and buyers can delete tasks" 
ON public.development_card_tasks
FOR DELETE 
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'buyer'::app_role)
);