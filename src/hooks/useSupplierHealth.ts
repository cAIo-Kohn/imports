import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { type SupplierHealthRowData } from '@/components/planning/SupplierHealthRow';
import { type RupturedProduct } from '@/components/planning/PeriodIndicator';
import { useToast } from '@/hooks/use-toast';

interface SupplierHealthSummary {
  supplier_id: string;
  company_name: string;
  country: string;
  total_products: number;
  critical_count: number;
  alert_count: number;
  attention_count: number;
  ok_count: number;
  overall_status: 'critical' | 'alert' | 'attention' | 'ok';
  ruptured_products: Array<{
    product_id: string;
    code: string;
    period: 'critical' | 'alert' | 'attention';
    rupture_month: string;
  }>;
  calculated_at: string;
}

interface PendingOrderData {
  supplier_id: string;
  total_value: number;
  next_arrival: string | null;
}

export function useSupplierHealth() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch pre-calculated health data from materialized view
  const {
    data: healthSummary = [],
    isLoading: healthLoading,
    refetch: refetchHealth,
    error: healthError,
  } = useQuery({
    queryKey: ['supplier-health-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_health_summary')
        .select('*');
      
      if (error) throw error;
      return data as SupplierHealthSummary[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - view data doesn't change frequently
  });

  // Fetch pending purchase orders (still needed for order info)
  const { data: pendingOrders = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['pending-orders-by-supplier'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select(`
          quantity,
          unit_price_usd,
          expected_arrival,
          purchase_orders!inner (status, supplier_id)
        `)
        .not('expected_arrival', 'is', null);
      
      if (error) throw error;
      
      // Aggregate by supplier
      const bySupplier = new Map<string, { value: number; nextArrival: string | null }>();
      
      data?.forEach(item => {
        const po = item.purchase_orders as any;
        if (po?.status === 'cancelled' || po?.status === 'received') return;
        
        const supplierId = po?.supplier_id;
        if (!supplierId) return;
        
        const current = bySupplier.get(supplierId) || { value: 0, nextArrival: null };
        const itemValue = item.quantity * (item.unit_price_usd || 0);
        
        let nextArrival = current.nextArrival;
        if (item.expected_arrival) {
          if (!nextArrival || item.expected_arrival < nextArrival) {
            nextArrival = item.expected_arrival;
          }
        }
        
        bySupplier.set(supplierId, {
          value: current.value + itemValue,
          nextArrival,
        });
      });
      
      return Array.from(bySupplier.entries()).map(([supplier_id, data]) => ({
        supplier_id,
        total_value: data.value,
        next_arrival: data.nextArrival,
      })) as PendingOrderData[];
    },
  });

  // Transform to SupplierHealthRowData format
  const supplierHealthData: SupplierHealthRowData[] = healthSummary.map(summary => {
    const pending = pendingOrders.find(p => p.supplier_id === summary.supplier_id);
    
    // Group ruptured products by period
    const criticalProducts: RupturedProduct[] = [];
    const alertProducts: RupturedProduct[] = [];
    const attentionProducts: RupturedProduct[] = [];
    
    summary.ruptured_products?.forEach(rp => {
      const product: RupturedProduct = {
        productId: rp.product_id,
        code: rp.code,
        firstRuptureMonthKey: rp.rupture_month,
      };
      
      if (rp.period === 'critical') {
        criticalProducts.push(product);
      } else if (rp.period === 'alert') {
        alertProducts.push(product);
      } else if (rp.period === 'attention') {
        attentionProducts.push(product);
      }
    });

    return {
      supplier: {
        id: summary.supplier_id,
        company_name: summary.company_name,
        country: summary.country,
      },
      stats: {
        totalProducts: summary.total_products,
        periods: {
          threeMonths: {
            label: '3 meses',
            ruptureCount: summary.critical_count,
            status: summary.critical_count > 0 ? 'critical' : 'ok',
            rupturedProducts: criticalProducts,
          },
          sixMonths: {
            label: '6 meses',
            ruptureCount: summary.alert_count,
            status: summary.alert_count > 0 ? 'alert' : 'ok',
            rupturedProducts: alertProducts,
          },
          nineMonths: {
            label: '9 meses',
            ruptureCount: summary.attention_count,
            status: summary.attention_count > 0 ? 'attention' : 'ok',
            rupturedProducts: attentionProducts,
          },
          twelveMonths: {
            label: '12 meses',
            ruptureCount: 0,
            status: 'ok',
            rupturedProducts: [],
          },
        },
        overallStatus: summary.overall_status,
      },
      pendingOrders: {
        totalValue: pending?.total_value ?? 0,
        nextArrival: pending?.next_arrival ?? null,
      },
    };
  });

  // Calculate overall stats
  const overallStats = {
    totalProducts: supplierHealthData.reduce((sum, s) => sum + s.stats.totalProducts, 0),
    totalCritical: supplierHealthData.reduce((sum, s) => sum + s.stats.periods.threeMonths.ruptureCount, 0),
    totalAlert: supplierHealthData.reduce((sum, s) => sum + s.stats.periods.sixMonths.ruptureCount, 0),
    totalAttention: supplierHealthData.reduce((sum, s) => sum + s.stats.periods.nineMonths.ruptureCount, 0),
    totalOk: 0,
    calculatedAt: healthSummary[0]?.calculated_at ?? null,
  };
  overallStats.totalOk = Math.max(0, overallStats.totalProducts - overallStats.totalCritical - overallStats.totalAlert - overallStats.totalAttention);

  // Refresh function that also refreshes the materialized view
  const refreshData = async () => {
    try {
      // Call the refresh function
      const { error } = await supabase.rpc('refresh_supplier_health_summary');
      if (error) throw error;
      
      // Refetch the data
      await refetchHealth();
      await queryClient.invalidateQueries({ queryKey: ['pending-orders-by-supplier'] });
      
      toast({ 
        title: 'Dados atualizados', 
        description: 'Os indicadores foram recalculados com base nos dados mais recentes.' 
      });
    } catch (error) {
      console.error('Error refreshing health data:', error);
      toast({ 
        title: 'Erro ao atualizar', 
        description: 'Não foi possível recalcular os indicadores.',
        variant: 'destructive',
      });
    }
  };

  return {
    supplierHealthData,
    overallStats,
    isLoading: healthLoading || pendingLoading,
    error: healthError,
    refreshData,
  };
}
