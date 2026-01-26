import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface OrderChange {
  id: string;
  purchase_order_id: string;
  purchase_order_item_id: string | null;
  changed_by: string;
  changed_at: string;
  change_type: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  is_critical: boolean;
  requires_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
}

export interface ConsolidatedChange {
  key: string;                    // "order-etd" or "item-uuid-unit_price_usd"
  fieldName: string;
  itemId: string | null;
  originalValue: string | null;   // First value before any change
  currentValue: string | null;    // Last value
  timeline: OrderChange[];        // All changes for this field
  hasCounterProposal: boolean;
  counterProposalValue: string | null;
  isAgreed: boolean;              // Trader accepted buyer's suggestion?
  needsApproval: boolean;         // Still needs approval?
  productCode: string | null;     // Product code for item-level changes
  productId: string | null;       // Product ID for item-level changes
}

interface LogChangeParams {
  orderId: string;
  itemId?: string;
  changeType: 'order_field' | 'item_field' | 'approval' | 'buyer_counter_proposal';
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  isCritical?: boolean;
}

interface LogCounterProposalParams {
  orderId: string;
  itemId?: string;
  fieldName: string;
  traderValue: string | null;
  suggestedValue: string;
  justification?: string;
}

// Critical fields that require buyer approval when changed
const CRITICAL_FIELDS = ['etd', 'unit_price_usd', 'quantity', 'total_value_usd'];

// Cadastral fields that should appear in informational changes (non-critical)
const CADASTRAL_FIELDS = [
  'technical_description',
  'supplier_specs',
  'ncm',
  'master_box_volume',
  'master_box_length',
  'master_box_width',
  'master_box_height',
  'gross_weight',
  'origin_description',
  'image_url',
];

