import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Package } from 'lucide-react';

interface Product {
  id: string;
  product_code: string;
  product_name: string | null;
  image_url: string | null;
}

interface ProductSelectorProps {
  products: Product[];
  selectedIds: string[];
  selectAll: boolean;
  onSelectAll: (checked: boolean) => void;
  onToggleProduct: (productId: string) => void;
}

export function ProductSelector({
  products,
  selectedIds,
  selectAll,
  onSelectAll,
  onToggleProduct,
}: ProductSelectorProps) {
  if (products.length <= 1) return null;

  return (
    <div className="space-y-2">
      <Label className="text-sm">Select Products</Label>
      <div className="border rounded-lg overflow-hidden">
        {/* Select All Option */}
        <div 
          className="flex items-center gap-3 p-2 bg-muted/50 border-b cursor-pointer hover:bg-muted/70 transition-colors"
          onClick={() => onSelectAll(!selectAll)}
        >
          <Checkbox
            id="select-all"
            checked={selectAll}
            onCheckedChange={onSelectAll}
          />
          <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer flex-1">
            All Items ({products.length})
          </Label>
        </div>

        {/* Product List */}
        <div className="max-h-40 overflow-y-auto divide-y">
          {products.map((product) => {
            const isSelected = selectAll || selectedIds.includes(product.id);
            return (
              <div
                key={product.id}
                className="flex items-center gap-3 p-2 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => !selectAll && onToggleProduct(product.id)}
              >
                <Checkbox
                  id={`product-${product.id}`}
                  checked={isSelected}
                  disabled={selectAll}
                  onCheckedChange={() => onToggleProduct(product.id)}
                />
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.product_name || product.product_code}
                    className="w-8 h-8 rounded object-cover bg-muted"
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <Label
                  htmlFor={`product-${product.id}`}
                  className="text-xs cursor-pointer flex-1 truncate"
                >
                  {product.product_name || product.product_code}
                </Label>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
