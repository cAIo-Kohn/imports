import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Package, AlertCircle, CheckCircle, Box, Scale, Ruler, Barcode, FileText, Building2, Factory } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';

interface Product {
  id: string;
  code: string;
  technical_description: string;
  warehouse_status: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  supplier_id: string | null;
  // Identification
  ean_13: string | null;
  dun_14: string | null;
  ncm: string | null;
  brand: string | null;
  // Classification
  item_type: string | null;
  origin_description: string | null;
  // Master box dimensions
  qty_master_box: number | null;
  master_box_length: number | null;
  master_box_width: number | null;
  master_box_height: number | null;
  master_box_volume: number | null;
  // Weights
  gross_weight: number | null;
  weight_per_unit: number | null;
  // Individual dimensions
  individual_length: number | null;
  individual_width: number | null;
  individual_height: number | null;
  individual_weight: number | null;
  // Product dimensions
  product_length: number | null;
  product_width: number | null;
  product_height: number | null;
  // Packaging
  packaging_type: string | null;
  qty_inner: number | null;
  // Pricing & Import
  fob_price_usd: number | null;
  customs_value: number | null;
  moq: number | null;
  lead_time_days: number | null;
  // Taxes
  tax_ii: number | null;
  tax_ipi: number | null;
  tax_pis: number | null;
  tax_cofins: number | null;
  tax_icms: number | null;
}

interface Supplier {
  id: string;
  company_name: string;
  trade_name: string | null;
  country: string;
}

