import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Package, Upload, Filter, ChevronLeft, ChevronRight, FileSpreadsheet, AlertCircle, Trash2, ArrowUp, ArrowDown, ArrowUpDown, X, SlidersHorizontal } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { ImportProductsModal } from '@/components/products/ImportProductsModal';
import { ImportProductDetailsModal } from '@/components/products/ImportProductDetailsModal';
import { ImportCadastralDataModal } from '@/components/products/ImportCadastralDataModal';
import { CreateProductModal } from '@/components/products/CreateProductModal';
import { DeleteProductDialog } from '@/components/products/DeleteProductDialog';

interface Product {
  id: string;
  code: string;
  technical_description: string;
  warehouse_status: string | null;
  is_active: boolean;
  created_at: string;
  supplier_id: string | null;
  // Identification
  ean_13: string | null;
  dun_14: string | null;
  ncm: string | null;
  item_type: string | null;
  origin_description: string | null;
  brand: string | null;
  // Master Box
  qty_master_box: number | null;
  qty_inner: number | null;
  master_box_length: number | null;
  master_box_width: number | null;
  master_box_height: number | null;
  master_box_volume: number | null;
  // Weights
  gross_weight: number | null;
  weight_per_unit: number | null;
  individual_weight: number | null;
  // Individual Dimensions
  individual_length: number | null;
  individual_width: number | null;
  individual_height: number | null;
  // Product Dimensions
  product_length: number | null;
  product_width: number | null;
  product_height: number | null;
  // Other
  packaging_type: string | null;
}

