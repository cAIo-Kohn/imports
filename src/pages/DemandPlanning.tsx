import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, TrendingDown, AlertTriangle, TrendingUp, Building2 } from 'lucide-react';
import { SupplierHealthCard, type SupplierHealthData } from '@/components/planning/SupplierHealthCard';
import { HealthBar } from '@/components/planning/HealthBar';
import { format, addMonths, startOfMonth, parseISO } from 'date-fns';

interface Supplier {
  id: string;
  company_name: string;
  country: string;
}

interface Product {
  id: string;
  supplier_id: string | null;
}

export default function DemandPlanning() {
  // Fetch suppliers
  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery({
    queryKey: ['suppliers-for-planning'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, company_name, country')
        .eq('is_active', true)
        .order('company_name');
      if (error) throw error;
      return data as Supplier[];
    },
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ['products-for-planning'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, supplier_id')
        .eq('is_active', true);
      if (error) throw error;
      return data as Product[];
    },
  });

  // Fetch forecasts (next 6 months)
  const { data: forecasts = [] } = useQuery({
    queryKey: ['sales-forecasts-summary'],
    queryFn: async () => {
      const now = new Date();
      const startMonth = format(startOfMonth(now), 'yyyy-MM-dd');
      const endMonth = format(addMonths(startOfMonth(now), 6), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('sales_forecasts')
        .select('product_id, quantity')
        .gte('year_month', startMonth)
        .lt('year_month', endMonth);
      if (error) throw error;
      return data;
    },
  });

  // Fetch latest inventory
  const { data: inventorySnapshots = [] } = useQuery({
    queryKey: ['inventory-snapshots-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_snapshots')
        .select('product_id, quantity, snapshot_date')
        .order('snapshot_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch pending purchase orders
  const { data: purchaseItems = [] } = useQuery({
    queryKey: ['purchase-items-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select(`
          product_id,
          quantity,
          unit_price_usd,
          expected_arrival,
          purchase_orders!inner (status, supplier_id)
        `)
        .not('expected_arrival', 'is', null);
      if (error) throw error;
      return data?.filter(item => 
        (item.purchase_orders as any)?.status !== 'cancelled' && 
        (item.purchase_orders as any)?.status !== 'received'
      ) || [];
    },
  });

  // Calculate supplier health data
  const supplierHealthData = useMemo((): SupplierHealthData[] => {
    // Group forecasts by product (sum of 6 months)
    const forecastByProduct = new Map<string, number>();
    forecasts.forEach(f => {
      const current = forecastByProduct.get(f.product_id) || 0;
      forecastByProduct.set(f.product_id, current + f.quantity);
    });

    // Get latest inventory per product
    const inventoryByProduct = new Map<string, number>();
    const processedProducts = new Set<string>();
    inventorySnapshots.forEach(inv => {
      if (!processedProducts.has(inv.product_id)) {
        inventoryByProduct.set(inv.product_id, inv.quantity);
        processedProducts.add(inv.product_id);
      }
    });

    // Group pending orders by supplier
    const pendingBySupplier = new Map<string, { value: number; nextArrival: string | null }>();
    purchaseItems.forEach(item => {
      const supplierId = (item.purchase_orders as any)?.supplier_id;
      if (!supplierId) return;
      
      const current = pendingBySupplier.get(supplierId) || { value: 0, nextArrival: null };
      const itemValue = item.quantity * (item.unit_price_usd || 0);
      
      let nextArrival = current.nextArrival;
      if (item.expected_arrival) {
        if (!nextArrival || item.expected_arrival < nextArrival) {
          nextArrival = item.expected_arrival;
        }
      }
      
      pendingBySupplier.set(supplierId, {
        value: current.value + itemValue,
        nextArrival,
      });
    });

    // Calculate health for each supplier
    return suppliers.map(supplier => {
      const supplierProducts = products.filter(p => p.supplier_id === supplier.id);
      
      let criticalCount = 0;
      let warningCount = 0;
      let healthyCount = 0;

      supplierProducts.forEach(product => {
        const stock = inventoryByProduct.get(product.id) || 0;
        const forecast = forecastByProduct.get(product.id) || 0;
        
        if (forecast === 0) {
          // No forecast = consider healthy
          healthyCount++;
        } else if (stock < forecast * 0.3) {
          // Less than 30% of needed = critical
          criticalCount++;
        } else if (stock < forecast) {
          // Between 30% and 100% = warning
          warningCount++;
        } else {
          // More than forecast = healthy
          healthyCount++;
        }
      });

      const pending = pendingBySupplier.get(supplier.id) || { value: 0, nextArrival: null };

      return {
        supplier: {
          id: supplier.id,
          company_name: supplier.company_name,
          country: supplier.country,
        },
        stats: {
          totalProducts: supplierProducts.length,
          criticalCount,
          warningCount,
          healthyCount,
        },
        pendingOrders: {
          totalValue: pending.value,
          nextArrival: pending.nextArrival,
        },
      };
    }).filter(s => s.stats.totalProducts > 0) // Only show suppliers with products
      .sort((a, b) => {
        // Sort by urgency: critical first, then warning
        if (a.stats.criticalCount !== b.stats.criticalCount) {
          return b.stats.criticalCount - a.stats.criticalCount;
        }
        if (a.stats.warningCount !== b.stats.warningCount) {
          return b.stats.warningCount - a.stats.warningCount;
        }
        return a.supplier.company_name.localeCompare(b.supplier.company_name);
      });
  }, [suppliers, products, forecasts, inventorySnapshots, purchaseItems]);

  // Overall stats
  const overallStats = useMemo(() => {
    const totalProducts = supplierHealthData.reduce((sum, s) => sum + s.stats.totalProducts, 0);
    const totalCritical = supplierHealthData.reduce((sum, s) => sum + s.stats.criticalCount, 0);
    const totalWarning = supplierHealthData.reduce((sum, s) => sum + s.stats.warningCount, 0);
    const totalHealthy = supplierHealthData.reduce((sum, s) => sum + s.stats.healthyCount, 0);
    return { totalProducts, totalCritical, totalWarning, totalHealthy };
  }, [supplierHealthData]);

  if (suppliersLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Planejamento de Demanda</h1>
        <p className="text-muted-foreground">
          Selecione um fornecedor para analisar a projeção de estoque
        </p>
      </div>

      {/* Overall Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Resumo Geral</CardTitle>
          <CardDescription>Visão consolidada de todos os fornecedores</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overallStats.totalProducts}</p>
                <p className="text-xs text-muted-foreground">produtos</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{overallStats.totalCritical}</p>
                <p className="text-xs text-muted-foreground">críticos</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-500">{overallStats.totalWarning}</p>
                <p className="text-xs text-muted-foreground">atenção</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500">{overallStats.totalHealthy}</p>
                <p className="text-xs text-muted-foreground">OK</p>
              </div>
            </div>
          </div>
          <HealthBar
            critical={overallStats.totalCritical}
            warning={overallStats.totalWarning}
            healthy={overallStats.totalHealthy}
            className="mt-4"
          />
        </CardContent>
      </Card>

      {/* Supplier Cards */}
      {supplierHealthData.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <Building2 className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">Nenhum fornecedor com produtos</p>
              <p className="text-sm text-muted-foreground">
                Cadastre produtos e associe a fornecedores para visualizar o planejamento
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {supplierHealthData.map(data => (
            <SupplierHealthCard key={data.supplier.id} data={data} />
          ))}
        </div>
      )}
    </div>
  );
}
