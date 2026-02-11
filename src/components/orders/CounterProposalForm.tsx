import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CounterProposalFormProps {
  fieldName: string;
  currentValue: string | null;
  onSubmit: (suggestedValue: string, justification: string) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function CounterProposalForm({ 
  fieldName, 
  currentValue, 
  onSubmit, 
  onCancel,
  isSubmitting 
}: CounterProposalFormProps) {
  const [suggestedValue, setSuggestedValue] = useState('');
  const [justification, setJustification] = useState('');

  const handleSubmit = async () => {
    if (!suggestedValue.trim()) return;
    await onSubmit(suggestedValue, justification);
  };

  const isDateField = fieldName === 'etd' || fieldName.includes('date');
  const isPriceField = fieldName.includes('price') || fieldName.includes('value');

  const getPlaceholder = () => {
    if (isDateField) return '';
    if (isPriceField) return 'Ex: 1.50';
    return 'Valor sugerido';
  };

  const formatCurrentValue = () => {
    if (!currentValue) return 'não definido';
    
    if (isDateField) {
      try {
        return format(new Date(currentValue), "dd/MM/yyyy", { locale: ptBR });
      } catch {
        return currentValue;
      }
    }
    
    if (isPriceField) {
      const num = parseFloat(currentValue);
      if (!isNaN(num)) {
        return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      }
    }
    
    return currentValue;
  };

  return (
    <div className="mt-3 p-4 border rounded-lg bg-background space-y-3">
      <div className="text-sm text-muted-foreground">
        Valor atual do ARC: <span className="font-medium text-foreground">{formatCurrentValue()}</span>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="suggested-value">Sugerir novo valor:</Label>
        {isDateField ? (
          <Input
            id="suggested-value"
            type="date"
            value={suggestedValue}
            onChange={(e) => setSuggestedValue(e.target.value)}
            className="w-full max-w-[200px]"
          />
        ) : isPriceField ? (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">$</span>
            <Input
              id="suggested-value"
              type="number"
              step="0.01"
              min="0"
              value={suggestedValue}
              onChange={(e) => setSuggestedValue(e.target.value)}
              placeholder={getPlaceholder()}
              className="w-full max-w-[150px]"
            />
          </div>
        ) : (
          <Input
            id="suggested-value"
            type="text"
            value={suggestedValue}
            onChange={(e) => setSuggestedValue(e.target.value)}
            placeholder={getPlaceholder()}
            className="w-full"
          />
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="justification">Justificativa (opcional):</Label>
        <Textarea
          id="justification"
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Explique por que você está sugerindo essa alteração..."
          className="min-h-[60px]"
        />
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          <X className="h-4 w-4 mr-1" />
          Cancelar
        </Button>
        <Button 
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitting || !suggestedValue.trim()}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-1" />
          )}
          Enviar ao ARC
        </Button>
      </div>
    </div>
  );
}