interface Supplier {
  id: string;
  company_name: string;
  trade_name: string | null;
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

type SortColumn = 'code' | 'technical_description' | 'ncm' | 'brand' | 'qty_master_box' | 'gross_weight' | 'warehouse_status' | 'created_at';
type SortDirection = 'asc' | 'desc';

export default function Products() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn>('code');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [ncmPrefixFilter, setNcmPrefixFilter] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importDetailsModalOpen, setImportDetailsModalOpen] = useState(false);
  const [importCadastralModalOpen, setImportCadastralModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<{ id: string; code: string; technical_description: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Check if any filters are active
  const hasActiveFilters = search || statusFilter !== 'all' || supplierFilter !== 'all' || incompleteOnly || brandFilter !== 'all' || ncmPrefixFilter;

  const clearAllFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setSupplierFilter('all');
    setIncompleteOnly(false);
    setBrandFilter('all');
    setNcmPrefixFilter('');
    setCurrentPage(1);
  };

  // Fetch suppliers for filter
  const { data: suppliersForFilter } = useQuery({
    queryKey: ['suppliers-for-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, company_name, trade_name')
        .eq('is_active', true)
        .order('company_name');
      
      if (error) throw error;
      return data as Supplier[];
    }
  });

  // Fetch unique brands for filter
  const { data: brandsForFilter } = useQuery({
    queryKey: ['brands-for-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('brand')
        .not('brand', 'is', null);
      
      if (error) throw error;
      
      const brands = [...new Set(data.map(p => p.brand))].filter(Boolean).sort();
      return brands as string[];
    }
  });

  // Fetch total count for pagination
  const { data: totalCount } = useQuery({
    queryKey: ['products-count', search, statusFilter, supplierFilter, incompleteOnly, brandFilter, ncmPrefixFilter],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('id, ean_13, ncm, gross_weight', { count: 'exact' });

      if (search) {
        query = query.or(`code.ilike.%${search}%,technical_description.ilike.%${search}%`);
      }

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('warehouse_status', statusFilter);
      }

      if (supplierFilter === 'none') {
        query = query.is('supplier_id', null);
      } else if (supplierFilter !== 'all') {
        query = query.eq('supplier_id', supplierFilter);
      }

      if (brandFilter !== 'all') {
        query = query.eq('brand', brandFilter);
      }

      if (ncmPrefixFilter) {
        query = query.ilike('ncm', `${ncmPrefixFilter}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      
      // Filter incomplete data client-side if needed
      if (incompleteOnly && data) {
        const incompleteProducts = data.filter(p => !p.ean_13 && !p.ncm && !p.gross_weight);
        return incompleteProducts.length;
      }
      
      return count ?? 0;
    }
  });

  const totalPages = Math.ceil((totalCount ?? 0) / ITEMS_PER_PAGE);

  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ['products', search, statusFilter, supplierFilter, sortColumn, sortDirection, incompleteOnly, brandFilter, ncmPrefixFilter, currentPage],
    queryFn: async () => {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from('products')
        .select(`
          id, code, technical_description, warehouse_status, is_active, created_at, supplier_id,
          ean_13, dun_14, ncm, item_type, origin_description, brand,
          qty_master_box, qty_inner, master_box_length, master_box_width, master_box_height, master_box_volume,
          gross_weight, weight_per_unit, individual_weight,
          individual_length, individual_width, individual_height,
          product_length, product_width, product_height,
          packaging_type
        `)
        .order(sortColumn, { ascending: sortDirection === 'asc', nullsFirst: false });

      if (search) {
        query = query.or(`code.ilike.%${search}%,technical_description.ilike.%${search}%`);
      }

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('warehouse_status', statusFilter);
      }

      if (supplierFilter === 'none') {
        query = query.is('supplier_id', null);
      } else if (supplierFilter !== 'all') {
        query = query.eq('supplier_id', supplierFilter);
      }

      if (brandFilter !== 'all') {
        query = query.eq('brand', brandFilter);
      }

      if (ncmPrefixFilter) {
        query = query.ilike('ncm', `${ncmPrefixFilter}%`);
      }

      // For incomplete filter, we need to fetch more and filter client-side
      if (incompleteOnly) {
        const { data, error } = await query;
        if (error) throw error;
        
        const filteredData = (data as Product[]).filter(hasIncompletePartnerData);
        return filteredData.slice(from, to + 1);
      }

      query = query.range(from, to);

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

  const handleSupplierChange = (value: string) => {
    setSupplierFilter(value);
    setCurrentPage(1);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
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

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, company_name, trade_name');
      
      if (error) throw error;
      
      const map: Record<string, Supplier> = {};
      for (const s of data || []) {
        map[s.id] = s;
      }
      return map;
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

  // Sortable header component
  const SortableHeader = ({ column, label, className = '' }: { column: SortColumn; label: string; className?: string }) => {
    const isActive = sortColumn === column;
    return (
      <TableHead 
        className={`cursor-pointer hover:bg-muted/50 select-none transition-colors ${className}`}
        onClick={() => handleSort(column)}
      >
        <div className="flex items-center gap-1">
          {label}
          {isActive ? (
            sortDirection === 'asc' ? (
              <ArrowUp className="h-3 w-3 text-primary" />
            ) : (
              <ArrowDown className="h-3 w-3 text-primary" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
          )}
        </div>
      </TableHead>
    );
  };

  // Count active advanced filters
  const advancedFilterCount = [incompleteOnly, brandFilter !== 'all', ncmPrefixFilter].filter(Boolean).length;

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
          <Button variant="outline" onClick={() => setImportCadastralModalOpen(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Dados Cadastrais
          </Button>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Produto
          </Button>
        </div>
      </div>

      {/* Control Bar: Filters + Pagination - Always visible */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-background py-2 border-b sticky top-0 z-20">
        {/* Left side: Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou descrição..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 w-[260px]"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[160px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {warehouseStatuses?.map((status) => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={supplierFilter} onValueChange={handleSupplierChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Fornecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os fornecedores</SelectItem>
              <SelectItem value="none">Sem fornecedor</SelectItem>
              {suppliersForFilter?.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.trade_name || supplier.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Advanced Filters Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Mais filtros
                {advancedFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {advancedFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Filtros Avançados</h4>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="incomplete" 
                    checked={incompleteOnly}
                    onCheckedChange={(checked) => {
                      setIncompleteOnly(checked as boolean);
                      setCurrentPage(1);
                    }}
                  />
                  <Label htmlFor="incomplete" className="text-sm cursor-pointer">
                    Apenas dados incompletos
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Marca</Label>
                  <Select value={brandFilter} onValueChange={(value) => {
                    setBrandFilter(value);
                    setCurrentPage(1);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as marcas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as marcas</SelectItem>
                      {brandsForFilter?.map((brand) => (
                        <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Prefixo NCM</Label>
                  <Input
                    placeholder="Ex: 9503, 8471..."
                    value={ncmPrefixFilter}
                    onChange={(e) => {
                      setNcmPrefixFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-9"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="gap-1 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
              Limpar filtros
            </Button>
          )}
        </div>
        
        {/* Right side: Count + Pagination */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {totalCount !== undefined ? `${totalCount} produtos` : 'Carregando...'} 
            {totalPages > 1 && ` | Pág. ${currentPage}/${totalPages}`}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Anterior</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <span className="hidden sm:inline mr-1">Próxima</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-lg">Lista de Produtos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : products && products.length > 0 ? (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table className="min-w-[2400px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8 sticky left-0 bg-background z-10"></TableHead>
                      <SortableHeader column="code" label="Código" className="sticky left-8 bg-background z-10 min-w-[100px]" />
                      <SortableHeader column="technical_description" label="Descrição" className="min-w-[250px]" />
                      <SortableHeader column="ncm" label="NCM" />
                      <TableHead>EAN-13</TableHead>
                      <TableHead>DUN-14</TableHead>
                      <TableHead>Tipo Item</TableHead>
                      <TableHead>Origem</TableHead>
                      <SortableHeader column="brand" label="Marca" />
                      <TableHead>Fornecedor</TableHead>
                      <SortableHeader column="qty_master_box" label="Qt. Master" className="text-right" />
                      <TableHead className="text-right">Qt. Inner</TableHead>
                      <TableHead className="text-right">C. Master (m)</TableHead>
                      <TableHead className="text-right">L. Master (m)</TableHead>
                      <TableHead className="text-right">A. Master (m)</TableHead>
                      <TableHead className="text-right">Volume (m³)</TableHead>
                      <SortableHeader column="gross_weight" label="Peso Bruto (kg)" className="text-right" />
                      <TableHead className="text-right">Peso Líquido (kg)</TableHead>
                      <TableHead className="text-right">P. Individual (kg)</TableHead>
                      <TableHead className="text-right">C. Individual (m)</TableHead>
                      <TableHead className="text-right">L. Individual (m)</TableHead>
                      <TableHead className="text-right">A. Individual (m)</TableHead>
                      <TableHead className="text-right">C. Produto (m)</TableHead>
                      <TableHead className="text-right">L. Produto (m)</TableHead>
                      <TableHead className="text-right">A. Produto (m)</TableHead>
                      <TableHead>Embalagem</TableHead>
                      <SortableHeader column="warehouse_status" label="Status" />
                      <TableHead>Unidades</TableHead>
                      <TableHead className="w-16 text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => {
                      const isIncomplete = hasIncompletePartnerData(product);
                      const formatNum = (val: number | null, decimals = 2) => 
                        val != null ? val.toFixed(decimals) : <span className="text-muted-foreground text-xs">-</span>;
                      const formatInt = (val: number | null) => 
                        val != null ? val : <span className="text-muted-foreground text-xs">-</span>;
                      const formatText = (val: string | null) => 
                        val || <span className="text-muted-foreground text-xs">-</span>;
                      
                      return (
                        <TableRow 
                          key={product.id} 
                          className={`cursor-pointer hover:bg-muted/50 transition-colors ${isIncomplete ? 'bg-destructive/5' : ''}`}
                          onClick={() => navigate(`/products/${product.id}`)}
                        >
                          <TableCell className="w-8 sticky left-0 bg-background z-10">
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
                          <TableCell className="font-mono font-medium sticky left-8 bg-background z-10">{product.code}</TableCell>
                          <TableCell className="max-w-[250px] truncate">{product.technical_description}</TableCell>
                          <TableCell className={!product.ncm ? 'text-destructive bg-destructive/10' : ''}>
                            {product.ncm || <span className="text-xs italic">Vazio</span>}
                          </TableCell>
                          <TableCell className={!product.ean_13 ? 'text-destructive bg-destructive/10' : ''}>
                            {product.ean_13 || <span className="text-xs italic">Vazio</span>}
                          </TableCell>
                          <TableCell>{formatText(product.dun_14)}</TableCell>
                          <TableCell>{formatText(product.item_type)}</TableCell>
                          <TableCell>{formatText(product.origin_description)}</TableCell>
                          <TableCell>{formatText(product.brand)}</TableCell>
                          <TableCell>
                            {product.supplier_id && suppliers?.[product.supplier_id] ? (
                              <span className="text-sm">{suppliers[product.supplier_id].trade_name || suppliers[product.supplier_id].company_name}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{formatInt(product.qty_master_box)}</TableCell>
                          <TableCell className="text-right">{formatInt(product.qty_inner)}</TableCell>
                          <TableCell className="text-right">{formatNum(product.master_box_length)}</TableCell>
                          <TableCell className="text-right">{formatNum(product.master_box_width)}</TableCell>
                          <TableCell className="text-right">{formatNum(product.master_box_height)}</TableCell>
                          <TableCell className="text-right">{formatNum(product.master_box_volume, 4)}</TableCell>
                          <TableCell className="text-right">{formatNum(product.gross_weight)}</TableCell>
                          <TableCell className="text-right">{formatNum(product.weight_per_unit)}</TableCell>
                          <TableCell className="text-right">{formatNum(product.individual_weight)}</TableCell>
                          <TableCell className="text-right">{formatNum(product.individual_length)}</TableCell>
                          <TableCell className="text-right">{formatNum(product.individual_width)}</TableCell>
                          <TableCell className="text-right">{formatNum(product.individual_height)}</TableCell>
                          <TableCell className="text-right">{formatNum(product.product_length)}</TableCell>
                          <TableCell className="text-right">{formatNum(product.product_width)}</TableCell>
                          <TableCell className="text-right">{formatNum(product.product_height)}</TableCell>
                          <TableCell>{formatText(product.packaging_type)}</TableCell>
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
                          <TableCell className="text-center">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setProductToDelete({
                                        id: product.id,
                                        code: product.code,
                                        technical_description: product.technical_description,
                                      });
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Excluir produto</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">Nenhum produto encontrado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {hasActiveFilters 
                  ? 'Tente ajustar os filtros para encontrar produtos'
                  : 'Comece importando seus produtos de um arquivo Excel'}
              </p>
              {hasActiveFilters ? (
                <Button variant="outline" onClick={clearAllFilters}>
                  <X className="mr-2 h-4 w-4" />
                  Limpar filtros
                </Button>
              ) : (
                <Button onClick={() => setImportModalOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Importar Produtos
                </Button>
              )}
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

      <ImportCadastralDataModal
        open={importCadastralModalOpen}
        onOpenChange={setImportCadastralModalOpen}
        onSuccess={refetch}
      />

      <CreateProductModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ['dashboard-products-count'] });
        }}
      />

      <DeleteProductDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        product={productToDelete}
        onSuccess={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ['dashboard-products-count'] });
        }}
      />
    </div>
  );
}
