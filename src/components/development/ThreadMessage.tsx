import { format, parseISO } from 'date-fns';
import { Reply, Check, HelpCircle, MessageCircle } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { InlineReplyBox } from './InlineReplyBox';
import { SnoozeButton } from './SnoozeButton';
import { MentionText } from '@/components/notifications/MentionInput';
import { AttachmentDisplay, UploadedAttachment } from './TimelineUploadButton';
import { UserRoleBadge } from './UserRoleBadge';
import { AppRole } from '@/hooks/useUserRole';

interface ThreadActivity {
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

interface ThreadMessageProps {
  activity: ThreadActivity;
  isRoot: boolean;
  cardId: string;
  currentOwner: 'mor' | 'arc';
  pendingActionType?: string | null;
  onReply: () => void;
  onResolve?: (activityId: string) => void;
  onAcknowledge?: (activityId: string) => void;
  isResolving?: boolean;
  isAcknowledging?: boolean;
  replyingToId: string | null;
  onCloseReply: () => void;
  onOwnerChange?: () => void;
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  comment: <MessageCircle className="h-3.5 w-3.5" />,
  question: <HelpCircle className="h-3.5 w-3.5" />,
  answer: <Reply className="h-3.5 w-3.5" />,
};

const ACTIVITY_LABELS: Record<string, string> = {
  comment: 'commented',
  question: 'asked',
  answer: 'answered',
};

export function ThreadMessage({
  activity,
  isRoot,
  cardId,
  currentOwner,
  pendingActionType,
  onReply,
  onResolve,
  onAcknowledge,
  isResolving,
  isAcknowledging,
  replyingToId,
  onCloseReply,
  onOwnerChange,
}: ThreadMessageProps) {
  const isQuestion = activity.activity_type === 'question';
  const isAnswer = activity.activity_type === 'answer';
  const isComment = activity.activity_type === 'comment';
  const isResolved = isQuestion && activity.metadata?.resolved;
  const isAcknowledged = isAnswer && activity.metadata?.acknowledged;
  
  const getInitials = (profile: ThreadActivity['profile']) => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (profile?.email) return profile.email[0].toUpperCase();
    return '?';
  };

  const getReplyToType = (): 'question' | 'answer' | 'comment' => {
    if (isQuestion) return 'question';
    if (isAnswer) return 'answer';
    return 'comment';
  };

  const getMessageStyle = () => {
    if (isResolved) return 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800';
    if (isQuestion) return 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800';
    if (isAnswer) return 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800';
    return 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800';
  };

  return (
    <div className={cn("relative", !isRoot && "ml-8")}>
      {/* Connector line for replies */}
      {!isRoot && (
        <div className="absolute left-[-20px] top-0 bottom-0 w-px bg-border" />
      )}
      
      <div className={cn(
        "rounded-lg border p-3",
        getMessageStyle()
      )}>
        <div className="flex gap-2">
          <Avatar className="h-6 w-6 flex-shrink-0">
            <AvatarFallback className="text-xs bg-background">
              {getInitials(activity.profile)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">
                {activity.profile?.full_name || activity.profile?.email || 'Unknown'}
              </span>
              {activity.roles && activity.roles.length > 0 && (
                <UserRoleBadge roles={activity.roles} />
              )}
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {ACTIVITY_ICONS[activity.activity_type] || ACTIVITY_ICONS.comment}
                {ACTIVITY_LABELS[activity.activity_type] || activity.activity_type}
              </span>
              <span className="text-xs text-muted-foreground opacity-70">
                {format(parseISO(activity.created_at), 'HH:mm')}
              </span>
              {isResolved && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-100 border-green-300 text-green-700">
                  Resolved
                </Badge>
              )}
              {isAcknowledged && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-100 border-green-300 text-green-700">
                  <Check className="h-2.5 w-2.5 mr-0.5" />
                  Acknowledged
                </Badge>
              )}
            </div>
            
            {/* Content */}
            {activity.content && (
              <p className={cn(
                "text-sm mt-1 whitespace-pre-wrap",
                isResolved && "line-through opacity-70"
              )}>
                {isQuestion ? (
                  <span className="italic">"<MentionText text={activity.content} />"</span>
                ) : (
                  <MentionText text={activity.content} />
                )}
              </p>
            )}
            
            {/* Attachments */}
            {activity.metadata?.attachments && Array.isArray(activity.metadata.attachments) && activity.metadata.attachments.length > 0 && (
              <AttachmentDisplay attachments={activity.metadata.attachments as UploadedAttachment[]} />
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-2 mt-2 flex-wrap">
              {/* Reply button - always visible */}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={onReply}
              >
                <Reply className="h-3 w-3 mr-1" />
                Reply
              </Button>
              
              {/* Resolve button for unresolved questions */}
              {isQuestion && !isResolved && onResolve && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-100"
                    onClick={() => onResolve(activity.id)}
                    disabled={isResolving}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    {isResolving ? 'Resolving...' : 'Mark Resolved'}
                  </Button>
                  <SnoozeButton
                    cardId={cardId}
                    currentActionType="question"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                  />
                </>
              )}
              
              {/* Acknowledge button for unacknowledged answers */}
              {isAnswer && !isAcknowledged && onAcknowledge && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-green-600 hover:text-green-700 hover:bg-green-100"
                    onClick={() => onAcknowledge(activity.id)}
                    disabled={isAcknowledging}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    {isAcknowledging ? 'Acknowledging...' : 'Got it'}
                  </Button>
                  <SnoozeButton
                    cardId={cardId}
                    currentActionType="answer_pending"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                  />
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Inline Reply Box */}
        {replyingToId === activity.id && (
          <div className="mt-3 ml-8">
            <InlineReplyBox
              replyToId={activity.id}
              replyToType={getReplyToType()}
              cardId={cardId}
              currentOwner={currentOwner}
              pendingActionType={pendingActionType}
              onClose={onCloseReply}
              onCardMove={onOwnerChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