export default function ProductDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Product | null;
    },
    enabled: !!id,
  });

  const { data: productUnits } = useQuery({
    queryKey: ['product-units', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_units')
        .select('unit_id, units:unit_id(id, name)')
        .eq('product_id', id);
      
      if (error) throw error;
      return data?.map(pu => {
        if (pu.units && typeof pu.units === 'object' && 'name' in pu.units) {
          return pu.units.name as string;
        }
        return null;
      }).filter(Boolean) as string[];
    },
    enabled: !!id,
  });

  const { data: supplier } = useQuery({
    queryKey: ['product-supplier', product?.supplier_id],
    queryFn: async () => {
      if (!product?.supplier_id) return null;
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, company_name, trade_name, country')
        .eq('id', product.supplier_id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Supplier | null;
    },
    enabled: !!product?.supplier_id,
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

  const formatNumber = (value: number | null, suffix?: string) => {
    if (value === null || value === undefined) return <span className="text-muted-foreground italic">—</span>;
    return `${value}${suffix || ''}`;
  };

  const formatCurrency = (value: number | null, currency = 'USD') => {
    if (value === null || value === undefined) return <span className="text-muted-foreground italic">—</span>;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
  };

  const formatPercent = (value: number | null) => {
    if (value === null || value === undefined) return <span className="text-muted-foreground italic">—</span>;
    return `${value}%`;
  };

  const DataItem = ({ label, value, className = '', isEmpty = false }: { 
    label: string; 
    value: React.ReactNode; 
    className?: string;
    isEmpty?: boolean;
  }) => (
    <div className={`space-y-1 ${isEmpty ? 'bg-destructive/5 p-2 rounded-md border border-destructive/20' : ''} ${className}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`font-medium ${isEmpty ? 'text-destructive' : ''}`}>{value}</p>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/products')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Produtos
        </Button>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold">Produto não encontrado</h2>
          <p className="text-muted-foreground">O produto solicitado não existe ou foi removido.</p>
        </div>
      </div>
    );
  }

  const hasPartnerData = product.ean_13 || product.ncm || product.gross_weight;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/products')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight font-mono">{product.code}</h1>
              {product.warehouse_status && (
                <Badge variant="secondary" className={getStatusColor(product.warehouse_status)}>
                  {product.warehouse_status}
                </Badge>
              )}
              {product.is_active ? (
                <Badge variant="outline" className="text-green-600 border-green-500/50">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Ativo
                </Badge>
              ) : (
                <Badge variant="outline" className="text-red-600 border-red-500/50">
                  Inativo
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">{product.technical_description}</p>
          </div>
        </div>
      </div>

      {/* Partner Data Warning */}
      {!hasPartnerData && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <p className="text-sm text-amber-600">
              Este produto não possui dados Partner importados. Use o botão "Importar Detalhes" na listagem de produtos.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Identification */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Barcode className="h-5 w-5" />
              Identificação
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <DataItem label="Código" value={product.code} />
            <DataItem label="EAN-13" value={product.ean_13 || 'Não informado'} isEmpty={!product.ean_13} />
            <DataItem label="DUN-14" value={product.dun_14 || 'Não informado'} isEmpty={!product.dun_14} />
            <DataItem label="NCM" value={product.ncm || 'Não informado'} isEmpty={!product.ncm} />
            <DataItem label="Marca" value={product.brand || 'Não informada'} isEmpty={!product.brand} />
            <DataItem label="Tipo Item" value={product.item_type || 'Não informado'} isEmpty={!product.item_type} />
            <DataItem label="Origem" value={product.origin_description || 'Não informada'} isEmpty={!product.origin_description} className="col-span-2" />
          </CardContent>
        </Card>

        {/* Supplier */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Factory className="h-5 w-5" />
              Fornecedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {supplier ? (
              <div className="space-y-2">
                <p className="font-medium">{supplier.trade_name || supplier.company_name}</p>
                {supplier.trade_name && (
                  <p className="text-sm text-muted-foreground">{supplier.company_name}</p>
                )}
                <Badge variant="outline">{supplier.country}</Badge>
              </div>
            ) : (
              <p className="text-muted-foreground italic">Nenhum fornecedor vinculado</p>
            )}
          </CardContent>
        </Card>

        {/* Units */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5" />
              Unidades
            </CardTitle>
            <CardDescription>Filiais onde o produto está disponível</CardDescription>
          </CardHeader>
          <CardContent>
            {productUnits && productUnits.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {productUnits.map((unit) => (
                  <Badge key={unit} variant="secondary" className="text-sm py-1 px-3">
                    {unit}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground italic">Nenhuma unidade vinculada</p>
            )}
          </CardContent>
        </Card>

        {/* Master Box */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Box className="h-5 w-5" />
              Caixa Master
            </CardTitle>
            <CardDescription>Dimensões e especificações da embalagem de transporte</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <DataItem label="Quantidade" value={formatNumber(product.qty_master_box, ' un')} />
            <DataItem label="Qtd. Inner" value={formatNumber(product.qty_inner, ' un')} />
            <Separator className="col-span-2" />
            <DataItem label="Comprimento" value={formatNumber(product.master_box_length, ' m')} />
            <DataItem label="Largura" value={formatNumber(product.master_box_width, ' m')} />
            <DataItem label="Altura" value={formatNumber(product.master_box_height, ' m')} />
            <DataItem label="Volume" value={formatNumber(product.master_box_volume, ' m³')} />
          </CardContent>
        </Card>

        {/* Weights */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Scale className="h-5 w-5" />
              Pesos
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <DataItem label="Peso Bruto" value={formatNumber(product.gross_weight, ' kg')} isEmpty={!product.gross_weight} />
            <DataItem label="Peso Líquido" value={formatNumber(product.weight_per_unit, ' kg')} />
            <DataItem label="Peso Individual" value={formatNumber(product.individual_weight, ' kg')} />
          </CardContent>
        </Card>

        {/* Individual Dimensions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Ruler className="h-5 w-5" />
              Dimensões Individuais
            </CardTitle>
            <CardDescription>Medidas de cada unidade do produto</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <DataItem label="Comprimento" value={formatNumber(product.individual_length, ' m')} />
            <DataItem label="Largura" value={formatNumber(product.individual_width, ' m')} />
            <DataItem label="Altura" value={formatNumber(product.individual_height, ' m')} />
            <Separator className="col-span-3" />
            <DataItem label="C. Produto" value={formatNumber(product.product_length, ' m')} />
            <DataItem label="L. Produto" value={formatNumber(product.product_width, ' m')} />
            <DataItem label="A. Produto" value={formatNumber(product.product_height, ' m')} />
          </CardContent>
        </Card>

        {/* Packaging */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5" />
              Embalagem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataItem label="Tipo de Embalagem" value={product.packaging_type || 'Não informado'} isEmpty={!product.packaging_type} />
          </CardContent>
        </Card>

        {/* Pricing & Import */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              Precificação & Importação
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <DataItem label="Preço FOB" value={formatCurrency(product.fob_price_usd)} />
            <DataItem label="Valor Aduaneiro" value={formatCurrency(product.customs_value, 'BRL')} />
            <DataItem label="MOQ" value={formatNumber(product.moq, ' un')} />
            <DataItem label="Lead Time" value={formatNumber(product.lead_time_days, ' dias')} />
          </CardContent>
        </Card>

        {/* Taxes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Impostos</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-5 gap-4">
            <DataItem label="II" value={formatPercent(product.tax_ii)} />
            <DataItem label="IPI" value={formatPercent(product.tax_ipi)} />
            <DataItem label="PIS" value={formatPercent(product.tax_pis)} />
            <DataItem label="COFINS" value={formatPercent(product.tax_cofins)} />
            <DataItem label="ICMS" value={formatPercent(product.tax_icms)} />
          </CardContent>
        </Card>
      </div>

      {/* Footer Info */}
      <div className="text-sm text-muted-foreground flex gap-6">
        <span>Criado em: {new Date(product.created_at).toLocaleDateString('pt-BR')}</span>
        <span>Atualizado em: {new Date(product.updated_at).toLocaleDateString('pt-BR')}</span>
      </div>
    </div>
  );
}
