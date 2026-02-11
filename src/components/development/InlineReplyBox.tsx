import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, HelpCircle, RotateCcw, Send, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { TimelineUploadButton, UploadedAttachment } from './TimelineUploadButton';
import { SnoozeButton } from './SnoozeButton';
import { MentionInput } from '@/components/notifications/MentionInput';
import { createMentionNotifications } from '@/hooks/useNotifications';
import { ThreadAssignmentSelect } from './ThreadAssignmentSelect';
import { AppRole } from '@/hooks/useUserRole';
import { useRoleColors } from '@/hooks/useRoleColors';
import { cn } from '@/lib/utils';

interface AssignedUser {
  id: string;
  name: string;
  email: string;
}

interface InlineReplyBoxProps {
  replyToId: string;
  replyToType: 'question' | 'answer' | 'comment' | 'sample_requested' | 'card_created';
  cardId: string;
  currentOwner?: 'mor' | 'arc';
  pendingActionType?: string | null;
  threadId?: string | null;
  onClose: () => void;
  onCardMove?: () => void;
  threadCreatorId?: string | null;
  assignedToUsers?: string[];
  assignedToRole?: AppRole | null;
  cardCreatorId?: string | null; // Used for "Ask Question" to reassign to card creator
}

const ROLE_LABELS: Record<string, string> = {
  buyer: 'Comex',
  marketing: 'Marketing',
  quality: 'Quality',
  trader: 'ARC',
  admin: 'Admin',
  viewer: 'Viewer',
};

