import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Factory, Calendar, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GroupedItemsDrawer } from './GroupedItemsDrawer';
import { cn } from '@/lib/utils';
import { DevelopmentItem, DevelopmentCardStatus, DevelopmentItemPriority, DevelopmentCardType } from '@/pages/Development';

interface CardInfoSectionProps {
  item: DevelopmentItem;
  canEdit: boolean;
  onUpdateStatus: (status: DevelopmentCardStatus) => void;
}

const STATUS_OPTIONS: { value: DevelopmentCardStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'solved', label: 'Solved' },
];

const PRIORITY_STYLES: Record<DevelopmentItemPriority, string> = {
  urgent: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-white',
  low: 'bg-slate-400 text-white',
};

const CARD_TYPE_LABELS: Record<DevelopmentCardType, string> = {
  item: 'Single Item',
  item_group: 'Item Group',
  task: 'Task',
};

const CATEGORY_LABELS: Record<string, string> = {
  final_product: 'Final Product',
  raw_material: 'Raw Material',
};

// Map old status to new simplified status
const mapOldToNewStatus = (oldStatus: string): DevelopmentCardStatus => {
  switch (oldStatus) {
    case 'backlog':
      return 'pending';
    case 'in_progress':
      return 'in_progress';
    case 'waiting_supplier':
    case 'sample_requested':
    case 'sample_in_transit':
    case 'sample_received':
    case 'under_review':
      return 'waiting';
    case 'approved':
    case 'rejected':
      return 'solved';
    default:
      return 'pending';
  }
};

export function CardInfoSection({ 
  item, 
  canEdit, 
  onUpdateStatus,
}: CardInfoSectionProps) {
  const [showGroupedItems, setShowGroupedItems] = useState(false);
  const itemWithNewFields = item as any;
  const cardType = item.card_type || 'item';
  const currentStatus = mapOldToNewStatus(item.status);

  // Fetch product count for groups
  const { data: productsCount = 0 } = useQuery({
    queryKey: ['development-card-products-count', item.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('development_card_products')
        .select('*', { count: 'exact', head: true })
        .eq('card_id', item.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: cardType === 'item_group',
  });

  return (
    <div className="space-y-4">
      {/* Title - large and prominent */}
      <div>
        <h3 className="font-semibold text-xl leading-tight">{item.title}</h3>
        
        {/* Badges Row */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {CARD_TYPE_LABELS[cardType]}
          </Badge>
          {itemWithNewFields.product_category && (
            <Badge variant="secondary" className="text-xs">
              {CATEGORY_LABELS[itemWithNewFields.product_category] || itemWithNewFields.product_category}
            </Badge>
          )}
          <Badge className={cn('text-xs', PRIORITY_STYLES[item.priority])}>
            {item.priority}
          </Badge>
          {item.product_code && (
            <Badge variant="outline" className="text-xs font-mono">
              {item.product_code}
            </Badge>
          )}
        </div>
      </div>

      {/* Status and Due Date Row */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Status:</Label>
          {canEdit ? (
            <Select
              value={currentStatus}
              onValueChange={(v) => onUpdateStatus(v as DevelopmentCardStatus)}
            >
              <SelectTrigger className="h-7 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs capitalize">{currentStatus.replace('_', ' ')}</span>
          )}
        </div>
        
        {item.due_date && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            Due: {format(new Date(item.due_date), 'dd/MM/yyyy')}
          </div>
        )}
      </div>

      {/* Desired Outcome - emphasized */}
      {item.description && (
        <div className="bg-muted/50 rounded-lg p-3 border">
          <Label className="text-xs text-muted-foreground block mb-1">Desired Outcome</Label>
          <p className="text-sm">
            {item.description}
          </p>
        </div>
      )}

      {/* Supplier */}
      {item.supplier && (
        <div className="flex items-center gap-2 text-sm">
          <Factory className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Supplier:</span>
          <span className="font-medium">{item.supplier.company_name}</span>
        </div>
      )}

      {/* Products in Group - only for item_group */}
      {cardType === 'item_group' && (
        <Button 
          variant="outline" 
          className="w-full justify-between"
          onClick={() => setShowGroupedItems(true)}
        >
          <span className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Products in Group
          </span>
          <Badge variant="secondary">{productsCount} items</Badge>
        </Button>
      )}

      {/* Grouped Items Modal */}
      <GroupedItemsDrawer
        open={showGroupedItems}
        onOpenChange={setShowGroupedItems}
        cardId={item.id}
        canEdit={canEdit}
      />
    </div>
  );
}
