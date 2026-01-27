import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ForecastInputProps {
  productId: string;
  monthKey: string;
  currentForecast: number;
  historyLastYear: number;
  onValueChange: (productId: string, monthKey: string, value: number) => void;
  canEdit?: boolean;
}

export const ForecastInput = memo(function ForecastInput({
  productId,
  monthKey,
  currentForecast,
  historyLastYear,
  onValueChange,
  canEdit = true,
}: ForecastInputProps) {
  const [localValue, setLocalValue] = useState(currentForecast.toString());
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with external value when it changes
  useEffect(() => {
    setLocalValue(currentForecast.toString());
  }, [currentForecast]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  }, []);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    const numValue = parseInt(localValue) || 0;
    if (numValue !== currentForecast) {
      onValueChange(productId, monthKey, numValue);
    }
  }, [localValue, currentForecast, onValueChange, productId, monthKey]);

  const handleClick = useCallback(() => {
    if (canEdit) {
      setIsEditing(true);
    }
  }, [canEdit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setLocalValue(currentForecast.toString());
      setIsEditing(false);
    }
  }, [handleBlur, currentForecast]);

  // Edit mode: show input
  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        min="0"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-16 h-6 text-xs p-1 text-center"
        placeholder="0"
      />
    );
  }

  // Trend indicator comparing forecast to history
  const showTrend = currentForecast > 0 && historyLastYear > 0;
  const trendUp = currentForecast > historyLastYear;
  const trendDown = currentForecast < historyLastYear;

  // Display mode
  return (
    <div 
      className={`flex items-center justify-center gap-0.5 min-h-[24px] px-1 py-0.5 rounded ${
        canEdit ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''
      }`}
      onClick={handleClick}
    >
      <span className="text-xs">
        {currentForecast > 0 ? currentForecast.toLocaleString('pt-BR') : '-'}
      </span>
      {showTrend && (
        trendUp ? (
          <TrendingUp className="h-3 w-3 text-orange-500" />
        ) : trendDown ? (
          <TrendingDown className="h-3 w-3 text-primary" />
        ) : null
      )}
    </div>
  );
});
