import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { format, isToday, isYesterday, parseISO, formatDistanceToNow } from 'date-fns';
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
  Check,
  Lightbulb,
  Truck,
  PackageCheck,
  CheckCircle,
  XCircle,
  Upload,
  Clock
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { InlineReplyBox } from './InlineReplyBox';
import { InlineSampleShipForm } from './InlineSampleShipForm';
import { TimelineUploadButton, AttachmentDisplay, UploadedAttachment } from './TimelineUploadButton';
import { SnoozeButton } from './SnoozeButton';
import { CommercialDataBanner, SampleInTransitBanner, SampleDeliveredBanner, NewCardBanner, Sample } from './TimelineBanners';

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
}

interface HistoryTimelineProps {
  cardId: string;
  cardType?: 'item' | 'item_group' | 'task';
  cardCreatedBy?: string;
  cardTitle?: string;
  cardDescription?: string | null;
  cardImageUrl?: string | null;
  isCardSolved?: boolean;
  isNewForOtherTeam?: boolean;
  showAttentionBanner?: boolean;
  currentOwner?: 'mor' | 'arc';
  pendingActionType?: string | null;
  pendingActionDueAt?: string | null;
  snoozedUntil?: string | null;
  // Commercial data for banners
  fobPriceUsd?: number | null;
  moq?: number | null;
  qtyPerContainer?: number | null;
  containerType?: string | null;
  onOwnerChange?: () => void;
  onOpenSampleSection?: (sampleId?: string) => void;
  onOpenMessageSection?: (type: 'comment' | 'question') => void;
  onOpenUploadSection?: () => void;
  onOpenCommercialSection?: () => void;
  onCloseCard?: () => void;
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

const ACTIVITY_STYLES: Record<string, string> = {
  comment: 'bg-blue-100 text-blue-700 border-blue-200',
  question: 'bg-purple-100 text-purple-700 border-purple-200',
  answer: 'bg-green-100 text-green-700 border-green-200',
  status_change: 'bg-amber-100 text-amber-700 border-amber-200',
  ownership_change: 'bg-green-100 text-green-700 border-green-200',
  sample_added: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  sample_updated: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  sample_requested: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  sample_shipped: 'bg-blue-100 text-blue-700 border-blue-200',
  sample_arrived: 'bg-green-100 text-green-700 border-green-200',
  sample_approved: 'bg-green-100 text-green-700 border-green-200',
  sample_rejected: 'bg-red-100 text-red-700 border-red-200',
  commercial_update: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  product_added: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  image_updated: 'bg-pink-100 text-pink-700 border-pink-200',
  created: 'bg-slate-100 text-slate-700 border-slate-200',
  action_snoozed: 'bg-slate-100 text-slate-700 border-slate-200',
  action_resumed: 'bg-blue-100 text-blue-700 border-blue-200',
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

// Primary activity types get full cards; all others are compact
const PRIMARY_ACTIVITY_TYPES = ['comment', 'question', 'answer'];

const isCompactActivity = (type: string) => !PRIMARY_ACTIVITY_TYPES.includes(type);

function formatDateHeader(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d, yyyy');
}

function groupByDate(activities: Activity[]): Record<string, Activity[]> {
  return activities.reduce((acc, activity) => {
    const dateKey = format(parseISO(activity.created_at), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(activity);
    return acc;
  }, {} as Record<string, Activity[]>);
}

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

// Compact single-line row for system activities
function CompactActivityRow({ activity }: { activity: Activity }) {
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

// Special card for the "created" activity showing title, description, and image
interface CreatedActivityCardProps {
  activity: Activity;
  cardTitle?: string;
  cardDescription?: string | null;
  cardImageUrl?: string | null;
}

function CreatedActivityCard({ activity, cardTitle, cardDescription, cardImageUrl }: CreatedActivityCardProps) {
  const firstName = activity.profile?.full_name?.split(' ')[0] || 'Someone';
  const fullName = activity.profile?.full_name || activity.profile?.email || 'Unknown';
  
  const getInitials = (profile: Activity['profile']) => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (profile?.email) {
      return profile.email[0].toUpperCase();
    }
    return '?';
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      {/* Creator info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Avatar className="h-5 w-5">
          <AvatarFallback className="text-[10px] bg-background">
            {getInitials(activity.profile)}
          </AvatarFallback>
        </Avatar>
        <span className="font-medium text-foreground">{fullName}</span>
        <span>created this card</span>
        <span className="opacity-70">• {format(parseISO(activity.created_at), 'HH:mm')}</span>
      </div>
      
      {/* Card content preview */}
      <div className="flex gap-3">
        {/* Image thumbnail */}
        {cardImageUrl && (
          <a
            href={cardImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0"
          >
            <div className="w-16 h-16 rounded-lg border overflow-hidden hover:ring-2 hover:ring-primary transition-all">
              <img
                src={cardImageUrl}
                alt={cardTitle || 'Card image'}
                className="w-full h-full object-cover"
              />
            </div>
          </a>
        )}
        
        {/* Title and description */}
        <div className="flex-1 min-w-0">
          {cardTitle && (
            <h4 className="font-medium text-sm text-foreground truncate">{cardTitle}</h4>
          )}
          {cardDescription && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {cardDescription}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Attention Banner Component for highlighting important actions
interface AttentionBannerProps {
  activity: Activity;
  cardId: string;
  currentOwner?: 'mor' | 'arc';
  pendingActionType?: string | null;
  onResolve: (activityId: string) => void;
  onOwnerChange?: () => void;
  isResolving?: boolean;
}

function AttentionBanner({ 
  activity, 
  cardId,
  currentOwner,
  pendingActionType,
  onResolve,
  onOwnerChange,
  isResolving,
}: AttentionBannerProps) {
  const [showReplyBox, setShowReplyBox] = useState(false);
  
  const isQuestion = activity.activity_type === 'question';
  const isCommercial = activity.activity_type === 'commercial_update';
  const isOwnershipChange = activity.activity_type === 'ownership_change';
  
  const getInitials = (profile: Activity['profile']) => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (profile?.email) {
      return profile.email[0].toUpperCase();
    }
    return '?';
  };

  return (
    <div className={cn(
      "rounded-lg p-4 mb-4 border-2 animate-pulse",
      isQuestion && "bg-purple-50 border-purple-300 dark:bg-purple-950/30 dark:border-purple-700",
      isCommercial && "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-700",
      isOwnershipChange && "bg-blue-50 border-blue-300 dark:bg-blue-950/30 dark:border-blue-700",
    )}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 font-medium">
          {isQuestion && <HelpCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
          {isCommercial && <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          {isOwnershipChange && <ArrowRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
          <span className={cn(
            "text-sm",
            isQuestion && "text-purple-800 dark:text-purple-200",
            isCommercial && "text-emerald-800 dark:text-emerald-200",
            isOwnershipChange && "text-blue-800 dark:text-blue-200",
          )}>
            {isQuestion ? "Question for you" : isCommercial ? "Commercial data updated" : "Card moved to you"}
          </span>
        </div>
      </div>
      <div className="bg-white dark:bg-background rounded-lg p-3 border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[10px]">{getInitials(activity.profile)}</AvatarFallback>
          </Avatar>
          <span>{activity.profile?.full_name || activity.profile?.email || 'Unknown'}</span>
          <span className="opacity-70">• {format(parseISO(activity.created_at), 'HH:mm')}</span>
        </div>
        {activity.content && (
          <p className="text-sm font-medium">
            {isQuestion ? `"${activity.content}"` : activity.content}
          </p>
        )}
        {isCommercial && activity.metadata && (
          <p className="text-xs text-muted-foreground mt-1">
            {activity.metadata.field?.replace('_', ' ')}: {activity.metadata.value}
          </p>
        )}
      </div>
      
      {/* Action buttons for questions */}
      {isQuestion && !showReplyBox && (
        <div className="flex gap-2 mt-3 flex-wrap">
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setShowReplyBox(true)}
            className="bg-white hover:bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-950 dark:hover:bg-purple-900 dark:border-purple-600 dark:text-purple-200"
          >
            <Reply className="h-3 w-3 mr-1" />
            Reply
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => onResolve(activity.id)}
            disabled={isResolving}
            className="bg-white hover:bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-950 dark:hover:bg-purple-900 dark:border-purple-600 dark:text-purple-200"
          >
            <Check className="h-3 w-3 mr-1" />
            {isResolving ? 'Resolving...' : 'Mark as Resolved'}
          </Button>
          <SnoozeButton
            cardId={cardId}
            currentActionType="question"
            variant="outline"
            size="sm"
            className="bg-white hover:bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-950 dark:hover:bg-purple-900 dark:border-purple-600 dark:text-purple-200"
          />
        </div>
      )}
      
      {/* Inline reply box inside banner */}
      {showReplyBox && (
        <div className="mt-3">
          <InlineReplyBox
            replyToId={activity.id}
            replyToType="question"
            cardId={cardId}
            currentOwner={currentOwner}
            pendingActionType={pendingActionType}
            onClose={() => setShowReplyBox(false)}
            onCardMove={onOwnerChange}
          />
        </div>
      )}
    </div>
  );
}

// Sample Requested Banner - for China to add tracking
interface SampleRequestedBannerProps {
  activity: Activity;
  cardId: string;
  currentOwner: 'mor' | 'arc';
  onSuccess: () => void;
}

function SampleRequestedBanner({ 
  activity, 
  cardId, 
  currentOwner, 
  onSuccess 
}: SampleRequestedBannerProps) {
  const [showShipForm, setShowShipForm] = useState(false);
  
  const getInitials = (profile: Activity['profile']) => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (profile?.email) {
      return profile.email[0].toUpperCase();
    }
    return '?';
  };

  return (
    <div className="rounded-lg p-4 mb-4 border-2 animate-pulse bg-cyan-50 border-cyan-300 dark:bg-cyan-950/30 dark:border-cyan-700">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 font-medium">
          <Package className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          <span className="text-sm text-cyan-800 dark:text-cyan-200">
            Sample Requested
          </span>
        </div>
        {!showShipForm && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setShowShipForm(true)}
            className="bg-white hover:bg-cyan-100 border-cyan-300 text-cyan-700 dark:bg-cyan-950 dark:hover:bg-cyan-900 dark:border-cyan-600 dark:text-cyan-200"
          >
            <Truck className="h-3 w-3 mr-1" />
            Add Tracking
          </Button>
        )}
      </div>
      <div className="bg-white dark:bg-background rounded-lg p-3 border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[10px]">{getInitials(activity.profile)}</AvatarFallback>
          </Avatar>
          <span>{activity.profile?.full_name || activity.profile?.email || 'Unknown'}</span>
          <span className="opacity-70">• {format(parseISO(activity.created_at), 'HH:mm')}</span>
        </div>
        <p className="text-sm font-medium">
          {activity.content || 'Sample requested'}
        </p>
      </div>
      
      {showShipForm && (
        <InlineSampleShipForm
          cardId={cardId}
          currentOwner={currentOwner}
          onClose={() => setShowShipForm(false)}
          onSuccess={() => {
            setShowShipForm(false);
            onSuccess();
          }}
        />
      )}
    </div>
  );
}

// Answer Pending Banner - for acknowledging an answer or asking follow-up
interface AnswerPendingBannerProps {
  activity: Activity;
  cardId: string;
  currentOwner: 'mor' | 'arc';
  cardData?: {
    fob_price_usd?: number | null;
    moq?: number | null;
    qty_per_container?: number | null;
  };
  onAcknowledge: (activityId: string) => void;
  onOwnerChange?: () => void;
  isAcknowledging?: boolean;
}

function AnswerPendingBanner({ 
  activity, 
  cardId,
  currentOwner,
  cardData,
  onAcknowledge,
  onOwnerChange,
  isAcknowledging,
}: AnswerPendingBannerProps) {
  const [showReplyBox, setShowReplyBox] = useState(false);
  
  const getInitials = (profile: Activity['profile']) => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (profile?.email) {
      return profile.email[0].toUpperCase();
    }
    return '?';
  };

  return (
    <div className="rounded-lg p-4 mb-4 border-2 animate-pulse bg-green-50 border-green-400 dark:bg-green-950/30 dark:border-green-600">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 font-medium">
          <Reply className="h-5 w-5 text-green-600 dark:text-green-400" />
          <span className="text-sm text-green-800 dark:text-green-200">
            Answer received
          </span>
        </div>
      </div>
      <div className="bg-white dark:bg-background rounded-lg p-3 border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[10px]">{getInitials(activity.profile)}</AvatarFallback>
          </Avatar>
          <span>{activity.profile?.full_name || activity.profile?.email || 'Unknown'}</span>
          <span className="opacity-70">• {format(parseISO(activity.created_at), 'HH:mm')}</span>
        </div>
        {activity.content && (
          <p className="text-sm font-medium">
            {activity.content}
          </p>
        )}
        {/* Show attachments if present */}
        {activity.metadata?.attachments && Array.isArray(activity.metadata.attachments) && activity.metadata.attachments.length > 0 && (
          <AttachmentDisplay 
            attachments={activity.metadata.attachments as UploadedAttachment[]} 
          />
        )}
      </div>
      
      {/* Action buttons */}
      {!showReplyBox && (
        <div className="flex gap-2 mt-3 flex-wrap">
          <Button 
            size="sm" 
            onClick={() => onAcknowledge(activity.id)}
            disabled={isAcknowledging}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Check className="h-3 w-3 mr-1" />
            {isAcknowledging ? 'Acknowledging...' : 'Got it'}
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setShowReplyBox(true)}
            className="bg-white hover:bg-green-100 border-green-400 text-green-700 dark:bg-green-950 dark:hover:bg-green-900 dark:border-green-600 dark:text-green-200"
          >
            <Reply className="h-3 w-3 mr-1" />
            Reply
          </Button>
          <SnoozeButton
            cardId={cardId}
            currentActionType="answer_pending"
            variant="outline"
            size="sm"
            className="bg-white hover:bg-green-100 border-green-400 text-green-700 dark:bg-green-950 dark:hover:bg-green-900 dark:border-green-600 dark:text-green-200"
          />
        </div>
      )}
      
      {/* Inline reply box inside banner */}
      {showReplyBox && (
        <div className="mt-3">
          <InlineReplyBox
            replyToId={activity.id}
            replyToType="answer"
            cardId={cardId}
            currentOwner={currentOwner}
            pendingActionType="answer_pending"
            onClose={() => setShowReplyBox(false)}
            onCardMove={onOwnerChange}
          />
        </div>
      )}
    </div>
  );
}

// Sample Approved Banner - for closing the card after sample approval
interface SampleApprovedBannerProps {
  cardId: string;
  cardCreatedBy: string;
  creatorName?: string;
  onCloseCard: () => void;
  onAskQuestion: () => void;
  onAddComment: () => void;
  onUpload: () => void;
  isClosing: boolean;
}

function SampleApprovedBanner({
  cardId,
  cardCreatedBy,
  creatorName,
  onCloseCard,
  onAskQuestion,
  onAddComment,
  onUpload,
  isClosing,
}: SampleApprovedBannerProps) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  
  // User can close if they're admin OR they created the card
  const canClose = isAdmin || user?.id === cardCreatedBy;

  return (
    <div className="rounded-lg p-4 mb-4 border-2 bg-green-50 border-green-400 dark:bg-green-950/30 dark:border-green-600">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
        <span className="font-medium text-sm text-green-800 dark:text-green-200">
          Sample Approved - Ready to Close
        </span>
      </div>
      <p className="text-sm text-green-700 dark:text-green-300 mb-3">
        The sample has been tested and approved. You can now close this card or continue the discussion.
      </p>
      <div className="flex flex-wrap gap-2">
        {canClose && (
          <Button 
            size="sm"
            onClick={onCloseCard}
            disabled={isClosing}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            {isClosing ? 'Closing...' : 'Close Card'}
          </Button>
        )}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onAskQuestion}
          className="bg-white hover:bg-green-100 border-green-400 text-green-700 dark:bg-green-950 dark:hover:bg-green-900 dark:border-green-600 dark:text-green-200"
        >
          <HelpCircle className="h-3 w-3 mr-1" />
          Ask Question
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onAddComment}
          className="bg-white hover:bg-green-100 border-green-400 text-green-700 dark:bg-green-950 dark:hover:bg-green-900 dark:border-green-600 dark:text-green-200"
        >
          <MessageCircle className="h-3 w-3 mr-1" />
          Add Comment
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onUpload}
          className="bg-white hover:bg-green-100 border-green-400 text-green-700 dark:bg-green-950 dark:hover:bg-green-900 dark:border-green-600 dark:text-green-200"
        >
          <Upload className="h-3 w-3 mr-1" />
          Upload
        </Button>
      </div>
      {!canClose && (
        <p className="text-xs text-green-600 dark:text-green-400 mt-3 italic">
          Only {creatorName || 'the card creator'} or an Admin can close this card.
        </p>
      )}
    </div>
  );
}

