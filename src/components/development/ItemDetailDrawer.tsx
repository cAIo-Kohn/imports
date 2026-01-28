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
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { DevelopmentItem, DevelopmentCardStatus } from '@/pages/Development';
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

  // Mark as seen when opened by the other team
  useEffect(() => {
    const markAsSeen = async () => {
      if (!item?.id || !open) return;
      
      const itemWithNewFields = item as any;
      const isNewForMe = itemWithNewFields.is_new_for_other_team && (
        (isBuyer && itemWithNewFields.created_by_role === 'trader') ||
        (isTrader && itemWithNewFields.created_by_role === 'buyer')
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

  // Determine user's team affiliation
  const userTeam: 'mor' | 'arc' = isTrader ? 'arc' : 'mor';

  // Show prompt when card is new AND belongs to user's team (or user is admin)
  const shouldShowAttentionBanner = 
    itemWithNewFields.is_new_for_other_team && 
    (isAdmin || itemWithNewFields.current_owner === userTeam);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col h-full p-0">
        {/* Fixed Header */}
        <SheetHeader className="flex-shrink-0 p-6 pb-4 border-b">
          <div className="flex items-start justify-between">
            <SheetTitle className="text-lg">Card Details</SheetTitle>
            
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

          {isDeleted && (
            <Badge variant="destructive" className="w-fit">
              Deleted on {format(new Date(itemWithNewFields.deleted_at), 'dd/MM/yyyy')}
            </Badge>
          )}
        </SheetHeader>

        {/* Top Section - Card Info */}
        <div className="flex-shrink-0 p-6 border-b bg-muted/20">
          <CardInfoSection
            item={item}
            canEdit={canManage && !isDeleted}
            onUpdateStatus={(status) => updateStatusMutation.mutate(status)}
            onUpdateImage={(url) => updateImageMutation.mutate(url)}
          />
        </div>

        {/* Middle Section - Scrollable Timeline */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide pt-4 pb-2 sticky top-0 bg-background">
              Timeline
            </h4>
            <HistoryTimeline
              cardId={item.id}
              cardType={cardType}
              cardCreatedBy={item.created_by}
              isCardSolved={itemWithNewFields.is_solved || false}
              showAttentionBanner={shouldShowAttentionBanner}
              currentOwner={itemWithNewFields.current_owner || 'arc'}
              onOwnerChange={() => queryClient.invalidateQueries({ queryKey: ['development-items'] })}
              onOpenSampleSection={() => setForcedOpenSection('samples')}
              onOpenMessageSection={(type) => {
                setForcedMessageType(type);
                setForcedOpenSection('messaging');
              }}
              onCloseCard={() => onOpenChange(false)}
            />
          </div>
        </ScrollArea>

        {/* Bottom Section - Sticky Actions */}
        {canManage && !isDeleted && (
          <div className="flex-shrink-0 border-t bg-background p-4 max-h-[60vh] overflow-y-auto overscroll-contain">
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
              onForcedSectionHandled={() => {
                setForcedOpenSection(null);
                setForcedMessageType(null);
              }}
              onOwnerChange={() => queryClient.invalidateQueries({ queryKey: ['development-items'] })}
            />
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
