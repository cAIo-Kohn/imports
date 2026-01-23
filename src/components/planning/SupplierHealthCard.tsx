import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HealthBar } from "./HealthBar";
import { TrendSparkline } from "./TrendSparkline";
import { Building2, Package, DollarSign, Calendar, ChevronRight, AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface StockTrendData {
  month: string;
  value: number;
}

export interface SupplierHealthData {
  supplier: {
    id: string;
    company_name: string;
    country: string;
  };
  stats: {
    totalProducts: number;
    criticalCount: number;
    warningCount: number;
    healthyCount: number;
  };
  pendingOrders: {
    totalValue: number;
    nextArrival: string | null;
  };
  stockTrend?: {
    data: StockTrendData[];
    trend: 'up' | 'down' | 'stable';
    percentChange: number;
  };
}

interface SupplierHealthCardProps {
  data: SupplierHealthData;
}

export function SupplierHealthCard({ data }: SupplierHealthCardProps) {
  const navigate = useNavigate();
  const { supplier, stats, pendingOrders } = data;
  
  const hasCritical = stats.criticalCount > 0;
  const hasWarning = stats.warningCount > 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card 
      className={`
        group relative overflow-hidden cursor-pointer transition-all duration-300
        hover:shadow-lg hover:scale-[1.02] hover:border-primary/50
        ${hasCritical ? 'border-destructive/50 bg-destructive/5' : ''}
        ${!hasCritical && hasWarning ? 'border-yellow-500/50 bg-yellow-500/5' : ''}
      `}
      onClick={() => navigate(`/demand-planning/${supplier.id}`)}
    >
      {/* Pulse indicator for critical */}
      {hasCritical && (
        <div className="absolute top-3 right-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
          </span>
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold truncate">
              {supplier.company_name}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{supplier.country}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Health Bar */}
        <HealthBar 
          critical={stats.criticalCount}
          warning={stats.warningCount}
          healthy={stats.healthyCount}
          showLabels
        />

        {/* Stock Trend Chart */}
        {data.stockTrend && data.stockTrend.data.length >= 2 && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Tendência de Estoque (3 meses)</span>
              <div className="flex items-center gap-1">
                {data.stockTrend.trend === 'up' && (
                  <>
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    <span className="text-xs font-medium text-green-500">
                      +{data.stockTrend.percentChange.toFixed(0)}%
                    </span>
                  </>
                )}
                {data.stockTrend.trend === 'down' && (
                  <>
                    <TrendingDown className="h-3 w-3 text-destructive" />
                    <span className="text-xs font-medium text-destructive">
                      {data.stockTrend.percentChange.toFixed(0)}%
                    </span>
                  </>
                )}
                {data.stockTrend.trend === 'stable' && (
                  <>
                    <Minus className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Estável
                    </span>
                  </>
                )}
              </div>
            </div>
            <TrendSparkline 
              data={data.stockTrend.data} 
              trend={data.stockTrend.trend}
            />
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{stats.totalProducts}</span>
            <span className="text-muted-foreground">produtos</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formatCurrency(pendingOrders.totalValue)}</span>
            <span className="text-muted-foreground text-xs">pendente</span>
          </div>

          {pendingOrders.nextArrival && (
            <div className="flex items-center gap-2 text-sm col-span-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Próxima chegada:</span>
              <span className="font-medium">
                {format(new Date(pendingOrders.nextArrival), "dd MMM yyyy", { locale: ptBR })}
              </span>
            </div>
          )}
        </div>

        {/* Alert badges */}
        {(hasCritical || hasWarning) && (
          <div className="flex gap-2 pt-1">
            {hasCritical && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {stats.criticalCount} ruptura{stats.criticalCount > 1 ? 's' : ''}
              </Badge>
            )}
            {hasWarning && (
              <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600 bg-yellow-500/10">
                <AlertTriangle className="h-3 w-3" />
                {stats.warningCount} atenção
              </Badge>
            )}
          </div>
        )}

        {/* Action button */}
        <Button 
          variant="ghost" 
          className="w-full justify-between group-hover:bg-primary/10 group-hover:text-primary"
        >
          Ver Projeção
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
