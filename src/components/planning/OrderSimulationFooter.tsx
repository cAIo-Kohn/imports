import React, { useMemo, useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parse, subDays, isBefore, startOfDay, addMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, DollarSign, Scale, Trash2, Ship, ChevronUp, ChevronDown, AlertTriangle, Calendar as CalendarIcon, Plus, Target } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';
import { Progress } from '@/components/ui/progress';
import { SimulatorQuantityInput } from './SimulatorQuantityInput';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { FillContainerPopover } from './FillContainerPopover';

interface ProductWithDetails {
  id: string;
  code: string;
  technical_description: string;
  supplier_id: string | null;
  qty_master_box: number | null;
  master_box_volume: number | null;
  gross_weight: number | null;
  fob_price_usd: number | null;
  lead_time_days: number | null;
}

interface OrderItem {
  productId: string;
  code: string;
  description: string;
  quantity: number;
  masterBoxes: number;
  volume: number;
  price: number;
  weight: number;
  leadTime: number;
  etdDate: Date;
  isEtdCritical: boolean;
}

interface OrderDraft {
  monthKey: string;
  monthLabel: string;
  containerType: keyof typeof CONTAINER_SPECS;
  referenceNumber: string; // User-defined order reference
  items: OrderItem[];
  totalVolume: number;
  totalValue: number;
  totalWeight: number;
  totalQuantity: number;
  // Sequential container counting
  fullContainers: number;
  partialContainerPercent: number;
  totalContainers: number;
  // Legacy fields for backward compatibility
  volumeUtilization: number;
  weightUtilization: number;
  isOverVolume: boolean;
  isOverWeight: boolean;
  earliestETD: Date | null;
  hasCriticalETD: boolean;
  suggestedETD: Date | null; // ETD calculado/arredondado
}

interface SupplierContainerSpecs {
  container_20_cbm: number | null;
  container_40_cbm: number | null;
  container_40hq_cbm: number | null;
}

interface MonthProjectionData {
  monthKey: string;
  finalBalance: number;
}

interface ProductProjectionData {
  product: { id: string; code: string; qty_master_box: number | null };
  projections: MonthProjectionData[];
}

interface OrderSimulationFooterProps {
  pendingArrivals: Record<string, number>;
  products: ProductWithDetails[];
  productProjections?: ProductProjectionData[];
  selectedSupplier: string;
  supplierName: string;
  supplierCountry: string;
  selectedUnit: string;
  onClear: () => void;
  onClearMonth?: (monthKey: string) => void;
  onUpdateArrivals?: (updates: Record<string, number>) => void;
  onSuccess: () => void;
  supplierContainerSpecs?: SupplierContainerSpecs;
}

const CONTAINER_SPECS = {
  '20dry': { name: "20' Dry", volume: 33, maxWeight: 28000 },
  '40dry': { name: "40' Dry", volume: 67, maxWeight: 28000 },
  '40hq': { name: "40' HQ", volume: 76, maxWeight: 28000 },
};

const DEFAULT_LEAD_TIME = 60;

function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day || 1);
}

function calculateRequiredETD(arrivalMonthKey: string, leadTimeDays: number): Date {
  const arrivalDate = parseDateString(arrivalMonthKey);
  return subDays(arrivalDate, leadTimeDays);
}

// Calculate rounded ETD: always round DOWN to day 30 (or 28/29 for February)
// This ensures ETD is always >= 60 days before arrival
function calculateRoundedETD(arrivalMonthKey: string, leadTimeDays: number): Date {
  const arrivalDate = parseDateString(arrivalMonthKey);
  const rawETD = subDays(arrivalDate, leadTimeDays);
  
  const year = rawETD.getFullYear();
  const month = rawETD.getMonth();
  const day = rawETD.getDate();
  
  let roundedMonth = month;
  let roundedYear = year;
  
  // Always round DOWN to day 30 of previous month if we're past day 1
  // If day is 1-30, go to day 30 of previous month
  // This ensures we always give MORE time than the raw 60 days
  if (day <= 30) {
    // Go to previous month
    roundedMonth = month === 0 ? 11 : month - 1;
    roundedYear = month === 0 ? year - 1 : year;
  }
  // If day is 31, stay in same month at day 30
  
  // Determine the day (30 or last day of month for February)
  let roundedDay: number;
  if (roundedMonth === 1) { // February
    const isLeapYear = (roundedYear % 4 === 0 && roundedYear % 100 !== 0) || (roundedYear % 400 === 0);
    roundedDay = isLeapYear ? 29 : 28;
  } else if ([3, 5, 8, 10].includes(roundedMonth)) { // April, June, September, November have 30 days
    roundedDay = 30;
  } else {
    roundedDay = 30; // For months with 31 days, use 30
  }
  
  return new Date(roundedYear, roundedMonth, roundedDay);
}

