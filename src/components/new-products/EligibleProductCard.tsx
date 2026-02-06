import { format } from 'date-fns';
import { ArrowRight, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNewProductFlow } from '@/hooks/useNewProductFlow';

interface EligibleProductCardProps {
  item: {
    id: string;
    title: string;
    card_type: string;
    image_url: string | null;
    product_code: string | null;
    sample_approved_at: string;
  };
  onOpenCard: (cardId: string) => void;
}

export function EligibleProductCard({ item, onOpenCard }: EligibleProductCardProps) {
  const { startFlow, startFlowPending } = useNewProductFlow();

  const handleStartFlow = (e: React.MouseEvent) => {
    e.stopPropagation();
    startFlow(item.id);
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onOpenCard(item.id)}
    >
      <CardContent className="p-4">
        <div className="flex gap-3">
          {/* Image */}
          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="h-6 w-6 text-muted-foreground" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{item.title}</h4>
            
            <div className="flex items-center gap-2 mt-1">
              {item.product_code && (
                <Badge variant="secondary" className="text-[10px]">
                  {item.product_code}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Approved {format(new Date(item.sample_approved_at), 'dd/MM/yy')}
              </span>
            </div>

            {/* Start Flow Button */}
            <Button
              size="sm"
              className="mt-2 h-7 text-xs"
              onClick={handleStartFlow}
              disabled={startFlowPending}
            >
              {startFlowPending ? 'Starting...' : 'Create New Product'}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
