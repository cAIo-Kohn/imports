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
import { ImageUpload } from './ImageUpload';
import { GroupedItemsDrawer } from './GroupedItemsDrawer';
import { cn } from '@/lib/utils';
import { DevelopmentItem, DevelopmentCardStatus, DevelopmentItemPriority, DevelopmentCardType } from '@/pages/Development';

interface CardInfoSectionProps {
  item: DevelopmentItem;
  canEdit: boolean;
  onUpdateStatus: (status: DevelopmentCardStatus) => void;
  onUpdateImage: (url: string | null) => void;
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
  onUpdateImage,
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
      {/* Image and Title Row */}
      <div className="flex gap-3">
        {/* Image - only for non-task cards, compact size */}
        {cardType !== 'task' && (
          <div className="flex-shrink-0">
            {itemWithNewFields.image_url ? (
              <div className="relative group">
                <img
                  src={itemWithNewFields.image_url}
                  alt={item.title}
                  className="w-16 h-16 rounded-lg border object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(itemWithNewFields.image_url, '_blank')}
                />
                {canEdit && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ImageUpload
                      value={itemWithNewFields.image_url}
                      onChange={onUpdateImage}
                      folder="cards"
                    />
                  </div>
                )}
              </div>
            ) : canEdit ? (
              <div className="w-16 h-16 rounded-lg border border-dashed flex items-center justify-center bg-muted/30">
                <ImageUpload
                  value={null}
                  onChange={onUpdateImage}
                  folder="cards"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg border bg-muted/30 flex items-center justify-center">
                <span className="text-xs text-muted-foreground">No image</span>
              </div>
            )}
          </div>
        )}

        {/* Title and Badges */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg leading-tight truncate">{item.title}</h3>
          
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

          {/* Status and Due Date Row */}
          <div className="flex items-center gap-4 mt-3">
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
        </div>
      </div>

      {/* Desired Outcome - compact */}
      {item.description && (
        <div className="bg-muted/30 rounded-md p-2 border">
          <p className="text-sm line-clamp-2">
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
