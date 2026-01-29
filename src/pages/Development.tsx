import { useState, useMemo, useCallback, useDeferredValue } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Filter, Eye, EyeOff, Trash2, Users, FileSpreadsheet } from 'lucide-react';
import { TeamSection } from '@/components/development/TeamSection';
import { CreateCardModal } from '@/components/development/CreateCardModal';
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
}

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
  
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [cardTypeFilter, setCardTypeFilter] = useState<string>('all');
  const [creatorRoleFilter, setCreatorRoleFilter] = useState<string>('all');
  const [showSolved, setShowSolved] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

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

      // Fetch sample counts, product counts, latest activity, user views, creator profiles, and unresolved questions in parallel
      const [sampleCountsRes, productCountsRes, latestActivitiesRes, userViewsRes, creatorProfilesRes, unresolvedQuestionsRes] = await Promise.all([
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

      return data.map(item => {
        // Compute effective pending action type
        let effectivePendingActionType = item.pending_action_type;
        
        // If no pending_action_type but has unresolved question, compute it
        if (!effectivePendingActionType && cardsWithUnresolvedQuestions.has(item.id)) {
          effectivePendingActionType = 'question';
        }

        return {
          ...item,
          card_type: item.card_type || 'item',
          is_solved: item.is_solved || false,
          deleted_at: item.deleted_at || null,
          deleted_by: item.deleted_by || null,
          current_owner: item.current_owner || 'arc',
          samples_count: sampleCountMap[item.id] || 0,
          products_count: productCountMap[item.id] || 0,
          latest_activity_at: latestActivityMap[item.id] || item.created_at,
          last_viewed_at: userViewMap[item.id] || null,
          creator_name: creatorNameMap[item.created_by] || null,
          pending_action_type: effectivePendingActionType,
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
      
      // Map old status to new for solved filtering
      const mappedStatus = mapOldStatusToNew(item.status);
      const matchesSolvedFilter = showSolved ? mappedStatus === 'solved' : mappedStatus !== 'solved';
      
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
          <div className="flex gap-2">
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

        {/* Filters */}
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
      </div>

      {/* Two-Section Layout: MOR / ARC */}
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
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDropToOwner(e, 'arc')}
            canManage={canManage}
          />
        </div>
      </div>

      {/* Create Modal */}
      <CreateCardModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />

      {/* Detail Drawer */}
      <ItemDetailDrawer
        item={selectedItem || null}
        open={!!selectedItemId}
        onOpenChange={(open) => !open && setSelectedItemId(null)}
      />
    </div>
  );
}
