-- Add new roles to the enum (separate transaction)
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'quality';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'marketing';