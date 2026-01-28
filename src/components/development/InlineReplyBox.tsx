import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

interface InlineReplyBoxProps {
  questionId: string;
  cardId: string;
  currentOwner: 'mor' | 'arc';
  onClose: () => void;
  onCardMove?: () => void;
}

export function InlineReplyBox({ 
  questionId, 
  cardId, 
  currentOwner, 
  onClose, 
  onCardMove 
}: InlineReplyBoxProps) {
  const [replyContent, setReplyContent] = useState('');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Reply as comment (no move)
  const commentReplyMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !replyContent.trim()) return;
      
      const { error } = await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'comment',
        content: replyContent.trim(),
        metadata: { reply_to_question: questionId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      toast({ title: 'Reply added' });
      setReplyContent('');
      onClose();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add reply', variant: 'destructive' });
    },
  });

  // Reply as answer (moves card + resolves question)
  const answerReplyMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !replyContent.trim()) return;
      
      // 1. Insert answer activity
      const { error: insertError } = await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'answer',
        content: replyContent.trim(),
        metadata: { reply_to_question: questionId },
      });
      if (insertError) throw insertError;

      // 2. Mark question as resolved
      const { error: resolveError } = await supabase
        .from('development_card_activity')
        .update({
          metadata: {
            resolved: true,
            resolved_at: new Date().toISOString(),
            resolved_by: user.id,
          },
        })
        .eq('id', questionId);
      if (resolveError) throw resolveError;

      // 3. Move card to other team
      const targetOwner = currentOwner === 'arc' ? 'mor' : 'arc';
      const { error: moveError } = await (supabase.from('development_items') as any)
        .update({ 
          current_owner: targetOwner,
          is_new_for_other_team: true,
        })
        .eq('id', cardId);
      if (moveError) throw moveError;

      // 4. Log ownership change
      await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'ownership_change',
        content: `Card moved to ${targetOwner === 'mor' ? 'MOR (Brazil)' : 'ARC (China)'}`,
        metadata: { new_owner: targetOwner, trigger: 'answer' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      const targetOwner = currentOwner === 'arc' ? 'mor' : 'arc';
      toast({ title: `Answer posted. Card moved to ${targetOwner === 'mor' ? 'MOR (Brazil)' : 'ARC (China)'}` });
      setReplyContent('');
      onClose();
      onCardMove?.();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to post answer', variant: 'destructive' });
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Escape to close
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const isPending = commentReplyMutation.isPending || answerReplyMutation.isPending;
  const targetTeam = currentOwner === 'arc' ? 'MOR' : 'ARC';

  return (
    <div className="mt-3 p-3 bg-muted/50 rounded-lg border">
      <Textarea
        ref={textareaRef}
        value={replyContent}
        onChange={(e) => setReplyContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your reply..."
        rows={2}
        className="text-sm bg-background"
        disabled={isPending}
      />
      <div className="flex gap-2 mt-2 justify-end flex-wrap">
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
          onClick={() => commentReplyMutation.mutate()}
          disabled={!replyContent.trim() || isPending}
        >
          {commentReplyMutation.isPending ? 'Sending...' : 'Just Comment'}
        </Button>
        <Button 
          size="sm" 
          onClick={() => answerReplyMutation.mutate()}
          disabled={!replyContent.trim() || isPending}
        >
          {answerReplyMutation.isPending ? 'Sending...' : `Answer & Move to ${targetTeam}`}
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}