// Request Sample Handler - extracted for reuse
function useRequestSample(cardId: string, currentOwner: 'mor' | 'arc', onOwnerChange?: () => void) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequestSample = async () => {
    if (!user?.id) return;
    setIsRequesting(true);
    
    try {
      const targetOwner = 'arc';
      
      // 1. Log sample_requested activity with embedded move info
      const { error: activityError } = await supabase
        .from('development_card_activity')
        .insert({
          card_id: cardId,
          user_id: user.id,
          activity_type: 'sample_requested',
          content: 'Sample requested',
          metadata: {
            moved_from: currentOwner,
            moved_to: targetOwner,
          },
        });
      
      if (activityError) throw activityError;

      // 2. Move card to ARC (China) and set pending action for sample tracking
      const { error: moveError } = await (supabase.from('development_items') as any)
        .update({ 
          current_owner: targetOwner,
          is_new_for_other_team: true,
          pending_action_type: 'sample_tracking',
          pending_action_due_at: null,
          pending_action_snoozed_until: null,
          pending_action_snoozed_by: null,
        })
        .eq('id', cardId);
      
      if (moveError) throw moveError;

      // NO separate ownership_change entry - move is embedded in sample_requested

      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      toast({ title: 'Sample requested & card moved to China' });
      onOwnerChange?.();
    } catch (error) {
      toast({ title: 'Error', description: String(error), variant: 'destructive' });
    } finally {
      setIsRequesting(false);
    }
  };

  return { handleRequestSample, isRequesting };
}

