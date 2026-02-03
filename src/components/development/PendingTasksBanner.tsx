import { useState } from 'react';
import { ChevronDown, ChevronUp, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TaskCard } from './TaskCard';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import type { CardTask } from '@/hooks/useCardTasks';

interface PendingTasksBannerProps {
  tasks: CardTask[];
  onFillCommercial: (task: CardTask) => void;
  onAddTracking: (task: CardTask) => void;
  onConfirmData: (task: CardTask) => void;
  onMarkArrived: (task: CardTask) => void;
  onReviewSample: (task: CardTask) => void;
}

export function PendingTasksBanner({
  tasks,
  onFillCommercial,
  onAddTracking,
  onConfirmData,
  onMarkArrived,
  onReviewSample,
}: PendingTasksBannerProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { user } = useAuth();
  const { roles, isAdmin, isBuyer, isTrader, isQuality, isMarketing } = useUserRole();

  if (tasks.length === 0) return null;

  // Check if user can action a task
  const canActionTask = (task: CardTask) => {
    if (!user?.id) return false;
    
    // Check if user is assigned directly
    if (task.assigned_to_users?.includes(user.id)) return true;
    
    // Check if user has the assigned role
    if (task.assigned_to_role) {
      const roleMatch = roles.includes(task.assigned_to_role as any);
      if (roleMatch) return true;
    }

    // Check if user is the requester (for confirmation actions)
    if (task.created_by === user.id) return true;

    // Admins and buyers can always action
    if (isAdmin || isBuyer) return true;

    return false;
  };

  // Determine what action button to show based on task state and user
  const getTaskActions = (task: CardTask) => {
    const metadata = task.metadata || {};
    const isRequester = task.created_by === user?.id;
    
    if (task.task_type === 'commercial_request') {
      const isDataFilled = !!metadata.fob_price_usd;
      
      // Anyone who can action can fill data if not filled yet
      if (!isDataFilled) {
        return { onFillCommercial: () => onFillCommercial(task) };
      }
      // Only requester can confirm filled data
      if (isDataFilled && isRequester) {
        return { onConfirmData: () => onConfirmData(task) };
      }
    }
    
    if (task.task_type === 'sample_request') {
      const hasTracking = !!metadata.tracking_number;
      const isDelivered = !!metadata.actual_arrival;
      
      // Anyone who can action can add tracking if not added yet
      if (!hasTracking) {
        return { onAddTracking: () => onAddTracking(task) };
      }
      // Only requester can mark arrived
      if (hasTracking && !isDelivered && isRequester) {
        return { onMarkArrived: () => onMarkArrived(task) };
      }
    }

    // Sample review - show review button for the requester
    if (task.task_type === 'sample_review') {
      return { onReviewSample: () => onReviewSample(task) };
    }
    
    return {};
  };

  return (
    <div className="bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-950/30 dark:to-amber-950/30 rounded-lg border border-orange-200 dark:border-orange-800 mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-orange-200/50 dark:hover:bg-orange-900/30"
          >
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <span className="font-medium text-orange-800 dark:text-orange-200">
                {tasks.length} Pending Task{tasks.length !== 1 ? 's' : ''}
              </span>
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            )}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-2">
            {tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                canAction={canActionTask(task)}
                {...getTaskActions(task)}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
