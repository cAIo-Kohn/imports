import { useEffect, useRef } from 'react';
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
  };
}

// Hook to fetch all products in the new product flow
export function useNewProductsData() {
  const queryClient = useQueryClient();

  const result = useQuery({
    queryKey: ['new-products'],
    staleTime: 60 * 1000, // 60 seconds — new products page doesn't need instant refresh
    queryFn: async () => {
      // Phase 1: Fetch eligible samples and all flow items in parallel
      const [eligibleRes, flowItemsRes] = await Promise.all([
        // Eligible products (approved samples, not yet in flow)
        supabase
          .from('development_item_samples')
          .select(`
            id,
            decided_at,
            development_items!inner (
              id, title, card_type, image_url, supplier_id, product_code, new_product_flow_status
            )
          `)
          .eq('decision', 'approved')
          .is('development_items.deleted_at', null)
          .is('development_items.new_product_flow_status', null)
          .order('decided_at', { ascending: false }),

        // All flow items in a single query (consolidates 4 separate queries)
        supabase
          .from('development_items')
          .select('id, title, description, card_type, image_url, supplier_id, product_code, new_product_flow_status, fob_price_usd, moq, qty_per_master_inner, container_type, qty_per_container, registered_product_id')
          .in('new_product_flow_status', ['step1_research', 'step2_code_registration', 'step3_ready_for_order', 'completed'])
          .is('deleted_at', null),
      ]);

      if (eligibleRes.error) throw eligibleRes.error;
      if (flowItemsRes.error) throw flowItemsRes.error;

      // Partition flow items by status client-side
      const step1Items = (flowItemsRes.data || []).filter(i => i.new_product_flow_status === 'step1_research');
      const step2Items = (flowItemsRes.data || []).filter(i => i.new_product_flow_status === 'step2_code_registration');
      const step3Items = (flowItemsRes.data || []).filter(i => i.new_product_flow_status === 'step3_ready_for_order');
      const completedItems = (flowItemsRes.data || []).filter(i => i.new_product_flow_status === 'completed');

      // Phase 2: Conditional enrichment queries in parallel
      const step2Ids = step2Items.map(item => item.id);
      const step1Ids = step1Items.map(item => item.id);
      const registeredProductIds = step3Items
        .filter(item => item.registered_product_id)
        .map(item => item.registered_product_id!);

      const [customsRes, approvalsRes, orderItemsRes] = await Promise.all([
        // Customs metadata for step2 cards
        step2Ids.length > 0
          ? supabase
              .from('development_card_activity')
              .select('card_id, metadata')
              .in('card_id', step2Ids)
              .not('metadata', 'is', null)
          : Promise.resolve({ data: [] as any[], error: null }),

        // Approvals for step1 cards
        step1Ids.length > 0
          ? supabase
              .from('new_product_approvals')
              .select('*')
              .in('card_id', step1Ids)
          : Promise.resolve({ data: [] as any[], error: null }),

        // Order detection for step3 cards
        registeredProductIds.length > 0
          ? supabase
              .from('purchase_order_items')
              .select('product_id')
              .in('product_id', registeredProductIds)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      // Process customs data for step2
      const step2CustomsData: Record<string, { ncm_code?: string; product_catalog_description?: string }> = {};
      for (const activity of customsRes.data || []) {
        const meta = activity.metadata as any;
        if (meta?.ncm_code || meta?.product_catalog_description) {
          step2CustomsData[activity.card_id] = {
            ncm_code: meta.ncm_code || step2CustomsData[activity.card_id]?.ncm_code,
            product_catalog_description: meta.product_catalog_description || step2CustomsData[activity.card_id]?.product_catalog_description,
          };
        }
      }

      const enrichedStep2 = step2Items.map(item => ({
        ...item,
        _customs_ncm: step2CustomsData[item.id]?.ncm_code || null,
        _customs_description: step2CustomsData[item.id]?.product_catalog_description || null,
      }));

      // Process auto-complete detection for step3
      const orderedProductIds = new Set((orderItemsRes.data || []).map(oi => oi.product_id));
      const autoCompletedCardIds: string[] = [];
      const remainingStep3 = step3Items.filter(item => {
        if (item.registered_product_id && orderedProductIds.has(item.registered_product_id)) {
          autoCompletedCardIds.push(item.id);
          return false;
        }
        return true;
      });

      // Process approvals
      const approvals = (approvalsRes.data || []) as NewProductApproval[];

      // Deduplicate eligible products by card_id
      const eligibleMap = new Map();
      (eligibleRes.data || []).forEach(sample => {
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
        step1: step1Items,
        step2: enrichedStep2,
        step3: remainingStep3,
        completed: completedItems,
        approvals,
        _autoCompletedCardIds: autoCompletedCardIds,
      };
    },
  });

  // Auto-advance cards detected as ordered — runs as side-effect, not inside queryFn
  const autoCompleteProcessedRef = useRef<Set<string>>(new Set());
  const autoCompletedIds = result.data?._autoCompletedCardIds || [];

  useEffect(() => {
    const newIds = autoCompletedIds.filter(id => !autoCompleteProcessedRef.current.has(id));
    if (newIds.length === 0) return;

    // Mark as processed immediately to prevent re-runs
    newIds.forEach(id => autoCompleteProcessedRef.current.add(id));

    supabase
      .from('development_items')
      .update({ new_product_flow_status: 'completed' })
      .in('id', newIds)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['new-products'] });
      });
  }, [autoCompletedIds, queryClient]);

  return result;
}
