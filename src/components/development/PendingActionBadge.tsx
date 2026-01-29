import { useMemo } from 'react';
import { format, parseISO, isAfter, isBefore, differenceInDays } from 'date-fns';
import { Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PendingActionBadgeProps {
  pendingActionType: string | null;
  pendingActionDueAt: string | null;
  snoozedUntil: string | null;
  className?: string;
  showLabel?: boolean;
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  question: 'Question pending',
  answer_pending: 'Answer received',
  commercial_review: 'Review commercial data',
  sample_tracking: 'Add tracking',
  sample_in_transit: 'Awaiting sample',
  sample_review: 'Review sample',
};

export function PendingActionBadge({
  pendingActionType,
  pendingActionDueAt,
  snoozedUntil,
  className,
  showLabel = true,
}: PendingActionBadgeProps) {
  const { isUrgent, dueText, daysRemaining } = useMemo(() => {
    const now = new Date();
    
    // Check if snoozed
    if (snoozedUntil) {
      const snoozeDate = parseISO(snoozedUntil);
      if (isAfter(snoozeDate, now)) {
        return {
          isUrgent: false,
          dueText: `Snoozed until ${format(snoozeDate, 'MMM d')}`,
          daysRemaining: differenceInDays(snoozeDate, now),
        };
      }
    }
    
    // Check if has due date
    if (pendingActionDueAt) {
      const dueDate = parseISO(pendingActionDueAt);
      if (isAfter(dueDate, now)) {
        return {
          isUrgent: false,
          dueText: `Due ${format(dueDate, 'MMM d')}`,
          daysRemaining: differenceInDays(dueDate, now),
        };
      }
      // Past due
      return {
        isUrgent: true,
        dueText: `Overdue (${format(dueDate, 'MMM d')})`,
        daysRemaining: differenceInDays(dueDate, now),
      };
    }
    
    // No due date or snooze - urgent now
    return {
      isUrgent: true,
      dueText: 'Action needed',
      daysRemaining: 0,
    };
  }, [pendingActionDueAt, snoozedUntil]);

  if (!pendingActionType) return null;

  const label = ACTION_TYPE_LABELS[pendingActionType] || pendingActionType.replace(/_/g, ' ');

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Badge
        variant="outline"
        className={cn(
          "text-[10px] px-1.5 py-0 flex items-center gap-1",
          isUrgent 
            ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-700" 
            : "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700"
        )}
      >
        {isUrgent ? (
          <AlertCircle className="h-3 w-3" />
        ) : (
          <Clock className="h-3 w-3" />
        )}
        {showLabel ? dueText : null}
      </Badge>
    </div>
  );
}

// Compact indicator for card list view
interface PendingActionIndicatorProps {
  pendingActionType: string | null;
  pendingActionDueAt: string | null;
  snoozedUntil: string | null;
  className?: string;
}

export function PendingActionIndicator({
  pendingActionType,
  pendingActionDueAt,
  snoozedUntil,
  className,
}: PendingActionIndicatorProps) {
  const { isUrgent, isSnoozed } = useMemo(() => {
    if (!pendingActionType) return { isUrgent: false, isSnoozed: false };
    
    const now = new Date();
    
    // Check if snoozed (snooze date is in the future)
    if (snoozedUntil) {
      const snoozeDate = parseISO(snoozedUntil);
      if (isAfter(snoozeDate, now)) {
        return { isUrgent: false, isSnoozed: true };
      }
    }
    
    // Check if has due date that hasn't passed
    if (pendingActionDueAt) {
      const dueDate = parseISO(pendingActionDueAt);
      if (isAfter(dueDate, now)) {
        return { isUrgent: false, isSnoozed: false };
      }
    }
    
    // Urgent if no snooze/due or they've passed
    return { isUrgent: true, isSnoozed: false };
  }, [pendingActionType, pendingActionDueAt, snoozedUntil]);

  if (!pendingActionType) return null;

  // Snoozed: show Clock icon
  if (isSnoozed) {
    return (
      <span className={cn("flex items-center justify-center h-4 w-4 text-muted-foreground", className)}>
        <Clock className="h-3 w-3" />
      </span>
    );
  }

  // Urgent: red blinking dot
  if (isUrgent) {
    return (
      <span className={cn("relative flex h-3 w-3", className)}>
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
      </span>
    );
  }

  // Waiting (not snoozed, not urgent): static amber dot
  return (
    <span className={cn("relative flex h-3 w-3", className)}>
      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400" />
    </span>
  );
}

// Due date display for card footer
interface ActionDueDateProps {
  pendingActionDueAt: string | null;
  snoozedUntil: string | null;
  className?: string;
}

export function ActionDueDate({
  pendingActionDueAt,
  snoozedUntil,
  className,
}: ActionDueDateProps) {
  const displayDate = useMemo(() => {
    const now = new Date();
    
    // If snoozed and snooze is in future, show snooze date
    if (snoozedUntil) {
      const snoozeDate = parseISO(snoozedUntil);
      if (isAfter(snoozeDate, now)) {
        return { date: snoozeDate, label: 'Snoozed' };
      }
    }
    
    // If has due date, show it
    if (pendingActionDueAt) {
      const dueDate = parseISO(pendingActionDueAt);
      const isPast = isBefore(dueDate, now);
      return { date: dueDate, label: isPast ? 'Overdue' : 'Due' };
    }
    
    return null;
  }, [pendingActionDueAt, snoozedUntil]);

  if (!displayDate) return null;

  return (
    <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <Clock className="h-3 w-3" />
      <span>{displayDate.label} {format(displayDate.date, 'MMM d')}</span>
    </div>
  );
}
