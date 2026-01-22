import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Calendar, Truck, Package, DollarSign, Building2, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AddOrderItemModal } from '@/components/planning/AddOrderItemModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  confirmed: { label: 'Confirmado', variant: 'default' },
  shipped: { label: 'Embarcado', variant: 'outline' },
  received: { label: 'Recebido', variant: 'default' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

export default function PurchaseOrderDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          suppliers (id, company_name, country, contact_email),
          purchase_order_items (
            id,
            quantity,
            unit_price_usd,
            expected_arrival,
            products (id, code, technical_description, lead_time_days, fob_price_usd),
            units (id, name)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: newStatus })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
      toast({ title: 'Status atualizado com sucesso!' });
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('purchase_order_items')
        .delete()
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
      toast({ title: 'Item removido com sucesso!' });
      setDeleteItemId(null);
    },
    onError: () => {
      toast({ title: 'Erro ao remover item', variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">Pedido não encontrado</p>
        <Button onClick={() => navigate('/purchase-orders')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Pedidos
        </Button>
      </div>
    );
  }

  const items = order.purchase_order_items || [];
  const totalQuantity = items.reduce((sum: number, item: any) => sum + item.quantity, 0);
  const totalValue = items.reduce((sum: number, item: any) => sum + (item.quantity * (item.unit_price_usd || 0)), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/purchase-orders')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{order.order_number}</h1>
              <Badge variant={STATUS_CONFIG[order.status]?.variant || 'secondary'}>
                {STATUS_CONFIG[order.status]?.label || order.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">{order.suppliers?.company_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={order.status} onValueChange={(v) => updateStatusMutation.mutate(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="confirmed">Confirmado</SelectItem>
              <SelectItem value="shipped">Embarcado</SelectItem>
              <SelectItem value="received">Recebido</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fornecedor</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-medium">{order.suppliers?.company_name}</div>
            <p className="text-sm text-muted-foreground">{order.suppliers?.country}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data do Pedido</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-medium">
              {format(new Date(order.order_date), 'dd/MM/yyyy', { locale: ptBR })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quantidade Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-medium">{totalQuantity.toLocaleString('pt-BR')} un</div>
            <p className="text-sm text-muted-foreground">{items.length} itens</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total FOB</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-medium">
              ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Itens do Pedido</CardTitle>
            <CardDescription>Produtos incluídos neste pedido de compra</CardDescription>
          </div>
          {order.status === 'draft' && (
            <Button onClick={() => setAddItemOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Item
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Unidade Destino</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="text-right">Preço Unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Chegada Prev.</TableHead>
                {order.status === 'draft' && <TableHead className="w-[50px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum item adicionado. Adicione produtos a este pedido.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.products?.code}</TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      {item.products?.technical_description}
                    </TableCell>
                    <TableCell>{item.units?.name}</TableCell>
                    <TableCell className="text-right">
                      {item.quantity.toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.unit_price_usd 
                        ? `$${item.unit_price_usd.toLocaleString('en-US', { minimumFractionDigits: 4 })}`
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      {item.unit_price_usd 
                        ? `$${(item.quantity * item.unit_price_usd).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      {item.expected_arrival 
                        ? format(new Date(item.expected_arrival), 'dd/MM/yyyy', { locale: ptBR })
                        : '-'
                      }
                    </TableCell>
                    {order.status === 'draft' && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteItemId(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Notes */}
      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Add Item Modal */}
      <AddOrderItemModal
        open={addItemOpen}
        onOpenChange={setAddItemOpen}
        orderId={order.id}
        orderDate={order.order_date}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este item do pedido? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteItemId && deleteItemMutation.mutate(deleteItemId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
