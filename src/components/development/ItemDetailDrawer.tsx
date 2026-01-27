import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { Package, MessageSquare, FileText, Layers, Trash2, RotateCcw } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { DevelopmentItem, DevelopmentCardStatus, DevelopmentItemPriority, DevelopmentCardType } from '@/pages/Development';
import { SampleTrackingCard } from './SampleTrackingCard';
import { AddSampleForm } from './AddSampleForm';
import { UnifiedActivityTimeline } from './UnifiedActivityTimeline';
import { GroupedItemsEditor } from './GroupedItemsEditor';
import { ImageUpload } from './ImageUpload';
import { CommercialDataSection } from './CommercialDataSection';
import { DeleteCardDialog } from './DeleteCardDialog';
import { cn } from '@/lib/utils';

interface ItemDetailDrawerProps {
  item: DevelopmentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_OPTIONS: { value: DevelopmentCardStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'solved', label: 'Solved' },
];

const PRIORITY_STYLES: Record<DevelopmentItemPriority, string> = {
  urgent: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-white',
  low: 'bg-slate-400 text-white',
};

const CARD_TYPE_LABELS: Record<DevelopmentCardType, string> = {
  item: 'Single Item',
  item_group: 'Item Group',
  task: 'Task',
};

// Map old status to new simplified status
const mapOldToNewStatus = (oldStatus: string): DevelopmentCardStatus => {
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

// Map new status to old status for database
const mapNewToOldStatus = (newStatus: DevelopmentCardStatus): string => {
  switch (newStatus) {
    case 'pending':
      return 'backlog';
    case 'in_progress':
      return 'in_progress';
    case 'waiting':
      return 'waiting_supplier';
    case 'solved':
      return 'approved';
    default:
      return 'backlog';
  }
};

export function ItemDetailDrawer({ item, open, onOpenChange }: ItemDetailDrawerProps) {
  const { canManageOrders, isTrader, isBuyer, isAdmin } = useUserRole();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('details');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const canManage = canManageOrders || isTrader;
  const canDelete = canManage;
  const canRestore = isAdmin;

  // Mark as seen when opened by the other team
  useEffect(() => {
    const markAsSeen = async () => {
      if (!item?.id || !open) return;
      
      // Check if this card is new for the current user
      const isNewForMe = (item as any).is_new_for_other_team && (
        (isBuyer && (item as any).created_by_role === 'trader') ||
        (isTrader && (item as any).created_by_role === 'buyer')
      );

      if (isNewForMe) {
        await (supabase.from('development_items') as any)
          .update({ is_new_for_other_team: false })
          .eq('id', item.id);
        queryClient.invalidateQueries({ queryKey: ['development-items'] });
      }
    };

    markAsSeen();
  }, [item?.id, open, isBuyer, isTrader, queryClient]);

  // Fetch samples for this item
  const { data: samples = [] } = useQuery({
    queryKey: ['development-item-samples', item?.id],
    queryFn: async () => {
      if (!item?.id) return [];
      const { data, error } = await supabase
        .from('development_item_samples')
        .select('*')
        .eq('item_id', item.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!item?.id,
  });

  // Update item mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<DevelopmentItem> & { newStatus?: DevelopmentCardStatus }) => {
      if (!item?.id) return;
      
      const dbUpdates: Record<string, unknown> = {};
      
      if (updates.newStatus) {
        dbUpdates.status = mapNewToOldStatus(updates.newStatus);
        dbUpdates.is_solved = updates.newStatus === 'solved';
        
        // Log status change
        if (user?.id) {
          await supabase.from('development_card_activity').insert({
            card_id: item.id,
            user_id: user.id,
            activity_type: 'status_change',
            content: `Status changed to ${updates.newStatus}`,
            metadata: { new_status: updates.newStatus },
          });
        }
      }
      
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
      if (updates.due_date !== undefined) dbUpdates.due_date = updates.due_date;
      if ((updates as any).image_url !== undefined) dbUpdates.image_url = (updates as any).image_url;

      const { error } = await (supabase
        .from('development_items') as any)
        .update(dbUpdates)
        .eq('id', item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', item?.id] });
      toast({ title: 'Success', description: 'Item updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update item', variant: 'destructive' });
    },
  });

  // Soft delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!item?.id || !user?.id) return;
      
      const { error } = await (supabase.from('development_items') as any)
        .update({ 
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
        })
        .eq('id', item.id);
      if (error) throw error;

      // Log the deletion in activity
      await supabase.from('development_card_activity').insert({
        card_id: item.id,
        user_id: user.id,
        activity_type: 'status_change',
        content: 'Card deleted',
        metadata: { action: 'deleted' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      toast({ title: 'Success', description: 'Card deleted' });
      setShowDeleteDialog(false);
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete card', variant: 'destructive' });
    },
  });

  // Restore mutation (admin only)
  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!item?.id || !user?.id) return;
      
      const { error } = await (supabase.from('development_items') as any)
        .update({ 
          deleted_at: null,
          deleted_by: null,
        })
        .eq('id', item.id);
      if (error) throw error;

      // Log the restoration in activity
      await supabase.from('development_card_activity').insert({
        card_id: item.id,
        user_id: user.id,
        activity_type: 'status_change',
        content: 'Card restored',
        metadata: { action: 'restored' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      toast({ title: 'Success', description: 'Card restored' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to restore card', variant: 'destructive' });
    },
  });

  if (!item) return null;

  // Cast to access new fields
  const itemWithNewFields = item as any;

  const currentStatus = mapOldToNewStatus(item.status);
  const cardType = item.card_type || 'item';

  // Check if item is deleted
  const isDeleted = !!(itemWithNewFields.deleted_at);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-8">
              <SheetTitle className="text-lg">{item.title}</SheetTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {CARD_TYPE_LABELS[cardType]}
                </Badge>
                <Badge className={cn('text-xs', PRIORITY_STYLES[item.priority])}>
                  {item.priority}
                </Badge>
                {item.product_code && (
                  <Badge variant="outline" className="text-xs font-mono">
                    {item.product_code}
                  </Badge>
                )}
                {isDeleted && (
                  <Badge variant="destructive" className="text-xs">
                    Deleted
                  </Badge>
                )}
              </div>
            </div>
            
            {/* Delete / Restore Buttons */}
            <div className="flex gap-2">
              {isDeleted && canRestore && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => restoreMutation.mutate()}
                  disabled={restoreMutation.isPending}
                  title="Restore card"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              {!isDeleted && canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Delete card"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Status Selector */}
          {canManage && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={currentStatus}
                onValueChange={(v) => updateMutation.mutate({ newStatus: v as DevelopmentCardStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className={cn("grid w-full", cardType === 'item_group' ? 'grid-cols-4' : 'grid-cols-3')}>
            <TabsTrigger value="details" className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Details
            </TabsTrigger>
            {cardType === 'item_group' && (
              <TabsTrigger value="products" className="flex items-center gap-1">
                <Layers className="h-3 w-3" />
                Items
              </TabsTrigger>
            )}
            <TabsTrigger value="samples" className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              Samples ({samples.length})
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              Activity
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4 mt-4">
            {/* Picture */}
            {cardType !== 'task' && (
              <div className="space-y-2">
                <Label>Picture</Label>
                {itemWithNewFields.image_url ? (
                  <div className="space-y-2">
                    <img
                      src={itemWithNewFields.image_url}
                      alt={item.title}
                      className="max-h-40 rounded-lg border object-cover cursor-pointer"
                      onClick={() => window.open(itemWithNewFields.image_url, '_blank')}
                    />
                    {canManage && (
                      <ImageUpload
                        value={itemWithNewFields.image_url}
                        onChange={(url) => updateMutation.mutate({ image_url: url } as any)}
                        folder="cards"
                      />
                    )}
                  </div>
                ) : canManage ? (
                  <ImageUpload
                    value={null}
                    onChange={(url) => updateMutation.mutate({ image_url: url } as any)}
                    folder="cards"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No picture</p>
                )}
              </div>
            )}

            {/* Desired Outcome */}
            <div className="space-y-2">
              <Label>Desired Outcome</Label>
              {canManage ? (
                <Textarea
                  value={item.description || ''}
                  onChange={(e) => updateMutation.mutate({ description: e.target.value })}
                  placeholder="What is the expected outcome?"
                  rows={4}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {item.description || 'No description'}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                {canManage ? (
                  <Select
                    value={item.priority}
                    onValueChange={(v) => updateMutation.mutate({ priority: v as DevelopmentItemPriority })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm capitalize">{item.priority}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Due Date</Label>
                {canManage ? (
                  <Input
                    type="date"
                    value={item.due_date || ''}
                    onChange={(e) => updateMutation.mutate({ due_date: e.target.value || null })}
                  />
                ) : (
                  <p className="text-sm">
                    {item.due_date ? format(new Date(item.due_date), 'dd/MM/yyyy') : '-'}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Supplier</Label>
              <p className="text-sm">{item.supplier?.company_name || '-'}</p>
            </div>

            {/* Commercial Data Section - Only for items, not tasks */}
            {cardType !== 'task' && (
              <CommercialDataSection
                cardId={item.id}
                fobPriceUsd={itemWithNewFields.fob_price_usd}
                moq={itemWithNewFields.moq}
                qtyPerContainer={itemWithNewFields.qty_per_container}
                containerType={itemWithNewFields.container_type}
                currentOwner={itemWithNewFields.current_owner || 'arc'}
                canEdit={canManage}
                onOwnerChange={() => queryClient.invalidateQueries({ queryKey: ['development-items'] })}
              />
            )}

            <div className="space-y-2 pt-4 border-t">
              <Label className="text-muted-foreground">Metadata</Label>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Created: {format(new Date(item.created_at), 'dd/MM/yyyy HH:mm')}</p>
                <p>Updated: {format(new Date(item.updated_at), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            </div>
          </TabsContent>

          {/* Products Tab (for groups) */}
          {cardType === 'item_group' && (
            <TabsContent value="products" className="mt-4">
              <GroupedItemsEditor cardId={item.id} canEdit={canManage} />
            </TabsContent>
          )}

          {/* Samples Tab */}
          <TabsContent value="samples" className="space-y-4 mt-4">
            {canManage && <AddSampleForm itemId={item.id} />}
            
            <div className="space-y-3">
              {samples.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No samples registered yet
                </p>
              ) : (
                samples.map((sample) => (
                  <SampleTrackingCard key={sample.id} sample={sample} canEdit={canManage} />
                ))
              )}
            </div>
          </TabsContent>

          {/* Activity Tab - Now using unified timeline */}
          <TabsContent value="activity" className="mt-4">
            <UnifiedActivityTimeline 
              cardId={item.id} 
              canComment={canManage} 
              currentOwner={itemWithNewFields.current_owner || 'arc'}
              onOwnerChange={() => queryClient.invalidateQueries({ queryKey: ['development-items'] })}
            />
          </TabsContent>
        </Tabs>

        {/* Deleted info */}
        {isDeleted && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">
              This card was deleted on {format(new Date(itemWithNewFields.deleted_at), 'dd/MM/yyyy HH:mm')}
            </p>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <DeleteCardDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onConfirm={() => deleteMutation.mutate()}
          cardTitle={item.title}
          isDeleting={deleteMutation.isPending}
        />
      </SheetContent>
    </Sheet>
  );
}
