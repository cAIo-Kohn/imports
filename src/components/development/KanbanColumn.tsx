import { DevelopmentCard } from './DevelopmentCard';
import { DevelopmentItem, DevelopmentItemStatus } from '@/pages/Development';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  status: DevelopmentItemStatus;
  label: string;
  colorClass: string;
  items: DevelopmentItem[];
  onCardClick: (itemId: string) => void;
  onDragStart: (e: React.DragEvent, itemId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, status: DevelopmentItemStatus) => void;
  canManage: boolean;
}

export function KanbanColumn({
  status,
  label,
  colorClass,
  items,
  onCardClick,
  onDragStart,
  onDragOver,
  onDrop,
  canManage,
}: KanbanColumnProps) {
  return (
    <div
      className={cn(
        'flex-shrink-0 w-[220px] md:w-[260px] lg:w-[280px] xl:w-[300px] rounded-lg border-2 p-2 md:p-3 flex flex-col h-fit max-h-full',
        colorClass
      )}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, status)}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="font-semibold text-sm text-foreground">{label}</h3>
        <span className="text-xs text-muted-foreground bg-background/80 px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>

      {/* Cards Container */}
      <div className="space-y-2 overflow-y-auto flex-1 min-h-[100px]">
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No items
          </div>
        ) : (
          items.map((item) => (
            <DevelopmentCard
              key={item.id}
              item={item}
              onClick={() => onCardClick(item.id)}
              onDragStart={onDragStart}
              canDrag={canManage}
            />
          ))
        )}
      </div>
    </div>
  );
}
