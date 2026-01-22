import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, addMonths, startOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, AlertTriangle, Package, Search, Filter, Upload, FileSpreadsheet } from 'lucide-react';
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
  purchases: number;
  finalBalance: number;
  status: 'ok' | 'warning' | 'rupture';
}

interface ProductProjection {
  product: Product;
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

    // Group data by product
    const forecastsByProduct = new Map<string, Map<string, number>>();
    forecasts.forEach(f => {
      const key = f.product_id;
      if (!forecastsByProduct.has(key)) {
        forecastsByProduct.set(key, new Map());
      }
      const monthKey = f.year_month;
      forecastsByProduct.get(key)!.set(monthKey, f.quantity);
    });

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
        const productPurchases = purchasesByProductMonth.get(product.id) || new Map();
        let runningBalance = inventoryByProduct.get(product.id) || 0;
        
        let hasRupture = false;
        let firstRuptureMonth: Date | null = null;

        const monthProjections: MonthProjection[] = months.map((month, index) => {
          const monthKey = format(month, 'yyyy-MM-dd');
          const forecast = productForecasts.get(monthKey) || 0;
          const purchases = productPurchases.get(monthKey) || 0;
          
          const initialStock = index === 0 ? (inventoryByProduct.get(product.id) || 0) : runningBalance;
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
            purchases,
            finalBalance,
            status,
          };
        });

        return {
          product,
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
  }, [products, forecasts, inventorySnapshots, purchaseItems, searchQuery, showOnlyRuptures, monthsAhead, selectedUnit]);

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

      {/* Projection Table */}
      <Card>
        <CardHeader>
          <CardTitle>Projeção de Estoque</CardTitle>
          <CardDescription>
            Clique em um produto para ver o gráfico detalhado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[300px]">Produto</TableHead>
                  {productProjections[0]?.projections.map((m, i) => (
                    <TableHead key={i} className="text-center min-w-[100px]">
                      {m.monthLabel}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {productProjections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={monthsAhead + 1} className="text-center py-8 text-muted-foreground">
                      Nenhum produto encontrado. Importe previsões e estoque para começar.
                    </TableCell>
                  </TableRow>
                ) : (
                  productProjections.map((productProj) => (
                    <TableRow 
                      key={productProj.product.id}
                      className={`cursor-pointer transition-colors ${
                        selectedProduct === productProj.product.id ? 'bg-muted' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedProduct(
                        selectedProduct === productProj.product.id ? null : productProj.product.id
                      )}
                    >
                      <TableCell className="sticky left-0 bg-background z-10">
                        <div className="flex items-center gap-2">
                          {productProj.hasRupture && (
                            <Badge variant="destructive" className="shrink-0">RUPTURA</Badge>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium">{productProj.product.code}</div>
                            <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {productProj.product.technical_description}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      {productProj.projections.map((proj, i) => (
                        <TableCell key={i} className="text-center">
                          <div 
                            className={`inline-flex flex-col items-center px-2 py-1 rounded ${
                              proj.status === 'rupture' 
                                ? 'bg-destructive/10 text-destructive' 
                                : proj.status === 'warning'
                                ? 'bg-yellow-500/10 text-yellow-600'
                                : ''
                            }`}
                          >
                            <span className="font-medium">
                              {proj.finalBalance.toLocaleString('pt-BR')}
                            </span>
                            {(proj.forecast > 0 || proj.purchases > 0) && (
                              <span className="text-xs text-muted-foreground">
                                {proj.forecast > 0 && `-${proj.forecast}`}
                                {proj.purchases > 0 && ` +${proj.purchases}`}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
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
