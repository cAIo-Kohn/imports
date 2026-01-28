import { useMemo } from 'react';
import { format } from 'date-fns';
import { Calendar, Package, Layers, ListTodo, Box, Leaf, Sparkles, Trash2 } from 'lucide-react';
import { DevelopmentItem, DevelopmentItemPriority, DevelopmentCardType, DevelopmentProductCategory } from '@/pages/Development';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks/useUserRole';
import { useRoleColors } from '@/hooks/useRoleColors';

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

const CARD_TYPE_ICONS: Record<DevelopmentCardType, React.ReactNode> = {
  item: <Package className="h-3 w-3" />,
  item_group: <Layers className="h-3 w-3" />,
  task: <ListTodo className="h-3 w-3" />,
};

const CARD_TYPE_LABELS: Record<DevelopmentCardType, string> = {
  item: 'Item',
  item_group: 'Group',
  task: 'Task',
};

const PRODUCT_CATEGORY_CONFIG: Record<DevelopmentProductCategory, { label: string; icon: React.ReactNode; className: string }> = {
  final_product: { label: 'Final', icon: <Box className="h-3 w-3" />, className: 'bg-blue-100 text-blue-700 border-blue-200' },
  raw_material: { label: 'Raw', icon: <Leaf className="h-3 w-3" />, className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

export function DevelopmentCard({
  item,
  onClick,
  onDragStart,
  canDrag,
}: DevelopmentCardProps) {
  const { isBuyer, isTrader } = useUserRole();
  const { getColorForRole } = useRoleColors();
  const cardType = item.card_type || 'item';
  
  // Get creator role color
  const creatorRole = (item as any).created_by_role;
  const { color: roleColor, label: roleLabel } = getColorForRole(creatorRole);
  
  // Check if this card is "new" for the current user (cross-team notification)
  const itemWithNewFields = item as any;
  const isNewForMe = itemWithNewFields.is_new_for_other_team && (
    (isBuyer && itemWithNewFields.created_by_role === 'trader') ||
    (isTrader && itemWithNewFields.created_by_role === 'buyer')
  );

  // Check if this card is deleted
  const isDeleted = !!(item as any).deleted_at;

  // Check if there's unseen activity for this user
  const hasUnseenActivity = useMemo(() => {
    const latestActivity = item.latest_activity_at;
    const lastViewed = item.last_viewed_at;
    
    if (!latestActivity) return false;
    if (!lastViewed) return true; // Never viewed = unseen
    
    return new Date(latestActivity) > new Date(lastViewed);
  }, [item.latest_activity_at, item.last_viewed_at]);

  // Determine the highlight color based on who created it
  const highlightClass = isNewForMe
    ? itemWithNewFields.created_by_role === 'buyer'
      ? 'ring-2 ring-blue-400 ring-offset-1'
      : 'ring-2 ring-emerald-400 ring-offset-1'
    : isDeleted
      ? 'opacity-60 border-destructive'
      : '';
  
  // Convert hex to rgba for subtle background
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <div
      className={cn(
        'relative rounded-md border shadow-sm p-2 md:p-3 cursor-pointer transition-all',
        'hover:shadow-md',
        canDrag && 'cursor-grab active:cursor-grabbing',
        highlightClass
      )}
      style={{
        backgroundColor: creatorRole ? hexToRgba(roleColor, 0.08) : undefined,
        borderLeftWidth: creatorRole ? '3px' : undefined,
        borderLeftColor: creatorRole ? roleColor : undefined,
      }}
      onClick={onClick}
      draggable={canDrag}
      onDragStart={(e) => onDragStart(e, item.id)}
    >
      {/* Unseen Activity Indicator */}
      {hasUnseenActivity && (
        <div className="absolute top-2 right-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
          </span>
        </div>
      )}
      {/* Creator Name Label */}
      {(item as any).creator_name && (
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px] font-medium" style={{ color: roleColor }}>{(item as any).creator_name}</span>
        </div>
      )}

      {/* Card Type, Product Category & Priority */}
      <div className="flex items-center gap-1.5 mb-1 md:mb-2 flex-wrap">
        {isDeleted && (
          <Badge
            variant="destructive"
            className="text-[10px] px-1.5 py-0 flex items-center gap-1"
          >
            <Trash2 className="h-3 w-3" />
            Deleted
          </Badge>
        )}
        {isNewForMe && (
          <Badge
            className="text-[10px] px-1.5 py-0 bg-gradient-to-r from-purple-500 to-pink-500 text-white animate-pulse flex items-center gap-1"
          >
            <Sparkles className="h-3 w-3" />
            NEW
          </Badge>
        )}
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 flex items-center gap-1"
        >
          {CARD_TYPE_ICONS[cardType]}
          {CARD_TYPE_LABELS[cardType]}
        </Badge>
        {item.product_category && cardType !== 'task' && (
          <Badge
            variant="outline"
            className={cn('text-[10px] px-1.5 py-0 flex items-center gap-1', PRODUCT_CATEGORY_CONFIG[item.product_category].className)}
          >
            {PRODUCT_CATEGORY_CONFIG[item.product_category].icon}
            {PRODUCT_CATEGORY_CONFIG[item.product_category].label}
          </Badge>
        )}
        <Badge
          className={cn('text-[10px] px-1.5 py-0', PRIORITY_STYLES[item.priority])}
        >
          {PRIORITY_LABELS[item.priority]}
        </Badge>
      </div>
      
      {/* Title */}
      <h4 className="font-medium text-xs md:text-sm mb-1 md:mb-2 line-clamp-2">{item.title}</h4>

      {/* Supplier */}
      {item.supplier && (
        <p className="text-xs text-muted-foreground mb-2 truncate">
          {item.supplier.company_name}
        </p>
      )}

      {/* Footer Info */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        {/* Sample Count */}
        {item.samples_count !== undefined && item.samples_count > 0 && (
          <div className="flex items-center gap-1">
            <Package className="h-3 w-3" />
            <span>{item.samples_count} sample{item.samples_count > 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Product Count for Groups */}
        {cardType === 'item_group' && item.products_count !== undefined && item.products_count > 0 && (
          <div className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            <span>{item.products_count} item{item.products_count > 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Due Date */}
        {item.due_date && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(item.due_date), 'dd/MM')}</span>
          </div>
        )}

        {/* Product Code (for single items) */}
        {cardType === 'item' && item.product_code && (
          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
            {item.product_code}
          </span>
        )}
      </div>
    </div>
  );
}
