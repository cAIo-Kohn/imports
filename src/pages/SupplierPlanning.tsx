import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, addMonths, startOfMonth, parseISO, subYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, AlertTriangle, Package, Search, Filter, RefreshCw, ArrowLeft } from 'lucide-react';
import { ProjectionChart } from '@/components/planning/ProjectionChart';
import { OrderSimulationFooter } from '@/components/planning/OrderSimulationFooter';
import { ProductProjectionCard } from '@/components/planning/ProductProjectionCard';
import { SmartOrderBuilder } from '@/components/planning/SmartOrderBuilder';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

interface Product {
  id: string;
  code: string;
  technical_description: string;
  lead_time_days: number | null;
  moq: number | null;
  supplier_id: string | null;
  qty_master_box: number | null;
  master_box_volume: number | null;
  gross_weight: number | null;
  fob_price_usd: number | null;
}

interface Unit {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  company_name: string;
  country: string;
  container_20_cbm: number | null;
  container_40_cbm: number | null;
  container_40hq_cbm: number | null;
}

interface MonthProjection {
  month: Date;
  monthKey: string;
  monthLabel: string;
  initialStock: number;
  forecast: number;
  historyLastYear: number;
  purchases: number; // From scheduled_arrivals (uploads) - BLACK
  appOrderArrivals: number; // From purchase_order_items (app) - BLUE
  appOrderNumbers: string[]; // Order reference numbers for tooltip
  pendingArrival: number;
  finalBalance: number;
  status: 'ok' | 'warning' | 'rupture';
  processNumber: string | null;
}

interface ProductProjection {
  product: Product;
  currentStock: number;
  projections: MonthProjection[];
  hasRupture: boolean;
  firstRuptureMonth: Date | null;
  totalForecast: number;
  totalHistory: number;
  totalPurchases: number; // From uploads (scheduled_arrivals)
  totalAppOrderArrivals: number; // From app orders (purchase_order_items)
  totalPendingArrivals: number;
}

