import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Filter } from 'lucide-react';
import { KanbanBoard } from '@/components/development/KanbanBoard';
import { CreateItemModal } from '@/components/development/CreateItemModal';
import { ItemDetailDrawer } from '@/components/development/ItemDetailDrawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

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

export type DevelopmentItemPriority = 'low' | 'medium' | 'high' | 'urgent';
export type DevelopmentItemType = 'new_item' | 'sample' | 'development';

export interface DevelopmentItem {
  id: string;
  title: string;
  description: string | null;
  status: DevelopmentItemStatus;
  priority: DevelopmentItemPriority;
  item_type: DevelopmentItemType;
  product_code: string | null;
  supplier_id: string | null;
  assigned_to: string | null;
  created_by: string;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  supplier?: { id: string; company_name: string } | null;
  assigned_profile?: { id: string; full_name: string | null; email: string | null } | null;
  samples_count?: number;
}

const STATUS_ORDER: DevelopmentItemStatus[] = [
  'backlog',
  'in_progress',
  'waiting_supplier',
  'sample_requested',
  'sample_in_transit',
  'sample_received',
  'under_review',
  'approved',
  'rejected',
];

export default function Development() {
  const { user } = useAuth();
  const { canManageOrders } = useUserRole();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Fetch development items
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['development-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('development_items')
        .select(`
          *,
          supplier:suppliers(id, company_name)
        `)
        .order('position', { ascending: true });

      if (error) throw error;

      // Fetch sample counts
      const itemIds = data.map(item => item.id);
      const { data: sampleCounts } = await supabase
        .from('development_item_samples')
        .select('item_id')
        .in('item_id', itemIds);

      const countMap = (sampleCounts || []).reduce((acc, s) => {
        acc[s.item_id] = (acc[s.item_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return data.map(item => ({
        ...item,
        samples_count: countMap[item.id] || 0,
      })) as DevelopmentItem[];
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
    mutationFn: async ({ itemId, newStatus }: { itemId: string; newStatus: DevelopmentItemStatus }) => {
      const { error } = await supabase
        .from('development_items')
        .update({ status: newStatus })
        .eq('id', itemId);
      if (error) throw error;
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

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product_code?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
    const matchesSupplier = supplierFilter === 'all' || item.supplier_id === supplierFilter;
    
    return matchesSearch && matchesPriority && matchesSupplier;
  });

  // Group items by status
  const itemsByStatus = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = filteredItems.filter(item => item.status === status);
    return acc;
  }, {} as Record<DevelopmentItemStatus, DevelopmentItem[]>);

  const handleCardClick = (itemId: string) => {
    setSelectedItemId(itemId);
  };

  const handleStatusChange = (itemId: string, newStatus: DevelopmentItemStatus) => {
    if (canManageOrders) {
      updateStatusMutation.mutate({ itemId, newStatus });
    }
  };

  const selectedItem = items.find(item => item.id === selectedItemId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-4 md:p-6 border-b bg-background">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">New Items & Samples</h1>
            <p className="text-muted-foreground">
              Manage product development and sample tracking
            </p>
          </div>
          {canManageOrders && (
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Item
            </Button>
          )}
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
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Supplier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden">
        <KanbanBoard
          itemsByStatus={itemsByStatus}
          statusOrder={STATUS_ORDER}
          isLoading={isLoading}
          onCardClick={handleCardClick}
          onStatusChange={handleStatusChange}
          canManage={canManageOrders}
        />
      </div>

      {/* Create Modal */}
      <CreateItemModal
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
