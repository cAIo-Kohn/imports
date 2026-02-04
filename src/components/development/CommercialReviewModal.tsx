import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { sendTaskNotification } from '@/hooks/useCardTasks';
import type { CardTask } from '@/hooks/useCardTasks';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface CommercialReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: CardTask;
  cardTitle: string;
}

const CONTAINER_LABELS: Record<string, string> = {
  '20ft': '20ft Container',
  '40ft': '40ft Container',
  '40hq': '40ft High Cube',
};

export function CommercialReviewModal({
  open,
  onOpenChange,
  task,
  cardTitle,
}: CommercialReviewModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [feedback, setFeedback] = useState('');

  const metadata = task.metadata || {};
  const fobPrice = metadata.fob_price_usd as number | undefined;
  const moq = metadata.moq as number | undefined;
  const qtyPerContainer = metadata.qty_per_container as number | undefined;
  const containerType = metadata.container_type as string | undefined;
  const filledBy = metadata.filled_by as string | undefined;
  const revisionNumber = (metadata.revision_number as number) || 1;
  const previousSubmissions = (metadata.previous_submissions as Array<{
    fob_price_usd: number;
    moq: number;
    submitted_at: string;
    rejection_reason?: string;
  }>) || [];

  const submitMutation = useMutation({
    mutationFn: async (decision: 'approve' | 'reject') => {
      if (!user?.id) throw new Error('Not authenticated');

      if (decision === 'approve') {
        // Update task to completed
        const { error: taskError } = await supabase
          .from('development_card_tasks')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            completed_by: user.id,
            metadata: {
              ...metadata,
              approved_at: new Date().toISOString(),
              approved_by: user.id,
            },
          })
          .eq('id', task.id);

        if (taskError) throw taskError;

        // Log to timeline
        await supabase.from('development_card_activity').insert({
          card_id: task.card_id,
          user_id: user.id,
          activity_type: 'message',
          content: `✅ Commercial data approved: $${fobPrice} FOB, MOQ ${moq}, ${qtyPerContainer}/${containerType}`,
          metadata: { 
            task_id: task.id, 
            task_type: 'commercial_approved',
            final_price: fobPrice,
            final_moq: moq,
            negotiation_rounds: revisionNumber,
          },
        });

        // Clear pending action and workflow status on card - workflow complete
        await supabase
          .from('development_items')
          .update({ 
            pending_action_type: null,
            pending_action_due_at: null,
            pending_action_snoozed_until: null,
            pending_action_snoozed_by: null,
            workflow_status: null,
            current_assignee_role: null,
          })
          .eq('id', task.card_id);
        
        // Log workflow completion
        await supabase.from('development_card_activity').insert({
          card_id: task.card_id,
          user_id: user.id,
          activity_type: 'handoff',
          content: 'Commercial data approved - workflow complete',
          metadata: { workflow_status: null, action: 'workflow_complete' },
        });

        // Notify the person who filled the data
        if (filledBy && filledBy !== user.id) {
          await sendTaskNotification({
            recipientUserIds: [filledBy],
            triggeredBy: user.id,
            cardId: task.card_id,
            taskId: task.id,
            type: 'commercial_approved',
            title: '{name} approved the commercial data',
            content: `Commercial data for "${cardTitle}" has been approved`,
          });
        }
      } else {
        // Rejection - create new commercial_request task for revision
        const updatedSubmissions = [
          ...previousSubmissions,
          {
            fob_price_usd: fobPrice,
            moq: moq,
            qty_per_container: qtyPerContainer,
            container_type: containerType,
            submitted_at: metadata.filled_at || new Date().toISOString(),
            submitted_by: filledBy,
            rejection_reason: feedback,
          },
        ];

        // Create new commercial_request task for trader
        const { error: newTaskError } = await (supabase
          .from('development_card_tasks') as any)
          .insert({
            card_id: task.card_id,
            task_type: 'commercial_request',
            status: 'pending',
            assigned_to_role: 'trader',
            assigned_to_users: filledBy ? [filledBy] : [],
            created_by: task.created_by, // Keep original requester
            metadata: {
              needs_revision: true,
              revision_number: revisionNumber + 1,
              previous_submissions: updatedSubmissions,
              rejection_reason: feedback,
              rejected_by: user.id,
              rejected_at: new Date().toISOString(),
            },
          });

        if (newTaskError) throw newTaskError;

        // Mark current review task as completed (rejected)
        const { error: taskError } = await supabase
          .from('development_card_tasks')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            completed_by: user.id,
            metadata: {
              ...metadata,
              rejected_at: new Date().toISOString(),
              rejected_by: user.id,
              rejection_reason: feedback,
            },
          })
          .eq('id', task.id);

        if (taskError) throw taskError;

        // Log to timeline
        await supabase.from('development_card_activity').insert({
          card_id: task.card_id,
          user_id: user.id,
          activity_type: 'message',
          content: `⚠️ Commercial data revision requested: "${feedback}"`,
          metadata: { 
            task_id: task.id, 
            task_type: 'commercial_rejected',
            revision_number: revisionNumber + 1,
            rejected_price: fobPrice,
          },
        });

        // Update card ownership to trader
        await supabase
          .from('development_items')
          .update({ 
            current_owner: 'arc',
            pending_action_type: 'commercial_data',
          })
          .eq('id', task.card_id);

        // Notify trader/filler
        await sendTaskNotification({
          recipientUserIds: filledBy ? [filledBy] : undefined,
          recipientRole: 'trader',
          triggeredBy: user.id,
          cardId: task.card_id,
          taskId: task.id,
          type: 'commercial_revision_needed',
          title: '{name} requested commercial data revision',
          content: `"${cardTitle}": ${feedback}`,
        });
      }
    },
    onSuccess: (_, decision) => {
      queryClient.invalidateQueries({ queryKey: ['card-tasks', task.card_id] });
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', task.card_id] });
      toast({ 
        title: decision === 'approve' ? 'Commercial data approved' : 'Revision requested',
      });
      onOpenChange(false);
      setFeedback('');
    },
    onError: (error: Error) => {
      console.error('Failed to process commercial review:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to process review',
        variant: 'destructive',
      });
    },
  });

  const handleReject = () => {
    if (!feedback.trim()) {
      toast({
        title: 'Feedback required',
        description: 'Please provide feedback for the revision request',
        variant: 'destructive',
      });
      return;
    }
    submitMutation.mutate('reject');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review Commercial Data</DialogTitle>
          <DialogDescription>
            Review the submitted commercial data and approve or request revisions.
          </DialogDescription>
        </DialogHeader>

        {/* Submitted Data */}
        <div className="space-y-4 py-4">
          <div className="rounded-lg border p-4 bg-muted/30">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">FOB Price (USD)</p>
                <p className="text-lg font-semibold text-foreground">
                  ${fobPrice?.toFixed(2) || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">MOQ</p>
                <p className="text-lg font-semibold text-foreground">
                  {moq?.toLocaleString() || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Qty / Container</p>
                <p className="text-sm font-medium text-foreground">
                  {qtyPerContainer?.toLocaleString() || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Container Type</p>
                <p className="text-sm font-medium text-foreground">
                  {containerType ? CONTAINER_LABELS[containerType] || containerType : '—'}
                </p>
              </div>
            </div>
            {revisionNumber > 1 && (
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                Revision #{revisionNumber}
              </p>
            )}
          </div>

          {/* Previous Submissions History */}
          {previousSubmissions.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Negotiation History</Label>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {previousSubmissions.map((sub, idx) => (
                  <div key={idx} className="text-xs p-2 bg-muted/50 rounded border">
                    <div className="flex justify-between">
                      <span className="font-medium">${sub.fob_price_usd} FOB, MOQ {sub.moq}</span>
                      <span className="text-muted-foreground">
                        {format(new Date(sub.submitted_at), 'dd/MM HH:mm')}
                      </span>
                    </div>
                    {sub.rejection_reason && (
                      <p className="text-red-600 dark:text-red-400 mt-1">
                        Rejected: "{sub.rejection_reason}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feedback for rejection */}
          <div className="space-y-2">
            <Label htmlFor="feedback">Feedback (required for revision request)</Label>
            <Textarea
              id="feedback"
              placeholder="e.g., Price too high. Target price is $2.00. Please request a 15% discount..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={submitMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={submitMutation.isPending || !feedback.trim()}
          >
            {submitMutation.isPending ? 'Processing...' : 'Request Revision'}
          </Button>
          <Button 
            onClick={() => submitMutation.mutate('approve')}
            disabled={submitMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {submitMutation.isPending ? 'Processing...' : 'Approve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
