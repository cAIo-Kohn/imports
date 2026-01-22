import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Bar, ComposedChart, Legend } from 'recharts';

interface MonthProjection {
  month: Date;
  monthLabel: string;
  initialStock: number;
  forecast: number;
  purchases: number;
  finalBalance: number;
  status: 'ok' | 'warning' | 'rupture';
}

interface ProjectionChartProps {
  projections: MonthProjection[];
}

export function ProjectionChart({ projections }: ProjectionChartProps) {
  const chartData = useMemo(() => {
    return projections.map(p => ({
      name: p.monthLabel,
      saldo: p.finalBalance,
      previsao: p.forecast,
      compras: p.purchases,
      status: p.status,
    }));
  }, [projections]);

  const minBalance = Math.min(...projections.map(p => p.finalBalance));
  const maxBalance = Math.max(...projections.map(p => p.finalBalance));
  const yMin = Math.min(minBalance - 100, 0);
  const yMax = maxBalance + 100;

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis 
            domain={[yMin, yMax]}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
            tickFormatter={(value) => value.toLocaleString('pt-BR')}
          />
          <Tooltip 
            formatter={(value: number, name: string) => [
              value.toLocaleString('pt-BR'),
              name === 'saldo' ? 'Saldo Final' : name === 'previsao' ? 'Previsão' : 'Compras'
            ]}
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              borderColor: 'hsl(var(--border))',
              borderRadius: '8px',
            }}
          />
          <Legend 
            formatter={(value) => 
              value === 'saldo' ? 'Saldo Final' : value === 'previsao' ? 'Previsão de Vendas' : 'Compras Programadas'
            }
          />
          <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeWidth={2} strokeDasharray="5 5" />
          <Bar 
            dataKey="compras" 
            fill="hsl(var(--primary))" 
            opacity={0.6}
            radius={[4, 4, 0, 0]}
          />
          <Area
            type="monotone"
            dataKey="saldo"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="hsl(var(--primary))"
            fillOpacity={0.1}
          />
          <Area
            type="monotone"
            dataKey="previsao"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1}
            strokeDasharray="5 5"
            fill="none"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
