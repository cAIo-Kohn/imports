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
import { 
  CheckCircle, 
  XCircle, 
  Upload, 
  FileText,
  X 
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface SampleReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: CardTask;
  cardTitle: string;
}

export function SampleReviewModal({
  open,
  onOpenChange,
  task,
  cardTitle,
}: SampleReviewModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [decisionNotes, setDecisionNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [reportFile, setReportFile] = useState<File | null>(null);

  const submitMutation = useMutation({
    mutationFn: async (decision: 'approved' | 'rejected') => {
      if (!user?.id) throw new Error('Not authenticated');

      let reportUrl: string | null = null;

      // Upload report file if provided (required for rejection)
      if (reportFile) {
        setIsUploading(true);
        const fileExt = reportFile.name.split('.').pop();
        const fileName = `${task.card_id}/${task.sample_id}/report-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('development-images')
          .upload(fileName, reportFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('development-images')
          .getPublicUrl(fileName);

        reportUrl = urlData.publicUrl;
        setIsUploading(false);
      }

      // Update sample with decision
      if (task.sample_id) {
        const { error: sampleError } = await supabase
          .from('development_item_samples')
          .update({
            decision,
            decision_notes: decisionNotes || null,
            decided_at: new Date().toISOString(),
            decided_by: user.id,
            report_url: reportUrl,
          })
          .eq('id', task.sample_id);

        if (sampleError) throw sampleError;
      }

      if (decision === 'approved') {
        // Mark task as completed
        const { error: taskError } = await supabase
          .from('development_card_tasks')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            completed_by: user.id,
            metadata: {
              ...task.metadata,
              decision: 'approved',
              decision_notes: decisionNotes || null,
              decided_at: new Date().toISOString(),
              report_url: reportUrl,
            },
          })
          .eq('id', task.id);

        if (taskError) throw taskError;

        // Log approval to timeline
        await supabase.from('development_card_activity').insert({
          card_id: task.card_id,
          user_id: user.id,
          activity_type: 'sample_approved',
          content: '✅ Sample approved',
          metadata: { 
            task_id: task.id, 
            sample_id: task.sample_id,
            notes: decisionNotes || null,
            has_report: !!reportUrl,
          },
        });

        // Clear pending action on the card
        await (supabase.from('development_items') as any)
          .update({ 
            pending_action_type: null,
            pending_action_due_at: null,
            pending_action_snoozed_until: null,
            pending_action_snoozed_by: null,
          })
          .eq('id', task.card_id);

      } else {
        // Rejected - reassign task to Trader for new sample
        const { error: taskError } = await supabase
          .from('development_card_tasks')
          .update({
            task_type: 'sample_request', // Back to sample_request
            status: 'pending',
            assigned_to_role: 'trader',
            assigned_to_users: [],
            metadata: {
              ...task.metadata,
              needs_resend: true,
              previous_decision: 'rejected',
              rejection_notes: decisionNotes || null,
              rejection_report_url: reportUrl,
              rejected_at: new Date().toISOString(),
              rejected_by: user.id,
            },
          })
          .eq('id', task.id);

        if (taskError) throw taskError;

        // Log rejection to timeline
        await supabase.from('development_card_activity').insert({
          card_id: task.card_id,
          user_id: user.id,
          activity_type: 'sample_rejected',
          content: '❌ Sample rejected - new sample required',
          metadata: { 
            task_id: task.id, 
            sample_id: task.sample_id,
            notes: decisionNotes || null,
            has_report: !!reportUrl,
          },
        });

        // Update card - move ownership back to ARC (China)
        await (supabase.from('development_items') as any)
          .update({ 
            current_owner: 'arc',
            is_new_for_other_team: true,
            pending_action_type: 'sample_tracking',
            pending_action_due_at: null,
            pending_action_snoozed_until: null,
            pending_action_snoozed_by: null,
          })
          .eq('id', task.card_id);

        await supabase.from('development_card_activity').insert({
          card_id: task.card_id,
          user_id: user.id,
          activity_type: 'ownership_change',
          content: 'Card moved to ARC (China) - new sample needed',
          metadata: { new_owner: 'arc', trigger: 'sample_rejected' },
        });

        // Notify Traders about rejection
        await sendTaskNotification({
          recipientRole: 'trader',
          triggeredBy: user.id,
          cardId: task.card_id,
          taskId: task.id,
          type: 'sample_rejected',
          title: '{name} rejected a sample',
          content: `Sample for "${cardTitle}" was rejected. A new sample is needed.`,
        });
      }
    },
    onSuccess: (_, decision) => {
      queryClient.invalidateQueries({ queryKey: ['card-tasks', task.card_id] });
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-item-samples', task.card_id] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', task.card_id] });
      toast({ 
        title: decision === 'approved' ? 'Sample Approved' : 'Sample Rejected',
        description: decision === 'rejected' 
          ? 'Trader will be notified to send a new sample' 
          : 'Sample review completed successfully',
      });
      onOpenChange(false);
      // Reset form
      setDecisionNotes('');
      setReportFile(null);
    },
    onError: (error: Error) => {
      setIsUploading(false);
      console.error('Failed to submit review:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit review',
        variant: 'destructive',
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast({ 
          title: 'Invalid file type', 
          description: 'Please upload a PDF or image file',
          variant: 'destructive' 
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ 
          title: 'File too large', 
          description: 'Maximum file size is 10MB',
          variant: 'destructive' 
        });
        return;
      }
      setReportFile(file);
    }
  };

  const canReject = !!reportFile || !!decisionNotes; // Require either report or notes for rejection
  const isPending = submitMutation.isPending || isUploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review Sample</DialogTitle>
          <DialogDescription>
            Review the received sample and provide your decision.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Notes Field */}
          <div className="space-y-2">
            <Label htmlFor="decision-notes">
              Review Notes / Feedback
            </Label>
            <Textarea
              id="decision-notes"
              placeholder="Describe your findings, any issues, or feedback..."
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Report Upload */}
          <div className="space-y-2">
            <Label>
              Attach Report <span className="text-muted-foreground text-xs">(Required for rejection)</span>
            </Label>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="file"
                id="report-upload"
                accept=".pdf,image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="report-upload"
                className={cn(
                  "flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer",
                  "hover:bg-muted transition-colors"
                )}
              >
                <Upload className="h-4 w-4" />
                <span className="text-sm">Upload PDF/Image</span>
              </label>
              {reportFile && (
                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm truncate max-w-[150px]">{reportFile.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => setReportFile(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="sm:order-1"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => submitMutation.mutate('rejected')}
            disabled={!canReject || isPending}
            className="border-destructive text-destructive hover:bg-destructive/10 sm:order-2"
          >
            <XCircle className="h-4 w-4 mr-1" />
            Reject
          </Button>
          <Button
            onClick={() => submitMutation.mutate('approved')}
            disabled={isPending}
            className="bg-green-600 hover:bg-green-700 text-white sm:order-3"
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            {isPending ? 'Submitting...' : 'Approve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
