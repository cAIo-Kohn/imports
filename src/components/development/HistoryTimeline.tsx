import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { 
  MessageCircle, 
  HelpCircle, 
  RefreshCw, 
  ArrowRight, 
  Package, 
  DollarSign,
  Image,
  Plus,
  CheckCircle2,
  Reply,
  Check,
  Lightbulb
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { InlineReplyBox } from './InlineReplyBox';

interface Activity {
  id: string;
  card_id: string;
  user_id: string;
  activity_type: string;
  content: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  profile?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

interface HistoryTimelineProps {
  cardId: string;
  cardType?: 'item' | 'item_group' | 'task';
  showAttentionBanner?: boolean;
  currentOwner?: 'mor' | 'arc';
  onOwnerChange?: () => void;
  onOpenSampleSection?: () => void;
  onOpenMessageSection?: (type: 'comment' | 'question') => void;
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  comment: <MessageCircle className="h-3.5 w-3.5" />,
  question: <HelpCircle className="h-3.5 w-3.5" />,
  answer: <Reply className="h-3.5 w-3.5" />,
  status_change: <RefreshCw className="h-3.5 w-3.5" />,
  ownership_change: <ArrowRight className="h-3.5 w-3.5" />,
  sample_added: <Package className="h-3.5 w-3.5" />,
  sample_updated: <Package className="h-3.5 w-3.5" />,
  commercial_update: <DollarSign className="h-3.5 w-3.5" />,
  product_added: <Plus className="h-3.5 w-3.5" />,
  image_updated: <Image className="h-3.5 w-3.5" />,
  created: <CheckCircle2 className="h-3.5 w-3.5" />,
};

const ACTIVITY_STYLES: Record<string, string> = {
  comment: 'bg-blue-100 text-blue-700 border-blue-200',
  question: 'bg-purple-100 text-purple-700 border-purple-200',
  answer: 'bg-green-100 text-green-700 border-green-200',
  status_change: 'bg-amber-100 text-amber-700 border-amber-200',
  ownership_change: 'bg-green-100 text-green-700 border-green-200',
  sample_added: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  sample_updated: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  commercial_update: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  product_added: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  image_updated: 'bg-pink-100 text-pink-700 border-pink-200',
  created: 'bg-slate-100 text-slate-700 border-slate-200',
};

const ACTIVITY_LABELS: Record<string, string> = {
  comment: 'commented',
  question: 'asked a question',
  answer: 'answered',
  status_change: 'changed status',
  ownership_change: 'moved card',
  sample_added: 'added sample tracking',
  sample_updated: 'updated sample',
  commercial_update: 'updated commercial data',
  product_added: 'added product',
  image_updated: 'updated image',
  created: 'created this card',
};

// Primary activity types get full cards; all others are compact
const PRIMARY_ACTIVITY_TYPES = ['comment', 'question', 'answer'];

const isCompactActivity = (type: string) => !PRIMARY_ACTIVITY_TYPES.includes(type);

function formatDateHeader(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d, yyyy');
}

function groupByDate(activities: Activity[]): Record<string, Activity[]> {
  return activities.reduce((acc, activity) => {
    const dateKey = format(parseISO(activity.created_at), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(activity);
    return acc;
  }, {} as Record<string, Activity[]>);
}

// Compact single-line row for system activities
function CompactActivityRow({ activity }: { activity: Activity }) {
  const firstName = activity.profile?.full_name?.split(' ')[0] || 'Someone';
  const label = ACTIVITY_LABELS[activity.activity_type] || activity.activity_type.replace(/_/g, ' ');
  
  // Build inline content based on activity type
  let inlineContent = '';
  if (activity.activity_type === 'commercial_update' && activity.metadata) {
    // Check if batch update (has multiple fields)
    if (activity.metadata.fob_price_usd !== undefined) {
      inlineContent = `FOB $${activity.metadata.fob_price_usd}, MOQ ${activity.metadata.moq}, ${activity.metadata.qty_per_container}/${activity.metadata.container_type}`;
    } else {
      // Legacy single field update
      const field = activity.metadata.field?.replace(/_/g, ' ');
      inlineContent = `${field}: ${activity.metadata.value}`;
    }
  } else if (activity.activity_type === 'ownership_change' && activity.content) {
    // Extract target from content like "Card moved to ARC (China)"
    const match = activity.content.match(/to (.*)/);
    inlineContent = match ? match[1] : '';
  } else if (activity.content) {
    inlineContent = activity.content;
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1 px-1">
      <span className="flex-shrink-0 opacity-70">
        {ACTIVITY_ICONS[activity.activity_type] || ACTIVITY_ICONS.created}
      </span>
      <span className="font-medium">{firstName}</span>
      <span>{label}</span>
      {inlineContent && (
        <>
          <span className="opacity-50">—</span>
          <span className="truncate max-w-[200px]">{inlineContent}</span>
        </>
      )}
      <span className="opacity-50 flex-shrink-0">
        • {format(parseISO(activity.created_at), 'HH:mm')}
      </span>
    </div>
  );
}

// Attention Banner Component for highlighting important actions
function AttentionBanner({ 
  activity, 
  onReply 
}: { 
  activity: Activity; 
  onReply?: () => void;
}) {
  const isQuestion = activity.activity_type === 'question';
  const isCommercial = activity.activity_type === 'commercial_update';
  const isOwnershipChange = activity.activity_type === 'ownership_change';
  
  const getInitials = (profile: Activity['profile']) => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (profile?.email) {
      return profile.email[0].toUpperCase();
    }
    return '?';
  };

  return (
    <div className={cn(
      "rounded-lg p-4 mb-4 border-2 animate-pulse",
      isQuestion && "bg-purple-50 border-purple-300 dark:bg-purple-950/30 dark:border-purple-700",
      isCommercial && "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-700",
      isOwnershipChange && "bg-blue-50 border-blue-300 dark:bg-blue-950/30 dark:border-blue-700",
    )}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 font-medium">
          {isQuestion && <HelpCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
          {isCommercial && <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          {isOwnershipChange && <ArrowRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
          <span className={cn(
            "text-sm",
            isQuestion && "text-purple-800 dark:text-purple-200",
            isCommercial && "text-emerald-800 dark:text-emerald-200",
            isOwnershipChange && "text-blue-800 dark:text-blue-200",
          )}>
            {isQuestion ? "Question for you" : isCommercial ? "Commercial data updated" : "Card moved to you"}
          </span>
        </div>
        {isQuestion && onReply && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={onReply}
            className="bg-white hover:bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-950 dark:hover:bg-purple-900 dark:border-purple-600 dark:text-purple-200"
          >
            <Reply className="h-3 w-3 mr-1" />
            Reply
          </Button>
        )}
      </div>
      <div className="bg-white dark:bg-background rounded-lg p-3 border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[10px]">{getInitials(activity.profile)}</AvatarFallback>
          </Avatar>
          <span>{activity.profile?.full_name || activity.profile?.email || 'Unknown'}</span>
          <span className="opacity-70">• {format(parseISO(activity.created_at), 'HH:mm')}</span>
        </div>
        {activity.content && (
          <p className="text-sm font-medium">
            {isQuestion ? `"${activity.content}"` : activity.content}
          </p>
        )}
        {isCommercial && activity.metadata && (
          <p className="text-xs text-muted-foreground mt-1">
            {activity.metadata.field?.replace('_', ' ')}: {activity.metadata.value}
          </p>
        )}
      </div>
    </div>
  );
}

// Next Step Prompt Component
interface NextStepPromptProps {
  cardType: 'item' | 'item_group' | 'task';
  triggerType?: 'commercial' | 'ownership';
  onRequestSample: () => void;
  onAskQuestion: () => void;
  onAddComment: () => void;
}

function NextStepPrompt({ 
  cardType,
  triggerType,
  onRequestSample, 
  onAskQuestion, 
  onAddComment,
}: NextStepPromptProps) {
  return (
    <div className="rounded-lg p-4 mb-4 border-2 bg-sky-50 border-sky-300 dark:bg-sky-950/30 dark:border-sky-700">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="h-5 w-5 text-sky-600 dark:text-sky-400" />
        <span className="font-medium text-sm text-sky-800 dark:text-sky-200">What's next?</span>
      </div>
      <p className="text-sm text-sky-700 dark:text-sky-300 mb-3">
        {triggerType === 'commercial' 
          ? "Commercial data has been set. What would you like to do?"
          : "The card is now with you. What's your next step?"}
      </p>
      <div className="flex flex-wrap gap-2">
        {cardType !== 'task' && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRequestSample}
            className="bg-white hover:bg-sky-100 border-sky-300 text-sky-700 dark:bg-sky-950 dark:hover:bg-sky-900 dark:border-sky-600 dark:text-sky-200"
          >
            <Package className="h-3 w-3 mr-1" />
            Request Sample
          </Button>
        )}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onAskQuestion}
          className="bg-white hover:bg-sky-100 border-sky-300 text-sky-700 dark:bg-sky-950 dark:hover:bg-sky-900 dark:border-sky-600 dark:text-sky-200"
        >
          <HelpCircle className="h-3 w-3 mr-1" />
          Ask a Question
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onAddComment}
          className="bg-white hover:bg-sky-100 border-sky-300 text-sky-700 dark:bg-sky-950 dark:hover:bg-sky-900 dark:border-sky-600 dark:text-sky-200"
        >
          <MessageCircle className="h-3 w-3 mr-1" />
          Add Comment
        </Button>
      </div>
    </div>
  );
}


