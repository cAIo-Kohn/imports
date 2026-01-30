import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { TimelineUploadButton, UploadedAttachment } from './TimelineUploadButton';
import { MentionInput } from '@/components/notifications/MentionInput';
import { createMentionNotifications } from '@/hooks/useNotifications';
import { ThreadAssignmentSelect } from './ThreadAssignmentSelect';
import { AppRole } from '@/hooks/useUserRole';

interface AssignedUser {
  id: string;
  name: string;
  email: string;
}

interface NewThreadComposerProps {
  cardId: string;
  currentOwner?: 'mor' | 'arc';
  onClose: () => void;
  onCardMove?: () => void;
  onActionComplete?: () => void;
  autoFocus?: boolean;
  colorScheme?: 'violet' | 'emerald' | 'blue' | 'amber' | 'default';
}

export function NewThreadComposer({
  cardId,
  currentOwner,
  onClose,
  onCardMove,
  onActionComplete,
  autoFocus = true,
  colorScheme = 'default',
}: NewThreadComposerProps) {
  const [threadTitle, setThreadTitle] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
  const [assignedRole, setAssignedRole] = useState<AppRole | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      titleInputRef.current?.focus();
    }
  }, [autoFocus]);

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

  // Post thread with assignment
  const postThreadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || (!messageContent.trim() && attachments.length === 0)) return;

      const metadata: Record<string, any> = {};
      if (attachments.length > 0) {
        metadata.attachments = attachments.map(a => ({ id: a.id, name: a.name, url: a.url, type: a.type }));
      }

      // Store assigned user names for display
      if (assignedUsers.length > 0) {
        metadata.assigned_user_names = assignedUsers.map(u => u.name);
      }

      // Insert the thread root with assignment info
      const { data, error } = await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'comment',
        content: messageContent.trim() || null,
        thread_title: threadTitle.trim() || null,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
        assigned_to_users: assignedUsers.map(u => u.id),
        assigned_to_role: assignedRole,
        thread_creator_id: user.id,
        thread_status: 'open',
      }).select('id').single();
      if (error) throw error;

      // Set thread_id and thread_root_id to itself (new thread root)
      if (data?.id) {
        await supabase.from('development_card_activity')
          .update({ thread_id: data.id, thread_root_id: data.id })
          .eq('id', data.id);

        // Create mention notifications for assigned users
        for (const assignedUser of assignedUsers) {
          if (assignedUser.id !== user.id) {
            await supabase.from('notifications').insert({
              user_id: assignedUser.id,
              triggered_by: user.id,
              type: 'thread_assigned',
              title: `You were assigned to a thread`,
              content: threadTitle.trim() || messageContent.trim().slice(0, 100) || 'New thread',
              card_id: cardId,
              activity_id: data.id,
            });
          }
        }

        // Also create @mention notifications from content
        if (messageContent.trim()) {
          await createMentionNotifications({
            text: messageContent,
            cardId,
            activityId: data.id,
            triggeredBy: user.id,
            cardTitle: cardData?.title || 'Development Card',
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      toast({ title: 'Thread started' });
      resetForm();
      onActionComplete?.();
      onClose();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to start thread', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setThreadTitle('');
    setMessageContent('');
    setAttachments([]);
    setAssignedUsers([]);
    setAssignedRole(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const isPending = postThreadMutation.isPending;
  const hasAssignment = assignedUsers.length > 0 || assignedRole !== null;
  const canSubmit = (messageContent.trim() || attachments.length > 0) && hasAssignment;

  // Color scheme classes
  const bgClasses: Record<string, string> = {
    violet: 'bg-violet-50/50 dark:bg-violet-950/20',
    emerald: 'bg-emerald-50/50 dark:bg-emerald-950/20',
    blue: 'bg-blue-50/50 dark:bg-blue-950/20',
    amber: 'bg-amber-50/50 dark:bg-amber-950/20',
    default: 'bg-muted/50',
  };

  return (
    <div className={`rounded-lg p-4 border ${bgClasses[colorScheme]}`}>
      <div className="flex items-center justify-between mb-3">
        <Label className="text-sm font-medium">New Thread</Label>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Thread Title */}
      <div className="mb-3">
        <Input
          ref={titleInputRef}
          value={threadTitle}
          onChange={(e) => setThreadTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Thread title (optional)"
          className="text-sm"
          disabled={isPending}
        />
      </div>

      {/* Message Content */}
      <MentionInput
        value={messageContent}
        onChange={setMessageContent}
        onKeyDown={handleKeyDown}
        placeholder="Type your message... Use @ to mention"
        rows={3}
        className="text-sm bg-background"
        disabled={isPending}
      />

      {/* Assignment Section */}
      <div className="mt-3">
        <Label className="text-xs text-muted-foreground mb-1.5 block">
          Assign to (required)
        </Label>
        <ThreadAssignmentSelect
          assignedUsers={assignedUsers}
          assignedRole={assignedRole}
          onAssignedUsersChange={setAssignedUsers}
          onAssignedRoleChange={setAssignedRole}
          disabled={isPending}
          required
        />
      </div>

      {/* Attachments */}
      <div className="mt-3">
        <TimelineUploadButton
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          variant="icon"
          disabled={isPending}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-4 justify-end flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>

        <Button
          size="sm"
          onClick={() => postThreadMutation.mutate()}
          disabled={!canSubmit || isPending}
        >
          <Send className="h-3 w-3 mr-1" />
          {postThreadMutation.isPending ? 'Posting...' : 'Post Thread'}
        </Button>
      </div>
    </div>
  );
}
