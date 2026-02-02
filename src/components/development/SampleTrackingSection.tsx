import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { 
  Package, Truck, CheckCircle, XCircle, ExternalLink, Plus, 
  Send, AlertTriangle, FileText 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { SampleReviewSection } from './SampleReviewSection';

interface SampleTrackingSectionProps {
  cardId: string;
  currentOwner: 'mor' | 'arc';
  canEdit: boolean;
}

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

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  in_transit: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  returned: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  returned: 'Returned',
};

const COURIER_OPTIONS = ['DHL', 'FedEx', 'TNT', 'UPS', 'SF Express', 'EMS', 'Other'];

function getTrackingUrl(courier: string | null, trackingNumber: string | null): string | null {
  if (!courier || !trackingNumber) return null;
  
  const courierLower = courier.toLowerCase();
  const tracking = encodeURIComponent(trackingNumber);
  
  if (courierLower.includes('dhl')) return `https://www.dhl.com/en/express/tracking.html?AWB=${tracking}`;
  if (courierLower.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${tracking}`;
  if (courierLower.includes('tnt')) return `https://www.tnt.com/express/en_us/site/tracking.html?searchType=con&cons=${tracking}`;
  if (courierLower.includes('ups')) return `https://www.ups.com/track?tracknum=${tracking}`;
  if (courierLower.includes('sf')) return `https://www.sf-express.com/us/en/dynamic_function/waybill/#search/bill-number/${tracking}`;
  
  return null;
}

export function SampleTrackingSection({ cardId, currentOwner, canEdit }: SampleTrackingSectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formMode, setFormMode] = useState<'request' | 'tracking'>('request');
  
  // Form state
  const [requestQuantity, setRequestQuantity] = useState('1');
  const [requestNotes, setRequestNotes] = useState('');
  const [courier, setCourier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippedDate, setShippedDate] = useState('');
  const [estimatedArrival, setEstimatedArrival] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');

  // Fetch samples
  const { data: samples = [] } = useQuery({
    queryKey: ['development-item-samples', cardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('development_item_samples')
        .select('*')
        .eq('item_id', cardId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Sample[];
    },
  });

  // Request sample mutation
  const requestSampleMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase.from('development_item_samples').insert({
        item_id: cardId,
        quantity: parseInt(requestQuantity) || 1,
        notes: requestNotes || null,
        status: 'pending',
      });
      if (error) throw error;

      // Log activity
      await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'message',
        content: `Requested ${requestQuantity} sample(s)${requestNotes ? `: ${requestNotes}` : ''}`,
        metadata: { 
          type: 'sample_request',
          quantity: parseInt(requestQuantity) || 1,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-item-samples', cardId] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      toast({ title: 'Sample requested' });
      setRequestQuantity('1');
      setRequestNotes('');
      setShowAddForm(false);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to request sample', variant: 'destructive' });
    },
  });

  // Add tracking mutation
  const addTrackingMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase.from('development_item_samples').insert({
        item_id: cardId,
        courier_name: courier || null,
        tracking_number: trackingNumber || null,
        shipped_date: shippedDate || null,
        estimated_arrival: estimatedArrival || null,
        quantity: parseInt(quantity) || 1,
        notes: notes || null,
        status: 'in_transit',
      });
      if (error) throw error;

      // Log activity
      await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'message',
        content: `Sample shipped via ${courier}${trackingNumber ? ` (${trackingNumber})` : ''}`,
        metadata: { 
          type: 'sample_shipped',
          courier,
          tracking_number: trackingNumber,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-item-samples', cardId] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      toast({ title: 'Sample tracking added' });
      setCourier('');
      setTrackingNumber('');
      setShippedDate('');
      setEstimatedArrival('');
      setQuantity('1');
      setNotes('');
      setShowAddForm(false);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add tracking', variant: 'destructive' });
    },
  });

  // Mark as arrived mutation
  const markArrivedMutation = useMutation({
    mutationFn: async (sampleId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('development_item_samples')
        .update({ 
          status: 'delivered', 
          actual_arrival: new Date().toISOString().split('T')[0],
        })
        .eq('id', sampleId);
      if (error) throw error;

      await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'message',
        content: 'Sample arrived',
        metadata: { type: 'sample_arrived', sample_id: sampleId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-item-samples', cardId] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      toast({ title: 'Sample marked as arrived' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to mark arrived', variant: 'destructive' });
    },
  });

  const pendingSamples = samples.filter(s => s.status === 'pending');
  const inTransitSamples = samples.filter(s => s.status === 'in_transit');
  const deliveredSamples = samples.filter(s => s.status === 'delivered' && !s.decision);
  const reviewedSamples = samples.filter(s => s.decision);

  return (
    <div className="space-y-3">
      {/* Add Sample Button */}
      {canEdit && !showAddForm && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Sample
        </Button>
      )}

      {/* Add Sample Form */}
      {showAddForm && (
        <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
          {/* Mode Toggle */}
          <div className="flex gap-1 p-1 bg-muted rounded-md">
            <Button
              type="button"
              variant={formMode === 'request' ? 'secondary' : 'ghost'}
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => setFormMode('request')}
            >
              <Send className="h-3 w-3 mr-1" />
              Request
            </Button>
            <Button
              type="button"
              variant={formMode === 'tracking' ? 'secondary' : 'ghost'}
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => setFormMode('tracking')}
            >
              <Package className="h-3 w-3 mr-1" />
              Add Tracking
            </Button>
          </div>

          {formMode === 'request' ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={requestQuantity}
                    onChange={(e) => setRequestQuantity(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Notes (optional)</Label>
                <Textarea
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder="e.g., Need 2 colors..."
                  rows={2}
                  className="text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  className="h-7 text-xs" 
                  onClick={() => requestSampleMutation.mutate()}
                  disabled={requestSampleMutation.isPending}
                >
                  {requestSampleMutation.isPending ? 'Requesting...' : 'Request Sample'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Courier</Label>
                  <Select value={courier} onValueChange={setCourier}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {COURIER_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Tracking #</Label>
                  <Input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="123456..."
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Shipped</Label>
                  <Input
                    type="date"
                    value={shippedDate}
                    onChange={(e) => setShippedDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">ETA</Label>
                  <Input
                    type="date"
                    value={estimatedArrival}
                    onChange={(e) => setEstimatedArrival(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Qty</Label>
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  className="h-7 text-xs" 
                  onClick={() => addTrackingMutation.mutate()}
                  disabled={addTrackingMutation.isPending || !courier}
                >
                  {addTrackingMutation.isPending ? 'Adding...' : 'Add Tracking'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Samples List */}
      {samples.length === 0 && !showAddForm && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No samples yet
        </p>
      )}

      {/* Pending Samples */}
      {pendingSamples.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-amber-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Pending ({pendingSamples.length})
          </h5>
          {pendingSamples.map((sample) => (
            <SampleCard key={sample.id} sample={sample} canEdit={canEdit} cardId={cardId} />
          ))}
        </div>
      )}

      {/* In Transit Samples */}
      {inTransitSamples.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-blue-600 flex items-center gap-1">
            <Truck className="h-3 w-3" />
            In Transit ({inTransitSamples.length})
          </h5>
          {inTransitSamples.map((sample) => (
            <SampleCard 
              key={sample.id} 
              sample={sample} 
              canEdit={canEdit} 
              cardId={cardId}
              onMarkArrived={() => markArrivedMutation.mutate(sample.id)}
              isMarkingArrived={markArrivedMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Delivered (Awaiting Review) */}
      {deliveredSamples.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-purple-600 flex items-center gap-1">
            <Package className="h-3 w-3" />
            Awaiting Review ({deliveredSamples.length})
          </h5>
          {deliveredSamples.map((sample) => (
            <SampleCard 
              key={sample.id} 
              sample={sample} 
              canEdit={canEdit} 
              cardId={cardId}
              showReview
            />
          ))}
        </div>
      )}

      {/* Reviewed Samples */}
      {reviewedSamples.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-green-600 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Reviewed ({reviewedSamples.length})
          </h5>
          {reviewedSamples.map((sample) => (
            <SampleCard key={sample.id} sample={sample} canEdit={false} cardId={cardId} />
          ))}
        </div>
      )}
    </div>
  );
}

interface SampleCardProps {
  sample: Sample;
  canEdit: boolean;
  cardId: string;
  onMarkArrived?: () => void;
  isMarkingArrived?: boolean;
  showReview?: boolean;
}

function SampleCard({ sample, canEdit, cardId, onMarkArrived, isMarkingArrived, showReview }: SampleCardProps) {
  const trackingUrl = getTrackingUrl(sample.courier_name, sample.tracking_number);

  return (
    <div className={cn(
      "border rounded-lg p-3 text-xs",
      sample.decision === 'approved' && "border-green-300 bg-green-50/50 dark:bg-green-900/20",
      sample.decision === 'rejected' && "border-red-300 bg-red-50/50 dark:bg-red-900/20"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{sample.quantity} sample{(sample.quantity || 1) > 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1">
          {sample.decision && (
            <Badge className={cn(
              'text-[10px]',
              sample.decision === 'approved' 
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
            )}>
              {sample.decision === 'approved' ? (
                <><CheckCircle className="h-2.5 w-2.5 mr-1" />Approved</>
              ) : (
                <><XCircle className="h-2.5 w-2.5 mr-1" />Rejected</>
              )}
            </Badge>
          )}
          <Badge className={cn('text-[10px]', STATUS_STYLES[sample.status || 'pending'])}>
            {STATUS_LABELS[sample.status || 'pending']}
          </Badge>
        </div>
      </div>

      {/* Courier & Tracking */}
      {sample.courier_name && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-1.5">
            <Truck className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">{sample.courier_name}</span>
          </div>
          {sample.tracking_number && (
            <div className="flex items-center gap-2">
              <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                {sample.tracking_number}
              </code>
              {trackingUrl && (
                <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-0.5">
                  <ExternalLink className="h-3 w-3" />
                  Track
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dates */}
      <div className="mt-2 flex gap-4 text-[10px] text-muted-foreground">
        {sample.shipped_date && (
          <span>Shipped: {format(new Date(sample.shipped_date), 'dd/MM/yy')}</span>
        )}
        {sample.estimated_arrival && !sample.actual_arrival && (
          <span>ETA: {format(new Date(sample.estimated_arrival), 'dd/MM/yy')}</span>
        )}
        {sample.actual_arrival && (
          <span className="text-green-600">Arrived: {format(new Date(sample.actual_arrival), 'dd/MM/yy')}</span>
        )}
      </div>

      {/* Notes */}
      {sample.notes && (
        <p className="mt-2 text-muted-foreground">{sample.notes}</p>
      )}

      {/* Decision Notes */}
      {sample.decision_notes && (
        <div className="mt-2 pt-2 border-t">
          <span className="font-medium">Review:</span> {sample.decision_notes}
        </div>
      )}

      {/* Report Link */}
      {sample.report_url && (
        <a 
          href={sample.report_url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
        >
          <FileText className="h-3 w-3" />
          View Report
        </a>
      )}

      {/* Mark as Arrived Button */}
      {sample.status === 'in_transit' && canEdit && onMarkArrived && (
        <Button
          size="sm"
          variant="outline"
          className="w-full mt-2 h-7 text-xs border-green-300 text-green-700 hover:bg-green-50"
          onClick={onMarkArrived}
          disabled={isMarkingArrived}
        >
          <CheckCircle className="h-3 w-3 mr-1" />
          {isMarkingArrived ? 'Marking...' : 'Mark as Arrived'}
        </Button>
      )}

      {/* Sample Review Section */}
      {showReview && canEdit && (
        <SampleReviewSection cardId={cardId} sample={sample as any} />
      )}
    </div>
  );
}