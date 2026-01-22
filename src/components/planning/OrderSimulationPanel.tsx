import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
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
import { Package, DollarSign, Scale, Box, Trash2, Ship } from 'lucide-react';
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
      });
    });

    // Container utilization
    const volumeUtilization = (totalVolume / container.volume) * 100;
    const weightUtilization = (totalWeight / container.maxWeight) * 100;

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

      // Create purchase order
      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .insert({
          order_number: orderNumber,
          supplier_id: selectedSupplier,
          order_date: format(new Date(), 'yyyy-MM-dd'),
          status: 'draft',
          created_by: user.id,
          total_value_usd: orderSummary.totalValue,
          notes: `Container: ${container.name} | Volume: ${orderSummary.totalVolume.toFixed(2)}m³ (${orderSummary.volumeUtilization.toFixed(1)}%)`,
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

        <div className="flex-1 overflow-hidden flex flex-col gap-4 mt-4">
          {/* Container selector */}
          <div className="flex items-center gap-2">
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

          {/* Volume utilization */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1">
                <Box className="h-4 w-4" />
                Ocupação (Volume)
              </span>
              <span className={`font-medium ${orderSummary.isOverVolume ? 'text-destructive' : ''}`}>
                {orderSummary.volumeUtilization.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={orderSummary.volumeUtilization} 
              className={orderSummary.isOverVolume ? '[&>div]:bg-destructive' : ''}
            />
            <p className="text-xs text-muted-foreground">
              {orderSummary.totalVolume.toFixed(2)} m³ de {container.volume} m³
              {orderSummary.isOverVolume && (
                <Badge variant="destructive" className="ml-2">Excedido!</Badge>
              )}
            </p>
          </div>

          {/* Weight utilization */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1">
                <Scale className="h-4 w-4" />
                Ocupação (Peso)
              </span>
              <span className={`font-medium ${orderSummary.isOverWeight ? 'text-destructive' : ''}`}>
                {orderSummary.weightUtilization.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={orderSummary.weightUtilization}
              className={orderSummary.isOverWeight ? '[&>div]:bg-destructive' : ''}
            />
            <p className="text-xs text-muted-foreground">
              {orderSummary.totalWeight.toFixed(0)} kg de {container.maxWeight.toLocaleString()} kg
              {orderSummary.isOverWeight && (
                <Badge variant="destructive" className="ml-2">Excedido!</Badge>
              )}
            </p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs">Valor FOB</span>
                </div>
                <div className="text-xl font-bold">
                  ${orderSummary.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Package className="h-4 w-4" />
                  <span className="text-xs">Qtd. Total</span>
                </div>
                <div className="text-xl font-bold">
                  {orderSummary.totalQuantity.toLocaleString('pt-BR')}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Items table */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full max-h-[300px]">
              {hasItems ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">m³</TableHead>
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
                        <TableCell className="text-right">
                          {item.quantity.toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          ${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.volume.toFixed(2)}
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
