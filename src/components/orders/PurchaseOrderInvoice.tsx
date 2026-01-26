import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';

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
  address: string | null;
  city: string | null;
  state: string | null;
  cnpj: string | null;
  phone?: string | null;
  fax?: string | null;
  zip_code?: string | null;
}

interface OrderItem {
  id: string;
  quantity: number;
  unit_price_usd: number | null;
  expected_arrival: string | null;
  products: Product | null;
  units: Unit | null;
}

interface Supplier {
  id: string;
  company_name: string;
  country: string;
  address: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  bank_name?: string | null;
  bank_swift?: string | null;
  bank_account?: string | null;
  bank_address?: string | null;
  payment_terms: string | null;
}

interface PurchaseOrder {
  id: string;
  order_number: string;
  order_date: string;
  status: string;
  notes: string | null;
  etd?: string | null;
  crd?: string | null;
  port_origin?: string | null;
  port_destination?: string | null;
  payment_terms?: string | null;
  invoice_number?: string | null;
  suppliers: Supplier | null;
  purchase_order_items: OrderItem[];
}

interface PurchaseOrderInvoiceProps {
  order: PurchaseOrder;
  showImages?: boolean;
}

export function PurchaseOrderInvoice({ order, showImages = true }: PurchaseOrderInvoiceProps) {
  const supplier = order.suppliers;
  const items = order.purchase_order_items || [];
  
  // Get unique unit for buyer info (use first item's unit)
  const buyerUnit = items[0]?.units;

  // Calculate totals
  const totals = items.reduce((acc, item, index) => {
    const product = item.products;
    const qty = item.quantity;
    const price = item.unit_price_usd || product?.fob_price_usd || 0;
    const qtyMasterBox = product?.qty_master_box || 1;
    const masterVolume = product?.master_box_volume || 0;
    const cartons = Math.ceil(qty / qtyMasterBox);
    const amount = qty * price;
    const cbm = cartons * masterVolume;
    const weight = (product?.gross_weight || 0) * cartons;

    acc.totalQty += qty;
    acc.totalCartons += cartons;
    acc.totalAmount += amount;
    acc.totalCbm += cbm;
    acc.totalWeight += weight;
    
    return acc;
  }, { totalQty: 0, totalCartons: 0, totalAmount: 0, totalCbm: 0, totalWeight: 0 });

  const formatDimensions = (l: number | null, w: number | null, h: number | null) => {
    if (!l && !w && !h) return '-';
    return `${l || 0}×${w || 0}×${h || 0}`;
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'MMMM do, yyyy', { locale: enUS });
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <Card className="p-0 overflow-hidden print:shadow-none print:border-0">
      {/* Supplier Header */}
      <div className="bg-muted/50 p-4 border-b">
        <h2 className="text-lg font-bold uppercase">{supplier?.company_name}</h2>
        <p className="text-sm text-muted-foreground">
          {[supplier?.address, supplier?.city, supplier?.state_province, supplier?.postal_code, supplier?.country]
            .filter(Boolean)
            .join(', ')}
        </p>
        {supplier?.contact_name && (
          <p className="text-sm text-muted-foreground">
            {supplier.contact_name} {supplier.contact_phone && `| ${supplier.contact_phone}`}
          </p>
        )}
      </div>

      {/* Commercial Invoice Header */}
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold text-center mb-4">COMMERCIAL INVOICE</h1>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Buyer Info */}
          <div>
            <p className="font-semibold">TO:</p>
            <p className="font-bold">{buyerUnit?.name || 'METALURGICA MOR SA'}</p>
            <p className="text-sm text-muted-foreground">{buyerUnit?.address}</p>
            <p className="text-sm text-muted-foreground">
              {[buyerUnit?.city, buyerUnit?.state].filter(Boolean).join(' - ')}
            </p>
            <p className="text-sm text-muted-foreground">BRASIL</p>
            {buyerUnit?.phone && (
              <p className="text-sm text-muted-foreground">TEL: {buyerUnit.phone}</p>
            )}
          </div>

          {/* Order Info */}
          <div className="text-right space-y-1">
            <p><span className="font-semibold">NO.:</span> {order.invoice_number || order.order_number}</p>
            <p><span className="font-semibold">DATE:</span> {formatDate(order.order_date)}</p>
          </div>
        </div>
      </div>

      {/* Shipping Info */}
      <div className="p-4 border-b bg-muted/30 space-y-1 text-sm">
        {order.etd && (
          <p>
            <span className="font-semibold">SHIPMENT (ETD):</span> {formatDate(order.etd)}
            {order.crd && <span className="text-muted-foreground"> (CRD: {formatDate(order.crd)})</span>}
          </p>
        )}
        {order.port_origin && (
          <p>
            <span className="font-semibold">SHIP FROM:</span> {order.port_origin}
          </p>
        )}
        {order.port_destination && (
          <p>
            <span className="font-semibold">TO:</span> {order.port_destination}
          </p>
        )}
        <p>
          <span className="font-semibold">PAYMENT:</span> {order.payment_terms || supplier?.payment_terms || '-'}
        </p>
      </div>

      {/* Items Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-center w-12">#</TableHead>
              {showImages && <TableHead className="w-16">PIC</TableHead>}
              <TableHead>CODE</TableHead>
              <TableHead>INNER BOX</TableHead>
              <TableHead>MASTER CTN</TableHead>
              <TableHead className="text-right">m³</TableHead>
              <TableHead className="max-w-[150px]">DESCRIPTION</TableHead>
              <TableHead className="max-w-[100px]">PACKING</TableHead>
              <TableHead>REFERENCE</TableHead>
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
            {items.map((item, index) => {
              const product = item.products;
              const qty = item.quantity;
              const price = item.unit_price_usd || product?.fob_price_usd || 0;
              const qtyMasterBox = product?.qty_master_box || 1;
              const masterVolume = product?.master_box_volume || 0;
              const cartons = Math.ceil(qty / qtyMasterBox);
              const amount = qty * price;
              const cbm = cartons * masterVolume;

              return (
                <TableRow key={item.id}>
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
                      product?.individual_length,
                      product?.individual_width,
                      product?.individual_height
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDimensions(
                      product?.master_box_length,
                      product?.master_box_width,
                      product?.master_box_height
                    )}
                  </TableCell>
                  <TableCell className="text-right">{masterVolume?.toFixed(3) || '-'}</TableCell>
                  <TableCell className="max-w-[150px] text-xs">
                    {product?.supplier_specs || product?.technical_description || '-'}
                  </TableCell>
                  <TableCell className="text-sm">{product?.packaging_type || '-'}</TableCell>
                  <TableCell className="text-sm">{product?.origin_description || '-'}</TableCell>
                  <TableCell className="font-mono text-sm">{product?.ncm || '-'}</TableCell>
                  <TableCell className="text-right">{qtyMasterBox}</TableCell>
                  <TableCell className="text-right">{cartons.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-medium">{qty.toLocaleString()}</TableCell>
                  <TableCell className="text-right">${price.toFixed(4)}</TableCell>
                  <TableCell className="text-right font-medium">${formatCurrency(amount)}</TableCell>
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

      {/* Remarks */}
      {order.notes && (
        <div className="p-4 border-t">
          <p className="font-semibold mb-2">REMARK:</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
        </div>
      )}

      {/* Bank Information */}
      {supplier?.bank_name && (
        <div className="p-4 border-t bg-muted/30">
          <p className="font-semibold mb-2">BANK INFORMATION:</p>
          <div className="text-sm space-y-1">
            <p><span className="text-muted-foreground">Company:</span> {supplier.company_name}</p>
            <p><span className="text-muted-foreground">Bank:</span> {supplier.bank_name}</p>
            {supplier.bank_address && (
              <p><span className="text-muted-foreground">Address:</span> {supplier.bank_address}</p>
            )}
            {supplier.bank_swift && (
              <p><span className="text-muted-foreground">SWIFT:</span> {supplier.bank_swift}</p>
            )}
            {supplier.bank_account && (
              <p><span className="text-muted-foreground">A/C NO:</span> {supplier.bank_account}</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
