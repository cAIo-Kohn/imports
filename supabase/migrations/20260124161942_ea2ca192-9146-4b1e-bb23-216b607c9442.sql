-- Remove materialized view from public API exposure by revoking anon access
-- Only authenticated users should access this data
REVOKE SELECT ON public.supplier_health_summary FROM anon;