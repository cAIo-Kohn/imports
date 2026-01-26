import React, { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { ArrivalInput } from './ArrivalInput';
import { PerformanceIndicator, type PerformanceData } from './PerformanceIndicator';

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

export interface ProductProjectionData {
  product: Product;
  currentStock: number;
  projections: MonthProjection[];
  hasRupture: boolean;
  totalForecast: number;
  totalHistory: number;
  totalPurchases: number; // From uploads
  totalAppOrderArrivals: number; // From app orders
  totalPendingArrivals: number;
  performanceData?: PerformanceData[]; // PV vs Actual for last 3 months
}

interface ProductProjectionCardProps {
  productProj: ProductProjectionData;
  isSelected: boolean;
  pendingArrivalsInput: Record<string, string>;
  onSelectProduct: (productId: string | null) => void;
  onArrivalChange: (productId: string, monthKey: string, value: string) => void;
  onArrivalBlur?: (productId: string, monthKey: string) => void;
}

export const ProductProjectionCard = memo(function ProductProjectionCard({
  productProj,
  isSelected,
  pendingArrivalsInput,
  onSelectProduct,
  onArrivalChange,
  onArrivalBlur,
}: ProductProjectionCardProps) {
  const handleClick = () => {
    onSelectProduct(isSelected ? null : productProj.product.id);
  };

  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
        isSelected 
          ? 'ring-2 ring-primary shadow-lg' 
          : productProj.hasRupture 
            ? 'border-destructive/50' 
            : ''
      }`}
      onClick={handleClick}
    >
      <CardContent className="p-3">
        {/* Product Header */}
        <div className="flex items-start gap-4 mb-3">
          <div className="flex flex-col gap-1 min-w-[140px]">
            {productProj.hasRupture && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 w-fit">
                RUPTURA
              </Badge>
            )}
            <div className="font-bold text-sm">{productProj.product.code}</div>
            <div 
              className="text-xs text-muted-foreground leading-tight line-clamp-2"
              title={productProj.product.technical_description}
            >
              {productProj.product.technical_description}
            </div>
          </div>
          <div className="flex flex-col items-center bg-muted/40 rounded-md px-3 py-1.5">
            <span className="text-[10px] text-muted-foreground uppercase">Stock</span>
            <span className="font-bold text-lg">{productProj.currentStock.toLocaleString('pt-BR')}</span>
          </div>
          {/* Performance Indicator - PV vs Actual */}
          <PerformanceIndicator 
            performanceData={productProj.performanceData || []} 
          />
        </div>

        {/* Projection Table */}
        <div className="overflow-x-auto -mx-1">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-7 w-[60px] text-center text-[10px] font-medium">Tipo</TableHead>
                {productProj.projections.map((proj, i) => (
                  <TableHead key={i} className="h-7 min-w-[60px] text-center text-[10px] font-medium px-1">
                    {proj.monthLabel}
                  </TableHead>
                ))}
                <TableHead className="h-7 min-w-[60px] text-center text-[10px] font-bold bg-muted/30 px-1">
                  TOTAL
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Row 1: PV (Sales Forecast) */}
              <TableRow className="hover:bg-muted/20">
                <TableCell className="text-center py-1 bg-muted/20 font-medium text-muted-foreground">
                  PV
                </TableCell>
                {productProj.projections.map((proj, i) => (
                  <TableCell key={i} className="text-center py-1 px-1">
                    <div className="flex items-center justify-center gap-0.5">
                      <span>
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
                <TableCell className="text-center py-1 px-1 bg-muted/20 font-semibold">
                  {productProj.totalForecast.toLocaleString('pt-BR')}
                </TableCell>
              </TableRow>

              {/* Row 2: History (Previous Year Sales) */}
              <TableRow className="hover:bg-muted/20">
                <TableCell className="text-center py-1 bg-muted/20 font-medium text-muted-foreground">
                  Hist.
                </TableCell>
                {productProj.projections.map((proj, i) => (
                  <TableCell key={i} className="text-center py-1 px-1 text-muted-foreground">
                    {proj.historyLastYear > 0 ? proj.historyLastYear.toLocaleString('pt-BR') : '-'}
                  </TableCell>
                ))}
                <TableCell className="text-center py-1 px-1 bg-muted/20 text-muted-foreground">
                  {productProj.totalHistory.toLocaleString('pt-BR')}
                </TableCell>
              </TableRow>

              {/* Row 3: Arrivals (Existing + Pending) - Highlighted */}
              <TableRow className="bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/50">
                <TableCell className="text-center py-1 bg-blue-100/60 dark:bg-blue-900/40 font-medium text-muted-foreground">
                  Chegada
                </TableCell>
                {productProj.projections.map((proj, i) => (
                  <TableCell 
                    key={i} 
                    className="text-center py-1 px-1" 
                    onClick={(e) => e.stopPropagation()}
                  >
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
                <TableCell className="text-center py-1 px-1 bg-muted/20">
                  {productProj.totalPurchases > 0 ? (
                    <>
                      <span className="font-semibold">
                        {productProj.totalPurchases.toLocaleString('pt-BR')}
                      </span>
                      {(productProj.totalAppOrderArrivals + productProj.totalPendingArrivals) > 0 && (
                        <span className="text-[10px] text-blue-700 dark:text-blue-400 font-bold ml-1">
                          +{(productProj.totalAppOrderArrivals + productProj.totalPendingArrivals).toLocaleString('pt-BR')}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className={`font-semibold ${
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
              <TableRow className="hover:bg-muted/20">
                <TableCell className="text-center py-1 bg-muted/20 font-medium text-muted-foreground">
                  Saldo
                </TableCell>
                {productProj.projections.map((proj, i) => (
                  <TableCell 
                    key={i} 
                    className={`text-center py-1 px-1 ${
                      proj.status === 'rupture' 
                        ? 'bg-red-100 dark:bg-red-900/30' 
                        : ''
                    }`}
                  >
                    <span 
                      className={`font-semibold ${
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
                  className={`text-center py-1 px-1 bg-muted/20 ${
                    productProj.projections[productProj.projections.length - 1]?.status === 'rupture'
                      ? 'bg-red-100 dark:bg-red-900/30'
                      : ''
                  }`}
                >
                  <span 
                    className={`font-bold ${
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
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
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
