import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { updateCardWorkflowStatus } from '@/hooks/useCardWorkflow';
import { 
  FileCheck, 
  CheckCircle, 
  XCircle, 
  Upload, 
  FileText,
  X 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Sample {
  id: string;
  item_id: string;
  courier_name: string | null;
  tracking_number: string | null;
  status: 'pending' | 'in_transit' | 'delivered' | 'returned';
  decision: 'approved' | 'rejected' | null;
  decision_notes: string | null;
  report_url: string | null;
}

interface SampleReviewSectionProps {
  cardId: string;
  sample: Sample;
  onReviewed?: () => void;
}

export function SampleReviewSection({ 
  cardId, 
  sample, 
  onReviewed 
}: SampleReviewSectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [decisionNotes, setDecisionNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [reportFile, setReportFile] = useState<File | null>(null);

  // If already decided, don't show the form
  if (sample.decision) {
    return null;
  }

  const submitDecisionMutation = useMutation({
    mutationFn: async (decision: 'approved' | 'rejected') => {
      if (!user?.id) throw new Error('Not authenticated');

      let reportUrl = sample.report_url;

      // Upload report file if provided
      if (reportFile) {
        setIsUploading(true);
        const fileExt = reportFile.name.split('.').pop();
        const fileName = `${cardId}/${sample.id}/report-${Date.now()}.${fileExt}`;

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
      const { error: updateError } = await supabase
        .from('development_item_samples')
        .update({
          decision,
          decision_notes: decisionNotes || null,
          decided_at: new Date().toISOString(),
          decided_by: user.id,
          report_url: reportUrl,
        })
        .eq('id', sample.id);

      if (updateError) throw updateError;

      // Log activity
      const { error: activityError } = await supabase
        .from('development_card_activity')
        .insert({
          card_id: cardId,
          user_id: user.id,
          activity_type: decision === 'approved' ? 'sample_approved' : 'sample_rejected',
          content: decision === 'approved' 
            ? 'Sample approved' 
            : 'Sample rejected',
          metadata: {
            sample_id: sample.id,
            decision,
            notes: decisionNotes || null,
            has_report: !!reportUrl,
          },
        });

      if (activityError) throw activityError;

      // Resolve the sample_requested thread (mark as complete)
      const { data: sampleRequestThread } = await supabase
        .from('development_card_activity')
        .select('id')
        .eq('card_id', cardId)
        .eq('activity_type', 'sample_requested')
        .is('thread_resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (sampleRequestThread?.id) {
        await supabase
          .from('development_card_activity')
          .update({ 
            pending_for_team: null,
            thread_resolved_at: new Date().toISOString(),
          })
          .eq('id', sampleRequestThread.id);
      }

      // Clear pending action and update workflow status
      if (decision === 'approved') {
        // Clear workflow status - sample complete
        await (supabase.from('development_items') as any)
          .update({ 
            workflow_status: null,
            current_assignee_role: null,
            pending_action_type: null,
            pending_action_due_at: null,
            pending_action_snoozed_until: null,
            pending_action_snoozed_by: null,
          })
          .eq('id', cardId);

        // Log workflow completion
        await supabase.from('development_card_activity').insert({
          card_id: cardId,
          user_id: user.id,
          activity_type: 'handoff',
          content: 'Sample approved - workflow complete',
          metadata: { workflow_status: null, action: 'workflow_complete' },
        });
      } else {
        // If rejected, restart workflow - trader needs to send new sample
        await updateCardWorkflowStatus(
          cardId,
          'sample_requested',
          user.id,
          'Sample rejected - new sample needed',
          'buyer',
          'trader'
        );

        // Also update legacy fields
        await (supabase.from('development_items') as any)
          .update({ 
            current_owner: 'arc',
            is_new_for_other_team: true,
            pending_action_type: 'sample_tracking',
            pending_action_due_at: null,
            pending_action_snoozed_until: null,
            pending_action_snoozed_by: null,
          })
          .eq('id', cardId);

        await supabase.from('development_card_activity').insert({
          card_id: cardId,
          user_id: user.id,
          activity_type: 'ownership_change',
          content: 'Card moved to ARC (China) - sample rejected',
          metadata: { new_owner: 'arc', trigger: 'sample_rejected' },
        });
      }
    },
    onSuccess: (_, decision) => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-item-samples', cardId] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      toast({ 
        title: decision === 'approved' ? 'Sample Approved' : 'Sample Rejected',
        description: decision === 'rejected' 
          ? 'Card moved to China for new sample' 
          : 'Review submitted successfully',
      });
      onReviewed?.();
    },
    onError: (error: Error) => {
      setIsUploading(false);
      toast({ 
        title: 'Error', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Allow PDFs and images
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast({ 
          title: 'Invalid file type', 
          description: 'Please upload a PDF or image file',
          variant: 'destructive' 
        });
        return;
      }
      setReportFile(file);
    }
  };

  const handleDecision = (decision: 'approved' | 'rejected') => {
    submitDecisionMutation.mutate(decision);
  };

  return (
    <div className="border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-600 rounded-lg p-4 mt-3 animate-pulse">
      <h4 className="font-medium flex items-center gap-2 text-amber-800 dark:text-amber-200">
        <FileCheck className="h-4 w-4" />
        Sample Review Required
      </h4>
      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1 mb-4">
        The sample has arrived. Please test and provide your decision.
      </p>

      {/* Notes Field */}
      <div className="space-y-2 mb-4">
        <Label htmlFor="decision-notes" className="text-sm">
          Review Notes / Feedback
        </Label>
        <Textarea
          id="decision-notes"
          placeholder="Describe your findings, any issues, or feedback..."
          value={decisionNotes}
          onChange={(e) => setDecisionNotes(e.target.value)}
          rows={3}
          className="bg-white dark:bg-background"
        />
      </div>

      {/* Report Upload */}
      <div className="mb-4">
        <Label className="text-sm mb-2 block">
          Attach Report (Optional)
        </Label>
        <div className="flex items-center gap-2">
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
              "bg-white dark:bg-background hover:bg-amber-100 dark:hover:bg-amber-900",
              "border-amber-300 dark:border-amber-600 transition-colors"
            )}
          >
            <Upload className="h-4 w-4" />
            <span className="text-sm">Upload PDF/Images</span>
          </label>
          {reportFile && (
            <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-background rounded-md border">
              <FileText className="h-4 w-4 text-amber-600" />
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

      {/* Decision Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          onClick={() => handleDecision('rejected')}
          disabled={submitDecisionMutation.isPending || isUploading}
          className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-950"
        >
          <XCircle className="h-4 w-4 mr-1" />
          Reject Sample
        </Button>
        <Button
          onClick={() => handleDecision('approved')}
          disabled={submitDecisionMutation.isPending || isUploading}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          {submitDecisionMutation.isPending || isUploading ? 'Submitting...' : 'Approve Sample'}
        </Button>
      </div>
    </div>
  );
}
