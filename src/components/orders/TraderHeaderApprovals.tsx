import { useState, useMemo } from 'react';
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
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, Calendar, DollarSign, Container, Send, AlertTriangle, Edit2, X, Save, Loader2, Users } from 'lucide-react';

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
  containerInfo: string;
  earliestArrival: string | null;
  onOrderUpdated: () => void;
}

// Calculate suggested ETD: 60 days before arrival, snap to 15th or last day of month
function calculateSuggestedEtd(expectedArrival: string): string {
  const arrivalDate = new Date(expectedArrival + 'T12:00:00');
  const suggestedDate = subDays(arrivalDate, 60);
  
  const day = suggestedDate.getDate();
  const year = suggestedDate.getFullYear();
  const month = suggestedDate.getMonth();
  
  if (day <= 15) {
    return format(new Date(year, month, 15), 'yyyy-MM-dd');
  } else {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return format(new Date(year, month, lastDay), 'yyyy-MM-dd');
  }
}

export function TraderHeaderApprovals({ 
  order, 
  totalValue, 
  containerInfo,
  earliestArrival,
  onOrderUpdated 
}: TraderHeaderApprovalsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logChange, pendingApprovalChanges, pendingCounterProposals, changeTimeline } = useOrderChanges(order.id);

  // Get buyer's suggestion for ETD if any
  const buyerEtdSuggestion = useMemo(() => {
    const etdChanges = changeTimeline['order-etd'] || [];
    const counterProposal = etdChanges.find(c => c.change_type === 'buyer_counter_proposal' && c.requires_approval);
    return counterProposal?.new_value || null;
  }, [changeTimeline]);

  // Calculate suggested ETD
  const suggestedEtd = useMemo(() => {
    if (order.etd) return order.etd;
    if (!earliestArrival) return '';
    return calculateSuggestedEtd(earliestArrival);
  }, [order.etd, earliestArrival]);

  const [isEditingEtd, setIsEditingEtd] = useState(false);
  const [editedEtd, setEditedEtd] = useState(suggestedEtd);

  // Update editedEtd when suggestedEtd changes
  useMemo(() => {
    if (!isEditingEtd) {
      setEditedEtd(suggestedEtd);
    }
  }, [suggestedEtd, isEditingEtd]);

  const displayEtd = order.etd || suggestedEtd;
  const canSubmit = order.trader_etd_approved;

  const approveEtdMutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const etdToSave = order.etd || suggestedEtd;
      
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          etd: etdToSave,
          trader_etd_approved: true,
          trader_etd_approved_at: now,
          trader_etd_approved_by: user?.id,
        })
        .eq('id', order.id);

      if (error) throw error;

      await logChange({
        orderId: order.id,
        changeType: 'approval',
        fieldName: 'trader_etd_approved',
        oldValue: 'false',
        newValue: 'true',
        isCritical: false,
      });
    },
    onSuccess: () => {
      toast({ title: 'ETD aprovado!' });
      onOrderUpdated();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao aprovar ETD', description: error.message, variant: 'destructive' });
    },
  });

  const updateEtdMutation = useMutation({
    mutationFn: async () => {
      const oldEtd = order.etd || suggestedEtd;
      
      const { error } = await supabase
        .from('purchase_orders')
        .update({ etd: editedEtd || null })
        .eq('id', order.id);

      if (error) throw error;

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
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background border min-w-[280px]">
            <Checkbox 
              id="etd-approved" 
              checked={order.trader_etd_approved}
              onCheckedChange={() => !order.trader_etd_approved && approveEtdMutation.mutate()}
              disabled={order.trader_etd_approved || approveEtdMutation.isPending || !displayEtd}
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
                        setEditedEtd(displayEtd);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Label htmlFor="etd-approved" className="text-sm cursor-pointer">
                    <span className="font-medium">ETD:</span>{' '}
                    {displayEtd 
                      ? format(new Date(displayEtd + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })
                      : 'Não definido'
                    }
                    {!order.etd && suggestedEtd && (
                      <span className="text-xs text-muted-foreground ml-1">(sugerido)</span>
                    )}
                  </Label>
                )}
              </div>
              {!isEditingEtd && (
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6"
                  onClick={() => {
                    setEditedEtd(displayEtd);
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

          {/* Total Amount Badge */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background border">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              <span className="font-medium">Total Amount:</span>{' '}
              {formatCurrency(totalValue)}
            </span>
          </div>

          {/* Containers Badge */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-background border">
            <Container className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              <span className="font-medium">Containers:</span>{' '}
              {containerInfo}
            </span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Status Badge & Submit Button */}
          <div className="flex items-center gap-3">
            {canSubmit && (
              <Badge className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                ETD aprovado
              </Badge>
            )}
            
            {canSubmit && order.status === 'pending_trader_review' && (
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

        {/* Buyer counter-proposals alert */}
        {pendingCounterProposals.length > 0 && order.status === 'pending_trader_review' && (
          <div className="mt-3 pt-3 border-t">
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
                <Users className="h-4 w-4" />
                Buyer fez {pendingCounterProposals.length} contra-proposta(s)
              </div>
              <div className="mt-2 space-y-1">
                {pendingCounterProposals.map(cp => (
                  <div key={cp.id} className="text-sm text-blue-600 dark:text-blue-400">
                    <span className="font-medium">{cp.field_name === 'etd' ? 'ETD' : cp.field_name}:</span>{' '}
                    Buyer sugere{' '}
                    <span className="font-semibold">
                      {cp.field_name === 'etd' 
                        ? format(new Date(cp.new_value + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })
                        : cp.new_value?.includes('.') ? `$${parseFloat(cp.new_value).toFixed(2)}` : cp.new_value
                      }
                    </span>
                    {buyerEtdSuggestion && cp.field_name === 'etd' && (
                      <Button
                        variant="link"
                        size="sm"
                        className="ml-2 h-auto p-0 text-blue-700 dark:text-blue-300"
                        onClick={() => {
                          setEditedEtd(buyerEtdSuggestion);
                          setIsEditingEtd(true);
                        }}
                      >
                        Usar sugestão
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Warning for critical changes */}
        {pendingApprovalChanges.length > 0 && canSubmit && order.status === 'pending_trader_review' && pendingCounterProposals.length === 0 && (
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