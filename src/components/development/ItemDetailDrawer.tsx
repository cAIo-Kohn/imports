import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { format } from 'date-fns';
import { X, Package, MessageSquare, FileText } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { DevelopmentItem, DevelopmentItemStatus, DevelopmentItemPriority } from '@/pages/Development';
import { SampleTrackingCard } from './SampleTrackingCard';
import { AddSampleForm } from './AddSampleForm';
import { ActivityTimeline } from './ActivityTimeline';
import { cn } from '@/lib/utils';

interface ItemDetailDrawerProps {
  item: DevelopmentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_OPTIONS: { value: DevelopmentItemStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_supplier', label: 'Waiting Supplier' },
  { value: 'sample_requested', label: 'Sample Requested' },
  { value: 'sample_in_transit', label: 'Sample In Transit' },
  { value: 'sample_received', label: 'Sample Received' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const PRIORITY_STYLES: Record<DevelopmentItemPriority, string> = {
  urgent: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-white',
  low: 'bg-slate-400 text-white',
};

export function ItemDetailDrawer({ item, open, onOpenChange }: ItemDetailDrawerProps) {
  const { canManageOrders } = useUserRole();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('details');

  // Fetch samples for this item
  const { data: samples = [] } = useQuery({
    queryKey: ['development-item-samples', item?.id],
    queryFn: async () => {
      if (!item?.id) return [];
      const { data, error } = await supabase
        .from('development_item_samples')
        .select('*')
        .eq('item_id', item.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!item?.id,
  });

  // Update item mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<DevelopmentItem>) => {
      if (!item?.id) return;
      const { error } = await supabase
        .from('development_items')
        .update(updates)
        .eq('id', item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      toast({ title: 'Success', description: 'Item updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update item', variant: 'destructive' });
    },
  });

  if (!item) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-8">
              <SheetTitle className="text-lg">{item.title}</SheetTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={cn('text-xs', PRIORITY_STYLES[item.priority])}>
                  {item.priority}
                </Badge>
                {item.product_code && (
                  <Badge variant="outline" className="text-xs">
                    {item.product_code}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Status Selector */}
          {canManageOrders && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={item.status}
                onValueChange={(v) => updateMutation.mutate({ status: v as DevelopmentItemStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details" className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Details
            </TabsTrigger>
            <TabsTrigger value="samples" className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              Samples ({samples.length})
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              Activity
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Description</Label>
              {canManageOrders ? (
                <Textarea
                  value={item.description || ''}
                  onChange={(e) => updateMutation.mutate({ description: e.target.value })}
                  placeholder="Add description..."
                  rows={4}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {item.description || 'No description'}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                {canManageOrders ? (
                  <Select
                    value={item.priority}
                    onValueChange={(v) => updateMutation.mutate({ priority: v as DevelopmentItemPriority })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm capitalize">{item.priority}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Due Date</Label>
                {canManageOrders ? (
                  <Input
                    type="date"
                    value={item.due_date || ''}
                    onChange={(e) => updateMutation.mutate({ due_date: e.target.value || null })}
                  />
                ) : (
                  <p className="text-sm">
                    {item.due_date ? format(new Date(item.due_date), 'dd/MM/yyyy') : '-'}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Supplier</Label>
              <p className="text-sm">{item.supplier?.company_name || '-'}</p>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label className="text-muted-foreground">Metadata</Label>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Created: {format(new Date(item.created_at), 'dd/MM/yyyy HH:mm')}</p>
                <p>Updated: {format(new Date(item.updated_at), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            </div>
          </TabsContent>

          {/* Samples Tab */}
          <TabsContent value="samples" className="space-y-4 mt-4">
            {canManageOrders && <AddSampleForm itemId={item.id} />}
            
            <div className="space-y-3">
              {samples.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No samples registered yet
                </p>
              ) : (
                samples.map((sample) => (
                  <SampleTrackingCard key={sample.id} sample={sample} canEdit={canManageOrders} />
                ))
              )}
            </div>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="mt-4">
            <ActivityTimeline itemId={item.id} canComment={canManageOrders} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
