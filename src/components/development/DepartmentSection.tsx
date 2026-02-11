import React from 'react';
import { DevelopmentItem } from '@/pages/Development';
import { DevelopmentCard } from './DevelopmentCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface DepartmentSectionProps {
  title: string;
  role: string;
  items: DevelopmentItem[];
  colorClass: string;
  onCardClick: (itemId: string) => void;
  onDragStart: (e: React.DragEvent, itemId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  canManage: boolean;
}

const ROLE_COLORS: Record<string, string> = {
  buyer: 'border-blue-300 bg-blue-50/30 dark:bg-blue-950/20',
  quality: 'border-green-300 bg-green-50/30 dark:bg-green-950/20',
  trader: 'border-amber-300 bg-amber-50/30 dark:bg-amber-950/20',
  marketing: 'border-purple-300 bg-purple-50/30 dark:bg-purple-950/20',
  admin: 'border-slate-300 bg-slate-50/30 dark:bg-slate-950/20',
};

const ROLE_LABELS: Record<string, string> = {
  buyer: '🛒 Comex',
  quality: '✅ Quality',
  trader: '🌏 ARC',
  marketing: '📢 Marketing',
  admin: '⚙️ Admin',
};

export const DepartmentSection = React.memo(function DepartmentSection({
  title,
  role,
  items,
  colorClass,
  onCardClick,
  onDragStart,
  onDragOver,
  onDrop,
  canManage,
}: DepartmentSectionProps) {
  const color = ROLE_COLORS[role] || ROLE_COLORS.admin;
  const label = ROLE_LABELS[role] || title;

  // Sort items: urgent first, then by priority order, then by created_at (oldest first)
  const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sortedItems = [...items].sort((a, b) => {
    // First sort by priority
    const priorityA = PRIORITY_ORDER[a.priority] ?? 4;
    const priorityB = PRIORITY_ORDER[b.priority] ?? 4;
    if (priorityA !== priorityB) return priorityA - priorityB;
    
    // Then by created_at (oldest first = ascending)
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  if (sortedItems.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-lg border-2 p-3 min-h-[120px]",
        color
      )}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">
          {label}
        </h3>
        <span className="text-xs text-muted-foreground bg-background/80 px-2 py-0.5 rounded-full">
          {sortedItems.length} card{sortedItems.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {sortedItems.map((item) => (
          <DevelopmentCard
            key={item.id}
            item={item}
            onClick={() => onCardClick(item.id)}
            onDragStart={(e) => onDragStart(e, item.id)}
            canDrag={canManage}
          />
        ))}
      </div>
    </div>
  );
});
