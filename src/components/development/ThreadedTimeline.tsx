import { useMemo } from 'react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { ThreadCard, ThreadActivity } from './ThreadCard';
import { CompactActivityRow } from './CompactActivityRow';

interface ThreadedTimelineProps {
  activities: ThreadActivity[];
  cardId: string;
  currentOwner: 'mor' | 'arc';
  pendingActionType?: string | null;
  onResolveQuestion?: (activityId: string) => void;
  onAcknowledgeAnswer?: (activityId: string) => void;
  onOwnerChange?: () => void;
  isResolving?: boolean;
  isAcknowledging?: boolean;
  excludeIds?: Set<string>;
  focusReplyThreadId?: string | null;
}

// Primary activity types that form threads (including sample_requested and card_created as auto-threads)
const THREADABLE_TYPES = ['comment', 'question', 'answer', 'sample_requested', 'card_created'];

function formatDateHeader(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d, yyyy');
}

interface ThreadGroup {
  threadId: string;
  activities: ThreadActivity[];
  latestActivity: Date;
}

interface SystemActivityGroup {
  type: 'system';
  activities: ThreadActivity[];
}

type TimelineItem = ThreadGroup | SystemActivityGroup;

export function ThreadedTimeline({
  activities,
  cardId,
  currentOwner,
  pendingActionType,
  onResolveQuestion,
  onAcknowledgeAnswer,
  onOwnerChange,
  isResolving,
  isAcknowledging,
  excludeIds = new Set(),
  focusReplyThreadId,
}: ThreadedTimelineProps) {
  // Filter out excluded activities (shown in banners)
  const filteredActivities = activities.filter(a => !excludeIds.has(a.id));

  // Group activities into threads and system activities
  const { threads, systemActivities } = useMemo(() => {
    const threadMap = new Map<string, ThreadActivity[]>();
    const system: ThreadActivity[] = [];

    for (const activity of filteredActivities) {
      // System activities (non-threadable) go to compact section
      if (!THREADABLE_TYPES.includes(activity.activity_type)) {
        system.push(activity);
        continue;
      }

      // Get thread ID - use activity's thread_id, or its own id if it's a root
      const threadId = activity.thread_id || activity.id;
      
      if (!threadMap.has(threadId)) {
        threadMap.set(threadId, []);
      }
      threadMap.get(threadId)!.push(activity);
    }

    // Convert to array and sort threads by latest activity (most recent first)
    const threadGroups: ThreadGroup[] = Array.from(threadMap.entries()).map(([threadId, acts]) => {
      const sortedActs = [...acts].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const latestActivity = new Date(sortedActs[sortedActs.length - 1].created_at);
      return { threadId, activities: sortedActs, latestActivity };
    });

    threadGroups.sort((a, b) => b.latestActivity.getTime() - a.latestActivity.getTime());

    return { threads: threadGroups, systemActivities: system };
  }, [filteredActivities]);

  // Group threads by date (based on latest activity in thread)
  const threadsByDate = useMemo(() => {
    const grouped: Record<string, ThreadGroup[]> = {};
    
    for (const thread of threads) {
      const dateKey = format(thread.latestActivity, 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(thread);
    }
    
    return grouped;
  }, [threads]);

  const sortedDates = Object.keys(threadsByDate).sort((a, b) => b.localeCompare(a));

  // Sort system activities by date (most recent first)
  const sortedSystemActivities = [...systemActivities].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (threads.length === 0 && systemActivities.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Threaded Conversations */}
      {sortedDates.map((dateKey) => (
        <div key={dateKey}>
          <div className="sticky top-0 bg-background py-1 mb-3 z-10">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {formatDateHeader(dateKey + 'T00:00:00')}
            </span>
          </div>
          
          <div className="space-y-3">
            {threadsByDate[dateKey].map((thread) => (
              <ThreadCard
                key={thread.threadId}
                activities={thread.activities}
                cardId={cardId}
                currentOwner={currentOwner}
                pendingActionType={pendingActionType}
                onResolveQuestion={onResolveQuestion}
                onAcknowledgeAnswer={onAcknowledgeAnswer}
                onOwnerChange={onOwnerChange}
                isResolving={isResolving}
                isAcknowledging={isAcknowledging}
                defaultOpen={thread.activities.length === 1}
                initialReplyToId={focusReplyThreadId === thread.threadId ? focusReplyThreadId : undefined}
              />
            ))}
          </div>
        </div>
      ))}

      {/* System Activities Section */}
      {sortedSystemActivities.length > 0 && (
        <div className="border-t pt-4">
          <div className="mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Activity Log
            </span>
          </div>
          <div className="space-y-0.5">
            {sortedSystemActivities.map((activity) => (
              <CompactActivityRow key={activity.id} activity={activity} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
