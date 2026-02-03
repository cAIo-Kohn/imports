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
  onReviewSample?: () => void;
  onReviewCommercial?: () => void;
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
  onReviewSample,
  onReviewCommercial,
}: TaskCardProps) {
  const isCommercial = task.task_type === 'commercial_request';
  const isCommercialReview = task.task_type === 'commercial_review';
  const isSample = task.task_type === 'sample_request';
  const isSampleReview = task.task_type === 'sample_review';
  
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
  const needsResend = isSample && metadata.needs_resend;
  const needsRevision = isCommercial && metadata.needs_revision;

  // Determine background color based on task type
  const getBgClass = () => {
    if (isCommercial || isCommercialReview) return 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800';
    if (isSampleReview) return 'bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800';
    return 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800';
  };

  // Determine icon background color
  const getIconBgClass = () => {
    if (isCommercial || isCommercialReview) return 'bg-amber-100 dark:bg-amber-900/50';
    if (isSampleReview) return 'bg-purple-100 dark:bg-purple-900/50';
    return 'bg-blue-100 dark:bg-blue-900/50';
  };

  // Determine icon color
  const getIconColorClass = () => {
    if (isCommercial || isCommercialReview) return 'text-amber-600 dark:text-amber-400';
    if (isSampleReview) return 'text-purple-600 dark:text-purple-400';
    return 'text-blue-600 dark:text-blue-400';
  };

  // Get task title
  const getTaskTitle = () => {
    if (isCommercialReview) return 'Review Commercial Data';
    if (isCommercial) return needsRevision ? 'Commercial Data Revision' : 'Commercial Data Request';
    if (isSampleReview) return 'Sample Review';
    if (isSample) return needsResend ? 'New Sample Needed' : 'Sample Request';
    return 'Task';
  };

  return (
    <div className={`rounded-lg border p-3 ${getBgClass()}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className={`p-1.5 rounded ${getIconBgClass()}`}>
            {isCommercial || isCommercialReview ? (
              <DollarSign className={`h-4 w-4 ${getIconColorClass()}`} />
            ) : (
              <Package className={`h-4 w-4 ${getIconColorClass()}`} />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{getTaskTitle()}</span>
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                {task.assigned_to_role ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
                {assignedLabel}
              </Badge>
              {task.status === 'in_progress' && (
                <Badge variant="secondary" className="text-xs">In Progress</Badge>
              )}
            </div>
            
            <div className="text-xs text-muted-foreground mt-1">
              {(isSample || isSampleReview) && metadata.quantity && (
                <span>{metadata.quantity as number} pcs needed</span>
              )}
              {(isSample || isSampleReview) && metadata.notes && (
                <span className="ml-1">• "{metadata.notes as string}"</span>
              )}
              {isCommercial && metadata.notes && (
                <span>"{metadata.notes as string}"</span>
              )}
              {isSampleReview && (
                <span className="text-purple-600 dark:text-purple-400 font-medium">
                  📦 Sample arrived - awaiting your review
                </span>
              )}
              {isCommercialReview && (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  💰 ${(metadata.fob_price_usd as number)?.toFixed(2)} FOB, MOQ {metadata.moq as number} - awaiting approval
                </span>
              )}
              {needsResend && metadata.rejection_notes && (
                <span className="text-destructive">
                  Previous rejection: "{metadata.rejection_notes as string}"
                </span>
              )}
              {needsRevision && metadata.rejection_reason && (
                <span className="text-destructive">
                  Revision needed: "{metadata.rejection_reason as string}"
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Clock className="h-3 w-3" />
              <span>Requested by {creatorName} • {timeAgo}</span>
            </div>

            {/* Show progress info */}
            {isDataFilled && !isCommercialReview && (
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                ✓ Data provided - awaiting confirmation
              </div>
            )}
            {hasTracking && !isDelivered && (
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                ✓ Shipped via {metadata.courier_name as string} - {metadata.tracking_number as string}
              </div>
            )}
            {isDelivered && !isSampleReview && (
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
                {needsRevision ? 'Submit Revision' : 'Fill Data'}
              </Button>
            )}
            {isCommercialReview && onReviewCommercial && (
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={onReviewCommercial}>
                Review Data
              </Button>
            )}
            {isSample && !hasTracking && onAddTracking && (
              <Button size="sm" onClick={onAddTracking}>
                {needsResend ? 'Add New Tracking' : 'Add Tracking'}
              </Button>
            )}
            {isSample && hasTracking && !isDelivered && onMarkArrived && (
              <Button size="sm" variant="outline" onClick={onMarkArrived}>
                Mark Arrived
              </Button>
            )}
            {isSampleReview && onReviewSample && (
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={onReviewSample}>
                Review Sample
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
