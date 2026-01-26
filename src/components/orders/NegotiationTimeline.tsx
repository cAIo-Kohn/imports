import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, User, Users } from 'lucide-react';
import type { OrderChange } from '@/hooks/useOrderChanges';

interface NegotiationTimelineProps {
  changes: OrderChange[];
  fieldName: string;
}

export function NegotiationTimeline({ changes, fieldName }: NegotiationTimelineProps) {
  if (changes.length <= 1) return null;

  const isDateField = fieldName === 'etd' || fieldName.includes('date');
  const isPriceField = fieldName.includes('price') || fieldName.includes('value');

  const formatValue = (value: string | null) => {
    if (!value) return 'não definido';
    
    if (isDateField) {
      try {
        return format(new Date(value), "dd/MM/yyyy", { locale: ptBR });
      } catch {
        return value;
      }
    }
    
    if (isPriceField) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      }
    }
    
    return value;
  };

  return (
    <div className="mt-2 space-y-1">
      <span className="text-xs text-muted-foreground font-medium">Histórico de negociação:</span>
      <div className="space-y-1 pl-2 border-l-2 border-muted">
        {changes.map((c) => (
          <div key={c.id} className="flex items-center gap-2 text-xs text-muted-foreground">
            {c.change_type === 'buyer_counter_proposal' ? (
              <Badge variant="secondary" className="text-xs py-0 px-1.5">
                <Users className="h-3 w-3 mr-1" />
                Buyer
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs py-0 px-1.5">
                <User className="h-3 w-3 mr-1" />
                Trader
              </Badge>
            )}
            <span className="flex items-center gap-1">
              {formatValue(c.old_value)}
              <ArrowRight className="h-3 w-3" />
              <span className="font-medium text-foreground">{formatValue(c.new_value)}</span>
            </span>
            <span className="text-muted-foreground/70">
              ({format(new Date(c.changed_at), "dd/MM HH:mm", { locale: ptBR })})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
