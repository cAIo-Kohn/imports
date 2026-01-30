import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { Trash2, RotateCcw } from 'lucide-react';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { DevelopmentItem, DevelopmentCardStatus, deriveCardStatus } from '@/pages/Development';
import { CardInfoSection } from './CardInfoSection';
import { HistoryTimeline } from './HistoryTimeline';
import { ActionsPanel } from './ActionsPanel';
import { DeleteCardDialog } from './DeleteCardDialog';

interface ItemDetailDrawerProps {
  item: DevelopmentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // State for forcing ActionsPanel sections open from timeline hints
  const [forcedOpenSection, setForcedOpenSection] = useState<string | null>(null);
  const [forcedMessageType, setForcedMessageType] = useState<'comment' | 'question' | null>(null);
  const [targetSampleId, setTargetSampleId] = useState<string | null>(null);
  
  // Track if this was initially a new card (persists for drawer session)
  const [wasNewForOtherTeam, setWasNewForOtherTeam] = useState(false);

  const canManage = canManageOrders || isTrader;
  const canDelete = canManage;
  const canRestore = isAdmin;

  // Fetch creator profile
  const { data: creatorProfile } = useQuery({
    queryKey: ['profile', item?.created_by],
    queryFn: async () => {
      if (!item?.created_by) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', item.created_by)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!item?.created_by,
  });

  // Capture initial "new for other team" state when drawer opens with a new item
  useEffect(() => {
    if (open && item?.id) {
      const itemWithNewFields = item as any;
      const isNewForMe = itemWithNewFields.is_new_for_other_team && (
        (isBuyer && itemWithNewFields.created_by_role === 'trader') ||
        (isTrader && itemWithNewFields.created_by_role === 'buyer')
      );
      setWasNewForOtherTeam(isNewForMe);
    }
    
    // Reset when drawer closes
    if (!open) {
      setWasNewForOtherTeam(false);
    }
  }, [open, item?.id]); // Intentionally not including item itself to avoid updates from refetch

  // Update last viewed timestamp when drawer opens (do NOT clear is_new_for_other_team here)
  useEffect(() => {
    const updateViewTimestamp = async () => {
      if (!item?.id || !open || !user?.id) return;

      // Update last viewed timestamp for current user
      const { error } = await supabase
        .from('card_user_views')
        .upsert({
          card_id: item.id,
          user_id: user.id,
          last_viewed_at: new Date().toISOString(),
        }, {
          onConflict: 'card_id,user_id',
        });

      if (!error) {
        // Optimistically mark as viewed in all matching caches
        const optimisticSeenAt = new Date().toISOString();

        queryClient.setQueriesData<DevelopmentItem[]>(
          { queryKey: ['development-items'] },
          (prev) => {
            if (!prev) return prev;
            return prev.map((it) =>
              it.id === item.id ? { ...it, last_viewed_at: optimisticSeenAt } : it
            );
          }
        );

        // Force immediate refetch to get server-confirmed data
        await queryClient.refetchQueries({
          queryKey: ['development-items'],
          type: 'active',
        });
      }
    };

    updateViewTimestamp();
  }, [item?.id, open, user?.id, queryClient]);

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: DevelopmentCardStatus) => {
      if (!item?.id) return;
      
      const { error } = await (supabase.from('development_items') as any)
        .update({ 
          status: mapNewToOldStatus(newStatus),
          is_solved: newStatus === 'solved',
        })
        .eq('id', item.id);
      if (error) throw error;

      // Log status change
      if (user?.id) {
        await supabase.from('development_card_activity').insert({
          card_id: item.id,
          user_id: user.id,
          activity_type: 'status_change',
          content: `Status changed to ${newStatus}`,
          metadata: { new_status: newStatus },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', item?.id] });
      toast({ title: 'Status updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    },
  });

  // Update image mutation
  const updateImageMutation = useMutation({
    mutationFn: async (imageUrl: string | null) => {
      if (!item?.id) return;
      
      const { error } = await (supabase.from('development_items') as any)
        .update({ image_url: imageUrl })
        .eq('id', item.id);
      if (error) throw error;

      // Log image update
      if (user?.id) {
        await supabase.from('development_card_activity').insert({
          card_id: item.id,
          user_id: user.id,
          activity_type: 'image_updated',
          content: imageUrl ? 'Image updated' : 'Image removed',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', item?.id] });
      toast({ title: 'Image updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update image', variant: 'destructive' });
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
      toast({ title: 'Card deleted' });
      setShowDeleteDialog(false);
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete card', variant: 'destructive' });
    },
  });

  // Restore mutation
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
      toast({ title: 'Card restored' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to restore card', variant: 'destructive' });
    },
  });

  if (!item) return null;

  const itemWithNewFields = item as any;
  const cardType = item.card_type || 'item';
  const isDeleted = !!(itemWithNewFields.deleted_at);

  // Use derived status - either pre-computed or compute it now
  const currentStatus: DevelopmentCardStatus = item.derived_status || deriveCardStatus({
    is_solved: item.is_solved,
    pending_action_snoozed_until: itemWithNewFields.pending_action_snoozed_until,
    pending_action_type: itemWithNewFields.pending_action_type,
    latest_activity_at: item.latest_activity_at,
    created_at: item.created_at,
  });

  const STATUS_OPTIONS: { value: DevelopmentCardStatus; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'waiting', label: 'Waiting' },
    { value: 'solved', label: 'Solved' },
  ];

  // Determine user's team affiliation
  const userTeam: 'mor' | 'arc' = isTrader ? 'arc' : 'mor';

  // Show attention banners only to the team that currently owns the card (admins see all)
  // NOTE: this must NOT depend on `is_new_for_other_team`, otherwise banners can disappear
  // immediately after we clear the flag in the background.
  const shouldShowAttentionBanner = isAdmin || itemWithNewFields.current_owner === userTeam;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col h-full p-0">
        {/* Compact Header: Title + Status inline */}
        <div className="flex-shrink-0 px-4 py-3 border-b">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <h2 className="font-semibold text-sm truncate">{item.title}</h2>
              {canManage && !isDeleted ? (
                <Select
                  value={currentStatus}
                  onValueChange={(v) => updateStatusMutation.mutate(v as DevelopmentCardStatus)}
                >
                  <SelectTrigger className="h-6 text-[10px] w-24 flex-shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-[10px] capitalize text-muted-foreground flex-shrink-0">
                  {currentStatus.replace('_', ' ')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {isDeleted && canRestore && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => restoreMutation.mutate()}
                  disabled={restoreMutation.isPending}
                  title="Restore card"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
              {!isDeleted && canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShowDeleteDialog(true)}
                  title="Delete card"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          {isDeleted && (
            <Badge variant="destructive" className="w-fit mt-1 text-[10px]">
              Deleted {format(new Date(itemWithNewFields.deleted_at), 'dd/MM/yyyy')}
            </Badge>
          )}
        </div>

        {/* Collapsible Card Info Section */}
        <CardInfoSection
          item={item}
          canEdit={canManage && !isDeleted}
        />

        {/* Timeline Section - Takes most of the space */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 py-2">
            <HistoryTimeline
              cardId={item.id}
              cardType={cardType}
              cardCreatedBy={item.created_by}
              cardTitle={item.title}
              cardDescription={item.description}
              cardImageUrl={item.image_url}
              isCardSolved={itemWithNewFields.is_solved || false}
              isNewForOtherTeam={wasNewForOtherTeam}
              showAttentionBanner={shouldShowAttentionBanner}
              currentOwner={itemWithNewFields.current_owner || 'arc'}
              pendingActionType={itemWithNewFields.pending_action_type || null}
              pendingActionDueAt={itemWithNewFields.pending_action_due_at || null}
              snoozedUntil={itemWithNewFields.pending_action_snoozed_until || null}
              fobPriceUsd={itemWithNewFields.fob_price_usd}
              moq={itemWithNewFields.moq}
              qtyPerContainer={itemWithNewFields.qty_per_container}
              containerType={itemWithNewFields.container_type}
              onOwnerChange={() => queryClient.invalidateQueries({ queryKey: ['development-items'] })}
              onOpenSampleSection={(sampleId) => {
                setForcedOpenSection('samples');
                if (sampleId) setTargetSampleId(sampleId);
              }}
              onOpenMessageSection={(type) => {
                setForcedMessageType(type);
                setForcedOpenSection('messaging');
              }}
              onOpenUploadSection={() => setForcedOpenSection('messaging')}
              onOpenCommercialSection={() => setForcedOpenSection('commercial')}
              onCloseCard={() => onOpenChange(false)}
            />
          </div>
        </ScrollArea>

        {/* Quick Action Bar at Bottom */}
        {canManage && !isDeleted && (
          <ActionsPanel
            cardId={item.id}
            cardType={cardType}
            fobPriceUsd={itemWithNewFields.fob_price_usd}
            moq={itemWithNewFields.moq}
            qtyPerContainer={itemWithNewFields.qty_per_container}
            containerType={itemWithNewFields.container_type}
            currentOwner={itemWithNewFields.current_owner || 'arc'}
            canEdit={canManage}
            forcedOpenSection={forcedOpenSection}
            forcedMessageType={forcedMessageType}
            targetSampleId={targetSampleId}
            onForcedSectionHandled={() => {
              setForcedOpenSection(null);
              setForcedMessageType(null);
              setTargetSampleId(null);
            }}
            onOwnerChange={() => queryClient.invalidateQueries({ queryKey: ['development-items'] })}
          />
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
