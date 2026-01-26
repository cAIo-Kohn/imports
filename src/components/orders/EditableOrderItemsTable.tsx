import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrderChanges } from '@/hooks/useOrderChanges';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Edit2, Save, X, Loader2 } from 'lucide-react';

interface Product {
  id: string;
  code: string;
  technical_description: string;
  ncm: string | null;
  qty_master_box: number | null;
  qty_inner: number | null;
  master_box_length: number | null;
  master_box_width: number | null;
  master_box_height: number | null;
  master_box_volume: number | null;
  packaging_type: string | null;
  supplier_specs: string | null;
  individual_length: number | null;
  individual_width: number | null;
  individual_height: number | null;
  image_url: string | null;
  fob_price_usd: number | null;
  origin_description: string | null;
  gross_weight: number | null;
}

interface Unit {
  id: string;
  name: string;
}

interface OrderItem {
  id: string;
  quantity: number;
  unit_price_usd: number | null;
  expected_arrival: string | null;
  products: Product | null;
  units: Unit | null;
}

interface EditableOrderItemsTableProps {
  orderId: string;
  items: OrderItem[];
  showImages?: boolean;
  onTotalsChanged: () => void;
}

interface EditingState {
  [itemId: string]: {
    unit_price_usd: number;
    quantity: number;
    isSaving: boolean;
  };
}

