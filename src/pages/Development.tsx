import { useState, useMemo, useCallback, useDeferredValue } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { usePendingActionNotifications } from '@/hooks/usePendingActionNotifications';
import { useDevelopmentItems } from '@/hooks/useDevelopmentItems';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Filter, Eye, EyeOff, Trash2, Users, FileSpreadsheet, LayoutGrid, Package } from 'lucide-react';
import { DepartmentSection } from '@/components/development/DepartmentSection';
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
  created_by_role?: 'buyer' | 'trader' | 'admin' | 'quality' | 'marketing' | null;
  // Pending action tracking
  pending_action_type?: string | null;
  pending_action_due_at?: string | null;
  pending_action_snoozed_until?: string | null;
  pending_action_snoozed_by?: string | null;
  // Derived status (computed from pending_action_type, is_solved, etc.)
  derived_status?: DevelopmentCardStatus;
  // Assignment columns - the source of truth for "whose turn"
  assigned_to_users?: string[] | null;
  assigned_to_role?: string | null;
  // Unread count for notification badge
  unread_count?: number;
  // Workflow status for responsibility tracking
  workflow_status?: string | null;
  current_assignee_role?: 'buyer' | 'trader' | 'quality' | null;
  // Unresolved mentions for display
  unresolved_mentions?: { user_id: string; user_name: string | null }[];
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

  // Fetch all user roles for department filtering (needed to know which users are in which department)
  const { data: allUserRoles = [] } = useQuery({
    queryKey: ['all-user-roles-for-filter'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (error) {
        console.error('Failed to fetch user roles:', error);
        return [];
      }
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

  // Centralized hook: shared cache between Development and Dashboard, includes realtime
  const { data: items = [], isLoading, isMutatingRef } = useDevelopmentItems();

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
    onMutate: () => {
      isMutatingRef.current = true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
    },
    onSettled: () => {
      // Reset after a delay to allow realtime event to be skipped
      setTimeout(() => { isMutatingRef.current = false; }, 1000);
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
      
      // Department filter - matches if:
      // 1) created by anyone in that department
      // 2) has an Action notification (current_assignee_role) for the department
      // 3) has an unresolved mention for someone in that department
      let matchesDepartment = creatorRoleFilter === 'all';
      if (!matchesDepartment) {
        // Check condition 1: created by someone in the department
        const creatorRole = (item as any).created_by_role;
        if (creatorRole === creatorRoleFilter) {
          matchesDepartment = true;
        }
        
        // Check condition 2: current_assignee_role matches the department
        if (!matchesDepartment && item.current_assignee_role === creatorRoleFilter) {
          matchesDepartment = true;
        }
        
        // Check condition 3: has unresolved mention for someone in that department
        if (!matchesDepartment && item.unresolved_mentions && item.unresolved_mentions.length > 0) {
          for (const mention of item.unresolved_mentions) {
            const mentionedUserRoles = userRolesMap[mention.user_id] || [];
            if (mentionedUserRoles.includes(creatorRoleFilter)) {
              matchesDepartment = true;
              break;
            }
          }
        }
      }
      
      // Use derived status for solved filtering
      const status = item.derived_status || 'pending';
      const matchesSolvedFilter = showSolved ? status === 'solved' : status !== 'solved';
      
      // Filter by deleted status - only admins can see deleted items
      const isDeleted = !!item.deleted_at;
      const matchesDeletedFilter = showDeleted ? isDeleted : !isDeleted;
      
      return matchesSearch && matchesPriority && matchesCardType && matchesDepartment && matchesSolvedFilter && matchesDeletedFilter;
    });
  }, [items, deferredSearchTerm, priorityFilter, cardTypeFilter, creatorRoleFilter, showSolved, showDeleted, userRolesMap]);

  // Group items by creator's department (role)
  const itemsByDepartment = useMemo(() => {
    const grouped: Record<string, DevelopmentItem[]> = {
      buyer: [],
      quality: [],
      trader: [],
      marketing: [],
    };
    
    for (const item of filteredItems) {
      const role = item.created_by_role || 'buyer'; // Default to buyer if no role
      if (grouped[role]) {
        grouped[role].push(item);
      } else {
        // Handle admin or other roles - put in buyer section
        grouped.buyer.push(item);
      }
    }
    
    return grouped;
  }, [filteredItems]);

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

  const handleDropToSection = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    // No-op for now - cards are moved via assignment, not drag-drop
  }, []);

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
                <SelectItem value="buyer">Comex</SelectItem>
                <SelectItem value="quality">Quality</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="trader">ARC</SelectItem>
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
        /* Dashboard by Creator's Department */
        <div className="flex-1 min-w-0 overflow-auto p-4 md:p-6">
          <div className="space-y-4">
            {/* Comex Section */}
            <DepartmentSection
              title="Comex"
              role="buyer"
              items={itemsByDepartment.buyer}
              colorClass="border-blue-300 bg-blue-50/30"
              onCardClick={handleCardClick}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDropToSection}
              canManage={canManage}
            />

            {/* Quality Section */}
            <DepartmentSection
              title="Quality"
              role="quality"
              items={itemsByDepartment.quality}
              colorClass="border-green-300 bg-green-50/30"
              onCardClick={handleCardClick}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDropToSection}
              canManage={canManage}
            />

            {/* ARC Section */}
            <DepartmentSection
              title="ARC"
              role="trader"
              items={itemsByDepartment.trader}
              colorClass="border-amber-300 bg-amber-50/30"
              onCardClick={handleCardClick}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDropToSection}
              canManage={canManage}
            />

            {/* Marketing Section */}
            <DepartmentSection
              title="Marketing"
              role="marketing"
              items={itemsByDepartment.marketing}
              colorClass="border-purple-300 bg-purple-50/30"
              onCardClick={handleCardClick}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDropToSection}
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
          }
        }}
      />
    </div>
  );
}
