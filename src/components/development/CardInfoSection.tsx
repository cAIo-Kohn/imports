import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Factory, Calendar, Layers, ExternalLink } from 'lucide-react';
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
    <div className="space-y-2">
      {/* Title + Badges + Status in compact layout */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-base leading-tight truncate">{item.title}</h3>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <Badge variant="outline" className="text-[10px] h-5">
              {CARD_TYPE_LABELS[cardType]}
            </Badge>
            {itemWithNewFields.product_category && (
              <Badge variant="secondary" className="text-[10px] h-5">
                {CATEGORY_LABELS[itemWithNewFields.product_category] || itemWithNewFields.product_category}
              </Badge>
            )}
            <Badge className={cn('text-[10px] h-5', PRIORITY_STYLES[item.priority])}>
              {item.priority}
            </Badge>
            {item.product_code && (
              <Badge variant="outline" className="text-[10px] h-5 font-mono">
                {item.product_code}
              </Badge>
            )}
          </div>
        </div>
        
        {/* Status dropdown on the right */}
        <div className="flex-shrink-0">
          {canEdit ? (
            <Select
              value={currentStatus}
              onValueChange={(v) => onUpdateStatus(v as DevelopmentCardStatus)}
            >
              <SelectTrigger className="h-6 text-[10px] w-24">
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
            <span className="text-[10px] capitalize text-muted-foreground">{currentStatus.replace('_', ' ')}</span>
          )}
        </div>
      </div>

      {/* Due date + Supplier + Image thumbnail inline */}
      {(item.due_date || item.supplier || item.image_url) && (
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {item.due_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(item.due_date), 'dd/MM/yyyy')}
            </span>
          )}
          {item.supplier && (
            <span className="flex items-center gap-1">
              <Factory className="h-3 w-3" />
              {item.supplier.company_name}
            </span>
          )}
          {item.image_url && (
            <a
              href={item.image_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex-shrink-0"
              title="View full image"
            >
              <div className="relative w-10 h-10 rounded border overflow-hidden hover:ring-2 hover:ring-primary transition-all">
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <ExternalLink className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </a>
          )}
        </div>
      )}

      {/* Desired Outcome - compact */}
      {item.description && (
        <div className="bg-muted/40 rounded-md p-2 border">
          <p className="text-xs leading-relaxed">
            {item.description}
          </p>
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
