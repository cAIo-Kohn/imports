import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, TrendingDown, AlertTriangle, TrendingUp, Building2, Upload, FileSpreadsheet, RefreshCw, Ship } from 'lucide-react';
import { SupplierHealthCard, type SupplierHealthData } from '@/components/planning/SupplierHealthCard';
import { HealthBar } from '@/components/planning/HealthBar';
import { ImportForecastModal } from '@/components/planning/ImportForecastModal';
import { ImportInventoryModal } from '@/components/planning/ImportInventoryModal';
import { ImportArrivalsModal } from '@/components/planning/ImportArrivalsModal';
import { ImportSalesHistoryModal } from '@/components/planning/ImportSalesHistoryModal';
import { format, addMonths, startOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  
  // Modal states
  const [importForecastOpen, setImportForecastOpen] = useState(false);
  const [importInventoryOpen, setImportInventoryOpen] = useState(false);
  const [importHistoryOpen, setImportHistoryOpen] = useState(false);
  const [importArrivalsOpen, setImportArrivalsOpen] = useState(false);

  // Fetch suppliers
  const { data: suppliers = [], isLoading: suppliersLoading, refetch: refetchSuppliers } = useQuery({
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
  const { data: forecasts = [], refetch: refetchForecasts } = useQuery({
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

  // Fetch inventory snapshots (last 3 months for trend)
  const { data: inventorySnapshots = [], refetch: refetchInventory } = useQuery({
    queryKey: ['inventory-snapshots-trend'],
    queryFn: async () => {
      const now = new Date();
      const threeMonthsAgo = format(subMonths(startOfMonth(now), 3), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('inventory_snapshots')
        .select('product_id, quantity, snapshot_date')
        .gte('snapshot_date', threeMonthsAgo)
        .order('snapshot_date', { ascending: true });
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

    // Group inventory by product and month for trend analysis
    const inventoryByProductMonth = new Map<string, Map<string, number>>();
    const latestInventoryByProduct = new Map<string, number>();
    const processedLatest = new Set<string>();
    
    // Sort by date descending for latest
    const sortedInventory = [...inventorySnapshots].sort((a, b) => 
      new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime()
    );
    
    sortedInventory.forEach(inv => {
      // Track latest inventory per product
      if (!processedLatest.has(inv.product_id)) {
        latestInventoryByProduct.set(inv.product_id, inv.quantity);
        processedLatest.add(inv.product_id);
      }
      
      // Group by month for trend
      const monthKey = format(startOfMonth(new Date(inv.snapshot_date)), 'yyyy-MM');
      if (!inventoryByProductMonth.has(inv.product_id)) {
        inventoryByProductMonth.set(inv.product_id, new Map());
      }
      const productMonths = inventoryByProductMonth.get(inv.product_id)!;
      // Keep the latest snapshot per month
      if (!productMonths.has(monthKey)) {
        productMonths.set(monthKey, inv.quantity);
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

    // Generate last 3 months keys
    const now = new Date();
    const monthKeys: string[] = [];
    for (let i = 2; i >= 0; i--) {
      monthKeys.push(format(subMonths(startOfMonth(now), i), 'yyyy-MM'));
    }

    // Calculate health for each supplier
    return suppliers.map(supplier => {
      const supplierProducts = products.filter(p => p.supplier_id === supplier.id);
      
      let criticalCount = 0;
      let warningCount = 0;
      let healthyCount = 0;

      // Aggregate stock trend data for this supplier
      const monthlyTotals = new Map<string, number>();
      monthKeys.forEach(mk => monthlyTotals.set(mk, 0));

      supplierProducts.forEach(product => {
        const stock = latestInventoryByProduct.get(product.id) || 0;
        const forecast = forecastByProduct.get(product.id) || 0;
        
        if (forecast === 0) {
          healthyCount++;
        } else if (stock < forecast * 0.3) {
          criticalCount++;
        } else if (stock < forecast) {
          warningCount++;
        } else {
          healthyCount++;
        }

        // Aggregate monthly stock for trend
        const productMonths = inventoryByProductMonth.get(product.id);
        if (productMonths) {
          monthKeys.forEach(mk => {
            const qty = productMonths.get(mk) || 0;
            monthlyTotals.set(mk, (monthlyTotals.get(mk) || 0) + qty);
          });
        }
      });

      // Calculate trend data
      const trendData = monthKeys.map(mk => ({
        month: format(new Date(mk + '-01'), 'MMM', { locale: ptBR }),
        value: monthlyTotals.get(mk) || 0,
      }));

      // Determine trend direction
      const firstValue = trendData[0]?.value || 0;
      const lastValue = trendData[trendData.length - 1]?.value || 0;
      let trend: 'up' | 'down' | 'stable' = 'stable';
      let percentChange = 0;

      if (firstValue > 0) {
        percentChange = ((lastValue - firstValue) / firstValue) * 100;
        if (percentChange > 5) {
          trend = 'up';
        } else if (percentChange < -5) {
          trend = 'down';
        }
      } else if (lastValue > 0) {
        trend = 'up';
        percentChange = 100;
      }

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
        stockTrend: {
          data: trendData,
          trend,
          percentChange,
        },
      };
    }).filter(s => s.stats.totalProducts > 0)
      .sort((a, b) => {
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

  // Handle refresh
  const handleRefreshData = useCallback(() => {
    refetchSuppliers();
    refetchForecasts();
    refetchInventory();
    toast({ title: 'Dados atualizados', description: 'Os indicadores foram recalculados.' });
  }, [refetchSuppliers, refetchForecasts, refetchInventory, toast]);

  // Handle import success
  const handleImportSuccess = useCallback(() => {
    handleRefreshData();
  }, [handleRefreshData]);

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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planejamento de Demanda</h1>
          <p className="text-muted-foreground">
            Selecione um fornecedor para analisar a projeção de estoque
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefreshData} title="Atualizar dados">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setImportInventoryOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Estoque
          </Button>
          <Button variant="outline" onClick={() => setImportHistoryOpen(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Histórico
          </Button>
          <Button variant="outline" onClick={() => setImportArrivalsOpen(true)}>
            <Ship className="mr-2 h-4 w-4" />
            Chegadas
          </Button>
          <Button onClick={() => setImportForecastOpen(true)}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Previsão
          </Button>
        </div>
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

      {/* Import Modals */}
      <ImportForecastModal
        open={importForecastOpen}
        onOpenChange={setImportForecastOpen}
        onSuccess={handleImportSuccess}
      />
      <ImportInventoryModal
        open={importInventoryOpen}
        onOpenChange={setImportInventoryOpen}
        onSuccess={handleImportSuccess}
      />
      <ImportSalesHistoryModal
        open={importHistoryOpen}
        onOpenChange={setImportHistoryOpen}
        onSuccess={handleImportSuccess}
      />
      <ImportArrivalsModal
        open={importArrivalsOpen}
        onOpenChange={setImportArrivalsOpen}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
}
