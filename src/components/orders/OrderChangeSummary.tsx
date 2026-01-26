import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrderChanges, ConsolidatedChange } from '@/hooks/useOrderChanges';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Info, CheckCircle, ArrowRight, History, MessageSquare, RotateCcw, Loader2 } from 'lucide-react';
import { CounterProposalForm } from './CounterProposalForm';
import { NegotiationTimeline } from './NegotiationTimeline';

interface OrderChangeSummaryProps {
  orderId: string;
  onChangesApproved?: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  etd: 'ETD (Data de Embarque)',
  unit_price_usd: 'Preço Unitário',
  quantity: 'Quantidade',
  total_value_usd: 'Valor Total',
  technical_description: 'Descrição Técnica',
  master_box_volume: 'Cubagem',
  ncm: 'NCM',
  fob_price_usd: 'Preço FOB',
};

export function OrderChangeSummary({ orderId, onChangesApproved }: OrderChangeSummaryProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { 
    consolidatedCriticalChanges,
    informationalChanges,
    isLoading,
    approveChange,
    logCounterProposal,
    isLoggingCounterProposal,
  } = useOrderChanges(orderId);

  const [counterProposalFor, setCounterProposalFor] = useState<string | null>(null);
  const [hasCounterProposals, setHasCounterProposals] = useState(false);

  // Auto-confirm order if all consolidated changes are agreed or approved
  useEffect(() => {
    const allResolved = consolidatedCriticalChanges.length > 0 && 
      consolidatedCriticalChanges.every(c => c.isAgreed || !c.needsApproval);
    
    if (allResolved && consolidatedCriticalChanges.some(c => c.isAgreed)) {
      // Auto-confirm the order silently
      const autoConfirm = async () => {
        const { error } = await supabase
          .from('purchase_orders')
          .update({
            status: 'confirmed',
            requires_buyer_approval: false,
          })
          .eq('id', orderId);
        
        if (!error) {
          queryClient.invalidateQueries({ queryKey: ['purchase-order', orderId] });
          onChangesApproved?.();
        }
      };
      autoConfirm();
    }
  }, [consolidatedCriticalChanges, orderId, queryClient, onChangesApproved]);

  const approveConsolidatedMutation = useMutation({
    mutationFn: async (consolidated: ConsolidatedChange) => {
      // Approve all pending changes in the timeline
      for (const change of consolidated.timeline) {
        if (change.requires_approval && !change.approved_by) {
          await approveChange(change.id);
        }
      }
    },
    onSuccess: () => {
      toast({ title: 'Alteração aprovada!' });
      queryClient.invalidateQueries({ queryKey: ['order-changes', orderId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao aprovar', description: error.message, variant: 'destructive' });
    },
  });

  const approveAllMutation = useMutation({
    mutationFn: async () => {
      // Approve all pending changes from all consolidated entries
      for (const consolidated of consolidatedCriticalChanges) {
        for (const change of consolidated.timeline) {
          if (change.requires_approval && !change.approved_by) {
            await approveChange(change.id);
          }
        }
      }
      
      // Update order status to confirmed
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'confirmed',
          requires_buyer_approval: false,
        })
        .eq('id', orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Todas as alterações aprovadas! Pedido confirmado.' });
      queryClient.invalidateQueries({ queryKey: ['purchase-order', orderId] });
      onChangesApproved?.();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao aprovar alterações', description: error.message, variant: 'destructive' });
    },
  });

  const returnToTraderMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ 
          status: 'pending_trader_review',
          requires_buyer_approval: false,
          // Reset trader approvals to force review
          trader_etd_approved: false,
          trader_prices_approved: false,
          trader_quantities_approved: false,
        })
        .eq('id', orderId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Pedido devolvido ao trader com suas sugestões!' });
      queryClient.invalidateQueries({ queryKey: ['purchase-order', orderId] });
      onChangesApproved?.();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao devolver ao trader', description: error.message, variant: 'destructive' });
    },
  });

  const handleCounterProposal = async (consolidated: ConsolidatedChange, suggestedValue: string, justification: string) => {
    await logCounterProposal({
      orderId,
      itemId: consolidated.itemId || undefined,
      fieldName: consolidated.fieldName,
      traderValue: consolidated.currentValue,
      suggestedValue,
      justification,
    });
    setCounterProposalFor(null);
    setHasCounterProposals(true);
    toast({ title: 'Contra-proposta registrada!' });
  };

  if (isLoading) {
    return null;
  }

  const hasChanges = consolidatedCriticalChanges.length > 0 || informationalChanges.length > 0;

  if (!hasChanges) {
    return null;
  }

  const formatFieldLabel = (fieldName: string) => {
    return FIELD_LABELS[fieldName] || fieldName;
  };

  const formatValue = (fieldName: string, value: string | null) => {
    if (!value) return 'não definido';
    
    if (fieldName === 'etd' || fieldName.includes('date')) {
      try {
        return format(new Date(value), "dd/MM/yyyy", { locale: ptBR });
      } catch {
        return value;
      }
    }
    
    if (fieldName.includes('price') || fieldName.includes('value')) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      }
    }
    
    return value;
  };

  // Count pending approvals by consolidated field (not individual changes)
  const pendingConsolidatedCount = consolidatedCriticalChanges.filter(c => c.needsApproval).length;

  const renderConsolidatedChange = (consolidated: ConsolidatedChange) => {
    return (
      <div 
        key={consolidated.key} 
        className="py-3 px-4 rounded-lg bg-muted/50 space-y-2"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <span className="font-medium text-sm">
              {formatFieldLabel(consolidated.fieldName)}
              {consolidated.productCode && (
                <span className="text-muted-foreground font-normal ml-1">
                  - Produto {consolidated.productCode}
                </span>
              )}
            </span>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="line-through">{formatValue(consolidated.fieldName, consolidated.originalValue)}</span>
              <ArrowRight className="h-3 w-3" />
              <span className="text-foreground font-medium">{formatValue(consolidated.fieldName, consolidated.currentValue)}</span>
            </div>
          </div>
          
          {consolidated.isAgreed ? (
            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
              <CheckCircle className="h-3 w-3 mr-1" />
              Acordo
            </Badge>
          ) : consolidated.needsApproval ? (
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                className="h-8"
                onClick={() => approveConsolidatedMutation.mutate(consolidated)}
                disabled={approveConsolidatedMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Aprovar
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                className="h-8"
                onClick={() => setCounterProposalFor(consolidated.key)}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                Sugerir
              </Button>
            </div>
          ) : (
            <Badge variant="outline" className="text-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Aprovado
            </Badge>
          )}
        </div>

        {/* Always show negotiation timeline inside the card */}
        {consolidated.timeline.length > 0 && (
          <NegotiationTimeline 
            changes={consolidated.timeline} 
            fieldName={consolidated.fieldName}
            isAgreed={consolidated.isAgreed}
          />
        )}

        {/* Counter-proposal form */}
        {counterProposalFor === consolidated.key && (
          <CounterProposalForm
            fieldName={consolidated.fieldName}
            currentValue={consolidated.currentValue}
            onSubmit={(value, justification) => handleCounterProposal(consolidated, value, justification)}
            onCancel={() => setCounterProposalFor(null)}
            isSubmitting={isLoggingCounterProposal}
          />
        )}
      </div>
    );
  };

  const showReturnButton = hasCounterProposals || consolidatedCriticalChanges.some(c => c.hasCounterProposal);

  return (
    <Card className={pendingConsolidatedCount > 0 ? "border-yellow-500/50" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Alterações do Trader</CardTitle>
          </div>
          {pendingConsolidatedCount > 0 && (
            <Badge variant="outline" className="border-yellow-500 text-yellow-700">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {pendingConsolidatedCount} campo(s) pendente(s)
            </Badge>
          )}
        </div>
        <CardDescription>
          Resumo das alterações realizadas pelo trader na China
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Consolidated Critical Changes */}
        {consolidatedCriticalChanges.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span>Alterações Críticas</span>
              <span className="text-muted-foreground font-normal">(requerem aprovação)</span>
            </div>
            <div className="space-y-2">
              {consolidatedCriticalChanges.map(consolidated => renderConsolidatedChange(consolidated))}
            </div>
          </div>
        )}

        {/* Informational Changes */}
        {informationalChanges.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Info className="h-4 w-4 text-primary" />
              <span>Alterações Informativas</span>
            </div>
            <div className="space-y-2">
              {informationalChanges.map(change => (
                <div 
                  key={change.id} 
                  className="py-2 px-3 rounded-lg bg-muted/30 text-sm"
                >
                  <span className="font-medium">{formatFieldLabel(change.field_name)}</span>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="line-through">{formatValue(change.field_name, change.old_value)}</span>
                    <ArrowRight className="h-3 w-3" />
                    <span className="text-foreground">{formatValue(change.field_name, change.new_value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {pendingConsolidatedCount > 0 && (
          <div className="pt-3 border-t space-y-2">
            {showReturnButton ? (
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  className="flex-1"
                  onClick={() => returnToTraderMutation.mutate()}
                  disabled={returnToTraderMutation.isPending}
                >
                  {returnToTraderMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-2" />
                  )}
                  Devolver ao Trader com Contra-propostas
                </Button>
                <Button 
                  className="flex-1"
                  onClick={() => approveAllMutation.mutate()}
                  disabled={approveAllMutation.isPending}
                >
                  {approveAllMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Aprovar Todas
                </Button>
              </div>
            ) : (
              <Button 
                className="w-full"
                onClick={() => approveAllMutation.mutate()}
                disabled={approveAllMutation.isPending}
              >
                {approveAllMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Aprovar Todas as Alterações e Confirmar Pedido
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
