import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { FileText, CheckCircle2, XCircle, Send, ClipboardList, User, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UploadedAttachment } from './TimelineUploadButton';

interface CommercialHistoryTimelineProps {
  cardId: string;
}

interface CommercialHistoryStep {
  action: 'requested' | 'submitted' | 'rejected' | 'approved';
  userId: string;
  userName: string | null;
  timestamp: string;
}

interface CommercialCycle {
  id: string;
  steps: CommercialHistoryStep[];
  finalData?: {
    fob_price_usd?: number | null;
    moq?: number | null;
    qty_per_container?: number | null;
    container_type?: string | null;
  };
  attachments?: UploadedAttachment[];
  submissionType?: 'manual' | 'file_only';
  revisionCount: number;
  isApproved: boolean;
  productNames?: string[];
  isAllProducts?: boolean;
}

const STEP_ICONS = {
  requested: ClipboardList,
  submitted: Send,
  rejected: XCircle,
  approved: CheckCircle2,
};

const STEP_COLORS = {
  requested: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
  submitted: 'text-cyan-600 bg-cyan-100 dark:bg-cyan-900/30',
  rejected: 'text-red-600 bg-red-100 dark:bg-red-900/30',
  approved: 'text-green-600 bg-green-100 dark:bg-green-900/30',
};

const CONTAINER_LABELS: Record<string, string> = {
  '20ft': '20ft',
  '40ft': '40ft',
  '40hq': '40HQ',
};

export function CommercialHistoryTimeline({ cardId }: CommercialHistoryTimelineProps) {
  const { data: cycles = [], isLoading } = useQuery({
    queryKey: ['commercial-history', cardId],
    queryFn: async () => {
      // Fetch commercial-related tasks
      const { data: tasks, error: tasksError } = await supabase
        .from('development_card_tasks')
        .select('*')
        .eq('card_id', cardId)
        .in('task_type', ['commercial_request', 'commercial_review'])
        .order('created_at', { ascending: true });

      if (tasksError) throw tasksError;
      if (!tasks || tasks.length === 0) return [];

      // Get all user IDs involved
      const userIds = new Set<string>();
      tasks.forEach(t => {
        userIds.add(t.created_by);
        if (t.completed_by) userIds.add(t.completed_by);
        const meta = t.metadata as Record<string, unknown> | null;
        if (meta?.filled_by) userIds.add(meta.filled_by as string);
        if (meta?.approved_by) userIds.add(meta.approved_by as string);
        if (meta?.rejected_by) userIds.add(meta.rejected_by as string);
      });

      // Fetch user profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', Array.from(userIds));

      const profileMap = new Map<string, string | null>();
      profiles?.forEach(p => profileMap.set(p.user_id, p.full_name));

      // Group tasks into cycles (a cycle = request -> submission -> review outcome)
      // Find the initial commercial_request task and track the full cycle
      const cyclesMap = new Map<string, CommercialCycle>();
      
      // Find root request tasks (not revisions)
      const rootRequests = tasks.filter(t => {
        const meta = t.metadata as Record<string, unknown> | null;
        return t.task_type === 'commercial_request' && !meta?.needs_revision;
      });

      for (const rootTask of rootRequests) {
        const rootMeta = (rootTask.metadata || {}) as Record<string, unknown>;
        const cycle: CommercialCycle = {
          id: rootTask.id,
          steps: [],
          revisionCount: 0,
          isApproved: false,
          productNames: (rootMeta.product_names as string[]) || undefined,
          isAllProducts: (rootMeta.is_all_products as boolean) || undefined,
        };

        // Add requested step
        cycle.steps.push({
          action: 'requested',
          userId: rootTask.created_by,
          userName: profileMap.get(rootTask.created_by) || null,
          timestamp: rootTask.created_at,
        });

        // Find all related tasks in this cycle
        const relatedTasks = tasks.filter(t => {
          if (t.id === rootTask.id) return false;
          // Match by created_by (original requester) or by timestamps
          return t.created_by === rootTask.created_by || 
                 new Date(t.created_at) >= new Date(rootTask.created_at);
        });

        // Track revisions and submissions
        for (const task of relatedTasks) {
          const meta = (task.metadata || {}) as Record<string, unknown>;

          if (task.task_type === 'commercial_request' && meta.needs_revision) {
            cycle.revisionCount++;
          }

          if (task.task_type === 'commercial_review' || 
              (task.task_type === 'commercial_request' && task.status === 'completed')) {
            // Submission
            if (meta.filled_by) {
              cycle.steps.push({
                action: 'submitted',
                userId: meta.filled_by as string,
                userName: profileMap.get(meta.filled_by as string) || null,
                timestamp: (meta.filled_at as string) || task.created_at,
              });
              
              // Store latest data and attachments
              cycle.finalData = {
                fob_price_usd: meta.fob_price_usd as number | null,
                moq: meta.moq as number | null,
                qty_per_container: meta.qty_per_container as number | null,
                container_type: meta.container_type as string | null,
              };
              cycle.attachments = (meta.attachments as UploadedAttachment[]) || undefined;
              cycle.submissionType = (meta.submission_type as 'manual' | 'file_only') || undefined;
            }

            // Check for approval/rejection
            if (task.status === 'completed') {
              if (meta.approved_by) {
                cycle.steps.push({
                  action: 'approved',
                  userId: meta.approved_by as string,
                  userName: profileMap.get(meta.approved_by as string) || null,
                  timestamp: (meta.approved_at as string) || task.completed_at || task.created_at,
                });
                cycle.isApproved = true;
              } else if (meta.rejected_by) {
                cycle.steps.push({
                  action: 'rejected',
                  userId: meta.rejected_by as string,
                  userName: profileMap.get(meta.rejected_by as string) || null,
                  timestamp: (meta.rejected_at as string) || task.completed_at || task.created_at,
                });
              }
            }
          }
        }

        // Deduplicate steps by action+timestamp
        const uniqueSteps = cycle.steps.reduce((acc, step) => {
          const key = `${step.action}-${step.timestamp}`;
          if (!acc.some(s => `${s.action}-${s.timestamp}` === key)) {
            acc.push(step);
          }
          return acc;
        }, [] as CommercialHistoryStep[]);

        cycle.steps = uniqueSteps.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        cyclesMap.set(rootTask.id, cycle);
      }

      return Array.from(cyclesMap.values());
    },
    enabled: !!cardId,
  });

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground py-2">
        Loading history...
      </div>
    );
  }

  if (cycles.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 pt-3 border-t">
      <p className="text-xs font-medium text-muted-foreground">Negotiation History</p>
      <div className="space-y-2">
        {cycles.map((cycle) => (
          <CommercialCycleCard key={cycle.id} cycle={cycle} />
        ))}
      </div>
    </div>
  );
}

