import { Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getRoleLabel, type AssigneeRole } from '@/hooks/useCardWorkflow';

interface ResponsibilityBadgeProps {
  currentAssigneeRole: AssigneeRole;
  workflowStatus?: string | null;
  className?: string;
}

export function ResponsibilityBadge({ 
  currentAssigneeRole, 
  workflowStatus,
  className 
}: ResponsibilityBadgeProps) {
  if (!currentAssigneeRole) return null;

  const roleLabel = getRoleLabel(currentAssigneeRole);
  
  // Different colors based on role
  const colorClasses = currentAssigneeRole === 'trader'
    ? 'bg-red-500 text-white border-red-600'
    : currentAssigneeRole === 'buyer'
      ? 'bg-amber-500 text-white border-amber-600'
      : currentAssigneeRole === 'quality'
        ? 'bg-teal-500 text-white border-teal-600'
        : 'bg-purple-500 text-white border-purple-600';

  return (
    <Badge
      className={cn(
        'text-[10px] px-1.5 py-0 flex items-center gap-1 animate-pulse font-semibold',
        colorClasses,
        className
      )}
    >
      <Zap className="h-3 w-3" />
      Action: {roleLabel}
    </Badge>
  );
}
