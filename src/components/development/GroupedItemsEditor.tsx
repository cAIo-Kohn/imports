import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, X, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

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
  created_at: string;
  created_by: string;
}

export function GroupedItemsEditor({ cardId, canEdit }: GroupedItemsEditorProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newProductCode, setNewProductCode] = useState('');
  const [newProductName, setNewProductName] = useState('');

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
              className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
            >
              <div className="flex items-center gap-3">
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
                  onClick={() => removeProductMutation.mutate(product.id)}
                  disabled={removeProductMutation.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
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
