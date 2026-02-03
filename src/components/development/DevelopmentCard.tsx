import { memo, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { Calendar, Package, Layers, ListTodo, Box, Leaf, Trash2, HelpCircle, MessageCircle, Reply, AlertCircle } from 'lucide-react';
import { DevelopmentItem, DevelopmentItemPriority, DevelopmentCardType, DevelopmentProductCategory } from '@/pages/Development';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks/useUserRole';
import { useRoleColors } from '@/hooks/useRoleColors';
import { PendingActionIndicator, ActionDueDate } from './PendingActionBadge';

interface DevelopmentCardProps {
  item: DevelopmentItem;
  onClick: () => void;
  onClickThread?: (threadId: string) => void;
  onDragStart: (e: React.DragEvent, itemId: string) => void;
  canDrag: boolean;
}

// Priority border styles - color and animation class
const PRIORITY_BORDER_STYLES: Record<DevelopmentItemPriority, { color: string; animation: string }> = {
  low: { color: '#60A5FA', animation: '' },
  medium: { color: '#FACC15', animation: '' },
  high: { color: '#F87171', animation: 'animate-pulse-border-red' },
  urgent: { color: '#A855F7', animation: 'animate-pulse-border-purple' },
};

// Badge configuration for card types
const CARD_TYPE_BADGE_CONFIG: Record<DevelopmentCardType, { label: string; icon: React.ReactNode; className: string }> = {
  item: { label: 'Product', icon: <Box className="h-3 w-3" />, className: 'bg-blue-100 text-blue-700 border-blue-200' },
  item_group: { label: 'Group', icon: <Layers className="h-3 w-3" />, className: 'bg-purple-100 text-purple-700 border-purple-200' },
  task: { label: 'Task', icon: <ListTodo className="h-3 w-3" />, className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

// Raw material badge (overrides item badge when product_category is raw_material)
const RAW_MATERIAL_BADGE = { label: 'Raw', icon: <Leaf className="h-3 w-3" />, className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };

function DevelopmentCardComponent({
  item,
  onClick,
  onClickThread,
  onDragStart,
  canDrag,
}: DevelopmentCardProps) {
  const { isBuyer, isTrader } = useUserRole();
  const { getColorForRole } = useRoleColors();
  const cardType = item.card_type || 'item';
  
  // Get creator role color
  const creatorRole = item.created_by_role;
  const { color: roleColor, label: roleLabel } = getColorForRole(creatorRole);
  
  // Check if this card is deleted
  const isDeleted = !!item.deleted_at;
  
  // Check if current user is assigned (for "Your Turn" indicator)
  const { user } = useAuth();
  const { roles: userRoles } = useUserRole();
  const isMyTurn = useMemo(() => {
    if (!user?.id) return false;
    // Card-level assignment
    if (item.assigned_to_users?.includes(user.id)) return true;
    if (item.assigned_to_role && userRoles.includes(item.assigned_to_role as any)) return true;
    // Thread-level pending
    if (item.pending_threads_count && item.pending_threads_count > 0) return true;
    return false;
  }, [user?.id, item.assigned_to_users, item.assigned_to_role, item.pending_threads_count, userRoles]);

  // Check if there's unseen activity for this user
  const hasUnseenActivity = useMemo(() => {
    const latestActivity = item.latest_activity_at;
    const lastViewed = item.last_viewed_at;
    
    if (!latestActivity) return false;
    if (!lastViewed) return true; // Never viewed = unseen
    
    return new Date(latestActivity) > new Date(lastViewed);
  }, [item.latest_activity_at, item.last_viewed_at]);

  // Get unread count for notification badge
  const unreadCount = item.unread_count || 0;

  // Determine the highlight class - deleted cards are faded, "my turn" cards are highlighted
  const highlightClass = isDeleted
    ? 'opacity-60 border-destructive'
    : isMyTurn
      ? 'ring-2 ring-amber-400 ring-offset-1'
      : '';
  
  // Get priority border style
  const priorityStyle = PRIORITY_BORDER_STYLES[item.priority];
  
  // Convert hex to rgba for subtle background
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  
  // Determine which badge to show based on card type and product category
  const getBadgeConfig = () => {
    if (cardType === 'task') return CARD_TYPE_BADGE_CONFIG.task;
    if (cardType === 'item_group') return CARD_TYPE_BADGE_CONFIG.item_group;
    // For individual items, check if it's raw material
    if (item.product_category === 'raw_material') return RAW_MATERIAL_BADGE;
    return CARD_TYPE_BADGE_CONFIG.item; // Default to "Product"
  };
  
  const badgeConfig = getBadgeConfig();

  return (
    <div
      className={cn(
        'relative rounded-md border shadow-sm p-2 md:p-3 cursor-pointer transition-all',
        'hover:shadow-md',
        canDrag && 'cursor-grab active:cursor-grabbing',
        highlightClass,
        priorityStyle.animation
      )}
      style={{
        backgroundColor: creatorRole ? hexToRgba(roleColor, 0.08) : undefined,
        borderLeftWidth: '4px',
        borderLeftColor: priorityStyle.color,
      }}
      onClick={onClick}
      draggable={canDrag}
      onDragStart={(e) => onDragStart(e, item.id)}
    >
      {/* Unread notification badge - WhatsApp style */}
      {unreadCount > 0 && (
        <div className="absolute -top-1.5 -right-1.5 z-10 flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold shadow-md">
          {unreadCount > 99 ? '99+' : unreadCount}
        </div>
      )}

      {/* Indicators - both can show independently */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        {/* Pending threads count indicator with tooltip */}
        {item.pending_threads_count && item.pending_threads_count > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative flex items-center justify-center h-5 w-5 rounded-full bg-amber-500 text-white text-[10px] font-bold animate-pulse cursor-help">
                  {item.pending_threads_count}
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[220px] p-2">
                <p className="font-medium text-xs mb-1.5">Pending threads:</p>
                <ul className="text-xs space-y-1.5">
                  {(item.pending_threads_info || []).slice(0, 5).map((thread, i) => (
                    <li 
                      key={thread.id || i} 
                      className="flex items-center gap-1.5 cursor-pointer hover:text-primary transition-colors group/item"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClickThread?.(thread.id);
                      }}
                    >
                      {thread.type === 'question' && <HelpCircle className="h-3 w-3 text-purple-500 flex-shrink-0" />}
                      {thread.type === 'sample_requested' && <Package className="h-3 w-3 text-cyan-500 flex-shrink-0" />}
                      {thread.type === 'answer' && <Reply className="h-3 w-3 text-green-500 flex-shrink-0" />}
                      {thread.type === 'comment' && <MessageCircle className="h-3 w-3 text-blue-500 flex-shrink-0" />}
                      {!['question', 'sample_requested', 'answer', 'comment'].includes(thread.type) && <MessageCircle className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                      <span className="truncate group-hover/item:underline">{thread.title}</span>
                    </li>
                  ))}
                  {(item.pending_threads_info || []).length > 5 && (
                    <li className="text-muted-foreground">+{item.pending_threads_info!.length - 5} more</li>
                  )}
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {/* Unseen activity indicator - only show when no unread badge is visible */}
        {hasUnseenActivity && !item.pending_threads_count && unreadCount === 0 && (
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
          </span>
        )}
        {/* Pending action indicator - shown independently */}
        {item.pending_action_type && !item.pending_threads_count && (
          <PendingActionIndicator
            pendingActionType={item.pending_action_type}
            pendingActionDueAt={item.pending_action_due_at || null}
            snoozedUntil={item.pending_action_snoozed_until || null}
          />
        )}
      </div>
      {/* Creator Name Label */}
      {item.creator_name && (
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px] font-medium" style={{ color: roleColor }}>{item.creator_name}</span>
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
        {isMyTurn && (
          <Badge
            className="text-[10px] px-1.5 py-0 bg-amber-500 text-white animate-pulse flex items-center gap-1"
          >
            <AlertCircle className="h-3 w-3" />
            Your Turn
          </Badge>
        )}
        {/* Simplified type/category badge */}
        <Badge
          variant="outline"
          className={cn('text-[10px] px-1.5 py-0 flex items-center gap-1', badgeConfig.className)}
        >
          {badgeConfig.icon}
          {badgeConfig.label}
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

        {/* Pending Action Due Date (if different from card due date) */}
        {item.pending_action_type && (item.pending_action_due_at || item.pending_action_snoozed_until) && (
          <ActionDueDate
            pendingActionDueAt={item.pending_action_due_at || null}
            snoozedUntil={item.pending_action_snoozed_until || null}
          />
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

// Memoized DevelopmentCard to prevent unnecessary re-renders
export const DevelopmentCard = memo(DevelopmentCardComponent, (prev, next) => {
  return (
    prev.item.id === next.item.id &&
    prev.item.updated_at === next.item.updated_at &&
    prev.item.latest_activity_at === next.item.latest_activity_at &&
    prev.item.last_viewed_at === next.item.last_viewed_at &&
    prev.item.pending_action_type === next.item.pending_action_type &&
    prev.item.pending_action_snoozed_until === next.item.pending_action_snoozed_until &&
    prev.item.pending_threads_count === next.item.pending_threads_count &&
    prev.item.unread_count === next.item.unread_count &&
    JSON.stringify(prev.item.pending_threads_info) === JSON.stringify(next.item.pending_threads_info) &&
    prev.canDrag === next.canDrag &&
    prev.onClickThread === next.onClickThread
  );
});
