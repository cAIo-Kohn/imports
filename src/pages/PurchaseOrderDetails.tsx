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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Calendar, Package, DollarSign, Building2, Plus, Trash2, FileText, Edit2, Save, X, Eye, EyeOff, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AddOrderItemModal } from '@/components/planning/AddOrderItemModal';
import { PurchaseOrderInvoice } from '@/components/orders/PurchaseOrderInvoice';
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
  const [isEditingShipping, setIsEditingShipping] = useState(false);
  const [showImages, setShowImages] = useState(true);
  
  // Shipping form state
  const [shippingForm, setShippingForm] = useState({
    etd: '',
    crd: '',
    port_origin: '',
    port_destination: '',
    payment_terms: '',
    invoice_number: '',
    notes: '',
  });

  const { data: order, isLoading } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          suppliers (
            id, company_name, country, address, city, state_province, postal_code,
            contact_name, contact_phone, contact_email,
            bank_name, bank_swift, bank_account, bank_address,
            payment_terms
          ),
          purchase_order_items (
            id,
            quantity,
            unit_price_usd,
            expected_arrival,
            products (
              id, code, technical_description, ncm,
              qty_master_box, qty_inner,
              master_box_length, master_box_width, master_box_height,
              master_box_volume, packaging_type, supplier_specs,
              individual_length, individual_width, individual_height,
              image_url, fob_price_usd, origin_description, gross_weight
            ),
            units (id, name, address, city, state, cnpj, zip_code)
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Initialize shipping form when order loads
  useState(() => {
    if (order) {
      setShippingForm({
        etd: order.etd || '',
        crd: order.crd || '',
        port_origin: order.port_origin || '',
        port_destination: order.port_destination || '',
        payment_terms: order.payment_terms || '',
        invoice_number: order.invoice_number || '',
        notes: order.notes || '',
      });
    }
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

  const updateShippingMutation = useMutation({
    mutationFn: async (data: typeof shippingForm) => {
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          etd: data.etd || null,
          crd: data.crd || null,
          port_origin: data.port_origin || null,
          port_destination: data.port_destination || null,
          payment_terms: data.payment_terms || null,
          invoice_number: data.invoice_number || null,
          notes: data.notes || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
      toast({ title: 'Dados de embarque atualizados!' });
      setIsEditingShipping(false);
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar dados', variant: 'destructive' });
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

  const handleEditShipping = () => {
    if (order) {
      setShippingForm({
        etd: order.etd || '',
        crd: order.crd || '',
        port_origin: order.port_origin || '',
        port_destination: order.port_destination || '',
        payment_terms: order.payment_terms || '',
        invoice_number: order.invoice_number || '',
        notes: order.notes || '',
      });
    }
    setIsEditingShipping(true);
  };

  const handlePrint = () => {
    window.print();
  };

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
      <div className="flex items-center justify-between print:hidden">
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
          <Button variant="outline" size="sm" onClick={() => setShowImages(!showImages)}>
            {showImages ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            {showImages ? 'Ocultar Imagens' : 'Mostrar Imagens'}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
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

      <Tabs defaultValue="invoice" className="print:hidden">
        <TabsList>
          <TabsTrigger value="invoice">
            <FileText className="mr-2 h-4 w-4" />
            Invoice Comercial
          </TabsTrigger>
          <TabsTrigger value="shipping">
            <Package className="mr-2 h-4 w-4" />
            Dados de Embarque
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoice" className="mt-4">
          {order.status === 'draft' && (
            <div className="mb-4 flex justify-end">
              <Button onClick={() => setAddItemOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Item
              </Button>
            </div>
          )}
          <PurchaseOrderInvoice order={order as any} showImages={showImages} />
        </TabsContent>

        <TabsContent value="shipping" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Dados de Embarque</CardTitle>
                <CardDescription>
                  Informações de ETD, portos e condições de pagamento
                </CardDescription>
              </div>
              {!isEditingShipping ? (
                <Button variant="outline" size="sm" onClick={handleEditShipping}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsEditingShipping(false)}>
                    <X className="mr-2 h-4 w-4" />
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={() => updateShippingMutation.mutate(shippingForm)}>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isEditingShipping ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Número da Invoice</Label>
                    <Input
                      value={shippingForm.invoice_number}
                      onChange={(e) => setShippingForm(s => ({ ...s, invoice_number: e.target.value }))}
                      placeholder="Ex: INV-2025-001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ETD (Estimated Time of Departure)</Label>
                    <Input
                      type="date"
                      value={shippingForm.etd}
                      onChange={(e) => setShippingForm(s => ({ ...s, etd: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CRD (Cargo Ready Date)</Label>
                    <Input
                      type="date"
                      value={shippingForm.crd}
                      onChange={(e) => setShippingForm(s => ({ ...s, crd: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Porto de Origem</Label>
                    <Input
                      value={shippingForm.port_origin}
                      onChange={(e) => setShippingForm(s => ({ ...s, port_origin: e.target.value }))}
                      placeholder="Ex: QINGDAO, CHINA"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Porto de Destino</Label>
                    <Input
                      value={shippingForm.port_destination}
                      onChange={(e) => setShippingForm(s => ({ ...s, port_destination: e.target.value }))}
                      placeholder="Ex: RIO GRANDE, BRAZIL"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Condições de Pagamento</Label>
                    <Input
                      value={shippingForm.payment_terms}
                      onChange={(e) => setShippingForm(s => ({ ...s, payment_terms: e.target.value }))}
                      placeholder="Ex: 100% T/T AFTER RECEIVED SHIPPING DOCUMENTS"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Observações / Remarks</Label>
                    <Textarea
                      value={shippingForm.notes}
                      onChange={(e) => setShippingForm(s => ({ ...s, notes: e.target.value }))}
                      placeholder="Observações sobre o pedido..."
                      rows={4}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Número da Invoice</p>
                    <p className="font-medium">{order.invoice_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">ETD</p>
                    <p className="font-medium">
                      {order.etd ? format(new Date(order.etd), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CRD</p>
                    <p className="font-medium">
                      {order.crd ? format(new Date(order.crd), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Porto de Origem</p>
                    <p className="font-medium">{order.port_origin || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Porto de Destino</p>
                    <p className="font-medium">{order.port_destination || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Condições de Pagamento</p>
                    <p className="font-medium">{order.payment_terms || order.suppliers?.payment_terms || '-'}</p>
                  </div>
                  {order.notes && (
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">Observações</p>
                      <p className="font-medium whitespace-pre-wrap">{order.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
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
        </TabsContent>
      </Tabs>

      {/* Print View - Shows invoice directly */}
      <div className="hidden print:block">
        <PurchaseOrderInvoice order={order as any} showImages={showImages} />
      </div>

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
