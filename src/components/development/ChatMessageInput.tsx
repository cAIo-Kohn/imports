import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { MentionInput } from '@/components/notifications/MentionInput';
import { createMentionNotifications } from '@/hooks/useNotifications';
import { TimelineUploadButton, UploadedAttachment } from './TimelineUploadButton';
import { ChatMessageData } from './ChatMessage';
import { parseMentionsFromText, useCardMentions } from '@/hooks/useCardMentions';

interface ChatMessageInputProps {
  cardId: string;
  cardTitle?: string;
  quotedMessage?: ChatMessageData | null;
  onClearQuote: () => void;
  onMessageSent?: () => void;
}

export function ChatMessageInput({
  cardId,
  cardTitle,
  quotedMessage,
  onClearQuote,
  onMessageSent,
}: ChatMessageInputProps) {
  const [messageContent, setMessageContent] = useState('');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { createMentions, resolveMentions } = useCardMentions(cardId);

  // Focus input when quote is set
  useEffect(() => {
    if (quotedMessage) {
      inputRef.current?.focus();
    }
  }, [quotedMessage]);

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || (!messageContent.trim() && attachments.length === 0)) return;

      const metadata: Record<string, any> = {};
      
      if (attachments.length > 0) {
        metadata.attachments = attachments.map(a => ({
          id: a.id,
          name: a.name,
          url: a.url,
          type: a.type,
        }));
      }
      
      if (quotedMessage) {
        metadata.quoted_message_id = quotedMessage.id;
      }

      const { data, error } = await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'message',
        content: messageContent.trim() || null,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      }).select('id').single();

      if (error) throw error;

      // Create mention notifications (existing behavior)
      if (data?.id && messageContent.trim()) {
        await createMentionNotifications({
          text: messageContent,
          cardId,
          activityId: data.id,
          triggeredBy: user.id,
          cardTitle: cardTitle || 'Development Card',
        });
        
        // Create unresolved mention entries for the new mention tracking system
        const { userIds, teamIds } = parseMentionsFromText(messageContent);
        if (userIds.length > 0 || teamIds.length > 0) {
          await createMentions({
            activityId: data.id,
            mentionedUserIds: userIds,
            mentionedTeamIds: teamIds,
          });
        }
      }
      
      // Resolve any mentions of the current user (they've replied)
      if (data?.id) {
        await resolveMentions({ resolvedByActivityId: data.id });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', cardId] });
      setMessageContent('');
      setAttachments([]);
      onClearQuote();
      onMessageSent?.();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (messageContent.trim() || attachments.length > 0) {
        sendMessageMutation.mutate();
      }
    }
    if (e.key === 'Escape' && quotedMessage) {
      onClearQuote();
    }
  };

  const isPending = sendMessageMutation.isPending;
  const canSend = messageContent.trim() || attachments.length > 0;

  return (
    <div className="border-t bg-background p-3">
      {/* Quoted message preview */}
      {quotedMessage && (
        <div className="flex items-start gap-2 mb-2 p-2 bg-muted rounded-lg">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-muted-foreground">
              Replying to {quotedMessage.profile?.full_name || 'Unknown'}
            </div>
            <div className="text-sm text-foreground line-clamp-2">
              {quotedMessage.content || 'Message'}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 flex-shrink-0"
            onClick={onClearQuote}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Input Row */}
      <div className="flex items-end gap-2">
        {/* Attachments Button */}
        <TimelineUploadButton
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          variant="icon"
          disabled={isPending}
        />

        {/* Message Input */}
        <div className="flex-1 min-w-0">
          <MentionInput
            value={messageContent}
            onChange={setMessageContent}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="text-sm resize-none min-h-[40px] max-h-[120px]"
            disabled={isPending}
          />
        </div>

        {/* Send Button */}
        <Button
          size="icon"
          className="h-10 w-10 rounded-full flex-shrink-0"
          onClick={() => sendMessageMutation.mutate()}
          disabled={!canSend || isPending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {attachments.map((att, idx) => (
            <div key={att.id || idx} className="relative">
              {att.type?.startsWith('image/') ? (
                <img src={att.url} alt={att.name} className="h-16 w-16 object-cover rounded" />
              ) : (
                <div className="h-16 px-3 flex items-center bg-muted rounded text-xs">
                  {att.name}
                </div>
              )}
              <Button
                variant="destructive"
                size="sm"
                className="absolute -top-2 -right-2 h-5 w-5 p-0 rounded-full"
                onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