export function InlineReplyBox({ 
  replyToId, 
  replyToType,
  cardId, 
  currentOwner, 
  pendingActionType,
  threadId,
  onClose, 
  onCardMove,
  threadCreatorId,
  assignedToUsers = [],
  assignedToRole,
  cardCreatorId,
}: InlineReplyBoxProps) {
  const [replyContent, setReplyContent] = useState('');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [showReassign, setShowReassign] = useState(false);
  const [newAssignedUsers, setNewAssignedUsers] = useState<AssignedUser[]>([]);
  const [newAssignedRole, setNewAssignedRole] = useState<AppRole | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { getColorForRole } = useRoleColors();

  // Fetch thread creator profile for "Back to Creator" option
  const { data: creatorProfile } = useQuery({
    queryKey: ['user-profile', threadCreatorId],
    queryFn: async () => {
      if (!threadCreatorId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('user_id', threadCreatorId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!threadCreatorId,
  });

  // Fetch card title for notification content
  const { data: cardData } = useQuery({
    queryKey: ['development-item-title', cardId],
    queryFn: async () => {
      const { data } = await supabase
        .from('development_items')
        .select('title')
        .eq('id', cardId)
        .single();
      return data;
    },
  });

  // Build metadata with attachments and reply reference
  const buildMetadata = (includeReplyRef = true) => {
    const metadata: Record<string, any> = {};
    if (includeReplyRef) {
      if (replyToType === 'question') {
        metadata.reply_to_question = replyToId;
      } else if (replyToType === 'answer') {
        metadata.reply_to_answer = replyToId;
      } else if (replyToType === 'comment') {
        metadata.reply_to_comment = replyToId;
      }
    }
    if (attachments.length > 0) {
      metadata.attachments = attachments;
    }
    return Object.keys(metadata).length > 0 ? metadata : null;
  };

  // Reply as comment (no reassignment - just adds info to thread)
  const commentReplyMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || (!replyContent.trim() && attachments.length === 0)) return;
      
      // Use provided threadId, or fallback to replyToId as thread root
      const effectiveThreadId = threadId || replyToId;
      
      const { data, error } = await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'comment',
        content: replyContent.trim() || null,
        metadata: buildMetadata(),
        thread_id: effectiveThreadId,
        thread_root_id: effectiveThreadId,
      }).select('id').single();
      if (error) throw error;
      
      // Create mention notifications
      if (data?.id && replyContent.trim()) {
        await createMentionNotifications({
          text: replyContent,
          cardId,
          activityId: data.id,
          triggeredBy: user.id,
          cardTitle: cardData?.title || 'Development Card',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      toast({ title: 'Comment added' });
      setReplyContent('');
      setAttachments([]);
      onClose();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add comment', variant: 'destructive' });
    },
  });

  // Reply as answer and auto-reassign to card creator (for asking questions back)
  const answerToCardCreatorMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !cardCreatorId || (!replyContent.trim() && attachments.length === 0)) return;
      
      const effectiveThreadId = threadId || replyToId;
      
      // 1. Insert the question activity
      const { data, error } = await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'question',
        content: replyContent.trim() || null,
        metadata: {
          ...buildMetadata(),
          reassigned_to_card_creator: true,
        },
        thread_id: effectiveThreadId,
        thread_root_id: effectiveThreadId,
      }).select('id').single();
      if (error) throw error;

      // 2. Update thread root to reassign to card creator
      const { error: updateError } = await supabase
        .from('development_card_activity')
        .update({
          assigned_to_users: [cardCreatorId],
          assigned_to_role: null,
        })
        .eq('id', effectiveThreadId);
      if (updateError) throw updateError;

      // 3. Notify card creator
      if (data?.id && cardCreatorId !== user.id) {
        await supabase.from('notifications').insert({
          user_id: cardCreatorId,
          triggered_by: user.id,
          type: 'question_asked',
          title: 'Question on your card',
          content: replyContent.trim().slice(0, 100) || 'New question',
          card_id: cardId,
          activity_id: data.id,
        });
      }

      // Create mention notifications
      if (data?.id && replyContent.trim()) {
        await createMentionNotifications({
          text: replyContent,
          cardId,
          activityId: data.id,
          triggeredBy: user.id,
          cardTitle: cardData?.title || 'Development Card',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      toast({ title: 'Question sent to card creator' });
      setReplyContent('');
      setAttachments([]);
      onClose();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to send question', variant: 'destructive' });
    },
  });

  // Reply and reassign to thread creator
  const replyBackToCreatorMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !threadCreatorId || (!replyContent.trim() && attachments.length === 0)) return;
      
      const effectiveThreadId = threadId || replyToId;
      
      // 1. Insert reply activity
      const { data, error } = await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'answer',
        content: replyContent.trim() || null,
        metadata: {
          ...buildMetadata(),
          reassigned_to_creator: true,
        },
        thread_id: effectiveThreadId,
        thread_root_id: effectiveThreadId,
      }).select('id').single();
      if (error) throw error;

      // 2. Update thread root to reassign to creator
      const { error: updateError } = await supabase
        .from('development_card_activity')
        .update({
          assigned_to_users: [threadCreatorId],
          assigned_to_role: null,
        })
        .eq('id', effectiveThreadId);
      if (updateError) throw updateError;

      // 3. Notify thread creator
      if (data?.id && threadCreatorId !== user.id) {
        await supabase.from('notifications').insert({
          user_id: threadCreatorId,
          triggered_by: user.id,
          type: 'thread_reply',
          title: 'Thread response - your turn',
          content: replyContent.trim().slice(0, 100) || 'New response',
          card_id: cardId,
          activity_id: data.id,
        });
      }

      // Create mention notifications
      if (data?.id && replyContent.trim()) {
        await createMentionNotifications({
          text: replyContent,
          cardId,
          activityId: data.id,
          triggeredBy: user.id,
          cardTitle: cardData?.title || 'Development Card',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      toast({ title: 'Reply sent back to thread creator' });
      setReplyContent('');
      setAttachments([]);
      onClose();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to send reply', variant: 'destructive' });
    },
  });

  // Reply and reassign to new users/role
  const replyAndReassignMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || (!replyContent.trim() && attachments.length === 0)) return;
      if (newAssignedUsers.length === 0 && !newAssignedRole) return;
      
      const effectiveThreadId = threadId || replyToId;
      
      // 1. Insert reply activity
      const metadata: Record<string, any> = {
        ...buildMetadata(),
        reassigned: true,
      };
      if (newAssignedUsers.length > 0) {
        metadata.reassigned_to_user_names = newAssignedUsers.map(u => u.name);
      }
      if (newAssignedRole) {
        metadata.reassigned_to_role = newAssignedRole;
      }

      const { data, error } = await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'answer',
        content: replyContent.trim() || null,
        metadata,
        thread_id: effectiveThreadId,
        thread_root_id: effectiveThreadId,
      }).select('id').single();
      if (error) throw error;

      // 2. Update thread root with new assignment
      const { error: updateError } = await supabase
        .from('development_card_activity')
        .update({
          assigned_to_users: newAssignedUsers.map(u => u.id),
          assigned_to_role: newAssignedRole,
        })
        .eq('id', effectiveThreadId);
      if (updateError) throw updateError;

      // 3. Notify new assignees
      for (const assignedUser of newAssignedUsers) {
        if (assignedUser.id !== user.id) {
          await supabase.from('notifications').insert({
            user_id: assignedUser.id,
            triggered_by: user.id,
            type: 'thread_assigned',
            title: 'Thread reassigned to you',
            content: replyContent.trim().slice(0, 100) || 'New assignment',
            card_id: cardId,
            activity_id: data?.id,
          });
        }
      }

      // Create mention notifications
      if (data?.id && replyContent.trim()) {
        await createMentionNotifications({
          text: replyContent,
          cardId,
          activityId: data.id,
          triggeredBy: user.id,
          cardTitle: cardData?.title || 'Development Card',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      toast({ title: 'Reply sent and thread reassigned' });
      setReplyContent('');
      setAttachments([]);
      setShowReassign(false);
      setNewAssignedUsers([]);
      setNewAssignedRole(null);
      onClose();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to send reply', variant: 'destructive' });
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Escape to close
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const isPending = commentReplyMutation.isPending || replyBackToCreatorMutation.isPending || replyAndReassignMutation.isPending || answerToCardCreatorMutation.isPending;
  const canSubmit = replyContent.trim() || attachments.length > 0;
  const canReassign = showReassign && (newAssignedUsers.length > 0 || newAssignedRole);
  
  const creatorName = creatorProfile?.full_name?.split(' ')[0] || 'Creator';
  const isCreator = user?.id === threadCreatorId;
  const isCardCreator = user?.id === cardCreatorId;
  const showAskQuestion = !isCardCreator && cardCreatorId; // Only show if not the card creator

  return (
    <div className="mt-3 p-3 bg-muted/50 rounded-lg border">
      <MentionInput
        value={replyContent}
        onChange={setReplyContent}
        onKeyDown={handleKeyDown}
        placeholder="Type your reply... Use @ to mention"
        rows={2}
        className="text-sm bg-background"
        disabled={isPending}
        autoFocus
      />
      
      {/* Attachments */}
      <div className="mt-2">
        <TimelineUploadButton
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          variant="icon"
          disabled={isPending}
        />
      </div>

      {/* Reassignment UI */}
      {showReassign && (
        <div className="mt-3 p-3 bg-background rounded-lg border">
          <div className="text-xs font-medium mb-2 text-muted-foreground">Reassign thread to:</div>
          <ThreadAssignmentSelect
            assignedUsers={newAssignedUsers}
            assignedRole={newAssignedRole}
            onAssignedUsersChange={setNewAssignedUsers}
            onAssignedRoleChange={setNewAssignedRole}
            disabled={isPending}
            required={false}
          />
        </div>
      )}
      
      <div className="flex gap-2 mt-3 justify-end flex-wrap">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
        
        {/* Snooze button */}
        <SnoozeButton
          cardId={cardId}
          currentActionType={pendingActionType}
          variant="outline"
          size="sm"
        />
        
        {/* Just Reply (comment) - no assignment change */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => commentReplyMutation.mutate()}
          disabled={!canSubmit || isPending}
        >
          <Send className="h-3 w-3 mr-1" />
          {commentReplyMutation.isPending ? 'Sending...' : 'Comment'}
        </Button>
        
        {/* Ask Question - reassigns to card creator */}
        {showAskQuestion && (
          <Button 
            variant="outline"
            size="sm" 
            onClick={() => answerToCardCreatorMutation.mutate()}
            disabled={!canSubmit || isPending}
            className="border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-600 dark:text-purple-300 dark:hover:bg-purple-900/30"
          >
            <HelpCircle className="h-3 w-3 mr-1" />
            {answerToCardCreatorMutation.isPending ? 'Sending...' : 'Ask Question'}
          </Button>
        )}
        
        {/* Reply & Back to Thread Creator - only if not the thread creator */}
        {!isCreator && threadCreatorId && (
          <Button 
            variant="outline"
            size="sm" 
            onClick={() => replyBackToCreatorMutation.mutate()}
            disabled={!canSubmit || isPending}
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-600 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            {replyBackToCreatorMutation.isPending ? 'Sending...' : `Answer ${creatorName}`}
          </Button>
        )}
        
        {/* Toggle Reassign UI */}
        {!showReassign ? (
          <Button 
            variant="outline"
            size="sm" 
            onClick={() => setShowReassign(true)}
            disabled={isPending}
          >
            <Users className="h-3 w-3 mr-1" />
            Reassign...
          </Button>
        ) : (
          <Button 
            size="sm" 
            onClick={() => replyAndReassignMutation.mutate()}
            disabled={!canSubmit || !canReassign || isPending}
          >
            <Send className="h-3 w-3 mr-1" />
            {replyAndReassignMutation.isPending ? 'Sending...' : 'Reply & Reassign'}
          </Button>
        )}
      </div>
    </div>
  );
}
