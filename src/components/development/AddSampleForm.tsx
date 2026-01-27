import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
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

interface AddSampleFormProps {
  itemId: string;
}

type SampleStatus = 'pending' | 'in_transit' | 'delivered' | 'returned';

const COURIER_OPTIONS = [
  'DHL',
  'FedEx',
  'TNT',
  'UPS',
  'SF Express',
  'EMS',
  'Other',
];

export function AddSampleForm({ itemId }: AddSampleFormProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippedDate, setShippedDate] = useState('');
  const [estimatedArrival, setEstimatedArrival] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<SampleStatus>('pending');

  const createMutation = useMutation({
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
      resetForm();
      setIsOpen(false);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add sample', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setCourierName('');
    setTrackingNumber('');
    setShippedDate('');
    setEstimatedArrival('');
    setQuantity('1');
    setNotes('');
    setStatus('pending');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Sample Tracking
          </span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-4">
        <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="courier">Courier</Label>
              <Select value={courierName} onValueChange={setCourierName}>
                <SelectTrigger>
                  <SelectValue placeholder="Select courier" />
                </SelectTrigger>
                <SelectContent>
                  {COURIER_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tracking">Tracking Number</Label>
              <Input
                id="tracking"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g., 1234567890"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="shipped">Shipped Date</Label>
              <Input
                id="shipped"
                type="date"
                value={shippedDate}
                onChange={(e) => setShippedDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eta">Est. Arrival</Label>
              <Input
                id="eta"
                type="date"
                value={estimatedArrival}
                onChange={(e) => setEstimatedArrival(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as SampleStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Adding...' : 'Add Sample'}
            </Button>
          </div>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}
