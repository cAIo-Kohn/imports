import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, Package, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Product {
  id: string;
  code: string;
  technical_description: string;
  ncm: string | null;
}

interface LinkProductsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
  onSuccess: () => void;
}

export function LinkProductsModal({ open, onOpenChange, supplierId, onSuccess }: LinkProductsModalProps) {
  const [search, setSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch products without supplier
  const { data: products, isLoading } = useQuery({
    queryKey: ['unlinked-products', search],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('id, code, technical_description, ncm')
        .is('supplier_id', null)
        .order('code', { ascending: true })
        .limit(100);

      if (search) {
        query = query.or(`code.ilike.%${search}%,technical_description.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
    enabled: open,
  });

  const handleToggleProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleSelectAll = () => {
    if (!products) return;
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  const handleSubmit = async () => {
    if (selectedProducts.size === 0) {
      toast.error('Selecione pelo menos um produto');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({ supplier_id: supplierId })
        .in('id', Array.from(selectedProducts));

      if (error) throw error;

      toast.success(`${selectedProducts.size} produto(s) vinculado(s) com sucesso!`);
      setSelectedProducts(new Set());
      setSearch('');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao vincular produtos:', error);
      toast.error('Erro ao vincular produtos: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedProducts(new Set());
    setSearch('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vincular Produtos</DialogTitle>
          <DialogDescription>
            Selecione produtos sem fornecedor para vincular a este fornecedor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : products && products.length > 0 ? (
            <>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{products.length} produto(s) disponível(is)</span>
                <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                  {selectedProducts.size === products.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </Button>
              </div>
              <ScrollArea className="h-[300px] rounded-md border">
                <div className="p-4 space-y-2">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedProducts.has(product.id)
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => handleToggleProduct(product.id)}
                    >
                      <Checkbox
                        checked={selectedProducts.has(product.id)}
                        onCheckedChange={() => handleToggleProduct(product.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">{product.code}</span>
                          {product.ncm && (
                            <span className="text-xs text-muted-foreground">NCM: {product.ncm}</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {product.technical_description}
                        </p>
                      </div>
                      {selectedProducts.has(product.id) && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">Nenhum produto disponível</h3>
              <p className="text-sm text-muted-foreground">
                {search
                  ? 'Nenhum produto encontrado com esses termos'
                  : 'Todos os produtos já estão vinculados a fornecedores'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedProducts.size === 0}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Vincular {selectedProducts.size > 0 ? `(${selectedProducts.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
