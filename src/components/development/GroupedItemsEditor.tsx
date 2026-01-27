import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, X, Package, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { ImageUpload } from './ImageUpload';

interface GroupedItemsEditorProps {
  cardId: string;
  canEdit: boolean;
}

interface CardProduct {
  id: string;
  card_id: string;
  product_code: string;
  product_name: string | null;
  notes: string | null;
  image_url: string | null;
  created_at: string;
  created_by: string;
}

export function GroupedItemsEditor({ cardId, canEdit }: GroupedItemsEditorProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newProductCode, setNewProductCode] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

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

  const addProductMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !newProductCode.trim()) return;
      
      const { error } = await supabase.from('development_card_products').insert({
        card_id: cardId,
        product_code: newProductCode.trim(),
        product_name: newProductName.trim() || null,
        created_by: user.id,
      });
      if (error) throw error;

      // Log the activity
      await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'product_added',
        content: `Added product ${newProductCode.trim()}`,
        metadata: { product_code: newProductCode.trim() },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-card-products', cardId] });
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      setNewProductCode('');
      setNewProductName('');
      toast({ title: 'Product added' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add product', variant: 'destructive' });
    },
  });

  const removeProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from('development_card_products')
        .delete()
        .eq('id', productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-card-products', cardId] });
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      toast({ title: 'Product removed' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to remove product', variant: 'destructive' });
    },
  });

  const updateProductImageMutation = useMutation({
    mutationFn: async ({ productId, imageUrl }: { productId: string; imageUrl: string | null }) => {
      const { error } = await (supabase
        .from('development_card_products') as any)
        .update({ image_url: imageUrl })
        .eq('id', productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-card-products', cardId] });
      toast({ title: 'Image updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update image', variant: 'destructive' });
    },
  });

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductCode.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Product code is required',
        variant: 'destructive',
      });
      return;
    }
    addProductMutation.mutate();
  };

  if (isLoading) {
    return <p className="text-center text-muted-foreground py-4">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      {/* Add Product Form */}
      {canEdit && (
        <form onSubmit={handleAddProduct} className="flex gap-2">
          <Input
            placeholder="Product Code"
            value={newProductCode}
            onChange={(e) => setNewProductCode(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Name (optional)"
            value={newProductName}
            onChange={(e) => setNewProductName(e.target.value)}
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={addProductMutation.isPending}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      )}

      {/* Products List */}
      {products.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No products in this group</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((product) => (
            <div
              key={product.id}
              className="rounded-lg border bg-muted/30 overflow-hidden"
            >
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
                onClick={() => setExpandedProductId(expandedProductId === product.id ? null : product.id)}
              >
                <div className="flex items-center gap-3">
                  {/* Image indicator */}
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
                  <Badge variant="secondary" className="font-mono">
                    {product.product_code}
                  </Badge>
                  {product.product_name && (
                    <span className="text-sm">{product.product_name}</span>
                  )}
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeProductMutation.mutate(product.id);
                    }}
                    disabled={removeProductMutation.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              {/* Expanded section for image upload */}
              {expandedProductId === product.id && canEdit && (
                <div className="px-3 pb-3 border-t bg-background">
                  <div className="pt-3">
                    <p className="text-xs text-muted-foreground mb-2">Product Image</p>
                    <ImageUpload
                      value={product.image_url}
                      onChange={(url) => updateProductImageMutation.mutate({ productId: product.id, imageUrl: url })}
                      folder={`products/${cardId}`}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        {products.length} product{products.length !== 1 ? 's' : ''} in this group
      </p>
    </div>
  );
}
