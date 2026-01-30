-- Allow any authenticated user to insert their own activity entries
CREATE POLICY "Authenticated users can create card activity"
ON development_card_activity
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);