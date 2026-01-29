import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Factory, Calendar, Layers, ExternalLink, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { GroupedItemsDrawer } from './GroupedItemsDrawer';
import { cn } from '@/lib/utils';
import { DevelopmentItem, DevelopmentItemPriority, DevelopmentCardType } from '@/pages/Development';

interface CardInfoSectionProps {
  item: DevelopmentItem;
  canEdit: boolean;
}

const PRIORITY_STYLES: Record<DevelopmentItemPriority, string> = {
  urgent: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-white',
  low: 'bg-slate-400 text-white',
};

const CARD_TYPE_LABELS: Record<DevelopmentCardType, string> = {
  item: 'Item',
  item_group: 'Group',
  task: 'Task',
};

const CATEGORY_LABELS: Record<string, string> = {
  final_product: 'Final',
  raw_material: 'Raw',
};

// Max characters for truncated description
const DESCRIPTION_TRUNCATE_LENGTH = 120;

export function CardInfoSection({ 
  item, 
  canEdit, 
}: CardInfoSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showGroupedItems, setShowGroupedItems] = useState(false);
  const itemWithNewFields = item as any;
  const cardType = item.card_type || 'item';

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

  // Check if description needs truncation
  const description = item.description || '';
  const needsTruncation = description.length > DESCRIPTION_TRUNCATE_LENGTH;
  const truncatedDescription = needsTruncation 
    ? description.slice(0, DESCRIPTION_TRUNCATE_LENGTH) + '...'
    : description;

  // Check if there's extra content to show in expanded view
  const hasExpandableContent = needsTruncation || item.supplier || cardType === 'item_group';

  return (
    <div className="border-b">
      {/* Always visible: Badges + metadata row */}
      <div className="flex items-center gap-2 py-2 px-4 bg-muted/30 flex-wrap">
        <Badge variant="outline" className="text-[10px] h-5 px-2">
          {CARD_TYPE_LABELS[cardType]}
        </Badge>
        {itemWithNewFields.product_category && (
          <Badge variant="secondary" className="text-[10px] h-5 px-2">
            {CATEGORY_LABELS[itemWithNewFields.product_category] || itemWithNewFields.product_category}
          </Badge>
        )}
        <Badge className={cn('text-[10px] h-5 px-2', PRIORITY_STYLES[item.priority])}>
          {item.priority}
        </Badge>
        {item.product_code && (
          <Badge variant="outline" className="text-[10px] h-5 px-2 font-mono">
            {item.product_code}
          </Badge>
        )}
        {item.due_date && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(item.due_date), 'dd/MM')}
          </span>
        )}
        {item.image_url && (
          <a
            href={item.image_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0"
            title="View full image"
          >
            <div className="w-6 h-6 rounded overflow-hidden border hover:ring-2 hover:ring-primary transition-all">
              <img
                src={item.image_url}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            </div>
          </a>
        )}
      </div>

      {/* Description / Desired Outcome - Always visible */}
      {description && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="px-4 py-2 bg-muted/20">
            <p className="text-sm text-foreground leading-relaxed">
              {isExpanded ? description : truncatedDescription}
            </p>
            
            {/* Expand/Collapse trigger for long descriptions */}
            {needsTruncation && (
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-5 text-xs px-1 mt-1 text-muted-foreground hover:text-foreground"
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                  <ChevronDown className={cn(
                    "h-3 w-3 ml-1 transition-transform",
                    isExpanded && "rotate-180"
                  )} />
                </Button>
              </CollapsibleTrigger>
            )}
          </div>

          {/* Expandable extra content: supplier, larger image, grouped items */}
          <CollapsibleContent>
            <div className="px-4 py-2 space-y-2 bg-muted/10">
              {/* Supplier */}
              {item.supplier && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Factory className="h-3 w-3" />
                  <span>{item.supplier.company_name}</span>
                </div>
              )}
              
              {/* Larger image preview if available */}
              {item.image_url && (
                <a
                  href={item.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block w-fit"
                  title="View full image"
                >
                  <div className="relative w-24 h-24 rounded-lg border overflow-hidden hover:ring-2 hover:ring-primary transition-all">
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </a>
              )}
              
              {/* Products in Group - only for item_group */}
              {cardType === 'item_group' && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full justify-between h-8 text-xs"
                  onClick={() => setShowGroupedItems(true)}
                >
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3 w-3" />
                    Products in Group
                  </span>
                  <Badge variant="secondary" className="text-[10px] h-4">{productsCount} items</Badge>
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* If no description but has other expandable content */}
      {!description && hasExpandableContent && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="px-4 py-1">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2 gap-1 text-muted-foreground">
                More details
                <ChevronDown className={cn(
                  "h-3 w-3 transition-transform",
                  isExpanded && "rotate-180"
                )} />
              </Button>
            </CollapsibleTrigger>
          </div>
          
          <CollapsibleContent>
            <div className="px-4 py-2 space-y-2 bg-muted/10">
              {item.supplier && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Factory className="h-3 w-3" />
                  <span>{item.supplier.company_name}</span>
                </div>
              )}
              
              {cardType === 'item_group' && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full justify-between h-8 text-xs"
                  onClick={() => setShowGroupedItems(true)}
                >
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3 w-3" />
                    Products in Group
                  </span>
                  <Badge variant="secondary" className="text-[10px] h-4">{productsCount} items</Badge>
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
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
