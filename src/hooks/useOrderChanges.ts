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

interface LogChangeParams {
  orderId: string;
  itemId?: string;
  changeType: 'order_field' | 'item_field' | 'approval';
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  isCritical?: boolean;
}

// Critical fields that require buyer approval when changed
const CRITICAL_FIELDS = ['etd', 'unit_price_usd', 'quantity', 'total_value_usd'];

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

  const criticalChanges = changes.filter(c => c.is_critical);
  const pendingApprovalChanges = changes.filter(c => c.is_critical && c.requires_approval && !c.approved_by);
  const informationalChanges = changes.filter(c => !c.is_critical);

  return {
    changes,
    criticalChanges,
    pendingApprovalChanges,
    informationalChanges,
    isLoading,
    logChange: logChangeMutation.mutateAsync,
    approveChange: approveChangeMutation.mutateAsync,
    isLogging: logChangeMutation.isPending,
    isApproving: approveChangeMutation.isPending,
  };
}
