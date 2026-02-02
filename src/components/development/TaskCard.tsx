import { Package, DollarSign, Clock, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import type { CardTask } from '@/hooks/useCardTasks';

interface TaskCardProps {
  task: CardTask;
  canAction: boolean;
  onFillCommercial?: () => void;
  onAddTracking?: () => void;
  onConfirmData?: () => void;
  onMarkArrived?: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  buyer: 'Buyer',
  trader: 'Trader',
  quality: 'Quality',
  marketing: 'Marketing',
};

export function TaskCard({
  task,
  canAction,
  onFillCommercial,
  onAddTracking,
  onConfirmData,
  onMarkArrived,
}: TaskCardProps) {
  const isCommercial = task.task_type === 'commercial_request';
  const isSample = task.task_type === 'sample_request';
  
  const creatorName = task.created_by_profile?.full_name || 'Unknown';
  const timeAgo = formatDistanceToNow(new Date(task.created_at), { addSuffix: true });
  
  const assignedLabel = task.assigned_to_role 
    ? ROLE_LABELS[task.assigned_to_role] || task.assigned_to_role
    : task.assigned_to_users?.length 
      ? `${task.assigned_to_users.length} user(s)`
      : 'Unassigned';

  // Determine status and action
  const metadata = task.metadata || {};
  const isDataFilled = isCommercial && metadata.fob_price_usd;
  const hasTracking = isSample && metadata.tracking_number;
  const isDelivered = isSample && metadata.actual_arrival;

  return (
    <div className={`rounded-lg border p-3 ${
      isCommercial ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' : 
      'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className={`p-1.5 rounded ${
            isCommercial ? 'bg-amber-100 dark:bg-amber-900/50' : 'bg-blue-100 dark:bg-blue-900/50'
          }`}>
            {isCommercial ? (
              <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">
                {isCommercial ? 'Commercial Data Request' : 'Sample Request'}
              </span>
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                {task.assigned_to_role ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
                {assignedLabel}
              </Badge>
              {task.status === 'in_progress' && (
                <Badge variant="secondary" className="text-xs">In Progress</Badge>
              )}
            </div>
            
            <div className="text-xs text-muted-foreground mt-1">
              {isSample && metadata.quantity && (
                <span>{metadata.quantity as number} pcs needed</span>
              )}
              {isSample && metadata.notes && (
                <span className="ml-1">• "{metadata.notes as string}"</span>
              )}
              {isCommercial && metadata.notes && (
                <span>"{metadata.notes as string}"</span>
              )}
            </div>
            
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Clock className="h-3 w-3" />
              <span>Requested by {creatorName} • {timeAgo}</span>
            </div>

            {/* Show progress info */}
            {isDataFilled && (
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                ✓ Data provided - awaiting confirmation
              </div>
            )}
            {hasTracking && !isDelivered && (
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                ✓ Shipped via {metadata.courier_name as string} - {metadata.tracking_number as string}
              </div>
            )}
            {isDelivered && (
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                ✓ Delivered - awaiting review
              </div>
            )}
          </div>
        </div>

        {canAction && (
          <div className="flex-shrink-0">
            {isCommercial && !isDataFilled && onFillCommercial && (
              <Button size="sm" onClick={onFillCommercial}>
                Fill Data
              </Button>
            )}
            {isCommercial && isDataFilled && onConfirmData && (
              <Button size="sm" variant="default" onClick={onConfirmData}>
                Confirm
              </Button>
            )}
            {isSample && !hasTracking && onAddTracking && (
              <Button size="sm" onClick={onAddTracking}>
                Add Tracking
              </Button>
            )}
            {isSample && hasTracking && !isDelivered && onMarkArrived && (
              <Button size="sm" variant="outline" onClick={onMarkArrived}>
                Mark Arrived
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
