-- Create materialized view for supplier health calculations
-- This pre-calculates rupture projections to avoid heavy frontend computation

CREATE MATERIALIZED VIEW public.supplier_health_summary AS
WITH 
-- Get latest inventory per product
latest_inventory AS (
  SELECT DISTINCT ON (product_id) 
    product_id,
    quantity as initial_stock
  FROM inventory_snapshots
  ORDER BY product_id, snapshot_date DESC
),

-- Generate next 12 months
months AS (
  SELECT generate_series(0, 11) as month_offset,
         to_char(date_trunc('month', CURRENT_DATE) + (generate_series(0, 11) || ' months')::interval, 'YYYY-MM') as month_key
),

-- Aggregate forecasts by product and month
forecasts_by_month AS (
  SELECT 
    product_id,
    to_char(year_month, 'YYYY-MM') as month_key,
    SUM(quantity) as forecast_qty
  FROM sales_forecasts
  WHERE year_month >= date_trunc('month', CURRENT_DATE)
    AND year_month < date_trunc('month', CURRENT_DATE) + interval '12 months'
  GROUP BY product_id, to_char(year_month, 'YYYY-MM')
),

-- Aggregate arrivals by product and month
arrivals_by_month AS (
  SELECT 
    product_id,
    to_char(arrival_date, 'YYYY-MM') as month_key,
    SUM(quantity) as arrival_qty
  FROM scheduled_arrivals
  WHERE arrival_date >= date_trunc('month', CURRENT_DATE)
    AND arrival_date < date_trunc('month', CURRENT_DATE) + interval '12 months'
  GROUP BY product_id, to_char(arrival_date, 'YYYY-MM')
),

-- Calculate running balance and find first rupture month per product
product_projections AS (
  SELECT 
    p.id as product_id,
    p.code as product_code,
    p.supplier_id,
    m.month_offset,
    m.month_key,
    COALESCE(li.initial_stock, 0) as initial_stock,
    COALESCE(f.forecast_qty, 0) as forecast_qty,
    COALESCE(a.arrival_qty, 0) as arrival_qty,
    -- Calculate cumulative balance
    COALESCE(li.initial_stock, 0) 
      - SUM(COALESCE(f.forecast_qty, 0)) OVER (PARTITION BY p.id ORDER BY m.month_offset)
      + SUM(COALESCE(a.arrival_qty, 0)) OVER (PARTITION BY p.id ORDER BY m.month_offset) as balance
  FROM products p
  CROSS JOIN months m
  LEFT JOIN latest_inventory li ON li.product_id = p.id
  LEFT JOIN forecasts_by_month f ON f.product_id = p.id AND f.month_key = m.month_key
  LEFT JOIN arrivals_by_month a ON a.product_id = p.id AND a.month_key = m.month_key
  WHERE p.is_active = true
    AND p.supplier_id IS NOT NULL
),

-- Find first rupture month per product
first_rupture AS (
  SELECT DISTINCT ON (product_id)
    product_id,
    product_code,
    supplier_id,
    month_offset as rupture_month_offset,
    month_key as rupture_month_key
  FROM product_projections
  WHERE balance < 0
  ORDER BY product_id, month_offset
),

-- Classify products by rupture period
product_ruptures AS (
  SELECT 
    p.id as product_id,
    p.code as product_code,
    p.supplier_id,
    fr.rupture_month_offset,
    fr.rupture_month_key,
    CASE 
      WHEN fr.rupture_month_offset IS NULL THEN 'ok'
      WHEN fr.rupture_month_offset < 3 THEN 'critical'
      WHEN fr.rupture_month_offset < 6 THEN 'alert'
      WHEN fr.rupture_month_offset < 9 THEN 'attention'
      ELSE 'ok'
    END as rupture_period
  FROM products p
  LEFT JOIN first_rupture fr ON fr.product_id = p.id
  WHERE p.is_active = true
    AND p.supplier_id IS NOT NULL
)

-- Final aggregation by supplier
SELECT 
  s.id as supplier_id,
  s.company_name,
  s.country,
  COUNT(pr.product_id) as total_products,
  COUNT(CASE WHEN pr.rupture_period = 'critical' THEN 1 END) as critical_count,
  COUNT(CASE WHEN pr.rupture_period = 'alert' THEN 1 END) as alert_count,
  COUNT(CASE WHEN pr.rupture_period = 'attention' THEN 1 END) as attention_count,
  COUNT(CASE WHEN pr.rupture_period = 'ok' THEN 1 END) as ok_count,
  CASE 
    WHEN COUNT(CASE WHEN pr.rupture_period = 'critical' THEN 1 END) > 0 THEN 'critical'
    WHEN COUNT(CASE WHEN pr.rupture_period = 'alert' THEN 1 END) > 0 THEN 'alert'
    WHEN COUNT(CASE WHEN pr.rupture_period = 'attention' THEN 1 END) > 0 THEN 'attention'
    ELSE 'ok'
  END as overall_status,
  -- JSON array of ruptured products for tooltips
  COALESCE(
    jsonb_agg(
      CASE WHEN pr.rupture_period != 'ok' THEN
        jsonb_build_object(
          'product_id', pr.product_id,
          'code', pr.product_code,
          'period', pr.rupture_period,
          'rupture_month', pr.rupture_month_key
        )
      END
    ) FILTER (WHERE pr.rupture_period != 'ok'),
    '[]'::jsonb
  ) as ruptured_products,
  now() as calculated_at
FROM suppliers s
LEFT JOIN product_ruptures pr ON pr.supplier_id = s.id
WHERE s.is_active = true
GROUP BY s.id, s.company_name, s.country
HAVING COUNT(pr.product_id) > 0
ORDER BY 
  CASE 
    WHEN COUNT(CASE WHEN pr.rupture_period = 'critical' THEN 1 END) > 0 THEN 0
    WHEN COUNT(CASE WHEN pr.rupture_period = 'alert' THEN 1 END) > 0 THEN 1
    WHEN COUNT(CASE WHEN pr.rupture_period = 'attention' THEN 1 END) > 0 THEN 2
    ELSE 3
  END,
  COUNT(CASE WHEN pr.rupture_period != 'ok' THEN 1 END) DESC,
  s.company_name;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_supplier_health_summary_id ON public.supplier_health_summary (supplier_id);

-- Create function to refresh the materialized view
CREATE OR REPLACE FUNCTION public.refresh_supplier_health_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.supplier_health_summary;
END;
$$;

-- Grant permissions
GRANT SELECT ON public.supplier_health_summary TO authenticated;
GRANT SELECT ON public.supplier_health_summary TO anon;

-- Enable RLS-like security via function (view doesn't support RLS directly)
COMMENT ON MATERIALIZED VIEW public.supplier_health_summary IS 'Pre-calculated supplier health status. Refresh via refresh_supplier_health_summary()';