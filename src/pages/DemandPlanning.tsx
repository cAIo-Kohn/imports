import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Package, TrendingDown, AlertTriangle, TrendingUp, Building2, Upload, FileSpreadsheet, RefreshCw, Ship, Bug } from 'lucide-react';
import { SupplierHealthRow, type SupplierHealthRowData } from '@/components/planning/SupplierHealthRow';
import { type PeriodStats, type RupturedProduct } from '@/components/planning/PeriodIndicator';
import { HealthBar } from '@/components/planning/HealthBar';
import { ImportForecastModal } from '@/components/planning/ImportForecastModal';
import { ImportInventoryModal } from '@/components/planning/ImportInventoryModal';
import { ImportArrivalsModal } from '@/components/planning/ImportArrivalsModal';
import { ImportSalesHistoryModal } from '@/components/planning/ImportSalesHistoryModal';
import { format, addMonths, startOfMonth } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { fetchForecastsParallel, fetchArrivalsParallel, fetchAllInventory } from '@/lib/fetchAllPaged';

interface Supplier {
  id: string;
  company_name: string;
  country: string;
}

interface Product {
  id: string;
  code: string;
  supplier_id: string | null;
}

interface Forecast {
  product_id: string;
  quantity: number;
  year_month: string;
}

interface InventorySnapshot {
  product_id: string;
  quantity: number;
  snapshot_date: string;
}

interface ScheduledArrival {
  product_id: string;
  quantity: number;
  arrival_date: string;
  process_number?: string | null;
}

