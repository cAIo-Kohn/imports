import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { TimelineUploadButton, UploadedAttachment } from './TimelineUploadButton';
import { SnoozeButton } from './SnoozeButton';

interface InlineReplyBoxProps {
  replyToId: string;
  replyToType: 'question' | 'answer';
  cardId: string;
  currentOwner: 'mor' | 'arc';
  pendingActionType?: string | null;
  onClose: () => void;
  onCardMove?: () => void;
}

export function InlineReplyBox({ 
  replyToId, 
  replyToType,
  cardId, 
  currentOwner, 
  pendingActionType,
  onClose, 
  onCardMove 
}: InlineReplyBoxProps) {
  const [replyContent, setReplyContent] = useState('');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Build metadata with attachments and reply reference
  const buildMetadata = (includeReplyRef = true) => {
    const metadata: Record<string, any> = {};
    if (includeReplyRef) {
      metadata[replyToType === 'question' ? 'reply_to_question' : 'reply_to_answer'] = replyToId;
    }
    if (attachments.length > 0) {
      metadata.attachments = attachments;
    }
    return Object.keys(metadata).length > 0 ? metadata : null;
  };

  // Reply as comment (no move)
  const commentReplyMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || (!replyContent.trim() && attachments.length === 0)) return;
      
      const { error } = await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'comment',
        content: replyContent.trim() || null,
        metadata: buildMetadata(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      toast({ title: 'Reply added' });
      setReplyContent('');
      setAttachments([]);
      onClose();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add reply', variant: 'destructive' });
    },
  });

  // Reply as answer (moves card + resolves question) - only for questions
  const answerReplyMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || (!replyContent.trim() && attachments.length === 0)) return;
      
      const targetOwner = currentOwner === 'arc' ? 'mor' : 'arc';
      
      // 1. Insert answer activity with embedded move info
      const { error: insertError } = await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'answer',
        content: replyContent.trim() || null,
        metadata: {
          ...buildMetadata(),
          moved_from: currentOwner,
          moved_to: targetOwner,
        },
      });
      if (insertError) throw insertError;

      // 2. Fetch existing metadata from the question to preserve attachments
      const { data: questionActivity, error: fetchError } = await supabase
        .from('development_card_activity')
        .select('metadata')
        .eq('id', replyToId)
        .single();

      if (fetchError) throw fetchError;

      const existingQuestionMetadata = (questionActivity?.metadata as Record<string, any>) || {};

      // 3. Mark question as resolved while preserving existing metadata
      const { error: resolveError } = await supabase
        .from('development_card_activity')
        .update({
          metadata: {
            ...existingQuestionMetadata,
            resolved: true,
            resolved_at: new Date().toISOString(),
            resolved_by: user.id,
          },
        })
        .eq('id', replyToId);
      if (resolveError) throw resolveError;

      // 4. Move card to other team and set answer_pending
      const { error: moveError } = await (supabase.from('development_items') as any)
        .update({ 
          current_owner: targetOwner,
          is_new_for_other_team: true,
          pending_action_type: 'answer_pending',
          pending_action_due_at: null,
          pending_action_snoozed_until: null,
          pending_action_snoozed_by: null,
        })
        .eq('id', cardId);
      if (moveError) throw moveError;

      // NO separate ownership_change entry - move is embedded in answer activity
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      const targetOwner = currentOwner === 'arc' ? 'mor' : 'arc';
      toast({ title: `Answer posted. Card moved to ${targetOwner === 'mor' ? 'MOR (Brazil)' : 'ARC (China)'}` });
      setReplyContent('');
      setAttachments([]);
      onClose();
      onCardMove?.();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to post answer', variant: 'destructive' });
    },
  });

  // Ask follow-up question (for replying to answers) - moves card
  const followUpQuestionMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || (!replyContent.trim() && attachments.length === 0)) return;
      
      const targetOwner = currentOwner === 'arc' ? 'mor' : 'arc';
      
      // 1. Insert question activity with reference to the answer and embedded move info
      const { error: insertError } = await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'question',
        content: replyContent.trim() || null,
        metadata: {
          ...buildMetadata(false),
          reply_to_answer: replyToId,
          moved_from: currentOwner,
          moved_to: targetOwner,
        },
      });
      if (insertError) throw insertError;

      // 2. Move card to other team and set question pending
      const { error: moveError } = await (supabase.from('development_items') as any)
        .update({ 
          current_owner: targetOwner,
          is_new_for_other_team: true,
          pending_action_type: 'question',
          pending_action_due_at: null,
          pending_action_snoozed_until: null,
          pending_action_snoozed_by: null,
        })
        .eq('id', cardId);
      if (moveError) throw moveError;

      // NO separate ownership_change entry - move is embedded in question activity
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      const targetOwner = currentOwner === 'arc' ? 'mor' : 'arc';
      toast({ title: `Follow-up question posted. Card moved to ${targetOwner === 'mor' ? 'MOR (Brazil)' : 'ARC (China)'}` });
      setReplyContent('');
      setAttachments([]);
      onClose();
      onCardMove?.();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to post follow-up question', variant: 'destructive' });
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Escape to close
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const isPending = commentReplyMutation.isPending || answerReplyMutation.isPending || followUpQuestionMutation.isPending;
  const targetTeam = currentOwner === 'arc' ? 'MOR' : 'ARC';
  const canSubmit = replyContent.trim() || attachments.length > 0;

  return (
    <div className="mt-3 p-3 bg-muted/50 rounded-lg border">
      <Textarea
        ref={textareaRef}
        value={replyContent}
        onChange={(e) => setReplyContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={replyToType === 'answer' ? "Type your reply or follow-up question..." : "Type your reply..."}
        rows={2}
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
      
      <div className="flex gap-2 mt-2 justify-end flex-wrap">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
        
        {/* Snooze button - allows user to delay the pending action */}
        <SnoozeButton
          cardId={cardId}
          currentActionType={pendingActionType}
          variant="outline"
          size="sm"
        />
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => commentReplyMutation.mutate()}
          disabled={!canSubmit || isPending}
        >
          {commentReplyMutation.isPending ? 'Sending...' : 'Just Comment'}
        </Button>
        
        {replyToType === 'question' ? (
          // Replying to a question: Answer & Move
          <Button 
            size="sm" 
            onClick={() => answerReplyMutation.mutate()}
            disabled={!canSubmit || isPending}
          >
            {answerReplyMutation.isPending ? 'Sending...' : `Answer & Move to ${targetTeam}`}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        ) : (
          // Replying to an answer: Ask Follow-up & Move
          <Button 
            size="sm" 
            onClick={() => followUpQuestionMutation.mutate()}
            disabled={!canSubmit || isPending}
          >
            {followUpQuestionMutation.isPending ? 'Sending...' : `Ask Follow-up & Move to ${targetTeam}`}
            <HelpCircle className="h-3 w-3 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
