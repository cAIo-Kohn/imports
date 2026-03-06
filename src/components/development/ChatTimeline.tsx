import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { MessageCircle, ChevronUp } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ChatMessage, ChatMessageData } from './ChatMessage';
import { ChatMessageInput } from './ChatMessageInput';
import { AppRole } from '@/hooks/useUserRole';

const PAGE_SIZE = 50;

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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [quotedMessage, setQuotedMessage] = useState<ChatMessageData | null>(null);
  const [loadedPages, setLoadedPages] = useState(1);

  // Reset pagination when card changes
  useEffect(() => {
    setLoadedPages(1);
  }, [cardId]);

  // Fetch messages with pagination — newest first from DB, then reverse for display
  const { data: queryData, isLoading } = useQuery({
    queryKey: ['chat-messages', cardId, loadedPages],
    queryFn: async () => {
      const limit = loadedPages * PAGE_SIZE;

      // Fetch total count for "has more" indicator
      const { count: totalCount } = await supabase
        .from('development_card_activity')
        .select('id', { count: 'exact', head: true })
        .eq('card_id', cardId);

      // Fetch the most recent `limit` messages (newest first for efficient limit)
      const { data, error } = await supabase
        .from('development_card_activity')
        .select('*')
        .eq('card_id', cardId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Reverse to get oldest-first order for display
      const sorted = (data || []).reverse();

      // Fetch profiles and roles for all users in this batch
      const userIds = [...new Set(sorted.map(a => a.user_id))];
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

      const messages = sorted.map(activity => ({
        ...activity,
        profile: profileMap[activity.user_id] || null,
        roles: rolesMap[activity.user_id] || [],
      })) as ChatMessageData[];

      return {
        messages,
        totalCount: totalCount || 0,
        hasMore: (totalCount || 0) > limit,
      };
    },
    staleTime: 10 * 1000,
  });

  const messages = queryData?.messages || [];
  const hasMore = queryData?.hasMore || false;

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

  // Auto-scroll to bottom on new messages (only when not loading older)
  const prevMessageCountRef = useRef(messages.length);
  useEffect(() => {
    // Only auto-scroll when new messages arrive (count increases at the end),
    // not when loading older messages (which prepend)
    const isNewMessage = messages.length > prevMessageCountRef.current && loadedPages === 1;
    prevMessageCountRef.current = messages.length;

    if (isNewMessage || loadedPages === 1) {
      const viewport = scrollContainerRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages.length, loadedPages]);

  // Real-time subscription with debounce to batch rapid changes
  const chatInvalidateRef = useRef<NodeJS.Timeout | null>(null);

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
          if (chatInvalidateRef.current) clearTimeout(chatInvalidateRef.current);
          chatInvalidateRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['chat-messages', cardId] });
          }, 300);
        }
      )
      .subscribe();

    return () => {
      if (chatInvalidateRef.current) clearTimeout(chatInvalidateRef.current);
      supabase.removeChannel(channel);
    };
  }, [cardId, queryClient]);

  const handleLoadMore = useCallback(() => {
    setLoadedPages(prev => prev + 1);
  }, []);

  const handleQuoteClick = useCallback((message: ChatMessageData) => {
    setQuotedMessage(message);
  }, []);

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Loading messages...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Messages Area - scrolls independently */}
      <ScrollArea className="flex-1" ref={scrollContainerRef}>
        <div className="p-4 space-y-4">
          {/* Load older messages button */}
          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground gap-1"
                onClick={handleLoadMore}
              >
                <ChevronUp className="h-3 w-3" />
                Load older messages
              </Button>
            </div>
          )}

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
            const viewport = scrollContainerRef.current?.querySelector('[data-radix-scroll-area-viewport]');
            if (viewport) {
              viewport.scrollTop = viewport.scrollHeight;
            }
          }, 100);
        }}
      />
    </div>
  );
}
