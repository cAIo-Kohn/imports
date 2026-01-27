import { format } from 'date-fns';
import { Calendar, Package, User } from 'lucide-react';
import { DevelopmentItem, DevelopmentItemPriority } from '@/pages/Development';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DevelopmentCardProps {
  item: DevelopmentItem;
  onClick: () => void;
  onDragStart: (e: React.DragEvent, itemId: string) => void;
  canDrag: boolean;
}

const PRIORITY_STYLES: Record<DevelopmentItemPriority, string> = {
  urgent: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-white',
  low: 'bg-slate-400 text-white',
};

const PRIORITY_LABELS: Record<DevelopmentItemPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function DevelopmentCard({
  item,
  onClick,
  onDragStart,
  canDrag,
}: DevelopmentCardProps) {
  return (
    <div
      className={cn(
        'bg-background rounded-md border shadow-sm p-3 cursor-pointer transition-all',
        'hover:shadow-md hover:border-primary/50',
        canDrag && 'cursor-grab active:cursor-grabbing'
      )}
      onClick={onClick}
      draggable={canDrag}
      onDragStart={(e) => onDragStart(e, item.id)}
    >
      {/* Priority & Title */}
      <div className="flex items-start gap-2 mb-2">
        <Badge
          className={cn('text-[10px] px-1.5 py-0', PRIORITY_STYLES[item.priority])}
        >
          {PRIORITY_LABELS[item.priority]}
        </Badge>
      </div>
      <h4 className="font-medium text-sm mb-2 line-clamp-2">{item.title}</h4>

      {/* Supplier */}
      {item.supplier && (
        <p className="text-xs text-muted-foreground mb-2 truncate">
          {item.supplier.company_name}
        </p>
      )}

      {/* Footer Info */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {/* Sample Count */}
        {item.samples_count !== undefined && item.samples_count > 0 && (
          <div className="flex items-center gap-1">
            <Package className="h-3 w-3" />
            <span>{item.samples_count}</span>
          </div>
        )}

        {/* Due Date */}
        {item.due_date && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(item.due_date), 'dd/MM')}</span>
          </div>
        )}

        {/* Product Code */}
        {item.product_code && (
          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
            {item.product_code}
          </span>
        )}
      </div>
    </div>
  );
}
