import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { DevelopmentItem, deriveCardStatus } from '@/pages/Development';

/**
 * Centralized hook for fetching and enriching development items.
 * Used by both Development.tsx and Dashboard.tsx to share cache and avoid duplicate queries.
 *
 * Includes realtime subscription with debounced invalidation.
 */
export function useDevelopmentItems() {
  const { user } = useAuth();
  const { isTrader, isAdmin } = useUserRole();
  const queryClient = useQueryClient();

  // Track local mutations to skip redundant realtime invalidations
  const isMutatingRef = useRef(false);
  const invalidateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const queryResult = useQuery({
    queryKey: ['development-items', user?.id],
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('development_items')
        .select(`
          *,
          supplier:suppliers(id, company_name)
        `)
        .order('position', { ascending: true });

      if (error) throw error;

      const itemIds = data.map(item => item.id);
      const creatorIds = [...new Set(data.map(item => item.created_by).filter(Boolean))];

      // Fetch enrichment data in parallel
      const [
        sampleCountsRes,
        productCountsRes,
        latestActivitiesRes,
        userViewsRes,
        creatorProfilesRes,
        unresolvedQuestionsRes,
        unacknowledgedAnswersRes,
        pendingThreadsRes,
        allActivitiesRes,
        unresolvedMentionsRes,
      ] = await Promise.all([
        supabase
          .from('development_item_samples')
          .select('item_id')
          .in('item_id', itemIds),
        supabase
          .from('development_card_products')
          .select('card_id')
          .in('card_id', itemIds),
        supabase
          .from('development_card_activity')
          .select('card_id, created_at')
          .in('card_id', itemIds)
          .order('created_at', { ascending: false }),
        user?.id
          ? supabase
              .from('card_user_views')
              .select('card_id, last_viewed_at')
              .eq('user_id', user.id)
              .in('card_id', itemIds)
          : Promise.resolve({ data: [] }),
        creatorIds.length > 0
          ? supabase
              .from('profiles')
              .select('user_id, full_name')
              .in('user_id', creatorIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from('development_card_activity')
          .select('card_id, metadata')
          .eq('activity_type', 'question')
          .in('card_id', itemIds),
        supabase
          .from('development_card_activity')
          .select('card_id, metadata')
          .eq('activity_type', 'answer')
          .in('card_id', itemIds),
        supabase
          .from('development_card_activity')
          .select('id, card_id, thread_title, activity_type, content, assigned_to_users, assigned_to_role, thread_status, thread_id')
          .in('card_id', itemIds)
          .is('thread_resolved_at', null)
          .not('thread_id', 'is', null),
        supabase
          .from('development_card_activity')
          .select('card_id, created_at')
          .in('card_id', itemIds),
        supabase
          .from('card_unresolved_mentions')
          .select('card_id, mentioned_user_id')
          .in('card_id', itemIds)
          .is('resolved_at', null),
      ]);

      // Build lookup maps
      const sampleCountMap = (sampleCountsRes.data || []).reduce((acc, s) => {
        acc[s.item_id] = (acc[s.item_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const productCountMap = (productCountsRes.data || []).reduce((acc, p) => {
        acc[p.card_id] = (acc[p.card_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const latestActivityMap = (latestActivitiesRes.data || []).reduce((acc, a) => {
        if (!acc[a.card_id] || new Date(a.created_at) > new Date(acc[a.card_id])) {
          acc[a.card_id] = a.created_at;
        }
        return acc;
      }, {} as Record<string, string>);

      const userViewMap = (userViewsRes.data || []).reduce((acc, v) => {
        acc[v.card_id] = v.last_viewed_at;
        return acc;
      }, {} as Record<string, string>);

      const creatorNameMap = (creatorProfilesRes.data || []).reduce((acc, p) => {
        acc[p.user_id] = p.full_name;
        return acc;
      }, {} as Record<string, string | null>);

      // Compute unresolved questions
      const cardsWithUnresolvedQuestions = new Set<string>();
      for (const q of unresolvedQuestionsRes.data || []) {
        const metadata = q.metadata as { resolved?: boolean } | null;
        if (!metadata?.resolved) {
          cardsWithUnresolvedQuestions.add(q.card_id);
        }
      }

      // Compute unacknowledged answers
      const cardsWithUnacknowledgedAnswers = new Set<string>();
      for (const a of unacknowledgedAnswersRes.data || []) {
        const metadata = a.metadata as { acknowledged?: boolean } | null;
        if (!metadata?.acknowledged) {
          cardsWithUnacknowledgedAnswers.add(a.card_id);
        }
      }

      // Pending threads
      const userRolesForCheck = isTrader ? ['trader'] : isAdmin ? ['admin', 'buyer', 'quality', 'marketing'] : ['buyer', 'quality', 'marketing'];
      const pendingThreadsCountMap: Record<string, number> = {};
      const pendingThreadsInfoMap: Record<string, { id: string; title: string; type: string }[]> = {};

      for (const pt of pendingThreadsRes.data || []) {
        if (pt.thread_id !== pt.id) continue;
        const isAssignedToUser = pt.assigned_to_users?.includes(user?.id || '');
        const isAssignedToRole = pt.assigned_to_role && userRolesForCheck.includes(pt.assigned_to_role);
        const isOpen = pt.thread_status !== 'resolved';

        if (isOpen && (isAssignedToUser || isAssignedToRole)) {
          pendingThreadsCountMap[pt.card_id] = (pendingThreadsCountMap[pt.card_id] || 0) + 1;
          const title = pt.thread_title ||
            (pt.content ? pt.content.split(' ').slice(0, 6).join(' ') + (pt.content.split(' ').length > 6 ? '...' : '') : null) ||
            (pt.activity_type === 'sample_requested' ? 'Sample Request' : 'Thread');
          if (!pendingThreadsInfoMap[pt.card_id]) pendingThreadsInfoMap[pt.card_id] = [];
          pendingThreadsInfoMap[pt.card_id].push({ id: pt.id, title, type: pt.activity_type });
        }
      }

      // Unread counts
      const unreadCountMap: Record<string, number> = {};
      for (const activity of allActivitiesRes.data || []) {
        const lastViewed = userViewMap[activity.card_id];
        if (!lastViewed || new Date(activity.created_at) > new Date(lastViewed)) {
          unreadCountMap[activity.card_id] = (unreadCountMap[activity.card_id] || 0) + 1;
        }
      }

      // Unresolved mentions
      const unresolvedMentionsMap: Record<string, string[]> = {};
      for (const m of unresolvedMentionsRes.data || []) {
        if (!unresolvedMentionsMap[m.card_id]) unresolvedMentionsMap[m.card_id] = [];
        if (!unresolvedMentionsMap[m.card_id].includes(m.mentioned_user_id)) {
          unresolvedMentionsMap[m.card_id].push(m.mentioned_user_id);
        }
      }

      // Fetch mention user names
      const allMentionedUserIds = [...new Set(Object.values(unresolvedMentionsMap).flat())];
      let mentionUserNameMap: Record<string, string | null> = {};
      if (allMentionedUserIds.length > 0) {
        const { data: mentionProfiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', allMentionedUserIds);
        mentionUserNameMap = (mentionProfiles || []).reduce((acc, p) => {
          acc[p.user_id] = p.full_name;
          return acc;
        }, {} as Record<string, string | null>);
      }

      // Enrich items
      return data.map(item => {
        let effectivePendingActionType = item.pending_action_type;
        if (!effectivePendingActionType && cardsWithUnresolvedQuestions.has(item.id)) {
          effectivePendingActionType = 'question';
        }
        if (!effectivePendingActionType && !cardsWithUnresolvedQuestions.has(item.id) && cardsWithUnacknowledgedAnswers.has(item.id)) {
          effectivePendingActionType = 'answer_pending';
        }

        const latestActivity = latestActivityMap[item.id] || item.created_at;
        const derivedStatus = deriveCardStatus({
          is_solved: item.is_solved || false,
          pending_action_snoozed_until: item.pending_action_snoozed_until,
          pending_action_type: effectivePendingActionType,
          latest_activity_at: latestActivity,
          created_at: item.created_at,
        });

        return {
          ...item,
          card_type: item.card_type || 'item',
          is_solved: item.is_solved || false,
          deleted_at: item.deleted_at || null,
          deleted_by: item.deleted_by || null,
          samples_count: sampleCountMap[item.id] || 0,
          products_count: productCountMap[item.id] || 0,
          latest_activity_at: latestActivity,
          last_viewed_at: userViewMap[item.id] || null,
          creator_name: creatorNameMap[item.created_by] || null,
          pending_action_type: effectivePendingActionType,
          pending_threads_count: pendingThreadsCountMap[item.id] || 0,
          pending_threads_info: pendingThreadsInfoMap[item.id] || [],
          derived_status: derivedStatus,
          unread_count: unreadCountMap[item.id] || 0,
          workflow_status: item.workflow_status || null,
          current_assignee_role: item.current_assignee_role as DevelopmentItem['current_assignee_role'] || null,
          unresolved_mentions: (unresolvedMentionsMap[item.id] || []).map(userId => ({
            user_id: userId,
            user_name: mentionUserNameMap[userId] || null,
          })),
        };
      }) as DevelopmentItem[];
    },
  });

  // Realtime subscription with debounced invalidation
  useEffect(() => {
    const handleInvalidate = () => {
      if (isMutatingRef.current) return;
      if (invalidateTimeoutRef.current) clearTimeout(invalidateTimeoutRef.current);
      invalidateTimeoutRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['development-items'] });
      }, 300);
    };

    const channel = supabase
      .channel('dev-items-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'development_items' }, handleInvalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'card_unresolved_mentions' }, handleInvalidate)
      .subscribe();

    return () => {
      if (invalidateTimeoutRef.current) clearTimeout(invalidateTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    ...queryResult,
    isMutatingRef,
  };
}
