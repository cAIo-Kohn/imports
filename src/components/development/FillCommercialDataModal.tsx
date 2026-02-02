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

interface FillCommercialDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: CardTask;
  cardTitle: string;
}

const CONTAINER_TYPES = [
  { value: '20ft', label: '20ft Container' },
  { value: '40ft', label: '40ft Container' },
  { value: '40hq', label: '40ft High Cube' },
];

export function FillCommercialDataModal({
  open,
  onOpenChange,
  task,
  cardTitle,
}: FillCommercialDataModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [fobPrice, setFobPrice] = useState('');
  const [moq, setMoq] = useState('');
  const [qtyPerContainer, setQtyPerContainer] = useState('');
  const [containerType, setContainerType] = useState('');

  const isValid = fobPrice && moq && qtyPerContainer && containerType;

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      const commercialData = {
        fob_price_usd: parseFloat(fobPrice),
        moq: parseInt(moq, 10),
        qty_per_container: parseInt(qtyPerContainer, 10),
        container_type: containerType,
      };

      // Update the card with commercial data
      const { error: cardError } = await supabase
        .from('development_items')
        .update(commercialData)
        .eq('id', task.card_id);

      if (cardError) throw cardError;

      // Update the task with the data and reassign to requester
      const { error: taskError } = await supabase
        .from('development_card_tasks')
        .update({
          status: 'in_progress',
          assigned_to_users: [task.created_by],
          assigned_to_role: null,
          metadata: {
            ...task.metadata,
            ...commercialData,
            filled_by: user.id,
            filled_at: new Date().toISOString(),
          },
        })
        .eq('id', task.id);

      if (taskError) throw taskError;

      // Log to timeline
      await supabase.from('development_card_activity').insert({
        card_id: task.card_id,
        user_id: user.id,
        activity_type: 'message',
        content: `💰 Commercial data provided: $${fobPrice} FOB, MOQ ${moq}, ${qtyPerContainer}/${containerType}`,
        metadata: { task_id: task.id, task_type: 'commercial_data_filled', ...commercialData },
      });

      // Notify the requester
      await sendTaskNotification({
        recipientUserIds: [task.created_by],
        triggeredBy: user.id,
        cardId: task.card_id,
        taskId: task.id,
        type: 'commercial_filled',
        title: '{name} provided commercial data',
        content: `Commercial data for "${cardTitle}" is ready for confirmation`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card-tasks', task.card_id] });
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', task.card_id] });
      toast({ title: 'Commercial data submitted' });
      onOpenChange(false);
      // Reset form
      setFobPrice('');
      setMoq('');
      setQtyPerContainer('');
      setContainerType('');
    },
    onError: (error) => {
      console.error('Failed to fill commercial data:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit commercial data',
        variant: 'destructive',
      });
    },
  });

  const requesterName = task.created_by_profile?.full_name || 'the requester';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fill Commercial Data</DialogTitle>
          <DialogDescription>
            All 4 fields are required. {requesterName} will be notified to confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="fob-price">FOB Price (USD) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="fob-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={fobPrice}
                onChange={(e) => setFobPrice(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="moq">MOQ *</Label>
            <Input
              id="moq"
              type="number"
              min="0"
              placeholder="1000"
              value={moq}
              onChange={(e) => setMoq(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qty-container">Qty / Container *</Label>
            <Input
              id="qty-container"
              type="number"
              min="0"
              placeholder="50000"
              value={qtyPerContainer}
              onChange={(e) => setQtyPerContainer(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="container-type">Container Type *</Label>
            <Select value={containerType} onValueChange={setContainerType}>
              <SelectTrigger id="container-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {CONTAINER_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => submitMutation.mutate()} 
            disabled={!isValid || submitMutation.isPending}
          >
            {submitMutation.isPending ? 'Submitting...' : 'Confirm & Notify Requester'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