export default function SupplierPlanning() {
  const { id: supplierId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyRuptures, setShowOnlyRuptures] = useState(false);
  const [monthsAhead, setMonthsAhead] = useState(12);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  
  

  const [pendingArrivals, setPendingArrivals] = useState<Record<string, number>>({});
  const [pendingArrivalsInput, setPendingArrivalsInput] = useState<Record<string, string>>({});
  
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Fetch supplier
  const { data: supplier, isLoading: supplierLoading } = useQuery({
    queryKey: ['supplier', supplierId],
    queryFn: async () => {
      if (!supplierId) return null;
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, company_name, country, container_20_cbm, container_40_cbm, container_40hq_cbm')
        .eq('id', supplierId)
        .single();
      if (error) throw error;
      return data as Supplier;
    },
    enabled: !!supplierId,
  });

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

  // Fetch products for this supplier only
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products-for-supplier', supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, code, technical_description, lead_time_days, moq, supplier_id, qty_master_box, master_box_volume, gross_weight, fob_price_usd')
        .eq('is_active', true)
        .eq('supplier_id', supplierId)
        .order('code');
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!supplierId,
  });

  // Fetch forecasts - filtered by supplier's products to avoid 1000 record limit
  const productIds = useMemo(() => products.map(p => p.id), [products]);

  // Fetch product_units to determine which units are linked to products
  const { data: productUnitsData = [] } = useQuery({
    queryKey: ['product-units-for-supplier', productIds],
    queryFn: async () => {
      if (productIds.length === 0) return [];
      const { data, error } = await supabase
        .from('product_units')
        .select('product_id, unit_id')
        .in('product_id', productIds);
      if (error) throw error;
      return data;
    },
    enabled: productIds.length > 0,
  });

  // Determine available units for this supplier's products
  const { availableUnits, autoSelectedUnit } = useMemo(() => {
    if (!productUnitsData.length || units.length === 0) return { availableUnits: [], autoSelectedUnit: null };
    
    // Get unique unit IDs from product_units
    const unitIds = new Set<string>();
    productUnitsData.forEach(pu => {
      if (pu.unit_id) unitIds.add(pu.unit_id);
    });
    
    // Map to unit objects
    const unitsForProducts = units.filter(u => unitIds.has(u.id));
    
    // If all products share the same single unit, auto-select it
    if (unitsForProducts.length === 1) {
      return { availableUnits: unitsForProducts, autoSelectedUnit: unitsForProducts[0].id };
    }
    
    return { availableUnits: unitsForProducts, autoSelectedUnit: null };
  }, [productUnitsData, units]);

  // Auto-set unit when supplier has products all in one unit
  useEffect(() => {
    if (autoSelectedUnit && selectedUnit === 'all') {
      setSelectedUnit(autoSelectedUnit);
    }
  }, [autoSelectedUnit, selectedUnit]);
  
  const { data: forecasts = [], refetch: refetchForecasts } = useQuery({
    queryKey: ['sales-forecasts', selectedUnit, supplierId, productIds],
    queryFn: async () => {
      if (productIds.length === 0) return [];
      
      let query = supabase
        .from('sales_forecasts')
        .select('product_id, unit_id, year_month, quantity, version')
        .in('product_id', productIds)
        .order('year_month');
      
      if (selectedUnit !== 'all') {
        query = query.eq('unit_id', selectedUnit);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: productIds.length > 0,
  });

  // Fetch sales history - filtered by supplier's products
  const { data: salesHistory = [], refetch: refetchHistory } = useQuery({
    queryKey: ['sales-history', selectedUnit, supplierId, productIds],
    queryFn: async () => {
      if (productIds.length === 0) return [];
      
      let query = supabase
        .from('sales_history')
        .select('product_id, unit_id, year_month, quantity')
        .in('product_id', productIds)
        .order('year_month');
      
      if (selectedUnit !== 'all') {
        query = query.eq('unit_id', selectedUnit);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: productIds.length > 0,
  });

  // Fetch latest inventory snapshots - filtered by supplier's products
  const { data: inventorySnapshots = [], refetch: refetchInventory } = useQuery({
    queryKey: ['inventory-snapshots', selectedUnit, supplierId, productIds],
    queryFn: async () => {
      if (productIds.length === 0) return [];
      
      let query = supabase
        .from('inventory_snapshots')
        .select('product_id, unit_id, snapshot_date, quantity')
        .in('product_id', productIds)
        .order('snapshot_date', { ascending: false });
      
      if (selectedUnit !== 'all') {
        query = query.eq('unit_id', selectedUnit);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: productIds.length > 0,
  });

  // Fetch scheduled arrivals (from uploads - BLACK)
  const { data: scheduledArrivals = [], refetch: refetchScheduledArrivals } = useQuery({
    queryKey: ['scheduled-arrivals', selectedUnit, supplierId, productIds],
    queryFn: async () => {
      if (productIds.length === 0) return [];
      
      let query = supabase
        .from('scheduled_arrivals')
        .select('product_id, unit_id, quantity, arrival_date, process_number')
        .in('product_id', productIds);
      
      if (selectedUnit !== 'all') {
        query = query.eq('unit_id', selectedUnit);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: productIds.length > 0,
  });

  // Fetch purchase order items (from app - BLUE)
  const { data: appOrderItems = [], refetch: refetchAppOrderItems } = useQuery({
    queryKey: ['app-order-items', supplierId, selectedUnit, productIds],
    queryFn: async () => {
      if (!supplierId || productIds.length === 0) return [];
      
      // Fetch all reference_numbers from this supplier's orders for deduplication
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .select('id, reference_number, status')
        .eq('supplier_id', supplierId)
        .not('status', 'in', '("cancelled","received")');
      
      if (poError) throw poError;
      if (!poData || poData.length === 0) return [];
      
      const orderIds = poData.map(po => po.id);
      const orderMap = new Map(poData.map(po => [po.id, { reference_number: po.reference_number, status: po.status }]));
      
      let itemsQuery = supabase
        .from('purchase_order_items')
        .select('product_id, unit_id, quantity, expected_arrival, purchase_order_id')
        .in('purchase_order_id', orderIds)
        .in('product_id', productIds)
        .not('expected_arrival', 'is', null);
      
      if (selectedUnit !== 'all') {
        itemsQuery = itemsQuery.eq('unit_id', selectedUnit);
      }
      
      const { data: itemsData, error: itemsError } = await itemsQuery;
      if (itemsError) throw itemsError;
      
      return (itemsData || []).map(item => ({
        ...item,
        reference_number: orderMap.get(item.purchase_order_id)?.reference_number || null,
        status: orderMap.get(item.purchase_order_id)?.status || 'draft',
      }));
    },
    enabled: !!supplierId && productIds.length > 0,
  });

  // Get set of reference_numbers from app orders for deduplication
  const appOrderReferenceNumbers = useMemo(() => {
    const refs = new Set<string>();
    appOrderItems.forEach(item => {
      if (item.reference_number) {
        refs.add(item.reference_number);
      }
    });
    return refs;
  }, [appOrderItems]);

  const handleArrivalChange = useCallback((productId: string, monthKey: string, value: string) => {
    const key = `${productId}::${monthKey}`;
    const numValue = parseInt(value) || 0;
    
    // Atualiza sem arredondar - permite digitação livre
    setPendingArrivalsInput(prev => {
      if (value === '' || value === '0') {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
    
    setPendingArrivals(prev => {
      if (numValue <= 0) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: numValue };
    });
  }, []);

  // Arredondamento para caixa master apenas ao sair do campo
  const handleArrivalBlur = useCallback((productId: string, monthKey: string) => {
    const key = `${productId}::${monthKey}`;
    const currentValue = pendingArrivals[key] || 0;
    
    if (currentValue <= 0) return;
    
    // Encontrar o produto para obter qty_master_box
    const product = products?.find(p => p.id === productId);
    const qtyMasterBox = product?.qty_master_box;
    
    // Se o produto tem qty_master_box definido, arredondar para cima em caixas completas
    if (qtyMasterBox && qtyMasterBox > 0) {
      const masterBoxes = Math.ceil(currentValue / qtyMasterBox);
      const roundedValue = masterBoxes * qtyMasterBox;
      
      // Atualizar apenas se o valor mudou
      if (roundedValue !== currentValue) {
        setPendingArrivalsInput(prev => ({ ...prev, [key]: roundedValue.toString() }));
        setPendingArrivals(prev => ({ ...prev, [key]: roundedValue }));
      }
    }
  }, [products, pendingArrivals]);

  const clearPendingArrivals = useCallback(() => {
    setPendingArrivals({});
    setPendingArrivalsInput({});
  }, []);

  const clearPendingArrivalsForMonth = useCallback((monthKey: string) => {
    setPendingArrivals(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        if (key.endsWith(`::${monthKey}`)) {
          delete updated[key];
        }
      });
      return updated;
    });
    setPendingArrivalsInput(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        if (key.endsWith(`::${monthKey}`)) {
          delete updated[key];
        }
      });
      return updated;
    });
  }, []);

  // Update multiple arrivals at once (for fill container function and simulator edits)
  const updateMultipleArrivals = useCallback((updates: Record<string, number>) => {
    setPendingArrivals(prev => {
      const updated = { ...prev };
      Object.entries(updates).forEach(([key, value]) => {
        if (value <= 0) {
          delete updated[key]; // Remove if value is 0 or negative
        } else {
          updated[key] = value;
        }
      });
      return updated;
    });
    
    setPendingArrivalsInput(prev => {
      const updated = { ...prev };
      Object.entries(updates).forEach(([key, value]) => {
        if (value <= 0) {
          delete updated[key];
        } else {
          updated[key] = value.toString();
        }
      });
      return updated;
    });
  }, []);

  const productProjections = useMemo(() => {
    const now = new Date();
    const startMonth = startOfMonth(now);
    const months: Date[] = [];
    
    for (let i = 0; i < monthsAhead; i++) {
      months.push(addMonths(startMonth, i));
    }

    const forecastsByProduct = new Map<string, Map<string, number>>();
    forecasts.forEach(f => {
      const key = f.product_id;
      if (!forecastsByProduct.has(key)) {
        forecastsByProduct.set(key, new Map());
      }
      const monthKey = f.year_month;
      forecastsByProduct.get(key)!.set(monthKey, f.quantity);
    });

    const historyByProduct = new Map<string, Map<string, number>>();
    salesHistory.forEach(h => {
      const key = h.product_id;
      if (!historyByProduct.has(key)) {
        historyByProduct.set(key, new Map());
      }
      historyByProduct.get(key)!.set(h.year_month, h.quantity);
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

    // scheduled_arrivals from uploads (BLACK) - exclude those matching app order reference_numbers
    const purchasesByProductMonth = new Map<string, Map<string, { quantity: number; processNumbers: string[] }>>();
    scheduledArrivals.forEach(item => {
      if (!item.arrival_date) return;
      // Skip if this process_number matches an app order reference_number (will show as blue instead)
      if (item.process_number && appOrderReferenceNumbers.has(item.process_number)) return;
      
      const key = item.product_id;
      if (!purchasesByProductMonth.has(key)) {
        purchasesByProductMonth.set(key, new Map());
      }
      const monthKey = format(startOfMonth(parseISO(item.arrival_date)), 'yyyy-MM-dd');
      const current = purchasesByProductMonth.get(key)!.get(monthKey) || { quantity: 0, processNumbers: [] };
      current.quantity += item.quantity;
      if (item.process_number && !current.processNumbers.includes(item.process_number)) {
        current.processNumbers.push(item.process_number);
      }
      purchasesByProductMonth.get(key)!.set(monthKey, current);
    });

    // app order arrivals (BLUE)
    const appOrdersByProductMonth = new Map<string, Map<string, { quantity: number; orderNumbers: string[] }>>();
    appOrderItems.forEach(item => {
      if (!item.expected_arrival) return;
      const key = item.product_id;
      if (!appOrdersByProductMonth.has(key)) {
        appOrdersByProductMonth.set(key, new Map());
      }
      const monthKey = format(startOfMonth(parseISO(item.expected_arrival)), 'yyyy-MM-dd');
      const current = appOrdersByProductMonth.get(key)!.get(monthKey) || { quantity: 0, orderNumbers: [] };
      current.quantity += item.quantity;
      const refNum = item.reference_number || `PO-${item.purchase_order_id.substring(0, 8)}`;
      if (!current.orderNumbers.includes(refNum)) {
        current.orderNumbers.push(refNum);
      }
      appOrdersByProductMonth.get(key)!.set(monthKey, current);
    });

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
          
          // Uploads (BLACK)
          const purchaseData = productPurchases.get(monthKey) || { quantity: 0, processNumbers: [] };
          const existingPurchases = purchaseData.quantity;
          const processNumber = purchaseData.processNumbers.length > 0 ? purchaseData.processNumbers.join(', ') : null;
          
          // App orders (BLUE)
          const appOrderData = appOrdersByProductMonth.get(product.id)?.get(monthKey) || { quantity: 0, orderNumbers: [] };
          const appOrderArrivals = appOrderData.quantity;
          const appOrderNumbers = appOrderData.orderNumbers;
          
          const pendingArrivalKey = `${product.id}::${monthKey}`;
          const pendingArrival = pendingArrivals[pendingArrivalKey] || 0;
          
          // Total arrivals = uploads + app orders + pending input
          const totalArrivals = existingPurchases + appOrderArrivals + pendingArrival;
          
          const historyMonth = subYears(month, 1);
          const historyKey = format(historyMonth, 'yyyy-MM-dd');
          const historyLastYear = productHistory.get(historyKey) || 0;
          
          const initialStock = index === 0 ? currentStock : runningBalance;
          const finalBalance = initialStock - forecast + totalArrivals;
          
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
            monthKey,
            monthLabel: format(month, 'MMM/yy', { locale: ptBR }),
            initialStock,
            forecast,
            historyLastYear,
            purchases: existingPurchases,
            appOrderArrivals,
            appOrderNumbers,
            pendingArrival,
            finalBalance,
            status,
            processNumber,
          };
        });

        const totalForecast = monthProjections.reduce((sum, m) => sum + m.forecast, 0);
        const totalHistory = monthProjections.reduce((sum, m) => sum + m.historyLastYear, 0);
        const totalPurchases = monthProjections.reduce((sum, m) => sum + m.purchases, 0);
        const totalAppOrderArrivals = monthProjections.reduce((sum, m) => sum + m.appOrderArrivals, 0);
        const totalPendingArrivals = monthProjections.reduce((sum, m) => sum + m.pendingArrival, 0);

        return {
          product,
          currentStock,
          projections: monthProjections,
          hasRupture,
          firstRuptureMonth,
          totalForecast,
          totalHistory,
          totalPurchases,
          totalAppOrderArrivals,
          totalPendingArrivals,
        };
      })
      .filter(p => !showOnlyRuptures || p.hasRupture);

    return projections.sort((a, b) => a.product.code.localeCompare(b.product.code));
  }, [products, forecasts, salesHistory, inventorySnapshots, scheduledArrivals, appOrderItems, appOrderReferenceNumbers, searchQuery, showOnlyRuptures, monthsAhead, selectedUnit, pendingArrivals]);

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

  const hasPendingArrivals = Object.keys(pendingArrivals).length > 0;

  const handleRefreshData = () => {
    refetchForecasts();
    refetchInventory();
    refetchHistory();
    refetchScheduledArrivals();
    refetchAppOrderItems();
  };

  if (supplierLoading || productsLoading) {
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

  if (!supplier) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-muted-foreground">Fornecedor não encontrado</p>
        <Button onClick={() => navigate('/demand-planning')}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      {/* Compact Header with Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Back + Title */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/demand-planning')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{supplier.company_name}</h1>
            <p className="text-sm text-muted-foreground">{products.length} produtos</p>
          </div>
        </div>
        
        {/* Center: Inline Stats */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm py-1 px-3">
            <Package className="h-3.5 w-3.5 mr-1.5" />
            {stats.total}
          </Badge>
          <Badge variant="destructive" className="text-sm py-1 px-3">
            <TrendingDown className="h-3.5 w-3.5 mr-1.5" />
            {stats.withRupture}
          </Badge>
          <Badge className="bg-yellow-500 text-white text-sm py-1 px-3">
            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
            {stats.withWarning}
          </Badge>
          <Badge className="bg-green-500 text-white text-sm py-1 px-3">
            <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
            {stats.ok}
          </Badge>
        </div>
        
        {/* Right: Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefreshData} title="Atualizar dados">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <SmartOrderBuilder
            productProjections={productProjections}
            products={products}
            onGenerateOrder={(arrivals) => {
              setPendingArrivals(arrivals);
              setPendingArrivalsInput(
                Object.fromEntries(
                  Object.entries(arrivals).map(([k, v]) => [k, v.toString()])
                )
              );
              toast.success('Pedido simulado gerado! Ajuste as quantidades e crie o pedido.');
            }}
          />
        </div>
      </div>

      {/* Compact Filters Row */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou descrição..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={selectedUnit} onValueChange={setSelectedUnit}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            {availableUnits.length > 1 && (
              <SelectItem value="all">Todas as Unidades</SelectItem>
            )}
            {availableUnits.length > 0 ? (
              availableUnits.map(unit => (
                <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
              ))
            ) : (
              units.map(unit => (
                <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Select value={monthsAhead.toString()} onValueChange={(v) => setMonthsAhead(Number(v))}>
          <SelectTrigger className="w-[120px] h-9">
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
          size="sm"
        >
          <Filter className="mr-2 h-4 w-4" />
          Apenas Rupturas
        </Button>
      </div>

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

      {/* Projection Cards */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Projeção de Estoque</CardTitle>
          <CardDescription className="text-xs">
            Clique em um produto para ver o gráfico. Digite valores na linha "Chegada" para simular compras.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div 
            ref={tableContainerRef}
            className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-2"
          >
            {productProjections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum produto encontrado. Importe previsões e estoque para começar.
              </div>
            ) : (
              productProjections.map((productProj) => (
                <ProductProjectionCard
                  key={productProj.product.id}
                  productProj={productProj}
                  isSelected={selectedProduct === productProj.product.id}
                  pendingArrivalsInput={pendingArrivalsInput}
                  onSelectProduct={setSelectedProduct}
                  onArrivalChange={handleArrivalChange}
                  onArrivalBlur={handleArrivalBlur}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Order Simulation Footer - Fixed at bottom */}
      <OrderSimulationFooter
        pendingArrivals={pendingArrivals}
        products={products}
        productProjections={productProjections}
        selectedSupplier={supplierId || ''}
        supplierName={supplier.company_name}
        supplierCountry={supplier.country}
        selectedUnit={selectedUnit}
        onClear={clearPendingArrivals}
        onClearMonth={clearPendingArrivalsForMonth}
        onUpdateArrivals={updateMultipleArrivals}
        onSuccess={handleRefreshData}
        supplierContainerSpecs={{
          container_20_cbm: supplier.container_20_cbm,
          container_40_cbm: supplier.container_40_cbm,
          container_40hq_cbm: supplier.container_40hq_cbm,
        }}
      />
    </div>
  );
}
