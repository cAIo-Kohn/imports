import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Truck, X, Send, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

interface InlineSampleShipFormProps {
  cardId: string;
  currentOwner: 'mor' | 'arc';
  onClose: () => void;
  onSuccess: () => void;
}

export function InlineSampleShipForm({ 
  cardId, 
  currentOwner, 
  onClose, 
  onSuccess 
}: InlineSampleShipFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [courier, setCourier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippedDate, setShippedDate] = useState(new Date().toISOString().split('T')[0]);
  const [estimatedArrival, setEstimatedArrival] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');

  const shipSampleMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      if (!courier || !trackingNumber) throw new Error('Courier and tracking number are required');

      // 1. Create sample record
      const { data: sampleData, error: sampleError } = await supabase
        .from('development_item_samples')
        .insert({
          item_id: cardId,
          courier_name: courier,
          tracking_number: trackingNumber,
          shipped_date: shippedDate || null,
          estimated_arrival: estimatedArrival || null,
          quantity: parseInt(quantity) || 1,
          notes: notes || null,
          status: 'in_transit',
        })
        .select('id')
        .single();

      if (sampleError) throw sampleError;

      // 2. Log sample_shipped activity
      const { error: activityError } = await supabase
        .from('development_card_activity')
        .insert({
          card_id: cardId,
          user_id: user.id,
          activity_type: 'sample_shipped',
          content: `Sample shipped via ${courier}`,
          metadata: { 
            sample_id: sampleData.id,
            courier, 
            tracking_number: trackingNumber,
            estimated_arrival: estimatedArrival,
          },
        });

      if (activityError) throw activityError;

      // 3. Move card to MOR (Brazil) and set pending action for sample in transit
      const targetOwner = 'mor';
      const updateData: Record<string, any> = { 
        current_owner: targetOwner,
        is_new_for_other_team: true,
        pending_action_type: 'sample_in_transit',
      };
      
      // Set due date from ETA if provided
      if (estimatedArrival) {
        updateData.pending_action_due_at = new Date(estimatedArrival).toISOString();
      }
      
      const { error: moveError } = await (supabase.from('development_items') as any)
        .update(updateData)
        .eq('id', cardId);

      if (moveError) throw moveError;

      // 4. Log ownership change
      await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'ownership_change',
        content: 'Card moved to MOR (Brazil)',
        metadata: { new_owner: targetOwner, trigger: 'sample_shipped' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-item-samples', cardId] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      toast({ title: 'Sample shipped & card moved to Brazil' });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    shipSampleMutation.mutate();
  };

  const canSubmit = courier.trim() && trackingNumber.trim();

  return (
    <div className="mt-3 p-4 border-2 border-cyan-300 bg-cyan-50 dark:bg-cyan-950/30 dark:border-cyan-700 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-sm flex items-center gap-2 text-cyan-800 dark:text-cyan-200">
          <Truck className="h-4 w-4" />
          Add Sample Shipment
        </h4>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="courier" className="text-xs">Courier *</Label>
            <Input
              id="courier"
              placeholder="DHL, FedEx, TNT..."
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              className="h-8 text-sm bg-white dark:bg-background"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="tracking" className="text-xs">Tracking Number *</Label>
            <Input
              id="tracking"
              placeholder="Enter tracking number"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="h-8 text-sm bg-white dark:bg-background"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="shipped-date" className="text-xs flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Shipped Date
            </Label>
            <Input
              id="shipped-date"
              type="date"
              value={shippedDate}
              onChange={(e) => setShippedDate(e.target.value)}
              className="h-8 text-sm bg-white dark:bg-background"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="eta" className="text-xs flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Estimated Arrival
            </Label>
            <Input
              id="eta"
              type="date"
              value={estimatedArrival}
              onChange={(e) => setEstimatedArrival(e.target.value)}
              className="h-8 text-sm bg-white dark:bg-background"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="quantity" className="text-xs">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-8 text-sm bg-white dark:bg-background"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="notes" className="text-xs">Notes (optional)</Label>
          <Textarea
            id="notes"
            placeholder="Any additional notes about this shipment..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="text-sm bg-white dark:bg-background"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!canSubmit || shipSampleMutation.isPending}
            className="bg-cyan-600 hover:bg-cyan-700"
          >
            <Send className="h-3 w-3 mr-1" />
            {shipSampleMutation.isPending ? 'Shipping...' : 'Ship & Move Card to Brazil'}
          </Button>
        </div>
      </form>
    </div>
  );
}
