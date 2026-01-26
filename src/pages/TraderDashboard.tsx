import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUserRole } from '@/hooks/useUserRole';
import { Clock, Package, CheckCircle, AlertTriangle, ExternalLink, Factory } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function TraderDashboard() {
  const navigate = useNavigate();
  const { isTrader, isAdmin, isLoading: rolesLoading } = useUserRole();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['trader-pending-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          suppliers (
            id,
            company_name,
            country
          ),
          purchase_order_items (
            id,
            quantity,
            unit_price_usd
          )
        `)
        .eq('status', 'pending_trader_review')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter only Chinese suppliers
      return (data || []).filter(
        (order) => order.suppliers?.country?.toLowerCase() === 'china'
      );
    },
    enabled: isTrader || isAdmin,
  });

  const stats = {
    total: orders.length,
    withEtd: orders.filter((o) => o.etd).length,
    withoutEtd: orders.filter((o) => !o.etd).length,
  };

  const calculateOrderTotal = (items: any[]) => {
    return items?.reduce((sum, item) => sum + (item.quantity * (item.unit_price_usd || 0)), 0) || 0;
  };

  const calculateTotalQty = (items: any[]) => {
    return items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
  };

  if (rolesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isTrader && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold">Acesso Restrito</h2>
        <p className="text-muted-foreground">
          Esta página é exclusiva para traders.
        </p>
        <Button onClick={() => navigate('/')}>Voltar ao Início</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Factory className="h-8 w-8 text-primary" />
          Painel do Trader
        </h1>
        <p className="text-muted-foreground">
          Pedidos de fornecedores chineses aguardando sua revisão e aprovação
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Pendentes</CardTitle>
            <Clock className="h-5 w-5 text-yellow-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.total}</div>
            )}
            <p className="text-xs text-muted-foreground">aguardando revisão</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com ETD Definido</CardTitle>
            <CheckCircle className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.withEtd}</div>
            )}
            <p className="text-xs text-muted-foreground">prontos para aprovar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sem ETD</CardTitle>
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.withoutEtd}</div>
            )}
            <p className="text-xs text-muted-foreground">precisam de data</p>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pedidos Aguardando Aprovação
          </CardTitle>
          <CardDescription>
            Clique em um pedido para revisar, editar e aprovar ETD, preços e quantidades
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold">Nenhum pedido pendente</h3>
              <p className="text-muted-foreground">
                Todos os pedidos de fornecedores chineses foram revisados
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Data Criação</TableHead>
                  <TableHead>ETD</TableHead>
                  <TableHead className="text-right">Itens</TableHead>
                  <TableHead className="text-right">Qtd Total</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/purchase-orders/${order.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {order.order_number}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{order.suppliers?.company_name}</div>
                      <div className="text-xs text-muted-foreground">
                        🇨🇳 China
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {order.etd ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {format(new Date(order.etd), 'dd/MM/yyyy', { locale: ptBR })}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                          Não definido
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {order.purchase_order_items?.length || 0}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {calculateTotalQty(order.purchase_order_items).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${calculateOrderTotal(order.purchase_order_items).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
