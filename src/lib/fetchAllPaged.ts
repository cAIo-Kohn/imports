import { supabase } from '@/integrations/supabase/client';
import { addMonths, format, parseISO } from 'date-fns';

/**
 * Helper to create a paged query for sales_forecasts
 */
export async function fetchAllForecasts(
  startMonth: string,
  endMonth: string
): Promise<{ data: { product_id: string; quantity: number; year_month: string }[]; total: number }> {
  // First get the count
  const { count, error: countError } = await supabase
    .from('sales_forecasts')
    .select('id', { count: 'exact', head: true })
    .gte('year_month', startMonth)
    .lt('year_month', endMonth);

  if (countError) throw countError;

  const total = count || 0;
  const pageSize = 1000;
  const maxPages = 50;
  const allData: { product_id: string; quantity: number; year_month: string }[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore && page < maxPages) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('sales_forecasts')
      .select('product_id, quantity, year_month')
      .gte('year_month', startMonth)
      .lt('year_month', endMonth)
      .order('year_month', { ascending: true })
      .order('product_id', { ascending: true })
      .range(from, to);

    if (error) throw error;

    if (data && data.length > 0) {
      allData.push(...data);
    }

    hasMore = data !== null && data.length === pageSize;
    page++;
  }

  return { data: allData, total };
}

/**
 * Fetch forecasts in parallel using two 6-month ranges
 */
export async function fetchForecastsParallel(
  startMonth: string,
  endMonth: string
): Promise<{ data: { product_id: string; quantity: number; year_month: string }[]; total: number }> {
  const midMonth = addMonths(parseISO(startMonth), 6);
  const midMonthStr = format(midMonth, 'yyyy-MM-dd');
  
  const [range1, range2] = await Promise.all([
    fetchAllForecasts(startMonth, midMonthStr),
    fetchAllForecasts(midMonthStr, endMonth),
  ]);
  
  return {
    data: [...range1.data, ...range2.data],
    total: range1.total + range2.total,
  };
}

/**
 * Helper to create a paged query for scheduled_arrivals
 */
export async function fetchAllArrivals(
  startMonth: string,
  endMonth: string
): Promise<{ data: { product_id: string; quantity: number; arrival_date: string }[]; total: number }> {
  // First get the count
  const { count, error: countError } = await supabase
    .from('scheduled_arrivals')
    .select('id', { count: 'exact', head: true })
    .gte('arrival_date', startMonth)
    .lt('arrival_date', endMonth);

  if (countError) throw countError;

  const total = count || 0;
  const pageSize = 1000;
  const maxPages = 50;
  const allData: { product_id: string; quantity: number; arrival_date: string }[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore && page < maxPages) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('scheduled_arrivals')
      .select('product_id, quantity, arrival_date')
      .gte('arrival_date', startMonth)
      .lt('arrival_date', endMonth)
      .order('arrival_date', { ascending: true })
      .order('product_id', { ascending: true })
      .range(from, to);

    if (error) throw error;

    if (data && data.length > 0) {
      allData.push(...data);
    }

    hasMore = data !== null && data.length === pageSize;
    page++;
  }

  return { data: allData, total };
}

/**
 * Fetch arrivals in parallel using two 6-month ranges
 */
export async function fetchArrivalsParallel(
  startMonth: string,
  endMonth: string
): Promise<{ data: { product_id: string; quantity: number; arrival_date: string }[]; total: number }> {
  const midMonth = addMonths(parseISO(startMonth), 6);
  const midMonthStr = format(midMonth, 'yyyy-MM-dd');
  
  const [range1, range2] = await Promise.all([
    fetchAllArrivals(startMonth, midMonthStr),
    fetchAllArrivals(midMonthStr, endMonth),
  ]);
  
  return {
    data: [...range1.data, ...range2.data],
    total: range1.total + range2.total,
  };
}

/**
 * Helper to create a paged query for inventory_snapshots
 */
export async function fetchAllInventory(): Promise<{ 
  data: { product_id: string; quantity: number; snapshot_date: string }[]; 
  total: number 
}> {
  // First get the count
  const { count, error: countError } = await supabase
    .from('inventory_snapshots')
    .select('id', { count: 'exact', head: true });

  if (countError) throw countError;

  const total = count || 0;
  const pageSize = 1000;
  const maxPages = 50;
  const allData: { product_id: string; quantity: number; snapshot_date: string }[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore && page < maxPages) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('inventory_snapshots')
      .select('product_id, quantity, snapshot_date')
      .order('snapshot_date', { ascending: false })
      .order('product_id', { ascending: true })
      .range(from, to);

    if (error) throw error;

    if (data && data.length > 0) {
      allData.push(...data);
    }

    hasMore = data !== null && data.length === pageSize;
    page++;
  }

  return { data: allData, total };
}
