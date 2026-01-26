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
  purchases: number; // From uploads (BLACK)
  appOrderArrivals: number; // From app orders (BLUE DARK)
  appOrderNumbers: string[]; // Order reference numbers for tooltip
  pendingArrival: number;
  finalBalance: number;
  status: 'ok' | 'warning' | 'rupture';
  processNumber: string | null;
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
  totalPurchases: number; // From uploads
  totalAppOrderArrivals: number; // From app orders
  totalPendingArrivals: number;
}

interface VirtualizedProductRowProps {
  productProj: ProductProjectionData;
  isSelected: boolean;
  pendingArrivalsInput: Record<string, string>;
  onSelectProduct: (productId: string | null) => void;
  onArrivalChange: (productId: string, monthKey: string, value: string) => void;
  onArrivalBlur?: (productId: string, monthKey: string) => void;
  style?: React.CSSProperties;
  index?: number;
}

export const ProductProjectionRow = memo(function ProductProjectionRow({
  productProj,
  isSelected,
  pendingArrivalsInput,
  onSelectProduct,
  onArrivalChange,
  onArrivalBlur,
  style,
  index = 0,
}: VirtualizedProductRowProps) {
  const handleClick = () => {
    onSelectProduct(isSelected ? null : productProj.product.id);
  };

  // Zebra striping: alternate background between products
  const isEven = index % 2 === 0;
  const zebraClass = isEven ? '' : 'bg-slate-50 dark:bg-slate-900/30';
  const baseRowClass = isSelected 
    ? 'bg-primary/5' 
    : `hover:bg-muted/30 ${zebraClass}`;
  
  // Sticky cell background must match zebra
  const stickyCellBg = isSelected 
    ? 'bg-primary/5' 
    : isEven 
      ? 'bg-background' 
      : 'bg-slate-50 dark:bg-slate-900/30';

  return (
    <div style={style} className="contents">
      {/* Row 1: PV (Sales Forecast) - with strong separator border */}
      <TableRow 
        className={`cursor-pointer transition-colors border-t-[3px] border-slate-300 dark:border-slate-600 ${baseRowClass}`}
        onClick={handleClick}
      >
        <TableCell className={`sticky left-0 z-10 py-1 ${stickyCellBg}`} rowSpan={4}>
          <div className="flex flex-col items-start gap-0.5 w-[120px]">
            {productProj.hasRupture && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                RUPTURA
              </Badge>
            )}
            <div className="font-semibold text-sm">{productProj.product.code}</div>
            <div 
              className="text-xs text-muted-foreground leading-tight line-clamp-2"
              title={productProj.product.technical_description}
            >
              {productProj.product.technical_description}
            </div>
          </div>
        </TableCell>
        <TableCell className="text-center bg-muted/40 font-bold py-1" rowSpan={4}>
          {productProj.currentStock.toLocaleString('pt-BR')}
        </TableCell>
        <TableCell className="text-center py-1 bg-muted/20 text-xs font-medium text-muted-foreground w-[60px]">
          PV
        </TableCell>
        {productProj.projections.map((proj, i) => (
          <TableCell key={i} className="text-center py-0.5 px-1">
            <div className="flex items-center justify-center gap-0.5">
              <span className="text-xs">
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
          </TableCell>
        ))}
        <TableCell className="text-center py-0.5 px-1 bg-muted/20 font-semibold text-xs">
          {productProj.totalForecast.toLocaleString('pt-BR')}
        </TableCell>
      </TableRow>
      
      {/* Row 2: History (Previous Year Sales) */}
      <TableRow className={baseRowClass}>
        <TableCell className="text-center py-1 bg-muted/20 text-xs font-medium text-muted-foreground">
          Hist.
        </TableCell>
        {productProj.projections.map((proj, i) => (
          <TableCell key={i} className="text-center py-0.5 px-1">
            <span className="text-xs text-muted-foreground">
              {proj.historyLastYear > 0 ? proj.historyLastYear.toLocaleString('pt-BR') : '-'}
            </span>
          </TableCell>
        ))}
        <TableCell className="text-center py-0.5 px-1 bg-muted/20 text-xs text-muted-foreground">
          {productProj.totalHistory.toLocaleString('pt-BR')}
        </TableCell>
      </TableRow>

      {/* Row 3: Arrivals (Existing + Pending) - Highlighted */}
      <TableRow className={`${baseRowClass} bg-blue-50/50 dark:bg-blue-950/20`}>
        <TableCell className="text-center py-1 bg-blue-100/60 dark:bg-blue-900/40 text-xs font-medium text-muted-foreground">
          Chegada
        </TableCell>
        {productProj.projections.map((proj, i) => (
          <TableCell key={i} className="text-center py-0.5 px-1" onClick={(e) => e.stopPropagation()}>
            <ArrivalInput
              productId={productProj.product.id}
              monthKey={proj.monthKey}
              initialValue={pendingArrivalsInput[`${productProj.product.id}::${proj.monthKey}`] || ''}
              uploadedArrivals={proj.purchases}
              appOrderArrivals={proj.appOrderArrivals}
              appOrderNumbers={proj.appOrderNumbers}
              processNumber={proj.processNumber}
              onValueChange={onArrivalChange}
              onBlur={onArrivalBlur}
            />
          </TableCell>
        ))}
        <TableCell className="text-center py-0.5 px-1 bg-muted/20">
          {productProj.totalPurchases > 0 ? (
            <>
              <span className="font-semibold text-xs">
                {productProj.totalPurchases.toLocaleString('pt-BR')}
              </span>
              {(productProj.totalAppOrderArrivals + productProj.totalPendingArrivals) > 0 && (
                <span className="text-[10px] text-blue-700 dark:text-blue-400 font-bold ml-1">
                  +{(productProj.totalAppOrderArrivals + productProj.totalPendingArrivals).toLocaleString('pt-BR')}
                </span>
              )}
            </>
          ) : (
            <span className={`font-semibold text-xs ${
              (productProj.totalAppOrderArrivals + productProj.totalPendingArrivals) > 0 
                ? 'text-blue-700 dark:text-blue-400' 
                : ''
            }`}>
              {(productProj.totalAppOrderArrivals + productProj.totalPendingArrivals).toLocaleString('pt-BR')}
            </span>
          )}
        </TableCell>
      </TableRow>

      {/* Row 4: Balance Projection */}
      <TableRow className={`border-b ${baseRowClass}`}>
        <TableCell className="text-center py-1 bg-muted/20 text-xs font-medium text-muted-foreground">
          Saldo
        </TableCell>
        {productProj.projections.map((proj, i) => (
          <TableCell 
            key={i} 
            className={`text-center py-0.5 px-1 ${
              proj.status === 'rupture' 
                ? 'bg-red-100 dark:bg-red-900/30' 
                : ''
            }`}
          >
            <span 
              className={`text-xs font-semibold ${
                proj.status === 'rupture' 
                  ? 'text-red-700 dark:text-red-400' 
                  : proj.status === 'warning'
                  ? 'text-yellow-600'
                  : ''
              }`}
            >
              {proj.finalBalance.toLocaleString('pt-BR')}
            </span>
          </TableCell>
        ))}
        <TableCell 
          className={`text-center py-0.5 px-1 bg-muted/20 ${
            productProj.projections[productProj.projections.length - 1]?.status === 'rupture'
              ? 'bg-red-100 dark:bg-red-900/30'
              : ''
          }`}
        >
          <span 
            className={`text-xs font-bold ${
              productProj.projections[productProj.projections.length - 1]?.status === 'rupture' 
                ? 'text-red-700 dark:text-red-400' 
                : productProj.projections[productProj.projections.length - 1]?.status === 'warning'
                ? 'text-yellow-600'
                : ''
            }`}
          >
            {productProj.projections[productProj.projections.length - 1]?.finalBalance.toLocaleString('pt-BR')}
          </span>
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
