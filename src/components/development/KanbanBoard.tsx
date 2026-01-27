import { useRef } from 'react';
import { KanbanColumn } from './KanbanColumn';
import { DevelopmentItem, DevelopmentCardStatus } from '@/pages/Development';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

interface KanbanBoardProps {
  itemsByStatus: Record<DevelopmentCardStatus, DevelopmentItem[]>;
  statusOrder: DevelopmentCardStatus[];
  isLoading: boolean;
  onCardClick: (itemId: string) => void;
  onStatusChange: (itemId: string, newStatus: DevelopmentCardStatus) => void;
  canManage: boolean;
}

const STATUS_LABELS: Record<DevelopmentCardStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  waiting: 'Waiting',
  solved: 'Solved',
};

const STATUS_COLORS: Record<DevelopmentCardStatus, string> = {
  pending: 'bg-slate-100 border-slate-300',
  in_progress: 'bg-blue-50 border-blue-300',
  waiting: 'bg-amber-50 border-amber-300',
  solved: 'bg-green-50 border-green-300',
};

export function KanbanBoard({
  itemsByStatus,
  statusOrder,
  isLoading,
  onCardClick,
  onStatusChange,
  canManage,
}: KanbanBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);

  if (isLoading) {
    return (
      <div className="flex gap-4 p-6 h-full overflow-x-auto">
        {statusOrder.slice(0, 3).map((status) => (
          <div key={status} className="flex-shrink-0 w-[300px]">
            <Skeleton className="h-8 w-32 mb-4" />
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData('itemId', itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetStatus: DevelopmentCardStatus) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('itemId');
    if (itemId && canManage) {
      onStatusChange(itemId, targetStatus);
    }
  };

  return (
    <ScrollArea className="h-full w-full min-w-0">
      <div
        ref={boardRef}
        className="flex w-max gap-2 md:gap-3 lg:gap-4 p-4 md:p-6 min-h-full"
      >
        {statusOrder.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            label={STATUS_LABELS[status]}
            colorClass={STATUS_COLORS[status]}
            items={itemsByStatus[status] || []}
            onCardClick={onCardClick}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            canManage={canManage}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
