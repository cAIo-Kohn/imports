import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, addMonths, startOfMonth, parseISO, subYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, AlertTriangle, Package, Search, Filter, Upload, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { ImportForecastModal } from '@/components/planning/ImportForecastModal';
import { ImportInventoryModal } from '@/components/planning/ImportInventoryModal';
import { ImportSalesHistoryModal } from '@/components/planning/ImportSalesHistoryModal';
import { ProjectionChart } from '@/components/planning/ProjectionChart';

interface Product {
  id: string;
  code: string;
  technical_description: string;
  lead_time_days: number | null;
  moq: number | null;
}

interface Unit {
  id: string;
  name: string;
}

interface MonthProjection {
  month: Date;
  monthLabel: string;
  initialStock: number;
  forecast: number;
  historyLastYear: number;
  purchases: number;
  finalBalance: number;
  status: 'ok' | 'warning' | 'rupture';
}

interface ProductProjection {
  product: Product;
  currentStock: number;
  projections: MonthProjection[];
  hasRupture: boolean;
  firstRuptureMonth: Date | null;
}

export default function DemandPlanning() {
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyRuptures, setShowOnlyRuptures] = useState(false);
  const [monthsAhead, setMonthsAhead] = useState(12);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  
  const [importForecastOpen, setImportForecastOpen] = useState(false);
  const [importInventoryOpen, setImportInventoryOpen] = useState(false);
  const [importHistoryOpen, setImportHistoryOpen] = useState(false);

  // Fetch units
  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Unit[];
    },
  });

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products-for-planning'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, code, technical_description, lead_time_days, moq')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return data as Product[];
    },
  });

  // Fetch forecasts
  const { data: forecasts = [], refetch: refetchForecasts } = useQuery({
    queryKey: ['sales-forecasts', selectedUnit],
    queryFn: async () => {
      let query = supabase
        .from('sales_forecasts')
        .select('product_id, unit_id, year_month, quantity, version')
        .order('year_month');
      
      if (selectedUnit !== 'all') {
        query = query.eq('unit_id', selectedUnit);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch sales history (previous year)
  const { data: salesHistory = [], refetch: refetchHistory } = useQuery({
    queryKey: ['sales-history', selectedUnit],
    queryFn: async () => {
      let query = supabase
        .from('sales_history')
        .select('product_id, unit_id, year_month, quantity')
        .order('year_month');
      
      if (selectedUnit !== 'all') {
        query = query.eq('unit_id', selectedUnit);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch latest inventory snapshots
  const { data: inventorySnapshots = [], refetch: refetchInventory } = useQuery({
    queryKey: ['inventory-snapshots', selectedUnit],
    queryFn: async () => {
      let query = supabase
        .from('inventory_snapshots')
        .select('product_id, unit_id, snapshot_date, quantity')
        .order('snapshot_date', { ascending: false });
      
      if (selectedUnit !== 'all') {
        query = query.eq('unit_id', selectedUnit);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch purchase order items with expected arrivals
  const { data: purchaseItems = [] } = useQuery({
    queryKey: ['purchase-order-items', selectedUnit],
    queryFn: async () => {
      let query = supabase
        .from('purchase_order_items')
        .select(`
          product_id,
          unit_id,
          quantity,
          expected_arrival,
          purchase_orders!inner (status)
        `)
        .not('expected_arrival', 'is', null);
      
      if (selectedUnit !== 'all') {
        query = query.eq('unit_id', selectedUnit);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data?.filter(item => 
        (item.purchase_orders as any)?.status !== 'cancelled' && 
        (item.purchase_orders as any)?.status !== 'received'
      ) || [];
    },
  });

  // Calculate projections
  const productProjections = useMemo(() => {
    const now = new Date();
    const startMonth = startOfMonth(now);
    const months: Date[] = [];
    
    for (let i = 0; i < monthsAhead; i++) {
      months.push(addMonths(startMonth, i));
    }

    // Group forecasts by product
    const forecastsByProduct = new Map<string, Map<string, number>>();
    forecasts.forEach(f => {
      const key = f.product_id;
      if (!forecastsByProduct.has(key)) {
        forecastsByProduct.set(key, new Map());
      }
      const monthKey = f.year_month;
      forecastsByProduct.get(key)!.set(monthKey, f.quantity);
    });

    // Group history by product (year_month as key)
    const historyByProduct = new Map<string, Map<string, number>>();
    salesHistory.forEach(h => {
      const key = h.product_id;
      if (!historyByProduct.has(key)) {
        historyByProduct.set(key, new Map());
      }
      historyByProduct.get(key)!.set(h.year_month, h.quantity);
    });

    // Get latest inventory per product
    const inventoryByProduct = new Map<string, number>();
    const processedProducts = new Set<string>();
    inventorySnapshots.forEach(inv => {
      const key = selectedUnit === 'all' ? inv.product_id : `${inv.product_id}-${inv.unit_id}`;
      if (!processedProducts.has(key)) {
        const currentQty = inventoryByProduct.get(inv.product_id) || 0;
        inventoryByProduct.set(inv.product_id, currentQty + inv.quantity);
        processedProducts.add(key);
      }
    });

    // Group purchases by product and month
    const purchasesByProductMonth = new Map<string, Map<string, number>>();
    purchaseItems.forEach(item => {
      if (!item.expected_arrival) return;
      const key = item.product_id;
      if (!purchasesByProductMonth.has(key)) {
        purchasesByProductMonth.set(key, new Map());
      }
      const monthKey = format(startOfMonth(parseISO(item.expected_arrival)), 'yyyy-MM-dd');
      const current = purchasesByProductMonth.get(key)!.get(monthKey) || 0;
      purchasesByProductMonth.get(key)!.set(monthKey, current + item.quantity);
    });

    // Calculate projections for each product
    const projections: ProductProjection[] = products
      .filter(p => {
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return p.code.toLowerCase().includes(query) || 
                 p.technical_description.toLowerCase().includes(query);
        }
        return true;
      })
      .map(product => {
        const productForecasts = forecastsByProduct.get(product.id) || new Map();
        const productHistory = historyByProduct.get(product.id) || new Map();
        const productPurchases = purchasesByProductMonth.get(product.id) || new Map();
        const currentStock = inventoryByProduct.get(product.id) || 0;
        let runningBalance = currentStock;
        
        let hasRupture = false;
        let firstRuptureMonth: Date | null = null;

        const monthProjections: MonthProjection[] = months.map((month, index) => {
          const monthKey = format(month, 'yyyy-MM-dd');
          const forecast = productForecasts.get(monthKey) || 0;
          const purchases = productPurchases.get(monthKey) || 0;
          
          // Get history from same month previous year
          const historyMonth = subYears(month, 1);
          const historyKey = format(historyMonth, 'yyyy-MM-dd');
          const historyLastYear = productHistory.get(historyKey) || 0;
          
          const initialStock = index === 0 ? currentStock : runningBalance;
          const finalBalance = initialStock - forecast + purchases;
          
          runningBalance = finalBalance;

          let status: 'ok' | 'warning' | 'rupture' = 'ok';
          if (finalBalance < 0) {
            status = 'rupture';
            if (!hasRupture) {
              hasRupture = true;
              firstRuptureMonth = month;
            }
          } else if (forecast > 0 && finalBalance < forecast * 0.3) {
            status = 'warning';
          }

          return {
            month,
            monthLabel: format(month, 'MMM/yy', { locale: ptBR }),
            initialStock,
            forecast,
            historyLastYear,
            purchases,
            finalBalance,
            status,
          };
        });

        return {
          product,
          currentStock,
          projections: monthProjections,
          hasRupture,
          firstRuptureMonth,
        };
      })
      .filter(p => !showOnlyRuptures || p.hasRupture);

    // Sort: products with rupture first
    return projections.sort((a, b) => {
      if (a.hasRupture && !b.hasRupture) return -1;
      if (!a.hasRupture && b.hasRupture) return 1;
      return a.product.code.localeCompare(b.product.code);
    });
  }, [products, forecasts, salesHistory, inventorySnapshots, purchaseItems, searchQuery, showOnlyRuptures, monthsAhead, selectedUnit]);

  const stats = useMemo(() => {
    const total = productProjections.length;
    const withRupture = productProjections.filter(p => p.hasRupture).length;
    const withWarning = productProjections.filter(p => 
      !p.hasRupture && p.projections.some(m => m.status === 'warning')
    ).length;
    const ok = total - withRupture - withWarning;
    return { total, withRupture, withWarning, ok };
  }, [productProjections]);

  const selectedProductData = selectedProduct 
    ? productProjections.find(p => p.product.id === selectedProduct)
    : null;

  const handleRefreshData = () => {
    refetchForecasts();
    refetchInventory();
    refetchHistory();
  };

  if (productsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planejamento de Demanda</h1>
          <p className="text-muted-foreground">
            Projeção de estoque e identificação de rupturas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefreshData} title="Atualizar dados">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setImportInventoryOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar Estoque
          </Button>
          <Button variant="outline" onClick={() => setImportHistoryOpen(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Importar Histórico
          </Button>
          <Button onClick={() => setImportForecastOpen(true)}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Importar Previsão
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">produtos analisados</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com Ruptura</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.withRupture}</div>
            <p className="text-xs text-muted-foreground">precisam de compra urgente</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atenção</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{stats.withWarning}</div>
            <p className="text-xs text-muted-foreground">estoque baixo previsto</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">OK</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.ok}</div>
            <p className="text-xs text-muted-foreground">situação confortável</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código ou descrição..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={selectedUnit} onValueChange={setSelectedUnit}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Unidades</SelectItem>
                {units.map(unit => (
                  <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={monthsAhead.toString()} onValueChange={(v) => setMonthsAhead(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 meses</SelectItem>
                <SelectItem value="12">12 meses</SelectItem>
                <SelectItem value="18">18 meses</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={showOnlyRuptures ? "default" : "outline"}
              onClick={() => setShowOnlyRuptures(!showOnlyRuptures)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Apenas Rupturas
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Chart for selected product */}
      {selectedProductData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>{selectedProductData.product.code}</span>
              <span className="text-muted-foreground font-normal">-</span>
              <span className="font-normal truncate">{selectedProductData.product.technical_description}</span>
            </CardTitle>
            <CardDescription>
              Projeção de estoque para os próximos {monthsAhead} meses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectionChart projections={selectedProductData.projections} />
          </CardContent>
        </Card>
      )}

      {/* Projection Table - Expanded View */}
      <Card>
        <CardHeader>
          <CardTitle>Projeção de Estoque</CardTitle>
          <CardDescription>
            Clique em um produto para ver o gráfico detalhado. Cada produto mostra: PV (previsão), Histórico do ano anterior, e Projeção de saldo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[280px]">Produto</TableHead>
                  <TableHead className="text-center min-w-[90px] bg-muted/50">Estoque</TableHead>
                  {productProjections[0]?.projections.map((m, i) => (
                    <TableHead key={i} className="text-center min-w-[85px]">
                      {m.monthLabel}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {productProjections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={monthsAhead + 2} className="text-center py-8 text-muted-foreground">
                      Nenhum produto encontrado. Importe previsões e estoque para começar.
                    </TableCell>
                  </TableRow>
                ) : (
                  productProjections.map((productProj) => (
                    <>
                      {/* Main product row with code and description */}
                      <TableRow 
                        key={`${productProj.product.id}-header`}
                        className={`cursor-pointer transition-colors border-t-2 ${
                          selectedProduct === productProj.product.id ? 'bg-muted' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedProduct(
                          selectedProduct === productProj.product.id ? null : productProj.product.id
                        )}
                      >
                        <TableCell className="sticky left-0 bg-background z-10 font-medium" rowSpan={4}>
                          <div className="flex items-center gap-2">
                            {productProj.hasRupture && (
                              <Badge variant="destructive" className="shrink-0">RUPTURA</Badge>
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-base">{productProj.product.code}</div>
                              <div className="text-sm text-muted-foreground truncate max-w-[180px]">
                                {productProj.product.technical_description}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center bg-muted/50 font-bold text-lg" rowSpan={4}>
                          {productProj.currentStock.toLocaleString('pt-BR')}
                        </TableCell>
                        {/* PV row values */}
                        {productProj.projections.map((proj, i) => (
                          <TableCell key={i} className="text-center p-1">
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-sm text-muted-foreground">
                                {proj.forecast > 0 ? proj.forecast.toLocaleString('pt-BR') : '-'}
                              </span>
                              {proj.forecast > 0 && proj.historyLastYear > 0 && (
                                proj.forecast > proj.historyLastYear ? (
                                  <TrendingUp className="h-3 w-3 text-orange-500" />
                                ) : proj.forecast < proj.historyLastYear ? (
                                  <TrendingDown className="h-3 w-3 text-green-500" />
                                ) : null
                              )}
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                      
                      {/* PV Label Row */}
                      <TableRow 
                        key={`${productProj.product.id}-pv-label`}
                        className={selectedProduct === productProj.product.id ? 'bg-muted' : ''}
                      >
                        {productProj.projections.map((proj, i) => (
                          <TableCell key={i} className="text-center p-0 pt-0">
                            <span className="text-[10px] text-muted-foreground font-medium">PV</span>
                          </TableCell>
                        ))}
                      </TableRow>

                      {/* History row */}
                      <TableRow 
                        key={`${productProj.product.id}-history`}
                        className={selectedProduct === productProj.product.id ? 'bg-muted' : ''}
                      >
                        {productProj.projections.map((proj, i) => (
                          <TableCell key={i} className="text-center p-1">
                            <div className="text-xs text-blue-600 dark:text-blue-400">
                              {proj.historyLastYear > 0 ? proj.historyLastYear.toLocaleString('pt-BR') : '-'}
                            </div>
                            <span className="text-[10px] text-muted-foreground">Hist.</span>
                          </TableCell>
                        ))}
                      </TableRow>

                      {/* Projection row (balance) */}
                      <TableRow 
                        key={`${productProj.product.id}-projection`}
                        className={`border-b-2 ${selectedProduct === productProj.product.id ? 'bg-muted' : ''}`}
                      >
                        {productProj.projections.map((proj, i) => (
                          <TableCell key={i} className="text-center p-1">
                            <div 
                              className={`inline-flex flex-col items-center px-2 py-0.5 rounded text-sm font-semibold ${
                                proj.status === 'rupture' 
                                  ? 'bg-destructive/10 text-destructive' 
                                  : proj.status === 'warning'
                                  ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-500'
                                  : 'text-foreground'
                              }`}
                            >
                              {proj.finalBalance.toLocaleString('pt-BR')}
                            </div>
                            {proj.purchases > 0 && (
                              <div className="text-[10px] text-green-600">+{proj.purchases.toLocaleString('pt-BR')}</div>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    </>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Import Modals */}
      <ImportForecastModal 
        open={importForecastOpen} 
        onOpenChange={setImportForecastOpen}
        onSuccess={handleRefreshData}
      />
      <ImportInventoryModal 
        open={importInventoryOpen} 
        onOpenChange={setImportInventoryOpen}
        onSuccess={handleRefreshData}
      />
      <ImportSalesHistoryModal 
        open={importHistoryOpen} 
        onOpenChange={setImportHistoryOpen}
        onSuccess={handleRefreshData}
      />
    </div>
  );
}