function CommercialCycleCard({ cycle }: { cycle: CommercialCycle }) {
  return (
    <div className={cn(
      "border rounded-lg p-3 text-xs",
      cycle.isApproved && "border-green-300 bg-green-50/50 dark:bg-green-900/20"
    )}>
      {/* Header with product names and data summary */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1">
          {/* Product context */}
          {cycle.productNames && cycle.productNames.length > 0 && (
            <div className="text-[10px] text-muted-foreground mb-1">
              📦 {cycle.isAllProducts ? 'All items' : cycle.productNames.join(', ')}
            </div>
          )}
          {cycle.finalData && (cycle.finalData.fob_price_usd || cycle.finalData.moq) ? (
            <div className="flex flex-wrap gap-2 text-[11px]">
              {cycle.finalData.fob_price_usd && (
                <span className="font-medium">${cycle.finalData.fob_price_usd.toFixed(2)} FOB</span>
              )}
              {cycle.finalData.moq && (
                <span className="text-muted-foreground">MOQ {cycle.finalData.moq.toLocaleString()}</span>
              )}
              {cycle.finalData.qty_per_container && (
                <span className="text-muted-foreground">
                  {cycle.finalData.qty_per_container.toLocaleString()}/{CONTAINER_LABELS[cycle.finalData.container_type || ''] || cycle.finalData.container_type}
                </span>
              )}
            </div>
          ) : cycle.submissionType === 'file_only' ? (
            <span className="text-muted-foreground italic">Via file upload</span>
          ) : (
            <span className="text-muted-foreground">Pending data...</span>
          )}
        </div>
        {cycle.revisionCount > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {cycle.revisionCount} revision{cycle.revisionCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Attachments */}
      {cycle.attachments && cycle.attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {cycle.attachments.map((file) => (
            <a
              key={file.id}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 bg-muted rounded px-1.5 py-0.5 hover:bg-muted/80 transition-colors text-[10px]"
            >
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span className="truncate max-w-[100px]">{file.name}</span>
            </a>
          ))}
        </div>
      )}

      {/* Steps timeline - compact horizontal style like samples */}
      <div className="pt-2 border-t space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          History
        </p>
        <div className="space-y-1">
          {cycle.steps.map((step, idx) => {
            const Icon = STEP_ICONS[step.action];
            return (
              <div key={idx} className="flex items-center gap-2 text-[10px]">
                <span className={cn("p-1 rounded-full", STEP_COLORS[step.action])}>
                  <Icon className="h-2.5 w-2.5" />
                </span>
                <span className="font-medium capitalize">{step.action}</span>
                <span className="text-muted-foreground">by</span>
                <span className="flex items-center gap-1">
                  <User className="h-2.5 w-2.5 text-muted-foreground" />
                  {step.userName || 'Unknown'}
                </span>
                <span className="text-muted-foreground ml-auto">
                  {format(new Date(step.timestamp), 'dd/MM HH:mm')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
