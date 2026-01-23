import { cn } from "@/lib/utils";

interface HealthBarProps {
  critical: number;
  warning: number;
  healthy: number;
  className?: string;
  showLabels?: boolean;
}

export function HealthBar({ critical, warning, healthy, className, showLabels = false }: HealthBarProps) {
  const total = critical + warning + healthy;
  
  if (total === 0) {
    return (
      <div className={cn("h-3 rounded-full bg-muted", className)} />
    );
  }

  const criticalPercent = (critical / total) * 100;
  const warningPercent = (warning / total) * 100;
  const healthyPercent = (healthy / total) * 100;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex h-3 rounded-full overflow-hidden bg-muted">
        {critical > 0 && (
          <div 
            className="bg-destructive transition-all duration-500 ease-out"
            style={{ width: `${criticalPercent}%` }}
          />
        )}
        {warning > 0 && (
          <div 
            className="bg-yellow-500 transition-all duration-500 ease-out"
            style={{ width: `${warningPercent}%` }}
          />
        )}
        {healthy > 0 && (
          <div 
            className="bg-green-500 transition-all duration-500 ease-out"
            style={{ width: `${healthyPercent}%` }}
          />
        )}
      </div>
      {showLabels && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-destructive" />
            {critical} Crítico
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            {warning} Atenção
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {healthy} OK
          </span>
        </div>
      )}
    </div>
  );
}
