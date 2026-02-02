-- Fix the UPDATE policy on development_card_tasks to allow "pass the ball" workflow
-- The issue: when a user reassigns a task to someone else, the new row no longer matches
-- the USING clause, so the update is rejected. Adding WITH CHECK (true) fixes this.

-- Drop the existing UPDATE policy
DROP POLICY IF EXISTS "Assigned users and admins can update tasks" ON public.development_card_tasks;

-- Recreate with WITH CHECK (true) to allow authorized users to reassign
CREATE POLICY "Assigned users and admins can update tasks"
ON public.development_card_tasks
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = ANY (assigned_to_users)) 
  OR has_role(auth.uid(), (assigned_to_role)::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'buyer'::app_role)
)
WITH CHECK (true);