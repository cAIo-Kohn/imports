import { useState, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { ProductSelector } from './ProductSelector';

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

  // Product selection for grouped cards
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(true);

  // Fetch products for this card (for item_groups)
  const { data: cardProducts = [] } = useQuery({
    queryKey: ['card-products', cardId],
    queryFn: async () => {
      const { data } = await supabase
        .from('development_card_products')
        .select('id, product_code, product_name, image_url')
        .eq('card_id', cardId)
        .order('created_at');
      return data || [];
    },
  });

  const isGroupedCard = cardProducts.length > 1;

  // Reset selection when modal opens
  useEffect(() => {
    if (open) {
      setSelectAll(true);
      setSelectedProductIds([]);
    }
  }, [open]);

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

  const handleToggleProduct = (productId: string) => {
    setSelectedProductIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedProductIds([]);
    }
  };

  const handleSubmit = async () => {
    if (!user?.id) return;

    // Validate product selection for grouped cards
    if (isGroupedCard && !selectAll && selectedProductIds.length === 0) {
      toast({
        title: 'Select products',
        description: 'Please select at least one product',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Build product metadata
      const productIds = selectAll
        ? cardProducts.map(p => p.id)
        : selectedProductIds;
      const productNames = selectAll
        ? cardProducts.map(p => p.product_name || p.product_code)
        : selectedProductIds.map(id => {
            const p = cardProducts.find(cp => cp.id === id);
            return p?.product_name || p?.product_code || '';
          });

      const task = await createTask({
        task_type: 'commercial_request',
        assigned_to_role: assignType === 'role' ? selectedRole : undefined,
        assigned_to_users: assignType === 'user' && selectedUserId ? [selectedUserId] : [],
        metadata: {
          notes: notes || undefined,
          product_ids: isGroupedCard ? productIds : undefined,
          product_names: isGroupedCard ? productNames : undefined,
          is_all_products: isGroupedCard ? selectAll : undefined,
        },
      });

      // Build product label for messages
      const productLabel = isGroupedCard
        ? selectAll
          ? '(all items)'
          : `(${productNames.join(', ')})`
        : '';

      // Log to timeline
      await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'message',
        content: `📋 Requested commercial data ${productLabel}${notes ? `: "${notes}"` : ''}`.trim(),
        metadata: {
          task_id: task.id,
          task_type: 'commercial_request',
          product_ids: isGroupedCard ? productIds : undefined,
          product_names: isGroupedCard ? productNames : undefined,
        },
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
        content: `Commercial data needed for "${cardTitle}" ${productLabel}`.trim(),
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
          <DialogDescription>
            The assigned team will be notified to provide pricing and MOQ information.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Product Selector for grouped cards */}
          {isGroupedCard && (
            <ProductSelector
              products={cardProducts}
              selectedIds={selectedProductIds}
              selectAll={selectAll}
              onSelectAll={handleSelectAll}
              onToggleProduct={handleToggleProduct}
            />
          )}

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
