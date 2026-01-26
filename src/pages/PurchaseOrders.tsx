import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Search, FileText, Container, DollarSign, Calendar, Truck, Clock, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';
import { CreatePurchaseOrderModal } from '@/components/planning/CreatePurchaseOrderModal';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { extractContainerInfo } from '@/lib/utils';

interface PurchaseOrder {
  id: string;
  order_number: string;
  reference_number: string | null;
  order_date: string;
  etd: string | null;
  status: string;
  notes: string | null;
  total_value_usd: number | null;
  created_at: string;
  suppliers: {
    company_name: string;
  };
  purchase_order_items: {
    id: string;
    quantity: number;
  }[];
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon?: typeof Clock }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  pending_trader_review: { label: 'Aguard. Trader', variant: 'outline', icon: Clock },
  pending_buyer_approval: { label: 'Mudanças Pendentes', variant: 'outline', icon: AlertTriangle },
  confirmed: { label: 'Confirmado', variant: 'default', icon: CheckCircle },
  shipped: { label: 'Embarcado', variant: 'outline', icon: Truck },
  received: { label: 'Recebido', variant: 'default', icon: Container },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin, isTrader, canManageOrders } = useUserRole();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // Primeiro deletar os itens do pedido
      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .delete()
        .eq('purchase_order_id', orderId);
      
      if (itemsError) throw itemsError;

      // Deletar histórico de alterações
      const { error: historyError } = await supabase
        .from('purchase_order_change_history')
        .delete()
        .eq('purchase_order_id', orderId);
      
      if (historyError) throw historyError;

      // Deletar o pedido
      const { error: orderError } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', orderId);
      
      if (orderError) throw orderError;
    },
    onSuccess: () => {
      toast({
        title: 'Pedido excluído',
        description: 'O pedido foi removido com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['purchase-orders', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('purchase_orders')
        .select(`
          id,
          order_number,
          reference_number,
          order_date,
          etd,
          status,
          notes,
          total_value_usd,
          created_at,
          suppliers (company_name),
          purchase_order_items (id, quantity)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PurchaseOrder[];
    },
  });

  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.order_number.toLowerCase().includes(query) ||
      (order.reference_number && order.reference_number.toLowerCase().includes(query)) ||
      order.suppliers.company_name.toLowerCase().includes(query)
    );
  });

  const stats = {
    total: orders.length,
    draft: orders.filter(o => o.status === 'draft').length,
    pendingTrader: orders.filter(o => o.status === 'pending_trader_review').length,
    pendingBuyer: orders.filter(o => o.status === 'pending_buyer_approval').length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    totalValue: orders.reduce((sum, o) => sum + (o.total_value_usd || 0), 0),
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pedidos de Compra</h1>
          <p className="text-muted-foreground">
            Gerencie seus pedidos de importação
          </p>
        </div>
        {canManageOrders && (
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Pedido
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">pedidos registrados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguard. Trader</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingTrader}</div>
            <p className="text-xs text-muted-foreground">aguardando aprovação</p>
          </CardContent>
        </Card>
        <Card className={stats.pendingBuyer > 0 ? "border-yellow-500/50 bg-yellow-500/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mudanças Pendentes</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${stats.pendingBuyer > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingBuyer}</div>
            <p className="text-xs text-muted-foreground">requerem aprovação</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">FOB USD</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número ou fornecedor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="pending_trader_review">Aguard. Trader</SelectItem>
                <SelectItem value="pending_buyer_approval">Mudanças Pendentes</SelectItem>
                <SelectItem value="confirmed">Confirmado</SelectItem>
                <SelectItem value="shipped">Embarcado</SelectItem>
                <SelectItem value="received">Recebido</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Pedidos</CardTitle>
          <CardDescription>
            Clique em um pedido para ver os detalhes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>ETD</TableHead>
                <TableHead>Containers</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-muted-foreground">
                    {orders.length === 0 
                      ? 'Nenhum pedido de compra registrado. Crie o primeiro!'
                      : 'Nenhum pedido encontrado com os filtros aplicados.'
                    }
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow 
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/purchase-orders/${order.id}`)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{order.reference_number || order.order_number}</span>
                        {order.reference_number && (
                          <span className="text-xs text-muted-foreground">{order.order_number}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{order.suppliers.company_name}</TableCell>
                    <TableCell>
                      {order.etd 
                        ? format(new Date(order.etd + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="max-w-[150px]">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm line-clamp-1 cursor-help block">
                              {extractContainerInfo(order.notes)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-sm">
                            <p className="text-sm whitespace-pre-wrap">
                              {extractContainerInfo(order.notes)}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      {order.total_value_usd 
                        ? `$${order.total_value_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={STATUS_CONFIG[order.status]?.variant || 'secondary'}
                        className={order.status === 'pending_buyer_approval' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : ''}
                      >
                        {STATUS_CONFIG[order.status]?.icon && (
                          <span className="mr-1">
                            {order.status === 'pending_trader_review' && <Clock className="h-3 w-3 inline" />}
                            {order.status === 'pending_buyer_approval' && <AlertTriangle className="h-3 w-3 inline" />}
                            {order.status === 'confirmed' && <CheckCircle className="h-3 w-3 inline" />}
                          </span>
                        )}
                        {STATUS_CONFIG[order.status]?.label || order.status}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir pedido {order.order_number}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. O pedido e todos os seus itens serão permanentemente removidos.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteOrderMutation.mutate(order.id)}
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Modal */}
      <CreatePurchaseOrderModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
        }}
      />
    </div>
  );
}
