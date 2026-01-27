import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { format } from 'date-fns';
import { Send, MessageCircle, ArrowRight, Package, Plus, CheckCircle, HelpCircle, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { MoveCardModal } from './MoveCardModal';

interface Activity {
  id: string;
  card_id: string;
  user_id: string;
  activity_type: string;
  content: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  profile?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

interface UnifiedActivityTimelineProps {
  cardId: string;
  canComment: boolean;
  currentOwner: 'mor' | 'arc';
  onOwnerChange?: (newOwner: 'mor' | 'arc') => void;
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  comment: <MessageCircle className="h-3 w-3" />,
  question: <HelpCircle className="h-3 w-3" />,
  status_change: <ArrowRight className="h-3 w-3" />,
  sample_added: <Package className="h-3 w-3" />,
  product_added: <Plus className="h-3 w-3" />,
  created: <CheckCircle className="h-3 w-3" />,
  ownership_change: <ArrowLeftRight className="h-3 w-3" />,
};

const ACTIVITY_COLORS: Record<string, string> = {
  comment: 'bg-blue-100 text-blue-600',
  question: 'bg-purple-100 text-purple-600',
  status_change: 'bg-amber-100 text-amber-600',
  sample_added: 'bg-purple-100 text-purple-600',
  product_added: 'bg-teal-100 text-teal-600',
  created: 'bg-green-100 text-green-600',
  ownership_change: 'bg-indigo-100 text-indigo-600',
};

export function UnifiedActivityTimeline({ cardId, canComment, currentOwner, onOwnerChange }: UnifiedActivityTimelineProps) {
  const { user } = useAuth();
  const { isTrader, isBuyer } = useUserRole();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const [messageType, setMessageType] = useState<'comment' | 'question'>('comment');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'comment' | 'question'; content: string } | null>(null);

  // Determine target owner for questions
  const getTargetOwner = (): 'mor' | 'arc' => {
    // If trader asks question, move to MOR; if buyer, move to ARC
    return isTrader ? 'mor' : 'arc';
  };

  // Fetch activities
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
        metadata: activity.metadata as Record<string, unknown> | null,
        profile: profileMap[activity.user_id] || null,
      })) as Activity[];
    },
  });

  const addActivityMutation = useMutation({
    mutationFn: async ({ type, content }: { type: 'comment' | 'question'; content: string }) => {
      if (!user?.id || !content.trim()) return;
      
      const { error } = await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: type,
        content: content.trim(),
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      setNewMessage('');
      toast({ title: variables.type === 'question' ? 'Question posted' : 'Comment added' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add activity', variant: 'destructive' });
    },
  });

  const moveCardMutation = useMutation({
    mutationFn: async (targetOwner: 'mor' | 'arc') => {
      if (!user?.id) return;
      
      // Update card owner
      const { error } = await (supabase.from('development_items') as any)
        .update({ 
          current_owner: targetOwner,
          is_new_for_other_team: true,
        })
        .eq('id', cardId);
      if (error) throw error;

      // Log the movement
      await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'ownership_change',
        content: `Card moved to ${targetOwner === 'mor' ? 'MOR (Brazil)' : 'ARC (China)'}`,
        metadata: { new_owner: targetOwner },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      onOwnerChange?.(getTargetOwner());
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    if (messageType === 'question') {
      // Questions trigger the move prompt
      setPendingAction({ type: 'question', content: newMessage });
      setShowMoveModal(true);
    } else {
      // Comments don't move cards
      addActivityMutation.mutate({ type: 'comment', content: newMessage });
    }
  };

  const handleMoveConfirm = async () => {
    if (!pendingAction) return;
    
    // First add the activity
    await addActivityMutation.mutateAsync({ type: pendingAction.type, content: pendingAction.content });
    
    // Then move the card
    await moveCardMutation.mutateAsync(getTargetOwner());
    
    setPendingAction(null);
    setShowMoveModal(false);
  };

  const handleMoveCancel = async () => {
    if (!pendingAction) return;
    
    // Just add the activity without moving
    await addActivityMutation.mutateAsync({ type: pendingAction.type, content: pendingAction.content });
    
    setPendingAction(null);
    setShowMoveModal(false);
  };

  const getActivityLabel = (activity: Activity) => {
    switch (activity.activity_type) {
      case 'comment':
        return 'commented';
      case 'question':
        return 'asked a question';
      case 'status_change':
        return `changed status to ${activity.metadata?.new_status || 'unknown'}`;
      case 'sample_added':
        return 'added a sample';
      case 'product_added':
        return 'added a product';
      case 'ownership_change':
        return activity.content || 'moved the card';
      case 'created':
        return activity.content || 'created this card';
      default:
        return activity.activity_type.replace(/_/g, ' ');
    }
  };

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

  return (
    <div className="space-y-4">
      {/* Comment/Question Input */}
      {canComment && (
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Toggle between Comment and Question */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={messageType === 'comment' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMessageType('comment')}
              className="flex items-center gap-1"
            >
              <MessageCircle className="h-3 w-3" />
              Comment
            </Button>
            <Button
              type="button"
              variant={messageType === 'question' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMessageType('question')}
              className="flex items-center gap-1"
            >
              <HelpCircle className="h-3 w-3" />
              Question
            </Button>
          </div>
          
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={messageType === 'question' 
              ? "Ask a question that requires the other team's input..."
              : "Add a comment or update..."
            }
            rows={2}
          />
          <div className="flex justify-between items-center">
            {messageType === 'question' && (
              <p className="text-xs text-muted-foreground">
                Questions will prompt to move the card
              </p>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={!newMessage.trim() || addActivityMutation.isPending}
              className="ml-auto"
            >
              <Send className="h-3 w-3 mr-1" />
              {addActivityMutation.isPending ? 'Sending...' : messageType === 'question' ? 'Ask' : 'Send'}
            </Button>
          </div>
        </form>
      )}

      {/* Activity List */}
      <div className="space-y-4">
        {isLoading ? (
          <p className="text-center text-muted-foreground py-4">Loading...</p>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No activity yet</p>
          </div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="flex gap-3">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="text-xs bg-primary/10">
                  {getInitials(activity.profile)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">
                    {activity.profile?.full_name || activity.profile?.email || 'Unknown'}
                  </span>
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full flex items-center gap-1',
                      ACTIVITY_COLORS[activity.activity_type] || 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {ACTIVITY_ICONS[activity.activity_type]}
                    {getActivityLabel(activity)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(activity.created_at), 'dd/MM/yyyy HH:mm')}
                  </span>
                </div>
                {(activity.activity_type === 'comment' || activity.activity_type === 'question') && activity.content && (
                  <p className={cn(
                    "text-sm text-muted-foreground mt-1 whitespace-pre-wrap rounded-md p-2",
                    activity.activity_type === 'question' ? 'bg-purple-50 border border-purple-200' : 'bg-muted/50'
                  )}>
                    {activity.content}
                  </p>
                )}
                {activity.activity_type === 'sample_added' && activity.metadata && (
                  <div className="text-sm text-muted-foreground mt-1 bg-muted/50 rounded-md p-2">
                    {activity.metadata.courier && (
                      <span>Courier: {String(activity.metadata.courier)}</span>
                    )}
                    {activity.metadata.tracking && (
                      <span className="ml-2">| Tracking: {String(activity.metadata.tracking)}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Move Card Modal */}
      <MoveCardModal
        open={showMoveModal}
        onOpenChange={setShowMoveModal}
        targetOwner={getTargetOwner()}
        onConfirm={handleMoveConfirm}
        onCancel={handleMoveCancel}
        triggerAction="asked a question"
      />
    </div>
  );
}
