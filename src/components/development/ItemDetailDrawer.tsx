import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { useCardTasks, sendTaskNotification } from '@/hooks/useCardTasks';
import { updateCardWorkflowStatus } from '@/hooks/useCardWorkflow';
import type { CardTask } from '@/hooks/useCardTasks';
import { format } from 'date-fns';
import { Trash2, RotateCcw, DollarSign, Package, History, CheckCircle2, RotateCw } from 'lucide-react';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from '@/hooks/use-toast';
import { DevelopmentItem, DevelopmentCardStatus, deriveCardStatus } from '@/pages/Development';
import { CardInfoSection } from './CardInfoSection';
import { ChatTimeline } from './ChatTimeline';
import { DeleteCardDialog } from './DeleteCardDialog';
import { CommercialDataSection } from './CommercialDataSection';
import { SampleTrackingSection } from './SampleTrackingSection';
import { PendingTasksBanner } from './PendingTasksBanner';
import { RequestCommercialDataModal } from './RequestCommercialDataModal';
import { FillCommercialDataModal } from './FillCommercialDataModal';
import { RequestSampleModal } from './RequestSampleModal';
import { AddTrackingModal } from './AddTrackingModal';
import { SampleReviewModal } from './SampleReviewModal';
import { CommercialReviewModal } from './CommercialReviewModal';
import { HandoffTimeline } from './HandoffTimeline';

interface ItemDetailDrawerProps {
  item: DevelopmentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helper component to show sample count badge
function SampleCountBadge({ cardId }: { cardId: string }) {
  const { data: samples = [] } = useQuery({
    queryKey: ['development-item-samples', cardId],
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('development_item_samples')
        .select('id, status, decision')
        .eq('item_id', cardId);
      if (error) throw error;
      return data || [];
    },
  });

  if (samples.length === 0) return null;

  const approvedCount = samples.filter(s => s.decision === 'approved').length;
  const totalCount = samples.length;

  return (
    <Badge variant="secondary" className="text-[10px] h-4 ml-2">
      {approvedCount > 0 ? `${approvedCount} approved` : `${totalCount} sample${totalCount > 1 ? 's' : ''}`}
    </Badge>
  );
}

