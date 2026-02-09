import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface PerformanceData {
  monthKey: string;
  monthLabel: string;
  forecast: number;
  actual: number;
  percentage: number; // actual/forecast * 100
  delta: number; // actual - forecast
}

interface PerformanceIndicatorProps {
  performanceData: PerformanceData[];
  className?: string;
}

export const PerformanceIndicator: React.FC<PerformanceIndicatorProps> = ({
  performanceData,
  className = '',
}) => {
  // If no completed months yet, show placeholder
  if (performanceData.length === 0) {
    return (
      <div className={`flex flex-col items-center bg-muted/30 rounded-md px-3 py-1.5 ${className}`}>
        <span className="text-[10px] text-muted-foreground uppercase">Performance</span>
        <span className="text-xs text-muted-foreground">No data yet</span>
      </div>
    );
  }

  // Calculate overall average
  const totalActual = performanceData.reduce((sum, d) => sum + d.actual, 0);
  const totalForecast = performanceData.reduce((sum, d) => sum + d.forecast, 0);
  const avgPercentage = totalForecast > 0 ? Math.round((totalActual / totalForecast) * 100) : 0;
  const totalDelta = totalActual - totalForecast;

  // Determine status and colors
  const getStatus = (percentage: number) => {
    if (percentage >= 105) return 'over'; // Selling more than expected
    if (percentage <= 95) return 'under'; // Selling less than expected
    return 'on-target'; // Within 5% of target
  };

  const status = getStatus(avgPercentage);
  
  const getStatusColor = (s: typeof status) => {
    switch (s) {
      case 'over':
        return 'text-green-600 dark:text-green-400';
      case 'under':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-yellow-600 dark:text-yellow-400';
    }
  };

  const getStatusIcon = (s: typeof status) => {
    switch (s) {
      case 'over':
        return <TrendingUp className="h-3.5 w-3.5" />;
      case 'under':
        return <TrendingDown className="h-3.5 w-3.5" />;
      default:
        return <Minus className="h-3.5 w-3.5" />;
    }
  };

  const getStatusBg = (s: typeof status) => {
    switch (s) {
      case 'over':
        return 'bg-green-50 dark:bg-green-950/30';
      case 'under':
        return 'bg-red-50 dark:bg-red-950/30';
      default:
        return 'bg-yellow-50 dark:bg-yellow-950/30';
    }
  };

  const formatDelta = (delta: number) => {
    if (delta > 0) return `+${delta.toLocaleString('pt-BR')}`;
    return delta.toLocaleString('pt-BR');
  };

  const fmtNum = (n: number) => n.toLocaleString('pt-BR');

  const tooltipContent = (
    <div className="text-xs">
      <div className="font-semibold border-b pb-1 mb-1.5">PV vs Actual (Last {performanceData.length}M)</div>
      <div className="grid grid-cols-4 gap-x-3 gap-y-0.5 items-center">
        <span />
        <span className="text-muted-foreground font-medium text-right">PV</span>
        <span className="text-muted-foreground font-medium text-right">Hist.</span>
        <span className="text-muted-foreground font-medium text-right">Delta</span>
        {performanceData.map((d) => {
          const monthStatus = getStatus(d.percentage);
          return (
            <React.Fragment key={d.monthKey}>
              <span>{d.monthLabel}</span>
              <span className="text-right">{fmtNum(d.forecast)}</span>
              <span className="text-right">{fmtNum(d.actual)}</span>
              <span className={`text-right ${getStatusColor(monthStatus)}`}>{formatDelta(d.delta)}</span>
            </React.Fragment>
          );
        })}
      </div>
      <div className="border-t mt-1.5 pt-1 grid grid-cols-4 gap-x-3 font-semibold items-center">
        <span>Total</span>
        <span className="text-right">{fmtNum(totalForecast)}</span>
        <span className="text-right">{fmtNum(totalActual)}</span>
        <span className={`text-right ${getStatusColor(status)}`}>{formatDelta(totalDelta)}</span>
      </div>
      <div className={`text-right mt-0.5 font-semibold ${getStatusColor(status)}`}>({avgPercentage}%)</div>
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex flex-col items-center rounded-md px-3 py-1.5 cursor-help ${getStatusBg(status)} ${className}`}>
            <span className="text-[10px] text-muted-foreground uppercase">Performance</span>
            <div className={`flex items-center gap-1 font-bold text-sm ${getStatusColor(status)}`}>
              {getStatusIcon(status)}
              <span>{avgPercentage}%</span>
            </div>
            <span className={`text-[10px] ${getStatusColor(status)}`}>
              {formatDelta(totalDelta)} units
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
