import { format, differenceInDays, isPast, parseISO } from 'date-fns';
import { Package, Truck, CheckCircle, XCircle, AlertTriangle, FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface SampleWithCard {
  id: string;
  item_id: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'returned' | null;
  quantity: number | null;
  courier_name: string | null;
  tracking_number: string | null;
  shipped_date: string | null;
  estimated_arrival: string | null;
  actual_arrival: string | null;
  decision: string | null;
  decision_notes: string | null;
  decided_at: string | null;
  report_url: string | null;
  notes: string | null;
  created_at: string;
  card: {
    id: string;
    title: string;
    current_owner: string | null;
    is_solved: boolean | null;
    deleted_at: string | null;
    image_url: string | null;
  } | null;
}

type SampleCategory = 'requested' | 'inTransit' | 'delivered' | 'reviewed';

interface SampleTrackerCardProps {
  sample: SampleWithCard;
  category: SampleCategory;
  onOpenCard: (cardId: string) => void;
}

export function SampleTrackerCard({ sample, category, onOpenCard }: SampleTrackerCardProps) {
  const card = sample.card;
  if (!card) return null;

  const isOverdue = sample.estimated_arrival && 
    sample.status !== 'delivered' && 
    !sample.actual_arrival &&
    isPast(parseISO(sample.estimated_arrival));

  const daysSinceArrival = sample.actual_arrival 
    ? differenceInDays(new Date(), parseISO(sample.actual_arrival))
    : 0;

  const hasReport = !!sample.report_url;

  return (
    <div 
      className={cn(
        "p-3 bg-card border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer",
        isOverdue && "border-destructive/50 bg-destructive/5"
      )}
      onClick={() => onOpenCard(card.id)}
    >
      {/* Card Title */}
      <div className="flex items-start gap-2 mb-2">
        {card.image_url ? (
          <img 
            src={card.image_url} 
            alt="" 
            className="w-8 h-8 rounded object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-sm truncate">{card.title}</h4>
          {sample.quantity && (
            <p className="text-xs text-muted-foreground">{sample.quantity} pcs</p>
          )}
        </div>
      </div>

      {/* Status-specific content */}
      {category === 'requested' && (
        <RequestedContent sample={sample} isOverdue={isOverdue} />
      )}
      {category === 'inTransit' && (
        <InTransitContent sample={sample} isOverdue={isOverdue} />
      )}
      {category === 'delivered' && (
        <DeliveredContent sample={sample} daysSinceArrival={daysSinceArrival} />
      )}
      {category === 'reviewed' && (
        <ReviewedContent sample={sample} hasReport={hasReport} />
      )}

      {/* Quick action */}
      <div className="mt-2 pt-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs gap-1"
          onClick={(e) => {
            e.stopPropagation();
            onOpenCard(card.id);
          }}
        >
          <ExternalLink className="h-3 w-3" />
          Open Card
        </Button>
      </div>
    </div>
  );
}

function RequestedContent({ sample, isOverdue }: { sample: SampleWithCard; isOverdue: boolean | "" | null }) {
  return (
    <div className="space-y-1 text-xs">
      <div className="flex items-center justify-between text-muted-foreground">
        <span>Requested</span>
        <span>{format(new Date(sample.created_at), 'dd/MM')}</span>
      </div>
      {sample.estimated_arrival ? (
        <div className={cn(
          "flex items-center gap-1",
          isOverdue ? "text-destructive" : "text-muted-foreground"
        )}>
          {isOverdue && <AlertTriangle className="h-3 w-3" />}
          <span>Ship by: {format(parseISO(sample.estimated_arrival), 'dd/MM')}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-amber-600">
          <AlertTriangle className="h-3 w-3" />
          <span>No ship date</span>
        </div>
      )}
    </div>
  );
}

function InTransitContent({ sample, isOverdue }: { sample: SampleWithCard; isOverdue: boolean | "" | null }) {
  return (
    <div className="space-y-1 text-xs">
      {sample.courier_name && (
        <div className="flex items-center gap-1">
          <Truck className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{sample.courier_name}</span>
        </div>
      )}
      {sample.tracking_number && (
        <p className="text-muted-foreground font-mono text-[10px] truncate">
          {sample.tracking_number}
        </p>
      )}
      {sample.estimated_arrival && (
        <div className={cn(
          "flex items-center gap-1",
          isOverdue ? "text-destructive" : "text-muted-foreground"
        )}>
          {isOverdue && <AlertTriangle className="h-3 w-3" />}
          <span>ETA: {format(parseISO(sample.estimated_arrival), 'dd/MM')}</span>
        </div>
      )}
    </div>
  );
}

function DeliveredContent({ sample, daysSinceArrival }: { sample: SampleWithCard; daysSinceArrival: number }) {
  return (
    <div className="space-y-1 text-xs">
      {sample.actual_arrival && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Package className="h-3 w-3" />
          <span>Arrived {format(parseISO(sample.actual_arrival), 'dd/MM')}</span>
        </div>
      )}
      {daysSinceArrival > 0 && (
        <Badge variant="outline" className={cn(
          "text-[10px] h-5",
          daysSinceArrival > 7 ? "border-amber-500 text-amber-600" : ""
        )}>
          Waiting {daysSinceArrival} day{daysSinceArrival !== 1 ? 's' : ''}
        </Badge>
      )}
    </div>
  );
}

function ReviewedContent({ sample, hasReport }: { sample: SampleWithCard; hasReport: boolean }) {
  const isApproved = sample.decision === 'approved';
  const isRejected = sample.decision === 'rejected';

  return (
    <div className="space-y-1 text-xs">
      <div className="flex items-center gap-1">
        {isApproved ? (
          <>
            <CheckCircle className="h-3 w-3 text-green-600" />
            <span className="text-green-600 font-medium">Approved</span>
          </>
        ) : isRejected ? (
          <>
            <XCircle className="h-3 w-3 text-destructive" />
            <span className="text-destructive font-medium">Rejected</span>
          </>
        ) : (
          <span className="text-muted-foreground">{sample.decision}</span>
        )}
      </div>
      {sample.decided_at && (
        <p className="text-muted-foreground">
          {format(parseISO(sample.decided_at), 'dd/MM/yy')}
        </p>
      )}
      {hasReport && (
        <Badge variant="secondary" className="text-[10px] h-5 gap-1">
          <FileText className="h-3 w-3" />
          Report
        </Badge>
      )}
    </div>
  );
}
