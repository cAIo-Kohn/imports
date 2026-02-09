import { Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface WorkflowItem {
  id: string;
  title: string;
  image_url: string | null;
  product_code: string | null;
}

interface WorkflowStepSectionProps {
  title: string;
  subtitle: string;
  responsibleRole: string;
  items: WorkflowItem[];
  onOpenCard: (cardId: string) => void;
  colorScheme: 'green' | 'blue' | 'amber' | 'emerald';
  icon: React.ReactNode;
}

const COLOR_SCHEMES = {
  green: 'border-green-200 bg-green-50/30 dark:bg-green-950/20',
  blue: 'border-blue-200 bg-blue-50/30 dark:bg-blue-950/20',
  amber: 'border-amber-200 bg-amber-50/30 dark:bg-amber-950/20',
  emerald: 'border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/20',
};

export function WorkflowStepSection({
  title,
  subtitle,
  responsibleRole,
  items,
  onOpenCard,
  colorScheme,
  icon,
}: WorkflowStepSectionProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn("rounded-lg border p-4", COLOR_SCHEMES[colorScheme])}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h3 className="font-semibold text-sm">{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] capitalize">
            {responsibleRole}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {items.length}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map(item => (
          <Card
            key={item.id}
            className="cursor-pointer hover:shadow-sm transition-shadow"
            onClick={() => onOpenCard(item.id)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.title}</p>
                  {item.product_code && (
                    <p className="text-[10px] text-muted-foreground">{item.product_code}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
