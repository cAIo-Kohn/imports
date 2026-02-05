import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { FileText, CheckCircle2, XCircle, Send, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UploadedAttachment } from './TimelineUploadButton';

interface CommercialHistoryTimelineProps {
  cardId: string;
}

interface CommercialHistoryStep {
  id: string;
  action: 'requested' | 'submitted' | 'rejected' | 'approved';
  userId: string;
  userName: string | null;
  timestamp: string;
  data?: {
    fob_price_usd?: number | null;
    moq?: number | null;
    qty_per_container?: number | null;
    container_type?: string | null;
  };
  attachments?: UploadedAttachment[];
  feedback?: string;
  revisionNumber?: number;
  submissionType?: 'manual' | 'file_only';
}

const ACTION_CONFIG = {
  requested: {
    icon: ClipboardList,
    label: 'Requested',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  submitted: {
    icon: Send,
    label: 'Submitted',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
  },
  rejected: {
    icon: XCircle,
    label: 'Revision Requested',
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  approved: {
    icon: CheckCircle2,
    label: 'Approved',
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
};

const CONTAINER_LABELS: Record<string, string> = {
  '20ft': '20ft',
  '40ft': '40ft',
  '40hq': '40HQ',
};

export function CommercialHistoryTimeline({ cardId }: CommercialHistoryTimelineProps) {
  const { data: historySteps = [], isLoading } = useQuery({
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

      // Build timeline steps
      const steps: CommercialHistoryStep[] = [];

      for (const task of tasks) {
        const meta = (task.metadata || {}) as Record<string, unknown>;

        if (task.task_type === 'commercial_request') {
          // Request step
          steps.push({
            id: `${task.id}-request`,
            action: 'requested',
            userId: task.created_by,
            userName: profileMap.get(task.created_by) || null,
            timestamp: task.created_at,
          });

          // If completed (data was filled)
          if (task.status === 'completed' && meta.filled_by) {
            steps.push({
              id: `${task.id}-submit`,
              action: 'submitted',
              userId: meta.filled_by as string,
              userName: profileMap.get(meta.filled_by as string) || null,
              timestamp: (meta.filled_at as string) || task.completed_at || task.created_at,
              data: {
                fob_price_usd: meta.fob_price_usd as number | null,
                moq: meta.moq as number | null,
                qty_per_container: meta.qty_per_container as number | null,
                container_type: meta.container_type as string | null,
              },
              attachments: (meta.attachments as UploadedAttachment[]) || undefined,
              revisionNumber: (meta.revision_number as number) || 1,
              submissionType: (meta.submission_type as 'manual' | 'file_only') || undefined,
            });
          }
        }

        if (task.task_type === 'commercial_review') {
          // Submission for review
          if (meta.filled_by) {
            steps.push({
              id: `${task.id}-submit`,
              action: 'submitted',
              userId: meta.filled_by as string,
              userName: profileMap.get(meta.filled_by as string) || null,
              timestamp: (meta.filled_at as string) || task.created_at,
              data: {
                fob_price_usd: meta.fob_price_usd as number | null,
                moq: meta.moq as number | null,
                qty_per_container: meta.qty_per_container as number | null,
                container_type: meta.container_type as string | null,
              },
              attachments: (meta.attachments as UploadedAttachment[]) || undefined,
              revisionNumber: (meta.revision_number as number) || 1,
              submissionType: (meta.submission_type as 'manual' | 'file_only') || undefined,
            });
          }

          // Check if approved or rejected
          if (task.status === 'completed') {
            if (meta.approved_by) {
              steps.push({
                id: `${task.id}-approved`,
                action: 'approved',
                userId: meta.approved_by as string,
                userName: profileMap.get(meta.approved_by as string) || null,
                timestamp: (meta.approved_at as string) || task.completed_at || task.created_at,
                data: {
                  fob_price_usd: meta.fob_price_usd as number | null,
                  moq: meta.moq as number | null,
                  qty_per_container: meta.qty_per_container as number | null,
                  container_type: meta.container_type as string | null,
                },
              });
            } else if (meta.rejected_by) {
              steps.push({
                id: `${task.id}-rejected`,
                action: 'rejected',
                userId: meta.rejected_by as string,
                userName: profileMap.get(meta.rejected_by as string) || null,
                timestamp: (meta.rejected_at as string) || task.completed_at || task.created_at,
                feedback: meta.rejection_reason as string | undefined,
                revisionNumber: (meta.revision_number as number) || 1,
              });
            }
          }
        }
      }

      // Sort by timestamp and deduplicate
      const uniqueSteps = steps.reduce((acc, step) => {
        const key = `${step.action}-${step.timestamp}`;
        if (!acc.some(s => `${s.action}-${s.timestamp}` === key)) {
          acc.push(step);
        }
        return acc;
      }, [] as CommercialHistoryStep[]);

      return uniqueSteps.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
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

  if (historySteps.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 pt-3 border-t">
      <p className="text-xs font-medium text-muted-foreground">Negotiation History</p>
      <div className="space-y-2">
        {historySteps.map((step) => {
          const config = ACTION_CONFIG[step.action];
          const Icon = config.icon;

          return (
            <div
              key={step.id}
              className={cn(
                'rounded-md p-2 text-xs',
                config.bgColor
              )}
            >
              <div className="flex items-start gap-2">
                <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', config.color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('font-medium', config.color)}>
                      {config.label}
                      {step.revisionNumber && step.revisionNumber > 1 && (
                        <span className="ml-1 text-muted-foreground font-normal">
                          (Rev. #{step.revisionNumber})
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground text-[10px] flex-shrink-0">
                      {format(new Date(step.timestamp), 'MMM d, HH:mm')}
                    </span>
                  </div>
                  
                  <p className="text-muted-foreground mt-0.5">
                    by {step.userName || 'Unknown'}
                  </p>

                  {/* Show data if submitted/approved */}
                  {step.data && (step.action === 'submitted' || step.action === 'approved') && (
                    <div className="mt-1.5 text-foreground">
                      {step.submissionType === 'file_only' ? (
                        <span className="italic text-muted-foreground">Via file upload</span>
                      ) : step.data.fob_price_usd || step.data.moq ? (
                        <span>
                          {step.data.fob_price_usd != null && `$${step.data.fob_price_usd.toFixed(2)} FOB`}
                          {step.data.fob_price_usd != null && step.data.moq != null && ' · '}
                          {step.data.moq != null && `MOQ ${step.data.moq.toLocaleString()}`}
                          {step.data.qty_per_container != null && (
                            <> · {step.data.qty_per_container.toLocaleString()}/{CONTAINER_LABELS[step.data.container_type || ''] || step.data.container_type}</>
                          )}
                        </span>
                      ) : null}
                    </div>
                  )}

                  {/* Show feedback if rejected */}
                  {step.action === 'rejected' && step.feedback && (
                    <p className="mt-1.5 text-foreground italic">
                      "{step.feedback}"
                    </p>
                  )}

                  {/* Show attachments */}
                  {step.attachments && step.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {step.attachments.map((file) => (
                        <a
                          key={file.id}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 bg-background/50 rounded px-1.5 py-0.5 hover:bg-background transition-colors"
                        >
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[120px]">{file.name}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
