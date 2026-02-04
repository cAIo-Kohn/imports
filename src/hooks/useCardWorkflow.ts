import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type WorkflowStatus =
  | 'sample_requested'
  | 'sample_tracking_added'
  | 'sample_arrived'
  | 'sample_reviewed'
  | 'commercial_requested'
  | 'commercial_filled'
  | 'commercial_reviewed'
  | null;

export type AssigneeRole = 'buyer' | 'trader' | 'quality' | 'admin' | 'marketing' | null;

// Map workflow status to which role should take action
const WORKFLOW_ASSIGNEE_MAP: Record<Exclude<WorkflowStatus, null>, AssigneeRole> = {
  sample_requested: 'trader',
  sample_tracking_added: 'buyer',
  sample_arrived: 'quality',  // Quality Team reviews samples
  sample_reviewed: null, // Complete
  commercial_requested: 'trader',
  commercial_filled: 'buyer',
  commercial_reviewed: null, // Complete
};

export function getAssigneeForWorkflowStatus(status: WorkflowStatus): AssigneeRole {
  if (!status) return null;
  return WORKFLOW_ASSIGNEE_MAP[status] || null;
}

export function getWorkflowStatusLabel(status: WorkflowStatus): string {
  if (!status) return '';
  
  const labels: Record<Exclude<WorkflowStatus, null>, string> = {
    sample_requested: 'Sample Requested',
    sample_tracking_added: 'Tracking Added',
    sample_arrived: 'Sample Arrived',
    sample_reviewed: 'Sample Reviewed',
    commercial_requested: 'Data Requested',
    commercial_filled: 'Data Filled',
    commercial_reviewed: 'Data Reviewed',
  };
  
  return labels[status] || status;
}

export function getRoleLabel(role: AssigneeRole): string {
  if (!role) return '';
  
  const labels: Record<Exclude<AssigneeRole, null>, string> = {
    buyer: 'Buyer Team',
    trader: 'Trader',
    quality: 'Quality Team',
    admin: 'Admin',
    marketing: 'Marketing',
  };
  
  return labels[role] || role;
}

export function useCardWorkflow(cardId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const updateWorkflowMutation = useMutation({
    mutationFn: async ({
      workflowStatus,
      reason,
      fromRole,
      toRole,
      taskId,
    }: {
      workflowStatus: WorkflowStatus;
      reason: string;
      fromRole?: AssigneeRole;
      toRole?: AssigneeRole;
      taskId?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const newAssignee = workflowStatus ? getAssigneeForWorkflowStatus(workflowStatus) : null;

      // Update the card's workflow status
      const { error: updateError } = await supabase
        .from('development_items')
        .update({
          workflow_status: workflowStatus,
          current_assignee_role: newAssignee,
        })
        .eq('id', cardId);

      if (updateError) throw updateError;

      // Log the handoff activity if there's a role change
      if (fromRole || toRole) {
        await supabase.from('development_card_activity').insert({
          card_id: cardId,
          user_id: user.id,
          activity_type: 'handoff',
          content: reason,
          metadata: {
            from_role: fromRole,
            to_role: toRole || newAssignee,
            workflow_status: workflowStatus,
            task_id: taskId,
          },
        });
      }

      return { workflowStatus, assignee: newAssignee };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
    },
  });

  const clearWorkflowMutation = useMutation({
    mutationFn: async ({ reason }: { reason: string }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Clear workflow status
      const { error: updateError } = await supabase
        .from('development_items')
        .update({
          workflow_status: null,
          current_assignee_role: null,
        })
        .eq('id', cardId);

      if (updateError) throw updateError;

      // Log completion
      await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'handoff',
        content: reason,
        metadata: {
          workflow_status: null,
          action: 'workflow_complete',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
    },
  });

  return {
    updateWorkflow: updateWorkflowMutation.mutateAsync,
    clearWorkflow: clearWorkflowMutation.mutateAsync,
    isUpdating: updateWorkflowMutation.isPending || clearWorkflowMutation.isPending,
  };
}

// Helper function to be used in task mutations
export async function updateCardWorkflowStatus(
  cardId: string,
  workflowStatus: WorkflowStatus,
  userId: string,
  reason: string,
  fromRole?: AssigneeRole,
  toRole?: AssigneeRole,
  taskId?: string
) {
  const newAssignee = workflowStatus ? getAssigneeForWorkflowStatus(workflowStatus) : null;

  // Update the card's workflow status
  const { error: updateError } = await supabase
    .from('development_items')
    .update({
      workflow_status: workflowStatus,
      current_assignee_role: newAssignee,
    })
    .eq('id', cardId);

  if (updateError) throw updateError;

  // Log the handoff activity if there's a role change
  if (fromRole || toRole) {
    await supabase.from('development_card_activity').insert({
      card_id: cardId,
      user_id: userId,
      activity_type: 'handoff',
      content: reason,
      metadata: {
        from_role: fromRole,
        to_role: toRole || newAssignee,
        workflow_status: workflowStatus,
        task_id: taskId,
      },
    });
  }

  return { workflowStatus, assignee: newAssignee };
}
