-- Add current_owner column to track which team has the "ball"
ALTER TABLE development_items
  ADD COLUMN current_owner TEXT DEFAULT 'arc' CHECK (current_owner IN ('mor', 'arc'));