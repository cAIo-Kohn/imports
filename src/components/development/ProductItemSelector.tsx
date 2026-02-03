import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Package, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CardProduct {
  id: string;
  card_id: string;
  product_code: string;
  product_name: string | null;
  notes: string | null;
  image_url: string | null;
  created_at: string;
  created_by: string;
}

interface ProductItemSelectorProps {
  cardId: string;
  selectedProductIds: string[];
  onSelectionChange: (productIds: string[]) => void;
  className?: string;
}

export function ProductItemSelector({
  cardId,
  selectedProductIds,
  onSelectionChange,
  className,
}: ProductItemSelectorProps) {
  // Fetch products for this card
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['development-card-products', cardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('development_card_products')
        .select('*')
        .eq('card_id', cardId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as CardProduct[];
    },
  });

  const allSelected = products.length > 0 && selectedProductIds.length === products.length;
  const someSelected = selectedProductIds.length > 0 && selectedProductIds.length < products.length;

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(products.map(p => p.id));
    }
  };

  const handleToggleProduct = (productId: string) => {
    if (selectedProductIds.includes(productId)) {
      onSelectionChange(selectedProductIds.filter(id => id !== productId));
    } else {
      onSelectionChange([...selectedProductIds, productId]);
    }
  };

  if (isLoading) {
    return (
      <div className="py-4 text-center text-muted-foreground text-sm">
        Loading items...
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="py-4 text-center text-muted-foreground text-sm">
        <Package className="h-6 w-6 mx-auto mb-2 opacity-50" />
        No items in this group
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Select All Checkbox */}
      <div className="flex items-center space-x-2 pb-2 border-b">
        <Checkbox
          id="select-all"
          checked={allSelected}
          ref={(el) => {
            if (el) {
              (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = someSelected;
            }
          }}
          onCheckedChange={handleSelectAll}
        />
        <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
          {allSelected ? 'Deselect All' : 'Select All'} ({products.length} items)
        </Label>
      </div>

      {/* Products List */}
      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {products.map((product) => (
          <div
            key={product.id}
            className={cn(
              "flex items-center gap-3 p-2 rounded-md border cursor-pointer transition-colors",
              selectedProductIds.includes(product.id)
                ? "bg-primary/5 border-primary/30"
                : "bg-muted/30 border-transparent hover:border-muted-foreground/20"
            )}
            onClick={() => handleToggleProduct(product.id)}
          >
            <Checkbox
              id={`product-${product.id}`}
              checked={selectedProductIds.includes(product.id)}
              onCheckedChange={() => handleToggleProduct(product.id)}
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* Product Image */}
            <div className="flex-shrink-0">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.product_code}
                  className="h-8 w-8 rounded object-cover border"
                />
              ) : (
                <div className="h-8 w-8 rounded border border-dashed flex items-center justify-center bg-muted">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-xs">
                  {product.product_code}
                </Badge>
                {product.product_name && (
                  <span className="text-sm truncate">{product.product_name}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Selection Summary */}
      <div className="text-xs text-muted-foreground text-center pt-2 border-t">
        {selectedProductIds.length} of {products.length} items selected
      </div>
    </div>
  );
}

// Hook to get products count for conditional rendering
export function useCardProducts(cardId: string) {
  return useQuery({
    queryKey: ['development-card-products', cardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('development_card_products')
        .select('*')
        .eq('card_id', cardId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as CardProduct[];
    },
  });
}
