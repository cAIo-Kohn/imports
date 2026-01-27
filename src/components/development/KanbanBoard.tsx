import { useRef } from 'react';
import { KanbanColumn } from './KanbanColumn';
import { DevelopmentItem, DevelopmentItemStatus } from '@/pages/Development';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

interface KanbanBoardProps {
  itemsByStatus: Record<DevelopmentItemStatus, DevelopmentItem[]>;
  statusOrder: DevelopmentItemStatus[];
  isLoading: boolean;
  onCardClick: (itemId: string) => void;
  onStatusChange: (itemId: string, newStatus: DevelopmentItemStatus) => void;
  canManage: boolean;
}

const STATUS_LABELS: Record<DevelopmentItemStatus, string> = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  waiting_supplier: 'Waiting Supplier',
  sample_requested: 'Sample Requested',
  sample_in_transit: 'Sample In Transit',
  sample_received: 'Sample Received',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

const STATUS_COLORS: Record<DevelopmentItemStatus, string> = {
  backlog: 'bg-slate-100 border-slate-300',
  in_progress: 'bg-blue-50 border-blue-300',
  waiting_supplier: 'bg-amber-50 border-amber-300',
  sample_requested: 'bg-purple-50 border-purple-300',
  sample_in_transit: 'bg-cyan-50 border-cyan-300',
  sample_received: 'bg-teal-50 border-teal-300',
  under_review: 'bg-orange-50 border-orange-300',
  approved: 'bg-green-50 border-green-300',
  rejected: 'bg-red-50 border-red-300',
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
        {statusOrder.slice(0, 5).map((status) => (
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

  const handleDrop = (e: React.DragEvent, targetStatus: DevelopmentItemStatus) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('itemId');
    if (itemId && canManage) {
      onStatusChange(itemId, targetStatus);
    }
  };

  return (
    <ScrollArea className="h-full">
      <div
        ref={boardRef}
        className="flex gap-2 md:gap-3 lg:gap-4 p-4 md:p-6 min-h-full"
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
