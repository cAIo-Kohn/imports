import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrderChanges } from '@/hooks/useOrderChanges';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, Calendar, DollarSign, Package, Send, AlertTriangle, Edit2, X, Save, Loader2 } from 'lucide-react';

interface PurchaseOrder {
  id: string;
  etd: string | null;
  total_value_usd: number | null;
  trader_etd_approved: boolean;
  trader_etd_approved_at: string | null;
  trader_prices_approved: boolean;
  trader_prices_approved_at: string | null;
  trader_quantities_approved: boolean;
  trader_quantities_approved_at: string | null;
  status: string;
}

interface TraderHeaderApprovalsProps {
  order: PurchaseOrder;
  totalValue: number;
  totalQuantity: number;
  itemsCount: number;
  itemsWithPriceApproved: number;
  itemsWithQtyApproved: number;
  onOrderUpdated: () => void;
}

export function TraderHeaderApprovals({ 
  order, 
  totalValue, 
  totalQuantity,
  itemsCount,
  itemsWithPriceApproved,
  itemsWithQtyApproved,
  onOrderUpdated 
}: TraderHeaderApprovalsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logChange, pendingApprovalChanges } = useOrderChanges(order.id);

  const [isEditingEtd, setIsEditingEtd] = useState(false);
  const [editedEtd, setEditedEtd] = useState(order.etd || '');

  const allApproved = order.trader_etd_approved && order.trader_prices_approved && order.trader_quantities_approved;

  const approveFieldMutation = useMutation({
    mutationFn: async (field: 'etd' | 'prices' | 'quantities') => {
      const updateData: Record<string, unknown> = {};
      const now = new Date().toISOString();
      
      if (field === 'etd') {
        updateData.trader_etd_approved = true;
        updateData.trader_etd_approved_at = now;
        updateData.trader_etd_approved_by = user?.id;
      } else if (field === 'prices') {
        updateData.trader_prices_approved = true;
        updateData.trader_prices_approved_at = now;
        updateData.trader_prices_approved_by = user?.id;
      } else if (field === 'quantities') {
        updateData.trader_quantities_approved = true;
        updateData.trader_quantities_approved_at = now;
        updateData.trader_quantities_approved_by = user?.id;
      }

      const { error } = await supabase
        .from('purchase_orders')
        .update(updateData)
        .eq('id', order.id);

      if (error) throw error;

      await logChange({
        orderId: order.id,
        changeType: 'approval',
        fieldName: `trader_${field}_approved`,
        oldValue: 'false',
        newValue: 'true',
        isCritical: false,
      });
    },
    onSuccess: () => {
      toast({ title: 'Aprovação registrada!' });
      onOrderUpdated();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao aprovar', description: error.message, variant: 'destructive' });
    },
  });

  const updateEtdMutation = useMutation({
    mutationFn: async () => {
      const oldEtd = order.etd;
      
      const { error } = await supabase
        .from('purchase_orders')
        .update({ etd: editedEtd || null })
        .eq('id', order.id);

      if (error) throw error;

      // Log the critical change if ETD changed
      if (oldEtd !== editedEtd) {
        await logChange({
          orderId: order.id,
          changeType: 'order_field',
          fieldName: 'etd',
          oldValue: oldEtd,
          newValue: editedEtd || null,
          isCritical: true,
        });
      }
    },
    onSuccess: () => {
      toast({ title: 'ETD atualizado!' });
      setIsEditingEtd(false);
      onOrderUpdated();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar ETD', description: error.message, variant: 'destructive' });
    },
  });

  const submitForApprovalMutation = useMutation({
    mutationFn: async () => {
      const hasCriticalChanges = pendingApprovalChanges.length > 0;
      const newStatus = hasCriticalChanges ? 'pending_buyer_approval' : 'confirmed';
      
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status: newStatus,
          requires_buyer_approval: hasCriticalChanges,
        })
        .eq('id', order.id);

      if (error) throw error;
    },
    onSuccess: () => {
      const hasCriticalChanges = pendingApprovalChanges.length > 0;
      toast({ 
        title: hasCriticalChanges 
          ? 'Pedido enviado para aprovação da equipe Brasil!' 
          : 'Pedido confirmado com sucesso!'
      });
      onOrderUpdated();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao enviar pedido', description: error.message, variant: 'destructive' });
    },
  });

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <Card className="border-2 border-primary/20 bg-primary/5">
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* ETD Approval */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background border min-w-[260px]">
            <Checkbox 
              id="etd-approved" 
              checked={order.trader_etd_approved}
              onCheckedChange={() => !order.trader_etd_approved && approveFieldMutation.mutate('etd')}
              disabled={order.trader_etd_approved || approveFieldMutation.isPending}
            />
            <div className="flex items-center gap-2 flex-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                {isEditingEtd ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="date"
                      value={editedEtd}
                      onChange={(e) => setEditedEtd(e.target.value)}
                      className="h-7 w-36"
                    />
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-7 w-7"
                      onClick={() => updateEtdMutation.mutate()}
                      disabled={updateEtdMutation.isPending}
                    >
                      {updateEtdMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3 text-green-600" />
                      )}
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-7 w-7"
                      onClick={() => {
                        setIsEditingEtd(false);
                        setEditedEtd(order.etd || '');
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Label htmlFor="etd-approved" className="text-sm cursor-pointer">
                    <span className="font-medium">ETD:</span>{' '}
                    {order.etd 
                      ? format(new Date(order.etd), "dd/MM/yyyy", { locale: ptBR })
                      : 'Não definido'
                    }
                  </Label>
                )}
              </div>
              {!isEditingEtd && !order.trader_etd_approved && (
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6"
                  onClick={() => {
                    setEditedEtd(order.etd || '');
                    setIsEditingEtd(true);
                  }}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              )}
            </div>
            {order.trader_etd_approved && (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
          </div>

          {/* Prices Approval */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background border min-w-[240px]">
            <Checkbox 
              id="prices-approved" 
              checked={order.trader_prices_approved}
              onCheckedChange={() => !order.trader_prices_approved && approveFieldMutation.mutate('prices')}
              disabled={order.trader_prices_approved || approveFieldMutation.isPending}
            />
            <div className="flex items-center gap-2 flex-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="prices-approved" className="text-sm cursor-pointer">
                <span className="font-medium">Preços:</span>{' '}
                {formatCurrency(totalValue)}
                <span className="text-xs text-muted-foreground ml-1">
                  ({itemsWithPriceApproved}/{itemsCount})
                </span>
              </Label>
            </div>
            {order.trader_prices_approved && (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
          </div>

          {/* Quantities Approval */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background border min-w-[220px]">
            <Checkbox 
              id="quantities-approved" 
              checked={order.trader_quantities_approved}
              onCheckedChange={() => !order.trader_quantities_approved && approveFieldMutation.mutate('quantities')}
              disabled={order.trader_quantities_approved || approveFieldMutation.isPending}
            />
            <div className="flex items-center gap-2 flex-1">
              <Package className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="quantities-approved" className="text-sm cursor-pointer">
                <span className="font-medium">Qtd:</span>{' '}
                {totalQuantity.toLocaleString('pt-BR')} pcs
                <span className="text-xs text-muted-foreground ml-1">
                  ({itemsWithQtyApproved}/{itemsCount})
                </span>
              </Label>
            </div>
            {order.trader_quantities_approved && (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Status Badge & Submit Button */}
          <div className="flex items-center gap-3">
            {allApproved && (
              <Badge className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Aprovações concluídas
              </Badge>
            )}
            
            {allApproved && order.status === 'pending_trader_review' && (
              <Button 
                onClick={() => submitForApprovalMutation.mutate()}
                disabled={submitForApprovalMutation.isPending}
              >
                {submitForApprovalMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {pendingApprovalChanges.length > 0 
                  ? 'Enviar para Aprovação' 
                  : 'Confirmar Pedido'
                }
              </Button>
            )}
          </div>
        </div>

        {/* Warning for critical changes */}
        {pendingApprovalChanges.length > 0 && allApproved && order.status === 'pending_trader_review' && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Há {pendingApprovalChanges.length} alteração(ões) crítica(s) que precisam de aprovação da equipe Brasil
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
