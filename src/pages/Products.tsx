import { useState } from 'react';
import { Plus, Search, Package, Upload, Filter, ChevronLeft, ChevronRight, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { ImportProductsModal } from '@/components/products/ImportProductsModal';
import { ImportProductDetailsModal } from '@/components/products/ImportProductDetailsModal';

interface Product {
  id: string;
  code: string;
  technical_description: string;
  warehouse_status: string | null;
  is_active: boolean;
  created_at: string;
  // New columns
  ean_13: string | null;
  dun_14: string | null;
  ncm: string | null;
  item_type: string | null;
  master_box_volume: number | null;
  gross_weight: number | null;
  weight_per_unit: number | null;
}

interface ProductUnit {
  unit_id: string;
  units: {
    id: string;
    name: string;
  } | null;
}

// Check if product has missing Partner data
const hasIncompletePartnerData = (product: Product) => {
  return !product.ean_13 && !product.ncm && !product.gross_weight;
};

const ITEMS_PER_PAGE = 50;

export default function Products() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importDetailsModalOpen, setImportDetailsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch total count for pagination
  const { data: totalCount } = useQuery({
    queryKey: ['products-count', search, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('id', { count: 'exact', head: true });

      if (search) {
        query = query.or(`code.ilike.%${search}%,technical_description.ilike.%${search}%`);
      }

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('warehouse_status', statusFilter);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    }
  });

  const totalPages = Math.ceil((totalCount ?? 0) / ITEMS_PER_PAGE);

  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ['products', search, statusFilter, currentPage],
    queryFn: async () => {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from('products')
        .select('id, code, technical_description, warehouse_status, is_active, created_at, ean_13, dun_14, ncm, item_type, master_box_volume, gross_weight, weight_per_unit')
        .order('code', { ascending: true })
        .range(from, to);

      if (search) {
        query = query.or(`code.ilike.%${search}%,technical_description.ilike.%${search}%`);
      }

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('warehouse_status', statusFilter);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as Product[];
    }
  });

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const { data: productUnits } = useQuery({
    queryKey: ['product-units'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_units')
        .select('product_id, unit_id, units:unit_id(id, name)');
      
      if (error) throw error;
      
      // Group by product_id
      const grouped: Record<string, string[]> = {};
      for (const pu of data || []) {
        if (!grouped[pu.product_id]) {
          grouped[pu.product_id] = [];
        }
        if (pu.units && typeof pu.units === 'object' && 'name' in pu.units) {
          grouped[pu.product_id].push(pu.units.name as string);
        }
      }
      return grouped;
    }
  });

  const { data: warehouseStatuses } = useQuery({
    queryKey: ['warehouse-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('warehouse_status')
        .not('warehouse_status', 'is', null);
      
      if (error) throw error;
      
      const statuses = [...new Set(data.map(p => p.warehouse_status))].filter(Boolean).sort();
      return statuses as string[];
    }
  });

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'A': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'B': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'BCR': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      case 'BN': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400';
      case 'ECC': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'NPD': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'FPE': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getUnitBadgeColor = (name: string) => {
    if (name.includes('Matriz')) return 'bg-primary/10 text-primary';
    if (name.includes('Pernambuco')) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
    if (name.includes('Rio')) return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">Gerencie seus produtos importados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportModalOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar Produtos
          </Button>
          <Button variant="outline" onClick={() => setImportDetailsModalOpen(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Importar Detalhes
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Produto
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou descrição..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Status Depósito" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {warehouseStatuses?.map((status) => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Produtos</CardTitle>
          <CardDescription>
            {totalCount !== undefined ? `${totalCount} produtos encontrados` : 'Carregando...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : products && products.length > 0 ? (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>NCM</TableHead>
                      <TableHead>EAN-13</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Unidades</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => {
                      const isIncomplete = hasIncompletePartnerData(product);
                      return (
                        <TableRow key={product.id} className={isIncomplete ? 'bg-destructive/5' : ''}>
                          <TableCell className="w-8">
                            {isIncomplete && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Dados Partner incompletos</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </TableCell>
                          <TableCell className="font-mono font-medium">{product.code}</TableCell>
                          <TableCell className="max-w-[250px] truncate">{product.technical_description}</TableCell>
                          <TableCell className={!product.ncm ? 'text-destructive bg-destructive/10' : ''}>
                            {product.ncm || <span className="text-xs italic">Vazio</span>}
                          </TableCell>
                          <TableCell className={!product.ean_13 ? 'text-destructive bg-destructive/10' : ''}>
                            {product.ean_13 || <span className="text-xs italic">Vazio</span>}
                          </TableCell>
                          <TableCell>
                            {product.warehouse_status && (
                              <Badge variant="secondary" className={getStatusColor(product.warehouse_status)}>
                                {product.warehouse_status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {productUnits?.[product.id]?.map((unitName) => (
                                <Badge key={unitName} variant="outline" className={getUnitBadgeColor(unitName)}>
                                  {unitName.replace('Filial ', '')}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">Nenhum produto encontrado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Comece importando seus produtos de um arquivo Excel
              </p>
              <Button onClick={() => setImportModalOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Importar Produtos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ImportProductsModal 
        open={importModalOpen} 
        onOpenChange={setImportModalOpen}
        onSuccess={refetch}
      />

      <ImportProductDetailsModal
        open={importDetailsModalOpen}
        onOpenChange={setImportDetailsModalOpen}
        onSuccess={refetch}
      />
    </div>
  );
}
