import { format, parseISO } from 'date-fns';
import { 
  MessageCircle, 
  HelpCircle, 
  RefreshCw, 
  ArrowRight, 
  Package, 
  DollarSign,
  Image,
  Plus,
  CheckCircle2,
  Reply,
  Truck,
  PackageCheck,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { UserRoleDot } from './UserRoleBadge';
import { AppRole } from '@/hooks/useUserRole';

interface Activity {
  id: string;
  card_id: string;
  user_id: string;
  activity_type: string;
  content: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  profile?: {
    full_name: string | null;
    email: string | null;
  } | null;
  roles?: AppRole[];
}

interface CompactActivityRowProps {
  activity: Activity;
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  comment: <MessageCircle className="h-3.5 w-3.5" />,
  question: <HelpCircle className="h-3.5 w-3.5" />,
  answer: <Reply className="h-3.5 w-3.5" />,
  status_change: <RefreshCw className="h-3.5 w-3.5" />,
  ownership_change: <ArrowRight className="h-3.5 w-3.5" />,
  sample_added: <Package className="h-3.5 w-3.5" />,
  sample_updated: <Package className="h-3.5 w-3.5" />,
  sample_requested: <Package className="h-3.5 w-3.5" />,
  sample_shipped: <Truck className="h-3.5 w-3.5" />,
  sample_arrived: <PackageCheck className="h-3.5 w-3.5" />,
  sample_approved: <CheckCircle className="h-3.5 w-3.5" />,
  sample_rejected: <XCircle className="h-3.5 w-3.5" />,
  commercial_update: <DollarSign className="h-3.5 w-3.5" />,
  product_added: <Plus className="h-3.5 w-3.5" />,
  image_updated: <Image className="h-3.5 w-3.5" />,
  created: <CheckCircle2 className="h-3.5 w-3.5" />,
  action_snoozed: <Clock className="h-3.5 w-3.5" />,
  action_resumed: <RefreshCw className="h-3.5 w-3.5" />,
};

const ACTIVITY_LABELS: Record<string, string> = {
  comment: 'commented',
  question: 'asked a question',
  answer: 'answered',
  status_change: 'changed status',
  ownership_change: 'moved card',
  sample_added: 'added sample tracking',
  sample_updated: 'updated sample',
  sample_requested: 'requested sample',
  sample_shipped: 'shipped sample',
  sample_arrived: 'sample arrived',
  sample_approved: 'approved sample',
  sample_rejected: 'rejected sample',
  commercial_update: 'updated commercial data',
  product_added: 'added product',
  image_updated: 'updated image',
  created: 'created this card',
  action_snoozed: 'snoozed action',
  action_resumed: 'resumed action',
};

// Ownership direction indicator with country flags
function OwnershipDirection({ from, to }: { from: 'mor' | 'arc'; to: 'mor' | 'arc' }) {
  if (from === to) return null;
  
  const fromFlag = from === 'mor' ? '🇧🇷' : '🇨🇳';
  const toFlag = to === 'mor' ? '🇧🇷' : '🇨🇳';
  
  return (
    <span className="inline-flex items-center gap-0.5 text-xs opacity-80 flex-shrink-0">
      <span>{fromFlag}</span>
      <span className="text-[10px]">→</span>
      <span>{toFlag}</span>
    </span>
  );
}

export function CompactActivityRow({ activity }: CompactActivityRowProps) {
  const firstName = activity.profile?.full_name?.split(' ')[0] || 'Someone';
  const label = ACTIVITY_LABELS[activity.activity_type] || activity.activity_type.replace(/_/g, ' ');
  
  // Build inline content based on activity type
  let inlineContent = '';
  if (activity.activity_type === 'commercial_update' && activity.metadata) {
    // Check if batch update (has multiple fields)
    if (activity.metadata.fob_price_usd !== undefined) {
      inlineContent = `FOB $${activity.metadata.fob_price_usd}, MOQ ${activity.metadata.moq}, ${activity.metadata.qty_per_container}/${activity.metadata.container_type}`;
    } else {
      // Legacy single field update
      const field = activity.metadata.field?.replace(/_/g, ' ');
      inlineContent = `${field}: ${activity.metadata.value}`;
    }
  } else if (activity.activity_type === 'ownership_change' && activity.content) {
    // Extract target from content like "Card moved to ARC (China)"
    const match = activity.content.match(/to (.*)/);
    inlineContent = match ? match[1] : '';
  } else if (activity.activity_type === 'sample_requested' && activity.metadata?.quantity) {
    inlineContent = `${activity.metadata.quantity} pcs`;
  } else if (activity.activity_type === 'sample_shipped' && activity.metadata?.courier) {
    inlineContent = activity.metadata.courier;
  } else if (activity.content) {
    inlineContent = activity.content;
  }

  // Check if this activity caused an ownership change
  const movedFrom = activity.metadata?.moved_from as 'mor' | 'arc' | undefined;
  const movedTo = activity.metadata?.moved_to as 'mor' | 'arc' | undefined;
  const showOwnershipChange = movedFrom && movedTo && movedFrom !== movedTo;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1 px-1">
      <span className="flex-shrink-0 opacity-70">
        {ACTIVITY_ICONS[activity.activity_type] || ACTIVITY_ICONS.created}
      </span>
      {/* Role dot before name */}
      {activity.roles && activity.roles.length > 0 && (
        <UserRoleDot roles={activity.roles} />
      )}
      <span className="font-medium">{firstName}</span>
      <span>{label}</span>
      {inlineContent && (
        <>
          <span className="opacity-50">—</span>
          <span className="truncate max-w-[200px]">{inlineContent}</span>
        </>
      )}
      {/* Inline ownership change flags */}
      {showOwnershipChange && (
        <OwnershipDirection from={movedFrom} to={movedTo} />
      )}
      {/* Date + Time format */}
      <span className="opacity-50 flex-shrink-0">
        • {format(parseISO(activity.created_at), 'dd/MM HH:mm')}
      </span>
    </div>
  );
}
