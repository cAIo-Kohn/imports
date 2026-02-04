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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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

interface RequestCommercialDataModalProps {
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

export function RequestCommercialDataModal({
  open,
  onOpenChange,
  cardId,
  cardTitle,
}: RequestCommercialDataModalProps) {
  const { user } = useAuth();
  const { createTask, isCreating } = useCardTasks(cardId);
  const { updateWorkflow } = useCardWorkflow(cardId);
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
      const task = await createTask({
        task_type: 'commercial_request',
        assigned_to_role: assignType === 'role' ? selectedRole : undefined,
        assigned_to_users: assignType === 'user' && selectedUserId ? [selectedUserId] : [],
        metadata: { notes: notes || undefined },
      });

      // Log to timeline
      await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'message',
        content: `📋 Requested commercial data${notes ? `: "${notes}"` : ''}`,
        metadata: { task_id: task.id, task_type: 'commercial_request' },
      });

      // Update workflow status
      const targetRole = assignType === 'role' ? selectedRole : 'trader';
      await updateWorkflow({
        workflowStatus: 'commercial_requested',
        reason: 'Commercial data requested',
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
        type: 'commercial_request',
        title: '{name} requested commercial data',
        content: `Commercial data needed for "${cardTitle}"`,
      });

      toast({ title: 'Commercial data requested' });
      onOpenChange(false);
      setNotes('');
    } catch (error) {
      console.error('Failed to create task:', error);
      toast({
        title: 'Error',
        description: 'Failed to request commercial data',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Commercial Data</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Assign to</Label>
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
              placeholder="E.g., Please provide FOB price for 40HQ container"
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
