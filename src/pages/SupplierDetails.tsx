import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Pencil, 
  Plus, 
  Link2, 
  Unlink, 
  Package, 
  Globe, 
  Mail, 
  Phone, 
  MapPin,
  Building2,
  CreditCard,
  FileText,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { EditSupplierModal } from '@/components/suppliers/EditSupplierModal';
import { LinkProductsModal } from '@/components/suppliers/LinkProductsModal';
import { EditProductModal } from '@/components/products/EditProductModal';
import { CreateProductModal } from '@/components/products/CreateProductModal';
import { toast } from 'sonner';

interface Supplier {
  id: string;
  company_name: string;
  trade_name: string | null;
  country: string;
  city: string | null;
  state_province: string | null;
  address: string | null;
  postal_code: string | null;
  tax_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  payment_terms: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  container_20_cbm: number | null;
  container_40_cbm: number | null;
  container_40hq_cbm: number | null;
}

interface Product {
  id: string;
  code: string;
  technical_description: string;
  ncm: string | null;
  warehouse_status: string | null;
  fob_price_usd: number | null;
  is_active: boolean;
}

export default function SupplierDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [editSupplierOpen, setEditSupplierOpen] = useState(false);
  const [linkProductsOpen, setLinkProductsOpen] = useState(false);
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [editProductOpen, setEditProductOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Fetch supplier data
  const { data: supplier, isLoading: loadingSupplier, error: supplierError } = useQuery({
    queryKey: ['supplier', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Supplier;
    },
    enabled: !!id,
  });

  // Fetch products linked to this supplier
  const { data: products, isLoading: loadingProducts, refetch: refetchProducts } = useQuery({
    queryKey: ['supplier-products', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, code, technical_description, ncm, warehouse_status, fob_price_usd, is_active')
        .eq('supplier_id', id)
        .order('code', { ascending: true });
      
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!id,
  });

  const handleUnlinkProduct = async (productId: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ supplier_id: null })
        .eq('id', productId);

      if (error) throw error;

      toast.success('Produto desvinculado com sucesso!');
      refetchProducts();
      queryClient.invalidateQueries({ queryKey: ['supplier-product-counts'] });
    } catch (error: any) {
      console.error('Erro ao desvincular produto:', error);
      toast.error('Erro ao desvincular produto: ' + error.message);
    }
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setEditProductOpen(true);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['supplier', id] });
    refetchProducts();
    queryClient.invalidateQueries({ queryKey: ['supplier-product-counts'] });
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'DISPONÍVEL': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'INATIVO': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      case 'EM COMPRA': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'EM TRÂNSITO': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  if (loadingSupplier) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (supplierError || !supplier) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/suppliers')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Fornecedor não encontrado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/suppliers')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {supplier.trade_name || supplier.company_name}
              </h1>
              <Badge variant={supplier.is_active ? 'default' : 'secondary'}>
                {supplier.is_active ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            {supplier.trade_name && (
              <p className="text-muted-foreground">{supplier.company_name}</p>
            )}
          </div>
        </div>
        <Button onClick={() => setEditSupplierOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar Fornecedor
        </Button>
      </div>

      {/* Supplier Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Location */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Localização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Badge variant="outline" className="font-normal mb-2">{supplier.country}</Badge>
            </div>
            {supplier.address && <p className="text-sm">{supplier.address}</p>}
            {(supplier.city || supplier.state_province) && (
              <p className="text-sm text-muted-foreground">
                {[supplier.city, supplier.state_province].filter(Boolean).join(', ')}
              </p>
            )}
            {supplier.postal_code && (
              <p className="text-sm text-muted-foreground">CEP: {supplier.postal_code}</p>
            )}
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Contato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {supplier.contact_name && (
              <p className="text-sm font-medium">{supplier.contact_name}</p>
            )}
            {supplier.contact_email && (
              <a 
                href={`mailto:${supplier.contact_email}`}
                className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                <Mail className="h-3 w-3" />
                {supplier.contact_email}
              </a>
            )}
            {supplier.contact_phone && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {supplier.contact_phone}
              </p>
            )}
            {supplier.website && (
              <a 
                href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <Globe className="h-3 w-3" />
                Website
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {!supplier.contact_name && !supplier.contact_email && !supplier.contact_phone && !supplier.website && (
              <p className="text-sm text-muted-foreground italic">Sem informações de contato</p>
            )}
          </CardContent>
        </Card>

        {/* Additional Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Informações Adicionais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {supplier.tax_id && (
              <div>
                <p className="text-xs text-muted-foreground">Tax ID</p>
                <p className="text-sm">{supplier.tax_id}</p>
              </div>
            )}
            {supplier.payment_terms && (
              <div>
                <p className="text-xs text-muted-foreground">Condições de Pagamento</p>
                <p className="text-sm">{supplier.payment_terms}</p>
              </div>
            )}
            {supplier.notes && (
              <div>
                <p className="text-xs text-muted-foreground">Observações</p>
                <p className="text-sm">{supplier.notes}</p>
              </div>
            )}
            {!supplier.tax_id && !supplier.payment_terms && !supplier.notes && (
              <p className="text-sm text-muted-foreground italic">Sem informações adicionais</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Products Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Produtos Vinculados
              </CardTitle>
              <CardDescription>
                {products?.length || 0} produto(s) vinculado(s) a este fornecedor
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setLinkProductsOpen(true)}>
                <Link2 className="mr-2 h-4 w-4" />
                Vincular Existente
              </Button>
              <Button onClick={() => setCreateProductOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Produto
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingProducts ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : products && products.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>NCM</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Preço FOB</TableHead>
                    <TableHead className="w-32 text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Link 
                          to={`/products/${product.id}`}
                          className="font-mono text-sm text-primary hover:underline"
                        >
                          {product.code}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {product.technical_description}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {product.ncm || '-'}
                      </TableCell>
                      <TableCell>
                        {product.warehouse_status ? (
                          <Badge className={getStatusColor(product.warehouse_status)} variant="secondary">
                            {product.warehouse_status}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(product.fob_price_usd)}
                      </TableCell>
                      <TableCell className="text-center">
                        <TooltipProvider>
                          <div className="flex justify-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEditProduct(product)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Editar produto</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleUnlinkProduct(product.id)}
                                >
                                  <Unlink className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Desvincular produto</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">Nenhum produto vinculado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Vincule produtos existentes ou crie novos para este fornecedor
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setLinkProductsOpen(true)}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Vincular Existente
                </Button>
                <Button onClick={() => setCreateProductOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Produto
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timestamps */}
      <div className="text-xs text-muted-foreground flex gap-4">
        <span>Criado em: {new Date(supplier.created_at).toLocaleString('pt-BR')}</span>
        <span>Atualizado em: {new Date(supplier.updated_at).toLocaleString('pt-BR')}</span>
      </div>

      {/* Modals */}
      <EditSupplierModal
        open={editSupplierOpen}
        onOpenChange={setEditSupplierOpen}
        supplier={supplier}
        onSuccess={handleSuccess}
      />

      <LinkProductsModal
        open={linkProductsOpen}
        onOpenChange={setLinkProductsOpen}
        supplierId={supplier.id}
        onSuccess={handleSuccess}
      />

      <CreateProductModal
        open={createProductOpen}
        onOpenChange={setCreateProductOpen}
        onSuccess={handleSuccess}
        defaultSupplierId={supplier.id}
      />

      {selectedProduct && (
        <EditProductModal
          open={editProductOpen}
          onOpenChange={setEditProductOpen}
          product={selectedProduct}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