export function OrderSimulationFooter({
  pendingArrivals,
  products,
  productProjections,
  selectedSupplier,
  supplierName,
  supplierCountry,
  selectedUnit,
  onClear,
  onClearMonth,
  onUpdateArrivals,
  onSuccess,
  supplierContainerSpecs,
}: OrderSimulationFooterProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { state: sidebarState, isMobile } = useSidebar();
  const [containerTypes, setContainerTypes] = useState<Record<string, keyof typeof CONTAINER_SPECS>>({});
  const [referenceNumbers, setReferenceNumbers] = useState<Record<string, string>>({});
  const [customContainerVolumes, setCustomContainerVolumes] = useState<Record<string, number>>({});
  const [customETDs, setCustomETDs] = useState<Record<string, Date>>({});
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('');

  const sidebarWidth = isMobile ? '0px' : (sidebarState === 'expanded' ? 'var(--sidebar-width)' : 'var(--sidebar-width-icon)');

  // Get the effective container volume considering supplier-specific settings
  const getEffectiveContainerVolume = React.useCallback((containerType: keyof typeof CONTAINER_SPECS) => {
    // First check supplier-specific settings
    if (supplierContainerSpecs) {
      if (containerType === '20dry' && supplierContainerSpecs.container_20_cbm) {
        return supplierContainerSpecs.container_20_cbm;
      }
      if (containerType === '40dry' && supplierContainerSpecs.container_40_cbm) {
        return supplierContainerSpecs.container_40_cbm;
      }
      if (containerType === '40hq' && supplierContainerSpecs.container_40hq_cbm) {
        return supplierContainerSpecs.container_40hq_cbm;
      }
    }
    // Fall back to default
    return CONTAINER_SPECS[containerType].volume;
  }, [supplierContainerSpecs]);

  // Group pending arrivals by month
  const ordersByMonth = useMemo(() => {
    const grouped = new Map<string, OrderDraft>();

    Object.entries(pendingArrivals).forEach(([key, quantity]) => {
      if (quantity <= 0) return;

      const [productId, monthKey] = key.split('::');
      const product = products.find(p => p.id === productId);
      if (!product) return;

      if (selectedSupplier !== 'all' && product.supplier_id !== selectedSupplier) return;

      if (!grouped.has(monthKey)) {
        const containerType = containerTypes[monthKey] || '40hq';
        const referenceNumber = referenceNumbers[monthKey] || '';
        grouped.set(monthKey, {
          monthKey,
          monthLabel: format(parseDateString(monthKey), "MMM/yy", { locale: ptBR }),
          containerType,
          referenceNumber,
          items: [],
          totalVolume: 0,
          totalValue: 0,
          totalWeight: 0,
          totalQuantity: 0,
          fullContainers: 0,
          partialContainerPercent: 0,
          totalContainers: 0,
          volumeUtilization: 0,
          weightUtilization: 0,
          isOverVolume: false,
          isOverWeight: false,
          earliestETD: null,
          hasCriticalETD: false,
          suggestedETD: null,
        });
      }

      const draft = grouped.get(monthKey)!;

      const masterBoxes = product.qty_master_box
        ? Math.ceil(quantity / product.qty_master_box)
        : quantity;

      const volumePerBox = product.master_box_volume || 0;
      const itemVolume = masterBoxes * volumePerBox;
      const itemValue = quantity * (product.fob_price_usd || 0);
      const itemWeight = masterBoxes * (product.gross_weight || 0);

      const leadTime = product.lead_time_days || DEFAULT_LEAD_TIME;
      const etdDate = calculateRequiredETD(monthKey, leadTime);
      const isEtdCritical = isBefore(etdDate, startOfDay(new Date()));

      draft.items.push({
        productId,
        code: product.code,
        description: product.technical_description,
        quantity,
        masterBoxes,
        volume: itemVolume,
        price: itemValue,
        weight: itemWeight,
        leadTime,
        etdDate,
        isEtdCritical,
      });

      draft.totalVolume += itemVolume;
      draft.totalValue += itemValue;
      draft.totalWeight += itemWeight;
      draft.totalQuantity += quantity;

      if (isEtdCritical) {
        draft.hasCriticalETD = true;
      }

      if (!draft.earliestETD || isBefore(etdDate, draft.earliestETD)) {
        draft.earliestETD = etdDate;
      }

      // Calculate suggested ETD (rounded) for each item's lead time
      const roundedETD = calculateRoundedETD(monthKey, leadTime);
      if (!draft.suggestedETD || isBefore(roundedETD, draft.suggestedETD)) {
        draft.suggestedETD = roundedETD;
      }
    });

    // Calculate sequential container counting for each draft
    grouped.forEach((draft) => {
      const container = CONTAINER_SPECS[draft.containerType];
      // Priority: custom volume for this month > supplier setting > default
      const effectiveVolume = customContainerVolumes[draft.monthKey] ?? getEffectiveContainerVolume(draft.containerType);
      
      // Sequential container counting
      const totalContainers = draft.totalVolume / effectiveVolume;
      draft.totalContainers = totalContainers;
      draft.fullContainers = Math.floor(totalContainers);
      draft.partialContainerPercent = Math.round((totalContainers - draft.fullContainers) * 100);
      
      // Weight utilization (still single container for now)
      draft.weightUtilization = Math.min((draft.totalWeight / container.maxWeight) * 100, 100);
      draft.isOverWeight = (draft.totalWeight / container.maxWeight) * 100 > 100;
      
      // Legacy: volumeUtilization now represents the partial container only
      draft.volumeUtilization = draft.partialContainerPercent;
      draft.isOverVolume = false; // No longer applies with sequential counting
    });

    return Array.from(grouped.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [pendingArrivals, products, selectedSupplier, containerTypes, referenceNumbers, customContainerVolumes, getEffectiveContainerVolume]);

  // Set initial active tab
  React.useEffect(() => {
    if (ordersByMonth.length > 0 && !activeTab) {
      setActiveTab(ordersByMonth[0].monthKey);
    } else if (ordersByMonth.length > 0 && !ordersByMonth.find(o => o.monthKey === activeTab)) {
      setActiveTab(ordersByMonth[0].monthKey);
    }
  }, [ordersByMonth, activeTab]);

  const handleContainerChange = (monthKey: string, type: keyof typeof CONTAINER_SPECS) => {
    setContainerTypes(prev => ({ ...prev, [monthKey]: type }));
  };

  const handleReferenceNumberChange = (monthKey: string, value: string) => {
    setReferenceNumbers(prev => ({ ...prev, [monthKey]: value }));
  };

  const getContainerVolume = (monthKey: string, containerType: keyof typeof CONTAINER_SPECS) => {
    // Priority: custom volume for this month > supplier setting > default
    return customContainerVolumes[monthKey] ?? getEffectiveContainerVolume(containerType);
  };

  // Fill container function - distributes remaining volume EQUALLY among products
  const handleFillContainer = useCallback((draft: OrderDraft) => {
    if (!onUpdateArrivals) return;
    if (draft.partialContainerPercent === 0) return;
    
    const container = CONTAINER_SPECS[draft.containerType];
    // Priority: custom volume for this month > supplier setting > default
    const effectiveVolume = customContainerVolumes[draft.monthKey] ?? getEffectiveContainerVolume(draft.containerType);
    
    // Calculate how much volume is needed to fill the partial container
    const partialVolume = draft.totalVolume % effectiveVolume;
    const remainingVolume = effectiveVolume - partialVolume;
    
    if (remainingVolume <= 0 || remainingVolume >= effectiveVolume) return;
    
    // Filter only products that can receive additional volume (have master box data)
    const eligibleItems = draft.items.filter(item => {
      const product = products.find(p => p.id === item.productId);
      return product?.qty_master_box && product?.master_box_volume;
    });

    if (eligibleItems.length === 0) {
      toast.error('Nenhum produto possui dados de caixa master para preencher');
      return;
    }

    // Distribute volume EQUALLY among all eligible products
    const volumePerProduct = remainingVolume / eligibleItems.length;
    
    const updates: Record<string, number> = {};
    
    eligibleItems.forEach((item) => {
      const product = products.find(p => p.id === item.productId)!;
      
      // Convert volume to master boxes (round up to ensure we actually fill)
      const additionalBoxes = Math.ceil(volumePerProduct / product.master_box_volume!);
      
      // Convert boxes to units
      const additionalUnits = additionalBoxes * product.qty_master_box!;
      
      // New total for this product
      const key = `${item.productId}::${draft.monthKey}`;
      updates[key] = item.quantity + additionalUnits;
    });
    
    if (Object.keys(updates).length > 0) {
      onUpdateArrivals(updates);
      toast.success(`Container preenchido! +${volumePerProduct.toFixed(2)}m³ por produto`);
    }
  }, [products, onUpdateArrivals, customContainerVolumes, getEffectiveContainerVolume]);

  // Fill container by target month - covers deficits until target month
  const handleFillByTargetMonth = useCallback((draft: OrderDraft, targetMonth: string) => {
    if (!onUpdateArrivals || !productProjections) return;
    
    const effectiveVolume = customContainerVolumes[draft.monthKey] ?? getEffectiveContainerVolume(draft.containerType);
    const partialVolume = draft.totalVolume % effectiveVolume;
    let remainingVolume = effectiveVolume - partialVolume;
    
    if (remainingVolume <= 0 || remainingVolume >= effectiveVolume) return;

    // Build a list of products that need more quantity to cover deficits
    type DeficitItem = { productId: string; neededQty: number; neededVolume: number; deficit: number };
    const deficitItems: DeficitItem[] = [];

    draft.items.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product?.qty_master_box || !product?.master_box_volume) return;

      const pp = productProjections.find(p => p.product.id === item.productId);
      if (!pp) return;

      // Find the minimum finalBalance from the draft's arrival month through targetMonth
      const relevantProjections = pp.projections.filter(
        p => p.monthKey >= draft.monthKey && p.monthKey <= targetMonth
      );

      if (relevantProjections.length === 0) return;

      const minBalance = Math.min(...relevantProjections.map(p => p.finalBalance));
      if (minBalance >= 0) return; // No deficit

      const deficit = Math.abs(minBalance);
      const neededBoxes = Math.ceil(deficit / product.qty_master_box);
      const neededQty = neededBoxes * product.qty_master_box;
      const neededVolume = neededBoxes * product.master_box_volume;

      deficitItems.push({ productId: item.productId, neededQty, neededVolume, deficit });
    });

    // Sort by deficit severity (largest first)
    deficitItems.sort((a, b) => b.deficit - a.deficit);

    const updates: Record<string, number> = {};
    let addedCount = 0;

    for (const item of deficitItems) {
      if (remainingVolume <= 0) break;

      const product = products.find(p => p.id === item.productId)!;
      let volumeToAdd = Math.min(item.neededVolume, remainingVolume);
      
      // Round to whole master boxes
      const boxesToAdd = Math.max(1, Math.floor(volumeToAdd / product.master_box_volume!));
      const actualVolume = boxesToAdd * product.master_box_volume!;
      const actualQty = boxesToAdd * product.qty_master_box!;

      if (actualVolume > 0) {
        const key = `${item.productId}::${draft.monthKey}`;
        const existingItem = draft.items.find(i => i.productId === item.productId);
        const existingQty = existingItem?.quantity || 0;
        updates[key] = existingQty + actualQty;
        remainingVolume -= actualVolume;
        addedCount++;
      }
    }

    if (Object.keys(updates).length > 0) {
      onUpdateArrivals(updates);
      toast.success(`${addedCount} produto(s) adicionado(s) para equilibrar estoque!`);
    } else {
      const monthLabel = format(parse(targetMonth, 'yyyy-MM', new Date()), 'MMM/yy', { locale: ptBR });
      toast.info(`Todos os produtos do pedido já estão equilibrados até ${monthLabel}. Nenhum ajuste necessário.`);
    }
  }, [products, productProjections, onUpdateArrivals, customContainerVolumes, getEffectiveContainerVolume, selectedSupplier]);

  // Month options for target month selector
  const fillMonthOptions = useMemo(() => {
    const today = startOfMonth(new Date());
    const months = [];
    for (let i = 1; i <= 18; i++) {
      const date = addMonths(today, i);
      const key = format(date, 'yyyy-MM-dd');
      const label = format(date, 'MMM/yy', { locale: ptBR });
      months.push({ key, label });
    }
    return months;
  }, []);

  const createOrderMutation = useMutation({
    mutationFn: async (draft: OrderDraft) => {
      if (!user) throw new Error('Usuário não autenticado');
      if (draft.items.length === 0) throw new Error('Nenhum item para criar pedido');
      if (!selectedSupplier || selectedSupplier === 'all') throw new Error('Selecione um fornecedor');
      if (!selectedUnit || selectedUnit === 'all') throw new Error('Selecione uma unidade de destino para criar o pedido');

      // Validação 1: Número do pedido obrigatório
      if (!draft.referenceNumber || draft.referenceNumber.trim() === '') {
        throw new Error('Digite o número do pedido para confirmar');
      }

      // Validação 2: Container deve estar 100% fechado
      if (draft.partialContainerPercent > 0) {
        throw new Error(`Container não está 100% fechado (${draft.partialContainerPercent}% parcial). Ajuste as quantidades ou preencha o container.`);
      }

      const { data: orderNumber, error: rpcError } = await supabase
        .rpc('generate_purchase_order_number');
      
      if (rpcError) throw rpcError;

      const container = CONTAINER_SPECS[draft.containerType];
      
      // Use custom ETD if provided, otherwise use calculated suggestedETD
      const effectiveETD = customETDs[draft.monthKey] || draft.suggestedETD;
      const orderDate = effectiveETD 
        ? format(effectiveETD, 'yyyy-MM-dd')
        : format(new Date(), 'yyyy-MM-dd');

      const containersLabel = draft.fullContainers > 0 
        ? `${draft.fullContainers}x ${container.name}${draft.partialContainerPercent > 0 ? ` + ${draft.partialContainerPercent}%` : ''}`
        : `${draft.partialContainerPercent}% ${container.name}`;

      // Determinar status inicial baseado no país do fornecedor
      const isChineseSupplier = supplierCountry?.toLowerCase() === 'china';
      const initialStatus = isChineseSupplier ? 'pending_trader_review' : 'draft';

      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .insert({
          order_number: orderNumber,
          reference_number: draft.referenceNumber.trim() || null,
          supplier_id: selectedSupplier,
          order_date: orderDate,
          etd: orderDate, // Save ETD to the dedicated field
          status: initialStatus,
          created_by: user.id,
          total_value_usd: draft.totalValue,
          notes: `Container: ${containersLabel} | Volume: ${draft.totalVolume.toFixed(2)}m³ | Chegada: ${draft.monthLabel} | ETD: ${effectiveETD ? format(effectiveETD, 'dd/MM/yyyy') : 'N/A'}`,
        })
        .select('id')
        .single();

      if (orderError) throw orderError;

      const orderItems = draft.items.map(item => ({
        purchase_order_id: order.id,
        product_id: item.productId,
        unit_id: selectedUnit,
        quantity: item.quantity,
        unit_price_usd: products.find(p => p.id === item.productId)?.fob_price_usd || null,
        expected_arrival: draft.monthKey,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      return { orderNumber, orderId: order.id, monthKey: draft.monthKey, referenceNumber: draft.referenceNumber };
    },
    onSuccess: (data) => {
      const displayNumber = data.referenceNumber || data.orderNumber;
      toast.success(`Pedido ${displayNumber} criado para ${format(parseDateString(data.monthKey), "MMM/yy", { locale: ptBR })}!`);
      queryClient.invalidateQueries({ queryKey: ['purchase-order-items'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      // Clear only items from this month
      if (onClearMonth) {
        onClearMonth(data.monthKey);
      }
    },
    onError: (error: any) => {
      toast.error('Erro ao criar pedido: ' + error.message);
    },
  });

  const createAllOrdersMutation = useMutation({
    mutationFn: async () => {
      const results = [];
      for (const draft of ordersByMonth) {
        const result = await createOrderMutation.mutateAsync(draft);
        results.push(result);
      }
      return results;
    },
    onSuccess: (results) => {
      toast.success(`${results.length} pedidos criados com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['purchase-order-items'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      onClear();
      onSuccess();
    },
    onError: (error: any) => {
      toast.error('Erro ao criar pedidos: ' + error.message);
    },
  });

  const handleCreateSingleOrder = (draft: OrderDraft) => {
    createOrderMutation.mutate(draft);
  };

  const handleCreateAllOrders = () => {
    createAllOrdersMutation.mutate();
  };

  const handleClearMonth = (monthKey: string) => {
    if (onClearMonth) {
      onClearMonth(monthKey);
    }
  };

  // Handle quantity update from simulator input
  const handleQuantityUpdate = useCallback((productId: string, monthKey: string, newValue: number) => {
    if (!onUpdateArrivals) return;
    
    const key = `${productId}::${monthKey}`;
    
    if (newValue <= 0) {
      // Remove item: setting to 0 effectively removes from pendingArrivals
      onUpdateArrivals({ [key]: 0 });
    } else {
      onUpdateArrivals({ [key]: newValue });
    }
  }, [onUpdateArrivals]);

  const hasItems = ordersByMonth.length > 0;
  const totalOrders = ordersByMonth.length;
  const totalItems = ordersByMonth.reduce((sum, o) => sum + o.items.length, 0);
  const totalValue = ordersByMonth.reduce((sum, o) => sum + o.totalValue, 0);

  if (!hasItems) return null;

  const currentDraft = ordersByMonth.find(o => o.monthKey === activeTab);

  // Render container visualization
  const renderContainerVisualization = (draft: OrderDraft) => {
    const container = CONTAINER_SPECS[draft.containerType];
    const remainingVolume = draft.partialContainerPercent > 0 
      ? (container.volume - (draft.totalVolume % container.volume)).toFixed(1)
      : '0';
    
    return (
      (() => {
        const totalContainersCount = Math.ceil(draft.totalContainers) || 1;
        const weightPerContainer = draft.totalWeight / totalContainersCount;
        const container = CONTAINER_SPECS[draft.containerType];
        const isOverweightPerContainer = weightPerContainer > container.maxWeight;
        
        return (
          <div className="space-y-1.5">
            {/* Full containers */}
            {Array.from({ length: Math.min(draft.fullContainers, 5) }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Package className="h-4 w-4 text-green-500 flex-shrink-0" />
                <div className="flex-1 h-2.5 bg-green-500 rounded-full" />
                <span className="text-xs text-green-600 font-medium w-10 text-right">100%</span>
                <span className={cn(
                  "text-xs w-14 text-right",
                  isOverweightPerContainer ? "text-destructive font-medium" : "text-muted-foreground"
                )}>
                  {(weightPerContainer / 1000).toFixed(1)}t
                </span>
              </div>
            ))}
            
            {/* Show "..." if more than 5 full containers */}
            {draft.fullContainers > 5 && (
              <div className="text-xs text-muted-foreground text-center">
                ... +{draft.fullContainers - 5} containers cheios ({(weightPerContainer / 1000).toFixed(1)}t cada)
              </div>
            )}
            
            {/* Partial container */}
            {draft.partialContainerPercent > 0 && (
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-yellow-500 transition-all duration-300" 
                    style={{ width: `${draft.partialContainerPercent}%` }}
                  />
                </div>
                <span className="text-xs text-yellow-600 font-medium w-10 text-right">
                  {draft.partialContainerPercent}%
                </span>
                <span className="text-xs text-muted-foreground w-14 text-right">
                  {((weightPerContainer * draft.partialContainerPercent / 100) / 1000).toFixed(1)}t
                </span>
              </div>
            )}
            
            {/* Summary */}
            <div className="text-sm text-muted-foreground pt-1 flex items-center justify-between">
              <span>
                {draft.fullContainers > 0 && (
                  <span className="font-medium text-foreground">
                    {draft.fullContainers} cheio{draft.fullContainers > 1 ? 's' : ''}
                  </span>
                )}
                {draft.fullContainers > 0 && draft.partialContainerPercent > 0 && ' + '}
                {draft.partialContainerPercent > 0 && (
                  <span>{draft.partialContainerPercent}%</span>
                )}
              </span>
              <span className="text-xs">
                {draft.totalVolume.toFixed(1)}m³ | {(draft.totalWeight / 1000).toFixed(1)}t total
              </span>
            </div>
          </div>
        );
      })()
    );
  };

  return (
    <div 
      className="fixed bottom-0 right-0 z-50 bg-background border-t shadow-2xl"
      style={{ left: sidebarWidth }}
    >
      {/* Compact Bar - Always visible */}
      <div 
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Left: Summary */}
        <div className="flex items-center gap-4">
          <Ship className="h-5 w-5 text-primary" />
          
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="font-semibold">
              {totalOrders} {totalOrders === 1 ? 'pedido' : 'pedidos'}
            </Badge>
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {totalItems} {totalItems === 1 ? 'produto' : 'produtos'}
            </span>
          </div>
        </div>

        {/* Center: Total value */}
        <div className="hidden md:flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          
          {ordersByMonth.some(o => o.hasCriticalETD) && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              ETD Crítico
            </Badge>
          )}
        </div>

        {/* Right: Expand button */}
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronUp className="h-5 w-5" />
          )}
        </div>
      </div>

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="border-t bg-background">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Month Tabs */}
            <div className="px-4 pt-2 border-b">
              <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-0">
                {ordersByMonth.map((draft) => (
                  <TabsTrigger
                    key={draft.monthKey}
                    value={draft.monthKey}
                    className={cn(
                      "relative bg-background data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
                      "px-3 py-1.5 text-sm rounded-t-md border-b-2 border-transparent",
                      "data-[state=active]:border-primary data-[state=active]:z-10",
                      draft.hasCriticalETD && "text-destructive data-[state=active]:bg-destructive"
                    )}
                  >
                    {draft.monthLabel}
                    {draft.hasCriticalETD && (
                      <AlertTriangle className="h-3 w-3 ml-1.5 text-destructive" />
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Tab Content */}
            {ordersByMonth.map((draft) => {
              const container = CONTAINER_SPECS[draft.containerType];
              const effectiveVolume = customContainerVolumes[draft.monthKey] ?? container.volume;
              const remainingVolume = draft.partialContainerPercent > 0 
                ? (effectiveVolume - (draft.totalVolume % effectiveVolume)).toFixed(1)
                : '0';
              
              return (
                <TabsContent key={draft.monthKey} value={draft.monthKey} className="mt-0">
                  <div className="p-3 space-y-3">
                    {/* Controls row - compact */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {/* Left: Container selector with CBM input */}
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">Container:</span>
                        <Select 
                          value={draft.containerType} 
                          onValueChange={(v) => {
                            handleContainerChange(draft.monthKey, v as keyof typeof CONTAINER_SPECS);
                            // Reset custom volume when changing container type
                            setCustomContainerVolumes(prev => {
                              const { [draft.monthKey]: _, ...rest } = prev;
                              return rest;
                            });
                          }}
                        >
                          <SelectTrigger className="w-[100px] h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="20dry">20' Dry</SelectItem>
                            <SelectItem value="40dry">40' Dry</SelectItem>
                            <SelectItem value="40hq">40' HQ</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={getContainerVolume(draft.monthKey, draft.containerType)}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value) && value > 0) {
                                setCustomContainerVolumes(prev => ({
                                  ...prev,
                                  [draft.monthKey]: value
                                }));
                              }
                            }}
                            className="w-16 h-8 text-sm text-center"
                            min={1}
                            step={1}
                          />
                          <span className="text-xs text-muted-foreground">m³</span>
                        </div>
                      </div>

                      {/* Center: Container visualization + Fill button */}
                      <div className="flex-1 max-w-md flex items-center gap-2">
                        <div className="flex-1">
                          {renderContainerVisualization(draft)}
                        </div>
                        
                        {/* Fill container popover - two strategies */}
                        {draft.partialContainerPercent > 0 && onUpdateArrivals && (
                          <FillContainerPopover
                            draft={draft}
                            remainingVolume={remainingVolume}
                            monthOptions={fillMonthOptions}
                            onFillCBM={() => handleFillContainer(draft)}
                            onFillByMonth={(targetMonth) => handleFillByTargetMonth(draft, targetMonth)}
                            hasProjections={!!productProjections && productProjections.length > 0}
                          />
                        )}
                      </div>
                    </div>

                    {/* Items table - ONLY scroll area */}
                    <div className="border rounded-md">
                      <ScrollArea className="h-[40vh]">
                        <Table>
                          <TableHeader>
                            <TableRow className="h-9">
                              <TableHead className="py-2 px-3">Produto</TableHead>
                              <TableHead className="text-center py-2 px-3">ETD</TableHead>
                              <TableHead className="text-right py-2 px-3">Qtd</TableHead>
                              <TableHead className="text-right py-2 px-3">Caixas</TableHead>
                              <TableHead className="text-right py-2 px-3">CBM</TableHead>
                              <TableHead className="text-right py-2 px-3">Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {draft.items.map((item, idx) => (
                              <TableRow key={idx} className="h-11">
                                <TableCell className="py-1.5 px-3">
                                  <div className="font-medium text-base leading-tight">{item.code}</div>
                                  <div className="text-xs text-muted-foreground truncate max-w-[200px] leading-tight">
                                    {item.description}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center py-1.5 px-3">
                                  <div className={cn(
                                    "text-sm",
                                    item.isEtdCritical && 'text-destructive font-medium'
                                  )}>
                                    {format(item.etdDate, "dd/MM/yy")}
                                  </div>
                                  {item.isEtdCritical && (
                                    <AlertTriangle className="h-3 w-3 text-destructive mx-auto" />
                                  )}
                                </TableCell>
                                <TableCell className="text-right py-1.5 px-3">
                                  <SimulatorQuantityInput
                                    productId={item.productId}
                                    monthKey={draft.monthKey}
                                    value={item.quantity}
                                    qtyMasterBox={products.find(p => p.id === item.productId)?.qty_master_box || null}
                                    onUpdate={handleQuantityUpdate}
                                  />
                                </TableCell>
                                <TableCell className="text-right text-sm text-muted-foreground py-1.5 px-3">
                                  {item.masterBoxes}
                                </TableCell>
                                <TableCell className="text-right text-sm py-1.5 px-3">
                                  {item.volume.toFixed(2)} m³
                                </TableCell>
                                <TableCell className="text-right text-sm py-1.5 px-3">
                                  ${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>

                    {/* Summary for this month */}
                    <div className="flex items-center justify-between pt-2 border-t text-sm">
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground">
                          Total: <span className="font-medium text-foreground">{draft.items.length} produtos</span>
                        </span>
                        <span className="text-muted-foreground">
                          Valor: <span className="font-medium text-foreground">${draft.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </span>
                      </div>
                      {draft.earliestETD && (
                        <span className={cn(
                          "text-muted-foreground",
                          draft.hasCriticalETD && "text-destructive"
                        )}>
                          ETD mais cedo: <span className="font-medium">{format(draft.earliestETD, "dd/MM/yyyy")}</span>
                        </span>
                      )}
                    </div>

                    {/* Reference Number Input + ETD + Actions */}
                    <div className="flex flex-wrap gap-3 pt-2 border-t items-center">
                      {/* Reference Number Field */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">Nº Pedido:</span>
                        <Input
                          type="text"
                          placeholder="Ex: AMOR-26001"
                          value={referenceNumbers[draft.monthKey] || ''}
                          onChange={(e) => handleReferenceNumberChange(draft.monthKey, e.target.value)}
                          className={cn(
                            "h-9 text-sm w-40",
                            !referenceNumbers[draft.monthKey]?.trim() && "border-destructive"
                          )}
                          onClick={(e) => e.stopPropagation()}
                        />
                        {!referenceNumbers[draft.monthKey]?.trim() && (
                          <span className="text-xs text-destructive">* Obrigatório</span>
                        )}
                      </div>

                      {/* ETD Field - editable */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">ETD:</span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                "h-9 justify-start text-left font-normal",
                                draft.hasCriticalETD && "border-destructive text-destructive"
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {customETDs[draft.monthKey] 
                                ? format(customETDs[draft.monthKey], "dd/MM/yyyy")
                                : draft.suggestedETD 
                                  ? format(draft.suggestedETD, "dd/MM/yyyy")
                                  : 'Definir ETD'
                              }
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 pointer-events-auto z-50" align="start">
                            <Calendar
                              mode="single"
                              selected={customETDs[draft.monthKey] || draft.suggestedETD || undefined}
                              onSelect={(date) => {
                                if (date) {
                                  setCustomETDs(prev => ({ ...prev, [draft.monthKey]: date }));
                                }
                              }}
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Container validation indicator */}
                      {draft.partialContainerPercent > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          Container {draft.partialContainerPercent}% - precisa 100%
                        </Badge>
                      )}
                      
                      {/* Spacer */}
                      <div className="flex-1" />
                      
                      {/* Action Buttons */}
                      <Button 
                        variant="outline" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearMonth(draft.monthKey);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Limpar
                      </Button>
                      <Button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateSingleOrder(draft);
                        }}
                        disabled={
                          !selectedSupplier || 
                          selectedSupplier === 'all' || 
                          createOrderMutation.isPending ||
                          !referenceNumbers[draft.monthKey]?.trim() ||
                          draft.partialContainerPercent > 0
                        }
                        title={
                          !referenceNumbers[draft.monthKey]?.trim() 
                            ? 'Digite o número do pedido' 
                            : draft.partialContainerPercent > 0 
                              ? 'Container deve estar 100% cheio'
                              : ''
                        }
                      >
                        {createOrderMutation.isPending ? 'Criando...' : `Criar Pedido ${draft.monthLabel}`}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              );
            })}

            {/* Global Actions Footer */}
            <div className="px-4 py-3 border-t bg-muted/30 flex items-center justify-between">
              <Button 
                variant="ghost" 
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Limpar Tudo
              </Button>
              
              <div className="flex items-center gap-2">
                {(!selectedSupplier || selectedSupplier === 'all') && (
                  <span className="text-xs text-muted-foreground">
                    Selecione um fornecedor
                  </span>
                )}
                {/* Show validation warnings for bulk create */}
                {ordersByMonth.some(o => !referenceNumbers[o.monthKey]?.trim()) && (
                  <span className="text-xs text-destructive">
                    Todos os pedidos precisam de nº
                  </span>
                )}
                {ordersByMonth.some(o => o.partialContainerPercent > 0) && (
                  <span className="text-xs text-destructive">
                    Containers incompletos
                  </span>
                )}
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateAllOrders();
                  }}
                  disabled={
                    !selectedSupplier || 
                    selectedSupplier === 'all' || 
                    createAllOrdersMutation.isPending ||
                    ordersByMonth.some(o => !referenceNumbers[o.monthKey]?.trim()) ||
                    ordersByMonth.some(o => o.partialContainerPercent > 0)
                  }
                  variant="default"
                  title={
                    ordersByMonth.some(o => !referenceNumbers[o.monthKey]?.trim())
                      ? 'Todos os pedidos precisam de número'
                      : ordersByMonth.some(o => o.partialContainerPercent > 0)
                        ? 'Todos os containers precisam estar 100%'
                        : ''
                  }
                >
                  {createAllOrdersMutation.isPending 
                    ? 'Criando...' 
                    : `Criar Todos (${totalOrders} ${totalOrders === 1 ? 'pedido' : 'pedidos'})`
                  }
                </Button>
              </div>
            </div>
          </Tabs>
        </div>
      )}
    </div>
  );
}
