import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export type FlowStatus = 'step1_research' | 'step2_code_registration' | 'step3_ready_for_order' | 'completed';
export type ApprovalType = 'market_research' | 'trademark_patent' | 'customs_research';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface NewProductApproval {
  id: string;
  card_id: string;
  approval_type: ApprovalType;
  status: ApprovalStatus;
  assigned_role: string;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  created_by: string;
}

export const APPROVAL_CONFIG: Record<ApprovalType, { label: string; labelPt: string; role: string; icon: string }> = {
  market_research: { label: 'Market Research', labelPt: 'Pesquisa de Mercado', role: 'marketing', icon: '📢' },
  trademark_patent: { label: 'Certifications, Trademarks & Patents', labelPt: 'Certificações, Marcas e Patentes', role: 'quality', icon: '✅' },
  customs_research: { label: 'Customs Research', labelPt: 'Pesquisa Aduaneira', role: 'buyer', icon: '🛒' },
};

export function useNewProductFlow(cardId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch approvals for a specific card
  const { data: approvals = [], isLoading: approvalsLoading } = useQuery({
    queryKey: ['new-product-approvals', cardId],
    queryFn: async () => {
      if (!cardId) return [];
      const { data, error } = await supabase
        .from('new_product_approvals')
        .select('*')
        .eq('card_id', cardId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as NewProductApproval[];
    },
    enabled: !!cardId,
  });

  // Start the new product flow
  const startFlowMutation = useMutation({
    mutationFn: async (targetCardId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Update the card to step1_research
      const { error: updateError } = await supabase
        .from('development_items')
        .update({ new_product_flow_status: 'step1_research' })
        .eq('id', targetCardId);

      if (updateError) throw updateError;

      // Create 3 approval records for parallel Step 1
      const approvalTypes: ApprovalType[] = ['market_research', 'trademark_patent', 'customs_research'];
      const approvalInserts = approvalTypes.map(type => ({
        card_id: targetCardId,
        approval_type: type,
        status: 'pending',
        assigned_role: APPROVAL_CONFIG[type].role,
        created_by: user.id,
      }));

      const { error: insertError } = await supabase
        .from('new_product_approvals')
        .insert(approvalInserts);

      if (insertError) throw insertError;

      // Log activity
      await supabase.from('development_card_activity').insert({
        card_id: targetCardId,
        user_id: user.id,
        activity_type: 'message',
        content: '🚀 New product workflow started - awaiting research & compliance approvals',
        metadata: { flow_action: 'start_flow' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['new-products'] });
      queryClient.invalidateQueries({ queryKey: ['new-product-approvals'] });
      toast({ title: 'Workflow started', description: 'Product moved to research phase' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Check if all Step 1 approvals are complete and advance to Step 2
  const checkAndAdvanceFlow = async (targetCardId: string) => {
    const { data: allApprovals, error } = await supabase
      .from('new_product_approvals')
      .select('status')
      .eq('card_id', targetCardId);

    if (error || !allApprovals) return;

    const allApproved = allApprovals.every(a => a.status === 'approved');
    if (allApproved && allApprovals.length === 3) {
      await supabase
        .from('development_items')
        .update({ new_product_flow_status: 'step2_code_registration' })
        .eq('id', targetCardId);

      if (user?.id) {
        await supabase.from('development_card_activity').insert({
          card_id: targetCardId,
          user_id: user.id,
          activity_type: 'message',
          content: '✅ All research approvals complete - moved to code registration',
          metadata: { flow_action: 'advance_step2' },
        });
      }
    }
  };

  // Advance to next step manually (for Step 2 -> Step 3 and Step 3 -> Complete)
  const advanceStepMutation = useMutation({
    mutationFn: async ({ targetCardId, nextStatus }: { targetCardId: string; nextStatus: FlowStatus }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('development_items')
        .update({ new_product_flow_status: nextStatus })
        .eq('id', targetCardId);

      if (error) throw error;

      const statusLabels: Record<FlowStatus, string> = {
        step1_research: 'Research Phase',
        step2_code_registration: 'Code Registration',
        step3_ready_for_order: 'Ready for Order',
        completed: 'Completed',
      };

      await supabase.from('development_card_activity').insert({
        card_id: targetCardId,
        user_id: user.id,
        activity_type: 'message',
        content: `📋 Product moved to: ${statusLabels[nextStatus]}`,
        metadata: { flow_action: 'advance_step', new_status: nextStatus },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['new-products'] });
      toast({ title: 'Step completed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    approvals,
    approvalsLoading,
    startFlow: startFlowMutation.mutate,
    startFlowPending: startFlowMutation.isPending,
    advanceStep: advanceStepMutation.mutate,
    advanceStepPending: advanceStepMutation.isPending,
    checkAndAdvanceFlow,
  };
}

// Hook to fetch all products in the new product flow
export function useNewProductsData() {
  return useQuery({
    queryKey: ['new-products'],
    queryFn: async () => {
      // Fetch eligible products (approved samples, not yet in flow)
      const { data: eligibleSamples, error: eligibleError } = await supabase
        .from('development_item_samples')
        .select(`
          id,
          decided_at,
          development_items!inner (
            id,
            title,
            card_type,
            image_url,
            supplier_id,
            product_code,
            new_product_flow_status
          )
        `)
        .eq('decision', 'approved')
        .is('development_items.deleted_at', null)
        .is('development_items.new_product_flow_status', null)
        .order('decided_at', { ascending: false });

      if (eligibleError) throw eligibleError;

      // Fetch products in Step 1
      const { data: step1Items, error: step1Error } = await supabase
        .from('development_items')
        .select('id, title, card_type, image_url, supplier_id, product_code, new_product_flow_status')
        .eq('new_product_flow_status', 'step1_research')
        .is('deleted_at', null);

      if (step1Error) throw step1Error;

      // Fetch products in Step 2
      const { data: step2Items, error: step2Error } = await supabase
        .from('development_items')
        .select('id, title, card_type, image_url, supplier_id, product_code, new_product_flow_status')
        .eq('new_product_flow_status', 'step2_code_registration')
        .is('deleted_at', null);

      if (step2Error) throw step2Error;

      // Fetch products in Step 3
      const { data: step3Items, error: step3Error } = await supabase
        .from('development_items')
        .select('id, title, card_type, image_url, supplier_id, product_code, new_product_flow_status')
        .eq('new_product_flow_status', 'step3_ready_for_order')
        .is('deleted_at', null);

      if (step3Error) throw step3Error;

      // Fetch all approvals for Step 1 items
      const step1Ids = step1Items?.map(item => item.id) || [];
      let approvals: NewProductApproval[] = [];
      if (step1Ids.length > 0) {
        const { data: approvalsData, error: approvalsError } = await supabase
          .from('new_product_approvals')
          .select('*')
          .in('card_id', step1Ids);
        
        if (!approvalsError && approvalsData) {
          approvals = approvalsData as NewProductApproval[];
        }
      }

      // Deduplicate eligible products by card_id
      const eligibleMap = new Map();
      eligibleSamples?.forEach(sample => {
        const item = sample.development_items as any;
        if (!eligibleMap.has(item.id)) {
          eligibleMap.set(item.id, {
            ...item,
            sample_approved_at: sample.decided_at,
          });
        }
      });

      return {
        eligible: Array.from(eligibleMap.values()),
        step1: step1Items || [],
        step2: step2Items || [],
        step3: step3Items || [],
        approvals,
      };
    },
  });
}
