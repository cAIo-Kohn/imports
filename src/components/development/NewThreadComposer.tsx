import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle, HelpCircle, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { TimelineUploadButton, UploadedAttachment } from './TimelineUploadButton';
import { MentionInput } from '@/components/notifications/MentionInput';
import { createMentionNotifications } from '@/hooks/useNotifications';

interface NewThreadComposerProps {
  cardId: string;
  currentOwner?: 'mor' | 'arc';
  onClose: () => void;
  onCardMove?: () => void;
  autoFocus?: boolean;
  colorScheme?: 'violet' | 'emerald' | 'blue' | 'amber' | 'default';
}

export function NewThreadComposer({
  cardId,
  currentOwner,
  onClose,
  onCardMove,
  autoFocus = true,
  colorScheme = 'default',
}: NewThreadComposerProps) {
  const [threadTitle, setThreadTitle] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
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

  // Post as comment (no move)
  const postCommentMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || (!messageContent.trim() && attachments.length === 0)) return;

      const metadata: Record<string, any> = {};
      if (attachments.length > 0) {
        metadata.attachments = attachments.map(a => ({ id: a.id, name: a.name, url: a.url, type: a.type }));
      }

      // Insert the comment
      const { data, error } = await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'comment',
        content: messageContent.trim() || null,
        thread_title: threadTitle.trim() || null,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      }).select('id').single();
      if (error) throw error;

      // Set thread_id and thread_root_id to itself (new thread root)
      if (data?.id) {
        await supabase.from('development_card_activity')
          .update({ thread_id: data.id, thread_root_id: data.id })
          .eq('id', data.id);

        // Create mention notifications
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
      onClose();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to start thread', variant: 'destructive' });
    },
  });

  // Post as question (moves card)
  const postQuestionMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || (!messageContent.trim() && attachments.length === 0)) return;

      const targetOwner = currentOwner === 'arc' ? 'mor' : 'arc';

      const metadata: Record<string, any> = {
        moved_from: currentOwner,
        moved_to: targetOwner,
      };
      if (attachments.length > 0) {
        metadata.attachments = attachments.map(a => ({ id: a.id, name: a.name, url: a.url, type: a.type }));
      }

      // Insert the question
      const { data, error } = await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'question',
        content: messageContent.trim() || null,
        thread_title: threadTitle.trim() || null,
        metadata,
      }).select('id').single();
      if (error) throw error;

      // Set thread_id and thread_root_id to itself (new thread root)
      if (data?.id) {
        await supabase.from('development_card_activity')
          .update({ thread_id: data.id, thread_root_id: data.id })
          .eq('id', data.id);

        // Create mention notifications
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

      // Update card: set pending action and move to other team
      const { error: cardError } = await (supabase.from('development_items') as any)
        .update({
          current_owner: targetOwner,
          is_new_for_other_team: true,
          pending_action_type: 'question',
          pending_action_due_at: null,
          pending_action_snoozed_until: null,
          pending_action_snoozed_by: null,
        })
        .eq('id', cardId);
      if (cardError) throw cardError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      const targetOwner = currentOwner === 'arc' ? 'mor' : 'arc';
      toast({ title: `Question posted. Card moved to ${targetOwner === 'mor' ? 'MOR (Brazil)' : 'ARC (China)'}` });
      resetForm();
      onClose();
      onCardMove?.();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to post question', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setThreadTitle('');
    setMessageContent('');
    setAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const isPending = postCommentMutation.isPending || postQuestionMutation.isPending;
  const canSubmit = messageContent.trim() || attachments.length > 0;
  const targetTeam = currentOwner === 'arc' ? 'MOR' : 'ARC';

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

      {/* Attachments */}
      <div className="mt-2">
        <TimelineUploadButton
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          variant="icon"
          disabled={isPending}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-3 justify-end flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => postCommentMutation.mutate()}
          disabled={!canSubmit || isPending}
        >
          <MessageCircle className="h-3 w-3 mr-1" />
          {postCommentMutation.isPending ? 'Posting...' : 'Post as Comment'}
        </Button>

        {currentOwner && (
          <Button
            size="sm"
            onClick={() => postQuestionMutation.mutate()}
            disabled={!canSubmit || isPending}
          >
            <HelpCircle className="h-3 w-3 mr-1" />
            {postQuestionMutation.isPending ? 'Posting...' : `Ask ${targetTeam}`}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
