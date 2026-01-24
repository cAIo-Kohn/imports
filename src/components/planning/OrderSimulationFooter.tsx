import React, { useMemo, useState } from 'react';
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
import { Package, DollarSign, Scale, Trash2, Ship, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';

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

interface OrderSimulationFooterProps {
  pendingArrivals: Record<string, number>;
  products: ProductWithDetails[];
  selectedSupplier: string;
  supplierName: string;
  selectedUnit: string;
  onClear: () => void;
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
  onSuccess,
}: OrderSimulationFooterProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { state: sidebarState, isMobile } = useSidebar();
  const [containerType, setContainerType] = useState<keyof typeof CONTAINER_SPECS>('40hq');
  const [isExpanded, setIsExpanded] = useState(false);

  const container = CONTAINER_SPECS[containerType];
  
  // Calculate left offset based on sidebar state
  const sidebarWidth = isMobile ? '0px' : (sidebarState === 'expanded' ? 'var(--sidebar-width)' : 'var(--sidebar-width-icon)');

  const orderSummary = useMemo(() => {
    const items: {
      productId: string;
      code: string;
      description: string;
      quantity: number;
      masterBoxes: number;
      volume: number;
      price: number;
      weight: number;
      monthKey: string;
      leadTime: number;
      etdDate: Date;
      isEtdCritical: boolean;
    }[] = [];
    
    let totalVolume = 0;
    let totalValue = 0;
    let totalWeight = 0;
    let totalQuantity = 0;

    Object.entries(pendingArrivals).forEach(([key, quantity]) => {
      if (quantity <= 0) return;

      const [productId, ...monthParts] = key.split('-');
      const monthKey = monthParts.join('-');
      const product = products.find(p => p.id === productId);
      if (!product) return;

      if (selectedSupplier !== 'all' && product.supplier_id !== selectedSupplier) return;

      const masterBoxes = product.qty_master_box
        ? Math.ceil(quantity / product.qty_master_box)
        : quantity;

      const volumePerBox = product.master_box_volume || 0;
      const itemVolume = masterBoxes * volumePerBox;

      const itemValue = quantity * (product.fob_price_usd || 0);
      const itemWeight = masterBoxes * (product.gross_weight || 0);

      totalVolume += itemVolume;
      totalValue += itemValue;
      totalWeight += itemWeight;
      totalQuantity += quantity;

      const leadTime = product.lead_time_days || DEFAULT_LEAD_TIME;
      const etdDate = calculateRequiredETD(monthKey, leadTime);
      const isEtdCritical = isBefore(etdDate, startOfDay(new Date()));

      items.push({
        productId,
        code: product.code,
        description: product.technical_description,
        quantity,
        masterBoxes,
        volume: itemVolume,
        price: itemValue,
        weight: itemWeight,
        monthKey,
        leadTime,
        etdDate,
        isEtdCritical,
      });
    });

    const volumeUtilization = (totalVolume / container.volume) * 100;
    const weightUtilization = (totalWeight / container.maxWeight) * 100;

    const earliestETD = items.length > 0 
      ? items.reduce((min, item) => isBefore(item.etdDate, min) ? item.etdDate : min, items[0].etdDate)
      : null;

    return {
      items,
      totalVolume,
      totalValue,
      totalWeight,
      totalQuantity,
      volumeUtilization: Math.min(volumeUtilization, 100),
      weightUtilization: Math.min(weightUtilization, 100),
      isOverVolume: volumeUtilization > 100,
      isOverWeight: weightUtilization > 100,
      earliestETD,
      hasCriticalETD: items.some(i => i.isEtdCritical),
    };
  }, [pendingArrivals, products, selectedSupplier, container]);

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Usuário não autenticado');
      if (orderSummary.items.length === 0) throw new Error('Nenhum item para criar pedido');
      if (!selectedSupplier || selectedSupplier === 'all') throw new Error('Selecione um fornecedor');

      const { data: orderNumber, error: rpcError } = await supabase
        .rpc('generate_purchase_order_number');
      
      if (rpcError) throw rpcError;

      const orderDate = orderSummary.earliestETD 
        ? format(orderSummary.earliestETD, 'yyyy-MM-dd')
        : format(new Date(), 'yyyy-MM-dd');

      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .insert({
          order_number: orderNumber,
          supplier_id: selectedSupplier,
          order_date: orderDate,
          status: 'draft',
          created_by: user.id,
          total_value_usd: orderSummary.totalValue,
          notes: `Container: ${container.name} | Volume: ${orderSummary.totalVolume.toFixed(2)}m³ (${orderSummary.volumeUtilization.toFixed(1)}%) | ETD: ${format(orderSummary.earliestETD || new Date(), 'dd/MM/yyyy')}`,
        })
        .select('id')
        .single();

      if (orderError) throw orderError;

      const orderItems = orderSummary.items.map(item => ({
        purchase_order_id: order.id,
        product_id: item.productId,
        unit_id: selectedUnit !== 'all' ? selectedUnit : null,
        quantity: item.quantity,
        unit_price_usd: products.find(p => p.id === item.productId)?.fob_price_usd || null,
        expected_arrival: item.monthKey,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      return { orderNumber, orderId: order.id };
    },
    onSuccess: (data) => {
      toast.success(`Pedido ${data.orderNumber} criado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['purchase-order-items'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      onClear();
      onSuccess();
    },
    onError: (error: any) => {
      toast.error('Erro ao criar pedido: ' + error.message);
    },
  });

  const hasItems = orderSummary.items.length > 0;

  if (!hasItems) return null;

  const getVolumeColor = () => {
    if (orderSummary.isOverVolume) return 'bg-destructive';
    if (orderSummary.volumeUtilization > 85) return 'bg-yellow-500';
    return 'bg-primary';
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
        {/* Left: Progress bar */}
        <div className="flex items-center gap-4">
          <Ship className="h-5 w-5 text-primary" />
          
          <div className="flex items-center gap-3">
            {/* Volume progress bar */}
            <div className="w-32 md:w-48 h-3 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all duration-300", getVolumeColor())}
                style={{ width: `${orderSummary.volumeUtilization}%` }}
              />
            </div>
            
            <span className={cn(
              "text-sm font-medium whitespace-nowrap",
              orderSummary.isOverVolume && "text-destructive"
            )}>
              {orderSummary.totalVolume.toFixed(1)} / {container.volume} m³
            </span>
            
            {orderSummary.isOverVolume && (
              <Badge variant="destructive" className="hidden sm:flex">Excedido!</Badge>
            )}
          </div>
        </div>

        {/* Center: Summary stats */}
        <div className="hidden md:flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              ${orderSummary.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span>{orderSummary.items.length} produtos</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-muted-foreground" />
            <span>{orderSummary.totalWeight.toFixed(0)} kg</span>
          </div>
          
          {orderSummary.hasCriticalETD && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              ETD Crítico
            </Badge>
          )}
        </div>

        {/* Right: Expand button */}
        <div className="flex items-center gap-2">
          <Badge variant="outline">{orderSummary.volumeUtilization.toFixed(0)}%</Badge>
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
          <div className="p-4 space-y-4 max-h-[50vh] overflow-auto">
            {/* Controls row */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">Container:</span>
                <Select value={containerType} onValueChange={(v) => setContainerType(v as keyof typeof CONTAINER_SPECS)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20dry">20' Dry (33m³)</SelectItem>
                    <SelectItem value="40dry">40' Dry (67m³)</SelectItem>
                    <SelectItem value="40hq">40' HQ (76m³)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Weight utilization */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Peso:</span>
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all",
                      orderSummary.isOverWeight ? 'bg-destructive' : 'bg-primary'
                    )}
                    style={{ width: `${orderSummary.weightUtilization}%` }}
                  />
                </div>
                <span className={cn(
                  "text-sm",
                  orderSummary.isOverWeight && "text-destructive font-medium"
                )}>
                  {orderSummary.totalWeight.toFixed(0)} / {container.maxWeight.toLocaleString()} kg
                </span>
              </div>
            </div>

            {/* Items table */}
            <ScrollArea className="max-h-[250px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Chegada</TableHead>
                    <TableHead className="text-center">ETD</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Caixas</TableHead>
                    <TableHead className="text-right">CBM</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderSummary.items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="font-medium">{item.code}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {item.description}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {format(parseDateString(item.monthKey), "MMM/yy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className={cn(
                          "text-xs",
                          item.isEtdCritical && 'text-destructive font-medium'
                        )}>
                          {format(item.etdDate, "MMM/yy", { locale: ptBR })}
                        </div>
                        {item.isEtdCritical && (
                          <AlertTriangle className="h-3 w-3 text-destructive mx-auto mt-0.5" />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.quantity.toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {item.masterBoxes}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.volume.toFixed(2)} m³
                      </TableCell>
                      <TableCell className="text-right">
                        ${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t">
              <Button 
                variant="outline" 
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="flex-1"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Limpar
              </Button>
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  createOrderMutation.mutate();
                }}
                disabled={!selectedSupplier || selectedSupplier === 'all' || createOrderMutation.isPending}
                className="flex-1"
              >
                {createOrderMutation.isPending ? 'Criando...' : 'Criar Pedido'}
              </Button>
            </div>

            {(!selectedSupplier || selectedSupplier === 'all') && (
              <p className="text-xs text-muted-foreground text-center">
                Selecione um fornecedor para criar o pedido
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