// Helper component to show commercial data count badge
function CommercialCountBadge({ cardId }: { cardId: string }) {
  const { data: count = 0 } = useQuery({
    queryKey: ['commercial-count', cardId],
    staleTime: 30 * 1000,
    queryFn: async () => {
      // Count completed commercial_review tasks (approved ones)
      const { data, error } = await supabase
        .from('development_card_tasks')
        .select('id, metadata')
        .eq('card_id', cardId)
        .eq('task_type', 'commercial_review')
        .eq('status', 'completed');
      
      if (error) throw error;
      
      // Count how many have approved_by in metadata
      const approvedCount = (data || []).filter(t => {
        const meta = t.metadata as Record<string, unknown> | null;
        return !!meta?.approved_by;
      }).length;
      
      return approvedCount;
    },
  });

  if (count === 0) return null;

  return (
    <Badge variant="secondary" className="text-[10px] h-4 ml-2">
      {count} approved
    </Badge>
  );
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
  const { canManageOrders, isTrader, isBuyer, isAdmin, roles } = useUserRole();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Modal state
  const [showRequestCommercialModal, setShowRequestCommercialModal] = useState(false);
  const [showFillCommercialModal, setShowFillCommercialModal] = useState(false);
  const [showRequestSampleModal, setShowRequestSampleModal] = useState(false);
  const [showAddTrackingModal, setShowAddTrackingModal] = useState(false);
  const [showSampleReviewModal, setShowSampleReviewModal] = useState(false);
  const [showCommercialReviewModal, setShowCommercialReviewModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CardTask | null>(null);

  // Fetch card tasks
  const { pendingTasks, updateTask } = useCardTasks(item?.id || '');

  const canManage = canManageOrders || isTrader;
  const canInteract = !!user; // Any authenticated user can message
  const canDelete = canManage;
  const canRestore = isAdmin;

  // Fetch creator profile — cache for 5 minutes since profiles rarely change
  const { data: creatorProfile } = useQuery({
    queryKey: ['profile', item?.created_by],
    staleTime: 5 * 60 * 1000,
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

  // Update last viewed timestamp when drawer opens
  useEffect(() => {
    const updateViewTimestamp = async () => {
      if (!item?.id || !open || !user?.id) return;

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
        queryClient.invalidateQueries({ queryKey: ['development-items'] });
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

  // Solve card mutation
  const solveCardMutation = useMutation({
    mutationFn: async () => {
      if (!item?.id || !user?.id) return;
      
      const { error } = await (supabase.from('development_items') as any)
        .update({ 
          is_solved: true,
          // Clear any pending workflow state
          workflow_status: null,
          current_assignee_role: null,
          pending_action_type: null,
          pending_action_due_at: null,
          pending_action_snoozed_until: null,
          pending_action_snoozed_by: null,
        })
        .eq('id', item.id);
      if (error) throw error;

      await supabase.from('development_card_activity').insert({
        card_id: item.id,
        user_id: user.id,
        activity_type: 'status_change',
        content: 'Card marked as solved',
        metadata: { action: 'solved' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      toast({ 
        title: 'Card solved!', 
        description: 'Use "Show Solved" filter to view it again.' 
      });
      onOpenChange(false); // Close drawer since card disappears from list
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to solve card', variant: 'destructive' });
    },
  });

  // Reopen card mutation
  const reopenCardMutation = useMutation({
    mutationFn: async () => {
      if (!item?.id || !user?.id) return;
      
      const { error } = await (supabase.from('development_items') as any)
        .update({ is_solved: false })
        .eq('id', item.id);
      if (error) throw error;

      await supabase.from('development_card_activity').insert({
        card_id: item.id,
        user_id: user.id,
        activity_type: 'status_change',
        content: 'Card reopened',
        metadata: { action: 'reopened' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      toast({ title: 'Card reopened' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to reopen card', variant: 'destructive' });
    },
  });

  // Handle task actions from banner
  const handleFillCommercial = (task: CardTask) => {
    setSelectedTask(task);
    setShowFillCommercialModal(true);
  };

  const handleAddTracking = (task: CardTask) => {
    setSelectedTask(task);
    setShowAddTrackingModal(true);
  };

  const handleConfirmData = async (task: CardTask) => {
    if (!user?.id || !item) return;
    
    try {
      await updateTask({
        taskId: task.id,
        status: 'completed',
        completed_by: user.id,
      });

      // Log to timeline
      await supabase.from('development_card_activity').insert({
        card_id: task.card_id,
        user_id: user.id,
        activity_type: 'message',
        content: '✅ Commercial data confirmed',
        metadata: { task_id: task.id, task_type: 'commercial_confirmed' },
      });

      // Notify the person who filled the data
      const filledBy = task.metadata?.filled_by as string | undefined;
      if (filledBy && filledBy !== user.id) {
        await sendTaskNotification({
          recipientUserIds: [filledBy],
          triggeredBy: user.id,
          cardId: task.card_id,
          taskId: task.id,
          type: 'commercial_confirmed',
          title: '{name} confirmed the commercial data',
          content: `Commercial data for "${item.title}" has been confirmed`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['card-tasks', task.card_id] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', task.card_id] });
      toast({ title: 'Data confirmed' });
    } catch (error) {
      console.error('Failed to confirm data:', error);
      toast({ title: 'Error', description: 'Failed to confirm data', variant: 'destructive' });
    }
  };

  const handleMarkArrived = async (task: CardTask) => {
    if (!user?.id || !item) return;
    
    try {
      // Update sample status to delivered
      if (task.sample_id) {
        const { error: sampleError } = await supabase
          .from('development_item_samples')
          .update({ 
            status: 'delivered',
            actual_arrival: new Date().toISOString().split('T')[0],
          })
          .eq('id', task.sample_id);
        
        if (sampleError) throw sampleError;
      }

      // Create a new sample_review task assigned to QUALITY TEAM
      const { error: reviewTaskError } = await (supabase
        .from('development_card_tasks') as any)
        .insert({
          card_id: task.card_id,
          task_type: 'sample_review',
          status: 'pending',
          assigned_to_users: [],  // No specific users
          assigned_to_role: 'quality',  // Assign to Quality Team
          created_by: task.created_by, // Keep original requester as creator
          sample_id: task.sample_id,
          metadata: {
            ...task.metadata,
            actual_arrival: new Date().toISOString().split('T')[0],
            marked_arrived_by: user.id,
          },
        });

      if (reviewTaskError) throw reviewTaskError;

      // Mark original sample_request task as completed
      await updateTask({
        taskId: task.id,
        status: 'completed',
        completed_by: user.id,
        metadata: {
          ...task.metadata,
          actual_arrival: new Date().toISOString().split('T')[0],
          marked_arrived_by: user.id,
        },
      });

      // Update workflow status - ball goes to QUALITY TEAM
      await updateCardWorkflowStatus(
        task.card_id,
        'sample_arrived',
        user.id,
        'Sample arrived - awaiting quality team review',
        'buyer',    // from
        'quality',  // to (Quality Team takes over for review)
        task.id
      );

      // Log to timeline
      await supabase.from('development_card_activity').insert({
        card_id: task.card_id,
        user_id: user.id,
        activity_type: 'message',
        content: '📬 Sample arrived - assigned to Quality Team for review',
        metadata: { 
          task_id: task.id, 
          sample_id: task.sample_id, 
          task_type: 'sample_arrived',
          assigned_to_role: 'quality',
        },
      });

      // Send notification to Quality Team
      await sendTaskNotification({
        recipientRole: 'quality',
        triggeredBy: user.id,
        cardId: task.card_id,
        taskId: task.id,
        type: 'sample_review',
        title: '{name} marked a sample as arrived',
        content: `Sample for "${item.title}" is ready for quality review`,
      });

      queryClient.invalidateQueries({ queryKey: ['card-tasks', task.card_id] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', task.card_id] });
      queryClient.invalidateQueries({ queryKey: ['development-item-samples', task.card_id] });
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      toast({ title: 'Sample marked as arrived - Quality Team notified' });
    } catch (error) {
      console.error('Failed to mark arrived:', error);
      toast({ title: 'Error', description: 'Failed to update sample', variant: 'destructive' });
    }
  };

  const handleReviewSample = (task: CardTask) => {
    setSelectedTask(task);
    setShowSampleReviewModal(true);
  };

  const handleReviewCommercial = (task: CardTask) => {
    setSelectedTask(task);
    setShowCommercialReviewModal(true);
  };

  const handleGiveUpItem = async (task: CardTask) => {
    if (!user?.id || !item) return;
    
    try {
      // Mark task as completed with give_up status
      await updateTask({
        taskId: task.id,
        status: 'completed',
        completed_by: user.id,
        metadata: { ...task.metadata, given_up: true, given_up_at: new Date().toISOString() },
      });

      // Clear workflow status - card remains open, only the sample task loop ends
      await (supabase.from('development_items') as any)
        .update({ 
          workflow_status: null,
          current_assignee_role: null,
          pending_action_type: null,
          pending_action_due_at: null,
          pending_action_snoozed_until: null,
          pending_action_snoozed_by: null,
        })
        .eq('id', task.card_id);

      // Log to timeline
      await supabase.from('development_card_activity').insert({
        card_id: task.card_id,
        user_id: user.id,
        activity_type: 'message',
        content: '🚫 Item given up - improvement not feasible after sample rejection',
        metadata: { task_id: task.id, action: 'give_up' },
      });

      queryClient.invalidateQueries({ queryKey: ['card-tasks', task.card_id] });
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      toast({ title: 'Item marked as given up' });
    } catch (error) {
      console.error('Failed to give up item:', error);
      toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' });
    }
  };

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
            <div className="flex items-center gap-2 flex-shrink-0 mr-6">
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
              {/* Solve/Reopen button */}
              {!isDeleted && canManage && (
                currentStatus === 'solved' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => reopenCardMutation.mutate()}
                    disabled={reopenCardMutation.isPending}
                    title="Reopen card"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    Reopen
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                    onClick={() => solveCardMutation.mutate()}
                    disabled={solveCardMutation.isPending}
                    title="Mark card as solved"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Solve
                  </Button>
                )
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

        {/* Collapsible Sections for Commercial Data & Samples */}
        {!isDeleted && (
          <Accordion type="multiple" className="border-b">
            {/* Commercial Data Section */}
            <AccordionItem value="commercial" className="border-0">
              <AccordionTrigger className="px-4 py-2 hover:no-underline text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  Commercial Data
                  <CommercialCountBadge cardId={item.id} />
                  {(itemWithNewFields.fob_price_usd || itemWithNewFields.moq) && (
                    <Badge variant="secondary" className="text-[10px] h-4">
                      {itemWithNewFields.fob_price_usd ? `$${itemWithNewFields.fob_price_usd}` : ''}
                      {itemWithNewFields.fob_price_usd && itemWithNewFields.moq ? ' • ' : ''}
                      {itemWithNewFields.moq ? `MOQ: ${itemWithNewFields.moq}` : ''}
                    </Badge>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3">
                <CommercialDataSection
                  cardId={item.id}
                  cardTitle={item.title}
                  fobPriceUsd={itemWithNewFields.fob_price_usd}
                  moq={itemWithNewFields.moq}
                  qtyPerContainer={itemWithNewFields.qty_per_container}
                  containerType={itemWithNewFields.container_type}
                  packingType={itemWithNewFields.packing_type}
                  packingTypeFileUrl={itemWithNewFields.packing_type_file_url}
                  qtyPerMasterInner={itemWithNewFields.qty_per_master_inner}
                  currentOwner={itemWithNewFields.current_owner || 'mor'}
                  canEdit={canManage}
                  onRequestCommercialData={() => setShowRequestCommercialModal(true)}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Sample Tracking Section */}
            <AccordionItem value="samples" className="border-0">
              <AccordionTrigger className="px-4 py-2 hover:no-underline text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Package className="h-4 w-4" />
                  Sample Tracking
                  <SampleCountBadge cardId={item.id} />
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3">
                <SampleTrackingSection
                  cardId={item.id}
                  cardTitle={item.title}
                  currentOwner={itemWithNewFields.current_owner || 'mor'}
                  canEdit={canManage}
                  onRequestSample={() => setShowRequestSampleModal(true)}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Responsibility History (Handoff Timeline) */}
            <AccordionItem value="handoffs" className="border-0">
              <AccordionTrigger className="px-4 py-2 hover:no-underline text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <History className="h-4 w-4" />
                  Responsibility History
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3">
                <HandoffTimeline cardId={item.id} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Pending Tasks Banner - before chat */}
        {!isDeleted && pendingTasks.length > 0 && (
          <div className="px-4 pt-3">
            <PendingTasksBanner
              tasks={pendingTasks}
              onFillCommercial={handleFillCommercial}
              onAddTracking={handleAddTracking}
              onConfirmData={handleConfirmData}
              onMarkArrived={handleMarkArrived}
              onReviewSample={handleReviewSample}
              onReviewCommercial={handleReviewCommercial}
              onGiveUpItem={handleGiveUpItem}
            />
          </div>
        )}

        {/* WhatsApp-style Chat Timeline */}
        {!isDeleted && (
          <ChatTimeline
            cardId={item.id}
            cardTitle={item.title}
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

        {/* Request Commercial Data Modal — only mount when open */}
        {showRequestCommercialModal && (
          <RequestCommercialDataModal
            open={showRequestCommercialModal}
            onOpenChange={setShowRequestCommercialModal}
            cardId={item.id}
            cardTitle={item.title}
          />
        )}

        {/* Fill Commercial Data Modal */}
        {selectedTask && (
          <FillCommercialDataModal
            open={showFillCommercialModal}
            onOpenChange={(open) => {
              setShowFillCommercialModal(open);
              if (!open) setSelectedTask(null);
            }}
            task={selectedTask}
            cardTitle={item.title}
          />
        )}

        {/* Request Sample Modal — only mount when open */}
        {showRequestSampleModal && (
          <RequestSampleModal
            open={showRequestSampleModal}
            onOpenChange={setShowRequestSampleModal}
            cardId={item.id}
            cardTitle={item.title}
          />
        )}

        {/* Add Tracking Modal */}
        {selectedTask && (
          <AddTrackingModal
            open={showAddTrackingModal}
            onOpenChange={(open) => {
              setShowAddTrackingModal(open);
              if (!open) setSelectedTask(null);
            }}
            task={selectedTask}
            cardTitle={item.title}
          />
        )}

        {/* Sample Review Modal */}
        {selectedTask && (
          <SampleReviewModal
            open={showSampleReviewModal}
            onOpenChange={(open) => {
              setShowSampleReviewModal(open);
              if (!open) setSelectedTask(null);
            }}
            task={selectedTask}
            cardTitle={item.title}
          />
        )}

        {/* Commercial Review Modal */}
        {selectedTask && (
          <CommercialReviewModal
            open={showCommercialReviewModal}
            onOpenChange={(open) => {
              setShowCommercialReviewModal(open);
              if (!open) setSelectedTask(null);
            }}
            task={selectedTask}
            cardTitle={item.title}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
