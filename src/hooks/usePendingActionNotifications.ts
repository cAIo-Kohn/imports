import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';

// Notification sound - a gentle chime
const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export function usePendingActionNotifications() {
  const { user } = useAuth();
  const { isTrader } = useUserRole();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasPermissionRef = useRef<boolean>(false);
  const userTeam = isTrader ? 'arc' : 'mor';

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
    audioRef.current.volume = 0.5;
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        hasPermissionRef.current = true;
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          hasPermissionRef.current = permission === 'granted';
        });
      }
    }
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.log('Could not play notification sound:', err);
      });
    }
  }, []);

  // Show browser notification
  const showBrowserNotification = useCallback((title: string, body: string) => {
    if (hasPermissionRef.current && 'Notification' in window) {
      try {
        const notification = new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: 'pending-action', // Prevents duplicate notifications
          requireInteraction: false,
        });
        
        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);
        
        // Focus window when clicked
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (err) {
        console.log('Could not show browser notification:', err);
      }
    }
  }, []);

  // Cache card titles to avoid querying the same card repeatedly
  const cardTitleCacheRef = useRef<Record<string, string>>({});

  // Debounce notification to batch rapid activity inserts
  const pendingNotificationRef = useRef<NodeJS.Timeout | null>(null);
  const pendingNotificationDataRef = useRef<{ title: string; body: string } | null>(null);

  const getCardTitle = useCallback(async (cardId: string): Promise<string> => {
    if (cardTitleCacheRef.current[cardId]) return cardTitleCacheRef.current[cardId];
    const { data: card } = await supabase
      .from('development_items')
      .select('title')
      .eq('id', cardId)
      .single();
    const title = card?.title || 'a card';
    cardTitleCacheRef.current[cardId] = title;
    return title;
  }, []);

  const scheduleNotification = useCallback((title: string, body: string) => {
    pendingNotificationDataRef.current = { title, body };
    if (pendingNotificationRef.current) clearTimeout(pendingNotificationRef.current);
    pendingNotificationRef.current = setTimeout(() => {
      const data = pendingNotificationDataRef.current;
      if (data) {
        playNotificationSound();
        showBrowserNotification(data.title, data.body);
        pendingNotificationDataRef.current = null;
      }
    }, 1500);
  }, [playNotificationSound, showBrowserNotification]);

  // Subscribe to realtime changes for pending actions
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`pending-actions-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'development_card_activity',
        },
        async (payload) => {
          const newActivity = payload.new as {
            id: string;
            card_id: string;
            user_id: string;
            activity_type: string;
            pending_for_team: string | null;
            thread_title: string | null;
            content: string | null;
          };

          if (
            newActivity.user_id !== user.id &&
            newActivity.pending_for_team === userTeam
          ) {
            const cardTitle = await getCardTitle(newActivity.card_id);

            let notificationTitle = 'New pending action';
            let notificationBody = `You have a new pending action on "${cardTitle}"`;

            if (newActivity.activity_type === 'question') {
              notificationTitle = 'New question for your team';
              notificationBody = `Someone asked a question on "${cardTitle}"`;
            } else if (newActivity.activity_type === 'sample_requested') {
              notificationTitle = 'Sample request received';
              notificationBody = `A sample was requested for "${cardTitle}"`;
            } else if (newActivity.activity_type === 'answer') {
              notificationTitle = 'Answer pending review';
              notificationBody = `You received an answer on "${cardTitle}"`;
            }

            scheduleNotification(notificationTitle, notificationBody);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'development_card_activity',
        },
        async (payload) => {
          const oldActivity = payload.old as { pending_for_team: string | null };
          const newActivity = payload.new as {
            id: string;
            card_id: string;
            user_id: string;
            activity_type: string;
            pending_for_team: string | null;
            thread_title: string | null;
          };

          if (
            oldActivity.pending_for_team !== userTeam &&
            newActivity.pending_for_team === userTeam
          ) {
            const cardTitle = await getCardTitle(newActivity.card_id);

            scheduleNotification(
              'Pending action updated',
              `You have a new pending action on "${cardTitle}"`
            );
          }
        }
      )
      .subscribe();

    return () => {
      if (pendingNotificationRef.current) clearTimeout(pendingNotificationRef.current);
      supabase.removeChannel(channel);
    };
  }, [user?.id, userTeam, getCardTitle, scheduleNotification]);

  // Manual request permission function
  const requestPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      hasPermissionRef.current = permission === 'granted';
      return permission === 'granted';
    }
    return hasPermissionRef.current;
  }, []);

  return {
    requestPermission,
    hasPermission: hasPermissionRef.current,
  };
}