export function useOrderChanges(orderId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: changes = [], isLoading } = useQuery({
    queryKey: ['order-changes', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_order_change_history')
        .select('*')
        .eq('purchase_order_id', orderId)
        .order('changed_at', { ascending: false });
      
      if (error) throw error;
      return data as OrderChange[];
    },
    enabled: !!orderId,
  });

  // Fetch order items with product codes for enriching item-level changes
  const { data: orderItems = [] } = useQuery({
    queryKey: ['order-items-products', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select('id, product_id, products(code)')
        .eq('purchase_order_id', orderId);
      if (error) throw error;
      return data as Array<{ id: string; product_id: string; products: { code: string } | null }>;
    },
    enabled: !!orderId,
  });

  const logChangeMutation = useMutation({
    mutationFn: async (params: LogChangeParams) => {
      const isCritical = params.isCritical ?? CRITICAL_FIELDS.includes(params.fieldName);
      
      const { error } = await supabase
        .from('purchase_order_change_history')
        .insert({
          purchase_order_id: params.orderId,
          purchase_order_item_id: params.itemId || null,
          changed_by: user?.id,
          change_type: params.changeType,
          field_name: params.fieldName,
          old_value: params.oldValue,
          new_value: params.newValue,
          is_critical: isCritical,
          requires_approval: isCritical,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-changes', orderId] });
    },
  });

  const approveChangeMutation = useMutation({
    mutationFn: async (changeId: string) => {
      const { error } = await supabase
        .from('purchase_order_change_history')
        .update({
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          requires_approval: false,
        })
        .eq('id', changeId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-changes', orderId] });
    },
  });

  const logCounterProposalMutation = useMutation({
    mutationFn: async (params: LogCounterProposalParams) => {
      const { error } = await supabase
        .from('purchase_order_change_history')
        .insert({
          purchase_order_id: params.orderId,
          purchase_order_item_id: params.itemId || null,
          changed_by: user?.id,
          change_type: 'buyer_counter_proposal',
          field_name: params.fieldName,
          old_value: params.traderValue,
          new_value: params.suggestedValue,
          is_critical: true,
          requires_approval: true, // Trader needs to accept or negotiate
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-changes', orderId] });
    },
  });

  const criticalChanges = changes.filter(c => c.is_critical);
  const pendingApprovalChanges = changes.filter(c => c.is_critical && c.requires_approval && !c.approved_by);
  // Filter informational changes to only show cadastral fields (no internal flags)
  const informationalChanges = changes.filter(c => 
    !c.is_critical && CADASTRAL_FIELDS.includes(c.field_name)
  );
  
  // Counter-proposals made by buyers
  const counterProposals = changes.filter(c => c.change_type === 'buyer_counter_proposal');
  const pendingCounterProposals = counterProposals.filter(c => c.requires_approval && !c.approved_by);
  
  // Timeline agrupando por campo para mostrar negociação
  const changeTimeline = useMemo(() => {
    const grouped: Record<string, OrderChange[]> = {};
    changes.forEach(c => {
      const key = `${c.purchase_order_item_id || 'order'}::${c.field_name}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(c);
    });
    // Ordenar cada grupo por data (mais antigo primeiro)
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime());
    });
    return grouped;
  }, [changes]);

  // Consolidated critical changes - 1 card per field/item
  const consolidatedCriticalChanges = useMemo(() => {
    const result: ConsolidatedChange[] = [];
    
    Object.entries(changeTimeline).forEach(([key, timeline]) => {
      // Filter only critical changes
      const criticalInTimeline = timeline.filter(c => c.is_critical);
      if (criticalInTimeline.length === 0) return;
      
      const [scope, fieldName] = key.split('::');
      const itemId = scope === 'order' ? null : scope;
      
      // Original value (first old_value in timeline)
      const originalValue = criticalInTimeline[0].old_value;
      
      // Current value (last new_value in timeline)
      const currentValue = criticalInTimeline[criticalInTimeline.length - 1].new_value;
      
      // Check if there's a counter-proposal
      const counterProposal = criticalInTimeline.find(c => c.change_type === 'buyer_counter_proposal');
      
      // Check if trader accepted buyer's suggestion
      const isAgreed = (() => {
        if (!counterProposal) return false;
        const lastChange = criticalInTimeline[criticalInTimeline.length - 1];
        // Trader accepted if the last change is NOT a counter-proposal and has the same value
        return lastChange.change_type !== 'buyer_counter_proposal' && 
               lastChange.new_value === counterProposal.new_value;
      })();
      
      // If agreed, no approval needed; otherwise check for pending approvals
      const needsApproval = !isAgreed && criticalInTimeline.some(c => c.requires_approval && !c.approved_by);
      
      // Find product info for item-level changes
      const productInfo = itemId ? orderItems.find(i => i.id === itemId) : null;

      result.push({
        key,
        fieldName,
        itemId,
        originalValue,
        currentValue,
        timeline: criticalInTimeline,
        hasCounterProposal: !!counterProposal,
        counterProposalValue: counterProposal?.new_value || null,
        isAgreed,
        needsApproval,
        productCode: productInfo?.products?.code || null,
        productId: productInfo?.product_id || null,
      });
    });
    
    return result;
  }, [changeTimeline, orderItems]);

  // Agrupar alterações por item (mantém apenas a mais recente por campo)
  const changesByItem = useMemo(() => {
    const grouped: Record<string, Record<string, OrderChange>> = {};
    changes.forEach(c => {
      if (c.purchase_order_item_id) {
        if (!grouped[c.purchase_order_item_id]) {
          grouped[c.purchase_order_item_id] = {};
        }
        // Manter apenas a alteração mais recente por campo
        const existing = grouped[c.purchase_order_item_id][c.field_name];
        if (!existing || new Date(c.changed_at) > new Date(existing.changed_at)) {
          grouped[c.purchase_order_item_id][c.field_name] = c;
        }
      }
    });
    return grouped;
  }, [changes]);

  // Alterações no nível do pedido (não itens)
  const orderLevelChanges = useMemo(() => {
    const grouped: Record<string, OrderChange> = {};
    changes.filter(c => !c.purchase_order_item_id).forEach(c => {
      const existing = grouped[c.field_name];
      if (!existing || new Date(c.changed_at) > new Date(existing.changed_at)) {
        grouped[c.field_name] = c;
      }
    });
    return grouped;
  }, [changes]);

  return {
    changes,
    criticalChanges,
    pendingApprovalChanges,
    informationalChanges,
    counterProposals,
    pendingCounterProposals,
    changeTimeline,
    consolidatedCriticalChanges,
    changesByItem,
    orderLevelChanges,
    isLoading,
    logChange: logChangeMutation.mutateAsync,
    logCounterProposal: logCounterProposalMutation.mutateAsync,
    approveChange: approveChangeMutation.mutateAsync,
    isLogging: logChangeMutation.isPending,
    isLoggingCounterProposal: logCounterProposalMutation.isPending,
    isApproving: approveChangeMutation.isPending,
  };
}
