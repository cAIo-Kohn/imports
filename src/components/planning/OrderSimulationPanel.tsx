import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, subDays, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package, DollarSign, Scale, Box, Trash2, Ship, CalendarClock, AlertTriangle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

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

interface PendingArrival {
  productId: string;
  monthKey: string;
  quantity: number;
}

interface OrderSimulationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

const DEFAULT_LEAD_TIME = 60; // Default 60 days if not specified

// Helper function to parse date string safely (avoiding timezone issues)
function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day || 1);
}

// Calculate required ETD based on arrival date and lead time
function calculateRequiredETD(arrivalMonthKey: string, leadTimeDays: number): Date {
  const arrivalDate = parseDateString(arrivalMonthKey);
  return subDays(arrivalDate, leadTimeDays);
}

export function OrderSimulationPanel({
  open,
  onOpenChange,
  pendingArrivals,
  products,
  selectedSupplier,
  supplierName,
  selectedUnit,
  onClear,
  onSuccess,
}: OrderSimulationPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [containerType, setContainerType] = useState<keyof typeof CONTAINER_SPECS>('40hq');

  const container = CONTAINER_SPECS[containerType];

  // Calculate order summary from pending arrivals
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

      // Filter by supplier if selected
      if (selectedSupplier !== 'all' && product.supplier_id !== selectedSupplier) return;

      // Calculate master boxes needed
      const masterBoxes = product.qty_master_box
        ? Math.ceil(quantity / product.qty_master_box)
        : quantity;

      // Volume in m³
      const volumePerBox = product.master_box_volume || 0;
      const itemVolume = masterBoxes * volumePerBox;

      // FOB value
      const itemValue = quantity * (product.fob_price_usd || 0);

      // Weight
      const itemWeight = masterBoxes * (product.gross_weight || 0);

      totalVolume += itemVolume;
      totalValue += itemValue;
      totalWeight += itemWeight;
      totalQuantity += quantity;

      // Calculate ETD
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

    // Container utilization
    const volumeUtilization = (totalVolume / container.volume) * 100;
    const weightUtilization = (totalWeight / container.maxWeight) * 100;

    // Group items by ETD month for summary
    const etdGroups: Record<string, { items: typeof items; hasCritical: boolean }> = {};
    items.forEach(item => {
      const etdKey = format(item.etdDate, 'yyyy-MM');
      if (!etdGroups[etdKey]) {
        etdGroups[etdKey] = { items: [], hasCritical: false };
      }
      etdGroups[etdKey].items.push(item);
      if (item.isEtdCritical) {
        etdGroups[etdKey].hasCritical = true;
      }
    });

    // Find earliest ETD for order date
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
      etdGroups,
      earliestETD,
    };
  }, [pendingArrivals, products, selectedSupplier, container]);

  // Create purchase order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Usuário não autenticado');
      if (orderSummary.items.length === 0) throw new Error('Nenhum item para criar pedido');
      if (selectedSupplier === 'all') throw new Error('Selecione um fornecedor');

      // Generate order number
      const { data: orderNumber, error: rpcError } = await supabase
        .rpc('generate_purchase_order_number');
      
      if (rpcError) throw rpcError;

      // Get the earliest expected arrival from items
      const earliestMonth = orderSummary.items.reduce((min, item) => {
        return item.monthKey < min ? item.monthKey : min;
      }, orderSummary.items[0].monthKey);

      // Create purchase order with earliest ETD as order_date
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

      // Group items by product and month, then insert
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
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error('Erro ao criar pedido: ' + error.message);
    },
  });

  const hasItems = orderSummary.items.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[450px] sm:w-[550px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5" />
            Simulação de Compra
          </SheetTitle>
          <SheetDescription>
            {selectedSupplier !== 'all' ? supplierName : 'Todos os fornecedores'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-2 mt-2">
          {/* Compact ETD Summary */}
          {hasItems && Object.keys(orderSummary.etdGroups).length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <CalendarClock className="h-3 w-3" />
                ETD
              </div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(orderSummary.etdGroups)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([etdKey, { items, hasCritical }]) => {
                    const etdDate = parseDateString(`${etdKey}-01`);
                    return (
                      <Badge 
                        key={etdKey} 
                        variant={hasCritical ? "destructive" : "outline"}
                        className="text-[10px] px-1.5 py-0 h-5"
                      >
                        {format(etdDate, "MMM/yy", { locale: ptBR })} ({items.length})
                        {hasCritical && <AlertTriangle className="h-2.5 w-2.5 ml-0.5" />}
                      </Badge>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Compact summary line: Container + Value + Quantity */}
          <div className="flex items-center gap-2 text-[11px] border rounded-md px-2 py-1.5 bg-muted/30">
            <div className="flex items-center gap-1">
              <Box className="h-3 w-3 text-muted-foreground" />
              <Select value={containerType} onValueChange={(v) => setContainerType(v as keyof typeof CONTAINER_SPECS)}>
                <SelectTrigger className="h-6 text-[11px] w-[90px] border-0 bg-transparent p-0 focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20dry">20' (33m³)</SelectItem>
                  <SelectItem value="40dry">40' (67m³)</SelectItem>
                  <SelectItem value="40hq">40' HQ (76m³)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="h-3 w-px bg-border" />
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <span className="font-semibold">
                {orderSummary.totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="h-3 w-px bg-border" />
            <div className="flex items-center gap-1">
              <Package className="h-3 w-3 text-muted-foreground" />
              <span>{orderSummary.items.length} prod.</span>
              <span className="text-muted-foreground">|</span>
              <span>{orderSummary.totalQuantity.toLocaleString('pt-BR')} un.</span>
            </div>
          </div>

          {/* Compact utilization bars */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-10">Vol.</span>
              <Progress 
                value={orderSummary.volumeUtilization} 
                className={`h-1.5 flex-1 ${orderSummary.isOverVolume ? '[&>div]:bg-destructive' : ''}`}
              />
              <span className={`text-[10px] font-medium w-20 text-right ${orderSummary.isOverVolume ? 'text-destructive' : ''}`}>
                {orderSummary.totalVolume.toFixed(1)}m³ ({orderSummary.volumeUtilization.toFixed(0)}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-10">Peso</span>
              <Progress 
                value={orderSummary.weightUtilization}
                className={`h-1.5 flex-1 ${orderSummary.isOverWeight ? '[&>div]:bg-destructive' : ''}`}
              />
              <span className={`text-[10px] font-medium w-20 text-right ${orderSummary.isOverWeight ? 'text-destructive' : ''}`}>
                {(orderSummary.totalWeight/1000).toFixed(1)}t ({orderSummary.weightUtilization.toFixed(0)}%)
              </span>
            </div>
          </div>

          {/* Items table - much more compact */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full">
              {hasItems ? (
                <Table className="text-[11px]">
                  <TableHeader>
                    <TableRow className="h-6">
                      <TableHead className="py-0.5 px-1.5">Produto</TableHead>
                      <TableHead className="text-center py-0.5 px-1">ETD</TableHead>
                      <TableHead className="text-right py-0.5 px-1">Qtd</TableHead>
                      <TableHead className="text-right py-0.5 px-1.5">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderSummary.items.map((item, idx) => (
                      <TableRow key={idx} className="h-8">
                        <TableCell className="py-0.5 px-1.5">
                          <div className="font-medium text-[11px] leading-none">{item.code}</div>
                          <div className="text-[9px] text-muted-foreground truncate max-w-[130px] leading-none mt-0.5">
                            {item.description}
                          </div>
                        </TableCell>
                        <TableCell className="text-center py-0.5 px-1">
                          <div className={`text-[10px] leading-none ${item.isEtdCritical ? 'text-destructive font-medium' : ''}`}>
                            {format(item.etdDate, "MMM/yy", { locale: ptBR })}
                            {item.isEtdCritical && <AlertTriangle className="h-2.5 w-2.5 inline ml-0.5" />}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-[10px] py-0.5 px-1">
                          {item.quantity.toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right text-[10px] py-0.5 px-1.5">
                          ${item.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm">Digite quantidades na linha "Chegada"</p>
                  <p className="text-xs">para simular uma compra</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t mt-4">
          <Button 
            variant="outline" 
            onClick={onClear}
            disabled={!hasItems}
            className="flex-1"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Limpar
          </Button>
          <Button 
            onClick={() => createOrderMutation.mutate()}
            disabled={!hasItems || selectedSupplier === 'all' || createOrderMutation.isPending}
            className="flex-1"
          >
            {createOrderMutation.isPending ? 'Criando...' : 'Criar Pedido'}
          </Button>
        </div>

        {selectedSupplier === 'all' && hasItems && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Selecione um fornecedor para criar o pedido
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
