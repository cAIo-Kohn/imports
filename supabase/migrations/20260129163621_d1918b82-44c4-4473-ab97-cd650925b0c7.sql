-- Allow all authenticated users to view profiles
-- This enables displaying user names in activity timelines, comments, etc.
CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);