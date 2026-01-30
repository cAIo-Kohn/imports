import { useState, useMemo, useCallback, useDeferredValue, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { usePendingActionNotifications } from '@/hooks/usePendingActionNotifications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Filter, Eye, EyeOff, Trash2, Users, FileSpreadsheet, LayoutGrid, Package } from 'lucide-react';
import { TeamSection } from '@/components/development/TeamSection';
import { CreateCardModal } from '@/components/development/CreateCardModal';
import { SampleTrackerView } from '@/components/development/SampleTrackerView';
import { ItemDetailDrawer } from '@/components/development/ItemDetailDrawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { toast } from '@/hooks/use-toast';

// New simplified types
export type DevelopmentCardStatus = 'pending' | 'in_progress' | 'waiting' | 'solved';
export type DevelopmentCardType = 'item' | 'item_group' | 'task';
export type DevelopmentItemPriority = 'low' | 'medium' | 'high' | 'urgent';
export type DevelopmentProductCategory = 'final_product' | 'raw_material';

// Legacy types kept for backward compatibility during transition
export type DevelopmentItemStatus = 
  | 'backlog' 
  | 'in_progress' 
  | 'waiting_supplier' 
  | 'sample_requested' 
  | 'sample_in_transit' 
  | 'sample_received' 
  | 'under_review' 
  | 'approved' 
  | 'rejected';

export type DevelopmentItemType = 'new_item' | 'sample' | 'development';

export type DevelopmentCardOwner = 'mor' | 'arc';

export interface DevelopmentItem {
  id: string;
  title: string;
  description: string | null;
  status: DevelopmentItemStatus;
  priority: DevelopmentItemPriority;
  item_type: DevelopmentItemType;
  card_type: DevelopmentCardType;
  product_category: DevelopmentProductCategory | null;
  is_solved: boolean;
  product_code: string | null;
  supplier_id: string | null;
  assigned_to: string | null;
  created_by: string;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  current_owner: DevelopmentCardOwner;
  image_url: string | null;
  supplier?: { id: string; company_name: string } | null;
  assigned_profile?: { id: string; full_name: string | null; email: string | null } | null;
  samples_count?: number;
  products_count?: number;
  // For unseen activity indicator
  latest_activity_at?: string;
  last_viewed_at?: string | null;
  // Creator info
  creator_name?: string | null;
  // Pending action tracking
  pending_action_type?: string | null;
  pending_action_due_at?: string | null;
  pending_action_snoozed_until?: string | null;
  pending_action_snoozed_by?: string | null;
  // Pending threads count and info for current user's team
  pending_threads_count?: number;
  pending_threads_info?: { id: string; title: string }[];
  // Derived status (computed from pending_action_type, is_solved, etc.)
  derived_status?: DevelopmentCardStatus;
}

// Derive card status automatically from pending_action_type, snooze, and is_solved
export const deriveCardStatus = (item: {
  is_solved?: boolean;
  pending_action_snoozed_until?: string | null;
  pending_action_type?: string | null;
  latest_activity_at?: string;
  created_at?: string;
}): DevelopmentCardStatus => {
  // Solved takes priority
  if (item.is_solved) return 'solved';
  
  // Check if snoozed (waiting)
  if (item.pending_action_snoozed_until) {
    const snoozeDate = new Date(item.pending_action_snoozed_until);
    if (snoozeDate > new Date()) return 'waiting';
  }
  
  // Check pending action type
  const actionType = item.pending_action_type;
  
  // These mean "waiting for something external"
  if (actionType === 'sample_in_transit' || actionType === 'sample_pending') {
    return 'waiting';
  }
  
  // These mean "action needed" (pending)
  if (actionType === 'question' || 
      actionType === 'answer_pending' || 
      actionType === 'sample_tracking' || 
      actionType === 'sample_review' || 
      actionType === 'commercial_review') {
    return 'pending';
  }
  
  // No blocking action - check if card has any activity (in progress)
  if (item.latest_activity_at && item.created_at && item.latest_activity_at !== item.created_at) {
    return 'in_progress';
  }
  
  // Fresh card with no activity
  return 'pending';
};

// New simplified status order (3 active + 1 solved)
const STATUS_ORDER: DevelopmentCardStatus[] = [
  'pending',
  'in_progress',
  'waiting',
];

// Map old statuses to new ones for display purposes
const mapOldStatusToNew = (oldStatus: DevelopmentItemStatus): DevelopmentCardStatus => {
  switch (oldStatus) {
    case 'backlog':
      return 'pending';
    case 'in_progress':
      return 'in_progress';
    case 'waiting_supplier':
    case 'sample_requested':
    case 'sample_in_transit':
    case 'sample_received':
    case 'under_review':
      return 'waiting';
    case 'approved':
    case 'rejected':
      return 'solved';
    default:
      return 'pending';
  }
};

export default function Development() {
  const { user } = useAuth();
  const { canManageOrders, isTrader, isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  
  // Enable pending action notifications (sound + browser notifications)
  usePendingActionNotifications();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [cardTypeFilter, setCardTypeFilter] = useState<string>('all');
  const [creatorRoleFilter, setCreatorRoleFilter] = useState<string>('all');
  const [showSolved, setShowSolved] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'samples'>('cards');

  // Deferred search for smoother typing
  const deferredSearchTerm = useDeferredValue(searchTerm);

  // Fetch development items with caching
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['development-items', user?.id],
    staleTime: 30 * 1000, // Data is fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false, // Don't refetch on tab switch
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
      
      // Get unique creator user IDs
      const creatorIds = [...new Set(data.map(item => item.created_by).filter(Boolean))];

      // Fetch sample counts, product counts, latest activity, user views, creator profiles, unresolved questions, unacknowledged answers, and pending threads in parallel
      const [sampleCountsRes, productCountsRes, latestActivitiesRes, userViewsRes, creatorProfilesRes, unresolvedQuestionsRes, unacknowledgedAnswersRes, pendingThreadsRes] = await Promise.all([
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
        // Fetch unresolved questions to compute pending action type
        supabase
          .from('development_card_activity')
          .select('card_id, metadata')
          .eq('activity_type', 'question')
          .in('card_id', itemIds),
        // Fetch unacknowledged answers to compute pending action type
        supabase
          .from('development_card_activity')
          .select('card_id, metadata')
          .eq('activity_type', 'answer')
          .in('card_id', itemIds),
        // Fetch pending threads (thread roots with pending_for_team set and not resolved)
        supabase
          .from('development_card_activity')
          .select('id, card_id, pending_for_team, thread_title, activity_type, content')
          .in('card_id', itemIds)
          .not('pending_for_team', 'is', null)
          .is('thread_resolved_at', null),
      ]);

      const sampleCountMap = (sampleCountsRes.data || []).reduce((acc, s) => {
        acc[s.item_id] = (acc[s.item_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const productCountMap = (productCountsRes.data || []).reduce((acc, p) => {
        acc[p.card_id] = (acc[p.card_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Get latest activity per card (MAX created_at)
      const latestActivityMap = (latestActivitiesRes.data || []).reduce((acc, a) => {
        if (!acc[a.card_id] || new Date(a.created_at) > new Date(acc[a.card_id])) {
          acc[a.card_id] = a.created_at;
        }
        return acc;
      }, {} as Record<string, string>);

      // Get user's last viewed times
      const userViewMap = (userViewsRes.data || []).reduce((acc, v) => {
        acc[v.card_id] = v.last_viewed_at;
        return acc;
      }, {} as Record<string, string>);

      // Get creator names
      const creatorNameMap = (creatorProfilesRes.data || []).reduce((acc, p) => {
        acc[p.user_id] = p.full_name;
        return acc;
      }, {} as Record<string, string | null>);

      // Compute cards with unresolved questions
      const cardsWithUnresolvedQuestions = new Set<string>();
      for (const q of unresolvedQuestionsRes.data || []) {
        const metadata = q.metadata as { resolved?: boolean } | null;
        if (!metadata?.resolved) {
          cardsWithUnresolvedQuestions.add(q.card_id);
        }
      }

      // Compute cards with unacknowledged answers
      const cardsWithUnacknowledgedAnswers = new Set<string>();
      for (const a of unacknowledgedAnswersRes.data || []) {
        const metadata = a.metadata as { acknowledged?: boolean } | null;
        if (!metadata?.acknowledged) {
          cardsWithUnacknowledgedAnswers.add(a.card_id);
        }
      }

      // Compute pending threads count and info per card for user's team
      // Determine user's team based on role
      const userTeam = isTrader ? 'arc' : 'mor';
      const pendingThreadsCountMap: Record<string, number> = {};
      const pendingThreadsInfoMap: Record<string, { id: string; title: string }[]> = {};
      
      for (const pt of pendingThreadsRes.data || []) {
        // Only count threads pending for the user's team
        if (pt.pending_for_team === userTeam) {
          pendingThreadsCountMap[pt.card_id] = (pendingThreadsCountMap[pt.card_id] || 0) + 1;
          
          // Build thread title for tooltip
          const title = pt.thread_title || 
            (pt.content ? pt.content.split(' ').slice(0, 6).join(' ') + (pt.content.split(' ').length > 6 ? '...' : '') : null) ||
            (pt.activity_type === 'sample_requested' ? 'Sample Request' : 'Thread');
          
          if (!pendingThreadsInfoMap[pt.card_id]) {
            pendingThreadsInfoMap[pt.card_id] = [];
          }
          pendingThreadsInfoMap[pt.card_id].push({ id: (pt as any).id, title });
        }
      }

      return data.map(item => {
        // Compute effective pending action type
        let effectivePendingActionType = item.pending_action_type;
        
        // If no pending_action_type but has unresolved question, compute it
        if (!effectivePendingActionType && cardsWithUnresolvedQuestions.has(item.id)) {
          effectivePendingActionType = 'question';
        }
        
        // If no pending_action_type but has unacknowledged answer (and no unresolved question), set answer_pending
        if (!effectivePendingActionType && !cardsWithUnresolvedQuestions.has(item.id) && cardsWithUnacknowledgedAnswers.has(item.id)) {
          effectivePendingActionType = 'answer_pending';
        }

        const latestActivity = latestActivityMap[item.id] || item.created_at;

        // Derive status automatically from actions
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
          current_owner: item.current_owner || 'arc',
          samples_count: sampleCountMap[item.id] || 0,
          products_count: productCountMap[item.id] || 0,
          latest_activity_at: latestActivity,
          last_viewed_at: userViewMap[item.id] || null,
          creator_name: creatorNameMap[item.created_by] || null,
          pending_action_type: effectivePendingActionType,
          pending_threads_count: pendingThreadsCountMap[item.id] || 0,
          pending_threads_info: pendingThreadsInfoMap[item.id] || [],
          derived_status: derivedStatus,
        };
      }) as DevelopmentItem[];
    },
  });

  // Fetch suppliers for filter
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, company_name')
        .eq('is_active', true)
        .order('company_name');
      if (error) throw error;
      return data;
    },
  });

  // Update item status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ itemId, newStatus }: { itemId: string; newStatus: DevelopmentCardStatus }) => {
      // Map new status to old status for database (using the old enum until full migration)
      const statusMap: Record<DevelopmentCardStatus, DevelopmentItemStatus> = {
        pending: 'backlog',
        in_progress: 'in_progress',
        waiting: 'waiting_supplier',
        solved: 'approved',
      };
      
      const dbStatus = statusMap[newStatus];
      const isSolved = newStatus === 'solved';
      
      const { error } = await supabase
        .from('development_items')
        .update({ 
          status: dbStatus,
          is_solved: isSolved,
        })
        .eq('id', itemId);
      if (error) throw error;

      // Log the activity
      if (user?.id) {
        await supabase.from('development_card_activity').insert({
          card_id: itemId,
          user_id: user.id,
          activity_type: 'status_change',
          content: `Status changed to ${newStatus}`,
          metadata: { new_status: newStatus },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update item status',
        variant: 'destructive',
      });
    },
  });

  // Memoized filtered items using deferred search
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = deferredSearchTerm === '' || 
        item.title.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
        item.product_code?.toLowerCase().includes(deferredSearchTerm.toLowerCase());
      
      const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
      const matchesCardType = cardTypeFilter === 'all' || item.card_type === cardTypeFilter;
      const matchesCreatorRole = creatorRoleFilter === 'all' || 
        (item as any).created_by_role === creatorRoleFilter;
      
      // Use derived status for solved filtering
      const status = item.derived_status || 'pending';
      const matchesSolvedFilter = showSolved ? status === 'solved' : status !== 'solved';
      
      // Filter by deleted status - only admins can see deleted items
      const isDeleted = !!item.deleted_at;
      const matchesDeletedFilter = showDeleted ? isDeleted : !isDeleted;
      
      return matchesSearch && matchesPriority && matchesCardType && matchesCreatorRole && matchesSolvedFilter && matchesDeletedFilter;
    });
  }, [items, deferredSearchTerm, priorityFilter, cardTypeFilter, creatorRoleFilter, showSolved, showDeleted]);

  // Memoized grouped items by owner (MOR/ARC)
  const { morItems, arcItems } = useMemo(() => ({
    morItems: filteredItems.filter(item => item.current_owner === 'mor'),
    arcItems: filteredItems.filter(item => item.current_owner === 'arc'),
  }), [filteredItems]);

  // Stabilized event handlers
  const handleCardClick = useCallback((itemId: string) => {
    setSelectedItemId(itemId);
    setSelectedThreadId(null); // Reset thread selection when opening normally
  }, []);

  const handleCardClickThread = useCallback((itemId: string, threadId: string) => {
    setSelectedItemId(itemId);
    setSelectedThreadId(threadId);
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData('itemId', itemId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Check if user can manage (admin, buyer, or trader)
  const canManage = canManageOrders || isTrader;

  const handleDropToOwner = useCallback(async (e: React.DragEvent, targetOwner: DevelopmentCardOwner) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('itemId');
    if (!itemId || !canManage) return;

    const item = items.find(i => i.id === itemId);
    if (!item || item.current_owner === targetOwner) return;

    // Update the owner
    const { error } = await (supabase.from('development_items') as any)
      .update({ 
        current_owner: targetOwner,
        is_new_for_other_team: true,
      })
      .eq('id', itemId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to move card', variant: 'destructive' });
      return;
    }

    // Log the movement
    if (user?.id) {
      await supabase.from('development_card_activity').insert({
        card_id: itemId,
        user_id: user.id,
        activity_type: 'ownership_change',
        content: `Card moved to ${targetOwner === 'mor' ? 'MOR (Brazil)' : 'ARC (China)'}`,
        metadata: { new_owner: targetOwner },
      });
    }

    queryClient.invalidateQueries({ queryKey: ['development-items'] });
    toast({ title: 'Success', description: `Card moved to ${targetOwner === 'mor' ? 'MOR (Brazil)' : 'ARC (China)'}` });
  }, [items, canManage, user?.id, queryClient]);

  const selectedItem = items.find(item => item.id === selectedItemId);

  // Real-time subscription for development items
  const invalidateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel('development-items-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'development_items',
        },
        () => {
          // Debounce: wait 300ms before refetching to batch rapid changes
          if (invalidateTimeoutRef.current) {
            clearTimeout(invalidateTimeoutRef.current);
          }
          invalidateTimeoutRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['development-items'] });
          }, 300);
        }
      )
      .subscribe();

    return () => {
      if (invalidateTimeoutRef.current) {
        clearTimeout(invalidateTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Export to Google Sheets handler
  const handleExportToSheets = async () => {
    setIsExporting(true);
    try {
      const response = await supabase.functions.invoke('export-to-sheets', {
        body: { 
          spreadsheetId: '1OKtCJQxnZgHUTxZVDrTaVS7Y8xbMTXaKAW-q_YzoA0U',
          sheetName: 'Development Cards'
        }
      });
      
      if (response.error) throw response.error;
      
      toast({
        title: 'Export Successful',
        description: `${response.data.rowsExported} cards exported to Google Sheets`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-4 md:p-6 border-b bg-background w-full">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Development Cards</h1>
            <p className="text-muted-foreground">
              Track items, samples, and tasks
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {/* View Toggle */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              <Button
                variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 gap-1"
                onClick={() => setViewMode('cards')}
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Cards</span>
              </Button>
              <Button
                variant={viewMode === 'samples' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 gap-1"
                onClick={() => setViewMode('samples')}
              >
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Samples</span>
              </Button>
            </div>

            {canManage && (
              <Button 
                variant="outline" 
                onClick={handleExportToSheets}
                disabled={isExporting}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {isExporting ? 'Exporting...' : 'Export to Sheets'}
              </Button>
            )}
            {canManage && (
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Card
              </Button>
            )}
          </div>
        </div>

        {/* Filters - only show for cards view */}
        {viewMode === 'cards' && (
          <div className="flex flex-wrap gap-3 mt-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or product code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={cardTypeFilter} onValueChange={setCardTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="item">Single Item</SelectItem>
                <SelectItem value="item_group">Item Group</SelectItem>
                <SelectItem value="task">Task</SelectItem>
              </SelectContent>
            </Select>

            <Select value={creatorRoleFilter} onValueChange={setCreatorRoleFilter}>
              <SelectTrigger className="w-[160px]">
                <Users className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="buyer">Buyer</SelectItem>
                <SelectItem value="quality">Quality</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="trader">Trader</SelectItem>
              </SelectContent>
            </Select>

            <Toggle
              pressed={showSolved}
              onPressedChange={setShowSolved}
              variant="outline"
              className="gap-2"
            >
              {showSolved ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {showSolved ? 'Showing Solved' : 'Show Solved'}
            </Toggle>

            {/* Show Deleted toggle - Admin only */}
            {isAdmin && (
              <Toggle
                pressed={showDeleted}
                onPressedChange={setShowDeleted}
                variant="outline"
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {showDeleted ? 'Showing Deleted' : 'Show Deleted'}
              </Toggle>
            )}
          </div>
        )}
      </div>

      {/* Main Content - conditionally render based on view mode */}
      {viewMode === 'cards' ? (
        /* Two-Section Layout: MOR / ARC */
        <div className="flex-1 min-w-0 overflow-hidden p-4 md:p-6">
          <div className="flex gap-4 md:gap-6 h-full">
            {/* MOR (Brazil) Section */}
            <TeamSection
              title="MOR (Brazil)"
              subtitle="Cards waiting for Brazil's input"
              items={morItems}
              colorClass="border-blue-300 bg-blue-50/30"
              flagEmoji="🇧🇷"
              onCardClick={handleCardClick}
              onCardClickThread={handleCardClickThread}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropToOwner(e, 'mor')}
              canManage={canManage}
            />

            {/* ARC (China) Section */}
            <TeamSection
              title="ARC (China)"
              subtitle="Cards waiting for China's action"
              items={arcItems}
              colorClass="border-emerald-300 bg-emerald-50/30"
              flagEmoji="🇨🇳"
              onCardClick={handleCardClick}
              onCardClickThread={handleCardClickThread}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropToOwner(e, 'arc')}
              canManage={canManage}
            />
          </div>
        </div>
      ) : (
        /* Sample Tracker View */
        <SampleTrackerView onOpenCard={handleCardClick} />
      )}

      {/* Create Modal */}
      <CreateCardModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />

      {/* Detail Drawer */}
      <ItemDetailDrawer
        item={selectedItem || null}
        open={!!selectedItemId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedItemId(null);
            setSelectedThreadId(null);
          }
        }}
        targetThreadId={selectedThreadId}
      />
    </div>
  );
}
