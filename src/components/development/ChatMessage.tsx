import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Reply, Paperclip, Image as ImageIcon, FileText } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UserRoleBadge } from './UserRoleBadge';
import { MentionText } from '@/components/notifications/MentionInput';
import { AppRole } from '@/hooks/useUserRole';

export interface ChatMessageData {
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
  roles?: AppRole[];
}

interface ChatMessageProps {
  message: ChatMessageData;
  quotedMessage?: ChatMessageData | null;
  isOwnMessage: boolean;
  onQuoteClick: (message: ChatMessageData) => void;
}

export function ChatMessage({ message, quotedMessage, isOwnMessage, onQuoteClick }: ChatMessageProps) {
  const getInitials = (profile: ChatMessageData['profile']) => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (profile?.email) {
      return profile.email[0].toUpperCase();
    }
    return '?';
  };

  const displayName = message.profile?.full_name || message.profile?.email || 'Unknown';
  const attachments = message.metadata?.attachments || [];
  const quotedMessageId = message.metadata?.quoted_message_id;

  // System messages (status changes, etc.) render differently
  const isSystemMessage = !['message', 'comment', 'question', 'answer', 'card_created'].includes(message.activity_type);
  
  if (isSystemMessage) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {message.content || `${message.activity_type.replace(/_/g, ' ')}`}
        </span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex gap-2 group mb-3",
      isOwnMessage ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar */}
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className="text-xs bg-primary/10">
          {getInitials(message.profile)}
        </AvatarFallback>
      </Avatar>

      {/* Message Bubble */}
      <div className={cn(
        "max-w-[70%] min-w-0",
        isOwnMessage ? "items-end" : "items-start"
      )}>
        {/* Name and Role */}
        <div className={cn(
          "flex items-center gap-1.5 mb-1",
          isOwnMessage ? "flex-row-reverse" : "flex-row"
        )}>
          <span className="text-xs font-medium text-foreground">{displayName}</span>
          {message.roles && message.roles.length > 0 && (
            <UserRoleBadge roles={message.roles} />
          )}
          <span className="text-[10px] text-muted-foreground">
            {format(parseISO(message.created_at), 'HH:mm')}
          </span>
        </div>

        {/* Message Content */}
        <div className={cn(
          "rounded-2xl px-4 py-2 relative",
          isOwnMessage 
            ? "bg-primary text-primary-foreground rounded-tr-sm" 
            : "bg-muted rounded-tl-sm"
        )}>
          {/* Quoted Message */}
          {quotedMessage && (
            <div className={cn(
              "mb-2 p-2 rounded border-l-2 text-xs",
              isOwnMessage 
                ? "bg-primary-foreground/10 border-primary-foreground/30" 
                : "bg-background border-muted-foreground/30"
            )}>
              <div className="font-medium opacity-70 mb-0.5">
                {quotedMessage.profile?.full_name || 'Unknown'}
              </div>
              <div className="line-clamp-2 opacity-80">
                {quotedMessage.content || 'Message'}
              </div>
            </div>
          )}

          {/* Main Content */}
          {message.content && (
            <div className="text-sm whitespace-pre-wrap break-words">
              <MentionText text={message.content} variant={isOwnMessage ? 'onPrimary' : 'default'} />
            </div>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {attachments.map((att: any, idx: number) => {
                const isImage = att.type?.startsWith('image/') || att.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                return (
                  <a
                    key={att.id || idx}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "block",
                      isImage ? "rounded-lg overflow-hidden" : "flex items-center gap-2 text-xs underline"
                    )}
                  >
                    {isImage ? (
                      <img
                        src={att.url}
                        alt={att.name || 'Attachment'}
                        className="max-w-[200px] max-h-[200px] object-cover rounded"
                      />
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        {att.name || 'File'}
                      </>
                    )}
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* Quote Button - appears on hover */}
        <div className={cn(
          "opacity-0 group-hover:opacity-100 transition-opacity mt-1",
          isOwnMessage ? "text-right" : "text-left"
        )}>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onQuoteClick(message)}
          >
            <Reply className="h-3 w-3 mr-1" />
            Quote
          </Button>
        </div>
      </div>
    </div>
  );
}
