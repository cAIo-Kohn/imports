import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { sendTaskNotification } from '@/hooks/useCardTasks';
import type { CardTask } from '@/hooks/useCardTasks';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

interface AddTrackingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: CardTask;
  cardTitle: string;
}

const COURIERS = [
  { value: 'DHL', label: 'DHL' },
  { value: 'FedEx', label: 'FedEx' },
  { value: 'UPS', label: 'UPS' },
  { value: 'TNT', label: 'TNT' },
  { value: 'SF Express', label: 'SF Express' },
  { value: 'Other', label: 'Other' },
];

export function AddTrackingModal({
  open,
  onOpenChange,
  task,
  cardTitle,
}: AddTrackingModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [courier, setCourier] = useState('DHL');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippedDate, setShippedDate] = useState(new Date().toISOString().split('T')[0]);
  const [estimatedArrival, setEstimatedArrival] = useState('');
  const [quantity, setQuantity] = useState(String(task.metadata?.quantity || 1));

  const isValid = courier && trackingNumber;

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      const trackingData = {
        courier_name: courier,
        tracking_number: trackingNumber,
        shipped_date: shippedDate || null,
        estimated_arrival: estimatedArrival || null,
        quantity: parseInt(quantity, 10) || 1,
        status: 'in_transit' as const,
      };

      // Update the sample record if exists
      if (task.sample_id) {
        const { error: sampleError } = await supabase
          .from('development_item_samples')
          .update(trackingData)
          .eq('id', task.sample_id);

        if (sampleError) throw sampleError;
      }

      // Update the task and reassign to requester
      const { error: taskError } = await supabase
        .from('development_card_tasks')
        .update({
          status: 'in_progress',
          assigned_to_users: [task.created_by],
          assigned_to_role: null,
          metadata: {
            ...task.metadata,
            ...trackingData,
            shipped_by: user.id,
            shipped_at: new Date().toISOString(),
          },
        })
        .eq('id', task.id);

      if (taskError) throw taskError;

      // Log to timeline
      await supabase.from('development_card_activity').insert({
        card_id: task.card_id,
        user_id: user.id,
        activity_type: 'message',
        content: `🚚 Sample shipped via ${courier}: ${trackingNumber}${estimatedArrival ? ` (ETA: ${estimatedArrival})` : ''}`,
        metadata: { task_id: task.id, sample_id: task.sample_id, task_type: 'sample_shipped', ...trackingData },
      });

      // Notify the requester
      await sendTaskNotification({
        recipientUserIds: [task.created_by],
        triggeredBy: user.id,
        cardId: task.card_id,
        taskId: task.id,
        type: 'sample_shipped',
        title: '{name} shipped the sample',
        content: `Sample for "${cardTitle}" shipped via ${courier} - ${trackingNumber}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card-tasks', task.card_id] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', task.card_id] });
      queryClient.invalidateQueries({ queryKey: ['development-item-samples', task.card_id] });
      toast({ title: 'Tracking added' });
      onOpenChange(false);
      // Reset form
      setCourier('DHL');
      setTrackingNumber('');
      setShippedDate(new Date().toISOString().split('T')[0]);
      setEstimatedArrival('');
    },
    onError: (error: Error & { details?: string }) => {
      console.error('Failed to add tracking:', error);
      const errorMessage = error.message || 'Failed to add tracking information';
      const details = error.details ? `: ${error.details}` : '';
      toast({
        title: 'Error',
        description: `${errorMessage}${details}`,
        variant: 'destructive',
      });
    },
  });

  const requesterName = task.created_by_profile?.full_name || 'the requester';
  const requestedQty = (task.metadata?.quantity as number) || 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Tracking & Ship</DialogTitle>
          <DialogDescription>
            Sample Request ({requestedQty} pcs) by {requesterName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="courier">Courier *</Label>
              <Select value={courier} onValueChange={setCourier}>
                <SelectTrigger id="courier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COURIERS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tracking">Tracking Number *</Label>
              <Input
                id="tracking"
                placeholder="1234567890"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shipped-date">Shipped Date</Label>
              <Input
                id="shipped-date"
                type="date"
                value={shippedDate}
                onChange={(e) => setShippedDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eta">ETA</Label>
              <Input
                id="eta"
                type="date"
                value={estimatedArrival}
                onChange={(e) => setEstimatedArrival(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="qty">Quantity</Label>
              <Input
                id="qty"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {requesterName} will be notified that the sample is on its way.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => submitMutation.mutate()} 
            disabled={!isValid || submitMutation.isPending}
          >
            {submitMutation.isPending ? 'Shipping...' : 'Ship & Notify'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
