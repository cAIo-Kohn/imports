-- Add assignment columns to development_items for user/role-based assignment
ALTER TABLE public.development_items
ADD COLUMN IF NOT EXISTS assigned_to_users UUID[] DEFAULT '{}'::UUID[],
ADD COLUMN IF NOT EXISTS assigned_to_role TEXT NULL;

-- Create index for faster lookups on assigned_to_role
CREATE INDEX IF NOT EXISTS idx_development_items_assigned_role 
ON public.development_items(assigned_to_role);

-- Create GIN index for array lookups on assigned_to_users
CREATE INDEX IF NOT EXISTS idx_development_items_assigned_users 
ON public.development_items USING GIN(assigned_to_users);