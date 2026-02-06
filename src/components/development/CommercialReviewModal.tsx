import { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { FileText } from 'lucide-react';
import type { UploadedAttachment } from './TimelineUploadButton';

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

const FIELD_LABELS: Record<string, string> = {
  fob_price_usd: 'FOB Price',
  moq: 'MOQ',
  qty_per_container: 'Qty/Container',
  container_type: 'Container Type',
  packing_type: 'Packing Type',
  qty_per_master_inner: 'Qty per Master/Inner',
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
  const [fieldsToRevise, setFieldsToRevise] = useState<Set<string>>(new Set());

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setFeedback('');
      setFieldsToRevise(new Set());
    }
  }, [open]);

  const metadata = task.metadata || {};
  const fobPrice = metadata.fob_price_usd as number | undefined;
  const moq = metadata.moq as number | undefined;
  const qtyPerContainer = metadata.qty_per_container as number | undefined;
  const containerType = metadata.container_type as string | undefined;
  const packingType = metadata.packing_type as string | undefined;
  const packingTypeFile = metadata.packing_type_file as UploadedAttachment | undefined;
  const qtyPerMasterInner = metadata.qty_per_master_inner as string | undefined;
  const filledBy = metadata.filled_by as string | undefined;
  const revisionNumber = (metadata.revision_number as number) || 1;
  const previousSubmissions = (metadata.previous_submissions as Array<{
    fob_price_usd: number;
    moq: number;
    submitted_at: string;
    rejection_reason?: string;
  }>) || [];
  const attachments = (metadata.attachments || []) as UploadedAttachment[];
  const submissionType = metadata.submission_type as string | undefined;
  
  // Determine if packing file is an image
  const isPackingFileImage = packingTypeFile?.type?.startsWith('image/');

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
        const fieldsArray = Array.from(fieldsToRevise);
        const updatedSubmissions = [
          ...previousSubmissions,
          {
            fob_price_usd: fobPrice,
            moq: moq,
            qty_per_container: qtyPerContainer,
            container_type: containerType,
            packing_type: packingType,
            qty_per_master_inner: qtyPerMasterInner,
            submitted_at: metadata.filled_at || new Date().toISOString(),
            submitted_by: filledBy,
            rejection_reason: feedback,
            fields_flagged: fieldsArray,
          },
        ];

        // Build preserved data - only keep fields NOT flagged for revision
        const preservedData = {
          fob_price_usd: !fieldsToRevise.has('fob_price_usd') ? fobPrice : null,
          moq: !fieldsToRevise.has('moq') ? moq : null,
          qty_per_container: !fieldsToRevise.has('qty_per_container') ? qtyPerContainer : null,
          container_type: !fieldsToRevise.has('container_type') ? containerType : null,
          packing_type: !fieldsToRevise.has('packing_type') ? packingType : null,
          packing_type_file: !fieldsToRevise.has('packing_type') ? packingTypeFile : null,
          qty_per_master_inner: !fieldsToRevise.has('qty_per_master_inner') ? qtyPerMasterInner : null,
        };

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
              fields_to_revise: fieldsArray,
              preserved_data: preservedData,
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

        // Log to timeline with specific fields needing revision
        const fieldsListText = fieldsArray.map(f => FIELD_LABELS[f] || f).join(', ');
        await supabase.from('development_card_activity').insert({
          card_id: task.card_id,
          user_id: user.id,
          activity_type: 'message',
          content: `⚠️ Revision requested for: ${fieldsListText}. Feedback: "${feedback}"`,
          metadata: { 
            task_id: task.id, 
            task_type: 'commercial_rejected',
            revision_number: revisionNumber + 1,
            rejected_price: fobPrice,
            fields_to_revise: fieldsArray,
          },
        });

        // Update card ownership and workflow status back to trader
        await supabase
          .from('development_items')
          .update({ 
            current_owner: 'arc',
            pending_action_type: 'commercial_data',
            workflow_status: 'commercial_requested',
            current_assignee_role: 'trader',
          })
          .eq('id', task.card_id);
        
        // Log handoff to timeline
        await supabase.from('development_card_activity').insert({
          card_id: task.card_id,
          user_id: user.id,
          activity_type: 'handoff',
          content: 'Revision requested - awaiting updated data',
          metadata: { 
            from_role: 'buyer', 
            to_role: 'trader', 
            workflow_status: 'commercial_requested' 
          },
        });

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
    if (fieldsToRevise.size === 0) {
      toast({
        title: 'Select fields to revise',
        description: 'Please check at least one field that needs revision',
        variant: 'destructive',
      });
      return;
    }
    submitMutation.mutate('reject');
  };

  const toggleField = (field: string) => {
    setFieldsToRevise(prev => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  };

  const canRequestRevision = feedback.trim() && fieldsToRevise.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review Commercial Data</DialogTitle>
          <DialogDescription>
            Review the submitted commercial data and approve or request revisions.
          </DialogDescription>
        </DialogHeader>

        {/* Submitted Data with Checkboxes for Revision Selection */}
        <div className="space-y-4 py-4">
          <div className="rounded-lg border p-4 bg-muted/30">
            <p className="text-xs text-muted-foreground mb-3">Check the fields that need revision:</p>
            <div className="grid grid-cols-2 gap-4">
              {/* FOB Price */}
              <div className="flex items-start gap-2">
                <Checkbox
                  id="revise-fob"
                  checked={fieldsToRevise.has('fob_price_usd')}
                  onCheckedChange={() => toggleField('fob_price_usd')}
                />
                <div className="flex-1">
                  <label htmlFor="revise-fob" className="text-xs text-muted-foreground cursor-pointer">FOB Price (USD)</label>
                  <p className="text-lg font-semibold text-foreground">
                    ${fobPrice?.toFixed(2) || '—'}
                  </p>
                </div>
              </div>
              
              {/* MOQ */}
              <div className="flex items-start gap-2">
                <Checkbox
                  id="revise-moq"
                  checked={fieldsToRevise.has('moq')}
                  onCheckedChange={() => toggleField('moq')}
                />
                <div className="flex-1">
                  <label htmlFor="revise-moq" className="text-xs text-muted-foreground cursor-pointer">MOQ</label>
                  <p className="text-lg font-semibold text-foreground">
                    {moq?.toLocaleString() || '—'}
                  </p>
                </div>
              </div>
              
              {/* Qty/Container */}
              <div className="flex items-start gap-2">
                <Checkbox
                  id="revise-qty"
                  checked={fieldsToRevise.has('qty_per_container')}
                  onCheckedChange={() => toggleField('qty_per_container')}
                />
                <div className="flex-1">
                  <label htmlFor="revise-qty" className="text-xs text-muted-foreground cursor-pointer">Qty / Container</label>
                  <p className="text-sm font-medium text-foreground">
                    {qtyPerContainer?.toLocaleString() || '—'}
                  </p>
                </div>
              </div>
              
              {/* Container Type */}
              <div className="flex items-start gap-2">
                <Checkbox
                  id="revise-container"
                  checked={fieldsToRevise.has('container_type')}
                  onCheckedChange={() => toggleField('container_type')}
                />
                <div className="flex-1">
                  <label htmlFor="revise-container" className="text-xs text-muted-foreground cursor-pointer">Container Type</label>
                  <p className="text-sm font-medium text-foreground">
                    {containerType ? CONTAINER_LABELS[containerType] || containerType : '—'}
                  </p>
                </div>
              </div>
              
              {/* Qty per Master/Inner */}
              <div className="flex items-start gap-2">
                <Checkbox
                  id="revise-master"
                  checked={fieldsToRevise.has('qty_per_master_inner')}
                  onCheckedChange={() => toggleField('qty_per_master_inner')}
                />
                <div className="flex-1">
                  <label htmlFor="revise-master" className="text-xs text-muted-foreground cursor-pointer">Qty per Master/Inner</label>
                  <p className="text-sm font-medium text-foreground">
                    {qtyPerMasterInner || '—'}
                  </p>
                </div>
              </div>
              
              {/* Packing Type */}
              <div className="flex items-start gap-2">
                <Checkbox
                  id="revise-packing"
                  checked={fieldsToRevise.has('packing_type')}
                  onCheckedChange={() => toggleField('packing_type')}
                />
                <div className="flex-1">
                  <label htmlFor="revise-packing" className="text-xs text-muted-foreground cursor-pointer">Packing Type</label>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {packingType || '—'}
                    </p>
                    {packingTypeFile && (
                      <a
                        href={packingTypeFile.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <FileText className="h-3 w-3" />
                        <span>View</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {revisionNumber > 1 && (
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                Revision #{revisionNumber}
              </p>
            )}
            
            {submissionType === 'file_only' && (
              <p className="text-sm text-muted-foreground italic mt-3 pt-3 border-t">
                Data provided via file attachment — review the uploaded document(s).
              </p>
            )}
          </div>

          {/* Attached Documents */}
          {attachments.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Attached Documents</Label>
              <div className="flex flex-wrap gap-2">
                {attachments.map((file) => (
                  <a
                    key={file.id}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-muted rounded px-2 py-1.5 text-xs hover:bg-muted/80 transition-colors"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="max-w-[150px] truncate">{file.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

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
            {!canRequestRevision && feedback.trim() && fieldsToRevise.size === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠️ Select at least one field above to request revision
              </p>
            )}
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
            disabled={submitMutation.isPending || !canRequestRevision}
          >
            {submitMutation.isPending ? 'Processing...' : `Request Revision (${fieldsToRevise.size})`}
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
