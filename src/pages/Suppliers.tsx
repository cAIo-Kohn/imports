import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Factory, Trash2, Globe, Mail, Phone, Package } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { CreateSupplierModal } from '@/components/suppliers/CreateSupplierModal';
import { DeleteSupplierDialog } from '@/components/suppliers/DeleteSupplierDialog';

interface Supplier {
  id: string;
  company_name: string;
  trade_name: string | null;
  country: string;
  city: string | null;
  state_province: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  is_active: boolean;
  created_at: string;
}

export default function Suppliers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<{ id: string; company_name: string; trade_name: string | null } | null>(null);

  const { data: suppliers, isLoading, refetch } = useQuery({
    queryKey: ['suppliers', search],
    queryFn: async () => {
      let query = supabase
        .from('suppliers')
        .select('id, company_name, trade_name, country, city, state_province, contact_name, contact_email, contact_phone, website, is_active, created_at')
        .order('company_name', { ascending: true });

      if (search) {
        query = query.or(`company_name.ilike.%${search}%,trade_name.ilike.%${search}%,country.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Supplier[];
    }
  });

  // Fetch product counts per supplier
  const { data: productCounts } = useQuery({
    queryKey: ['supplier-product-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('supplier_id')
        .not('supplier_id', 'is', null);
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      for (const p of data || []) {
        if (p.supplier_id) {
          counts[p.supplier_id] = (counts[p.supplier_id] || 0) + 1;
        }
      }
      return counts;
    }
  });

  const linkedProductsCount = supplierToDelete ? (productCounts?.[supplierToDelete.id] || 0) : 0;

  const handleSuccess = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['dashboard-suppliers-count'] });
    queryClient.invalidateQueries({ queryKey: ['supplier-product-counts'] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fornecedores</h1>
          <p className="text-muted-foreground">Gerencie seus fornecedores internacionais</p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Fornecedor
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar fornecedores..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {suppliers && (
          <span className="text-sm text-muted-foreground">
            {suppliers.length} fornecedor(es)
          </span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Fornecedores</CardTitle>
          <CardDescription>
            {suppliers?.length ? `${suppliers.length} fornecedor(es) cadastrado(s)` : 'Nenhum fornecedor cadastrado ainda'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : suppliers && suppliers.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead className="text-center">Produtos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16 text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow 
                      key={supplier.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/suppliers/${supplier.id}`)}
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{supplier.trade_name || supplier.company_name}</p>
                          {supplier.trade_name && (
                            <p className="text-sm text-muted-foreground">{supplier.company_name}</p>
                          )}
                          {supplier.website && (
                            <a 
                              href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              <Globe className="h-3 w-3" />
                              Website
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline" className="font-normal">
                            {supplier.country}
                          </Badge>
                          {(supplier.city || supplier.state_province) && (
                            <p className="text-sm text-muted-foreground">
                              {[supplier.city, supplier.state_province].filter(Boolean).join(', ')}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {supplier.contact_name && (
                            <p className="text-sm font-medium">{supplier.contact_name}</p>
                          )}
                          {supplier.contact_email && (
                            <a 
                              href={`mailto:${supplier.contact_email}`}
                              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                            >
                              <Mail className="h-3 w-3" />
                              {supplier.contact_email}
                            </a>
                          )}
                          {supplier.contact_phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {supplier.contact_phone}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{productCounts?.[supplier.id] || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={supplier.is_active ? 'default' : 'secondary'}>
                          {supplier.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  setSupplierToDelete({
                                    id: supplier.id,
                                    company_name: supplier.company_name,
                                    trade_name: supplier.trade_name,
                                  });
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Excluir fornecedor</p>
                            </TooltipContent>
                          </Tooltip>
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
                <Factory className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">Nenhum fornecedor encontrado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Comece cadastrando seu primeiro fornecedor
              </p>
              <Button onClick={() => setCreateModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar Fornecedor
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateSupplierModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={handleSuccess}
      />

      <DeleteSupplierDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        supplier={supplierToDelete}
        linkedProductsCount={linkedProductsCount}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
