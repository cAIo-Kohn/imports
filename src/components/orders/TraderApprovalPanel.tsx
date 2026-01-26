import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrderChanges } from '@/hooks/useOrderChanges';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, Clock, AlertTriangle, Send, Calendar } from 'lucide-react';

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

interface TraderApprovalPanelProps {
  order: PurchaseOrder;
  totalQuantity: number;
  onOrderUpdated: () => void;
}

export function TraderApprovalPanel({ order, totalQuantity, onOrderUpdated }: TraderApprovalPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logChange, pendingApprovalChanges } = useOrderChanges(order.id);

  const [etdChangeOpen, setEtdChangeOpen] = useState(false);
  const [newEtd, setNewEtd] = useState('');
  const [etdReason, setEtdReason] = useState('');

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

      // Log the approval
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

  const requestEtdChangeMutation = useMutation({
    mutationFn: async () => {
      const oldEtd = order.etd;
      
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          etd: newEtd,
          requires_buyer_approval: true,
          buyer_approval_notes: `ETD alterado de ${oldEtd || 'não definido'} para ${newEtd}. Motivo: ${etdReason}`,
          status: 'pending_buyer_approval',
        })
        .eq('id', order.id);

      if (error) throw error;

      // Log the critical change
      await logChange({
        orderId: order.id,
        changeType: 'order_field',
        fieldName: 'etd',
        oldValue: oldEtd,
        newValue: newEtd,
        isCritical: true,
      });
    },
    onSuccess: () => {
      toast({ title: 'Solicitação de alteração de ETD enviada!' });
      setEtdChangeOpen(false);
      setNewEtd('');
      setEtdReason('');
      onOrderUpdated();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao solicitar alteração', description: error.message, variant: 'destructive' });
    },
  });

  const submitForApprovalMutation = useMutation({
    mutationFn: async () => {
      // Check if there are pending critical changes
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
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  return (
    <>
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Aprovação do Pedido
              </CardTitle>
              <CardDescription>
                Revise e aprove os itens abaixo para confirmar o pedido
              </CardDescription>
            </div>
            {allApproved && (
              <Badge className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Todas aprovações concluídas
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ETD Approval */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-background border">
            <div className="flex items-center gap-3">
              <Checkbox 
                id="etd-approved" 
                checked={order.trader_etd_approved}
                disabled={order.trader_etd_approved}
              />
              <div>
                <Label htmlFor="etd-approved" className="text-sm font-medium">
                  ETD (Data Estimada de Embarque)
                </Label>
                <p className="text-sm text-muted-foreground">
                  {order.etd 
                    ? format(new Date(order.etd), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : 'Não definido'
                  }
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {order.trader_etd_approved ? (
                <Badge variant="outline" className="text-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Aprovado
                </Badge>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setEtdChangeOpen(true)}
                  >
                    <Calendar className="h-4 w-4 mr-1" />
                    Solicitar Mudança
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => approveFieldMutation.mutate('etd')}
                    disabled={approveFieldMutation.isPending}
                  >
                    Aprovar ETD
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Prices Approval */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-background border">
            <div className="flex items-center gap-3">
              <Checkbox 
                id="prices-approved" 
                checked={order.trader_prices_approved}
                disabled={order.trader_prices_approved}
              />
              <div>
                <Label htmlFor="prices-approved" className="text-sm font-medium">
                  Preço Total FOB
                </Label>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(order.total_value_usd)}
                </p>
              </div>
            </div>
            {order.trader_prices_approved ? (
              <Badge variant="outline" className="text-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Aprovado
              </Badge>
            ) : (
              <Button 
                size="sm"
                onClick={() => approveFieldMutation.mutate('prices')}
                disabled={approveFieldMutation.isPending}
              >
                Aprovar Preços
              </Button>
            )}
          </div>

          {/* Quantities Approval */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-background border">
            <div className="flex items-center gap-3">
              <Checkbox 
                id="quantities-approved" 
                checked={order.trader_quantities_approved}
                disabled={order.trader_quantities_approved}
              />
              <div>
                <Label htmlFor="quantities-approved" className="text-sm font-medium">
                  Quantidade Total
                </Label>
                <p className="text-sm text-muted-foreground">
                  {totalQuantity.toLocaleString('pt-BR')} peças
                </p>
              </div>
            </div>
            {order.trader_quantities_approved ? (
              <Badge variant="outline" className="text-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Aprovado
              </Badge>
            ) : (
              <Button 
                size="sm"
                onClick={() => approveFieldMutation.mutate('quantities')}
                disabled={approveFieldMutation.isPending}
              >
                Aprovar Quantidades
              </Button>
            )}
          </div>

          {/* Submit Button */}
          {allApproved && order.status === 'pending_trader_review' && (
            <div className="pt-2 border-t">
              <Button 
                className="w-full"
                onClick={() => submitForApprovalMutation.mutate()}
                disabled={submitForApprovalMutation.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                {pendingApprovalChanges.length > 0 
                  ? 'Enviar para Aprovação Final' 
                  : 'Confirmar Pedido'
                }
              </Button>
              {pendingApprovalChanges.length > 0 && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  Há {pendingApprovalChanges.length} alteração(ões) crítica(s) que precisam de aprovação
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ETD Change Request Dialog */}
      <Dialog open={etdChangeOpen} onOpenChange={setEtdChangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Mudança de ETD</DialogTitle>
            <DialogDescription>
              Informe a nova data e o motivo da alteração. A equipe Brasil precisará aprovar essa mudança.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-etd">Nova Data de ETD</Label>
              <Input
                id="new-etd"
                type="date"
                value={newEtd}
                onChange={(e) => setNewEtd(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="etd-reason">Motivo da Alteração</Label>
              <Textarea
                id="etd-reason"
                value={etdReason}
                onChange={(e) => setEtdReason(e.target.value)}
                placeholder="Ex: Fábrica em manutenção, atraso na produção..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEtdChangeOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => requestEtdChangeMutation.mutate()}
              disabled={!newEtd || !etdReason || requestEtdChangeMutation.isPending}
            >
              Enviar Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
