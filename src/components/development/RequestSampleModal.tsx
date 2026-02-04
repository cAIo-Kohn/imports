import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCardTasks, sendTaskNotification } from '@/hooks/useCardTasks';
import { useCardWorkflow } from '@/hooks/useCardWorkflow';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

interface RequestSampleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  cardTitle: string;
}

const ROLES = [
  { value: 'trader', label: 'Trader (Team)' },
  { value: 'buyer', label: 'Buyer (Team)' },
  { value: 'quality', label: 'Quality (Team)' },
  { value: 'marketing', label: 'Marketing (Team)' },
];

export function RequestSampleModal({
  open,
  onOpenChange,
  cardId,
  cardTitle,
}: RequestSampleModalProps) {
  const { user } = useAuth();
  const { createTask, isCreating } = useCardTasks(cardId);
  const { updateWorkflow } = useCardWorkflow(cardId);
  const [quantity, setQuantity] = useState('1');
  const [assignType, setAssignType] = useState<'role' | 'user'>('role');
  const [selectedRole, setSelectedRole] = useState('trader');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch users for user assignment
  const { data: users = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async () => {
    if (!user?.id) return;

    try {
      // Create sample record
      const { data: sample, error: sampleError } = await supabase
        .from('development_item_samples')
        .insert({
          item_id: cardId,
          quantity: parseInt(quantity, 10) || 1,
          notes: notes || null,
          status: 'pending',
        })
        .select()
        .single();

      if (sampleError) throw sampleError;

      // Create task
      const task = await createTask({
        task_type: 'sample_request',
        assigned_to_role: assignType === 'role' ? selectedRole : undefined,
        assigned_to_users: assignType === 'user' && selectedUserId ? [selectedUserId] : [],
        metadata: { 
          quantity: parseInt(quantity, 10) || 1,
          notes: notes || undefined,
        },
        sample_id: sample.id,
      });

      // Log to timeline
      await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'message',
        content: `📦 Requested ${quantity} sample(s)${notes ? `: "${notes}"` : ''}`,
        metadata: { task_id: task.id, sample_id: sample.id, task_type: 'sample_request' },
      });

      // Update workflow status
      const targetRole = assignType === 'role' ? selectedRole : 'trader';
      await updateWorkflow({
        workflowStatus: 'sample_requested',
        reason: 'Sample requested',
        toRole: targetRole as 'buyer' | 'trader' | 'quality',
        taskId: task.id,
      });

      // Send notifications
      await sendTaskNotification({
        recipientRole: assignType === 'role' ? selectedRole : undefined,
        recipientUserIds: assignType === 'user' && selectedUserId ? [selectedUserId] : undefined,
        triggeredBy: user.id,
        cardId,
        taskId: task.id,
        type: 'sample_request',
        title: '{name} requested a sample',
        content: `${quantity} sample(s) needed for "${cardTitle}"`,
      });

      toast({ title: 'Sample requested' });
      onOpenChange(false);
      setQuantity('1');
      setNotes('');
    } catch (error) {
      console.error('Failed to create sample request:', error);
      toast({
        title: 'Error',
        description: 'Failed to request sample',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Sample</DialogTitle>
          <DialogDescription>
            The assigned team will be notified to send the sample.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
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

            <div className="space-y-2">
              <Label>Assign to *</Label>
              <Select value={assignType} onValueChange={(v) => setAssignType(v as 'role' | 'user')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="role">Team (Role)</SelectItem>
                  <SelectItem value="user">Specific User</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {assignType === 'role' && (
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {assignType === 'user' && (
            <div className="space-y-2">
              <Label>User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="E.g., Need blue and red color samples for quality check"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isCreating}>
            {isCreating ? 'Requesting...' : 'Request & Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
