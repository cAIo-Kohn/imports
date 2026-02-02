import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { MessageCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage, ChatMessageData } from './ChatMessage';
import { ChatMessageInput } from './ChatMessageInput';
import { AppRole } from '@/hooks/useUserRole';

interface ChatTimelineProps {
  cardId: string;
  cardTitle?: string;
}

function formatDateHeader(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d, yyyy');
}

export function ChatTimeline({ cardId, cardTitle }: ChatTimelineProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [quotedMessage, setQuotedMessage] = useState<ChatMessageData | null>(null);

  // Fetch all messages for the card (oldest first for WhatsApp-style)
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat-messages', cardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('development_card_activity')
        .select('*')
        .eq('card_id', cardId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profiles for all users
      const userIds = [...new Set(data.map(a => a.user_id))];
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, email').in('user_id', userIds),
        supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
      ]);

      const profileMap = (profilesRes.data || []).reduce((acc, p) => {
        acc[p.user_id] = { full_name: p.full_name, email: p.email };
        return acc;
      }, {} as Record<string, { full_name: string | null; email: string | null }>);

      const rolesMap = (rolesRes.data || []).reduce((acc, r) => {
        if (!acc[r.user_id]) acc[r.user_id] = [];
        acc[r.user_id].push(r.role as AppRole);
        return acc;
      }, {} as Record<string, AppRole[]>);

      return data.map(activity => ({
        ...activity,
        profile: profileMap[activity.user_id] || null,
        roles: rolesMap[activity.user_id] || [],
      })) as ChatMessageData[];
    },
    staleTime: 10 * 1000,
  });

  // Build a map of messages for quick lookup (for quoted messages)
  const messageMap = useMemo(() => {
    return messages.reduce((acc, msg) => {
      acc[msg.id] = msg;
      return acc;
    }, {} as Record<string, ChatMessageData>);
  }, [messages]);

  // Group messages by date
  const messagesByDate = useMemo(() => {
    const grouped: Record<string, ChatMessageData[]> = {};
    for (const msg of messages) {
      const dateKey = format(parseISO(msg.created_at), 'yyyy-MM-dd');
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(msg);
    }
    return grouped;
  }, [messages]);

  const sortedDates = Object.keys(messagesByDate).sort();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${cardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'development_card_activity',
          filter: `card_id=eq.${cardId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat-messages', cardId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cardId, queryClient]);

  const handleQuoteClick = (message: ChatMessageData) => {
    setQuotedMessage(message);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Loading messages...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-4">
          {sortedDates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs mt-1">Start the conversation below</p>
            </div>
          ) : (
            sortedDates.map(dateKey => (
              <div key={dateKey}>
                {/* Date Header */}
                <div className="flex justify-center mb-4">
                  <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {formatDateHeader(dateKey + 'T00:00:00')}
                  </span>
                </div>

                {/* Messages for this date */}
                {messagesByDate[dateKey].map(message => {
                  const quotedId = message.metadata?.quoted_message_id;
                  const quoted = quotedId ? messageMap[quotedId] : null;

                  return (
                    <ChatMessage
                      key={message.id}
                      message={message}
                      quotedMessage={quoted}
                      isOwnMessage={message.user_id === user?.id}
                      onQuoteClick={handleQuoteClick}
                    />
                  );
                })}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <ChatMessageInput
        cardId={cardId}
        cardTitle={cardTitle}
        quotedMessage={quotedMessage}
        onClearQuote={() => setQuotedMessage(null)}
        onMessageSent={() => {
          // Scroll to bottom after sending
          setTimeout(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }, 100);
        }}
      />
    </div>
  );
}
