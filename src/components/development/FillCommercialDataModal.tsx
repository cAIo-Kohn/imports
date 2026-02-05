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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { TimelineUploadButton, UploadedAttachment, ALLOWED_FORMATS_HINT } from './TimelineUploadButton';

interface FillCommercialDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: CardTask;
  cardTitle: string;
}

const CONTAINER_TYPES = [
  { value: '20ft', label: '20ft Container' },
  { value: '40ft', label: '40ft Container' },
  { value: '40hq', label: '40ft High Cube' },
];

export function FillCommercialDataModal({
  open,
  onOpenChange,
  task,
  cardTitle,
}: FillCommercialDataModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [fobPrice, setFobPrice] = useState('');
  const [moq, setMoq] = useState('');
  const [qtyPerContainer, setQtyPerContainer] = useState('');
  const [containerType, setContainerType] = useState('');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);

  const hasManualData = fobPrice && moq && qtyPerContainer && containerType;
  const hasFileUpload = attachments.length > 0;
  const isValid = hasManualData || hasFileUpload;

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      const commercialData = {
        fob_price_usd: parseFloat(fobPrice),
        moq: parseInt(moq, 10),
        qty_per_container: parseInt(qtyPerContainer, 10),
        container_type: containerType,
      };

      // Update the card with commercial data AND update workflow status to buyer
      const { error: cardError } = await supabase
        .from('development_items')
        .update({
          ...commercialData,
          workflow_status: 'commercial_filled',
          current_assignee_role: 'buyer',
        })
        .eq('id', task.card_id);

      if (cardError) throw cardError;
      
      // Log handoff to timeline
      await supabase.from('development_card_activity').insert({
        card_id: task.card_id,
        user_id: user.id,
        activity_type: 'handoff',
        content: 'Commercial data submitted - awaiting review',
        metadata: { 
          from_role: 'trader', 
          to_role: 'buyer', 
          workflow_status: 'commercial_filled' 
        },
      });

      // Get revision number from task metadata
      const taskMetadata = task.metadata || {};
      const revisionNumber = (taskMetadata.revision_number as number) || 1;
      const previousSubmissions = (taskMetadata.previous_submissions as Array<unknown>) || [];

      // Create a new commercial_review task for the requester to approve
      const { error: reviewTaskError } = await (supabase
        .from('development_card_tasks') as any)
        .insert({
          card_id: task.card_id,
          task_type: 'commercial_review',
          status: 'pending',
          assigned_to_users: [task.created_by], // Assign to original requester
          assigned_to_role: null,
          created_by: task.created_by, // Keep original requester as creator
          metadata: {
            ...commercialData,
            filled_by: user.id,
            filled_at: new Date().toISOString(),
            revision_number: revisionNumber,
            previous_submissions: previousSubmissions,
            attachments: attachments,
            submission_type: hasManualData ? 'manual' : 'file_only',
          },
        });

      if (reviewTaskError) throw reviewTaskError;

      // Mark the original commercial_request task as completed
      const { error: taskError } = await supabase
        .from('development_card_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user.id,
          metadata: {
            ...taskMetadata,
            ...commercialData,
            filled_by: user.id,
            filled_at: new Date().toISOString(),
          },
        })
        .eq('id', task.id);

      if (taskError) throw taskError;

      // Log to timeline
      const timelineContent = hasManualData
        ? `💰 Commercial data submitted: $${fobPrice} FOB, MOQ ${moq}, ${qtyPerContainer}/${containerType}${revisionNumber > 1 ? ` (Revision #${revisionNumber})` : ''}`
        : `📎 Commercial data submitted via file upload (${attachments.length} file${attachments.length > 1 ? 's' : ''})${revisionNumber > 1 ? ` (Revision #${revisionNumber})` : ''}`;

      await (supabase.from('development_card_activity') as any).insert({
        card_id: task.card_id,
        user_id: user.id,
        activity_type: 'message',
        content: timelineContent,
        metadata: { task_id: task.id, task_type: 'commercial_data_filled', ...commercialData, revision_number: revisionNumber, attachments },
      });

      // Notify the requester
      await sendTaskNotification({
        recipientUserIds: [task.created_by],
        triggeredBy: user.id,
        cardId: task.card_id,
        taskId: task.id,
        type: 'commercial_filled',
        title: '{name} submitted commercial data',
        content: `Commercial data for "${cardTitle}" is ready for your approval`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card-tasks', task.card_id] });
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', task.card_id] });
      toast({ title: 'Commercial data submitted' });
      onOpenChange(false);
      // Reset form
      setFobPrice('');
      setMoq('');
      setQtyPerContainer('');
      setContainerType('');
      setAttachments([]);
    },
    onError: (error: Error & { details?: string }) => {
      console.error('Failed to fill commercial data:', error);
      const errorMessage = error.message || 'Failed to submit commercial data';
      const details = error.details ? `: ${error.details}` : '';
      toast({
        title: 'Error',
        description: `${errorMessage}${details}`,
        variant: 'destructive',
      });
    },
  });

  const requesterName = task.created_by_profile?.full_name || 'the requester';
  const productNames = (task.metadata?.product_names as string[]) || [];
  const isAllProducts = task.metadata?.is_all_products as boolean;

  // Build product description
  const productDescription = productNames.length > 0
    ? isAllProducts
      ? 'for all items in this group'
      : `for: ${productNames.join(', ')}`
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fill Commercial Data</DialogTitle>
          <DialogDescription>
            {productDescription && (
              <span className="block text-xs font-medium mb-1">📦 {productDescription}</span>
            )}
            Fill all 4 fields OR upload a document. {requesterName} will be notified to review.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="fob-price">FOB Price (USD) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="fob-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={fobPrice}
                onChange={(e) => setFobPrice(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="moq">MOQ *</Label>
            <Input
              id="moq"
              type="number"
              min="0"
              placeholder="1000"
              value={moq}
              onChange={(e) => setMoq(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qty-container">Qty / Container *</Label>
            <Input
              id="qty-container"
              type="number"
              min="0"
              placeholder="50000"
              value={qtyPerContainer}
              onChange={(e) => setQtyPerContainer(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="container-type">Container Type *</Label>
            <Select value={containerType} onValueChange={setContainerType}>
              <SelectTrigger id="container-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {CONTAINER_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* File Upload Alternative */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or upload a document</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          
          <div className="flex items-center gap-2">
            <TimelineUploadButton
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              variant="button"
            />
            <span className="text-xs text-muted-foreground">({ALLOWED_FORMATS_HINT})</span>
          </div>
          
          {hasFileUpload && !hasManualData && (
            <p className="text-xs text-muted-foreground">
              File uploaded — you can submit without filling the fields above.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => submitMutation.mutate()} 
            disabled={!isValid || submitMutation.isPending}
          >
            {submitMutation.isPending ? 'Submitting...' : 'Confirm & Notify Requester'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