export function EditableOrderItemsTable({ 
  orderId, 
  items, 
  showImages = true,
  onTotalsChanged 
}: EditableOrderItemsTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logChange } = useOrderChanges(orderId);
  const [editingItems, setEditingItems] = useState<EditingState>({});

  const isEditing = (itemId: string) => itemId in editingItems;

  const startEditing = (item: OrderItem) => {
    setEditingItems(prev => ({
      ...prev,
      [item.id]: {
        unit_price_usd: item.unit_price_usd || item.products?.fob_price_usd || 0,
        quantity: item.quantity,
        isSaving: false,
      }
    }));
  };

  const cancelEditing = (itemId: string) => {
    setEditingItems(prev => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const updateEditingValue = (itemId: string, field: 'unit_price_usd' | 'quantity', value: number) => {
    setEditingItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      }
    }));
  };

  const saveItemMutation = useMutation({
    mutationFn: async ({ 
      item, 
      newPrice, 
      newQty 
    }: { 
      item: OrderItem; 
      newPrice: number; 
      newQty: number; 
    }) => {
      const oldPrice = item.unit_price_usd;
      const oldQty = item.quantity;

      // Update the item in database
      const { error } = await supabase
        .from('purchase_order_items')
        .update({ 
          unit_price_usd: newPrice,
          quantity: newQty,
        })
        .eq('id', item.id);

      if (error) throw error;

      // Log price change if different
      if (oldPrice !== newPrice) {
        await logChange({
          orderId,
          itemId: item.id,
          changeType: 'item_field',
          fieldName: 'unit_price_usd',
          oldValue: String(oldPrice || 0),
          newValue: String(newPrice),
          isCritical: true,
        });
      }

      // Log quantity change if different
      if (oldQty !== newQty) {
        await logChange({
          orderId,
          itemId: item.id,
          changeType: 'item_field',
          fieldName: 'quantity',
          oldValue: String(oldQty),
          newValue: String(newQty),
          isCritical: true,
        });
      }

      // Recalculate order total
      const { data: allItems } = await supabase
        .from('purchase_order_items')
        .select('quantity, unit_price_usd')
        .eq('purchase_order_id', orderId);

      if (allItems) {
        const newTotal = allItems.reduce((sum, i) => 
          sum + (i.quantity * (i.unit_price_usd || 0)), 0);

        await supabase
          .from('purchase_orders')
          .update({ total_value_usd: newTotal })
          .eq('id', orderId);
      }

      return { item, newPrice, newQty };
    },
    onMutate: async ({ item }) => {
      setEditingItems(prev => ({
        ...prev,
        [item.id]: { ...prev[item.id], isSaving: true }
      }));
    },
    onSuccess: ({ item }) => {
      toast({ title: `Item ${item.products?.code} atualizado!` });
      cancelEditing(item.id);
      queryClient.invalidateQueries({ queryKey: ['purchase-order', orderId] });
      onTotalsChanged();
    },
    onError: (error: Error, { item }) => {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      setEditingItems(prev => ({
        ...prev,
        [item.id]: { ...prev[item.id], isSaving: false }
      }));
    },
  });

  const handleSave = (item: OrderItem) => {
    const editing = editingItems[item.id];
    if (!editing) return;
    
    saveItemMutation.mutate({
      item,
      newPrice: editing.unit_price_usd,
      newQty: editing.quantity,
    });
  };

  const formatDimensions = (l: number | null, w: number | null, h: number | null) => {
    if (!l && !w && !h) return '-';
    return `${l || 0}×${w || 0}×${h || 0}`;
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculate totals
  const totals = items.reduce((acc, item) => {
    const product = item.products;
    const editing = editingItems[item.id];
    const qty = editing ? editing.quantity : item.quantity;
    const price = editing ? editing.unit_price_usd : (item.unit_price_usd || product?.fob_price_usd || 0);
    const qtyMasterBox = product?.qty_master_box || 1;
    const masterVolume = product?.master_box_volume || 0;
    const cartons = Math.ceil(qty / qtyMasterBox);
    const amount = qty * price;
    const cbm = cartons * masterVolume;

    acc.totalQty += qty;
    acc.totalCartons += cartons;
    acc.totalAmount += amount;
    acc.totalCbm += cbm;
    
    return acc;
  }, { totalQty: 0, totalCartons: 0, totalAmount: 0, totalCbm: 0 });

  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-center w-12">#</TableHead>
              {showImages && <TableHead className="w-16">PIC</TableHead>}
              <TableHead>CODE</TableHead>
              <TableHead>MASTER CTN</TableHead>
              <TableHead className="text-right">m³</TableHead>
              <TableHead className="max-w-[150px]">DESCRIPTION</TableHead>
              <TableHead>NCM</TableHead>
              <TableHead className="text-right">PCS/CTN</TableHead>
              <TableHead className="text-right">CTN</TableHead>
              <TableHead className="text-right w-28">Q'TY</TableHead>
              <TableHead className="text-right w-28">FOB USD</TableHead>
              <TableHead className="text-right">AMOUNT</TableHead>
              <TableHead className="text-right">CBM</TableHead>
              <TableHead className="w-24">AÇÃO</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => {
              const product = item.products;
              const editing = editingItems[item.id];
              const qty = editing ? editing.quantity : item.quantity;
              const price = editing ? editing.unit_price_usd : (item.unit_price_usd || product?.fob_price_usd || 0);
              const qtyMasterBox = product?.qty_master_box || 1;
              const masterVolume = product?.master_box_volume || 0;
              const cartons = Math.ceil(qty / qtyMasterBox);
              const amount = qty * price;
              const cbm = cartons * masterVolume;

              return (
                <TableRow key={item.id} className={isEditing(item.id) ? 'bg-primary/5' : ''}>
                  <TableCell className="text-center font-medium">{index + 1}</TableCell>
                  {showImages && (
                    <TableCell>
                      {product?.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.code}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                          N/A
                        </div>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="font-mono">{product?.code}</TableCell>
                  <TableCell className="text-sm">
                    {formatDimensions(
                      product?.master_box_length,
                      product?.master_box_width,
                      product?.master_box_height
                    )}
                  </TableCell>
                  <TableCell className="text-right">{masterVolume?.toFixed(3) || '-'}</TableCell>
                  <TableCell className="max-w-[150px] text-xs">
                    {product?.supplier_specs || product?.technical_description || '-'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{product?.ncm || '-'}</TableCell>
                  <TableCell className="text-right">{qtyMasterBox}</TableCell>
                  <TableCell className="text-right">{cartons.toLocaleString()}</TableCell>
                  
                  {/* Editable Quantity */}
                  <TableCell className="text-right">
                    {isEditing(item.id) ? (
                      <Input
                        type="number"
                        value={editing.quantity}
                        onChange={(e) => updateEditingValue(item.id, 'quantity', Number(e.target.value))}
                        className="w-24 h-8 text-right"
                        min={1}
                      />
                    ) : (
                      <span className="font-medium">{qty.toLocaleString()}</span>
                    )}
                  </TableCell>
                  
                  {/* Editable Price */}
                  <TableCell className="text-right">
                    {isEditing(item.id) ? (
                      <Input
                        type="number"
                        value={editing.unit_price_usd}
                        onChange={(e) => updateEditingValue(item.id, 'unit_price_usd', Number(e.target.value))}
                        className="w-28 h-8 text-right"
                        step={0.0001}
                        min={0}
                      />
                    ) : (
                      <span>${price.toFixed(4)}</span>
                    )}
                  </TableCell>
                  
                  <TableCell className="text-right font-medium">${formatCurrency(amount)}</TableCell>
                  <TableCell className="text-right">{cbm.toFixed(3)}</TableCell>
                  
                  {/* Actions */}
                  <TableCell>
                    {isEditing(item.id) ? (
                      <div className="flex gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8"
                          onClick={() => handleSave(item)}
                          disabled={editing.isSaving}
                        >
                          {editing.isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 text-green-600" />
                          )}
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8"
                          onClick={() => cancelEditing(item.id)}
                          disabled={editing.isSaving}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8"
                        onClick={() => startEditing(item)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Totals Row */}
      <div className="border-t bg-muted/50 p-4">
        <div className="grid grid-cols-4 gap-4 text-sm font-medium">
          <div>
            <span className="text-muted-foreground">Total Cartons:</span>{' '}
            {totals.totalCartons.toLocaleString()}
          </div>
          <div>
            <span className="text-muted-foreground">Total Qty:</span>{' '}
            {totals.totalQty.toLocaleString()} pcs
          </div>
          <div>
            <span className="text-muted-foreground">Total CBM:</span>{' '}
            {totals.totalCbm.toFixed(3)} m³
          </div>
          <div className="text-right">
            <span className="text-muted-foreground">Total Amount:</span>{' '}
            <span className="text-lg font-bold">${formatCurrency(totals.totalAmount)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
