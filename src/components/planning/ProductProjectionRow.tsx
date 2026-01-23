import React, { memo, useCallback } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ArrivalInput } from './ArrivalInput';

interface MonthProjection {
  monthKey: string;
  monthLabel: string;
  forecast: number;
  salesHistory: number;
  initialStock: number;
  purchases: number;
  pendingArrival: number;
  finalBalance: number;
  status: 'ok' | 'warning' | 'rupture';
}

interface Product {
  id: string;
  code: string;
  technical_description: string;
  supplier_id: string | null;
  lead_time_days: number | null;
}

interface ProductProjectionData {
  product: Product;
  supplierName: string;
  projections: MonthProjection[];
}

interface ProductProjectionRowProps {
  productProj: ProductProjectionData;
  isExpanded: boolean;
  isSelected: boolean;
  pendingArrivalsForProduct: Record<string, string>;
  onToggleExpand: (productId: string) => void;
  onToggleSelect: (productId: string, checked: boolean) => void;
  onArrivalChange: (productId: string, monthKey: string, value: string) => void;
  onSelectProduct: (productId: string) => void;
}

export const ProductProjectionRow = memo(function ProductProjectionRow({
  productProj,
  isExpanded,
  isSelected,
  pendingArrivalsForProduct,
  onToggleExpand,
  onToggleSelect,
  onArrivalChange,
  onSelectProduct,
}: ProductProjectionRowProps) {
  const handleToggleExpand = useCallback(() => {
    onToggleExpand(productProj.product.id);
  }, [onToggleExpand, productProj.product.id]);

  const handleToggleSelect = useCallback((checked: boolean) => {
    onToggleSelect(productProj.product.id, checked);
  }, [onToggleSelect, productProj.product.id]);

  const handleSelectProduct = useCallback(() => {
    onSelectProduct(productProj.product.id);
  }, [onSelectProduct, productProj.product.id]);

  const getStatusColor = (status: 'ok' | 'warning' | 'rupture') => {
    switch (status) {
      case 'ok':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'rupture':
        return 'bg-red-100 text-red-800';
    }
  };

  return (
    <>
      {/* Header Row */}
      <TableRow className="bg-muted/50 hover:bg-muted cursor-pointer" onClick={handleSelectProduct}>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={isSelected}
              onCheckedChange={handleToggleSelect}
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleExpand();
              }}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <div>
              <div className="font-semibold">{productProj.product.code}</div>
              <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                {productProj.product.technical_description}
              </div>
            </div>
          </div>
        </TableCell>
        {productProj.projections.map((proj) => (
          <TableCell key={proj.monthKey} className="text-center">
            <div className={`text-sm font-medium px-2 py-1 rounded ${getStatusColor(proj.status)}`}>
              {proj.finalBalance.toLocaleString('pt-BR')}
            </div>
          </TableCell>
        ))}
      </TableRow>

      {/* Detail Rows (when expanded) */}
      {isExpanded && (
        <>
          {/* Forecast Row */}
          <TableRow className="text-xs">
            <TableCell className="pl-12 text-muted-foreground">Previsão</TableCell>
            {productProj.projections.map((proj) => (
              <TableCell key={proj.monthKey} className="text-center text-muted-foreground">
                {proj.forecast > 0 ? `-${proj.forecast.toLocaleString('pt-BR')}` : '-'}
              </TableCell>
            ))}
          </TableRow>

          {/* Purchases Row */}
          <TableRow className="text-xs">
            <TableCell className="pl-12 text-muted-foreground">Compras</TableCell>
            {productProj.projections.map((proj) => (
              <TableCell key={proj.monthKey} className="text-center text-green-600">
                {proj.purchases > 0 ? `+${proj.purchases.toLocaleString('pt-BR')}` : '-'}
              </TableCell>
            ))}
          </TableRow>

          {/* Arrivals Input Row */}
          <TableRow className="text-xs bg-blue-50/50">
            <TableCell className="pl-12 text-blue-700 font-medium">Chegadas</TableCell>
            {productProj.projections.map((proj) => (
              <TableCell key={proj.monthKey} className="text-center">
                <ArrivalInput
                  productId={productProj.product.id}
                  monthKey={proj.monthKey}
                  initialValue={pendingArrivalsForProduct[proj.monthKey] || ''}
                  existingPurchases={proj.purchases}
                  onValueChange={onArrivalChange}
                />
              </TableCell>
            ))}
          </TableRow>
        </>
      )}
    </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better memoization
  if (prevProps.isExpanded !== nextProps.isExpanded) return false;
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.productProj !== nextProps.productProj) return false;
  
  // Compare pending arrivals for this product only
  const prevPending = prevProps.pendingArrivalsForProduct;
  const nextPending = nextProps.pendingArrivalsForProduct;
  
  const prevKeys = Object.keys(prevPending);
  const nextKeys = Object.keys(nextPending);
  
  if (prevKeys.length !== nextKeys.length) return false;
  
  for (const key of prevKeys) {
    if (prevPending[key] !== nextPending[key]) return false;
  }
  
  return true;
});
