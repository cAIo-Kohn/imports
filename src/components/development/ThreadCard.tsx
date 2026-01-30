import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ChevronDown, ChevronRight, MessageCircle, HelpCircle, Reply } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ThreadMessage } from './ThreadMessage';
import { InlineReplyBox } from './InlineReplyBox';
import { UserRoleBadge } from './UserRoleBadge';
import { AppRole } from '@/hooks/useUserRole';

export interface ThreadActivity {
  id: string;
  card_id: string;
  user_id: string;
  activity_type: string;
  content: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  thread_id: string | null;
  thread_root_id: string | null;
  profile?: {
    full_name: string | null;
    email: string | null;
  } | null;
  roles?: AppRole[];
}

interface ThreadCardProps {
  activities: ThreadActivity[];
  cardId: string;
  currentOwner: 'mor' | 'arc';
  pendingActionType?: string | null;
  onResolveQuestion?: (activityId: string) => void;
  onAcknowledgeAnswer?: (activityId: string) => void;
  onOwnerChange?: () => void;
  isResolving?: boolean;
  isAcknowledging?: boolean;
  defaultOpen?: boolean;
}

export function ThreadCard({
  activities,
  cardId,
  currentOwner,
  pendingActionType,
  onResolveQuestion,
  onAcknowledgeAnswer,
  onOwnerChange,
  isResolving,
  isAcknowledging,
  defaultOpen = false,
}: ThreadCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);

  // Sort activities by created_at ascending (oldest first within thread)
  const sortedActivities = [...activities].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Root activity is the first one (thread starter)
  const rootActivity = sortedActivities[0];
  const replies = sortedActivities.slice(1);
  const replyCount = replies.length;

  // Get unique participants
  const participants = [...new Map(sortedActivities.map(a => [a.user_id, a.profile])).values()];
  const participantCount = participants.length;

  // Latest activity time
  const latestActivity = sortedActivities[sortedActivities.length - 1];
  const latestTime = format(parseISO(latestActivity.created_at), 'dd/MM HH:mm');

  // Thread title - use first few words of root message or activity type
  const getThreadTitle = () => {
    if (rootActivity.content) {
      const words = rootActivity.content.split(' ').slice(0, 6).join(' ');
      return words.length < rootActivity.content.length ? `${words}...` : words;
    }
    if (rootActivity.activity_type === 'question') return 'Question';
    if (rootActivity.activity_type === 'comment') return 'Comment';
    return 'Discussion';
  };

  // Determine thread icon and color based on root activity
  const isQuestion = rootActivity.activity_type === 'question';
  const isResolved = isQuestion && rootActivity.metadata?.resolved;
  
  const getThreadStyle = () => {
    if (isResolved) return 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20';
    if (isQuestion) return 'border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20';
    return 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20';
  };

  const getThreadIcon = () => {
    if (isQuestion) return <HelpCircle className="h-4 w-4" />;
    return <MessageCircle className="h-4 w-4" />;
  };

  const getInitials = (profile: ThreadActivity['profile']) => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (profile?.email) return profile.email[0].toUpperCase();
    return '?';
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn("rounded-lg border", getThreadStyle())}>
        {/* Thread Header - Always Visible */}
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors cursor-pointer">
            {/* Expand/Collapse Icon */}
            <div className="text-muted-foreground">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
            
            {/* Thread Icon */}
            <div className={cn(
              "flex-shrink-0",
              isResolved ? "text-green-600" : isQuestion ? "text-purple-600" : "text-blue-600"
            )}>
              {getThreadIcon()}
            </div>
            
            {/* Thread Title & Meta */}
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "font-medium text-sm truncate",
                  isResolved && "line-through opacity-70"
                )}>
                  {getThreadTitle()}
                </span>
                {isResolved && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-100 border-green-300 text-green-700 dark:bg-green-900 dark:border-green-700 dark:text-green-200">
                    Resolved
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>{rootActivity.profile?.full_name?.split(' ')[0] || 'Someone'}</span>
                {rootActivity.roles && rootActivity.roles.length > 0 && (
                  <UserRoleBadge roles={rootActivity.roles} />
                )}
                {replyCount > 0 && (
                  <>
                    <span>•</span>
                    <span>{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
                  </>
                )}
                <span>•</span>
                <span>{latestTime}</span>
              </div>
            </div>
            
            {/* Participant Avatars (collapsed view) */}
            {!isOpen && participantCount > 0 && (
              <div className="flex -space-x-1.5">
                {participants.slice(0, 3).map((profile, i) => (
                  <Avatar key={i} className="h-6 w-6 border-2 border-background">
                    <AvatarFallback className="text-[10px] bg-muted">
                      {getInitials(profile)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {participantCount > 3 && (
                  <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                    <span className="text-[10px] text-muted-foreground">+{participantCount - 3}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CollapsibleTrigger>

        {/* Thread Content - Expanded */}
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2">
            {/* All messages in thread */}
            {sortedActivities.map((activity, index) => (
              <ThreadMessage
                key={activity.id}
                activity={activity}
                isRoot={index === 0}
                cardId={cardId}
                currentOwner={currentOwner}
                pendingActionType={pendingActionType}
                onReply={() => setReplyingToId(activity.id)}
                onResolve={onResolveQuestion}
                onAcknowledge={onAcknowledgeAnswer}
                isResolving={isResolving}
                isAcknowledging={isAcknowledging}
                replyingToId={replyingToId}
                onCloseReply={() => setReplyingToId(null)}
                onOwnerChange={onOwnerChange}
              />
            ))}
            
            {/* Quick reply button for thread */}
            {!replyingToId && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setReplyingToId(rootActivity.id)}
              >
                <Reply className="h-3 w-3 mr-1" />
                Reply to this thread
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
