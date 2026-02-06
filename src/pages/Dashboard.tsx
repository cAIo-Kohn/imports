import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { usePendingActionNotifications } from '@/hooks/usePendingActionNotifications';
import { Link } from 'react-router-dom';
import { Inbox, ArrowRight, Sparkles, Package } from 'lucide-react';
import { DevelopmentCard } from '@/components/development/DevelopmentCard';
import { ItemDetailDrawer } from '@/components/development/ItemDetailDrawer';
import { ResearchApprovalDrawer } from '@/components/new-products/ResearchApprovalDrawer';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DevelopmentItem, DevelopmentCardStatus, deriveCardStatus } from './Development';
import { useNewProductsData, APPROVAL_CONFIG, type ApprovalType, type NewProductApproval } from '@/hooks/useNewProductFlow';

// Role labels for display
const ROLE_LABELS: Record<string, { emoji: string; name: string }> = {
  buyer: { emoji: '🛒', name: 'Buyer' },
  quality: { emoji: '✅', name: 'Quality' },
  marketing: { emoji: '📢', name: 'Marketing' },
  trader: { emoji: '🌏', name: 'Trader' },
};

export default function Dashboard() {
  const { user } = useAuth();
  const { isBuyer, isQuality, isMarketing, isTrader, isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  
  // Enable pending action notifications
  usePendingActionNotifications();
  
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  
  // Research approval drawer state
  const [researchDrawerState, setResearchDrawerState] = useState<{
    open: boolean;
    cardId: string;
    cardTitle: string;
    cardImageUrl: string | null;
    approvalType: ApprovalType;
    approval: NewProductApproval | undefined;
  } | null>(null);

  // Determine user's functional department (admins default to buyer per requirement)
  const userDepartment = useMemo(() => {
    if (isBuyer) return 'buyer';
    if (isQuality) return 'quality';
    if (isMarketing) return 'marketing';
    if (isTrader) return 'trader';
    // Admin or fallback - default to buyer
    return 'buyer';
  }, [isBuyer, isQuality, isMarketing, isTrader]);

  // Fetch user profile for greeting
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile', user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Extract first name from full_name
  const firstName = useMemo(() => {
    if (!profile?.full_name) return 'there';
    return profile.full_name.split(' ')[0];
  }, [profile]);

  // Fetch all user roles for department filtering
  const { data: allUserRoles = [] } = useQuery({
    queryKey: ['all-user-roles-for-filter'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (error) return [];
      return data || [];
    },
  });

  // Build a map: userId -> roles[]
  const userRolesMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const ur of allUserRoles) {
      if (!map[ur.user_id]) {
        map[ur.user_id] = [];
      }
      map[ur.user_id].push(ur.role);
    }
    return map;
  }, [allUserRoles]);

  // Fetch development items (same query as Development.tsx)
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['development-items', user?.id],
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
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

      // Parallel fetches for enrichment
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
        supabase.from('development_item_samples').select('item_id').in('item_id', itemIds),
        supabase.from('development_card_products').select('card_id').in('card_id', itemIds),
        supabase.from('development_card_activity').select('card_id, created_at').in('card_id', itemIds).order('created_at', { ascending: false }),
        user?.id ? supabase.from('card_user_views').select('card_id, last_viewed_at').eq('user_id', user.id).in('card_id', itemIds) : Promise.resolve({ data: [] }),
        creatorIds.length > 0 ? supabase.from('profiles').select('user_id, full_name').in('user_id', creatorIds) : Promise.resolve({ data: [] }),
        supabase.from('development_card_activity').select('card_id, metadata').eq('activity_type', 'question').in('card_id', itemIds),
        supabase.from('development_card_activity').select('card_id, metadata').eq('activity_type', 'answer').in('card_id', itemIds),
        supabase.from('development_card_activity').select('id, card_id, thread_title, activity_type, content, assigned_to_users, assigned_to_role, thread_status, thread_id').in('card_id', itemIds).is('thread_resolved_at', null).not('thread_id', 'is', null),
        supabase.from('development_card_activity').select('card_id, created_at').in('card_id', itemIds),
        supabase.from('card_unresolved_mentions').select('card_id, mentioned_user_id').in('card_id', itemIds).is('resolved_at', null),
      ]);

      // Process all the data
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

      const cardsWithUnresolvedQuestions = new Set<string>();
      for (const q of unresolvedQuestionsRes.data || []) {
        const metadata = q.metadata as { resolved?: boolean } | null;
        if (!metadata?.resolved) {
          cardsWithUnresolvedQuestions.add(q.card_id);
        }
      }

      const cardsWithUnacknowledgedAnswers = new Set<string>();
      for (const a of unacknowledgedAnswersRes.data || []) {
        const metadata = a.metadata as { acknowledged?: boolean } | null;
        if (!metadata?.acknowledged) {
          cardsWithUnacknowledgedAnswers.add(a.card_id);
        }
      }

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
          const title = pt.thread_title || (pt.content ? pt.content.split(' ').slice(0, 6).join(' ') + '...' : 'Thread');
          if (!pendingThreadsInfoMap[pt.card_id]) pendingThreadsInfoMap[pt.card_id] = [];
          pendingThreadsInfoMap[pt.card_id].push({ id: pt.id, title, type: pt.activity_type });
        }
      }

      const unreadCountMap: Record<string, number> = {};
      for (const activity of allActivitiesRes.data || []) {
        const lastViewed = userViewMap[activity.card_id];
        if (!lastViewed || new Date(activity.created_at) > new Date(lastViewed)) {
          unreadCountMap[activity.card_id] = (unreadCountMap[activity.card_id] || 0) + 1;
        }
      }

      const unresolvedMentionsMap: Record<string, string[]> = {};
      for (const m of unresolvedMentionsRes.data || []) {
        if (!unresolvedMentionsMap[m.card_id]) unresolvedMentionsMap[m.card_id] = [];
        if (!unresolvedMentionsMap[m.card_id].includes(m.mentioned_user_id)) {
          unresolvedMentionsMap[m.card_id].push(m.mentioned_user_id);
        }
      }

      const allMentionedUserIds = [...new Set(Object.values(unresolvedMentionsMap).flat())];
      let mentionUserNameMap: Record<string, string | null> = {};
      if (allMentionedUserIds.length > 0) {
        const { data: mentionProfiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', allMentionedUserIds);
        mentionUserNameMap = (mentionProfiles || []).reduce((acc, p) => {
          acc[p.user_id] = p.full_name;
          return acc;
        }, {} as Record<string, string | null>);
      }

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

  // Filter items for user's department pending cards
  const pendingTeamCards = useMemo(() => {
    return items.filter(item => {
      // Exclude solved and deleted
      if (item.derived_status === 'solved' || item.deleted_at) return false;

      // Match if:
      // 1) Created by someone in user's department
      // 2) current_assignee_role matches user's department
      // 3) Unresolved mention for someone in user's department

      // Condition 1: created_by_role matches
      if ((item as any).created_by_role === userDepartment) return true;

      // Condition 2: current_assignee_role matches
      if (item.current_assignee_role === userDepartment) return true;

      // Condition 3: unresolved mention for someone in the department
      if (item.unresolved_mentions && item.unresolved_mentions.length > 0) {
        for (const mention of item.unresolved_mentions) {
          const mentionedUserRoles = userRolesMap[mention.user_id] || [];
          if (mentionedUserRoles.includes(userDepartment)) return true;
        }
      }

      return false;
    });
  }, [items, userDepartment, userRolesMap]);

  // Sort: urgent first, then by priority, then oldest first
  const sortedPendingCards = useMemo(() => {
    const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };
    return [...pendingTeamCards].sort((a, b) => {
      const priorityA = PRIORITY_ORDER[a.priority] ?? 4;
      const priorityB = PRIORITY_ORDER[b.priority] ?? 4;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [pendingTeamCards]);

  // Fetch New Products data
  const { data: newProductsData, isLoading: newProductsLoading } = useNewProductsData();

  // Map department to approval type for Step 1
  const departmentApprovalType: Record<string, ApprovalType | null> = {
    marketing: 'market_research',
    quality: 'trademark_patent',
    buyer: 'customs_research',
    trader: null, // Trader has no Step 1 tasks
  };

  // Step 1 label based on department
  const step1Labels: Record<string, string> = {
    marketing: 'Pesquisa de Mercado',
    quality: 'Certificações, Marcas e Patentes',
    buyer: 'Pesquisa Aduaneira',
  };

  // Filter pending Step 1 items for user's department
  const pendingStep1Items = useMemo(() => {
    if (!newProductsData || userDepartment === 'trader') return [];
    const myApprovalType = departmentApprovalType[userDepartment];
    if (!myApprovalType) return [];
    
    return newProductsData.step1.filter(item => {
      const approval = newProductsData.approvals.find(
        a => a.card_id === item.id && a.approval_type === myApprovalType
      );
      return approval?.status === 'pending';
    });
  }, [newProductsData, userDepartment]);

  // Step 2: Only Quality
  const pendingStep2Items = useMemo(() => {
    if (!newProductsData || userDepartment !== 'quality') return [];
    return newProductsData.step2;
  }, [newProductsData, userDepartment]);

  // Step 3: Only Buyer
  const pendingStep3Items = useMemo(() => {
    if (!newProductsData || userDepartment !== 'buyer') return [];
    return newProductsData.step3;
  }, [newProductsData, userDepartment]);

  const totalPendingNewProducts = pendingStep1Items.length + pendingStep2Items.length + pendingStep3Items.length;

  // Handlers
  const handleCardClick = useCallback((itemId: string) => {
    setSelectedItemId(itemId);
    setSelectedThreadId(null);
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData('itemId', itemId);
  }, []);

  // Handler for Step 1 research item click
  const handleStep1ItemClick = useCallback((item: any) => {
    const myApprovalType = departmentApprovalType[userDepartment];
    if (!myApprovalType || !newProductsData) return;
    
    const approval = newProductsData.approvals.find(
      a => a.card_id === item.id && a.approval_type === myApprovalType
    );
    
    setResearchDrawerState({
      open: true,
      cardId: item.id,
      cardTitle: item.title,
      cardImageUrl: item.image_url || null,
      approvalType: myApprovalType,
      approval,
    });
  }, [userDepartment, newProductsData]);

  // Handler for Step 2/3 item click (opens regular drawer)
  const handleWorkflowItemClick = useCallback((itemId: string) => {
    setSelectedItemId(itemId);
    setSelectedThreadId(null);
  }, []);

  const selectedItem = items.find(item => item.id === selectedItemId) || 
    (newProductsData ? [...newProductsData.step2, ...newProductsData.step3].find(i => i.id === selectedItemId) : null);

  // Real-time subscription
  const invalidateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleInvalidate = () => {
      if (invalidateTimeoutRef.current) clearTimeout(invalidateTimeoutRef.current);
      invalidateTimeoutRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['development-items'] });
        queryClient.invalidateQueries({ queryKey: ['new-products'] });
      }, 300);
    };

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'development_items' }, handleInvalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'development_card_activity' }, handleInvalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'card_unresolved_mentions' }, handleInvalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'new_product_approvals' }, handleInvalidate)
      .subscribe();

    return () => {
      if (invalidateTimeoutRef.current) clearTimeout(invalidateTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const roleLabel = ROLE_LABELS[userDepartment] || { emoji: '📋', name: 'Team' };
  const isLoading = profileLoading || itemsLoading;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        {profileLoading ? (
          <Skeleton className="h-10 w-48" />
        ) : (
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            Hello {firstName}!
          </h1>
        )}
      </div>

      {/* Pending Cards Section */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>{roleLabel.emoji}</span>
            Your Team's Pending Cards
            <span className="text-sm font-normal text-muted-foreground">({roleLabel.name})</span>
          </h2>
          {sortedPendingCards.length > 0 && (
            <span className="text-sm font-medium bg-primary/10 text-primary px-3 py-1 rounded-full">
              {sortedPendingCards.length} card{sortedPendingCards.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex gap-3 flex-wrap">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32 w-48" />
            ))}
          </div>
        ) : sortedPendingCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground font-medium">No pending actions for your team</p>
            <p className="text-sm text-muted-foreground mt-1">
              Check New Items & Samples for all ongoing cards
            </p>
            <Link to="/development">
              <Button variant="outline" className="mt-4 gap-2">
                View All Cards
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {sortedPendingCards.map((item) => (
              <DevelopmentCard
                key={item.id}
                item={item}
                onClick={() => handleCardClick(item.id)}
                onDragStart={(e) => handleDragStart(e, item.id)}
                canDrag={false}
              />
            ))}
          </div>
        )}
      </div>

      {/* New Products Workflow Section - only for non-traders with pending items */}
      {userDepartment !== 'trader' && totalPendingNewProducts > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              New Products Workflow
            </h2>
            <span className="text-sm font-medium bg-primary/10 text-primary px-3 py-1 rounded-full">
              {totalPendingNewProducts} task{totalPendingNewProducts !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-4">
            {/* Step 1 Items */}
            {pendingStep1Items.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Step 1: {step1Labels[userDepartment] || 'Research'}
                  </span>
                  <span className="text-xs text-muted-foreground">({pendingStep1Items.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {pendingStep1Items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleStep1ItemClick(item)}
                      className="flex items-center gap-2 bg-muted/50 hover:bg-muted rounded-lg px-3 py-2 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded bg-background flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate max-w-[180px]">{item.title}</p>
                        {item.product_code && (
                          <p className="text-xs text-muted-foreground">{item.product_code}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2 Items - Quality only */}
            {pendingStep2Items.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Step 2: Cadastrar Código
                  </span>
                  <span className="text-xs text-muted-foreground">({pendingStep2Items.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {pendingStep2Items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleWorkflowItemClick(item.id)}
                      className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded bg-background flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate max-w-[180px]">{item.title}</p>
                        {item.product_code && (
                          <p className="text-xs text-muted-foreground">{item.product_code}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3 Items - Buyer only */}
            {pendingStep3Items.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Step 3: Ready for Order
                  </span>
                  <span className="text-xs text-muted-foreground">({pendingStep3Items.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {pendingStep3Items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleWorkflowItemClick(item.id)}
                      className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded bg-background flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate max-w-[180px]">{item.title}</p>
                        {item.product_code && (
                          <p className="text-xs text-muted-foreground">{item.product_code}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Link to New Products page */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4 pt-4 border-t">
            <span>💡</span>
            <span>View all products in workflow at</span>
            <Link to="/new-products" className="text-primary hover:underline font-medium">
              New Products
            </Link>
          </div>
        </div>
      )}

      {/* Link to full view */}
      {sortedPendingCards.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>💡</span>
          <span>To see all ongoing cards, go to</span>
          <Link to="/development" className="text-primary hover:underline font-medium">
            New Items & Samples
          </Link>
        </div>
      )}

      {/* Item Detail Drawer */}
      <ItemDetailDrawer
        item={selectedItem as DevelopmentItem | null}
        open={!!selectedItemId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedItemId(null);
            setSelectedThreadId(null);
          }
        }}
      />

      {/* Research Approval Drawer for Step 1 items */}
      {researchDrawerState && (
        <ResearchApprovalDrawer
          open={researchDrawerState.open}
          onOpenChange={(open) => {
            if (!open) setResearchDrawerState(null);
          }}
          cardId={researchDrawerState.cardId}
          cardTitle={researchDrawerState.cardTitle}
          cardImageUrl={researchDrawerState.cardImageUrl}
          approvalType={researchDrawerState.approvalType}
          approval={researchDrawerState.approval}
          onOpenOriginalCard={() => {
            setResearchDrawerState(null);
            setSelectedItemId(researchDrawerState.cardId);
          }}
        />
      )}
    </div>
  );
}
