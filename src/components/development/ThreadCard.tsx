import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ChevronDown, ChevronRight, MessageCircle, HelpCircle, Reply, Pencil, Check, X, Package, AlertCircle, CheckCircle2, Truck, PackageCheck, FileCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
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
  thread_title: string | null;
  pending_for_team: 'mor' | 'arc' | null;
  thread_resolved_at: string | null;
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
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

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

  // Thread title - prioritize custom title, fallback to first few words
  const getThreadTitle = () => {
    if (rootActivity.thread_title) return rootActivity.thread_title;
    if (rootActivity.content) {
      const words = rootActivity.content.split(' ').slice(0, 6).join(' ');
      return words.length < rootActivity.content.length ? `${words}...` : words;
    }
    if (rootActivity.activity_type === 'question') return 'Question';
    if (rootActivity.activity_type === 'comment') return 'Comment';
    return 'Discussion';
  };

  // Update thread title mutation
  const updateTitleMutation = useMutation({
    mutationFn: async (newTitle: string) => {
      const { error } = await supabase
        .from('development_card_activity')
        .update({ thread_title: newTitle.trim() || null })
        .eq('id', rootActivity.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      setIsEditingTitle(false);
      toast({ title: 'Thread title updated' });
    },
    onError: () => {
      toast({ title: 'Failed to update title', variant: 'destructive' });
    },
  });

  const handleStartEditTitle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedTitle(rootActivity.thread_title || '');
    setIsEditingTitle(true);
  };

  const handleSaveTitle = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateTitleMutation.mutate(editedTitle);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTitle(false);
    setEditedTitle('');
  };

  // Determine thread icon and color based on root activity
  const isQuestion = rootActivity.activity_type === 'question';
  const isSampleRelated = rootActivity.activity_type === 'sample_requested';
  const isResolved = rootActivity.thread_resolved_at !== null || (isQuestion && rootActivity.metadata?.resolved);
  
  // Thread-level pending status (who needs to act on this thread)
  const pendingForTeam = rootActivity.pending_for_team;
  const isThreadPending = pendingForTeam && !isResolved;

  // Sample lifecycle stage detection
  const getSampleLifecycleStage = (): 'requested' | 'shipped' | 'arrived' | 'reviewed' | null => {
    if (!isSampleRelated) return null;
    
    // Check metadata for sample status progression
    const metadata = rootActivity.metadata || {};
    
    if (metadata.sample_decision || metadata.reviewed || isResolved) return 'reviewed';
    if (metadata.sample_arrived || metadata.actual_arrival) return 'arrived';
    if (metadata.tracking_number || metadata.shipped_date || metadata.courier) return 'shipped';
    return 'requested';
  };

  const sampleStage = getSampleLifecycleStage();
  
  const getThreadStyle = () => {
    if (isResolved) return 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20';
    if (isThreadPending && pendingForTeam === currentOwner) {
      // This team needs to act - highlight more prominently
      return 'border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20 ring-1 ring-amber-300 dark:ring-amber-700';
    }
    if (isSampleRelated) return 'border-cyan-200 bg-cyan-50/50 dark:border-cyan-800 dark:bg-cyan-950/20';
    if (isQuestion) return 'border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20';
    return 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20';
  };

  const getThreadIcon = () => {
    if (isSampleRelated) return <Package className="h-4 w-4" />;
    if (isQuestion) return <HelpCircle className="h-4 w-4" />;
    return <MessageCircle className="h-4 w-4" />;
  };
  
  const getThreadIconColor = () => {
    if (isResolved) return 'text-green-600';
    if (isThreadPending && pendingForTeam === currentOwner) return 'text-amber-600';
    if (isSampleRelated) return 'text-cyan-600';
    if (isQuestion) return 'text-purple-600';
    return 'text-blue-600';
  };

  // Sample Lifecycle Progress Component
  const SampleLifecycleIndicator = () => {
    if (!sampleStage) return null;

    const stages = [
      { key: 'requested', label: 'Requested', icon: Package, color: 'text-cyan-500' },
      { key: 'shipped', label: 'Shipped', icon: Truck, color: 'text-blue-500' },
      { key: 'arrived', label: 'Arrived', icon: PackageCheck, color: 'text-amber-500' },
      { key: 'reviewed', label: 'Reviewed', icon: FileCheck, color: 'text-green-500' },
    ];

    const currentStageIndex = stages.findIndex(s => s.key === sampleStage);

    return (
      <div className="flex items-center gap-0.5 text-[10px]">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const isCompleted = index <= currentStageIndex;
          const isCurrent = index === currentStageIndex;
          
          return (
            <div key={stage.key} className="flex items-center">
              <div 
                className={cn(
                  "flex items-center gap-0.5 px-1 py-0.5 rounded transition-all",
                  isCurrent && "bg-white/50 dark:bg-black/20 shadow-sm",
                  isCompleted ? stage.color : "text-muted-foreground/40"
                )}
                title={stage.label}
              >
                <Icon className={cn(
                  "h-3 w-3",
                  isCurrent && "animate-pulse"
                )} />
                {isCurrent && (
                  <span className="font-medium hidden sm:inline">{stage.label}</span>
                )}
              </div>
              {index < stages.length - 1 && (
                <div className={cn(
                  "w-2 h-px mx-0.5",
                  index < currentStageIndex ? "bg-current opacity-30" : "bg-muted-foreground/20"
                )} />
              )}
            </div>
          );
        })}
      </div>
    );
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
      <div id={`thread-${rootActivity.id}`} className={cn("rounded-lg border group", getThreadStyle())}>
        {/* Thread Header - Always Visible */}
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors cursor-pointer">
            {/* Expand/Collapse Icon */}
            <div className="text-muted-foreground">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
            
            {/* Thread Icon */}
            <div className={cn("flex-shrink-0", getThreadIconColor())}>
              {getThreadIcon()}
            </div>
            
            {/* Thread Title & Meta */}
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2">
                {isEditingTitle ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Input
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      placeholder="Enter thread title..."
                      className="h-6 text-sm px-2 w-48"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          updateTitleMutation.mutate(editedTitle);
                        } else if (e.key === 'Escape') {
                          setIsEditingTitle(false);
                        }
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleSaveTitle}
                      disabled={updateTitleMutation.isPending}
                    >
                      <Check className="h-3 w-3 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className={cn(
                      "font-medium text-sm truncate",
                      isResolved && "line-through opacity-70"
                    )}>
                      {getThreadTitle()}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={handleStartEditTitle}
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </Button>
                    {isResolved && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-100 border-green-300 text-green-700 dark:bg-green-900 dark:border-green-700 dark:text-green-200">
                        Resolved
                      </Badge>
                    )}
                    {/* Pending for team badge */}
                    {isThreadPending && (
                      <Badge variant="outline" className={cn(
                        "text-[10px] px-1.5 py-0 flex items-center gap-1",
                        pendingForTeam === currentOwner 
                          ? "bg-amber-100 border-amber-400 text-amber-700 dark:bg-amber-900 dark:border-amber-600 dark:text-amber-200 animate-pulse"
                          : "bg-muted border-muted-foreground/30 text-muted-foreground"
                      )}>
                        {pendingForTeam === currentOwner && <AlertCircle className="h-2.5 w-2.5" />}
                        {pendingForTeam === 'mor' ? '🇧🇷' : '🇨🇳'} {pendingForTeam === currentOwner ? 'Your turn' : 'Waiting'}
                      </Badge>
                    )}
                  </>
                )}
              </div>
              {/* Sample Lifecycle Progress - shown for sample-related threads */}
              {sampleStage && (
                <div className="mt-1">
                  <SampleLifecycleIndicator />
                </div>
              )}
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
