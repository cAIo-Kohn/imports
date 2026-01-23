import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface DataPoint {
  month: string;
  value: number;
}

interface TrendSparklineProps {
  data: DataPoint[];
  trend: 'up' | 'down' | 'stable';
  className?: string;
}

export function TrendSparkline({ data, trend, className }: TrendSparklineProps) {
  const color = useMemo(() => {
    switch (trend) {
      case 'up':
        return 'hsl(var(--chart-2))'; // green
      case 'down':
        return 'hsl(var(--destructive))'; // red
      default:
        return 'hsl(var(--muted-foreground))'; // neutral
    }
  }, [trend]);

  if (data.length < 2) {
    return (
      <div className={`h-10 flex items-center justify-center text-xs text-muted-foreground ${className}`}>
        Sem dados
      </div>
    );
  }

  return (
    <div className={`h-10 ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={`gradient-${trend}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#gradient-${trend})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
