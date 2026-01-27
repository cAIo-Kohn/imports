import { format } from 'date-fns';
import { ExternalLink, Package, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Sample {
  id: string;
  item_id: string;
  courier_name: string | null;
  tracking_number: string | null;
  shipped_date: string | null;
  estimated_arrival: string | null;
  actual_arrival: string | null;
  quantity: number;
  notes: string | null;
  status: 'pending' | 'in_transit' | 'delivered' | 'returned';
  created_at: string;
}

interface SampleTrackingCardProps {
  sample: Sample;
  canEdit: boolean;
}

const STATUS_STYLES: Record<Sample['status'], string> = {
  pending: 'bg-slate-100 text-slate-700',
  in_transit: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  returned: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<Sample['status'], string> = {
  pending: 'Pending',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  returned: 'Returned',
};

// Generate tracking URL based on courier name
function getTrackingUrl(courier: string | null, trackingNumber: string | null): string | null {
  if (!courier || !trackingNumber) return null;
  
  const courierLower = courier.toLowerCase();
  const tracking = encodeURIComponent(trackingNumber);
  
  if (courierLower.includes('dhl')) {
    return `https://www.dhl.com/en/express/tracking.html?AWB=${tracking}`;
  }
  if (courierLower.includes('fedex')) {
    return `https://www.fedex.com/fedextrack/?trknbr=${tracking}`;
  }
  if (courierLower.includes('tnt')) {
    return `https://www.tnt.com/express/en_us/site/tracking.html?searchType=con&cons=${tracking}`;
  }
  if (courierLower.includes('ups')) {
    return `https://www.ups.com/track?tracknum=${tracking}`;
  }
  if (courierLower.includes('sf') || courierLower.includes('shunfeng')) {
    return `https://www.sf-express.com/us/en/dynamic_function/waybill/#search/bill-number/${tracking}`;
  }
  if (courierLower.includes('ems')) {
    return `https://www.ems.post/en/global-network/tracking`;
  }
  
  return null;
}

export function SampleTrackingCard({ sample, canEdit }: SampleTrackingCardProps) {
  const trackingUrl = getTrackingUrl(sample.courier_name, sample.tracking_number);

  return (
    <div className="border rounded-lg p-4 bg-card">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">
            {sample.quantity} sample{sample.quantity > 1 ? 's' : ''}
          </span>
        </div>
        <Badge className={cn('text-xs', STATUS_STYLES[sample.status])}>
          {STATUS_LABELS[sample.status]}
        </Badge>
      </div>

      {/* Courier & Tracking */}
      {sample.courier_name && (
        <div className="mb-3">
          <div className="flex items-center gap-2 text-sm">
            <Truck className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">{sample.courier_name}</span>
          </div>
          {sample.tracking_number && (
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {sample.tracking_number}
              </code>
              {trackingUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  asChild
                >
                  <a href={trackingUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                    Track
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        {sample.shipped_date && (
          <div>
            <span className="block font-medium text-foreground">Shipped</span>
            {format(new Date(sample.shipped_date), 'dd/MM/yyyy')}
          </div>
        )}
        {sample.estimated_arrival && !sample.actual_arrival && (
          <div>
            <span className="block font-medium text-foreground">ETA</span>
            {format(new Date(sample.estimated_arrival), 'dd/MM/yyyy')}
          </div>
        )}
        {sample.actual_arrival && (
          <div>
            <span className="block font-medium text-green-600">Arrived</span>
            {format(new Date(sample.actual_arrival), 'dd/MM/yyyy')}
          </div>
        )}
      </div>

      {/* Notes */}
      {sample.notes && (
        <p className="mt-3 text-xs text-muted-foreground border-t pt-2">
          {sample.notes}
        </p>
      )}
    </div>
  );
}
