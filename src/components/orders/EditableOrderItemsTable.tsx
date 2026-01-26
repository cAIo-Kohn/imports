import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrderChanges } from '@/hooks/useOrderChanges';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Edit2, Save, X, Loader2, CheckCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  trader_price_approved?: boolean;
  trader_quantity_approved?: boolean;
}

interface EditableOrderItemsTableProps {
  orderId: string;
  items: OrderItem[];
  showImages?: boolean;
  onTotalsChanged: () => void;
  onApprovalsChanged?: (priceCount: number, qtyCount: number) => void;
}

interface EditingState {
  [itemId: string]: {
    // Campos críticos (purchase_order_items)
    unit_price_usd: number;
    quantity: number;
    // Campos não-críticos (products)
    technical_description: string;
    supplier_specs: string;
    ncm: string;
    master_box_volume: number;
    master_box_length: number;
    master_box_width: number;
    master_box_height: number;
    isSaving: boolean;
  };
}

interface ItemApprovals {
  [itemId: string]: {
    priceApproved: boolean;
    qtyApproved: boolean;
  };
}

export function EditableOrderItemsTable({ 
  orderId, 
  items, 
  showImages = true,
  onTotalsChanged,
  onApprovalsChanged 
}: EditableOrderItemsTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logChange } = useOrderChanges(orderId);
  const [editingItems, setEditingItems] = useState<EditingState>({});
  const [itemApprovals, setItemApprovals] = useState<ItemApprovals>({});

  // Initialize approvals from items
  useEffect(() => {
    const approvals: ItemApprovals = {};
    items.forEach(item => {
      approvals[item.id] = {
        priceApproved: item.trader_price_approved || false,
        qtyApproved: item.trader_quantity_approved || false,
      };
    });
    setItemApprovals(approvals);
  }, [items]);

  // Notify parent when approvals change
  useEffect(() => {
    if (onApprovalsChanged) {
      const priceCount = Object.values(itemApprovals).filter(a => a.priceApproved).length;
      const qtyCount = Object.values(itemApprovals).filter(a => a.qtyApproved).length;
      onApprovalsChanged(priceCount, qtyCount);
    }
  }, [itemApprovals, onApprovalsChanged]);

  const isEditing = (itemId: string) => itemId in editingItems;

  const startEditing = (item: OrderItem) => {
    const product = item.products;
    setEditingItems(prev => ({
      ...prev,
      [item.id]: {
        unit_price_usd: item.unit_price_usd || product?.fob_price_usd || 0,
        quantity: item.quantity,
        technical_description: product?.technical_description || '',
        supplier_specs: product?.supplier_specs || '',
        ncm: product?.ncm || '',
        master_box_volume: product?.master_box_volume || 0,
        master_box_length: product?.master_box_length || 0,
        master_box_width: product?.master_box_width || 0,
        master_box_height: product?.master_box_height || 0,
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

  const updateEditingValue = (itemId: string, field: keyof EditingState[string], value: number | string) => {
    setEditingItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      }
    }));
  };

  // Mutation for item approval checkboxes
  const approveItemMutation = useMutation({
    mutationFn: async ({ itemId, field, value }: { itemId: string; field: 'price' | 'quantity'; value: boolean }) => {
      const columnName = field === 'price' ? 'trader_price_approved' : 'trader_quantity_approved';
      
      const { error } = await supabase
        .from('purchase_order_items')
        .update({ [columnName]: value })
        .eq('id', itemId);

      if (error) throw error;
      return { itemId, field, value };
    },
    onSuccess: ({ itemId, field, value }) => {
      setItemApprovals(prev => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          [field === 'price' ? 'priceApproved' : 'qtyApproved']: value,
        }
      }));
      queryClient.invalidateQueries({ queryKey: ['purchase-order', orderId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao aprovar item', description: error.message, variant: 'destructive' });
    },
  });

  // Batch approval mutation
  const batchApproveMutation = useMutation({
    mutationFn: async ({ field }: { field: 'price' | 'quantity' }) => {
      const columnName = field === 'price' ? 'trader_price_approved' : 'trader_quantity_approved';
      const itemIds = items.map(item => item.id);
      
      const { error } = await supabase
        .from('purchase_order_items')
        .update({ [columnName]: true })
        .in('id', itemIds);

      if (error) throw error;
      return { field, itemIds };
    },
    onSuccess: ({ field, itemIds }) => {
      setItemApprovals(prev => {
        const updated = { ...prev };
        itemIds.forEach(id => {
          updated[id] = {
            ...updated[id],
            [field === 'price' ? 'priceApproved' : 'qtyApproved']: true,
          };
        });
        return updated;
      });
      toast({ 
        title: field === 'price' ? 'Todos os preços aprovados!' : 'Todas as quantidades aprovadas!'
      });
      queryClient.invalidateQueries({ queryKey: ['purchase-order', orderId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao aprovar em lote', description: error.message, variant: 'destructive' });
    },
  });

  // Check if all items are already approved
  const allPricesApproved = items.length > 0 && items.every(item => itemApprovals[item.id]?.priceApproved);
  const allQtysApproved = items.length > 0 && items.every(item => itemApprovals[item.id]?.qtyApproved);

  const saveItemMutation = useMutation({
    mutationFn: async ({ 
      item, 
      editingData 
    }: { 
      item: OrderItem; 
      editingData: EditingState[string];
    }) => {
      const product = item.products;
      const oldPrice = item.unit_price_usd;
      const oldQty = item.quantity;

      // 1. Update purchase_order_items (campos críticos)
      const { error: itemError } = await supabase
        .from('purchase_order_items')
        .update({ 
          unit_price_usd: editingData.unit_price_usd,
          quantity: editingData.quantity,
        })
        .eq('id', item.id);

      if (itemError) throw itemError;

      // 2. Update products table (campos não-críticos)
      if (product) {
        const { error: productError } = await supabase
          .from('products')
          .update({
            technical_description: editingData.technical_description,
            supplier_specs: editingData.supplier_specs,
            ncm: editingData.ncm,
            master_box_volume: editingData.master_box_volume,
            master_box_length: editingData.master_box_length,
            master_box_width: editingData.master_box_width,
            master_box_height: editingData.master_box_height,
          })
          .eq('id', product.id);

        if (productError) throw productError;
      }

      // 3. Log all changes
      const changes: Array<{field: string; oldVal: string | null; newVal: string; isCritical: boolean}> = [];

      // Critical changes
      if (oldPrice !== editingData.unit_price_usd) {
        changes.push({
          field: 'unit_price_usd',
          oldVal: String(oldPrice || 0),
          newVal: String(editingData.unit_price_usd),
          isCritical: true,
        });
      }
      if (oldQty !== editingData.quantity) {
        changes.push({
          field: 'quantity',
          oldVal: String(oldQty),
          newVal: String(editingData.quantity),
          isCritical: true,
        });
      }

      // Non-critical changes
      if (product) {
        if (product.technical_description !== editingData.technical_description) {
          changes.push({
            field: 'technical_description',
            oldVal: product.technical_description,
            newVal: editingData.technical_description,
            isCritical: false,
          });
        }
        if ((product.supplier_specs || '') !== editingData.supplier_specs) {
          changes.push({
            field: 'supplier_specs',
            oldVal: product.supplier_specs,
            newVal: editingData.supplier_specs,
            isCritical: false,
          });
        }
        if ((product.ncm || '') !== editingData.ncm) {
          changes.push({
            field: 'ncm',
            oldVal: product.ncm,
            newVal: editingData.ncm,
            isCritical: false,
          });
        }
        if ((product.master_box_volume || 0) !== editingData.master_box_volume) {
          changes.push({
            field: 'master_box_volume',
            oldVal: String(product.master_box_volume || 0),
            newVal: String(editingData.master_box_volume),
            isCritical: false,
          });
        }
        if ((product.master_box_length || 0) !== editingData.master_box_length) {
          changes.push({
            field: 'master_box_length',
            oldVal: String(product.master_box_length || 0),
            newVal: String(editingData.master_box_length),
            isCritical: false,
          });
        }
        if ((product.master_box_width || 0) !== editingData.master_box_width) {
          changes.push({
            field: 'master_box_width',
            oldVal: String(product.master_box_width || 0),
            newVal: String(editingData.master_box_width),
            isCritical: false,
          });
        }
        if ((product.master_box_height || 0) !== editingData.master_box_height) {
          changes.push({
            field: 'master_box_height',
            oldVal: String(product.master_box_height || 0),
            newVal: String(editingData.master_box_height),
            isCritical: false,
          });
        }
      }

      // Log each change
      for (const change of changes) {
        await logChange({
          orderId,
          itemId: item.id,
          changeType: 'item_field',
          fieldName: change.field,
          oldValue: change.oldVal,
          newValue: change.newVal,
          isCritical: change.isCritical,
        });
      }

      // 4. Recalculate order total
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

      return { item, changesCount: changes.length };
    },
    onMutate: async ({ item }) => {
      setEditingItems(prev => ({
        ...prev,
        [item.id]: { ...prev[item.id], isSaving: true }
      }));
    },
    onSuccess: ({ item, changesCount }) => {
      toast({ 
        title: `Item ${item.products?.code} atualizado!`,
        description: changesCount > 0 ? `${changesCount} alteração(ões) registrada(s)` : undefined
      });
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
      editingData: editing,
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
    const masterVolume = editing ? editing.master_box_volume : (product?.master_box_volume || 0);
    const cartons = Math.ceil(qty / qtyMasterBox);
    const amount = qty * price;
    const cbm = cartons * masterVolume;

    acc.totalQty += qty;
    acc.totalCartons += cartons;
    acc.totalAmount += amount;
    acc.totalCbm += cbm;
    
    return acc;
  }, { totalQty: 0, totalCartons: 0, totalAmount: 0, totalCbm: 0 });

  // Sort items by product code to maintain stable order
  const sortedItems = [...items].sort((a, b) => {
    const codeA = a.products?.code || '';
    const codeB = b.products?.code || '';
    return codeA.localeCompare(codeB);
  });

  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-center w-12">#</TableHead>
              {showImages && <TableHead className="w-16">PIC</TableHead>}
              <TableHead>CODE</TableHead>
              <TableHead className="w-32">MASTER CTN (L×W×H)</TableHead>
              <TableHead className="text-right w-20">m³</TableHead>
              <TableHead className="w-48">DESCRIPTION / SPECS</TableHead>
              <TableHead className="w-28">NCM</TableHead>
              <TableHead className="text-right w-16">PCS/CTN</TableHead>
              <TableHead className="text-right w-16">CTN</TableHead>
              <TableHead className="text-right w-24">Q'TY</TableHead>
              <TableHead className="text-center w-14">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant={allQtysApproved ? "ghost" : "outline"}
                        className="h-6 px-1.5 text-xs"
                        onClick={() => !allQtysApproved && batchApproveMutation.mutate({ field: 'quantity' })}
                        disabled={allQtysApproved || batchApproveMutation.isPending}
                      >
                        {batchApproveMutation.isPending && batchApproveMutation.variables?.field === 'quantity' ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : allQtysApproved ? (
                          <CheckCheck className="h-3 w-3 text-green-600" />
                        ) : (
                          <CheckCheck className="h-3 w-3" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {allQtysApproved ? 'Todas qtds aprovadas' : 'Aprovar todas quantidades'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableHead>
              <TableHead className="text-right w-28">FOB USD</TableHead>
              <TableHead className="text-center w-14">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant={allPricesApproved ? "ghost" : "outline"}
                        className="h-6 px-1.5 text-xs"
                        onClick={() => !allPricesApproved && batchApproveMutation.mutate({ field: 'price' })}
                        disabled={allPricesApproved || batchApproveMutation.isPending}
                      >
                        {batchApproveMutation.isPending && batchApproveMutation.variables?.field === 'price' ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : allPricesApproved ? (
                          <CheckCheck className="h-3 w-3 text-green-600" />
                        ) : (
                          <CheckCheck className="h-3 w-3" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {allPricesApproved ? 'Todos preços aprovados' : 'Aprovar todos preços'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableHead>
              <TableHead className="text-right">AMOUNT</TableHead>
              <TableHead className="text-right">CBM</TableHead>
              <TableHead className="w-24">AÇÃO</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.map((item, index) => {
              const product = item.products;
              const editing = editingItems[item.id];
              const qty = editing ? editing.quantity : item.quantity;
              const price = editing ? editing.unit_price_usd : (item.unit_price_usd || product?.fob_price_usd || 0);
              const qtyMasterBox = product?.qty_master_box || 1;
              const masterVolume = editing ? editing.master_box_volume : (product?.master_box_volume || 0);
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
                  
                  {/* Master CTN Dimensions - Editable */}
                  <TableCell className="text-sm">
                    {isEditing(item.id) ? (
                      <div className="flex gap-1 text-xs">
                        <Input
                          type="number"
                          value={editing.master_box_length}
                          onChange={(e) => updateEditingValue(item.id, 'master_box_length', Number(e.target.value))}
                          className="w-12 h-6 text-xs px-1"
                          min={0}
                          step={0.1}
                        />
                        ×
                        <Input
                          type="number"
                          value={editing.master_box_width}
                          onChange={(e) => updateEditingValue(item.id, 'master_box_width', Number(e.target.value))}
                          className="w-12 h-6 text-xs px-1"
                          min={0}
                          step={0.1}
                        />
                        ×
                        <Input
                          type="number"
                          value={editing.master_box_height}
                          onChange={(e) => updateEditingValue(item.id, 'master_box_height', Number(e.target.value))}
                          className="w-12 h-6 text-xs px-1"
                          min={0}
                          step={0.1}
                        />
                      </div>
                    ) : (
                      formatDimensions(
                        product?.master_box_length,
                        product?.master_box_width,
                        product?.master_box_height
                      )
                    )}
                  </TableCell>
                  
                  {/* Volume - Editable */}
                  <TableCell className="text-right">
                    {isEditing(item.id) ? (
                      <Input
                        type="number"
                        value={editing.master_box_volume}
                        onChange={(e) => updateEditingValue(item.id, 'master_box_volume', Number(e.target.value))}
                        className="w-20 h-6 text-xs text-right px-1"
                        min={0}
                        step={0.001}
                      />
                    ) : (
                      masterVolume?.toFixed(3) || '-'
                    )}
                  </TableCell>
                  
                  {/* Description / Specs - Editable */}
                  <TableCell className="w-48 max-w-[200px]">
                    {isEditing(item.id) ? (
                      <Textarea
                        value={editing.supplier_specs || editing.technical_description}
                        onChange={(e) => {
                          // Update both fields to keep in sync
                          updateEditingValue(item.id, 'supplier_specs', e.target.value);
                        }}
                        className="text-xs min-h-[60px] resize-none"
                        placeholder="Descrição técnica..."
                      />
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs line-clamp-2 cursor-help block">
                              {product?.supplier_specs || product?.technical_description || '-'}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-sm">
                            <p className="text-xs whitespace-pre-wrap">
                              {product?.supplier_specs || product?.technical_description || '-'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableCell>
                  
                  {/* NCM - Editable */}
                  <TableCell>
                    {isEditing(item.id) ? (
                      <Input
                        type="text"
                        value={editing.ncm}
                        onChange={(e) => updateEditingValue(item.id, 'ncm', e.target.value)}
                        className="w-24 h-6 text-xs font-mono px-1"
                        placeholder="0000.00.00"
                      />
                    ) : (
                      <span className="font-mono text-sm">{product?.ncm || '-'}</span>
                    )}
                  </TableCell>
                  
                  <TableCell className="text-right">{qtyMasterBox}</TableCell>
                  <TableCell className="text-right">{cartons.toLocaleString()}</TableCell>
                  
                  {/* Editable Quantity - CRITICAL */}
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

                  {/* Quantity Approval Checkbox */}
                  <TableCell className="text-center">
                    <Checkbox
                      checked={itemApprovals[item.id]?.qtyApproved || false}
                      onCheckedChange={(checked) => 
                        approveItemMutation.mutate({ 
                          itemId: item.id, 
                          field: 'quantity', 
                          value: checked === true 
                        })
                      }
                      disabled={approveItemMutation.isPending}
                    />
                  </TableCell>
                  
                  {/* Editable Price - CRITICAL */}
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

                  {/* Price Approval Checkbox */}
                  <TableCell className="text-center">
                    <Checkbox
                      checked={itemApprovals[item.id]?.priceApproved || false}
                      onCheckedChange={(checked) => 
                        approveItemMutation.mutate({ 
                          itemId: item.id, 
                          field: 'price', 
                          value: checked === true 
                        })
                      }
                      disabled={approveItemMutation.isPending}
                    />
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
