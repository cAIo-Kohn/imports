import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OrderChange } from '@/hooks/useOrderChanges';

interface Product {
  id: string;
  code: string;
  technical_description: string;
  ncm: string | null;
  qty_master_box: number | null;
  qty_inner: number | null;
  master_box_length: number | null;
  master_box_width: number | null;
  master_box_height: number | null;
  master_box_volume: number | null;
  packaging_type: string | null;
  supplier_specs: string | null;
  individual_length: number | null;
  individual_width: number | null;
  individual_height: number | null;
  image_url: string | null;
  fob_price_usd: number | null;
  origin_description: string | null;
  gross_weight: number | null;
}

interface Unit {
  id: string;
  name: string;
}

interface OrderItem {
  id: string;
  quantity: number;
  unit_price_usd: number | null;
  expected_arrival: string | null;
  products: Product | null;
  units: Unit | null;
}

interface HighlightedOrderItemsTableProps {
  orderId: string;
  items: OrderItem[];
  changesByItem: Record<string, Record<string, OrderChange>>;
  showImages?: boolean;
}

// Componente de célula com destaque visual para alterações
function HighlightedCell({ 
  value, 
  change,
  className 
}: { 
  value: React.ReactNode; 
  change: OrderChange | null;
  className?: string;
}) {
  if (!change) {
    return <span className={className}>{value}</span>;
  }
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(
          "px-1.5 py-0.5 rounded inline-flex items-center gap-1 cursor-help",
          change.is_critical 
            ? "bg-amber-100 text-amber-900 border border-amber-300" 
            : "bg-blue-50 text-blue-900 border border-blue-200",
          className
        )}>
          {value}
          {change.is_critical 
            ? <AlertTriangle className="h-3 w-3 flex-shrink-0" /> 
            : <Info className="h-3 w-3 flex-shrink-0" />
          }
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <p className="text-xs">
            <span className="font-medium">Valor anterior:</span>{' '}
            <span className="line-through text-muted-foreground">
              {change.old_value || '(vazio)'}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Alterado em {format(new Date(change.changed_at), "dd/MM 'às' HH:mm")}
          </p>
          {change.is_critical && !change.approved_by && (
            <p className="text-xs font-medium text-amber-600">
              ⚠️ Requer aprovação
            </p>
          )}
          {change.approved_by && (
            <p className="text-xs text-green-600">
              ✓ Aprovado em {format(new Date(change.approved_at!), "dd/MM 'às' HH:mm")}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function HighlightedOrderItemsTable({ 
  orderId, 
  items, 
  changesByItem,
  showImages = true 
}: HighlightedOrderItemsTableProps) {
  
  const getChange = (itemId: string, fieldName: string): OrderChange | null => {
    return changesByItem[itemId]?.[fieldName] || null;
  };

  const formatDimensions = (l: number | null, w: number | null, h: number | null) => {
    if (!l && !w && !h) return '-';
    return `${l || 0}×${w || 0}×${h || 0}`;
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculate totals
  const totals = items.reduce((acc, item) => {
    const product = item.products;
    const qty = item.quantity;
    const price = item.unit_price_usd || product?.fob_price_usd || 0;
    const qtyMasterBox = product?.qty_master_box || 1;
    const masterVolume = product?.master_box_volume || 0;
    const cartons = Math.ceil(qty / qtyMasterBox);
    const amount = qty * price;
    const cbm = cartons * masterVolume;

    acc.totalQty += qty;
    acc.totalCartons += cartons;
    acc.totalAmount += amount;
    acc.totalCbm += cbm;
    
    return acc;
  }, { totalQty: 0, totalCartons: 0, totalAmount: 0, totalCbm: 0 });

  // Sort items by product code to maintain stable order
  const sortedItems = [...items].sort((a, b) => {
    const codeA = a.products?.code || '';
    const codeB = b.products?.code || '';
    return codeA.localeCompare(codeB);
  });

  // Count changes
  const criticalCount = Object.values(changesByItem).reduce((acc, itemChanges) => {
    return acc + Object.values(itemChanges).filter(c => c.is_critical && !c.approved_by).length;
  }, 0);

  const infoCount = Object.values(changesByItem).reduce((acc, itemChanges) => {
    return acc + Object.values(itemChanges).filter(c => !c.is_critical).length;
  }, 0);

  return (
    <TooltipProvider>
      <Card className="p-0 overflow-hidden">
        {/* Legend */}
        {(criticalCount > 0 || infoCount > 0) && (
          <div className="px-4 py-2 bg-muted/30 border-b flex items-center gap-4 text-xs">
            <span className="font-medium">Legenda:</span>
            {criticalCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                <AlertTriangle className="h-3 w-3" />
                Alteração crítica ({criticalCount})
              </span>
            )}
            {infoCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200">
                <Info className="h-3 w-3" />
                Alteração informativa ({infoCount})
              </span>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-center w-12">#</TableHead>
                {showImages && <TableHead className="w-16">PIC</TableHead>}
                <TableHead>CODE</TableHead>
                <TableHead>MASTER CTN</TableHead>
                <TableHead className="text-right">m³</TableHead>
                <TableHead className="max-w-[180px]">DESCRIPTION</TableHead>
                <TableHead>NCM</TableHead>
                <TableHead className="text-right">PCS/CTN</TableHead>
                <TableHead className="text-right">CTN</TableHead>
                <TableHead className="text-right">Q'TY</TableHead>
                <TableHead className="text-right">FOB USD</TableHead>
                <TableHead className="text-right">AMOUNT</TableHead>
                <TableHead className="text-right">CBM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((item, index) => {
                const product = item.products;
                const qty = item.quantity;
                const price = item.unit_price_usd || product?.fob_price_usd || 0;
                const qtyMasterBox = product?.qty_master_box || 1;
                const masterVolume = product?.master_box_volume || 0;
                const cartons = Math.ceil(qty / qtyMasterBox);
                const amount = qty * price;
                const cbm = cartons * masterVolume;

                // Check for changes
                const hasChanges = !!changesByItem[item.id];
                const qtyChange = getChange(item.id, 'quantity');
                const priceChange = getChange(item.id, 'unit_price_usd');
                const descChange = getChange(item.id, 'technical_description');
                const ncmChange = getChange(item.id, 'ncm');
                const specsChange = getChange(item.id, 'supplier_specs');
                const volumeChange = getChange(item.id, 'master_box_volume');

                return (
                  <TableRow 
                    key={item.id} 
                    className={cn(hasChanges && 'bg-muted/20')}
                  >
                    <TableCell className="text-center font-medium">{index + 1}</TableCell>
                    {showImages && (
                      <TableCell>
                        {product?.image_url ? (
                          <img 
                            src={product.image_url} 
                            alt={product.code}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                            N/A
                          </div>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="font-mono">{product?.code}</TableCell>
                    <TableCell className="text-sm">
                      {formatDimensions(
                        product?.master_box_length,
                        product?.master_box_width,
                        product?.master_box_height
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <HighlightedCell 
                        value={masterVolume?.toFixed(3) || '-'} 
                        change={volumeChange}
                      />
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      {(descChange || specsChange) ? (
                        <HighlightedCell 
                          value={
                            <span className="line-clamp-2 block">
                              {product?.supplier_specs || product?.technical_description || '-'}
                            </span>
                          }
                          change={descChange || specsChange}
                          className="text-xs"
                        />
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs line-clamp-2 cursor-help block">
                              {product?.supplier_specs || product?.technical_description || '-'}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-sm">
                            <p className="text-xs whitespace-pre-wrap">
                              {product?.supplier_specs || product?.technical_description || '-'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <HighlightedCell 
                        value={product?.ncm || '-'} 
                        change={ncmChange}
                      />
                    </TableCell>
                    <TableCell className="text-right">{qtyMasterBox}</TableCell>
                    <TableCell className="text-right">{cartons.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <HighlightedCell 
                        value={qty.toLocaleString()} 
                        change={qtyChange}
                        className="font-medium"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <HighlightedCell 
                        value={`$${price.toFixed(4)}`} 
                        change={priceChange}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${formatCurrency(amount)}
                    </TableCell>
                    <TableCell className="text-right">{cbm.toFixed(3)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Totals Row */}
        <div className="border-t bg-muted/50 p-4">
          <div className="grid grid-cols-4 gap-4 text-sm font-medium">
            <div>
              <span className="text-muted-foreground">Total Cartons:</span>{' '}
              {totals.totalCartons.toLocaleString()}
            </div>
            <div>
              <span className="text-muted-foreground">Total Qty:</span>{' '}
              {totals.totalQty.toLocaleString()} pcs
            </div>
            <div>
              <span className="text-muted-foreground">Total CBM:</span>{' '}
              {totals.totalCbm.toFixed(3)} m³
            </div>
            <div className="text-right">
              <span className="text-muted-foreground">Total Amount:</span>{' '}
              <span className="text-lg font-bold">${formatCurrency(totals.totalAmount)}</span>
            </div>
          </div>
        </div>
      </Card>
    </TooltipProvider>
  );
}
