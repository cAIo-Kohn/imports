-- Enable realtime broadcasting for development_items table
-- This allows changes to be pushed instantly to all connected users
ALTER PUBLICATION supabase_realtime ADD TABLE public.development_items;