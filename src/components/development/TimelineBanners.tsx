import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, differenceInDays } from 'date-fns';
import { 
  DollarSign, 
  Package, 
  Truck, 
  ExternalLink, 
  PackageCheck, 
  HelpCircle, 
  MessageCircle, 
  Upload,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

export interface Sample {
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
  created_at: string;
}

// Commercial Data Banner
interface CommercialDataBannerProps {
  fobPriceUsd: number;
  moq: number;
  qtyPerContainer: number;
  containerType: string;
  updatedAt?: string;
  onRequestSample: () => void;
  onAskQuestion: () => void;
  onAddComment: () => void;
  onUpload: () => void;
}

export function CommercialDataBanner({ 
  fobPriceUsd, 
  moq, 
  qtyPerContainer, 
  containerType,
  updatedAt,
  onRequestSample, 
  onAskQuestion, 
  onAddComment,
  onUpload,
}: CommercialDataBannerProps) {
  const [isRequesting, setIsRequesting] = useState(false);

  return (
    <div className="rounded-lg p-4 mb-4 border-2 bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium text-sm text-emerald-800 dark:text-emerald-200">Commercial Data</span>
        </div>
        {updatedAt && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            {updatedAt}
          </span>
        )}
      </div>
      
      {/* Data Display Card */}
      <div className="bg-white dark:bg-background rounded-lg p-3 border mb-3">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground text-xs block">FOB</span>
            <span className="font-semibold">${fobPriceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <div>
            <span className="text-muted-foreground text-xs block">MOQ</span>
            <span className="font-semibold">{moq.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-muted-foreground text-xs block">Qty/Container</span>
            <span className="font-semibold">{qtyPerContainer.toLocaleString()}/{containerType}</span>
          </div>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRequestSample}
          disabled={isRequesting}
          className="bg-white hover:bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:border-emerald-600 dark:text-emerald-200"
        >
          <Package className="h-3 w-3 mr-1" />
          Request Sample
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onAskQuestion}
          className="bg-white hover:bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:border-emerald-600 dark:text-emerald-200"
        >
          <HelpCircle className="h-3 w-3 mr-1" />
          Ask a Question
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onAddComment}
          className="bg-white hover:bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:border-emerald-600 dark:text-emerald-200"
        >
          <MessageCircle className="h-3 w-3 mr-1" />
          Add Comment
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onUpload}
          className="bg-white hover:bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:border-emerald-600 dark:text-emerald-200"
        >
          <Upload className="h-3 w-3 mr-1" />
          Upload
        </Button>
      </div>
    </div>
  );
}

// Sample In Transit Banner
interface SampleInTransitBannerProps {
  sample: Sample;
  cardId: string;
  onMarkArrived: () => void;
  onAskQuestion: () => void;
  onAddComment: () => void;
}

export function SampleInTransitBanner({ 
  sample, 
  cardId,
  onMarkArrived, 
  onAskQuestion, 
  onAddComment,
}: SampleInTransitBannerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const trackingUrl = getTrackingUrl(sample.courier_name, sample.tracking_number);

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

      // Update card pending action to sample_review
      const { error: cardError } = await (supabase.from('development_items') as any)
        .update({ 
          pending_action_type: 'sample_review',
          pending_action_due_at: null,
        })
        .eq('id', sample.item_id);

      if (cardError) throw cardError;

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
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      toast({ title: 'Sample marked as arrived' });
      onMarkArrived();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <div className="rounded-lg p-4 mb-4 border-2 bg-blue-50 border-blue-300 dark:bg-blue-950/30 dark:border-blue-700">
      <div className="flex items-center gap-2 mb-3">
        <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <span className="font-medium text-sm text-blue-800 dark:text-blue-200">Sample In Transit</span>
      </div>
      
      <div className="bg-white dark:bg-background rounded-lg p-3 border mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">{sample.courier_name || 'Courier'}</span>
            {sample.tracking_number && (
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {sample.tracking_number}
              </code>
            )}
          </div>
          {trackingUrl && (
            <Button variant="ghost" size="sm" asChild className="h-7">
              <a href={trackingUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                Track
              </a>
            </Button>
          )}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          {sample.shipped_date && (
            <span>Shipped: {format(parseISO(sample.shipped_date), 'dd/MM')}</span>
          )}
          {sample.estimated_arrival && (
            <span className="font-medium text-blue-600 dark:text-blue-400">
              ETA: {format(parseISO(sample.estimated_arrival), 'dd/MM')}
            </span>
          )}
          <span>{sample.quantity} pcs</span>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <Button 
          size="sm" 
          onClick={() => markArrivedMutation.mutate()}
          disabled={markArrivedMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <PackageCheck className="h-3 w-3 mr-1" />
          {markArrivedMutation.isPending ? 'Marking...' : 'Mark Arrived'}
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onAskQuestion}
          className="bg-white hover:bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-950 dark:hover:bg-blue-900 dark:border-blue-600 dark:text-blue-200"
        >
          <HelpCircle className="h-3 w-3 mr-1" />
          Ask a Question
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onAddComment}
          className="bg-white hover:bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-950 dark:hover:bg-blue-900 dark:border-blue-600 dark:text-blue-200"
        >
          <MessageCircle className="h-3 w-3 mr-1" />
          Add Comment
        </Button>
      </div>
    </div>
  );
}

// Sample Delivered Banner
interface SampleDeliveredBannerProps {
  sample: Sample;
  cardId: string;
  onReviewSample: (sampleId: string) => void;
  onAskQuestion: () => void;
}

export function SampleDeliveredBanner({ 
  sample, 
  cardId,
  onReviewSample, 
  onAskQuestion,
}: SampleDeliveredBannerProps) {
  const daysWaiting = sample.actual_arrival 
    ? differenceInDays(new Date(), parseISO(sample.actual_arrival))
    : 0;

  return (
    <div className="rounded-lg p-4 mb-4 border-2 bg-amber-50 border-amber-400 dark:bg-amber-950/30 dark:border-amber-600">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <span className="font-medium text-sm text-amber-800 dark:text-amber-200">Sample Delivered</span>
        </div>
        {daysWaiting > 0 && (
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
            Waiting {daysWaiting} day{daysWaiting !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      
      <div className="bg-white dark:bg-background rounded-lg p-3 border mb-3">
        <div className="flex items-center gap-2">
          {sample.courier_name && (
            <span className="font-medium">{sample.courier_name}</span>
          )}
          {sample.tracking_number && (
            <code className="text-xs bg-muted px-2 py-1 rounded">
              {sample.tracking_number}
            </code>
          )}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          {sample.actual_arrival && (
            <span className="font-medium text-green-600 dark:text-green-400">
              Arrived: {format(parseISO(sample.actual_arrival), 'dd/MM')}
            </span>
          )}
          <span>{sample.quantity} pcs</span>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <Button 
          size="sm" 
          onClick={() => onReviewSample(sample.id)}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          <CheckCircle className="h-3 w-3 mr-1" />
          Review Sample
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onAskQuestion}
          className="bg-white hover:bg-amber-100 border-amber-400 text-amber-700 dark:bg-amber-950 dark:hover:bg-amber-900 dark:border-amber-600 dark:text-amber-200"
        >
          <HelpCircle className="h-3 w-3 mr-1" />
          Ask a Question
        </Button>
      </div>
    </div>
  );
}
