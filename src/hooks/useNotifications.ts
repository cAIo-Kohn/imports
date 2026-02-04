import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  card_id: string | null;
  activity_id: string | null;
  triggered_by: string;
  title: string;
  content: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  // Joined data
  triggered_by_profile?: {
    full_name: string | null;
    email: string | null;
  } | null;
  card?: {
    title: string;
  } | null;
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch notifications for current user
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Fetch notifications
      const { data: notificationsData, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      if (!notificationsData || notificationsData.length === 0) return [];
      
      // Get unique triggered_by and card_id values
      const triggerUserIds = [...new Set(notificationsData.map(n => n.triggered_by))];
      const cardIds = [...new Set(notificationsData.map(n => n.card_id).filter(Boolean))] as string[];
      
      // Fetch profiles for triggered_by users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', triggerUserIds);
      
      // Fetch card titles
      const { data: cards } = cardIds.length > 0 
        ? await supabase
            .from('development_items')
            .select('id, title')
            .in('id', cardIds)
        : { data: [] };
      
      // Map profiles and cards to notifications
      const profileMap = new Map<string, { user_id: string; full_name: string | null; email: string | null }>();
      profiles?.forEach(p => profileMap.set(p.user_id, p));
      
      const cardMap = new Map<string, { id: string; title: string }>();
      cards?.forEach(c => cardMap.set(c.id, c));
      
      return notificationsData.map(n => ({
        ...n,
        triggered_by_profile: profileMap.get(n.triggered_by) || null,
        card: n.card_id ? cardMap.get(n.card_id) || null : null,
      })) as Notification[];
    },
    enabled: !!user?.id,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetch]);

  // Unread count
  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Mark single notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  // Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
  });

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    deleteNotification: deleteNotificationMutation.mutate,
    refetch,
  };
}

// Helper to parse @mentions from text and return user IDs and team IDs
export function parseMentions(text: string): { userIds: string[]; teamIds: string[] } {
  // Match @[Name](id) format
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const userIds: string[] = [];
  const teamIds: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    const id = match[2];
    if (id.startsWith('team:')) {
      teamIds.push(id);
    } else {
      userIds.push(id);
    }
  }
  
  return { userIds, teamIds };
}

// Convert display text with mentions to storage format
export function formatMentionsForStorage(text: string): string {
  // Text is already in @[Name](user_id) format from the input
  return text;
}

// Convert storage format to display format (for rendering)
export function formatMentionsForDisplay(text: string): string {
  // Replace @[Name](user_id) with @Name
  return text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
}

// Create notifications for mentioned users and teams
export async function createMentionNotifications({
  text,
  cardId,
  activityId,
  triggeredBy,
  cardTitle,
}: {
  text: string;
  cardId: string;
  activityId: string;
  triggeredBy: string;
  cardTitle: string;
}): Promise<void> {
  const { userIds, teamIds } = parseMentions(text);
  
  // Filter out self-mentions for direct user mentions
  const directUserIds = userIds.filter(id => id !== triggeredBy);
  
  // Get triggering user's name
  const { data: triggerProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('user_id', triggeredBy)
    .single();
  
  const triggerName = triggerProfile?.full_name || 'Someone';
  const notificationContent = `In card "${cardTitle}": ${formatMentionsForDisplay(text).slice(0, 100)}${text.length > 100 ? '...' : ''}`;
  
  // Create notifications for direct user mentions
  if (directUserIds.length > 0) {
    const notifications = directUserIds.map(userId => ({
      user_id: userId,
      type: 'mention',
      card_id: cardId,
      activity_id: activityId,
      triggered_by: triggeredBy,
      title: `${triggerName} mentioned you`,
      content: notificationContent,
    }));
    
    await supabase.from('notifications').insert(notifications);
  }
  
  // Handle team mentions via edge function (bypasses RLS on user_roles)
  for (const teamId of teamIds) {
    const role = teamId.replace('team:', '');
    if (!role) continue;
    
    await supabase.functions.invoke('send-notification', {
      body: {
        recipientRole: role,
        triggeredBy,
        cardId,
        activityId,
        type: 'mention',
        title: `${triggerName} mentioned ${role.charAt(0).toUpperCase() + role.slice(1)} Team`,
        content: notificationContent,
      },
    });
  }
}
