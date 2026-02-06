import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { CheckCircle2, ExternalLink, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface EligibleProduct {
  id: string;
  title: string;
  card_type: string | null;
  image_url: string | null;
  sample_approved_at: string;
  supplier_name: string | null;
  product_code: string | null;
}

export default function NewProducts() {
  const navigate = useNavigate();

  const { data: eligibleProducts = [], isLoading } = useQuery({
    queryKey: ['eligible-products'],
    queryFn: async () => {
      // Query cards with approved samples
      const { data: samples, error: samplesError } = await supabase
        .from('development_item_samples')
        .select(`
          id,
          decided_at,
          item_id,
          development_items!inner (
            id,
            title,
            card_type,
            image_url,
            product_code,
            deleted_at,
            supplier_id
          )
        `)
        .eq('decision', 'approved')
        .order('decided_at', { ascending: false });

      if (samplesError) throw samplesError;
      if (!samples || samples.length === 0) return [];

      // Get unique cards (a card may have multiple approved samples)
      const cardMap = new Map<string, EligibleProduct>();
      const supplierIds = new Set<string>();

      for (const sample of samples) {
        const card = sample.development_items as any;
        if (!card || card.deleted_at) continue;

        if (!cardMap.has(card.id)) {
          cardMap.set(card.id, {
            id: card.id,
            title: card.title,
            card_type: card.card_type,
            image_url: card.image_url,
            product_code: card.product_code,
            sample_approved_at: sample.decided_at,
            supplier_name: null,
          });
          if (card.supplier_id) supplierIds.add(card.supplier_id);
        }
      }

      // Fetch supplier names
      if (supplierIds.size > 0) {
        const { data: suppliers } = await supabase
          .from('suppliers')
          .select('id, company_name')
          .in('id', Array.from(supplierIds));

        if (suppliers) {
          const supplierMap = new Map(suppliers.map(s => [s.id, s.company_name]));
          // Update supplier names in card data
          for (const sample of samples) {
            const card = sample.development_items as any;
            if (card && !card.deleted_at && cardMap.has(card.id) && card.supplier_id) {
              const product = cardMap.get(card.id)!;
              product.supplier_name = supplierMap.get(card.supplier_id) || null;
            }
          }
        }
      }

      return Array.from(cardMap.values());
    },
  });

  const handleOpenCard = (cardId: string) => {
    // Navigate to development page with card ID to open the slideout
    navigate(`/development?card=${cardId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">New Products</h1>
        <p className="text-muted-foreground">Products ready for catalog integration</p>
      </div>

      {/* Eligible Products Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-lg font-semibold">Eligible Products</h2>
          <Badge variant="secondary" className="ml-1">
            {eligibleProducts.length}
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : eligibleProducts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-lg mb-1">No eligible products yet</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Products will appear here once their samples have been approved in the
                development workflow.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {eligibleProducts.map((product) => (
              <Card 
                key={product.id} 
                className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleOpenCard(product.id)}
              >
                {/* Image */}
                <div className="aspect-square bg-muted relative">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-16 w-16 text-muted-foreground/30" />
                    </div>
                  )}
                  {/* Approved badge */}
                  <Badge 
                    className="absolute top-2 right-2 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Approved
                  </Badge>
                </div>

                <CardContent className="p-4 space-y-2">
                  {/* Title */}
                  <h3 className="font-medium line-clamp-2">{product.title}</h3>

                  {/* Product code */}
                  {product.product_code && (
                    <p className="text-xs text-muted-foreground font-mono">
                      {product.product_code}
                    </p>
                  )}

                  {/* Supplier */}
                  {product.supplier_name && (
                    <p className="text-sm text-muted-foreground truncate">
                      {product.supplier_name}
                    </p>
                  )}

                  {/* Approval date */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      Approved {format(new Date(product.sample_approved_at), 'dd/MM/yy')}
                    </span>
                    <Button variant="ghost" size="sm" className="h-7 px-2">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
