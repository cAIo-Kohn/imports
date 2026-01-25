import React, { useMemo, useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, subDays, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, DollarSign, Scale, Trash2, Ship, ChevronUp, ChevronDown, AlertTriangle, Calendar, Plus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';
import { Progress } from '@/components/ui/progress';

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
}

interface OrderSimulationFooterProps {
  pendingArrivals: Record<string, number>;
  products: ProductWithDetails[];
  productProjections?: unknown; // Kept for backwards compatibility, no longer used
  selectedSupplier: string;
  supplierName: string;
  selectedUnit: string;
  onClear: () => void;
  onClearMonth?: (monthKey: string) => void;
  onUpdateArrivals?: (updates: Record<string, number>) => void;
  onSuccess: () => void;
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

export function OrderSimulationFooter({
  pendingArrivals,
  products,
  selectedSupplier,
  supplierName,
  selectedUnit,
  onClear,
  onClearMonth,
  onUpdateArrivals,
  onSuccess,
}: OrderSimulationFooterProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { state: sidebarState, isMobile } = useSidebar();
  const [containerTypes, setContainerTypes] = useState<Record<string, keyof typeof CONTAINER_SPECS>>({});
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('');

  const sidebarWidth = isMobile ? '0px' : (sidebarState === 'expanded' ? 'var(--sidebar-width)' : 'var(--sidebar-width-icon)');

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
        grouped.set(monthKey, {
          monthKey,
          monthLabel: format(parseDateString(monthKey), "MMM/yy", { locale: ptBR }),
          containerType,
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
    });

    // Calculate sequential container counting for each draft
    grouped.forEach((draft) => {
      const container = CONTAINER_SPECS[draft.containerType];
      
      // Sequential container counting
      const totalContainers = draft.totalVolume / container.volume;
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
  }, [pendingArrivals, products, selectedSupplier, containerTypes]);

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

  // Fill container function - distributes remaining volume EQUALLY among products
  const handleFillContainer = useCallback((draft: OrderDraft) => {
    if (!onUpdateArrivals) return;
    if (draft.partialContainerPercent === 0) return;
    
    const container = CONTAINER_SPECS[draft.containerType];
    
    // Calculate how much volume is needed to fill the partial container
    const partialVolume = draft.totalVolume % container.volume;
    const remainingVolume = container.volume - partialVolume;
    
    if (remainingVolume <= 0 || remainingVolume >= container.volume) return;
    
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
  }, [products, onUpdateArrivals]);

  const createOrderMutation = useMutation({
    mutationFn: async (draft: OrderDraft) => {
      if (!user) throw new Error('Usuário não autenticado');
      if (draft.items.length === 0) throw new Error('Nenhum item para criar pedido');
      if (!selectedSupplier || selectedSupplier === 'all') throw new Error('Selecione um fornecedor');

      const { data: orderNumber, error: rpcError } = await supabase
        .rpc('generate_purchase_order_number');
      
      if (rpcError) throw rpcError;

      const container = CONTAINER_SPECS[draft.containerType];
      const orderDate = draft.earliestETD 
        ? format(draft.earliestETD, 'yyyy-MM-dd')
        : format(new Date(), 'yyyy-MM-dd');

      const containersLabel = draft.fullContainers > 0 
        ? `${draft.fullContainers}x ${container.name}${draft.partialContainerPercent > 0 ? ` + ${draft.partialContainerPercent}%` : ''}`
        : `${draft.partialContainerPercent}% ${container.name}`;

      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .insert({
          order_number: orderNumber,
          supplier_id: selectedSupplier,
          order_date: orderDate,
          status: 'draft',
          created_by: user.id,
          total_value_usd: draft.totalValue,
          notes: `Container: ${containersLabel} | Volume: ${draft.totalVolume.toFixed(2)}m³ | Chegada: ${draft.monthLabel} | ETD: ${draft.earliestETD ? format(draft.earliestETD, 'dd/MM/yyyy') : 'N/A'}`,
        })
        .select('id')
        .single();

      if (orderError) throw orderError;

      const orderItems = draft.items.map(item => ({
        purchase_order_id: order.id,
        product_id: item.productId,
        unit_id: selectedUnit !== 'all' ? selectedUnit : null,
        quantity: item.quantity,
        unit_price_usd: products.find(p => p.id === item.productId)?.fob_price_usd || null,
        expected_arrival: draft.monthKey,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      return { orderNumber, orderId: order.id, monthKey: draft.monthKey };
    },
    onSuccess: (data) => {
      toast.success(`Pedido ${data.orderNumber} criado para ${format(parseDateString(data.monthKey), "MMM/yy", { locale: ptBR })}!`);
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
      <div className="space-y-2">
        {/* Full containers */}
        {Array.from({ length: Math.min(draft.fullContainers, 5) }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Package className="h-4 w-4 text-green-500 flex-shrink-0" />
            <div className="flex-1 h-2.5 bg-green-500 rounded-full" />
            <span className="text-xs text-green-600 font-medium w-12 text-right">100%</span>
          </div>
        ))}
        
        {/* Show "..." if more than 5 full containers */}
        {draft.fullContainers > 5 && (
          <div className="text-xs text-muted-foreground text-center">
            ... +{draft.fullContainers - 5} containers cheios
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
            <span className="text-xs text-yellow-600 font-medium w-12 text-right">
              {draft.partialContainerPercent}%
            </span>
          </div>
        )}
        
        {/* Summary */}
        <div className="text-sm text-muted-foreground pt-1 flex items-center justify-between">
          <span>
            {draft.fullContainers > 0 && (
              <span className="font-medium text-foreground">
                {draft.fullContainers} container{draft.fullContainers > 1 ? 's' : ''} cheio{draft.fullContainers > 1 ? 's' : ''}
              </span>
            )}
            {draft.fullContainers > 0 && draft.partialContainerPercent > 0 && ' + '}
            {draft.partialContainerPercent > 0 && (
              <span>{draft.partialContainerPercent}% do próximo</span>
            )}
          </span>
          <span className="text-xs">
            {draft.totalVolume.toFixed(1)}m³ total
          </span>
        </div>
      </div>
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
                      "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
                      "px-3 py-1.5 text-sm rounded-t-md border-b-2 border-transparent",
                      "data-[state=active]:border-primary",
                      draft.hasCriticalETD && "text-destructive data-[state=active]:bg-destructive"
                    )}
                  >
                    <Calendar className="h-3 w-3 mr-1.5" />
                    {draft.monthLabel}
                    <Badge variant="outline" className="ml-1.5 px-1.5 py-0 text-xs">
                      {draft.items.length}
                    </Badge>
                    {draft.hasCriticalETD && (
                      <AlertTriangle className="h-3 w-3 ml-1 text-destructive" />
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Tab Content */}
            {ordersByMonth.map((draft) => {
              const container = CONTAINER_SPECS[draft.containerType];
              const remainingVolume = draft.partialContainerPercent > 0 
                ? (container.volume - (draft.totalVolume % container.volume)).toFixed(1)
                : '0';
              
              return (
                <TabsContent key={draft.monthKey} value={draft.monthKey} className="mt-0">
                  <div className="p-3 space-y-3">
                    {/* Controls row - compact */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {/* Left: Container selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Container:</span>
                        <Select 
                          value={draft.containerType} 
                          onValueChange={(v) => handleContainerChange(draft.monthKey, v as keyof typeof CONTAINER_SPECS)}
                        >
                          <SelectTrigger className="w-[120px] h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="20dry">20' Dry (33m³)</SelectItem>
                            <SelectItem value="40dry">40' Dry (67m³)</SelectItem>
                            <SelectItem value="40hq">40' HQ (76m³)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Center: Container visualization + Fill button */}
                      <div className="flex-1 max-w-sm flex items-center gap-2">
                        <div className="flex-1">
                          {renderContainerVisualization(draft)}
                        </div>
                        
                        {/* Fill container button - inline */}
                        {draft.partialContainerPercent > 0 && onUpdateArrivals && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFillContainer(draft);
                            }}
                            className="h-7 text-xs"
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            +{remainingVolume}m³
                          </Button>
                        )}
                      </div>

                      {/* Right: Weight utilization */}
                      <div className="flex items-center gap-2">
                        <Scale className="h-3.5 w-3.5 text-muted-foreground" />
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full transition-all",
                              draft.isOverWeight ? 'bg-destructive' : 'bg-primary'
                            )}
                            style={{ width: `${draft.weightUtilization}%` }}
                          />
                        </div>
                        <span className={cn(
                          "text-xs",
                          draft.isOverWeight && "text-destructive font-medium"
                        )}>
                          {draft.totalWeight.toFixed(0)} kg
                        </span>
                      </div>
                    </div>

                    {/* Items table - ONLY scroll area */}
                    <div className="border rounded-md">
                      <ScrollArea className="h-[40vh]">
                        <Table className="text-sm">
                          <TableHeader>
                            <TableRow className="h-8">
                              <TableHead className="py-1.5 px-2">Produto</TableHead>
                              <TableHead className="text-center py-1.5 px-2">ETD</TableHead>
                              <TableHead className="text-right py-1.5 px-2">Qtd</TableHead>
                              <TableHead className="text-right py-1.5 px-2">Caixas</TableHead>
                              <TableHead className="text-right py-1.5 px-2">CBM</TableHead>
                              <TableHead className="text-right py-1.5 px-2">Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {draft.items.map((item, idx) => (
                              <TableRow key={idx} className="h-10">
                                <TableCell className="py-1 px-2">
                                  <div className="font-medium text-sm leading-tight">{item.code}</div>
                                  <div className="text-[10px] text-muted-foreground truncate max-w-[180px] leading-tight">
                                    {item.description}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center py-1 px-2">
                                  <div className={cn(
                                    "text-xs",
                                    item.isEtdCritical && 'text-destructive font-medium'
                                  )}>
                                    {format(item.etdDate, "dd/MM/yy")}
                                  </div>
                                  {item.isEtdCritical && (
                                    <AlertTriangle className="h-2.5 w-2.5 text-destructive mx-auto" />
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-xs py-1 px-2">
                                  {item.quantity.toLocaleString('pt-BR')}
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground py-1 px-2">
                                  {item.masterBoxes}
                                </TableCell>
                                <TableCell className="text-right text-xs py-1 px-2">
                                  {item.volume.toFixed(2)} m³
                                </TableCell>
                                <TableCell className="text-right text-xs py-1 px-2">
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

                    {/* Actions for this month */}
                    <div className="flex gap-2 pt-2 border-t">
                      <Button 
                        variant="outline" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearMonth(draft.monthKey);
                        }}
                        className="flex-1"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Limpar {draft.monthLabel}
                      </Button>
                      <Button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateSingleOrder(draft);
                        }}
                        disabled={!selectedSupplier || selectedSupplier === 'all' || createOrderMutation.isPending}
                        className="flex-1"
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
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateAllOrders();
                  }}
                  disabled={!selectedSupplier || selectedSupplier === 'all' || createAllOrdersMutation.isPending}
                  variant="default"
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
