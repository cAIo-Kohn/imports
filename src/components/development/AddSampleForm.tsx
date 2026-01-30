import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, ChevronDown, ChevronUp, Send, Package } from 'lucide-react';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AddSampleFormProps {
  itemId: string;
  currentOwner?: 'mor' | 'arc';
  onSampleRequested?: () => void;
}

type SampleStatus = 'pending' | 'in_transit' | 'delivered' | 'returned';
type FormMode = 'request' | 'tracking';

const COURIER_OPTIONS = [
  'DHL',
  'FedEx',
  'TNT',
  'UPS',
  'SF Express',
  'EMS',
  'Other',
];

export function AddSampleForm({ itemId, currentOwner, onSampleRequested }: AddSampleFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('request');
  
  // Request sample state
  const [requestQuantity, setRequestQuantity] = useState('1');
  const [requestNotes, setRequestNotes] = useState('');

  // Tracking form state
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippedDate, setShippedDate] = useState('');
  const [estimatedArrival, setEstimatedArrival] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<SampleStatus>('pending');

  // Request sample mutation (Brazil → China)
  const requestSampleMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      const targetOwner = 'arc';
      const fromOwner = currentOwner || 'mor';

      // Create a sample entry with "pending" status (waiting for China to ship)
      const { error: sampleError } = await supabase.from('development_item_samples').insert({
        item_id: itemId,
        quantity: parseInt(requestQuantity) || 1,
        notes: requestNotes || null,
        status: 'pending',
      });
      if (sampleError) throw sampleError;

      // Log the request activity with embedded move info - creates its own thread
      const { data: activityData, error: activityError } = await supabase.from('development_card_activity').insert({
        card_id: itemId,
        user_id: user.id,
        activity_type: 'sample_requested',
        content: `Requested ${requestQuantity} sample(s)${requestNotes ? `: ${requestNotes}` : ''}`,
        thread_title: 'Sample Request',
        metadata: { 
          quantity: parseInt(requestQuantity) || 1, 
          notes: requestNotes || null,
          moved_from: fromOwner,
          moved_to: targetOwner,
        },
        pending_for_team: targetOwner, // ARC (China) needs to add tracking
      }).select('id').single();

      if (activityError) throw activityError;

      // Set thread_id and thread_root_id to itself (new thread root)
      if (activityData?.id) {
        await supabase.from('development_card_activity')
          .update({ thread_id: activityData.id, thread_root_id: activityData.id })
          .eq('id', activityData.id);
      }

      // Update pending action and move card to ARC (China)
      await (supabase.from('development_items') as any)
        .update({
          pending_action_type: 'sample_pending',
          pending_action_due_at: null,
          pending_action_snoozed_until: null,
          pending_action_snoozed_by: null,
          current_owner: targetOwner,
          is_new_for_other_team: true,
        })
        .eq('id', itemId);

      // NO separate ownership_change entry - move is embedded in sample_requested activity
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-item-samples', itemId] });
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', itemId] });
      toast({ title: 'Sample requested', description: 'Card moved to ARC (China) for fulfillment' });
      resetRequestForm();
      setIsOpen(false);
      onSampleRequested?.();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to request sample', variant: 'destructive' });
    },
  });

  // Add tracking mutation
  const createTrackingMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('development_item_samples').insert({
        item_id: itemId,
        courier_name: courierName || null,
        tracking_number: trackingNumber || null,
        shipped_date: shippedDate || null,
        estimated_arrival: estimatedArrival || null,
        quantity: parseInt(quantity) || 1,
        notes: notes || null,
        status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-item-samples', itemId] });
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      toast({ title: 'Success', description: 'Sample tracking added' });
      resetTrackingForm();
      setIsOpen(false);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add sample', variant: 'destructive' });
    },
  });

  const resetRequestForm = () => {
    setRequestQuantity('1');
    setRequestNotes('');
  };

  const resetTrackingForm = () => {
    setCourierName('');
    setTrackingNumber('');
    setShippedDate('');
    setEstimatedArrival('');
    setQuantity('1');
    setNotes('');
    setStatus('pending');
  };

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    requestSampleMutation.mutate();
  };

  const handleTrackingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTrackingMutation.mutate();
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between h-9">
          <span className="flex items-center gap-2 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Add Sample
          </span>
          {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-3">
        {/* Mode Toggle */}
        <div className="flex gap-1 mb-3 p-1 bg-muted rounded-md">
          <Button
            type="button"
            variant={formMode === 'request' ? 'secondary' : 'ghost'}
            size="sm"
            className={cn("flex-1 h-7 text-xs gap-1", formMode === 'request' && "shadow-sm")}
            onClick={() => setFormMode('request')}
          >
            <Send className="h-3 w-3" />
            Request Sample
          </Button>
          <Button
            type="button"
            variant={formMode === 'tracking' ? 'secondary' : 'ghost'}
            size="sm"
            className={cn("flex-1 h-7 text-xs gap-1", formMode === 'tracking' && "shadow-sm")}
            onClick={() => setFormMode('tracking')}
          >
            <Package className="h-3 w-3" />
            Add Tracking
          </Button>
        </div>

        {/* Request Sample Form */}
        {formMode === 'request' && (
          <form onSubmit={handleRequestSubmit} className="space-y-3 p-3 border rounded-lg bg-muted/30">
            <p className="text-[11px] text-muted-foreground">
              Request samples from the supplier. This will move the card to ARC (China) for fulfillment.
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="req-quantity" className="text-[10px]">Quantity</Label>
                <Input
                  id="req-quantity"
                  type="number"
                  min="1"
                  value={requestQuantity}
                  onChange={(e) => setRequestQuantity(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="req-notes" className="text-[10px]">Notes (optional)</Label>
              <Textarea
                id="req-notes"
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                placeholder="e.g., Need 2 colors, include packaging..."
                rows={2}
                className="text-xs"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="ghost" 
                size="sm"
                className="h-7 text-xs"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                size="sm"
                className="h-7 text-xs"
                disabled={requestSampleMutation.isPending}
              >
                <Send className="h-3 w-3 mr-1" />
                {requestSampleMutation.isPending ? 'Requesting...' : 'Request & Move to ARC'}
              </Button>
            </div>
          </form>
        )}

        {/* Add Tracking Form */}
        {formMode === 'tracking' && (
          <form onSubmit={handleTrackingSubmit} className="space-y-3 p-3 border rounded-lg bg-muted/30">
            <p className="text-[11px] text-muted-foreground">
              Add tracking details for a shipped sample.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="courier" className="text-[10px]">Courier</Label>
                <Select value={courierName} onValueChange={setCourierName}>
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
                <Label htmlFor="tracking" className="text-[10px]">Tracking Number</Label>
                <Input
                  id="tracking"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="e.g., 1234567890"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="shipped" className="text-[10px]">Shipped</Label>
                <Input
                  id="shipped"
                  type="date"
                  value={shippedDate}
                  onChange={(e) => setShippedDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="eta" className="text-[10px]">Est. Arrival</Label>
                <Input
                  id="eta"
                  type="date"
                  value={estimatedArrival}
                  onChange={(e) => setEstimatedArrival(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="quantity" className="text-[10px]">Qty</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px]">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as SampleStatus)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                  <SelectItem value="in_transit" className="text-xs">In Transit</SelectItem>
                  <SelectItem value="delivered" className="text-xs">Delivered</SelectItem>
                  <SelectItem value="returned" className="text-xs">Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="notes" className="text-[10px]">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={2}
                className="text-xs"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="ghost" 
                size="sm"
                className="h-7 text-xs"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                size="sm"
                className="h-7 text-xs"
                disabled={createTrackingMutation.isPending}
              >
                {createTrackingMutation.isPending ? 'Adding...' : 'Add Tracking'}
              </Button>
            </div>
          </form>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