// Post-Acknowledgement Prompt - shows after acknowledging an answer to guide next steps
interface PostAcknowledgementPromptProps {
  cardId: string;
  cardType: 'item' | 'item_group' | 'task';
  currentOwner: 'mor' | 'arc';
  fobPriceUsd?: number | null;
  moq?: number | null;
  qtyPerContainer?: number | null;
  containerType?: string | null;
  hasPendingSamples?: boolean;
  onOpenCommercialSection?: () => void;
  onOpenSampleSection?: () => void;
  onAskQuestion: () => void;
  onAddComment: () => void;
  onDismiss: () => void;
}

function PostAcknowledgementPrompt({
  cardId,
  cardType,
  currentOwner,
  fobPriceUsd,
  moq,
  qtyPerContainer,
  containerType,
  hasPendingSamples,
  onOpenCommercialSection,
  onOpenSampleSection,
  onAskQuestion,
  onAddComment,
  onDismiss,
}: PostAcknowledgementPromptProps) {
  // Check for missing commercial data
  const hasAllCommercialData = fobPriceUsd && moq && qtyPerContainer && containerType;
  const missingCommercialFields: string[] = [];
  if (!fobPriceUsd) missingCommercialFields.push('FOB Price');
  if (!moq) missingCommercialFields.push('MOQ');
  if (!qtyPerContainer) missingCommercialFields.push('Qty/Container');
  if (!containerType) missingCommercialFields.push('Container Type');
  
  // Determine what to highlight
  const showCommercialPrompt = !hasAllCommercialData && cardType !== 'task';
  const showSamplePrompt = hasPendingSamples && cardType !== 'task';
  
  // If nothing specific to highlight, show generic prompt
  const showGenericPrompt = !showCommercialPrompt && !showSamplePrompt;

  return (
    <div className="rounded-lg p-4 mb-4 border-2 bg-sky-50 border-sky-300 dark:bg-sky-950/30 dark:border-sky-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-sky-600 dark:text-sky-400" />
          <span className="font-medium text-sm text-sky-800 dark:text-sky-200">What's next?</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="h-6 px-2 text-xs text-sky-600 hover:text-sky-800 hover:bg-sky-100 dark:text-sky-400 dark:hover:text-sky-200 dark:hover:bg-sky-900"
        >
          Dismiss
        </Button>
      </div>
      
      <p className="text-sm text-sky-700 dark:text-sky-300 mb-3">
        {showCommercialPrompt && (
          <>Missing commercial data: <span className="font-medium">{missingCommercialFields.join(', ')}</span></>
        )}
        {showSamplePrompt && !showCommercialPrompt && (
          <>You have pending samples to review or request.</>
        )}
        {showGenericPrompt && (
          <>Answer acknowledged! What would you like to do next?</>
        )}
      </p>
      
      <div className="flex flex-wrap gap-2">
        {showCommercialPrompt && onOpenCommercialSection && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onOpenCommercialSection}
            className="bg-white hover:bg-sky-100 border-sky-300 text-sky-700 dark:bg-sky-950 dark:hover:bg-sky-900 dark:border-sky-600 dark:text-sky-200"
          >
            <DollarSign className="h-3 w-3 mr-1" />
            Add Commercial Data
          </Button>
        )}
        {showSamplePrompt && onOpenSampleSection && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onOpenSampleSection}
            className="bg-white hover:bg-sky-100 border-sky-300 text-sky-700 dark:bg-sky-950 dark:hover:bg-sky-900 dark:border-sky-600 dark:text-sky-200"
          >
            <Package className="h-3 w-3 mr-1" />
            Review Samples
          </Button>
        )}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onAskQuestion}
          className="bg-white hover:bg-sky-100 border-sky-300 text-sky-700 dark:bg-sky-950 dark:hover:bg-sky-900 dark:border-sky-600 dark:text-sky-200"
        >
          <HelpCircle className="h-3 w-3 mr-1" />
          Ask a Question
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onAddComment}
          className="bg-white hover:bg-sky-100 border-sky-300 text-sky-700 dark:bg-sky-950 dark:hover:bg-sky-900 dark:border-sky-600 dark:text-sky-200"
        >
          <MessageCircle className="h-3 w-3 mr-1" />
          Add Comment
        </Button>
      </div>
    </div>
  );
}