export function HistoryTimeline({ 
  cardId, 
  cardType = 'item',
  showAttentionBanner,
  currentOwner = 'arc',
  onOwnerChange,
  onOpenSampleSection,
  onOpenMessageSection,
}: HistoryTimelineProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // State for which question has the inline reply box open
  const [replyingToId, setReplyingToId] = useState<string | null>(null);

  // Mutation to mark question as resolved
  const resolveQuestionMutation = useMutation({
    mutationFn: async (activityId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('development_card_activity')
        .update({
          metadata: {
            resolved: true,
            resolved_at: new Date().toISOString(),
            resolved_by: user.id,
          },
        })
        .eq('id', activityId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      toast({ title: 'Question marked as resolved' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to resolve question', variant: 'destructive' });
    },
  });

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['development-card-activity', cardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('development_card_activity')
        .select('*')
        .eq('card_id', cardId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // Fetch profiles for activities
      const userIds = [...new Set(data.map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.user_id] = p;
        return acc;
      }, {} as Record<string, { full_name: string | null; email: string | null }>);

      return data.map(activity => ({
        ...activity,
        profile: profileMap[activity.user_id] || null,
      })) as Activity[];
    },
  });

  // Real-time subscription for activity updates
  useEffect(() => {
    const channel = supabase
      .channel(`activity-${cardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'development_card_activity',
          filter: `card_id=eq.${cardId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cardId, queryClient]);

  // Use activities from database directly (no synthetic creation activity)
  const allActivities: Activity[] = activities;

  const groupedActivities = groupByDate(allActivities);
  const sortedDates = Object.keys(groupedActivities).sort((a, b) => b.localeCompare(a));

  const getInitials = (profile: Activity['profile']) => {
    if (profile?.full_name) {
      return profile.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (profile?.email) {
      return profile.email[0].toUpperCase();
    }
    return '?';
  };

  // Find the first unresolved question for keyboard shortcut / attention banner
  const firstUnresolvedQuestion = activities.find(a => 
    a.activity_type === 'question' && !a.metadata?.resolved
  );

  // Handle opening reply for the first unresolved question
  const handleOpenFirstReply = () => {
    if (firstUnresolvedQuestion) {
      setReplyingToId(firstUnresolvedQuestion.id);
    }
  };

  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        Loading timeline...
      </div>
    );
  }

  if (allActivities.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
        No activity yet
      </div>
    );
  }

  // Find the triggering action for attention banner (prioritize unresolved questions)
  const otherTriggerActivity = activities.find(a => 
    ['commercial_update', 'ownership_change'].includes(a.activity_type)
  );
  const triggerActivity = firstUnresolvedQuestion || otherTriggerActivity;

  // Find the most recent commercial update activity (regardless of position)
  const mostRecentCommercialUpdate = activities.find(a => 
    a.activity_type === 'commercial_update'
  );

  // Find ownership changes triggered by commercial data
  const commercialTriggeredMove = activities.find(a => 
    a.activity_type === 'ownership_change' && 
    a.metadata?.trigger === 'commercial'
  );

  // Show next step prompt when commercial data was recently set and no unresolved questions
  const showNextStepPrompt = 
    showAttentionBanner && 
    !firstUnresolvedQuestion &&
    (mostRecentCommercialUpdate || commercialTriggeredMove);
  
  // Determine trigger type for prompt messaging
  const promptTriggerType = mostRecentCommercialUpdate ? 'commercial' : 'ownership';

  return (
    <div className="space-y-6 py-4">
      {/* Next Step Prompt - when commercial data was set and no unresolved questions */}
      {showNextStepPrompt && onOpenSampleSection && onOpenMessageSection && (
        <NextStepPrompt
          cardType={cardType}
          triggerType={promptTriggerType}
          onRequestSample={() => onOpenSampleSection()}
          onAskQuestion={() => onOpenMessageSection('question')}
          onAddComment={() => onOpenMessageSection('comment')}
        />
      )}
      
      {/* Attention Banner - when there's an unresolved question */}
      {showAttentionBanner && firstUnresolvedQuestion && (
        <AttentionBanner 
          activity={firstUnresolvedQuestion} 
          onReply={handleOpenFirstReply} 
        />
      )}
      
      {sortedDates.map((dateKey) => (
        <div key={dateKey}>
          <div className="sticky top-0 bg-background py-1 mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {formatDateHeader(dateKey + 'T00:00:00')}
            </span>
          </div>
          
          <div className="space-y-2">
            {groupedActivities[dateKey].map((activity) => {
              // Render compact row for system activities
              if (isCompactActivity(activity.activity_type)) {
                return <CompactActivityRow key={activity.id} activity={activity} />;
              }
              
              const isQuestion = activity.activity_type === 'question';
              const isAnswer = activity.activity_type === 'answer';
              const isResolved = isQuestion && activity.metadata?.resolved;
              
              return (
                <div key={activity.id}>
                  <div 
                    className={cn(
                      "flex gap-3 p-3 rounded-lg border",
                      isResolved 
                        ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800"
                        : ACTIVITY_STYLES[activity.activity_type] || ACTIVITY_STYLES.comment
                    )}
                  >
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      <AvatarFallback className="text-xs bg-background">
                        {getInitials(activity.profile)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {activity.profile?.full_name || activity.profile?.email || 'Unknown'}
                        </span>
                        <span className="flex items-center gap-1 text-xs">
                          {isResolved ? <Check className="h-3.5 w-3.5" /> : (ACTIVITY_ICONS[activity.activity_type] || ACTIVITY_ICONS.comment)}
                          {isResolved ? 'question resolved' : (ACTIVITY_LABELS[activity.activity_type] || activity.activity_type)}
                        </span>
                        <span className="text-xs opacity-70">
                          {format(parseISO(activity.created_at), 'HH:mm')}
                        </span>
                        {isResolved && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-100 border-green-300 text-green-700 dark:bg-green-900 dark:border-green-700 dark:text-green-200">
                            Resolved
                          </Badge>
                        )}
                      </div>
                      
                      {activity.content && (
                        <p className={cn(
                          "text-sm mt-1 whitespace-pre-wrap",
                          isResolved && "line-through opacity-70"
                        )}>
                          {isQuestion ? (
                            <span className="italic">"{activity.content}"</span>
                          ) : (
                            activity.content
                          )}
                        </p>
                      )}
                      
                      {/* Action buttons for unresolved questions */}
                      {isQuestion && !isResolved && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900"
                            onClick={() => setReplyingToId(activity.id)}
                          >
                            <Reply className="h-3 w-3 mr-1" />
                            Reply
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900"
                            onClick={() => resolveQuestionMutation.mutate(activity.id)}
                            disabled={resolveQuestionMutation.isPending}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            {resolveQuestionMutation.isPending ? 'Resolving...' : 'Mark as Resolved'}
                          </Button>
                        </div>
                      )}
                      
                      {/* Metadata display for certain types */}
                      {activity.activity_type === 'commercial_update' && activity.metadata && (
                        <p className="text-xs mt-1 opacity-80">
                          {activity.metadata.field?.replace('_', ' ')}: {activity.metadata.value}
                        </p>
                      )}
                      
                      {/* Show which question this is a reply to */}
                      {(isAnswer || (activity.activity_type === 'comment' && activity.metadata?.reply_to_question)) && (
                        <p className="text-xs mt-1 opacity-70 italic">
                          ↳ Reply to question
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Inline Reply Box */}
                  {replyingToId === activity.id && (
                    <InlineReplyBox
                      questionId={activity.id}
                      cardId={cardId}
                      currentOwner={currentOwner}
                      onClose={() => setReplyingToId(null)}
                      onCardMove={onOwnerChange}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
