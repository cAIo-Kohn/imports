import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { getRoleLabel, type AssigneeRole } from '@/hooks/useCardWorkflow';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HandoffTimelineProps {
  cardId: string;
}

interface HandoffActivity {
  id: string;
  created_at: string;
  content: string;
  user_id: string;
  metadata: {
    from_role?: string;
    to_role?: string;
    workflow_status?: string;
    action?: string;
  };
  user_name?: string | null;
}

export function HandoffTimeline({ cardId }: HandoffTimelineProps) {
  const { data: handoffs = [], isLoading } = useQuery({
    queryKey: ['handoff-timeline', cardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('development_card_activity')
        .select('id, created_at, content, user_id, metadata')
        .eq('card_id', cardId)
        .eq('activity_type', 'handoff')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch user names
      const userIds = [...new Set(data.map(h => h.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      const nameMap = new Map<string, string | null>();
      profiles?.forEach(p => nameMap.set(p.user_id, p.full_name));

      return data.map(h => ({
        ...h,
        metadata: (h.metadata || {}) as HandoffActivity['metadata'],
        user_name: nameMap.get(h.user_id) || null,
      })) as HandoffActivity[];
    },
    enabled: !!cardId,
  });

  if (handoffs.length === 0) return null;

  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
        <ArrowRight className="h-4 w-4" />
        <span>Responsibility History</span>
        <span className="text-xs bg-muted px-1.5 py-0.5 rounded ml-1">{handoffs.length}</span>
        <ChevronDown className="h-4 w-4 ml-auto transition-transform ui-open:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-3 space-y-2">
          {handoffs.map((handoff) => {
            const fromRole = handoff.metadata.from_role as AssigneeRole;
            const toRole = handoff.metadata.to_role as AssigneeRole;
            const isComplete = handoff.metadata.action === 'workflow_complete';

            return (
              <div
                key={handoff.id}
                className="flex items-start gap-2 text-xs border-l-2 border-muted pl-3 py-1"
              >
                <div className="flex-shrink-0 text-muted-foreground w-16">
                  {format(new Date(handoff.created_at), 'MMM d, HH:mm')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    {isComplete ? (
                      <span className="flex items-center gap-1 text-green-600 font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        Complete
                      </span>
                    ) : (
                      <>
                        {fromRole && (
                          <span className={cn(
                            'font-medium',
                            fromRole === 'trader' ? 'text-red-600' : 'text-amber-600'
                          )}>
                            {getRoleLabel(fromRole)}
                          </span>
                        )}
                        {fromRole && toRole && (
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        )}
                        {toRole && (
                          <span className={cn(
                            'font-medium',
                            toRole === 'trader' ? 'text-red-600' : 'text-amber-600'
                          )}>
                            {getRoleLabel(toRole)}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  {handoff.content && (
                    <p className="text-muted-foreground mt-0.5 truncate">
                      "{handoff.content}"
                    </p>
                  )}
                  {handoff.user_name && (
                    <p className="text-muted-foreground/60 text-[10px]">
                      by {handoff.user_name}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
