-- Add soft delete columns to development_items
ALTER TABLE development_items
  ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN deleted_by UUID;

-- Create index for efficient filtering of non-deleted items
CREATE INDEX idx_development_items_deleted_at ON development_items(deleted_at) WHERE deleted_at IS NULL;