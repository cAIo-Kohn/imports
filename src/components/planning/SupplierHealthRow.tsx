import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Package, DollarSign, ChevronRight, AlertTriangle } from "lucide-react";
import { PeriodIndicator, type PeriodStats } from "./PeriodIndicator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface SupplierHealthRowData {
  supplier: {
    id: string;
    company_name: string;
    country: string;
  };
  stats: {
    totalProducts: number;
    periods: {
      underSixMonths: PeriodStats;
      sixToTwelveMonths: PeriodStats;
    };
    overallStatus: 'critical' | 'alert' | 'attention' | 'ok';
  };
  pendingOrders: {
    totalValue: number;
    nextArrival: string | null;
  };
}

interface SupplierHealthRowProps {
  data: SupplierHealthRowData;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const statusBorderColors = {
  critical: 'border-l-destructive',
  alert: 'border-l-orange-500',
  attention: 'border-l-yellow-500',
  ok: 'border-l-green-500',
};

export function SupplierHealthRow({ data }: SupplierHealthRowProps) {
  const navigate = useNavigate();
  const { supplier, stats, pendingOrders } = data;
  
  const hasCriticalOrAlert = stats.overallStatus === 'critical' || stats.overallStatus === 'alert';

  return (
    <Card 
      className={`
        group cursor-pointer transition-all duration-200
        hover:shadow-md hover:border-primary/30
        border-l-4 ${statusBorderColors[stats.overallStatus]}
      `}
      onClick={() => navigate(`/demand-planning/${supplier.id}`)}
    >
      <div className="flex items-center p-4 gap-4">
        {/* Supplier Info */}
        <div className="flex items-center gap-3 min-w-[220px] flex-shrink-0">
          <div className="p-2 rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold truncate">{supplier.company_name}</p>
              {hasCriticalOrAlert && (
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{supplier.country}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                {stats.totalProducts}
              </span>
            </div>
          </div>
        </div>

        {/* Period Indicators */}
        <div className="flex gap-2 flex-1 justify-center">
          <PeriodIndicator label="<6m" stats={stats.periods.underSixMonths} />
          <PeriodIndicator label="6-12m" stats={stats.periods.sixToTwelveMonths} />
        </div>

        {/* Pending Orders */}
        <div className="flex flex-col items-end gap-1 min-w-[120px] flex-shrink-0">
          {pendingOrders.totalValue > 0 ? (
            <>
              <div className="flex items-center gap-1 text-sm">
                <DollarSign className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{formatCurrency(pendingOrders.totalValue)}</span>
              </div>
              {pendingOrders.nextArrival && (
                <span className="text-xs text-muted-foreground">
                  Chega {format(new Date(pendingOrders.nextArrival), "dd MMM", { locale: ptBR })}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Sem pedidos</span>
          )}
        </div>

        {/* Arrow */}
        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
      </div>
    </Card>
  );
}
