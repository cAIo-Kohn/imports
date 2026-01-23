import React, { memo } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { ArrivalInput } from './ArrivalInput';

interface MonthProjection {
  monthKey: string;
  monthLabel: string;
  forecast: number;
  historyLastYear: number;
  purchases: number;
  pendingArrival: number;
  finalBalance: number;
  status: 'ok' | 'warning' | 'rupture';
}

interface Product {
  id: string;
  code: string;
  technical_description: string;
}

interface ProductProjectionData {
  product: Product;
  currentStock: number;
  projections: MonthProjection[];
  hasRupture: boolean;
  totalForecast: number;
  totalHistory: number;
  totalPurchases: number;
  totalPendingArrivals: number;
}

interface VirtualizedProductRowProps {
  productProj: ProductProjectionData;
  isSelected: boolean;
  pendingArrivalsInput: Record<string, string>;
  onSelectProduct: (productId: string | null) => void;
  onArrivalChange: (productId: string, monthKey: string, value: string) => void;
  style?: React.CSSProperties;
}

export const VirtualizedProductRow = memo(function VirtualizedProductRow({
  productProj,
  isSelected,
  pendingArrivalsInput,
  onSelectProduct,
  onArrivalChange,
  style,
}: VirtualizedProductRowProps) {
  const handleClick = () => {
    onSelectProduct(isSelected ? null : productProj.product.id);
  };

  return (
    <div style={style} className="contents">
      {/* Row 1: PV (Sales Forecast) */}
      <TableRow 
        className={`cursor-pointer transition-colors border-t-2 bg-muted/30 ${
          isSelected ? 'bg-muted' : 'hover:bg-muted/50'
        }`}
        onClick={handleClick}
      >
        <TableCell className="sticky left-0 bg-background z-10 font-medium" rowSpan={4}>
          <div className="flex items-center gap-2">
            {productProj.hasRupture && (
              <Badge variant="destructive" className="shrink-0">RUPTURA</Badge>
            )}
            <div className="min-w-0">
              <div className="font-semibold text-base">{productProj.product.code}</div>
              <div className="text-sm text-muted-foreground truncate max-w-[180px]">
                {productProj.product.technical_description}
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-center bg-muted/50 font-bold text-lg" rowSpan={4}>
          {productProj.currentStock.toLocaleString('pt-BR')}
        </TableCell>
        {productProj.projections.map((proj, i) => (
          <TableCell key={i} className="text-center p-1 bg-muted/20">
            <div className="flex items-center justify-center gap-1">
              <span className="text-sm text-muted-foreground">
                {proj.forecast > 0 ? proj.forecast.toLocaleString('pt-BR') : '-'}
              </span>
              {proj.forecast > 0 && proj.historyLastYear > 0 && (
                proj.forecast > proj.historyLastYear ? (
                  <TrendingUp className="h-3 w-3 text-orange-500" />
                ) : proj.forecast < proj.historyLastYear ? (
                  <TrendingDown className="h-3 w-3 text-primary" />
                ) : null
              )}
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">PV</span>
          </TableCell>
        ))}
        <TableCell className="text-center p-1 bg-muted/30 font-semibold">
          {productProj.totalForecast.toLocaleString('pt-BR')}
        </TableCell>
      </TableRow>
      
      {/* Row 2: History (Previous Year Sales) */}
      <TableRow className={`bg-secondary/30 ${isSelected ? 'bg-muted' : ''}`}>
        {productProj.projections.map((proj, i) => (
          <TableCell key={i} className="text-center p-1 bg-secondary/30">
            <div className="text-sm text-secondary-foreground">
              {proj.historyLastYear > 0 ? proj.historyLastYear.toLocaleString('pt-BR') : '-'}
            </div>
            <span className="text-[10px] text-muted-foreground">Hist.</span>
          </TableCell>
        ))}
        <TableCell className="text-center p-1 bg-secondary/50 font-semibold text-secondary-foreground">
          {productProj.totalHistory.toLocaleString('pt-BR')}
        </TableCell>
      </TableRow>

      {/* Row 3: Arrivals (Existing + Pending) */}
      <TableRow className={`bg-accent/20 ${isSelected ? 'bg-muted' : ''}`}>
        {productProj.projections.map((proj, i) => (
          <TableCell key={i} className="text-center p-1 bg-accent/30" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-0.5">
              <ArrivalInput
                productId={productProj.product.id}
                monthKey={proj.monthKey}
                initialValue={pendingArrivalsInput[`${productProj.product.id}-${proj.monthKey}`] || ''}
                existingPurchases={proj.purchases}
                onValueChange={onArrivalChange}
              />
              <span className="text-[10px] text-muted-foreground">Chegada</span>
            </div>
          </TableCell>
        ))}
        <TableCell className="text-center p-1 bg-accent/40">
          <div className="font-semibold text-accent-foreground">
            {(productProj.totalPurchases + productProj.totalPendingArrivals).toLocaleString('pt-BR')}
          </div>
          {productProj.totalPendingArrivals > 0 && (
            <span className="text-[10px] text-muted-foreground">
              (+{productProj.totalPendingArrivals.toLocaleString('pt-BR')} novo)
            </span>
          )}
        </TableCell>
      </TableRow>

      {/* Row 4: Balance Projection */}
      <TableRow className={`border-b-2 ${isSelected ? 'bg-muted' : ''}`}>
        {productProj.projections.map((proj, i) => (
          <TableCell key={i} className="text-center p-1">
            <div 
              className={`inline-block px-2 py-0.5 rounded text-sm font-bold ${
                proj.status === 'rupture' 
                  ? 'bg-destructive/15 text-destructive' 
                  : proj.status === 'warning'
                  ? 'bg-warning/15 text-warning'
                  : 'text-foreground'
              }`}
            >
              {proj.finalBalance.toLocaleString('pt-BR')}
            </div>
            <div className="text-[10px] text-muted-foreground">Saldo</div>
          </TableCell>
        ))}
        <TableCell className="text-center p-1 bg-muted/30">
          <div 
            className={`inline-block px-2 py-0.5 rounded text-sm font-bold ${
              productProj.projections[productProj.projections.length - 1]?.status === 'rupture' 
                ? 'bg-destructive/15 text-destructive' 
                : productProj.projections[productProj.projections.length - 1]?.status === 'warning'
                ? 'bg-warning/15 text-warning'
                : 'text-foreground'
            }`}
          >
            {productProj.projections[productProj.projections.length - 1]?.finalBalance.toLocaleString('pt-BR')}
          </div>
        </TableCell>
      </TableRow>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memoization
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.productProj !== nextProps.productProj) return false;
  
  // Compare only pending arrivals for this specific product
  const productId = prevProps.productProj.product.id;
  const prevKeys = Object.keys(prevProps.pendingArrivalsInput).filter(k => k.startsWith(productId));
  const nextKeys = Object.keys(nextProps.pendingArrivalsInput).filter(k => k.startsWith(productId));
  
  if (prevKeys.length !== nextKeys.length) return false;
  
  for (const key of prevKeys) {
    if (prevProps.pendingArrivalsInput[key] !== nextProps.pendingArrivalsInput[key]) return false;
  }
  
  return true;
});
