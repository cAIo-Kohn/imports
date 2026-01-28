import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ExternalLink, Package, Truck, CheckCircle, XCircle, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { SampleReviewSection } from './SampleReviewSection';

interface Sample {
  id: string;
  item_id: string;
  courier_name: string | null;
  tracking_number: string | null;
  shipped_date: string | null;
  estimated_arrival: string | null;
  actual_arrival: string | null;
  quantity: number | null;
  notes: string | null;
  status: string | null;
  decision: string | null;
  decision_notes: string | null;
  report_url: string | null;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
}

interface SampleTrackingCardProps {
  sample: Sample;
  canEdit: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700',
  in_transit: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  returned: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  returned: 'Returned',
};

const DECISION_STYLES: Record<string, string> = {
  approved: 'bg-green-100 text-green-700 border-green-300',
  rejected: 'bg-red-100 text-red-700 border-red-300',
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const trackingUrl = getTrackingUrl(sample.courier_name, sample.tracking_number);

  // Mark as arrived mutation
  const markArrivedMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      // Update sample status
      const { error: updateError } = await supabase
        .from('development_item_samples')
        .update({ 
          status: 'delivered', 
          actual_arrival: new Date().toISOString().split('T')[0],
        })
        .eq('id', sample.id);

      if (updateError) throw updateError;

      // Log activity
      const { error: activityError } = await supabase
        .from('development_card_activity')
        .insert({
          card_id: sample.item_id,
          user_id: user.id,
          activity_type: 'sample_arrived',
          content: 'Sample arrived',
          metadata: { sample_id: sample.id },
        });

      if (activityError) throw activityError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-item-samples', sample.item_id] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', sample.item_id] });
      toast({ title: 'Sample marked as arrived' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleMarkArrived = () => {
    markArrivedMutation.mutate();
  };

  return (
    <div className={cn(
      "border rounded-lg p-4 bg-card",
      sample.decision === 'approved' && "border-green-300 bg-green-50/50",
      sample.decision === 'rejected' && "border-red-300 bg-red-50/50"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">
            {sample.quantity} sample{sample.quantity > 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {sample.decision && (
            <Badge className={cn('text-xs', DECISION_STYLES[sample.decision])}>
              {sample.decision === 'approved' ? (
                <><CheckCircle className="h-3 w-3 mr-1" /> Approved</>
              ) : (
                <><XCircle className="h-3 w-3 mr-1" /> Rejected</>
              )}
            </Badge>
          )}
          <Badge className={cn('text-xs', STATUS_STYLES[sample.status])}>
            {STATUS_LABELS[sample.status]}
          </Badge>
        </div>
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

      {/* Decision Notes */}
      {sample.decision_notes && (
        <div className="mt-3 border-t pt-2">
          <span className="text-xs font-medium text-foreground">Review Notes:</span>
          <p className="text-xs text-muted-foreground mt-1">{sample.decision_notes}</p>
        </div>
      )}

      {/* Report Link */}
      {sample.report_url && (
        <div className="mt-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            asChild
          >
            <a href={sample.report_url} target="_blank" rel="noopener noreferrer">
              <FileText className="h-3 w-3 mr-1" />
              View Report
            </a>
          </Button>
        </div>
      )}

      {/* Mark as Arrived Button - Only show when in_transit */}
      {sample.status === 'in_transit' && canEdit && (
        <div className="mt-3 pt-3 border-t">
          <Button
            size="sm"
            variant="outline"
            onClick={handleMarkArrived}
            disabled={markArrivedMutation.isPending}
            className="w-full border-green-300 text-green-700 hover:bg-green-50"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            {markArrivedMutation.isPending ? 'Marking...' : 'Mark as Arrived'}
          </Button>
        </div>
      )}

      {/* Sample Review Section - Only show when delivered and no decision yet */}
      {sample.status === 'delivered' && !sample.decision && canEdit && (
        <SampleReviewSection 
          cardId={sample.item_id} 
          sample={sample as any}
        />
      )}
    </div>
  );
}
