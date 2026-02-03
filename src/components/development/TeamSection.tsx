import { memo } from 'react';
import { DevelopmentItem } from '@/pages/Development';
import { DevelopmentCard } from './DevelopmentCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TeamSectionProps {
  title: string;
  subtitle: string;
  items: DevelopmentItem[];
  colorClass: string;
  flagEmoji: string;
  onCardClick: (itemId: string) => void;
  onCardClickThread?: (itemId: string, threadId: string) => void;
  onDragStart: (e: React.DragEvent, itemId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  canManage: boolean;
}

function TeamSectionComponent({
  title,
  subtitle,
  items,
  colorClass,
  flagEmoji,
  onCardClick,
  onCardClickThread,
  onDragStart,
  onDragOver,
  onDrop,
  canManage,
}: TeamSectionProps) {
  return (
    <div
      className={cn(
        'flex flex-col flex-1 min-w-[300px] max-w-none rounded-lg border-2',
        colorClass
      )}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Header */}
      <div className="p-3 md:p-4 border-b bg-background/50">
        <div className="flex items-center gap-2">
          <span className="text-xl">{flagEmoji}</span>
          <h2 className="font-semibold text-lg">{title}</h2>
          <Badge variant="secondary" className="ml-auto">
            {items.length}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 md:p-3 space-y-2">
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No cards here</p>
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
      </ScrollArea>
    </div>
  );
}

// Memoized TeamSection to prevent unnecessary re-renders
export const TeamSection = memo(TeamSectionComponent);
