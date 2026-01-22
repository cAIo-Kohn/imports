import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addDays, format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface AddOrderItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderDate: string;
  onSuccess: () => void;
}

export function AddOrderItemModal({ open, onOpenChange, orderId, orderDate, onSuccess }: AddOrderItemModalProps) {
  const { toast } = useToast();
  
  const [productId, setProductId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [expectedArrival, setExpectedArrival] = useState('');
  const [productSearchOpen, setProductSearchOpen] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ['products-for-order-item'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, code, technical_description, lead_time_days, fob_price_usd, moq')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return data;
    },
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units-for-order-item'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === productId);
  }, [products, productId]);

  // Calculate expected arrival based on lead time
  const handleProductSelect = (id: string) => {
    setProductId(id);
    const product = products.find(p => p.id === id);
    if (product) {
      if (product.fob_price_usd) {
        setUnitPrice(product.fob_price_usd.toString());
      }
      if (product.lead_time_days && orderDate) {
        const arrival = addDays(new Date(orderDate), product.lead_time_days);
        setExpectedArrival(format(arrival, 'yyyy-MM-dd'));
      }
    }
    setProductSearchOpen(false);
  };

  const addItemMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('purchase_order_items')
        .insert({
          purchase_order_id: orderId,
          product_id: productId,
          unit_id: unitId,
          quantity: parseInt(quantity),
          unit_price_usd: unitPrice ? parseFloat(unitPrice) : null,
          expected_arrival: expectedArrival || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Item adicionado com sucesso!' });
      onSuccess();
      handleClose();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao adicionar item', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const handleClose = () => {
    setProductId('');
    setUnitId('');
    setQuantity('');
    setUnitPrice('');
    setExpectedArrival('');
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) {
      toast({ title: 'Selecione um produto', variant: 'destructive' });
      return;
    }
    if (!unitId) {
      toast({ title: 'Selecione a unidade de destino', variant: 'destructive' });
      return;
    }
    if (!quantity || parseInt(quantity) <= 0) {
      toast({ title: 'Informe a quantidade', variant: 'destructive' });
      return;
    }
    addItemMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Item ao Pedido</DialogTitle>
          <DialogDescription>
            Selecione o produto e informe a quantidade
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Produto *</Label>
            <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={productSearchOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedProduct 
                    ? `${selectedProduct.code} - ${selectedProduct.technical_description.slice(0, 40)}...`
                    : 'Buscar produto...'
                  }
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar por código ou descrição..." />
                  <CommandList>
                    <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                    <CommandGroup>
                      {products.map((product) => (
                        <CommandItem
                          key={product.id}
                          value={`${product.code} ${product.technical_description}`}
                          onSelect={() => handleProductSelect(product.id)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              productId === product.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">{product.code}</span>
                            <span className="text-sm text-muted-foreground truncate max-w-[300px]">
                              {product.technical_description}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedProduct && (
            <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lead Time:</span>
                <span>{selectedProduct.lead_time_days || '-'} dias</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">MOQ:</span>
                <span>{selectedProduct.moq?.toLocaleString('pt-BR') || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Preço FOB:</span>
                <span>
                  {selectedProduct.fob_price_usd 
                    ? `$${selectedProduct.fob_price_usd.toLocaleString('en-US', { minimumFractionDigits: 4 })}`
                    : '-'
                  }
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Unidade de Destino *</Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {units.map(unit => (
                  <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-price">Preço Unitário USD</Label>
              <Input
                id="unit-price"
                type="number"
                step="0.0001"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.0000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expected-arrival">Chegada Prevista</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="expected-arrival"
                type="date"
                value={expectedArrival}
                onChange={(e) => setExpectedArrival(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Calculado automaticamente com base no lead time do produto
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={addItemMutation.isPending}>
              {addItemMutation.isPending ? 'Adicionando...' : 'Adicionar Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