export default function DemandPlanning() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const debugMode = searchParams.get('debug') === '1';
  
  // Modal states
  const [importForecastOpen, setImportForecastOpen] = useState(false);
  const [importInventoryOpen, setImportInventoryOpen] = useState(false);
  const [importHistoryOpen, setImportHistoryOpen] = useState(false);
  const [importArrivalsOpen, setImportArrivalsOpen] = useState(false);

  const now = new Date();
  const startMonth = startOfMonth(now);

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

  // Fetch products (include code for debug tooltips)
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products-for-planning'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, code, supplier_id')
        .eq('is_active', true);
      if (error) throw error;
      return data as Product[];
    },
  });

  // Date range for 12-month queries (memoized for stable queryKey)
  const startMonthStr = useMemo(() => format(startMonth, 'yyyy-MM-dd'), []);
  const endMonthStr = useMemo(() => format(addMonths(startMonth, 12), 'yyyy-MM-dd'), []);

  // Fetch forecasts (next 12 months) with parallel pagination - queryKey includes date range for proper cache invalidation
  const { data: forecastsResult, isLoading: forecastsLoading, refetch: refetchForecasts } = useQuery({
    queryKey: ['sales-forecasts-12m-parallel', startMonthStr, endMonthStr],
    queryFn: () => fetchForecastsParallel(startMonthStr, endMonthStr),
  });
  const forecasts = forecastsResult?.data ?? [];
  const forecastsTotal = forecastsResult?.total ?? 0;

  // Fetch inventory snapshots (latest per product) with pagination
  const { data: inventoryResult, isLoading: inventoryLoading, refetch: refetchInventory } = useQuery({
    queryKey: ['inventory-snapshots-paged'],
    queryFn: () => fetchAllInventory(),
  });
  const inventorySnapshots = inventoryResult?.data ?? [];
  const inventoryTotal = inventoryResult?.total ?? 0;

  // Fetch scheduled arrivals (next 12 months) with parallel pagination - queryKey includes date range
  const { data: arrivalsResult, isLoading: arrivalsLoading, refetch: refetchArrivals } = useQuery({
    queryKey: ['scheduled-arrivals-12m-parallel', startMonthStr, endMonthStr],
    queryFn: () => fetchArrivalsParallel(startMonthStr, endMonthStr),
  });
  const scheduledArrivals = arrivalsResult?.data ?? [];
  const arrivalsTotal = arrivalsResult?.total ?? 0;

  // Fetch pending purchase orders (including reference_number for deduplication)
  const { data: purchaseItems = [], refetch: refetchPurchaseItems } = useQuery({
    queryKey: ['purchase-items-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select(`
          product_id,
          quantity,
          unit_price_usd,
          expected_arrival,
          purchase_orders!inner (status, supplier_id, reference_number)
        `)
        .not('expected_arrival', 'is', null);
      if (error) throw error;
      return data?.filter(item => 
        (item.purchase_orders as any)?.status !== 'cancelled' && 
        (item.purchase_orders as any)?.status !== 'received'
      ) || [];
    },
  });

  // Check if all data is ready for rendering
  const isDataReady = !suppliersLoading && !productsLoading && !forecastsLoading && !inventoryLoading && !arrivalsLoading;

  // Generate month keys for 12 months
  const monthKeys = useMemo(() => {
    const keys: string[] = [];
    for (let i = 0; i < 12; i++) {
      keys.push(format(addMonths(startMonth, i), 'yyyy-MM'));
    }
    return keys;
  }, []);

  // Calculate supplier health data with proper month-by-month projection
  const supplierHealthData = useMemo((): SupplierHealthRowData[] => {
    // Get latest inventory per product
    const latestInventoryByProduct = new Map<string, number>();
    const processedLatest = new Set<string>();
    
    const sortedInventory = [...inventorySnapshots].sort((a, b) => 
      new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime()
    );
    
    sortedInventory.forEach(inv => {
      if (!processedLatest.has(inv.product_id)) {
        latestInventoryByProduct.set(inv.product_id, inv.quantity);
        processedLatest.add(inv.product_id);
      }
    });

  // Group forecasts by product and month
  const forecastByProductMonth = new Map<string, Map<string, number>>();
  forecasts.forEach(f => {
    // Extract month key directly from ISO string to avoid timezone issues
    const monthKey = f.year_month.substring(0, 7);
    if (!forecastByProductMonth.has(f.product_id)) {
      forecastByProductMonth.set(f.product_id, new Map());
    }
    const productMonths = forecastByProductMonth.get(f.product_id)!;
    productMonths.set(monthKey, (productMonths.get(monthKey) || 0) + f.quantity);
  });

  // Group app order arrivals by product and month
  const appOrdersByProductMonth = new Map<string, Map<string, number>>();
  purchaseItems.forEach(item => {
    if (!item.expected_arrival) return;
    const monthKey = item.expected_arrival.substring(0, 7);
    
    if (!appOrdersByProductMonth.has(item.product_id)) {
      appOrdersByProductMonth.set(item.product_id, new Map());
    }
    const productMonths = appOrdersByProductMonth.get(item.product_id)!;
    productMonths.set(monthKey, (productMonths.get(monthKey) || 0) + item.quantity);
  });

  // Get reference numbers for filtering duplicates from scheduled_arrivals
  const appOrderReferenceNumbers = new Set<string>();
  purchaseItems.forEach(item => {
    const refNum = (item.purchase_orders as any)?.reference_number;
    if (refNum) appOrderReferenceNumbers.add(refNum);
  });

  // Group arrivals by product and month (excluding those already matched to app orders)
  const arrivalsByProductMonth = new Map<string, Map<string, number>>();
  scheduledArrivals.forEach(arr => {
    // Se o process_number corresponde a um reference_number de pedido do app, ignorar
    if (arr.process_number && appOrderReferenceNumbers.has(arr.process_number)) {
      return; // Evita duplicação
    }
    
    // Extract month key directly from ISO string to avoid timezone issues
    const monthKey = arr.arrival_date.substring(0, 7);
    if (!arrivalsByProductMonth.has(arr.product_id)) {
      arrivalsByProductMonth.set(arr.product_id, new Map());
    }
    const productMonths = arrivalsByProductMonth.get(arr.product_id)!;
    productMonths.set(monthKey, (productMonths.get(monthKey) || 0) + arr.quantity);
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
      
      // Track ruptures per period with product details
      const rupturesIn3m: RupturedProduct[] = [];
      const rupturesIn6m: RupturedProduct[] = [];
      const rupturesIn9m: RupturedProduct[] = [];
      const rupturesIn12m: RupturedProduct[] = [];

      supplierProducts.forEach(product => {
        const initialStock = latestInventoryByProduct.get(product.id) || 0;
        const productForecasts = forecastByProductMonth.get(product.id) || new Map();
        const productArrivals = arrivalsByProductMonth.get(product.id) || new Map();
        const productAppOrders = appOrdersByProductMonth.get(product.id) || new Map();
        
        let balance = initialStock;
        let firstRuptureMonth: number | null = null;
        let firstRuptureMonthKey: string | null = null;

        // Project month by month
        for (let i = 0; i < 12; i++) {
          const monthKey = monthKeys[i];
          const forecast = productForecasts.get(monthKey) || 0;
          const uploadedArrivals = productArrivals.get(monthKey) || 0;
          const appOrderArrivals = productAppOrders.get(monthKey) || 0;
          const arrivals = uploadedArrivals + appOrderArrivals; // SOMA AMBAS AS FONTES
          
          balance = balance - forecast + arrivals;
          
          if (balance < 0 && firstRuptureMonth === null) {
            firstRuptureMonth = i;
            firstRuptureMonthKey = monthKey;
            break; // We only need the first rupture month
          }
        }

        // Classify by period with product details
        if (firstRuptureMonth !== null && firstRuptureMonthKey !== null) {
          const ruptureInfo: RupturedProduct = {
            productId: product.id,
            code: product.code,
            firstRuptureMonthKey,
          };
          
          if (firstRuptureMonth < 3) {
            rupturesIn3m.push(ruptureInfo);
          } else if (firstRuptureMonth < 6) {
            rupturesIn6m.push(ruptureInfo);
          } else if (firstRuptureMonth < 9) {
            rupturesIn9m.push(ruptureInfo);
          } else {
            rupturesIn12m.push(ruptureInfo);
          }
        }
      });

      // Create period stats with product details
      const createPeriodStats = (
        label: string, 
        rupturedProducts: RupturedProduct[], 
        periodType: 'critical' | 'alert' | 'attention' | 'ok'
      ): PeriodStats => ({
        label,
        ruptureCount: rupturedProducts.length,
        status: rupturedProducts.length > 0 ? periodType : 'ok',
        rupturedProducts,
      });

      const periods = {
        threeMonths: createPeriodStats('3 meses', rupturesIn3m, 'critical'),
        sixMonths: createPeriodStats('6 meses', rupturesIn6m, 'alert'),
        nineMonths: createPeriodStats('9 meses', rupturesIn9m, 'attention'),
        twelveMonths: createPeriodStats('12 meses', rupturesIn12m, 'ok'),
      };

      // Determine overall status (based on earliest rupture)
      let overallStatus: 'critical' | 'alert' | 'attention' | 'ok' = 'ok';
      if (rupturesIn3m.length > 0) {
        overallStatus = 'critical';
      } else if (rupturesIn6m.length > 0) {
        overallStatus = 'alert';
      } else if (rupturesIn9m.length > 0) {
        overallStatus = 'attention';
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
          periods,
          overallStatus,
        },
        pendingOrders: {
          totalValue: pending.value,
          nextArrival: pending.nextArrival,
        },
      };
    }).filter(s => s.stats.totalProducts > 0)
      .sort((a, b) => {
        // Sort by urgency (critical first)
        const statusOrder = { critical: 0, alert: 1, attention: 2, ok: 3 };
        if (statusOrder[a.stats.overallStatus] !== statusOrder[b.stats.overallStatus]) {
          return statusOrder[a.stats.overallStatus] - statusOrder[b.stats.overallStatus];
        }
        // Then by total ruptures
        const aRuptures = a.stats.periods.threeMonths.ruptureCount + a.stats.periods.sixMonths.ruptureCount + 
                          a.stats.periods.nineMonths.ruptureCount + a.stats.periods.twelveMonths.ruptureCount;
        const bRuptures = b.stats.periods.threeMonths.ruptureCount + b.stats.periods.sixMonths.ruptureCount + 
                          b.stats.periods.nineMonths.ruptureCount + b.stats.periods.twelveMonths.ruptureCount;
        if (aRuptures !== bRuptures) {
          return bRuptures - aRuptures;
        }
        return a.supplier.company_name.localeCompare(b.supplier.company_name);
      });
  }, [suppliers, products, forecasts, inventorySnapshots, scheduledArrivals, purchaseItems, monthKeys]);

  // Overall stats
  const overallStats = useMemo(() => {
    const totalProducts = supplierHealthData.reduce((sum, s) => sum + s.stats.totalProducts, 0);
    const totalCritical = supplierHealthData.reduce((sum, s) => sum + s.stats.periods.threeMonths.ruptureCount, 0);
    const totalAlert = supplierHealthData.reduce((sum, s) => sum + s.stats.periods.sixMonths.ruptureCount, 0);
    const totalAttention = supplierHealthData.reduce((sum, s) => sum + s.stats.periods.nineMonths.ruptureCount, 0);
    const totalOk = totalProducts - totalCritical - totalAlert - totalAttention;
    return { totalProducts, totalCritical, totalAlert, totalAttention, totalOk: Math.max(0, totalOk) };
  }, [supplierHealthData]);

  // Handle refresh
  const handleRefreshData = useCallback(() => {
    refetchSuppliers();
    refetchForecasts();
    refetchInventory();
    refetchArrivals();
    refetchPurchaseItems();
    toast({ title: 'Dados atualizados', description: 'Os indicadores foram recalculados com base nos dados mais recentes.' });
  }, [refetchSuppliers, refetchForecasts, refetchInventory, refetchArrivals, refetchPurchaseItems, toast]);

  // Handle import success
  const handleImportSuccess = useCallback(() => {
    handleRefreshData();
  }, [handleRefreshData]);

  // Toggle debug mode
  const toggleDebug = useCallback(() => {
    if (debugMode) {
      searchParams.delete('debug');
    } else {
      searchParams.set('debug', '1');
    }
    setSearchParams(searchParams);
  }, [debugMode, searchParams, setSearchParams]);

  // Show loading state until ALL data is ready (prevents false "OK" states)
  if (!isDataReady) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <p className="text-sm text-muted-foreground text-center">Carregando dados e calculando indicadores...</p>
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
          <Button 
            variant={debugMode ? "default" : "outline"} 
            size="icon" 
            onClick={toggleDebug} 
            title={debugMode ? "Desativar modo debug" : "Ativar modo debug"}
          >
            <Bug className="h-4 w-4" />
          </Button>
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

      {/* Debug Panel */}
      {debugMode && (
        <Card className="border-dashed border-2 border-amber-500 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bug className="h-4 w-4 text-amber-500" />
              Modo Diagnóstico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">Período: {startMonthStr} → {endMonthStr}</Badge>
              <Badge variant={forecasts.length < forecastsTotal ? "destructive" : "secondary"}>
                Previsões: {forecasts.length.toLocaleString()} / {forecastsTotal.toLocaleString()}
                {forecasts.length < forecastsTotal && " (INCOMPLETO!)"}
              </Badge>
              <Badge variant={scheduledArrivals.length < arrivalsTotal ? "destructive" : "secondary"}>
                Chegadas: {scheduledArrivals.length.toLocaleString()} / {arrivalsTotal.toLocaleString()}
                {scheduledArrivals.length < arrivalsTotal && " (INCOMPLETO!)"}
              </Badge>
              <Badge variant={inventorySnapshots.length < inventoryTotal ? "destructive" : "secondary"}>
                Estoque: {inventorySnapshots.length.toLocaleString()} / {inventoryTotal.toLocaleString()}
                {inventorySnapshots.length < inventoryTotal && " (INCOMPLETO!)"}
              </Badge>
              <Badge variant="secondary">Produtos: {products.length.toLocaleString()}</Badge>
              <Badge variant="secondary">Fornecedores: {suppliers.length}</Badge>
            </div>
            {(forecasts.length === forecastsTotal && scheduledArrivals.length === arrivalsTotal && inventorySnapshots.length === inventoryTotal) ? (
              <p className="text-xs text-green-600">✓ Todos os dados foram carregados com sucesso via paginação.</p>
            ) : (
              <p className="text-xs text-destructive">⚠ Alguns dados podem estar incompletos. Verifique os badges acima.</p>
            )}
            <p className="text-xs text-muted-foreground">
              Passe o mouse nos indicadores de período (3m, 6m...) para ver os produtos com ruptura.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Overall Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Resumo Geral</CardTitle>
          <CardDescription>Visão consolidada por horizonte de planejamento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                <p className="text-xs text-muted-foreground">crítico (3m)</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-500">{overallStats.totalAlert}</p>
                <p className="text-xs text-muted-foreground">alerta (6m)</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-500">{overallStats.totalAttention}</p>
                <p className="text-xs text-muted-foreground">atenção (9m)</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500">{overallStats.totalOk}</p>
                <p className="text-xs text-muted-foreground">OK</p>
              </div>
            </div>
          </div>
          <HealthBar
            critical={overallStats.totalCritical}
            warning={overallStats.totalAlert + overallStats.totalAttention}
            healthy={overallStats.totalOk}
            className="mt-4"
          />
        </CardContent>
      </Card>

      {/* Supplier Rows */}
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
        <div className="space-y-3">
          {supplierHealthData.map(data => (
            <SupplierHealthRow key={data.supplier.id} data={data} />
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
