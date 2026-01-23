import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface PeriodStats {
  label: string;
  ruptureCount: number;
  status: 'critical' | 'alert' | 'attention' | 'ok';
}

interface PeriodIndicatorProps {
  label: string;
  stats: PeriodStats;
  className?: string;
}

const statusConfig = {
  critical: {
    bg: 'bg-destructive',
    text: 'text-destructive',
    bgLight: 'bg-destructive/10',
    label: 'Crítico',
  },
  alert: {
    bg: 'bg-orange-500',
    text: 'text-orange-500',
    bgLight: 'bg-orange-500/10',
    label: 'Alerta',
  },
  attention: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-500',
    bgLight: 'bg-yellow-500/10',
    label: 'Atenção',
  },
  ok: {
    bg: 'bg-green-500',
    text: 'text-green-500',
    bgLight: 'bg-green-500/10',
    label: 'OK',
  },
};

export function PeriodIndicator({ label, stats, className }: PeriodIndicatorProps) {
  const config = statusConfig[stats.status];
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
              config.bgLight,
              className
            )}
          >
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            <div className={cn("w-3 h-3 rounded-full", config.bg)} />
            {stats.ruptureCount > 0 ? (
              <span className={cn("text-xs font-semibold", config.text)}>
                {stats.ruptureCount} rupt.
              </span>
            ) : (
              <span className="text-xs font-medium text-green-600">OK</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {stats.ruptureCount > 0 
              ? `${stats.ruptureCount} produto${stats.ruptureCount > 1 ? 's' : ''} com ruptura em ${label}`
              : `Estoque OK para ${label}`
            }
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