export function HistoryTimeline({ 
  cardId, 
  cardType = 'item',
  cardCreatedBy,
  cardTitle,
  cardDescription,
  cardImageUrl,
  isCardSolved = false,
  isNewForOtherTeam = false,
  showAttentionBanner,
  currentOwner = 'arc',
  pendingActionType,
  pendingActionDueAt,
  snoozedUntil,
  fobPriceUsd,
  moq,
  qtyPerContainer,
  containerType,
  onOwnerChange,
  onOpenSampleSection,
  onOpenMessageSection,
  onOpenUploadSection,
  onOpenCommercialSection,
  onCloseCard,
}: HistoryTimelineProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // State for which question has the inline reply box open
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  
  // State to track if we just acknowledged an answer (for showing post-acknowledgement prompt)
  const [showPostAcknowledgementPrompt, setShowPostAcknowledgementPrompt] = useState(false);

  // Mutation to close the card
  const closeCardMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      
      // 1. Update card status to solved
      const { error: updateError } = await (supabase.from('development_items') as any)
        .update({ 
          status: 'approved',
          is_solved: true,
        })
        .eq('id', cardId);
      
      if (updateError) throw updateError;

      // 2. Log the activity
      const { error: activityError } = await supabase.from('development_card_activity').insert({
        card_id: cardId,
        user_id: user.id,
        activity_type: 'status_change',
        content: 'Card closed - development complete',
        metadata: { new_status: 'solved', action: 'closed' },
      });
      
      if (activityError) throw activityError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      toast({ title: 'Card closed', description: 'Development complete!' });
      onCloseCard?.();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to close card', variant: 'destructive' });
    },
  });

  // Mutation to mark question as resolved
  const resolveQuestionMutation = useMutation({
    mutationFn: async (activityId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      // 1. Fetch existing metadata to preserve attachments
      const { data: currentActivity, error: fetchError } = await supabase
        .from('development_card_activity')
        .select('metadata')
        .eq('id', activityId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const existingMetadata = (currentActivity?.metadata as Record<string, any>) || {};
      
      // 2. Merge existing metadata with resolved fields
      const { error } = await supabase
        .from('development_card_activity')
        .update({
          metadata: {
            ...existingMetadata,
            resolved: true,
            resolved_at: new Date().toISOString(),
            resolved_by: user.id,
          },
        })
        .eq('id', activityId);
      
      if (error) throw error;

      // 3. Clear pending action on the card if it was a question
      await (supabase.from('development_items') as any)
        .update({
          pending_action_type: null,
          pending_action_due_at: null,
          pending_action_snoozed_until: null,
          pending_action_snoozed_by: null,
        })
        .eq('id', cardId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      toast({ title: 'Question marked as resolved' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to resolve question', variant: 'destructive' });
    },
  });

  // Mutation to acknowledge an answer
  const acknowledgeAnswerMutation = useMutation({
    mutationFn: async (activityId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      // 1. Fetch current metadata and merge with acknowledged fields
      const { data: currentActivity, error: fetchError } = await supabase
        .from('development_card_activity')
        .select('metadata')
        .eq('id', activityId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const existingMetadata = (currentActivity?.metadata as Record<string, any>) || {};
      
      // 2. Update the activity metadata to mark as acknowledged
      const { error } = await supabase
        .from('development_card_activity')
        .update({
          metadata: {
            ...existingMetadata,
            acknowledged: true,
            acknowledged_at: new Date().toISOString(),
            acknowledged_by: user.id,
          },
        })
        .eq('id', activityId);
      
      if (error) throw error;

      // 3. Clear pending action on the card
      await (supabase.from('development_items') as any)
        .update({
          pending_action_type: null,
          pending_action_due_at: null,
          pending_action_snoozed_until: null,
          pending_action_snoozed_by: null,
        })
        .eq('id', cardId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
      queryClient.invalidateQueries({ queryKey: ['development-items'] });
      toast({ title: 'Answer acknowledged' });
      // Show the post-acknowledgement prompt
      setShowPostAcknowledgementPrompt(true);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to acknowledge answer', variant: 'destructive' });
    },
  });

  // Use request sample hook
  const { handleRequestSample, isRequesting: isRequestingSample } = useRequestSample(cardId, currentOwner, onOwnerChange);

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['development-card-activity', cardId],
    staleTime: 30 * 1000, // Data is fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from('development_card_activity')
        .select('*')
        .eq('card_id', cardId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // Fetch profiles for activities
      const userIds = [...new Set(data.map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.user_id] = p;
        return acc;
      }, {} as Record<string, { full_name: string | null; email: string | null }>);

      return data.map(activity => ({
        ...activity,
        profile: profileMap[activity.user_id] || null,
      })) as Activity[];
    },
  });

  // Fetch samples for banner display
  const { data: samples = [] } = useQuery({
    queryKey: ['development-item-samples-timeline', cardId],
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('development_item_samples')
        .select('*')
        .eq('item_id', cardId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Sample[];
    },
  });

  // Debounced realtime subscription for activity updates
  const invalidateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    const channel = supabase
      .channel(`activity-${cardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'development_card_activity',
          filter: `card_id=eq.${cardId}`,
        },
        () => {
          // Debounce: wait 300ms before invalidating
          if (invalidateTimeoutRef.current) clearTimeout(invalidateTimeoutRef.current);
          invalidateTimeoutRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['development-card-activity', cardId] });
          }, 300);
        }
      )
      .subscribe();

    return () => {
      if (invalidateTimeoutRef.current) clearTimeout(invalidateTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [cardId, queryClient]);

  // Filter out redundant ownership_change entries that have a trigger (were caused by another action)
  // The move info is now embedded in the triggering action's metadata
  const filteredActivities = activities.filter(a => {
    if (a.activity_type === 'ownership_change' && a.metadata?.trigger) {
      return false; // Hide ownership_change if it has a trigger field
    }
    return true;
  });

  // Use filtered activities for display
  const allActivities: Activity[] = filteredActivities;

  // Find the first unresolved question for keyboard shortcut / attention banner
  const firstUnresolvedQuestion = allActivities.find(a => 
    a.activity_type === 'question' && !a.metadata?.resolved
  );

  // Find the first unacknowledged answer (for AnswerPendingBanner)
  const firstUnacknowledgedAnswer = allActivities.find(a => 
    a.activity_type === 'answer' && !a.metadata?.acknowledged
  );

  // Find sample_requested activity (for China to show "Add Tracking" banner)
  const sampleRequestedActivity = allActivities.find(a => 
    a.activity_type === 'sample_requested'
  );
  
  // Check if sample was already shipped after request
  const sampleShippedAfterRequest = sampleRequestedActivity && allActivities.find(a => 
    a.activity_type === 'sample_shipped' && 
    new Date(a.created_at) > new Date(sampleRequestedActivity.created_at)
  );
  
  // Show sample requested banner only if sample wasn't shipped yet and card is with ARC
  const showSampleRequestedBanner = 
    showAttentionBanner && 
    sampleRequestedActivity && 
    !sampleShippedAfterRequest &&
    currentOwner === 'arc';

  // Show answer pending banner when there's an unacknowledged answer and no unresolved question
  const showAnswerPendingBanner = 
    showAttentionBanner && 
    firstUnacknowledgedAnswer && 
    !firstUnresolvedQuestion &&
    !showSampleRequestedBanner;

  // Check for pending samples (requested but not yet approved/arrived)
  const hasPendingSamples = Boolean(
    sampleRequestedActivity && 
    !allActivities.find(a => 
      ['sample_approved', 'sample_rejected'].includes(a.activity_type) &&
      new Date(a.created_at) > new Date(sampleRequestedActivity.created_at)
    )
  );

  // Collect IDs of activities shown in banners (to exclude from timeline)
  const bannerActivityIds = new Set<string>();
  
  if (showAttentionBanner && firstUnresolvedQuestion && !showSampleRequestedBanner && !showAnswerPendingBanner) {
    bannerActivityIds.add(firstUnresolvedQuestion.id);
  }
  
  if (showAnswerPendingBanner && firstUnacknowledgedAnswer) {
    bannerActivityIds.add(firstUnacknowledgedAnswer.id);
  }
  
  if (showSampleRequestedBanner && sampleRequestedActivity) {
    bannerActivityIds.add(sampleRequestedActivity.id);
  }
  
  // Filter activities for timeline (exclude ones shown in banners)
  const timelineActivities = allActivities.filter(a => !bannerActivityIds.has(a.id));

  const groupedActivities = groupByDate(timelineActivities);
  const sortedDates = Object.keys(groupedActivities).sort((a, b) => b.localeCompare(a));

  const getInitials = (profile: Activity['profile']) => {
    if (profile?.full_name) {
      return profile.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (profile?.email) {
      return profile.email[0].toUpperCase();
    }
    return '?';
  };

  // Handle opening reply for the first unresolved question (unused now, actions in banner)
  const handleOpenFirstReply = () => {
    // No longer needed since actions are now in banner
  };

  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        Loading timeline...
      </div>
    );
  }

  if (allActivities.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
        No activity yet
      </div>
    );
  }

  // Find the triggering action for attention banner (prioritize unresolved questions)
  const otherTriggerActivity = activities.find(a => 
    ['commercial_update', 'ownership_change'].includes(a.activity_type)
  );
  const triggerActivity = firstUnresolvedQuestion || otherTriggerActivity;

  // Find the most recent commercial update activity (regardless of position)
  const mostRecentCommercialUpdate = activities.find(a => 
    a.activity_type === 'commercial_update'
  );

  // Find ownership changes triggered by commercial data
  const commercialTriggeredMove = activities.find(a => 
    a.activity_type === 'ownership_change' && 
    a.metadata?.trigger === 'commercial'
  );

  // (sample_requested variables already defined above in banner filtering section)

  // Find sample_approved activity (for showing "Ready to Close" banner)
  const sampleApprovedActivity = activities.find(a => 
    a.activity_type === 'sample_approved'
  );
  
  // Get creator name for display
  const creatorActivity = activities.find(a => a.activity_type === 'created');
  const creatorName = creatorActivity?.profile?.full_name || creatorActivity?.profile?.email;
  
  // Show sample approved banner if sample was approved, card not closed, no unresolved questions
  const showSampleApprovedBanner = 
    sampleApprovedActivity && 
    !isCardSolved &&
    !firstUnresolvedQuestion &&
    !showSampleRequestedBanner &&
    cardCreatedBy;

  // Find in-transit sample for banner
  const inTransitSample = samples.find(s => s.status === 'in_transit');
  
  // Find delivered sample awaiting review (no decision yet)
  const deliveredSampleAwaitingReview = samples.find(s => 
    s.status === 'delivered' && !s.decision
  );

  // Show commercial data banner when commercial data is set, no blocking actions
  const showCommercialDataBanner = 
    showAttentionBanner &&
    !firstUnresolvedQuestion &&
    !firstUnacknowledgedAnswer &&
    !showSampleRequestedBanner &&
    !showSampleApprovedBanner &&
    !inTransitSample &&
    !deliveredSampleAwaitingReview &&
    fobPriceUsd && moq && qtyPerContainer && containerType;

  // Show sample in transit banner
  const showSampleInTransitBanner = 
    showAttentionBanner &&
    !firstUnresolvedQuestion &&
    !firstUnacknowledgedAnswer &&
    !showSampleRequestedBanner &&
    !deliveredSampleAwaitingReview &&
    inTransitSample;

  // Show sample delivered banner
  const showSampleDeliveredBanner = 
    showAttentionBanner &&
    !firstUnresolvedQuestion &&
    !firstUnacknowledgedAnswer &&
    !showSampleRequestedBanner &&
    deliveredSampleAwaitingReview;

  // Show new card banner when card is new for receiving team and no other priority banners
  const showNewCardBanner = 
    showAttentionBanner &&
    isNewForOtherTeam &&
    cardTitle &&
    !firstUnresolvedQuestion &&
    !firstUnacknowledgedAnswer &&
    !showSampleRequestedBanner &&
    !showSampleApprovedBanner &&
    !inTransitSample &&
    !deliveredSampleAwaitingReview;

  // Get commercial update timestamp for display
  const commercialUpdatedAt = mostRecentCommercialUpdate 
    ? formatDistanceToNow(parseISO(mostRecentCommercialUpdate.created_at), { addSuffix: true })
    : undefined;

  return (
    <div className="space-y-6 py-4">
      {/* Sample Approved Banner - for closing the card */}
      {showSampleApprovedBanner && cardCreatedBy && onOpenMessageSection && (
        <SampleApprovedBanner
          cardId={cardId}
          cardCreatedBy={cardCreatedBy}
          creatorName={creatorName || undefined}
          onCloseCard={() => closeCardMutation.mutate()}
          onAskQuestion={() => onOpenMessageSection('question')}
          onAddComment={() => onOpenMessageSection('comment')}
          onUpload={() => onOpenUploadSection?.()}
          isClosing={closeCardMutation.isPending}
        />
      )}

      {/* Sample Requested Banner - for China to add tracking */}
      {showSampleRequestedBanner && sampleRequestedActivity && (
        <SampleRequestedBanner
          activity={sampleRequestedActivity}
          cardId={cardId}
          currentOwner={currentOwner}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['development-items'] });
            queryClient.invalidateQueries({ queryKey: ['development-item-samples-timeline', cardId] });
            onOwnerChange?.();
          }}
        />
      )}

      {/* Sample Delivered Banner - awaiting review */}
      {showSampleDeliveredBanner && deliveredSampleAwaitingReview && onOpenMessageSection && (
        <SampleDeliveredBanner
          sample={deliveredSampleAwaitingReview}
          cardId={cardId}
          onReviewSample={(sampleId) => onOpenSampleSection?.(sampleId)}
          onAskQuestion={() => onOpenMessageSection('question')}
        />
      )}

      {/* Sample In Transit Banner */}
      {showSampleInTransitBanner && inTransitSample && onOpenMessageSection && (
        <SampleInTransitBanner
          sample={inTransitSample}
          cardId={cardId}
          onMarkArrived={() => {
            queryClient.invalidateQueries({ queryKey: ['development-item-samples-timeline', cardId] });
          }}
          onAskQuestion={() => onOpenMessageSection('question')}
          onAddComment={() => onOpenMessageSection('comment')}
        />
      )}
      
      {/* Commercial Data Banner - when commercial data is set */}
      {showCommercialDataBanner && !showNewCardBanner && fobPriceUsd && moq && qtyPerContainer && containerType && onOpenMessageSection && (
        <CommercialDataBanner
          fobPriceUsd={fobPriceUsd}
          moq={moq}
          qtyPerContainer={qtyPerContainer}
          containerType={containerType}
          updatedAt={commercialUpdatedAt}
          onRequestSample={handleRequestSample}
          onAskQuestion={() => onOpenMessageSection('question')}
          onAddComment={() => onOpenMessageSection('comment')}
          onUpload={() => onOpenUploadSection?.()}
        />
      )}

      {/* New Card Banner - when card is new for receiving team */}
      {showNewCardBanner && cardTitle && onOpenMessageSection && (
        <NewCardBanner
          cardTitle={cardTitle}
          cardDescription={cardDescription}
          cardImageUrl={cardImageUrl}
          cardId={cardId}
          pendingActionType={pendingActionType}
          onAddComment={() => onOpenMessageSection('comment')}
          onAskQuestion={() => onOpenMessageSection('question')}
          onUpload={() => onOpenUploadSection?.()}
        />
      )}
      
      {/* Attention Banner - when there's an unresolved question */}
      {showAttentionBanner && firstUnresolvedQuestion && !showSampleRequestedBanner && !showSampleApprovedBanner && !showAnswerPendingBanner && (
        <AttentionBanner
          activity={firstUnresolvedQuestion}
          cardId={cardId}
          currentOwner={currentOwner}
          pendingActionType={pendingActionType}
          onResolve={(id) => resolveQuestionMutation.mutate(id)}
          onOwnerChange={onOwnerChange}
          isResolving={resolveQuestionMutation.isPending}
        />
      )}

      {/* Answer Pending Banner - when there's an unacknowledged answer */}
      {showAnswerPendingBanner && firstUnacknowledgedAnswer && (
        <AnswerPendingBanner
          activity={firstUnacknowledgedAnswer}
          cardId={cardId}
          currentOwner={currentOwner}
          onAcknowledge={(id) => acknowledgeAnswerMutation.mutate(id)}
          onOwnerChange={onOwnerChange}
          isAcknowledging={acknowledgeAnswerMutation.isPending}
        />
      )}

      {/* Post-Acknowledgement Prompt - after acknowledging an answer, highlight next steps */}
      {showPostAcknowledgementPrompt && !showAnswerPendingBanner && !firstUnresolvedQuestion && onOpenMessageSection && (
        <PostAcknowledgementPrompt
          cardId={cardId}
          cardType={cardType}
          currentOwner={currentOwner}
          fobPriceUsd={fobPriceUsd}
          moq={moq}
          qtyPerContainer={qtyPerContainer}
          containerType={containerType}
          hasPendingSamples={hasPendingSamples}
          onOpenCommercialSection={onOpenCommercialSection}
          onOpenSampleSection={() => onOpenSampleSection?.()}
          onAskQuestion={() => onOpenMessageSection('question')}
          onAddComment={() => onOpenMessageSection('comment')}
          onDismiss={() => setShowPostAcknowledgementPrompt(false)}
        />
      )}
      
      {sortedDates.map((dateKey) => (
        <div key={dateKey}>
          <div className="sticky top-0 bg-background py-1 mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {formatDateHeader(dateKey + 'T00:00:00')}
            </span>
          </div>
          
          <div className="space-y-2">
            {groupedActivities[dateKey].map((activity) => {
              // Special card for "created" activity
              if (activity.activity_type === 'created') {
                return (
                  <CreatedActivityCard
                    key={activity.id}
                    activity={activity}
                    cardTitle={cardTitle}
                    cardDescription={cardDescription}
                    cardImageUrl={cardImageUrl}
                  />
                );
              }
              
              // Render compact row for other system activities
              if (isCompactActivity(activity.activity_type)) {
                return <CompactActivityRow key={activity.id} activity={activity} />;
              }
              
              const isQuestion = activity.activity_type === 'question';
              const isAnswer = activity.activity_type === 'answer';
              const isResolved = isQuestion && activity.metadata?.resolved;
              
              return (
                <div key={activity.id}>
                  <div 
                    className={cn(
                      "flex gap-3 p-3 rounded-lg border",
                      isResolved 
                        ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800"
                        : ACTIVITY_STYLES[activity.activity_type] || ACTIVITY_STYLES.comment
                    )}
                  >
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      <AvatarFallback className="text-xs bg-background">
                        {getInitials(activity.profile)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {activity.profile?.full_name || activity.profile?.email || 'Unknown'}
                        </span>
                        <span className="flex items-center gap-1 text-xs">
                          {isResolved ? <Check className="h-3.5 w-3.5" /> : (ACTIVITY_ICONS[activity.activity_type] || ACTIVITY_ICONS.comment)}
                          {isResolved ? 'question resolved' : (ACTIVITY_LABELS[activity.activity_type] || activity.activity_type)}
                        </span>
                        <span className="text-xs opacity-70">
                          {format(parseISO(activity.created_at), 'HH:mm')}
                        </span>
                        {isResolved && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-100 border-green-300 text-green-700 dark:bg-green-900 dark:border-green-700 dark:text-green-200">
                            Resolved
                          </Badge>
                        )}
                      </div>
                      
                      {activity.content && (
                        <p className={cn(
                          "text-sm mt-1 whitespace-pre-wrap",
                          isResolved && "line-through opacity-70"
                        )}>
                          {isQuestion ? (
                            <span className="italic">"{activity.content}"</span>
                          ) : (
                            activity.content
                          )}
                        </p>
                      )}
                      
                      {/* Show attachments if present */}
                      {activity.metadata?.attachments && Array.isArray(activity.metadata.attachments) && activity.metadata.attachments.length > 0 && (
                        <AttachmentDisplay 
                          attachments={activity.metadata.attachments as UploadedAttachment[]} 
                        />
                      )}
                      
                      {/* Action buttons for unresolved questions */}
                      {isQuestion && !isResolved && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900"
                            onClick={() => setReplyingToId(activity.id)}
                          >
                            <Reply className="h-3 w-3 mr-1" />
                            Reply
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900"
                            onClick={() => resolveQuestionMutation.mutate(activity.id)}
                            disabled={resolveQuestionMutation.isPending}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            {resolveQuestionMutation.isPending ? 'Resolving...' : 'Mark as Resolved'}
                          </Button>
                          <SnoozeButton
                            cardId={cardId}
                            currentActionType="question"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900"
                          />
                        </div>
                      )}
                      
                      {/* Action buttons for unacknowledged answers */}
                      {isAnswer && !activity.metadata?.acknowledged && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900"
                            onClick={() => acknowledgeAnswerMutation.mutate(activity.id)}
                            disabled={acknowledgeAnswerMutation.isPending}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            {acknowledgeAnswerMutation.isPending ? 'Acknowledging...' : 'Got it'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900"
                            onClick={() => setReplyingToId(activity.id)}
                          >
                            <Reply className="h-3 w-3 mr-1" />
                            Reply
                          </Button>
                          <SnoozeButton
                            cardId={cardId}
                            currentActionType="answer_pending"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900"
                          />
                        </div>
                      )}
                      
                      {/* Show acknowledged badge */}
                      {isAnswer && activity.metadata?.acknowledged && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-2 bg-green-100 border-green-300 text-green-700 dark:bg-green-900 dark:border-green-700 dark:text-green-200">
                          <Check className="h-3 w-3 mr-1" />
                          Acknowledged
                        </Badge>
                      )}
                      
                      {/* Metadata display for certain types */}
                      {activity.activity_type === 'commercial_update' && activity.metadata && (
                        <p className="text-xs mt-1 opacity-80">
                          {activity.metadata.field?.replace('_', ' ')}: {activity.metadata.value}
                        </p>
                      )}
                      
                      {/* Show which question/answer this is a reply to */}
                      {(isAnswer || (activity.activity_type === 'comment' && activity.metadata?.reply_to_question)) && (
                        <p className="text-xs mt-1 opacity-70 italic">
                          ↳ Reply to question
                        </p>
                      )}
                      {activity.activity_type === 'comment' && activity.metadata?.reply_to_answer && (
                        <p className="text-xs mt-1 opacity-70 italic">
                          ↳ Reply to answer
                        </p>
                      )}
                      {activity.activity_type === 'question' && activity.metadata?.reply_to_answer && (
                        <p className="text-xs mt-1 opacity-70 italic">
                          ↳ Follow-up question
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Inline Reply Box */}
                  {replyingToId === activity.id && (
                    <InlineReplyBox
                      replyToId={activity.id}
                      replyToType={isAnswer ? 'answer' : 'question'}
                      cardId={cardId}
                      currentOwner={currentOwner}
                      pendingActionType={pendingActionType}
                      onClose={() => setReplyingToId(null)}
                      onCardMove={onOwnerChange}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
