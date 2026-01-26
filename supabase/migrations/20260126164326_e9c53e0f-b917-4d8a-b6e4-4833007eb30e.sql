-- Allow buyers and admins to insert into change history (for counter-proposals)
-- The existing ALL policy only covers admins and buyers for managing (which includes INSERT)
-- but we need to explicitly ensure this works for the counter-proposal flow

-- First, let's check if we need to add a separate INSERT policy
-- The existing "Admins and buyers can manage change history" policy with ALL command should already cover INSERT
-- But let's add a more explicit policy for clarity and ensure it works

-- No additional policy needed as the existing ALL policy already covers INSERT for admins and buyers
-- The existing policy: "Admins and buyers can manage change history" with ALL command
-- This includes SELECT, INSERT, UPDATE, DELETE for users with admin or buyer roles

-- Just verify the policy exists (no changes needed)